// Saca las capturas de pantalla que ilustran el manual, contra la app local.
// Corre dentro del contenedor `server`, que es donde está puppeteer:
//
//   IP=$(docker compose exec -T client hostname -i)
//   docker compose cp docs/manual-posventa-pdf/capturas.mjs server:/app/capturas.mjs
//   docker compose exec -T -w /app -e CAPTURA_FRONT="$IP:5173" server node capturas.mjs /tmp/capturas
//
// Dos cosas que no son obvias:
//   · El front vive en otro contenedor y no se le puede pegar por su IP: Vite
//     rechaza el Host y el CORS del server solo admite localhost y 127.0.0.1.
//     El proxy TCP de abajo deja al navegador entrar por 127.0.0.1, que las dos
//     cosas aceptan, mientras la API le queda en localhost:4000.
//   · La app arranca en modo oscuro y el manual se imprime en papel, así que se
//     fuerza el tema claro en el localStorage antes de navegar.
import fs from "node:fs";
import net from "node:net";
import puppeteer from "puppeteer";

const destino = process.argv[2] || "/tmp/capturas";
const PROYECTO = process.argv[3] || "cmrds6tf6000kofey68tnhwvl";
const FRONT = process.env.CAPTURA_FRONT || "172.18.0.2:5173";
const BASE = "http://127.0.0.1:5173";
const USER = process.env.CAPTURA_USER || "admin@voltiapm.com";
const PASS = process.env.CAPTURA_PASS || "Y1025Voltia";

fs.mkdirSync(destino, { recursive: true });

const [frontHost, frontPort] = FRONT.split(":");
const proxy = net.createServer((cliente) => {
  const arriba = net.connect(Number(frontPort), frontHost, () => cliente.pipe(arriba).pipe(cliente));
  arriba.on("error", () => cliente.destroy());
  cliente.on("error", () => arriba.destroy());
});
await new Promise((r) => proxy.listen(5173, "127.0.0.1", r));

const esperar = (ms) => new Promise((r) => setTimeout(r, ms));

const browser = await puppeteer.launch({
  headless: true,
  args: ["--no-sandbox", "--disable-setuid-sandbox", "--disable-dev-shm-usage"],
});
const page = await browser.newPage();
await page.setViewport({ width: 1440, height: 1000, deviceScaleFactor: 2 });

await page.goto(`${BASE}/login`, { waitUntil: "networkidle2", timeout: 60000 });
await page.waitForSelector("#email", { timeout: 20000 });
await page.type("#email", USER);
await page.type("#password", PASS);
await Promise.all([
  page.click('button[type="submit"]'),
  page.waitForNavigation({ waitUntil: "networkidle2", timeout: 60000 }).catch(() => {}),
]);
await esperar(4000);
if (page.url().includes("/login")) {
  console.error("NO ENTRÓ:", await page.$eval("body", (b) => b.innerText.slice(0, 200)).catch(() => "?"));
  await browser.close();
  proxy.close();
  process.exit(1);
}
await page.evaluate(() => localStorage.setItem("voltia-theme", "light"));
console.log("login ok, tema claro →", page.url());

// Devuelve el rectángulo de la tarjeta que contiene un texto: sube por los
// padres hasta dar con uno lo bastante alto como para ser la tarjeta entera.
async function recorteDe(texto, altoMinimo = 400) {
  return page.evaluate(
    (t, min) => {
      const nodos = [...document.querySelectorAll("h1,h2,h3,h4,div,span,button")];
      const hit = nodos.find((n) => n.textContent?.trim().startsWith(t) && n.children.length < 4);
      if (!hit) return null;
      let el = hit;
      while (el && el.getBoundingClientRect().height < min) el = el.parentElement;
      if (!el) return null;
      const r = el.getBoundingClientRect();
      return { x: r.x + window.scrollX, y: r.y + window.scrollY, width: r.width, height: r.height };
    },
    texto,
    altoMinimo,
  );
}

async function abrir(url, espera = 4000) {
  await page.goto(`${BASE}${url}`, { waitUntil: "networkidle2", timeout: 60000 });
  await esperar(espera);
  await page.evaluate(() => document.querySelectorAll("details:not([open])").forEach((d) => (d.open = true)));
  await esperar(900);
}

async function guardar(nombre, opciones = {}) {
  const archivo = `${destino}/${nombre}.png`;
  await page.screenshot({ path: archivo, ...opciones });
  console.log(`  ✓ ${nombre}`);
}

// 1. La ficha del cliente entera, y de ahí los dos recortes que pide el manual.
await abrir(`/clientes/${PROYECTO}`);
await guardar("ficha-cliente", { fullPage: true });

const ute = await recorteDe("Consulta enviada a UTE", 600);
if (ute) await guardar("tramite-ute", { clip: ute });
else console.log("  · no encontré el trámite UTE");

const recorrido = await recorteDe("E1 · De la venta a la obra", 300);
if (recorrido) await guardar("recorrido-etapas", { clip: recorrido });
else console.log("  · no encontré el recorrido de etapas");

// 2. El botón de plantillas abre el panel con los mensajes modelo.
try {
  const abrio = await page.evaluate(() => {
    const b = [...document.querySelectorAll("button")].find((x) => x.textContent?.trim() === "Plantillas");
    if (!b) return false;
    b.click();
    return true;
  });
  if (abrio) {
    await esperar(1800);
    await guardar("plantillas", { fullPage: false });
  } else console.log("  · no encontré el botón Plantillas");
} catch (e) {
  console.log("  · plantillas falló:", e.message);
}

// 3. Los pasos de E2 en un cliente que ya tiene la obra hecha y espera a UTE:
//    es la pantalla donde se apaga la alerta de "ya podés encender".
try {
  await abrir(`/clientes/${process.env.CAPTURA_PROYECTO_E2 || PROYECTO}`, 4000);
  // La tarjeta es un <button> y el rótulo lleva punto, no medio punto:
  // "E2. Habilitación".
  const abrioE2 = await page.evaluate(() => {
    const t = [...document.querySelectorAll("button")].find((x) =>
      /^E2[.·]/.test(x.textContent?.trim() || ""));
    if (!t) return false;
    t.click();
    return true;
  });
  await esperar(1800);
  if (abrioE2) {
    // Hay que anclar en el encabezado del bloque de pasos ("E2 · De la obra…"),
    // no en el nombre del paso: ese texto aparece antes, truncado, en la
    // tarjeta resumen de la etapa, y el recorte sale de ahí.
    const pasos = await recorteDe("E2 · De la obra", 200);
    if (pasos) await guardar("pasos-e2", { clip: pasos });
    else console.log("  · no encontré los pasos de E2");
  } else console.log("  · no encontré la tarjeta E2");
} catch (e) {
  console.error("  ✗ pasos-e2:", e.message);
}

// 4. El portal, como lo ve el cliente (modo previsualización).
try {
  await page.evaluate(
    (id, nombre) =>
      sessionStorage.setItem("voltia-portal-preview", JSON.stringify({ projectId: id, clientName: nombre })),
    PROYECTO,
    "Agroindustrial Sur S.A.",
  );
  await abrir(`/portal/${PROYECTO}`, 4000);
  await guardar("portal-cliente", { fullPage: true });
} catch (e) {
  console.error("  ✗ portal-cliente:", e.message);
}

// 5. Las pantallas sueltas.
for (const [nombre, url] of [
  ["listado-clientes", "/clientes"],
  ["calendario", "/calendario"],
  ["reportes-fv", "/clientes/reportes"],
]) {
  try {
    await abrir(url, 3500);
    await guardar(nombre, { fullPage: true });
  } catch (e) {
    console.error(`  ✗ ${nombre}:`, e.message);
  }
}

await browser.close();
proxy.close();

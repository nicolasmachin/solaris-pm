// Saca las capturas que el Manual de Trabajo usa y el de Posventa no tiene: el
// proyecto con su pipeline, la vista Recorrido, Mis tareas y el gabinete
// metálico. Las demás (ficha, calendario, portal, plantillas) se reusan del de
// Posventa. Corre en el contenedor `server`, igual que aquel:
//
//   IP=$(docker compose exec -T client hostname -i)
//   docker compose cp docs/manual-trabajo-pdf/capturas.mjs server:/app/capturas-trabajo.mjs
//   docker compose exec -T -w /app -e CAPTURA_FRONT="$IP:5173" server node capturas-trabajo.mjs /tmp/capturas-trabajo
//
// El proxy TCP y el tema claro forzado están explicados en
// docs/manual-posventa-pdf/capturas.mjs: sin ellos no entra o sale en oscuro.
import fs from "node:fs";
import net from "node:net";
import puppeteer from "puppeteer";

const destino = process.argv[2] || "/tmp/capturas-trabajo";
const PROYECTO = process.env.CAPTURA_PROYECTO || "cmrds6tf6000kofey68tnhwvl";
// Un proyecto que ya tiene gabinetes cargados, para no crear uno al capturar.
const PROYECTO_GABINETE = process.env.CAPTURA_PROYECTO_GABINETE || "cmrfmqk810001of2t1k63o2ep";
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
  console.error("NO ENTRÓ");
  await browser.close();
  proxy.close();
  process.exit(1);
}
await page.evaluate(() => localStorage.setItem("voltia-theme", "light"));

async function abrir(url, espera = 4000) {
  await page.goto(`${BASE}${url}`, { waitUntil: "networkidle2", timeout: 60000 });
  await esperar(espera);
  // Un traspaso pendiente abre un aviso encima de todo. Se cierra con
  // "Cancelar": no confirma ni pospone nada.
  for (let i = 0; i < 3; i++) {
    const cerro = await page.evaluate(() => {
      const b = [...document.querySelectorAll("button")].find((x) => x.textContent?.trim() === "Cancelar");
      if (!b) return false;
      b.click();
      return true;
    });
    if (!cerro) break;
    await esperar(800);
  }
}

async function guardar(nombre, opciones = {}) {
  await page.screenshot({ path: `${destino}/${nombre}.png`, ...opciones });
  console.log(`  ✓ ${nombre}`);
}

// Hace clic en el primer botón cuyo texto empieza con `texto`.
async function clic(texto) {
  const ok = await page.evaluate((t) => {
    const b = [...document.querySelectorAll("button")].find((x) => x.textContent?.trim().startsWith(t));
    if (!b) return false;
    b.click();
    return true;
  }, texto);
  await esperar(1800);
  return ok;
}

// 1. El proyecto: el pipeline de las ocho etapas y la fila de botones que
//    lleva al mismo cliente en los otros módulos.
try {
  await abrir(`/projects/${PROYECTO}`);
  await guardar("proyecto");
} catch (e) {
  console.error("  ✗ proyecto:", e.message);
}

// 2. La vista Recorrido de Experiencia Solar: una columna por etapa.
try {
  await abrir("/clientes/recorrido");
  await guardar("recorrido");
} catch (e) {
  console.error("  ✗ recorrido:", e.message);
}

// 3. Mis tareas.
try {
  await abrir("/mis-tareas");
  await guardar("mis-tareas");
} catch (e) {
  console.error("  ✗ mis-tareas:", e.message);
}

// 4. El gabinete metálico abierto: formulario a la izquierda y el plano que se
//    dibuja solo a la derecha. Se abre uno que ya existe ("Abrir"), nunca
//    "Nuevo gabinete", que crearía un registro.
try {
  await abrir(`/ingenieria/proyecto/${PROYECTO_GABINETE}`);
  if (!(await clic("Gabinete metálico"))) console.log("  · no encontré la herramienta Gabinete metálico");
  else if (!(await clic("Abrir"))) console.log("  · no encontré un gabinete para abrir");
  else {
    await esperar(1500);
    await guardar("gabinete");
  }
} catch (e) {
  console.error("  ✗ gabinete:", e.message);
}

// 5. Ventas: el pipeline en sus tres vistas y el panel de un lead.
try {
  await abrir("/ventas");
  await guardar("ventas-kanban");
  for (const vista of ["Priorizada", "Lista"]) {
    if (await clic(vista)) await guardar(`ventas-${vista.toLowerCase()}`);
    else console.log(`  · no encontré la vista ${vista}`);
  }
  await abrir("/ventas");
  // Abre el primer lead del Kanban para mostrar su panel.
  const abrio = await page.evaluate(() => {
    const t = [...document.querySelectorAll("*")].find(
      (x) => x.children.length === 0 && x.textContent?.trim() === "Juan Corbo");
    if (!t) return false;
    t.click();
    return true;
  });
  await esperar(2500);
  if (abrio) await guardar("ventas-lead");
  else console.log("  · no encontré un lead para abrir");
} catch (e) {
  console.error("  ✗ ventas:", e.message);
}

await browser.close();
proxy.close();

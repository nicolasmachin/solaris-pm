// Las capturas del Manual de trabajo de Administración y Finanzas: cada
// pantalla de Finanzas (sección 5 del manual) y Recursos Humanos (5.21), en
// modo oscuro. Corre en el contenedor `server`, igual que capturas-operaciones.mjs:
//
//   IP=$(docker compose exec -T client hostname -i)
//   docker compose cp docs/manual-trabajo-pdf/capturas-finanzas.mjs server:/app/capturas-fin.mjs
//   docker compose exec -T -w /app -e CAPTURA_FRONT="$IP:5173" server node capturas-fin.mjs /tmp/capturas-fin
//
// Nada de lo que hace modifica datos: solo abre pantallas.
import fs from "node:fs";
import net from "node:net";
import puppeteer from "puppeteer";

const destino = process.argv[2] || "/tmp/capturas-fin";
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
  args: ["--no-sandbox", "--disable-setuid-sandbox", "--disable-dev-shm-usage", "--no-zygote", "--disable-crash-reporter", "--disable-breakpad"],
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
await page.evaluate(() => localStorage.setItem("voltia-theme", "dark"));

async function cerrarAvisos() {
  // Un traspaso pendiente abre un aviso encima de todo: "Cancelar" no confirma nada.
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

async function abrir(url, espera = 4500) {
  await page.goto(`${BASE}${url}`, { waitUntil: "networkidle2", timeout: 60000 });
  await esperar(espera);
  await cerrarAvisos();
  // La barra de arriba es fija: en los recortes de una sección quedaba pintada
  // encima. Se la deja en su lugar para la captura.
  await page.addStyleTag({ content: "header, nav, [class*='sticky'] { position: relative !important; top: auto !important; }" });
}

async function guardar(nombre, opciones = {}) {
  await page.screenshot({ path: `${destino}/${nombre}.png`, ...opciones });
  console.log(`  ✓ ${nombre}`);
}

// La caja de la sección que contiene un texto: sube desde el texto hasta el
// primer contenedor ancho con borde o fondo propio. Devuelve el recorte en
// coordenadas de la página, con un margen.
async function cajaDe(texto, { minAlto = 120, margen = 12 } = {}) {
  return page.evaluate(
    (t, minAlto, margen) => {
      const hojas = [...document.querySelectorAll("h1,h2,h3,h4,span,div,p,button")].filter(
        (x) => x.childElementCount === 0 && x.textContent?.trim().startsWith(t),
      );
      const el = hojas[0];
      if (!el) return null;
      let n = el;
      while (n && n !== document.body) {
        const r = n.getBoundingClientRect();
        const cs = getComputedStyle(n);
        const tieneCaja = cs.borderTopWidth !== "0px" || (cs.backgroundColor !== "rgba(0, 0, 0, 0)" && cs.backgroundColor !== "transparent");
        if (r.width > 560 && r.height >= minAlto && tieneCaja) break;
        n = n.parentElement;
      }
      if (!n || n === document.body) return null;
      n.scrollIntoView({ block: "start" });
      const r = n.getBoundingClientRect();
      return {
        x: Math.max(0, r.left - margen),
        y: Math.max(0, r.top + window.scrollY - margen),
        width: Math.min(r.width + 2 * margen, document.documentElement.clientWidth),
        height: Math.min(r.height + 2 * margen, 2400),
      };
    },
    texto,
    minAlto,
    margen,
  );
}

async function seccion(nombre, texto, opciones) {
  const caja = await cajaDe(texto, opciones);
  if (!caja) {
    console.log(`  · no encontré "${texto}"`);
    return;
  }
  await esperar(900);
  await guardar(nombre, { clip: caja, captureBeyondViewport: true });
}

async function clic(texto, { exacto = false, selector = "button" } = {}) {
  const ok = await page.evaluate(
    (t, exacto, selector) => {
      const b = [...document.querySelectorAll(selector)].find((x) => {
        const s = x.textContent?.trim() ?? "";
        return exacto ? s === t : s.startsWith(t);
      });
      if (!b) return false;
      b.scrollIntoView({ block: "center" });
      b.click();
      return true;
    },
    texto,
    exacto,
    selector,
  );
  await esperar(2200);
  return ok;
}

async function intentar(nombre, fn) {
  if (process.env.CAPTURA_SOLO && !process.env.CAPTURA_SOLO.split(",").some((n) => n.startsWith(nombre))) return;
  try {
    await fn();
  } catch (e) {
    console.error(`  ✗ ${nombre}:`, e.message);
  }
}


// El aviso amarillo de descalce y el botón violeta del asistente salen en
// todas las pantallas y no son de lo que se explica: se esconden.
async function limpiar() {
  await page.evaluate(() => {
    const aviso = [...document.querySelectorAll("p,span,div")].find((x) => x.childElementCount === 0 && x.textContent?.startsWith("Hay un descalce"));
    let n = aviso;
    // Sube hasta el recuadro del aviso: el último contenedor cuyo padre ya es
    // más alto que un renglón (si sigue, esconde la pantalla entera).
    while (n && n.parentElement && n.parentElement.getBoundingClientRect().height < 80) n = n.parentElement;
    if (n) n.style.display = "none";
    for (const el of document.querySelectorAll("body *")) {
      const cs = getComputedStyle(el);
      if (cs.position === "fixed" && parseFloat(cs.bottom) < 80 && el.getBoundingClientRect().width < 120) el.style.display = "none";
    }
  });
  await esperar(500);
}

// Cambia un <select> o un <input> de React (por su posición entre los de su
// tipo) y avisa del cambio para que la pantalla se actualice.
async function poner(selector, indice, valor) {
  await page.evaluate((selector, indice, valor) => {
    // Solo los visibles: el menú de Finanzas para celular también es un <select>.
    const el = [...document.querySelectorAll(selector)].filter((x) => x.getClientRects().length > 0)[indice];
    if (!el) return;
    const proto = el.tagName === "SELECT" ? HTMLSelectElement.prototype : HTMLInputElement.prototype;
    Object.getOwnPropertyDescriptor(proto, "value").set.call(el, valor);
    el.dispatchEvent(new Event("input", { bubbles: true }));
    el.dispatchEvent(new Event("change", { bubbles: true }));
  }, selector, indice, valor);
  await esperar(2500);
}

// Las pantallas de Finanzas: una por sección del menú.
const FINANZAS = [
  ["fin-inicio", "/finanzas/inicio"],
  ["fin-cobros", "/finanzas/cobros"],
  ["fin-facturacion", "/finanzas/facturacion"],
  ["fin-facturas-proveedores", "/finanzas/facturas-proveedores"],
  ["fin-proveedores", "/finanzas/proveedores"],
  ["fin-instaladores", "/finanzas/instaladores"],
  ["fin-costos-fijos", "/finanzas/costos-fijos"],
  ["fin-comisiones", "/finanzas/comisiones"],
  ["fin-banco", "/finanzas/banco"],
  ["fin-tarjetas", "/finanzas/tarjetas"],
  ["fin-movimientos", "/finanzas/movimientos"],
  ["fin-cuentas", "/finanzas/cuentas"],
  ["fin-flujo", "/finanzas/flujo"],
  ["fin-resultados", "/finanzas/resultados"],
  ["fin-cierre", "/finanzas/cierre"],
  ["fin-historial", "/finanzas/historial"],
  ["fin-es-cobros", "/clientes/cobros"],
  ["fin-plan-granizo", "/clientes/plan-granizo"],
];
// CAPTURA_SOLO=fin-resultados,fin-tarjetas saca solo esas (para corregir una).
const SOLO = process.env.CAPTURA_SOLO?.split(",");
for (const [nombre, url] of FINANZAS) {
  if (SOLO && !SOLO.includes(nombre)) continue;
  await intentar(nombre, async () => {
    await abrir(url);
    await limpiar();
    // Las que arrancan en el mes en curso, vacío todavía: se pasan a octubre.
    if (nombre === "fin-banco") await poner('input[type="date"]', 0, "2026-10-01");
    if (nombre === "fin-resultados") await poner("select", 0, "10");
    if (nombre === "fin-tarjetas") await poner("select", 1, "10");
    if (nombre === "fin-facturacion") await clic("Todas", { exacto: true });
    await limpiar();
    await guardar(nombre);
  });
}

// El detalle de un cliente en Cobros: el primero de la lista.
await intentar("fin-cobro-detalle", async () => {
  await abrir("/finanzas/cobros");
  const href = await page.evaluate(() => [...document.querySelectorAll("a")].map((a) => a.getAttribute("href")).find((h) => h && /^\/finanzas\/cobros\/./.test(h)));
  if (!href) return console.log("  · no encontré un cliente en Cobros");
  await abrir(href);
  await limpiar();
  await guardar("fin-cobro-detalle");
});

// El detalle de un proveedor con facturas y pagos.
const PROVEEDOR = process.env.CAPTURA_PROVEEDOR || "cmohl58kv002jm50hibukx6ci";
await intentar("fin-proveedor-detalle", async () => {
  await abrir(`/finanzas/proveedores/${PROVEEDOR}`);
  await limpiar();
  await guardar("fin-proveedor-detalle");
});

// Recursos Humanos: cada pestaña, un legajo y Mi legajo.
await intentar("rrhh", async () => {
  await abrir("/rrhh");
  await guardar("rrhh-personas");
  for (const [nombre, texto] of [["rrhh-vencimientos", "Vencimientos"], ["rrhh-licencias", "Licencias"], ["rrhh-recibos", "Cargar recibos"]]) {
    if (await clic(texto, { exacto: true })) {
      await esperar(2500);
      await guardar(nombre);
    } else console.log(`  · no encontré la pestaña ${texto}`);
  }
});
// Un legajo: las filas de Personas no son links, se entra con un clic.
await intentar("rrhh-legajo", async () => {
  await abrir("/rrhh");
  if (!(await clic("Asesor Comercial", { exacto: true, selector: "td" }))) return console.log("  · no encontré un legajo");
  await esperar(4000);
  await guardar("rrhh-legajo");
});
await intentar("mi-legajo", async () => {
  await abrir("/mi-legajo");
  await guardar("rrhh-mi-legajo");
});

await browser.close();
proxy.close();

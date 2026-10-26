// Las capturas del Manual de trabajo de Ventas: el pipeline (Kanban y
// Priorizada), una tarjeta, el panel del lead, el constructor de la propuesta y
// la lista de propuestas, crear el proyecto, el onboarding (subetapas y
// modalidad de pago), la consulta a UTE y el bloque del contrato firmado. Corre
// en el contenedor `server`, igual que capturas-operaciones.mjs, en modo oscuro:
//
//   IP=$(docker compose exec -T client hostname -i)
//   docker compose cp docs/manual-trabajo-pdf/capturas-ventas.mjs server:/app/capturas-ventas.mjs
//   docker compose cp <pdf.html de abajo> server:/tmp/cv-pdf.html
//   docker compose exec -T -w /app -e CAPTURA_FRONT="$IP:5173" server node capturas-ventas.mjs /tmp/cv [paso,paso]
//
// Después: preparar-capturas-ventas.mjs las recorta, y se registran en
// capturas-ventas.json y assets-locales.json (id = md5 del archivo).
//
// Datos: el lead LEAD-2026-051 y su proyecto PRY-2026-092 de la base LOCAL (el
// 11-oct-2026 se les sumaron un comentario, un pendiente, datos del lead y los
// responsables de las subetapas; algunos leads se pasaron a Reclamado y Agendar
// visita para que el Kanban tenga todas las columnas). El paso "convertir"
// necesita el lead ganado SIN proyecto: antes de correrlo se pone en null
// "convertedToProjectId" del lead y después se restaura.
//
// No guarda nada: abre pantallas y ventanas. En la consulta a UTE escribe datos
// de ejemplo en el formulario (no lo manda) y desenfoca los datos de la firma
// instaladora. La vista previa de la propuesta es un PDF en un iframe, que
// Chrome sin pantalla no dibuja: se dibuja su primera página con pdf.js
// (/tmp/cv-pdf.html, que importa pdfjs-dist de /app/node_modules) y se pone en
// su lugar.
//
// /tmp/cv-pdf.html:
//   <!doctype html><html><body><script type="module">
//   import * as pdfjs from "file:///app/node_modules/pdfjs-dist/legacy/build/pdf.mjs";
//   pdfjs.GlobalWorkerOptions.workerSrc = "file:///app/node_modules/pdfjs-dist/legacy/build/pdf.worker.mjs";
//   window.render = async (b64, ancho) => {
//     const bin = atob(b64); const u = new Uint8Array(bin.length); for (let i = 0; i < bin.length; i++) u[i] = bin.charCodeAt(i);
//     const doc = await pdfjs.getDocument({ data: u, standardFontDataUrl: "file:///app/node_modules/pdfjs-dist/standard_fonts/" }).promise;
//     const pg = await doc.getPage(1); const v0 = pg.getViewport({ scale: 1 }); const vp = pg.getViewport({ scale: ancho / v0.width });
//     const c = document.createElement("canvas"); c.width = vp.width; c.height = vp.height;
//     await pg.render({ canvasContext: c.getContext("2d"), viewport: vp }).promise;
//     return c.toDataURL("image/png");
//   };
//   </script></body></html>
import net from "node:net";
import puppeteer from "puppeteer";
const esperar = (ms) => new Promise((r) => setTimeout(r, ms));
async function arrancar() {
  const FRONT = process.env.CAPTURA_FRONT || "172.18.0.4:5173";
  const [h, p] = FRONT.split(":");
  const proxy = net.createServer((c) => { const a = net.connect(Number(p), h, () => c.pipe(a).pipe(c)); a.on("error", () => c.destroy()); c.on("error", () => a.destroy()); });
  await new Promise((r) => proxy.listen(5173, "127.0.0.1", r));
  const browser = await puppeteer.launch({ headless: true, args: ["--allow-file-access-from-files", "--no-sandbox", "--disable-setuid-sandbox", "--disable-dev-shm-usage", "--no-zygote", "--disable-crash-reporter", "--disable-breakpad"] });
  const page = await browser.newPage();
  await page.setViewport({ width: 1440, height: 1000, deviceScaleFactor: 2 });
  await page.goto("http://127.0.0.1:5173/login", { waitUntil: "networkidle2", timeout: 60000 });
  await page.waitForSelector("#email");
  await page.type("#email", "admin@voltiapm.com"); await page.type("#password", "Y1025Voltia");
  await Promise.all([page.click('button[type="submit"]'), page.waitForNavigation({ waitUntil: "networkidle2", timeout: 60000 }).catch(() => {})]);
  await esperar(3000);
  await page.evaluate(() => localStorage.setItem("voltia-theme", "dark"));
  return { proxy, browser, page };
}

// Capturas del Manual de trabajo de Ventas (exploración + definitivas).
const { proxy, browser, page } = await arrancar();
const D = process.argv[2];
const solo = (process.argv[3] || "").split(",").filter(Boolean);
const LEAD = "cmqedulnm002oof0jzcg30r09", PROY = "cmsxy5kwl000qo70j2hys8sc5", RECL = "LEAD-2026-040";
const B = "http://127.0.0.1:5173";
async function abrir(url, ms = 4500) {
  await page.goto(B + url, { waitUntil: "networkidle2", timeout: 60000 });
  await esperar(ms);
  for (let i = 0; i < 3; i++) {
    const c = await page.evaluate(() => { const b = [...document.querySelectorAll("button")].find((x) => x.textContent?.trim() === "Cancelar"); if (!b) return false; b.click(); return true; });
    if (!c) break; await esperar(700);
  }
  await page.addStyleTag({ content: "header, nav, [class*='sticky'] { position: relative !important; top: auto !important; }" });
}
const g = async (n, o = {}) => { await page.screenshot({ path: `${D}/${n}.png`, ...o }); console.log("  ✓", n); };
async function clic(t, { exacto = false, sel = "button" } = {}) {
  const ok = await page.evaluate((t, e, s) => { const b = [...document.querySelectorAll(s)].find((x) => { const z = x.textContent?.replace(/\s+/g, " ").trim() ?? ""; return e ? z === t : z.startsWith(t); }); if (!b) return false; b.scrollIntoView({ block: "center" }); b.click(); return true; }, t, exacto, sel);
  await esperar(2200); if (!ok) console.log("  · no encontré", t); return ok;
}
// La caja (con borde o fondo) que contiene un texto.
async function caja(t, { minAlto = 80, minAncho = 300, margen = 10, sel = "h1,h2,h3,h4,span,div,p,button,label" } = {}) {
  return page.evaluate((t, minAlto, minAncho, m, sel) => {
    const el = [...document.querySelectorAll(sel)].find((x) => x.childElementCount === 0 && (x.textContent?.trim().startsWith(t) || x.textContent?.trim().toUpperCase().startsWith(t.toUpperCase())));
    if (!el) return null;
    let n = el;
    while (n && n !== document.body) { const r = n.getBoundingClientRect(); const cs = getComputedStyle(n); const tc = cs.borderTopWidth !== "0px" || (cs.backgroundColor !== "rgba(0, 0, 0, 0)"); if (r.width > minAncho && r.height >= minAlto && tc) break; n = n.parentElement; }
    if (!n || n === document.body) return null;
    n.scrollIntoView({ block: "start" });
    const r = n.getBoundingClientRect();
    return { x: Math.max(0, r.left - m), y: Math.max(0, r.top + window.scrollY - m), width: r.width + 2 * m, height: Math.min(r.height + 2 * m, 3000) };
  }, t, minAlto, minAncho, margen, sel);
}
async function seccion(n, t, o) { const c = await caja(t, o); if (!c) { console.log("  · sin caja", t); return; } await esperar(800); await g(n, { clip: c, captureBeyondViewport: true }); }
const quiere = (x) => !solo.length || solo.includes(x);

if (quiere("kanban")) { await page.setViewport({ width: 1920, height: 1000, deviceScaleFactor: 1.5 }); await abrir("/ventas"); await clic("Kanban", { exacto: true }); await g("ventas-pipeline-kanban"); await page.setViewport({ width: 1440, height: 1000, deviceScaleFactor: 2 }); }
if (quiere("priorizada")) { await abrir("/ventas"); await clic("Priorizada", { exacto: true }); await g("ventas-pipeline-priorizada"); }
if (quiere("tarjeta")) { await abrir("/ventas"); await clic("Kanban", { exacto: true }); await seccion("ventas-tarjeta-lead", "Diego Basualdo", { minAlto: 100, minAncho: 200 }); }
if (quiere("panel")) {
  await page.setViewport({ width: 1440, height: 1700, deviceScaleFactor: 2 });
  await abrir(`/ventas?lead=${LEAD}`);
  // La lista: las tres V2 más nuevas y las dos viejas (Excel), para que se vean las dos marcas.
  await page.evaluate(() => {
    const v = [...document.querySelectorAll("*")].find((x) => x.childElementCount === 0 && x.textContent?.trim() === "v15");
    let n = v; while (n && n.parentElement && n.parentElement.children.length < 5) n = n.parentElement;
    const hs = [...n.parentElement.children]; hs.slice(3, hs.length - 2).forEach((c) => (c.style.display = "none"));
  });
  await esperar(600);
  await seccion("ventas-lista-propuestas", "Propuestas comerciales", { minAncho: 400 });
  // Para el panel entero: solo las tres versiones más nuevas, así se ven las demás secciones.
  await page.evaluate(() => {
    const v = [...document.querySelectorAll("*")].find((x) => x.childElementCount === 0 && x.textContent?.trim() === "v15");
    let n = v; while (n && n.parentElement && n.parentElement.children.length < 5) n = n.parentElement;
    if (n && n.parentElement) [...n.parentElement.children].slice(3).forEach((c) => (c.style.display = "none"));
  });
  await esperar(600);
  await page.evaluate(() => document.querySelector("[role=dialog]")?.scrollTo?.(0, 0));
  await g("ventas-panel-lead");
  await seccion("ventas-presentacion-es", "PRESENTACIÓN DE EXPERIENCIA SOLAR", { minAncho: 400 });
  await page.setViewport({ width: 1440, height: 1000, deviceScaleFactor: 2 });
}
if (quiere("armar")) {
  await abrir(`/ventas?lead=${LEAD}`); await clic("Armar propuesta"); await esperar(9000);
  const datos = await page.evaluate(async () => {
    const f = document.querySelector('iframe[title="Preview de la propuesta"]'); if (!f) return null;
    const buf = await (await fetch(f.src)).arrayBuffer();
    let s = ""; const u = new Uint8Array(buf); for (let i = 0; i < u.length; i++) s += String.fromCharCode(u[i]);
    return { b64: btoa(s), w: f.getBoundingClientRect().width };
  });
  if (datos) {
    const p2 = await browser.newPage();
    await p2.goto("file:///tmp/cv-pdf.html");
    const png = await p2.evaluate(async (b64, w) => window.render(b64, w * 2), datos.b64, datos.w);
    await p2.close();
    await page.evaluate((png) => {
      const f = document.querySelector('iframe[title="Preview de la propuesta"]');
      const img = document.createElement("img"); img.src = png; img.style.cssText = "width:100%;display:block;background:#fff";
      const d = document.createElement("div"); d.style.cssText = "width:100%;height:100%;overflow:hidden;background:#fff"; d.appendChild(img);
      f.replaceWith(d);
    }, png);
  } else console.log("  · sin iframe de preview");
  await page.evaluate(() => { const b = [...document.querySelectorAll("button")].find((x) => x.textContent?.trim() === "Debug"); if (b) b.style.display = "none"; });
  await esperar(1500); await g("ventas-armar-propuesta");
}
if (quiere("convertir")) { await abrir(`/ventas?lead=${LEAD}`); await clic("Convertir a proyecto"); await esperar(2000); await g("ventas-crear-proyecto"); }
if (quiere("onboarding")) {
  await abrir(`/projects/${PROY}`);
  await g("proyecto-entero", { fullPage: true });
  const ok = await page.evaluate(() => { const t = [...document.querySelectorAll("*")].find((x) => x.childElementCount <= 2 && /^\d+\.\s*Onboarding$/.test(x.textContent?.replace(/\s+/g, " ").trim() ?? "")); if (!t) return false; let n = t; while (n && n !== document.body && getComputedStyle(n).cursor !== "pointer") n = n.parentElement; (n && n !== document.body ? n : t).click(); return true; });
  await esperar(2500); if (!ok) console.log("  · sin tarjeta Onboarding");
  await clic("Recolección de datos administrativos", { sel: "div.cursor-pointer" });
  await g("ventas-onboarding-subetapas");
  await clic("Recolección de datos administrativos", { sel: "div.cursor-pointer" });
  await clic("Modalidad de pago definida", { sel: "div.cursor-pointer" });
  await g("ventas-modalidad-pago");
}
if (quiere("contrato")) { await abrir(`/projects/${PROY}`); await seccion("ventas-contrato-firmado", "Contrato firmado", { minAncho: 400, minAlto: 100, sel: "h3" }); }
if (quiere("ute")) { await abrir(`/proyecto/${PROY}/consulta-ute`, 6000);
  // Datos de ejemplo en el formulario (no se envía ni se guarda nada).
  const poner = async (rotulo, valor) => {
    const h = await page.evaluateHandle((r) => {
      const l = [...document.querySelectorAll("label,span,div,p")].find((x) => x.childElementCount <= 1 && x.textContent?.trim().toUpperCase().replace(/\s*\*$/, "") === r.toUpperCase());
      if (!l) return null;
      let n = l; for (let i = 0; i < 4 && n; i++) { const inp = n.querySelector("input"); if (inp) return inp; n = n.parentElement; }
      return null;
    }, rotulo);
    const el = h.asElement(); if (!el) { console.log("  · sin campo", rotulo); return; }
    await el.click({ clickCount: 3 }); await page.keyboard.press("Backspace"); await el.type(valor, { delay: 5 });
  };
  await poner("C.I. / RUT", "4.567.890-1"); await poner("Cuenta UTE", "5501234567"); await poner("Teléfono", "099 123 456");
  await poner("Localidad", "Montevideo"); await poner("Calle", "Av. Italia"); await poner("Nro.", "4321");
  await poner("Pot. comprometida generador", "6");
  await esperar(1200);
  // Los datos de la firma instaladora (personales) se tapan con un desenfoque.
  await page.evaluate(() => {
    const st = [...document.querySelectorAll("strong,b")];
    const a = st.find((x) => x.textContent?.trim().startsWith("Razón Social")), b = st.find((x) => x.textContent?.trim().startsWith("Email"));
    if (!a || !b) return;
    const ra = a.getBoundingClientRect(), rb = b.getBoundingClientRect();
    const d = document.createElement("div");
    d.style.cssText = `position:absolute;left:${ra.left - 6 + scrollX}px;top:${ra.top - 4 + scrollY}px;width:560px;height:${rb.bottom - ra.top + 26}px;backdrop-filter:blur(7px);-webkit-backdrop-filter:blur(7px);z-index:9999;border-radius:6px`;
    document.body.appendChild(d);
  });
  await g("ventas-consulta-ute"); await g("ventas-consulta-ute-full", { fullPage: true }); }
await browser.close(); proxy.close();

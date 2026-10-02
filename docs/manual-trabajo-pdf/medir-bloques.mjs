// Mide de verdad cada bloque del PGT (párrafo, tabla, lista, aviso) dibujándolo
// con las fuentes reales en una columna del ancho útil de la hoja. contenido.py
// usa estas alturas para cortar las hojas, en vez de estimarlas: la estimación
// dejaba hojas medio vacías y tablas que se pasaban del borde.
//
//   node medir-bloques.mjs bloques.json alturas.json
//
// bloques.json = {"helmet": "...", "ancho": 650, "bloques": {"id": "<html>"}}
// alturas.json = {"id": {"h": 123, "filas": [h1, h2, ...], "cab": h}} — filas y
// cab solo en las tablas, para poder partirlas por fila.
import fs from "node:fs";
import puppeteer from "puppeteer";

const [entrada, salida] = process.argv.slice(2);
const { helmet, ancho, bloques } = JSON.parse(fs.readFileSync(entrada, "utf8"));
// Las imágenes viven en el canvas como /_blob/<id>: sin apuntarlas al archivo
// local miden cero y el bloque parece entrar cuando no entra.
const dirImgs = process.env.DIR_IMAGENES || "/tmp/mt/imagenes";
let mapa = {};
try { mapa = JSON.parse(fs.readFileSync(process.env.MAPA_ASSETS || "/tmp/mt/assets-locales.json", "utf8")); } catch {}
const conImagenes = (html) => html.replace(/\/_blob\/([0-9a-f]{32})/g, (t, id) => (mapa[id] ? `file://${dirImgs}/${mapa[id]}` : t));

const cuerpo = Object.entries(bloques)
  .map(([id, html]) => `<div class="b" data-id="${id}" style="display: flow-root">${conImagenes(html)}</div>`)
  .join("\n");
fs.writeFileSync("/tmp/medir-bloques.html",
  `<!doctype html><html><head><meta charset="utf-8">${helmet}</head>` +
  `<body style="margin:0"><div style="width:${ancho}px">${cuerpo}</div></body></html>`);

const browser = await puppeteer.launch({
  headless: true,
  args: ["--no-sandbox", "--disable-setuid-sandbox", "--disable-dev-shm-usage", "--allow-file-access-from-files"],
});
const page = await browser.newPage();
await page.setViewport({ width: 900, height: 1200 });
await page.goto("file:///tmp/medir-bloques.html", { waitUntil: "networkidle2", timeout: 60000 });
await page.evaluate(() => document.fonts.ready);
await new Promise((r) => setTimeout(r, 300));
const alturas = await page.evaluate(() => {
  const out = {};
  for (const b of document.querySelectorAll(".b")) {
    const r = { h: Math.ceil(b.getBoundingClientRect().height) };
    const t = b.querySelector("table");
    if (t) {
      r.cab = Math.ceil(t.tHead ? t.tHead.getBoundingClientRect().height : 0);
      r.filas = [...t.tBodies[0].rows].map((f) => Math.ceil(f.getBoundingClientRect().height));
    }
    out[b.dataset.id] = r;
  }
  return out;
});
await browser.close();
fs.writeFileSync(salida, JSON.stringify(alturas));
console.log(`${Object.keys(alturas).length} bloques medidos`);

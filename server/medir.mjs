// Dibuja cada hoja del manual con las fuentes reales y mide si se pasa del A4.
// Las fuentes van locales: el contenedor no llega a Google Fonts, y medir con
// otra tipografía da otra altura.
import fs from "node:fs";
import puppeteer from "puppeteer";

const [dir, fuentes, soloEstos] = [process.argv[2], process.argv[3], process.argv[4]];
const tmp = "/tmp/medir-html";
fs.mkdirSync(tmp, { recursive: true });
const browser = await puppeteer.launch({ headless: true, args: ["--no-sandbox", "--disable-setuid-sandbox", "--disable-dev-shm-usage", "--allow-file-access-from-files"] });
const page = await browser.newPage();
await page.setViewport({ width: 794, height: 1123 });
const archivos = fs.readdirSync(dir).filter((x) => x.endsWith(".dc.html") && (!soloEstos || soloEstos.split(",").includes(x))).sort();
for (const f of archivos) {
  const src = fs.readFileSync(`${dir}/${f}`, "utf8");
  const dc = src.slice(src.indexOf("<x-dc>") + 6, src.indexOf("</x-dc>"));
  let helmet = (dc.match(/<helmet>([\s\S]*?)<\/helmet>/) || [, ""])[1];
  helmet = helmet.replace(/<link[^>]*fonts\.googleapis[^>]*>/, `<link rel="stylesheet" href="file://${fuentes}/fonts-local.css">`);
  const cuerpo = dc.replace(/<helmet>[\s\S]*?<\/helmet>/, "");
  fs.writeFileSync(`${tmp}/${f}.html`, `<!doctype html><html><head><meta charset="utf-8">${helmet}</head><body>${cuerpo}</body></html>`);
  await page.goto(`file://${tmp}/${f}.html`, { waitUntil: "load", timeout: 15000 });
  await page.evaluate(() => document.fonts.ready);
  const r = await page.evaluate(() => {
    const root = document.body.firstElementChild;
    const cargadas = [...document.fonts].filter((x) => x.status === "loaded").length;
    return { alto: Math.round(root.scrollHeight), cargadas };
  });
  console.log(`${String(r.alto).padStart(5)} ${r.alto > 1123 ? "SE PASA" : "ok     "} fuentes:${r.cargadas} ${f}`);
}
await browser.close();

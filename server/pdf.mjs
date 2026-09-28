// Arma el PDF del manual completo con las hojas locales, sin pasar por el
// canvas. Sirve para mandar el manual por mail o imprimirlo; el canvas también
// exporta ("All artboards"), pero eso hay que hacerlo a mano desde la web.
//
//   docker compose exec -T -w /app server node pdf.mjs paginas/project /tmp/manual.pdf
//
// Las hojas van una por página: cada una ya mide 794×1123 y se separan con
// break-after. Nada de `height: 100vh`, que en impresión desborda a la hoja
// anterior.
import fs from "node:fs";
import puppeteer from "puppeteer";

const [dir, salida] = process.argv.slice(2);
const dirImgs = process.env.DIR_IMAGENES || "/app/imagenes";
const mapaAssets = JSON.parse(fs.readFileSync(process.env.MAPA_ASSETS || "/app/assets-locales.json", "utf8"));

const canvas = JSON.parse(fs.readFileSync(`${dir}/canvas.json`, "utf8"));
const orden = canvas.order.filter((f) => fs.existsSync(`${dir}/${f}`));
const faltan = canvas.order.filter((f) => !fs.existsSync(`${dir}/${f}`));
if (faltan.length) console.warn("! faltan y se saltean:", faltan.join(", "));

let helmet = "";
const hojas = orden.map((f) => {
  const src = fs.readFileSync(`${dir}/${f}`, "utf8");
  const dc = src.slice(src.indexOf("<x-dc>") + 6, src.indexOf("</x-dc>"));
  if (!helmet) helmet = (dc.match(/<helmet>([\s\S]*?)<\/helmet>/) || [, ""])[1];
  let cuerpo = dc.replace(/<helmet>[\s\S]*?<\/helmet>/, "");
  cuerpo = cuerpo.replace(/\/_blob\/([0-9a-f]{32})/g, (todo, id) =>
    mapaAssets[id] ? `file://${dirImgs}/${mapaAssets[id]}` : todo);
  return `<div class="hoja">${cuerpo}</div>`;
});

const html = `<!doctype html><html><head><meta charset="utf-8">${helmet}
<style>
  @page { size: 794px 1123px; margin: 0; }
  html, body { margin: 0; padding: 0; }
  .hoja { break-after: page; overflow: hidden; }
  .hoja:last-child { break-after: auto; }
</style></head><body>${hojas.join("\n")}</body></html>`;

fs.writeFileSync("/tmp/manual-completo.html", html);

const browser = await puppeteer.launch({
  headless: true,
  args: ["--no-sandbox", "--disable-setuid-sandbox", "--disable-dev-shm-usage", "--allow-file-access-from-files"],
});
const page = await browser.newPage();
await page.goto("file:///tmp/manual-completo.html", { waitUntil: "networkidle2", timeout: 120000 });
await page.evaluate(() => document.fonts.ready);
await new Promise((r) => setTimeout(r, 1500));
await page.pdf({
  path: salida,
  width: "794px",
  height: "1123px",
  printBackground: true,
  preferCSSPageSize: true,
});
await browser.close();
console.log(`${orden.length} hojas → ${salida}`);

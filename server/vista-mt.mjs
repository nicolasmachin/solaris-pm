// Dibuja hojas sueltas como PNG para mirarlas antes de dar el trabajo por
// bueno. Mismo truco que espacio.mjs con las imágenes: /_blob/<id> no resuelve
// fuera del artifact, así que se apunta a los archivos locales.
//
//   docker compose exec -T -w /app server node vista-previa.mjs paginas/project /tmp/vistas Main.dc.html,...
import fs from "node:fs";
import puppeteer from "puppeteer";

const [dir, salida, cuales] = process.argv.slice(2);
fs.mkdirSync(salida, { recursive: true });
const tmp = "/tmp/vista-html";
fs.mkdirSync(tmp, { recursive: true });
const dirImgs = process.env.DIR_IMAGENES || "/app/imagenes";
const mapaAssets = JSON.parse(fs.readFileSync(process.env.MAPA_ASSETS || "/app/assets-locales.json", "utf8"));

const browser = await puppeteer.launch({
  headless: true,
  args: ["--no-sandbox", "--disable-setuid-sandbox", "--disable-dev-shm-usage", "--allow-file-access-from-files"],
});
const page = await browser.newPage();
await page.setViewport({ width: 794, height: 1123, deviceScaleFactor: 2 });

for (const f of cuales.split(",")) {
  const src = fs.readFileSync(`${dir}/${f}`, "utf8");
  const dc = src.slice(src.indexOf("<x-dc>") + 6, src.indexOf("</x-dc>"));
  const helmet = (dc.match(/<helmet>([\s\S]*?)<\/helmet>/) || [, ""])[1];
  let cuerpo = dc.replace(/<helmet>[\s\S]*?<\/helmet>/, "");
  cuerpo = cuerpo.replace(/\/_blob\/([0-9a-f]{32})/g, (todo, id) =>
    mapaAssets[id] ? `file://${dirImgs}/${mapaAssets[id]}` : todo);
  fs.writeFileSync(`${tmp}/${f}.html`, `<!doctype html><html><head><meta charset="utf-8">${helmet}</head><body style="margin:0">${cuerpo}</body></html>`);
  await page.goto(`file://${tmp}/${f}.html`, { waitUntil: "networkidle2", timeout: 20000 });
  await page.evaluate(() => document.fonts.ready);
  await new Promise((r) => setTimeout(r, 400));
  await page.screenshot({ path: `${salida}/${f.replace(".dc.html", "")}.png` });
  console.log("  ✓", f);
}
await browser.close();

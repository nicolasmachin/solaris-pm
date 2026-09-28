// Cuánto aire libre le queda a cada hoja: el alto del spacer flex-grow que
// empuja el pie de página. Es lo que se puede gastar en una imagen sin que la
// hoja se pase de los 1123px del A4.
//
//   docker compose cp docs/manual-posventa-pdf/paginas server:/app/paginas
//   docker compose exec -T -w /app server node espacio.mjs paginas
import fs from "node:fs";
import puppeteer from "puppeteer";

const dir = process.argv[2];
const soloEstos = process.argv[3];
// Las imágenes viven en el canvas como /_blob/<id> y esa ruta no resuelve acá.
// Sin el archivo real la imagen mide cero y la hoja parece entrar cuando no
// entra, así que se apunta cada id a su archivo local antes de medir.
const dirImgs = process.env.DIR_IMAGENES || "/app/imagenes";
let mapaAssets = {};
try {
  mapaAssets = JSON.parse(fs.readFileSync(process.env.MAPA_ASSETS || "/app/assets-locales.json", "utf8"));
} catch {
  console.warn("! sin assets-locales.json: las imágenes van a medir cero");
}
const tmp = "/tmp/medir-html";
fs.mkdirSync(tmp, { recursive: true });

const browser = await puppeteer.launch({
  headless: true,
  args: ["--no-sandbox", "--disable-setuid-sandbox", "--disable-dev-shm-usage", "--allow-file-access-from-files"],
});
const page = await browser.newPage();
await page.setViewport({ width: 794, height: 1123 });

const archivos = fs
  .readdirSync(dir)
  .filter((x) => x.endsWith(".dc.html") && (!soloEstos || soloEstos.split(",").includes(x)))
  .sort();

for (const f of archivos) {
  const src = fs.readFileSync(`${dir}/${f}`, "utf8");
  const dc = src.slice(src.indexOf("<x-dc>") + 6, src.indexOf("</x-dc>"));
  const helmet = (dc.match(/<helmet>([\s\S]*?)<\/helmet>/) || [, ""])[1];
  let cuerpo = dc.replace(/<helmet>[\s\S]*?<\/helmet>/, "");
  cuerpo = cuerpo.replace(/\/_blob\/([0-9a-f]{32})/g, (todo, id) =>
    mapaAssets[id] ? `file://${dirImgs}/${mapaAssets[id]}` : todo);
  fs.writeFileSync(`${tmp}/${f}.html`, `<!doctype html><html><head><meta charset="utf-8">${helmet}</head><body>${cuerpo}</body></html>`);
  await page.goto(`file://${tmp}/${f}.html`, { waitUntil: "networkidle2", timeout: 20000 });
  await page.evaluate(() => document.fonts.ready);
  await new Promise((r) => setTimeout(r, 200));
  const r = await page.evaluate(() => {
    const root = document.body.firstElementChild;
    // El spacer es el hijo vacío con flex-grow que separa el contenido del pie.
    const spacers = [...root.querySelectorAll("div")].filter(
      (d) => getComputedStyle(d).flexGrow === "1" && d.children.length === 0 && !d.textContent.trim(),
    );
    const libre = spacers.reduce((max, d) => Math.max(max, d.getBoundingClientRect().height), 0);
    return { alto: Math.round(root.scrollHeight), libre: Math.round(libre) };
  });
  const estado = r.alto > 1123 ? "SE PASA" : "ok";
  console.log(`${String(r.alto).padStart(5)} ${estado.padEnd(8)} libre:${String(r.libre).padStart(4)}px  ${f}`);
}
await browser.close();

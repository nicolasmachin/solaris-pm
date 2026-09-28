// Mide cuánto ocupa cada tema del anexo, dibujado con el ancho y las fuentes reales.
import fs from "node:fs";
import puppeteer from "puppeteer";
const temas = JSON.parse(fs.readFileSync(process.argv[2], "utf8"));
const fuentes = process.argv[3];
const browser = await puppeteer.launch({ headless: true, args: ["--no-sandbox", "--disable-setuid-sandbox", "--disable-dev-shm-usage", "--allow-file-access-from-files"] });
const page = await browser.newPage();
await page.setViewport({ width: 794, height: 1123 });
const cuerpo = Object.entries(temas).map(([n, html]) => `<div id="t${n}">${html}</div>`).join("");
fs.writeFileSync("/tmp/temas.html", `<!doctype html><html><head><meta charset="utf-8"><link rel="stylesheet" href="file://${fuentes}/fonts-local.css"><style>body{margin:0;font-family:'Source Serif 4',Georgia,serif}</style></head><body><div style="width:794px;box-sizing:border-box;padding:0 72px">${cuerpo}</div></body></html>`);
await page.goto("file:///tmp/temas.html", { waitUntil: "load" });
await page.evaluate(() => document.fonts.ready);
const alturas = await page.evaluate((ids) => Object.fromEntries(ids.map((n) => [n, Math.ceil(document.getElementById("t" + n).getBoundingClientRect().height)])), Object.keys(temas));
console.log(JSON.stringify(alturas));
await browser.close();

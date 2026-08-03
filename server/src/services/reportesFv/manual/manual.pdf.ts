// Genera el PDF del manual de uso: portada con marca Voltia + versión, contenido
// (Markdown → HTML) y changelog. Reusa el renderer Puppeteer de efpPdf/v2 y el
// logo embebido del reporte.

import { marked } from "marked";

import { renderHtmlToPdf } from "../../efpPdf/v2/pdfRenderer.js";
import { LOGO_VOLTIA_DATA_URI } from "../pdf/logo.js";
import { MANUAL_ACTUALIZADO, MANUAL_CAMBIOS, MANUAL_MARKDOWN, MANUAL_VERSION } from "./manual.content.js";

marked.setOptions({ gfm: true, breaks: false });

const ESTILOS = String.raw`
  @page { size: A4; margin: 18mm 16mm; }
  * { box-sizing: border-box; }
  body { font-family: Arial, Helvetica, sans-serif; color: #1f2937; font-size: 12.5px; line-height: 1.6; margin: 0; }
  .cover { text-align: center; padding: 60px 0 40px; border-bottom: 3px solid #0a4f86; margin-bottom: 28px; page-break-after: avoid; }
  .cover img { max-width: 240px; max-height: 90px; }
  .cover h1 { color: #0a4f86; font-size: 26px; margin: 24px 0 6px; }
  .cover .sub { color: #4b5563; font-size: 14px; }
  .cover .ver { display: inline-block; margin-top: 18px; padding: 5px 14px; background: #eaf3fb; color: #0a4f86; border-radius: 999px; font-size: 12px; font-weight: 700; }
  h2 { color: #0a4f86; font-size: 17px; margin: 26px 0 8px; padding-bottom: 4px; border-bottom: 1px solid #d7dee6; page-break-after: avoid; }
  h3 { color: #083e69; font-size: 14px; margin: 16px 0 6px; page-break-after: avoid; }
  p { margin: 8px 0; }
  ul, ol { margin: 8px 0; padding-left: 22px; }
  li { margin: 4px 0; }
  strong { color: #111827; }
  hr { border: none; border-top: 1px solid #e5e7eb; margin: 22px 0; }
  code { background: #f1f5f9; padding: 1px 5px; border-radius: 4px; font-size: 12px; }
  .changelog { margin-top: 30px; padding-top: 14px; border-top: 2px solid #0a4f86; page-break-before: auto; }
  .changelog h2 { border: none; }
  .changelog .rel { margin-bottom: 10px; }
  .changelog .rel-head { font-weight: 700; color: #083e69; }
  .footer { margin-top: 24px; padding-top: 10px; border-top: 1px solid #e5e7eb; text-align: center; font-size: 10.5px; color: #6b7280; }
`;

function changelogHtml(): string {
  const items = MANUAL_CAMBIOS.map(
    (c) =>
      `<div class="rel"><div class="rel-head">v${esc(c.version)} · ${esc(c.fecha)}</div>` +
      `<ul>${c.cambios.map((x) => `<li>${esc(x)}</li>`).join("")}</ul></div>`,
  ).join("");
  return `<div class="changelog"><h2>Historial de versiones del manual</h2>${items}</div>`;
}

function esc(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

export async function generarManualPdf(): Promise<Buffer> {
  const contenido = marked.parse(MANUAL_MARKDOWN, { async: false }) as string;

  const html = `<!DOCTYPE html><html lang="es"><head><meta charset="utf-8">
<title>Manual de uso — Reportes Fotovoltaicos</title><style>${ESTILOS}</style></head>
<body>
  <div class="cover">
    <img src="${LOGO_VOLTIA_DATA_URI}" alt="Voltia">
    <h1>Reportes Fotovoltaicos</h1>
    <div class="sub">Manual de uso de la herramienta</div>
    <div class="ver">Versión ${MANUAL_VERSION} · ${MANUAL_ACTUALIZADO}</div>
  </div>
  ${contenido}
  ${changelogHtml()}
  <div class="footer">Voltia · Manual de Reportes Fotovoltaicos v${MANUAL_VERSION} · voltia.com.uy</div>
</body></html>`;

  return renderHtmlToPdf(html, {
    displayHeaderFooter: false,
    margin: { top: "0", right: "0", bottom: "0", left: "0" },
  });
}

export { MANUAL_VERSION, MANUAL_ACTUALIZADO } from "./manual.content.js";

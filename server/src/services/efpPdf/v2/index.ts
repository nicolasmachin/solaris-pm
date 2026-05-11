// Generador EFP v2 — entrada pública.
// Reescribe el generador viejo (efpPdf/index.ts, pdfkit imperativo) usando
// Puppeteer + HTML/CSS. Arregla:
//   - Páginas vacías por interacción rara entre pdfkit auto-pagination y el
//     listener de pageAdded.
//   - Ligadura "fi" rota (Roboto-Regular.ttf con glyph mal embebido).
//   - Banner "9 × 5 kWW" — el campo viene del snapshot Int (Fase A) y la
//     potencia total es derivada (computed) no IA.
//   - Estado UTE / código de proyecto mostrados en la cabecera del PDF —
//     este generador NO los muestra (decisión de producto).
//
// Lee SIEMPRE de los snapshots de EFPVersion (Fase A), nunca de DB en vivo.

import { buildEFPPdfInput } from "./dataLoader.js";
import { renderHtmlToPdf } from "./pdfRenderer.js";
import { buildFooterHtml, buildHeaderHtml, renderEFPHtml } from "./template.html.js";

export async function generateEFPPdfV2(versionId: string): Promise<Buffer> {
  const input = await buildEFPPdfInput(versionId);
  const html = renderEFPHtml(input);
  const header = buildHeaderHtml(input);
  const footer = buildFooterHtml();
  return renderHtmlToPdf(html, { headerHtml: header, footerHtml: footer });
}

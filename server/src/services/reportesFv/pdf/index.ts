// Generador del PDF del reporte fotovoltaico: view-model → Buffer.
//
// Reusa el renderer Puppeteer de efpPdf/v2 (misma instancia de Chromium para
// todo el server). El template ya trae su propio layout A4 con @page y márgenes,
// así que se renderiza a sangre (sin header/footer de Puppeteer, margen 0).

import { renderHtmlToPdf } from "../../efpPdf/v2/pdfRenderer.js";
import { renderReporteFvHtml } from "./template.html.js";
import type { ReporteFvPdfInput } from "./types.js";

const MARGEN_CERO = { top: "0", right: "0", bottom: "0", left: "0" };

export async function generarReporteFvPdf(input: ReporteFvPdfInput): Promise<Buffer> {
  const html = renderReporteFvHtml(input);
  return renderHtmlToPdf(html, { displayHeaderFooter: false, margin: MARGEN_CERO });
}

export { renderReporteFvHtml } from "./template.html.js";
export type { ReporteFvPdfInput } from "./types.js";

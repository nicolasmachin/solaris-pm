// PDF de una cotización a medida: template HTML → Puppeteer (mismo renderer que
// la proforma y el EFP).

import { renderHtmlToPdf } from "../efpPdf/v2/pdfRenderer.js";
import { MARGEN_PAGINA, renderCotizacionHtml, type CotizacionPdfData } from "./template.js";

export async function generarCotizacionPdf(d: CotizacionPdfData): Promise<Buffer> {
  return renderHtmlToPdf(renderCotizacionHtml(d), { displayHeaderFooter: false, margin: MARGEN_PAGINA });
}

/** "Cotizacion_Voltia_2026-006_Ruben_Penedo.pdf" */
export function nombreArchivo(numero: string | null, cliente: string): string {
  const limpio = cliente
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^A-Za-z0-9]+/g, "_")
    .replace(/^_|_$/g, "");
  return `Cotizacion_Voltia_${numero ?? "borrador"}_${limpio || "cliente"}.pdf`;
}

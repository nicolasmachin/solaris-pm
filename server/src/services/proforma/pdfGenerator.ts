// Generador del PDF de la proforma: data → HTML (template) → PDF (Puppeteer).
// Diseño full-bleed (olas a sangre): margen 0 y sin header/footer.

import { renderHtmlToPdf } from "../efpPdf/v2/pdfRenderer.js";
import type { ProformaDataPublish } from "./schemas/proforma.schema.js";
import { renderProformaHtml } from "./template.js";

export async function generateProformaPdf(data: ProformaDataPublish): Promise<Buffer> {
  const html = renderProformaHtml(data);
  return renderHtmlToPdf(html, {
    displayHeaderFooter: false,
    margin: { top: "0", right: "0", bottom: "0", left: "0" },
  });
}

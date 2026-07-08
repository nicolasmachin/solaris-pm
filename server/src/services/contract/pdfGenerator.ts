// Generador del PDF del contrato: data → HTML (template) → PDF (Puppeteer).
// Reutiliza el wrapper Puppeteer del EFP v2 (browser memoizado) para no levantar
// una tercera instancia de Chromium.

import { renderHtmlToPdf } from "../efpPdf/v2/pdfRenderer.js";
import type { ContractDataPublish } from "./schemas/contract.schema.js";
import { buildFooterHtml, buildHeaderHtml, renderContractHtml } from "./template.js";

export async function generateContractPdf(data: ContractDataPublish): Promise<Buffer> {
  const html = renderContractHtml(data);
  return renderHtmlToPdf(html, {
    headerHtml: buildHeaderHtml(),
    footerHtml: buildFooterHtml(),
  });
}

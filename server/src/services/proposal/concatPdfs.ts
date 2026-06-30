// Concatena varios PDFs (en orden) en uno solo. Usado para pegar la tapa (con
// overlay) delante del cuerpo de la propuesta generado con Puppeteer.

import { PDFDocument } from "pdf-lib";

export async function concatPdfs(...pdfs: Buffer[]): Promise<Buffer> {
  const finalPdf = await PDFDocument.create();

  for (const pdfBytes of pdfs) {
    const pdf = await PDFDocument.load(pdfBytes, { ignoreEncryption: true });
    const pages = await finalPdf.copyPages(pdf, pdf.getPageIndices());
    pages.forEach((p) => finalPdf.addPage(p));
  }

  const finalBytes = await finalPdf.save();
  return Buffer.from(finalBytes);
}

// Merge real de adjuntos PDF al PDF principal del EFP.
// Reglas:
//   - Solo PDFs (mimeType === "application/pdf"). Imágenes y otros tipos
//     se ignoran del merge — la página separadora "ANEXO X" que generó
//     Puppeteer queda como referencia visual, pero no se appendea contenido.
//   - Adjuntos rotos / no-cargables NO abortan el merge. Se loguea el error
//     y se sigue con los siguientes (resilencia > perfección).
//   - NO se reescala el page size del adjunto: si trae Letter, queda Letter
//     en el PDF final. Decisión consciente — reescalar complica mucho.
//   - El orden de los adjuntos lo decide el caller (createdAt asc en el
//     dataLoader).

import { promises as fsPromises } from "node:fs";

import { PDFDocument } from "pdf-lib";

export type AttachmentForMerge = {
  fileAttachmentId: string;
  filePath: string; // path absoluto en filesystem
  mimeType: string;
  label: string; // "Anexo A", "Anexo B", ...
  title: string; // descripción legible o filename
};

export async function mergePdfWithAttachments(
  mainPdf: Buffer,
  attachments: AttachmentForMerge[],
): Promise<Buffer> {
  if (attachments.length === 0) return mainPdf;

  const merged = await PDFDocument.load(mainPdf);

  for (const att of attachments) {
    if (att.mimeType !== "application/pdf") {
      // Ignoramos imágenes y otros tipos. El separador "ANEXO X" ya quedó
      // en el PDF principal — sigue siendo informativo.
      continue;
    }

    try {
      const attBytes = await fsPromises.readFile(att.filePath);
      const attDoc = await PDFDocument.load(attBytes, { ignoreEncryption: true });
      const pageCount = attDoc.getPageCount();
      if (pageCount === 0) {
        // PDF vacío — saltar.
        continue;
      }
      const pages = await merged.copyPages(attDoc, attDoc.getPageIndices());
      for (const p of pages) merged.addPage(p);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      console.error(
        `[efp-merge] fallo al fusionar ${att.label} (${att.fileAttachmentId}): ${msg}`,
      );
      // Continuar con los demás adjuntos — un PDF roto no debería romper
      // todo el documento.
    }
  }

  const out = await merged.save();
  return Buffer.from(out);
}

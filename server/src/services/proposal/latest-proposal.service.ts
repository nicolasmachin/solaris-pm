// Herencia lead → proyecto de la última propuesta comercial PUBLISHED.
//
// Dos usos, ambos sobre la misma "última versión publicada del lead":
//   - copyLatestProposalToProject: al convertir, copia sus dos PDF como
//     FileAttachment del proyecto (la propuesta v2 guarda los PDF sueltos en
//     disco, sin FileAttachment, por eso copyLeadAttachmentsToProject no la ve).
//   - getLatestPublishedQuote: la cotización y potencia del snapshot, para
//     pre-cargar el modal de conversión (mismo criterio que la comisión y los
//     contratos: `totalFinalConIva ?? totalConIva`).

import { FileAttachmentTipo } from "@prisma/client";

import { prisma } from "../../lib/prisma.js";
import { saveBufferAsAttachment } from "../file-storage.service.js";
import { readVersionPdf } from "./proposal-storage.js";

/** Snapshot parcial: solo lo que necesitamos leer, tolerante a lo demás. */
type SnapshotShape = {
  calc?: Record<string, unknown>;
  data?: { sistema?: Record<string, unknown> };
};

function num(v: unknown): number | null {
  const n = typeof v === "string" ? Number(v) : typeof v === "number" ? v : null;
  return n != null && Number.isFinite(n) ? n : null;
}

export interface LatestQuote {
  potenciaKwp: number | null;
  precioUsd: number | null;
  versionNumber: number;
}

/**
 * Cotización (USD con IVA) y potencia (kWp) de la última propuesta publicada del
 * lead. Devuelve null si el lead no tiene ninguna versión publicada.
 */
export async function getLatestPublishedQuote(leadId: string): Promise<LatestQuote | null> {
  const version = await prisma.proposalV2Version.findFirst({
    where: { leadId, status: "PUBLISHED", discardedAt: null },
    orderBy: { versionNumber: "desc" },
    select: { snapshot: true, versionNumber: true },
  });
  if (!version) return null;

  const snap = version.snapshot as SnapshotShape | null;
  const calc = snap?.calc ?? {};
  const sistema = snap?.data?.sistema ?? {};

  let potenciaKwp = num(calc.potenciaTotalKwp);
  if (potenciaKwp == null) {
    const cantidad = num(sistema.cantidadPaneles);
    const potenciaPanelW = num(sistema.potenciaPanelW);
    if (cantidad != null && potenciaPanelW != null) {
      potenciaKwp = Math.round((cantidad * potenciaPanelW) / 10) / 100;
    }
  }

  const precioUsd = num(calc.totalFinalConIva) ?? num(calc.totalConIva);

  return { potenciaKwp, precioUsd, versionNumber: version.versionNumber };
}

/**
 * Copia los dos PDF (completa + resumen) de la última propuesta publicada del
 * lead como FileAttachment (tipo PRESUPUESTO) del proyecto. Best-effort por PDF:
 * si un archivo físico no está, lo saltea sin romper. No borra la propuesta del
 * lead. Devuelve cuántos PDF se copiaron (0, 1 o 2).
 */
export async function copyLatestProposalToProject(
  leadId: string,
  projectId: string,
  userId: string,
): Promise<{ copied: number }> {
  const version = await prisma.proposalV2Version.findFirst({
    where: { leadId, status: "PUBLISHED", discardedAt: null },
    orderBy: { versionNumber: "desc" },
    select: { id: true, versionNumber: true, fullPdfPath: true, summaryPdfPath: true },
  });
  if (!version) return { copied: 0 };

  const targets = [
    { path: version.fullPdfPath, filename: `Propuesta comercial v${version.versionNumber}.pdf` },
    { path: version.summaryPdfPath, filename: `Propuesta comercial (resumen) v${version.versionNumber}.pdf` },
  ];

  let copied = 0;
  for (const target of targets) {
    if (!target.path) continue;
    let buffer: Buffer;
    try {
      buffer = await readVersionPdf(target.path);
    } catch {
      // Archivo físico ausente (raro): saltamos este PDF sin abortar.
      continue;
    }

    const saved = await saveBufferAsAttachment(buffer, target.filename, "application/pdf", projectId);
    await prisma.fileAttachment.create({
      data: {
        projectId,
        leadId: null,
        filename: saved.filename,
        storedFilename: saved.storedFilename,
        mimeType: saved.mimeType,
        sizeBytes: saved.sizeBytes,
        url: saved.url,
        tipo: FileAttachmentTipo.PRESUPUESTO,
        toolSource: "PropuestaComercial",
        toolVersion: version.versionNumber,
        toolEntityId: version.id,
        uploadedById: userId,
      },
    });
    copied++;
  }

  return { copied };
}

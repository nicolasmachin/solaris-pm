/**
 * Documentos comerciales generados (contrato, proforma, condiciones del Plan de
 * Protección contra Granizo) como adjuntos del proyecto.
 *
 * Cada una de esas herramientas guarda el PDF de sus versiones en su propia
 * carpeta (`pdfPath` de ContractVersion / ProformaVersion / PlanGranizoVersion)
 * y hasta oct-2026 no creaba un FileAttachment: el documento no aparecía en
 * "Documentos" del proyecto y quien no entraba a la herramienta no lo veía.
 *
 * Criterio (mismo que Unifilar, Pre-ingeniería y Justificación de potencia): en
 * Documentos queda **solo la versión vigente** de cada documento, es decir la
 * última publicada y no descartada. Las anteriores siguen en la herramienta.
 *
 * `sincronizarDocumentoGenerado()` es idempotente: deja el adjunto alineado con
 * la versión vigente (lo crea copiando el PDF, retira los que sobran, o no hace
 * nada si ya está). La llaman la publicación, el descarte y la restauración de
 * cada herramienta, y el backfill `prisma/scripts/backfill-documentos-generados.ts`.
 */

import { promises as fsPromises } from "node:fs";

import { FileAttachmentTipo, Prisma } from "@prisma/client";

import { prisma } from "../lib/prisma.js";
import { contractPdfFilename } from "./contract/filename.js";
import { deleteStoredFile, getStoredFilePath, saveBufferAsAttachment } from "./file-storage.service.js";
import { proformaPdfFilename } from "./proforma/filename.js";
import { tituloPlan } from "./seguro-granizo/documento/template.js";

export const TOOL_SOURCE_CONTRATO = "contrato";
export const TOOL_SOURCE_PROFORMA = "proforma";
export const TOOL_SOURCE_PLAN_GRANIZO = "plan-granizo";
/** El contrato firmado por el cliente, subido a mano (no es un documento generado). */
export const TOOL_SOURCE_CONTRATO_FIRMADO = "contrato-firmado";

export type DocumentoGenerado =
  | typeof TOOL_SOURCE_CONTRATO
  | typeof TOOL_SOURCE_PROFORMA
  | typeof TOOL_SOURCE_PLAN_GRANIZO;

export const DOCUMENTOS_GENERADOS: DocumentoGenerado[] = [
  TOOL_SOURCE_CONTRATO,
  TOOL_SOURCE_PROFORMA,
  TOOL_SOURCE_PLAN_GRANIZO,
];

const NOMBRE: Record<DocumentoGenerado, string> = {
  [TOOL_SOURCE_CONTRATO]: "Contrato",
  [TOOL_SOURCE_PROFORMA]: "Proforma",
  [TOOL_SOURCE_PLAN_GRANIZO]: "Plan de Protección",
};

/**
 * Rótulo en español de un adjunto comercial ("Contrato v2", "Proforma v1",
 * "Plan de Protección v1", "Contrato firmado"). `null` si el toolSource no es
 * de estos: quien llama sigue con su propia lógica.
 */
export function etiquetaDocumentoComercial(
  toolSource: string | null,
  toolVersion: number | null,
): string | null {
  if (toolSource === TOOL_SOURCE_CONTRATO_FIRMADO) return "Contrato firmado";
  if (toolSource && toolSource in NOMBRE) {
    const nombre = NOMBRE[toolSource as DocumentoGenerado];
    return toolVersion ? `${nombre} v${toolVersion}` : nombre;
  }
  return null;
}

type VersionVigente = {
  id: string;
  versionNumber: number;
  pdfPath: string;
  publishedById: string;
  filename: string;
};

function nombreCliente(snapshot: Prisma.JsonValue): string {
  const snap = snapshot as { data?: { cliente?: { nombre?: string } } } | null;
  return snap?.data?.cliente?.nombre ?? "Cliente";
}

async function versionVigente(
  kind: DocumentoGenerado,
  projectId: string,
): Promise<VersionVigente | null> {
  const where = { projectId, status: "PUBLISHED" as const };
  const orderBy = { versionNumber: "desc" as const };
  const select = { id: true, versionNumber: true, pdfPath: true, publishedById: true, snapshot: true };

  if (kind === TOOL_SOURCE_CONTRATO) {
    const v = await prisma.contractVersion.findFirst({ where, orderBy, select });
    return v && { ...v, filename: contractPdfFilename(nombreCliente(v.snapshot), v.versionNumber) };
  }
  if (kind === TOOL_SOURCE_PROFORMA) {
    const v = await prisma.proformaVersion.findFirst({ where, orderBy, select });
    return v && { ...v, filename: proformaPdfFilename(nombreCliente(v.snapshot), v.versionNumber) };
  }
  const v = await prisma.planGranizoVersion.findFirst({ where, orderBy, select });
  if (!v) return null;
  const snap = v.snapshot as { data?: { plan?: { incluyeVandalismo?: boolean } } } | null;
  const limpio = nombreCliente(v.snapshot).replace(/[/\\:*?"<>|]/g, "").replace(/\s+/g, " ").trim() || "Cliente";
  return {
    ...v,
    filename: `${tituloPlan(snap?.data?.plan?.incluyeVandalismo === true)} - ${limpio} - V${v.versionNumber}.pdf`,
  };
}

export type ResultadoSincronizacion =
  | { accion: "creado"; versionNumber: number }
  | { accion: "ya-estaba"; versionNumber: number }
  | { accion: "sin-version"; retirados: number }
  | { accion: "pdf-faltante"; versionNumber: number; pdfPath: string };

/**
 * Deja el adjunto de `kind` alineado con su versión vigente en el proyecto.
 *
 * - Vigente ya adjuntada → no hace nada (retira duplicados si los hubiera).
 * - Vigente sin adjunto → copia su PDF como FileAttachment nuevo y retira el
 *   anterior (soft-delete + borrado del archivo copiado; el PDF de la versión,
 *   en la carpeta de la herramienta, no se toca).
 * - Sin versión vigente (todas descartadas) → retira los adjuntos.
 * - PDF de la vigente no está en disco → no toca nada y lo informa.
 *
 * Con `dryRun` solo calcula qué haría (lo usa el backfill sin --apply).
 */
export async function sincronizarDocumentoGenerado(
  kind: DocumentoGenerado,
  projectId: string,
  opts: { userId?: string; dryRun?: boolean } = {},
): Promise<ResultadoSincronizacion> {
  const vigente = await versionVigente(kind, projectId);
  const actuales = await prisma.fileAttachment.findMany({
    where: { projectId, toolSource: kind, deletedAt: null },
    select: { id: true, url: true, toolEntityId: true },
  });

  const retirar = async (ids: { id: string; url: string }[]) => {
    if (ids.length === 0 || opts.dryRun) return;
    await prisma.fileAttachment.updateMany({
      where: { id: { in: ids.map((a) => a.id) } },
      data: { deletedAt: new Date() },
    });
    await Promise.all(ids.map((a) => deleteStoredFile(a.url).catch(() => undefined)));
  };

  if (!vigente) {
    await retirar(actuales);
    return { accion: "sin-version", retirados: actuales.length };
  }

  const yaEsta = actuales.find((a) => a.toolEntityId === vigente.id);
  if (yaEsta) {
    await retirar(actuales.filter((a) => a.id !== yaEsta.id));
    return { accion: "ya-estaba", versionNumber: vigente.versionNumber };
  }

  let pdf: Buffer;
  try {
    pdf = await fsPromises.readFile(getStoredFilePath(vigente.pdfPath));
  } catch {
    return { accion: "pdf-faltante", versionNumber: vigente.versionNumber, pdfPath: vigente.pdfPath };
  }
  if (opts.dryRun) return { accion: "creado", versionNumber: vigente.versionNumber };

  const stored = await saveBufferAsAttachment(pdf, vigente.filename, "application/pdf", projectId);
  await prisma.fileAttachment.create({
    data: {
      projectId,
      filename: stored.filename,
      storedFilename: stored.storedFilename,
      mimeType: stored.mimeType,
      sizeBytes: stored.sizeBytes,
      url: stored.url,
      // No hay un tipo propio en el enum (agregarlo pide migración y no aporta:
      // el origen fino va en toolSource, que es lo que usa la pantalla).
      tipo: FileAttachmentTipo.OTRO,
      toolSource: kind,
      toolVersion: vigente.versionNumber,
      toolEntityId: vigente.id,
      uploadedById: opts.userId ?? vigente.publishedById,
    },
  });
  await retirar(actuales);
  return { accion: "creado", versionNumber: vigente.versionNumber };
}

/**
 * Versión "best-effort" para llamar después de publicar/descartar/restaurar: un
 * fallo al copiar el adjunto no debe tirar abajo la operación principal (la
 * versión ya quedó publicada y se puede bajar desde la herramienta).
 */
export async function sincronizarDocumentoGeneradoSeguro(
  kind: DocumentoGenerado,
  projectId: string,
  userId?: string,
): Promise<void> {
  try {
    await sincronizarDocumentoGenerado(kind, projectId, { userId });
  } catch (err) {
    console.warn(`[documentos-generados] no se pudo sincronizar ${kind} del proyecto ${projectId}`, err);
  }
}

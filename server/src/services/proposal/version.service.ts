// Service de versiones publicadas de propuesta v2 (Fase E). Publicar, listar,
// obtener, descartar, restaurar y regenerar. Ver FASE_E_SPEC.md.

import { randomUUID } from "node:crypto";
import { promises as fsPromises } from "node:fs";

import { AuditAction, AuditEntityType, Prisma, ProposalV2VersionStatus } from "@prisma/client";

import { prisma } from "../../lib/prisma.js";
import { createAuditEntry } from "../audit.service.js";
import { getStoredFilePath } from "../file-storage.service.js";
import { AppError, badRequest, notFound } from "../../utils/errors.js";
import { buildAdvisor, resolveAdvisorForUser } from "./advisor.js";
import { calculate } from "./calculator.js";
import { concatPdfs } from "./concatPdfs.js";
import { applyCoverOverlay } from "./coverOverlay.js";
import { generateFullPdfWithCover } from "./full-with-cover.service.js";
import { generateProposalFullPdf, generateProposalSummaryPdf } from "./pdfGenerator.js";
import { resolveDefaults } from "./resolveDefaults.js";
import { draftDataSchema } from "./schemas/draft.schema.js";
import {
  SNAPSHOT_VERSION,
  TEMPLATE_VERSION,
  snapshotSchema,
  type ProposalV2Snapshot,
} from "./schemas/snapshot.schema.js";
import {
  cleanupVersionDir,
  getVersionPdfPaths,
  writeVersionPdfs,
} from "./proposal-storage.js";
import type { ProposalAdvisor } from "./template.js";
import type { ProposalCalculated, ProposalData } from "./types.js";

const PUBLISH_MAX_RETRIES = 3;

// ─── Helpers puros (testeables sin DB) ───────────────────────────────────────

// Último token del nombre, saneado para nombre de archivo (sin acentos ni
// símbolos). "Jose Gonzalez" → "Gonzalez".
export function clientLastName(nombre: string): string {
  const parts = nombre.trim().split(/\s+/);
  const last = parts[parts.length - 1] ?? "";
  const clean = last
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-zA-Z0-9]/g, "");
  return clean || "cliente";
}

export function versionPdfFilename(
  kind: "full" | "summary",
  nombre: string,
  versionNumber: number,
): string {
  const prefix = kind === "full" ? "propuesta" : "resumen";
  return `${prefix}-${clientLastName(nombre)}-v${versionNumber}.pdf`;
}

// Ensambla y VALIDA el snapshot (snapshotSchema tira si algo no cuadra).
export function buildSnapshot(params: {
  data: unknown;
  defaults: unknown;
  coverOverlay: unknown;
  coverPdfAttachmentId: string | null;
  calc: unknown;
  renderedAt: string;
  advisor?: unknown;
}): ProposalV2Snapshot {
  return snapshotSchema.parse({
    version: SNAPSHOT_VERSION,
    data: params.data,
    defaults: params.defaults,
    coverOverlay: params.coverOverlay,
    coverPdfAttachmentId: params.coverPdfAttachmentId,
    calc: params.calc,
    templateVersion: TEMPLATE_VERSION,
    renderedAt: params.renderedAt,
    advisor: params.advisor,
  });
}

// ─── Render desde snapshot (para regenerar idéntico) ─────────────────────────

async function loadCoverBytesById(attachmentId: string): Promise<Buffer | null> {
  const att = await prisma.fileAttachment.findUnique({
    where: { id: attachmentId },
    select: { url: true },
  });
  if (!att?.url) return null;
  try {
    return await fsPromises.readFile(getStoredFilePath(att.url));
  } catch {
    return null;
  }
}

// Regenera los dos PDFs usando EXCLUSIVAMENTE el snapshot (data + calc + tapa
// referenciada por el snapshot), para reproducir el entregable original aunque
// la tapa actual del sistema haya cambiado.
async function renderPdfsFromSnapshot(
  snapshot: ProposalV2Snapshot,
  advisor: ProposalAdvisor,
): Promise<{ fullBuffer: Buffer; summaryBuffer: Buffer }> {
  const ctx = {
    data: snapshot.data as ProposalData,
    calculated: snapshot.calc as unknown as ProposalCalculated,
    advisor,
  };
  const summaryBuffer = await generateProposalSummaryPdf(ctx);
  const body = await generateProposalFullPdf(ctx);

  let fullBuffer = body;
  if (snapshot.coverPdfAttachmentId) {
    const coverBytes = await loadCoverBytesById(snapshot.coverPdfAttachmentId);
    if (coverBytes) {
      const overlaid = await applyCoverOverlay(coverBytes, snapshot.coverOverlay, {
        clientName: snapshot.data.cliente.nombre,
        city: snapshot.data.cliente.ciudad,
        date: (snapshot.calc as { fechaTextoLargo?: string }).fechaTextoLargo ?? "",
      });
      fullBuffer = await concatPdfs(overlaid, body);
    }
  }
  return { fullBuffer, summaryBuffer };
}

// ─── Preview del borrador (al vuelo, sin persistir) ──────────────────────────

// Genera el PDF full del borrador actual con el mismo pipeline que la
// publicación (defaults + calc + tapa + firma del asesor logueado). No cachea.
// 404 si no hay draft; 400 (ZodError) si el draft no valida.
export async function generateDraftPreviewPdf(leadId: string, userId: string): Promise<Buffer> {
  const draft = await prisma.proposalV2Draft.findUnique({ where: { leadId } });
  if (!draft) throw notFound("DRAFT_NOT_FOUND", "El lead no tiene borrador.");
  const data = draftDataSchema.parse(draft.data);

  const defaultsRow = await prisma.proposalDefaults.findUnique({ where: { id: "singleton" } });
  if (!defaultsRow) {
    throw badRequest("PROPOSAL_DEFAULTS_NOT_SEEDED", "Los defaults de propuestas no están cargados.");
  }
  const defaults = resolveDefaults(defaultsRow.data);
  const calc = calculate(data, defaults);
  const advisor = await resolveAdvisorForUser(userId);

  return generateFullPdfWithCover({ data, calculated: calc, advisor });
}

// ─── Publicar ────────────────────────────────────────────────────────────────

export async function publishVersion(leadId: string, userId: string) {
  const draft = await prisma.proposalV2Draft.findUnique({ where: { leadId } });
  if (!draft) {
    throw badRequest("DRAFT_NOT_FOUND", "El lead no tiene borrador de propuesta para publicar.");
  }
  // Valida el draft.data (ZodError → 400). Defensivo: el data es Json en la BD.
  const data = draftDataSchema.parse(draft.data);

  const defaultsRow = await prisma.proposalDefaults.findUnique({ where: { id: "singleton" } });
  if (!defaultsRow) {
    throw badRequest("PROPOSAL_DEFAULTS_NOT_SEEDED", "Los defaults de propuestas no están cargados.");
  }
  const defaults = resolveDefaults(defaultsRow.data);
  const calc = calculate(data, defaults);

  // Asesor que publica: crudo (jobTitle nullable) para el snapshot, resuelto
  // (con fallback) para el render.
  const rawAdvisor = await prisma.user.findUnique({
    where: { id: userId },
    select: { name: true, jobTitle: true, email: true },
  });
  const snapshotAdvisor = rawAdvisor
    ? { name: rawAdvisor.name, jobTitle: rawAdvisor.jobTitle, email: rawAdvisor.email }
    : undefined;
  const renderAdvisor = buildAdvisor(rawAdvisor ?? {});

  const snapshot = buildSnapshot({
    data,
    defaults,
    coverOverlay: defaultsRow.coverOverlay,
    coverPdfAttachmentId: defaultsRow.coverPdfAttachmentId,
    calc,
    renderedAt: new Date().toISOString(),
    advisor: snapshotAdvisor,
  });
  const snapshotJson = snapshot as unknown as Prisma.InputJsonValue;

  // Render con la tapa ACTUAL (== la del snapshot en este instante).
  const ctx = { data, calculated: calc, advisor: renderAdvisor };
  const fullBuffer = await generateFullPdfWithCover(ctx);
  const summaryBuffer = await generateProposalSummaryPdf(ctx);

  for (let attempt = 1; attempt <= PUBLISH_MAX_RETRIES; attempt++) {
    const versionId = randomUUID();
    const { fullPath, summaryPath } = getVersionPdfPaths(leadId, versionId);

    // Fallo de disco: no es carrera, no reintentamos. writeVersionPdfs ya limpia
    // su propio parcial si el segundo write falla.
    await writeVersionPdfs(leadId, versionId, { fullBuffer, summaryBuffer });

    try {
      const created = await prisma.$transaction(async (tx) => {
        const agg = await tx.proposalV2Version.aggregate({
          where: { leadId },
          _max: { versionNumber: true },
        });
        const versionNumber = (agg._max.versionNumber ?? 0) + 1;
        return tx.proposalV2Version.create({
          data: {
            id: versionId,
            leadId,
            versionNumber,
            snapshot: snapshotJson,
            fullPdfPath: fullPath,
            summaryPdfPath: summaryPath,
            publishedById: userId,
          },
        });
      });

      await createAuditEntry({
        entityType: AuditEntityType.proposal,
        entityId: created.id,
        userId,
        action: AuditAction.proposal_v2_version_published,
        description: `Publicó la versión ${created.versionNumber} de la propuesta`,
        metadata: {
          leadId,
          versionNumber: created.versionNumber,
          versionId: created.id,
        } as unknown as Prisma.InputJsonValue,
      });

      return created;
    } catch (err) {
      // Falló el INSERT: borrar los archivos escritos para no dejar huérfanos.
      await cleanupVersionDir(leadId, versionId).catch(() => undefined);
      // Carrera de versionNumber → reintentar con un versionId nuevo.
      const isUniqueRace =
        err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002";
      if (isUniqueRace && attempt < PUBLISH_MAX_RETRIES) continue;
      throw err;
    }
  }

  throw new AppError(
    500,
    "VERSION_PUBLISH_RETRY_EXHAUSTED",
    "No se pudo asignar un número de versión tras varios intentos. Reintentá.",
  );
}

// ─── Listar / obtener ────────────────────────────────────────────────────────

// Metadatos livianos (sin snapshot completo) para el listado.
function toLightDto(row: {
  id: string;
  leadId: string;
  versionNumber: number;
  status: ProposalV2VersionStatus;
  publishedAt: Date;
  publishedById: string;
  snapshot: Prisma.JsonValue;
}) {
  const snap = row.snapshot as unknown as ProposalV2Snapshot;
  return {
    id: row.id,
    leadId: row.leadId,
    versionNumber: row.versionNumber,
    status: row.status,
    publishedAt: row.publishedAt,
    publishedById: row.publishedById,
    clientName: snap?.data?.cliente?.nombre ?? null,
    totalConIva: (snap?.calc as { totalConIva?: number } | undefined)?.totalConIva ?? null,
  };
}

export async function listVersions(leadId: string, opts: { includeDiscarded: boolean }) {
  const rows = await prisma.proposalV2Version.findMany({
    where: {
      leadId,
      ...(opts.includeDiscarded ? {} : { status: ProposalV2VersionStatus.PUBLISHED }),
    },
    orderBy: { versionNumber: "desc" },
  });
  return rows.map(toLightDto);
}

export function getVersionById(versionId: string) {
  return prisma.proposalV2Version.findUnique({ where: { id: versionId } });
}

// ─── Descartar / restaurar ───────────────────────────────────────────────────

export async function discardVersion(versionId: string, userId: string, reason?: string) {
  const v = await prisma.proposalV2Version.findUnique({ where: { id: versionId } });
  if (!v) throw notFound("VERSION_NOT_FOUND", "La versión no existe.");

  const updated = await prisma.proposalV2Version.update({
    where: { id: versionId },
    data: {
      status: ProposalV2VersionStatus.DISCARDED,
      discardedAt: new Date(),
      discardedById: userId,
      discardReason: reason ?? null,
    },
  });

  await createAuditEntry({
    entityType: AuditEntityType.proposal,
    entityId: versionId,
    userId,
    action: AuditAction.proposal_v2_version_discarded,
    description: `Descartó la versión ${v.versionNumber} de la propuesta`,
    metadata: { versionId, reason: reason ?? null } as unknown as Prisma.InputJsonValue,
  });

  return updated;
}

export async function restoreVersion(versionId: string, userId: string) {
  const v = await prisma.proposalV2Version.findUnique({ where: { id: versionId } });
  if (!v) throw notFound("VERSION_NOT_FOUND", "La versión no existe.");

  const updated = await prisma.proposalV2Version.update({
    where: { id: versionId },
    data: {
      status: ProposalV2VersionStatus.PUBLISHED,
      discardedAt: null,
      discardedById: null,
      discardReason: null,
    },
  });

  await createAuditEntry({
    entityType: AuditEntityType.proposal,
    entityId: versionId,
    userId,
    action: AuditAction.proposal_v2_version_restored,
    description: `Restauró la versión ${v.versionNumber} de la propuesta`,
    metadata: { versionId } as unknown as Prisma.InputJsonValue,
  });

  return updated;
}

// ─── Regenerar PDFs desde snapshot ───────────────────────────────────────────

export async function regeneratePdf(versionId: string, userId: string) {
  const v = await prisma.proposalV2Version.findUnique({ where: { id: versionId } });
  if (!v) throw notFound("VERSION_NOT_FOUND", "La versión no existe.");

  const snapshot = snapshotSchema.parse(v.snapshot);
  // Advisor: del snapshot si lo tiene (Fase F+); si no (versiones viejas), del
  // publishedBy con fallback a "Asesor Comercial".
  const advisor = snapshot.advisor
    ? buildAdvisor(snapshot.advisor)
    : await resolveAdvisorForUser(v.publishedById);
  const { fullBuffer, summaryBuffer } = await renderPdfsFromSnapshot(snapshot, advisor);

  // Sobrescribe los archivos existentes (no cambia paths, snapshot ni número).
  await fsPromises.writeFile(getStoredFilePath(v.fullPdfPath), fullBuffer);
  await fsPromises.writeFile(getStoredFilePath(v.summaryPdfPath), summaryBuffer);

  await createAuditEntry({
    entityType: AuditEntityType.proposal,
    entityId: versionId,
    userId,
    action: AuditAction.proposal_v2_version_pdf_regenerated,
    description: `Regeneró los PDFs de la versión ${v.versionNumber} de la propuesta`,
    metadata: { versionId } as unknown as Prisma.InputJsonValue,
  });

  return v;
}

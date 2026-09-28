// Documento del plan de granizo (condiciones + Anexo A): borrador con autosave,
// vista previa y versiones publicadas inmutables con su PDF en disco. Mismo
// patrón que services/proforma/* y services/contract/*.
//
//   PDF: projects/{projectId}/plan-granizo/{versionId}/condiciones.pdf

import { randomUUID } from "node:crypto";
import { promises as fsPromises } from "node:fs";
import path from "node:path";

import { AuditAction, AuditEntityType, PlanGranizoVersionStatus, Prisma } from "@prisma/client";

import { prisma } from "../../../lib/prisma.js";
import { AppError, badRequest, notFound } from "../../../utils/errors.js";
import { createAuditEntry } from "../../audit.service.js";
import { renderHtmlToPdf } from "../../efpPdf/v2/pdfRenderer.js";
import { getStoredFilePath } from "../../file-storage.service.js";
import {
  PLAN_GRANIZO_DOC_SNAPSHOT_VERSION,
  PLAN_GRANIZO_DOC_TEMPLATE_VERSION,
  planGranizoDocPublishSchema,
  planGranizoDocSnapshotSchema,
  planGranizoDocStorageSchema,
  type PlanGranizoDocData,
  type PlanGranizoDocSnapshot,
} from "./schema.js";
import { buildFooterHtml, buildHeaderHtml, renderPlanGranizoHtml } from "./template.js";

const PUBLISH_MAX_RETRIES = 3;

// ─── PDF ─────────────────────────────────────────────────────────────────────

export function generatePlanGranizoPdf(data: PlanGranizoDocData): Promise<Buffer> {
  return renderHtmlToPdf(renderPlanGranizoHtml(data), {
    headerHtml: buildHeaderHtml(),
    footerHtml: buildFooterHtml(data.empresa.razonSocial),
  });
}

export function planGranizoPdfFilename(nombre: string, versionNumber: number): string {
  const limpio = (nombre ?? "").replace(/[/\\:*?"<>|]/g, "").replace(/\s+/g, " ").trim() || "Cliente";
  return `Plan de Protección contra Granizo - ${limpio} - V${versionNumber}.pdf`;
}

function versionDir(projectId: string, versionId: string) {
  return `projects/${projectId}/plan-granizo/${versionId}`;
}

// ─── Borrador ────────────────────────────────────────────────────────────────

export function getDraft(projectId: string) {
  return prisma.planGranizoDraft.findUnique({ where: { projectId } });
}

export async function upsertDraft(projectId: string, data: unknown, userId: string) {
  const parsed = planGranizoDocStorageSchema.parse(data) as unknown as Prisma.InputJsonValue;
  const draft = await prisma.planGranizoDraft.upsert({
    where: { projectId },
    create: { projectId, data: parsed, createdById: userId, updatedById: userId },
    update: { data: parsed, updatedById: userId },
  });
  await createAuditEntry({
    entityType: AuditEntityType.plan_granizo_documento,
    entityId: draft.id,
    projectId,
    userId,
    action: AuditAction.plan_granizo_draft_updated,
    description: "Actualizó el borrador de las condiciones del plan de granizo",
  });
  return draft;
}

export async function generateDraftPreviewPdf(projectId: string): Promise<Buffer> {
  const draft = await getDraft(projectId);
  if (!draft) throw notFound("PLAN_GRANIZO_DRAFT_NOT_FOUND", "El proyecto no tiene borrador de las condiciones del plan.");
  return generatePlanGranizoPdf(planGranizoDocPublishSchema.parse(draft.data));
}

// ─── Versiones ───────────────────────────────────────────────────────────────

export async function publishVersion(projectId: string, userId: string) {
  const draft = await getDraft(projectId);
  if (!draft) throw badRequest("PLAN_GRANIZO_DRAFT_NOT_FOUND", "No hay borrador para generar.");
  const data = planGranizoDocPublishSchema.parse(draft.data);
  const snapshot: PlanGranizoDocSnapshot = planGranizoDocSnapshotSchema.parse({
    version: PLAN_GRANIZO_DOC_SNAPSHOT_VERSION,
    templateVersion: PLAN_GRANIZO_DOC_TEMPLATE_VERSION,
    data,
    renderedAt: new Date().toISOString(),
  });
  const pdf = await generatePlanGranizoPdf(data);

  for (let attempt = 1; attempt <= PUBLISH_MAX_RETRIES; attempt++) {
    const versionId = randomUUID();
    const pdfPath = `${versionDir(projectId, versionId)}/condiciones.pdf`;
    const abs = getStoredFilePath(pdfPath);
    await fsPromises.mkdir(path.dirname(abs), { recursive: true });
    await fsPromises.writeFile(abs, pdf);
    try {
      const created = await prisma.$transaction(async (tx) => {
        const agg = await tx.planGranizoVersion.aggregate({ where: { projectId }, _max: { versionNumber: true } });
        return tx.planGranizoVersion.create({
          data: {
            id: versionId,
            projectId,
            versionNumber: (agg._max.versionNumber ?? 0) + 1,
            snapshot: snapshot as unknown as Prisma.InputJsonValue,
            pdfPath,
            publishedById: userId,
          },
        });
      });
      await createAuditEntry({
        entityType: AuditEntityType.plan_granizo_documento,
        entityId: created.id,
        projectId,
        userId,
        action: AuditAction.plan_granizo_version_published,
        description: `Generó la versión ${created.versionNumber} de las condiciones del plan de granizo (${data.plan.cantidadPaneles} paneles, USD ${data.plan.anualidadUsd}/año)`,
      });
      return toLightDto(created);
    } catch (err) {
      await fsPromises.rm(getStoredFilePath(versionDir(projectId, versionId)), { recursive: true, force: true }).catch(() => undefined);
      const carrera = err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002";
      if (carrera && attempt < PUBLISH_MAX_RETRIES) continue;
      throw err;
    }
  }
  throw new AppError(500, "PLAN_GRANIZO_PUBLISH_RETRY_EXHAUSTED", "No se pudo asignar un número de versión. Reintentá.");
}

function toLightDto(row: {
  id: string;
  projectId: string;
  versionNumber: number;
  status: PlanGranizoVersionStatus;
  publishedAt: Date;
  publishedById: string;
  snapshot: Prisma.JsonValue;
}) {
  const snap = row.snapshot as unknown as PlanGranizoDocSnapshot;
  return {
    id: row.id,
    projectId: row.projectId,
    versionNumber: row.versionNumber,
    status: row.status,
    publishedAt: row.publishedAt,
    publishedById: row.publishedById,
    clientName: snap?.data?.cliente?.nombre ?? null,
    cantidadPaneles: snap?.data?.plan?.cantidadPaneles ?? null,
    anualidadUsd: snap?.data?.plan?.anualidadUsd ?? null,
  };
}

export async function listVersions(projectId: string, includeDiscarded: boolean) {
  const rows = await prisma.planGranizoVersion.findMany({
    where: { projectId, ...(includeDiscarded ? {} : { status: PlanGranizoVersionStatus.PUBLISHED }) },
    orderBy: { versionNumber: "desc" },
  });
  return rows.map(toLightDto);
}

export async function getVersionPdf(versionId: string) {
  const v = await prisma.planGranizoVersion.findUnique({ where: { id: versionId } });
  if (!v) throw notFound("PLAN_GRANIZO_VERSION_NOT_FOUND", "La versión no existe.");
  let buf: Buffer;
  try {
    buf = await fsPromises.readFile(getStoredFilePath(v.pdfPath));
  } catch {
    throw badRequest("PLAN_GRANIZO_PDF_MISSING", "El PDF de la versión no está disponible en disco.");
  }
  const snap = v.snapshot as unknown as PlanGranizoDocSnapshot;
  return { version: v, buf, filename: planGranizoPdfFilename(snap?.data?.cliente?.nombre ?? "Cliente", v.versionNumber) };
}

export async function setVersionStatus(versionId: string, userId: string, descartar: boolean, reason?: string) {
  const v = await prisma.planGranizoVersion.findUnique({ where: { id: versionId } });
  if (!v) throw notFound("PLAN_GRANIZO_VERSION_NOT_FOUND", "La versión no existe.");
  const updated = await prisma.planGranizoVersion.update({
    where: { id: versionId },
    data: descartar
      ? { status: PlanGranizoVersionStatus.DISCARDED, discardedAt: new Date(), discardedById: userId, discardReason: reason ?? null }
      : { status: PlanGranizoVersionStatus.PUBLISHED, discardedAt: null, discardedById: null, discardReason: null },
  });
  await createAuditEntry({
    entityType: AuditEntityType.plan_granizo_documento,
    entityId: versionId,
    projectId: v.projectId,
    userId,
    action: descartar ? AuditAction.plan_granizo_version_discarded : AuditAction.plan_granizo_version_restored,
    description: `${descartar ? "Descartó" : "Restauró"} la versión ${v.versionNumber} de las condiciones del plan de granizo`,
    metadata: { reason: reason ?? null },
  });
  return toLightDto(updated);
}

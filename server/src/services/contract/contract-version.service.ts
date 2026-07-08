// Service de versiones publicadas del contrato. Publicar, listar, obtener,
// descartar y restaurar. Mismo patrón que las versiones de propuesta v2, pero
// ligado al Project y con un solo PDF por versión.

import { randomUUID } from "node:crypto";

import { AuditAction, AuditEntityType, ContractVersionStatus, Prisma } from "@prisma/client";

import { prisma } from "../../lib/prisma.js";
import { AppError, badRequest, notFound } from "../../utils/errors.js";
import { createAuditEntry } from "../audit.service.js";
import {
  cleanupContractVersionDir,
  readContractPdf,
  writeContractPdf,
} from "./contract-storage.js";
import { generateContractPdf } from "./pdfGenerator.js";
import { contractDataPublishSchema } from "./schemas/contract.schema.js";
import {
  CONTRACT_SNAPSHOT_VERSION,
  CONTRACT_TEMPLATE_VERSION,
  type ContractSnapshot,
  contractSnapshotSchema,
} from "./schemas/contract-snapshot.schema.js";

const PUBLISH_MAX_RETRIES = 3;

// ─── Preview del borrador (al vuelo, sin persistir) ──────────────────────────

// Genera el PDF del borrador actual con el mismo pipeline que la publicación.
// 404 si no hay draft; 400 (ZodError) si el draft no valida (faltan campos).
export async function generateDraftPreviewPdf(projectId: string): Promise<Buffer> {
  const draft = await prisma.contractDraft.findUnique({ where: { projectId } });
  if (!draft) throw notFound("CONTRACT_DRAFT_NOT_FOUND", "El proyecto no tiene borrador de contrato.");
  const data = contractDataPublishSchema.parse(draft.data);
  return generateContractPdf(data);
}

// ─── Publicar ────────────────────────────────────────────────────────────────

export async function publishVersion(projectId: string, userId: string) {
  const draft = await prisma.contractDraft.findUnique({ where: { projectId } });
  if (!draft) {
    throw badRequest("CONTRACT_DRAFT_NOT_FOUND", "El proyecto no tiene borrador de contrato para publicar.");
  }
  const data = contractDataPublishSchema.parse(draft.data);

  const snapshot: ContractSnapshot = contractSnapshotSchema.parse({
    version: CONTRACT_SNAPSHOT_VERSION,
    templateVersion: CONTRACT_TEMPLATE_VERSION,
    data,
    renderedAt: new Date().toISOString(),
  });
  const snapshotJson = snapshot as unknown as Prisma.InputJsonValue;

  const pdfBuffer = await generateContractPdf(data);

  for (let attempt = 1; attempt <= PUBLISH_MAX_RETRIES; attempt++) {
    const versionId = randomUUID();
    const pdfPath = await writeContractPdf(projectId, versionId, pdfBuffer);

    try {
      const created = await prisma.$transaction(async (tx) => {
        const agg = await tx.contractVersion.aggregate({
          where: { projectId },
          _max: { versionNumber: true },
        });
        const versionNumber = (agg._max.versionNumber ?? 0) + 1;
        return tx.contractVersion.create({
          data: {
            id: versionId,
            projectId,
            versionNumber,
            snapshot: snapshotJson,
            pdfPath,
            publishedById: userId,
          },
        });
      });

      await createAuditEntry({
        entityType: AuditEntityType.contract,
        entityId: created.id,
        userId,
        action: AuditAction.contract_version_published,
        description: `Publicó la versión ${created.versionNumber} del contrato`,
        metadata: {
          projectId,
          versionNumber: created.versionNumber,
          versionId: created.id,
        } as unknown as Prisma.InputJsonValue,
      });

      return created;
    } catch (err) {
      await cleanupContractVersionDir(projectId, versionId).catch(() => undefined);
      const isUniqueRace =
        err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002";
      if (isUniqueRace && attempt < PUBLISH_MAX_RETRIES) continue;
      throw err;
    }
  }

  throw new AppError(
    500,
    "CONTRACT_PUBLISH_RETRY_EXHAUSTED",
    "No se pudo asignar un número de versión tras varios intentos. Reintentá.",
  );
}

// ─── Listar / obtener ────────────────────────────────────────────────────────

function toLightDto(row: {
  id: string;
  projectId: string;
  versionNumber: number;
  status: ContractVersionStatus;
  publishedAt: Date;
  publishedById: string;
  snapshot: Prisma.JsonValue;
}) {
  const snap = row.snapshot as unknown as ContractSnapshot;
  return {
    id: row.id,
    projectId: row.projectId,
    versionNumber: row.versionNumber,
    status: row.status,
    publishedAt: row.publishedAt,
    publishedById: row.publishedById,
    clientName: snap?.data?.cliente?.nombre ?? null,
  };
}

export async function listVersions(projectId: string, opts: { includeDiscarded: boolean }) {
  const rows = await prisma.contractVersion.findMany({
    where: {
      projectId,
      ...(opts.includeDiscarded ? {} : { status: ContractVersionStatus.PUBLISHED }),
    },
    orderBy: { versionNumber: "desc" },
  });
  return rows.map(toLightDto);
}

export function getVersionById(versionId: string) {
  return prisma.contractVersion.findUnique({ where: { id: versionId } });
}

// Devuelve el PDF de una versión (Buffer). 400 si el archivo no está en disco.
export async function readVersionPdfById(versionId: string): Promise<Buffer> {
  const version = await prisma.contractVersion.findUnique({ where: { id: versionId } });
  if (!version) throw notFound("CONTRACT_VERSION_NOT_FOUND", "La versión no existe.");
  try {
    return await readContractPdf(version.pdfPath);
  } catch {
    throw badRequest("CONTRACT_PDF_MISSING", "El archivo PDF de la versión no está disponible en disco.");
  }
}

// ─── Descartar / restaurar ───────────────────────────────────────────────────

export async function discardVersion(versionId: string, userId: string, reason?: string) {
  const v = await prisma.contractVersion.findUnique({ where: { id: versionId } });
  if (!v) throw notFound("CONTRACT_VERSION_NOT_FOUND", "La versión no existe.");

  const updated = await prisma.contractVersion.update({
    where: { id: versionId },
    data: {
      status: ContractVersionStatus.DISCARDED,
      discardedAt: new Date(),
      discardedById: userId,
      discardReason: reason ?? null,
    },
  });

  await createAuditEntry({
    entityType: AuditEntityType.contract,
    entityId: versionId,
    userId,
    action: AuditAction.contract_version_discarded,
    description: `Descartó la versión ${v.versionNumber} del contrato`,
    metadata: { versionId, reason: reason ?? null } as unknown as Prisma.InputJsonValue,
  });

  return updated;
}

export async function restoreVersion(versionId: string, userId: string) {
  const v = await prisma.contractVersion.findUnique({ where: { id: versionId } });
  if (!v) throw notFound("CONTRACT_VERSION_NOT_FOUND", "La versión no existe.");

  const updated = await prisma.contractVersion.update({
    where: { id: versionId },
    data: {
      status: ContractVersionStatus.PUBLISHED,
      discardedAt: null,
      discardedById: null,
      discardReason: null,
    },
  });

  await createAuditEntry({
    entityType: AuditEntityType.contract,
    entityId: versionId,
    userId,
    action: AuditAction.contract_version_restored,
    description: `Restauró la versión ${v.versionNumber} del contrato`,
    metadata: { versionId } as unknown as Prisma.InputJsonValue,
  });

  return updated;
}

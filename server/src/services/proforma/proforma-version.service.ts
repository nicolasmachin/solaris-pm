// Service de versiones publicadas de la proforma. Publicar, listar, obtener,
// descartar y restaurar. Mismo patrón que las versiones de contrato.

import { randomUUID } from "node:crypto";

import { AuditAction, AuditEntityType, Prisma, ProformaVersionStatus } from "@prisma/client";

import { prisma } from "../../lib/prisma.js";
import { AppError, badRequest, notFound } from "../../utils/errors.js";
import { createAuditEntry } from "../audit.service.js";
import {
  cleanupProformaVersionDir,
  readProformaPdf,
  writeProformaPdf,
} from "./proforma-storage.js";
import { generateProformaPdf } from "./pdfGenerator.js";
import { proformaDataPublishSchema } from "./schemas/proforma.schema.js";
import {
  PROFORMA_SNAPSHOT_VERSION,
  PROFORMA_TEMPLATE_VERSION,
  type ProformaSnapshot,
  proformaSnapshotSchema,
} from "./schemas/proforma-snapshot.schema.js";

const PUBLISH_MAX_RETRIES = 3;

// Genera el PDF del borrador actual (mismo pipeline que publish). 404 si no hay
// draft; 400 (ZodError) si no valida.
export async function generateDraftPreviewPdf(projectId: string): Promise<Buffer> {
  const draft = await prisma.proformaDraft.findUnique({ where: { projectId } });
  if (!draft) throw notFound("PROFORMA_DRAFT_NOT_FOUND", "El proyecto no tiene borrador de proforma.");
  const data = proformaDataPublishSchema.parse(draft.data);
  return generateProformaPdf(data);
}

export async function publishVersion(projectId: string, userId: string) {
  const draft = await prisma.proformaDraft.findUnique({ where: { projectId } });
  if (!draft) {
    throw badRequest("PROFORMA_DRAFT_NOT_FOUND", "El proyecto no tiene borrador de proforma para publicar.");
  }
  const data = proformaDataPublishSchema.parse(draft.data);

  const snapshot: ProformaSnapshot = proformaSnapshotSchema.parse({
    version: PROFORMA_SNAPSHOT_VERSION,
    templateVersion: PROFORMA_TEMPLATE_VERSION,
    data,
    renderedAt: new Date().toISOString(),
  });
  const snapshotJson = snapshot as unknown as Prisma.InputJsonValue;

  const pdfBuffer = await generateProformaPdf(data);

  for (let attempt = 1; attempt <= PUBLISH_MAX_RETRIES; attempt++) {
    const versionId = randomUUID();
    const pdfPath = await writeProformaPdf(projectId, versionId, pdfBuffer);

    try {
      const created = await prisma.$transaction(async (tx) => {
        const agg = await tx.proformaVersion.aggregate({
          where: { projectId },
          _max: { versionNumber: true },
        });
        const versionNumber = (agg._max.versionNumber ?? 0) + 1;
        return tx.proformaVersion.create({
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
        entityType: AuditEntityType.proforma,
        entityId: created.id,
        userId,
        action: AuditAction.proforma_version_published,
        description: `Generó la versión ${created.versionNumber} de la proforma`,
        metadata: {
          projectId,
          versionNumber: created.versionNumber,
          versionId: created.id,
        } as unknown as Prisma.InputJsonValue,
      });

      return created;
    } catch (err) {
      await cleanupProformaVersionDir(projectId, versionId).catch(() => undefined);
      const isUniqueRace =
        err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002";
      if (isUniqueRace && attempt < PUBLISH_MAX_RETRIES) continue;
      throw err;
    }
  }

  throw new AppError(
    500,
    "PROFORMA_PUBLISH_RETRY_EXHAUSTED",
    "No se pudo asignar un número de versión tras varios intentos. Reintentá.",
  );
}

function toLightDto(row: {
  id: string;
  projectId: string;
  versionNumber: number;
  status: ProformaVersionStatus;
  publishedAt: Date;
  publishedById: string;
  snapshot: Prisma.JsonValue;
}) {
  const snap = row.snapshot as unknown as ProformaSnapshot;
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
  const rows = await prisma.proformaVersion.findMany({
    where: {
      projectId,
      ...(opts.includeDiscarded ? {} : { status: ProformaVersionStatus.PUBLISHED }),
    },
    orderBy: { versionNumber: "desc" },
  });
  return rows.map(toLightDto);
}

export function getVersionById(versionId: string) {
  return prisma.proformaVersion.findUnique({ where: { id: versionId } });
}

export async function readVersionPdfById(versionId: string): Promise<Buffer> {
  const version = await prisma.proformaVersion.findUnique({ where: { id: versionId } });
  if (!version) throw notFound("PROFORMA_VERSION_NOT_FOUND", "La versión no existe.");
  try {
    return await readProformaPdf(version.pdfPath);
  } catch {
    throw badRequest("PROFORMA_PDF_MISSING", "El archivo PDF de la versión no está disponible en disco.");
  }
}

export async function discardVersion(versionId: string, userId: string, reason?: string) {
  const v = await prisma.proformaVersion.findUnique({ where: { id: versionId } });
  if (!v) throw notFound("PROFORMA_VERSION_NOT_FOUND", "La versión no existe.");

  const updated = await prisma.proformaVersion.update({
    where: { id: versionId },
    data: {
      status: ProformaVersionStatus.DISCARDED,
      discardedAt: new Date(),
      discardedById: userId,
      discardReason: reason ?? null,
    },
  });

  await createAuditEntry({
    entityType: AuditEntityType.proforma,
    entityId: versionId,
    userId,
    action: AuditAction.proforma_version_discarded,
    description: `Descartó la versión ${v.versionNumber} de la proforma`,
    metadata: { versionId, reason: reason ?? null } as unknown as Prisma.InputJsonValue,
  });

  return updated;
}

export async function restoreVersion(versionId: string, userId: string) {
  const v = await prisma.proformaVersion.findUnique({ where: { id: versionId } });
  if (!v) throw notFound("PROFORMA_VERSION_NOT_FOUND", "La versión no existe.");

  const updated = await prisma.proformaVersion.update({
    where: { id: versionId },
    data: {
      status: ProformaVersionStatus.PUBLISHED,
      discardedAt: null,
      discardedById: null,
      discardReason: null,
    },
  });

  await createAuditEntry({
    entityType: AuditEntityType.proforma,
    entityId: versionId,
    userId,
    action: AuditAction.proforma_version_restored,
    description: `Restauró la versión ${v.versionNumber} de la proforma`,
    metadata: { versionId } as unknown as Prisma.InputJsonValue,
  });

  return updated;
}

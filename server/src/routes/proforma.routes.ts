// Endpoints del generador de proforma BBVA (subetapa "Modalidad de pago definida").
// Prefijo /api. Gate Module.ONBOARDING. Mismo patrón que contract.routes.ts.

import { Action, AuditAction, AuditEntityType, FileAttachmentTipo, Module, Prisma } from "@prisma/client";
import type { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";
import { z } from "zod";

import { authenticate } from "../middleware/auth.middleware.js";
import { authorize } from "../middleware/authorize.middleware.js";
import { createAuditEntry } from "../services/audit.service.js";
import {
  completarPorEvidencia,
  despintarPorEvidencia,
  EVIDENCIA_PROFORMA,
  TOOL_SOURCE_PROFORMA_SUBIDA,
} from "../services/checklist-evidencias.js";
import { deleteStoredFile, saveUploadedFile } from "../services/file-storage.service.js";
import { prisma } from "../lib/prisma.js";
import { buildProformaContext } from "../services/proforma/proforma-context.service.js";
import { contentDisposition } from "../utils/content-disposition.js";
import { getDraft, upsertDraft } from "../services/proforma/proforma-draft.service.js";
import {
  discardVersion,
  generateDraftPreviewPdf,
  getVersionById,
  listVersions,
  publishVersion,
  readVersionPdfById,
  restoreVersion,
} from "../services/proforma/proforma-version.service.js";
import { proformaPdfFilename } from "../services/proforma/filename.js";
import { proformaDataStorageSchema } from "../services/proforma/schemas/proforma.schema.js";
import type { ProformaSnapshot } from "../services/proforma/schemas/proforma-snapshot.schema.js";
import { badRequest, notFound, unauthorized } from "../utils/errors.js";

function ensureUser(request: FastifyRequest) {
  if (!request.user) throw unauthorized("No autenticado");
  return request.user;
}

const projectParams = z.object({ projectId: z.string().min(1) }).strict();
const idParams = z.object({ id: z.string().min(1) }).strict();
const putDraftBody = z.object({ data: proformaDataStorageSchema }).strict();
const discardBody = z.object({ reason: z.string().optional() }).strict();

function clientNameFromSnapshot(snapshot: Prisma.JsonValue): string {
  const snap = snapshot as unknown as ProformaSnapshot;
  return snap?.data?.cliente?.nombre ?? "Cliente";
}

async function sendVersionPdf(
  request: FastifyRequest,
  reply: FastifyReply,
  disposition: "attachment" | "inline",
) {
  const user = ensureUser(request);
  const { id } = idParams.parse(request.params);
  const includeDiscarded = (request.query as { includeDiscarded?: string }).includeDiscarded === "true";

  const version = await getVersionById(id);
  if (!version) throw notFound("PROFORMA_VERSION_NOT_FOUND", "La versión no existe.");
  if (version.status === "DISCARDED" && !(includeDiscarded && user.role === "ADMIN")) {
    throw notFound("PROFORMA_VERSION_DISCARDED", "La versión está descartada.");
  }

  const buf = await readVersionPdfById(id);
  const filename = proformaPdfFilename(clientNameFromSnapshot(version.snapshot), version.versionNumber);
  reply.header("Content-Type", "application/pdf");
  reply.header("Content-Disposition", contentDisposition(disposition, filename));
  reply.header("Cache-Control", "no-store");
  return reply.send(buf);
}

export async function registerProformaRoutes(app: FastifyInstance) {
  app.addHook("preHandler", authenticate);

  app.get(
    "/projects/:projectId/proforma/draft",
    { preHandler: authorize(Module.ONBOARDING, Action.VIEW) },
    async (request) => {
      const { projectId } = projectParams.parse(request.params);
      const draft = await getDraft(projectId);
      if (!draft) throw notFound("PROFORMA_DRAFT_NOT_FOUND", "El proyecto no tiene borrador de proforma.");
      return draft;
    },
  );

  app.get(
    "/projects/:projectId/proforma/context",
    { preHandler: authorize(Module.ONBOARDING, Action.VIEW) },
    async (request) => {
      const { projectId } = projectParams.parse(request.params);
      return buildProformaContext(projectId);
    },
  );

  app.get(
    "/projects/:projectId/proforma/draft/preview.pdf",
    { preHandler: authorize(Module.ONBOARDING, Action.VIEW) },
    async (request, reply) => {
      const { projectId } = projectParams.parse(request.params);
      const pdf = await generateDraftPreviewPdf(projectId);
      reply.header("Content-Type", "application/pdf");
      reply.header("Content-Disposition", 'inline; filename="proforma-preview.pdf"');
      reply.header("Cache-Control", "no-store");
      return reply.send(pdf);
    },
  );

  app.put(
    "/projects/:projectId/proforma/draft",
    { preHandler: authorize(Module.ONBOARDING, Action.EDIT) },
    async (request) => {
      const user = ensureUser(request);
      const { projectId } = projectParams.parse(request.params);
      const body = putDraftBody.parse(request.body);

      const draft = await upsertDraft(projectId, body.data, user.id);

      await createAuditEntry({
        entityType: AuditEntityType.proforma,
        entityId: draft.id,
        userId: user.id,
        action: AuditAction.proforma_draft_updated,
        description: "Actualizó el borrador de proforma",
        metadata: { projectId, keys: Object.keys(body.data) } as unknown as Prisma.InputJsonValue,
      });

      return draft;
    },
  );

  app.post(
    "/projects/:projectId/proforma/versions",
    { preHandler: authorize(Module.ONBOARDING, Action.CREATE) },
    async (request, reply) => {
      const user = ensureUser(request);
      const { projectId } = projectParams.parse(request.params);
      const version = await publishVersion(projectId, user.id);
      return reply.status(201).send(version);
    },
  );

  app.get(
    "/projects/:projectId/proforma/versions",
    { preHandler: authorize(Module.ONBOARDING, Action.VIEW) },
    async (request) => {
      const { projectId } = projectParams.parse(request.params);
      const includeDiscarded =
        (request.query as { includeDiscarded?: string }).includeDiscarded === "true";
      const versions = await listVersions(projectId, { includeDiscarded });
      return { versions };
    },
  );

  app.get(
    "/proforma/versions/:id/pdf",
    { preHandler: authorize(Module.ONBOARDING, Action.VIEW) },
    (request, reply) => sendVersionPdf(request, reply, "attachment"),
  );
  app.get(
    "/proforma/versions/:id/preview",
    { preHandler: authorize(Module.ONBOARDING, Action.VIEW) },
    (request, reply) => sendVersionPdf(request, reply, "inline"),
  );

  app.delete(
    "/proforma/versions/:id",
    { preHandler: authorize(Module.ONBOARDING, Action.EDIT) },
    async (request) => {
      const user = ensureUser(request);
      const { id } = idParams.parse(request.params);
      const body = discardBody.parse(request.body ?? {});
      return discardVersion(id, user.id, body.reason);
    },
  );

  app.post(
    "/proforma/versions/:id/restore",
    { preHandler: authorize(Module.ONBOARDING, Action.EDIT) },
    async (request) => {
      const user = ensureUser(request);
      const { id } = idParams.parse(request.params);
      return restoreVersion(id, user.id);
    },
  );

  // ─── Proforma subida a mano ───────────────────────────────────────────────
  // Para la proforma que se hizo por fuera de Voltia PM: se sube el PDF (o la
  // foto) y vale como respaldo de la financiación igual que una generada.
  const SUBIDA_EXT = new Set([".pdf", ".jpg", ".jpeg", ".png"]);

  app.get(
    "/projects/:projectId/proforma/subidas",
    { preHandler: authorize(Module.ONBOARDING, Action.VIEW) },
    async (request) => {
      const { projectId } = projectParams.parse(request.params);
      const archivos = await prisma.fileAttachment.findMany({
        where: {
          deletedAt: null,
          OR: [
            { projectId, toolSource: TOOL_SOURCE_PROFORMA_SUBIDA },
            // Las del lead del que salió el proyecto (subidas o generadas ahí).
            { lead: { convertedToProjectId: projectId }, toolSource: { in: [TOOL_SOURCE_PROFORMA_SUBIDA, "proforma"] } },
          ],
        },
        orderBy: { createdAt: "desc" },
        select: { id: true, filename: true, createdAt: true, leadId: true, projectId: true },
      });
      return {
        archivos: archivos.map((a) => ({
          id: a.id,
          filename: a.filename,
          createdAt: a.createdAt,
          origen: a.projectId === projectId ? "proyecto" : "lead",
        })),
      };
    },
  );

  app.post(
    "/projects/:projectId/proforma/subidas",
    { preHandler: authorize(Module.ONBOARDING, Action.CREATE) },
    async (request, reply) => {
      const user = ensureUser(request);
      const { projectId } = projectParams.parse(request.params);
      const proyecto = await prisma.project.findFirst({ where: { id: projectId, deletedAt: null }, select: { id: true } });
      if (!proyecto) throw notFound("PROJECT_NOT_FOUND", "Proyecto no encontrado");

      const file = await request.file();
      if (!file) throw badRequest("FILE_REQUIRED", "Falta el archivo de la proforma.");
      const ext = (file.filename.match(/\.[^.]+$/)?.[0] ?? "").toLowerCase();
      if (!SUBIDA_EXT.has(ext)) {
        throw badRequest("INVALID_FILE_TYPE", "La proforma tiene que ser un PDF o una foto (JPG o PNG).");
      }
      const subido = await saveUploadedFile(file, projectId);
      const creado = await prisma.fileAttachment.create({
        data: {
          projectId,
          filename: subido.filename,
          storedFilename: subido.storedFilename,
          mimeType: subido.mimeType,
          sizeBytes: subido.sizeBytes,
          url: subido.url,
          tipo: FileAttachmentTipo.UPLOAD_MANUAL,
          toolSource: TOOL_SOURCE_PROFORMA_SUBIDA,
          uploadedById: user.id,
        },
        select: { id: true, filename: true, createdAt: true },
      });
      await createAuditEntry({
        entityType: AuditEntityType.file,
        entityId: creado.id,
        projectId,
        userId: user.id,
        action: AuditAction.file_uploaded,
        description: `Subió la proforma '${creado.filename}' (hecha por fuera de Voltia PM)`,
      });
      // Igual que al generarla: el ítem "Proforma generada" se marca solo.
      await completarPorEvidencia(projectId, EVIDENCIA_PROFORMA, user.id).catch(() => undefined);
      return reply.status(201).send({ ...creado, origen: "proyecto" });
    },
  );

  app.delete(
    "/projects/:projectId/proforma/subidas/:fileId",
    { preHandler: authorize(Module.ONBOARDING, Action.EDIT) },
    async (request) => {
      const user = ensureUser(request);
      const { projectId, fileId } = z.object({ projectId: z.string().min(1), fileId: z.string().min(1) }).parse(request.params);
      const archivo = await prisma.fileAttachment.findFirst({
        where: { id: fileId, projectId, toolSource: TOOL_SOURCE_PROFORMA_SUBIDA, deletedAt: null },
        select: { id: true, url: true, filename: true },
      });
      if (!archivo) throw notFound("PROFORMA_SUBIDA_NOT_FOUND", "No existe esa proforma subida en el proyecto.");
      await prisma.fileAttachment.update({ where: { id: archivo.id }, data: { deletedAt: new Date() } });
      await deleteStoredFile(archivo.url);
      await createAuditEntry({
        entityType: AuditEntityType.file,
        entityId: archivo.id,
        projectId,
        userId: user.id,
        action: AuditAction.deleted,
        description: `Eliminó la proforma subida '${archivo.filename}'`,
      });
      // Si era la única, el ítem vuelve a quedar pendiente.
      await despintarPorEvidencia(projectId, EVIDENCIA_PROFORMA).catch(() => undefined);
      return { ok: true };
    },
  );
}

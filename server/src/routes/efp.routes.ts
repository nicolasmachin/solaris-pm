// Endpoints del Proyecto Final de Ingeniería (EFP). Permisos:
//   - VIEW (INGENIERIA) para listar/leer
//   - EDIT (INGENIERIA) para crear/editar versiones, subir anexos
//   - DELETE (INGENIERIA) para eliminar EFP, versión o anexo
//
// Generación con IA: POST /efp/:id/versions/generate-with-ai
// Snapshot manual: POST /efp/:id/versions/snapshot (duplica versión actual)
// Edición inline:   PATCH /efp/versions/:versionId — actualiza el content de la
//                   versión actual sin crear una nueva (estilo Notion).

import { Action, AuditAction, AuditEntityType, EFPStatus, FileAttachmentTipo, Module } from "@prisma/client";
import type { FastifyInstance, FastifyRequest } from "fastify";
import { z } from "zod";

import { prisma } from "../lib/prisma.js";
import { authenticate } from "../middleware/auth.middleware.js";
import { authorize } from "../middleware/authorize.middleware.js";
import { createAuditEntry } from "../services/audit.service.js";
import {
  buildEFPSnapshots,
  EFP_SECTION_KEYS,
  ensureEFP,
  generateEFPVersionWithAI,
  type EFPSectionKey,
} from "../services/efp.service.js";
// Generador viejo (pdfkit imperativo) queda en disco pero deprecated. La
// ruta de download usa v2 (Puppeteer + HTML).
// import { generateEFPPdf } from "../services/efpPdf/index.js";
import { generateEFPPdfV2 } from "../services/efpPdf/v2/index.js";
import { deleteStoredFile, saveUploadedFile } from "../services/file-storage.service.js";
import { notifyEngineeringCompleted } from "../services/notify.service.js";
import { badRequest, notFound, unauthorized } from "../utils/errors.js";
import { serializeDate } from "../utils/serialization.js";

function ensureUser(request: FastifyRequest) {
  if (!request.user) throw unauthorized("No autenticado");
  return request.user;
}

const ALLOWED_ATTACHMENT_MIMETYPES = new Set([
  "image/jpeg",
  "image/jpg",
  "image/png",
  "image/webp",
  "application/pdf",
]);

const sectionKeyEnum = z.enum(EFP_SECTION_KEYS) satisfies z.ZodType<EFPSectionKey>;

const contentPartialSchema = z.object({
  datosGenerales: z.string().optional(),
  resumenEjecutivo: z.string().optional(),
  analisisSitio: z.string().optional(),
  equipamiento: z.string().optional(),
  disenoElectrico: z.string().optional(),
  disenoMecanico: z.string().optional(),
  anexos: z.string().optional(),
});

const updateVersionBodySchema = z
  .object({
    content: contentPartialSchema.optional(),
    sectionKey: sectionKeyEnum.optional(),
    sectionContent: z.string().optional(),
    changesFromPrevious: z.string().nullable().optional(),
  })
  .refine(
    (v) =>
      v.content !== undefined ||
      (v.sectionKey !== undefined && v.sectionContent !== undefined) ||
      v.changesFromPrevious !== undefined,
    "Falta content, (sectionKey + sectionContent) o changesFromPrevious",
  );

function serializeVersion(v: {
  id: string;
  efpId: string;
  version: number;
  content: unknown;
  checklist: unknown;
  sourceVisitIds: string[];
  aiGenerated: boolean;
  modelUsed: string | null;
  tokensInput: number | null;
  tokensOutput: number | null;
  costUsd: { toNumber: () => number } | null;
  changesFromPrevious: string | null;
  createdAt: Date;
  updatedAt: Date;
  createdBy?: { id: string; name: string } | null;
}) {
  return {
    id: v.id,
    efpId: v.efpId,
    version: v.version,
    content: (v.content as Record<string, string>) ?? {},
    checklist: (v.checklist as Record<string, string[]> | null) ?? null,
    sourceVisitIds: v.sourceVisitIds,
    aiGenerated: v.aiGenerated,
    modelUsed: v.modelUsed,
    tokensInput: v.tokensInput,
    tokensOutput: v.tokensOutput,
    costUsd: v.costUsd ? v.costUsd.toNumber() : null,
    changesFromPrevious: v.changesFromPrevious,
    createdAt: serializeDate(v.createdAt),
    updatedAt: serializeDate(v.updatedAt),
    createdBy: v.createdBy ?? null,
  };
}

export async function registerEFPRoutes(app: FastifyInstance) {
  app.addHook("preHandler", authenticate);

  // ─── Get EFP del proyecto (con versiones + adjuntos) ─────────────────────
  app.get(
    "/projects/:projectId/efp",
    { preHandler: authorize(Module.INGENIERIA, Action.VIEW) },
    async (request) => {
      const params = z.object({ projectId: z.string().min(1) }).parse(request.params);

      const project = await prisma.project.findFirst({
        where: { id: params.projectId, deletedAt: null },
        select: { id: true, code: true, clientName: true },
      });
      if (!project) throw notFound("PROJECT_NOT_FOUND", "Proyecto no encontrado");

      const efp = await prisma.engineeringFinalProject.findFirst({
        where: { projectId: project.id, deletedAt: null },
        include: {
          versions: {
            orderBy: { version: "desc" },
            include: { createdBy: { select: { id: true, name: true } } },
          },
          attachments: {
            where: { deletedAt: null },
            orderBy: { createdAt: "desc" },
            include: {
              fileAttachment: {
                select: { id: true, filename: true, mimeType: true, sizeBytes: true, url: true },
              },
              uploadedBy: { select: { id: true, name: true } },
            },
          },
        },
      });

      if (!efp) {
        return {
          efp: null,
          project: { id: project.id, code: project.code, clientName: project.clientName },
        };
      }

      return {
        project: { id: project.id, code: project.code, clientName: project.clientName },
        efp: {
          id: efp.id,
          projectId: efp.projectId,
          status: efp.status,
          createdAt: serializeDate(efp.createdAt),
          updatedAt: serializeDate(efp.updatedAt),
          versions: efp.versions.map(serializeVersion),
          attachments: efp.attachments.map((a) => ({
            id: a.id,
            description: a.description,
            category: a.category,
            includeInPdf: a.includeInPdf,
            createdAt: serializeDate(a.createdAt),
            uploadedBy: a.uploadedBy,
            file: a.fileAttachment
              ? {
                  id: a.fileAttachment.id,
                  filename: a.fileAttachment.filename,
                  mimeType: a.fileAttachment.mimeType,
                  sizeBytes: a.fileAttachment.sizeBytes,
                  previewUrl: `/api/files/${a.fileAttachment.id}/preview`,
                  downloadUrl: `/api/files/${a.fileAttachment.id}/download`,
                }
              : null,
          })),
        },
      };
    },
  );

  // ─── Crear EFP vacío (sin versiones) ─────────────────────────────────────
  // Normalmente no hace falta llamarlo: la generación con IA crea el EFP.
  app.post(
    "/projects/:projectId/efp",
    { preHandler: authorize(Module.INGENIERIA, Action.EDIT) },
    async (request, reply) => {
      const params = z.object({ projectId: z.string().min(1) }).parse(request.params);
      const efp = await ensureEFP(params.projectId);
      reply.code(201);
      return efp;
    },
  );

  // ─── Cambiar status del EFP (DRAFT/REVIEW/APPROVED/ARCHIVED) ─────────────
  // Pasar a APPROVED dispara aviso a Operaciones + Admin (idempotente).
  app.patch(
    "/efp/:id/status",
    { preHandler: authorize(Module.INGENIERIA, Action.EDIT) },
    async (request) => {
      const user = ensureUser(request);
      const params = z.object({ id: z.string().min(1) }).parse(request.params);
      const body = z.object({ status: z.nativeEnum(EFPStatus) }).parse(request.body);

      const efp = await prisma.engineeringFinalProject.findFirst({
        where: { id: params.id, deletedAt: null },
        select: { id: true, projectId: true, status: true },
      });
      if (!efp) throw notFound("EFP_NOT_FOUND", "EFP no encontrado");

      if (efp.status === body.status) {
        return { id: efp.id, status: efp.status };
      }

      const updated = await prisma.engineeringFinalProject.update({
        where: { id: efp.id },
        data: { status: body.status },
        select: { id: true, status: true, projectId: true },
      });

      await createAuditEntry({
        entityType: AuditEntityType.file,
        entityId: efp.id,
        projectId: efp.projectId,
        userId: user.id,
        action: AuditAction.status_changed,
        description: `Cambió estado del Proyecto Final de Ingeniería de ${efp.status} a ${body.status}`,
        oldValue: efp.status,
        newValue: body.status,
      });

      if (body.status === EFPStatus.APPROVED) {
        await notifyEngineeringCompleted({
          projectId: efp.projectId,
          trigger: "efp_approved",
        });
      }

      return { id: updated.id, status: updated.status };
    },
  );

  // ─── Generar versión nueva con IA ────────────────────────────────────────
  app.post(
    "/projects/:projectId/efp/generate-with-ai",
    { preHandler: authorize(Module.INGENIERIA, Action.EDIT) },
    async (request, reply) => {
      const user = ensureUser(request);
      const params = z.object({ projectId: z.string().min(1) }).parse(request.params);
      const body = z
        .object({ sourceVisitIds: z.array(z.string().min(1)).default([]) })
        .parse(request.body ?? {});

      const result = await generateEFPVersionWithAI({
        projectId: params.projectId,
        sourceVisitIds: body.sourceVisitIds,
        generatedById: user.id,
      });

      await createAuditEntry({
        entityType: AuditEntityType.file,
        entityId: result.version.id,
        projectId: params.projectId,
        userId: user.id,
        action: AuditAction.created,
        description: `Generó Proyecto Final de Ingeniería v${result.version.version} con IA`,
        metadata: {
          kind: "efp_generation",
          modelUsed: result.metadata.modelUsed,
          latencyMs: result.metadata.latencyMs,
          tokensInput: result.metadata.tokensInput,
          tokensOutput: result.metadata.tokensOutput,
          costUsd: result.metadata.costUsd,
          sourceVisitIds: body.sourceVisitIds,
        },
      });

      reply.code(201);
      return {
        id: result.version.id,
        version: result.version.version,
        metadata: result.metadata,
      };
    },
  );

  // ─── Snapshot manual (duplica versión actual sin IA) ─────────────────────
  app.post(
    "/efp/:id/versions/snapshot",
    { preHandler: authorize(Module.INGENIERIA, Action.EDIT) },
    async (request, reply) => {
      const user = ensureUser(request);
      const params = z.object({ id: z.string().min(1) }).parse(request.params);

      const efp = await prisma.engineeringFinalProject.findFirst({
        where: { id: params.id, deletedAt: null },
        include: {
          versions: { orderBy: { version: "desc" }, take: 1 },
        },
      });
      if (!efp) throw notFound("EFP_NOT_FOUND", "EFP no encontrado");
      if (efp.versions.length === 0) {
        throw badRequest(
          "NO_VERSIONS",
          "No hay versiones para snapshotear — generá primero un borrador con IA.",
        );
      }

      const current = efp.versions[0];
      const nextVersion = current.version + 1;

      // Snapshot manual NO copia los snapshots de la versión origen — los
      // re-captura del estado actual de DB. La idea es: al "fotografiar" se
      // congela lo que hay en este momento, no lo que había cuando se generó
      // la versión anterior.
      const snapshots = await buildEFPSnapshots(efp.projectId);

      const created = await prisma.eFPVersion.create({
        data: {
          efpId: efp.id,
          version: nextVersion,
          content: current.content as object,
          checklist: (current.checklist ?? undefined) as object | undefined,
          sourceVisitIds: current.sourceVisitIds,
          aiGenerated: false,
          changesFromPrevious: `Snapshot manual desde v${current.version}`,
          createdById: user.id,
          snapshotProject: snapshots.snapshotProject as unknown as object,
          snapshotPreIng: snapshots.snapshotPreIng as unknown as object,
          snapshotUte: snapshots.snapshotUte as unknown as object,
          snapshotMaterials: snapshots.snapshotMaterials as unknown as object,
        },
        include: { createdBy: { select: { id: true, name: true } } },
      });

      await createAuditEntry({
        entityType: AuditEntityType.file,
        entityId: created.id,
        projectId: efp.projectId,
        userId: user.id,
        action: AuditAction.created,
        description: `Creó snapshot v${nextVersion} del Proyecto Final de Ingeniería`,
      });

      reply.code(201);
      return serializeVersion(created);
    },
  );

  // ─── Edición inline (no crea versión nueva) ──────────────────────────────
  app.patch(
    "/efp/versions/:versionId",
    { preHandler: authorize(Module.INGENIERIA, Action.EDIT) },
    async (request) => {
      const user = ensureUser(request);
      const params = z.object({ versionId: z.string().min(1) }).parse(request.params);
      const body = updateVersionBodySchema.parse(request.body);

      const version = await prisma.eFPVersion.findUnique({
        where: { id: params.versionId },
        include: { efp: { select: { id: true, projectId: true } } },
      });
      if (!version) throw notFound("EFP_VERSION_NOT_FOUND", "Versión no encontrada");

      const currentContent = (version.content as Record<string, string>) ?? {};
      let nextContent = currentContent;

      if (body.content) {
        nextContent = { ...currentContent, ...body.content };
      }
      if (body.sectionKey && body.sectionContent !== undefined) {
        nextContent = { ...nextContent, [body.sectionKey]: body.sectionContent };
      }

      const updated = await prisma.eFPVersion.update({
        where: { id: version.id },
        data: {
          content: nextContent as object,
          changesFromPrevious:
            body.changesFromPrevious !== undefined
              ? body.changesFromPrevious
              : version.changesFromPrevious,
        },
        include: { createdBy: { select: { id: true, name: true } } },
      });

      // Auditamos sólo cambios sustanciales (no cada keystroke). El frontend
      // hace debounce — cada PATCH ya representa un guardado deliberado.
      await createAuditEntry({
        entityType: AuditEntityType.file,
        entityId: version.id,
        projectId: version.efp.projectId,
        userId: user.id,
        action: AuditAction.updated,
        description: `Editó Proyecto Final de Ingeniería v${version.version}${body.sectionKey ? ` (sección ${body.sectionKey})` : ""}`,
      });

      return serializeVersion(updated);
    },
  );

  // ─── Eliminar versión ────────────────────────────────────────────────────
  app.delete(
    "/efp/versions/:versionId",
    { preHandler: authorize(Module.INGENIERIA, Action.DELETE) },
    async (request, reply) => {
      const user = ensureUser(request);
      const params = z.object({ versionId: z.string().min(1) }).parse(request.params);

      const version = await prisma.eFPVersion.findUnique({
        where: { id: params.versionId },
        include: { efp: { select: { id: true, projectId: true } } },
      });
      if (!version) throw notFound("EFP_VERSION_NOT_FOUND", "Versión no encontrada");

      await prisma.eFPVersion.delete({ where: { id: version.id } });

      await createAuditEntry({
        entityType: AuditEntityType.file,
        entityId: version.id,
        projectId: version.efp.projectId,
        userId: user.id,
        action: AuditAction.deleted,
        description: `Eliminó versión v${version.version} del Proyecto Final de Ingeniería`,
      });

      reply.code(204);
      return;
    },
  );

  // ─── Subir anexo (foto, datasheet, plano, etc.) ──────────────────────────
  app.post(
    "/efp/:id/attachments",
    { preHandler: authorize(Module.INGENIERIA, Action.EDIT) },
    async (request, reply) => {
      const user = ensureUser(request);
      const params = z.object({ id: z.string().min(1) }).parse(request.params);

      const efp = await prisma.engineeringFinalProject.findFirst({
        where: { id: params.id, deletedAt: null },
        select: { id: true, projectId: true },
      });
      if (!efp) throw notFound("EFP_NOT_FOUND", "EFP no encontrado");

      const part = await request.file();
      if (!part) throw badRequest("MISSING_FILE", "No se envió ningún archivo");

      if (!ALLOWED_ATTACHMENT_MIMETYPES.has(part.mimetype.toLowerCase())) {
        throw badRequest(
          "INVALID_MIMETYPE",
          `Tipo de archivo no permitido: ${part.mimetype}. Usá JPG, PNG, WEBP o PDF.`,
        );
      }

      // Multipart fields: description, category (opcional). Los pasamos como
      // query params porque vienen junto al archivo en form-data — leemos del
      // request.query (los formData de Fastify multipart no expone fields
      // adicionales fácilmente; usamos query como contrato simple del cliente).
      const queryParsed = z
        .object({
          description: z.string().max(200).optional(),
          category: z.enum(["datasheet", "foto", "plano", "otro"]).optional(),
        })
        .parse(request.query ?? {});

      const stored = await saveUploadedFile(part, efp.projectId);

      const fileAttachment = await prisma.fileAttachment.create({
        data: {
          projectId: efp.projectId,
          filename: stored.filename,
          storedFilename: stored.storedFilename,
          mimeType: stored.mimeType,
          sizeBytes: stored.sizeBytes,
          url: stored.url,
          tipo: FileAttachmentTipo.UPLOAD_MANUAL,
          toolSource: "efp-attach",
          toolEntityId: efp.id,
          uploadedById: user.id,
        },
      });

      const efpAttachment = await prisma.eFPAttachment.create({
        data: {
          efpId: efp.id,
          fileAttachmentId: fileAttachment.id,
          description: queryParsed.description ?? null,
          category: queryParsed.category ?? null,
          uploadedById: user.id,
        },
        include: {
          fileAttachment: {
            select: { id: true, filename: true, mimeType: true, sizeBytes: true, url: true },
          },
        },
      });

      await createAuditEntry({
        entityType: AuditEntityType.file,
        entityId: fileAttachment.id,
        projectId: efp.projectId,
        userId: user.id,
        action: AuditAction.file_uploaded,
        description: `Subió anexo al Proyecto Final de Ingeniería: ${fileAttachment.filename}`,
        metadata: {
          kind: "efp_attachment_upload",
          category: queryParsed.category ?? null,
          sizeBytes: fileAttachment.sizeBytes,
        },
      });

      reply.code(201);
      return {
        id: efpAttachment.id,
        description: efpAttachment.description,
        category: efpAttachment.category,
        createdAt: serializeDate(efpAttachment.createdAt),
        file: {
          id: fileAttachment.id,
          filename: fileAttachment.filename,
          mimeType: fileAttachment.mimeType,
          sizeBytes: fileAttachment.sizeBytes,
          previewUrl: `/api/files/${fileAttachment.id}/preview`,
          downloadUrl: `/api/files/${fileAttachment.id}/download`,
        },
      };
    },
  );

  // ─── Patch de un anexo (descripción / categoría / includeInPdf) ─────────
  app.patch(
    "/efp/attachments/:attachmentId",
    { preHandler: authorize(Module.INGENIERIA, Action.EDIT) },
    async (request) => {
      const user = ensureUser(request);
      const params = z.object({ attachmentId: z.string().min(1) }).parse(request.params);
      const body = z
        .object({
          description: z.string().max(500).nullable().optional(),
          category: z.enum(["datasheet", "foto", "plano", "otro"]).nullable().optional(),
          includeInPdf: z.boolean().optional(),
        })
        .strict()
        .parse(request.body);

      const existing = await prisma.eFPAttachment.findFirst({
        where: { id: params.attachmentId, deletedAt: null },
        include: { efp: { select: { projectId: true } } },
      });
      if (!existing) throw notFound("EFP_ATTACHMENT_NOT_FOUND", "Anexo no encontrado");

      const updated = await prisma.eFPAttachment.update({
        where: { id: existing.id },
        data: {
          ...(body.description !== undefined ? { description: body.description } : {}),
          ...(body.category !== undefined ? { category: body.category } : {}),
          ...(body.includeInPdf !== undefined ? { includeInPdf: body.includeInPdf } : {}),
        },
        select: { id: true, description: true, category: true, includeInPdf: true },
      });

      await createAuditEntry({
        entityType: AuditEntityType.file,
        entityId: existing.id,
        projectId: existing.efp.projectId,
        userId: user.id,
        action: AuditAction.updated,
        description: `Actualizó anexo del Proyecto Final${
          body.includeInPdf !== undefined ? ` (includeInPdf=${body.includeInPdf})` : ""
        }`,
        metadata: body,
      });

      return updated;
    },
  );

  // ─── Eliminar anexo ──────────────────────────────────────────────────────
  app.delete(
    "/efp/attachments/:attachmentId",
    { preHandler: authorize(Module.INGENIERIA, Action.EDIT) },
    async (request, reply) => {
      const user = ensureUser(request);
      const params = z.object({ attachmentId: z.string().min(1) }).parse(request.params);

      const attachment = await prisma.eFPAttachment.findUnique({
        where: { id: params.attachmentId },
        include: {
          efp: { select: { projectId: true } },
          fileAttachment: { select: { id: true, url: true } },
        },
      });
      if (!attachment) throw notFound("EFP_ATTACHMENT_NOT_FOUND", "Anexo no encontrado");

      await prisma.eFPAttachment.update({
        where: { id: attachment.id },
        data: { deletedAt: new Date() },
      });

      if (attachment.fileAttachment) {
        await prisma.fileAttachment.update({
          where: { id: attachment.fileAttachment.id },
          data: { deletedAt: new Date() },
        });
        await deleteStoredFile(attachment.fileAttachment.url).catch(() => undefined);
      }

      await createAuditEntry({
        entityType: AuditEntityType.file,
        entityId: attachment.id,
        projectId: attachment.efp.projectId,
        userId: user.id,
        action: AuditAction.deleted,
        description: `Eliminó anexo del Proyecto Final de Ingeniería`,
      });

      reply.code(204);
      return;
    },
  );

  // ─── Descargar PDF de una versión (on-demand) ────────────────────────────
  app.get(
    "/efp/versions/:versionId/pdf",
    { preHandler: authorize(Module.INGENIERIA, Action.VIEW) },
    async (request, reply) => {
      const params = z.object({ versionId: z.string().min(1) }).parse(request.params);

      // v2: el generador lee de los snapshots de la versión (Fase A). No
      // necesitamos pasar project/preIng/ute desde acá — el dataLoader del
      // v2 los obtiene del propio EFPVersion. Sólo verificamos existencia
      // para que el 404 lo dé este endpoint con código consistente.
      const exists = await prisma.eFPVersion.findUnique({
        where: { id: params.versionId },
        select: {
          id: true,
          version: true,
          efp: { select: { project: { select: { code: true } } } },
        },
      });
      if (!exists) throw notFound("EFP_VERSION_NOT_FOUND", "Versión no encontrada");

      const pdfBuffer = await generateEFPPdfV2(params.versionId);

      reply.header("Content-Type", "application/pdf");
      reply.header(
        "Content-Disposition",
        `inline; filename="proyecto-final-${exists.efp.project.code ?? "proyecto"}-v${exists.version}.pdf"`,
      );
      return reply.send(pdfBuffer);
    },
  );
}

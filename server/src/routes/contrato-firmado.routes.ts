// Contrato firmado por el cliente: un solo archivo vigente por proyecto, a la
// vista en la ficha del proyecto (bloque "Contrato firmado").
//
// Se guarda como FileAttachment del proyecto con toolSource "contrato-firmado".
// Subir uno nuevo reemplaza al anterior (soft-delete + borrado del archivo).
// No bloquea ninguna subetapa (decisión 11-oct-2026): lo que falta cargar se le
// avisa al asesor en el resumen diario por mail (digest/contratos-pendientes).
//
// Permisos (matriz, sin roles hardcodeados):
//   - ver:    OPERACIONES:VIEW (el mismo que Documentos del proyecto).
//   - subir:  ONBOARDING:EDIT u OPERACIONES:EDIT.
//   - quitar: ONBOARDING:EDIT u OPERACIONES:EDIT.

import path from "node:path";

import { Action, AuditAction, AuditEntityType, FileAttachmentTipo, Module } from "@prisma/client";
import type { FastifyInstance, FastifyRequest } from "fastify";
import { z } from "zod";

import { prisma } from "../lib/prisma.js";
import { authenticate } from "../middleware/auth.middleware.js";
import { authorize, authorizeAny } from "../middleware/authorize.middleware.js";
import { createAuditEntry } from "../services/audit.service.js";
import { TOOL_SOURCE_CONTRATO_FIRMADO } from "../services/documentos-generados.service.js";
import { deleteStoredFile, saveUploadedFile } from "../services/file-storage.service.js";
import { esHeic } from "../services/heic.service.js";
import { badRequest, notFound, unauthorized } from "../utils/errors.js";
import { serializeDate } from "../utils/serialization.js";
import { cerrarChecks } from "../services/clientes/recorrido.service.js";

// PDF o foto. HEIC/HEIF (iPhone) se acepta y `saveUploadedFile` lo pasa a JPEG.
const EXTENSIONES = new Set([".pdf", ".jpg", ".jpeg", ".png", ".webp", ".heic", ".heif"]);

// Ver: quien ve el onboarding o la operación. Experiencia Solar entra por
// ONBOARDING:VIEW: es quien controla que el contrato quede archivado.
const PUEDE_VER = [
  { module: Module.ONBOARDING, action: Action.VIEW },
  { module: Module.OPERACIONES, action: Action.VIEW },
];

const PUEDE_EDITAR = [
  { module: Module.ONBOARDING, action: Action.EDIT },
  { module: Module.OPERACIONES, action: Action.EDIT },
];

const projectParams = z.object({ projectId: z.string().min(1) });

function ensureUser(request: FastifyRequest) {
  if (!request.user) throw unauthorized("No autenticado");
  return request.user;
}

async function ensureProject(projectId: string) {
  const project = await prisma.project.findFirst({
    where: { id: projectId, deletedAt: null },
    select: { id: true, clientName: true },
  });
  if (!project) throw notFound("PROJECT_NOT_FOUND", "Proyecto no encontrado");
  return project;
}

function vigente(projectId: string) {
  return prisma.fileAttachment.findMany({
    where: { projectId, toolSource: TOOL_SOURCE_CONTRATO_FIRMADO, deletedAt: null },
    orderBy: { createdAt: "desc" },
    include: { uploadedBy: { select: { id: true, name: true } } },
  });
}

function serializar(file: {
  id: string;
  filename: string;
  mimeType: string;
  sizeBytes: number;
  createdAt: Date;
  uploadedBy: { id: string; name: string | null } | null;
}) {
  return {
    id: file.id,
    filename: file.filename,
    mimeType: file.mimeType,
    sizeBytes: file.sizeBytes,
    uploadedBy: file.uploadedBy ? { id: file.uploadedBy.id, name: file.uploadedBy.name } : null,
    createdAt: serializeDate(file.createdAt),
    previewUrl: `/api/files/${file.id}/preview`,
    downloadUrl: `/api/files/${file.id}/download`,
  };
}

export async function registerContratoFirmadoRoutes(app: FastifyInstance) {
  app.addHook("preHandler", authenticate);

  app.get(
    "/projects/:projectId/contrato-firmado",
    { preHandler: authorizeAny(PUEDE_VER) },
    async (request) => {
      const { projectId } = projectParams.parse(request.params);
      await ensureProject(projectId);
      const [actual] = await vigente(projectId);
      return { contrato: actual ? serializar(actual) : null };
    },
  );

  app.post(
    "/projects/:projectId/contrato-firmado",
    { preHandler: authorizeAny(PUEDE_EDITAR) },
    async (request, reply) => {
      const user = ensureUser(request);
      const { projectId } = projectParams.parse(request.params);
      const project = await ensureProject(projectId);

      const part = await request.file();
      if (!part) throw badRequest("FILE_REQUIRED", "Adjuntá el contrato firmado (PDF o foto).");
      const ext = path.extname(part.filename).toLowerCase();
      if (!EXTENSIONES.has(ext) && !esHeic({ filename: part.filename, mimetype: part.mimetype })) {
        await part.toBuffer().catch(() => undefined);
        throw badRequest("INVALID_FILE_TYPE", "Solo se permiten PDF o fotos (JPG, PNG, WEBP o HEIC).");
      }

      const anteriores = await vigente(projectId);
      const saved = await saveUploadedFile(part, projectId);
      const creado = await prisma.fileAttachment.create({
        data: {
          projectId,
          filename: saved.filename,
          storedFilename: saved.storedFilename,
          mimeType: saved.mimeType,
          sizeBytes: saved.sizeBytes,
          url: saved.url,
          tipo: FileAttachmentTipo.UPLOAD_MANUAL,
          toolSource: TOOL_SOURCE_CONTRATO_FIRMADO,
          uploadedById: user.id,
        },
        include: { uploadedBy: { select: { id: true, name: true } } },
      });

      // Reemplazo: queda un solo contrato firmado vigente.
      if (anteriores.length > 0) {
        await prisma.fileAttachment.updateMany({
          where: { id: { in: anteriores.map((a) => a.id) } },
          data: { deletedAt: new Date() },
        });
        await Promise.all(anteriores.map((a) => deleteStoredFile(a.url).catch(() => undefined)));
      }

      await createAuditEntry({
        entityType: AuditEntityType.file,
        entityId: creado.id,
        projectId,
        userId: user.id,
        action: AuditAction.file_uploaded,
        description:
          `${anteriores.length > 0 ? "Reemplazó" : "Subió"} el contrato firmado de ${project.clientName} ('${saved.filename}')`,
      });

      await cerrarChecks({
        projectId,
        codigos: ["e1_contrato_firmado"],
        userId: user.id,
        fuente: "hecho",
        motivo: "se subió el contrato firmado",
      });

      reply.code(201);
      return { contrato: serializar(creado) };
    },
  );

  app.delete(
    "/projects/:projectId/contrato-firmado",
    { preHandler: authorizeAny(PUEDE_EDITAR) },
    async (request, reply) => {
      const user = ensureUser(request);
      const { projectId } = projectParams.parse(request.params);
      const project = await ensureProject(projectId);
      const actuales = await vigente(projectId);
      if (actuales.length === 0) throw notFound("FILE_NOT_FOUND", "El proyecto no tiene contrato firmado cargado.");

      await prisma.fileAttachment.updateMany({
        where: { id: { in: actuales.map((a) => a.id) } },
        data: { deletedAt: new Date() },
      });
      await Promise.all(actuales.map((a) => deleteStoredFile(a.url).catch(() => undefined)));
      await createAuditEntry({
        entityType: AuditEntityType.file,
        entityId: actuales[0].id,
        projectId,
        userId: user.id,
        action: AuditAction.deleted,
        description: `Quitó el contrato firmado de ${project.clientName} ('${actuales[0].filename}')`,
      });
      return reply.code(204).send();
    },
  );
}

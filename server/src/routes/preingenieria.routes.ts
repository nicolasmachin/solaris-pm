// REST endpoints del generador de Pre-Ingeniería ("Resumen Técnico").
// Vive bajo el módulo INGENIERIA. Mismo patrón que `unifilar.routes.ts`:
// versionado 1:N inmutable, snapshot del cliente al crear, PDF persistido como
// FileAttachment con `toolSource="preing"`. Las fotos se suben antes via
// `upload-foto` y se asocian al crear la versión.

import { Action, FileAttachmentTipo, Module } from "@prisma/client";
import type { FastifyInstance } from "fastify";

import { authenticate } from "../middleware/auth.middleware.js";
import { authorize } from "../middleware/authorize.middleware.js";
import { prisma } from "../lib/prisma.js";
import { saveUploadedFile } from "../services/file-storage.service.js";
import { badRequest, notFound, unauthorized } from "../utils/errors.js";

function ensureUser(request: import("fastify").FastifyRequest) {
  if (!request.user) throw unauthorized("No autenticado");
  return request.user;
}

const ALLOWED_PHOTO_MIMETYPES = new Set([
  "image/jpeg",
  "image/jpg",
  "image/png",
  "image/webp",
]);

export async function registerPreIngenieriaRoutes(app: FastifyInstance) {
  app.addHook("preHandler", authenticate);

  // ─── Subir foto (paso previo a crear versión) ────────────────────────────
  // Multipart: un solo archivo. Crea un FileAttachment "huérfano" con tipo
  // UPLOAD_MANUAL y sin toolSource — al crear la versión Pre-Ingeniería se
  // referencia desde PreIngenieriaFoto. Si la foto nunca se asocia (el usuario
  // cancela), queda como upload manual del proyecto (visible en Documentos).
  app.post(
    "/projects/:projectId/preingenieria-versions/upload-foto",
    { preHandler: authorize(Module.INGENIERIA, Action.EDIT) },
    async (request, reply) => {
      const user = ensureUser(request);
      const projectId = (request.params as { projectId?: string }).projectId;
      if (!projectId) throw badRequest("MISSING_PROJECT_ID", "Falta projectId");

      const project = await prisma.project.findFirst({
        where: { id: projectId, deletedAt: null },
        select: { id: true },
      });
      if (!project) throw notFound("PROJECT_NOT_FOUND", "Proyecto no encontrado");

      const part = await request.file();
      if (!part) throw badRequest("MISSING_FILE", "No se envió ningún archivo");

      if (!ALLOWED_PHOTO_MIMETYPES.has(part.mimetype.toLowerCase())) {
        throw badRequest(
          "INVALID_PHOTO_MIMETYPE",
          `Tipo de imagen no permitido: ${part.mimetype}. Usá JPG, PNG o WEBP.`,
        );
      }

      const stored = await saveUploadedFile(part, projectId);

      const attachment = await prisma.fileAttachment.create({
        data: {
          projectId,
          filename: stored.filename,
          storedFilename: stored.storedFilename,
          mimeType: stored.mimeType,
          sizeBytes: stored.sizeBytes,
          url: stored.url,
          tipo: FileAttachmentTipo.UPLOAD_MANUAL,
          uploadedById: user.id,
        },
      });

      reply.code(201);
      return {
        fileId: attachment.id,
        filename: attachment.filename,
        size: attachment.sizeBytes,
      };
    },
  );
}

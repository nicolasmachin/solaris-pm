// Endpoints del módulo Ventas — adjuntos y fotos de leads.
// El resto de la API de leads (CRUD, conversión, stage transitions, métricas,
// proposals) vive todavía en api.routes.ts; el refactor a este archivo
// queda pendiente como segunda fase.

import fs from "node:fs";

import { Action, AuditAction, AuditEntityType, Module } from "@prisma/client";
import type { FastifyInstance, FastifyRequest } from "fastify";
import { z } from "zod";

import { prisma } from "../lib/prisma.js";
import { authenticate } from "../middleware/auth.middleware.js";
import { authorize } from "../middleware/authorize.middleware.js";
import { createAuditEntry } from "../services/audit.service.js";
import { contentDisposition } from "../utils/content-disposition.js";
import {
  deleteLeadAttachmentFile,
  leadAttachmentAbsolutePath,
  saveLeadAttachment,
} from "../services/sales/sales.service.js";
import {
  deleteObraPhotoFiles,
  deriveObraThumbUrl,
  getStoredFilePath,
  saveLeadPhoto,
} from "../services/file-storage.service.js";
import { badRequest, notFound, unauthorized } from "../utils/errors.js";
import { serializeDate } from "../utils/serialization.js";

function ensureUser(request: FastifyRequest) {
  if (!request.user) throw unauthorized("No autenticado");
  return request.user;
}

function serializeLeadAttachment(a: {
  id: string;
  filename: string;
  mimeType: string;
  sizeBytes: number;
  url: string;
  uploadedBy?: { id: string; name: string } | null;
  createdAt: Date;
}) {
  return {
    id: a.id,
    filename: a.filename,
    mimeType: a.mimeType,
    sizeBytes: a.sizeBytes,
    url: a.url,
    uploadedBy: a.uploadedBy ?? null,
    createdAt: serializeDate(a.createdAt),
  };
}

export async function registerSalesRoutes(app: FastifyInstance) {
  app.addHook("preHandler", authenticate);

  // ─── Listar adjuntos del lead ────────────────────────────────────────────
  app.get(
    "/leads/:id/attachments",
    { preHandler: authorize(Module.VENTAS, Action.VIEW) },
    async (request) => {
      const params = z.object({ id: z.string().min(1) }).parse(request.params);
      const lead = await prisma.salesLead.findFirst({
        where: { id: params.id, deletedAt: null },
        select: { id: true },
      });
      if (!lead) throw notFound("LEAD_NOT_FOUND", "Lead no encontrado");

      const items = await prisma.fileAttachment.findMany({
        where: { leadId: params.id, deletedAt: null },
        include: { uploadedBy: { select: { id: true, name: true } } },
        orderBy: { createdAt: "desc" },
      });
      return items.map(serializeLeadAttachment);
    },
  );

  // ─── Subir adjunto al lead ───────────────────────────────────────────────
  app.post(
    "/leads/:id/attachments",
    { preHandler: authorize(Module.VENTAS, Action.EDIT) },
    async (request, reply) => {
      const user = ensureUser(request);
      const params = z.object({ id: z.string().min(1) }).parse(request.params);

      const lead = await prisma.salesLead.findFirst({
        where: { id: params.id, deletedAt: null },
        select: { id: true },
      });
      if (!lead) throw notFound("LEAD_NOT_FOUND", "Lead no encontrado");

      const file = await request.file();
      if (!file) throw badRequest("NO_FILE", "Falta el archivo en la request multipart");

      const saved = await saveLeadAttachment(file, lead.id);
      const created = await prisma.fileAttachment.create({
        data: {
          leadId: lead.id,
          projectId: null,
          filename: saved.filename,
          storedFilename: saved.storedFilename,
          mimeType: saved.mimeType,
          sizeBytes: saved.sizeBytes,
          url: saved.url,
          uploadedById: user.id,
        },
        include: { uploadedBy: { select: { id: true, name: true } } },
      });

      await createAuditEntry({
        entityType: AuditEntityType.file,
        entityId: created.id,
        userId: user.id,
        action: AuditAction.file_uploaded,
        description: `Subió adjunto "${saved.filename}" al lead`,
      });

      reply.code(201);
      return serializeLeadAttachment(created);
    },
  );

  // ─── Descargar adjunto ───────────────────────────────────────────────────
  app.get(
    "/leads/:leadId/attachments/:attachmentId/download",
    { preHandler: authorize(Module.VENTAS, Action.VIEW) },
    async (request, reply) => {
      const params = z
        .object({ leadId: z.string().min(1), attachmentId: z.string().min(1) })
        .parse(request.params);

      const attachment = await prisma.fileAttachment.findFirst({
        where: { id: params.attachmentId, leadId: params.leadId, deletedAt: null },
      });
      if (!attachment) throw notFound("ATTACHMENT_NOT_FOUND", "Adjunto no encontrado");

      const absolutePath = leadAttachmentAbsolutePath(attachment.url);
      if (!fs.existsSync(absolutePath)) {
        throw notFound("FILE_MISSING", "El archivo físico ya no existe en el storage");
      }

      reply.header("Content-Type", attachment.mimeType);
      reply.header("Content-Disposition", contentDisposition("attachment", attachment.filename));
      return reply.send(fs.createReadStream(absolutePath));
    },
  );

  // ─── Eliminar adjunto (soft-delete) ──────────────────────────────────────
  app.delete(
    "/leads/:leadId/attachments/:attachmentId",
    { preHandler: authorize(Module.VENTAS, Action.DELETE) },
    async (request, reply) => {
      const user = ensureUser(request);
      const params = z
        .object({ leadId: z.string().min(1), attachmentId: z.string().min(1) })
        .parse(request.params);

      const attachment = await prisma.fileAttachment.findFirst({
        where: { id: params.attachmentId, leadId: params.leadId, deletedAt: null },
      });
      if (!attachment) throw notFound("ATTACHMENT_NOT_FOUND", "Adjunto no encontrado");

      await prisma.fileAttachment.update({
        where: { id: attachment.id },
        data: { deletedAt: new Date() },
      });
      // El archivo físico lo borramos también: el adjunto está soft-deleted
      // pero el binario ya no hace falta. Si querés conservar el binario,
      // sacar esta línea.
      await deleteLeadAttachmentFile(attachment.url);

      await createAuditEntry({
        entityType: AuditEntityType.file,
        entityId: attachment.id,
        userId: user.id,
        action: AuditAction.deleted,
        description: `Eliminó adjunto "${attachment.filename}" del lead`,
      });

      reply.code(204);
      return;
    },
  );

  // ── Fotos de la visita de ventas ──────────────────────────────────────────
  //
  // Galería propia y no la lista de adjuntos: en una visita se sacan diez fotos
  // y hace falta verlas en miniatura, no como filas de archivos. Se guardan como
  // FileAttachment del lead con `toolSource` propio, así el traspaso al proyecto
  // (cuando el lead se gana) las arrastra igual que al resto de los adjuntos.
  const LEAD_FOTO_TOOL_SOURCE = "lead-fotos";

  app.get(
    "/leads/:leadId/fotos",
    { preHandler: [authenticate, authorize(Module.VENTAS, Action.VIEW)] },
    async (request) => {
      const params = z.object({ leadId: z.string().min(1) }).parse(request.params);

      const fotos = await prisma.fileAttachment.findMany({
        where: { leadId: params.leadId, toolSource: LEAD_FOTO_TOOL_SOURCE, deletedAt: null },
        orderBy: { createdAt: "desc" },
        select: {
          id: true,
          filename: true,
          sizeBytes: true,
          createdAt: true,
          uploadedBy: { select: { id: true, name: true } },
        },
      });

      return {
        fotos: fotos.map((f) => ({
          ...f,
          createdAt: serializeDate(f.createdAt),
          thumbnailUrl: `/api/leads/${params.leadId}/fotos/${f.id}/thumb`,
          fullUrl: `/api/leads/${params.leadId}/fotos/${f.id}/full`,
        })),
        count: fotos.length,
      };
    },
  );

  app.post(
    "/leads/:leadId/fotos",
    { preHandler: [authenticate, authorize(Module.VENTAS, Action.CREATE)] },
    async (request, reply) => {
      const user = ensureUser(request);
      const params = z.object({ leadId: z.string().min(1) }).parse(request.params);

      const lead = await prisma.salesLead.findFirst({
        where: { id: params.leadId, deletedAt: null },
        select: { id: true },
      });
      if (!lead) throw notFound("LEAD_NOT_FOUND", "El lead no existe");

      const file = await request.file();
      if (!file) throw badRequest("NO_FILE", "No se recibió ningún archivo");

      const stored = await saveLeadPhoto(file, params.leadId);

      const created = await prisma.fileAttachment.create({
        data: {
          leadId: params.leadId,
          filename: stored.filename,
          storedFilename: stored.storedFilename,
          mimeType: stored.mimeType,
          sizeBytes: stored.sizeBytes,
          url: stored.url,
          toolSource: LEAD_FOTO_TOOL_SOURCE,
          uploadedById: user.id,
        },
        select: { id: true, filename: true, sizeBytes: true, createdAt: true },
      });

      reply.code(201);
      return { ...created, createdAt: serializeDate(created.createdAt) };
    },
  );

  // Miniatura y original. Van por endpoint autenticado (no estático) para que
  // las fotos de un lead no queden accesibles por URL a cualquiera.
  for (const [sufijo, esThumb] of [
    ["thumb", true],
    ["full", false],
  ] as const) {
    app.get(
      `/leads/:leadId/fotos/:fotoId/${sufijo}`,
      { preHandler: [authenticate, authorize(Module.VENTAS, Action.VIEW)] },
      async (request, reply) => {
        const params = z
          .object({ leadId: z.string().min(1), fotoId: z.string().min(1) })
          .parse(request.params);

        const foto = await prisma.fileAttachment.findFirst({
          where: { id: params.fotoId, leadId: params.leadId, deletedAt: null },
          select: { url: true, mimeType: true },
        });
        if (!foto) throw notFound("FOTO_NOT_FOUND", "La foto no existe");

        const url = esThumb ? deriveObraThumbUrl(foto.url) : foto.url;
        const absolutePath = getStoredFilePath(url);

        return reply
          .header("Content-Type", esThumb ? "image/jpeg" : foto.mimeType)
          .header("Cache-Control", "private, max-age=3600")
          .send(fs.createReadStream(absolutePath));
      },
    );
  }

  app.delete(
    "/leads/:leadId/fotos/:fotoId",
    { preHandler: [authenticate, authorize(Module.VENTAS, Action.DELETE)] },
    async (request, reply) => {
      const user = ensureUser(request);
      const params = z
        .object({ leadId: z.string().min(1), fotoId: z.string().min(1) })
        .parse(request.params);

      const foto = await prisma.fileAttachment.findFirst({
        where: { id: params.fotoId, leadId: params.leadId, deletedAt: null },
        select: { id: true, url: true, filename: true },
      });
      if (!foto) throw notFound("FOTO_NOT_FOUND", "La foto no existe");

      await prisma.fileAttachment.update({
        where: { id: foto.id },
        data: { deletedAt: new Date() },
      });
      await deleteObraPhotoFiles(foto.url);

      await createAuditEntry({
        entityType: AuditEntityType.file,
        entityId: foto.id,
        userId: user.id,
        action: AuditAction.deleted,
        description: `Eliminó la foto "${foto.filename}" de la visita del lead`,
      });

      reply.code(204);
      return;
    },
  );
}

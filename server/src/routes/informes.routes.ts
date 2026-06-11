import fs from "node:fs";

import type { FastifyInstance, FastifyRequest } from "fastify";
import { z } from "zod";

import { Action, AuditAction, AuditEntityType, InformeEstado, Module } from "@prisma/client";

import { authenticate } from "../middleware/auth.middleware.js";
import { authorize } from "../middleware/authorize.middleware.js";
import { createAuditEntry } from "../services/audit.service.js";
import { badRequest, unauthorized } from "../utils/errors.js";
import {
  borrarInforme,
  contarPendientes,
  crearInforme,
  editarInforme,
  enviarInforme,
  listarInformes,
  obtenerInforme,
  responderInforme,
  type RequestUser,
} from "../services/informes/informes.service.js";
import {
  borrarAdjunto,
  obtenerAdjuntoDescarga,
  subirAdjunto,
} from "../services/informes/informes-adjuntos.service.js";

function ensureUser(request: FastifyRequest): RequestUser {
  if (!request.user) throw unauthorized("No autenticado");
  return { id: request.user.id, role: request.user.role };
}

const idParam = z.object({ id: z.string().min(1) });
const adjuntoParams = z.object({ id: z.string().min(1), fileId: z.string().min(1) });

const crearSchema = z
  .object({
    titulo: z.string().trim().min(1).max(200),
    cuerpo: z.string().trim().min(1),
    projectId: z.string().min(1).nullable().optional(),
    destinatariosIds: z.array(z.string().min(1)).min(1),
  })
  .strict();

const editarSchema = z
  .object({
    titulo: z.string().trim().min(1).max(200).optional(),
    cuerpo: z.string().trim().min(1).optional(),
    projectId: z.string().min(1).nullable().optional(),
    destinatariosIds: z.array(z.string().min(1)).min(1).optional(),
  })
  .strict();

const responderSchema = z
  .object({
    respuesta: z.enum(["APROBADO", "DEVUELTO"]),
    comentario: z.string().trim().min(1).optional(),
  })
  .strict()
  .refine((v) => v.respuesta !== "DEVUELTO" || !!v.comentario, {
    message: "El comentario es obligatorio para devolver el informe",
    path: ["comentario"],
  });

const listQuery = z
  .object({
    box: z.enum(["recibidos", "enviados", "todos"]).optional(),
    estado: z.nativeEnum(InformeEstado).optional(),
    projectId: z.string().min(1).optional(),
    search: z.string().trim().min(1).optional(),
  })
  .strict();

export async function registerInformesRoutes(app: FastifyInstance) {
  // Todas las rutas del módulo requieren usuario autenticado. El hook se aplica
  // en el scope de este plugin (encapsulación Fastify), igual que el resto de
  // los grupos de rutas. Sin esto `request.user` queda undefined y `authorize`
  // responde 401 "No autenticado" en cada endpoint — lo que tumbaba la sesión
  // del front al llamar al contador del badge.
  app.addHook("preHandler", authenticate);

  // ─── Badge de pendientes (ruta estática antes que /:id) ─────────────────────
  app.get(
    "/informes/pendientes/count",
    { preHandler: authorize(Module.INFORMES, Action.VIEW) },
    async (request) => {
      const user = ensureUser(request);
      const count = await contarPendientes(user.id);
      return { count };
    },
  );

  // ─── Listar (row-level + ADMIN) ─────────────────────────────────────────────
  app.get("/informes", { preHandler: authorize(Module.INFORMES, Action.VIEW) }, async (request) => {
    const user = ensureUser(request);
    const q = listQuery.parse(request.query);
    return listarInformes(user, q);
  });

  // ─── Detalle (guard row-level en el servicio) ───────────────────────────────
  app.get("/informes/:id", { preHandler: authorize(Module.INFORMES, Action.VIEW) }, async (request) => {
    const user = ensureUser(request);
    const { id } = idParam.parse(request.params);
    return obtenerInforme(id, user);
  });

  // ─── Crear (BORRADOR) ───────────────────────────────────────────────────────
  app.post("/informes", { preHandler: authorize(Module.INFORMES, Action.CREATE) }, async (request, reply) => {
    const user = ensureUser(request);
    const body = crearSchema.parse(request.body);
    const informe = await crearInforme(user.id, body);
    await createAuditEntry({
      entityType: AuditEntityType.informe,
      entityId: informe.id,
      projectId: informe.projectId,
      userId: user.id,
      action: AuditAction.created,
      description: `Creó informe (borrador): ${informe.titulo}`,
    });
    reply.code(201);
    return informe;
  });

  // ─── Editar (solo BORRADOR + autor) ─────────────────────────────────────────
  app.patch("/informes/:id", { preHandler: authorize(Module.INFORMES, Action.EDIT) }, async (request) => {
    const user = ensureUser(request);
    const { id } = idParam.parse(request.params);
    const body = editarSchema.parse(request.body);
    const informe = await editarInforme(id, user.id, body);
    await createAuditEntry({
      entityType: AuditEntityType.informe,
      entityId: informe.id,
      projectId: informe.projectId,
      userId: user.id,
      action: AuditAction.updated,
      description: `Editó informe: ${informe.titulo}`,
    });
    return informe;
  });

  // ─── Enviar (BORRADOR → PENDIENTE) ──────────────────────────────────────────
  app.post("/informes/:id/enviar", { preHandler: authorize(Module.INFORMES, Action.EDIT) }, async (request) => {
    const user = ensureUser(request);
    const { id } = idParam.parse(request.params);
    const informe = await enviarInforme(id, user.id);
    await createAuditEntry({
      entityType: AuditEntityType.informe,
      entityId: informe.id,
      projectId: informe.projectId,
      userId: user.id,
      action: AuditAction.status_changed,
      fieldChanged: "estado",
      oldValue: InformeEstado.BORRADOR,
      newValue: InformeEstado.PENDIENTE,
      description: `Envió el informe: ${informe.titulo}`,
    });
    return informe;
  });

  // ─── Responder (destinatario; aprobar/devolver) ─────────────────────────────
  app.post("/informes/:id/responder", { preHandler: authorize(Module.INFORMES, Action.VIEW) }, async (request) => {
    const user = ensureUser(request);
    const { id } = idParam.parse(request.params);
    const body = responderSchema.parse(request.body);
    const { informe, estado } = await responderInforme(id, user.id, body);
    await createAuditEntry({
      entityType: AuditEntityType.informe,
      entityId: informe.id,
      projectId: informe.projectId,
      userId: user.id,
      action: AuditAction.status_changed,
      fieldChanged: "respuesta",
      newValue: body.respuesta, // APROBADO | DEVUELTO (respuesta del destinatario)
      description: body.respuesta === "DEVUELTO" ? "Devolvió el informe" : "Aprobó el informe",
      metadata: { estadoConsolidado: estado },
    });
    return { id: informe.id, estado };
  });

  // ─── Borrar (solo BORRADOR + autor) ─────────────────────────────────────────
  app.delete("/informes/:id", { preHandler: authorize(Module.INFORMES, Action.EDIT) }, async (request, reply) => {
    const user = ensureUser(request);
    const { id } = idParam.parse(request.params);
    await borrarInforme(id, user.id);
    await createAuditEntry({
      entityType: AuditEntityType.informe,
      entityId: id,
      userId: user.id,
      action: AuditAction.deleted,
      description: "Borró un informe",
    });
    return reply.code(204).send();
  });

  // ─── Adjuntos: subir (autor + BORRADOR; multipart files:1) ──────────────────
  app.post("/informes/:id/adjuntos", { preHandler: authorize(Module.INFORMES, Action.EDIT) }, async (request, reply) => {
    const user = ensureUser(request);
    const { id } = idParam.parse(request.params);
    const part = await request.file();
    if (!part) throw badRequest("FILE_REQUIRED", "Debés adjuntar un archivo");
    const adjunto = await subirAdjunto(id, user.id, part);
    await createAuditEntry({
      entityType: AuditEntityType.informe,
      entityId: id,
      userId: user.id,
      action: AuditAction.file_uploaded,
      description: `Adjuntó '${adjunto.filename}' al informe`,
    });
    reply.code(201);
    return adjunto;
  });

  // ─── Adjuntos: borrar (autor + BORRADOR) ────────────────────────────────────
  app.delete(
    "/informes/:id/adjuntos/:fileId",
    { preHandler: authorize(Module.INFORMES, Action.EDIT) },
    async (request, reply) => {
      const user = ensureUser(request);
      const { id, fileId } = adjuntoParams.parse(request.params);
      await borrarAdjunto(id, fileId, user.id);
      return reply.code(204).send();
    },
  );

  // ─── Adjuntos: preview (inline) y download (attachment) — row-level ─────────
  app.get(
    "/informes/:id/adjuntos/:fileId/preview",
    { preHandler: authorize(Module.INFORMES, Action.VIEW) },
    async (request, reply) => {
      const user = ensureUser(request);
      const { id, fileId } = adjuntoParams.parse(request.params);
      const file = await obtenerAdjuntoDescarga(id, fileId, user);
      reply.header("Content-Type", file.mimeType);
      reply.header("Content-Disposition", `inline; filename="${file.filename}"`);
      return reply.send(fs.createReadStream(file.absolutePath));
    },
  );

  app.get(
    "/informes/:id/adjuntos/:fileId/download",
    { preHandler: authorize(Module.INFORMES, Action.VIEW) },
    async (request, reply) => {
      const user = ensureUser(request);
      const { id, fileId } = adjuntoParams.parse(request.params);
      const file = await obtenerAdjuntoDescarga(id, fileId, user);
      reply.header("Content-Type", file.mimeType);
      reply.header("Content-Disposition", `attachment; filename="${file.filename}"`);
      return reply.send(fs.createReadStream(file.absolutePath));
    },
  );
}

// Endpoints del módulo Documentación (intranet). Prefijo /api.
// Consumo: DOCUMENTACION:VIEW + visibilidad por rol (row-level en el service).
// Gestión: DOCUMENTACION:EDIT. Ver services/documentacion/documentacion.service.ts.

import fs from "node:fs";

import { Action, AuditAction, AuditEntityType, Module } from "@prisma/client";
import type { FastifyInstance, FastifyRequest } from "fastify";
import { z } from "zod";

import { authenticate } from "../middleware/auth.middleware.js";
import { authorize } from "../middleware/authorize.middleware.js";
import { createAuditEntry } from "../services/audit.service.js";
import * as doc from "../services/documentacion/documentacion.service.js";
import { contentDisposition } from "../utils/content-disposition.js";
import { badRequest } from "../utils/errors.js";
import { verificarTokenDescarga } from "../utils/token-descarga.js";

function ensureUser(request: FastifyRequest) {
  if (!request.user) throw badRequest("AUTH_CONTEXT_MISSING", "No se pudo resolver el usuario autenticado");
  return request.user;
}

const idParam = z.object({ id: z.string().min(1) });
const fecha = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Fecha inválida (AAAA-MM-DD)");
const roleIds = z.preprocess(
  (v) => (typeof v === "string" ? v.split(",").filter(Boolean) : v),
  z.array(z.string().min(1)),
);
const booleano = z.preprocess((v) => v === true || v === "true" || v === "1", z.boolean());

const ver = { preHandler: authorize(Module.DOCUMENTACION, Action.VIEW) };
const gestionar = { preHandler: authorize(Module.DOCUMENTACION, Action.EDIT) };

function audit(userId: string, entityId: string, action: AuditAction, description: string) {
  return createAuditEntry({ entityType: AuditEntityType.documento_intranet, entityId, userId, action, description });
}

export async function registerDocumentacionRoutes(app: FastifyInstance) {
  // Descarga y vista previa: sin `authenticate`, porque un enlace o un iframe
  // no mandan el header Authorization. El permiso viaja en `?t=`, atado a la
  // versión (lo emiten los endpoints de abajo).
  const tokenQuery = z.object({ t: z.string().min(1) });
  for (const [sufijo, disposition] of [["download", "attachment"], ["preview", "inline"]] as const) {
    app.get(`/documentacion/versiones/:id/${sufijo}`, async (request, reply) => {
      const { id } = idParam.parse(request.params);
      const { t } = tokenQuery.parse(request.query);
      const user = verificarTokenDescarga(t, doc.TOKEN_DESCARGA, id);
      const file = await doc.versionParaDescarga(id, user);
      reply.header("Content-Type", file.mimeType);
      reply.header("Content-Disposition", contentDisposition(disposition, file.filename));
      reply.header("Cache-Control", "private, max-age=3600");
      return reply.send(fs.createReadStream(file.absolutePath));
    });
  }

  await app.register(async (app) => {
    app.addHook("preHandler", authenticate);

    // ─── Consumo ────────────────────────────────────────────────────────────

    app.get("/documentacion", ver, async (request) => doc.listar(ensureUser(request)));

    app.get("/documentacion/pendientes", ver, async (request) => ({
      pendientes: await doc.pendientesDeLectura(ensureUser(request)),
    }));

    app.get("/documentacion/:id", ver, async (request) => {
      const { id } = idParam.parse(request.params);
      return doc.detalle(id, ensureUser(request));
    });

    app.post("/documentacion/:id/leido", ver, async (request) => {
      const user = ensureUser(request);
      const { id } = idParam.parse(request.params);
      const r = await doc.confirmarLectura(id, user);
      await audit(user.id, id, AuditAction.status_changed, `Confirmó la lectura de la versión ${r.version}`);
      return r;
    });

    // ─── Gestión ────────────────────────────────────────────────────────────

    app.get("/documentacion/gestion/roles", gestionar, async () => doc.rolesAsignables());

    // Los metadatos van por querystring (el archivo es la única parte multipart).
    app.post("/documentacion", gestionar, async (request, reply) => {
      const user = ensureUser(request);
      const q = z
        .object({
          titulo: z.string().trim().min(1).max(200),
          descripcion: z.string().trim().max(2000).optional(),
          categoria: z.string().trim().min(1).max(80),
          requiereLectura: booleano.default(false),
          roleIds: roleIds.default([]),
          version: z.string().trim().min(1).max(20),
          vigenteDesde: fecha.optional(),
          notas: z.string().trim().max(4000).optional(),
        })
        .parse(request.query);
      const part = await request.file();
      if (!part) throw badRequest("FILE_REQUIRED", "Debés adjuntar un archivo");
      const creado = await doc.crearDocumento(part, { ...q, descripcion: q.descripcion || null, notas: q.notas || null }, user.id);
      await audit(user.id, creado.id, AuditAction.created, `Publicó el documento '${creado.titulo}' (versión ${q.version})`);
      reply.code(201);
      return creado;
    });

    app.post("/documentacion/:id/versiones", gestionar, async (request, reply) => {
      const user = ensureUser(request);
      const { id } = idParam.parse(request.params);
      const q = z
        .object({
          version: z.string().trim().min(1).max(20),
          vigenteDesde: fecha.optional(),
          notas: z.string().trim().max(4000).optional(),
        })
        .parse(request.query);
      const part = await request.file();
      if (!part) throw badRequest("FILE_REQUIRED", "Debés adjuntar un archivo");
      const v = await doc.subirVersion(id, part, { ...q, notas: q.notas || null }, user.id);
      await audit(user.id, id, AuditAction.file_uploaded, `Subió la versión ${v.version} de '${v.titulo}'`);
      reply.code(201);
      return v;
    });

    app.patch("/documentacion/:id", gestionar, async (request) => {
      const user = ensureUser(request);
      const { id } = idParam.parse(request.params);
      const body = z
        .object({
          titulo: z.string().trim().min(1).max(200).optional(),
          descripcion: z.string().trim().max(2000).nullish(),
          categoria: z.string().trim().min(1).max(80).optional(),
          requiereLectura: z.boolean().optional(),
          activo: z.boolean().optional(),
          roleIds: z.array(z.string().min(1)).optional(),
        })
        .parse(request.body);
      const d = await doc.actualizarDocumento(id, body);
      await audit(user.id, id, AuditAction.updated, `Editó el documento '${d.titulo}'`);
      return d;
    });

    app.delete("/documentacion/:id", gestionar, async (request, reply) => {
      const user = ensureUser(request);
      const { id } = idParam.parse(request.params);
      const d = await doc.borrarDocumento(id);
      await audit(user.id, id, AuditAction.deleted, `Borró el documento '${d.titulo}'`);
      return reply.code(204).send();
    });
  });
}

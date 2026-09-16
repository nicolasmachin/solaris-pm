// Endpoints del módulo Capacitación. Prefijo /api.
// Consumo: CAPACITACION:VIEW + visibilidad por sección (row-level en el service).
// Gestión: CAPACITACION:EDIT. Ver services/capacitacion/capacitacion.service.ts.

import fs from "node:fs";

import { Action, AuditAction, AuditEntityType, Module } from "@prisma/client";
import type { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";
import { z } from "zod";

import { prisma } from "../lib/prisma.js";
import { authenticate } from "../middleware/auth.middleware.js";
import { authorize } from "../middleware/authorize.middleware.js";
import { createAuditEntry } from "../services/audit.service.js";
import { bunnyConfigurado, listarColecciones, listarVideos } from "../services/bunny-stream.service.js";
import * as cap from "../services/capacitacion/capacitacion.service.js";
import {
  borrarComentario,
  crearComentario,
  editarComentario,
  listarComentarios,
} from "../services/capacitacion/comentarios.service.js";
import {
  firmarTokenMedia,
  miniaturaLocal,
  streamMiniatura,
  verificarTokenMedia,
} from "../services/capacitacion/miniaturas.service.js";
import { contentDisposition } from "../utils/content-disposition.js";
import { badRequest, forbidden } from "../utils/errors.js";

function ensureUser(request: FastifyRequest) {
  if (!request.user) throw badRequest("AUTH_CONTEXT_MISSING", "No se pudo resolver el usuario autenticado");
  return request.user;
}

const idParam = z.object({ id: z.string().min(1) });
const ordenBody = z.object({ ids: z.array(z.string().min(1)) });
const textoOpcional = z.string().trim().max(2000).nullish();

const ver = { preHandler: authorize(Module.CAPACITACION, Action.VIEW) };
const gestionar = { preHandler: authorize(Module.CAPACITACION, Action.EDIT) };

function audit(userId: string, entityId: string, action: AuditAction, description: string) {
  return createAuditEntry({ entityType: AuditEntityType.capacitacion, entityId, userId, action, description });
}

export async function registerCapacitacionRoutes(app: FastifyInstance) {
  await registerRutasConToken(app);
  await app.register(registerRutasAutenticadas);
}

/**
 * Miniaturas y archivos: únicas rutas sin `authenticate`, porque ni un `<img>`
 * ni un enlace de descarga pueden mandar el header Authorization. El permiso
 * viaja en `?t=`, un token firmado de vida corta que emiten los endpoints
 * normales (mismo patrón que el stream de los videos de ensayo). La miniatura
 * sale de la cache local; si no está, se baja de Bunny una vez.
 */
async function registerRutasConToken(app: FastifyInstance) {
  const tokenQuery = z.object({ t: z.string().min(1) });

  async function responder(reply: FastifyReply, bunnyVideoId: string, filename: string) {
    const ruta = await miniaturaLocal(bunnyVideoId, filename);
    if (!ruta) return reply.code(404).send({ error: true, code: "MINIATURA_NOT_FOUND", message: "Sin miniatura" });
    reply.header("Content-Type", "image/jpeg");
    // Privada: la miniatura depende de los permisos de quien la pide.
    reply.header("Cache-Control", "private, max-age=86400");
    return reply.send(streamMiniatura(ruta));
  }

  // Miniatura de un video ya cargado en una lista.
  app.get("/capacitacion/videos/:id/miniatura", async (request, reply) => {
    const { id } = idParam.parse(request.params);
    const { t } = tokenQuery.parse(request.query);
    const user = verificarTokenMedia(t);
    const video = await cap.miniaturaDeVideo(id, user);
    return responder(reply, video.bunnyVideoId, video.thumbnailFileName);
  });

  // Documentos: descarga (attachment) y vista previa (inline).
  for (const [sufijo, disposition] of [["download", "attachment"], ["preview", "inline"]] as const) {
    app.get(`/capacitacion/documentos/:id/${sufijo}`, async (request, reply) => {
      const { id } = idParam.parse(request.params);
      const { t } = tokenQuery.parse(request.query);
      const user = verificarTokenMedia(t);
      const file = await cap.documentoParaDescarga(id, user);
      reply.header("Content-Type", file.mimeType);
      reply.header("Content-Disposition", contentDisposition(disposition, file.filename));
      return reply.send(fs.createReadStream(file.absolutePath));
    });
  }

  // Miniatura de un video de Bunny todavía no cargado (selector de gestión).
  app.get("/capacitacion/bunny/miniaturas/:bunnyVideoId", async (request, reply) => {
    const { bunnyVideoId } = z.object({ bunnyVideoId: z.string().min(1) }).parse(request.params);
    const { t, f } = tokenQuery.extend({ f: z.string().min(1) }).parse(request.query);
    const user = verificarTokenMedia(t);
    if (!(await cap.puedeGestionar(user))) throw forbidden("No tenés permiso para realizar esta acción");
    return responder(reply, bunnyVideoId, f);
  });
}

async function registerRutasAutenticadas(app: FastifyInstance) {
  app.addHook("preHandler", authenticate);

  // ─── Consumo ──────────────────────────────────────────────────────────────

  app.get("/capacitacion/secciones", ver, async (request) => {
    const user = ensureUser(request);
    return {
      puedeGestionar: await cap.puedeGestionar(user),
      mediaToken: firmarTokenMedia(user),
      secciones: await cap.listarSecciones(user),
    };
  });

  app.get("/capacitacion/secciones/:id", ver, async (request) => {
    const user = ensureUser(request);
    const { id } = idParam.parse(request.params);
    return { ...(await cap.detalleSeccion(id, user)), mediaToken: firmarTokenMedia(user) };
  });

  app.get("/capacitacion/listas/:id", ver, async (request) => {
    const user = ensureUser(request);
    const { id } = idParam.parse(request.params);
    return { ...(await cap.detalleLista(id, user)), mediaToken: firmarTokenMedia(user) };
  });

  app.post("/capacitacion/videos/:id/embed", ver, async (request) => {
    const user = ensureUser(request);
    const { id } = idParam.parse(request.params);
    return cap.embedVideo(id, user);
  });

  app.put("/capacitacion/videos/:id/progreso", ver, async (request) => {
    const user = ensureUser(request);
    const { id } = idParam.parse(request.params);
    const body = z
      .object({ segundos: z.number().min(0).max(24 * 3600), completado: z.boolean().optional() })
      .parse(request.body);
    return cap.guardarProgreso(id, user, body);
  });

  // ─── Comentarios del video (preguntas del equipo) ─────────────────────────
  // Leer y escribir alcanza con ver el video; borrar es del autor o de quien
  // gestiona el módulo (moderación).

  const comentarioBody = z.object({ contenido: z.string().min(1).max(4000) });

  app.get("/capacitacion/videos/:id/comentarios", ver, async (request) => {
    const user = ensureUser(request);
    const { id } = idParam.parse(request.params);
    return { comentarios: await listarComentarios(id, user) };
  });

  app.post("/capacitacion/videos/:id/comentarios", ver, async (request, reply) => {
    const user = ensureUser(request);
    const { id } = idParam.parse(request.params);
    const { contenido } = comentarioBody.parse(request.body);
    reply.code(201);
    return crearComentario(id, user, contenido);
  });

  app.patch("/capacitacion/comentarios/:id", ver, async (request) => {
    const user = ensureUser(request);
    const { id } = idParam.parse(request.params);
    const { contenido } = comentarioBody.parse(request.body);
    return editarComentario(id, user, contenido);
  });

  app.delete("/capacitacion/comentarios/:id", ver, async (request, reply) => {
    const user = ensureUser(request);
    const { id } = idParam.parse(request.params);
    await borrarComentario(id, user);
    return reply.code(204).send();
  });

  // ─── Gestión: secciones ───────────────────────────────────────────────────

  // Roles asignables (todos menos el del portal de clientes). Va acá y no en
  // /roles para no exigir USUARIOS:VIEW a quien gestiona capacitación.
  app.get("/capacitacion/roles", gestionar, async () => {
    return prisma.role.findMany({
      where: { name: { not: "CLIENT" } },
      select: { id: true, name: true, label: true },
      orderBy: { label: "asc" },
    });
  });

  const seccionBody = z.object({
    nombre: z.string().trim().min(1).max(120),
    descripcion: textoOpcional,
    roleIds: z.array(z.string().min(1)).default([]),
  });

  app.post("/capacitacion/secciones", gestionar, async (request, reply) => {
    const user = ensureUser(request);
    const body = seccionBody.parse(request.body);
    const seccion = await cap.crearSeccion(body);
    await audit(user.id, seccion.id, AuditAction.created, `Creó la sección de capacitación '${seccion.nombre}'`);
    reply.code(201);
    return seccion;
  });

  app.patch("/capacitacion/secciones/:id", gestionar, async (request) => {
    const user = ensureUser(request);
    const { id } = idParam.parse(request.params);
    const body = z
      .object({ nombre: z.string().trim().min(1).max(120).optional(), descripcion: textoOpcional, activa: z.boolean().optional() })
      .parse(request.body);
    const seccion = await cap.actualizarSeccion(id, body);
    await audit(user.id, id, AuditAction.updated, `Editó la sección de capacitación '${seccion.nombre}'`);
    return seccion;
  });

  app.put("/capacitacion/secciones/:id/roles", gestionar, async (request) => {
    const user = ensureUser(request);
    const { id } = idParam.parse(request.params);
    const { roleIds } = z.object({ roleIds: z.array(z.string().min(1)) }).parse(request.body);
    const asignados = await cap.asignarRolesSeccion(id, roleIds);
    const nombres = await prisma.role.findMany({ where: { id: { in: asignados } }, select: { name: true } });
    await audit(
      user.id,
      id,
      AuditAction.updated,
      `Cambió los roles que ven la sección: ${nombres.map((r) => r.name).join(", ") || "(ninguno)"}`,
    );
    return { roleIds: asignados };
  });

  app.put("/capacitacion/secciones-orden", gestionar, async (request) => {
    const { ids } = ordenBody.parse(request.body);
    await cap.reordenarSecciones(ids);
    return { ok: true };
  });

  app.delete("/capacitacion/secciones/:id", gestionar, async (request, reply) => {
    const user = ensureUser(request);
    const { id } = idParam.parse(request.params);
    const seccion = await cap.borrarSeccion(id);
    await audit(user.id, id, AuditAction.deleted, `Borró la sección de capacitación '${seccion.nombre}'`);
    return reply.code(204).send();
  });

  // ─── Gestión: listas ──────────────────────────────────────────────────────

  const listaBody = z.object({ titulo: z.string().trim().min(1).max(160), descripcion: textoOpcional });

  app.post("/capacitacion/secciones/:id/listas", gestionar, async (request, reply) => {
    const user = ensureUser(request);
    const { id } = idParam.parse(request.params);
    const lista = await cap.crearLista(id, listaBody.parse(request.body));
    await audit(user.id, lista.id, AuditAction.created, `Creó la lista de capacitación '${lista.titulo}'`);
    reply.code(201);
    return lista;
  });

  app.patch("/capacitacion/listas/:id", gestionar, async (request) => {
    const user = ensureUser(request);
    const { id } = idParam.parse(request.params);
    const lista = await cap.actualizarLista(id, listaBody.partial().parse(request.body));
    await audit(user.id, id, AuditAction.updated, `Editó la lista de capacitación '${lista.titulo}'`);
    return lista;
  });

  app.put("/capacitacion/secciones/:id/listas-orden", gestionar, async (request) => {
    const { id } = idParam.parse(request.params);
    const { ids } = ordenBody.parse(request.body);
    await cap.reordenarListas(id, ids);
    return { ok: true };
  });

  app.delete("/capacitacion/listas/:id", gestionar, async (request, reply) => {
    const user = ensureUser(request);
    const { id } = idParam.parse(request.params);
    const lista = await cap.borrarLista(id);
    await audit(user.id, id, AuditAction.deleted, `Borró la lista de capacitación '${lista.titulo}'`);
    return reply.code(204).send();
  });

  // ─── Gestión: videos (Bunny) ──────────────────────────────────────────────

  app.get("/capacitacion/bunny/estado", gestionar, async () => ({ configurado: bunnyConfigurado() }));

  app.get("/capacitacion/bunny/videos", gestionar, async (request) => {
    const q = z
      .object({
        page: z.coerce.number().int().min(1).default(1),
        search: z.string().trim().max(200).optional(),
        collectionId: z.string().trim().max(100).optional(),
      })
      .parse(request.query);
    const data = await listarVideos({
      page: q.page,
      search: q.search || undefined,
      collectionId: q.collectionId || undefined,
    });
    return { ...data, mediaToken: firmarTokenMedia(ensureUser(request)) };
  });

  app.get("/capacitacion/bunny/colecciones", gestionar, async () => listarColecciones());

  app.post("/capacitacion/listas/:id/videos", gestionar, async (request, reply) => {
    const user = ensureUser(request);
    const { id } = idParam.parse(request.params);
    const { bunnyVideoIds } = z
      .object({ bunnyVideoIds: z.array(z.string().min(1)).min(1).max(200) })
      .parse(request.body);
    const r = await cap.agregarVideos(id, bunnyVideoIds, user.id);
    await audit(user.id, id, AuditAction.updated, `Agregó ${r.agregados} video(s) de Bunny a la lista`);
    reply.code(201);
    return r;
  });

  app.post("/capacitacion/secciones/:id/importar-coleccion", gestionar, async (request, reply) => {
    const user = ensureUser(request);
    const { id } = idParam.parse(request.params);
    const body = z
      .object({ collectionId: z.string().min(1), titulo: z.string().trim().min(1).max(160) })
      .parse(request.body);
    const r = await cap.importarColeccion(id, body, user.id);
    await audit(
      user.id,
      r.lista.id,
      AuditAction.created,
      `Importó la colección de Bunny como lista '${r.lista.titulo}' (${r.agregados} videos)`,
    );
    reply.code(201);
    return r;
  });

  app.patch("/capacitacion/videos/:id", gestionar, async (request) => {
    const user = ensureUser(request);
    const { id } = idParam.parse(request.params);
    const body = z
      .object({ titulo: z.string().trim().min(1).max(200).optional(), descripcion: textoOpcional })
      .parse(request.body);
    const video = await cap.actualizarVideo(id, body);
    await audit(user.id, id, AuditAction.updated, `Editó el video de capacitación '${video.titulo}'`);
    return video;
  });

  app.put("/capacitacion/listas/:id/videos-orden", gestionar, async (request) => {
    const { id } = idParam.parse(request.params);
    const { ids } = ordenBody.parse(request.body);
    await cap.reordenarVideos(id, ids);
    return { ok: true };
  });

  app.delete("/capacitacion/videos/:id", gestionar, async (request, reply) => {
    const user = ensureUser(request);
    const { id } = idParam.parse(request.params);
    const video = await cap.quitarVideo(id);
    await audit(user.id, id, AuditAction.deleted, `Quitó el video '${video.titulo}' de la lista`);
    return reply.code(204).send();
  });

  // ─── Gestión: documentos ──────────────────────────────────────────────────

  // Los metadatos van por querystring (el archivo es la única parte multipart).
  app.post("/capacitacion/secciones/:id/documentos", gestionar, async (request, reply) => {
    const user = ensureUser(request);
    const { id } = idParam.parse(request.params);
    const q = z
      .object({
        titulo: z.string().trim().max(200).optional(),
        descripcion: z.string().trim().max(2000).optional(),
        listaId: z.string().optional(),
      })
      .parse(request.query);
    const part = await request.file();
    if (!part) throw badRequest("FILE_REQUIRED", "Debés adjuntar un archivo");
    const doc = await cap.subirDocumento(
      id,
      part,
      { titulo: q.titulo, descripcion: q.descripcion || null, listaId: q.listaId || null },
      user.id,
    );
    await audit(user.id, doc.id, AuditAction.file_uploaded, `Subió el documento de capacitación '${doc.filename}'`);
    reply.code(201);
    return doc;
  });

  app.patch("/capacitacion/documentos/:id", gestionar, async (request) => {
    const user = ensureUser(request);
    const { id } = idParam.parse(request.params);
    const body = z
      .object({
        titulo: z.string().trim().min(1).max(200).optional(),
        descripcion: textoOpcional,
        listaId: z.string().min(1).nullish(),
      })
      .parse(request.body);
    const doc = await cap.actualizarDocumento(id, body);
    await audit(user.id, id, AuditAction.updated, `Editó el documento de capacitación '${doc.titulo}'`);
    return doc;
  });

  app.put("/capacitacion/secciones/:id/documentos-orden", gestionar, async (request) => {
    const { id } = idParam.parse(request.params);
    const { ids } = ordenBody.parse(request.body);
    await cap.reordenarDocumentos(id, ids);
    return { ok: true };
  });

  app.delete("/capacitacion/documentos/:id", gestionar, async (request, reply) => {
    const user = ensureUser(request);
    const { id } = idParam.parse(request.params);
    const doc = await cap.borrarDocumento(id);
    await audit(user.id, id, AuditAction.deleted, `Borró el documento de capacitación '${doc.titulo}'`);
    return reply.code(204).send();
  });

  // ─── Seguimiento ──────────────────────────────────────────────────────────

  app.get("/capacitacion/seguimiento", gestionar, async (request) => {
    const q = z.object({ seccionId: z.string().optional() }).parse(request.query);
    return cap.seguimiento(q.seccionId || undefined);
  });
}

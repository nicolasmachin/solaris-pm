// Videos del proyecto: ensayos de obra (anti-isla, encendido) y videos grabados
// durante una visita técnica. Permisos sobre Module.OPERACIONES:
//   - VIEW   listar, ver la miniatura y pedir permiso de reproducción
//   - CREATE subir un video
//   - DELETE borrar (borrado suave; el archivo físico se conserva)
//
// El borrado se rige solo por la matriz, como el resto del módulo: un video es
// una cosa más dentro del proyecto, y quien puede borrar en Operaciones puede
// borrarlo. Que el operario o el capataz no borren la evidencia del ensayo que
// grabaron se resuelve no dándoles DELETE en la matriz, no con un guard aparte.
// La red de seguridad es que el borrado es suave y el .mp4 nunca se toca.
//
// Los videos que se suben desde una visita técnica entran por
// `visitas.routes.ts` y quedan con `visitId` seteado, pero se listan y se
// reproducen por acá: son videos del proyecto igual que los demás.
//
// Subida: multipart → se guarda el original en `.tmp/`, se crea el ProjectVideo en
// PENDING y se responde 202. La compresión corre en una cola serial aparte; el
// front sigue el avance por `processingStatus`.
//
// Reproducción: `<video src>` no puede mandar el header Authorization, así que la
// ruta de streaming se autentica con un token firmado de vida corta que se pide
// por separado. Es la única ruta del archivo sin `authenticate`.

import fs from "node:fs";
import { promises as fsPromises } from "node:fs";

import { Action, AuditAction, AuditEntityType, Module, TipoVideo } from "@prisma/client";
import type { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";
import jwt from "jsonwebtoken";
import { z } from "zod";

import { env } from "../config/env.js";
import { prisma } from "../lib/prisma.js";
import { authenticate } from "../middleware/auth.middleware.js";
import { authorize, authorizeAny, hasPermission } from "../middleware/authorize.middleware.js";
import { createAuditEntry } from "../services/audit.service.js";
import { enqueueProjectVideo } from "../services/project-video.service.js";
import { getStoredFilePath, saveProjectVideoUpload } from "../services/file-storage.service.js";
import { badRequest, forbidden, notFound, unauthorized } from "../utils/errors.js";

/** Tipo del token de streaming. Un token de sesión nunca lleva `typ`. */
const STREAM_TOKEN_TYPE = "ensayo-stream";

/**
 * 15 minutos: suficiente para mirar un video de dos minutos con pausas, y corto
 * para que un token que se escape por el historial del navegador o un log sirva
 * de poco. El front lo renueva solo si el usuario vuelve después de expirado.
 */
const STREAM_TOKEN_TTL_SECONDS = 15 * 60;

const TIPO_VIDEO_LABEL: Record<TipoVideo, string> = {
  ENSAYO_ANTI_ISLA: "ensayo anti-isla",
  ENSAYO_ENCENDIDO: "ensayo encendido",
  VISITA: "visita técnica",
  OTRO: "otro",
};

function ensureUser(request: FastifyRequest) {
  if (!request.user) throw unauthorized("No autenticado");
  return request.user;
}

interface StreamTokenPayload {
  typ: string;
  vid: string;
  sub: string;
}

function signStreamToken(videoId: string, userId: string): string {
  return jwt.sign({ typ: STREAM_TOKEN_TYPE, vid: videoId, sub: userId }, env.jwtSecret, {
    expiresIn: STREAM_TOKEN_TTL_SECONDS,
  });
}

function verifyStreamToken(token: string, videoId: string): StreamTokenPayload {
  let payload: StreamTokenPayload;
  try {
    payload = jwt.verify(token, env.jwtSecret) as StreamTokenPayload;
  } catch {
    throw unauthorized("El permiso para ver el video venció. Recargá la página.");
  }

  // Sin esta comprobación, un token de sesión común serviría para descargar
  // cualquier video conociendo su id.
  if (payload.typ !== STREAM_TOKEN_TYPE) {
    throw unauthorized("Token inválido para reproducir video");
  }
  if (payload.vid !== videoId) {
    throw unauthorized("El permiso no corresponde a este video");
  }

  return payload;
}

/** Parsea `Range: bytes=START-END`. Devuelve null si el header no aplica. */
function parseRange(
  header: string | undefined,
  size: number,
): { start: number; end: number } | null | "invalid" {
  if (!header) return null;

  const match = /^bytes=(\d*)-(\d*)$/.exec(header.trim());
  if (!match) return "invalid";

  const [, rawStart, rawEnd] = match;
  if (rawStart === "" && rawEnd === "") return "invalid";

  let start: number;
  let end: number;

  if (rawStart === "") {
    // `bytes=-500` = los últimos 500 bytes.
    const suffixLength = Number(rawEnd);
    if (suffixLength <= 0) return "invalid";
    start = Math.max(0, size - suffixLength);
    end = size - 1;
  } else {
    start = Number(rawStart);
    end = rawEnd === "" ? size - 1 : Number(rawEnd);
  }

  if (!Number.isFinite(start) || !Number.isFinite(end) || start > end || start >= size) {
    return "invalid";
  }

  return { start, end: Math.min(end, size - 1) };
}

/** Campos que se devuelven al listar videos, iguales para proyecto y para lead. */
const VIDEO_LIST_SELECT = {
  id: true,
  tipoVideo: true,
  descripcion: true,
  visitId: true,
  posterUrl: true,
  durationSeconds: true,
  width: true,
  height: true,
  sizeBytes: true,
  processingStatus: true,
  processingError: true,
  originalFilename: true,
  originalSizeBytes: true,
  createdAt: true,
  processedAt: true,
  uploadedBy: { select: { id: true, name: true } },
} as const;

/**
 * Lee un campo de texto del multipart. Solo llegan los que el cliente mandó
 * ANTES del archivo: el parseo es en streaming y se corta al encontrarlo.
 */
function campoDeTexto(fields: unknown, nombre: string): string | null {
  const campo = (fields as Record<string, unknown> | undefined)?.[nombre];
  if (!campo || typeof campo !== "object" || !("value" in campo)) return null;
  return String((campo as { value: unknown }).value).trim() || null;
}

const uploadParamsSchema = z.object({ projectId: z.string().min(1) });
const videoParamsSchema = z.object({ id: z.string().min(1) });

/**
 * Autenticación + permiso, como preHandler explícito de cada ruta.
 *
 * Este módulo no usa `addHook("preHandler", authenticate)` como el resto: los
 * hooks se heredan hacia todos los scopes hijos sin importar el orden en que se
 * declaren, y acá hay una ruta (`/stream`) que tiene que quedar fuera. Ponerlo
 * ruta por ruta hace visible cuál está exceptuada y por qué.
 */
function protegida(action: Action) {
  return [authenticate, authorize(Module.OPERACIONES, action)];
}

/**
 * Ver y reproducir: lo habilita Operaciones **o** Ventas.
 *
 * Los videos de la visita comercial cuelgan de un lead y los sube un asesor, que
 * no tiene permisos sobre Operaciones; sin esto no podría ni ver lo que él mismo
 * grabó. Son todos usuarios internos, así que alcanza con exigir uno de los dos
 * módulos en vez de resolver el permiso según el dueño de cada video.
 */
function protegidaVerVideo() {
  return [
    authenticate,
    authorizeAny([
      { module: Module.OPERACIONES, action: Action.VIEW },
      { module: Module.VENTAS, action: Action.VIEW },
    ]),
  ];
}

/**
 * Borrar: filtro grueso acá y el módulo exacto en el handler, que es el único
 * lugar donde ya se sabe si el video cuelga de un proyecto o de un lead.
 */
function protegidaBorrarVideo() {
  return [
    authenticate,
    authorizeAny([
      { module: Module.OPERACIONES, action: Action.DELETE },
      { module: Module.VENTAS, action: Action.DELETE },
    ]),
  ];
}

export async function registerVideosRoutes(app: FastifyInstance) {
  // ── Streaming del video ───────────────────────────────────────────────────
  // Única ruta sin `authenticate`: un `<video src>` no puede mandar el header
  // Authorization. El acceso lo controla el token firmado de vida corta, que se
  // emite desde `/stream-token`, que sí pasa por los permisos normales.
  app.route({
    method: ["GET", "HEAD"],
    url: "/videos/:id/stream",
    handler: async (request, reply) => {
      const params = videoParamsSchema.parse(request.params);
      const query = z.object({ t: z.string().min(1) }).parse(request.query);

      verifyStreamToken(query.t, params.id);

      const video = await prisma.projectVideo.findFirst({
        where: { id: params.id, deletedAt: null },
        select: { fileAttachment: { select: { url: true, deletedAt: true } } },
      });

      if (!video?.fileAttachment || video.fileAttachment.deletedAt) {
        throw notFound("VIDEO_NOT_FOUND", "El video no está disponible");
      }

      return sendVideoRange(request, reply, getStoredFilePath(video.fileAttachment.url));
    },
  });

  // Listar los videos de un proyecto
  app.get(
    "/projects/:projectId/videos",
    { preHandler: protegida(Action.VIEW) },
    async (request) => {
      const params = uploadParamsSchema.parse(request.params);

      const videos = await prisma.projectVideo.findMany({
        where: { projectId: params.projectId, deletedAt: null },
        orderBy: { createdAt: "desc" },
        select: VIDEO_LIST_SELECT,
      });

      return { videos };
    },
  );

  // ── Videos de la visita de ventas (cuelgan del lead) ──────────────────────
  // Mismo pipeline de compresión y la misma UI; lo único distinto es el dueño y
  // el módulo que da el permiso. Al ganarse el lead se reasignan al proyecto.
  app.get(
    "/leads/:leadId/videos",
    { preHandler: [authenticate, authorize(Module.VENTAS, Action.VIEW)] },
    async (request) => {
      const params = z.object({ leadId: z.string().min(1) }).parse(request.params);

      const videos = await prisma.projectVideo.findMany({
        where: { leadId: params.leadId, deletedAt: null },
        orderBy: { createdAt: "desc" },
        select: VIDEO_LIST_SELECT,
      });

      return { videos };
    },
  );

  app.post(
    "/leads/:leadId/videos",
    { preHandler: [authenticate, authorize(Module.VENTAS, Action.CREATE)] },
    async (request, reply) => {
      const user = ensureUser(request);
      const params = z.object({ leadId: z.string().min(1) }).parse(request.params);

      const lead = await prisma.salesLead.findFirst({
        where: { id: params.leadId, deletedAt: null },
        select: { id: true },
      });
      if (!lead) throw notFound("LEAD_NOT_FOUND", "El lead no existe");

      const file = await request.file({
        limits: { fileSize: env.maxVideoSizeMb * 1024 * 1024 },
      });
      if (!file) throw badRequest("NO_FILE", "No se recibió ningún archivo");

      const descripcion = campoDeTexto(file.fields, "descripcion");
      const stored = await saveProjectVideoUpload(file, `leads/${params.leadId}`);

      const video = await prisma.projectVideo.create({
        data: {
          leadId: params.leadId,
          // El video de una visita comercial es relevamiento, no un ensayo: no
          // debe contar como evidencia cuando el lead se convierta en proyecto.
          tipoVideo: TipoVideo.VISITA,
          descripcion,
          originalFilename: stored.filename,
          originalSizeBytes: stored.sizeBytes,
          originalMimeType: stored.mimeType,
          uploadedById: user.id,
        },
        select: { id: true, processingStatus: true, createdAt: true },
      });

      enqueueProjectVideo(video.id, stored.absolutePath);

      await createAuditEntry({
        entityType: AuditEntityType.ensayo_video,
        entityId: video.id,
        userId: user.id,
        action: AuditAction.file_uploaded,
        description: `Subió un video en la visita de ventas del lead (${stored.filename})`,
        metadata: { leadId: params.leadId, originalSizeBytes: stored.sizeBytes },
      });

      return reply.code(202).send({ video });
    },
  );

  // Subir un video
  app.post(
    "/projects/:projectId/videos",
    { preHandler: protegida(Action.CREATE) },
    async (request, reply) => {
      const user = ensureUser(request);
      const params = uploadParamsSchema.parse(request.params);

      const project = await prisma.project.findFirst({
        where: { id: params.projectId, deletedAt: null },
        select: { id: true },
      });
      if (!project) throw notFound("PROJECT_NOT_FOUND", "El proyecto no existe");

      // Límite propio: el global de 20 MB dejaría afuera cualquier video de
      // celular. Se aplica acá y no subiendo el techo global.
      const file = await request.file({
        limits: { fileSize: env.maxVideoSizeMb * 1024 * 1024 },
      });
      if (!file) throw badRequest("NO_FILE", "No se recibió ningún archivo");

      const descripcion = campoDeTexto(file.fields, "descripcion");
      const substageId = campoDeTexto(file.fields, "substageId");
      const tipoVideo = z
        .nativeEnum(TipoVideo, {
          errorMap: () => ({ message: "Elegí qué documenta el video" }),
        })
        .parse(campoDeTexto(file.fields, "tipoVideo") ?? undefined);

      const stored = await saveProjectVideoUpload(file, params.projectId);

      const video = await prisma.projectVideo.create({
        data: {
          projectId: params.projectId,
          substageId,
          tipoVideo,
          descripcion,
          originalFilename: stored.filename,
          originalSizeBytes: stored.sizeBytes,
          originalMimeType: stored.mimeType,
          uploadedById: user.id,
        },
        select: { id: true, tipoVideo: true, processingStatus: true, createdAt: true },
      });

      enqueueProjectVideo(video.id, stored.absolutePath);

      await createAuditEntry({
        entityType: AuditEntityType.ensayo_video,
        entityId: video.id,
        projectId: params.projectId,
        userId: user.id,
        action: AuditAction.file_uploaded,
        description: `Subió el video de ${TIPO_VIDEO_LABEL[tipoVideo]} (${stored.filename})`,
        metadata: {
          tipoVideo,
          originalFilename: stored.filename,
          originalSizeBytes: stored.sizeBytes,
          originalMimeType: stored.mimeType,
        },
      });

      // 202: el archivo llegó, pero todavía no está listo para ver.
      return reply.code(202).send({ video });
    },
  );

  // Permiso de reproducción
  app.post(
    "/videos/:id/stream-token",
    { preHandler: protegidaVerVideo() },
    async (request) => {
      const user = ensureUser(request);
      const params = videoParamsSchema.parse(request.params);

      const video = await prisma.projectVideo.findFirst({
        where: { id: params.id, deletedAt: null },
        select: {
          id: true,
          projectId: true,
          tipoVideo: true,
          fileAttachment: { select: { id: true, deletedAt: true } },
        },
      });

      if (!video) throw notFound("VIDEO_NOT_FOUND", "El video no existe");
      if (!video.fileAttachment || video.fileAttachment.deletedAt) {
        throw badRequest("VIDEO_NOT_READY", "El video todavía se está procesando");
      }

      // Se audita el permiso, no cada pedido de rango: un solo video genera
      // decenas de requests y el registro sería ilegible. Un token equivale a
      // una sesión de visualización.
      await createAuditEntry({
        entityType: AuditEntityType.ensayo_video,
        entityId: video.id,
        projectId: video.projectId,
        userId: user.id,
        action: AuditAction.updated,
        description: `Reprodujo el video de ${TIPO_VIDEO_LABEL[video.tipoVideo]}`,
      });

      return {
        token: signStreamToken(video.id, user.id),
        expiresInSeconds: STREAM_TOKEN_TTL_SECONDS,
      };
    },
  );

  // Miniatura
  app.get(
    "/videos/:id/poster",
    { preHandler: protegidaVerVideo() },
    async (request, reply) => {
      const params = videoParamsSchema.parse(request.params);

      const video = await prisma.projectVideo.findFirst({
        where: { id: params.id, deletedAt: null },
        select: { posterUrl: true },
      });

      if (!video?.posterUrl) throw notFound("POSTER_NOT_FOUND", "El video no tiene miniatura");

      const absolutePath = getStoredFilePath(video.posterUrl);
      const exists = await fsPromises
        .access(absolutePath)
        .then(() => true)
        .catch(() => false);
      if (!exists) throw notFound("POSTER_NOT_FOUND", "El video no tiene miniatura");

      return reply
        .header("Content-Type", "image/jpeg")
        .header("Cache-Control", "private, max-age=3600")
        .send(fs.createReadStream(absolutePath));
    },
  );

  // Borrar (suave)
  app.delete(
    "/videos/:id",
    { preHandler: protegidaBorrarVideo() },
    async (request) => {
      const user = ensureUser(request);
      const params = videoParamsSchema.parse(request.params);

      const video = await prisma.projectVideo.findFirst({
        where: { id: params.id, deletedAt: null },
        select: {
          id: true,
          projectId: true,
          tipoVideo: true,
          fileAttachmentId: true,
          originalFilename: true,
        },
      });
      if (!video) throw notFound("VIDEO_NOT_FOUND", "El video no existe");

      // El módulo que manda depende de dónde vive el video: uno del proyecto lo
      // borra Operaciones; uno que todavía cuelga de un lead, Ventas. El
      // preHandler solo garantiza que tenga uno de los dos.
      const moduloDelVideo = video.projectId ? Module.OPERACIONES : Module.VENTAS;
      if (!(await hasPermission(user.role, moduloDelVideo, Action.DELETE))) {
        throw forbidden("No tenés permiso para borrar este video");
      }

      const now = new Date();

      // Borrado suave a propósito: el .mp4 NO se toca. Es evidencia, y un
      // borrado equivocado no puede destruir los bytes. Purgar de verdad es un
      // acto aparte, deliberado y de un ADMIN.
      await prisma.projectVideo.update({
        where: { id: video.id },
        data: { deletedAt: now, deletedById: user.id },
      });

      if (video.fileAttachmentId) {
        await prisma.fileAttachment.update({
          where: { id: video.fileAttachmentId },
          data: { deletedAt: now },
        });
      }

      await createAuditEntry({
        entityType: AuditEntityType.ensayo_video,
        entityId: video.id,
        projectId: video.projectId,
        userId: user.id,
        action: AuditAction.deleted,
        description: `Borró el video de ${TIPO_VIDEO_LABEL[video.tipoVideo]} (${video.originalFilename}). El archivo se conserva en el storage.`,
      });

      return { ok: true };
    },
  );
}

/**
 * Sirve el video con soporte de rangos (HTTP 206).
 *
 * Sin esto Safari directamente no reproduce, y ningún navegador puede adelantar:
 * el `<video>` pide el archivo por pedazos y espera un 206 con `Content-Range`.
 */
async function sendVideoRange(
  request: FastifyRequest,
  reply: FastifyReply,
  absolutePath: string,
): Promise<FastifyReply> {
  const stat = await fsPromises.stat(absolutePath).catch(() => null);
  if (!stat?.isFile()) {
    throw notFound("VIDEO_FILE_MISSING", "El archivo del video no está disponible");
  }

  const size = stat.size;

  reply.header("Accept-Ranges", "bytes");
  reply.header("Content-Type", "video/mp4");
  // `private` mantiene la respuesta fuera de proxies compartidos, pero NO se usa
  // `no-store`: el reproductor de Chrome se apoya en el caché HTTP para armar el
  // buffer, y con no-store se queda cargando para siempre sin dar error. La
  // revalidación forzada más el token de 15 minutos acotan igual el acceso.
  reply.header("Cache-Control", "private, max-age=0, must-revalidate");

  const range = parseRange(request.headers.range, size);

  if (range === "invalid") {
    return reply.code(416).header("Content-Range", `bytes */${size}`).send();
  }

  if (range === null) {
    // Sin header Range: se manda entero. `Content-Length` explícito porque
    // Fastify no lo calcula para streams, y sin él Safari se cuelga esperando.
    reply.header("Content-Length", size);
    if (request.method === "HEAD") return reply.send();
    return reply.send(fs.createReadStream(absolutePath));
  }

  const { start, end } = range;
  const chunkSize = end - start + 1;

  reply.code(206);
  reply.header("Content-Range", `bytes ${start}-${end}/${size}`);
  reply.header("Content-Length", chunkSize);

  if (request.method === "HEAD") return reply.send();
  return reply.send(fs.createReadStream(absolutePath, { start, end }));
}

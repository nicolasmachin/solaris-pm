// Videos del proyecto: ensayos de obra (anti-isla, encendido) y videos grabados
// durante una visita técnica. Permisos sobre Module.OPERACIONES:
//   - VIEW   listar, ver la miniatura y pedir permiso de reproducción
//   - CREATE subir un video
//   - DELETE borrar (borrado suave; el archivo físico se conserva)
//
// El borrado exige además rol ADMIN, por encima del permiso de módulo: los roles
// de obra tienen DELETE sobre OPERACIONES en la matriz, y quien graba el ensayo
// no debería poder hacer desaparecer la evidencia de que lo hizo.
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
import { authorize } from "../middleware/authorize.middleware.js";
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
        select: {
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
        },
      });

      return { videos };
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

      const rawTipo = (file.fields as Record<string, unknown> | undefined)?.tipoVideo;
      const tipoValue =
        rawTipo && typeof rawTipo === "object" && "value" in rawTipo
          ? String((rawTipo as { value: unknown }).value)
          : undefined;
      const rawDescripcion = (file.fields as Record<string, unknown> | undefined)?.descripcion;
      const descripcion =
        rawDescripcion && typeof rawDescripcion === "object" && "value" in rawDescripcion
          ? String((rawDescripcion as { value: unknown }).value).trim() || null
          : null;

      const tipoVideo = z
        .nativeEnum(TipoVideo, {
          errorMap: () => ({ message: "Elegí qué ensayo documenta el video" }),
        })
        .parse(tipoValue);

      const rawSubstage = (file.fields as Record<string, unknown> | undefined)?.substageId;
      const substageId =
        rawSubstage && typeof rawSubstage === "object" && "value" in rawSubstage
          ? String((rawSubstage as { value: unknown }).value) || null
          : null;

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
    { preHandler: protegida(Action.VIEW) },
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
    { preHandler: protegida(Action.VIEW) },
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
    { preHandler: protegida(Action.DELETE) },
    async (request) => {
      const user = ensureUser(request);
      const params = videoParamsSchema.parse(request.params);

      // Restricción explícita a ADMIN, además del permiso de módulo.
      //
      // La matriz da DELETE sobre OPERACIONES a los roles de obra (OPERACIONES,
      // CAPATAZ, GERENTE_OPERACIONES), que es razonable para lo demás del módulo
      // pero no para esto: quien graba el ensayo no debería poder hacer
      // desaparecer la evidencia de que lo hizo. Y como la matriz es editable
      // desde la UI de administración, apoyarse solo en ella dejaría la garantía
      // sujeta a un cambio de permisos hecho con otra intención.
      if (user.role !== "ADMIN") {
        throw forbidden("Solo un administrador puede borrar un video de ensayo");
      }

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

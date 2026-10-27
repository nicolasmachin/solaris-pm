// Asistente del equipo (chat con IA dentro de Voltia PM). Prefijo /api.
//
// Lo puede usar cualquier usuario interno: no hay permiso de la matriz para el
// chat en sí, porque lo que puede ver cada uno lo deciden las herramientas,
// que chequean la matriz del rol en cada consulta (las mismas del conector).
// El rol CLIENT queda afuera. Cada uno ve solo sus conversaciones.
// Ver services/asistente/.

import { randomUUID } from "node:crypto";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

import type { FastifyInstance, FastifyRequest } from "fastify";
import { z } from "zod";

import { authenticate } from "../middleware/auth.middleware.js";
import {
  adjuntoDeUsuario,
  adjuntosPendientes,
  atarAdjuntos,
  bloquesDeAdjuntos,
  guardarAdjunto,
  hayDocumentos,
  MAX_ADJUNTO_MB,
  MAX_ADJUNTOS_POR_MENSAJE,
  rutaAbsoluta,
} from "../services/asistente/adjuntos.service.js";
import { asistenteHabilitado, MODELOS, responder } from "../services/asistente/chat.service.js";
import {
  aprenderDeLaConversacion,
  borrarConversacion,
  guardarIntercambio,
  leerConversacion,
  listarConversaciones,
  prepararConversacion,
} from "../services/asistente/historial.service.js";
import { chequearTopes, gastoActual, topes } from "../services/asistente/topes.js";
import { isWhisperEnabled, transcribeAudio } from "../services/whisper.service.js";
import { contentDisposition } from "../utils/content-disposition.js";
import { badRequest, forbidden, notFound } from "../utils/errors.js";

function usuarioInterno(request: FastifyRequest) {
  const user = request.user;
  if (!user) throw badRequest("AUTH_CONTEXT_MISSING", "No se pudo resolver el usuario autenticado");
  if (user.role === "CLIENT") throw forbidden("El asistente es solo para el equipo de Voltia");
  return { id: user.id, email: user.email ?? "", name: user.name, role: user.role };
}

const chatBody = z
  .object({
    conversacionId: z.string().min(1).nullish(),
    mensaje: z.string().trim().min(1).max(40_000),
    adjuntoIds: z.array(z.string().min(1)).max(MAX_ADJUNTOS_POR_MENSAJE).default([]),
    modelo: z.enum(["auto", "haiku", "sonnet", "opus"]).default("auto"),
    contexto: z
      .object({ leadId: z.string().min(1).nullish(), projectId: z.string().min(1).nullish() })
      .default({}),
  })
  .strict();

const idParam = z.object({ id: z.string().min(1) });

export async function registerAsistenteRoutes(app: FastifyInstance) {
  await app.register(async (app) => {
    app.addHook("preHandler", authenticate);

    app.get("/asistente/estado", async (request) => {
      const user = usuarioInterno(request);
      const t = topes();
      const g = await gastoActual(user.id);
      return {
        habilitado: asistenteHabilitado(),
        modelos: Object.entries(MODELOS).map(([clave, m]) => ({ clave, nombre: m.nombre })),
        topeDiarioUsd: t.diarioPorUsuarioUsd,
        gastoHoyUsd: g.hoyUsuarioUsd,
      };
    });

    app.get("/asistente/conversaciones", async (request) => {
      const user = usuarioInterno(request);
      return listarConversaciones(user.id);
    });

    app.get("/asistente/conversaciones/:id", async (request) => {
      const user = usuarioInterno(request);
      const { id } = idParam.parse(request.params);
      const mensajes = await leerConversacion(user.id, id);
      if (!mensajes) throw notFound("CONVERSACION_NO_ENCONTRADA", "Conversación no encontrada");
      return { id, mensajes };
    });

    app.delete("/asistente/conversaciones/:id", async (request) => {
      const user = usuarioInterno(request);
      const { id } = idParam.parse(request.params);
      if (!(await borrarConversacion(user.id, id))) throw notFound("CONVERSACION_NO_ENCONTRADA", "Conversación no encontrada");
      return { ok: true };
    });

    // Se sube antes de mandar el mensaje; queda suelto hasta que se manda.
    app.post("/asistente/adjuntos", async (request) => {
      const user = usuarioInterno(request);
      const part = await request.file({ limits: { fileSize: MAX_ADJUNTO_MB * 1024 * 1024, files: 1 } });
      if (!part) throw badRequest("SIN_ARCHIVO", "No llegó ningún archivo");
      return guardarAdjunto(part, user.id);
    });

    app.get("/asistente/adjuntos/:id", async (request, reply) => {
      const user = usuarioInterno(request);
      const { id } = idParam.parse(request.params);
      const a = await adjuntoDeUsuario(user.id, id);
      if (!a) throw notFound("ADJUNTO_NO_ENCONTRADO", "Adjunto no encontrado");
      reply.header("Content-Type", a.mimeType);
      reply.header("Content-Disposition", contentDisposition("inline", a.nombre));
      return reply.send(fs.createReadStream(rutaAbsoluta(a.ruta)));
    });

    // Mensaje de voz → texto. El audio no se guarda: se transcribe y se borra.
    app.post("/asistente/transcribir", async (request) => {
      const user = usuarioInterno(request);
      if (!isWhisperEnabled()) throw badRequest("SIN_TRANSCRIPCION", "La transcripción de audio no está configurada");
      const part = await request.file({ limits: { fileSize: MAX_ADJUNTO_MB * 1024 * 1024, files: 1 } });
      if (!part) throw badRequest("SIN_AUDIO", "No llegó el audio");
      const ext = path.extname(part.filename || "").toLowerCase() || ".webm";
      const tmp = path.join(os.tmpdir(), `asistente-${randomUUID()}${ext}`);
      await fs.promises.writeFile(tmp, await part.toBuffer());
      try {
        const r = await transcribeAudio(tmp, { userId: user.id }, "asistente_audio");
        return { texto: r.text.trim() };
      } finally {
        await fs.promises.unlink(tmp).catch(() => undefined);
      }
    });

    app.post("/asistente/chat", async (request, reply) => {
      const user = usuarioInterno(request);
      const body = chatBody.parse(request.body);
      if (!asistenteHabilitado()) {
        return reply.status(503).send({ error: "El asistente no está configurado en este server (falta ANTHROPIC_API_KEY)." });
      }
      const bloqueo = await chequearTopes(user.id);
      if (bloqueo) return reply.status(429).send({ error: bloqueo });

      const adjuntos = await adjuntosPendientes(user.id, body.adjuntoIds);
      const bloques = await bloquesDeAdjuntos(adjuntos);

      const { conversacionId, previos } = await prepararConversacion(user.id, body.conversacionId, body.mensaje);
      const respuesta = await responder({
        user,
        conversacion: [...previos, { role: "user", content: body.mensaje }],
        contexto: body.contexto,
        modelo: body.modelo,
        adjuntos: bloques,
        conDocumentos: hayDocumentos(adjuntos),
      });
      const { preguntaId } = await guardarIntercambio({
        conversacionId,
        pregunta: body.mensaje,
        respuesta: respuesta.texto,
        modelo: respuesta.modeloNombre,
        herramientas: respuesta.herramientas,
      });
      await atarAdjuntos(body.adjuntoIds, preguntaId);
      void aprenderDeLaConversacion(user, conversacionId).catch((err) => {
        request.log.warn({ err }, "[asistente] No se pudieron actualizar las notas del usuario");
      });

      return { conversacionId, ...respuesta };
    });
  });
}

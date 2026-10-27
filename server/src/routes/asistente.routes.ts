// Asistente del equipo (chat con IA dentro de Voltia PM). Prefijo /api.
//
// Lo puede usar cualquier usuario interno: no hay permiso de la matriz para el
// chat en sí, porque lo que puede ver cada uno lo deciden las herramientas,
// que chequean la matriz del rol en cada consulta (las mismas del conector).
// El rol CLIENT queda afuera. Cada uno ve solo sus conversaciones.
// Ver services/asistente/.

import type { FastifyInstance, FastifyRequest } from "fastify";
import { z } from "zod";

import { authenticate } from "../middleware/auth.middleware.js";
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

    app.post("/asistente/chat", async (request, reply) => {
      const user = usuarioInterno(request);
      const body = chatBody.parse(request.body);
      if (!asistenteHabilitado()) {
        return reply.status(503).send({ error: "El asistente no está configurado en este server (falta ANTHROPIC_API_KEY)." });
      }
      const bloqueo = await chequearTopes(user.id);
      if (bloqueo) return reply.status(429).send({ error: bloqueo });

      const { conversacionId, previos } = await prepararConversacion(user.id, body.conversacionId, body.mensaje);
      const respuesta = await responder({
        user,
        conversacion: [...previos, { role: "user", content: body.mensaje }],
        contexto: body.contexto,
        modelo: body.modelo,
      });
      await guardarIntercambio({
        conversacionId,
        pregunta: body.mensaje,
        respuesta: respuesta.texto,
        modelo: respuesta.modeloNombre,
        herramientas: respuesta.herramientas,
      });
      void aprenderDeLaConversacion(user, conversacionId).catch((err) => {
        request.log.warn({ err }, "[asistente] No se pudieron actualizar las notas del usuario");
      });

      return { conversacionId, ...respuesta };
    });
  });
}

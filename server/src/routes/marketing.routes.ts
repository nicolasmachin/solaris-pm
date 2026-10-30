/**
 * Marketing. Por ahora, la bandeja de privados de Instagram (las conversaciones
 * del contestador). VIEW = ver; EDIT = contestar, tomar la conversación y crear
 * el lead. Ver docs/manual/20-marketing.md.
 */

import { Action, Module } from "@prisma/client";
import type { FastifyInstance, FastifyRequest } from "fastify";
import { z } from "zod";

import { authenticate } from "../middleware/auth.middleware.js";
import { authorize } from "../middleware/authorize.middleware.js";
import {
  crearLeadDesdeConversacion,
  enviarMensaje,
  listarConversaciones,
  tomarConversacion,
  verConversacion,
} from "../services/instagram-marketing/bandeja.service.js";
import { instagramConectorConfig } from "../services/instagram-marketing/config.js";
import { unauthorized } from "../utils/errors.js";

function actor(request: FastifyRequest) {
  if (!request.user) throw unauthorized("No autenticado");
  return { id: request.user.id, name: request.user.name };
}

const idParams = z.object({ id: z.string().min(1) });

export async function registerMarketingRoutes(app: FastifyInstance) {
  app.addHook("preHandler", authenticate);
  const ver = { preHandler: authorize(Module.MARKETING, Action.VIEW) };
  const editar = { preHandler: authorize(Module.MARKETING, Action.EDIT) };

  app.get("/marketing/instagram/estado", ver, async () => {
    const c = instagramConectorConfig();
    return { conectado: !!c.url && !!c.secreto };
  });

  app.get("/marketing/instagram/conversaciones", ver, async () => listarConversaciones());

  app.get("/marketing/instagram/conversaciones/:id", ver, async (request) => {
    const { id } = idParams.parse(request.params);
    return verConversacion(id);
  });

  app.post("/marketing/instagram/conversaciones/:id/enviar", editar, async (request, reply) => {
    const { id } = idParams.parse(request.params);
    // 1000 caracteres es el tope de Instagram por mensaje.
    const { texto } = z.object({ texto: z.string().trim().min(1).max(1000) }).parse(request.body);
    reply.code(201);
    return enviarMensaje(id, texto, actor(request));
  });

  app.post("/marketing/instagram/conversaciones/:id/tomar", editar, async (request) => {
    const { id } = idParams.parse(request.params);
    const { tomada } = z.object({ tomada: z.boolean() }).parse(request.body);
    return tomarConversacion(id, tomada, actor(request));
  });

  app.post("/marketing/instagram/conversaciones/:id/lead", editar, async (request, reply) => {
    const { id } = idParams.parse(request.params);
    const body = z
      .object({
        clientName: z.string().trim().min(1).max(200),
        clientPhone: z.string().trim().max(40).nullish(),
        notes: z.string().trim().max(4000).nullish(),
      })
      .parse(request.body);
    reply.code(201);
    return crearLeadDesdeConversacion(id, body, actor(request));
  });
}

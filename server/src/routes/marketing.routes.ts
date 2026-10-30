/**
 * Marketing → Instagram: la bandeja de privados, las automatizaciones (el
 * "ManyChat con IA"), los contactos y las consultas por día. VIEW = ver; EDIT
 * = contestar, tomar la conversación, crear el lead y prender, apagar o editar
 * una automatización. Ver docs/manual/20-marketing.md.
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
import {
  consultas,
  contactos,
  editarAutomatizacion,
  estado,
  listarAutomatizaciones,
} from "../services/instagram-marketing/panel.service.js";
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

  app.get("/marketing/instagram/estado", ver, async () => estado());

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

  app.get("/marketing/instagram/automatizaciones", ver, async () => listarAutomatizaciones());

  app.patch("/marketing/instagram/automatizaciones/:id", editar, async (request) => {
    const { id } = idParams.parse(request.params);
    const cambio = z
      .object({
        activa: z.boolean().optional(),
        nombre: z.string().trim().min(1).max(120).optional(),
        flujo: z.string().max(20_000).optional(),
        palabras: z.array(z.string().trim().min(1).max(40)).max(20).optional(),
        link: z.string().trim().url().max(500).nullish(),
        esperaMinSeg: z.number().int().min(0).max(3600).optional(),
        esperaMaxSeg: z.number().int().min(0).max(3600).optional(),
        topeDiario: z.number().int().min(0).max(1000).optional(),
      })
      .parse(request.body);
    return editarAutomatizacion(id, cambio, actor(request));
  });

  app.get("/marketing/instagram/contactos", ver, async (request) => {
    const q = z
      .object({
        etiqueta: z.string().trim().max(80).optional(),
        texto: z.string().trim().max(80).optional(),
        cuantos: z.coerce.number().int().min(1).max(500).optional(),
      })
      .parse(request.query);
    return contactos(q);
  });

  app.get("/marketing/instagram/consultas", ver, async (request) => {
    const { dias } = z.object({ dias: z.coerce.number().int().min(1).max(90).default(14) }).parse(request.query);
    return consultas(dias);
  });
}

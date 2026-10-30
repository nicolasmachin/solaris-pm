/**
 * Avisos automáticos al cliente (Administración → Avisos automáticos).
 * Ver: CONFIGURACION:VIEW. Crear, editar, mandar a Meta, activar: CONFIGURACION:EDIT.
 */

import { Action, Module } from "@prisma/client";
import type { FastifyInstance, FastifyRequest } from "fastify";
import { z } from "zod";

import { authenticate } from "../middleware/auth.middleware.js";
import { authorize } from "../middleware/authorize.middleware.js";
import {
  activarAviso,
  borrarAviso,
  catalogo,
  crearAviso,
  editarAviso,
  listarAvisos,
  listarEnvios,
  mandarAMeta,
  pausarAviso,
  refrescarPlantillas,
} from "../services/avisos/avisos.service.js";
import { MetaApiError } from "../services/whatsapp-cloud/api.service.js";
import { AppError, unauthorized } from "../utils/errors.js";

function ensureUser(request: FastifyRequest) {
  if (!request.user) throw unauthorized("No autenticado");
  return request.user;
}

async function conMeta<T>(fn: () => Promise<T>): Promise<T> {
  try {
    return await fn();
  } catch (err) {
    if (err instanceof MetaApiError) {
      throw new AppError(502, "META_ERROR", `Meta: ${err.message}`, { detalle: err.detalle as Record<string, unknown> });
    }
    throw err;
  }
}

const datosSchema = z.object({
  nombre: z.string().trim().min(3).max(80),
  disparador: z.string().min(3).max(80),
  dias: z.number().int().min(1).max(30).nullish(),
  canal: z.enum(["WHATSAPP", "EMAIL"]),
  asunto: z.string().max(200).nullish(),
  cuerpo: z.string().min(1).max(4000),
  cierraCheck: z.string().max(60).nullish(),
});

const idParam = z.object({ id: z.string().min(1) });

export async function registerAvisosRoutes(app: FastifyInstance) {
  app.addHook("preHandler", authenticate);
  const ver = { preHandler: authorize(Module.CONFIGURACION, Action.VIEW) };
  const editar = { preHandler: authorize(Module.CONFIGURACION, Action.EDIT) };

  app.get("/avisos/catalogo", ver, async () => catalogo());

  app.get("/avisos", ver, async () => {
    // Al abrir la pantalla se trae de Meta el estado de las plantillas en revisión.
    await refrescarPlantillas().catch((err) => console.error("[avisos] refrescar:", err instanceof Error ? err.message : err));
    return listarAvisos();
  });

  app.get("/avisos/envios", ver, async (request) => {
    const q = z
      .object({ avisoId: z.string().optional(), projectId: z.string().optional(), limite: z.coerce.number().int().optional() })
      .parse(request.query);
    return listarEnvios(q);
  });

  app.post("/avisos", editar, async (request, reply) => {
    const user = ensureUser(request);
    const a = await crearAviso(datosSchema.parse(request.body), user.id);
    return reply.status(201).send(a);
  });

  app.put("/avisos/:id", editar, async (request) => {
    const user = ensureUser(request);
    const { id } = idParam.parse(request.params);
    return editarAviso(id, datosSchema.parse(request.body), user.id);
  });

  app.post("/avisos/:id/meta", editar, async (request) => {
    const user = ensureUser(request);
    const { id } = idParam.parse(request.params);
    return conMeta(() => mandarAMeta(id, user.id));
  });

  app.post("/avisos/:id/activar", editar, async (request) => {
    const user = ensureUser(request);
    const { id } = idParam.parse(request.params);
    return activarAviso(id, user.id);
  });

  app.post("/avisos/:id/pausar", editar, async (request) => {
    const user = ensureUser(request);
    const { id } = idParam.parse(request.params);
    return pausarAviso(id, user.id);
  });

  app.delete("/avisos/:id", editar, async (request, reply) => {
    const user = ensureUser(request);
    const { id } = idParam.parse(request.params);
    await borrarAviso(id, user.id);
    return reply.status(204).send();
  });
}

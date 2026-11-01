/**
 * Bandejas de WhatsApp de cada área. Hoy: Experiencia Solar (el número general),
 * que usa cualquiera que entre al módulo: EXPERIENCIA_CLIENTES:VIEW alcanza para
 * leer y para escribir, porque escribirle al cliente es el trabajo del módulo.
 *
 * Ver services/whatsapp-cloud/bandejas.service.ts y docs/manual/15-whatsapp.md.
 */

import { Action, Module } from "@prisma/client";
import type { FastifyInstance, FastifyRequest } from "fastify";
import { z } from "zod";

import { authenticate } from "../middleware/auth.middleware.js";
import { authorize } from "../middleware/authorize.middleware.js";
import {
  asociarCliente,
  bandejaExperienciaSolar,
  clienteDe,
  listarConversaciones,
  mandar,
  marcarLeida,
  marcarResuelta,
  mensajesDe,
  plantillasDe,
  whatsappDeProyecto,
} from "../services/whatsapp-cloud/bandejas.service.js";
import { unauthorized } from "../utils/errors.js";
import { conMeta } from "./whatsapp.routes.js";

function ensureUser(request: FastifyRequest) {
  if (!request.user) throw unauthorized("No autenticado");
  return request.user;
}

const telefonoParam = z.object({ telefono: z.string().min(6).max(20) });

export async function registerWhatsAppBandejasRoutes(app: FastifyInstance) {
  app.addHook("preHandler", authenticate);
  const es = { preHandler: authorize(Module.EXPERIENCIA_CLIENTES, Action.VIEW) };
  const base = "/whatsapp/bandeja/experiencia-solar";

  app.get(base, es, async () => {
    const b = await bandejaExperienciaSolar();
    return {
      numero: b.cuenta ? { telefono: b.telefono, nombre: b.nombre } : null,
      conversaciones: await listarConversaciones(b),
    };
  });

  app.get(`${base}/conversaciones/:telefono`, es, async (request) => {
    const { telefono } = telefonoParam.parse(request.params);
    const b = await bandejaExperienciaSolar();
    const [mensajes, cliente] = await Promise.all([mensajesDe(b, telefono), clienteDe(b, telefono)]);
    return { mensajes, cliente };
  });

  app.post(`${base}/conversaciones/:telefono/leida`, es, async (request) => {
    const { telefono } = telefonoParam.parse(request.params);
    await marcarLeida(await bandejaExperienciaSolar(), telefono, ensureUser(request).id);
    return { ok: true };
  });

  app.post(`${base}/conversaciones/:telefono/resuelta`, es, async (request) => {
    const { telefono } = telefonoParam.parse(request.params);
    await marcarResuelta(await bandejaExperienciaSolar(), telefono, ensureUser(request).id);
    return { ok: true };
  });

  app.put(`${base}/conversaciones/:telefono/cliente`, es, async (request) => {
    const { telefono } = telefonoParam.parse(request.params);
    const { projectId } = z.object({ projectId: z.string().min(1).max(40).nullable() }).parse(request.body);
    const b = await bandejaExperienciaSolar();
    await asociarCliente(b, telefono, projectId);
    return { cliente: await clienteDe(b, telefono) };
  });

  app.post(`${base}/enviar`, es, async (request, reply) => {
    const user = ensureUser(request);
    const body = z
      .discriminatedUnion("tipo", [
        z.object({
          tipo: z.literal("plantilla"),
          telefono: z.string().min(6).max(20),
          plantilla: z.string().min(1).max(512),
          idioma: z.string().min(2).max(10),
          variables: z.array(z.string().max(1024)).max(20).optional(),
        }),
        z.object({
          tipo: z.literal("texto"),
          telefono: z.string().min(6).max(20),
          texto: z.string().trim().min(1).max(4096),
        }),
      ])
      .parse(request.body);
    const b = await bandejaExperienciaSolar();
    const mensaje = await conMeta(() => mandar(b, body, user.id));
    reply.code(201);
    return { id: mensaje.id, estado: mensaje.estado, telefono: mensaje.telefono };
  });

  // Si Meta no contesta, la bandeja sigue andando sin plantillas (el texto libre
  // no las necesita): un error acá aparecería en cada carga de la pantalla.
  app.get(`${base}/plantillas`, es, async () => {
    try {
      return await plantillasDe(await bandejaExperienciaSolar());
    } catch (err) {
      console.error("[whatsapp] no se pudieron traer las plantillas de la bandeja:", err instanceof Error ? err.message : err);
      return [];
    }
  });

  app.get(`${base}/proyecto/:projectId`, es, async (request) => {
    const { projectId } = z.object({ projectId: z.string().min(1).max(40) }).parse(request.params);
    return whatsappDeProyecto(await bandejaExperienciaSolar(), projectId);
  });
}

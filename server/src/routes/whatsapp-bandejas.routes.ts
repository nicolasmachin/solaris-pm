/**
 * Bandejas de WhatsApp de cada área.
 *
 * - Experiencia Solar (el número general): la usa cualquiera que entre al
 *   módulo. EXPERIENCIA_CLIENTES:VIEW alcanza para leer y para escribir, porque
 *   escribirle al cliente es el trabajo del módulo.
 * - Ventas (el número de cada asesor): VENTAS:VIEW. Cada asesor ve y usa la
 *   suya; gerencia comercial y admin pueden mirar la de cualquiera
 *   (`?asesor=<id>`), sin escribir ni marcarla leída.
 *
 * Ver services/whatsapp-cloud/bandejas.service.ts y docs/manual/15-whatsapp.md.
 */

import { Action, Module } from "@prisma/client";
import type { FastifyInstance, FastifyRequest } from "fastify";
import { z } from "zod";

import { prisma } from "../lib/prisma.js";
import { authenticate } from "../middleware/auth.middleware.js";
import { authorize } from "../middleware/authorize.middleware.js";
import {
  asesoresConNumero,
  asociarCliente,
  type Bandeja,
  bandejaExperienciaSolar,
  bandejaVentas,
  clienteDe,
  listarConversaciones,
  mandar,
  marcarLeida,
  marcarResuelta,
  mensajesDe,
  plantillasDe,
  whatsappDeLead,
  whatsappDeProyecto,
} from "../services/whatsapp-cloud/bandejas.service.js";
import { puedeVerTodoElEmbudo } from "../services/sales-panel.service.js";
import { forbidden, unauthorized } from "../utils/errors.js";
import { conMeta } from "./whatsapp.routes.js";

function ensureUser(request: FastifyRequest) {
  if (!request.user) throw unauthorized("No autenticado");
  return request.user;
}

const telefonoParam = z.object({ telefono: z.string().min(6).max(20) });

const enviarBody = z.discriminatedUnion("tipo", [
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
]);

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
    const body = enviarBody.parse(request.body);
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

  // ─── Ventas: el número de cada asesor ─────────────────────────────────────
  const ventas = { preHandler: authorize(Module.VENTAS, Action.VIEW) };
  const baseV = "/whatsapp/bandeja/ventas";
  const asesorQuery = z.object({ asesor: z.string().min(1).max(40).optional() });

  /** La bandeja que se mira: la propia, o la de otro asesor si es gerencia. */
  async function bandejaQueSeMira(request: FastifyRequest): Promise<{ bandeja: Bandeja; propia: boolean }> {
    const user = ensureUser(request);
    const { asesor } = asesorQuery.parse(request.query);
    if (asesor && asesor !== user.id) {
      if (!puedeVerTodoElEmbudo(user.role)) throw forbidden("Solo gerencia comercial puede ver la bandeja de otro asesor");
      return { bandeja: await bandejaVentas(asesor), propia: false };
    }
    return { bandeja: await bandejaVentas(user.id), propia: true };
  }

  /** Para escribir, marcar o asociar: siempre la propia. */
  async function bandejaPropia(request: FastifyRequest) {
    return bandejaVentas(ensureUser(request).id);
  }

  app.get(baseV, ventas, async (request) => {
    const user = ensureUser(request);
    const { bandeja, propia } = await bandejaQueSeMira(request);
    return {
      numero: bandeja.cuenta ? { telefono: bandeja.telefono, nombre: bandeja.nombre } : null,
      conversaciones: await listarConversaciones(bandeja),
      soloLectura: !propia,
      asesores: puedeVerTodoElEmbudo(user.role) ? await asesoresConNumero() : [],
    };
  });

  app.get(`${baseV}/conversaciones/:telefono`, ventas, async (request) => {
    const { telefono } = telefonoParam.parse(request.params);
    const { bandeja } = await bandejaQueSeMira(request);
    const [mensajes, cliente] = await Promise.all([mensajesDe(bandeja, telefono), clienteDe(bandeja, telefono)]);
    return { mensajes, cliente };
  });

  app.post(`${baseV}/conversaciones/:telefono/leida`, ventas, async (request) => {
    const { telefono } = telefonoParam.parse(request.params);
    await marcarLeida(await bandejaPropia(request), telefono, ensureUser(request).id);
    return { ok: true };
  });

  app.post(`${baseV}/conversaciones/:telefono/resuelta`, ventas, async (request) => {
    const { telefono } = telefonoParam.parse(request.params);
    await marcarResuelta(await bandejaPropia(request), telefono, ensureUser(request).id);
    return { ok: true };
  });

  app.put(`${baseV}/conversaciones/:telefono/cliente`, ventas, async (request) => {
    const { telefono } = telefonoParam.parse(request.params);
    const { leadId } = z.object({ leadId: z.string().min(1).max(40).nullable() }).parse(request.body);
    const b = await bandejaPropia(request);
    await asociarCliente(b, telefono, leadId);
    return { cliente: await clienteDe(b, telefono) };
  });

  app.post(`${baseV}/enviar`, ventas, async (request, reply) => {
    const user = ensureUser(request);
    const body = enviarBody.parse(request.body);
    const b = await bandejaPropia(request);
    const mensaje = await conMeta(() => mandar(b, body, user.id));
    reply.code(201);
    return { id: mensaje.id, estado: mensaje.estado, telefono: mensaje.telefono };
  });

  app.get(`${baseV}/plantillas`, ventas, async (request) => {
    try {
      return await plantillasDe((await bandejaQueSeMira(request)).bandeja);
    } catch (err) {
      console.error("[whatsapp] no se pudieron traer las plantillas de la bandeja de Ventas:", err instanceof Error ? err.message : err);
      return [];
    }
  });

  /**
   * El WhatsApp del panel del lead: por el número propio y, si el que mira es
   * gerencia y no tiene número, por el del asesor del lead (solo para leer).
   */
  app.get(`${baseV}/lead/:leadId`, ventas, async (request) => {
    const user = ensureUser(request);
    const { leadId } = z.object({ leadId: z.string().min(1).max(40) }).parse(request.params);
    let bandeja = await bandejaVentas(user.id);
    let asesorId: string | null = user.id;
    if (!bandeja.cuenta && puedeVerTodoElEmbudo(user.role)) {
      const lead = await prisma.salesLead.findFirst({ where: { id: leadId, deletedAt: null }, select: { assignedToId: true } });
      if (lead?.assignedToId) {
        bandeja = await bandejaVentas(lead.assignedToId);
        asesorId = lead.assignedToId;
      }
    }
    return { ...(await whatsappDeLead(bandeja, leadId)), asesorId, soloLectura: asesorId !== user.id };
  });
}

/**
 * Bandejas de WhatsApp de cada área. Cada número lo ve y lo usa solo su
 * responsable; el admin, cualquiera (decisión de Nicolás del 15-nov-2026).
 *
 * - Experiencia Solar (el número general): EXPERIENCIA_CLIENTES:VIEW y ser el
 *   responsable del número (o admin). Si el número no tiene responsable, lo usa
 *   cualquiera del módulo. VIEW alcanza para escribir: escribirle al cliente es
 *   el trabajo del módulo.
 * - Ventas (el número de cada asesor): VENTAS:VIEW y la propia. El admin elige
 *   cualquier asesor con `?asesor=<id>` y la usa como si fuera suya, salvo que
 *   abrir un chat no se lo marca leído al asesor.
 *
 * Ver services/whatsapp-cloud/bandejas.service.ts y docs/manual/15-whatsapp.md.
 */

import { createReadStream } from "node:fs";
import { Action, Module } from "@prisma/client";
import type { FastifyInstance, FastifyRequest } from "fastify";
import { z } from "zod";

import { prisma } from "../lib/prisma.js";
import { authenticate } from "../middleware/auth.middleware.js";
import { authorize } from "../middleware/authorize.middleware.js";
import {
  asesoresConNumero,
  archivoDeMensaje,
  mandarArchivo,
  asociarCliente,
  nombrePerfilDe,
  type Bandeja,
  bandejaExperienciaSolar,
  marcaLeida,
  puedeUsarBandeja,
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
import { badRequest, forbidden, unauthorized } from "../utils/errors.js";
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

  /** Las rutas de una bandeja, iguales para las dos áreas: cambia de dónde sale el número. */
  function rutasDeBandeja(
    base: string,
    pre: { preHandler: ReturnType<typeof authorize> },
    bandejaDe: (request: FastifyRequest) => Promise<Bandeja>,
    asociarSchema: z.ZodType<string | null, z.ZodTypeDef, unknown>,
  ) {
    /** La bandeja, solo si el usuario la puede usar. */
    async function usable(request: FastifyRequest) {
      const b = await bandejaDe(request);
      if (!puedeUsarBandeja(b, ensureUser(request))) {
        throw forbidden(`Este número de WhatsApp lo usa ${b.responsable?.nombre ?? "otra persona"}`);
      }
      return b;
    }

    app.get(`${base}/conversaciones/:telefono`, pre, async (request) => {
      const { telefono } = telefonoParam.parse(request.params);
      const b = await usable(request);
      const [mensajes, cliente, nombrePerfil] = await Promise.all([mensajesDe(b, telefono), clienteDe(b, telefono), nombrePerfilDe(b, telefono)]);
      return { mensajes, cliente, nombrePerfil };
    });

    // Foto, audio, video o documento de un mensaje (la pantalla lo pide con la sesión).
    app.get(`${base}/mensajes/:id/archivo`, pre, async (request, reply) => {
      const { id } = z.object({ id: z.string().min(1).max(40) }).parse(request.params);
      const a = await archivoDeMensaje(await usable(request), id);
      reply.header("Content-Type", a.mime);
      reply.header("Cache-Control", "private, max-age=86400");
      if (a.nombre) reply.header("Content-Disposition", `inline; filename*=UTF-8''${encodeURIComponent(a.nombre)}`);
      return reply.send(createReadStream(a.ruta));
    });

    app.post(`${base}/conversaciones/:telefono/leida`, pre, async (request) => {
      const { telefono } = telefonoParam.parse(request.params);
      const b = await usable(request);
      const user = ensureUser(request);
      if (marcaLeida(b, user)) await marcarLeida(b, telefono, user.id);
      return { ok: true };
    });

    app.post(`${base}/conversaciones/:telefono/resuelta`, pre, async (request) => {
      const { telefono } = telefonoParam.parse(request.params);
      await marcarResuelta(await usable(request), telefono, ensureUser(request).id);
      return { ok: true };
    });

    app.put(`${base}/conversaciones/:telefono/cliente`, pre, async (request) => {
      const { telefono } = telefonoParam.parse(request.params);
      const id = asociarSchema.parse(request.body);
      const b = await usable(request);
      await asociarCliente(b, telefono, id);
      return { cliente: await clienteDe(b, telefono) };
    });

    // Foto, audio, video o documento (multipart: archivo + telefono, caption, notaDeVoz).
    app.post(`${base}/enviar-archivo`, pre, async (request, reply) => {
      const user = ensureUser(request);
      const b = await usable(request);
      const part = await request.file({ limits: { fileSize: 200 * 1024 * 1024, files: 1 } });
      if (!part) throw badRequest("SIN_ARCHIVO", "No llegó ningún archivo.");
      const bytes = await part.toBuffer().catch(() => {
        throw badRequest("MUY_GRANDE", "El archivo es demasiado grande.");
      });
      const campo = (k: string) => {
        const f = part.fields[k] as { value?: unknown } | undefined;
        return typeof f?.value === "string" ? f.value : undefined;
      };
      const telefono = z.string().min(6).max(20).parse(campo("telefono"));
      const mensaje = await conMeta(() =>
        mandarArchivo(
          b,
          {
            telefono,
            archivo: { bytes, mime: part.mimetype || "application/octet-stream", nombre: part.filename || "archivo" },
            caption: campo("caption")?.slice(0, 1024) ?? null,
            notaDeVoz: campo("notaDeVoz") === "1",
          },
          user.id,
        ),
      );
      reply.code(201);
      return { id: mensaje.id, estado: mensaje.estado, telefono: mensaje.telefono };
    });

    app.post(`${base}/enviar`, pre, async (request, reply) => {
      const user = ensureUser(request);
      const body = enviarBody.parse(request.body);
      const b = await usable(request);
      const mensaje = await conMeta(() => mandar(b, body, user.id));
      reply.code(201);
      return { id: mensaje.id, estado: mensaje.estado, telefono: mensaje.telefono };
    });

    // Si Meta no contesta, la bandeja sigue andando sin plantillas (el texto libre
    // no las necesita): un error acá aparecería en cada carga de la pantalla.
    app.get(`${base}/plantillas`, pre, async (request) => {
      const b = await usable(request);
      try {
        return await plantillasDe(b);
      } catch (err) {
        console.error("[whatsapp] no se pudieron traer las plantillas de la bandeja:", err instanceof Error ? err.message : err);
        return [];
      }
    });

    return usable;
  }

  // ─── Experiencia Solar: el número general ─────────────────────────────────
  const es = { preHandler: authorize(Module.EXPERIENCIA_CLIENTES, Action.VIEW) };
  const base = "/whatsapp/bandeja/experiencia-solar";

  rutasDeBandeja(
    base,
    es,
    () => bandejaExperienciaSolar(),
    z.object({ projectId: z.string().min(1).max(40).nullable() }).transform((b) => b.projectId),
  );

  // La lista y la tarjeta de la ficha no dan error si el número es de otro: se
  // muestran vacías, con de quién es.
  app.get(base, es, async (request) => {
    const b = await bandejaExperienciaSolar();
    if (!puedeUsarBandeja(b, ensureUser(request))) {
      return { numero: null, conversaciones: [], deOtro: b.responsable?.nombre ?? null };
    }
    return {
      numero: b.cuenta ? { telefono: b.telefono, nombre: b.nombre } : null,
      conversaciones: await listarConversaciones(b),
    };
  });

  app.get(`${base}/proyecto/:projectId`, es, async (request) => {
    const { projectId } = z.object({ projectId: z.string().min(1).max(40) }).parse(request.params);
    const b = await bandejaExperienciaSolar();
    if (!puedeUsarBandeja(b, ensureUser(request))) {
      return { hayNumero: false, telefono: null, sinContestar: null, noLeida: false, mensajes: [] };
    }
    return whatsappDeProyecto(b, projectId);
  });

  // ─── Ventas: el número de cada asesor ─────────────────────────────────────
  const ventas = { preHandler: authorize(Module.VENTAS, Action.VIEW) };
  const baseV = "/whatsapp/bandeja/ventas";
  const asesorQuery = z.object({ asesor: z.string().min(1).max(40).optional() });

  /** La propia o, para el admin, la del asesor que eligió (`?asesor=`). */
  async function bandejaVentasDe(request: FastifyRequest): Promise<Bandeja> {
    const user = ensureUser(request);
    const { asesor } = asesorQuery.parse(request.query);
    if (asesor && asesor !== user.id) {
      if (user.role !== "ADMIN") throw forbidden("Solo el admin puede usar el número de otro asesor");
      return bandejaVentas(asesor);
    }
    return bandejaVentas(user.id);
  }

  rutasDeBandeja(
    baseV,
    ventas,
    bandejaVentasDe,
    z.object({ leadId: z.string().min(1).max(40).nullable() }).transform((b) => b.leadId),
  );

  app.get(baseV, ventas, async (request) => {
    const user = ensureUser(request);
    const b = await bandejaVentasDe(request);
    return {
      numero: b.cuenta ? { telefono: b.telefono, nombre: b.nombre } : null,
      conversaciones: await listarConversaciones(b),
      asesores: user.role === "ADMIN" ? await asesoresConNumero() : [],
    };
  });

  /**
   * El WhatsApp del panel del lead: por el número propio y, si el que mira es el
   * admin y no tiene número, por el del asesor del lead.
   */
  app.get(`${baseV}/lead/:leadId`, ventas, async (request) => {
    const user = ensureUser(request);
    const { leadId } = z.object({ leadId: z.string().min(1).max(40) }).parse(request.params);
    let bandeja = await bandejaVentas(user.id);
    let asesorId: string | null = user.id;
    if (!bandeja.cuenta && user.role === "ADMIN") {
      const lead = await prisma.salesLead.findFirst({ where: { id: leadId, deletedAt: null }, select: { assignedToId: true } });
      if (lead?.assignedToId) {
        bandeja = await bandejaVentas(lead.assignedToId);
        asesorId = lead.assignedToId;
      }
    }
    return { ...(await whatsappDeLead(bandeja, leadId)), asesorId: asesorId === user.id ? null : asesorId };
  });
}

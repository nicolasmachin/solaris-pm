// Endpoints internos del módulo Tickets. Prefijo /api. Guard authorize(TICKETS,*).
//   GET  /tickets                 (VIEW)   — lista con filtros
//   GET  /tickets/:id             (VIEW)   — detalle (incluye comentarios internos)
//   POST /tickets                 (CREATE) — abrir
//   POST /tickets/:id/comentarios (EDIT)
//   POST /tickets/:id/derivar     (EDIT)   — dispara T9
//   POST /tickets/:id/en-progreso (EDIT)
//   POST /tickets/:id/resolver    (EDIT)   — dispara T10
//   POST /tickets/:id/cerrar      (EDIT)

import { Action, Module, TicketEstado, TicketPrioridad } from "@prisma/client";
import type { FastifyInstance, FastifyRequest } from "fastify";
import { z } from "zod";

import { prisma } from "../lib/prisma.js";
import { authenticate } from "../middleware/auth.middleware.js";
import { authorize } from "../middleware/authorize.middleware.js";
import { badRequest } from "../utils/errors.js";
import {
  actualizarTicket,
  agregarComentario,
  cerrarTicket,
  crearTicket,
  derivarTicket,
  eliminarTicket,
  esAreaDerivable,
  marcarEnProgreso,
  resolverTicket,
  serializeTicket,
} from "../services/tickets/tickets.service.js";

function ensureUser(request: FastifyRequest) {
  if (!request.user) {
    throw badRequest("AUTH_CONTEXT_MISSING", "No se pudo resolver el usuario autenticado");
  }
  return request.user;
}

export async function registerTicketsRoutes(app: FastifyInstance) {
  app.addHook("preHandler", authenticate);

  app.get("/tickets", { preHandler: authorize(Module.TICKETS, Action.VIEW) }, async (request) => {
    const user = ensureUser(request);
    const q = z
      .object({
        estado: z.nativeEnum(TicketEstado).optional(),
        area: z.string().optional(),
        projectId: z.string().optional(),
        mias: z.coerce.boolean().optional(),
      })
      .parse(request.query);

    const rows = await prisma.ticket.findMany({
      where: {
        deletedAt: null,
        ...(q.estado ? { estado: q.estado } : {}),
        ...(q.area ? { areaDerivada: q.area } : {}),
        ...(q.projectId ? { projectId: q.projectId } : {}),
        ...(q.mias ? { creadoPorId: user.id } : {}),
      },
      include: { project: { select: { id: true, clientName: true, code: true } } },
      orderBy: [{ estado: "asc" }, { createdAt: "desc" }],
    });

    const creadores = await prisma.user.findMany({
      where: { id: { in: [...new Set(rows.map((r) => r.creadoPorId))] } },
      select: { id: true, name: true },
    });
    const nameById = new Map(creadores.map((u) => [u.id, u.name]));

    return {
      tickets: rows.map((t) => ({
        id: t.id,
        projectId: t.projectId,
        projectName: t.project.clientName,
        projectCode: t.project.code,
        titulo: t.titulo,
        estado: t.estado,
        prioridad: t.prioridad,
        areaDerivada: t.areaDerivada,
        origenCliente: t.origenCliente,
        creadoPorNombre: nameById.get(t.creadoPorId) ?? null,
        createdAt: t.createdAt.toISOString(),
      })),
    };
  });

  app.get("/tickets/:id", { preHandler: authorize(Module.TICKETS, Action.VIEW) }, async (request) => {
    const { id } = z.object({ id: z.string() }).parse(request.params);
    const t = await prisma.ticket.findFirst({ where: { id, deletedAt: null }, include: { comentarios: true } });
    if (!t) throw badRequest("TICKET_NOT_FOUND", "Ticket no encontrado");
    return serializeTicket(t, { includeInternalComments: true });
  });

  app.post("/tickets", { preHandler: authorize(Module.TICKETS, Action.CREATE) }, async (request) => {
    const user = ensureUser(request);
    const body = z
      .object({
        projectId: z.string(),
        titulo: z.string().trim().min(1).max(200),
        descripcion: z.string().trim().min(1).max(4000),
        prioridad: z.nativeEnum(TicketPrioridad).optional(),
      })
      .parse(request.body);
    const t = await crearTicket({ ...body, creadoPorId: user.id });
    return serializeTicket(t, { includeInternalComments: true });
  });

  // Editar título/descripción/prioridad. Reusa TICKETS:EDIT (roles internos).
  app.patch("/tickets/:id", { preHandler: authorize(Module.TICKETS, Action.EDIT) }, async (request) => {
    const user = ensureUser(request);
    const { id } = z.object({ id: z.string() }).parse(request.params);
    const body = z
      .object({
        titulo: z.string().trim().min(1).max(200).optional(),
        descripcion: z.string().trim().min(1).max(4000).optional(),
        prioridad: z.nativeEnum(TicketPrioridad).optional(),
      })
      .parse(request.body);
    const t = await actualizarTicket({ ticketId: id, ...body, actorUserId: user.id });
    return serializeTicket(t, { includeInternalComments: true });
  });

  // Eliminar (borrado suave). Solo ADMIN vía permiso TICKETS:DELETE.
  app.delete("/tickets/:id", { preHandler: authorize(Module.TICKETS, Action.DELETE) }, async (request, reply) => {
    const user = ensureUser(request);
    const { id } = z.object({ id: z.string() }).parse(request.params);
    await eliminarTicket({ ticketId: id, actorUserId: user.id });
    reply.code(204);
    return null;
  });

  app.post("/tickets/:id/comentarios", { preHandler: authorize(Module.TICKETS, Action.EDIT) }, async (request) => {
    const user = ensureUser(request);
    const { id } = z.object({ id: z.string() }).parse(request.params);
    const body = z
      .object({ contenido: z.string().trim().min(1).max(4000), esInterno: z.boolean().optional() })
      .parse(request.body);
    const t = await agregarComentario({ ticketId: id, autorId: user.id, contenido: body.contenido, esInterno: body.esInterno });
    return serializeTicket(t, { includeInternalComments: true });
  });

  app.post("/tickets/:id/derivar", { preHandler: authorize(Module.TICKETS, Action.EDIT) }, async (request) => {
    const user = ensureUser(request);
    const { id } = z.object({ id: z.string() }).parse(request.params);
    const body = z.object({ areaDerivada: z.string() }).parse(request.body);
    if (!esAreaDerivable(body.areaDerivada)) {
      throw badRequest("AREA_INVALIDA", "El área debe ser INGENIERIA u OPERACIONES.");
    }
    const t = await derivarTicket({ ticketId: id, areaDerivada: body.areaDerivada, actorUserId: user.id });
    return serializeTicket(t, { includeInternalComments: true });
  });

  app.post("/tickets/:id/en-progreso", { preHandler: authorize(Module.TICKETS, Action.EDIT) }, async (request) => {
    const user = ensureUser(request);
    const { id } = z.object({ id: z.string() }).parse(request.params);
    const t = await marcarEnProgreso({ ticketId: id, actorUserId: user.id });
    return serializeTicket(t, { includeInternalComments: true });
  });

  app.post("/tickets/:id/resolver", { preHandler: authorize(Module.TICKETS, Action.EDIT) }, async (request) => {
    const user = ensureUser(request);
    const { id } = z.object({ id: z.string() }).parse(request.params);
    const t = await resolverTicket({ ticketId: id, actorUserId: user.id });
    return serializeTicket(t, { includeInternalComments: true });
  });

  app.post("/tickets/:id/cerrar", { preHandler: authorize(Module.TICKETS, Action.EDIT) }, async (request) => {
    const user = ensureUser(request);
    const { id } = z.object({ id: z.string() }).parse(request.params);
    const t = await cerrarTicket({ ticketId: id, actorUserId: user.id });
    return serializeTicket(t, { includeInternalComments: true });
  });
}

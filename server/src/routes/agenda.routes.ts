// Eventos de agenda que no son obras: mantenimientos, soportes/reclamos y
// visitas técnicas. Prefijo /api.
//
// Mismos permisos que las obras (`OPERACIONES`): es el mismo calendario y la
// misma gente. No se crea un módulo nuevo para no multiplicar llaves sobre lo
// que operativamente es una sola pantalla.

import { Action, Module, TipoEventoAgenda } from "@prisma/client";
import type { FastifyInstance, FastifyRequest } from "fastify";
import { z } from "zod";

import { authenticate } from "../middleware/auth.middleware.js";
import { authorize } from "../middleware/authorize.middleware.js";
import {
  actualizarAgendaEvento,
  agregarDia,
  crearAgendaEvento,
  eliminarAgendaEvento,
  listAgendaEventos,
  moverDia,
  quitarDia,
} from "../services/agenda/agenda.service.js";
import { parseDateOnly } from "../utils/dates.js";
import { unauthorized } from "../utils/errors.js";

function ensureUser(request: FastifyRequest) {
  if (!request.user) throw unauthorized("No autenticado");
  return request.user;
}

const fechaIso = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);
const idParams = z.object({ id: z.string().min(1) }).strict();

export async function registerAgendaRoutes(app: FastifyInstance) {
  const guardVer = [authenticate, authorize(Module.OPERACIONES, Action.VIEW)];
  const guardEditar = [authenticate, authorize(Module.OPERACIONES, Action.EDIT)];

  // ── Listado ────────────────────────────────────────────────────────────────
  app.get("/agenda-eventos", { preHandler: guardVer }, async (request) => {
    const q = z
      .object({
        desde: fechaIso.optional(),
        hasta: fechaIso.optional(),
        projectId: z.string().min(1).optional(),
        // Lista separada por comas: MANTENIMIENTO,SOPORTE
        tipos: z.string().optional(),
      })
      .strict()
      .parse(request.query);

    const tipos = q.tipos
      ?.split(",")
      .map((t) => t.trim())
      .filter((t): t is TipoEventoAgenda =>
        (Object.values(TipoEventoAgenda) as string[]).includes(t),
      );

    const eventos = await listAgendaEventos({
      desde: q.desde ? parseDateOnly(q.desde) : undefined,
      hasta: q.hasta ? parseDateOnly(q.hasta) : undefined,
      projectId: q.projectId,
      tipos: tipos?.length ? tipos : undefined,
    });
    return { eventos };
  });

  // ── Alta ───────────────────────────────────────────────────────────────────
  const crearBody = z
    .object({
      tipo: z.nativeEnum(TipoEventoAgenda),
      titulo: z.string().trim().max(200).optional(),
      // Al menos un día; los demás pueden ser disjuntos.
      fechas: z.array(fechaIso).min(1).max(60),
      projectId: z.string().min(1).nullable().optional(),
      ticketId: z.string().min(1).nullable().optional(),
      teamId: z.string().min(1).nullable().optional(),
      notas: z.string().max(2000).optional(),
    })
    .strict();

  app.post(
    "/agenda-eventos",
    { preHandler: [authenticate, authorize(Module.OPERACIONES, Action.CREATE)] },
    async (request, reply) => {
      const user = ensureUser(request);
      const body = crearBody.parse(request.body);
      const evento = await crearAgendaEvento({
        tipo: body.tipo,
        titulo: body.titulo,
        fechas: body.fechas.map(parseDateOnly),
        projectId: body.projectId ?? null,
        ticketId: body.ticketId ?? null,
        teamId: body.teamId ?? null,
        notas: body.notas,
        userId: user.id,
      });
      reply.code(201);
      return { evento };
    },
  );

  // ── Edición ────────────────────────────────────────────────────────────────
  const editarBody = z
    .object({
      tipo: z.nativeEnum(TipoEventoAgenda).optional(),
      titulo: z.string().trim().max(200).optional(),
      teamId: z.string().min(1).nullable().optional(),
      projectId: z.string().min(1).nullable().optional(),
      ticketId: z.string().min(1).nullable().optional(),
      notas: z.string().max(2000).optional(),
      completado: z.boolean().optional(),
    })
    .strict()
    .refine((b) => Object.keys(b).length > 0, { message: "Nada para actualizar." });

  app.patch("/agenda-eventos/:id", { preHandler: guardEditar }, async (request) => {
    const user = ensureUser(request);
    const { id } = idParams.parse(request.params);
    const body = editarBody.parse(request.body);
    const evento = await actualizarAgendaEvento({ id, userId: user.id, ...body });
    return { evento };
  });

  // ── Días ───────────────────────────────────────────────────────────────────
  app.post("/agenda-eventos/:id/dias", { preHandler: guardEditar }, async (request, reply) => {
    const user = ensureUser(request);
    const { id } = idParams.parse(request.params);
    const { fecha } = z.object({ fecha: fechaIso }).strict().parse(request.body);
    const evento = await agregarDia({ eventoId: id, fecha: parseDateOnly(fecha), userId: user.id });
    reply.code(201);
    return { evento };
  });

  // Mover un día a otra fecha (drag & drop).
  app.patch("/agenda-eventos/:id/dias/:diaId", { preHandler: guardEditar }, async (request) => {
    const user = ensureUser(request);
    const params = z.object({ id: z.string().min(1), diaId: z.string().min(1) }).strict().parse(request.params);
    const { fecha } = z.object({ fecha: fechaIso }).strict().parse(request.body);
    const evento = await moverDia({
      eventoId: params.id,
      diaId: params.diaId,
      fecha: parseDateOnly(fecha),
      userId: user.id,
    });
    return { evento };
  });

  app.delete("/agenda-eventos/:id/dias/:diaId", { preHandler: guardEditar }, async (request) => {
    const user = ensureUser(request);
    const params = z.object({ id: z.string().min(1), diaId: z.string().min(1) }).strict().parse(request.params);
    const evento = await quitarDia({ eventoId: params.id, diaId: params.diaId, userId: user.id });
    return { evento };
  });

  // ── Baja ───────────────────────────────────────────────────────────────────
  app.delete(
    "/agenda-eventos/:id",
    { preHandler: [authenticate, authorize(Module.OPERACIONES, Action.DELETE)] },
    async (request, reply) => {
      const user = ensureUser(request);
      const { id } = idParams.parse(request.params);
      await eliminarAgendaEvento({ id, userId: user.id });
      reply.code(204);
      return null;
    },
  );
}

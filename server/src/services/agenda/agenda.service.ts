// Eventos de agenda que no son obras: mantenimientos, soportes/reclamos y
// visitas técnicas. Conviven con las obras (`InstallationSchedule`) en el mismo
// calendario, pero tienen su propio modelo — ver el comentario de `AgendaEvento`
// en el schema.
//
// Los días se guardan sueltos (`AgendaEventoDia`), uno por fecha: el evento se
// agenda en un día y se le pueden sumar días no necesariamente consecutivos.

import {
  AuditAction,
  AuditEntityType,
  Prisma,
  TipoEventoAgenda,
} from "@prisma/client";

import { prisma } from "../../lib/prisma.js";
import { createAuditEntry } from "../audit.service.js";
import { badRequest, notFound } from "../../utils/errors.js";

/** Color del bloque cuando el evento no tiene equipo asignado. */
export const SIN_EQUIPO_COLOR = "#9AA0A6";
export const SIN_EQUIPO_NOMBRE = "Sin equipo";

export const TIPO_EVENTO_LABEL: Record<TipoEventoAgenda, string> = {
  MANTENIMIENTO: "Mantenimiento",
  SOPORTE: "Soporte / Reclamo",
  VISITA_TECNICA: "Visita técnica",
};

const INCLUDE = {
  dias: { orderBy: { fecha: "asc" } },
  team: { select: { id: true, name: true, color: true, type: true } },
  project: { select: { id: true, code: true, clientName: true } },
  ticket: { select: { id: true, titulo: true } },
  createdBy: { select: { id: true, name: true } },
} satisfies Prisma.AgendaEventoInclude;

type EventoConRelaciones = Prisma.AgendaEventoGetPayload<{ include: typeof INCLUDE }>;

export interface SerializedAgendaEvento {
  id: string;
  tipo: TipoEventoAgenda;
  titulo: string;
  projectId: string | null;
  projectCode: string | null;
  clientName: string | null;
  ticketId: string | null;
  ticketTitulo: string | null;
  teamId: string | null;
  teamName: string;
  teamColor: string;
  notas: string | null;
  completadoEn: string | null;
  /** Fechas "YYYY-MM-DD", ordenadas. */
  dias: Array<{ id: string; fecha: string }>;
  createdByName: string | null;
  createdAt: string;
}

function isoDate(d: Date): string {
  return d.toISOString().slice(0, 10);
}

export function serializeAgendaEvento(e: EventoConRelaciones): SerializedAgendaEvento {
  return {
    id: e.id,
    tipo: e.tipo,
    titulo: e.titulo,
    projectId: e.projectId,
    projectCode: e.project?.code ?? null,
    clientName: e.project?.clientName ?? null,
    ticketId: e.ticketId,
    ticketTitulo: e.ticket?.titulo ?? null,
    teamId: e.teamId,
    // Si el equipo sigue vivo manda su nombre/color actual; si se borró, el
    // snapshot guardado. Mismo criterio que las obras.
    teamName: e.team?.name ?? e.teamName,
    teamColor: e.team?.color ?? e.teamColor,
    notas: e.notas,
    completadoEn: e.completadoEn ? e.completadoEn.toISOString() : null,
    dias: e.dias.map((d) => ({ id: d.id, fecha: isoDate(d.fecha) })),
    createdByName: e.createdBy?.name ?? null,
    createdAt: e.createdAt.toISOString(),
  };
}

// ─── Lectura ─────────────────────────────────────────────────────────────────

/** Eventos que tocan al menos un día dentro del rango (inclusive). */
export async function listAgendaEventos(filtro: {
  desde?: Date;
  hasta?: Date;
  projectId?: string;
  tipos?: TipoEventoAgenda[];
}): Promise<SerializedAgendaEvento[]> {
  const where: Prisma.AgendaEventoWhereInput = { deletedAt: null };
  if (filtro.projectId) where.projectId = filtro.projectId;
  if (filtro.tipos?.length) where.tipo = { in: filtro.tipos };
  if (filtro.desde || filtro.hasta) {
    where.dias = {
      some: {
        fecha: {
          ...(filtro.desde ? { gte: filtro.desde } : {}),
          ...(filtro.hasta ? { lte: filtro.hasta } : {}),
        },
      },
    };
  }

  const rows = await prisma.agendaEvento.findMany({
    where,
    include: INCLUDE,
    orderBy: { createdAt: "desc" },
  });
  return rows.map(serializeAgendaEvento);
}

// ─── Alta ────────────────────────────────────────────────────────────────────

export interface CrearEventoInput {
  tipo: TipoEventoAgenda;
  titulo?: string | null;
  fechas: Date[];
  projectId?: string | null;
  ticketId?: string | null;
  teamId?: string | null;
  notas?: string | null;
  userId: string;
}

export async function crearAgendaEvento(input: CrearEventoInput): Promise<SerializedAgendaEvento> {
  if (input.fechas.length === 0) {
    throw badRequest("SIN_FECHAS", "Hay que elegir al menos un día.");
  }
  // El ticket solo tiene sentido en un soporte: engancharlo a un mantenimiento
  // haría que el reclamo apareciera donde no corresponde.
  if (input.ticketId && input.tipo !== TipoEventoAgenda.SOPORTE) {
    throw badRequest("TICKET_SOLO_EN_SOPORTE", "Solo los eventos de soporte pueden enlazar un ticket.");
  }

  const proyecto = input.projectId
    ? await prisma.project.findFirst({
        where: { id: input.projectId, deletedAt: null },
        select: { id: true, clientName: true },
      })
    : null;
  if (input.projectId && !proyecto) {
    throw badRequest("PROJECT_NOT_FOUND", "El proyecto no existe.");
  }

  const equipo = input.teamId
    ? await prisma.team.findFirst({
        where: { id: input.teamId, deletedAt: null },
        select: { id: true, name: true, color: true },
      })
    : null;
  if (input.teamId && !equipo) {
    throw badRequest("TEAM_NOT_FOUND", "El equipo no existe.");
  }

  // Sin título explícito se usa el cliente; y si tampoco hay proyecto, el tipo.
  const titulo =
    input.titulo?.trim() || proyecto?.clientName || TIPO_EVENTO_LABEL[input.tipo];

  const evento = await prisma.agendaEvento.create({
    data: {
      tipo: input.tipo,
      titulo,
      projectId: proyecto?.id ?? null,
      ticketId: input.ticketId ?? null,
      teamId: equipo?.id ?? null,
      teamName: equipo?.name ?? SIN_EQUIPO_NOMBRE,
      teamColor: equipo?.color ?? SIN_EQUIPO_COLOR,
      notas: input.notas?.trim() || null,
      createdById: input.userId,
      dias: { create: dedupFechas(input.fechas).map((fecha) => ({ fecha })) },
    },
    include: INCLUDE,
  });

  await auditar(evento, input.userId, AuditAction.agenda_evento_creado);
  return serializeAgendaEvento(evento);
}

/** Quita repetidos y ordena. Evita romper el unique (eventoId, fecha). */
function dedupFechas(fechas: Date[]): Date[] {
  const vistos = new Map<string, Date>();
  for (const f of fechas) vistos.set(isoDate(f), f);
  return [...vistos.values()].sort((a, b) => a.getTime() - b.getTime());
}

// ─── Edición ─────────────────────────────────────────────────────────────────

export async function actualizarAgendaEvento(input: {
  id: string;
  userId: string;
  titulo?: string;
  teamId?: string | null;
  notas?: string;
  completado?: boolean;
}): Promise<SerializedAgendaEvento> {
  const actual = await prisma.agendaEvento.findFirst({
    where: { id: input.id, deletedAt: null },
    select: { id: true, projectId: true, tipo: true, titulo: true },
  });
  if (!actual) throw notFound("EVENTO_NOT_FOUND", "El evento no existe.");

  let equipo: { id: string; name: string; color: string } | null = null;
  if (input.teamId) {
    equipo = await prisma.team.findFirst({
      where: { id: input.teamId, deletedAt: null },
      select: { id: true, name: true, color: true },
    });
    if (!equipo) throw badRequest("TEAM_NOT_FOUND", "El equipo no existe.");
  }

  const evento = await prisma.agendaEvento.update({
    where: { id: input.id },
    data: {
      ...(input.titulo !== undefined ? { titulo: input.titulo.trim() || actual.titulo } : {}),
      ...(input.teamId !== undefined
        ? {
            teamId: equipo?.id ?? null,
            teamName: equipo?.name ?? SIN_EQUIPO_NOMBRE,
            teamColor: equipo?.color ?? SIN_EQUIPO_COLOR,
          }
        : {}),
      ...(input.notas !== undefined ? { notas: input.notas.trim() || null } : {}),
      ...(input.completado !== undefined
        ? { completadoEn: input.completado ? new Date() : null }
        : {}),
    },
    include: INCLUDE,
  });

  await auditar(
    evento,
    input.userId,
    input.completado === true
      ? AuditAction.agenda_evento_completado
      : AuditAction.agenda_evento_actualizado,
  );
  return serializeAgendaEvento(evento);
}

// ─── Días ────────────────────────────────────────────────────────────────────

export async function agregarDia(input: {
  eventoId: string;
  fecha: Date;
  userId: string;
}): Promise<SerializedAgendaEvento> {
  const existe = await prisma.agendaEvento.findFirst({
    where: { id: input.eventoId, deletedAt: null },
    select: { id: true },
  });
  if (!existe) throw notFound("EVENTO_NOT_FOUND", "El evento no existe.");

  // Idempotente: agregar un día que ya está no es un error, no hace nada.
  await prisma.agendaEventoDia.upsert({
    where: { eventoId_fecha: { eventoId: input.eventoId, fecha: input.fecha } },
    create: { eventoId: input.eventoId, fecha: input.fecha },
    update: {},
  });

  const evento = await prisma.agendaEvento.findUniqueOrThrow({
    where: { id: input.eventoId },
    include: INCLUDE,
  });
  await auditar(evento, input.userId, AuditAction.agenda_evento_actualizado);
  return serializeAgendaEvento(evento);
}

export async function quitarDia(input: {
  eventoId: string;
  diaId: string;
  userId: string;
}): Promise<SerializedAgendaEvento> {
  const dias = await prisma.agendaEventoDia.count({ where: { eventoId: input.eventoId } });
  if (dias <= 1) {
    throw badRequest(
      "ULTIMO_DIA",
      "Es el único día del evento. Para sacarlo del calendario, eliminá el evento.",
    );
  }
  await prisma.agendaEventoDia.delete({ where: { id: input.diaId } });

  const evento = await prisma.agendaEvento.findUniqueOrThrow({
    where: { id: input.eventoId },
    include: INCLUDE,
  });
  await auditar(evento, input.userId, AuditAction.agenda_evento_actualizado);
  return serializeAgendaEvento(evento);
}

/** Mueve un día a otra fecha (drag & drop en el calendario). */
export async function moverDia(input: {
  eventoId: string;
  diaId: string;
  fecha: Date;
  userId: string;
}): Promise<SerializedAgendaEvento> {
  const yaEsta = await prisma.agendaEventoDia.findUnique({
    where: { eventoId_fecha: { eventoId: input.eventoId, fecha: input.fecha } },
    select: { id: true },
  });
  // Si el destino ya está ocupado por otro día del mismo evento, se colapsan:
  // se borra el que se movía en vez de romper con un error de unicidad.
  if (yaEsta && yaEsta.id !== input.diaId) {
    await prisma.agendaEventoDia.delete({ where: { id: input.diaId } });
  } else {
    await prisma.agendaEventoDia.update({
      where: { id: input.diaId },
      data: { fecha: input.fecha },
    });
  }

  const evento = await prisma.agendaEvento.findUniqueOrThrow({
    where: { id: input.eventoId },
    include: INCLUDE,
  });
  await auditar(evento, input.userId, AuditAction.agenda_evento_actualizado);
  return serializeAgendaEvento(evento);
}

// ─── Baja ────────────────────────────────────────────────────────────────────

export async function eliminarAgendaEvento(input: { id: string; userId: string }): Promise<void> {
  const evento = await prisma.agendaEvento.findFirst({
    where: { id: input.id, deletedAt: null },
    include: INCLUDE,
  });
  if (!evento) throw notFound("EVENTO_NOT_FOUND", "El evento no existe.");

  await prisma.agendaEvento.update({
    where: { id: input.id },
    data: { deletedAt: new Date() },
  });
  await auditar(evento, input.userId, AuditAction.agenda_evento_cancelado);
}

// ─── Auditoría ───────────────────────────────────────────────────────────────

/**
 * Deja la entrada en el registro. Cuando el evento tiene proyecto, va con
 * `projectId`: así aparece en el historial del cliente, donde
 * `services/clientes/eventos.ts` la clasifica como novedad.
 */
async function auditar(
  evento: EventoConRelaciones,
  userId: string,
  action: AuditAction,
): Promise<void> {
  const tipo = TIPO_EVENTO_LABEL[evento.tipo];
  const cuando = evento.dias.map((d) => isoDate(d.fecha)).join(", ");
  const quien = evento.team?.name ?? evento.teamName;

  const descripcion =
    action === AuditAction.agenda_evento_cancelado
      ? `Se canceló ${tipo.toLowerCase()}: ${evento.titulo}`
      : action === AuditAction.agenda_evento_completado
        ? `${tipo} realizado: ${evento.titulo}`
        : action === AuditAction.agenda_evento_creado
          ? `${tipo} agendado para el ${cuando} — ${quien}`
          : `${tipo} reprogramado: ${cuando} — ${quien}`;

  await createAuditEntry({
    entityType: AuditEntityType.agenda_evento,
    entityId: evento.id,
    projectId: evento.projectId ?? undefined,
    userId,
    action,
    description: descripcion,
    metadata: { tipo: evento.tipo, dias: evento.dias.map((d) => isoDate(d.fecha)) },
  });
}

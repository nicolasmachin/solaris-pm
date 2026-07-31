import {
  AuditAction,
  AuditEntityType,
  NotificationType,
  type Prisma,
  TicketEstado,
  TicketPrioridad,
  TraspasoTipo,
} from "@prisma/client";

import { prisma } from "../../lib/prisma.js";
import { badRequest, notFound } from "../../utils/errors.js";
import { createAuditEntry } from "../audit.service.js";
import { createNotification } from "../notification.service.js";
import { crearTraspaso } from "../traspasos/traspasos.service.js";

type TicketWithComments = Prisma.TicketGetPayload<{ include: { comentarios: true } }>;

// Áreas técnicas válidas para derivar un ticket (coinciden con el ruteo T9 en
// destinatarios.ts, que espera payload.areaDerivada = INGENIERIA | OPERACIONES).
const AREAS_DERIVABLES = ["INGENIERIA", "OPERACIONES"] as const;
export type AreaDerivable = (typeof AREAS_DERIVABLES)[number];
export function esAreaDerivable(v: string): v is AreaDerivable {
  return (AREAS_DERIVABLES as readonly string[]).includes(v);
}

// Resuelve nombres de usuario para los ids involucrados en un ticket (sin
// relación en el modelo; lookup puntual como en ProjectNonMaterialCost).
async function resolveUserNames(ids: Array<string | null | undefined>): Promise<Map<string, string>> {
  const unique = [...new Set(ids.filter((x): x is string => !!x))];
  if (unique.length === 0) return new Map();
  const users = await prisma.user.findMany({
    where: { id: { in: unique } },
    select: { id: true, name: true },
  });
  return new Map(users.map((u) => [u.id, u.name]));
}

export async function serializeTicket(
  t: TicketWithComments,
  opts: { includeInternalComments: boolean },
) {
  const comentarios = [...t.comentarios]
    .filter((c) => (opts.includeInternalComments ? true : !c.esInterno))
    .sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime());
  const names = await resolveUserNames([
    t.creadoPorId,
    t.asignadoAId,
    t.resueltoPorId,
    ...comentarios.map((c) => c.autorId),
  ]);
  return {
    id: t.id,
    projectId: t.projectId,
    titulo: t.titulo,
    descripcion: t.descripcion,
    estado: t.estado,
    prioridad: t.prioridad,
    areaDerivada: t.areaDerivada,
    origenCliente: t.origenCliente,
    creadoPorId: t.creadoPorId,
    creadoPorNombre: names.get(t.creadoPorId) ?? null,
    asignadoAId: t.asignadoAId,
    asignadoANombre: t.asignadoAId ? names.get(t.asignadoAId) ?? null : null,
    resueltoEn: t.resueltoEn?.toISOString() ?? null,
    resueltoPorNombre: t.resueltoPorId ? names.get(t.resueltoPorId) ?? null : null,
    cerradoEn: t.cerradoEn?.toISOString() ?? null,
    createdAt: t.createdAt.toISOString(),
    updatedAt: t.updatedAt.toISOString(),
    comentarios: comentarios.map((c) => ({
      id: c.id,
      autorId: c.autorId,
      autorNombre: names.get(c.autorId) ?? null,
      contenido: c.contenido,
      esInterno: c.esInterno,
      createdAt: c.createdAt.toISOString(),
    })),
  };
}

async function loadTicket(id: string): Promise<TicketWithComments> {
  const t = await prisma.ticket.findFirst({
    where: { id, deletedAt: null },
    include: { comentarios: true },
  });
  if (!t) throw notFound("TICKET_NOT_FOUND", "Ticket no encontrado");
  return t;
}

export async function crearTicket(params: {
  projectId: string;
  titulo: string;
  descripcion: string;
  prioridad?: TicketPrioridad;
  creadoPorId: string;
  origenCliente?: boolean;
}): Promise<TicketWithComments> {
  const project = await prisma.project.findFirst({
    where: { id: params.projectId, deletedAt: null },
    select: { id: true },
  });
  if (!project) throw notFound("PROJECT_NOT_FOUND", "Proyecto no encontrado");

  const ticket = await prisma.ticket.create({
    data: {
      projectId: params.projectId,
      titulo: params.titulo,
      descripcion: params.descripcion,
      prioridad: params.prioridad ?? TicketPrioridad.MEDIA,
      creadoPorId: params.creadoPorId,
      origenCliente: params.origenCliente ?? false,
    },
    include: { comentarios: true },
  });

  await createAuditEntry({
    entityType: AuditEntityType.ticket,
    entityId: ticket.id,
    projectId: ticket.projectId,
    userId: params.creadoPorId,
    action: AuditAction.created,
    description: `Ticket abierto: ${params.titulo}${params.origenCliente ? " (desde el portal)" : ""}`,
  });

  return ticket;
}

export async function agregarComentario(params: {
  ticketId: string;
  autorId: string;
  contenido: string;
  esInterno?: boolean;
}): Promise<TicketWithComments> {
  const ticket = await loadTicket(params.ticketId);
  await prisma.ticketComment.create({
    data: {
      ticketId: ticket.id,
      autorId: params.autorId,
      contenido: params.contenido,
      esInterno: params.esInterno ?? false,
    },
  });

  await createAuditEntry({
    entityType: AuditEntityType.ticket,
    entityId: ticket.id,
    projectId: ticket.projectId,
    userId: params.autorId,
    action: AuditAction.comment_added,
    description: `Comentario en ticket "${ticket.titulo}"${params.esInterno ? " (interno)" : ""}`,
  });

  // Si un interno comenta (no interno) un ticket abierto por el cliente, avisarle in-app.
  if (!params.esInterno && ticket.origenCliente && params.autorId !== ticket.creadoPorId) {
    await notifyCliente(ticket, "Nuevo comentario en tu ticket", `"${ticket.titulo}" tiene una respuesta.`);
  }

  return loadTicket(params.ticketId);
}

export async function derivarTicket(params: {
  ticketId: string;
  areaDerivada: AreaDerivable;
  actorUserId: string;
}): Promise<TicketWithComments> {
  const ticket = await loadTicket(params.ticketId);
  if (ticket.estado === TicketEstado.RESUELTO || ticket.estado === TicketEstado.CERRADO) {
    throw badRequest("TICKET_ESTADO_INVALIDO", "No se puede derivar un ticket resuelto o cerrado.");
  }

  await prisma.ticket.update({
    where: { id: ticket.id },
    data: { estado: TicketEstado.DERIVADO, areaDerivada: params.areaDerivada },
  });

  await createAuditEntry({
    entityType: AuditEntityType.ticket,
    entityId: ticket.id,
    projectId: ticket.projectId,
    userId: params.actorUserId,
    action: AuditAction.status_changed,
    description: `Ticket derivado a ${params.areaDerivada}`,
  });

  // Dispara T9 (→ área técnica + Gerente/ADMIN). Aparece en Pendientes.
  await crearTraspaso({
    tipo: TraspasoTipo.T9_TICKET_DERIVADO,
    projectId: ticket.projectId,
    actorUserId: params.actorUserId,
    payload: { areaDerivada: params.areaDerivada, ticketId: ticket.id },
  });

  return loadTicket(params.ticketId);
}

export async function marcarEnProgreso(params: {
  ticketId: string;
  actorUserId: string;
}): Promise<TicketWithComments> {
  const ticket = await loadTicket(params.ticketId);
  if (ticket.estado === TicketEstado.CERRADO) {
    throw badRequest("TICKET_ESTADO_INVALIDO", "El ticket ya está cerrado.");
  }
  await prisma.ticket.update({
    where: { id: ticket.id },
    data: { estado: TicketEstado.EN_PROGRESO },
  });
  await createAuditEntry({
    entityType: AuditEntityType.ticket,
    entityId: ticket.id,
    projectId: ticket.projectId,
    userId: params.actorUserId,
    action: AuditAction.status_changed,
    description: "Ticket en progreso",
  });
  return loadTicket(params.ticketId);
}

export async function resolverTicket(params: {
  ticketId: string;
  actorUserId: string;
}): Promise<TicketWithComments> {
  const ticket = await loadTicket(params.ticketId);
  if (ticket.estado === TicketEstado.CERRADO) {
    throw badRequest("TICKET_ESTADO_INVALIDO", "El ticket ya está cerrado.");
  }

  await prisma.ticket.update({
    where: { id: ticket.id },
    data: { estado: TicketEstado.RESUELTO, resueltoEn: new Date(), resueltoPorId: params.actorUserId },
  });

  await createAuditEntry({
    entityType: AuditEntityType.ticket,
    entityId: ticket.id,
    projectId: ticket.projectId,
    userId: params.actorUserId,
    action: AuditAction.status_changed,
    description: "Ticket resuelto",
  });

  // Dispara T10 (→ Experiencia Solar). Aparece en Pendientes.
  await crearTraspaso({
    tipo: TraspasoTipo.T10_TICKET_RESUELTO,
    projectId: ticket.projectId,
    actorUserId: params.actorUserId,
    payload: { ticketId: ticket.id },
  });

  if (ticket.origenCliente) {
    await notifyCliente(ticket, "Tu ticket fue resuelto", `"${ticket.titulo}" fue marcado como resuelto.`);
  }

  return loadTicket(params.ticketId);
}

export async function cerrarTicket(params: {
  ticketId: string;
  actorUserId: string;
}): Promise<TicketWithComments> {
  const ticket = await loadTicket(params.ticketId);
  await prisma.ticket.update({
    where: { id: ticket.id },
    data: { estado: TicketEstado.CERRADO, cerradoEn: new Date() },
  });
  await createAuditEntry({
    entityType: AuditEntityType.ticket,
    entityId: ticket.id,
    projectId: ticket.projectId,
    userId: params.actorUserId,
    action: AuditAction.status_changed,
    description: "Ticket cerrado",
  });
  return loadTicket(params.ticketId);
}

export async function actualizarTicket(params: {
  ticketId: string;
  titulo?: string;
  descripcion?: string;
  prioridad?: TicketPrioridad;
  actorUserId: string;
}): Promise<TicketWithComments> {
  const ticket = await loadTicket(params.ticketId);

  const data: Prisma.TicketUpdateInput = {};
  if (params.titulo !== undefined) data.titulo = params.titulo;
  if (params.descripcion !== undefined) data.descripcion = params.descripcion;
  if (params.prioridad !== undefined) data.prioridad = params.prioridad;
  if (Object.keys(data).length === 0) return ticket;

  await prisma.ticket.update({ where: { id: ticket.id }, data });

  await createAuditEntry({
    entityType: AuditEntityType.ticket,
    entityId: ticket.id,
    projectId: ticket.projectId,
    userId: params.actorUserId,
    action: AuditAction.updated,
    description: `Ticket editado: "${params.titulo ?? ticket.titulo}"`,
  });

  return loadTicket(params.ticketId);
}

export async function eliminarTicket(params: {
  ticketId: string;
  actorUserId: string;
}): Promise<void> {
  const ticket = await loadTicket(params.ticketId);

  await prisma.ticket.update({
    where: { id: ticket.id },
    data: { deletedAt: new Date() },
  });

  await createAuditEntry({
    entityType: AuditEntityType.ticket,
    entityId: ticket.id,
    projectId: ticket.projectId,
    userId: params.actorUserId,
    action: AuditAction.deleted,
    description: `Ticket eliminado: "${ticket.titulo}"`,
  });
}

// Aviso in-app al cliente (NUNCA email — guardrail). userId = creador del ticket.
async function notifyCliente(ticket: TicketWithComments, title: string, message: string) {
  try {
    await createNotification({
      userId: ticket.creadoPorId,
      projectId: ticket.projectId,
      type: NotificationType.ticket_actualizado,
      title,
      message,
    });
  } catch (err) {
    console.error("[tickets] no se pudo notificar al cliente:", err);
  }
}

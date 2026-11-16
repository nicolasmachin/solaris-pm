/**
 * "No puedo entrar" del ingreso al portal: el cliente que no logra entrar deja su
 * nombre y su teléfono, y a Experiencia Solar le llega como pendiente con plazo
 * de un día hábil (no por WhatsApp: no se le escribe a un número que llegó desde
 * un formulario abierto).
 *
 *  - Si el teléfono coincide con el de un cliente, el pendiente queda en su
 *    proyecto y la fila de la lista de Experiencia Solar se pone en rojo
 *    ("No puede entrar al portal") hasta que se resuelva.
 *  - Si no coincide, queda como pendiente suelto con los datos que dejó.
 *
 * Ver docs/manual/10-portal-cliente.md.
 */

import { AuditAction, AuditEntityType, TaskPriority, TaskStatus } from "@prisma/client";

import { prisma } from "../../lib/prisma.js";
import { addBusinessDays } from "../../utils/business-days.js";
import { createAuditEntry } from "../audit.service.js";

/** Así empieza el título del pendiente: la lista de Experiencia Solar lo busca por acá. */
export const TITULO_NO_PUEDE_ENTRAR = "No puede entrar al portal";

export async function registrarNoPuedoEntrar(params: { nombre: string; telefono: string; mensaje?: string | null }) {
  const { normalizarTelefono } = await import("../whatsapp-cloud/api.service.js");
  const { telefonosDe } = await import("../whatsapp-cloud/bandejas.service.js");
  const tel = normalizarTelefono(params.telefono);

  // El cliente, por el teléfono cargado en su proyecto (el más nuevo si hay varios).
  const proyectos = await prisma.project.findMany({
    where: { deletedAt: null, clientPhone: { not: null } },
    select: { id: true, code: true, clientName: true, clientPhone: true },
    orderBy: { createdAt: "desc" },
  });
  const proyecto = tel.length >= 10 ? proyectos.find((p) => telefonosDe(p.clientPhone).includes(tel)) ?? null : null;

  // A quién le llega: la gente de Experiencia Solar.
  const equipo = await prisma.user.findMany({
    where: { deletedAt: null, role: { name: "EXPERIENCIA_SOLAR" } },
    select: { id: true, name: true },
    orderBy: { createdAt: "asc" },
  });
  const sistema = await prisma.user.findFirst({
    where: { deletedAt: null, role: { name: "ADMIN" } },
    orderBy: { createdAt: "asc" },
    select: { id: true, name: true },
  });
  const asignados = equipo.length > 0 ? equipo : sistema ? [sistema] : [];

  const descripcion = [
    `Pidió ayuda desde la pantalla de ingreso ("No puedo entrar").`,
    `Nombre: ${params.nombre.trim()}`,
    `Teléfono: ${params.telefono.trim()}`,
    params.mensaje?.trim() ? `Lo que contó: ${params.mensaje.trim()}` : null,
    proyecto
      ? `Coincide con el cliente ${proyecto.clientName} (${proyecto.code}).`
      : "El teléfono no coincide con el de ningún cliente cargado.",
  ]
    .filter(Boolean)
    .join("\n");

  const tarea = await prisma.task.create({
    data: {
      projectId: proyecto?.id ?? null,
      title: `${TITULO_NO_PUEDE_ENTRAR}: ${params.nombre.trim()}`,
      description: descripcion,
      status: TaskStatus.PENDING,
      priority: TaskPriority.URGENT,
      responsible: asignados[0]?.name ?? "Experiencia Solar",
      userId: asignados[0]?.id ?? null,
      dueDate: addBusinessDays(new Date(), 1),
      assignees: { create: asignados.map((u) => ({ userId: u.id })) },
    },
  });

  if (sistema) {
    await createAuditEntry({
      entityType: AuditEntityType.task,
      entityId: tarea.id,
      projectId: proyecto?.id ?? null,
      userId: sistema.id,
      action: AuditAction.created,
      description: `Un cliente pidió ayuda para entrar al portal (${params.nombre.trim()}, ${params.telefono.trim()})${proyecto ? "" : ": el teléfono no coincide con ningún cliente"}`,
    });
  }
  return { ok: true };
}

/** Los proyectos con un pedido de "No puedo entrar" sin resolver, con desde cuándo. */
export async function pedidosSinResolver(projectIds: string[]): Promise<Map<string, Date>> {
  if (projectIds.length === 0) return new Map();
  const tareas = await prisma.task.findMany({
    where: {
      projectId: { in: projectIds },
      deletedAt: null,
      status: { not: TaskStatus.COMPLETED },
      title: { startsWith: TITULO_NO_PUEDE_ENTRAR },
    },
    select: { projectId: true, createdAt: true },
    orderBy: { createdAt: "asc" },
  });
  const salida = new Map<string, Date>();
  for (const t of tareas) if (t.projectId && !salida.has(t.projectId)) salida.set(t.projectId, t.createdAt);
  return salida;
}

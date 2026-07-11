// Actualización de campos de contacto/fecha de un Project desde fuera del módulo
// Proyectos (hoy: Experiencia de Clientes). Escribe el dato CANÓNICO en Project
// (no una copia) y deja la MISMA auditoría que usa Proyectos
// (createAuditEntriesForChanges, entityType project), con metadata de origen para
// poder distinguir de dónde vino sin cambiar el texto del log.

import { AuditEntityType, Prisma, type ProjectStatus } from "@prisma/client";

import { prisma } from "../lib/prisma.js";
import { parseDateOnly } from "../utils/dates.js";
import { createAuditEntriesForChanges } from "./audit.service.js";

// Mismas etiquetas que projectFieldLabels (módulo Proyectos).
const CLIENT_FIELD_LABELS: Record<string, string> = {
  clientEmail: "email del cliente",
  clientPhone: "teléfono del cliente",
  plannedEndDate: "fecha estimada de entrega",
  clientName: "nombre",
  locationProvince: "departamento",
  capacityKwp: "potencia (kWp)",
  salespersonId: "asesor",
  status: "estado",
  clientAddress: "dirección",
  saleDate: "fecha de venta",
  recorridoManual: "etapa (recorrido)",
};

export type ProjectClientFieldsInput = {
  clientEmail?: string | null;
  clientPhone?: string | null;
  plannedEndDate?: string | null; // YYYY-MM-DD
  clientName?: string;
  locationProvince?: string;
  capacityKwp?: number;
  salespersonId?: string | null;
  status?: ProjectStatus;
  clientAddress?: string | null;
  saleDate?: string | null; // YYYY-MM-DD
  recorridoManual?: string | null; // "E1" | "E2" | "E3"
};

// Devuelve el Project actualizado, o null si no existe / está borrado.
export async function updateProjectClientFields(
  projectId: string,
  input: ProjectClientFieldsInput,
  userId: string,
  source: string,
) {
  const project = await prisma.project.findFirst({
    where: { id: projectId, deletedAt: null },
    select: {
      id: true,
      code: true,
      clientEmail: true,
      clientPhone: true,
      plannedEndDate: true,
      clientName: true,
      locationProvince: true,
      capacityKwp: true,
      salespersonId: true,
      status: true,
      clientAddress: true,
      saleDate: true,
      recorridoManual: true,
    },
  });
  if (!project) return null;

  const updateData: Record<string, unknown> = {};
  // "" → null para que "borrar" deje el campo realmente vacío (canónico).
  if (input.clientEmail !== undefined) updateData.clientEmail = input.clientEmail || null;
  if (input.clientPhone !== undefined) updateData.clientPhone = input.clientPhone || null;
  if (input.plannedEndDate !== undefined) {
    updateData.plannedEndDate = input.plannedEndDate ? parseDateOnly(input.plannedEndDate) : null;
  }
  if (input.clientName !== undefined) updateData.clientName = input.clientName;
  if (input.locationProvince !== undefined) updateData.locationProvince = input.locationProvince;
  if (input.capacityKwp !== undefined) updateData.capacityKwp = new Prisma.Decimal(input.capacityKwp);
  if (input.salespersonId !== undefined) updateData.salespersonId = input.salespersonId || null;
  if (input.status !== undefined) updateData.status = input.status;
  if (input.clientAddress !== undefined) updateData.clientAddress = input.clientAddress || null;
  if (input.saleDate !== undefined) {
    updateData.saleDate = input.saleDate ? parseDateOnly(input.saleDate) : null;
  }
  if (input.recorridoManual !== undefined) updateData.recorridoManual = input.recorridoManual || null;

  const updated = await prisma.project.update({ where: { id: project.id }, data: updateData });

  await createAuditEntriesForChanges({
    entityType: AuditEntityType.project,
    entityId: project.id,
    projectId: project.id,
    userId,
    oldData: project,
    newData: { ...project, ...updateData },
    labels: CLIENT_FIELD_LABELS,
    formatter: ({ label, oldValue, newValue }) =>
      `Actualizó ${label} de ${oldValue ?? "vacío"} a ${newValue ?? "vacío"} en proyecto ${project.code}`,
    metadata: { source },
  });

  return updated;
}

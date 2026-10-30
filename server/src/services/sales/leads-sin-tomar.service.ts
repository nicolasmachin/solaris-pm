// Leads sin tomar: los que entran sin vendedor (hoy, los que crea Marketing desde
// una conversación de Instagram). Los ve todo Ventas, pintados aparte, y el
// primero con VENTAS:TOMAR_LEAD que toca "Tomar" se lo queda.
//
// La toma es atómica: se asigna solo si sigue sin vendedor (`updateMany` con
// `assignedToId: null` en el where). Si dos tocan a la vez, gana uno y el otro
// recibe un 409 con el nombre de quien lo tomó.

import { Action, AuditAction, AuditEntityType, Module, NotificationType, SalesStage } from "@prisma/client";

import { prisma } from "../../lib/prisma.js";
import { conflict, notFound } from "../../utils/errors.js";
import { createAuditEntry } from "../audit.service.js";
import { createNotification } from "../notification.service.js";
import type { LeadActor } from "./leads.service.js";
import { describirOrigen } from "./origen-lead.js";

const ABIERTO = { notIn: [SalesStage.CERRADO_GANADO, SalesStage.CERRADO_PERDIDO] };

/** La bandeja: los leads abiertos sin vendedor, el más viejo primero (es el que más espera). */
export async function listarLeadsSinTomar() {
  const leads = await prisma.salesLead.findMany({
    where: { deletedAt: null, assignedToId: null, stage: ABIERTO },
    orderBy: { createdAt: "asc" },
    take: 100,
    include: { createdBy: { select: { name: true } } },
  });
  return leads.map((l) => ({
    id: l.id,
    code: l.code,
    clientName: l.clientName,
    clientPhone: l.clientPhone,
    stage: l.stage,
    origen: describirOrigen(l.origen, l.origenDetalle),
    notes: l.notes,
    createdAt: l.createdAt.toISOString(),
    createdBy: l.createdBy?.name ?? null,
  }));
}

export async function tomarLead(leadId: string, actor: LeadActor) {
  const r = await prisma.salesLead.updateMany({
    where: { id: leadId, deletedAt: null, assignedToId: null },
    data: { assignedToId: actor.id },
  });
  if (r.count === 0) {
    const lead = await prisma.salesLead.findFirst({
      where: { id: leadId, deletedAt: null },
      select: { assignedTo: { select: { name: true } } },
    });
    if (!lead) throw notFound("LEAD_NOT_FOUND", "No existe ese lead");
    throw conflict("LEAD_YA_TOMADO", `Ya lo tomó ${lead.assignedTo?.name ?? "otra persona"}`);
  }
  await prisma.salesActivity.create({
    data: { leadId, userId: actor.id, action: "lead_tomado", notes: `${actor.name} tomó el lead` },
  });
  await createAuditEntry({
    entityType: AuditEntityType.lead,
    entityId: leadId,
    userId: actor.id,
    action: AuditAction.updated,
    fieldChanged: "assignedToId",
    oldValue: null,
    newValue: actor.id,
    description: `Tomó el lead (estaba sin vendedor)`,
  });
  return { ok: true, assignedTo: { id: actor.id, name: actor.name } };
}

/**
 * Avisa (campanita + push) a todos los que pueden tomar leads. Quiénes son sale
 * de la matriz de permisos (VENTAS:TOMAR_LEAD), no de nombres de rol. No frena
 * el alta si falla.
 */
export async function avisarLeadSinTomar(lead: { id: string; code: string; clientName: string }, origen: string) {
  try {
    const usuarios = await prisma.user.findMany({
      where: {
        deletedAt: null,
        role: { permissions: { some: { module: Module.VENTAS, action: Action.TOMAR_LEAD } } },
      },
      select: { id: true },
    });
    await Promise.all(
      usuarios.map((u) =>
        createNotification({
          userId: u.id,
          type: NotificationType.lead_sin_tomar,
          title: `Lead nuevo sin tomar: ${lead.clientName}`,
          message: `${lead.code} entró desde ${origen} y no tiene vendedor. El primero que lo tome se lo queda.`,
          link: `/ventas?lead=${lead.id}`,
        }),
      ),
    );
  } catch (err) {
    console.error("[ventas] no se pudo avisar el lead sin tomar:", err);
  }
}

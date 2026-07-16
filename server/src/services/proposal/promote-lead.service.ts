import { AuditAction, AuditEntityType, SalesStage } from "@prisma/client";

import { prisma } from "../../lib/prisma.js";
import { createAuditEntry } from "../audit.service.js";

// Fecha de creación de la PRIMERA propuesta comercial del lead, unificando el
// flujo nuevo (ProposalV2Version.publishedAt) y el viejo (ProposalGeneration.
// createdAt). null si el lead no tiene propuestas.
export async function getFirstProposalAt(leadId: string): Promise<Date | null> {
  const [v2, gen] = await Promise.all([
    prisma.proposalV2Version.aggregate({ where: { leadId }, _min: { publishedAt: true } }),
    prisma.proposalGeneration.aggregate({ where: { leadId }, _min: { createdAt: true } }),
  ]);
  const fechas = [v2._min.publishedAt, gen._min.createdAt].filter((d): d is Date => d != null);
  if (fechas.length === 0) return null;
  return fechas.reduce((a, b) => (a < b ? a : b));
}

// Auto-promueve un lead a COTIZADO cuando tiene una propuesta comercial generada.
//
// Reglas:
//  - Forward-only: solo promueve si el lead está en NUEVO_LEAD o
//    PENDIENTE_COTIZAR. Si ya está en una etapa posterior (NEGOCIACION,
//    VISITADO, CERRADO_*, etc.) NO retrocede — el caso típico es regenerar la
//    propuesta de un lead que ya está negociando o cerrado.
//  - proposalSentAt (fecha de cotización) se setea a la fecha de la PRIMERA
//    propuesta del lead, y solo si estaba vacía (preserva edición manual).
//
// Devuelve true si promovió el stage.
export async function autoPromoteLeadToCotizado(params: {
  leadId: string;
  userId: string;
  motivo?: string;
}): Promise<boolean> {
  const lead = await prisma.salesLead.findFirst({
    where: { id: params.leadId, deletedAt: null },
    select: { id: true, stage: true, proposalSentAt: true, clientName: true },
  });
  if (!lead) return false;

  const shouldPromote =
    lead.stage === SalesStage.NUEVO_LEAD || lead.stage === SalesStage.PENDIENTE_COTIZAR;

  const firstProposalAt = await getFirstProposalAt(params.leadId);
  const updates: { proposalSentAt?: Date; stage?: SalesStage } = {};
  if (!lead.proposalSentAt && firstProposalAt) updates.proposalSentAt = firstProposalAt;
  if (shouldPromote) updates.stage = SalesStage.COTIZADO;

  if (Object.keys(updates).length === 0) return false;

  await prisma.salesLead.update({ where: { id: lead.id }, data: updates });

  if (shouldPromote) {
    const nota = params.motivo ?? "Promovido a COTIZADO automáticamente al generar la propuesta";
    await prisma.salesActivity.create({
      data: {
        leadId: lead.id,
        userId: params.userId,
        fromStage: lead.stage,
        toStage: SalesStage.COTIZADO,
        action: "stage_changed",
        notes: nota,
      },
    });
    await createAuditEntry({
      entityType: AuditEntityType.lead,
      entityId: lead.id,
      userId: params.userId,
      action: AuditAction.lead_stage_changed,
      fieldChanged: "stage",
      oldValue: lead.stage,
      newValue: SalesStage.COTIZADO,
      description: `Lead '${lead.clientName}' movido a COTIZADO automáticamente al generar la propuesta`,
    });
  }
  return shouldPromote;
}

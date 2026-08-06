// Operaciones sobre leads comerciales.
//
// Existe para que la API HTTP y el conector MCP compartan una sola
// implementación: las reglas de negocio (auto-completado de fechas al cambiar
// de etapa, el motivo de pérdida obligatorio, la traza en el historial) tienen
// que ser las mismas se entre por donde se entre.
//
// Cada función recibe un `actor` —quién la ejecuta— y un `metadata` opcional
// que viaja a la auditoría. El conector lo usa para marcar `source: "mcp"`.

import { AuditAction, AuditEntityType, Prisma, SalesStage } from "@prisma/client";

import { prisma } from "../../lib/prisma.js";
import { createAuditEntriesForChanges, createAuditEntry } from "../audit.service.js";
import { badRequest, notFound } from "../../utils/errors.js";

export interface LeadActor {
  id: string;
  name: string;
}

/** Metadata que se adjunta a cada entrada de auditoría. */
export type LeadAuditMetadata = Prisma.InputJsonValue | null | undefined;

// ── Código ─────────────────────────────────────────────────────────────────

/** Siguiente código libre del año, con el formato `LEAD-2026-007`. */
export async function generateLeadCode(): Promise<string> {
  const year = new Date().getUTCFullYear();
  const prefix = `LEAD-${year}-`;

  const leads = await prisma.salesLead.findMany({
    where: { code: { startsWith: prefix } },
    select: { code: true },
  });

  const maxSequence = leads.reduce((max, lead) => {
    const parsed = Number(lead.code.split("-")[2]);
    return Number.isFinite(parsed) ? Math.max(max, parsed) : max;
  }, 0);

  return `${prefix}${String(maxSequence + 1).padStart(3, "0")}`;
}

// ── Búsqueda ───────────────────────────────────────────────────────────────

/**
 * Ids de leads cuyo teléfono contiene estos dígitos, ignorando espacios,
 * guiones y paréntesis.
 *
 * Va en SQL crudo porque Prisma no puede normalizar una columna dentro del
 * `where`: un `contains` común no encuentra "099 123 456" buscando "099123456",
 * que es justo como se dicta un número de memoria.
 */
async function findLeadIdsByPhoneDigits(digits: string): Promise<string[]> {
  const rows = await prisma.$queryRaw<Array<{ id: string }>>`
    SELECT id FROM sales_leads
    WHERE "deletedAt" IS NULL
      AND regexp_replace(COALESCE("clientPhone", ''), '\D', '', 'g') LIKE ${`%${digits}%`}
    LIMIT 100
  `;
  return rows.map((r) => r.id);
}

/**
 * Construye el filtro de texto libre. Busca por nombre, dirección, email,
 * código y teléfono.
 *
 * El teléfono solo entra si hay al menos 6 dígitos: con menos, cualquier número
 * suelto de una dirección devolvería medio padrón.
 */
export async function buildLeadSearchFilter(
  query: string,
): Promise<Prisma.SalesLeadWhereInput | null> {
  const q = query.trim();
  if (!q) return null;

  const or: Prisma.SalesLeadWhereInput[] = [
    { clientName: { contains: q, mode: "insensitive" } },
    { address: { contains: q, mode: "insensitive" } },
    { clientEmail: { contains: q, mode: "insensitive" } },
    { code: { contains: q, mode: "insensitive" } },
  ];

  const digits = q.replace(/\D/g, "");
  if (digits.length >= 6) {
    const ids = await findLeadIdsByPhoneDigits(digits);
    if (ids.length > 0) or.push({ id: { in: ids } });
  }

  return { OR: or };
}

// ── Alta ───────────────────────────────────────────────────────────────────

export interface CrearLeadInput {
  clientName: string;
  clientEmail?: string | null;
  clientPhone?: string | null;
  address?: string | null;
  estimatedKwp?: number | null;
  estimatedBudgetUsd?: number | null;
  uteBillMonthlyUsd?: number | null;
  roofType?: string | null;
  notes?: string | null;
  assignedToId?: string | null;
  leadCreatedAt?: string | null;
}

export async function crearLead(params: {
  data: CrearLeadInput;
  actor: LeadActor;
  metadata?: LeadAuditMetadata;
}) {
  const { data, actor } = params;
  const code = await generateLeadCode();

  const lead = await prisma.salesLead.create({
    data: {
      code,
      clientName: data.clientName,
      clientEmail: data.clientEmail ?? null,
      clientPhone: data.clientPhone ?? null,
      address: data.address ?? null,
      estimatedKwp: data.estimatedKwp ? new Prisma.Decimal(data.estimatedKwp) : null,
      estimatedBudgetUsd: data.estimatedBudgetUsd
        ? new Prisma.Decimal(data.estimatedBudgetUsd)
        : null,
      uteBillMonthlyUsd: data.uteBillMonthlyUsd
        ? new Prisma.Decimal(data.uteBillMonthlyUsd)
        : null,
      roofType: data.roofType ?? null,
      notes: data.notes ?? null,
      assignedToId: data.assignedToId ?? null,
      // Fecha de alta comercial. Si vino explícita (cargar un lead viejo con su
      // fecha real), se respeta; si no, ahora.
      leadCreatedAt: data.leadCreatedAt ? new Date(data.leadCreatedAt) : new Date(),
      createdById: actor.id,
    },
  });

  await prisma.salesActivity.create({
    data: {
      leadId: lead.id,
      userId: actor.id,
      toStage: lead.stage,
      action: "lead_created",
      notes: `Lead creado por ${actor.name}`,
    },
  });

  await createAuditEntry({
    entityType: AuditEntityType.lead,
    entityId: lead.id,
    userId: actor.id,
    action: AuditAction.lead_created,
    description: `Creó lead '${lead.clientName}' con código ${lead.code}`,
    metadata: params.metadata,
  });

  return lead;
}

// ── Edición ────────────────────────────────────────────────────────────────

export interface EditarLeadInput extends Partial<CrearLeadInput> {
  proposalSentAt?: string | null;
  visitScheduledAt?: string | null;
  visitCompletedAt?: string | null;
  closedAt?: string | null;
}

function toDateOrNull(value: string | null | undefined): Date | null {
  return value ? new Date(value) : null;
}

export async function editarLead(params: {
  leadId: string;
  data: EditarLeadInput;
  actor: LeadActor;
  metadata?: LeadAuditMetadata;
}) {
  const { leadId, data, actor } = params;

  const existing = await prisma.salesLead.findFirst({
    where: { id: leadId, deletedAt: null },
  });
  if (!existing) throw notFound("LEAD_NOT_FOUND", "Lead no encontrado");

  const lead = await prisma.salesLead.update({
    where: { id: leadId },
    data: {
      ...(data.clientName !== undefined && { clientName: data.clientName }),
      ...(data.clientEmail !== undefined && { clientEmail: data.clientEmail }),
      ...(data.clientPhone !== undefined && { clientPhone: data.clientPhone }),
      ...(data.address !== undefined && { address: data.address }),
      ...(data.estimatedKwp !== undefined && {
        estimatedKwp: data.estimatedKwp ? new Prisma.Decimal(data.estimatedKwp) : null,
      }),
      ...(data.estimatedBudgetUsd !== undefined && {
        estimatedBudgetUsd: data.estimatedBudgetUsd
          ? new Prisma.Decimal(data.estimatedBudgetUsd)
          : null,
      }),
      ...(data.uteBillMonthlyUsd !== undefined && {
        uteBillMonthlyUsd: data.uteBillMonthlyUsd
          ? new Prisma.Decimal(data.uteBillMonthlyUsd)
          : null,
      }),
      ...(data.roofType !== undefined && { roofType: data.roofType }),
      ...(data.notes !== undefined && { notes: data.notes }),
      ...(data.assignedToId !== undefined && { assignedToId: data.assignedToId }),
      ...(data.leadCreatedAt !== undefined && { leadCreatedAt: toDateOrNull(data.leadCreatedAt) }),
      ...(data.proposalSentAt !== undefined && { proposalSentAt: toDateOrNull(data.proposalSentAt) }),
      ...(data.visitScheduledAt !== undefined && {
        visitScheduledAt: toDateOrNull(data.visitScheduledAt),
      }),
      ...(data.visitCompletedAt !== undefined && {
        visitCompletedAt: toDateOrNull(data.visitCompletedAt),
      }),
      ...(data.closedAt !== undefined && { closedAt: toDateOrNull(data.closedAt) }),
    },
  });

  await createAuditEntriesForChanges({
    entityType: AuditEntityType.lead,
    entityId: lead.id,
    userId: actor.id,
    oldData: existing,
    newData: {
      ...existing,
      clientName: lead.clientName,
      clientEmail: lead.clientEmail,
      clientPhone: lead.clientPhone,
      address: lead.address,
      estimatedKwp: lead.estimatedKwp,
      estimatedBudgetUsd: lead.estimatedBudgetUsd,
      uteBillMonthlyUsd: lead.uteBillMonthlyUsd,
      roofType: lead.roofType,
      notes: lead.notes,
      assignedToId: lead.assignedToId,
    },
    formatter: ({ label, oldValue, newValue }) =>
      `Actualizó ${label} del lead '${existing.clientName}' de ${oldValue ?? "vacío"} a ${newValue ?? "vacío"}`,
    metadata: params.metadata,
  });

  return lead;
}

// ── Cambio de etapa ────────────────────────────────────────────────────────

export async function moverEtapaLead(params: {
  leadId: string;
  stage: SalesStage;
  notes?: string | null;
  lostReason?: string | null;
  actor: LeadActor;
  metadata?: LeadAuditMetadata;
}) {
  const { leadId, stage, actor } = params;

  const existing = await prisma.salesLead.findFirst({
    where: { id: leadId, deletedAt: null },
  });
  if (!existing) throw notFound("LEAD_NOT_FOUND", "Lead no encontrado");

  if (stage === SalesStage.CERRADO_PERDIDO && !params.lostReason?.trim()) {
    throw badRequest("LOST_REASON_REQUIRED", "Debés indicar el motivo de pérdida");
  }

  const isClosed = stage === SalesStage.CERRADO_GANADO || stage === SalesStage.CERRADO_PERDIDO;

  // Fechas que se completan solas al cambiar de etapa:
  //  - AGENDAR_VISITA completa la fecha de visita SI está vacía. Si el usuario
  //    ya la cargó a mano, no se pisa.
  //  - Cerrar (ganado o perdido) SIEMPRE pisa la fecha de cierre: si el lead se
  //    reabre y se vuelve a cerrar, queda la última real.
  // Ninguna otra etapa toca fechas, y volver atrás no borra la de cierre.
  const dateAutoFills: { visitScheduledAt?: Date; closedAt?: Date } = {};
  if (stage === SalesStage.AGENDAR_VISITA && !existing.visitScheduledAt) {
    dateAutoFills.visitScheduledAt = new Date();
  }
  if (isClosed) {
    dateAutoFills.closedAt = new Date();
  }

  const updatedLead = await prisma.salesLead.update({
    where: { id: leadId },
    data: {
      stage,
      notes: params.notes !== undefined ? params.notes : existing.notes,
      lostReason:
        stage === SalesStage.CERRADO_PERDIDO ? (params.lostReason ?? null) : existing.lostReason,
      ...dateAutoFills,
    },
  });

  await prisma.salesActivity.create({
    data: {
      leadId: updatedLead.id,
      userId: actor.id,
      fromStage: existing.stage,
      toStage: stage,
      action: "stage_changed",
      notes: params.notes ?? null,
    },
  });

  await createAuditEntry({
    entityType: AuditEntityType.lead,
    entityId: updatedLead.id,
    userId: actor.id,
    action: AuditAction.lead_stage_changed,
    fieldChanged: "stage",
    oldValue: existing.stage,
    newValue: stage,
    description: `Movió el lead '${existing.clientName}' de ${existing.stage} a ${stage}`,
    metadata: params.metadata,
  });

  if (stage === SalesStage.CERRADO_PERDIDO) {
    await createAuditEntry({
      entityType: AuditEntityType.lead,
      entityId: updatedLead.id,
      userId: actor.id,
      action: AuditAction.updated,
      fieldChanged: "lostReason",
      oldValue: existing.lostReason,
      newValue: params.lostReason ?? null,
      description: `Registró motivo de pérdida para el lead '${existing.clientName}'`,
      metadata: params.metadata,
    });
  }

  return { lead: updatedLead, previousStage: existing.stage };
}

// ── Comentario ─────────────────────────────────────────────────────────────

export async function comentarLead(params: {
  leadId: string;
  content: string;
  actor: LeadActor;
  metadata?: LeadAuditMetadata;
}) {
  const { leadId, content, actor } = params;

  const lead = await prisma.salesLead.findFirst({
    where: { id: leadId, deletedAt: null },
    select: { id: true, clientName: true, convertedToProjectId: true },
  });
  if (!lead) throw notFound("LEAD_NOT_FOUND", "Lead no encontrado");

  const comment = await prisma.comment.create({
    data: {
      content,
      authorId: actor.id,
      // Si el lead ya se convirtió, el comentario cuelga también del proyecto,
      // para que se vea de los dos lados.
      projectId: lead.convertedToProjectId ?? null,
      leadId: lead.id,
    },
    include: { author: { select: { id: true, name: true } } },
  });

  await createAuditEntry({
    entityType: AuditEntityType.comment,
    entityId: comment.id,
    projectId: comment.projectId,
    userId: actor.id,
    action: AuditAction.comment_added,
    description: `Comentó en el lead '${lead.clientName}'`,
    metadata: params.metadata,
  });

  return comment;
}

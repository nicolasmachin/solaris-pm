// Servicio de comisiones del asesor (Tanda 2).
//
// Congela la comisión de la propuesta ganadora al marcar un lead CERRADO_GANADO:
// lee el `comisionVentasUsdSinIva` del snapshot inmutable, crea un FinanceMovement
// PREVISTO (GASTO, subcategoría "Comisiones ventas") y una Commission linkeada.
// El estado PENDIENTE/PAGADA de la comisión es espejo del status del movimiento
// (fuente de verdad = Finanzas; ver sync-commission-status.ts).

import {
  AuditAction,
  AuditEntityType,
  CategoriaPrincipal,
  CommissionStatus,
  FinanceMovementStatus,
  Moneda,
  Prisma,
  TipoMovimiento,
} from "@prisma/client";

import { prisma } from "../../lib/prisma.js";
import type { ProposalV2Snapshot } from "../proposal/schemas/snapshot.schema.js";
import { createAuditEntry } from "../audit.service.js";
import { badRequest, forbidden, notFound } from "../../utils/errors.js";

const SUBCAT_NOMBRE = "Comisiones ventas";
const SUBCAT_CATEGORIA = CategoriaPrincipal.VARIABLE;

// Primer día del mes siguiente a `date` (en UTC). Aritmética de meses pura, no
// depende del día del mes (evita el bug de saltear meses al caer en día 31).
export function firstDayOfNextMonth(date: Date): Date {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth() + 1, 1));
}

// Extrae el monto congelado y el % desde el snapshot de una versión publicada.
export function readComisionFromSnapshot(snapshot: Prisma.JsonValue): {
  montoUsd: number | null;
  porcentaje: number | null;
} {
  const snap = snapshot as unknown as ProposalV2Snapshot;
  const montoUsd =
    (snap?.calc as { comisionVentasUsdSinIva?: number } | undefined)?.comisionVentasUsdSinIva ?? null;
  const rawPct = snap?.defaults?.comisionVendedorPorcentaje;
  const pctNum = typeof rawPct === "number" ? rawPct : rawPct != null ? Number(rawPct) : null;
  return { montoUsd, porcentaje: pctNum != null && Number.isFinite(pctNum) ? pctNum : null };
}

// ─── Serialización (Decimal → number, Date → ISO) para el cliente ────────────

type CommissionRow = Prisma.CommissionGetPayload<Record<string, never>>;

export interface SerializedCommission {
  id: string;
  asesorId: string;
  leadId: string;
  proposalVersionId: string | null;
  proposalGenerationId: string | null;
  montoUsd: number;
  porcentaje: number | null;
  origenManual: boolean;
  fechaVenta: string;
  dueDate: string;
  status: CommissionStatus;
  paidAt: string | null;
  financeMovementId: string | null;
  createdAt: string;
}

export function serializeCommission(c: CommissionRow): SerializedCommission {
  return {
    id: c.id,
    asesorId: c.asesorId,
    leadId: c.leadId,
    proposalVersionId: c.proposalVersionId,
    proposalGenerationId: c.proposalGenerationId,
    montoUsd: Number(c.montoUsd),
    porcentaje: c.porcentaje != null ? Number(c.porcentaje) : null,
    origenManual: c.origenManual,
    fechaVenta: c.fechaVenta.toISOString(),
    dueDate: c.dueDate.toISOString(),
    status: c.status,
    paidAt: c.paidAt ? c.paidAt.toISOString() : null,
    financeMovementId: c.financeMovementId,
    createdAt: c.createdAt.toISOString(),
  };
}

// ─── Propuestas elegibles para el modal ──────────────────────────────────────

export interface EligibleProposal {
  id: string;
  versionNumber: number;
  publishedAt: string;
  clientName: string | null;
  totalConIva: number | null;
  comisionVentasUsdSinIva: number | null;
  isDefault: boolean;
}

export interface EligibleProposalsResult {
  proposals: EligibleProposal[];
  // No hay propuestas V2 publicadas pero sí propuestas viejas → habilita la
  // carga manual del monto (solo ADMIN/FINANZAS).
  onlyOld: boolean;
}

export async function listEligibleProposals(leadId: string): Promise<EligibleProposalsResult> {
  const versions = await prisma.proposalV2Version.findMany({
    where: { leadId, status: "PUBLISHED" },
    orderBy: { versionNumber: "desc" },
  });

  const proposals: EligibleProposal[] = versions.map((v, idx) => {
    const snap = v.snapshot as unknown as ProposalV2Snapshot;
    const { montoUsd } = readComisionFromSnapshot(v.snapshot);
    return {
      id: v.id,
      versionNumber: v.versionNumber,
      publishedAt: v.publishedAt.toISOString(),
      clientName: snap?.data?.cliente?.nombre ?? null,
      totalConIva: (snap?.calc as { totalConIva?: number } | undefined)?.totalConIva ?? null,
      comisionVentasUsdSinIva: montoUsd,
      isDefault: idx === 0, // la de mayor versionNumber
    };
  });

  let onlyOld = false;
  if (proposals.length === 0) {
    const oldCount = await prisma.proposalGeneration.count({ where: { leadId } });
    onlyOld = oldCount > 0;
  }

  return { proposals, onlyOld };
}

// ─── Congelamiento ───────────────────────────────────────────────────────────

export interface ConfirmCommissionInput {
  leadId: string;
  userId: string;
  userRole: string;
  proposalVersionId?: string;
  montoManualUsd?: number;
  proposalGenerationId?: string;
}

export interface ConfirmCommissionResult {
  commission: SerializedCommission;
  created: boolean;
}

export async function confirmCommission(input: ConfirmCommissionInput): Promise<ConfirmCommissionResult> {
  const { leadId, userId, userRole } = input;

  const lead = await prisma.salesLead.findUnique({
    where: { id: leadId },
    select: {
      id: true,
      clientName: true,
      stage: true,
      closedAt: true,
      assignedToId: true,
      convertedToProjectId: true,
      assignedTo: { select: { name: true } },
    },
  });
  if (!lead) throw notFound("LEAD_NOT_FOUND", "El lead no existe.");
  if (lead.stage !== "CERRADO_GANADO") throw badRequest("LEAD_NOT_WON", "El lead no está marcado como ganado.");
  if (!lead.closedAt) throw badRequest("LEAD_NO_CLOSED_AT", "El lead no tiene fecha de cierre.");
  if (!lead.assignedToId) throw badRequest("LEAD_NO_ASESOR", "El lead no tiene un asesor asignado.");

  // Idempotencia: una comisión por lead.
  const existing = await prisma.commission.findUnique({ where: { leadId } });
  if (existing) return { commission: serializeCommission(existing), created: false };

  // Determinar monto / % / origen.
  let montoUsd: number;
  let porcentaje: number | null = null;
  let proposalVersionId: string | null = null;
  let proposalGenerationId: string | null = null;
  let origenManual = false;

  if (input.proposalVersionId) {
    const version = await prisma.proposalV2Version.findUnique({ where: { id: input.proposalVersionId } });
    if (!version || version.leadId !== leadId) {
      throw badRequest("PROPOSAL_NOT_IN_LEAD", "La propuesta no pertenece al lead.");
    }
    const parsed = readComisionFromSnapshot(version.snapshot);
    if (parsed.montoUsd == null) {
      throw badRequest("PROPOSAL_NO_COMMISSION", "La propuesta no tiene comisión calculada en su snapshot.");
    }
    montoUsd = parsed.montoUsd;
    porcentaje = parsed.porcentaje;
    proposalVersionId = version.id;
  } else if (input.montoManualUsd != null) {
    // Carga manual (propuesta vieja): solo ADMIN o FINANZAS.
    if (userRole !== "ADMIN" && userRole !== "FINANZAS") {
      throw forbidden("Solo un administrador puede cargar la comisión manualmente.");
    }
    if (!(input.montoManualUsd > 0)) {
      throw badRequest("MONTO_INVALIDO", "El monto de comisión debe ser mayor a 0.");
    }
    montoUsd = input.montoManualUsd;
    origenManual = true;
    proposalGenerationId = input.proposalGenerationId ?? null;
  } else {
    throw badRequest("MISSING_PROPOSAL_OR_MONTO", "Elegí una propuesta o cargá un monto manual.");
  }

  const fechaVenta = lead.closedAt;
  const dueDate = firstDayOfNextMonth(fechaVenta);
  const asesorNombre = lead.assignedTo?.name ?? "asesor";
  const descripcion = `Comisión venta ${lead.clientName} — ${asesorNombre}`;

  // Subcategoría de finanzas (idempotente).
  const subcat = await prisma.financeSubcategory.upsert({
    where: { nombre_categoria: { nombre: SUBCAT_NOMBRE, categoria: SUBCAT_CATEGORIA } },
    create: { nombre: SUBCAT_NOMBRE, categoria: SUBCAT_CATEGORIA },
    update: {},
  });

  const { commission, movement } = await prisma.$transaction(async (tx) => {
    const movement = await tx.financeMovement.create({
      data: {
        fecha: fechaVenta,
        mes: fechaVenta.getUTCMonth() + 1,
        anio: fechaVenta.getUTCFullYear(),
        tipoMovimiento: TipoMovimiento.GASTO,
        categoriaPrincipal: SUBCAT_CATEGORIA,
        subcategoriaId: subcat.id,
        descripcion,
        monto: new Prisma.Decimal(montoUsd),
        moneda: Moneda.USD,
        status: FinanceMovementStatus.PREVISTO,
        pagado: false,
        impactaFlujo: true,
        dueDate,
        projectId: lead.convertedToProjectId ?? null,
        creadoPorId: userId,
        observaciones: `Comisión del asesor ${asesorNombre}`,
      },
    });

    const commission = await tx.commission.create({
      data: {
        asesorId: lead.assignedToId!,
        leadId,
        proposalVersionId,
        proposalGenerationId,
        montoUsd: new Prisma.Decimal(montoUsd),
        porcentaje: porcentaje != null ? new Prisma.Decimal(porcentaje) : null,
        origenManual,
        fechaVenta,
        dueDate,
        status: CommissionStatus.PENDIENTE,
        financeMovementId: movement.id,
        createdById: userId,
      },
    });

    return { commission, movement };
  });

  await createAuditEntry({
    entityType: AuditEntityType.commission,
    entityId: commission.id,
    projectId: lead.convertedToProjectId ?? null,
    userId,
    action: AuditAction.commission_created,
    description: `Comisión congelada para ${lead.clientName} (USD ${montoUsd.toFixed(2)})`,
    metadata: { leadId, financeMovementId: movement.id, origenManual },
  });

  return { commission: serializeCommission(commission), created: true };
}

// ─── Listados / métricas (dashboard) ─────────────────────────────────────────

export interface CommissionListItem extends SerializedCommission {
  leadClientName: string;
  asesorName: string;
}

export interface ListCommissionsFilter {
  asesorId?: string;
  status?: CommissionStatus;
  year?: number;
  sort?: "fecha" | "monto";
}

export async function listCommissions(filter: ListCommissionsFilter): Promise<CommissionListItem[]> {
  const where: Prisma.CommissionWhereInput = {};
  if (filter.asesorId) where.asesorId = filter.asesorId;
  if (filter.status) where.status = filter.status;
  if (filter.year) {
    where.fechaVenta = {
      gte: new Date(Date.UTC(filter.year, 0, 1)),
      lt: new Date(Date.UTC(filter.year + 1, 0, 1)),
    };
  }
  const orderBy: Prisma.CommissionOrderByWithRelationInput =
    filter.sort === "monto" ? { montoUsd: "desc" } : { fechaVenta: "desc" };

  const rows = await prisma.commission.findMany({
    where,
    orderBy,
    include: { lead: { select: { clientName: true } }, asesor: { select: { name: true } } },
  });

  return rows.map((r) => ({
    ...serializeCommission(r),
    leadClientName: r.lead?.clientName ?? "",
    asesorName: r.asesor?.name ?? "",
  }));
}

// Comisión de un lead puntual (o null). Para el panel del lead y el aviso al reabrir.
export async function getLeadCommission(leadId: string): Promise<SerializedCommission | null> {
  const c = await prisma.commission.findUnique({ where: { leadId } });
  return c ? serializeCommission(c) : null;
}

export interface CommissionMetrics {
  saldoAcobrarUsd: number;
  cobradoEnAnioUsd: number;
  ventasCerradas: number;
  evolucion: Array<{ mes: number; cobradas: number; proyectadas: number }>;
}

export async function commissionMetrics(filter: { asesorId?: string; year: number }): Promise<CommissionMetrics> {
  const { asesorId, year } = filter;
  const baseWhere: Prisma.CommissionWhereInput = {};
  if (asesorId) baseWhere.asesorId = asesorId;

  const yearStart = new Date(Date.UTC(year, 0, 1));
  const yearEnd = new Date(Date.UTC(year + 1, 0, 1));

  // Saldo total a cobrar = todas las PENDIENTE (sin importar año).
  const pendientes = await prisma.commission.findMany({
    where: { ...baseWhere, status: CommissionStatus.PENDIENTE },
    select: { montoUsd: true, dueDate: true },
  });
  const saldoAcobrarUsd = pendientes.reduce((a, c) => a + Number(c.montoUsd), 0);

  // Pagadas con paidAt en el año.
  const pagadasAnio = await prisma.commission.findMany({
    where: { ...baseWhere, status: CommissionStatus.PAGADA, paidAt: { gte: yearStart, lt: yearEnd } },
    select: { montoUsd: true, paidAt: true },
  });
  const cobradoEnAnioUsd = pagadasAnio.reduce((a, c) => a + Number(c.montoUsd), 0);

  // Ventas cerradas del año (fechaVenta en el año).
  const ventasCerradas = await prisma.commission.count({
    where: { ...baseWhere, fechaVenta: { gte: yearStart, lt: yearEnd } },
  });

  // Evolución mensual: cobradas por paidAt, proyectadas por dueDate de PENDIENTE.
  const evolucion = Array.from({ length: 12 }, (_, i) => ({ mes: i + 1, cobradas: 0, proyectadas: 0 }));
  for (const c of pagadasAnio) {
    if (c.paidAt) evolucion[c.paidAt.getUTCMonth()].cobradas += Number(c.montoUsd);
  }
  for (const c of pendientes) {
    if (c.dueDate >= yearStart && c.dueDate < yearEnd) {
      evolucion[c.dueDate.getUTCMonth()].proyectadas += Number(c.montoUsd);
    }
  }

  return { saldoAcobrarUsd, cobradoEnAnioUsd, ventasCerradas, evolucion };
}

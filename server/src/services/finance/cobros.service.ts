// Cobros a clientes por proyecto.
//
// Lógica de la pestaña Finanzas → Cobros (y su espejo en Experiencia Solar),
// extraída del handler de `GET /finance/cobros-by-project` para compartirla con
// el conector MCP. El cálculo es el mismo; se agregan dos piezas que la
// pantalla no necesitaba y el chat sí: las cuotas del plan de pagos de cada
// proyecto, en una sola consulta, para poder decir quién tiene plan y quién no.
//
// "Cobrado" acá = movimiento INGRESO con la marca `cobrado`, de cualquier
// categoría, convertido a dólares con la cotización del propio movimiento o, si
// no la tiene, con la última cargada. ⚠️ El plan de pagos usa otro criterio
// (solo PROYECTO_ENTRADA, estado PAGADO y en dólares nominales), así que el
// saldo de una vista y otra puede no coincidir en proyectos con cobros en pesos.

import {
  CategoriaPrincipal,
  FinanceMovementStatus,
  Moneda,
  MovementSourceType,
  Prisma,
  ProjectStatus,
  TipoMovimiento,
} from "@prisma/client";

import { prisma } from "../../lib/prisma.js";
import { decimalToNumber, serializeDateOnly } from "../../utils/serialization.js";

export type EstadoCobranza = "SIN_PRESUPUESTO" | "PENDIENTE" | "PARCIAL" | "COMPLETO" | "EXCEDIDO";

export function clasificarEstadoCobranza(presupuestoUsd: number | null, cobradoUsd: number): EstadoCobranza {
  if (presupuestoUsd == null) return "SIN_PRESUPUESTO";
  if (cobradoUsd < 0.005) return "PENDIENTE";
  if (cobradoUsd > presupuestoUsd + 0.005) return "EXCEDIDO";
  if (cobradoUsd >= presupuestoUsd - 0.005) return "COMPLETO";
  return "PARCIAL";
}

function roundMoney(value: number) {
  return Math.round(value * 100) / 100;
}

/** Cotización de la pantalla de Cobros: la última cargada, o 1. */
export async function cotizacionCobros(): Promise<number> {
  const lastRate = await prisma.exchangeRate.findFirst({ orderBy: { createdAt: "desc" } });
  return lastRate ? (decimalToNumber(lastRate.usdToUyu) ?? 1) : 1;
}

/** Monto en dólares: con la cotización del movimiento si la tiene. */
export function movimientoEnUsd(
  row: { monto: Prisma.Decimal; moneda: Moneda; tipoCambio: Prisma.Decimal | null },
  fallbackUsdToUyu: number,
) {
  const monto = decimalToNumber(row.monto) ?? 0;
  if (row.moneda === Moneda.USD) return monto;
  const rowRate = row.tipoCambio
    ? (decimalToNumber(row.tipoCambio) ?? fallbackUsdToUyu)
    : fallbackUsdToUyu;
  return rowRate > 0 ? monto / rowRate : monto;
}

export interface FiltroCobros {
  estado?: EstadoCobranza;
  clientName?: string;
  activos?: boolean;
}

export async function listarCobrosPorProyecto(filtro: FiltroCobros) {
  const fallbackUsdToUyu = await cotizacionCobros();

  const where: Prisma.ProjectWhereInput = { deletedAt: null };
  if (filtro.activos) where.status = ProjectStatus.ACTIVE;
  if (filtro.clientName && filtro.clientName.trim().length > 0) {
    where.clientName = { contains: filtro.clientName.trim(), mode: "insensitive" };
  }

  const projects = await prisma.project.findMany({
    where,
    select: {
      id: true,
      code: true,
      clientName: true,
      capacityKwp: true,
      budgetUsd: true,
      status: true,
    },
    orderBy: [{ status: "asc" }, { clientName: "asc" }],
  });

  // Cobros agregados por proyecto en una sola query.
  const projectIds = projects.map((p) => p.id);
  const cobrosAgg =
    projectIds.length === 0
      ? []
      : await prisma.financeMovement.findMany({
          where: {
            deletedAt: null,
            tipoMovimiento: TipoMovimiento.INGRESO,
            cobrado: true,
            projectId: { in: projectIds },
          },
          select: { projectId: true, fecha: true, monto: true, moneda: true, tipoCambio: true },
        });

  const cobrosByProject = new Map<string, typeof cobrosAgg>();
  for (const m of cobrosAgg) {
    if (!m.projectId) continue;
    const arr = cobrosByProject.get(m.projectId) ?? [];
    arr.push(m);
    cobrosByProject.set(m.projectId, arr);
  }

  const items = projects.map((p) => {
    const cobros = cobrosByProject.get(p.id) ?? [];
    let totalCobradoUSD = 0;
    let ultimoCobro: Date | null = null;
    for (const c of cobros) {
      totalCobradoUSD += movimientoEnUsd(c, fallbackUsdToUyu);
      if (!ultimoCobro || c.fecha > ultimoCobro) ultimoCobro = c.fecha;
    }
    totalCobradoUSD = roundMoney(totalCobradoUSD);
    const presupuestoUSD = p.budgetUsd != null ? Number(p.budgetUsd) : null;
    const saldoPendienteUSD =
      presupuestoUSD != null ? roundMoney(Math.max(0, presupuestoUSD - totalCobradoUSD)) : 0;
    const saldoAFavorUSD =
      presupuestoUSD != null ? roundMoney(Math.max(0, totalCobradoUSD - presupuestoUSD)) : 0;
    const estadoCobranza = clasificarEstadoCobranza(presupuestoUSD, totalCobradoUSD);

    return {
      id: p.id,
      clientName: p.clientName,
      code: p.code,
      capacity: Number(p.capacityKwp),
      status: p.status,
      presupuestoUSD,
      totalCobradoUSD,
      saldoPendienteUSD,
      saldoAFavorUSD,
      estadoCobranza,
      ultimoCobro: ultimoCobro ? serializeDateOnly(ultimoCobro) : null,
      cantidadCobros: cobros.length,
    };
  });

  const filtered = filtro.estado ? items.filter((i) => i.estadoCobranza === filtro.estado) : items;

  const totales = filtered.reduce(
    (acc, p) => ({
      totalPresupuestadoUSD: acc.totalPresupuestadoUSD + (p.presupuestoUSD ?? 0),
      totalCobradoUSD: acc.totalCobradoUSD + p.totalCobradoUSD,
      totalPendienteUSD: acc.totalPendienteUSD + p.saldoPendienteUSD,
      totalSaldoAFavorUSD: acc.totalSaldoAFavorUSD + p.saldoAFavorUSD,
    }),
    { totalPresupuestadoUSD: 0, totalCobradoUSD: 0, totalPendienteUSD: 0, totalSaldoAFavorUSD: 0 },
  );

  return {
    projects: filtered,
    totales: {
      totalPresupuestadoUSD: roundMoney(totales.totalPresupuestadoUSD),
      totalCobradoUSD: roundMoney(totales.totalCobradoUSD),
      totalPendienteUSD: roundMoney(totales.totalPendienteUSD),
      totalSaldoAFavorUSD: roundMoney(totales.totalSaldoAFavorUSD),
    },
    tipoCambio: fallbackUsdToUyu,
  };
}

export interface CuotaPrevista {
  id: string;
  projectId: string;
  descripcion: string;
  monto: number;
  moneda: Moneda;
  /** YYYY-MM-DD, o null si la cuota no tiene vencimiento. */
  dueDate: string | null;
}

/**
 * Cuotas del plan de pagos de varios proyectos, en una sola consulta.
 *
 * Mismo criterio que `getPlanPagos()`: INGRESO + PROYECTO_ENTRADA + PREVISTO +
 * MANUAL. Un proyecto "tiene plan" si tiene al menos una. La descripción se
 * devuelve sin el prefijo "[PLAN] " que ponía el asistente viejo.
 */
export async function cuotasPrevistasPorProyecto(
  projectIds: string[],
): Promise<Map<string, CuotaPrevista[]>> {
  const map = new Map<string, CuotaPrevista[]>();
  if (projectIds.length === 0) return map;

  const rows = await prisma.financeMovement.findMany({
    where: {
      projectId: { in: projectIds },
      tipoMovimiento: TipoMovimiento.INGRESO,
      categoriaPrincipal: CategoriaPrincipal.PROYECTO_ENTRADA,
      status: FinanceMovementStatus.PREVISTO,
      sourceType: MovementSourceType.MANUAL,
      deletedAt: null,
    },
    select: { id: true, projectId: true, descripcion: true, monto: true, moneda: true, dueDate: true },
    orderBy: [{ dueDate: "asc" }, { createdAt: "asc" }],
  });

  for (const r of rows) {
    if (!r.projectId) continue;
    const arr = map.get(r.projectId) ?? [];
    arr.push({
      id: r.id,
      projectId: r.projectId,
      descripcion: r.descripcion.replace(/^\[PLAN\]\s*/, ""),
      monto: Number(r.monto),
      moneda: r.moneda,
      dueDate: r.dueDate ? serializeDateOnly(r.dueDate) : null,
    });
    map.set(r.projectId, arr);
  }
  return map;
}

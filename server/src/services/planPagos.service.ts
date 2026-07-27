// Asistente de Plan de Pagos Previstos.
// Crea cobros previstos estructurados (seña + cuotas) en una sola transacción
// a partir del presupuesto del proyecto. Identificación del plan: prefijo
// "[PLAN] " literal en `FinanceMovement.descripcion` (sin migración de schema).
// En la UI el prefijo se strippea al mostrar — el usuario ve "Seña" y no
// "[PLAN] Seña".

import {
  CategoriaPrincipal,
  EstadoAprobacion,
  FinanceMovementStatus,
  Moneda,
  MovementSourceType,
  Prisma,
  TipoMovimiento,
  type FinanceMovement,
} from "@prisma/client";

import { prisma } from "../lib/prisma.js";
import { AppError, badRequest, notFound } from "../utils/errors.js";

export const PLAN_PREFIX = "[PLAN] ";

// Tolerancia (en USD) entre suma de cuotas y presupuesto. Cubre redondeos
// de centavos al recalcular % ↔ monto en el cliente.
const SUM_TOLERANCE_USD = 1;

export type PlanCuotaInput = {
  descripcion: string;
  monto: number;
  fechaPrevista: string; // ISO yyyy-mm-dd
};

export type PlanCuotaOutput = {
  id: string;
  descripcion: string; // SIN prefijo [PLAN], listo para mostrar
  monto: number;
  moneda: Moneda;
  dueDate: string | null;
  status: FinanceMovementStatus;
  cobrado: boolean;
};

export type GetPlanResult = {
  hasPlan: boolean;
  presupuestoUsd: number | null;
  totalCobrado: number;
  saldoPendiente: number;
  cuotas: PlanCuotaOutput[];
};

/**
 * Suma los ingresos de proyecto ya cobrados (status PAGADO, INGRESO,
 * PROYECTO_ENTRADA, no soft-deleted) — moneda USD a precio nominal.
 * Lo que se descuenta del presupuesto para calcular el saldo pendiente sobre
 * el cual se arma el plan de pagos.
 */
async function calcularTotalCobradoUsd(projectId: string): Promise<number> {
  const rows = await prisma.financeMovement.findMany({
    where: {
      projectId,
      tipoMovimiento: TipoMovimiento.INGRESO,
      categoriaPrincipal: CategoriaPrincipal.PROYECTO_ENTRADA,
      status: FinanceMovementStatus.PAGADO,
      moneda: Moneda.USD,
      deletedAt: null,
    },
    select: { monto: true },
  });
  return rows.reduce((acc, r) => acc + Number(r.monto), 0);
}

function stripPlanPrefix(desc: string): string {
  return desc.startsWith(PLAN_PREFIX) ? desc.slice(PLAN_PREFIX.length) : desc;
}

function toCuotaOutput(m: FinanceMovement): PlanCuotaOutput {
  return {
    id: m.id,
    descripcion: stripPlanPrefix(m.descripcion),
    monto: Number(m.monto),
    moneda: m.moneda,
    dueDate: m.dueDate ? m.dueDate.toISOString().slice(0, 10) : null,
    status: m.status,
    cobrado: m.cobrado,
  };
}

/**
 * Lee el plan de pagos de un proyecto = TODOS sus cobros previstos (pendientes).
 * El plan no es una entidad separada: son los cobros de proyecto que todavía no
 * se cobraron, sin importar si se cargaron con el asistente o a mano (desde
 * "Registrar cobro" en modo Previsto). Filtro:
 *   - tipoMovimiento INGRESO, categoría PROYECTO_ENTRADA
 *   - status PREVISTO (las cuotas ya cobradas salen del plan editable)
 *   - sourceType MANUAL (excluye previstos generados por procesos automáticos)
 *   - deletedAt null
 *
 * Las cuotas se ordenan por dueDate asc (luego createdAt como tiebreaker).
 */
export async function getPlanPagos(projectId: string): Promise<GetPlanResult> {
  const project = await prisma.project.findFirst({
    where: { id: projectId, deletedAt: null },
    select: { id: true, budgetUsd: true },
  });
  if (!project) throw notFound("PROJECT_NOT_FOUND", "Proyecto no encontrado");

  const [cuotas, totalCobrado] = await Promise.all([
    prisma.financeMovement.findMany({
      where: {
        projectId,
        tipoMovimiento: TipoMovimiento.INGRESO,
        categoriaPrincipal: CategoriaPrincipal.PROYECTO_ENTRADA,
        status: FinanceMovementStatus.PREVISTO,
        sourceType: MovementSourceType.MANUAL,
        deletedAt: null,
      },
      orderBy: [{ dueDate: "asc" }, { createdAt: "asc" }],
    }),
    calcularTotalCobradoUsd(projectId),
  ]);

  const presupuestoUsd = project.budgetUsd ? Number(project.budgetUsd) : null;
  const saldoPendiente = (presupuestoUsd ?? 0) - totalCobrado;

  return {
    hasPlan: cuotas.length > 0,
    presupuestoUsd,
    totalCobrado,
    saldoPendiente,
    cuotas: cuotas.map(toCuotaOutput),
  };
}

export type CreatePlanResult = {
  created: number;
  replaced: number;
  cuotas: PlanCuotaOutput[];
};

/**
 * Crea (o reemplaza) el plan de pagos previstos del proyecto.
 *
 * Reglas de validación:
 *  - proyecto debe existir, no estar borrado, y tener budgetUsd > 0
 *  - al menos 1 cuota
 *  - cada cuota: monto > 0, dueDate parseable
 *  - sum(montos) coincide con presupuesto ±SUM_TOLERANCE_USD
 *  - primera cuota (la "seña") < presupuesto (si seña >= budget no tiene
 *    sentido matemático). El warning de seña > 50% se valida en el cliente
 *    (es un soft warning, no bloquea).
 *
 * Atomic: soft-deletea TODOS los cobros previstos vigentes del proyecto
 * (INGRESO, PROYECTO_ENTRADA, status PREVISTO, MANUAL, deletedAt null) y crea
 * las nuevas cuotas en una sola transacción. Así "editar el plan" reconcilia
 * todos los pendientes en un solo set, sin duplicar. No toca:
 *   - cobros ya cobrados (status != PREVISTO)
 */
export async function createPlanPagos(args: {
  projectId: string;
  cuotas: PlanCuotaInput[];
  userId: string;
}): Promise<CreatePlanResult> {
  const { projectId, cuotas, userId } = args;

  const project = await prisma.project.findFirst({
    where: { id: projectId, deletedAt: null },
    select: { id: true, budgetUsd: true },
  });
  if (!project) throw notFound("PROJECT_NOT_FOUND", "Proyecto no encontrado");
  if (!project.budgetUsd || Number(project.budgetUsd) <= 0) {
    throw badRequest(
      "BUDGET_REQUIRED",
      "El proyecto no tiene presupuesto cargado. Cargá el presupuesto antes de crear el plan de pagos.",
    );
  }
  const budget = Number(project.budgetUsd);
  const totalCobrado = await calcularTotalCobradoUsd(projectId);
  const saldoPendiente = budget - totalCobrado;

  if (saldoPendiente <= 0) {
    throw badRequest(
      "SALDO_PENDIENTE_INVALID",
      `Este proyecto no tiene saldo pendiente (presupuesto USD ${budget.toFixed(2)}, cobrado USD ${totalCobrado.toFixed(2)}). No hay nada que planificar.`,
    );
  }

  if (cuotas.length === 0) {
    throw badRequest("CUOTAS_EMPTY", "El plan debe tener al menos una cuota.");
  }

  // Validaciones por cuota.
  for (const c of cuotas) {
    if (!c.descripcion || c.descripcion.trim().length === 0) {
      throw badRequest("CUOTA_DESCRIPCION_REQUIRED", "Cada cuota debe tener descripción.");
    }
    if (!Number.isFinite(c.monto) || c.monto <= 0) {
      throw badRequest("CUOTA_MONTO_INVALID", `Monto inválido para "${c.descripcion}".`);
    }
    if (!/^\d{4}-\d{2}-\d{2}$/.test(c.fechaPrevista)) {
      throw badRequest(
        "CUOTA_FECHA_INVALID",
        `Fecha inválida para "${c.descripcion}" (esperado yyyy-mm-dd).`,
      );
    }
  }

  // Validación de suma: cierra contra saldo pendiente (presupuesto - cobrado),
  // no contra presupuesto bruto. Permite reabrir el plan después de cobros.
  const total = cuotas.reduce((acc, c) => acc + c.monto, 0);
  const diff = Math.abs(total - saldoPendiente);
  if (diff > SUM_TOLERANCE_USD) {
    throw badRequest(
      "SUM_MISMATCH",
      `La suma de las cuotas (USD ${total.toFixed(2)}) no coincide con el saldo pendiente (USD ${saldoPendiente.toFixed(2)}). Diferencia: USD ${(total - saldoPendiente).toFixed(2)}.`,
    );
  }

  // Validación matemática de seña: contra saldo pendiente, no presupuesto.
  const senia = cuotas[0];
  if (senia.monto >= saldoPendiente) {
    throw badRequest(
      "SENIA_GTE_SALDO",
      `La seña (USD ${senia.monto.toFixed(2)}) no puede ser mayor o igual al saldo pendiente (USD ${saldoPendiente.toFixed(2)}).`,
    );
  }

  // Atomic: soft-delete plan anterior + create nuevas cuotas.
  const result = await prisma.$transaction(async (tx) => {
    const existing = await tx.financeMovement.findMany({
      where: {
        projectId,
        tipoMovimiento: TipoMovimiento.INGRESO,
        categoriaPrincipal: CategoriaPrincipal.PROYECTO_ENTRADA,
        status: FinanceMovementStatus.PREVISTO,
        sourceType: MovementSourceType.MANUAL,
        deletedAt: null,
      },
      select: { id: true },
    });

    if (existing.length > 0) {
      await tx.financeMovement.updateMany({
        where: { id: { in: existing.map((m) => m.id) } },
        data: { deletedAt: new Date() },
      });
    }

    const now = new Date();
    const createdRows: FinanceMovement[] = [];
    for (const cuota of cuotas) {
      const fecha = new Date(`${cuota.fechaPrevista}T00:00:00.000Z`);
      const created = await tx.financeMovement.create({
        data: {
          fecha,
          mes: fecha.getUTCMonth() + 1,
          anio: fecha.getUTCFullYear(),
          tipoMovimiento: TipoMovimiento.INGRESO,
          categoriaPrincipal: CategoriaPrincipal.PROYECTO_ENTRADA,
          descripcion: `${PLAN_PREFIX}${cuota.descripcion.trim()}`,
          monto: new Prisma.Decimal(cuota.monto),
          moneda: Moneda.USD,
          pagado: false,
          cobrado: false,
          impactaFlujo: true,
          status: FinanceMovementStatus.PREVISTO,
          sourceType: MovementSourceType.MANUAL,
          estadoAprobacion: EstadoAprobacion.REGISTRADO,
          dueDate: fecha,
          projectId,
          accountId: null,
          creadoPorId: userId,
          updatedAt: now,
        },
      });
      createdRows.push(created);
    }

    return { existingCount: existing.length, createdRows };
  });

  return {
    created: result.createdRows.length,
    replaced: result.existingCount,
    cuotas: result.createdRows.map(toCuotaOutput),
  };
}

/**
 * Sanity check para confirmar que el módulo Project tiene budgetUsd > 0
 * antes de mostrar el banner. Lo expongo para que el cliente lo use sin
 * tener que armar otra query.
 */
export async function getPlanBannerContext(projectId: string): Promise<{
  presupuestoUsd: number | null;
  totalCobrado: number;
  saldoPendiente: number;
  hasPlan: boolean;
}> {
  const r = await getPlanPagos(projectId);
  return {
    presupuestoUsd: r.presupuestoUsd,
    totalCobrado: r.totalCobrado,
    saldoPendiente: r.saldoPendiente,
    hasPlan: r.hasPlan,
  };
}

// Re-export tipo público para que las routes importen sin re-derivar.
export type { FinanceMovement } from "@prisma/client";

// Helper de error tipado por si la route quiere hacer mapping puntual.
export function isPlanPagosError(err: unknown): err is AppError {
  return err instanceof AppError;
}

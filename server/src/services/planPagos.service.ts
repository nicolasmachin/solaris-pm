// Asistente de Plan de Pagos Previstos.
// Crea cobros previstos estructurados (seña + cuotas) en una sola transacción
// a partir del presupuesto del proyecto. Identificación del plan: prefijo
// "[PLAN] " literal en `FinanceMovement.descripcion` (sin migración de schema).
// En la UI el prefijo se strippea al mostrar — el usuario ve "Seña" y no
// "[PLAN] Seña".

import {
  CategoriaPrincipal,
  HitoCobro,
  EstadoAprobacion,
  FinanceMovementStatus,
  Moneda,
  MovementSourceType,
  Prisma,
  TipoMovimiento,
  type FinanceMovement,
} from "@prisma/client";

import { prisma } from "../lib/prisma.js";
import { completarPorEvidencia, EVIDENCIA_PLAN_PAGOS } from "./checklist-evidencias.js";
import { AppError, badRequest, notFound } from "../utils/errors.js";
import { todayUtc } from "../utils/dates.js";
import { hitosDeProyectos, infoCuota, serializarInfo } from "./finance/hitos-cobro.service.js";

export const PLAN_PREFIX = "[PLAN] ";

// Tolerancia (en USD) entre suma de cuotas y presupuesto. Cubre redondeos
// de centavos al recalcular % ↔ monto en el cliente.
const SUM_TOLERANCE_USD = 1;

// Una cuota va atada a un momento de la obra (`hitoCobro`, sin fecha: queda
// lista para cobrar cuando llega) o a una fecha fija (`fechaPrevista`), para
// los acuerdos que no siguen el plan de siempre.
export type PlanCuotaInput = {
  descripcion: string;
  monto: number;
  hitoCobro?: HitoCobro | null;
  fechaPrevista?: string | null; // ISO yyyy-mm-dd, obligatoria sin hitoCobro
};

export type PlanCuotaOutput = {
  id: string;
  descripcion: string; // SIN prefijo [PLAN], listo para mostrar
  monto: number;
  moneda: Moneda;
  dueDate: string | null;
  status: FinanceMovementStatus;
  cobrado: boolean;
  hitoCobro: HitoCobro | null;
  hito: ReturnType<typeof serializarInfo>;
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

const ORDEN_HITO: Record<HitoCobro, number> = { SENIA: 0, PREVIO_OBRA: 1, OBRA_FINALIZADA: 2, HABILITACION: 3 };

function toCuotaOutput(m: FinanceMovement, hito: ReturnType<typeof serializarInfo> = null): PlanCuotaOutput {
  return {
    id: m.id,
    descripcion: stripPlanPrefix(m.descripcion),
    monto: Number(m.monto),
    moneda: m.moneda,
    dueDate: m.dueDate ? m.dueDate.toISOString().slice(0, 10) : null,
    status: m.status,
    cobrado: m.cobrado,
    hitoCobro: m.hitoCobro,
    hito,
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
  const hitos = (await hitosDeProyectos([projectId])).get(projectId);
  const hoy = todayUtc();
  // Las de un momento de la obra, en el orden de la obra; después las de fecha fija.
  const orden = (m: FinanceMovement) => (m.hitoCobro ? ORDEN_HITO[m.hitoCobro] : 10);
  const ordenadas = [...cuotas].sort((a, b) => orden(a) - orden(b));

  return {
    hasPlan: cuotas.length > 0,
    presupuestoUsd,
    totalCobrado,
    saldoPendiente,
    cuotas: ordenadas.map((m) => toCuotaOutput(m, serializarInfo(infoCuota(m, hitos, hoy)))),
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
 *  - primera cuota (la "seña") <= saldo pendiente (solo bloquea si lo supera;
 *    una cuota única igual al total es válida). El warning de seña > 50% se
 *    valida en el cliente (es un soft warning, no bloquea).
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
    if (c.hitoCobro) {
      if (!Object.values(HitoCobro).includes(c.hitoCobro)) {
        throw badRequest("CUOTA_HITO_INVALID", `Momento de cobro inválido para "${c.descripcion}".`);
      }
    } else if (!c.fechaPrevista || !/^\d{4}-\d{2}-\d{2}$/.test(c.fechaPrevista)) {
      throw badRequest(
        "CUOTA_FECHA_INVALID",
        `"${c.descripcion}" necesita una fecha o un momento de la obra.`,
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
  // Solo bloquea si la primera cuota SUPERA el saldo (una cuota única igual al
  // saldo es válida: el plan de un solo pago por el total pendiente).
  const senia = cuotas[0];
  if (senia.monto > saldoPendiente + SUM_TOLERANCE_USD) {
    throw badRequest(
      "SENIA_GTE_SALDO",
      `La seña (USD ${senia.monto.toFixed(2)}) no puede ser mayor al saldo pendiente (USD ${saldoPendiente.toFixed(2)}).`,
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
      // Atada a un momento: no tiene fecha (dueDate null). `fecha` es obligatoria
      // en la tabla y queda la de creación; al cobrarla se reemplaza por la del cobro.
      const hitoCobro = cuota.hitoCobro ?? null;
      const fecha = hitoCobro ? todayUtc() : new Date(`${cuota.fechaPrevista}T00:00:00.000Z`);
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
          dueDate: hitoCobro ? null : fecha,
          hitoCobro,
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

  // El ítem "Plan de pagos creado" de la subetapa de modalidad de pago se marca
  // solo: el plan ya existe, no hace falta que además alguien lo tilde.
  await completarPorEvidencia(projectId, EVIDENCIA_PLAN_PAGOS, userId).catch(() => undefined);

  return {
    created: result.createdRows.length,
    replaced: result.existingCount,
    cuotas: result.createdRows.map((m) => toCuotaOutput(m)),
  };
}

/**
 * Con financiación bancaria el banco paga todo junto: el plan pasa a ser una
 * sola cuota "Financiación bancaria" por lo que falta cobrar, que se marca
 * pagada cuando entra la plata del banco. Si hay una seña prevista sin cobrar,
 * se respeta. Queda lista para cobrar antes de la obra, que con financiación se
 * agenda recién con el crédito aprobado.
 *
 * No toca un plan que ya tenga la cuota del banco (cargada a mano, p. ej.
 * "Banco BBVA"). Devuelve null si no hay nada que planificar.
 */
export async function planFinanciacionBancaria(projectId: string, userId: string): Promise<CreatePlanResult | null> {
  const project = await prisma.project.findFirst({
    where: { id: projectId, deletedAt: null },
    select: { budgetUsd: true },
  });
  const budget = Number(project?.budgetUsd ?? 0);
  if (budget <= 0) return null;
  const saldo = budget - (await calcularTotalCobradoUsd(projectId));
  if (saldo <= SUM_TOLERANCE_USD) return null;

  const previstos = await prisma.financeMovement.findMany({
    where: {
      projectId,
      tipoMovimiento: TipoMovimiento.INGRESO,
      categoriaPrincipal: CategoriaPrincipal.PROYECTO_ENTRADA,
      status: FinanceMovementStatus.PREVISTO,
      sourceType: MovementSourceType.MANUAL,
      deletedAt: null,
    },
  });
  if (previstos.some((m) => /banco|financiaci/i.test(m.descripcion))) return null;

  const cuotas: PlanCuotaInput[] = [];
  const senia = previstos.find((m) => m.hitoCobro === HitoCobro.SENIA || /^se[ñn]a$/i.test(stripPlanPrefix(m.descripcion).trim()));
  if (senia && Number(senia.monto) < saldo - SUM_TOLERANCE_USD) {
    cuotas.push({
      descripcion: stripPlanPrefix(senia.descripcion),
      monto: Number(senia.monto),
      ...(senia.hitoCobro || !senia.dueDate
        ? { hitoCobro: senia.hitoCobro ?? HitoCobro.SENIA }
        : { fechaPrevista: senia.dueDate.toISOString().slice(0, 10) }),
    });
  }
  const resto = Math.round((saldo - cuotas.reduce((a, c) => a + c.monto, 0)) * 100) / 100;
  cuotas.push({ descripcion: "Financiación bancaria", monto: resto, hitoCobro: HitoCobro.PREVIO_OBRA });
  return createPlanPagos({ projectId, cuotas, userId });
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

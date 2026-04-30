/**
 * Rate limiting del Asistente IA por usuario.
 *
 * Cada usuario tiene un AIRateLimit con:
 *   - queriesPerDay (default 100)
 *   - costUSDPerMonth (default 50)
 *   - enabled (default true)
 *
 * Si no existe registro, se aplica el default. Las queries con status=SUCCESS
 * cuentan para el límite diario; el costo total mensual cuenta TODAS las
 * queries (incluyendo errores, porque el modelo igual cobra los tokens
 * gastados en intentar generar SQL).
 */

import { prisma } from "../lib/prisma.js";

const DEFAULT_QUERIES_PER_DAY = 100;
const DEFAULT_COST_USD_PER_MONTH = 50;

export type RateLimitCheck =
  | { allowed: true; queriesUsedToday: number; costUsedThisMonth: number }
  | { allowed: false; reason: "DISABLED" | "DAILY_LIMIT" | "MONTHLY_COST_LIMIT"; message: string };

export async function checkRateLimit(userId: string): Promise<RateLimitCheck> {
  const limit = await prisma.aIRateLimit.findUnique({ where: { userId } });
  const queriesPerDay = limit?.queriesPerDay ?? DEFAULT_QUERIES_PER_DAY;
  const costUSDPerMonth = Number(limit?.costUSDPerMonth ?? DEFAULT_COST_USD_PER_MONTH);
  const enabled = limit?.enabled ?? true;

  if (!enabled) {
    return { allowed: false, reason: "DISABLED", message: "El asistente IA está deshabilitado para este usuario." };
  }

  const inicioDia = new Date();
  inicioDia.setUTCHours(0, 0, 0, 0);
  const queriesHoy = await prisma.aIQuery.count({
    where: {
      userId,
      createdAt: { gte: inicioDia },
      status: "SUCCESS",
    },
  });
  if (queriesHoy >= queriesPerDay) {
    return {
      allowed: false,
      reason: "DAILY_LIMIT",
      message: `Llegaste al límite diario (${queriesPerDay} consultas). Volvé a intentar mañana.`,
    };
  }

  const inicioMes = new Date();
  inicioMes.setUTCDate(1);
  inicioMes.setUTCHours(0, 0, 0, 0);
  const costAgg = await prisma.aIQuery.aggregate({
    where: { userId, createdAt: { gte: inicioMes } },
    _sum: { costUSD: true },
  });
  const costoMes = Number(costAgg._sum.costUSD ?? 0);
  if (costoMes >= costUSDPerMonth) {
    return {
      allowed: false,
      reason: "MONTHLY_COST_LIMIT",
      message: `Llegaste al límite mensual de costo (USD ${costUSDPerMonth}). Pedile a un super-admin que lo extienda.`,
    };
  }

  return { allowed: true, queriesUsedToday: queriesHoy, costUsedThisMonth: costoMes };
}

import { StageStatus, StageType } from "@prisma/client";

import { prisma } from "../lib/prisma.js";
import { addBusinessDays, signedBusinessDaysBetween, businessDaysBetween } from "../utils/business-days.js";
import { startOfUtcDay, todayUtc } from "../utils/dates.js";

// Umbral (días hábiles restantes) a partir del cual la cuenta regresiva pasa a
// "warning" (amarillo). Verde si falta más; rojo si ya está vencida.
const WARNING_THRESHOLD_DIAS = Number(process.env.STAGE_SLA_WARNING_DIAS) || 2;

export type CountdownStatus = "ok" | "warning" | "overdue";

export interface StageCountdown {
  slaDiasHabiles: number;
  deadline: string; // YYYY-MM-DD
  remainingBusinessDays: number; // negativo = vencido y creciente
  elapsedBusinessDays: number;
  status: CountdownStatus;
}

// Shape mínimo de etapa que necesita el cálculo.
export interface CountdownStageInput {
  name: StageType;
  status: StageStatus;
  actualStartDate: Date | null;
  actualEndDate?: Date | null;
}

// --- Cache corto del mapa de SLAs (mismo patrón que el cache de permisos) ---
let slaCache: Map<StageType, number> | null = null;
let slaCacheAt = 0;
const SLA_CACHE_TTL_MS = 5 * 60 * 1000;

export function clearStageSlaCache(): void {
  slaCache = null;
  slaCacheAt = 0;
}

// Devuelve el mapa stageType → días hábiles, solo para SLAs activos.
export async function getSlaMap(): Promise<Map<StageType, number>> {
  const now = Date.now();
  if (slaCache && now - slaCacheAt < SLA_CACHE_TTL_MS) {
    return slaCache;
  }
  const rows = await prisma.stageSla.findMany({ where: { activo: true } });
  const map = new Map<StageType, number>();
  for (const r of rows) {
    if (r.diasHabiles > 0) map.set(r.stageType, r.diasHabiles);
  }
  slaCache = map;
  slaCacheAt = now;
  return map;
}

function toDateStr(d: Date): string {
  return d.toISOString().slice(0, 10);
}

// Calcula la cuenta regresiva de una etapa contra su SLA.
// Devuelve null si: no hay SLA activo para ese tipo, o la etapa no arrancó.
// Para etapas COMPLETED se calcula igual (elapsed = start→end) para saber si
// cumplió el plazo; para etapas en curso, elapsed = start→hoy.
export function computeStageCountdown(
  stage: CountdownStageInput,
  slaDias: number | undefined,
): StageCountdown | null {
  if (!slaDias || slaDias <= 0) return null;
  if (!stage.actualStartDate) return null;

  const start = startOfUtcDay(stage.actualStartDate);
  const deadline = addBusinessDays(start, slaDias);

  const isCompleted = stage.status === StageStatus.COMPLETED && !!stage.actualEndDate;
  const reference = isCompleted ? startOfUtcDay(stage.actualEndDate as Date) : todayUtc();

  const elapsedBusinessDays = businessDaysBetween(start, reference);
  const remainingBusinessDays = signedBusinessDaysBetween(reference, deadline);

  let status: CountdownStatus;
  if (remainingBusinessDays < 0) status = "overdue";
  else if (remainingBusinessDays <= WARNING_THRESHOLD_DIAS) status = "warning";
  else status = "ok";

  return {
    slaDiasHabiles: slaDias,
    deadline: toDateStr(deadline),
    remainingBusinessDays,
    elapsedBusinessDays,
    status,
  };
}

// Helper para list/detail: dado un stage y el mapa, devuelve el countdown o null.
export function countdownForStage(
  stage: CountdownStageInput,
  slaMap: Map<StageType, number>,
): StageCountdown | null {
  return computeStageCountdown(stage, slaMap.get(stage.name));
}

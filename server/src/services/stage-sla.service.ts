import { StageStatus, StageType } from "@prisma/client";

import { prisma } from "../lib/prisma.js";
import { isParallelStage } from "./pipeline-definitions.js";
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

// Fecha de handoff: cuándo la etapa actual pasó a ser la etapa vigente, aunque
// todavía no tenga actualStartDate propio. Es la fecha de cierre (actualEndDate)
// de la última etapa lineal COMPLETED anterior en el orden. Sirve para que, al
// resolver una etapa, la cuenta regresiva de la siguiente arranque de inmediato
// (desde el handoff) en vez de desaparecer hasta que alguien toque una subtarea.
export function handoffStart(
  target: { order: number },
  allStages: Array<{
    name: StageType;
    order: number;
    status: StageStatus;
    actualEndDate: Date | null;
  }>,
  projectStart?: Date | null,
): Date | null {
  let best: Date | null = null;
  let hadPriorLinear = false;
  for (const s of allStages) {
    if (isParallelStage(s.name)) continue;
    if (s.order >= target.order) continue;
    hadPriorLinear = true;
    // Sólo la etapa "frontera" (todas las lineales previas COMPLETED) hereda el
    // handoff. Si alguna previa no está cerrada, `target` es una etapa futura y
    // no debe mostrar cuenta corriendo.
    if (s.status !== StageStatus.COMPLETED) return null;
    if (s.actualEndDate && (!best || s.actualEndDate > best)) best = s.actualEndDate;
  }
  if (best) return best;
  // Primera etapa (sin etapa previa): la cuenta arranca en la fecha de inicio
  // del proyecto, así ONBOARDING muestra su contador desde el día uno.
  if (!hadPriorLinear) return projectStart ?? null;
  return null;
}

// Calcula la cuenta regresiva de una etapa contra su SLA.
// Devuelve null si: no hay SLA activo para ese tipo, o no hay fecha de arranque
// (ni actualStartDate propio ni handoff de la etapa previa).
// Para etapas COMPLETED se calcula igual (elapsed = start→end) para saber si
// cumplió el plazo; para etapas en curso, elapsed = start→hoy.
export function computeStageCountdown(
  stage: CountdownStageInput,
  slaDias: number | undefined,
  fallbackStart?: Date | null,
): StageCountdown | null {
  if (!slaDias || slaDias <= 0) return null;
  const startSource = stage.actualStartDate ?? fallbackStart ?? null;
  if (!startSource) return null;

  const start = startOfUtcDay(startSource);
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
  fallbackStart?: Date | null,
): StageCountdown | null {
  return computeStageCountdown(stage, slaMap.get(stage.name), fallbackStart);
}

// Panel de ventas · Embudo & SLA (dentro del Dashboard). Piezas de cálculo
// compartidas por los endpoints /ventas/*. Gemelo del panel de operaciones:
// mide el embudo comercial por pares de hitos del lead y reutiliza el motor de
// días hábiles (utils/business-days) y el semáforo (mismos umbrales que
// stage-sla.service). No recalcula fechas por su cuenta.

import { SalesFunnelStep, SalesStage } from "@prisma/client";

import { prisma } from "../lib/prisma.js";
import { addBusinessDays, businessDaysBetween, signedBusinessDaysBetween } from "../utils/business-days.js";
import { startOfUtcDay, todayUtc } from "../utils/dates.js";
import type { CountdownStatus } from "./stage-sla.service.js";

// Mismo umbral que stage-sla.service (no exportado allá): días hábiles restantes
// a partir de los cuales la cuenta pasa a "warning".
const WARNING_THRESHOLD_DIAS = Number(process.env.STAGE_SLA_WARNING_DIAS) || 2;

// ── Definición de los 5 tramos (orden del embudo) ──────────────────────────────
export const FUNNEL_STEPS: SalesFunnelStep[] = [
  SalesFunnelStep.LEAD_TO_QUOTE,
  SalesFunnelStep.QUOTE_TO_SCHEDULED,
  SalesFunnelStep.SCHEDULED_TO_VISIT,
  SalesFunnelStep.VISIT_TO_CLOSE,
  SalesFunnelStep.CLOSE_TO_PROJECT,
];

export const STEP_LABEL: Record<SalesFunnelStep, string> = {
  [SalesFunnelStep.LEAD_TO_QUOTE]: "Lead → Cotización",
  [SalesFunnelStep.QUOTE_TO_SCHEDULED]: "Cotización → Visita agendada",
  [SalesFunnelStep.SCHEDULED_TO_VISIT]: "Agendada → Visita realizada",
  [SalesFunnelStep.VISIT_TO_CLOSE]: "Visita → Cierre ganado",
  [SalesFunnelStep.CLOSE_TO_PROJECT]: "Cierre ganado → Proyecto",
};

// ── Cache corto del mapa de SLAs de ventas (mismo patrón que getSlaMap) ─────────
let slaCache: Map<SalesFunnelStep, number> | null = null;
let slaCacheAt = 0;
const SLA_CACHE_TTL_MS = 5 * 60 * 1000;

export function clearSalesSlaCache(): void {
  slaCache = null;
  slaCacheAt = 0;
}

// Mapa step → días hábiles objetivo, solo para SLAs activos.
export async function getSalesSlaMap(): Promise<Map<SalesFunnelStep, number>> {
  const now = Date.now();
  if (slaCache && now - slaCacheAt < SLA_CACHE_TTL_MS) return slaCache;
  const rows = await prisma.salesStageSla.findMany({ where: { activo: true } });
  const map = new Map<SalesFunnelStep, number>();
  for (const r of rows) {
    if (r.diasHabiles > 0) map.set(r.step, r.diasHabiles);
  }
  slaCache = map;
  slaCacheAt = now;
  return map;
}

// ── Hitos del lead + tramo en curso ────────────────────────────────────────────
export interface LeadTimes {
  stage: SalesStage;
  leadCreatedAt: Date | null;
  createdAt: Date;
  proposalSentAt: Date | null;
  visitScheduledAt: Date | null;
  visitCompletedAt: Date | null;
  closedAt: Date | null;
  convertedAt: Date | null;
}

// ¿Qué tramo está EN CURSO ahora mismo para este lead? Devuelve el tramo y la
// fecha desde la cual corre. Null si el lead ya salió del embudo (perdido,
// convertido a proyecto, o sin fecha de arranque).
export function currentStep(lead: LeadTimes): { step: SalesFunnelStep; since: Date } | null {
  if (lead.stage === SalesStage.CERRADO_PERDIDO) return null;
  if (lead.convertedAt) return null; // ya es proyecto: tramo 5 cerrado

  const inicioComercial = lead.leadCreatedAt ?? lead.createdAt;

  if (!lead.proposalSentAt) return { step: SalesFunnelStep.LEAD_TO_QUOTE, since: inicioComercial };
  if (!lead.visitScheduledAt) return { step: SalesFunnelStep.QUOTE_TO_SCHEDULED, since: lead.proposalSentAt };
  if (!lead.visitCompletedAt) return { step: SalesFunnelStep.SCHEDULED_TO_VISIT, since: lead.visitScheduledAt };
  // Visita hecha. Si todavía no está ganado, corre "Visita → Cierre".
  if (lead.stage !== SalesStage.CERRADO_GANADO || !lead.closedAt) {
    return { step: SalesFunnelStep.VISIT_TO_CLOSE, since: lead.visitCompletedAt };
  }
  // Ganado pero sin convertir aún: corre "Cierre → Proyecto".
  return { step: SalesFunnelStep.CLOSE_TO_PROJECT, since: lead.closedAt };
}

// ── Countdown de un tramo contra su SLA (días hábiles) ──────────────────────────
export interface StepCountdown {
  slaDiasHabiles: number;
  remainingBusinessDays: number; // negativo = vencido
  elapsedBusinessDays: number;
  status: CountdownStatus;
}

// `end` = fecha de cierre del tramo (histórico) o undefined/null para "en curso"
// (elapsed hasta hoy). Devuelve null si no hay SLA activo para el tramo.
export function computeStepCountdown(
  since: Date,
  slaDias: number | undefined,
  end?: Date | null,
): StepCountdown | null {
  if (!slaDias || slaDias <= 0) return null;
  const start = startOfUtcDay(since);
  const deadline = addBusinessDays(start, slaDias);
  const reference = end ? startOfUtcDay(end) : todayUtc();
  const elapsedBusinessDays = businessDaysBetween(start, reference);
  const remainingBusinessDays = signedBusinessDaysBetween(reference, deadline);
  let status: CountdownStatus;
  if (remainingBusinessDays < 0) status = "overdue";
  else if (remainingBusinessDays <= WARNING_THRESHOLD_DIAS) status = "warning";
  else status = "ok";
  return { slaDiasHabiles: slaDias, remainingBusinessDays, elapsedBusinessDays, status };
}

// ── Visibilidad: quién ve el embudo completo vs. solo sus leads ─────────────────
// Gerencia comercial + admin ven todo; el asesor solo los leads que tiene
// asignados (assignedToId). Mismo criterio de "visión total" que el panel de ops
// (que lo ve gerencia), pero acá además filtramos por dueño para el asesor.
export function puedeVerTodoElEmbudo(role: string): boolean {
  return role === "ADMIN" || role === "GERENTE_COMERCIAL";
}

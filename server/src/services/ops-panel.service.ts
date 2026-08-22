// Panel de operaciones · Tiempos & SLA (dentro del Dashboard).
// Piezas de cálculo compartidas por los endpoints /ops/*. Reutiliza el motor de
// SLA por etapa (stage-sla.service) y el mapeo de recorrido (clientes) — no
// recalcula nada por su cuenta.

import { StageType, type StageStatus } from "@prisma/client";

import { prisma } from "../lib/prisma.js";
import { RECORRIDO_BY_STAGE, type ClienteRecorrido } from "./clientes/index.js";
import { UTE_ACTION_KEYS, participatesInTiming, isOurAction, type UteActionKey } from "./uteProcess.service.js";

// ── Cache corto del mapa de cadencias por recorrido (mismo patrón que getSlaMap) ──
let cadenciaCache: Map<string, number> | null = null;
let cadenciaCacheAt = 0;
const CADENCIA_CACHE_TTL_MS = 5 * 60 * 1000;

export function clearCadenciaCache(): void {
  cadenciaCache = null;
  cadenciaCacheAt = 0;
}

// Mapa recorrido ("E1"|"E2"|"E3") → días calendario objetivo, solo activos.
export async function getCadenciaMap(): Promise<Map<string, number>> {
  const now = Date.now();
  if (cadenciaCache && now - cadenciaCacheAt < CADENCIA_CACHE_TTL_MS) {
    return cadenciaCache;
  }
  const rows = await prisma.recorridoCadencia.findMany({ where: { activo: true } });
  const map = new Map<string, number>();
  for (const r of rows) {
    if (r.diasObjetivo > 0) map.set(r.recorrido, r.diasObjetivo);
  }
  cadenciaCache = map;
  cadenciaCacheAt = now;
  return map;
}

// Recorrido del cliente: override manual del proyecto si existe, si no el
// derivado de la etapa mostrada. Fallback E1.
export function recorridoForProject(
  displayStageName: StageType | null | undefined,
  recorridoManual: string | null | undefined,
): ClienteRecorrido {
  if (recorridoManual === "E1" || recorridoManual === "E2" || recorridoManual === "E3") {
    return recorridoManual;
  }
  if (displayStageName && RECORRIDO_BY_STAGE[displayStageName]) {
    return RECORRIDO_BY_STAGE[displayStageName];
  }
  return "E1";
}

// Shape mínimo de etapa para los cálculos del panel.
export interface OpsStageShape {
  name: StageType;
  order: number;
  status: StageStatus;
  actualStartDate: Date | null;
  actualEndDate: Date | null;
}

// "¿Quién tiene el turno ahora?" de un trámite UTE no finalizado, según la última
// acción registrada (misma regla del "tail" de calculateTimes): si la última fue
// nuestra (un "enviar") → esperamos a UTE; si fue de UTE (una aprobación) → nos
// toca a nosotros. Devuelve null si el trámite ya está finalizado o sin acciones.
export type WaitingParty = "US" | "UTE";
export function waitingParty(
  process: Record<UteActionKey, Date | null>,
  finalizedAt: Date | null,
): WaitingParty | null {
  if (finalizedAt) return null;
  let last: { key: UteActionKey; date: Date } | null = null;
  for (const key of UTE_ACTION_KEYS) {
    if (!participatesInTiming(key)) continue;
    const d = process[key];
    if (d && (!last || d.getTime() > last.date.getTime())) last = { key, date: d };
  }
  if (!last) return null;
  return isOurAction(last.key) ? "UTE" : "US";
}

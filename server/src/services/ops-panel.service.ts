// Panel de operaciones · Tiempos & SLA (dentro del Dashboard).
// Piezas de cálculo compartidas por los endpoints /ops/*. Reutiliza el motor de
// SLA por etapa (stage-sla.service) y el mapeo de recorrido (clientes) — no
// recalcula nada por su cuenta.

import { ProjectStatus, StageStatus, StageType, UteStatus } from "@prisma/client";

import { prisma } from "../lib/prisma.js";
import { businessDaysBetween } from "../utils/business-days.js";
import { diffInDays, startOfUtcDay, todayUtc } from "../utils/dates.js";
import { decimalToNumber } from "../utils/serialization.js";
import { RECORRIDO_BY_STAGE, type ClienteRecorrido } from "./clientes/index.js";
import { PIPELINE_DEFINITIONS, getStageLabel, isParallelStage } from "./pipeline-definitions.js";
import { getDisplayStage } from "./project.service.js";
import { countdownForStage, currentStageStart, getSlaMap, type StageCountdown } from "./stage-sla.service.js";
import {
  UTE_ACTION_KEYS,
  calculateTimes,
  participatesInTiming,
  isOurAction,
  type UteActionKey,
} from "./uteProcess.service.js";

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

// ─── Etapa actual y su vencimiento ────────────────────────────────────────────
//
// Lo que sigue estaba dentro de los endpoints /ops/* de api.routes.ts. Vive
// acá para que el dashboard y el conector MCP usen exactamente la misma cuenta.

// Shape común de proyecto activo con sus etapas para el cálculo del panel.
export const OPS_STAGE_SELECT = {
  id: true, name: true, order: true, status: true, actualStartDate: true, actualEndDate: true,
} as const;

/**
 * Etapa que se muestra como actual y su cuenta regresiva contra el plazo. La
 * cuenta arranca cuando la etapa se recibió (cierre de la etapa previa); si no
 * hay, la fecha de venta, de inicio o de alta del proyecto. Es el mismo cálculo
 * del listado de proyectos y del panel de operaciones.
 */
export function vencimientoEtapaActual<
  S extends { name: StageType; order: number; status: StageStatus; actualStartDate: Date | null; actualEndDate: Date | null },
>(
  p: { stages: S[]; stageOverride: StageType | null; saleDate: Date | null; startDate: Date | null; createdAt: Date },
  slaMap: Map<StageType, number>,
): { etapa: S | null; countdown: StageCountdown | null } {
  const etapa = getDisplayStage(p.stages, p.stageOverride) as S | null;
  if (!etapa) return { etapa: null, countdown: null };
  const countdown = countdownForStage(
    etapa, slaMap,
    currentStageStart(etapa, p.stages, p.saleDate ?? p.startDate ?? p.createdAt),
  );
  return { etapa, countdown };
}

export interface FilaControlEtapa {
  id: string;
  code: string;
  clientName: string;
  etapa: StageType | null;
  etapaLabel: string | null;
  responsable: string | null;
  countdown: StageCountdown | null;
}

/**
 * Todas las obras en curso con su etapa actual y el vencimiento. Mismo universo
 * que el KPI "En riesgo ahora" del dashboard: proyectos activos, sin los
 * cargados por planilla ni los omitidos de métricas.
 */
export async function controlEtapas(): Promise<FilaControlEtapa[]> {
  const projects = await prisma.project.findMany({
    where: { deletedAt: null, importedFromCsv: false, excludedFromMetrics: false, status: ProjectStatus.ACTIVE },
    select: {
      id: true, code: true, clientName: true, saleDate: true, startDate: true, createdAt: true, stageOverride: true,
      stages: {
        select: { ...OPS_STAGE_SELECT, responsibleName: true, responsibleUser: { select: { name: true } } },
        orderBy: { order: "asc" },
      },
    },
  });
  const slaMap = await getSlaMap();
  return projects.map((p) => {
    const { etapa, countdown } = vencimientoEtapaActual(p, slaMap);
    return {
      id: p.id,
      code: p.code,
      clientName: p.clientName,
      etapa: etapa?.name ?? null,
      etapaLabel: etapa ? getStageLabel(etapa.name) : null,
      responsable: etapa ? (etapa.responsibleUser?.name ?? etapa.responsibleName ?? null) : null,
      countdown,
    };
  });
}

// KPI "En riesgo ahora": estado del countdown de la etapa actual de cada
// proyecto ACTIVE. Cuenta ok/warning/overdue; los que no tienen SLA activo en
// su etapa quedan aparte (sinSla).
export async function resumenRiesgo() {
  const filas = await controlEtapas();
  let ok = 0, warning = 0, overdue = 0, sinSla = 0;
  for (const f of filas) {
    const cd = f.countdown;
    if (!cd) { sinSla++; continue; }
    if (cd.status === "overdue") overdue++;
    else if (cd.status === "warning") warning++;
    else ok++;
  }
  return { ok, warning, overdue, sinSla, total: ok + warning + overdue };
}

// "Sin fecha de instalación": proyectos vendidos, no terminales y sin agenda
// de obra activa, ordenados por días (calendario) desde la venta, más demorado
// primero. El semáforo de cada fila = estado de la etapa actual (motor SLA).
export async function obrasSinFechaInstalacion() {
  const projects = await prisma.project.findMany({
    where: {
      deletedAt: null, importedFromCsv: false, excludedFromMetrics: false,
      status: { notIn: [ProjectStatus.COMPLETED, ProjectStatus.ARCHIVED] },
      NOT: { installationSchedule: { deletedAt: null } },
      saleDate: { not: null },
    },
    select: {
      id: true, code: true, clientName: true, locationCity: true, capacityKwp: true,
      saleDate: true, startDate: true, createdAt: true, stageOverride: true,
      stages: { select: OPS_STAGE_SELECT, orderBy: { order: "asc" } },
    },
  });
  const slaMap = await getSlaMap();
  const now = todayUtc();
  const rows = projects.map((p) => {
    const displayStage = getDisplayStage(p.stages, p.stageOverride);
    const cd = displayStage
      ? countdownForStage(displayStage, slaMap, currentStageStart(displayStage, p.stages, p.saleDate ?? p.startDate ?? p.createdAt))
      : null;
    return {
      id: p.id,
      code: p.code,
      clientName: p.clientName,
      locationCity: p.locationCity,
      capacityKwp: decimalToNumber(p.capacityKwp),
      diasDesdeVenta: p.saleDate ? diffInDays(p.saleDate, now) : 0,
      stageLabel: displayStage ? getStageLabel(displayStage.name) : null,
      status: cd?.status ?? null, // ok | warning | overdue | null
    };
  });
  rows.sort((a, b) => b.diasDesdeVenta - a.diasDesdeVenta);
  return { rows };
}

// "Sin comunicación hace X días": última interacción registrada vs. cadencia
// objetivo del recorrido (E1/E2/E3, configurable en Admin). Devuelve los que
// superan el objetivo (o nunca tuvieron contacto), ordenados por atraso.
export async function clientesSinComunicacion() {
  // Incluye COMPLETED y los importados por planilla a propósito: la cartera de
  // post-habilitación vive justamente ahí, y excluirla dejaba a E3 invisible —
  // que es donde más fácil se pierde el contacto, porque el cliente ya no
  // espera nada. `excludedFromMetrics` sí se respeta (son bajas explícitas).
  const projects = await prisma.project.findMany({
    where: {
      deletedAt: null,
      excludedFromMetrics: false,
      status: { in: [ProjectStatus.ACTIVE, ProjectStatus.COMPLETED] },
    },
    select: {
      id: true, code: true, clientName: true, recorridoManual: true, stageOverride: true,
      stages: { select: OPS_STAGE_SELECT, orderBy: { order: "asc" } },
    },
  });
  const cadenciaMap = await getCadenciaMap();
  const now = todayUtc();
  // Última interacción no borrada por proyecto en una sola query.
  const lastByProject = new Map<string, Date>();
  if (projects.length > 0) {
    const grouped = await prisma.clientInteraction.groupBy({
      by: ["projectId"],
      where: { deletedAt: null, projectId: { in: projects.map((p) => p.id) } },
      _max: { createdAt: true },
    });
    for (const g of grouped) {
      if (g._max.createdAt) lastByProject.set(g.projectId, g._max.createdAt);
    }
  }
  const rows = projects
    .map((p) => {
      const displayStage = getDisplayStage(p.stages, p.stageOverride);
      const recorrido = recorridoForProject(displayStage?.name ?? null, p.recorridoManual);
      const objetivo = cadenciaMap.get(recorrido) ?? null;
      const last = lastByProject.get(p.id) ?? null;
      const diasSinContacto = last ? diffInDays(last, now) : null;
      return {
        id: p.id,
        code: p.code,
        clientName: p.clientName,
        recorrido,
        stageLabel: displayStage ? getStageLabel(displayStage.name) : null,
        cadenciaObjetivo: objetivo,
        diasSinContacto,
        ultimoContactoEn: last ? last.toISOString() : null,
        atraso: objetivo == null ? null : diasSinContacto == null ? Infinity : diasSinContacto - objetivo,
      };
    })
    // Solo los que tienen objetivo definido Y lo superan (o nunca contactados).
    .filter((r) => r.cadenciaObjetivo != null && r.atraso != null && (r.atraso as number) > 0)
    .sort((a, b) => (b.atraso as number) - (a.atraso as number))
    // Infinity no serializa a JSON: los "sin contacto" van con atraso=null +bandera.
    .map((r) => ({ ...r, atraso: r.atraso === Infinity ? null : r.atraso, sinContacto: r.diasSinContacto == null }));
  return { rows };
}

// "¿Dónde se rompe el proceso?": promedio real + % cumplimiento por etapa
// (histórico de etapas COMPLETED) + el cliente ACTIVE más trabado en cada
// etapa (peor countdown ahora mismo).
export async function procesoPorEtapa() {
  const STAGES_EXCL: StageType[] = [StageType.POSTVENTA, StageType.POST_HABILITACION];
  const slaMap = await getSlaMap();

  // (a) Duración histórica + cumplimiento por etapa (mismo criterio que /metrics/stages).
  const completed = await prisma.stage.findMany({
    where: {
      project: { deletedAt: null, excludedFromMetrics: false },
      status: StageStatus.COMPLETED,
      name: { notIn: STAGES_EXCL },
    },
    select: { name: true, actualStartDate: true, actualEndDate: true },
  });
  const byStage = new Map<StageType, { durations: number[]; within: number; over: number; slaObs: number }>();
  for (const s of completed) {
    if (s.actualStartDate == null || s.actualEndDate == null) continue;
    const bucket = byStage.get(s.name) ?? { durations: [], within: 0, over: 0, slaObs: 0 };
    const dias = Math.round((s.actualEndDate.getTime() - s.actualStartDate.getTime()) / 86_400_000);
    if (dias >= 0) bucket.durations.push(dias);
    const sla = slaMap.get(s.name);
    if (sla) {
      const biz = businessDaysBetween(startOfUtcDay(s.actualStartDate), startOfUtcDay(s.actualEndDate));
      bucket.slaObs++;
      if (biz - sla <= 0) bucket.within++; else bucket.over++;
    }
    byStage.set(s.name, bucket);
  }

  // (b) Cliente ACTIVE más trabado por etapa (peor countdown = menor remaining).
  const activos = await prisma.project.findMany({
    where: { deletedAt: null, importedFromCsv: false, excludedFromMetrics: false, status: ProjectStatus.ACTIVE },
    select: {
      id: true, code: true, clientName: true, saleDate: true, startDate: true, createdAt: true, stageOverride: true,
      stages: { select: OPS_STAGE_SELECT, orderBy: { order: "asc" } },
    },
  });
  const worstByStage = new Map<StageType, { clientName: string; code: string; remaining: number; elapsed: number }>();
  for (const p of activos) {
    const displayStage = getDisplayStage(p.stages, p.stageOverride);
    if (!displayStage) continue;
    const cd = countdownForStage(displayStage, slaMap, currentStageStart(displayStage, p.stages, p.saleDate ?? p.startDate ?? p.createdAt));
    if (!cd) continue;
    const cur = worstByStage.get(displayStage.name);
    if (!cur || cd.remainingBusinessDays < cur.remaining) {
      worstByStage.set(displayStage.name, {
        clientName: p.clientName, code: p.code,
        remaining: cd.remainingBusinessDays, elapsed: cd.elapsedBusinessDays,
      });
    }
  }

  // Orden canónico del pipeline expandido (excluye POST_HABILITACION y paralelas).
  const orderedStageNames = PIPELINE_DEFINITIONS.map((d) => d.name).filter(
    (name) => !STAGES_EXCL.includes(name) && !isParallelStage(name),
  );
  const stages = orderedStageNames
    .map((name) => {
      const b = byStage.get(name);
      const durations = b?.durations ?? [];
      const avgDias = durations.length > 0
        ? Number((durations.reduce((s, d) => s + d, 0) / durations.length).toFixed(1))
        : null;
      const slaObs = b?.slaObs ?? 0;
      const worst = worstByStage.get(name);
      return {
        stageName: name,
        stageLabel: getStageLabel(name),
        slaDiasHabiles: slaMap.get(name) ?? null,
        avgDias,
        completedCount: durations.length,
        complianceRate: slaObs > 0 ? Math.round((b!.within / slaObs) * 100) : null,
        masTrabado: worst
          ? { clientName: worst.clientName, code: worst.code, elapsedBusinessDays: worst.elapsed, remainingBusinessDays: worst.remaining }
          : null,
      };
    })
    // Solo etapas con señal real (histórico o alguien trabado ahora).
    .filter((s) => s.completedCount > 0 || s.masTrabado != null);

  return { stages };
}

// Banda UTE del panel: (a) sin habilitar por demora desde la venta, (b) reparto
// de espera nosotros vs UTE + promedios, (c) promedio de respuesta de UTE por
// sub-etapa. Reutiliza calculateTimes / waitingParty (motor UTE).
export async function panelUte() {
  const now = todayUtc();
  const processes = await prisma.uteProcess.findMany({
    where: { deletedAt: null, project: { deletedAt: null, importedFromCsv: false, excludedFromMetrics: false } },
    include: { project: { select: { id: true, code: true, clientName: true, saleDate: true, createdAt: true } } },
  });
  const activos = processes.filter((p) => p.finalizedAt == null && p.currentStatus !== UteStatus.CERRADO);
  const avg = (nums: number[]) => (nums.length ? Math.round((nums.reduce((s, n) => s + n, 0) / nums.length) * 10) / 10 : null);

  // (a) Sin habilitar, ordenado por días desde la venta (calendario).
  const sinHabilitar = activos
    .map((p) => {
      const base = p.project.saleDate ?? p.project.createdAt;
      return {
        id: p.project.id,
        code: p.project.code,
        clientName: p.project.clientName,
        diasDesdeVenta: base ? diffInDays(base, now) : 0,
        subEtapa: p.currentStage, // enum UteStage; label en el front
        esperandoA: waitingParty(p, p.finalizedAt), // "US" | "UTE" | null
      };
    })
    .sort((a, b) => b.diasDesdeVenta - a.diasDesdeVenta);

  // (b) Reparto de espera + promedios nuestro vs UTE (sobre activos).
  let esperandoNosotros = 0;
  let esperandoUTE = 0;
  for (const p of activos) {
    const w = waitingParty(p, p.finalizedAt);
    if (w === "US") esperandoNosotros++;
    else if (w === "UTE") esperandoUTE++;
  }
  const timesActivos = activos.map((p) => calculateTimes(p, now));
  const reparto = {
    esperandoNosotros,
    esperandoUTE,
    totalActivos: activos.length,
    avgOurDays: avg(timesActivos.map((t) => t.ourTimeDays)),
    avgUteDays: avg(timesActivos.map((t) => t.uteTimeDays)),
    avgTotalDays: avg(timesActivos.map((t) => t.totalDays)),
  };

  // (c) Promedio de respuesta de UTE por sub-etapa (par enviada→aprobada),
  // sobre TODOS los procesos con ese par completo.
  const pairDays: Record<string, number[]> = { consulta: [], solicitud: [], docs1: [], ensayos: [], finalizacion: [] };
  for (const p of processes) {
    if (p.consultaSentAt && p.consultaApprovedAt) pairDays.consulta.push(diffInDays(p.consultaSentAt, p.consultaApprovedAt));
    if (p.solicitudSentAt && p.proyectoApprovedAt) pairDays.solicitud.push(diffInDays(p.solicitudSentAt, p.proyectoApprovedAt));
    if (p.docs1SentAt && p.docs1ApprovedAt) pairDays.docs1.push(diffInDays(p.docs1SentAt, p.docs1ApprovedAt));
    if (p.ensayosSentAt && p.ensayosApprovedAt) pairDays.ensayos.push(diffInDays(p.ensayosSentAt, p.ensayosApprovedAt));
    if (p.docs2SentAt && p.finalizedAt) pairDays.finalizacion.push(diffInDays(p.docs2SentAt, p.finalizedAt));
  }
  const SUB_LABEL: Record<string, string> = {
    consulta: "Consulta", solicitud: "Solicitud", docs1: "Documentación 1", ensayos: "Ensayos", finalizacion: "Finalización",
  };
  const promedioPorSubEtapa = Object.keys(pairDays).map((k) => ({
    key: k,
    label: SUB_LABEL[k],
    avgDias: avg(pairDays[k]),
    muestras: pairDays[k].length,
  }));

  return { sinHabilitar, reparto, promedioPorSubEtapa };
}

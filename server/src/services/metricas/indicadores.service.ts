// Indicadores comerciales y de obra sobre un rango de fechas cualquiera.
//
// Es la lógica que antes vivía dentro del reporte semanal por correo (atada a
// "la semana que cerró") y, para las obras, dentro de `GET /metrics/overview`.
// La usan el mail de los lunes, el dashboard y el conector MCP, así que las
// tres cosas cuentan lo mismo con la misma definición.
//
// Definiciones (las mismas del dashboard):
//  - lead nuevo:          `createdAt` en el rango (no `leadCreatedAt`);
//  - propuesta enviada:   `proposalSentAt` en el rango;
//  - visita realizada:    `visitCompletedAt` en el rango;
//  - venta:               etapa CERRADO_GANADO con `closedAt` en el rango;
//  - venta perdida:       etapa CERRADO_PERDIDO con `closedAt` en el rango;
//  - obra realizada:      ver `obrasRealizadasDe()`.
//
// Los rangos son [inicio, fin): el que llama decide en qué hora corta. El mail
// y el conector cortan a medianoche de Uruguay; el dashboard, a medianoche UTC
// (el servidor corre en UTC), que en Uruguay son las 21:00 del día anterior.

import {
  GoalArea,
  GoalMetric,
  GoalPeriod,
  ProjectStatus,
  SalesStage,
  StageStatus,
  StageType,
  TipoMovimiento,
} from "@prisma/client";

import { prisma } from "../../lib/prisma.js";

// ─── Obras realizadas ─────────────────────────────────────────────────────────

export interface ObraRealizada {
  projectId: string;
  clientName: string;
  code: string;
  installedAt: Date;
  capacityKwp: number;
  pesoObra: number;
  /** Generador liviano cargado por planilla (sin obra en el sistema). */
  liviana: boolean;
}

/** Lo mínimo de un proyecto para decidir si es obra realizada y cuándo. */
export interface ProyectoParaObras {
  id: string;
  clientName: string;
  code: string;
  status: ProjectStatus;
  actualEndDate: Date | null;
  plannedEndDate: Date | null;
  capacityKwp: unknown;
  pesoObra: number;
  importedFromCsv: boolean;
  stages: Array<{ name: StageType; status: StageStatus; actualEndDate: Date | null }>;
}

function aNumero(v: unknown): number {
  if (v == null) return 0;
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
}

/**
 * "Obra realizada" (definición del negocio):
 *   1) el proyecto tiene la etapa "Ejecución de obra" FINALIZADA (status
 *      COMPLETED con fecha de fin real), o
 *   2) en su defecto, el proyecto está finalizado (status COMPLETED) aunque la
 *      etapa de obra no figure cerrada.
 * La fecha es la del fin de la obra; si no hay, la de finalización del
 * proyecto. Sin ninguna de las dos no se puede ubicar en un período y no cuenta.
 *
 * Los generadores livianos (cargados por planilla, sin etapas) cuentan como
 * realizados en su fecha de entrega (`plannedEndDate`).
 *
 * Devuelve primero las obras con pipeline y después las livianas: el orden no
 * cambia los conteos, pero sí el redondeo de una suma de kWp, y así se conserva
 * el del dashboard.
 */
export function obrasRealizadasDe(proyectos: ProyectoParaObras[]): ObraRealizada[] {
  const conObra: ObraRealizada[] = [];
  const livianas: ObraRealizada[] = [];
  for (const p of proyectos) {
    const base = {
      projectId: p.id,
      clientName: p.clientName,
      code: p.code,
      capacityKwp: aNumero(p.capacityKwp),
      pesoObra: p.pesoObra,
    };
    if (p.importedFromCsv) {
      if (p.plannedEndDate != null) livianas.push({ ...base, installedAt: p.plannedEndDate, liviana: true });
      continue;
    }
    const ejecObra = p.stages.find(
      (s) => s.name === StageType.EJECUCION_OBRA && s.status === StageStatus.COMPLETED && s.actualEndDate != null,
    );
    const finalizado = p.status === ProjectStatus.COMPLETED;
    if (!ejecObra && !finalizado) continue;
    const installedAt = ejecObra?.actualEndDate ?? p.actualEndDate;
    if (installedAt == null) continue;
    conObra.push({ ...base, installedAt, liviana: false });
  }
  return [...conObra, ...livianas];
}

/** Todas las obras realizadas (proyectos no borrados ni excluidos de métricas). */
export async function listarObrasRealizadas(): Promise<ObraRealizada[]> {
  const proyectos = await prisma.project.findMany({
    where: { deletedAt: null, excludedFromMetrics: false },
    select: {
      id: true,
      clientName: true,
      code: true,
      status: true,
      actualEndDate: true,
      plannedEndDate: true,
      capacityKwp: true,
      pesoObra: true,
      importedFromCsv: true,
      stages: {
        where: { name: StageType.EJECUCION_OBRA },
        orderBy: { order: "asc" },
        select: { name: true, status: true, actualEndDate: true },
      },
    },
  });
  return obrasRealizadasDe(proyectos);
}

export interface ResumenObras {
  count: number;
  kwp: number;
  /** Suma de `pesoObra`: una obra grande puede valer por varias. */
  ponderadas: number;
  items: ObraRealizada[];
}

export function resumenObras(obras: ObraRealizada[], inicio: Date, fin: Date): ResumenObras {
  const items = obras.filter((o) => o.installedAt >= inicio && o.installedAt < fin);
  return {
    count: items.length,
    kwp: Number(items.reduce((s, o) => s + o.capacityKwp, 0).toFixed(2)),
    ponderadas: items.reduce((s, o) => s + o.pesoObra, 0),
    items,
  };
}

// ─── Ventas ───────────────────────────────────────────────────────────────────

/**
 * Monto de la venta, con IVA. El precio es un dato de la **propuesta**, así que
 * se lee de ahí y no de la comisión: primero la propuesta que quedó congelada
 * en la comisión, y si no hay comisión (ventas viejas, o cerradas sin pasar por
 * el modal) la última propuesta publicada del lead. Último recurso: el
 * presupuesto estimado cargado en el lead.
 */
export function montoDeVenta(lead: {
  estimatedBudgetUsd: unknown;
  commission: { proposalVersion: { snapshot: unknown } | null } | null;
  proposalV2Versions: { snapshot: unknown }[];
}): number | null {
  const candidatos = [lead.commission?.proposalVersion?.snapshot, lead.proposalV2Versions[0]?.snapshot];
  for (const snapshot of candidatos) {
    const calc = (snapshot as { calc?: { totalFinalConIva?: number; totalConIva?: number } } | null | undefined)?.calc;
    const total = calc?.totalFinalConIva ?? calc?.totalConIva;
    if (typeof total === "number" && Number.isFinite(total)) return total;
  }
  if (lead.estimatedBudgetUsd != null) {
    const n = Number(lead.estimatedBudgetUsd);
    if (Number.isFinite(n)) return n;
  }
  return null;
}

export interface Venta {
  leadId: string;
  code: string;
  cliente: string;
  asesor: string | null;
  montoUsd: number | null;
  fecha: Date;
}

/** Ventas ganadas en [inicio, fin), de la más vieja a la más nueva. */
export async function ventasGanadas(inicio: Date, fin: Date): Promise<Venta[]> {
  const leads = await prisma.salesLead.findMany({
    where: { deletedAt: null, stage: SalesStage.CERRADO_GANADO, closedAt: { gte: inicio, lt: fin } },
    select: {
      id: true,
      code: true,
      clientName: true,
      closedAt: true,
      estimatedBudgetUsd: true,
      assignedTo: { select: { name: true } },
      commission: { select: { proposalVersion: { select: { snapshot: true } } } },
      // Fallback cuando la venta no tiene comisión congelada: la última
      // propuesta publicada del lead.
      proposalV2Versions: {
        where: { status: "PUBLISHED", discardedAt: null },
        orderBy: { versionNumber: "desc" },
        take: 1,
        select: { snapshot: true },
      },
    },
    orderBy: { closedAt: "asc" },
  });
  return leads.map((l) => ({
    leadId: l.id,
    code: l.code,
    cliente: l.clientName,
    asesor: l.assignedTo?.name ?? null,
    montoUsd: montoDeVenta(l),
    fecha: l.closedAt!,
  }));
}

export interface Visita {
  cliente: string;
  asesor: string | null;
  fecha: Date;
}

/** Visitas comerciales realizadas en [inicio, fin), en orden. */
export async function visitasRealizadas(inicio: Date, fin: Date): Promise<Visita[]> {
  const leads = await prisma.salesLead.findMany({
    where: { deletedAt: null, visitCompletedAt: { gte: inicio, lt: fin } },
    select: { clientName: true, visitCompletedAt: true, assignedTo: { select: { name: true } } },
    orderBy: { visitCompletedAt: "asc" },
  });
  return leads.map((l) => ({ cliente: l.clientName, asesor: l.assignedTo?.name ?? null, fecha: l.visitCompletedAt! }));
}

// ─── Conteos y tiempos del embudo ─────────────────────────────────────────────

export interface ConteosPeriodo {
  leads: number;
  propuestas: number;
  ganados: number;
  instalaciones: number;
  kwp: number;
}

/** Conteos de leads/propuestas/ventas/obras sobre [inicio, fin). */
export async function contarPeriodo(inicio: Date, fin: Date, obras?: ObraRealizada[]): Promise<ConteosPeriodo> {
  const [leads, propuestas, ganados, todas] = await Promise.all([
    prisma.salesLead.count({ where: { deletedAt: null, createdAt: { gte: inicio, lt: fin } } }),
    prisma.salesLead.count({ where: { deletedAt: null, proposalSentAt: { gte: inicio, lt: fin } } }),
    prisma.salesLead.count({
      where: { deletedAt: null, stage: SalesStage.CERRADO_GANADO, closedAt: { gte: inicio, lt: fin } },
    }),
    obras ?? listarObrasRealizadas(),
  ]);
  const o = resumenObras(todas, inicio, fin);
  return { leads, propuestas, ganados, instalaciones: o.count, kwp: o.kwp };
}

export interface LeadFechas {
  createdAt: Date;
  proposalSentAt: Date | null;
  visitCompletedAt: Date | null;
  closedAt: Date | null;
}

/**
 * Días promedio entre dos hitos del lead, sobre los leads cuyo hito final cae
 * en el rango. Redondea cada lead a días enteros y el promedio a un decimal.
 * Es la cuenta de los "tiempos del embudo" del dashboard.
 */
export function promedioDias<L>(
  leads: L[],
  desde: (l: L) => Date | null,
  hasta: (l: L) => Date | null,
  inicio: Date,
  fin: Date,
): number | null {
  const validos = leads.filter((l) => {
    const a = desde(l);
    const b = hasta(l);
    return a && b && b >= a && b >= inicio && b < fin;
  });
  if (validos.length === 0) return null;
  const total = validos.reduce(
    (sum, l) => sum + Math.round((hasta(l)!.getTime() - desde(l)!.getTime()) / 86_400_000),
    0,
  );
  return Number((total / validos.length).toFixed(1));
}

// ─── Indicadores completos de un período (conector) ───────────────────────────

export interface IndicadoresAsesor {
  asesor: string;
  leads: number;
  propuestas: number;
  visitas: number;
  ventas: number;
  montoUsd: number;
  perdidas: number;
}

export interface Indicadores {
  leads: number;
  propuestas: number;
  visitas: Visita[];
  ventas: Venta[];
  facturacionVendidaUsd: number;
  perdidas: number;
  /** Ventas / (ventas + perdidas) cerradas en el período, en %. */
  conversion: number | null;
  tiempos: {
    leadAPropuesta: number | null;
    propuestaAVisita: number | null;
    visitaACierre: number | null;
    propuestaACierre: number | null;
  };
  obras: ResumenObras;
  gastosRegistrados: number;
  porAsesor: IndicadoresAsesor[];
}

export async function indicadoresDelPeriodo(inicio: Date, fin: Date): Promise<Indicadores> {
  const enRango = (d: Date | null) => d != null && d >= inicio && d < fin;

  const [leads, ventas, visitas, obras, gastosRegistrados] = await Promise.all([
    prisma.salesLead.findMany({
      where: { deletedAt: null },
      select: {
        stage: true,
        createdAt: true,
        proposalSentAt: true,
        visitCompletedAt: true,
        closedAt: true,
        assignedTo: { select: { name: true } },
      },
    }),
    ventasGanadas(inicio, fin),
    visitasRealizadas(inicio, fin),
    listarObrasRealizadas(),
    prisma.financeMovement.count({
      where: { deletedAt: null, tipoMovimiento: TipoMovimiento.GASTO, fecha: { gte: inicio, lt: fin } },
    }),
  ]);

  const perdidasLeads = leads.filter((l) => l.stage === SalesStage.CERRADO_PERDIDO && enRango(l.closedAt));
  const cerradas = ventas.length + perdidasLeads.length;

  const porAsesor = new Map<string, IndicadoresAsesor>();
  const de = (nombre: string | null | undefined) => {
    const k = nombre ?? "Sin asignar";
    const a = porAsesor.get(k) ?? { asesor: k, leads: 0, propuestas: 0, visitas: 0, ventas: 0, montoUsd: 0, perdidas: 0 };
    porAsesor.set(k, a);
    return a;
  };
  for (const l of leads) {
    if (enRango(l.createdAt)) de(l.assignedTo?.name).leads++;
    if (enRango(l.proposalSentAt)) de(l.assignedTo?.name).propuestas++;
  }
  for (const l of perdidasLeads) de(l.assignedTo?.name).perdidas++;
  for (const v of visitas) de(v.asesor).visitas++;
  for (const v of ventas) {
    const a = de(v.asesor);
    a.ventas++;
    a.montoUsd += v.montoUsd ?? 0;
  }

  return {
    leads: leads.filter((l) => enRango(l.createdAt)).length,
    propuestas: leads.filter((l) => enRango(l.proposalSentAt)).length,
    visitas,
    ventas,
    facturacionVendidaUsd: Number(ventas.reduce((s, v) => s + (v.montoUsd ?? 0), 0).toFixed(2)),
    perdidas: perdidasLeads.length,
    conversion: cerradas > 0 ? Number(((ventas.length / cerradas) * 100).toFixed(1)) : null,
    tiempos: {
      leadAPropuesta: promedioDias(leads, (l) => l.createdAt, (l) => l.proposalSentAt, inicio, fin),
      propuestaAVisita: promedioDias(leads, (l) => l.proposalSentAt, (l) => l.visitCompletedAt, inicio, fin),
      visitaACierre: promedioDias(leads, (l) => l.visitCompletedAt, (l) => l.closedAt, inicio, fin),
      propuestaACierre: promedioDias(leads, (l) => l.proposalSentAt, (l) => l.closedAt, inicio, fin),
    },
    obras: resumenObras(obras, inicio, fin),
    gastosRegistrados,
    porAsesor: [...porAsesor.values()].sort((a, b) => b.montoUsd - a.montoUsd || b.leads - a.leads),
  };
}

// ─── Metas ────────────────────────────────────────────────────────────────────

export const META_LABEL: Record<string, string> = {
  [GoalMetric.LEADS_CREATED]: "Leads",
  [GoalMetric.PROPOSALS_SENT]: "Propuestas enviadas",
  [GoalMetric.CLOSED_WON]: "Nuevas ventas",
  [GoalMetric.INSTALLATIONS_COUNT]: "Instalaciones",
  [GoalMetric.KWP_INSTALLED]: "kWp instalados",
};

export interface AvanceMeta {
  area: GoalArea;
  metric: GoalMetric;
  period: GoalPeriod;
  quarter: number | null;
  etiqueta: string;
  objetivo: number;
  actual: number;
  /** Porcentaje logrado, entero. */
  porcentaje: number;
  /** Lo logrado va al menos al ritmo del tiempo transcurrido del período. */
  enRitmo: boolean;
}

/** Fracción del período [inicio, fin) transcurrida a `now`, entre 0 y 1. */
export function fraccionTranscurrida(inicio: Date, fin: Date, now: Date): number {
  const total = fin.getTime() - inicio.getTime();
  const transcurrido = Math.min(Math.max(now.getTime() - inicio.getTime(), 0), total);
  return total > 0 ? transcurrido / total : 1;
}

export function valorPorMetrica(c: ConteosPeriodo): Record<string, number> {
  return {
    [GoalMetric.LEADS_CREATED]: c.leads,
    [GoalMetric.PROPOSALS_SENT]: c.propuestas,
    [GoalMetric.CLOSED_WON]: c.ganados,
    [GoalMetric.INSTALLATIONS_COUNT]: c.instalaciones,
    [GoalMetric.KWP_INSTALLED]: c.kwp,
  };
}

/**
 * Avance de las metas cargadas para un año (y, si se pasa, un trimestre): las
 * trimestrales de ese trimestre y las anuales. Cada meta se mide sobre SU
 * período, con los rangos que recibe (`rangoTrimestre`, `rangoAnio`), así el
 * que llama decide la hora de corte.
 */
export async function avanceMetas(opts: {
  anio: number;
  trimestre?: number;
  rangoAnio: { inicio: Date; fin: Date };
  rangoTrimestre?: { inicio: Date; fin: Date };
  now: Date;
}): Promise<AvanceMeta[]> {
  const { anio, trimestre, rangoAnio, rangoTrimestre, now } = opts;
  const goals = await prisma.goal.findMany({
    where: {
      year: anio,
      OR: [
        ...(trimestre ? [{ period: GoalPeriod.QUARTERLY, quarter: trimestre }] : []),
        { period: GoalPeriod.ANNUAL },
      ],
    },
    orderBy: [{ area: "asc" }, { period: "asc" }, { metric: "asc" }],
  });
  if (goals.length === 0) return [];

  const obras = await listarObrasRealizadas();
  const hayTrimestrales = goals.some((g) => g.period === GoalPeriod.QUARTERLY) && rangoTrimestre;
  const [conteoAnio, conteoTrim] = await Promise.all([
    contarPeriodo(rangoAnio.inicio, rangoAnio.fin, obras),
    hayTrimestrales ? contarPeriodo(rangoTrimestre!.inicio, rangoTrimestre!.fin, obras) : null,
  ]);
  const valAnio = valorPorMetrica(conteoAnio);
  const valTrim = conteoTrim ? valorPorMetrica(conteoTrim) : null;

  return goals.map((g) => {
    const trimestral = g.period === GoalPeriod.QUARTERLY && valTrim && rangoTrimestre;
    const rango = trimestral ? rangoTrimestre! : rangoAnio;
    const objetivo = Number(g.targetValue);
    const actual = (trimestral ? valTrim! : valAnio)[g.metric] ?? 0;
    return {
      area: g.area,
      metric: g.metric,
      period: g.period,
      quarter: g.quarter,
      etiqueta: META_LABEL[g.metric] ?? g.metric,
      objetivo,
      actual,
      porcentaje: objetivo > 0 ? Number(((actual / objetivo) * 100).toFixed(0)) : 0,
      enRitmo: objetivo > 0 ? actual / objetivo >= fraccionTranscurrida(rango.inicio, rango.fin, now) : true,
    };
  });
}

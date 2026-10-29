// Cuotas del plan de pagos atadas a un momento de la obra (`hitoCobro`).
//
// No tienen fecha: quedan "listas para cobrar" cuando llega su momento, y eso
// se calcula al pedirlo con el estado del proyecto (no hay nada guardado que
// sincronizar: si la obra se reagenda, la cuota se corre sola).
//
//   SENIA            → desde que se crea el plan
//   PREVIO_OBRA      → DIAS_ANTES_OBRA antes del primer día de obra agendado
//   OBRA_FINALIZADA  → cuando se completa la etapa de ejecución de obra
//   HABILITACION     → cuando se finaliza la habilitación de UTE (el mismo
//                      momento en que se avisa al cliente que puede encender)
//
// Una cuota lista vence DIAS_PARA_VENCER después (para la cuota 1, justo el
// primer día de obra). Para proyectar (flujo de fondos, posición) se usa una
// fecha estimada mientras no está lista; sin obra agendada no hay estimación.

import { HitoCobro, ProjectStatus, StageStatus, StageType } from "@prisma/client";

import { prisma } from "../../lib/prisma.js";
import { todayUtc } from "../../utils/dates.js";

export const DIAS_ANTES_OBRA = 10;
export const DIAS_PARA_VENCER = 10;
// Estimación de la habilitación de UTE para proyectar: un mes después de la obra.
const DIAS_OBRA_A_HABILITACION = 30;

export const HITO_LABEL: Record<HitoCobro, string> = {
  SENIA: "Al firmar",
  PREVIO_OBRA: "Previo a la obra",
  OBRA_FINALIZADA: "Obra finalizada",
  HABILITACION: "Habilitación finalizada",
};

export type HitosProyecto = {
  primerDiaObra: Date | null;
  ultimoDiaObra: Date | null;
  obraTerminadaEn: Date | null;
  habilitadoEn: Date | null;
};

export type InfoCuota = {
  hito: HitoCobro;
  /** Desde cuándo se puede cobrar; null = su momento todavía no tiene fecha. */
  listoDesde: Date | null;
  /** true si listoDesde ya llegó. */
  listo: boolean;
  /** Fecha límite para cobrarla, una vez lista. */
  venceEl: Date | null;
  vencida: boolean;
  /** Cuándo se espera cobrarla: el vencimiento si está lista, si no la estimación (null = sin fecha). */
  fechaEsperada: Date | null;
};

type CuotaMin = { hitoCobro: HitoCobro | null; createdAt: Date; expectedDate?: Date | null; projectId: string | null };

const sumarDias = (d: Date, dias: number) => new Date(d.getTime() + dias * 86_400_000);
const soloDia = (d: Date) => new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));

/** Los momentos de cada proyecto, en una sola tanda de consultas. */
export async function hitosDeProyectos(projectIds: string[]): Promise<Map<string, HitosProyecto>> {
  const ids = [...new Set(projectIds)];
  const res = new Map<string, HitosProyecto>();
  if (!ids.length) return res;
  const [proyectos, agendas, etapas] = await Promise.all([
    prisma.project.findMany({ where: { id: { in: ids } }, select: { id: true, postHabilitacionInicioEn: true } }),
    prisma.installationSchedule.findMany({
      where: { projectId: { in: ids }, deletedAt: null },
      select: { projectId: true, segments: { select: { startDate: true, endDate: true } } },
    }),
    prisma.stage.findMany({
      where: { projectId: { in: ids }, name: StageType.EJECUCION_OBRA, status: StageStatus.COMPLETED },
      select: { projectId: true, actualEndDate: true, updatedAt: true },
    }),
  ]);
  for (const p of proyectos) {
    res.set(p.id, { primerDiaObra: null, ultimoDiaObra: null, obraTerminadaEn: null, habilitadoEn: p.postHabilitacionInicioEn });
  }
  for (const a of agendas) {
    const h = res.get(a.projectId);
    if (!h || !a.segments.length) continue;
    h.primerDiaObra = a.segments.reduce((m, s) => (s.startDate < m ? s.startDate : m), a.segments[0].startDate);
    h.ultimoDiaObra = a.segments.reduce((m, s) => (s.endDate > m ? s.endDate : m), a.segments[0].endDate);
  }
  for (const e of etapas) {
    const h = res.get(e.projectId);
    if (h) h.obraTerminadaEn = e.actualEndDate ?? e.updatedAt;
  }
  return res;
}

/** Estado de una cuota atada a un momento. Null si es una cuota con fecha fija. */
export function infoCuota(c: CuotaMin, hitos: HitosProyecto | undefined, hoy = todayUtc()): InfoCuota | null {
  if (!c.hitoCobro) return null;
  const h = hitos ?? { primerDiaObra: null, ultimoDiaObra: null, obraTerminadaEn: null, habilitadoEn: null };
  let listoDesde: Date | null = null;
  let estimada: Date | null = null;
  switch (c.hitoCobro) {
    case HitoCobro.SENIA:
      listoDesde = c.createdAt;
      break;
    case HitoCobro.PREVIO_OBRA:
      listoDesde = h.primerDiaObra ? sumarDias(h.primerDiaObra, -DIAS_ANTES_OBRA) : null;
      break;
    case HitoCobro.OBRA_FINALIZADA:
      listoDesde = h.obraTerminadaEn;
      estimada = h.ultimoDiaObra;
      break;
    case HitoCobro.HABILITACION:
      listoDesde = h.habilitadoEn;
      estimada = h.ultimoDiaObra ? sumarDias(h.ultimoDiaObra, DIAS_OBRA_A_HABILITACION) : null;
      break;
  }
  if (listoDesde) listoDesde = soloDia(listoDesde);
  const listo = !!listoDesde && listoDesde <= hoy;
  const venceEl = listoDesde ? sumarDias(listoDesde, DIAS_PARA_VENCER) : null;
  return {
    hito: c.hitoCobro,
    listoDesde,
    listo,
    venceEl,
    vencida: listo && !!venceEl && venceEl < hoy,
    // Una fecha puesta a mano en el flujo de fondos manda sobre la estimación.
    fechaEsperada: c.expectedDate ?? (listoDesde ? venceEl : estimada),
  };
}

/**
 * Fecha con la que se ordena y se proyecta un cobro pendiente: la de siempre
 * para las cuotas con fecha fija; la esperada para las atadas a un momento.
 */
export function fechaDeCobro(
  m: CuotaMin & { fecha: Date; dueDate: Date | null; expectedDate: Date | null },
  hitos: Map<string, HitosProyecto>,
  hoy = todayUtc(),
): Date | null {
  if (!m.hitoCobro) return m.dueDate ?? m.expectedDate ?? m.fecha;
  return infoCuota(m, m.projectId ? hitos.get(m.projectId) : undefined, hoy)?.fechaEsperada ?? null;
}

export function serializarInfo(i: InfoCuota | null) {
  if (!i) return null;
  const d = (x: Date | null) => (x ? x.toISOString().slice(0, 10) : null);
  return {
    hito: i.hito,
    hitoLabel: HITO_LABEL[i.hito],
    listo: i.listo,
    vencida: i.vencida,
    listoDesde: d(i.listoDesde),
    venceEl: d(i.venceEl),
    fechaEsperada: d(i.fechaEsperada),
  };
}

/** Cuotas listas para cobrar (y cuántas vencidas), por proyecto. */
export async function cuotasListasPorProyecto(projectIds?: string[]) {
  const cuotas = await prisma.financeMovement.findMany({
    where: {
      deletedAt: null, cobrado: false, hitoCobro: { not: null }, projectId: projectIds ? { in: projectIds } : { not: null },
      status: "PREVISTO",
      // Las ventas caídas (archivadas) y los prospectos no se cobran.
      project: { deletedAt: null, status: { notIn: [ProjectStatus.ARCHIVED, ProjectStatus.PROSPECT] } },
    },
    select: { id: true, projectId: true, hitoCobro: true, createdAt: true, expectedDate: true, monto: true, moneda: true, descripcion: true },
  });
  const hitos = await hitosDeProyectos(cuotas.map((c) => c.projectId!));
  const hoy = todayUtc();
  const porProyecto = new Map<string, { cantidad: number; vencidas: number; montoUsd: number; montoVencidoUsd: number; cuotas: string[] }>();
  for (const c of cuotas) {
    const info = infoCuota(c, hitos.get(c.projectId!), hoy);
    if (!info?.listo) continue;
    const r = porProyecto.get(c.projectId!) ?? { cantidad: 0, vencidas: 0, montoUsd: 0, montoVencidoUsd: 0, cuotas: [] };
    r.cantidad++;
    if (info.vencida) r.vencidas++;
    if (c.moneda === "USD") {
      r.montoUsd += Number(c.monto);
      if (info.vencida) r.montoVencidoUsd += Number(c.monto);
    }
    r.cuotas.push(c.descripcion);
    porProyecto.set(c.projectId!, r);
  }
  return porProyecto;
}

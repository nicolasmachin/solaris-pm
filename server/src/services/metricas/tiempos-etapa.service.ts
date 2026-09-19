// Duración real de cada etapa del pipeline de obra y cumplimiento del plazo.
//
// Extraído de `GET /metrics/stages` para que lo usen el dashboard y el
// conector MCP. Mide todas las etapas COMPLETED con ambas fechas reales, de
// proyectos no borrados ni excluidos de métricas, sin importar el estado del
// proyecto. Post-habilitación queda afuera por ser indefinida.
//
// El rango (opcional) filtra por la fecha en que TERMINÓ la etapa.

import { StageStatus, StageType } from "@prisma/client";

import { prisma } from "../../lib/prisma.js";
import { businessDaysBetween } from "../../utils/business-days.js";
import { startOfUtcDay } from "../../utils/dates.js";
import { getStageLabel } from "../pipeline-definitions.js";
import { getSlaMap } from "../stage-sla.service.js";

export async function tiemposPorEtapa(rango?: { inicio: Date; fin: Date }) {
  const completedStages = await prisma.stage.findMany({
    where: {
      project: { deletedAt: null, excludedFromMetrics: false },
      status: StageStatus.COMPLETED,
      name: { notIn: [StageType.POSTVENTA, StageType.POST_HABILITACION] },
      ...(rango ? { actualEndDate: { gte: rango.inicio, lt: rango.fin } } : {}),
    },
    orderBy: [{ order: "asc" }, { createdAt: "asc" }],
  });

  const grouped = new Map<StageType, typeof completedStages>();
  for (const stage of completedStages) {
    const bucket = grouped.get(stage.name) ?? [];
    bucket.push(stage);
    grouped.set(stage.name, bucket);
  }

  const slaMap = await getSlaMap();

  return (Object.values(StageType) as StageType[])
    .filter((stageName) => stageName !== StageType.POSTVENTA && stageName !== StageType.POST_HABILITACION)
    .map((stageName) => {
      const items = grouped.get(stageName) ?? [];
      const completedCount = items.length;
      // Calculamos duración on-the-fly desde fechas reales. La columna
      // persistida `actualDurationDays` no siempre está populada (legacy),
      // así que la ignoramos y nos basamos en lo que hay en la DB.
      const durations = items
        .filter((s) => s.actualStartDate != null && s.actualEndDate != null)
        .map((s) => {
          const ms = s.actualEndDate!.getTime() - s.actualStartDate!.getTime();
          return Math.round(ms / 86_400_000);
        })
        .filter((d) => d >= 0);
      const avgActualDays =
        durations.length > 0
          ? Number((durations.reduce((s, d) => s + d, 0) / durations.length).toFixed(2))
          : 0;
      const minActualDays = durations.length > 0 ? Math.min(...durations) : 0;
      const maxActualDays = durations.length > 0 ? Math.max(...durations) : 0;

      // Cumplimiento contra el SLA (días hábiles). Solo cuenta las etapas con
      // ambas fechas reales; el desvío es actual(hábiles) - SLA (negativo = a
      // tiempo o antes). complianceRate = % dentro del plazo.
      const slaDiasHabiles = slaMap.get(stageName) ?? null;
      let withinSlaCount = 0;
      let overSlaCount = 0;
      let deltaSum = 0;
      let slaObs = 0;
      if (slaDiasHabiles) {
        for (const s of items) {
          if (s.actualStartDate == null || s.actualEndDate == null) continue;
          const biz = businessDaysBetween(startOfUtcDay(s.actualStartDate), startOfUtcDay(s.actualEndDate));
          const delta = biz - slaDiasHabiles;
          slaObs++;
          deltaSum += delta;
          if (delta <= 0) withinSlaCount++;
          else overSlaCount++;
        }
      }

      return {
        stageName,
        stageLabel: getStageLabel(stageName),
        avgActualDays,
        minActualDays,
        maxActualDays,
        completedCount,
        slaDiasHabiles,
        withinSlaCount,
        overSlaCount,
        complianceRate: slaObs > 0 ? Math.round((withinSlaCount / slaObs) * 100) : null,
        avgDelayBusinessDays: slaObs > 0 ? Number((deltaSum / slaObs).toFixed(1)) : null,
      };
    });
}

export type TiempoEtapa = Awaited<ReturnType<typeof tiemposPorEtapa>>[number];

// Tipo de cambio USD por periodo para los reportes.
//
// El sistema Python usaba un único valor manual ("Dólar = 40" en una celda) y lo
// persistía en cada fila del histórico para que los acumulados en USD no se
// movieran retroactivamente. Voltia PM ya sincroniza la cotización del BCU todos
// los días, así que de acá en más se usa esa.
//
// Decisión tomada con el usuario: los periodos anteriores al arranque del BCU
// (los migrados desde la planilla) quedan congelados en 40, para que el ahorro
// acumulado y el ROI que ya se le comunicaron a cada cliente no cambien.

import { prisma } from "../../lib/prisma.js";
import { periodoADate, type Periodo, ultimoDiaDelPeriodo } from "./periodo.js";

/**
 * Tipo de cambio de los periodos migrados desde la planilla. No tocar: cambiarlo
 * movería el ROI histórico de todos los generadores.
 */
export const TIPO_CAMBIO_LEGACY = 40;

/**
 * Último periodo que usa el valor congelado. Los reportes de junio de 2026 y
 * anteriores son los que ya se emitieron con el sistema Python.
 */
export const ULTIMO_PERIODO_LEGACY: Periodo = "2026-06";

/**
 * Resolutor de tipo de cambio para una corrida. Cachea por periodo: calcular 50
 * clientes × 24 meses no puede disparar 1200 queries.
 *
 * Para cada periodo toma la última cotización del BCU del mes. Si no hay ninguna
 * (por ejemplo un mes anterior a que existiera el job), cae a la más reciente
 * previa; si tampoco hay, al valor legacy.
 */
export async function getTipoCambioResolver(periodos: Periodo[]) {
  const unicos = [...new Set(periodos)].sort();
  const cache = new Map<Periodo, number>();

  const legacy = unicos.filter((p) => p <= ULTIMO_PERIODO_LEGACY);
  for (const p of legacy) cache.set(p, TIPO_CAMBIO_LEGACY);

  const modernos = unicos.filter((p) => p > ULTIMO_PERIODO_LEGACY);
  if (modernos.length > 0) {
    const desde = periodoADate(modernos[0]);
    const hasta = ultimoDiaDelPeriodo(modernos[modernos.length - 1]);

    const cotizaciones = await prisma.exchangeRate.findMany({
      where: { date: { gte: desde, lte: hasta } },
      orderBy: { date: "asc" },
      select: { date: true, usdToUyu: true },
    });

    // Última cotización de cada mes.
    const porPeriodo = new Map<Periodo, number>();
    for (const c of cotizaciones) {
      const p = `${c.date.getUTCFullYear()}-${String(c.date.getUTCMonth() + 1).padStart(2, "0")}`;
      porPeriodo.set(p, Number(c.usdToUyu));
    }

    // Fallback para los meses sin cotización: la última anterior al periodo.
    let anterior: number | null = null;
    for (const p of modernos) {
      const valor = porPeriodo.get(p);
      if (valor != null) {
        anterior = valor;
        cache.set(p, valor);
        continue;
      }
      if (anterior == null) {
        const previa = await prisma.exchangeRate.findFirst({
          where: { date: { lt: periodoADate(p) } },
          orderBy: { date: "desc" },
          select: { usdToUyu: true },
        });
        anterior = previa ? Number(previa.usdToUyu) : TIPO_CAMBIO_LEGACY;
      }
      cache.set(p, anterior);
    }
  }

  return {
    tipoCambioPorPeriodo: (periodo: Periodo): number => cache.get(periodo) ?? TIPO_CAMBIO_LEGACY,
  };
}

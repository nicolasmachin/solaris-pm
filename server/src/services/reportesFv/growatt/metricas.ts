// Lógica pura de derivación de métricas mensuales desde el smart meter Growatt.
// Port de las funciones de `growatt_clientes.py`. Sin I/O: se testea sola.
//
// Los totales de importación y exportación NO vienen listos: se arman sumando,
// día por día, el máximo diario de `positiveActiveTodayEnergy` (importación) y
// `reverseActiveTodayEnergy` (exportación) del medidor. Un mes al que le faltan
// días produce un total parcial que parece completo, de ahí la regla de
// cobertura.

import { round2 } from "../motor/metrics.js";

/** Una muestra cruda del smart meter (los campos que nos interesan). */
export interface MuestraMedidor {
  time?: string | null;
  timeText?: string | null;
  positiveActiveTodayEnergy?: number | string | null;
  reverseActiveTodayEnergy?: number | string | null;
}

function aFloat(v: unknown): number | null {
  if (v == null) return null;
  const n = typeof v === "number" ? v : Number(String(v).trim());
  return Number.isFinite(n) ? n : null;
}

/** Día (YYYY-MM-DD) de una muestra, o null si no tiene marca temporal. */
function diaDeMuestra(m: MuestraMedidor): string | null {
  const marca = String(m.time ?? m.timeText ?? "").trim();
  return marca ? marca.slice(0, 10) : null;
}

/** Días distintos con al menos una muestra. */
export function diasConMuestras(muestras: MuestraMedidor[]): Set<string> {
  const dias = new Set<string>();
  for (const m of muestras) {
    const dia = diaDeMuestra(m);
    if (dia) dias.add(dia);
  }
  return dias;
}

/**
 * Total del mes de un campo: para cada día toma el MÁXIMO de sus muestras (el
 * campo es un acumulador que se resetea a diario) y suma los máximos. null si no
 * hay ninguna muestra útil.
 */
export function resumirHistorialDiario(
  muestras: MuestraMedidor[],
  campo: "positiveActiveTodayEnergy" | "reverseActiveTodayEnergy",
): number | null {
  const maximosPorDia = new Map<string, number>();
  for (const m of muestras) {
    const dia = diaDeMuestra(m);
    if (!dia) continue;
    const valor = aFloat(m[campo]);
    if (valor == null) continue;
    const anterior = maximosPorDia.get(dia);
    if (anterior == null || valor > anterior) maximosPorDia.set(dia, valor);
  }
  if (maximosPorDia.size === 0) return null;
  let suma = 0;
  for (const v of maximosPorDia.values()) suma += v;
  return round2(suma);
}

/**
 * Días del periodo que ya transcurrieron (no se esperan datos de días futuros).
 * `hoy` se inyecta para poder testear. Todo en UTC.
 */
export function contarDiasEsperados(inicio: Date, fin: Date, hoy: Date): number {
  const finReal = fin < hoy ? fin : hoy;
  if (finReal < inicio) return 0;
  const ms = Date.UTC(finReal.getUTCFullYear(), finReal.getUTCMonth(), finReal.getUTCDate()) -
    Date.UTC(inicio.getUTCFullYear(), inicio.getUTCMonth(), inicio.getUTCDate());
  return Math.floor(ms / 86_400_000) + 1;
}

export interface MetricasMes {
  generacionKwh: number | null;
  consumoKwh: number | null;
  exportacionKwh: number | null;
  importacionMedidaKwh: number | null;
  diasConDatos: number;
  diasEsperados: number;
  motivoDescarte: string | null;
}

/**
 * Deriva las métricas del mes a partir de la generación (de plant/energy) y las
 * muestras del medidor. Si la cobertura de días no llega al mínimo, descarta
 * consumo y exportación (quedan null) para no reportar un total subestimado.
 */
export function derivarMetricas(params: {
  generacionKwh: number | null;
  muestras: MuestraMedidor[];
  diasEsperados: number;
  /** Por debajo de esto el mes no se reporta. 0..1 — hoy 0.5, media. */
  coberturaMinima: number;
}): MetricasMes {
  const { generacionKwh, muestras, diasEsperados, coberturaMinima } = params;

  let importacion = resumirHistorialDiario(muestras, "positiveActiveTodayEnergy");
  let exportacion = resumirHistorialDiario(muestras, "reverseActiveTodayEnergy");
  const diasConDatos = diasConMuestras(muestras).size;

  // Qué hacer cuando el smart meter perdió días. Tres tramos:
  //
  //   mes completo        → el dato es una medición, se usa tal cual.
  //   faltan pero >= 50%  → se PROYECTA: los días faltantes se completan con el
  //                         promedio diario de los medidos. Deja de ser una
  //                         medición y pasa a ser una estimación, así que se
  //                         anota y el PDF lo aclara.
  //   menos del 50%       → no alcanza para estimar nada creíble: se descartan
  //                         consumo y exportación, y sin ellos el mes no se
  //                         puede emitir. El generador queda visible como
  //                         pendiente en el panel.
  //
  // La generación NO entra en esto: la da el inversor, que no pierde días.
  let motivoDescarte: string | null = null;
  const cobertura = diasEsperados > 0 ? diasConDatos / diasEsperados : 1;

  if (diasEsperados > 0 && diasConDatos < diasEsperados) {
    if (cobertura < coberturaMinima) {
      motivoDescarte =
        `sólo ${diasConDatos} de ${diasEsperados} días con datos del smart meter ` +
        `(menos de la mitad del período): no se puede estimar el mes`;
      importacion = null;
      exportacion = null;
    } else {
      const factor = diasEsperados / diasConDatos;
      if (importacion != null) importacion = round2(importacion * factor);
      if (exportacion != null) exportacion = round2(exportacion * factor);
      motivoDescarte =
        `el medidor reportó ${diasConDatos} de ${diasEsperados} días; los ` +
        `${diasEsperados - diasConDatos} faltantes se estimaron con el promedio diario`;
    }
  }

  // consumo = generación + lo que igual se compró a la red - lo exportado.
  const consumo =
    generacionKwh != null && importacion != null && exportacion != null
      ? round2(generacionKwh + importacion - exportacion)
      : null;

  return {
    generacionKwh,
    consumoKwh: consumo,
    exportacionKwh: exportacion,
    importacionMedidaKwh: importacion,
    diasConDatos,
    diasEsperados,
    motivoDescarte,
  };
}

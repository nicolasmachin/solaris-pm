// Formato numérico y de fechas para el reporte, en español rioplatense.
//
// Port de las funciones `fmt_int` / `fmt_decimal` / `formatear_mes_es` del
// sistema Python. El PDF tiene que verse idéntico al que ya reciben los
// clientes, así que estos formatos se replican al detalle: miles con punto,
// decimales con coma, NaN/null como "-".

import { round2 } from "./motor/metrics.js";

const MESES_ES = [
  "enero", "febrero", "marzo", "abril", "mayo", "junio",
  "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre",
];

/**
 * Redondeo a entero half-even, como `round()` de Python. Los valores que llegan
 * acá ya pasaron por round2 (2 decimales), así que los empates son .5 exactos
 * (0.5 se representa exacto en binario), y el desempate va al par.
 */
function roundEntero(x: number): number {
  const piso = Math.floor(x);
  const frac = x - piso;
  if (frac < 0.5) return piso;
  if (frac > 0.5) return piso + 1;
  return piso % 2 === 0 ? piso : piso + 1;
}

/**
 * Entero con separador de miles de punto. `fmt_int` del Python:
 *   f"{int(round(x)):,}".replace(",", ".")
 * Ej: 1234.5 → "1.234"  ·  null/NaN → "-".
 */
export function fmtInt(num: number | null | undefined): string {
  if (num == null || !Number.isFinite(num)) return "-";
  const entero = roundEntero(num);
  // Intl con es-UY usa punto de miles; forzamos sin decimales.
  return new Intl.NumberFormat("es-UY", { maximumFractionDigits: 0 }).format(entero);
}

/** Alias de fmtInt, como el `fmt`/`fmt_pct` del Python. */
export const fmt = fmtInt;
export const fmtPct = fmtInt;

/**
 * Decimal con `decimales` cifras, coma decimal y punto de miles. `fmt_decimal`
 * del Python. Ej: fmtDecimal(4.25, 2) → "4,25"  ·  fmtDecimal(1234.5, 1) → "1.234,5".
 */
export function fmtDecimal(num: number | null | undefined, decimales = 1): string {
  if (num == null || !Number.isFinite(num)) return "-";
  return new Intl.NumberFormat("es-UY", {
    minimumFractionDigits: decimales,
    maximumFractionDigits: decimales,
  }).format(num);
}

/** "junio 2026" a partir de un periodo "YYYY-MM". */
export function mesEs(periodo: string): string {
  const [anio, mes] = periodo.split("-").map(Number);
  const nombre = MESES_ES[mes - 1] ?? "";
  return `${nombre} ${anio}`;
}

/** Duración en años y meses: 14 → "1 año y 2 meses". Port de formatear_duracion_meses. */
export function duracionMeses(cantidad: number): string {
  const n = Math.trunc(cantidad);
  const anios = Math.floor(n / 12);
  const meses = n % 12;
  const partes: string[] = [];
  if (anios > 0) partes.push(anios === 1 ? "1 año" : `${anios} años`);
  if (meses > 0 || partes.length === 0) partes.push(meses === 1 ? "1 mes" : `${meses} meses`);
  return partes.join(" y ");
}

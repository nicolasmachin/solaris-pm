// Manejo de periodos mensuales.
//
// Un periodo se representa como string "YYYY-MM" en todo el módulo. Es a
// propósito: los reportes son mensuales y usar Date invita a errores de zona
// horaria (un `new Date("2026-03-01")` en UTC-3 cae en febrero). La DB guarda
// un @db.Date del día 1 y la conversión pasa siempre por acá.

export type Periodo = string; // "YYYY-MM"

const RE_PERIODO = /^\d{4}-(0[1-9]|1[0-2])$/;

export function esPeriodoValido(p: string): boolean {
  return RE_PERIODO.test(p);
}

export function parsePeriodo(p: Periodo): { anio: number; mes: number } {
  if (!esPeriodoValido(p)) throw new Error(`Periodo inválido: "${p}" (se espera YYYY-MM)`);
  return { anio: Number(p.slice(0, 4)), mes: Number(p.slice(5, 7)) };
}

export function anioDePeriodo(p: Periodo): number {
  return parsePeriodo(p).anio;
}

export function mesDePeriodo(p: Periodo): number {
  return parsePeriodo(p).mes;
}

/** Suma (o resta, con delta negativo) meses a un periodo. */
export function sumarMeses(p: Periodo, delta: number): Periodo {
  const { anio, mes } = parsePeriodo(p);
  const total = anio * 12 + (mes - 1) + delta;
  const nuevoAnio = Math.floor(total / 12);
  const nuevoMes = total - nuevoAnio * 12 + 1;
  return `${String(nuevoAnio).padStart(4, "0")}-${String(nuevoMes).padStart(2, "0")}`;
}

export function periodoAnterior(p: Periodo): Periodo {
  return sumarMeses(p, -1);
}

export function periodoSiguiente(p: Periodo): Periodo {
  return sumarMeses(p, 1);
}

/** Meses calendario entre dos periodos (hasta - desde). Puede ser negativo. */
export function mesesEntre(desde: Periodo, hasta: Periodo): number {
  const a = parsePeriodo(desde);
  const b = parsePeriodo(hasta);
  return (b.anio - a.anio) * 12 + (b.mes - a.mes);
}

/** Todos los periodos del rango, inclusive ambos extremos. */
export function rangoPeriodos(desde: Periodo, hasta: Periodo): Periodo[] {
  const total = mesesEntre(desde, hasta);
  if (total < 0) return [];
  return Array.from({ length: total + 1 }, (_, i) => sumarMeses(desde, i));
}

/** Periodo → Date del día 1 en UTC (lo que espera un @db.Date de Prisma). */
export function periodoADate(p: Periodo): Date {
  const { anio, mes } = parsePeriodo(p);
  return new Date(Date.UTC(anio, mes - 1, 1));
}

/** Date → periodo, leyendo siempre en UTC para no correrse de mes. */
export function dateAPeriodo(d: Date): Periodo {
  return `${String(d.getUTCFullYear()).padStart(4, "0")}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
}

/** Último día del mes, en UTC. Sirve para resolver la vigencia de una tarifa. */
export function ultimoDiaDelPeriodo(p: Periodo): Date {
  const { anio, mes } = parsePeriodo(p);
  return new Date(Date.UTC(anio, mes, 0));
}

/** Periodo del mes anterior al de la fecha dada (el que se reporta cada mes). */
export function periodoMesAnterior(ahora: Date = new Date()): Periodo {
  return sumarMeses(dateAPeriodo(ahora), -1);
}

/**
 * Normaliza lo que venga de una planilla o de un form: "2024-08", "2024-08-01",
 * "2024/08", un Date. Devuelve null si no se puede interpretar.
 */
export function normalizarPeriodo(valor: string | Date | null | undefined): Periodo | null {
  if (valor == null) return null;
  if (valor instanceof Date) return Number.isNaN(valor.getTime()) ? null : dateAPeriodo(valor);

  const texto = String(valor).trim();
  if (!texto || texto.toLowerCase() === "nan") return null;

  const m = texto.match(/^(\d{4})[-/](\d{1,2})/);
  if (!m) return null;

  const mes = Number(m[2]);
  if (mes < 1 || mes > 12) return null;
  return `${m[1]}-${String(mes).padStart(2, "0")}`;
}

/**
 * Proporción de días hábiles (lunes a viernes) del mes.
 *
 * UTE cobra la hora punta al precio caro sólo de lunes a viernes; sábados y
 * domingos se facturan al precio de fuera de punta (tarifa doble) o de llano
 * (triple y zafral). El motor usa esta fracción para reasignar la porción de
 * punta que cae en fin de semana.
 *
 * Port literal de `fraccion_dias_habiles` del sistema Python: NO descuenta
 * feriados (el docstring original los menciona pero el código sólo mira
 * `weekday() < 5`). No cambiar sin re-verificar contra el motor original.
 */
export function fraccionDiasHabiles(p: Periodo): number {
  const { anio, mes } = parsePeriodo(p);
  const diasMes = new Date(Date.UTC(anio, mes, 0)).getUTCDate();
  let habiles = 0;
  for (let dia = 1; dia <= diasMes; dia++) {
    // getUTCDay: 0 = domingo, 6 = sábado. Hábil = lunes(1) a viernes(5).
    const dow = new Date(Date.UTC(anio, mes - 1, dia)).getUTCDay();
    if (dow >= 1 && dow <= 5) habiles++;
  }
  return habiles / diasMes;
}

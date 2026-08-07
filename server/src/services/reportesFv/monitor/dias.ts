// Fechas del monitoreo diario.
//
// REGLA DEL MÓDULO: un día es SIEMPRE el string "YYYY-MM-DD". Nunca un Date
// local. El "día" de la generación lo define Growatt en hora de la planta
// (Uruguay, GMT-3 fijo, sin horario de verano), el cron corre en
// America/Montevideo y el proceso en Docker está en UTC: mezclar los tres con
// objetos Date es la receta para que un reporte se corra un día.

export type Dia = string; // "YYYY-MM-DD"

const RE_DIA = /^\d{4}-\d{2}-\d{2}$/;

export function esDiaValido(d: string): boolean {
  return RE_DIA.test(d) && !Number.isNaN(Date.parse(`${d}T00:00:00.000Z`));
}

/** Día → Date UTC del día 1 (lo que espera un @db.Date de Prisma). */
export function diaADate(d: Dia): Date {
  return new Date(`${d}T00:00:00.000Z`);
}

export function dateADia(d: Date): Dia {
  return d.toISOString().slice(0, 10);
}

export function sumarDias(d: Dia, delta: number): Dia {
  const x = diaADate(d);
  x.setUTCDate(x.getUTCDate() + delta);
  return dateADia(x);
}

/** Días calendario entre dos días (hasta - desde). Puede ser negativo. */
export function diasEntre(desde: Dia, hasta: Dia): number {
  return Math.round((diaADate(hasta).getTime() - diaADate(desde).getTime()) / 86_400_000);
}

/** Todos los días del rango, inclusive ambos extremos. */
export function rangoDias(desde: Dia, hasta: Dia): Dia[] {
  const total = diasEntre(desde, hasta);
  if (total < 0) return [];
  return Array.from({ length: total + 1 }, (_, i) => sumarDias(desde, i));
}

/**
 * El día que le toca evaluar a una corrida lanzada en `ahora`: siempre el
 * anterior en hora de Uruguay, nunca el día en curso.
 *
 * Que sea el anterior no es una cautela de más: el datalogger transmite sólo
 * con luz solar, así que el día en curso está incompleto por definición hasta
 * la tarde, y una planta sana daría "sin generación" toda la mañana.
 */
export function diaAEvaluar(ahora: Date = new Date()): Dia {
  // Uruguay es UTC-3 todo el año (sin DST desde 2015).
  const enUruguay = new Date(ahora.getTime() - 3 * 60 * 60 * 1000);
  enUruguay.setUTCDate(enUruguay.getUTCDate() - 1);
  return dateADia(enUruguay);
}

const MESES = [
  "enero", "febrero", "marzo", "abril", "mayo", "junio",
  "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre",
];

/** "6 de agosto" — para los textos del mail y del panel. */
export function diaTexto(d: Dia): string {
  const x = diaADate(d);
  return `${x.getUTCDate()} de ${MESES[x.getUTCMonth()]}`;
}

/** "6 ago" — versión corta para tablas. */
export function diaCorto(d: Dia): string {
  const x = diaADate(d);
  return `${x.getUTCDate()} ${MESES[x.getUTCMonth()].slice(0, 3)}`;
}

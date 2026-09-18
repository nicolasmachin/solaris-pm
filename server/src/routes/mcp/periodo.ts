// Resolución de períodos para las herramientas de finanzas y métricas.
//
// Una sola forma de pedir un período en todo el conector: un mes, un
// trimestre, un año, o un rango libre de fechas. Sin nada, el mes en curso.
// Las fechas se interpretan en hora de Uruguay para decidir "hoy" y "el mes en
// curso"; el rango que se devuelve está en UTC a medianoche, que es como
// guardan sus fechas los movimientos financieros.

import { z } from "zod";

const MESES = [
  "enero", "febrero", "marzo", "abril", "mayo", "junio",
  "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre",
];

/** Parámetros de período que aceptan las herramientas. */
export const periodoInput = {
  mes: z.number().int().min(1).max(12).optional().describe("Mes (1-12). Va con `anio`."),
  trimestre: z.number().int().min(1).max(4).optional().describe("Trimestre (1-4). Va con `anio`."),
  anio: z
    .number()
    .int()
    .min(2020)
    .max(2100)
    .optional()
    .describe("Año. Solo, pide el año entero; con `mes` o `trimestre`, ese período."),
  desde: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .optional()
    .describe("Inicio de un rango libre, AAAA-MM-DD. Va con `hasta`."),
  hasta: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .optional()
    .describe("Fin de un rango libre, AAAA-MM-DD, inclusive."),
};

export interface PeriodoPedido {
  mes?: number;
  trimestre?: number;
  anio?: number;
  desde?: string;
  hasta?: string;
}

export interface PeriodoResuelto {
  /** Inicio inclusive, UTC 00:00. */
  inicio: Date;
  /** Fin exclusivo, UTC 00:00 del día siguiente al último incluido. */
  fin: Date;
  /** Cómo se lo nombra en una respuesta: "agosto de 2026", "del 1/7 al 15/7". */
  etiqueta: string;
}

/** Hoy en Uruguay, como { anio, mes (1-12), dia }. */
export function hoyUruguay() {
  const s = new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Montevideo",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
  const [anio, mes, dia] = s.split("-").map(Number);
  return { anio, mes, dia, iso: s };
}

function ddmm(d: Date) {
  return `${d.getUTCDate()}/${d.getUTCMonth() + 1}/${d.getUTCFullYear()}`;
}

/**
 * Traduce lo que se pidió a un rango. Lanza un Error con mensaje legible si la
 * combinación no tiene sentido — el conector lo devuelve como error de la
 * herramienta, que el chat puede explicar.
 */
export function resolverPeriodo(p: PeriodoPedido): PeriodoResuelto {
  if (p.desde || p.hasta) {
    if (!p.desde || !p.hasta) throw new Error("Para un rango libre hacen falta `desde` y `hasta`.");
    const inicio = new Date(`${p.desde}T00:00:00.000Z`);
    const ultimo = new Date(`${p.hasta}T00:00:00.000Z`);
    if (ultimo < inicio) throw new Error("`hasta` es anterior a `desde`.");
    const fin = new Date(ultimo.getTime() + 86_400_000);
    return { inicio, fin, etiqueta: `del ${ddmm(inicio)} al ${ddmm(ultimo)}` };
  }

  const hoy = hoyUruguay();
  const anio = p.anio ?? hoy.anio;

  if (p.mes) {
    return {
      inicio: new Date(Date.UTC(anio, p.mes - 1, 1)),
      fin: new Date(Date.UTC(anio, p.mes, 1)),
      etiqueta: `${MESES[p.mes - 1]} de ${anio}`,
    };
  }
  if (p.trimestre) {
    const m0 = (p.trimestre - 1) * 3;
    return {
      inicio: new Date(Date.UTC(anio, m0, 1)),
      fin: new Date(Date.UTC(anio, m0 + 3, 1)),
      etiqueta: `${p.trimestre}.º trimestre de ${anio}`,
    };
  }
  if (p.anio) {
    return {
      inicio: new Date(Date.UTC(anio, 0, 1)),
      fin: new Date(Date.UTC(anio + 1, 0, 1)),
      etiqueta: `año ${anio}`,
    };
  }
  // Sin nada: el mes en curso.
  return {
    inicio: new Date(Date.UTC(hoy.anio, hoy.mes - 1, 1)),
    fin: new Date(Date.UTC(hoy.anio, hoy.mes, 1)),
    etiqueta: `${MESES[hoy.mes - 1]} de ${hoy.anio} (mes en curso)`,
  };
}

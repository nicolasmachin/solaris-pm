// Lógica pura del vigía para plantas Huawei. FusionSolar no da la potencia del
// momento: da el estado de salud (1 sin comunicación, 2 con falla, 3 sana) y la
// energía del día. Con dos lecturas seguidas se sabe si la planta está sumando.

import { SONDEOS_PARA_ALERTA } from "./vigia.js";

/** Menos que esto en media hora no es "sumar" (redondeos de FusionSolar). */
export const SUBA_MIN_KWH = 0.05;

export type PrevioHuawei = {
  diaKwh: number | null;
  /** Día (YYYY-MM-DD) de la lectura anterior. */
  dia: string | null;
  leidoEn: Date | null;
  sinComunicacionConSol: number;
  conFallaConSol: number;
  sinSumarConSol: number;
};

export type LecturaHuawei = { salud: 1 | 2 | 3 | null; diaKwh: number | null };

export type EvalHuawei = {
  sinComunicacionConSol: number;
  conFallaConSol: number;
  sinSumarConSol: number;
  /** Sumó energía desde la lectura anterior. */
  genera: boolean;
  /** Potencia media desde la lectura anterior (W), si se puede calcular. */
  potenciaW: number | null;
  alerta: "SIN_COMUNICACION" | "FALLA_INVERSOR" | "SIN_GENERACION" | null;
};

export function evaluarHuawei(
  previo: PrevioHuawei,
  l: LecturaHuawei,
  hoy: string,
  ahora: Date,
  haySol: boolean,
): EvalHuawei {
  const mismoDia = previo.dia === hoy && previo.diaKwh != null && l.diaKwh != null;
  const suba = mismoDia ? l.diaKwh! - previo.diaKwh! : null;
  const horas = previo.leidoEn ? (ahora.getTime() - previo.leidoEn.getTime()) / 3_600_000 : null;
  const potenciaW = suba != null && horas && horas > 0.1 ? Math.max(0, (suba / horas) * 1000) : null;
  const genera = suba != null && suba >= SUBA_MIN_KWH;

  const cuenta = (cond: boolean, antes: number) => (cond ? (haySol ? antes + 1 : antes) : 0);
  const sinComunicacionConSol = cuenta(l.salud === 1, previo.sinComunicacionConSol);
  const conFallaConSol = cuenta(l.salud === 2, previo.conFallaConSol);
  // Sana y sin sumar: solo cuenta si hay con qué comparar (misma jornada).
  const sinSumarConSol = l.salud === 3 && suba != null && !genera ? (haySol ? previo.sinSumarConSol + 1 : previo.sinSumarConSol) : 0;

  let alerta: EvalHuawei["alerta"] = null;
  if (haySol) {
    if (conFallaConSol >= SONDEOS_PARA_ALERTA) alerta = "FALLA_INVERSOR";
    else if (sinComunicacionConSol >= SONDEOS_PARA_ALERTA) alerta = "SIN_COMUNICACION";
    else if (sinSumarConSol >= SONDEOS_PARA_ALERTA) alerta = "SIN_GENERACION";
  }
  return { sinComunicacionConSol, conFallaConSol, sinSumarConSol, genera, potenciaW, alerta };
}

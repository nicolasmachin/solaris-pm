// Aritmética de aniversarios de la puesta en marcha del sistema. La comparten el
// cron de encuestas de aniversario (server/src/services/encuestas/aniversario.job.ts)
// y el listado de Experiencia Solar (columna "Próximo mantenimiento").
//
// Ancla del "año 0" = Project.postHabilitacionInicioEn, con fallback a
// Project.actualUteEnd para proyectos sin la post-habilitación seteada.

import { diffInDays, startOfUtcDay } from "./dates.js";

// Aniversarios ya cumplidos (años completos) entre `ancla` y `now`, en UTC.
export function aniversariosCumplidos(ancla: Date, now: Date): number {
  let anios = now.getUTCFullYear() - ancla.getUTCFullYear();
  const antesDelDia =
    now.getUTCMonth() < ancla.getUTCMonth() ||
    (now.getUTCMonth() === ancla.getUTCMonth() && now.getUTCDate() < ancla.getUTCDate());
  if (antesDelDia) anios -= 1;
  return anios;
}

// Fecha ancla del mantenimiento: inicio de post-habilitación, fallback fin de UTE.
export function getAnclaMantenimiento(p: {
  postHabilitacionInicioEn: Date | null;
  actualUteEnd: Date | null;
}): Date | null {
  return p.postHabilitacionInicioEn ?? p.actualUteEnd ?? null;
}

export type ProximoMantenimiento = {
  aniosQueCumple: number; // qué aniversario es el próximo (1°, 2°, 3°…)
  proximoAniversario: Date; // fecha del próximo aniversario (día UTC)
  diasRestantes: number; // días desde hoy hasta el próximo aniversario (>= 0)
};

// Próximo aniversario (hoy o futuro) a partir de la fecha ancla. En el día exacto
// del aniversario devuelve diasRestantes = 0 (no salta al año siguiente).
export function proximoMantenimiento(ancla: Date, now: Date = new Date()): ProximoMantenimiento {
  const today = startOfUtcDay(now);
  const mes = ancla.getUTCMonth();
  const dia = ancla.getUTCDate();
  let year = today.getUTCFullYear();
  let candidato = new Date(Date.UTC(year, mes, dia));
  if (candidato.getTime() < today.getTime()) {
    year += 1;
    candidato = new Date(Date.UTC(year, mes, dia));
  }
  return {
    aniosQueCumple: year - ancla.getUTCFullYear(),
    proximoAniversario: candidato,
    diasRestantes: diffInDays(today, candidato),
  };
}

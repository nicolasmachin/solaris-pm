// Lógica pura de las herramientas de obra del conector (calendario, subetapas).
// Separada de `obra.ts` para poder probarla sin base de datos.

import { SubstageStatus } from "@prisma/client";

import { esFeriado } from "../../../utils/business-days.js";

const DIA_SEMANA = ["dom", "lun", "mar", "mié", "jue", "vie", "sáb"];

/** Día "AAAA-MM-DD" a medianoche UTC (así se guardan las columnas de solo día). */
export function diaUtc(iso: string): Date {
  return new Date(`${iso}T00:00:00.000Z`);
}

export function isoDia(d: Date): string {
  return d.toISOString().slice(0, 10);
}

export function sumarDias(iso: string, n: number): string {
  const d = diaUtc(iso);
  d.setUTCDate(d.getUTCDate() + n);
  return isoDia(d);
}

/** "lun 3/11". */
export function diaCorto(iso: string): string {
  const d = diaUtc(iso);
  return `${DIA_SEMANA[d.getUTCDay()]} ${d.getUTCDate()}/${d.getUTCMonth() + 1}`;
}

/** Hábil = lunes a viernes que no es feriado (mismo criterio que `business-days.ts`). */
export function esHabil(iso: string): boolean {
  const d = diaUtc(iso);
  const dow = d.getUTCDay();
  return dow !== 0 && dow !== 6 && !esFeriado(d);
}

/** Todos los días entre `desde` y `hasta`, inclusive, como "AAAA-MM-DD". */
export function diasDelRango(desde: string, hasta: string): string[] {
  const out: string[] = [];
  for (let d = desde; d <= hasta; d = sumarDias(d, 1)) out.push(d);
  return out;
}

export interface Hueco {
  desde: string;
  hasta: string;
  diasHabiles: number;
}

/**
 * Tramos de días hábiles libres de un equipo dentro del rango. Un tramo se corta
 * en un día ocupado; los fines de semana y feriados no lo cortan (un equipo
 * libre de viernes a lunes tiene un solo hueco de dos días hábiles).
 */
export function huecosLibres(desde: string, hasta: string, ocupados: Set<string>): Hueco[] {
  const huecos: Hueco[] = [];
  let actual: Hueco | null = null;
  for (const dia of diasDelRango(desde, hasta)) {
    if (!esHabil(dia)) continue;
    if (ocupados.has(dia)) {
      if (actual) huecos.push(actual);
      actual = null;
      continue;
    }
    if (actual) {
      actual.hasta = dia;
      actual.diasHabiles++;
    } else {
      actual = { desde: dia, hasta: dia, diasHabiles: 1 };
    }
  }
  if (actual) huecos.push(actual);
  return huecos;
}

/** Marca como ocupados los días de un tramo [inicio, fin] que caen en el rango. */
export function ocuparTramo(ocupados: Set<string>, inicio: string, fin: string, desde: string, hasta: string) {
  const a = inicio < desde ? desde : inicio;
  const b = fin > hasta ? hasta : fin;
  for (const d of diasDelRango(a, b)) ocupados.add(d);
}

/** Minúsculas y sin tildes, para comparar nombres dictados. */
export function normalizar(texto: string): string {
  return texto
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();
}

export const ESTADO_SUBETAPA: Record<string, SubstageStatus> = {
  PENDIENTE: SubstageStatus.PENDING,
  EN_PROGRESO: SubstageStatus.IN_PROGRESS,
  BLOQUEADO: SubstageStatus.BLOCKED,
  COMPLETADO: SubstageStatus.COMPLETED,
  NO_APLICA: SubstageStatus.NO_APLICA,
};

export const ESTADO_SUBETAPA_LABEL: Record<SubstageStatus, string> = {
  PENDING: "Pendiente",
  IN_PROGRESS: "En progreso",
  BLOCKED: "Bloqueado",
  COMPLETED: "Completado",
  NO_APLICA: "No aplica",
};

/**
 * Busca la subetapa que nombró la persona: primero por id, después por nombre
 * exacto (sin tildes ni mayúsculas), después por nombre que lo contenga. Devuelve
 * todas las que empatan en el primer criterio que encuentra algo: si son varias,
 * quien llama pide precisión en vez de adivinar.
 */
export function buscarSubetapa<T extends { id: string; name: string }>(lista: T[], consulta: string): T[] {
  const porId = lista.filter((s) => s.id === consulta.trim());
  if (porId.length > 0) return porId;
  const q = normalizar(consulta);
  if (!q) return [];
  const exactas = lista.filter((s) => normalizar(s.name) === q);
  if (exactas.length > 0) return exactas;
  return lista.filter((s) => normalizar(s.name).includes(q));
}

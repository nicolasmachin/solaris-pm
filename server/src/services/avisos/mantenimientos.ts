/**
 * Mantenimientos y avisos al cliente.
 *
 * La instalación incluye dos mantenimientos sin costo: al primer y al segundo año
 * de habilitada. Un mantenimiento es un evento MANTENIMIENTO de la agenda del
 * proyecto (`AgendaEvento`); hecho = `completadoEn`.
 *
 *  - `esMantenimientoSinCosto()`: la condición del aviso "Mantenimiento agendado"
 *    (solo los dos sin costo).
 *  - `avisosMantenimientoAnio()`: el disparador "un año desde el último
 *    mantenimiento hecho" (job diario), para ofrecer el mantenimiento pago.
 *  - `alertasMantenimiento()`: la alerta interna de mantenimiento sin costo
 *    próximo o vencido, que Experiencia Solar ve en su lista.
 *
 * **Los mantenimientos de antes de Voltia PM no están cargados** (al 15-nov-2026
 * no había ninguno en la agenda). Por eso "sin costo" no se decide solo
 * contando: también tiene que caer dentro de los dos primeros años de habilitada,
 * con margen. Y la alerta solo mira aniversarios desde `CORTE_ALERTAS`: los de
 * antes no se pueden saber. Ver docs/manual/20-avisos-automaticos.md.
 */

import { TipoEventoAgenda } from "@prisma/client";

import { prisma } from "../../lib/prisma.js";
import { getAnclaAniversario } from "../../utils/aniversario.js";

const DIA_MS = 24 * 60 * 60 * 1000;

/** Cuántos mantenimientos incluye la instalación sin costo. */
export const MANTENIMIENTOS_SIN_COSTO = 2;
/** Margen después del segundo aniversario en que el mantenimiento sigue siendo el sin costo (se agendó tarde). */
const MARGEN_SIN_COSTO_MESES = 6;
/** Desde cuándo se alerta un mantenimiento sin costo vencido: lo anterior no está registrado. */
export const CORTE_ALERTAS = new Date("2026-11-15T00:00:00Z");
/** Con cuánta anticipación se avisa que se viene un mantenimiento sin costo. */
export const DIAS_AVISO_PROXIMO = 30;

function sumarAnios(d: Date, anios: number): Date {
  return new Date(Date.UTC(d.getUTCFullYear() + anios, d.getUTCMonth(), d.getUTCDate()));
}

function sumarMeses(d: Date, meses: number): Date {
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + meses, d.getUTCDate()));
}

const ANCLA_SELECT = {
  postHabilitacionInicioEn: true,
  actualUteEnd: true,
  plannedEndDate: true,
  importedFromCsv: true,
} as const;

/** El primer día de cada mantenimiento del proyecto (los no borrados), del más viejo al más nuevo. */
async function mantenimientosDe(projectId: string) {
  const eventos = await prisma.agendaEvento.findMany({
    where: { projectId, tipo: TipoEventoAgenda.MANTENIMIENTO, deletedAt: null },
    select: { id: true, completadoEn: true, dias: { select: { fecha: true }, orderBy: { fecha: "asc" } } },
  });
  return eventos
    .filter((e) => e.dias.length > 0)
    .map((e) => ({ id: e.id, hecho: !!e.completadoEn, primerDia: e.dias[0].fecha, ultimoDia: e.dias[e.dias.length - 1].fecha }))
    .sort((a, b) => a.primerDia.getTime() - b.primerDia.getTime());
}

/**
 * Si el mantenimiento de esa fecha es uno de los sin costo: es el 1.º o el 2.º
 * del proyecto y cae dentro de los dos primeros años de habilitada (+ margen).
 */
export async function esMantenimientoSinCosto(
  projectId: string,
  fecha: Date,
): Promise<{ sinCosto: true } | { sinCosto: false; motivo: string }> {
  const p = await prisma.project.findUnique({ where: { id: projectId }, select: ANCLA_SELECT });
  const ancla = p ? getAnclaAniversario(p) : null;
  if (!ancla) return { sinCosto: false, motivo: "La instalación todavía no tiene fecha de habilitación." };
  const limite = sumarMeses(sumarAnios(ancla, MANTENIMIENTOS_SIN_COSTO), MARGEN_SIN_COSTO_MESES);
  if (fecha.getTime() > limite.getTime()) {
    return { sinCosto: false, motivo: "Ya pasaron los dos primeros años de habilitada: el mantenimiento no es sin costo." };
  }
  const anteriores = (await mantenimientosDe(projectId)).filter((m) => m.primerDia.getTime() <= fecha.getTime());
  if (anteriores.length > MANTENIMIENTOS_SIN_COSTO) {
    return { sinCosto: false, motivo: `Es el ${anteriores.length}.º mantenimiento: ya usó los dos sin costo.` };
  }
  return { sinCosto: true };
}

/**
 * "Un año desde el último mantenimiento hecho", para ofrecer uno pago: solo a
 * quien ya usó los dos sin costo. Revisa la última semana (si un día no corre,
 * el siguiente lo recupera); cada mantenimiento avisa una sola vez (ref = su id).
 */
export async function avisosMantenimientoAnio(ahora = new Date()): Promise<number> {
  const { emitirHecho } = await import("./emitir.js");
  const hoy = new Date(Date.UTC(ahora.getUTCFullYear(), ahora.getUTCMonth(), ahora.getUTCDate()));
  const hace1 = sumarAnios(hoy, -1);
  const desde = new Date(hace1.getTime() - 7 * DIA_MS);
  const candidatos = await prisma.agendaEvento.findMany({
    where: {
      tipo: TipoEventoAgenda.MANTENIMIENTO,
      deletedAt: null,
      completadoEn: { not: null },
      projectId: { not: null },
      dias: { some: { fecha: { gte: desde, lte: hace1 } } },
    },
    select: { id: true, projectId: true },
  });
  let emitidos = 0;
  for (const c of candidatos) {
    const todos = await mantenimientosDe(c.projectId!);
    const este = todos.find((m) => m.id === c.id);
    if (!este) continue;
    // El último día del mantenimiento tiene que estar en la ventana, y tiene que
    // ser el último: si después hubo otro, el año cuenta desde ese.
    if (este.ultimoDia < desde || este.ultimoDia > hace1) continue;
    if (todos.some((m) => m.primerDia.getTime() > este.ultimoDia.getTime())) continue;
    const hechosHastaEste = todos.filter((m) => m.hecho && m.primerDia.getTime() <= este.primerDia.getTime()).length;
    if (!(await usoLosSinCosto(c.projectId!, este.primerDia, hechosHastaEste))) continue;
    emitirHecho({
      disparador: "mantenimiento.anio",
      projectId: c.projectId!,
      ref: c.id,
      ocurrioEn: sumarAnios(este.ultimoDia, 1),
      eventoFecha: este.ultimoDia,
    });
    emitidos++;
  }
  return emitidos;
}

/**
 * Ya usó los dos sin costo: hizo dos (o más), o el último cae después de la
 * ventana del primero (fue el segundo, aunque el primero no esté cargado).
 */
async function usoLosSinCosto(projectId: string, fechaUltimo: Date, hechos: number): Promise<boolean> {
  if (hechos >= MANTENIMIENTOS_SIN_COSTO) return true;
  const p = await prisma.project.findUnique({ where: { id: projectId }, select: ANCLA_SELECT });
  const ancla = p ? getAnclaAniversario(p) : null;
  if (!ancla) return false;
  return fechaUltimo.getTime() >= sumarMeses(sumarAnios(ancla, 1), MARGEN_SIN_COSTO_MESES).getTime();
}

/**
 * La alerta interna de mantenimiento sin costo, por proyecto: el próximo (faltan
 * DIAS_AVISO_PROXIMO o menos) o el vencido (pasó el aniversario) que no tiene
 * mantenimiento agendado. Solo aniversarios desde CORTE_ALERTAS.
 */
export async function alertasMantenimiento(projectIds: string[], ahora = new Date()): Promise<Map<string, string>> {
  const salida = new Map<string, string>();
  if (projectIds.length === 0) return salida;
  const hoy = new Date(Date.UTC(ahora.getUTCFullYear(), ahora.getUTCMonth(), ahora.getUTCDate()));
  const [proyectos, eventos] = await Promise.all([
    prisma.project.findMany({ where: { id: { in: projectIds } }, select: { id: true, ...ANCLA_SELECT } }),
    prisma.agendaEvento.groupBy({
      by: ["projectId"],
      where: { projectId: { in: projectIds }, tipo: TipoEventoAgenda.MANTENIMIENTO, deletedAt: null },
      _count: true,
    }),
  ]);
  const cuantos = new Map(eventos.map((e) => [e.projectId, e._count]));
  for (const p of proyectos) {
    const ancla = getAnclaAniversario(p);
    if (!ancla) continue;
    const agendados = cuantos.get(p.id) ?? 0;
    // Los aniversarios de antes del corte no se exigen: si el 1.º fue antes, para
    // el 2.º alcanza con un mantenimiento cargado.
    let anterioresAlCorte = 0;
    for (let n = 1; n <= MANTENIMIENTOS_SIN_COSTO; n++) {
      const vence = sumarAnios(ancla, n);
      if (vence < CORTE_ALERTAS) {
        anterioresAlCorte++;
        continue;
      }
      if (agendados >= n - anterioresAlCorte) continue;
      const dias = Math.round((vence.getTime() - hoy.getTime()) / DIA_MS);
      if (dias > DIAS_AVISO_PROXIMO) break;
      const fecha = vence.toISOString().slice(0, 10).split("-").reverse().join("/");
      salida.set(
        p.id,
        dias >= 0
          ? `Agendar el ${n}.º mantenimiento sin costo (vence el ${fecha})`
          : `${n}.º mantenimiento sin costo vencido desde el ${fecha}, sin agendar`,
      );
      break;
    }
  }
  return salida;
}

// Ciclo de vida de las incidencias del monitoreo.
//
// Sin esto, una planta rota generaría el mismo mail todos los días hasta que
// alguien la arregle, y el mail se volvería ruido que nadie abre. La incidencia
// convierte "hoy está mal" en "esto empezó tal día y sigue", que es lo que
// realmente hay que avisar una sola vez.

import { FvDiagnostico, FvIncidenciaEstado, Prisma } from "@prisma/client";

import { prisma } from "../../../lib/prisma.js";
import { diaADate, dateADia, diasEntre, type Dia } from "./dias.js";
import type { ResultadoDiagnostico } from "./diagnostico.js";

/**
 * Identifica la planta de una incidencia. Discriminada y no dos parámetros
 * opcionales: la base tiene un CHECK que exige exactamente una de las dos, así
 * que el tipo hace imposible construir el caso que la base rechazaría.
 */
export type ClavePlanta = { growattPlantId: bigint } | { huaweiPlantId: string };

export interface DeteccionRegistrada {
  incidenciaId: string;
  /** Recién abierta en esta corrida (lo que va a la sección "nuevas" del mail). */
  esNueva: boolean;
  /** Cambió el diagnóstico y se cerró la anterior. */
  cambioDeDiagnostico: boolean;
}

/**
 * Registra que la planta sigue (o empieza a estar) mal. Idempotente: correr dos
 * veces el mismo día no duplica ni infla `diasAfectados`.
 *
 * Si el diagnóstico cambió —volvió el wifi pero el inversor sigue muerto— se
 * resuelve el anterior y se abre uno nuevo. Eso es información real, no ruido.
 */
export async function registrarDeteccion(params: {
  planta: ClavePlanta;
  projectId: string | null;
  dia: Dia;
  resultado: ResultadoDiagnostico;
}): Promise<DeteccionRegistrada> {
  const { planta, projectId, dia, resultado } = params;
  const fecha = diaADate(dia);
  const ultimaGeneracion = resultado.ultimaGeneracionEn ? diaADate(resultado.ultimaGeneracionEn) : null;

  const abiertas = await prisma.fvIncidencia.findMany({
    where: { ...planta, estado: FvIncidenciaEstado.ABIERTA },
  });

  const misma = abiertas.find((i) => i.diagnostico === resultado.diagnostico);
  const otras = abiertas.filter((i) => i.diagnostico !== resultado.diagnostico);

  // El problema mutó: se cierra lo viejo para no dejar dos incidencias vivas.
  for (const vieja of otras) {
    await prisma.fvIncidencia.update({
      where: { id: vieja.id },
      data: { estado: FvIncidenciaEstado.RESUELTA, resueltaEn: fecha },
    });
  }

  if (misma) {
    // Días afectados = ventana real cubierta, no un contador que se incrementa
    // en cada corrida (si el cron corre dos veces, el número mentiría).
    const dias = Math.max(1, diasEntre(dateADia(misma.primeraDeteccionEn), dia) + 1);
    await prisma.fvIncidencia.update({
      where: { id: misma.id },
      data: {
        ultimaDeteccionEn: fecha > misma.ultimaDeteccionEn ? fecha : misma.ultimaDeteccionEn,
        diasAfectados: dias,
        detalle: resultado.detalle,
        ultimaGeneracionEn: ultimaGeneracion ?? misma.ultimaGeneracionEn,
      },
    });
    return { incidenciaId: misma.id, esNueva: false, cambioDeDiagnostico: otras.length > 0 };
  }

  try {
    const creada = await prisma.fvIncidencia.create({
      data: {
        ...planta,
        projectId,
        diagnostico: resultado.diagnostico,
        estado: FvIncidenciaEstado.ABIERTA,
        primeraDeteccionEn: fecha,
        ultimaDeteccionEn: fecha,
        diasAfectados: Math.max(1, resultado.diasSinGeneracion),
        detalle: resultado.detalle,
        ultimaGeneracionEn: ultimaGeneracion,
      },
    });
    return { incidenciaId: creada.id, esNueva: true, cambioDeDiagnostico: otras.length > 0 };
  } catch (err) {
    // El índice único parcial (una ABIERTA por planta y diagnóstico) frenó una
    // carrera con otra corrida. La que ganó ya dejó la incidencia; no es error.
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002") {
      const existente = await prisma.fvIncidencia.findFirst({
        where: { ...planta, diagnostico: resultado.diagnostico, estado: FvIncidenciaEstado.ABIERTA },
      });
      if (existente) {
        return { incidenciaId: existente.id, esNueva: false, cambioDeDiagnostico: otras.length > 0 };
      }
    }
    throw err;
  }
}

/**
 * Cierra las incidencias abiertas de una planta que volvió a estar bien.
 *
 * REGLA DE ORO: esto se llama SÓLO cuando la planta se pudo evaluar con éxito.
 * Una planta que no se pudo consultar nunca cierra su incidencia por omisión —
 * si no, una caída de la API "arreglaría" todas las plantas rotas.
 */
export async function resolverIncidencias(planta: ClavePlanta, dia: Dia): Promise<string[]> {
  const abiertas = await prisma.fvIncidencia.findMany({
    where: { ...planta, estado: FvIncidenciaEstado.ABIERTA },
    select: { id: true },
  });
  if (abiertas.length === 0) return [];

  await prisma.fvIncidencia.updateMany({
    where: { id: { in: abiertas.map((i) => i.id) } },
    data: { estado: FvIncidenciaEstado.RESUELTA, resueltaEn: diaADate(dia) },
  });
  return abiertas.map((i) => i.id);
}

export interface FilaIncidencia {
  id: string;
  /** Sólo una de las dos viene con valor; `marca` dice cuál mirar. */
  growattPlantId: string | null;
  huaweiPlantId: string | null;
  marca: "GROWATT" | "HUAWEI";
  plantName: string;
  projectId: string | null;
  clientName: string | null;
  diagnostico: FvDiagnostico;
  estado: FvIncidenciaEstado;
  detalle: string | null;
  primeraDeteccionEn: Dia;
  ultimaDeteccionEn: Dia;
  resueltaEn: Dia | null;
  diasAfectados: number;
  ultimaGeneracionEn: Dia | null;
  revisada: boolean;
  revisadaPor: string | null;
  revisadaEn: string | null;
  nota: string | null;
  notificada: boolean;
}

const INCLUDE_FILA = {
  plant: { select: { name: true } },
  huaweiPlant: { select: { name: true } },
  project: { select: { clientName: true } },
  revisadaPor: { select: { name: true } },
} as const;

type IncidenciaConRelaciones = Prisma.FvIncidenciaGetPayload<{ include: typeof INCLUDE_FILA }>;

export function serializarIncidencia(i: IncidenciaConRelaciones): FilaIncidencia {
  return {
    id: i.id,
    // BigInt no sobrevive a JSON.stringify: siempre string en el borde.
    growattPlantId: i.growattPlantId?.toString() ?? null,
    huaweiPlantId: i.huaweiPlantId,
    marca: i.huaweiPlantId ? "HUAWEI" : "GROWATT",
    plantName: i.plant?.name ?? i.huaweiPlant?.name ?? "—",
    projectId: i.projectId,
    clientName: i.project?.clientName ?? null,
    diagnostico: i.diagnostico,
    estado: i.estado,
    detalle: i.detalle,
    primeraDeteccionEn: dateADia(i.primeraDeteccionEn),
    ultimaDeteccionEn: dateADia(i.ultimaDeteccionEn),
    resueltaEn: i.resueltaEn ? dateADia(i.resueltaEn) : null,
    diasAfectados: i.diasAfectados,
    ultimaGeneracionEn: i.ultimaGeneracionEn ? dateADia(i.ultimaGeneracionEn) : null,
    revisada: i.revisadaEn != null,
    revisadaPor: i.revisadaPor?.name ?? null,
    revisadaEn: i.revisadaEn?.toISOString() ?? null,
    nota: i.nota,
    notificada: i.notificadaEn != null,
  };
}

export interface FiltrosIncidencias {
  estado?: FvIncidenciaEstado;
  diagnostico?: FvDiagnostico;
  projectId?: string;
  desde?: Dia;
  hasta?: Dia;
  limit?: number;
}

export async function listarIncidencias(f: FiltrosIncidencias = {}): Promise<FilaIncidencia[]> {
  const where: Prisma.FvIncidenciaWhereInput = {};
  if (f.estado) where.estado = f.estado;
  if (f.diagnostico) where.diagnostico = f.diagnostico;
  if (f.projectId) where.projectId = f.projectId;
  if (f.desde || f.hasta) {
    where.primeraDeteccionEn = {
      ...(f.desde ? { gte: diaADate(f.desde) } : {}),
      ...(f.hasta ? { lte: diaADate(f.hasta) } : {}),
    };
  }

  const filas = await prisma.fvIncidencia.findMany({
    where,
    include: INCLUDE_FILA,
    orderBy: [{ estado: "asc" }, { primeraDeteccionEn: "desc" }],
    take: Math.min(f.limit ?? 200, 500),
  });
  return filas.map(serializarIncidencia);
}

/**
 * Marcar como revisada NO cierra la incidencia: sigue abierta hasta que la
 * planta vuelva a generar. "La vi" y "está resuelta" son cosas distintas, y
 * confundirlas haría desaparecer del panel problemas que siguen vivos.
 */
export async function marcarRevisada(
  incidenciaId: string,
  userId: string,
  nota?: string | null,
): Promise<FilaIncidencia> {
  const i = await prisma.fvIncidencia.update({
    where: { id: incidenciaId },
    data: { revisadaPorId: userId, revisadaEn: new Date(), ...(nota != null ? { nota } : {}) },
    include: INCLUDE_FILA,
  });
  return serializarIncidencia(i);
}

/** Descartar = falso positivo o caso que no amerita seguimiento. Exige nota. */
export async function descartarIncidencia(
  incidenciaId: string,
  userId: string,
  nota: string,
): Promise<FilaIncidencia> {
  const i = await prisma.fvIncidencia.update({
    where: { id: incidenciaId },
    data: {
      estado: FvIncidenciaEstado.DESCARTADA,
      revisadaPorId: userId,
      revisadaEn: new Date(),
      nota,
    },
    include: INCLUDE_FILA,
  });
  return serializarIncidencia(i);
}

// Edición manual de lecturas mensuales.
//
// Sirve para los generadores de otras marcas (sin API) y para completar los
// meses en que el smart meter de Growatt falló. Un valor cargado a mano queda
// con fuente MANUAL, que la ingesta automática no pisa (salvo force explícito).
//
// Tras guardar hay que recalcular la serie; lo hace el caller (la ruta), para
// no crear un ciclo de imports con calculo.service.

import { type Prisma, ReporteFvFuente } from "@prisma/client";

import { prisma } from "../../lib/prisma.js";
import { notFound } from "../../utils/errors.js";
import { type Periodo, periodoADate } from "./periodo.js";

export interface LecturaManualInput {
  generacionKwh?: number | null;
  consumoKwh?: number | null;
  exportacionKwh?: number | null;
  nota?: string | null;
}

/**
 * Carga o corrige una lectura a mano. Cada campo que venga (incluido null
 * explícito para borrarlo) se marca con fuente MANUAL. Los campos que no vienen
 * (undefined) se dejan como estaban.
 */
export async function upsertLecturaManual(
  projectId: string,
  periodo: Periodo,
  input: LecturaManualInput,
  userId: string,
): Promise<void> {
  const proyecto = await prisma.project.findFirst({
    where: { id: projectId, deletedAt: null },
    select: { id: true },
  });
  if (!proyecto) throw notFound("PROYECTO_NO_ENCONTRADO", "El proyecto no existe");

  const fecha = periodoADate(periodo);
  const existente = await prisma.reporteFvLectura.findUnique({
    where: { projectId_periodo: { projectId, periodo: fecha } },
  });

  // Sólo los campos presentes se tocan; cada uno presente pasa a fuente MANUAL.
  const data: Prisma.ReporteFvLecturaUncheckedUpdateInput = {
    editadoPorId: userId,
    editadoEn: new Date(),
  };
  if (input.generacionKwh !== undefined) {
    data.generacionKwh = input.generacionKwh;
    data.generacionFuente = input.generacionKwh == null ? null : ReporteFvFuente.MANUAL;
  }
  if (input.consumoKwh !== undefined) {
    data.consumoKwh = input.consumoKwh;
    data.consumoFuente = input.consumoKwh == null ? null : ReporteFvFuente.MANUAL;
  }
  if (input.exportacionKwh !== undefined) {
    data.exportacionKwh = input.exportacionKwh;
    data.exportacionFuente = input.exportacionKwh == null ? null : ReporteFvFuente.MANUAL;
  }
  if (input.nota !== undefined) data.nota = input.nota;

  if (existente) {
    await prisma.reporteFvLectura.update({
      where: { projectId_periodo: { projectId, periodo: fecha } },
      data,
    });
  } else {
    await prisma.reporteFvLectura.create({
      data: {
        projectId,
        periodo: fecha,
        generacionKwh: input.generacionKwh ?? null,
        consumoKwh: input.consumoKwh ?? null,
        exportacionKwh: input.exportacionKwh ?? null,
        generacionFuente: input.generacionKwh == null ? null : ReporteFvFuente.MANUAL,
        consumoFuente: input.consumoKwh == null ? null : ReporteFvFuente.MANUAL,
        exportacionFuente: input.exportacionKwh == null ? null : ReporteFvFuente.MANUAL,
        nota: input.nota ?? null,
        editadoPorId: userId,
        editadoEn: new Date(),
      },
    });
  }
}

const dec = (v: Prisma.Decimal | null | undefined): number | null => (v == null ? null : Number(v));

/** Lecturas de un proyecto (todas), para el detalle del generador. */
export async function listarLecturas(projectId: string) {
  const filas = await prisma.reporteFvLectura.findMany({
    where: { projectId },
    orderBy: { periodo: "desc" },
  });
  return filas.map((l) => ({
    periodo: `${l.periodo.getUTCFullYear()}-${String(l.periodo.getUTCMonth() + 1).padStart(2, "0")}`,
    generacionKwh: dec(l.generacionKwh),
    consumoKwh: dec(l.consumoKwh),
    exportacionKwh: dec(l.exportacionKwh),
    generacionFuente: l.generacionFuente,
    consumoFuente: l.consumoFuente,
    exportacionFuente: l.exportacionFuente,
    diasConDatos: l.diasConDatos,
    diasEsperados: l.diasEsperados,
    motivoFaltante: l.motivoFaltante,
    nota: l.nota,
  }));
}

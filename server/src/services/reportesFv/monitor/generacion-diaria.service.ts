// Serie diaria de generación por proyecto.
//
// La trae el monitoreo (que igual necesita los últimos días para decidir si la
// planta está viva) y la lee además el portal del cliente. Es el único lugar
// donde se persiste el dato diario: antes se pedía a Growatt, se sumaba y se
// tiraba.

import { Prisma, ReporteFvFuente } from "@prisma/client";
import { prisma } from "../../../lib/prisma.js";
import { diaADate, dateADia, type Dia } from "./dias.js";

/**
 * Upsert idempotente de la serie de un proyecto. Re-correr con los mismos datos
 * no cambia nada; re-correr con datos nuevos (Growatt consolida un día tarde)
 * los pisa.
 *
 * Un valor MANUAL no se pisa con GROWATT: si alguien corrigió un día a mano fue
 * porque el dato de la API estaba mal.
 */
/** Exportación del día. Se guarda aparte porque viene de otra consulta. */
export async function guardarExportacionDiaria(
  projectId: string,
  dia: Dia,
  exportacionKwh: number,
): Promise<void> {
  // Sólo actualiza si la fila ya existe: la exportación cuelga de un día que ya
  // tiene generación. Sin generación registrada, un dato de exportación suelto
  // no se puede interpretar.
  await prisma.reporteFvGeneracionDiaria.updateMany({
    where: { projectId, fecha: diaADate(dia) },
    data: { exportacionKwh: new Prisma.Decimal(exportacionKwh.toFixed(2)) },
  });
}

export async function guardarGeneracionDiaria(
  projectId: string,
  growattPlantId: bigint | null,
  serie: Map<Dia, number>,
): Promise<number> {
  if (serie.size === 0) return 0;

  const dias = [...serie.keys()];
  const manuales = await prisma.reporteFvGeneracionDiaria.findMany({
    where: {
      projectId,
      fecha: { in: dias.map(diaADate) },
      fuente: ReporteFvFuente.MANUAL,
    },
    select: { fecha: true },
  });
  const protegidos = new Set(manuales.map((m) => dateADia(m.fecha)));

  let escritos = 0;
  for (const [dia, kwh] of serie) {
    if (protegidos.has(dia)) continue;
    if (!Number.isFinite(kwh) || kwh < 0) continue;
    const valor = new Prisma.Decimal(kwh.toFixed(2));
    await prisma.reporteFvGeneracionDiaria.upsert({
      where: { projectId_fecha: { projectId, fecha: diaADate(dia) } },
      create: {
        projectId,
        fecha: diaADate(dia),
        generacionKwh: valor,
        fuente: ReporteFvFuente.GROWATT,
        growattPlantId,
      },
      update: { generacionKwh: valor, fuente: ReporteFvFuente.GROWATT, growattPlantId },
    });
    escritos++;
  }
  return escritos;
}

export interface DiaGeneracion {
  fecha: Dia;
  generacionKwh: number;
}

/** Serie de un proyecto en un rango, ordenada. Lee la tabla; no toca Growatt. */
export async function leerGeneracionDiaria(
  projectId: string,
  desde: Dia,
  hasta: Dia,
): Promise<DiaGeneracion[]> {
  const filas = await prisma.reporteFvGeneracionDiaria.findMany({
    where: { projectId, fecha: { gte: diaADate(desde), lte: diaADate(hasta) } },
    orderBy: { fecha: "asc" },
    select: { fecha: true, generacionKwh: true },
  });
  return filas.map((f) => ({
    fecha: dateADia(f.fecha),
    generacionKwh: Number(f.generacionKwh),
  }));
}

/** La misma serie como Map, que es lo que consume el diagnóstico. */
export async function leerHistorial(
  projectId: string,
  desde: Dia,
  hasta: Dia,
): Promise<Map<Dia, number>> {
  const filas = await leerGeneracionDiaria(projectId, desde, hasta);
  return new Map(filas.map((f) => [f.fecha, f.generacionKwh]));
}

/** Generación + exportación por día, para evaluar si la planta está inyectando. */
export async function leerHistorialConExportacion(
  projectId: string,
  desde: Dia,
  hasta: Dia,
): Promise<Map<Dia, { generacionKwh: number | null; exportacionKwh: number | null }>> {
  const filas = await prisma.reporteFvGeneracionDiaria.findMany({
    where: { projectId, fecha: { gte: diaADate(desde), lte: diaADate(hasta) } },
    orderBy: { fecha: "asc" },
    select: { fecha: true, generacionKwh: true, exportacionKwh: true },
  });
  return new Map(
    filas.map((f) => [
      dateADia(f.fecha),
      {
        generacionKwh: Number(f.generacionKwh),
        exportacionKwh: f.exportacionKwh != null ? Number(f.exportacionKwh) : null,
      },
    ]),
  );
}

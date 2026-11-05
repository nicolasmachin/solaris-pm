// La noche de las plantas cuyo inversor se apaga sin sol.
//
// El inversor (y con él el datalogger) deja de mandar datos al atardecer, y sus
// contadores no suman lo de la noche: un MIN con medidor conectado marcaba 6,5
// kWh comprados en un día en que el medidor contó 13,1. El medidor sí cuenta,
// pero recién lo informa al amanecer: su primer "comprado hoy" es todo lo que se
// compró desde su último dato de ayer (Yamandú Ramos: el último menos el primero
// del medidor da exactamente lo del inversor, tres días seguidos).
//
// Se pide una vez por noche, a la mañana, y se guarda en `FvNoche`. La curva no
// se toca: la noche se le agrega al leerla (`completarNoche`), y los totales de
// la serie diaria (pestañas Día/Mes/Año) se actualizan acá.

import { Prisma } from "@prisma/client";

import { prisma } from "../../../lib/prisma.js";
import { growattEnFilaCurva, primeraLecturaMedidor, ultimaLecturaMedidor } from "../growatt/client.js";
import { dateADia, diaADate, sumarDias, type Dia } from "../monitor/dias.js";
import { resolverMedidor } from "../monitor/monitor.service.js";
import { completarNoche, type PuntoCurva, type TramoNoche } from "./curva.js";

const HORA_MS = 60 * 60 * 1000;
// Un primer dato después de esta hora no es el amanecer: la planta estuvo sin
// comunicar, y lo que trae el contador no es la noche.
const AMANECER_MAX_UY = 11;
// Menos que esto es una planta que reporta de noche (no hay hueco que llenar).
const NOCHE_MIN_MS = 2 * HORA_MS;
// Más que esto, faltó comunicación además de la noche.
const NOCHE_MAX_MS = 20 * HORA_MS;

export async function nochesDeLaCurva(projectId: string, dia: Dia) {
  const filas = await prisma.fvNoche.findMany({
    where: { projectId, fecha: { in: [diaADate(dia), diaADate(sumarDias(dia, 1))] } },
  });
  const tramo = (d: Dia): TramoNoche | null => {
    const f = filas.find((x) => dateADia(x.fecha) === d);
    return f ? { kwh: Number(f.kwh), desde: f.desde, hasta: f.hasta } : null;
  };
  return { antes: tramo(dia), despues: tramo(sumarDias(dia, 1)) };
}

/** Pide y guarda la noche que termina en `dia`. Devuelve si quedó guardada. */
export async function guardarNoche(projectId: string, plantId: bigint, dia: Dia): Promise<boolean> {
  const fecha = diaADate(dia);
  const ya = await prisma.fvNoche.findUnique({ where: { projectId_fecha: { projectId, fecha } }, select: { id: true } });
  if (ya) return true;

  const medidor = await growattEnFilaCurva(() => resolverMedidor(plantId, () => undefined));
  if (!medidor) return false;

  const primera = await primeraLecturaMedidor(medidor.dataloggerSn, medidor.address, dia);
  if (!primera) return false;
  const horaUy = new Date(primera.ts.getTime() - 3 * HORA_MS).getUTCHours();
  if (horaUy >= AMANECER_MAX_UY) return false;
  // El medidor ya reportaba a esta hora: una planta que no se apaga de noche.
  if (horaUy < 1) return false;

  const ultima = await ultimaLecturaMedidor(medidor.dataloggerSn, medidor.address, sumarDias(dia, -1));
  if (!ultima) return false;
  const dur = primera.ts.getTime() - ultima.ts.getTime();
  if (dur < NOCHE_MIN_MS || dur > NOCHE_MAX_MS) return false;

  const datos = { kwh: new Prisma.Decimal(primera.deRedHoyKwh.toFixed(2)), desde: ultima.ts, hasta: primera.ts };
  await prisma.fvNoche.upsert({
    where: { projectId_fecha: { projectId, fecha } },
    create: { projectId, fecha, ...datos },
    update: datos,
  });
  return true;
}

/**
 * Suma la noche a los totales del día en la serie diaria. Parte siempre de los
 * totales guardados en la curva (sin noche), así que se puede repetir. Solo para
 * el medidor conectado al inversor: con el medidor aparte (MAX) el contador ya
 * trae la noche.
 */
export async function actualizarTotalesConNoche(projectId: string, dia: Dia): Promise<void> {
  const fila = await prisma.fvCurvaDia.findUnique({ where: { projectId_fecha: { projectId, fecha: diaADate(dia) } } });
  if (!fila || !fila.completo || fila.origenMedicion !== "INVERSOR") return;
  if (fila.consumoKwh === null || fila.importacionKwh === null) return;
  const { antes, despues } = await nochesDeLaCurva(projectId, dia);
  const { kwh } = completarNoche(dia, (fila.puntos as unknown as PuntoCurva[]) ?? [], antes, despues);
  if (kwh <= 0) return;
  await prisma.reporteFvGeneracionDiaria.updateMany({
    where: { projectId, fecha: diaADate(dia) },
    data: {
      consumoKwh: new Prisma.Decimal((Number(fila.consumoKwh) + kwh).toFixed(2)),
      importacionKwh: new Prisma.Decimal((Number(fila.importacionKwh) + kwh).toFixed(2)),
    },
  });
}

/** Noches de un rango de días de una planta, con sus totales. Para el relleno. */
export async function reconstruirNochesDePlanta(projectId: string, plantId: bigint, dias: Dia[]) {
  let guardadas = 0;
  for (const dia of dias) if (await guardarNoche(projectId, plantId, dia)) guardadas++;
  // Un día usa la noche que lo abre y la que lo cierra.
  for (const dia of new Set(dias.flatMap((d) => [d, sumarDias(d, -1)]))) await actualizarTotalesConNoche(projectId, dia);
  return guardadas;
}

/**
 * La corrida de cada mañana, para todas las plantas Growatt: la noche que acaba
 * de terminar y la anterior (por si ayer el equipo arrancó después de la corrida).
 */
export async function reconstruirNoches(hoy: Dia): Promise<{ plantas: number; fallidas: number }> {
  const plantas = await prisma.growattPlant.findMany({
    where: { projectId: { not: null }, ignorada: false },
    select: { projectId: true, plantId: true },
  });
  let fallidas = 0;
  for (const p of plantas) {
    try {
      await reconstruirNochesDePlanta(p.projectId!, p.plantId, [sumarDias(hoy, -1), hoy]);
    } catch (err) {
      fallidas++;
      console.error(`[energia-noche] planta ${p.plantId}:`, err);
    }
  }
  return { plantas: plantas.length, fallidas };
}

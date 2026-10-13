// Vista de energía de una planta (como la aplicación de Growatt): curva del día
// (pestaña "Hora"), días del mes, meses del año y años.
//
// Hora: se pide a Growatt cuando alguien abre el día y se guarda en
// `FvCurvaDia`. Un día cerrado no se vuelve a pedir; el día en curso se refresca
// si el dato tiene más de 5 minutos (el equipo sube datos cada 5). No se
// consulta en segundo plano cada 5 minutos: con ~60 plantas sería una consulta
// cada 5 segundos, en el borde de lo que Growatt tolera, y la curva entera del
// día ya viene en una sola tanda.
//
// Día / Mes / Año: salen de lo guardado (`ReporteFvGeneracionDiaria` por día,
// `ReporteFvLectura` por mes), sin llamar a Growatt.
//
// Solo Growatt tiene curva por ahora. Huawei tiene días, meses y años.

import { Prisma, ReporteFvFuente } from "@prisma/client";

import { prisma } from "../../../lib/prisma.js";
import { badRequest } from "../../../utils/errors.js";
import {
  growattEnFilaCurva,
  listarDispositivos,
  muestrasInversorDelDia,
  muestrasMedidorCurva,
  type MuestraInversor,
} from "../growatt/client.js";
import { guardarDispositivos, resolverMedidor } from "../monitor/monitor.service.js";
import { dateADia, diaADate, esDiaValido, type Dia } from "../monitor/dias.js";
import { armarCurva, resumenEnergia, type OrigenMedicion, type PuntoCurva } from "./curva.js";

/** Tipos de inversor de los que Growatt da curva: 7 = MIN (TLX), 4 = MAX. */
const TIPOS_CON_CURVA = new Set([7, 4]);
const REFRESCO_DIA_EN_CURSO_MS = 5 * 60 * 1000;

/** Hoy en Uruguay (UTC-3 todo el año). */
export function hoyUy(ahora: Date = new Date()): Dia {
  return dateADia(new Date(ahora.getTime() - 3 * 60 * 60 * 1000));
}

export type MarcaPlanta = "GROWATT" | "HUAWEI" | null;

async function marcaDe(projectId: string): Promise<{ marca: MarcaPlanta; plantId: bigint | null }> {
  const gw = await prisma.growattPlant.findFirst({
    where: { projectId, ignorada: false },
    select: { plantId: true },
  });
  if (gw) return { marca: "GROWATT", plantId: gw.plantId };
  const hw = await prisma.huaweiPlant.findFirst({ where: { projectId, ignorada: false }, select: { id: true } });
  return { marca: hw ? "HUAWEI" : null, plantId: null };
}

export interface CurvaDiaRespuesta {
  dia: Dia;
  marca: MarcaPlanta;
  /** false = esta planta no tiene curva (Huawei, o sin planta vinculada). */
  disponible: boolean;
  motivo: string | null;
  puntos: PuntoCurva[];
  resumen: ReturnType<typeof resumenEnergia>;
  origenMedicion: OrigenMedicion | null;
  completo: boolean;
  actualizadoEn: string | null;
}

const VACIO = resumenEnergia({ generacionKwh: null, consumoKwh: null, importacionKwh: null, exportacionKwh: null });

const dec = (n: number | null) => (n === null ? null : new Prisma.Decimal(n.toFixed(2)));
const num = (d: Prisma.Decimal | null) => (d === null ? null : Number(d));

function respuestaDesdeFila(
  fila: {
    fecha: Date;
    puntos: Prisma.JsonValue;
    generacionKwh: Prisma.Decimal | null;
    consumoKwh: Prisma.Decimal | null;
    importacionKwh: Prisma.Decimal | null;
    exportacionKwh: Prisma.Decimal | null;
    origenMedicion: string | null;
    completo: boolean;
    updatedAt: Date;
  },
  marca: MarcaPlanta,
): CurvaDiaRespuesta {
  return {
    dia: dateADia(fila.fecha),
    marca,
    disponible: true,
    motivo: null,
    puntos: (fila.puntos as unknown as PuntoCurva[]) ?? [],
    resumen: resumenEnergia({
      generacionKwh: num(fila.generacionKwh),
      consumoKwh: num(fila.consumoKwh),
      importacionKwh: num(fila.importacionKwh),
      exportacionKwh: num(fila.exportacionKwh),
    }),
    origenMedicion: (fila.origenMedicion as OrigenMedicion | null) ?? null,
    completo: fila.completo,
    actualizadoEn: fila.updatedAt.toISOString(),
  };
}

// Plantas que no tienen medidor (no se vuelve a preguntar hasta este momento).
const sinMedidor = new Map<string, number>();

// Un mismo día de una planta no se pide dos veces en paralelo (dos personas
// abriendo la ficha a la vez): la segunda espera a la primera.
const enCurso = new Map<string, Promise<CurvaDiaRespuesta>>();

/**
 * Curva de un día. `forzar` vuelve a pedir el día en curso aunque el dato sea
 * reciente (botón "Actualizar"); un día cerrado nunca se vuelve a pedir.
 */
export async function obtenerCurvaDia(
  projectId: string,
  dia: Dia,
  opts: { forzar?: boolean; ahora?: Date } = {},
): Promise<CurvaDiaRespuesta> {
  if (!esDiaValido(dia)) throw badRequest("DIA_INVALIDO", "La fecha tiene que ser AAAA-MM-DD");
  const ahora = opts.ahora ?? new Date();
  const hoy = hoyUy(ahora);
  if (dia > hoy) throw badRequest("DIA_FUTURO", "Ese día todavía no pasó");

  const { marca, plantId } = await marcaDe(projectId);
  if (marca !== "GROWATT" || plantId === null) {
    return {
      dia, marca, disponible: false,
      motivo: marca === "HUAWEI"
        ? "La curva por hora todavía no está disponible para inversores Huawei."
        : "El proyecto no tiene una planta de monitoreo vinculada.",
      puntos: [], resumen: VACIO, origenMedicion: null, completo: false, actualizadoEn: null,
    };
  }

  const fila = await prisma.fvCurvaDia.findUnique({
    where: { projectId_fecha: { projectId, fecha: diaADate(dia) } },
  });
  const fresca =
    fila && (fila.completo || (!opts.forzar && ahora.getTime() - fila.updatedAt.getTime() < REFRESCO_DIA_EN_CURSO_MS));
  if (fila && fresca) return respuestaDesdeFila(fila, marca);

  // No se le pide a Growatt un día anterior al primer dato de la planta: cada
  // pedido cuesta 3 a 6 consultas y dejaría guardado un día vacío.
  if (!fila) {
    const primero = await prisma.reporteFvGeneracionDiaria.findFirst({
      where: { projectId },
      orderBy: { fecha: "asc" },
      select: { fecha: true },
    });
    if (primero && dia < dateADia(primero.fecha)) {
      return {
        dia, marca, disponible: false,
        motivo: `No hay datos de este día: el primero de la planta es del ${dateADia(primero.fecha).split("-").reverse().join("/")}.`,
        puntos: [], resumen: VACIO, origenMedicion: null, completo: false, actualizadoEn: null,
      };
    }
  }

  const clave = `${projectId}:${dia}`;
  const pendiente = enCurso.get(clave);
  if (pendiente) return pendiente;
  // Un día se da por cerrado recién 2 horas después de terminar: el datalogger
  // a veces sube los últimos registros con atraso.
  const finDelDiaUy = new Date(`${dia}T23:59:59-03:00`).getTime();
  const cerrado = ahora.getTime() - finDelDiaUy > 2 * 60 * 60 * 1000;
  const tarea = pedirYGuardar(projectId, plantId, dia, cerrado).finally(() => enCurso.delete(clave));
  enCurso.set(clave, tarea);
  return tarea;
}

async function pedirYGuardar(projectId: string, plantId: bigint, dia: Dia, diaCerrado: boolean): Promise<CurvaDiaRespuesta> {
  let completo = diaCerrado;
  // Inversores de la planta: del caché del monitoreo; si no está, se pregunta.
  let inversores = await prisma.growattDevice.findMany({
    where: { growattPlantId: plantId, tipo: { in: [...TIPOS_CON_CURVA] } },
    select: { deviceSn: true, tipo: true },
  });
  if (inversores.length === 0) {
    // Se guardan en el mismo caché del monitoreo, así no se vuelve a preguntar
    // (en un relleno de 30 días serían 30 consultas de más). Un mismo equipo a
    // veces aparece dos veces con tipos distintos (1 y 4): se guardan los de
    // curva al final para que queden ellos.
    const devs = await growattEnFilaCurva(() => listarDispositivos(plantId.toString()));
    const ordenados = [...devs].sort((a, b) => Number(TIPOS_CON_CURVA.has(a.tipo)) - Number(TIPOS_CON_CURVA.has(b.tipo)));
    await guardarDispositivos(plantId, ordenados).catch(() => undefined);
    inversores = devs.filter((d) => TIPOS_CON_CURVA.has(d.tipo) && d.deviceSn).map((d) => ({ deviceSn: d.deviceSn, tipo: d.tipo }));
  }
  if (inversores.length === 0) {
    return {
      dia, marca: "GROWATT", disponible: false,
      motivo: "Growatt no da la curva de este modelo de inversor.",
      puntos: [], resumen: VACIO, origenMedicion: null, completo, actualizadoEn: null,
    };
  }

  // Un inversor que falla (Growatt cortó, o un equipo viejo que quedó en el
  // caché) no tira abajo la curva entera; pero el día queda abierto para
  // volver a pedirse. Lo mismo un día cerrado sin registros de algún inversor.
  const muestras: MuestraInversor[][] = [];
  let ultimoError: unknown = null;
  for (const inv of inversores) {
    try {
      const m = await muestrasInversorDelDia(inv.deviceSn, inv.tipo, dia);
      if (m.length === 0) completo = false;
      muestras.push(m);
    } catch (err) {
      ultimoError = err;
      completo = false;
    }
  }
  if (muestras.length === 0) throw ultimoError ?? new Error("Growatt no devolvió datos");

  // El medidor aparte se pide solo si el inversor no trae la medición (MAX, o
  // MIN al que no le llega el medidor).
  let medidor = null;
  // Si la planta tiene medidor y no se pudo leer (Growatt cortó), el día no se
  // da por cerrado: quedaría guardado sin consumo para siempre.
  let medidorFallo = false;
  const traeMedicion = muestras.some((m) => m.some((x) => (x.consumo ?? 0) > 0 || (x.deRed ?? 0) > 0 || (x.aRed ?? 0) > 0));
  const sinMedidorHasta = sinMedidor.get(plantId.toString()) ?? 0;
  if (!traeMedicion && Date.now() > sinMedidorHasta) {
    let ubicado: Awaited<ReturnType<typeof resolverMedidor>> = null;
    try {
      ubicado = await growattEnFilaCurva(() => resolverMedidor(plantId, () => undefined));
      // Una planta sin medidor no se vuelve a preguntar por un día: cada
      // pregunta es una lista de equipos más.
      if (!ubicado) sinMedidor.set(plantId.toString(), Date.now() + 24 * 60 * 60 * 1000);
    } catch {
      medidorFallo = true;
    }
    if (ubicado) {
      try {
        medidor = await muestrasMedidorCurva(ubicado.dataloggerSn, ubicado.address, dia);
        // Tiene medidor y en un día cerrado no devolvió nada: Growatt cortó.
        if (medidor.length === 0) medidorFallo = true;
      } catch {
        medidorFallo = true;
      }
    }
  }
  if (medidorFallo) completo = false;

  const curva = armarCurva({ inversores: muestras, medidor });
  const datos = {
    puntos: curva.puntos as unknown as Prisma.InputJsonValue,
    generacionKwh: dec(curva.totales.generacionKwh),
    consumoKwh: dec(curva.totales.consumoKwh),
    importacionKwh: dec(curva.totales.importacionKwh),
    exportacionKwh: dec(curva.totales.exportacionKwh),
    origenMedicion: curva.origenMedicion,
    completo,
    fuente: ReporteFvFuente.GROWATT,
  };
  const fila = await prisma.fvCurvaDia.upsert({
    where: { projectId_fecha: { projectId, fecha: diaADate(dia) } },
    create: { projectId, fecha: diaADate(dia), ...datos },
    update: datos,
  });

  // Un día cerrado deja sus totales en la serie diaria (pestaña "Día" y el
  // portal). El día en curso no: estaría a medias.
  if (completo) await guardarTotalesDelDia(projectId, plantId, dia, curva.totales, curva.origenMedicion);

  return respuestaDesdeFila(fila, "GROWATT");
}

/**
 * Totales de un día cerrado en la serie diaria (pestaña "Día" y el portal).
 *
 * La generación que ya está NO se pisa: la escribe el monitoreo con el total de
 * la planta (el mismo de la aplicación de Growatt), o alguien a mano. La curva
 * solo la crea si falta. Lo que sí se escribe es la medición (consumo,
 * importación, exportación). Y cuando el consumo sale del medidor aparte
 * (producción + red − exportado), se recalcula con la generación guardada, para
 * que el día cierre consigo mismo.
 */
async function guardarTotalesDelDia(
  projectId: string,
  plantId: bigint,
  dia: Dia,
  t: { generacionKwh: number | null; consumoKwh: number | null; importacionKwh: number | null; exportacionKwh: number | null },
  origen: OrigenMedicion | null,
) {
  const existente = await prisma.reporteFvGeneracionDiaria.findUnique({
    where: { projectId_fecha: { projectId, fecha: diaADate(dia) } },
    select: { id: true, generacionKwh: true },
  });
  let consumo = t.consumoKwh;
  if (existente && origen === "MEDIDOR" && t.importacionKwh !== null && t.exportacionKwh !== null) {
    consumo = Math.max(0, Number(existente.generacionKwh) + t.importacionKwh - t.exportacionKwh);
  }
  const medicion = {
    ...(consumo !== null ? { consumoKwh: dec(consumo) } : {}),
    ...(t.importacionKwh !== null ? { importacionKwh: dec(t.importacionKwh) } : {}),
    ...(t.exportacionKwh !== null ? { exportacionKwh: dec(t.exportacionKwh) } : {}),
  };
  if (existente) {
    await prisma.reporteFvGeneracionDiaria.update({ where: { id: existente.id }, data: medicion });
  } else if (t.generacionKwh !== null) {
    await prisma.reporteFvGeneracionDiaria.create({
      data: {
        projectId,
        fecha: diaADate(dia),
        generacionKwh: dec(t.generacionKwh)!,
        fuente: ReporteFvFuente.GROWATT,
        growattPlantId: plantId,
        ...medicion,
      },
    });
  }
}

// ─── Día / Mes / Año (de lo guardado) ────────────────────────────────────────

export interface BarraEnergia {
  /** "YYYY-MM-DD" (días), "YYYY-MM" (meses) o "YYYY" (años). */
  clave: string;
  generacionKwh: number | null;
  consumoKwh: number | null;
  exportacionKwh: number | null;
  importacionKwh: number | null;
}

function sumar(barras: BarraEnergia[]) {
  const s = (campo: keyof Omit<BarraEnergia, "clave">) => {
    const vals = barras.map((b) => b[campo]).filter((v): v is number => v !== null);
    return vals.length ? Math.round(vals.reduce((a, b) => a + b, 0) * 100) / 100 : null;
  };
  // El consumo y la red solo se suman si todos los días que tienen producción
  // los tienen: un total con días faltantes subestimaría el consumo.
  const conGen = barras.filter((b) => b.generacionKwh !== null);
  const completo = (campo: "consumoKwh" | "exportacionKwh" | "importacionKwh") =>
    conGen.length > 0 && conGen.every((b) => b[campo] !== null);
  return {
    ...resumenEnergia({
      generacionKwh: s("generacionKwh"),
      consumoKwh: completo("consumoKwh") ? s("consumoKwh") : null,
      exportacionKwh: completo("exportacionKwh") ? s("exportacionKwh") : null,
      importacionKwh: completo("importacionKwh") ? s("importacionKwh") : null,
    }),
    // Para que la pantalla distinga "esta planta no mide el consumo" (0 de N)
    // de "falta medir algunos días" (antes de esta función, o un día en que el
    // medidor no respondió).
    cobertura: {
      conProduccion: conGen.length,
      conConsumo: conGen.filter((b) => b.consumoKwh !== null).length,
    },
  };
}

/** Días de un mes ("YYYY-MM"). */
export async function obtenerDiasDelMes(projectId: string, periodo: string) {
  if (!/^\d{4}-\d{2}$/.test(periodo)) throw badRequest("PERIODO_INVALIDO", "El mes tiene que ser AAAA-MM");
  const [anio, mes] = periodo.split("-").map(Number);
  const desde = new Date(Date.UTC(anio, mes - 1, 1));
  const hasta = new Date(Date.UTC(anio, mes, 0));
  const filas = await prisma.reporteFvGeneracionDiaria.findMany({
    where: { projectId, fecha: { gte: desde, lte: hasta } },
    orderBy: { fecha: "asc" },
  });
  const barras: BarraEnergia[] = filas.map((f) => ({
    clave: dateADia(f.fecha),
    generacionKwh: Number(f.generacionKwh),
    consumoKwh: num(f.consumoKwh),
    exportacionKwh: num(f.exportacionKwh),
    importacionKwh: num(f.importacionKwh),
  }));
  const { marca } = await marcaDe(projectId);
  return { periodo, marca, diasDelMes: hasta.getUTCDate(), barras, resumen: sumar(barras) };
}

/**
 * Meses de un año. Un mes con lectura mensual (la de los reportes FV) usa esa;
 * si no la tiene (el mes en curso, o meses sin reporte), se suma la serie diaria.
 */
export async function obtenerMesesDelAnio(projectId: string, anio: number) {
  if (!Number.isInteger(anio) || anio < 2000 || anio > 2100) throw badRequest("ANIO_INVALIDO", "Año inválido");
  const barras = await mesesEntre(projectId, new Date(Date.UTC(anio, 0, 1)), new Date(Date.UTC(anio, 11, 31)));
  const { marca } = await marcaDe(projectId);
  return { anio, marca, barras, resumen: sumar(barras) };
}

async function mesesEntre(projectId: string, desde: Date, hasta: Date): Promise<BarraEnergia[]> {
  const [lecturas, dias] = await Promise.all([
    prisma.reporteFvLectura.findMany({
      where: { projectId, periodo: { gte: desde, lte: hasta } },
      orderBy: { periodo: "asc" },
    }),
    prisma.reporteFvGeneracionDiaria.findMany({
      where: { projectId, fecha: { gte: desde, lte: hasta } },
      orderBy: { fecha: "asc" },
    }),
  ]);
  const porMes = new Map<string, BarraEnergia>();
  // Primero la serie diaria agrupada…
  const diasPorMes = new Map<string, BarraEnergia[]>();
  for (const f of dias) {
    const k = dateADia(f.fecha).slice(0, 7);
    const arr = diasPorMes.get(k) ?? [];
    arr.push({
      clave: dateADia(f.fecha),
      generacionKwh: Number(f.generacionKwh),
      consumoKwh: num(f.consumoKwh),
      exportacionKwh: num(f.exportacionKwh),
      importacionKwh: num(f.importacionKwh),
    });
    diasPorMes.set(k, arr);
  }
  for (const [k, arr] of diasPorMes) {
    const s = sumar(arr);
    porMes.set(k, {
      clave: k,
      generacionKwh: s.generacionKwh,
      consumoKwh: s.consumoKwh,
      exportacionKwh: s.exportacionKwh,
      importacionKwh: s.importacionKwh,
    });
  }
  // …y la lectura mensual, que es la oficial, le gana cuando existe.
  for (const l of lecturas) {
    const k = dateADia(l.periodo).slice(0, 7);
    const gen = num(l.generacionKwh);
    const cons = num(l.consumoKwh);
    const exp = num(l.exportacionKwh);
    if (gen === null) continue;
    const imp = cons !== null && exp !== null ? Math.max(0, Math.round((cons - (gen - exp)) * 100) / 100) : null;
    porMes.set(k, { clave: k, generacionKwh: gen, consumoKwh: cons, exportacionKwh: exp, importacionKwh: imp });
  }
  return [...porMes.values()].sort((a, b) => a.clave.localeCompare(b.clave));
}

/** Un total por año, desde el primer dato. */
export async function obtenerAnios(projectId: string) {
  const meses = await mesesEntre(projectId, new Date(Date.UTC(2000, 0, 1)), new Date(Date.UTC(2100, 0, 1)));
  const porAnio = new Map<string, BarraEnergia[]>();
  for (const m of meses) {
    const k = m.clave.slice(0, 4);
    const arr = porAnio.get(k) ?? [];
    arr.push(m);
    porAnio.set(k, arr);
  }
  const barras: BarraEnergia[] = [...porAnio].map(([k, arr]) => {
    const s = sumar(arr);
    return { clave: k, generacionKwh: s.generacionKwh, consumoKwh: s.consumoKwh, exportacionKwh: s.exportacionKwh, importacionKwh: s.importacionKwh };
  });
  const { marca } = await marcaDe(projectId);
  return { marca, barras, resumen: sumar(barras) };
}

/**
 * Guarda la curva de un día (normalmente ayer) de todas las plantas Growatt
 * vinculadas. Lo corre el monitoreo de cada mañana, después del diagnóstico, así
 * el historial de la pestaña "Hora" y el consumo diario de la pestaña "Día" se
 * arman solos sin que nadie abra la ficha.
 *
 * Va de a una planta, con pausa: son 3 a 5 consultas por planta y Growatt corta
 * si se le pregunta seguido. Best-effort: una planta que falla no frena al resto.
 */
export async function guardarCurvasDelDia(dia: Dia): Promise<{ guardadas: number; fallidas: number }> {
  const plantas = await prisma.growattPlant.findMany({
    where: { projectId: { not: null }, ignorada: false },
    select: { projectId: true },
  });
  let guardadas = 0;
  let fallidas = 0;
  for (const p of plantas) {
    try {
      await obtenerCurvaDia(p.projectId!, dia);
      guardadas++;
    } catch {
      fallidas++;
    }
  }
  return { guardadas, fallidas };
}

// Ingesta mensual desde Growatt.
//
// Por cada planta vinculada: generación (plant/energy) + smart meter día por día
// (meter_data) → métricas del mes → lectura. Es RESUMIBLE: cada planta se
// persiste apenas termina (si el proceso muere, lo hecho queda), y una nueva
// corrida saltea las que ya tienen lectura completa (salvo force).
//
// Corre in-process (no hay cola de jobs en el sistema): la ruta lanza
// `void ingerirPeriodo(...)` y devuelve el id; el frontend hace polling.

import {
  ReporteFvFuente,
  ReporteFvIngestaEstado,
  ReporteFvIngestaModo,
  type Prisma,
} from "@prisma/client";

import { prisma } from "../../../lib/prisma.js";
import { recalcularSerie } from "../calculo.service.js";
import { mesDePeriodo, anioDePeriodo, type Periodo, periodoADate, ultimoDiaDelPeriodo } from "../periodo.js";
import { dataloggersSmartMeter, generacionMensual, growattDormir, growattPausaMs, medidoresDeDatalogger, muestrasDelDia } from "./client.js";
import { contarDiasEsperados, derivarMetricas, type MuestraMedidor } from "./metricas.js";

const CONCURRENCIA = Math.max(1, Number(process.env.REPORTES_FV_GROWATT_CONCURRENCIA ?? 3));
const COBERTURA_MINIMA = Number(process.env.GROWATT_MIN_COVERAGE ?? 0.9);

export interface OpcionesIngesta {
  periodo: Periodo;
  modo: ReporteFvIngestaModo;
  projectIds?: string[];
  /** Reingiere aunque ya haya lectura completa y pisa incluso valores MANUAL. */
  force?: boolean;
  userId?: string;
}

/**
 * Lanza la ingesta de un periodo. Devuelve el id de la corrida enseguida; el
 * trabajo pesado sigue en background. Para esperar el resultado (scripts/cron),
 * usar `await ejecutarIngesta(...)` directamente.
 */
export async function ingerirPeriodo(opts: OpcionesIngesta): Promise<{ ingestaId: string }> {
  const ingesta = await prisma.reporteFvIngesta.create({
    data: {
      periodo: periodoADate(opts.periodo),
      modo: opts.modo,
      estado: ReporteFvIngestaEstado.EN_CURSO,
      lanzadaPorId: opts.userId ?? null,
    },
  });

  // No await: corre en background. Los errores se registran en la corrida.
  void ejecutarIngesta(ingesta.id, opts).catch(async (err) => {
    await prisma.reporteFvIngesta
      .update({
        where: { id: ingesta.id },
        data: {
          estado: ReporteFvIngestaEstado.ERROR,
          terminadaEn: new Date(),
          errorMessage: err instanceof Error ? err.message : String(err),
        },
      })
      .catch(() => undefined);
  });

  return { ingestaId: ingesta.id };
}

/** Ejecuta la ingesta de forma síncrona (para cron/scripts que esperan). */
export async function ejecutarIngesta(ingestaId: string, opts: OpcionesIngesta): Promise<void> {
  const fecha = periodoADate(opts.periodo);
  const inicioStr = `${opts.periodo}-01`;
  const finDate = ultimoDiaDelPeriodo(opts.periodo);
  const finStr = finDate.toISOString().slice(0, 10);
  const diasEsperados = contarDiasEsperados(fecha, finDate, new Date());

  // Plantas vinculadas y no ignoradas (opcionalmente filtradas por proyecto).
  const plantas = await prisma.growattPlant.findMany({
    where: {
      ignorada: false,
      projectId: opts.projectIds ? { in: opts.projectIds } : { not: null },
    },
    select: { plantId: true, projectId: true, name: true },
  });

  // Skip inteligente: las que ya tienen lectura completa del periodo se saltean.
  const lecturas = await prisma.reporteFvLectura.findMany({
    where: { periodo: fecha, projectId: { in: plantas.map((p) => p.projectId!).filter(Boolean) } },
    select: { projectId: true, generacionKwh: true, consumoKwh: true, exportacionKwh: true, generacionFuente: true, consumoFuente: true, exportacionFuente: true },
  });
  const lecturaPorProyecto = new Map(lecturas.map((l) => [l.projectId, l]));

  const objetivo = plantas.filter((p) => {
    if (opts.force) return true;
    const l = lecturaPorProyecto.get(p.projectId!);
    return !(l && l.generacionKwh != null && l.consumoKwh != null && l.exportacionKwh != null);
  });

  await prisma.reporteFvIngesta.update({
    where: { id: ingestaId },
    data: { plantasTotal: objetivo.length },
  });

  const proyectosTocados = new Set<string>();
  let ok = 0;
  let error = 0;
  let requestsTotal = 0;

  // Pool de concurrencia entre plantas (dentro de cada planta, secuencial).
  let cursor = 0;
  async function worker() {
    while (cursor < objetivo.length) {
      const planta = objetivo[cursor++];
      const inicio = Date.now();
      let requests = 0;
      try {
        const r = await ingerirPlanta({
          plantId: planta.plantId.toString(),
          projectId: planta.projectId!,
          periodo: opts.periodo,
          inicioStr,
          finStr,
          diasEsperados,
          force: opts.force ?? false,
          onRequest: () => requests++,
        });
        requestsTotal += r.requests;
        proyectosTocados.add(planta.projectId!);
        ok++;
        await prisma.reporteFvIngestaItem.create({
          data: {
            ingestaId,
            growattPlantId: planta.plantId,
            projectId: planta.projectId,
            ok: true,
            generacionKwh: r.metricas.generacionKwh,
            consumoKwh: r.metricas.consumoKwh,
            exportacionKwh: r.metricas.exportacionKwh,
            requests: r.requests,
            duracionMs: Date.now() - inicio,
          },
        });
      } catch (err) {
        error++;
        await prisma.reporteFvIngestaItem.create({
          data: {
            ingestaId,
            growattPlantId: planta.plantId,
            projectId: planta.projectId,
            ok: false,
            requests,
            duracionMs: Date.now() - inicio,
            errorMessage: err instanceof Error ? err.message : String(err),
          },
        });
      }
      // Progreso incremental para el polling.
      await prisma.reporteFvIngesta
        .update({ where: { id: ingestaId }, data: { plantasOk: ok, plantasError: error, requests: requestsTotal } })
        .catch(() => undefined);
    }
  }

  await Promise.all(Array.from({ length: Math.min(CONCURRENCIA, objetivo.length || 1) }, worker));

  // Recalcular las series de los proyectos que recibieron datos nuevos.
  for (const projectId of proyectosTocados) {
    await recalcularSerie(projectId).catch(() => undefined);
  }

  await prisma.reporteFvIngesta.update({
    where: { id: ingestaId },
    data: {
      estado: error === 0 ? ReporteFvIngestaEstado.OK : ok > 0 ? ReporteFvIngestaEstado.PARCIAL : ReporteFvIngestaEstado.ERROR,
      terminadaEn: new Date(),
      plantasOk: ok,
      plantasError: error,
      requests: requestsTotal,
    },
  });
}

async function ingerirPlanta(params: {
  plantId: string;
  projectId: string;
  periodo: Periodo;
  inicioStr: string;
  finStr: string;
  diasEsperados: number;
  force: boolean;
  onRequest: () => void;
}) {
  const { plantId, inicioStr, finStr, diasEsperados, onRequest } = params;
  let requests = 0;
  const req = <T>(p: Promise<T>): Promise<T> => {
    requests++;
    onRequest();
    return p;
  };

  const generacion = await req(generacionMensual(plantId, inicioStr, finStr));
  await growattDormir(growattPausaMs);

  // Smart meter: dataloggers tipo 3 → medidores → muestras día por día.
  const dataloggers = await req(dataloggersSmartMeter(plantId));
  await growattDormir(growattPausaMs);

  const muestras: MuestraMedidor[] = [];
  let motivoSinMedidor: string | null = dataloggers.length === 0 ? "la planta no tiene smart meter/datalogger tipo 3 visible" : null;

  for (const datalogSn of dataloggers) {
    const medidores = await req(medidoresDeDatalogger(datalogSn));
    await growattDormir(growattPausaMs);
    for (const address of medidores) {
      // meter_data devuelve sólo el último día de un rango → iterar día a día.
      const [anio, mes] = [anioDePeriodo(params.periodo), mesDePeriodo(params.periodo)];
      const diasMes = new Date(Date.UTC(anio, mes, 0)).getUTCDate();
      for (let dia = 1; dia <= diasMes; dia++) {
        const diaStr = `${params.periodo}-${String(dia).padStart(2, "0")}`;
        const delDia = await req(muestrasDelDia(datalogSn, address, diaStr));
        muestras.push(...delDia);
        await growattDormir(growattPausaMs);
      }
    }
  }

  const metricas = derivarMetricas({
    generacionKwh: generacion,
    muestras,
    diasEsperados,
    coberturaMinima: COBERTURA_MINIMA,
  });
  if (motivoSinMedidor && !metricas.motivoDescarte) metricas.motivoDescarte = motivoSinMedidor;

  await guardarLecturaIngesta(params.projectId, params.periodo, metricas, params.force);
  return { metricas, requests };
}

/**
 * Merge de la lectura ingerida con la existente. Regla (endurecida respecto del
 * Python): un valor null nuevo NO pisa lo que había, y un valor con fuente
 * MANUAL sólo lo pisa Growatt con `force`.
 */
async function guardarLecturaIngesta(
  projectId: string,
  periodo: Periodo,
  metricas: {
    generacionKwh: number | null;
    consumoKwh: number | null;
    exportacionKwh: number | null;
    importacionMedidaKwh: number | null;
    diasConDatos: number;
    diasEsperados: number;
    motivoDescarte: string | null;
  },
  force: boolean,
): Promise<void> {
  const fecha = periodoADate(periodo);
  const existente = await prisma.reporteFvLectura.findUnique({
    where: { projectId_periodo: { projectId, periodo: fecha } },
  });

  type Campo = "generacion" | "consumo" | "exportacion";
  const nuevo: Record<Campo, number | null> = {
    generacion: metricas.generacionKwh,
    consumo: metricas.consumoKwh,
    exportacion: metricas.exportacionKwh,
  };
  const fuenteExistente: Record<Campo, ReporteFvFuente | null> = {
    generacion: existente?.generacionFuente ?? null,
    consumo: existente?.consumoFuente ?? null,
    exportacion: existente?.exportacionFuente ?? null,
  };
  const valorExistente: Record<Campo, number | null> = {
    generacion: existente?.generacionKwh == null ? null : Number(existente.generacionKwh),
    consumo: existente?.consumoKwh == null ? null : Number(existente.consumoKwh),
    exportacion: existente?.exportacionKwh == null ? null : Number(existente.exportacionKwh),
  };

  const resolver = (campo: Campo): { valor: number | null; fuente: ReporteFvFuente | null } => {
    // null nuevo → conservar lo que había.
    if (nuevo[campo] == null) return { valor: valorExistente[campo], fuente: fuenteExistente[campo] };
    // MANUAL sin force → conservar.
    if (fuenteExistente[campo] === ReporteFvFuente.MANUAL && !force) {
      return { valor: valorExistente[campo], fuente: ReporteFvFuente.MANUAL };
    }
    return { valor: nuevo[campo], fuente: ReporteFvFuente.GROWATT };
  };

  const g = resolver("generacion");
  const c = resolver("consumo");
  const e = resolver("exportacion");

  const data: Prisma.ReporteFvLecturaUncheckedCreateInput = {
    projectId,
    periodo: fecha,
    generacionKwh: g.valor,
    consumoKwh: c.valor,
    exportacionKwh: e.valor,
    importacionMedidaKwh: metricas.importacionMedidaKwh,
    generacionFuente: g.fuente,
    consumoFuente: c.fuente,
    exportacionFuente: e.fuente,
    diasConDatos: metricas.diasConDatos,
    diasEsperados: metricas.diasEsperados,
    motivoFaltante: metricas.motivoDescarte,
  };

  await prisma.reporteFvLectura.upsert({
    where: { projectId_periodo: { projectId, periodo: fecha } },
    create: data,
    update: {
      generacionKwh: g.valor,
      consumoKwh: c.valor,
      exportacionKwh: e.valor,
      importacionMedidaKwh: metricas.importacionMedidaKwh,
      generacionFuente: g.fuente,
      consumoFuente: c.fuente,
      exportacionFuente: e.fuente,
      diasConDatos: metricas.diasConDatos,
      diasEsperados: metricas.diasEsperados,
      motivoFaltante: metricas.motivoDescarte,
    },
  });
}

/** Estado de una corrida, para el polling del panel. */
export async function getIngesta(ingestaId: string) {
  const i = await prisma.reporteFvIngesta.findUnique({
    where: { id: ingestaId },
    include: {
      items: {
        where: { ok: false },
        select: { growattPlantId: true, projectId: true, errorMessage: true },
      },
    },
  });
  if (!i) return null;
  return {
    id: i.id,
    periodo: `${i.periodo.getUTCFullYear()}-${String(i.periodo.getUTCMonth() + 1).padStart(2, "0")}`,
    estado: i.estado,
    plantasTotal: i.plantasTotal,
    plantasOk: i.plantasOk,
    plantasError: i.plantasError,
    requests: i.requests,
    iniciadaEn: i.iniciadaEn.toISOString(),
    terminadaEn: i.terminadaEn?.toISOString() ?? null,
    errorMessage: i.errorMessage,
    errores: i.items.map((it) => ({
      plantId: it.growattPlantId.toString(),
      projectId: it.projectId,
      error: it.errorMessage,
    })),
  };
}

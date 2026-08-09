// Monitoreo diario de las plantas Huawei (FusionSolar).
//
// Corre pegado al de Growatt y alimenta las MISMAS incidencias, así que el mail
// y el panel muestran las dos marcas juntas: al que mira el monitoreo no le
// importa qué inversor tiene el cliente que se quedó sin generar.
//
// Es mucho más barato que el de Growatt: dos llamadas para toda la flota Huawei
// (la serie diaria del mes en curso y el estado en tiempo real), contra ~2
// requests POR PLANTA en Growatt. Por eso no tiene concurrencia ni corrida
// propia: entra entero en el mismo ciclo.
//
// Además guarda la generación diaria en `ReporteFvGeneracionDiaria`, que es lo
// que alimenta el gráfico día a día del portal del cliente. Sale gratis: la
// serie ya vino en la misma llamada.

import { FvDiagnostico, ReporteFvFuente, type StageType } from "@prisma/client";

import { prisma } from "../../../lib/prisma.js";
import { estadoActual, serieDiariaDelMes } from "../huawei/client.js";
import { dateADia, type Dia } from "./dias.js";
import { diagnosticarHuawei, leerUmbralesHuawei, type EstadoSalud } from "./diagnostico-huawei.js";
import { guardarGeneracionDiaria } from "./generacion-diaria.service.js";
import { resolverHabilitadoEn, resolverOperativaDesde, ETAPAS_UTE } from "./habilitacion.js";
import { registrarDeteccion, resolverIncidencias } from "./incidencias.service.js";

export interface FilaHuawei {
  incidenciaId: string;
  huaweiPlantId: string;
  plantName: string;
  projectId: string | null;
  clientName: string | null;
  diagnostico: FvDiagnostico;
  detalle: string;
  diasAfectados: number;
  ultimaGeneracionEn: Dia | null;
}

export interface ResumenMonitorHuawei {
  fecha: Dia;
  plantasTotal: number;
  requests: number;
  porDiagnostico: Partial<Record<FvDiagnostico, number>>;
  nuevas: FilaHuawei[];
  abiertas: FilaHuawei[];
  resueltas: FilaHuawei[];
  error: string | null;
}

const VACIO = (fecha: Dia): ResumenMonitorHuawei => ({
  fecha,
  plantasTotal: 0,
  requests: 0,
  porDiagnostico: {},
  nuevas: [],
  abiertas: [],
  resueltas: [],
  error: null,
});

/**
 * Evalúa todas las plantas Huawei vinculadas para el día `fecha`.
 *
 * Nunca lanza: si FusionSolar no contesta devuelve el resumen con `error` y sin
 * tocar ninguna incidencia. Una caída de la API no puede "arreglar" plantas
 * rotas ni inventar plantas caídas — misma regla de oro que en Growatt.
 */
export async function ejecutarMonitorHuawei(fecha: Dia): Promise<ResumenMonitorHuawei> {
  const plantas = await prisma.huaweiPlant.findMany({
    where: { projectId: { not: null }, ignorada: false },
    include: {
      project: {
        select: {
          clientName: true,
          postHabilitacionInicioEn: true,
          actualUteEnd: true,
          uteProcesses: { select: { currentStage: true, finalizedAt: true } },
          stages: {
            where: { deletedAt: null, name: { in: ETAPAS_UTE as StageType[] } },
            select: { name: true, actualEndDate: true, status: true },
          },
          reporteFvConfig: { select: { mesInicio: true } },
        },
      },
    },
  });

  const resumen = VACIO(fecha);
  resumen.plantasTotal = plantas.length;
  if (!plantas.length) return resumen;

  const umbrales = leerUmbralesHuawei();
  const [anio, mes] = fecha.split("-").map(Number);

  let series: Awaited<ReturnType<typeof serieDiariaDelMes>>["series"];
  let estados: Map<string, EstadoSalud | null>;
  try {
    const codigos = plantas.map((p) => p.plantCode);
    // El mes del día evaluado: trae todos los días hasta hoy de una vez, lo que
    // da el historial para contar días seguidos sin generar sin pedir nada más.
    ({ series } = await serieDiariaDelMes(codigos, anio, mes));
    estados = await estadoActual(codigos);
    resumen.requests = 2;
  } catch (err) {
    resumen.error = err instanceof Error ? err.message : String(err);
    return resumen;
  }

  for (const planta of plantas) {
    const projectId = planta.projectId!;
    const dias = series.get(planta.plantCode) ?? [];

    // Persistir la serie sirve al portal y deja el historial para los días en que
    // FusionSolar no conteste.
    const serieMap = new Map<Dia, number>(dias.map((d) => [d.fecha as Dia, d.generacionKwh]));
    if (serieMap.size) {
      await guardarGeneracionDiaria(projectId, null, serieMap, ReporteFvFuente.HUAWEI);
    }

    const habilitadoEn = resolverHabilitadoEn({
      postHabilitacionInicioEn: planta.project?.postHabilitacionInicioEn ?? null,
      actualUteEnd: planta.project?.actualUteEnd ?? null,
      uteProcesses: planta.project?.uteProcesses ?? [],
      stages: planta.project?.stages ?? [],
    });
    // Sin fecha de habilitación se cae al primer mes reportado: en la flota real
    // el 73% de los proyectos no tiene la fecha cargada, y sin este fallback el
    // monitoreo los daría a todos por "esperando habilitación" para siempre.
    const { desde } = resolverOperativaDesde({
      habilitadoEn,
      mesInicioReportes: planta.project?.reporteFvConfig?.mesInicio ?? null,
    });

    // Últimos 7 días del historial que ya trajimos (el mes entero vino en la
    // misma llamada, así que acotar es filtrar en memoria, no pedir más).
    const desdeHistorial = dateADia(
      new Date(Date.UTC(anio, mes - 1, Number(fecha.slice(8, 10)) - 7)),
    );
    const historial = dias
      .filter((d) => d.fecha >= desdeHistorial && d.fecha <= fecha)
      .map((d) => ({ dia: d.fecha as Dia, generacionKwh: d.generacionKwh }));

    const delDia = dias.find((d) => d.fecha === fecha);

    const resultado = diagnosticarHuawei({
      dia: fecha,
      generacionKwh: delDia?.generacionKwh ?? null,
      historial,
      estadoSalud: estados.get(planta.plantCode) ?? null,
      habilitadoEn: desde ? dateADia(desde) : null,
      silenciadaHasta: planta.monitoreoSilenciadoHasta
        ? dateADia(planta.monitoreoSilenciadoHasta)
        : null,
      umbrales,
    });

    resumen.porDiagnostico[resultado.diagnostico] =
      (resumen.porDiagnostico[resultado.diagnostico] ?? 0) + 1;

    // El estado de salud se guarda siempre: es útil aunque no haya incidencia.
    await prisma.huaweiPlant.update({
      where: { id: planta.id },
      data: {
        healthState: estados.get(planta.plantCode) ?? null,
        ultimoEstadoEn: new Date(),
      },
    });

    const fila = (incidenciaId: string): FilaHuawei => ({
      incidenciaId,
      huaweiPlantId: planta.id,
      plantName: planta.name,
      projectId,
      clientName: planta.project?.clientName ?? null,
      diagnostico: resultado.diagnostico,
      detalle: resultado.detalle,
      diasAfectados: Math.max(1, resultado.diasSinGeneracion),
      ultimaGeneracionEn: resultado.ultimaGeneracionEn,
    });

    if (resultado.alerta) {
      const r = await registrarDeteccion({
        planta: { huaweiPlantId: planta.id },
        projectId,
        dia: fecha,
        resultado: {
          diagnostico: resultado.diagnostico,
          diasSinGeneracion: resultado.diasSinGeneracion,
          ultimaGeneracionEn: resultado.ultimaGeneracionEn,
          detalle: resultado.detalle,
          alerta: resultado.alerta,
        },
      });
      if (r.esNueva) resumen.nuevas.push(fila(r.incidenciaId));
      else resumen.abiertas.push(fila(r.incidenciaId));
    } else if (resultado.diagnostico !== FvDiagnostico.SIN_DATOS_API) {
      // Igual que en Growatt: sólo cierra la que se pudo evaluar de verdad.
      const cerradas = await resolverIncidencias({ huaweiPlantId: planta.id }, fecha);
      for (const id of cerradas) resumen.resueltas.push(fila(id));
    }
  }

  return resumen;
}

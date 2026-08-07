// Monitoreo diario: consulta Growatt planta por planta, diagnostica y mantiene
// las incidencias.
//
// Corre in-process, como la ingesta mensual (no hay cola de jobs en el sistema).
// Es resumible: cada planta se persiste apenas termina, así que si el proceso
// muere lo hecho queda.
//
// Costo por planta: 2 requests (plant/energy de 7 días + device/list), más 1
// para las sospechosas. Se piden 7 días y no 1 porque cuesta lo mismo y de paso
// da la racha sin generar y el auto-relleno de un día que falló ayer.

import {
  FvDiagnostico,
  FvMonitorCorridaEstado,
  FvMonitorCorridaModo,
  Prisma,
  type StageType,
} from "@prisma/client";

import { prisma } from "../../../lib/prisma.js";
import {
  estadoInversor,
  generacionDiaria,
  growattDormir,
  growattPausaMs,
  listarDispositivos,
  type DispositivoGrowatt,
} from "../growatt/client.js";
import { concurrencia, pctAlertaMasiva, pctErrorMasivo } from "./config.js";
import { dateADia, diaAEvaluar, diaADate, sumarDias, type Dia } from "./dias.js";
import {
  diagnosticar,
  leerUmbrales,
  type EstadoDispositivo,
  type ResultadoDiagnostico,
} from "./diagnostico.js";
import { guardarGeneracionDiaria } from "./generacion-diaria.service.js";
import { resolverHabilitadoEn, resolverOperativaDesde, ETAPAS_UTE } from "./habilitacion.js";
import { registrarDeteccion, resolverIncidencias, serializarIncidencia } from "./incidencias.service.js";

/** Días de historial que se piden a Growatt. 7 = un solo request. */
const VENTANA_DIAS = 7;

export interface FilaResumen {
  incidenciaId: string;
  growattPlantId: string;
  plantName: string;
  projectId: string | null;
  clientName: string | null;
  diagnostico: FvDiagnostico;
  detalle: string;
  diasAfectados: number;
  ultimaGeneracionEn: Dia | null;
}

export interface ResumenMonitor {
  corridaId: string;
  fecha: Dia;
  plantasTotal: number;
  plantasOk: number;
  plantasError: number;
  requests: number;
  porDiagnostico: Partial<Record<FvDiagnostico, number>>;
  incidenciasNuevas: FilaResumen[];
  incidenciasAbiertas: FilaResumen[];
  incidenciasResueltas: FilaResumen[];
  erroresConsulta: Array<{ plantName: string; clientName: string | null; error: string }>;
  /** Media flota con el mismo síntoma: es el clima o la API, no 60 plantas rotas. */
  fallaMasiva: boolean;
  /** Growatt no respondió para una parte grande de la flota. */
  corridaRota: boolean;
}

export interface OpcionesMonitor {
  modo?: FvMonitorCorridaModo;
  /** Día a evaluar. Por defecto, el anterior. */
  fecha?: Dia;
  plantIds?: bigint[];
  userId?: string;
  /** Corrida ya creada (la usa el lanzamiento en background para devolver el id). */
  corridaId?: string;
}

interface PlantaObjetivo {
  plantId: bigint;
  name: string;
  projectId: string | null;
  clientName: string | null;
  silenciadaHasta: Date | null;
  habilitadoEn: Date | null;
}

/** Universo del monitoreo: toda planta de un cliente que no esté marcada como ajena. */
async function cargarObjetivo(plantIds?: bigint[]): Promise<PlantaObjetivo[]> {
  const plantas = await prisma.growattPlant.findMany({
    where: {
      ignorada: false,
      projectId: { not: null },
      ...(plantIds && plantIds.length > 0 ? { plantId: { in: plantIds } } : {}),
    },
    select: {
      plantId: true,
      name: true,
      projectId: true,
      monitoreoSilenciadoHasta: true,
      project: {
        select: {
          clientName: true,
          postHabilitacionInicioEn: true,
          actualUteEnd: true,
          uteProcesses: {
            where: { deletedAt: null },
            select: { currentStage: true, finalizedAt: true },
          },
          stages: {
            // Los nombres viejos y nuevos de etapa conviven en producción.
            where: { deletedAt: null, name: { in: ETAPAS_UTE as StageType[] } },
            select: { name: true, actualEndDate: true, status: true },
          },
          reporteFvConfig: { select: { mesInicio: true } },
        },
      },
    },
  });

  return plantas.map((p) => {
    const habilitadoEn = p.project
      ? resolverHabilitadoEn({
          postHabilitacionInicioEn: p.project.postHabilitacionInicioEn,
          actualUteEnd: p.project.actualUteEnd,
          uteProcesses: p.project.uteProcesses,
          stages: p.project.stages,
        })
      : null;
    // La mayoría de los generadores viejos no tiene fecha de habilitación; el
    // mes desde el que se les reporta prueba igual que la planta ya genera.
    const { desde } = resolverOperativaDesde({
      habilitadoEn,
      mesInicioReportes: p.project?.reporteFvConfig?.mesInicio ?? null,
    });
    return {
      plantId: p.plantId,
      name: p.name,
      projectId: p.projectId,
      clientName: p.project?.clientName ?? null,
      silenciadaHasta: p.monitoreoSilenciadoHasta,
      habilitadoEn: desde,
    };
  });
}

/** Corridas anteriores consecutivas en las que la API tampoco respondió. */
async function rachaSinDatos(plantId: bigint, dia: Dia): Promise<number> {
  const items = await prisma.fvMonitorItem.findMany({
    where: { growattPlantId: plantId, corrida: { fecha: { lt: diaADate(dia) } } },
    orderBy: { corrida: { fecha: "desc" } },
    take: 5,
    select: { diagnostico: true },
  });
  let racha = 0;
  for (const i of items) {
    if (i.diagnostico !== FvDiagnostico.SIN_DATOS_API) break;
    racha++;
  }
  return racha;
}

function aEstadoDispositivo(d: DispositivoGrowatt): EstadoDispositivo {
  return {
    deviceSn: d.deviceSn,
    tipo: d.tipo,
    lost: d.lost,
    ultimoDatoEn: d.ultimoDatoEn,
    statusRaw: d.status,
    faultCode: null,
    warnCode: null,
    faultTexto: null,
  };
}

async function guardarDispositivos(plantId: bigint, dispositivos: DispositivoGrowatt[]) {
  const ahora = new Date();
  for (const d of dispositivos) {
    if (!d.deviceSn) continue;
    const datos = {
      dataloggerSn: d.dataloggerSn,
      tipo: Number.isFinite(d.tipo) ? d.tipo : 0,
      model: d.model,
      lost: d.lost,
      statusRaw: d.status,
      ultimoDatoEn: d.ultimoDatoEn,
      ultimoChequeoEn: ahora,
      ultimaVezEn: ahora,
    };
    await prisma.growattDevice.upsert({
      where: { growattPlantId_deviceSn: { growattPlantId: plantId, deviceSn: d.deviceSn } },
      create: { growattPlantId: plantId, deviceSn: d.deviceSn, ...datos },
      update: datos,
    });
  }
}

interface ResultadoPlanta {
  resultado: ResultadoDiagnostico;
  generacionKwh: number | null;
  requests: number;
}

async function evaluarPlanta(
  planta: PlantaObjetivo,
  dia: Dia,
  ahora: Date,
): Promise<ResultadoPlanta> {
  const umbrales = leerUmbrales();
  const desde = sumarDias(dia, -(VENTANA_DIAS - 1));
  let requests = 0;

  // 1. Serie diaria. Si Growatt no contesta, la planta queda SIN_DATOS_API y no
  //    se toca su incidencia: el problema es nuestro, no del cliente.
  let serie = new Map<Dia, number>();
  let apiCaida = false;
  try {
    serie = await generacionDiaria(planta.plantId.toString(), desde, dia, () => requests++);
  } catch {
    apiCaida = true;
  }

  if (serie.size > 0 && planta.projectId) {
    await guardarGeneracionDiaria(planta.projectId, planta.plantId, serie);
  }

  // El historial persistido cubre los días que la API no devolvió en esta pasada.
  const historial = new Map(serie);
  if (planta.projectId) {
    const guardados = await prisma.reporteFvGeneracionDiaria.findMany({
      where: { projectId: planta.projectId, fecha: { gte: diaADate(desde), lte: diaADate(dia) } },
      select: { fecha: true, generacionKwh: true },
    });
    for (const g of guardados) {
      const d = dateADia(g.fecha);
      if (!historial.has(d)) historial.set(d, Number(g.generacionKwh));
    }
  }

  const generacionKwh = historial.get(dia) ?? null;

  // 2. Estado de los equipos. Sólo hace falta si la planta no generó: pedirlo
  //    para toda la flota duplicaría los requests contra un rate limit que ya
  //    está justo.
  const generoOk = generacionKwh != null && generacionKwh >= umbrales.generacionMinimaKwh;
  let dispositivos: EstadoDispositivo[] = [];

  if (!generoOk && !apiCaida) {
    await growattDormir(growattPausaMs);
    try {
      requests++;
      const crudos = await listarDispositivos(planta.plantId.toString());
      dispositivos = crudos.map(aEstadoDispositivo);
      await guardarDispositivos(planta.plantId, crudos);

      // 3. Detalle del inversor: el único lugar de la API v1 con códigos de
      //    falla. Sólo si el equipo está comunicando — si no reporta, no va a
      //    contestar igual y sería un request tirado.
      const inversor = crudos.find((d) => d.tipo !== 3 && d.deviceSn);
      const comunica = crudos.some(
        (d) => d.ultimoDatoEn != null && ahora.getTime() - d.ultimoDatoEn.getTime() < umbrales.horasSinComunicacion * 3_600_000,
      );
      if (inversor && comunica) {
        await growattDormir(growattPausaMs);
        requests++;
        const estado = await estadoInversor(inversor.deviceSn).catch(() => null);
        if (estado) {
          dispositivos = dispositivos.map((d) =>
            d.deviceSn === inversor.deviceSn
              ? {
                  ...d,
                  faultCode: estado.faultCode,
                  warnCode: estado.warnCode,
                  faultTexto: estado.faultTexto ?? estado.warnTexto,
                }
              : d,
          );
          await prisma.growattDevice
            .update({
              where: {
                growattPlantId_deviceSn: { growattPlantId: planta.plantId, deviceSn: inversor.deviceSn },
              },
              data: {
                faultCode: estado.faultCode,
                warnCode: estado.warnCode,
                faultTexto: estado.faultTexto ?? estado.warnTexto,
                statusText: estado.statusText,
              },
            })
            .catch(() => undefined);
        }
      }
    } catch {
      // Sin estado de equipos el diagnóstico igual sirve; lo dice en el detalle.
    }
  }

  const resultado = diagnosticar({
    dia,
    generacionKwh,
    historial,
    habilitadoEn: planta.habilitadoEn,
    dispositivos,
    silenciadaHasta: planta.silenciadaHasta,
    diasSeguidosSinDatosApi: apiCaida ? await rachaSinDatos(planta.plantId, dia) : 0,
    umbrales,
    ahora,
  });

  if (apiCaida && resultado.diagnostico !== FvDiagnostico.SIN_DATOS_API && historial.size === 0) {
    // Defensa: si la API cayó y no hay nada guardado, nunca reportar "no genera".
    return {
      resultado: {
        ...resultado,
        diagnostico: FvDiagnostico.SIN_DATOS_API,
        detalle: "Growatt no devolvió datos de esta planta.",
        alerta: false,
      },
      generacionKwh,
      requests,
    };
  }

  return { resultado, generacionKwh, requests };
}

async function crearCorrida(
  fecha: Dia,
  modo: FvMonitorCorridaModo,
  userId?: string,
): Promise<{ id: string }> {
  return prisma.fvMonitorCorrida.create({
    data: {
      fecha: diaADate(fecha),
      modo,
      estado: FvMonitorCorridaEstado.EN_CURSO,
      lanzadaPorId: userId ?? null,
    },
    select: { id: true },
  });
}

export async function ejecutarMonitorDiario(
  now: Date = new Date(),
  opts: OpcionesMonitor = {},
): Promise<ResumenMonitor> {
  const fecha = opts.fecha ?? diaAEvaluar(now);
  const modo = opts.modo ?? FvMonitorCorridaModo.CRON;

  const corrida = opts.corridaId
    ? { id: opts.corridaId }
    : await crearCorrida(fecha, modo, opts.userId);

  const objetivo = await cargarObjetivo(opts.plantIds);
  await prisma.fvMonitorCorrida.update({
    where: { id: corrida.id },
    data: { plantasTotal: objetivo.length },
  });

  const porDiagnostico: Partial<Record<FvDiagnostico, number>> = {};
  const evaluadas: Array<{ planta: PlantaObjetivo; resultado: ResultadoDiagnostico }> = [];
  const erroresConsulta: ResumenMonitor["erroresConsulta"] = [];
  let ok = 0;
  let error = 0;
  let requestsTotal = 0;

  let cursor = 0;
  async function worker() {
    while (cursor < objetivo.length) {
      const planta = objetivo[cursor++];
      const inicio = Date.now();
      try {
        const r = await evaluarPlanta(planta, fecha, now);
        requestsTotal += r.requests;
        ok++;
        porDiagnostico[r.resultado.diagnostico] = (porDiagnostico[r.resultado.diagnostico] ?? 0) + 1;
        evaluadas.push({ planta, resultado: r.resultado });

        await prisma.fvMonitorItem.create({
          data: {
            corridaId: corrida.id,
            growattPlantId: planta.plantId,
            projectId: planta.projectId,
            diagnostico: r.resultado.diagnostico,
            generacionKwh:
              r.generacionKwh != null ? new Prisma.Decimal(r.generacionKwh.toFixed(2)) : null,
            diasSinGeneracion: r.resultado.diasSinGeneracion,
            detalle: r.resultado.detalle,
            ok: true,
            requests: r.requests,
            duracionMs: Date.now() - inicio,
          },
        });
      } catch (err) {
        error++;
        const mensaje = err instanceof Error ? err.message : String(err);
        erroresConsulta.push({ plantName: planta.name, clientName: planta.clientName, error: mensaje });
        await prisma.fvMonitorItem
          .create({
            data: {
              corridaId: corrida.id,
              growattPlantId: planta.plantId,
              projectId: planta.projectId,
              diagnostico: FvDiagnostico.SIN_DATOS_API,
              ok: false,
              duracionMs: Date.now() - inicio,
              errorMessage: mensaje,
            },
          })
          .catch(() => undefined);
      }
      await prisma.fvMonitorCorrida
        .update({
          where: { id: corrida.id },
          data: { plantasOk: ok, plantasError: error, requests: requestsTotal },
        })
        .catch(() => undefined);
    }
  }

  await Promise.all(
    Array.from({ length: Math.min(concurrencia(), objetivo.length || 1) }, worker),
  );

  // ── Guardas antes de tocar una sola incidencia ─────────────────────────────
  const total = objetivo.length || 1;
  // Growatt casi nunca tira la conexión: cuando pega el rate limit devuelve un
  // 10012 que `evaluarPlanta` atrapa y convierte en SIN_DATOS_API. Esas plantas
  // se cuentan como "ok" porque la corrida no se rompió, pero NO se pudieron
  // consultar. Si son muchas, la corrida no vale y no se puede tocar ninguna
  // incidencia: las 4 plantas que sí respondieron no son muestra de nada.
  const sinDatos = porDiagnostico[FvDiagnostico.SIN_DATOS_API] ?? 0;
  const corridaRota = (error + sinDatos) / total > pctErrorMasivo();

  const conAlerta = evaluadas.filter((e) => e.resultado.alerta);
  const sinGenerar = evaluadas.filter(
    (e) => e.resultado.diagnostico === FvDiagnostico.SIN_GENERACION,
  ).length;
  // Un temporal apaga medio Uruguay a la vez. Abrir 60 incidencias ese día
  // convertiría el sistema en ruido justo cuando hay que mirarlo con cuidado.
  const fallaMasiva = !corridaRota && sinGenerar / total >= pctAlertaMasiva();

  const nuevas: FilaResumen[] = [];
  const abiertas: FilaResumen[] = [];
  const resueltas: FilaResumen[] = [];

  if (!corridaRota && !fallaMasiva) {
    for (const { planta, resultado } of evaluadas) {
      if (resultado.alerta) {
        const r = await registrarDeteccion({
          growattPlantId: planta.plantId,
          projectId: planta.projectId,
          dia: fecha,
          resultado,
        });
        const fila: FilaResumen = {
          incidenciaId: r.incidenciaId,
          growattPlantId: planta.plantId.toString(),
          plantName: planta.name,
          projectId: planta.projectId,
          clientName: planta.clientName,
          diagnostico: resultado.diagnostico,
          detalle: resultado.detalle,
          diasAfectados: Math.max(1, resultado.diasSinGeneracion),
          ultimaGeneracionEn: resultado.ultimaGeneracionEn,
        };
        if (r.esNueva) nuevas.push(fila);
        else abiertas.push(fila);
      } else if (resultado.diagnostico !== FvDiagnostico.SIN_DATOS_API) {
        // Sólo cierra quien se pudo evaluar de verdad.
        const cerradas = await resolverIncidencias(planta.plantId, fecha);
        for (const id of cerradas) {
          resueltas.push({
            incidenciaId: id,
            growattPlantId: planta.plantId.toString(),
            plantName: planta.name,
            projectId: planta.projectId,
            clientName: planta.clientName,
            diagnostico: resultado.diagnostico,
            detalle: resultado.detalle,
            diasAfectados: 0,
            ultimaGeneracionEn: resultado.ultimaGeneracionEn,
          });
        }
      }
    }
  }

  const estado = corridaRota
    ? FvMonitorCorridaEstado.ERROR
    : error > 0
      ? FvMonitorCorridaEstado.PARCIAL
      : FvMonitorCorridaEstado.OK;

  await prisma.fvMonitorCorrida.update({
    where: { id: corrida.id },
    data: {
      estado,
      terminadaEn: new Date(),
      plantasOk: ok,
      plantasError: error,
      requests: requestsTotal,
      incidenciasAbiertas: nuevas.length,
      incidenciasCerradas: resueltas.length,
      errorMessage: corridaRota
        ? `Growatt no respondió para ${error + sinDatos} de ${objetivo.length} plantas.`
        : fallaMasiva
          ? `${sinGenerar} de ${objetivo.length} plantas sin generar: se asumió un evento general y no se abrieron incidencias.`
          : null,
    },
  });

  console.log(
    `[fv-monitor] ${fecha}: ${ok} ok, ${error} con error, ${nuevas.length} incidencias nuevas, ` +
      `${resueltas.length} resueltas (${requestsTotal} requests)`,
  );

  return {
    corridaId: corrida.id,
    fecha,
    plantasTotal: objetivo.length,
    plantasOk: ok - sinDatos,
    plantasError: error + sinDatos,
    requests: requestsTotal,
    porDiagnostico,
    incidenciasNuevas: nuevas,
    incidenciasAbiertas: abiertas,
    incidenciasResueltas: resueltas,
    erroresConsulta,
    fallaMasiva,
    corridaRota,
  };
}

/** Lanza la corrida en background y devuelve el id (para el botón del panel). */
export async function lanzarMonitorEnBackground(
  opts: OpcionesMonitor & { enviarEmail?: boolean },
): Promise<{ corridaId: string }> {
  const fecha = opts.fecha ?? diaAEvaluar(new Date());
  const corridaPrevia = await prisma.fvMonitorCorrida.findFirst({
    where: { estado: FvMonitorCorridaEstado.EN_CURSO },
    select: { id: true },
  });
  if (corridaPrevia) return { corridaId: corridaPrevia.id };

  // La corrida se crea acá para poder devolver el id sin esperar el trabajo.
  const corrida = await crearCorrida(fecha, opts.modo ?? FvMonitorCorridaModo.MANUAL, opts.userId);

  // Import perezoso: el digest importa este módulo y sería un ciclo.
  const { enviarDigest } = await import("./digest.email.js");

  void ejecutarMonitorDiario(new Date(), { ...opts, fecha, corridaId: corrida.id })
    .then(async (resumen) => {
      if (opts.enviarEmail !== false) await enviarDigest(resumen).catch(() => false);
    })
    .catch(async (err) => {
      console.error("[fv-monitor] corrida manual falló:", err);
      await prisma.fvMonitorCorrida
        .update({
          where: { id: corrida.id },
          data: {
            estado: FvMonitorCorridaEstado.ERROR,
            terminadaEn: new Date(),
            errorMessage: err instanceof Error ? err.message : String(err),
          },
        })
        .catch(() => undefined);
    });

  return { corridaId: corrida.id };
}

export { serializarIncidencia };

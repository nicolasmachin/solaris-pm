// Estado del monitoreo para el panel interno.
//
// Lee lo que dejó la última corrida; no consulta Growatt. Devuelve el universo
// completo (44 plantas hoy) y el filtrado se hace en el cliente, igual que en el
// panel de reportes.

import { FvDiagnostico, FvIncidenciaEstado, FvMonitorCorridaEstado } from "@prisma/client";

import { prisma } from "../../../lib/prisma.js";
import { dateADia, type Dia } from "./dias.js";

export interface FilaMonitor {
  /** BigInt serializado: JSON.stringify no sabe manejarlo. */
  growattPlantId: string;
  plantName: string;
  projectId: string | null;
  clientName: string | null;
  diagnostico: FvDiagnostico;
  detalle: string | null;
  generacionAyerKwh: number | null;
  diasSinGeneracion: number;
  ultimaGeneracionEn: Dia | null;
  incidenciaId: string | null;
  incidenciaDesde: Dia | null;
  diasAfectados: number | null;
  revisada: boolean;
  notificada: boolean;
  silenciadaHasta: Dia | null;
  silenciadaMotivo: string | null;
  peakPowerKw: number | null;
  /** Último dato recibido de cualquier equipo de la planta. */
  ultimoDatoEn: string | null;
}

export interface KpisMonitor {
  total: number;
  ok: number;
  sinGeneracion: number;
  sinComunicacion: number;
  errorDispositivo: number;
  esperandoHabilitacion: number;
  silenciadas: number;
  sinDatos: number;
  incidenciasAbiertas: number;
  sinRevisar: number;
}

export interface EstadoMonitor {
  /** Plantas propias detectadas en Growatt que todavía no tienen proyecto. */
  plantasSinVincular: number;
  ultimaCorrida: {
    id: string;
    fecha: Dia;
    estado: FvMonitorCorridaEstado;
    modo: string;
    terminadaEn: string | null;
    plantasTotal: number;
    plantasError: number;
    requests: number;
    errorMessage: string | null;
  } | null;
  kpis: KpisMonitor;
  plantas: FilaMonitor[];
}

export async function getEstadoMonitor(): Promise<EstadoMonitor> {
  const corrida = await prisma.fvMonitorCorrida.findFirst({
    where: { estado: { not: FvMonitorCorridaEstado.EN_CURSO } },
    orderBy: [{ fecha: "desc" }, { iniciadaEn: "desc" }],
  });

  const [plantas, items, incidencias] = await Promise.all([
    prisma.growattPlant.findMany({
      where: { ignorada: false, projectId: { not: null } },
      select: {
        plantId: true,
        name: true,
        peakPowerKw: true,
        projectId: true,
        monitoreoSilenciadoHasta: true,
        monitoreoSilenciadoMotivo: true,
        project: { select: { clientName: true } },
        devices: { select: { ultimoDatoEn: true } },
      },
      orderBy: { name: "asc" },
    }),
    corrida
      ? prisma.fvMonitorItem.findMany({ where: { corridaId: corrida.id } })
      : Promise.resolve([]),
    prisma.fvIncidencia.findMany({
      where: { estado: FvIncidenciaEstado.ABIERTA },
      orderBy: { primeraDeteccionEn: "asc" },
    }),
  ]);

  const itemPorPlanta = new Map(items.map((i) => [i.growattPlantId.toString(), i]));
  // La primera incidencia abierta de cada planta: la más vieja es la que importa.
  const incidenciaPorPlanta = new Map<string, (typeof incidencias)[number]>();
  for (const i of incidencias) {
    // Este panel lista plantas Growatt; las incidencias de Huawei no tienen
    // dónde colgarse acá y se descartan (el mail sí las incluye).
    if (i.growattPlantId == null) continue;
    const k = i.growattPlantId.toString();
    if (!incidenciaPorPlanta.has(k)) incidenciaPorPlanta.set(k, i);
  }

  const filas: FilaMonitor[] = plantas.map((p) => {
    const k = p.plantId.toString();
    const item = itemPorPlanta.get(k);
    const inc = incidenciaPorPlanta.get(k);
    const ultimoDato = p.devices.reduce<Date | null>(
      (max, d) => (d.ultimoDatoEn && (!max || d.ultimoDatoEn > max) ? d.ultimoDatoEn : max),
      null,
    );

    return {
      growattPlantId: k,
      plantName: p.name,
      projectId: p.projectId,
      clientName: p.project?.clientName ?? null,
      // Sin corrida todavía, la planta no está "ok": está sin evaluar.
      diagnostico: item?.diagnostico ?? FvDiagnostico.SIN_DATOS_API,
      detalle: item?.detalle ?? null,
      generacionAyerKwh: item?.generacionKwh != null ? Number(item.generacionKwh) : null,
      diasSinGeneracion: item?.diasSinGeneracion ?? 0,
      ultimaGeneracionEn: inc?.ultimaGeneracionEn ? dateADia(inc.ultimaGeneracionEn) : null,
      incidenciaId: inc?.id ?? null,
      incidenciaDesde: inc ? dateADia(inc.primeraDeteccionEn) : null,
      diasAfectados: inc?.diasAfectados ?? null,
      revisada: inc?.revisadaEn != null,
      notificada: inc?.notificadaEn != null,
      silenciadaHasta: p.monitoreoSilenciadoHasta ? dateADia(p.monitoreoSilenciadoHasta) : null,
      silenciadaMotivo: p.monitoreoSilenciadoMotivo,
      peakPowerKw: p.peakPowerKw != null ? Number(p.peakPowerKw) : null,
      ultimoDatoEn: ultimoDato?.toISOString() ?? null,
    };
  });

  const cuenta = (d: FvDiagnostico) => filas.filter((f) => f.diagnostico === d).length;
  const kpis: KpisMonitor = {
    total: filas.length,
    ok: cuenta(FvDiagnostico.OK),
    sinGeneracion: cuenta(FvDiagnostico.SIN_GENERACION),
    sinComunicacion: cuenta(FvDiagnostico.SIN_COMUNICACION),
    errorDispositivo: cuenta(FvDiagnostico.ERROR_DISPOSITIVO),
    esperandoHabilitacion: cuenta(FvDiagnostico.ESPERANDO_HABILITACION),
    silenciadas: cuenta(FvDiagnostico.SILENCIADA),
    sinDatos: cuenta(FvDiagnostico.SIN_DATOS_API),
    incidenciasAbiertas: incidencias.length,
    sinRevisar: incidencias.filter((i) => i.revisadaEn == null).length,
  };

  // Una planta sin vincular no genera datos ni alertas: es trabajo pendiente
  // que hay que hacer visible o se acumula en silencio.
  const plantasSinVincular = await prisma.growattPlant.count({
    where: { projectId: null, ignorada: false },
  });

  return {
    plantasSinVincular,
    ultimaCorrida: corrida
      ? {
          id: corrida.id,
          fecha: dateADia(corrida.fecha),
          estado: corrida.estado,
          modo: corrida.modo,
          terminadaEn: corrida.terminadaEn?.toISOString() ?? null,
          plantasTotal: corrida.plantasTotal,
          plantasError: corrida.plantasError,
          requests: corrida.requests,
          errorMessage: corrida.errorMessage,
        }
      : null,
    kpis,
    plantas: filas,
  };
}

export interface FilaCorrida {
  id: string;
  fecha: Dia;
  modo: string;
  estado: FvMonitorCorridaEstado;
  iniciadaEn: string;
  terminadaEn: string | null;
  plantasTotal: number;
  plantasOk: number;
  plantasError: number;
  requests: number;
  incidenciasAbiertas: number;
  incidenciasCerradas: number;
  emailEnviado: boolean;
  errorMessage: string | null;
}

/** Últimas corridas — sirve sobre todo para confirmar que el cron está corriendo. */
export async function listarCorridas(limit = 30): Promise<FilaCorrida[]> {
  const filas = await prisma.fvMonitorCorrida.findMany({
    orderBy: { iniciadaEn: "desc" },
    take: Math.min(limit, 100),
  });
  return filas.map((c) => ({
    id: c.id,
    fecha: dateADia(c.fecha),
    modo: c.modo,
    estado: c.estado,
    iniciadaEn: c.iniciadaEn.toISOString(),
    terminadaEn: c.terminadaEn?.toISOString() ?? null,
    plantasTotal: c.plantasTotal,
    plantasOk: c.plantasOk,
    plantasError: c.plantasError,
    requests: c.requests,
    incidenciasAbiertas: c.incidenciasAbiertas,
    incidenciasCerradas: c.incidenciasCerradas,
    emailEnviado: c.emailEnviado,
    errorMessage: c.errorMessage,
  }));
}

/** Silenciar (o des-silenciar, con hasta = null) el monitoreo de una planta. */
export async function silenciarPlanta(
  plantId: bigint,
  hasta: Dia | null,
  motivo: string | null,
  userId: string,
): Promise<void> {
  await prisma.growattPlant.update({
    where: { plantId },
    data: {
      monitoreoSilenciadoHasta: hasta ? new Date(`${hasta}T00:00:00.000Z`) : null,
      monitoreoSilenciadoMotivo: hasta ? motivo : null,
      monitoreoSilenciadoPorId: hasta ? userId : null,
    },
  });
}

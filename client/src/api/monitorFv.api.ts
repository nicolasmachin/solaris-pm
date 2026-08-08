import { apiClient } from "./axios";

export type FvDiagnostico =
  | "OK"
  | "GENERACION_BAJA"
  | "SIN_GENERACION"
  | "SIN_COMUNICACION"
  | "ERROR_DISPOSITIVO"
  | "SIN_EXPORTACION"
  | "ESPERANDO_HABILITACION"
  | "SILENCIADA"
  | "SIN_DATOS_API";

export type FvIncidenciaEstado = "ABIERTA" | "RESUELTA" | "DESCARTADA";

export const DIAGNOSTICO_LABEL: Record<FvDiagnostico, string> = {
  OK: "Funcionando",
  GENERACION_BAJA: "Generación baja",
  SIN_GENERACION: "No genera",
  SIN_COMUNICACION: "Sin comunicación",
  ERROR_DISPOSITIVO: "Falla del equipo",
  SIN_EXPORTACION: "No inyecta a la red",
  ESPERANDO_HABILITACION: "Esperando habilitación",
  SILENCIADA: "Silenciada",
  SIN_DATOS_API: "Sin datos",
};

/** Orden de severidad: lo que hay que mirar primero va primero. */
export const DIAGNOSTICO_ORDER: FvDiagnostico[] = [
  "SIN_GENERACION",
  "ERROR_DISPOSITIVO",
  "SIN_EXPORTACION",
  "SIN_COMUNICACION",
  "SIN_DATOS_API",
  "GENERACION_BAJA",
  "ESPERANDO_HABILITACION",
  "SILENCIADA",
  "OK",
];

export const DIAGNOSTICO_BADGE: Record<FvDiagnostico, string> = {
  OK: "bg-emerald-500/15 text-emerald-400 border border-emerald-500/30",
  GENERACION_BAJA: "bg-amber-500/15 text-amber-400 border border-amber-500/30",
  SIN_GENERACION: "bg-red-500/15 text-red-400 border border-red-500/30",
  SIN_COMUNICACION: "bg-amber-500/15 text-amber-400 border border-amber-500/30",
  ERROR_DISPOSITIVO: "bg-red-500/15 text-red-400 border border-red-500/30",
  SIN_EXPORTACION: "bg-orange-500/15 text-orange-400 border border-orange-500/30",
  ESPERANDO_HABILITACION: "bg-[var(--color-border)] text-[var(--color-text-muted)]",
  SILENCIADA: "bg-[var(--color-border)] text-[var(--color-text-muted)]",
  SIN_DATOS_API: "bg-blue-500/15 text-blue-400 border border-blue-500/30",
};

export interface FilaMonitor {
  growattPlantId: string;
  plantName: string;
  projectId: string | null;
  clientName: string | null;
  diagnostico: FvDiagnostico;
  detalle: string | null;
  generacionAyerKwh: number | null;
  diasSinGeneracion: number;
  ultimaGeneracionEn: string | null;
  incidenciaId: string | null;
  incidenciaDesde: string | null;
  diasAfectados: number | null;
  revisada: boolean;
  notificada: boolean;
  silenciadaHasta: string | null;
  silenciadaMotivo: string | null;
  peakPowerKw: number | null;
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

export interface CorridaMonitor {
  id: string;
  fecha: string;
  estado: "EN_CURSO" | "OK" | "PARCIAL" | "ERROR";
  modo: string;
  terminadaEn: string | null;
  plantasTotal: number;
  plantasError: number;
  requests: number;
  errorMessage: string | null;
}

export interface EstadoMonitor {
  /** Plantas propias detectadas en Growatt que todavía no tienen proyecto. */
  plantasSinVincular: number;
  ultimaCorrida: CorridaMonitor | null;
  kpis: KpisMonitor;
  plantas: FilaMonitor[];
}

export interface IncidenciaFv {
  id: string;
  growattPlantId: string;
  plantName: string;
  projectId: string | null;
  clientName: string | null;
  diagnostico: FvDiagnostico;
  estado: FvIncidenciaEstado;
  detalle: string | null;
  primeraDeteccionEn: string;
  ultimaDeteccionEn: string;
  resueltaEn: string | null;
  diasAfectados: number;
  ultimaGeneracionEn: string | null;
  revisada: boolean;
  revisadaPor: string | null;
  revisadaEn: string | null;
  nota: string | null;
  notificada: boolean;
}

export interface FilaCorridaMonitor extends CorridaMonitor {
  iniciadaEn: string;
  plantasOk: number;
  incidenciasAbiertas: number;
  incidenciasCerradas: number;
  emailEnviado: boolean;
}

export async function getEstadoMonitor(): Promise<EstadoMonitor> {
  const { data } = await apiClient.get<EstadoMonitor>("/api/reportes-fv/monitor/estado");
  return data;
}

export async function getIncidencias(params: {
  estado?: FvIncidenciaEstado;
  diagnostico?: FvDiagnostico;
  projectId?: string;
  limit?: number;
} = {}): Promise<IncidenciaFv[]> {
  const { data } = await apiClient.get<{ incidencias: IncidenciaFv[] }>(
    "/api/reportes-fv/monitor/incidencias",
    { params },
  );
  return data.incidencias;
}

export async function getCorridasMonitor(limit = 30): Promise<FilaCorridaMonitor[]> {
  const { data } = await apiClient.get<{ corridas: FilaCorridaMonitor[] }>(
    "/api/reportes-fv/monitor/corridas",
    { params: { limit } },
  );
  return data.corridas;
}

export async function getGeneracionDiaria(
  projectId: string,
  desde: string,
  hasta: string,
): Promise<Array<{ fecha: string; generacionKwh: number }>> {
  const { data } = await apiClient.get<{ dias: Array<{ fecha: string; generacionKwh: number }> }>(
    `/api/reportes-fv/generadores/${projectId}/generacion-diaria`,
    { params: { desde, hasta } },
  );
  return data.dias;
}

export async function correrMonitor(params: { fecha?: string; enviarEmail?: boolean } = {}) {
  const { data } = await apiClient.post<{ corridaId: string }>(
    "/api/reportes-fv/monitor/correr",
    params,
  );
  return data;
}

export async function revisarIncidencia(id: string, nota?: string): Promise<IncidenciaFv> {
  const { data } = await apiClient.post<IncidenciaFv>(
    `/api/reportes-fv/monitor/incidencias/${id}/revisar`,
    { nota },
  );
  return data;
}

export async function descartarIncidencia(id: string, nota: string): Promise<IncidenciaFv> {
  const { data } = await apiClient.post<IncidenciaFv>(
    `/api/reportes-fv/monitor/incidencias/${id}/descartar`,
    { nota },
  );
  return data;
}

export async function silenciarPlanta(
  plantId: string,
  hasta: string | null,
  motivo?: string,
): Promise<void> {
  await apiClient.post(`/api/reportes-fv/monitor/plantas/${plantId}/silenciar`, { hasta, motivo });
}

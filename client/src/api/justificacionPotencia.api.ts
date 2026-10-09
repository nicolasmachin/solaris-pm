import { apiClient } from "./axios";

// Espejo de `server/src/services/justificacionPotencia/schema.ts`.

export type TipoSolicitud = "NUEVA" | "AMPLIACION";
export type MotivoAntecedente = "NUEVAS_CARGAS" | "EN_CONSTRUCCION" | "RECIEN_HABILITADO" | "UNIFICACION";

export interface CargaJustificacion {
  id: string;
  tipo: "CARGA" | "UNIFICACION";
  concepto: string;
  detalle?: string | null;
  modo: "DESGLOSE" | "DIRECTO";
  potenciaKw?: number | null;
  horasDia?: number | null;
  diasMes?: number | null;
  cantidad?: number | null;
  kwhMes?: number | null;
  cuentaUte?: string | null;
  potenciaContratadaKw?: number | null;
}

export interface TextosJustificacion {
  objeto: string;
  antecedentes: string;
  justificacion: string;
  conclusion: string;
}

export interface DatosJustificacion {
  tipoSolicitud: TipoSolicitud;
  cliente: { nombre: string; documento: string; esEmpresa: boolean; cuentaUte: string; ubicacion: string };
  firmante: { nombre: string; ci: string };
  potenciaSolicitadaKw: number;
  potenciaUteKw?: number | null;
  consumoAnualActualKwh?: number | null;
  productividadKwhKw: number;
  motivoAntecedente: MotivoAntecedente;
  cargas: CargaJustificacion[];
  textos: TextosJustificacion;
}

export interface JustificacionContexto {
  cliente: DatosJustificacion["cliente"];
  firmante: DatosJustificacion["firmante"];
  potenciaSolicitadaKw: number | null;
}

export interface JustificacionVersionItem {
  id: string;
  versionNumber: number;
  potenciaSolicitadaKw: number;
  consumoAnualProyectadoKwh: number | null;
  cumpleBalance: boolean | null;
  textosConIa: boolean;
  createdAt: string;
  createdByName: string;
  /** Nombre del PDF al descargarlo: "Justificacion de potencia - <cliente>.pdf". */
  archivo: string;
  /** FileAttachment vigente en Documentos (solo la última versión lo tiene). */
  documentoId: string | null;
}

export interface JustificacionEstado {
  contexto: JustificacionContexto;
  ultimaVersionDatos: DatosJustificacion | null;
  versions: JustificacionVersionItem[];
}

export async function getJustificacionPotencia(projectId: string): Promise<JustificacionEstado> {
  const { data } = await apiClient.get(`/api/projects/${projectId}/justificacion-potencia`);
  return data;
}

export async function getTextosAutomaticos(projectId: string, datos: DatosJustificacion): Promise<TextosJustificacion> {
  const { data } = await apiClient.post(`/api/projects/${projectId}/justificacion-potencia/textos-automaticos`, datos);
  return data.textos;
}

export async function redactarConIa(projectId: string, datos: DatosJustificacion): Promise<TextosJustificacion> {
  const { data } = await apiClient.post(`/api/projects/${projectId}/justificacion-potencia/redactar-ia`, datos, {
    timeout: 120_000,
  });
  return data.textos;
}

export async function crearJustificacion(
  projectId: string,
  datos: DatosJustificacion,
  textosConIa: boolean,
): Promise<{ id: string; versionNumber: number; documentoId: string }> {
  const { data } = await apiClient.post(`/api/projects/${projectId}/justificacion-potencia`, { datos, textosConIa });
  return data;
}

export async function deleteJustificacion(id: string): Promise<void> {
  await apiClient.delete(`/api/justificacion-potencia/${id}`);
}

export function justificacionPdfPath(id: string): string {
  return `/api/justificacion-potencia/${id}/pdf`;
}

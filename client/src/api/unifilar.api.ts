import { apiClient } from "./axios";

export type TipoRed = "MONO_230" | "TRI_230_SN" | "TRI_400_CN";
export type TipoProteccionDC = "TERMOMAGNETICO" | "FUSIBLE";

export interface UnifilarVersionListItem {
  id: string;
  versionNumber: number;
  label: string | null;
  createdAt: string;
  tipoRed: TipoRed;
  potenciaInversorKw: number;
  cantidadPaneles: number;
}

export interface UnifilarVersionFull {
  id: string;
  projectId: string;
  versionNumber: number;
  label: string | null;
  createdAt: string;
  snapshotCliente: string;
  snapshotUbicacion: string;
  snapshotFecha: string;
  snapshotAutor: string;
  tipoRed: TipoRed;
  cantidadPaneles: number;
  potenciaPanelW: number;
  modeloPanel: string | null;
  cantidadStrings: number;
  potenciaContratadaKw: number;
  modeloInversor: string;
  potenciaInversorKw: number;
  tipoProteccionDc: TipoProteccionDC;
  calibreProteccionDc: string;
  termicaAcCalibre: string | null;
  diferencialAcCalibre: string | null;
  modeloMedidorMonitoreo: string | null;
  largoDcPanelesM: number;
  largoDcEsLargo: boolean;
  largoAcInversorIcpM: number;
  largoAcIcpTableroM: number;
}

export interface UnifilarFormInput {
  label?: string | null;
  tipoRed: TipoRed;
  cantidadPaneles: number;
  potenciaPanelW: number;
  modeloPanel?: string | null;
  cantidadStrings: number;
  potenciaContratadaKw: number;
  modeloInversor: string;
  potenciaInversorKw: number;
  tipoProteccionDc: TipoProteccionDC;
  calibreProteccionDc: string;
  termicaAcCalibre?: string | null;
  diferencialAcCalibre?: string | null;
  modeloMedidorMonitoreo?: string | null;
  largoDcPanelesM: number;
  largoDcEsLargo: boolean;
  largoAcInversorIcpM: number;
  largoAcIcpTableroM: number;
}

export async function getUnifilarVersions(projectId: string): Promise<UnifilarVersionListItem[]> {
  const { data } = await apiClient.get<{ versions: UnifilarVersionListItem[] }>(
    `/api/projects/${projectId}/unifilar-versions`,
  );
  return data.versions;
}

export async function getUnifilarVersion(id: string): Promise<UnifilarVersionFull> {
  const { data } = await apiClient.get<UnifilarVersionFull>(`/api/unifilar-versions/${id}`);
  return data;
}

export async function createUnifilarVersion(
  projectId: string,
  body: UnifilarFormInput,
): Promise<UnifilarVersionFull> {
  const { data } = await apiClient.post<UnifilarVersionFull>(
    `/api/projects/${projectId}/unifilar-versions`,
    body,
  );
  return data;
}

export async function deleteUnifilarVersion(id: string): Promise<void> {
  await apiClient.delete(`/api/unifilar-versions/${id}`);
}

export async function getUnifilarPreviewSvg(
  projectId: string,
  body: UnifilarFormInput,
): Promise<string> {
  const { data } = await apiClient.post<string>(
    `/api/projects/${projectId}/unifilar-preview`,
    body,
    { responseType: "text", transformResponse: (v) => v },
  );
  return data;
}

/**
 * URL absoluta de un endpoint del API (para hrefs de descarga directa).
 * Lee la baseURL del cliente axios para respetar VITE_API_URL.
 */
export function unifilarSvgUrl(versionId: string): string {
  const base = apiClient.defaults.baseURL ?? "";
  return `${base}/api/unifilar-versions/${versionId}/svg`;
}

export function unifilarPdfUrl(versionId: string): string {
  const base = apiClient.defaults.baseURL ?? "";
  return `${base}/api/unifilar-versions/${versionId}/pdf`;
}

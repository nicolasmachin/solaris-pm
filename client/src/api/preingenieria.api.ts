import { apiClient } from "./axios";

export type TipoTecho = "ISOPANEL" | "HORMIGON" | "CHAPA" | "TEJAS" | "OTRO";

export interface PreIngenieriaVersionListItem {
  id: string;
  versionNumber: number;
  label: string | null;
  createdAt: string;
}

export interface PreIngenieriaFotoFull {
  id: string;
  versionId: string;
  orden: number;
  etiqueta: string | null;
  fileAttachmentId: string | null;
  fileAttachment: {
    id: string;
    filename: string;
    mimeType: string;
    sizeBytes: number;
    url: string;
  } | null;
}

export interface PreIngenieriaPdfAttachment {
  id: string;
  filename: string;
  sizeBytes: number;
  createdAt?: string;
  previewUrl: string;
  downloadUrl: string;
}

export interface PreIngenieriaVersionFull {
  id: string;
  projectId: string;
  versionNumber: number;
  label: string | null;
  createdAt: string;
  snapshotNombre: string;
  snapshotDireccion: string | null;
  snapshotCiudad: string | null;
  snapshotCelular: string | null;
  snapshotFechaPrevista: string | null;
  tipoTecho: TipoTecho | null;
  tipoTechoOtro: string | null;
  infoTecho: string | null;
  alturaTecho: string | null;
  cantidadPaneles: string | null;
  potenciaPaneles: string | null;
  inversor: string | null;
  stringsLineasDc: string | null;
  cableAc: string | null;
  termicaAc: string | null;
  diferencialAc: string | null;
  largoCablesAcMts: string | null;
  largoCablesDcMts: string | null;
  redMonofasica: boolean;
  redTrifasica230SN: boolean;
  redTrifasica400CN: boolean;
  notasAdicionales: string | null;
  unifilarVersionId: string | null;
  fotos: PreIngenieriaFotoFull[];
  pdfAttachment: PreIngenieriaPdfAttachment | null;
}

export interface ExtractedMinutaFields {
  tipoTecho: TipoTecho | null;
  tipoTechoOtro: string | null;
  infoTecho: string | null;
  alturaTecho: string | null;
  cantidadPaneles: string | null;
  potenciaPaneles: string | null;
  inversor: string | null;
  stringsLineasDc: string | null;
  cableAc: string | null;
  termicaAc: string | null;
  diferencialAc: string | null;
  largoCablesAcMts: string | null;
  largoCablesDcMts: string | null;
  redMonofasica: boolean;
  redTrifasica230SN: boolean;
  redTrifasica400CN: boolean;
  notasAdicionales: string | null;
}

export interface MinutaExtractMetadata {
  modelUsed: string;
  latencyMs: number;
  tokensInput: number;
  tokensOutput: number;
}

export interface MinutaExtractResult {
  minutaFileId: string;
  extractedFields: ExtractedMinutaFields;
  metadata: MinutaExtractMetadata;
}

export interface PreIngenieriaFormInput {
  label?: string | null;
  // Cliente snapshot (editable)
  snapshotNombre: string;
  snapshotDireccion?: string | null;
  snapshotCiudad?: string | null;
  snapshotCelular?: string | null;
  snapshotFechaPrevista?: string | null;
  // Sitio
  tipoTecho?: TipoTecho | null;
  tipoTechoOtro?: string | null;
  infoTecho?: string | null;
  alturaTecho?: string | null;
  // Eléctricos
  cantidadPaneles?: string | null;
  potenciaPaneles?: string | null;
  inversor?: string | null;
  stringsLineasDc?: string | null;
  cableAc?: string | null;
  termicaAc?: string | null;
  diferencialAc?: string | null;
  largoCablesAcMts?: string | null;
  largoCablesDcMts?: string | null;
  // Red
  redMonofasica: boolean;
  redTrifasica230SN: boolean;
  redTrifasica400CN: boolean;
  // Notas
  notasAdicionales?: string | null;
  // Trazabilidad
  unifilarVersionId?: string | null;
  // Trazabilidad de extracción de minuta (sólo si se usó IA para pre-rellenar)
  minutaFileId?: string | null;
  minutaModelUsed?: string | null;
  // Fotos
  fotosOrden: string[];
  fotosEtiquetas?: Record<string, string>;
}

export interface PreIngenieriaCreateResult {
  id: string;
  versionNumber: number;
  label: string | null;
  createdAt: string;
  pdfAttachment: PreIngenieriaPdfAttachment | null;
  warning?: string;
}

export interface PreIngenieriaFotoUploadResult {
  fileId: string;
  filename: string;
  size: number;
}

export async function getPreIngenieriaVersions(
  projectId: string,
): Promise<PreIngenieriaVersionListItem[]> {
  const { data } = await apiClient.get<{ versions: PreIngenieriaVersionListItem[] }>(
    `/api/projects/${projectId}/preingenieria-versions`,
  );
  return data.versions;
}

export async function getPreIngenieriaVersion(id: string): Promise<PreIngenieriaVersionFull> {
  const { data } = await apiClient.get<PreIngenieriaVersionFull>(
    `/api/preingenieria-versions/${id}`,
  );
  return data;
}

export async function createPreIngenieriaVersion(
  projectId: string,
  body: PreIngenieriaFormInput,
): Promise<PreIngenieriaCreateResult> {
  const { data } = await apiClient.post<PreIngenieriaCreateResult>(
    `/api/projects/${projectId}/preingenieria-versions`,
    body,
  );
  return data;
}

export async function deletePreIngenieriaVersion(id: string): Promise<void> {
  await apiClient.delete(`/api/preingenieria-versions/${id}`);
}

export async function uploadPreIngenieriaFoto(
  projectId: string,
  file: File,
): Promise<PreIngenieriaFotoUploadResult> {
  const fd = new FormData();
  fd.append("file", file);
  const { data } = await apiClient.post<PreIngenieriaFotoUploadResult>(
    `/api/projects/${projectId}/preingenieria-versions/upload-foto`,
    fd,
    { headers: { "Content-Type": "multipart/form-data" } },
  );
  return data;
}

export async function extractMinutaFields(
  projectId: string,
  file: File,
): Promise<MinutaExtractResult> {
  const fd = new FormData();
  fd.append("file", file);
  const { data } = await apiClient.post<MinutaExtractResult>(
    `/api/projects/${projectId}/preingenieria/extract-from-minuta`,
    fd,
    { headers: { "Content-Type": "multipart/form-data" }, timeout: 120_000 },
  );
  return data;
}

export async function retryMinutaExtraction(
  projectId: string,
  minutaFileId: string,
): Promise<MinutaExtractResult> {
  const { data } = await apiClient.post<MinutaExtractResult>(
    `/api/projects/${projectId}/preingenieria/extract-from-minuta/retry`,
    { minutaFileId },
    { timeout: 120_000 },
  );
  return data;
}

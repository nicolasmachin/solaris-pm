import { apiClient } from "./axios";

// Espejo del modelo UteDocumentConfig (server/prisma/schema.prisma).
export interface UteDocumentConfig {
  id: string;
  projectId: string;
  // Cliente (datos del trámite — los generales viven en Project ahora)
  cuentaUte: string;
  casoUte: string;
  // Representante
  representa: string;
  ciRepre: string;
  calidadRepre: string;
  // Voltia / técnico / UTE
  fi: string;
  rut: string;
  dirFi: string;
  ti: string;
  ciTi: string;
  oficina: string;
  repUte: string;
  calidadUte: string;
  asUte: string;
  ps: string;
  x: string;
  // Técnicos
  potenciaNomSolicitudImg: string;
  intensidadNomSolicitudImg: string;
  tension230: boolean;
  tension400: boolean;
  tensionNomInversor230: boolean;
  tensionNomInversor400: boolean;
  fasesMono: boolean;
  fasesTri: boolean;
  tipoGeneradorSincMono: boolean;
  tipoGeneradorSincTri: boolean;
  potImg: string;
  potImgLetras: string;
  potContratada: string;
  potContratadaLetras: string;
  potContratada1000: string;
  tarifa: string;
  fp: string;
  normas1: string;
  normas2: string;
  x1: string;
  x2: string;
  x3: string;
  x4: string;
  seriePanel: string;
  serieInversor: string;
  areaPaneles: string;
  // Fechas — ambas nullable.
  fechaDoc: string | null;
  fechaFin: string | null;
  createdAt: string;
  updatedAt: string;
}

export type UteDocKey =
  | "solicitud_img"
  | "dar"
  | "jurada_min"
  | "jurada_tec"
  | "convenio"
  | "sol_hab"
  | "acta_hab"
  | "contrato";

export const UTE_DOC_KEYS: UteDocKey[] = [
  "solicitud_img",
  "dar",
  "jurada_min",
  "jurada_tec",
  "convenio",
  "sol_hab",
  "acta_hab",
  "contrato",
];

export const UTE_DOC_LABEL: Record<UteDocKey, string> = {
  solicitud_img: "Solicitud IMG",
  dar: "DAR",
  jurada_min: "Declaración Jurada Mínima",
  jurada_tec: "Declaración Jurada Técnica",
  convenio: "Convenio",
  sol_hab: "Solicitud de Habilitación",
  acta_hab: "Acta de Habilitación",
  contrato: "Contrato",
};

export async function getUteDocsConfig(projectId: string): Promise<UteDocumentConfig> {
  const { data } = await apiClient.get<UteDocumentConfig>(`/api/projects/${projectId}/ute-docs/config`);
  return data;
}

export async function saveUteDocsConfig(
  projectId: string,
  body: Partial<Omit<UteDocumentConfig, "id" | "projectId" | "createdAt" | "updatedAt">>,
): Promise<UteDocumentConfig> {
  const { data } = await apiClient.put<UteDocumentConfig>(`/api/projects/${projectId}/ute-docs/config`, body);
  return data;
}

// Borra la config UTE para que el próximo GET la recree con los defaults
// del schema. Lo usa el botón "Resetear datos" del form.
export async function deleteUteDocsConfig(projectId: string): Promise<void> {
  await apiClient.delete(`/api/projects/${projectId}/ute-docs/config`);
}

export async function generateUteDocs(projectId: string, docs: UteDocKey[]): Promise<Blob> {
  const response = await apiClient.post(
    `/api/projects/${projectId}/ute-docs/generate`,
    { docs },
    { responseType: "blob" },
  );
  return response.data as Blob;
}

// ─── ZIP generado vigente + documentos firmados ────────────────────────────────

export interface UteDocFile {
  id: string;
  filename: string;
  mimeType: string;
  sizeBytes: number;
  uploadedBy: { id: string; name: string | null } | null;
  createdAt: string;
  downloadUrl: string;
}

export async function getUteDocGenerado(projectId: string): Promise<UteDocFile | null> {
  const { data } = await apiClient.get<{ generado: UteDocFile | null }>(
    `/api/projects/${projectId}/ute-docs/generado`,
  );
  return data.generado;
}

export async function getUteDocsFirmados(projectId: string): Promise<UteDocFile[]> {
  const { data } = await apiClient.get<{ firmados: UteDocFile[] }>(
    `/api/projects/${projectId}/ute-docs/firmados`,
  );
  return data.firmados;
}

export async function uploadUteDocFirmado(projectId: string, file: File): Promise<UteDocFile> {
  const form = new FormData();
  form.append("file", file, file.name);
  const { data } = await apiClient.post<{ firmados: UteDocFile[] }>(
    `/api/projects/${projectId}/ute-docs/firmados`,
    form,
    { headers: { "Content-Type": "multipart/form-data" } },
  );
  return data.firmados[0];
}

export async function deleteUteDocFirmado(projectId: string, fileId: string): Promise<void> {
  await apiClient.delete(`/api/projects/${projectId}/ute-docs/firmados/${fileId}`);
}

import { apiClient } from "./axios";

export const EFP_SECTION_KEYS = [
  "datosGenerales",
  "resumenEjecutivo",
  "analisisSitio",
  "equipamiento",
  "disenoElectrico",
  "disenoMecanico",
  "anexos",
] as const;

export type EFPSectionKey = (typeof EFP_SECTION_KEYS)[number];

export const EFP_SECTION_TITLES: Record<EFPSectionKey, string> = {
  datosGenerales: "1. Datos generales del proyecto",
  resumenEjecutivo: "2. Resumen ejecutivo del sistema",
  analisisSitio: "3. Análisis del sitio",
  equipamiento: "4. Equipamiento y materiales",
  disenoElectrico: "5. Diseño eléctrico",
  disenoMecanico: "6. Diseño mecánico / instalación física",
  anexos: "7. Anexos",
};

export type EFPStatus = "DRAFT" | "REVIEW" | "APPROVED" | "ARCHIVED";

export interface EFPVersionDto {
  id: string;
  efpId: string;
  version: number;
  content: Record<string, string>;
  checklist: Record<string, string[]> | null;
  sourceVisitIds: string[];
  aiGenerated: boolean;
  modelUsed: string | null;
  tokensInput: number | null;
  tokensOutput: number | null;
  costUsd: number | null;
  changesFromPrevious: string | null;
  createdAt: string;
  updatedAt: string;
  createdBy: { id: string; name: string } | null;
}

export interface EFPAttachmentDto {
  id: string;
  description: string | null;
  category: string | null;
  createdAt: string;
  uploadedBy?: { id: string; name: string } | null;
  file: {
    id: string;
    filename: string;
    mimeType: string;
    sizeBytes: number;
    previewUrl: string;
    downloadUrl: string;
  } | null;
}

export interface EFPDto {
  id: string;
  projectId: string;
  status: EFPStatus;
  createdAt: string;
  updatedAt: string;
  versions: EFPVersionDto[];
  attachments: EFPAttachmentDto[];
}

export interface EFPGetResponse {
  project: { id: string; code: string; clientName: string };
  efp: EFPDto | null;
}

export async function getEFP(projectId: string): Promise<EFPGetResponse> {
  const { data } = await apiClient.get<EFPGetResponse>(`/api/projects/${projectId}/efp`);
  return data;
}

export async function generateEFPWithAI(
  projectId: string,
  sourceVisitIds: string[],
): Promise<{
  id: string;
  version: number;
  metadata: {
    modelUsed: string;
    tokensInput: number;
    tokensOutput: number;
    costUsd: number;
    latencyMs: number;
  };
}> {
  const { data } = await apiClient.post(
    `/api/projects/${projectId}/efp/generate-with-ai`,
    { sourceVisitIds },
    { timeout: 180_000 },
  );
  return data;
}

export async function snapshotEFPVersion(efpId: string): Promise<EFPVersionDto> {
  const { data } = await apiClient.post<EFPVersionDto>(`/api/efp/${efpId}/versions/snapshot`);
  return data;
}

export async function updateEFPVersion(
  versionId: string,
  body:
    | { content: Partial<Record<EFPSectionKey, string>>; changesFromPrevious?: string | null }
    | { sectionKey: EFPSectionKey; sectionContent: string },
): Promise<EFPVersionDto> {
  const { data } = await apiClient.patch<EFPVersionDto>(`/api/efp/versions/${versionId}`, body);
  return data;
}

export async function deleteEFPVersion(versionId: string): Promise<void> {
  await apiClient.delete(`/api/efp/versions/${versionId}`);
}

export async function uploadEFPAttachment(
  efpId: string,
  file: File,
  options?: { description?: string; category?: "datasheet" | "foto" | "plano" | "otro" },
): Promise<EFPAttachmentDto> {
  const fd = new FormData();
  fd.append("file", file);
  const params: Record<string, string> = {};
  if (options?.description) params.description = options.description;
  if (options?.category) params.category = options.category;
  const { data } = await apiClient.post<EFPAttachmentDto>(
    `/api/efp/${efpId}/attachments`,
    fd,
    {
      headers: { "Content-Type": "multipart/form-data" },
      params,
    },
  );
  return data;
}

export async function deleteEFPAttachment(attachmentId: string): Promise<void> {
  await apiClient.delete(`/api/efp/attachments/${attachmentId}`);
}

export function efpVersionPdfUrl(versionId: string): string {
  const base = apiClient.defaults.baseURL ?? "";
  return `${base}/api/efp/versions/${versionId}/pdf`;
}

export async function updateEFPStatus(
  efpId: string,
  status: EFPStatus,
): Promise<{ id: string; status: EFPStatus }> {
  const { data } = await apiClient.patch<{ id: string; status: EFPStatus }>(
    `/api/efp/${efpId}/status`,
    { status },
  );
  return data;
}

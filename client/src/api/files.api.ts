import { apiClient } from "./axios";
import type { FileAttachment } from "../types/api.types";

export async function getFiles(projectId: string): Promise<FileAttachment[]> {
  const { data } = await apiClient.get<FileAttachment[]>(`/api/projects/${projectId}/files`);
  return data;
}

export async function uploadFile(
  projectId: string,
  file: File,
  // Opcional: si se omite (o es null), el adjunto queda a nivel proyecto
  // (sin etapa). El backend ya acepta subir con solo projectId.
  stageId?: string | null,
  onProgress?: (pct: number) => void
): Promise<FileAttachment> {
  const form = new FormData();
  form.append("file", file);
  if (stageId) form.append("stageId", stageId);

  const { data } = await apiClient.post<FileAttachment>(
    `/api/projects/${projectId}/files`,
    form,
    {
      headers: { "Content-Type": "multipart/form-data" },
      onUploadProgress: (e) => {
        if (onProgress && e.total) {
          onProgress(Math.round((e.loaded / e.total) * 100));
        }
      },
    }
  );
  return data;
}

export function getDownloadUrl(fileId: string): string {
  const base = (import.meta.env.VITE_API_URL as string | undefined) ?? "";
  return `${base}/api/files/${fileId}/download`;
}

export type FileAttachmentTipo =
  | "UPLOAD_MANUAL"
  | "LISTA_MATERIALES"
  | "PRESUPUESTO"
  | "CALCULO_TRIANGULOS"
  | "UNIFILAR"
  | "OTRO"
  | null;

export interface ProjectDocument {
  id: string;
  filename: string;
  mimeType: string;
  sizeBytes: number;
  tipo: FileAttachmentTipo;
  /** Origen fino para docs generados por herramientas del módulo Ingeniería. */
  toolSource: string | null;
  toolVersion: number | null;
  toolEntityId: string | null;
  uploadedAt: string;
  uploadedBy: string | null;
  source: "stage" | "substage" | "generated" | "other";
  sourceLabel: string;
  stageId: string | null;
  substageId: string | null;
  downloadUrl: string;
  previewUrl: string;
}

export async function getProjectDocuments(projectId: string): Promise<ProjectDocument[]> {
  const { data } = await apiClient.get<ProjectDocument[]>(`/api/projects/${projectId}/documents`);
  return data;
}

export async function deleteFile(fileId: string): Promise<void> {
  await apiClient.delete(`/api/files/${fileId}`);
}

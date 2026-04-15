import { apiClient } from "./axios";
import type { FileAttachment } from "../types/api.types";

export async function getFiles(projectId: string): Promise<FileAttachment[]> {
  const { data } = await apiClient.get<FileAttachment[]>(`/api/projects/${projectId}/files`);
  return data;
}

export async function uploadFile(
  projectId: string,
  file: File,
  stageId: string,
  onProgress?: (pct: number) => void
): Promise<FileAttachment> {
  const form = new FormData();
  form.append("file", file);
  form.append("stageId", stageId);

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

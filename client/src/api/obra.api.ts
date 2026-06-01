import { apiClient } from "./axios";

// ─── Tipos (matchean los contratos reales del backend, ver api.routes.ts) ──────

export interface ObraPhoto {
  id: string;
  filename: string;
  thumbnailUrl: string;
  fullUrl: string;
  sizeBytes: number;
  uploadedBy: { id: string; name: string | null } | null;
  createdAt: string;
}

export interface ObraPhotosResponse {
  photos: ObraPhoto[];
  count: number;
}

export type ObraChecklistStatus = "OK" | "PENDING";

export interface ObraChecklistItem {
  id: string;
  name: string;
  description: string | null;
  order: number;
  status: ObraChecklistStatus;
  observation: string | null;
  isCustom: boolean;
  completedBy: { id: string; name: string | null } | null;
  completedAt: string | null;
}

export interface ObraChecklistSummary {
  total: number;
  completed: number;
  pending: number;
  percentComplete: number;
}

export interface ObraChecklistResponse {
  items: ObraChecklistItem[];
  summary: ObraChecklistSummary;
}

// ─── Fotos ─────────────────────────────────────────────────────────────────────

export async function getObraPhotos(projectId: string): Promise<ObraPhotosResponse> {
  const { data } = await apiClient.get<ObraPhotosResponse>(
    `/api/projects/${projectId}/obra/photos`,
  );
  return data;
}

export async function uploadObraPhoto(
  projectId: string,
  blob: Blob,
  filename: string,
): Promise<ObraPhoto> {
  const form = new FormData();
  form.append("file", blob, filename);
  const { data } = await apiClient.post<{ photos: ObraPhoto[] }>(
    `/api/projects/${projectId}/obra/photos`,
    form,
    { headers: { "Content-Type": "multipart/form-data" } },
  );
  return data.photos[0];
}

export async function deleteObraPhoto(projectId: string, photoId: string): Promise<void> {
  await apiClient.delete(`/api/projects/${projectId}/obra/photos/${photoId}`);
}

// URL absoluta del endpoint de ZIP. La descarga real va por fetch autenticado
// (Bearer) → blob, no por <a href>, porque el endpoint exige token.
export function getDownloadAllUrl(projectId: string): string {
  const base = (import.meta.env.VITE_API_URL as string | undefined) ?? "http://localhost:4000";
  return `${base}/api/projects/${projectId}/obra/photos/download-all`;
}

// ─── Checklist ─────────────────────────────────────────────────────────────────

export async function getChecklist(projectId: string): Promise<ObraChecklistResponse> {
  const { data } = await apiClient.get<ObraChecklistResponse>(
    `/api/projects/${projectId}/checklist`,
  );
  return data;
}

export async function createChecklistItem(
  projectId: string,
  body: { name: string; description?: string },
): Promise<ObraChecklistItem> {
  const { data } = await apiClient.post<ObraChecklistItem>(
    `/api/projects/${projectId}/checklist`,
    body,
  );
  return data;
}

export async function updateChecklistItem(
  projectId: string,
  itemId: string,
  body: { status?: ObraChecklistStatus; observation?: string | null },
): Promise<ObraChecklistItem> {
  const { data } = await apiClient.patch<ObraChecklistItem>(
    `/api/projects/${projectId}/checklist/${itemId}`,
    body,
  );
  return data;
}

export async function deleteChecklistItem(projectId: string, itemId: string): Promise<void> {
  await apiClient.delete(`/api/projects/${projectId}/checklist/${itemId}`);
}

import { apiClient } from "./axios";

export type VisitType = "INICIAL" | "REVISION" | "COMPLEMENTARIA";
export type VisitStatus = "EN_CURSO" | "FINALIZADA" | "ARCHIVADA";
export type VisitInputType = "AUDIO" | "PHOTO" | "NOTE";
export type TranscriptionStatus = "PENDING" | "PROCESSING" | "COMPLETED" | "FAILED";

export interface VisitListItem {
  id: string;
  visitDate: string;
  visitType: VisitType;
  status: VisitStatus;
  notes: string | null;
  createdBy: { id: string; name: string };
  inputsCount: number;
  reportsCount: number;
  createdAt: string;
}

export interface VisitInputDto {
  id: string;
  type: VisitInputType;
  fileUrl: string | null;
  fileMimeType: string | null;
  fileSize: number | null;
  transcription: string | null;
  transcriptionStatus: TranscriptionStatus | null;
  noteText: string | null;
  description: string | null;
  createdBy?: { id: string; name: string };
  createdAt: string;
}

export interface ProjectSuggestion {
  field: string;
  currentValue?: string | number | null;
  suggestedValue: string | number | null;
  reason: string;
  confidence: "alta" | "media" | "baja";
}

export interface VisitReportDto {
  id: string;
  version: number;
  content: Record<string, string>;
  summary: string | null;
  changesFromPrevious: string | null;
  projectSuggestions: ProjectSuggestion[];
  inputsUsed: string[];
  modelUsed: string | null;
  tokensInput: number | null;
  tokensOutput: number | null;
  costUsd: number | null;
  generatedAt: string;
  generatedBy: { id: string; name: string };
  hasPdf: boolean;
}

export interface VisitFull {
  id: string;
  projectId: string;
  project: { id: string; clientName: string };
  visitDate: string;
  visitType: VisitType;
  status: VisitStatus;
  notes: string | null;
  createdBy: { id: string; name: string };
  createdAt: string;
  inputs: VisitInputDto[];
  reports: VisitReportDto[];
}

export async function getVisitas(projectId: string): Promise<VisitListItem[]> {
  const { data } = await apiClient.get<{ visits: VisitListItem[] }>(
    `/api/projects/${projectId}/technical-visits`,
  );
  return data.visits;
}

export async function createVisita(
  projectId: string,
  body: { visitDate: string; visitType: VisitType; notes?: string | null },
): Promise<{ id: string }> {
  const { data } = await apiClient.post<{ id: string }>(
    `/api/projects/${projectId}/technical-visits`,
    body,
  );
  return data;
}

export async function getVisita(visitId: string): Promise<VisitFull> {
  const { data } = await apiClient.get<VisitFull>(`/api/technical-visits/${visitId}`);
  return data;
}

export async function deleteVisita(visitId: string): Promise<void> {
  await apiClient.delete(`/api/technical-visits/${visitId}`);
}

export async function uploadVisitNote(
  visitId: string,
  body: { noteText: string; description?: string | null },
): Promise<VisitInputDto> {
  const { data } = await apiClient.post<VisitInputDto>(
    `/api/technical-visits/${visitId}/inputs/note`,
    body,
  );
  return data;
}

function extensionFromMime(mime: string): string {
  const base = mime.split(";")[0].trim().toLowerCase();
  if (base.includes("webm")) return "webm";
  if (base.includes("mp4") || base === "audio/m4a" || base === "audio/x-m4a") return "m4a";
  if (base.includes("aac")) return "aac";
  if (base.includes("mpeg") || base === "audio/mp3") return "mp3";
  if (base.includes("ogg")) return "ogg";
  if (base.includes("wav")) return "wav";
  return "webm";
}

export async function uploadVisitAudio(
  visitId: string,
  blob: Blob,
  mimeType: string,
  description?: string | null,
): Promise<VisitInputDto> {
  const ext = extensionFromMime(mimeType || blob.type || "audio/webm");
  const filename = `recording_${Date.now()}.${ext}`;
  const fd = new FormData();
  fd.append("file", blob, filename);
  if (description) fd.append("description", description);
  const { data } = await apiClient.post<VisitInputDto>(
    `/api/technical-visits/${visitId}/inputs/audio`,
    fd,
    { headers: { "Content-Type": "multipart/form-data" } },
  );
  return data;
}

export async function uploadVisitPhoto(
  visitId: string,
  file: File,
  description?: string | null,
): Promise<VisitInputDto> {
  const fd = new FormData();
  fd.append("file", file);
  if (description) fd.append("description", description);
  const { data } = await apiClient.post<VisitInputDto>(
    `/api/technical-visits/${visitId}/inputs/photo`,
    fd,
    { headers: { "Content-Type": "multipart/form-data" } },
  );
  return data;
}

export async function deleteVisitInput(visitId: string, inputId: string): Promise<void> {
  await apiClient.delete(`/api/technical-visits/${visitId}/inputs/${inputId}`);
}

export async function resetVisitReports(visitId: string): Promise<void> {
  await apiClient.delete(`/api/technical-visits/${visitId}/reports`);
}

export async function consolidateVisitReport(visitId: string): Promise<{
  id: string;
  version: number;
  summary: string | null;
  metadata: {
    modelUsed: string;
    tokensInput: number;
    tokensOutput: number;
    costUsd: number;
    latencyMs: number;
  };
}> {
  const { data } = await apiClient.post(
    `/api/technical-visits/${visitId}/consolidate-report`,
  );
  return data;
}

export async function generateVisitReport(visitId: string): Promise<{
  id: string;
  version: number;
  summary: string | null;
  metadata: {
    modelUsed: string;
    tokensInput: number;
    tokensOutput: number;
    costUsd: number;
    latencyMs: number;
  };
}> {
  const { data } = await apiClient.post(
    `/api/technical-visits/${visitId}/generate-report`,
  );
  return data;
}

export function visitAudioUrl(visitId: string, inputId: string): string {
  const base = apiClient.defaults.baseURL ?? "";
  return `${base}/api/technical-visits/${visitId}/inputs/${inputId}/audio`;
}

export function visitReportPdfUrl(visitId: string, reportId: string): string {
  const base = apiClient.defaults.baseURL ?? "";
  return `${base}/api/technical-visits/${visitId}/reports/${reportId}/pdf`;
}

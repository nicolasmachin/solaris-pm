import { apiClient as api } from "./axios";
import type { LeadDetail, LeadProposal, LeadStageGroup, ProposalListItem, SalesStage } from "../types/leads.types";
import type { Project } from "../types/api.types";

export async function getLeads(params?: {
  assignedTo?: "me";
  search?: string;
  ownerId?: string; // filtrar por vendedor asignado (userId; "unassigned" = sin asignar)
}): Promise<LeadStageGroup[]> {
  const { data } = await api.get<LeadStageGroup[]>("/api/leads", { params });
  return data;
}

// Vista de lista (flat=true): leads planos + paginación + filtros + sort.
// Coexiste con getLeads(); el Kanban sigue usando el response default.
export interface LeadFlatRow {
  id: string;
  code: string;
  clientName: string;
  stage: SalesStage;
  address: string | null;
  estimatedKwp: number | null;
  estimatedBudgetUsd: number | null;
  leadCreatedAt: string | null;
  proposalSentAt: string | null;
  visitScheduledAt: string | null;
  visitCompletedAt: string | null;
  closedAt: string | null;
  reclamosCount: number;
  lastReclamoAt: string | null;
  assignedTo: { id: string; name: string } | null;
  createdAt: string;
}

export interface LeadListResponse {
  data: LeadFlatRow[];
  pagination: { page: number; limit: number; total: number; totalPages: number };
}

export interface GetLeadsFlatParams {
  q?: string;
  stage?: string; // CSV
  ownerId?: string; // CSV ("unassigned" para no asignados)
  dateField?: "leadCreatedAt" | "proposalSentAt" | "closedAt";
  dateFrom?: string; // YYYY-MM-DD
  dateTo?: string; // YYYY-MM-DD
  sortBy?: "clientName" | "stage" | "leadCreatedAt" | "proposalSentAt" | "closedAt" | "owner";
  sortOrder?: "asc" | "desc";
  page?: number;
  limit?: number;
}

export async function getLeadsFlat(params: GetLeadsFlatParams): Promise<LeadListResponse> {
  const { data } = await api.get<LeadListResponse>("/api/leads", {
    params: { flat: "true", ...params },
  });
  return data;
}

export async function getLead(id: string): Promise<LeadDetail> {
  const { data } = await api.get<LeadDetail>(`/api/leads/${id}`);
  return data;
}

export async function createLead(body: {
  clientName: string;
  clientEmail?: string | null;
  clientPhone?: string | null;
  address?: string | null;
  estimatedKwp?: number | null;
  estimatedBudgetUsd?: number | null;
  uteBillMonthlyUsd?: number | null;
  roofType?: string | null;
  notes?: string | null;
  assignedToId?: string | null;
}): Promise<{ id: string; code: string }> {
  const { data } = await api.post<{ id: string; code: string }>("/api/leads", body);
  return data;
}

export async function patchLead(
  id: string,
  body: {
    clientName?: string;
    clientEmail?: string | null;
    clientPhone?: string | null;
    address?: string | null;
    estimatedKwp?: number | null;
    estimatedBudgetUsd?: number | null;
    uteBillMonthlyUsd?: number | null;
    roofType?: string | null;
    notes?: string | null;
    assignedToId?: string | null;
    leadCreatedAt?: string | null;
    proposalSentAt?: string | null;
    visitScheduledAt?: string | null;
    visitCompletedAt?: string | null;
    closedAt?: string | null;
  },
): Promise<void> {
  await api.patch(`/api/leads/${id}`, body);
}

export async function patchLeadStage(
  id: string,
  body: {
    stage: SalesStage;
    notes?: string | null;
    lostReason?: string | null;
  },
): Promise<void> {
  await api.patch(`/api/leads/${id}/stage`, body);
}

// Registra un reclamo (insistencia) al lead. Incrementa el contador "xR".
export async function addReclamo(
  id: string,
): Promise<{ success: boolean; reclamosCount: number; lastReclamoAt: string | null }> {
  const { data } = await api.post<{ success: boolean; reclamosCount: number; lastReclamoAt: string | null }>(
    `/api/leads/${id}/reclamo`,
    {},
  );
  return data;
}

export interface ConvertLeadBody {
  clientName?: string;
  clientAddress?: string | null;
  clientEmail?: string | null;
  clientPhone?: string | null;
  capacityKwp?: number;
  locationCity?: string;
  locationProvince?: string;
  budgetUsd?: number | null;
  plannedEndDate?: string | null;
  startDate?: string;
  modalidadPago?: "DIRECTO_50_50" | "FINANCIACION_BANCARIA" | null;
}

export async function convertLeadWithBody(id: string, body: ConvertLeadBody): Promise<Project> {
  const { data } = await api.post<Project>(`/api/leads/${id}/convert`, body);
  return data;
}

export async function convertLead(id: string): Promise<Project> {
  const { data } = await api.post<Project>(`/api/leads/${id}/convert`);
  return data;
}

export interface ConversionDefaults {
  capacityKwp: number | null;
  budgetUsd: number | null;
  source: "proposal" | "lead" | null;
}

export async function getConversionDefaults(id: string): Promise<ConversionDefaults> {
  const { data } = await api.get<ConversionDefaults>(`/api/leads/${id}/conversion-defaults`);
  return data;
}

export async function deleteLead(id: string): Promise<void> {
  await api.delete(`/api/leads/${id}`);
}

export async function getLeadProposals(
  leadId: string,
  includeDiscarded = false,
): Promise<ProposalListItem[]> {
  const { data } = await api.get<ProposalListItem[]>(`/api/leads/${leadId}/proposals`, {
    params: { includeDiscarded: includeDiscarded ? "true" : "false" },
  });
  return data;
}

export async function generateProposal(formData: FormData): Promise<{ id: string; status: string }> {
  const { data } = await api.post<{ id: string; status: string }>("/api/proposals/generate", formData, {
    headers: {
      "Content-Type": "multipart/form-data",
    },
  });
  return data;
}

export async function getProposal(id: string): Promise<LeadProposal> {
  const { data } = await api.get<LeadProposal>(`/api/proposals/${id}`);
  return data;
}

export async function downloadProposal(id: string, filename: string): Promise<void> {
  const response = await api.get<Blob>(`/api/proposals/${id}/download`, {
    responseType: "blob",
  });
  const blobUrl = URL.createObjectURL(response.data);
  const a = document.createElement("a");
  a.href = blobUrl;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(blobUrl);
}

// Propuestas viejas (ProposalGeneration): descarga del Excel de entrada +
// descartar / restaurar (soft-delete, paridad con las nuevas).
export async function downloadProposalExcel(id: string, filename: string): Promise<void> {
  const response = await api.get<Blob>(`/api/proposals/${id}/download-excel`, { responseType: "blob" });
  const blobUrl = URL.createObjectURL(response.data);
  const a = document.createElement("a");
  a.href = blobUrl;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(blobUrl);
}

export async function discardProposal(id: string): Promise<void> {
  await api.delete(`/api/proposals/${id}`);
}

export async function restoreProposal(id: string): Promise<void> {
  await api.post(`/api/proposals/${id}/restore`, {});
}

// ─── Adjuntos del lead ────────────────────────────────────────────────────

export interface LeadAttachment {
  id: string;
  filename: string;
  mimeType: string;
  sizeBytes: number;
  url: string;
  uploadedBy: { id: string; name: string } | null;
  createdAt: string;
}

export async function listLeadAttachments(leadId: string): Promise<LeadAttachment[]> {
  const { data } = await api.get<LeadAttachment[]>(`/api/leads/${leadId}/attachments`);
  return data;
}

export async function uploadLeadAttachment(leadId: string, file: File): Promise<LeadAttachment> {
  const fd = new FormData();
  fd.append("file", file);
  const { data } = await api.post<LeadAttachment>(`/api/leads/${leadId}/attachments`, fd, {
    headers: { "Content-Type": "multipart/form-data" },
  });
  return data;
}

export async function deleteLeadAttachment(leadId: string, attachmentId: string): Promise<void> {
  await api.delete(`/api/leads/${leadId}/attachments/${attachmentId}`);
}

export function leadAttachmentDownloadUrl(leadId: string, attachmentId: string): string {
  return `${api.defaults.baseURL}/api/leads/${leadId}/attachments/${attachmentId}/download`;
}

// ─── Pendientes del lead ─────────────────────────────────────────────────────
// Todas las tareas colgadas del lead, sin filtrar por asignado (a diferencia de
// /api/my-tasks). Misma forma que `StandaloneTaskItem` de myTasks.api salvo el
// `urgencyRank`, que acá no se usa: el orden lo define el backend.
export interface LeadTaskItem {
  id: string;
  title: string;
  description: string | null;
  status: "PENDING" | "IN_PROGRESS" | "COMPLETED" | "WAITING";
  dueDate: string | null;
  completedAt: string | null;
  origin: "MANUAL" | "MINUTA" | "MCP";
  waitingReason: string | null;
  followUpAt: string | null;
  leadId: string | null;
  lead: { id: string; code: string; name: string } | null;
  /** @deprecated primer asignado; usar `assignees` */
  assignedUserId: string | null;
  /** @deprecated primer asignado; usar `assignees` */
  assignedUser: { id: string; name: string; email: string } | null;
  assignees: { id: string; name: string; email: string | null }[];
  createdAt: string;
  updatedAt: string;
}

export async function getLeadTasks(
  leadId: string,
  params?: { includeCompleted?: boolean },
): Promise<LeadTaskItem[]> {
  const { data } = await api.get<LeadTaskItem[]>(`/api/leads/${leadId}/tasks`, {
    params: params?.includeCompleted ? { includeCompleted: true } : undefined,
  });
  return data;
}

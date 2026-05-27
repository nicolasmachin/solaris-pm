import { apiClient as api } from "./axios";
import type { LeadDetail, LeadProposal, LeadStageGroup, SalesStage } from "../types/leads.types";
import type { Project } from "../types/api.types";

export async function getLeads(params?: { assignedTo?: "me"; search?: string }): Promise<LeadStageGroup[]> {
  const { data } = await api.get<LeadStageGroup[]>("/api/leads", { params });
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

export async function deleteLead(id: string): Promise<void> {
  await api.delete(`/api/leads/${id}`);
}

export async function getLeadProposals(leadId: string): Promise<LeadProposal[]> {
  const { data } = await api.get<LeadProposal[]>(`/api/leads/${leadId}/proposals`);
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

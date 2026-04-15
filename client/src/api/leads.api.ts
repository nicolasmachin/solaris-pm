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

export function getProposalDownloadUrl(id: string): string {
  return `${api.defaults.baseURL}/api/proposals/${id}/download`;
}

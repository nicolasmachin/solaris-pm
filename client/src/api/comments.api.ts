import { apiClient } from "./axios";
import type { Comment } from "../types/api.types";
import type { LeadDetail } from "../types/leads.types";

export async function getProjectComments(
  projectId: string,
  filters?: {
    stageId?: string;
    substageId?: string;
    page?: number;
    limit?: number;
  },
): Promise<Comment[]> {
  const { data } = await apiClient.get<Comment[]>(`/api/projects/${projectId}/comments`, {
    params: filters,
  });
  return data;
}

export async function getLeadComments(leadId: string): Promise<Comment[]> {
  const data = await apiClient.get<LeadDetail>(`/api/leads/${leadId}`);
  return data.data.comments;
}

export async function createComment(body: {
  content: string;
  projectId?: string;
  leadId?: string;
  stageId?: string;
  substageId?: string;
  checklistItemId?: string;
  taskId?: string;
}): Promise<Comment> {
  const { data } = await apiClient.post<Comment>("/api/comments", body);
  return data;
}

export async function patchComment(id: string, body: { content: string }): Promise<Comment> {
  const { data } = await apiClient.patch<Comment>(`/api/comments/${id}`, body);
  return data;
}

export async function deleteComment(id: string): Promise<void> {
  await apiClient.delete(`/api/comments/${id}`);
}

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

// ─── Endpoints específicos para tareas ─────────────────────────────────────
//
// Aceptan tareas sueltas (sin projectId). PATCH/DELETE solo permiten al
// autor (ADMIN sin poder extra). Heredan projectId de la tarea si lo tiene.

export async function getTaskComments(taskId: string): Promise<Comment[]> {
  const { data } = await apiClient.get<Comment[]>(`/api/tasks/${taskId}/comments`);
  return data;
}

export async function createTaskComment(taskId: string, body: { content: string }): Promise<Comment> {
  const { data } = await apiClient.post<Comment>(`/api/tasks/${taskId}/comments`, body);
  return data;
}

export async function patchTaskComment(
  taskId: string,
  commentId: string,
  body: { content: string },
): Promise<Comment> {
  const { data } = await apiClient.patch<Comment>(
    `/api/tasks/${taskId}/comments/${commentId}`,
    body,
  );
  return data;
}

export async function deleteTaskComment(taskId: string, commentId: string): Promise<void> {
  await apiClient.delete(`/api/tasks/${taskId}/comments/${commentId}`);
}

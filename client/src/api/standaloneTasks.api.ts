import { apiClient } from "./axios";
import type { Task } from "../types/api.types";

// Detalle de tarea individual con relaciones (project/stage/substage/user).
// Lo usa TaskDetailModal en modo edición.
export interface TaskDetail {
  id: string;
  title: string;
  description: string | null;
  status: "PENDING" | "IN_PROGRESS" | "COMPLETED" | "WAITING";
  priority: "NORMAL" | "URGENT";
  dueDate: string | null;
  origin: "MANUAL" | "MINUTA" | "MCP";
  // Sólo con status WAITING: qué se espera y cuándo reconsultar.
  waitingReason: string | null;
  followUpAt: string | null;
  projectId: string | null;
  project: { id: string; code: string; name: string } | null;
  leadId: string | null;
  lead: { id: string; code: string; name: string } | null;
  stageId: string | null;
  stage: { id: string; name: string } | null;
  substageId: string | null;
  substage: { id: string; name: string } | null;
  /** @deprecated primer asignado. Usar `assignees`. */
  userId: string | null;
  /** @deprecated primer asignado. Usar `assignees`. */
  user: { id: string; name: string; email: string } | null;
  // Fuente de verdad de la asignación: varios responsables por tarea.
  assignees: { id: string; name: string; email: string | null }[];
  completedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export async function getTask(id: string): Promise<TaskDetail> {
  const { data } = await apiClient.get<TaskDetail>(`/api/tasks/${id}`);
  return data;
}

// Endpoints "tarea suelta" — viven en /api/tasks (sin projectId en URL).
// Soportan tareas con projectId opcional. Conviven con los endpoints
// /api/projects/:projectId/tasks/* usados por el flujo de tareas de proyecto.

export interface CreateStandaloneTaskBody {
  title: string;
  description?: string | null;
  dueDate?: string | null;
  projectId?: string | null;
  leadId?: string | null;
  /** @deprecated usar assignedUserIds */
  assignedUserId?: string | null;
  assignedUserIds?: string[];
}

export interface UpdateStandaloneTaskBody {
  title?: string;
  description?: string | null;
  dueDate?: string | null;
  projectId?: string | null;
  leadId?: string | null;
  /** @deprecated usar assignedUserIds */
  assignedUserId?: string | null;
  assignedUserIds?: string[];
  status?: "PENDING" | "COMPLETED" | "WAITING";
  // Obligatorio al pasar a WAITING. Se limpian solos al salir de la espera.
  waitingReason?: string | null;
  followUpAt?: string | null;
}

export async function createStandaloneTask(body: CreateStandaloneTaskBody): Promise<Task> {
  const { data } = await apiClient.post<Task>("/api/tasks", body);
  return data;
}

export async function updateStandaloneTask(
  id: string,
  body: UpdateStandaloneTaskBody,
): Promise<Task> {
  const { data } = await apiClient.patch<Task>(`/api/tasks/${id}`, body);
  return data;
}

export async function deleteStandaloneTask(id: string): Promise<void> {
  await apiClient.delete(`/api/tasks/${id}`);
}

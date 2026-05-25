import { apiClient } from "./axios";
import type { Task } from "../types/api.types";

// Endpoints "tarea suelta" — viven en /api/tasks (sin projectId en URL).
// Soportan tareas con projectId opcional. Conviven con los endpoints
// /api/projects/:projectId/tasks/* usados por el flujo de tareas de proyecto.

export interface CreateStandaloneTaskBody {
  title: string;
  description?: string | null;
  dueDate?: string | null;
  projectId?: string | null;
  assignedUserId?: string | null;
}

export interface UpdateStandaloneTaskBody {
  title?: string;
  description?: string | null;
  dueDate?: string | null;
  projectId?: string | null;
  assignedUserId?: string | null;
  status?: "PENDING" | "COMPLETED";
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

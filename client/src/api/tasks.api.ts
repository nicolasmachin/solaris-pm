import { apiClient } from "./axios";
import type { Task } from "../types/api.types";

export async function getTasks(projectId: string): Promise<Task[]> {
  const { data } = await apiClient.get<Task[]>(`/api/projects/${projectId}/tasks`);
  return data;
}

export async function createTask(
  projectId: string,
  body: {
    title: string;
    /** @deprecated usar userId */
    responsible?: string;
    userId?: string | null;
    description?: string | null;
    priority?: Task["priority"];
    stageId?: string | null;
    dueDate?: string | null;
  }
): Promise<Task> {
  const { data } = await apiClient.post<Task>(`/api/projects/${projectId}/tasks`, body);
  return data;
}

export async function patchTask(
  projectId: string,
  taskId: string,
  body: {
    title?: string;
    description?: string | null;
    status?: Task["status"];
    priority?: Task["priority"];
    /** @deprecated usar userId */
    responsible?: string | null;
    userId?: string | null;
    dueDate?: string | null;
  }
): Promise<Task> {
  const { data } = await apiClient.patch<Task>(
    `/api/projects/${projectId}/tasks/${taskId}`,
    body
  );
  return data;
}

export async function deleteTask(projectId: string, taskId: string): Promise<void> {
  await apiClient.delete(`/api/projects/${projectId}/tasks/${taskId}`);
}

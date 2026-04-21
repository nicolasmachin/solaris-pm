import { apiClient } from "./axios";

export interface Team {
  id: string;
  name: string;
  color: string;
  notes: string | null;
  createdAt: string;
  updatedAt: string;
  deletedAt: string | null;
}

export async function getTeams(includeDeleted = false): Promise<Team[]> {
  const { data } = await apiClient.get<Team[]>("/api/teams", {
    params: includeDeleted ? { includeDeleted: "true" } : undefined,
  });
  return data;
}

export async function createTeam(body: {
  name: string;
  color?: string;
  notes?: string | null;
}): Promise<Team> {
  const { data } = await apiClient.post<Team>("/api/teams", body);
  return data;
}

export async function patchTeam(
  id: string,
  body: { name?: string; color?: string; notes?: string | null },
): Promise<Team> {
  const { data } = await apiClient.patch<Team>(`/api/teams/${id}`, body);
  return data;
}

export async function deleteTeam(id: string): Promise<void> {
  await apiClient.delete(`/api/teams/${id}`);
}

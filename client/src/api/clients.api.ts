import { apiClient } from "./axios";

export interface ClientProject {
  id: string;
  code: string;
  clientName: string;
}

export interface ClientUser {
  id: string;
  name: string;
  email: string;
  phone: string | null;
  passwordTemporary: boolean;
  active: boolean;
  createdAt: string;
  projects: ClientProject[];
}

export interface ClientCreateInput {
  name: string;
  email: string;
  temporaryPassword: string;
  projectIds: string[];
  phone?: string | null;
}

export interface ClientPatchInput {
  name?: string;
  email?: string;
  phone?: string | null;
  active?: boolean;
  newPassword?: string;
  projectIds?: string[];
}

export async function getClients(): Promise<ClientUser[]> {
  const { data } = await apiClient.get<ClientUser[]>("/api/admin/clients");
  return data;
}

export async function getClient(id: string): Promise<ClientUser> {
  const { data } = await apiClient.get<ClientUser>(`/api/admin/clients/${id}`);
  return data;
}

export async function createClient(input: ClientCreateInput): Promise<ClientUser> {
  const { data } = await apiClient.post<ClientUser>("/api/admin/clients", input);
  return data;
}

export async function patchClient(id: string, input: ClientPatchInput): Promise<ClientUser> {
  const { data } = await apiClient.patch<ClientUser>(`/api/admin/clients/${id}`, input);
  return data;
}

export async function deleteClient(id: string): Promise<void> {
  await apiClient.delete(`/api/admin/clients/${id}`);
}

export interface AvailableProjectForClient {
  id: string;
  code: string;
  clientName: string;
  capacityKwp: number;
  location: string;
  status: string;
  /** Cuántos clientes ya tienen acceso a este proyecto (m2m). */
  clientsCount: number;
}

export async function getProjectsAvailableForClient(): Promise<AvailableProjectForClient[]> {
  const { data } = await apiClient.get<AvailableProjectForClient[]>(
    "/api/admin/projects/available-for-client",
  );
  return data;
}

export interface ProjectClientLink {
  projectClientId: string;
  userId: string;
  name: string;
  email: string;
  phone: string | null;
  passwordTemporary: boolean;
  assignedAt: string;
}

export async function getProjectClients(projectId: string): Promise<ProjectClientLink[]> {
  const { data } = await apiClient.get<ProjectClientLink[]>(
    `/api/admin/projects/${projectId}/clients`,
  );
  return data;
}

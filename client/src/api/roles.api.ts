import { apiClient } from "./axios";

export interface PermissionEntry {
  module: string;
  action: string;
}

export interface ModulePermissions {
  module: string;
  actions: string[];
}

export interface RoleData {
  id: string;
  name: string;
  label: string;
  description: string | null;
  isSystem: boolean;
  userCount: number;
  permissions: ModulePermissions[];
  createdAt: string;
  updatedAt: string;
}

export interface PermissionCatalogEntry {
  module: string;
  actions: string[];
}

export async function getRoles(): Promise<RoleData[]> {
  const { data } = await apiClient.get<RoleData[]>("/api/roles");
  return data;
}

export async function getPermissionsCatalog(): Promise<PermissionCatalogEntry[]> {
  const { data } = await apiClient.get<PermissionCatalogEntry[]>("/api/permissions/catalog");
  return data;
}

export async function createRole(body: {
  name: string;
  label: string;
  description?: string | null;
  permissions: PermissionEntry[];
}): Promise<{ id: string; name: string; label: string }> {
  const { data } = await apiClient.post<{ id: string; name: string; label: string }>("/api/roles", body);
  return data;
}

export async function patchRole(
  id: string,
  body: {
    label?: string;
    description?: string | null;
    permissions?: PermissionEntry[];
  },
): Promise<{ success: boolean }> {
  const { data } = await apiClient.patch<{ success: boolean }>(`/api/roles/${id}`, body);
  return data;
}

export async function deleteRole(id: string): Promise<void> {
  await apiClient.delete(`/api/roles/${id}`);
}

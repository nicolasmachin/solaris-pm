import { apiClient } from "./axios";
import type { PhaseType, Project, ProjectListItem, SolarSystem } from "../types/api.types";

export interface SolarSystemPayload {
  order?: number;
  description?: string | null;
  inverterBrand?: string | null;
  inverterPowerKw?: number | null;
  inverterQuantity?: number | null;
  inverterPhaseType?: PhaseType | null;
  inverterModel?: string | null;
  panelQuantity?: number | null;
  panelPowerW?: number | null;
  panelBrand?: string | null;
  panelModel?: string | null;
}

export interface GetProjectsParams {
  status?: string;
  search?: string;
  stageInProgress?: string;
  sortBy?: "recent" | "createdAt" | "clientName" | "installationDate" | "progress";
  sortOrder?: "asc" | "desc";
  schedulable?: boolean;
}

export async function getProjects(params?: GetProjectsParams): Promise<ProjectListItem[]> {
  const { data } = await apiClient.get<ProjectListItem[]>("/api/projects", { params });
  return data;
}

export async function getProject(id: string): Promise<Project> {
  const { data } = await apiClient.get<Project>(`/api/projects/${id}`);
  return data;
}

export async function createProject(body: {
  clientName: string;
  capacityKwp: number;
  locationCity: string;
  locationProvince: string;
  budgetUsd?: number;
  estimatedMwhYear?: number;
  salespersonId?: string;
  clientEmail?: string;
  clientPhone?: string;
  clientAddress?: string;
  saleDate?: string;
  solarSystem?: SolarSystemPayload;
}): Promise<Project> {
  const { data } = await apiClient.post<Project>("/api/projects", body);
  return data;
}

export async function deleteProject(id: string): Promise<void> {
  await apiClient.delete(`/api/projects/${id}`);
}

export async function patchProject(
  id: string,
  body: {
    clientName?: string;
    capacityKwp?: number;
    pesoObra?: number;
    locationCity?: string;
    locationProvince?: string;
    status?: import("../types/api.types").ProjectStatus;
    budgetUsd?: number | null;
    clientEmail?: string | null;
    clientPhone?: string | null;
    clientAddress?: string | null;
    firstDateScheduledAt?: string | null;
    saleDate?: string | null;
    uteCodigoPS?: string | null;
    uteCodigoAS?: string | null;
  }
): Promise<Project> {
  const { data } = await apiClient.patch<Project>(`/api/projects/${id}`, body);
  return data;
}

export async function createSolarSystem(projectId: string, body: SolarSystemPayload): Promise<SolarSystem> {
  const { data } = await apiClient.post<SolarSystem>(`/api/projects/${projectId}/systems`, body);
  return data;
}

export async function patchSolarSystem(projectId: string, solarSystemId: string, body: SolarSystemPayload): Promise<SolarSystem> {
  const { data } = await apiClient.patch<SolarSystem>(`/api/projects/${projectId}/systems/${solarSystemId}`, body);
  return data;
}

export async function deleteSolarSystem(projectId: string, solarSystemId: string): Promise<SolarSystem> {
  const { data } = await apiClient.delete<SolarSystem>(`/api/projects/${projectId}/systems/${solarSystemId}`);
  return data;
}

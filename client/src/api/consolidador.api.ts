import { apiClient } from "./axios";

export interface EligibleProject {
  id: string;
  nombreCliente: string;
  potenciaKwp: number;
  ubicacion: string;
  cantidadItems: number;
  ultimaActualizacion: string | null;
}

export interface ConsolidadoVersionListItem {
  id: string;
  versionNumber: number;
  label: string | null;
  createdAt: string;
  cantidadProyectos: number;
  cantidadItems: number;
  hasPdf: boolean;
  hasXlsx: boolean;
}

export interface ProjectSnapshot {
  id: string;
  nombreCliente: string;
  potenciaKwp: number;
  ubicacion: string;
}

export interface ItemConsolidado {
  catalogItemId: string;
  nombre: string;
  categoria: string;
  categoriaOrden: number;
  unidad: string;
  cantidadesPorProyecto: Record<string, number>;
  cantidadTotal: number;
}

export interface ConsolidadoVersionFull {
  id: string;
  versionNumber: number;
  label: string | null;
  createdAt: string;
  projectsSnapshot: ProjectSnapshot[];
  itemsSnapshot: ItemConsolidado[];
  hasPdf: boolean;
  hasXlsx: boolean;
}

export interface CreateConsolidadoInput {
  label?: string | null;
  projectIds: string[];
}

export interface CreateConsolidadoResult {
  id: string;
  versionNumber: number;
  label: string | null;
  createdAt: string;
  cantidadProyectos: number;
  cantidadItems: number;
}

export async function getEligibleProjects(): Promise<EligibleProject[]> {
  const { data } = await apiClient.get<{ projects: EligibleProject[] }>(
    "/api/ingenieria/materiales-consolidados/proyectos-elegibles",
  );
  return data.projects;
}

export async function getConsolidadoVersions(): Promise<ConsolidadoVersionListItem[]> {
  const { data } = await apiClient.get<{ versions: ConsolidadoVersionListItem[] }>(
    "/api/ingenieria/materiales-consolidados",
  );
  return data.versions;
}

export async function getConsolidadoVersion(id: string): Promise<ConsolidadoVersionFull> {
  const { data } = await apiClient.get<ConsolidadoVersionFull>(
    `/api/ingenieria/materiales-consolidados/${id}`,
  );
  return data;
}

export async function createConsolidado(
  body: CreateConsolidadoInput,
): Promise<CreateConsolidadoResult> {
  const { data } = await apiClient.post<CreateConsolidadoResult>(
    "/api/ingenieria/materiales-consolidados",
    body,
  );
  return data;
}

export async function deleteConsolidado(id: string): Promise<void> {
  await apiClient.delete(`/api/ingenieria/materiales-consolidados/${id}`);
}

export function consolidadoPdfUrl(id: string): string {
  const base = apiClient.defaults.baseURL ?? "";
  return `${base}/api/ingenieria/materiales-consolidados/${id}/pdf`;
}

export function consolidadoXlsxUrl(id: string): string {
  const base = apiClient.defaults.baseURL ?? "";
  return `${base}/api/ingenieria/materiales-consolidados/${id}/xlsx`;
}

// ─── Vista compras: overlay con estado agregado por item ─────────────────

import type { MaterialStatus } from "../types/materials.types";

export type AggregatedStatus = MaterialStatus | "MIXED" | null;

export interface ComprasOverlayItem {
  catalogItemId: string;
  aggregatedStatus: AggregatedStatus;
  isCrossed: boolean;
  perProjectStatus: Array<{
    projectId: string;
    projectMaterialId: string;
    status: MaterialStatus;
    crossed: boolean;
  }>;
}

export async function getConsolidadoComprasOverlay(id: string): Promise<{ items: ComprasOverlayItem[] }> {
  const { data } = await apiClient.get<{ items: ComprasOverlayItem[] }>(
    `/api/ingenieria/materiales-consolidados/${id}/compras-overlay`,
  );
  return data;
}

export interface CascadeUpdateBody {
  status?: MaterialStatus;
  crossed?: boolean;
}

export async function cascadeUpdateConsolidadoItem(
  versionId: string,
  catalogItemId: string,
  body: CascadeUpdateBody,
): Promise<{ updatedCount: number; projectMaterialIds: string[] }> {
  const { data } = await apiClient.post<{ updatedCount: number; projectMaterialIds: string[] }>(
    `/api/ingenieria/materiales-consolidados/${versionId}/items/${catalogItemId}/cascade-update`,
    body,
  );
  return data;
}

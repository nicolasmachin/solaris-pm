import { apiClient } from './axios';
import type { MaterialCategory, MaterialItem, ProjectMaterial } from '../types/materials.types';
import type { Moneda } from '../types/finance.types';

// ─── Categorías ──────────────────────────────────────────────────────────────

export const getMaterialCategories = (params?: { activa?: 'true' | 'false' | 'all' }) =>
  apiClient.get<MaterialCategory[]>('/api/materials/categories', { params }).then(r => r.data);

export const createMaterialCategory = (body: { nombre: string; descripcion?: string; orden?: number }) =>
  apiClient.post<MaterialCategory>('/api/materials/categories', body).then(r => r.data);

export const patchMaterialCategory = (id: string, body: Partial<{ nombre: string; descripcion: string | null; orden: number; activa: boolean }>) =>
  apiClient.patch<MaterialCategory>(`/api/materials/categories/${id}`, body).then(r => r.data);

export const deleteMaterialCategory = (id: string) =>
  apiClient.delete<{ success: true; deactivated: boolean }>(`/api/materials/categories/${id}`).then(r => r.data);

export const reorderMaterialCategories = (ids: string[]) =>
  apiClient.post('/api/materials/categories/reorder', { ids }).then(r => r.data);

// ─── Ítems ───────────────────────────────────────────────────────────────────

export const getMaterialItems = (params?: { categoryId?: string; search?: string; activo?: 'true' | 'false' | 'all' }) =>
  apiClient.get<MaterialItem[]>('/api/materials/items', { params }).then(r => r.data);

export const getMaterialItem = (id: string) =>
  apiClient.get<MaterialItem>(`/api/materials/items/${id}`).then(r => r.data);

export const createMaterialItem = (body: {
  categoryId: string;
  nombre: string;
  descripcion?: string;
  unidad?: string;
  precioSugerido?: number;
  moneda?: Moneda;
  defaultSupplierId?: string;
  gestionaStock?: boolean;
  stockMinimo?: number;
  ubicacionDeposito?: string;
}) => apiClient.post<MaterialItem>('/api/materials/items', body).then(r => r.data);

export const patchMaterialItem = (id: string, body: Partial<{
  categoryId: string;
  nombre: string;
  descripcion: string | null;
  unidad: string;
  precioSugerido: number | null;
  moneda: Moneda;
  defaultSupplierId: string | null;
  activo: boolean;
  gestionaStock: boolean;
  stockMinimo: number | null;
  ubicacionDeposito: string | null;
}>) => apiClient.patch<MaterialItem>(`/api/materials/items/${id}`, body).then(r => r.data);

export const deleteMaterialItem = (id: string) =>
  apiClient.delete<{ success: true; deactivated: boolean }>(`/api/materials/items/${id}`).then(r => r.data);

// ─── Lista por proyecto ──────────────────────────────────────────────────────

export const getProjectMaterials = (projectId: string) =>
  apiClient.get<ProjectMaterial[]>(`/api/projects/${projectId}/materials`).then(r => r.data);

export const createProjectMaterial = (projectId: string, body: {
  materialItemId: string;
  quantity: number;
  unitPrice?: number;
  moneda?: Moneda;
  supplierId?: string | null;
  notes?: string;
}) => apiClient.post<ProjectMaterial>(`/api/projects/${projectId}/materials`, body).then(r => r.data);

export const patchProjectMaterial = (projectId: string, materialId: string, body: Partial<{
  quantity: number;
  unitPrice: number;
  moneda: Moneda;
  supplierId: string | null;
  notes: string | null;
}>) => apiClient.patch<ProjectMaterial>(`/api/projects/${projectId}/materials/${materialId}`, body).then(r => r.data);

export const deleteProjectMaterial = (projectId: string, materialId: string) =>
  apiClient.delete<{ success: true; previstoEliminado: boolean }>(`/api/projects/${projectId}/materials/${materialId}`).then(r => r.data);

export const generateProjectPrevistos = (projectId: string, expectedDate: string) =>
  apiClient.post<{ created: number; alreadyExisted: number }>(`/api/projects/${projectId}/materials/generate-previsto`, { expectedDate }).then(r => r.data);

export const regenerateProjectPrevistos = (projectId: string, expectedDate: string) =>
  apiClient.post<{ created: number; alreadyExisted: number; regenerated: number }>(`/api/projects/${projectId}/materials/regenerate-previsto`, { expectedDate }).then(r => r.data);

export const exportMaterialsPdf = async (projectId: string, includePrecios: boolean): Promise<{ fileId: string }> => {
  const response = await apiClient.post(
    `/api/projects/${projectId}/materials/export-pdf`,
    null,
    { responseType: 'blob', params: { includePrecios: includePrecios ? 'true' : 'false' } },
  );
  const today = new Date().toISOString().slice(0, 10);
  const filename = includePrecios
    ? `Lista de materiales (con precios) ${today}.pdf`
    : `Lista de materiales (sin precios) ${today}.pdf`;
  const url = URL.createObjectURL(new Blob([response.data], { type: 'application/pdf' }));
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
  const fileId = (response.headers['x-file-id'] as string) ?? '';
  return { fileId };
};

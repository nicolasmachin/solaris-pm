import { apiClient } from './axios';
import type { MaterialTemplate, PhaseType } from '../types/materials.types';

// ─── Plantillas de lista de materiales ────────────────────────────────────────

export const getMaterialTemplates = (params?: { activa?: 'true' | 'false' | 'all' }) =>
  apiClient.get<MaterialTemplate[]>('/api/material-templates', { params }).then(r => r.data);

export const createMaterialTemplate = (body: {
  nombre: string;
  descripcion?: string | null;
  phaseType?: PhaseType | null;
  orden?: number;
  activa?: boolean;
}) => apiClient.post<MaterialTemplate>('/api/material-templates', body).then(r => r.data);

export const patchMaterialTemplate = (id: string, body: Partial<{
  nombre: string;
  descripcion: string | null;
  phaseType: PhaseType | null;
  orden: number;
  activa: boolean;
}>) => apiClient.patch<MaterialTemplate>(`/api/material-templates/${id}`, body).then(r => r.data);

export const deleteMaterialTemplate = (id: string) =>
  apiClient.delete<{ success: true; deactivated: boolean }>(`/api/material-templates/${id}`).then(r => r.data);

export const setMaterialTemplateItems = (
  id: string,
  items: Array<{ materialItemId: string; quantity?: number; orden?: number }>,
) => apiClient.put<MaterialTemplate>(`/api/material-templates/${id}/items`, { items }).then(r => r.data);

// Aplica una plantilla sobre la lista de materiales de un proyecto (agrega solo faltantes).
export const applyMaterialTemplate = (projectId: string, templateId: string) =>
  apiClient
    .post<{ agregados: number; salteados: number; plantilla: string }>(
      `/api/projects/${projectId}/materials/apply-template`,
      { templateId },
    )
    .then(r => r.data);

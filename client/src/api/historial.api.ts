import { apiClient } from './axios';

export interface EntradaHistorial {
  id: string;
  timestamp: string;
  entidad: string;
  entityId: string;
  accion: string;
  campo: string | null;
  antes: string | null;
  despues: string | null;
  descripcion: string;
  usuario: { id: string; name: string };
  project: { id: string; code: string; clientName: string } | null;
}

export interface HistorialDto {
  total: number;
  page: number;
  porPagina: number;
  usuarios: Array<{ id: string; name: string }>;
  entradas: EntradaHistorial[];
}

export const getHistorialFinanzas = (params: {
  desde?: string; hasta?: string; userId?: string; entidad?: string; accion?: string; buscar?: string; page?: number;
}) => apiClient.get<HistorialDto>('/api/finance/historial', { params }).then((r) => r.data);

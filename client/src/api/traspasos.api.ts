import { apiClient } from "./axios";

export interface TraspasoDestinatario {
  nombre: string;
  roleName: string;
  esCopia: boolean;
}

export interface TraspasoPendiente {
  id: string;
  tipo: string;
  label: string;
  projectId: string;
  projectName: string;
  modalTexto: string;
  destinatariosPreview: string[];
  destinatarios: TraspasoDestinatario[];
  condicionDetectadaEn: string;
}

export async function getTraspasosPendientes(): Promise<TraspasoPendiente[]> {
  const { data } = await apiClient.get<{ traspasos: TraspasoPendiente[] }>("/api/traspasos/pendientes");
  return data.traspasos;
}

export async function confirmarTraspaso(
  id: string,
  notaAlReceptor?: string,
): Promise<{ traspasoId: string; notificacionesEnviadas: number }> {
  const { data } = await apiClient.post(`/api/traspasos/${id}/confirmar`, {
    notaAlReceptor: notaAlReceptor || undefined,
  });
  return data;
}

export async function cancelarTraspaso(id: string, motivo?: string): Promise<{ traspasoId: string }> {
  const { data } = await apiClient.post(`/api/traspasos/${id}/cancelar`, { motivo: motivo || undefined });
  return data;
}

export async function posponerTraspaso(id: string): Promise<{ traspasoId: string; pospuestoHasta: string }> {
  const { data } = await apiClient.post(`/api/traspasos/${id}/posponer`);
  return data;
}

import { apiClient } from "./axios";

export type TicketEstado = "ABIERTO" | "DERIVADO" | "EN_PROGRESO" | "RESUELTO" | "CERRADO";
export type TicketPrioridad = "BAJA" | "MEDIA" | "ALTA";
export type AreaDerivable = "INGENIERIA" | "OPERACIONES";

export interface TicketRow {
  id: string;
  projectId: string;
  projectName: string;
  projectCode: string;
  titulo: string;
  estado: TicketEstado;
  prioridad: TicketPrioridad;
  areaDerivada: string | null;
  origenCliente: boolean;
  creadoPorNombre: string | null;
  createdAt: string;
}

export interface TicketComentario {
  id: string;
  autorId: string;
  autorNombre: string | null;
  contenido: string;
  esInterno: boolean;
  createdAt: string;
}

export interface TicketDetalle {
  id: string;
  projectId: string;
  titulo: string;
  descripcion: string;
  estado: TicketEstado;
  prioridad: TicketPrioridad;
  areaDerivada: string | null;
  origenCliente: boolean;
  creadoPorNombre: string | null;
  asignadoANombre: string | null;
  resueltoEn: string | null;
  resueltoPorNombre: string | null;
  cerradoEn: string | null;
  createdAt: string;
  updatedAt: string;
  comentarios: TicketComentario[];
}

export async function listTickets(params?: {
  estado?: TicketEstado;
  area?: string;
  projectId?: string;
  mias?: boolean;
}): Promise<TicketRow[]> {
  const { data } = await apiClient.get<{ tickets: TicketRow[] }>("/api/tickets", { params });
  return data.tickets;
}

export async function getTicket(id: string): Promise<TicketDetalle> {
  const { data } = await apiClient.get<TicketDetalle>(`/api/tickets/${id}`);
  return data;
}

export async function createTicket(body: {
  projectId: string;
  titulo: string;
  descripcion: string;
  prioridad?: TicketPrioridad;
}): Promise<TicketDetalle> {
  const { data } = await apiClient.post<TicketDetalle>("/api/tickets", body);
  return data;
}

export async function updateTicket(
  id: string,
  body: { titulo?: string; descripcion?: string; prioridad?: TicketPrioridad },
): Promise<TicketDetalle> {
  const { data } = await apiClient.patch<TicketDetalle>(`/api/tickets/${id}`, body);
  return data;
}

export async function deleteTicket(id: string): Promise<void> {
  await apiClient.delete(`/api/tickets/${id}`);
}

export async function addComentario(id: string, contenido: string, esInterno: boolean): Promise<TicketDetalle> {
  const { data } = await apiClient.post<TicketDetalle>(`/api/tickets/${id}/comentarios`, { contenido, esInterno });
  return data;
}

export async function derivarTicket(id: string, areaDerivada: AreaDerivable): Promise<TicketDetalle> {
  const { data } = await apiClient.post<TicketDetalle>(`/api/tickets/${id}/derivar`, { areaDerivada });
  return data;
}

export async function enProgresoTicket(id: string): Promise<TicketDetalle> {
  const { data } = await apiClient.post<TicketDetalle>(`/api/tickets/${id}/en-progreso`, {});
  return data;
}

export async function resolverTicket(id: string): Promise<TicketDetalle> {
  const { data } = await apiClient.post<TicketDetalle>(`/api/tickets/${id}/resolver`, {});
  return data;
}

export async function cerrarTicket(id: string): Promise<TicketDetalle> {
  const { data } = await apiClient.post<TicketDetalle>(`/api/tickets/${id}/cerrar`, {});
  return data;
}

// ─── Helpers de presentación (compartidos por la UI) ─────────────────────────

export const ESTADO_LABEL: Record<TicketEstado, string> = {
  ABIERTO: "Abierto",
  DERIVADO: "Derivado",
  EN_PROGRESO: "En progreso",
  RESUELTO: "Resuelto",
  CERRADO: "Cerrado",
};

export const PRIORIDAD_LABEL: Record<TicketPrioridad, string> = {
  BAJA: "Baja",
  MEDIA: "Media",
  ALTA: "Alta",
};

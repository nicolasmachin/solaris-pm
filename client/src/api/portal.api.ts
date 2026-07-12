import { apiClient } from "./axios";
import type { TicketDetalle, TicketEstado, TicketPrioridad } from "./tickets.api";

export interface PortalProjectListItem {
  id: string;
  code: string;
  clientName: string;
  capacityKwp: number;
  location: string;
  uteCaseNumber: string | null;
  uteCurrentStage: string | null;
  uteFinalized: boolean;
}

export type PortalTimelineStatus = "completed" | "current" | "pending";
export type PortalResponsible = "VOLTIA" | "UTE";

export interface PortalTimelineItem {
  key: string;
  label: string;
  description: string;
  responsible: PortalResponsible;
  status: PortalTimelineStatus;
  completedAt: string | null;
  daysInStage: number | null;
  explanation: string | null;
}

export interface PortalProjectUte {
  projectId: string;
  projectCode: string;
  clientName: string;
  capacityKwp: number;
  location: string;
  ute: {
    id: string;
    caseNumber: string | null;
    currentStage: string;
    currentStatus: string;
    finalizedAt: string | null;
    totalDays: number;
    ourTimeDays: number;
    uteTimeDays: number;
  } | null;
  timeline: PortalTimelineItem[];
}

export async function getPortalProjects(): Promise<PortalProjectListItem[]> {
  const { data } = await apiClient.get<PortalProjectListItem[]>("/api/client/projects");
  return data;
}

export async function getPortalProjectUte(projectId: string): Promise<PortalProjectUte> {
  const { data } = await apiClient.get<PortalProjectUte>(
    `/api/client/projects/${projectId}/ute`,
  );
  return data;
}

// ─── Tickets del cliente (portal) ────────────────────────────────────────────

export interface PortalTicketRow {
  id: string;
  projectId: string;
  projectName: string;
  projectCode: string;
  titulo: string;
  estado: TicketEstado;
  prioridad: TicketPrioridad;
  createdAt: string;
}

export async function getPortalTickets(): Promise<PortalTicketRow[]> {
  const { data } = await apiClient.get<PortalTicketRow[]>("/api/client/tickets");
  return data;
}

export async function getPortalTicket(id: string): Promise<TicketDetalle> {
  const { data } = await apiClient.get<TicketDetalle>(`/api/client/tickets/${id}`);
  return data;
}

export async function createPortalTicket(body: {
  projectId: string;
  titulo: string;
  descripcion: string;
}): Promise<TicketDetalle> {
  const { data } = await apiClient.post<TicketDetalle>("/api/client/tickets", body);
  return data;
}

export async function comentarPortalTicket(id: string, contenido: string): Promise<TicketDetalle> {
  const { data } = await apiClient.post<TicketDetalle>(`/api/client/tickets/${id}/comentarios`, { contenido });
  return data;
}

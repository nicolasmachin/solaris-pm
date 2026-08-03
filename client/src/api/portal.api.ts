import { apiClient } from "./axios";
import type { TicketDetalle, TicketEstado, TicketPrioridad } from "./tickets.api";
import type { EncuestaDetalle, SurveyEstado, SurveyTipo } from "./encuestas.api";
import type { Notification } from "../types/api.types";

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

// ─── Encuestas del cliente (portal) ──────────────────────────────────────────

export interface PortalSurveyRow {
  id: string;
  projectId: string;
  projectName: string;
  projectCode: string;
  tipo: SurveyTipo;
  estado: SurveyEstado;
  edicion: number;
  nota: number | null;
  comentario: string | null;
  respondidaEn: string | null;
  createdAt: string;
}

export async function getPortalSurveys(): Promise<PortalSurveyRow[]> {
  const { data } = await apiClient.get<PortalSurveyRow[]>("/api/client/surveys");
  return data;
}

export async function responderPortalSurvey(
  id: string,
  body: { nota: number; comentario?: string },
): Promise<EncuestaDetalle> {
  const { data } = await apiClient.post<EncuestaDetalle>(`/api/client/surveys/${id}/responder`, body);
  return data;
}

// ─── Notificaciones del cliente (portal) ─────────────────────────────────────

export async function getPortalNotifications(): Promise<Notification[]> {
  const { data } = await apiClient.get<Notification[]>("/api/client/notifications");
  return data;
}

export async function markPortalNotificationRead(id: string): Promise<void> {
  await apiClient.patch(`/api/client/notifications/${id}/read`);
}

export async function markAllPortalNotificationsRead(): Promise<void> {
  await apiClient.patch("/api/client/notifications/read-all");
}

// ─── Reportes fotovoltaicos ──────────────────────────────────────────────────

export interface PortalReporteRow {
  id: string;
  projectId: string;
  projectName: string;
  periodo: string; // "YYYY-MM"
  anio: number;
  ahorroTotal: number | null;
  ahorroAcumuladoUsd: number | null;
}

export async function getPortalReportes(): Promise<PortalReporteRow[]> {
  const { data } = await apiClient.get<{ reportes: PortalReporteRow[] }>("/api/client/reportes");
  return data.reportes;
}

/** URL absoluta del PDF de un reporte del portal (para iframe / descarga con auth). */
export function portalReportePdfUrl(id: string): string {
  const base = apiClient.defaults.baseURL ?? "";
  return `${base}/api/client/reportes/${id}/pdf`;
}

export interface PortalEnergiaMes {
  periodo: string; // "YYYY-MM"
  generacionKwh: number | null;
  consumoKwh: number | null;
  autoconsumoKwh: number;
  exportacionKwh: number | null;
  importacionRedKwh: number;
  ahorroTotal: number;
  ahorroTotalUsd: number;
  ahorroAcumulado: number;
  ahorroAcumuladoUsd: number;
  retornoInversionPct: number;
}

export interface PortalEnergiaGenerador {
  projectId: string;
  projectName: string;
  meses: PortalEnergiaMes[];
}

export async function getPortalEnergia(): Promise<PortalEnergiaGenerador[]> {
  const { data } = await apiClient.get<{ generadores: PortalEnergiaGenerador[] }>(
    "/api/client/energia",
  );
  return data.generadores;
}

export interface PortalDiaCorteRow {
  projectId: string;
  projectName: string;
  diaCorteMedidor: number | null;
}

export async function getPortalDiaCorte(): Promise<PortalDiaCorteRow[]> {
  const { data } = await apiClient.get<{ generadores: PortalDiaCorteRow[] }>(
    "/api/client/reportes/dia-corte",
  );
  return data.generadores;
}

export async function setPortalDiaCorte(
  projectId: string,
  diaCorteMedidor: number | null,
): Promise<number | null> {
  const { data } = await apiClient.put<{ diaCorteMedidor: number | null }>(
    `/api/client/reportes/${projectId}/dia-corte`,
    { diaCorteMedidor },
  );
  return data.diaCorteMedidor;
}

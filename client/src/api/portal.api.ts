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
  /** Trámite finalizado, o cliente anterior a Voltia PM sin trámite cargado. */
  habilitado: boolean;
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
  /** Cliente anterior a Voltia PM: anda, pero su trámite no está cargado. */
  habilitadoSinTramite: boolean;
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
  nota2: number | null;
  nota3: number | null;
  comentario: string | null;
  // Las preguntas dependen del tipo de encuesta (las manda el backend).
  preguntas: {
    intro: string;
    pregunta1: string;
    pregunta2: string;
    pregunta3: string;
    comentario: string;
  };
  respondidaEn: string | null;
  createdAt: string;
}

export async function getPortalSurveys(): Promise<PortalSurveyRow[]> {
  const { data } = await apiClient.get<PortalSurveyRow[]>("/api/client/surveys");
  return data;
}

export async function responderPortalSurvey(
  id: string,
  body: { nota: number; nota2?: number | null; nota3?: number | null; comentario?: string },
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

export interface PortalEnergiaDia {
  fecha: string; // "YYYY-MM-DD"
  generacionKwh: number;
}

export interface PortalEnergiaDiariaGenerador {
  projectId: string;
  projectName: string;
  periodo: string; // "YYYY-MM"
  dias: PortalEnergiaDia[];
  totalKwh: number;
  promedioKwh: number;
  mejorDia: PortalEnergiaDia | null;
  actualizadoEn: string | null;
}

/** Generación día a día. Sin `periodo`, el mes en curso. */
export async function getPortalEnergiaDiaria(
  periodo?: string,
): Promise<PortalEnergiaDiariaGenerador[]> {
  const { data } = await apiClient.get<{ generadores: PortalEnergiaDiariaGenerador[] }>(
    "/api/client/energia/diaria",
    { params: periodo ? { periodo } : undefined },
  );
  return data.generadores;
}

export type PortalTarifaUte = "SIMPLE" | "DOBLE" | "TRIPLE" | "ZAFRAL";

export interface PortalDiaCorteRow {
  projectId: string;
  projectName: string;
  diaCorteMedidor: number | null;
  tarifaContratada: PortalTarifaUte | null;
  potenciaContratadaKw: number | null;
}

export async function getPortalDiaCorte(): Promise<PortalDiaCorteRow[]> {
  const { data } = await apiClient.get<{ generadores: PortalDiaCorteRow[] }>(
    "/api/client/reportes/dia-corte",
  );
  return data.generadores;
}

/** Datos que el cliente lee de su factura de UTE y carga él mismo. */
export async function setPortalDatosUte(
  projectId: string,
  datos: { tarifaContratada: PortalTarifaUte | null; potenciaContratadaKw: number | null },
): Promise<{ tarifaContratada: PortalTarifaUte | null; potenciaContratadaKw: number | null }> {
  const { data } = await apiClient.put<{
    tarifaContratada: PortalTarifaUte | null;
    potenciaContratadaKw: number | null;
  }>(`/api/client/reportes/${projectId}/datos-ute`, datos);
  return data;
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

// ─── Mis documentos ────────────────────────────────────────────────────────
// Contrato y papeles de UTE firmados, y el Plan de Protección contra Granizo.

export interface PortalDocArchivo {
  id: string;
  nombre: string;
  /** Cuándo se subió a Voltia PM (ISO). No es la fecha de firma. */
  cargadoEl: string;
}

export type PortalPlanEstado =
  | "PENDIENTE_INICIO"
  | "PENDIENTE_ACTIVACION"
  | "EN_CARENCIA"
  | "VIGENTE"
  | "POR_VENCER"
  | "EN_GRACIA"
  | "SUSPENDIDA"
  | "VENCIDA"
  | "CANCELADA";

export interface PortalPlanGranizo {
  estado: PortalPlanEstado;
  faltaFirma: boolean;
  faltaPago: boolean;
  coberturaActiva: boolean;
  sinCarencia: boolean;
  /** "YYYY-MM-DD" */
  coberturaDesde: string | null;
  vencimiento: string | null;
  diasParaVencer: number | null;
  proximoCobro: { fecha: string | null; montoUsd: number } | null;
  deudaUsd: number;
  cantidadPaneles: number;
  montoAnualUsd: number;
  anexo: (PortalDocArchivo & { firmadoEl: string | null }) | null;
  condiciones: PortalDocArchivo | null;
}

export interface PortalDocumentosProyecto {
  projectId: string;
  nombre: string;
  capacityKwp: number;
  contrato: PortalDocArchivo | null;
  ute: { suministro: number; archivos: PortalDocArchivo[] }[];
  plan: PortalPlanGranizo | null;
}

export const getPortalDocumentos = () =>
  apiClient.get<{ proyectos: PortalDocumentosProyecto[] }>("/api/client/documentos").then((r) => r.data.proyectos);

/** Ruta relativa: va por apiClient, que le agrega la sesión (y la vista como cliente). */
export const portalDocumentoPath = (fileId: string) => `/api/client/documentos/${fileId}`;

// ─── Avisos de Soporte sobre la planta ─────────────────────────────────────
export interface PortalAvisoPlanta {
  id: string;
  planta: string;
  mensaje: string;
  avisadoEn: string;
}
export const getPortalAvisosPlanta = () =>
  apiClient.get<{ avisos: PortalAvisoPlanta[] }>("/api/client/avisos-planta").then((r) => r.data.avisos);

import { apiClient } from "./axios";

// Panel de operaciones · Tiempos & SLA (dentro del Dashboard).
// Endpoints de triage en vivo. Todos gateados por OPERACIONES:VIEW.

export type CountdownStatus = "ok" | "warning" | "overdue";

export interface OpsRiskSummary {
  ok: number;
  warning: number;
  overdue: number;
  sinSla: number;
  total: number; // ok + warning + overdue
}

export interface OpsSinFechaRow {
  id: string;
  code: string;
  clientName: string;
  locationCity: string | null;
  capacityKwp: number | null;
  diasDesdeVenta: number;
  stageLabel: string | null;
  status: CountdownStatus | null;
}

export interface OpsSinComunicacionRow {
  id: string;
  code: string;
  clientName: string;
  recorrido: "E1" | "E2" | "E3";
  stageLabel: string | null;
  cadenciaObjetivo: number | null;
  diasSinContacto: number | null;
  ultimoContactoEn: string | null;
  atraso: number | null; // días por encima del objetivo (null si nunca contactado)
  sinContacto: boolean;
}

export interface OpsProcesoStage {
  stageName: string;
  stageLabel: string;
  slaDiasHabiles: number | null;
  avgDias: number | null;
  completedCount: number;
  complianceRate: number | null;
  masTrabado: {
    clientName: string;
    code: string;
    elapsedBusinessDays: number;
    remainingBusinessDays: number;
  } | null;
}

export function getOpsRiskSummary(): Promise<OpsRiskSummary> {
  return apiClient.get<OpsRiskSummary>("/api/ops/risk-summary").then((r) => r.data);
}

export function getOpsSinFechaInstalacion(): Promise<{ rows: OpsSinFechaRow[] }> {
  return apiClient.get<{ rows: OpsSinFechaRow[] }>("/api/ops/sin-fecha-instalacion").then((r) => r.data);
}

export function getOpsSinComunicacion(): Promise<{ rows: OpsSinComunicacionRow[] }> {
  return apiClient.get<{ rows: OpsSinComunicacionRow[] }>("/api/ops/sin-comunicacion").then((r) => r.data);
}

export function getOpsProcesoPorEtapa(): Promise<{ stages: OpsProcesoStage[] }> {
  return apiClient.get<{ stages: OpsProcesoStage[] }>("/api/ops/proceso-por-etapa").then((r) => r.data);
}

// ─── Banda UTE (Fase 1b) ──────────────────────────────────────────────────────
export type WaitingParty = "US" | "UTE" | null;

export interface OpsUteSinHabilitarRow {
  id: string;
  code: string;
  clientName: string;
  diasDesdeVenta: number;
  subEtapa: string; // enum UteStage (CONSULTA, ENSAYOS, …); label vía UTE_STAGE_LABEL
  esperandoA: WaitingParty;
}

export interface OpsUteReparto {
  esperandoNosotros: number;
  esperandoUTE: number;
  totalActivos: number;
  avgOurDays: number | null;
  avgUteDays: number | null;
  avgTotalDays: number | null;
}

export interface OpsUteSubEtapa {
  key: string;
  label: string;
  avgDias: number | null;
  muestras: number;
}

export interface OpsUtePanel {
  sinHabilitar: OpsUteSinHabilitarRow[];
  reparto: OpsUteReparto;
  promedioPorSubEtapa: OpsUteSubEtapa[];
}

export function getOpsUtePanel(): Promise<OpsUtePanel> {
  return apiClient.get<OpsUtePanel>("/api/ops/ute-panel").then((r) => r.data);
}

// ─── Omitir / re-incluir proyectos de métricas y SLA ──────────────────────────
export interface OpsOmitidoRow {
  id: string;
  code: string;
  clientName: string;
  capacityKwp: number | null;
}

// Omite (excluded=true) o reincluye (excluded=false) un proyecto de las métricas.
export function setProyectoExclusionMetricas(id: string, excluded: boolean): Promise<{ id: string; excludedFromMetrics: boolean }> {
  return apiClient
    .patch<{ id: string; excludedFromMetrics: boolean }>(`/api/ops/proyectos/${id}/exclusion-metricas`, { excluded })
    .then((r) => r.data);
}

export function getOpsOmitidos(): Promise<{ rows: OpsOmitidoRow[] }> {
  return apiClient.get<{ rows: OpsOmitidoRow[] }>("/api/ops/omitidos").then((r) => r.data);
}

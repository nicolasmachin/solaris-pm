import { apiClient } from "./axios";

// Panel de ventas · Embudo & SLA (dentro del Dashboard). Gemelo de ops.api.
// Todos gateados por VENTAS:VIEW; gerencia/admin ven todo, el asesor solo lo suyo.

export type CountdownStatus = "ok" | "warning" | "overdue";
export type SalesFunnelStep =
  | "LEAD_TO_QUOTE"
  | "QUOTE_TO_SCHEDULED"
  | "SCHEDULED_TO_VISIT"
  | "VISIT_TO_CLOSE"
  | "CLOSE_TO_PROJECT";

export interface VentasRiskSummary {
  ok: number;
  warning: number;
  overdue: number;
  sinSla: number;
  total: number; // ok + warning + overdue
}

export interface VentasLeadTrabado {
  id: string;
  code: string;
  clientName: string;
  asesorName: string | null;
  step: SalesFunnelStep;
  stepLabel: string;
  elapsedBusinessDays: number;
  remainingBusinessDays: number;
  status: CountdownStatus;
  reclamosCount: number;
}

export interface VentasTramo {
  step: SalesFunnelStep;
  stepLabel: string;
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

export interface VentasVendedor {
  asesorId: string | null;
  asesorName: string;
  leadsAbiertos: number;
  atrasados: number;
  enPlazo: number;
  complianceRate: number | null;
}

export function getVentasRiskSummary(): Promise<VentasRiskSummary> {
  return apiClient.get<VentasRiskSummary>("/api/ventas/risk-summary").then((r) => r.data);
}

export function getVentasLeadsTrabados(): Promise<{ rows: VentasLeadTrabado[] }> {
  return apiClient.get<{ rows: VentasLeadTrabado[] }>("/api/ventas/leads-trabados").then((r) => r.data);
}

export function getVentasEmbudoPorTramo(): Promise<{ steps: VentasTramo[] }> {
  return apiClient.get<{ steps: VentasTramo[] }>("/api/ventas/embudo-por-tramo").then((r) => r.data);
}

export function getVentasPorVendedor(): Promise<{ rows: VentasVendedor[] }> {
  return apiClient.get<{ rows: VentasVendedor[] }>("/api/ventas/por-vendedor").then((r) => r.data);
}

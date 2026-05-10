import { apiClient } from "./axios";
import type { Moneda } from "../types/finance.types";

export type CashflowSourceType = "FIXED_COST" | "PROJECT_MATERIAL" | "SUPPLIER_DEBT" | "CLIENT_COBRO";

export interface CashflowEvent {
  id: string;
  fecha: string;
  descripcion: string;
  tipo: CashflowSourceType;
  monto: number;
  moneda: Moneda;
  impacto: "POSITIVO" | "NEGATIVO";
  sourceType: CashflowSourceType;
  sourceId: string;
  causeNegative?: boolean;
}

export interface CashflowTimelinePoint {
  fecha: string;
  saldo: number;
  descripcion: string;
}

export interface CashflowDto {
  saldoActualUYU: number;
  saldoActualUSD: number;
  fallbackUsdToUyu: number;
  events: CashflowEvent[];
  historicalTimeline: CashflowTimelinePoint[];
  projectionTimeline: CashflowTimelinePoint[];
  // Alias de projectionTimeline (compat temporal con código viejo).
  timelineUSD: CashflowTimelinePoint[];
  alertaNegativo: boolean;
  horizonUntil: string;
  historyFrom: string;
}

export async function getCashflow(): Promise<CashflowDto> {
  const { data } = await apiClient.get<CashflowDto>("/api/finance/cashflow");
  return data;
}

export async function updateCashflowEventFecha(
  sourceType: CashflowSourceType,
  sourceId: string,
  fecha: string,
): Promise<{ id: string; fecha: string | null }> {
  const { data } = await apiClient.patch<{ id: string; fecha: string | null }>(
    `/api/finance/cashflow/events/${sourceType}/${sourceId}/fecha`,
    { fecha },
  );
  return data;
}

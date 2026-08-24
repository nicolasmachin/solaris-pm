import { apiClient } from "./axios";

// Plazos del embudo comercial (SLA por tramo, en días hábiles). Config de admin.

export interface SalesStageSlaRow {
  step: string;
  label: string;
  /** Plazo en días hábiles. null si nunca se configuró. */
  diasHabiles: number | null;
  activo: boolean;
  /** true si ya existe una fila persistida para este tramo. */
  configured: boolean;
}

export function getSalesStageSlas(): Promise<SalesStageSlaRow[]> {
  return apiClient.get<SalesStageSlaRow[]>("/api/admin/sales-stage-slas").then((r) => r.data);
}

export function putSalesStageSla(
  step: string,
  body: { diasHabiles: number; activo?: boolean },
): Promise<unknown> {
  return apiClient.put(`/api/admin/sales-stage-slas/${step}`, body).then((r) => r.data);
}

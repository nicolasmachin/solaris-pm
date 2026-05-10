import { apiClient } from "./axios";
import type { Moneda } from "../types/finance.types";
import type { FixedCostPeriodicity } from "./fixedCosts.api";

export type PendingItemSourceType =
  | "FIXED_COST"
  | "PROJECT_MATERIAL"
  | "SUPPLIER_DEBT"
  | "COMMITTED_EXPENSE";

export interface PendingItem {
  id: string;
  sourceType: PendingItemSourceType;
  sourceId: string;
  fecha: string;
  descripcion: string;
  categoria: string;
  monto: number;
  moneda: Moneda;
  project: { id: string; clientName: string; code: string } | null;
  supplier: { id: string; nombre: string } | null;
  fixedCost: { id: string; nombre: string; periodicidad: FixedCostPeriodicity } | null;
  isOverdue: boolean;
}

export interface PendingResponse {
  items: PendingItem[];
  generatedAt: string;
}

export async function getPendingItems(): Promise<PendingResponse> {
  const { data } = await apiClient.get<PendingResponse>("/api/finance/pending");
  return data;
}

export async function deletePendingItem(
  sourceType: PendingItemSourceType,
  sourceId: string,
): Promise<void> {
  await apiClient.delete(`/api/finance/pending/${sourceType}/${sourceId}`);
}

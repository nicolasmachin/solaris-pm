import { apiClient } from "./axios";
import type { CategoriaPrincipal, Moneda } from "../types/finance.types";
import type { FixedCostPeriodicity } from "./fixedCosts.api";

export type PendingItemSourceType =
  | "FIXED_COST"
  | "PROJECT_MATERIAL"
  | "SUPPLIER_DEBT"
  | "COMMITTED_EXPENSE"
  | "MANUAL_PENDING";

export interface PendingItem {
  id: string;
  sourceType: PendingItemSourceType;
  sourceId: string;
  fecha: string;
  descripcion: string;
  categoria: string;
  tipoMovimiento: "INGRESO" | "GASTO";
  monto: number;
  moneda: Moneda;
  project: { id: string; clientName: string; code: string } | null;
  supplier: { id: string; nombre: string } | null;
  fixedCost: { id: string; nombre: string; periodicidad: FixedCostPeriodicity } | null;
  isOverdue: boolean;
}

export interface ProjectMaterialItem {
  id: string;
  sourceId: string;
  materialNombre: string;
  quantity: number;
  unitPrice: number;
  monto: number;
  moneda: Moneda;
  fecha: string;
  isOverdue: boolean;
}

export interface ProjectMaterialCategoria {
  categoria: string;
  totalAmount: number;
  items: ProjectMaterialItem[];
}

export interface ProjectMaterialGroup {
  projectId: string;
  clientName: string;
  projectCode: string;
  totalAmount: number;
  moneda: Moneda;
  earliestDate: string;
  overdueCount: number;
  categorias: ProjectMaterialCategoria[];
}

export interface PendingResponse {
  items: PendingItem[];
  projectMaterialGroups: ProjectMaterialGroup[];
  generatedAt: string;
}

export async function getPendingItems(): Promise<PendingResponse> {
  const { data } = await apiClient.get<PendingResponse>("/api/finance/pending");
  return data;
}

export interface CreateManualPendingBody {
  tipoMovimiento: "INGRESO" | "GASTO";
  descripcion: string;
  monto: number;
  moneda: Moneda;
  categoriaPrincipal: CategoriaPrincipal;
  fechaEsperada: string;
  projectId?: string | null;
}

export async function createManualPending(body: CreateManualPendingBody): Promise<{ id: string }> {
  const { data } = await apiClient.post<{ id: string }>("/api/finance/pending", body);
  return data;
}

export async function deletePendingItem(
  sourceType: PendingItemSourceType,
  sourceId: string,
): Promise<void> {
  await apiClient.delete(`/api/finance/pending/${sourceType}/${sourceId}`);
}

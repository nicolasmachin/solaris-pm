import { apiClient } from "./axios";
import type { Moneda } from "../types/finance.types";

export type FixedCostPeriodicity = "MENSUAL" | "BIMENSUAL" | "ANUAL";

export interface FixedCostDto {
  id: string;
  nombre: string;
  descripcion: string | null;
  periodicidad: FixedCostPeriodicity;
  diaDelMes: number;
  mesesPares: boolean | null;
  mesAnual: number | null;
  montoReferencia: number;
  moneda: Moneda;
  activo: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface FixedCostPendingDto extends FixedCostDto {
  ultimoMontoPagado: number;
  ultimoPagoFecha: string | null;
}

export interface FixedCostInput {
  nombre: string;
  descripcion?: string | null;
  periodicidad: FixedCostPeriodicity;
  diaDelMes: number;
  mesesPares?: boolean | null;
  mesAnual?: number | null;
  montoReferencia: number;
  moneda?: Moneda;
  activo?: boolean;
}

export async function listFixedCosts(): Promise<FixedCostDto[]> {
  const { data } = await apiClient.get<FixedCostDto[]>("/api/admin/fixed-costs");
  return data;
}

export async function createFixedCost(body: FixedCostInput): Promise<FixedCostDto> {
  const { data } = await apiClient.post<FixedCostDto>("/api/admin/fixed-costs", body);
  return data;
}

export async function updateFixedCost(id: string, body: Partial<FixedCostInput>): Promise<FixedCostDto> {
  const { data } = await apiClient.patch<FixedCostDto>(`/api/admin/fixed-costs/${id}`, body);
  return data;
}

export async function deleteFixedCost(id: string): Promise<void> {
  await apiClient.delete(`/api/admin/fixed-costs/${id}`);
}

export async function listPendingFixedCosts(mes: number, anio: number): Promise<FixedCostPendingDto[]> {
  const { data } = await apiClient.get<FixedCostPendingDto[]>("/api/finance/fixed-costs/pending", {
    params: { mes, anio },
  });
  return data;
}

const PERIODICIDAD_LABEL: Record<FixedCostPeriodicity, string> = {
  MENSUAL: "Mensual",
  BIMENSUAL: "Bimensual",
  ANUAL: "Anual",
};
const MONTHS_FULL = [
  "Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio",
  "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre",
];

export function formatPeriodicidad(fc: FixedCostDto): string {
  if (fc.periodicidad === "BIMENSUAL") {
    return `${PERIODICIDAD_LABEL.BIMENSUAL} (${fc.mesesPares ? "pares" : "impares"})`;
  }
  if (fc.periodicidad === "ANUAL" && fc.mesAnual) {
    return `${PERIODICIDAD_LABEL.ANUAL} (${MONTHS_FULL[fc.mesAnual - 1]})`;
  }
  return PERIODICIDAD_LABEL[fc.periodicidad];
}

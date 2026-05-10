import { apiClient } from "./axios";
import type { Moneda } from "../types/finance.types";

export type ResultsPeriodo = "MENSUAL" | "TRIMESTRAL" | "ANUAL";

export interface ResultItem {
  id: string;
  fecha: string;
  descripcion: string;
  monto: number;
  moneda: Moneda;
  projectClientName: string | null;
  projectCode: string | null;
  supplierName: string | null;
}

export interface ResultProjectGroup {
  projectId: string;
  clientName: string;
  code: string;
  total: number;
  items: ResultItem[];
}

export interface ResultsCategoryItems {
  total: number;
  items: ResultItem[];
}

export interface ResultsCategoryByProject {
  total: number;
  byProject: ResultProjectGroup[];
}

export interface ResultsDto {
  periodo: ResultsPeriodo;
  anio: number;
  mes: number | null;
  trimestre: number | null;
  fechaInicio: string;
  fechaFin: string;
  fallbackUsdToUyu: number;
  ingresos: ResultsCategoryItems;
  egresos: {
    total: number;
    costosFijos: ResultsCategoryItems;
    costosVariables: ResultsCategoryItems;
    salidasProyecto: ResultsCategoryByProject;
    pagoProveedores: ResultsCategoryItems;
    comprasStock: ResultsCategoryItems;
    otros: ResultsCategoryItems;
  };
  resultado: number;
  rentabilidad: number;
}

export interface ResultsQuery {
  periodo: ResultsPeriodo;
  anio: number;
  mes?: number;
  trimestre?: number;
}

export async function getFinanceResults(q: ResultsQuery): Promise<ResultsDto> {
  const { data } = await apiClient.get<ResultsDto>("/api/finance/results", { params: q });
  return data;
}

import { apiClient } from "./axios";

export type TarifaUte = "SIMPLE" | "DOBLE" | "TRIPLE" | "ZAFRAL";
export type FranjaHoraria = "PUNTA" | "LLANO" | "VALLE" | "FUERA_PUNTA";

export const TARIFAS: TarifaUte[] = ["SIMPLE", "DOBLE", "TRIPLE", "ZAFRAL"];

export const TARIFA_LABEL: Record<TarifaUte, string> = {
  SIMPLE: "Simple",
  DOBLE: "Doble horario",
  TRIPLE: "Triple horario",
  ZAFRAL: "Zafral",
};

export const FRANJA_LABEL: Record<FranjaHoraria, string> = {
  PUNTA: "Punta",
  LLANO: "Llano",
  VALLE: "Valle",
  FUERA_PUNTA: "Fuera de punta",
};

// Franjas que aplican a cada tarifa. La simple no usa franjas (va por tramos de
// consumo) y la doble sólo distingue punta / fuera de punta.
export const FRANJAS_POR_TARIFA: Record<TarifaUte, FranjaHoraria[]> = {
  SIMPLE: [],
  DOBLE: ["PUNTA", "FUERA_PUNTA"],
  TRIPLE: ["PUNTA", "LLANO", "VALLE"],
  ZAFRAL: ["PUNTA", "LLANO", "VALLE"],
};

export interface TarifaVersionRow {
  id: string;
  nombre: string;
  vigenteDesde: string;
  vigenteHasta: string | null;
  publicada: boolean;
  ivaPct: number;
  irpfPct: number;
  notas: string | null;
  creadaPor: string;
  createdAt: string;
  calculosUsando: number;
}

export interface TarifaCargo {
  tarifa: TarifaUte;
  cargoFijo: number;
  cargoPotenciaKw: number;
}

export interface TarifaTramo {
  tarifa: TarifaUte;
  orden: number;
  desdeKwh: number;
  hastaKwh: number;
  precioKwh: number;
}

export interface TarifaFranja {
  tarifa: TarifaUte;
  franja: FranjaHoraria;
  precioKwh: number;
}

export interface TarifaVersionDetalle extends Omit<TarifaVersionRow, "createdAt"> {
  cargos: TarifaCargo[];
  tramos: TarifaTramo[];
  franjas: TarifaFranja[];
}

export interface GuardarCuadroInput {
  nombre?: string;
  vigenteDesde?: string;
  ivaPct?: number;
  irpfPct?: number;
  notas?: string | null;
  cargos?: TarifaCargo[];
  tramos?: TarifaTramo[];
  franjas?: TarifaFranja[];
}

export async function listarTarifas(): Promise<TarifaVersionRow[]> {
  const { data } = await apiClient.get<{ versiones: TarifaVersionRow[] }>("/reportes-fv/tarifas");
  return data.versiones;
}

export async function getTarifa(id: string): Promise<TarifaVersionDetalle> {
  const { data } = await apiClient.get<TarifaVersionDetalle>(`/reportes-fv/tarifas/${id}`);
  return data;
}

export async function crearTarifa(
  input: GuardarCuadroInput & { nombre: string; vigenteDesde: string; clonarDeId?: string },
): Promise<string> {
  const { data } = await apiClient.post<{ id: string }>("/reportes-fv/tarifas", input);
  return data.id;
}

export async function actualizarTarifa(id: string, input: GuardarCuadroInput): Promise<void> {
  await apiClient.put(`/reportes-fv/tarifas/${id}`, input);
}

export async function publicarTarifa(id: string): Promise<void> {
  await apiClient.post(`/reportes-fv/tarifas/${id}/publicar`, { confirmar: true });
}

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
  const { data } = await apiClient.get<{ versiones: TarifaVersionRow[] }>("/api/reportes-fv/tarifas");
  return data.versiones;
}

export async function getTarifa(id: string): Promise<TarifaVersionDetalle> {
  const { data } = await apiClient.get<TarifaVersionDetalle>(`/api/reportes-fv/tarifas/${id}`);
  return data;
}

export async function crearTarifa(
  input: GuardarCuadroInput & { nombre: string; vigenteDesde: string; clonarDeId?: string },
): Promise<string> {
  const { data } = await apiClient.post<{ id: string }>("/api/reportes-fv/tarifas", input);
  return data.id;
}

export async function actualizarTarifa(id: string, input: GuardarCuadroInput): Promise<void> {
  await apiClient.put(`/api/reportes-fv/tarifas/${id}`, input);
}

export async function publicarTarifa(id: string): Promise<void> {
  await apiClient.post(`/api/reportes-fv/tarifas/${id}/publicar`, { confirmar: true });
}

// ─── Panel de gestión ────────────────────────────────────────────────────────

export type EstadoGenerador =
  | "SIN_ALTA"
  | "DESHABILITADO"
  | "BLOQUEADO"
  | "SIN_LECTURA"
  | "LECTURA_INCOMPLETA"
  | "CALCULADO"
  | "PDF_LISTO"
  | "ENVIADO";

export interface FilaPanel {
  projectId: string;
  clientName: string;
  dadoDeAlta: boolean;
  habilitado: boolean;
  origenDatos: "GROWATT" | "MANUAL" | null;
  tipoCliente: "residencial" | "empresa" | null;
  potenciaEstimada: boolean;
  bloqueosCalculo: string[];
  bloqueosEnvio: string[];
  advertencias: string[];
  tieneDestinatario: boolean;
  estado: EstadoGenerador;
  generacionKwh: number | null;
  consumoKwh: number | null;
  exportacionKwh: number | null;
  lecturaCompleta: boolean;
  diasConDatos: number | null;
  diasEsperados: number | null;
  ahorroTotal: number | null;
  ahorroTotalUsd: number | null;
  retornoInversionPct: number | null;
  emisionId: string | null;
  emisionVersion: number | null;
  emisionEstado: string | null;
  enviado: boolean;
}

export interface KpisPanel {
  total: number;
  dadosDeAlta: number;
  sinAlta: number;
  conLecturaCompleta: number;
  calculados: number;
  pdfListos: number;
  enviados: number;
  bloqueados: number;
}

export interface PanelReporteFv {
  periodo: string;
  kpis: KpisPanel;
  generadores: FilaPanel[];
}

export interface DestinatarioDto {
  email: string;
  nombre: string | null;
  esCopia: boolean;
}

export interface DetalleGenerador {
  projectId: string;
  clientName: string;
  dadoDeAlta: boolean;
  proyecto: {
    capacityKwp: number | null;
    budgetUsd: number | null;
    clientEmail: string | null;
    mesInicioSugerido: string | null;
  };
  config: {
    habilitado: boolean;
    tipoCliente: "residencial" | "empresa";
    tarifaContratada: "simple" | "doble" | "triple" | "zafral" | null;
    origenDatos: "GROWATT" | "MANUAL";
    growattPlantId: string | null;
    potenciaContratadaKw: number | null;
    pctPunta: number | null;
    pctLlano: number | null;
    pctValle: number | null;
    inversionUsd: number | null;
    potenciaInstaladaKwp: number | null;
    mesInicio: string | null;
    notasFijas: string | null;
    destinatarios: DestinatarioDto[];
    efectivo: {
      potenciaEstimada: boolean;
      heredados: string[];
      bloqueosCalculo: string[];
      bloqueosEnvio: string[];
      advertencias: string[];
      destinatariosEfectivos: DestinatarioDto[];
    };
  } | null;
  emisiones: Array<{
    id: string;
    periodo: string;
    version: number;
    estado: string;
    tienePdf: boolean;
    publicadoEnPortal: boolean;
    enviado: boolean;
    generadoEn: string;
  }>;
}

export interface GuardarConfigInput {
  habilitado?: boolean;
  tipoCliente?: "residencial" | "empresa";
  tarifaContratada?: "simple" | "doble" | "triple" | "zafral" | null;
  potenciaContratadaKw?: number | null;
  pctPunta?: number | null;
  pctLlano?: number | null;
  pctValle?: number | null;
  inversionUsd?: number | null;
  potenciaInstaladaKwp?: number | null;
  mesInicio?: string | null;
  origenDatos?: "GROWATT" | "MANUAL";
  growattPlantId?: string | null;
  notasFijas?: string | null;
  destinatarios?: DestinatarioDto[];
}

export interface GuardarLecturaInput {
  generacionKwh?: number | null;
  consumoKwh?: number | null;
  exportacionKwh?: number | null;
  nota?: string | null;
}

export async function getPanel(periodo: string): Promise<PanelReporteFv> {
  const { data } = await apiClient.get<PanelReporteFv>("/api/reportes-fv/panel", { params: { periodo } });
  return data;
}

export async function getPeriodos(): Promise<string[]> {
  const { data } = await apiClient.get<{ periodos: string[] }>("/api/reportes-fv/periodos");
  return data.periodos;
}

export async function getDetalleGenerador(projectId: string): Promise<DetalleGenerador> {
  const { data } = await apiClient.get<DetalleGenerador>(`/api/reportes-fv/generadores/${projectId}`);
  return data;
}

export async function guardarConfig(projectId: string, input: GuardarConfigInput): Promise<void> {
  await apiClient.put(`/api/reportes-fv/generadores/${projectId}/config`, input);
}

export async function guardarLectura(
  projectId: string,
  periodo: string,
  input: GuardarLecturaInput,
): Promise<void> {
  await apiClient.put(`/api/reportes-fv/generadores/${projectId}/lecturas/${periodo}`, input);
}

export async function recalcularGenerador(projectId: string): Promise<void> {
  await apiClient.post(`/api/reportes-fv/generadores/${projectId}/recalcular`);
}

export async function emitirReporte(
  projectId: string,
  periodo: string,
): Promise<{ emisionId: string; version: number }> {
  const { data } = await apiClient.post<{ emisionId: string; version: number }>(
    `/api/reportes-fv/generadores/${projectId}/emitir`,
    { periodo },
  );
  return data;
}

/** URL absoluta del PDF de una emisión (para iframe / descarga con auth). */
export function reporteFvPdfUrl(emisionId: string): string {
  const base = apiClient.defaults.baseURL ?? "";
  return `${base}/api/reportes-fv/emisiones/${emisionId}/pdf`;
}

import { apiClient } from "./axios";

// Trámites con UTE Comercial: lo que se le pide a UTE Comercial y no es la
// habilitación del generador. Los tipos son los del campo "Trámite" del
// formulario de UTE, más "Otro".

export type UteComercialTipo =
  | "NUEVO_SERVICIO"
  | "AUMENTO"
  | "REDUCCION"
  | "REHABILITACION"
  | "INSTALACION_ENLACE"
  | "PROVISORIO_GENERAL"
  | "PROVISORIO_OBRA"
  | "OTRO";

export type UteComercialEstado = "A_PEDIR" | "PEDIDO" | "OBSERVADO" | "RESUELTO" | "CANCELADO";

export const TIPO_COMERCIAL_ORDER: UteComercialTipo[] = [
  "AUMENTO",
  "NUEVO_SERVICIO",
  "REDUCCION",
  "REHABILITACION",
  "INSTALACION_ENLACE",
  "PROVISORIO_GENERAL",
  "PROVISORIO_OBRA",
  "OTRO",
];

export const TIPO_COMERCIAL_LABEL: Record<UteComercialTipo, string> = {
  NUEVO_SERVICIO: "Nuevo servicio",
  AUMENTO: "Aumento de potencia",
  REDUCCION: "Reducción de potencia",
  REHABILITACION: "Rehabilitación",
  INSTALACION_ENLACE: "Instalación de enlace",
  PROVISORIO_GENERAL: "Provisorio general",
  PROVISORIO_OBRA: "Provisorio de obra",
  OTRO: "Otro",
};

export const ESTADO_COMERCIAL_ORDER: UteComercialEstado[] = [
  "A_PEDIR",
  "PEDIDO",
  "OBSERVADO",
  "RESUELTO",
  "CANCELADO",
];

export const ESTADO_COMERCIAL_LABEL: Record<UteComercialEstado, string> = {
  A_PEDIR: "A pedir",
  PEDIDO: "Pedido",
  OBSERVADO: "Observado",
  RESUELTO: "Resuelto",
  CANCELADO: "Cancelado",
};

export const ESTADO_COMERCIAL_COLORS: Record<UteComercialEstado, { bg: string; text: string }> = {
  A_PEDIR: { bg: "rgba(148,163,184,0.18)", text: "#94a3b8" },
  PEDIDO: { bg: "rgba(167,139,250,0.18)", text: "#a78bfa" },
  OBSERVADO: { bg: "rgba(251,146,60,0.18)", text: "#fb923c" },
  RESUELTO: { bg: "rgba(52,211,153,0.18)", text: "#34d399" },
  CANCELADO: { bg: "rgba(148,163,184,0.12)", text: "#64748b" },
};

/** Color propio de la sección Comercial, para distinguirla de la habilitación. */
export const COMERCIAL_COLOR = "#a78bfa";

export const ESTADOS_COMERCIAL_ABIERTOS: UteComercialEstado[] = ["A_PEDIR", "PEDIDO", "OBSERVADO"];

export type UteTramiteComercial = {
  id: string;
  projectId: string;
  project: { id: string; code: string; clientName: string; locationCity: string };
  suministro: number;
  tipo: UteComercialTipo;
  detalle: string | null;
  estado: UteComercialEstado;
  caseNumber: string | null;
  notes: string | null;
  solicitadoEl: string | null;
  resueltoEl: string | null;
  emailLogId: string | null;
  fileAttachmentId: string | null;
  createdAt: string;
  updatedAt: string;
  /** Días con UTE: del pedido a hoy, o hasta que se resolvió. */
  dias: number | null;
};

export type UteComercialInput = {
  projectId: string;
  suministro?: number;
  tipo: UteComercialTipo;
  detalle?: string | null;
  estado?: UteComercialEstado;
  caseNumber?: string | null;
  notes?: string | null;
  solicitadoEl?: string | null;
};

export type UteComercialPatch = Partial<Omit<UteComercialInput, "projectId">> & {
  resueltoEl?: string | null;
};

export async function getTramitesComerciales(projectId?: string): Promise<UteTramiteComercial[]> {
  const { data } = await apiClient.get("/api/ute-tramites-comerciales", {
    params: projectId ? { projectId } : undefined,
  });
  return data;
}

export async function createTramiteComercial(input: UteComercialInput): Promise<UteTramiteComercial> {
  const { data } = await apiClient.post("/api/ute-tramites-comerciales", input);
  return data;
}

export async function patchTramiteComercial(
  id: string,
  patch: UteComercialPatch,
): Promise<UteTramiteComercial> {
  const { data } = await apiClient.patch(`/api/ute-tramites-comerciales/${id}`, patch);
  return data;
}

export async function deleteTramiteComercial(id: string): Promise<void> {
  await apiClient.delete(`/api/ute-tramites-comerciales/${id}`);
}

import { apiClient } from "./axios";

export type SurveyTipo = "OBRA" | "HABILITACION" | "ANIVERSARIO";
export type SurveyEstado = "PENDIENTE" | "RESPONDIDA";

export interface EncuestaRow {
  id: string;
  projectId: string;
  projectName: string;
  projectCode: string;
  tipo: SurveyTipo;
  estado: SurveyEstado;
  edicion: number;
  nota: number | null;
  comentario: string | null;
  notaBaja: boolean;
  respondidaEn: string | null;
  respondidaPorNombre: string | null;
  traspasoId: string | null;
  createdAt: string;
}

export interface EncuestaDetalle {
  id: string;
  projectId: string;
  tipo: SurveyTipo;
  estado: SurveyEstado;
  edicion: number;
  nota: number | null;
  comentario: string | null;
  notaBaja: boolean;
  respondidaEn: string | null;
  respondidaPorNombre: string | null;
  traspasoId: string | null;
  createdAt: string;
  updatedAt: string;
}

export async function listEncuestas(params?: {
  tipo?: SurveyTipo;
  estado?: SurveyEstado;
  projectId?: string;
  notaBaja?: boolean;
}): Promise<EncuestaRow[]> {
  const { data } = await apiClient.get<{ encuestas: EncuestaRow[] }>("/api/encuestas", { params });
  return data.encuestas;
}

export async function getEncuesta(id: string): Promise<EncuestaDetalle> {
  const { data } = await apiClient.get<EncuestaDetalle>(`/api/encuestas/${id}`);
  return data;
}

// ─── Helpers de presentación (compartidos por la UI) ─────────────────────────

export const TIPO_LABEL: Record<SurveyTipo, string> = {
  OBRA: "Instalación",
  HABILITACION: "Habilitación",
  ANIVERSARIO: "Aniversario",
};

export const ESTADO_LABEL: Record<SurveyEstado, string> = {
  PENDIENTE: "Pendiente",
  RESPONDIDA: "Respondida",
};

// Etiqueta larga del tipo, incluyendo el año para los aniversarios.
export function tipoLabelConEdicion(tipo: SurveyTipo, edicion: number): string {
  if (tipo === "ANIVERSARIO" && edicion > 0) return `Aniversario (año ${edicion})`;
  return TIPO_LABEL[tipo];
}

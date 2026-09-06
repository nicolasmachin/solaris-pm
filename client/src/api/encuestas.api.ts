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
  nota2: number | null;
  nota3: number | null;
  notaPromedio: number | null; // puntaje de la encuesta
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
  nota2: number | null;
  nota3: number | null;
  notaPromedio: number | null;
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


// Las preguntas de cada encuesta, para mostrarlas junto a las notas en el panel
// interno. Tienen que coincidir con services/encuestas/preguntas.ts del backend.
export const PREGUNTAS_POR_TIPO: Record<SurveyTipo, [string, string, string]> = {
  OBRA: [
    "Conformidad general con Voltia",
    "Claridad e información del proceso",
    "Trabajo del equipo el día de la instalación",
  ],
  HABILITACION: [
    "Conformidad general",
    "Acompañamiento durante la espera",
    "Claridad del momento de encender",
  ],
  ANIVERSARIO: [
    "Conformidad con el sistema y con Voltia",
    "Probabilidad de recomendarnos",
    "Respuesta recibida cuando necesitó algo",
  ],
};

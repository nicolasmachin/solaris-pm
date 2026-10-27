import { apiClient } from "./axios";

export type ModeloAsistente = "auto" | "haiku" | "sonnet" | "opus";

export interface ContextoAsistente {
  leadId?: string | null;
  projectId?: string | null;
}

export interface RespuestaAsistente {
  conversacionId: string;
  texto: string;
  modelo: Exclude<ModeloAsistente, "auto">;
  modeloNombre: string;
  herramientas: string[];
}

export interface EstadoAsistente {
  habilitado: boolean;
  modelos: Array<{ clave: string; nombre: string }>;
  topeDiarioUsd: number;
  gastoHoyUsd: number;
}

export interface ConversacionResumen {
  id: string;
  titulo: string;
  actualizada: string;
}

export interface MensajeGuardado {
  role: "user" | "assistant";
  content: string;
  modelo: string | null;
  herramientas: string[];
}

export const getEstadoAsistente = () =>
  apiClient.get<EstadoAsistente>("/api/asistente/estado").then((r) => r.data);

export const chatAsistente = (body: {
  conversacionId: string | null;
  mensaje: string;
  modelo: ModeloAsistente;
  contexto: ContextoAsistente;
}) => apiClient.post<RespuestaAsistente>("/api/asistente/chat", body).then((r) => r.data);

export const listarConversacionesAsistente = () =>
  apiClient.get<ConversacionResumen[]>("/api/asistente/conversaciones").then((r) => r.data);

export const leerConversacionAsistente = (id: string) =>
  apiClient
    .get<{ id: string; mensajes: MensajeGuardado[] }>(`/api/asistente/conversaciones/${id}`)
    .then((r) => r.data);

export const borrarConversacionAsistente = (id: string) =>
  apiClient.delete(`/api/asistente/conversaciones/${id}`).then((r) => r.data);

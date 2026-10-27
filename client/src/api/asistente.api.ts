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

export interface AdjuntoAsistente {
  id: string;
  nombre: string;
  mimeType: string;
}

export interface MensajeGuardado {
  role: "user" | "assistant";
  content: string;
  modelo: string | null;
  herramientas: string[];
  adjuntos: AdjuntoAsistente[];
}

export const getEstadoAsistente = () =>
  apiClient.get<EstadoAsistente>("/api/asistente/estado").then((r) => r.data);

export const chatAsistente = (body: {
  conversacionId: string | null;
  mensaje: string;
  adjuntoIds: string[];
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

export const subirAdjuntoAsistente = (archivo: File) => {
  const form = new FormData();
  form.append("file", archivo, archivo.name);
  return apiClient
    .post<AdjuntoAsistente>("/api/asistente/adjuntos", form, { headers: { "Content-Type": "multipart/form-data" } })
    .then((r) => r.data);
};

/** Abre un adjunto en otra pestaña (va con el token, por eso no es un link directo). */
export const abrirAdjuntoAsistente = async (id: string) => {
  const r = await apiClient.get<Blob>(`/api/asistente/adjuntos/${id}`, { responseType: "blob" });
  const url = URL.createObjectURL(r.data);
  window.open(url, "_blank", "noopener");
  setTimeout(() => URL.revokeObjectURL(url), 60_000);
};

export const transcribirAudioAsistente = (audio: Blob, nombre: string) => {
  const form = new FormData();
  form.append("file", audio, nombre);
  return apiClient
    .post<{ texto: string }>("/api/asistente/transcribir", form, { headers: { "Content-Type": "multipart/form-data" } })
    .then((r) => r.data);
};

/** La respuesta en voz alta (mp3), de a un pedazo de texto. */
export const vozAsistente = (texto: string) =>
  apiClient.post<Blob>("/api/asistente/voz", { texto }, { responseType: "blob" }).then((r) => r.data);

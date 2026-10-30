import { apiClient } from "./axios";

// Marketing → Instagram: la bandeja de privados del contestador.
// Ver server/src/routes/marketing.routes.ts.

export type InstagramAutor = "CLIENTE" | "ASISTENTE" | "PERSONA" | "OTRO";
export type InstagramEstado = "TOMADA" | "DERIVADA" | "ASISTENTE";

export interface InstagramConversacion {
  id: string;
  persona: string;
  usuario: string | null;
  nombre: string | null;
  desdeAnuncio: boolean;
  estado: InstagramEstado;
  derivadaMotivo: string | null;
  tomadaPor: string | null;
  ultimoMensajeEn: string | null;
  ultimoTexto: string | null;
  ultimoAutor: InstagramAutor | null;
  noLeidos: number;
  ventanaAbierta: boolean;
  ventanaHasta: string | null;
  lead: { id: string; code: string | null; nombre: string | null } | null;
}

export interface InstagramMensaje {
  id: string;
  autor: InstagramAutor;
  texto: string;
  enviadoEn: string;
  enviadoPor: string | null;
}

export async function getInstagramEstado() {
  const { data } = await apiClient.get<{ conectado: boolean }>("/api/marketing/instagram/estado");
  return data;
}

export async function getInstagramConversaciones() {
  const { data } = await apiClient.get<InstagramConversacion[]>("/api/marketing/instagram/conversaciones");
  return data;
}

export async function getInstagramConversacion(id: string) {
  const { data } = await apiClient.get<{ conversacion: InstagramConversacion; mensajes: InstagramMensaje[] }>(
    `/api/marketing/instagram/conversaciones/${id}`,
  );
  return data;
}

export async function enviarInstagram(id: string, texto: string) {
  const { data } = await apiClient.post<{ mid: string }>(`/api/marketing/instagram/conversaciones/${id}/enviar`, { texto });
  return data;
}

export async function tomarInstagram(id: string, tomada: boolean) {
  const { data } = await apiClient.post(`/api/marketing/instagram/conversaciones/${id}/tomar`, { tomada });
  return data;
}

export async function crearLeadInstagram(
  id: string,
  body: { clientName: string; clientPhone?: string | null; notes?: string | null },
) {
  const { data } = await apiClient.post<{ id: string; code: string }>(
    `/api/marketing/instagram/conversaciones/${id}/lead`,
    body,
  );
  return data;
}

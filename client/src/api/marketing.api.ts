import { apiClient } from "./axios";

// Marketing → Instagram: la bandeja de privados, las automatizaciones, los contactos y las consultas.
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

export interface InstagramEstadoAsistente {
  modo: "apagado" | "sombra" | "envio";
  conectado: boolean;
  webhook: boolean;
  gasto: { usd: number; llamadas: number; topeUsd: number };
  derivarA: string;
  derivarWhatsapp: string;
}

export interface InstagramEvento {
  id: string;
  tipo: string;
  resultado: string;
  razon: string | null;
  sombra: boolean;
  creadoEn: string;
  datos: { mensajes?: string[]; motivo?: string; temas?: string[] };
}

export interface MarketingAutomatizacion {
  id: string;
  nombre: string;
  activa: boolean;
  disparador: "comentario" | "privado" | "seguimiento" | "texto";
  palabras: string[];
  publicaciones: string[];
  link: string;
  espera: [number, number];
  topeDiario: number;
  flujo: string;
  actualizadoPor: string | null;
  actualizadoEn: string;
  actividad: { hoy: number; semana: number; contestados: number; sombra: number };
}

export interface InstagramContacto {
  id: string;
  persona: string | null;
  usuario: string | null;
  nombre: string | null;
  sigue: boolean | null;
  importado: boolean;
  primeraVez: string;
  ultimaVez: string;
  lead: { id: string; code: string } | null;
  etiquetas: Array<{ nombre: string; veces: number; ultima: string; importada: boolean }>;
}

export interface InstagramDia {
  dia: string;
  personas: number;
  nuevas: number;
  anuncio: number;
  organico: number;
  speech: number;
  derivadas: number;
  leads: number;
  leadMagnets: number;
  comentariosContestados: number;
}

export async function getInstagramEstado() {
  const { data } = await apiClient.get<InstagramEstadoAsistente>("/api/marketing/instagram/estado");
  return data;
}

export async function getAutomatizaciones() {
  const { data } = await apiClient.get<MarketingAutomatizacion[]>("/api/marketing/instagram/automatizaciones");
  return data;
}

export async function editarAutomatizacion(
  id: string,
  cambio: Partial<{ activa: boolean; flujo: string; palabras: string[]; link: string | null; esperaMinSeg: number; esperaMaxSeg: number; topeDiario: number }>,
) {
  const { data } = await apiClient.patch<MarketingAutomatizacion>(`/api/marketing/instagram/automatizaciones/${id}`, cambio);
  return data;
}

export async function getContactosInstagram(f: { etiqueta?: string; texto?: string }) {
  const { data } = await apiClient.get<{ total: number; etiquetas: Array<{ etiqueta: string; contactos: number }>; contactos: InstagramContacto[] }>(
    "/api/marketing/instagram/contactos",
    { params: { etiqueta: f.etiqueta || undefined, texto: f.texto || undefined, cuantos: 200 } },
  );
  return data;
}

export async function getConsultasInstagram(dias = 14) {
  const { data } = await apiClient.get<InstagramDia[]>("/api/marketing/instagram/consultas", { params: { dias } });
  return data;
}

export async function getInstagramConversaciones() {
  const { data } = await apiClient.get<InstagramConversacion[]>("/api/marketing/instagram/conversaciones");
  return data;
}

export async function getInstagramConversacion(id: string) {
  const { data } = await apiClient.get<{ conversacion: InstagramConversacion; mensajes: InstagramMensaje[]; eventos: InstagramEvento[] }>(
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

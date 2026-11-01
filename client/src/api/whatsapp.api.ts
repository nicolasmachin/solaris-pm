import { apiClient } from "./axios";

export type WhatsAppEstadoConfig = {
  faltan: string[];
  webhookListo: boolean;
  phoneNumberId: string | null;
  graphVersion: string;
};

/** Una conversación de una bandeja (un número de Voltia con un teléfono). */
export type WhatsAppConversacion = {
  telefono: string;
  ultimoTexto: string;
  ultimaDireccion: "ENTRANTE" | "SALIENTE";
  ultimoEn: string;
  total: number;
  ventanaAbierta: boolean;
  noLeida: boolean;
  sinContestar: boolean;
  cliente: WhatsAppCliente | null;
};

export type WhatsAppCliente = { projectId: string; codigo: string; nombre: string; aMano: boolean };

export type WhatsAppMensaje = {
  id: string;
  waMessageId: string;
  direccion: "ENTRANTE" | "SALIENTE";
  tipo: string;
  texto: string | null;
  plantilla: string | null;
  estado: string | null;
  estadoEn: string | null;
  error: string | null;
  enviadoPor: string | null;
  /** API (Voltia PM) | CELULAR (escrito en el celular) | HISTORIAL */
  origen?: string;
  ocurridoEn: string;
};

export type WhatsAppPlantilla = {
  id: string;
  name: string;
  status: string;
  category: string;
  language: string;
  rejected_reason?: string;
  components?: Array<{ type: string; text?: string }>;
};

export async function getWhatsAppEstado() {
  return (await apiClient.get<WhatsAppEstadoConfig>("/api/whatsapp/estado")).data;
}

export type EnviarWhatsAppBody =
  | { tipo: "plantilla"; telefono: string; plantilla: string; idioma: string; variables?: string[] }
  | { tipo: "texto"; telefono: string; texto: string };

export async function getWhatsAppPlantillas() {
  return (await apiClient.get<WhatsAppPlantilla[]>("/api/whatsapp/plantillas")).data;
}

export async function crearWhatsAppPlantilla(body: {
  nombre: string;
  categoria: "UTILITY" | "MARKETING";
  idioma: string;
  cuerpo: string;
  ejemplos: string[];
}) {
  return (await apiClient.post<{ id: string; status: string; category: string }>("/api/whatsapp/plantillas", body)).data;
}

// ─── Números conectados con el registro integrado de Meta ──────────────────

export type WhatsAppRegistroConfig = {
  faltan: string[];
  appId: string | null;
  configId: string | null;
  graphVersion: string;
};

export type WhatsAppNumero = {
  id: string;
  phoneNumberId: string;
  wabaId: string;
  telefono: string;
  nombreVerificado: string | null;
  coexistencia: boolean;
  etiqueta: string | null;
  uso: WhatsAppUso | null;
  estado: "CONECTADO" | "DESCONECTADO";
  responsable: { id: string; name: string } | null;
  conectadoPor: string | null;
  conectadoEn: string;
  syncContactosEn: string | null;
  syncHistorialEn: string | null;
  historialProgreso: number | null;
  historialError: string | null;
  syncError: string | null;
  puedeSincronizar: boolean;
};

export async function getWhatsAppRegistro() {
  return (await apiClient.get<WhatsAppRegistroConfig>("/api/whatsapp/registro")).data;
}

export async function getWhatsAppNumeros() {
  return (await apiClient.get<WhatsAppNumero[]>("/api/whatsapp/numeros")).data;
}

export async function conectarWhatsAppNumero(body: {
  code: string;
  phoneNumberId: string;
  wabaId: string;
  businessId?: string;
  etiqueta?: string;
  responsableId?: string;
  uso?: WhatsAppUso;
}) {
  return (await apiClient.post<WhatsAppNumero>("/api/whatsapp/numeros", body)).data;
}

export async function sincronizarWhatsAppNumero(id: string) {
  return (await apiClient.post<WhatsAppNumero>(`/api/whatsapp/numeros/${id}/sincronizar`)).data;
}

export async function actualizarWhatsAppNumero(
  id: string,
  body: { etiqueta?: string | null; responsableId?: string | null; uso?: WhatsAppUso | null },
) {
  return (await apiClient.patch(`/api/whatsapp/numeros/${id}`, body)).data;
}

export type WhatsAppUso = "EXPERIENCIA_SOLAR" | "VENTAS";

export const NOMBRE_USO: Record<WhatsAppUso, string> = {
  EXPERIENCIA_SOLAR: "Experiencia Solar (número general)",
  VENTAS: "Ventas (número de un asesor)",
};

// ─── Bandeja de Experiencia Solar ───────────────────────────────────────────

const BANDEJA_ES = "/api/whatsapp/bandeja/experiencia-solar";

export type WhatsAppBandeja = {
  numero: { telefono: string | null; nombre: string | null } | null;
  conversaciones: WhatsAppConversacion[];
};

export async function getBandejaES() {
  return (await apiClient.get<WhatsAppBandeja>(BANDEJA_ES)).data;
}

export async function getConversacionES(telefono: string) {
  return (
    await apiClient.get<{ mensajes: WhatsAppMensaje[]; cliente: WhatsAppCliente | null }>(
      `${BANDEJA_ES}/conversaciones/${encodeURIComponent(telefono)}`,
    )
  ).data;
}

export async function marcarLeidaES(telefono: string) {
  await apiClient.post(`${BANDEJA_ES}/conversaciones/${encodeURIComponent(telefono)}/leida`);
}

export async function marcarResueltaES(telefono: string) {
  await apiClient.post(`${BANDEJA_ES}/conversaciones/${encodeURIComponent(telefono)}/resuelta`);
}

export async function asociarClienteES(telefono: string, projectId: string | null) {
  return (
    await apiClient.put<{ cliente: WhatsAppCliente | null }>(
      `${BANDEJA_ES}/conversaciones/${encodeURIComponent(telefono)}/cliente`,
      { projectId },
    )
  ).data;
}

export async function enviarWhatsAppES(body: EnviarWhatsAppBody) {
  return (await apiClient.post<{ id: string; telefono: string; estado: string | null }>(`${BANDEJA_ES}/enviar`, body)).data;
}

export async function getPlantillasES() {
  return (await apiClient.get<WhatsAppPlantilla[]>(`${BANDEJA_ES}/plantillas`)).data;
}

export type WhatsAppDeProyecto = {
  hayNumero: boolean;
  telefono: string | null;
  sinContestar: { telefono: string; desde: string; texto: string } | null;
  noLeida: boolean;
  mensajes: WhatsAppMensaje[];
};

export async function getWhatsAppDeProyecto(projectId: string) {
  return (await apiClient.get<WhatsAppDeProyecto>(`${BANDEJA_ES}/proyecto/${projectId}`)).data;
}

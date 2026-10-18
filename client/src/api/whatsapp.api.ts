import { apiClient } from "./axios";

export type WhatsAppEstadoConfig = {
  faltan: string[];
  webhookListo: boolean;
  phoneNumberId: string | null;
  graphVersion: string;
};

export type WhatsAppConversacion = {
  telefono: string;
  ultimoTexto: string;
  ultimaDireccion: "ENTRANTE" | "SALIENTE";
  ultimoEn: string;
  total: number;
  ventanaAbierta: boolean;
};

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

export async function getWhatsAppConversaciones() {
  return (await apiClient.get<WhatsAppConversacion[]>("/api/whatsapp/conversaciones")).data;
}

export async function getWhatsAppMensajes(telefono: string) {
  return (await apiClient.get<WhatsAppMensaje[]>(`/api/whatsapp/conversaciones/${encodeURIComponent(telefono)}`)).data;
}

export type EnviarWhatsAppBody =
  | { tipo: "plantilla"; telefono: string; plantilla: string; idioma: string; variables?: string[] }
  | { tipo: "texto"; telefono: string; texto: string };

export async function enviarWhatsApp(body: EnviarWhatsAppBody) {
  return (await apiClient.post<{ id: string; telefono: string; estado: string | null }>("/api/whatsapp/enviar", body)).data;
}

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

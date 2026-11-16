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
  /** Estado del último mensaje si es saliente (para los tildes de la lista). */
  ultimoEstado?: string | null;
  total: number;
  ventanaAbierta: boolean;
  noLeida: boolean;
  /** Mensajes del cliente sin leer en la bandeja (el número del círculo verde). */
  noLeidos?: number;
  sinContestar: boolean;
  cliente: WhatsAppCliente | null;
  /** El nombre que tiene puesto en su WhatsApp quien escribe. */
  nombrePerfil?: string | null;
};

/** El cliente (Experiencia Solar: `projectId`) o el lead (Ventas: `leadId`) de una conversación. */
export type WhatsAppCliente = {
  projectId?: string;
  leadId?: string;
  /** CRM: el contacto de la conversación (tenga o no lead o cliente). */
  contactoId?: string;
  /** Un usuario de Voltia: conversación interna, no cuenta como sin contestar. */
  usuarioId?: string;
  interno?: boolean;
  codigo: string;
  nombre: string;
  aMano: boolean;
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
  /** API (Voltia PM) | CELULAR (escrito en el celular) | HISTORIAL */
  origen?: string;
  ocurridoEn: string;
  /** Foto, audio, video o documento: se pide aparte con la sesión. */
  archivo?: { mime: string | null; nombre: string | null; error: string | null; transcripcion: string | null } | null;
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
  phoneNumberId?: string;
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
  /** El número lo usa otra persona (su responsable): no se muestra. */
  deOtro?: string | null;
  /** Ventas: los asesores con número, para que el admin elija cuál usar. */
  asesores?: WhatsAppAsesor[];
};

export type WhatsAppAsesor = { id: string; nombre: string; telefono: string };

export async function getBandejaES() {
  return (await apiClient.get<WhatsAppBandeja>(BANDEJA_ES)).data;
}

export async function getConversacionES(telefono: string) {
  return (
    await apiClient.get<{ mensajes: WhatsAppMensaje[]; cliente: WhatsAppCliente | null; nombrePerfil?: string | null }>(
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

// ─── Bandeja de Ventas (el número de cada asesor) ────────────────────────────

const BANDEJA_VENTAS = "/api/whatsapp/bandeja/ventas";

/** `asesor`: el admin usando el número de otro asesor. Sin él, la propia. */
function deAsesor(asesor?: string | null) {
  return asesor ? { params: { asesor } } : undefined;
}

export async function getBandejaVentas(asesor?: string | null) {
  return (await apiClient.get<WhatsAppBandeja>(BANDEJA_VENTAS, deAsesor(asesor))).data;
}

export async function getConversacionVentas(telefono: string, asesor?: string | null) {
  return (
    await apiClient.get<{ mensajes: WhatsAppMensaje[]; cliente: WhatsAppCliente | null; nombrePerfil?: string | null }>(
      `${BANDEJA_VENTAS}/conversaciones/${encodeURIComponent(telefono)}`,
      deAsesor(asesor),
    )
  ).data;
}

export async function marcarLeidaVentas(telefono: string, asesor?: string | null) {
  await apiClient.post(`${BANDEJA_VENTAS}/conversaciones/${encodeURIComponent(telefono)}/leida`, undefined, deAsesor(asesor));
}

export async function marcarResueltaVentas(telefono: string, asesor?: string | null) {
  await apiClient.post(`${BANDEJA_VENTAS}/conversaciones/${encodeURIComponent(telefono)}/resuelta`, undefined, deAsesor(asesor));
}

export async function asociarLeadVentas(telefono: string, leadId: string | null, asesor?: string | null) {
  return (
    await apiClient.put<{ cliente: WhatsAppCliente | null }>(
      `${BANDEJA_VENTAS}/conversaciones/${encodeURIComponent(telefono)}/cliente`,
      { leadId },
      deAsesor(asesor),
    )
  ).data;
}

export async function enviarWhatsAppVentas(body: EnviarWhatsAppBody, asesor?: string | null) {
  return (
    await apiClient.post<{ id: string; telefono: string; estado: string | null }>(`${BANDEJA_VENTAS}/enviar`, body, deAsesor(asesor))
  ).data;
}

export async function getPlantillasVentas(asesor?: string | null) {
  return (await apiClient.get<WhatsAppPlantilla[]>(`${BANDEJA_VENTAS}/plantillas`, deAsesor(asesor))).data;
}

export type WhatsAppDeLead = WhatsAppDeProyecto & {
  /** El admin sin número propio: el asesor del lead, por cuyo número se ve. null = el propio. */
  asesorId: string | null;
};

export async function getWhatsAppDeLead(leadId: string) {
  return (await apiClient.get<WhatsAppDeLead>(`${BANDEJA_VENTAS}/lead/${leadId}`)).data;
}

/** Dónde se pide el archivo de un mensaje (foto, audio, video, documento). */
export function urlArchivoES(mensajeId: string) {
  return `${BANDEJA_ES}/mensajes/${mensajeId}/archivo`;
}
export function urlArchivoVentas(mensajeId: string, asesor?: string | null) {
  return `${BANDEJA_VENTAS}/mensajes/${mensajeId}/archivo${asesor ? `?asesor=${encodeURIComponent(asesor)}` : ""}`;
}

/** Baja el archivo con la sesión y devuelve una URL local para mostrarlo. */
export async function blobArchivo(url: string) {
  const r = await apiClient.get<Blob>(url, { responseType: "blob" });
  return URL.createObjectURL(r.data);
}

export type ArchivoAEnviar = { telefono: string; archivo: Blob; nombre: string; caption?: string; notaDeVoz?: boolean };

function formArchivo(d: ArchivoAEnviar) {
  const f = new FormData();
  // Los campos van antes que el archivo: el servidor los lee al recibirlo.
  f.append("telefono", d.telefono);
  if (d.caption) f.append("caption", d.caption);
  if (d.notaDeVoz) f.append("notaDeVoz", "1");
  f.append("archivo", d.archivo, d.nombre);
  return f;
}

export async function enviarArchivoES(d: ArchivoAEnviar) {
  return (await apiClient.post(`${BANDEJA_ES}/enviar-archivo`, formArchivo(d))).data;
}
export async function enviarArchivoVentas(d: ArchivoAEnviar, asesor?: string | null) {
  return (await apiClient.post(`${BANDEJA_VENTAS}/enviar-archivo`, formArchivo(d), deAsesor(asesor))).data;
}

import { apiClient } from "./axios";

export type AvisoCanal = "WHATSAPP" | "EMAIL";
export type AvisoEstado = "BORRADOR" | "EN_REVISION" | "RECHAZADO" | "LISTO" | "ACTIVO" | "PAUSADO";

export type AvisoDisparador = {
  clave: string;
  grupo: string;
  etiqueta: string;
  cuando: string;
  variables: string[];
  conDias?: boolean;
};

export type AvisosCatalogo = {
  disparadores: AvisoDisparador[];
  variables: Array<{ clave: string; etiqueta: string; ejemplo: string }>;
  checks: Array<{ codigo: string; etiqueta: string }>;
  condiciones: Array<{ clave: AvisoCondicion; etiqueta: string }>;
};

export type AvisoCondicion = "SIN_CONTACTO" | "PORTAL_CON_MAIL" | "PORTAL_SIN_MAIL" | "MANTENIMIENTO_SIN_COSTO";

export type Aviso = {
  id: string;
  nombre: string;
  disparador: string;
  disparadorEtiqueta: string;
  dias: number | null;
  demoraMinutos: number | null;
  condicion: AvisoCondicion | null;
  canal: AvisoCanal;
  estado: AvisoEstado;
  asunto: string | null;
  cuerpo: string;
  plantillaNombre: string | null;
  plantillaEstado: string | null;
  plantillaMotivo: string | null;
  cierraCheck: string | null;
  adjuntoTipo: "VIDEO" | "IMAGEN" | null;
  adjuntoNombre: string | null;
  adjuntoArchivo: string | null;
  adjuntoTexto: string | null;
  adjuntoUnaVez: boolean;
  adjuntoPlantillaEstado: string | null;
  adjuntoPlantillaMotivo: string | null;
  activadoEn: string | null;
  creadoPor: string | null;
  createdAt: string;
  envios: Partial<Record<"ENVIADO" | "FALLIDO" | "OMITIDO" | "PROGRAMADO", number>>;
};

export type AvisoDatos = {
  nombre: string;
  disparador: string;
  dias?: number | null;
  demoraMinutos?: number | null;
  condicion?: AvisoCondicion | null;
  canal: AvisoCanal;
  asunto?: string | null;
  cuerpo: string;
  cierraCheck?: string | null;
  adjuntoTexto?: string | null;
  adjuntoUnaVez?: boolean;
};

export type AvisoEnvio = {
  id: string;
  avisoId: string;
  projectId: string | null;
  canal: AvisoCanal;
  destino: string | null;
  estado: "ENVIADO" | "FALLIDO" | "OMITIDO" | "PROCESANDO" | "PROGRAMADO" | "ENVIANDO";
  detalle: string | null;
  /** Cuándo sale, si está programado. */
  salirEn: string | null;
  texto: string | null;
  createdAt: string;
  estadoWhatsApp: string | null;
  aviso: { nombre: string; canal: AvisoCanal };
  project: { code: string; clientName: string } | null;
};

export const getAvisosCatalogo = () => apiClient.get<AvisosCatalogo>("/api/avisos/catalogo").then((r) => r.data);
export const getAvisos = () => apiClient.get<Aviso[]>("/api/avisos").then((r) => r.data);
export const getAvisosEnvios = (params: { avisoId?: string; projectId?: string } = {}) =>
  apiClient.get<AvisoEnvio[]>("/api/avisos/envios", { params }).then((r) => r.data);
export const crearAviso = (d: AvisoDatos) => apiClient.post<Aviso>("/api/avisos", d).then((r) => r.data);
export const editarAviso = (id: string, d: AvisoDatos) => apiClient.put<Aviso>(`/api/avisos/${id}`, d).then((r) => r.data);
export const mandarAvisoAMeta = (id: string) => apiClient.post<Aviso>(`/api/avisos/${id}/meta`).then((r) => r.data);
export const activarAviso = (id: string) => apiClient.post<Aviso>(`/api/avisos/${id}/activar`).then((r) => r.data);
export const pausarAviso = (id: string) => apiClient.post<Aviso>(`/api/avisos/${id}/pausar`).then((r) => r.data);
export const borrarAviso = (id: string) => apiClient.delete(`/api/avisos/${id}`);
export const subirAdjuntoAviso = (id: string, archivo: File) => {
  const form = new FormData();
  form.append("file", archivo);
  return apiClient.post<Aviso>(`/api/avisos/${id}/adjunto`, form).then((r) => r.data);
};
export const quitarAdjuntoAviso = (id: string) => apiClient.delete<Aviso>(`/api/avisos/${id}/adjunto`).then((r) => r.data);

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
};

export type Aviso = {
  id: string;
  nombre: string;
  disparador: string;
  disparadorEtiqueta: string;
  dias: number | null;
  canal: AvisoCanal;
  estado: AvisoEstado;
  asunto: string | null;
  cuerpo: string;
  plantillaNombre: string | null;
  plantillaEstado: string | null;
  plantillaMotivo: string | null;
  cierraCheck: string | null;
  activadoEn: string | null;
  creadoPor: string | null;
  createdAt: string;
  envios: Partial<Record<"ENVIADO" | "FALLIDO" | "OMITIDO", number>>;
};

export type AvisoDatos = {
  nombre: string;
  disparador: string;
  dias?: number | null;
  canal: AvisoCanal;
  asunto?: string | null;
  cuerpo: string;
  cierraCheck?: string | null;
};

export type AvisoEnvio = {
  id: string;
  avisoId: string;
  projectId: string | null;
  canal: AvisoCanal;
  destino: string | null;
  estado: "ENVIADO" | "FALLIDO" | "OMITIDO" | "PROCESANDO";
  detalle: string | null;
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

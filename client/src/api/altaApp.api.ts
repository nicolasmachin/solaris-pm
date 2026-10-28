import { apiClient as api } from "./axios";

// Alta del cliente en la aplicación del inversor (Growatt): link de un solo uso
// para que elija usuario y contraseña, o desde el portal.

export type LinksApp = { iphone: string; android: string; web: string };

export type EstadoAltaApp = {
  tienePlantaGrowatt: boolean;
  plantaNombre: string | null;
  webConfigurada: boolean;
  hecha: { usuario: string | null; cuando: string; canal: string } | null;
  linkPendiente: { expiraEn: string; creadoEn: string } | null;
};

export type LinkAltaApp = { url: string; expiraEn: string; mensaje: string; whatsapp: string | null };

export type InfoLinkAltaApp =
  | { estado: "VENCIDO" | "USADO" | "INEXISTENTE" }
  | { estado: "VALIDO"; nombre: string; planta: string; email: string; links: LinksApp };

export type Disponibilidad = { disponible: boolean; motivo?: string };

export const altaAppApi = {
  estado: async (projectId: string) =>
    (await api.get<EstadoAltaApp>(`/api/projects/${projectId}/alta-app`)).data,
  generarLink: async (projectId: string) =>
    (await api.post<LinkAltaApp>(`/api/projects/${projectId}/alta-app/link`, {})).data,

  // Público (página del link)
  info: async (token: string) => (await api.get<InfoLinkAltaApp>(`/api/publico/alta-app/${token}`)).data,
  disponible: async (token: string, usuario: string) =>
    (await api.post<Disponibilidad>(`/api/publico/alta-app/${token}/disponible`, { usuario })).data,
  completar: async (token: string, datos: { usuario: string; password: string; email: string }) =>
    (await api.post<{ usuario: string; links: LinksApp }>(`/api/publico/alta-app/${token}`, datos)).data,

  // Portal
  portal: async () =>
    (await api.get<{ proyectos: Array<{ projectId: string; planta: string; usuario: string | null; email: string }>; links: LinksApp }>(
      "/api/client/alta-app",
    )).data,
  portalDisponible: async (projectId: string, usuario: string) =>
    (await api.post<Disponibilidad>("/api/client/alta-app/disponible", { projectId, usuario })).data,
  portalCompletar: async (projectId: string, datos: { usuario: string; password: string; email: string }) =>
    (await api.post<{ usuario: string; links: LinksApp }>(`/api/client/alta-app/${projectId}`, datos)).data,
};

import { apiClient } from "./axios";

export type InformeEstado = "BORRADOR" | "PENDIENTE" | "APROBADO" | "DEVUELTO";
export type InformeRespuesta = "PENDIENTE" | "APROBADO" | "DEVUELTO";
export type InformeBox = "recibidos" | "enviados" | "todos";

export interface InformeProjectRef {
  codigo: string;
  nombre: string;
}

export interface InformeListItem {
  id: string;
  titulo: string;
  estado: InformeEstado;
  autor: { id: string; nombre: string };
  projectId: string | null;
  project: InformeProjectRef | null;
  enviadoAt: string | null;
  createdAt: string;
  totalDestinatarios: number;
  respondidos: number;
}

export interface InformeAdjunto {
  id: string;
  filename: string;
  mimeType: string;
  sizeBytes: number;
  createdAt: string;
  downloadUrl: string;
  previewUrl: string;
}

export interface InformeDestinatarioDetail {
  usuario: { id: string; nombre: string };
  respuesta: InformeRespuesta;
  comentario: string | null;
  respondidoAt: string | null;
}

export interface InformeDetail {
  id: string;
  titulo: string;
  cuerpo: string;
  estado: InformeEstado;
  autor: { id: string; nombre: string };
  projectId: string | null;
  project: InformeProjectRef | null;
  enviadoAt: string | null;
  createdAt: string;
  adjuntos: InformeAdjunto[];
  destinatarios: InformeDestinatarioDetail[];
  puedeResponder: boolean;
  esAutor: boolean;
}

export interface CrearInformeBody {
  titulo: string;
  cuerpo: string;
  projectId?: string | null;
  destinatariosIds: string[];
}

export type EditarInformeBody = Partial<CrearInformeBody>;

export async function getInformes(params: {
  box?: InformeBox;
  estado?: InformeEstado;
  projectId?: string;
  search?: string;
}): Promise<InformeListItem[]> {
  const clean = Object.fromEntries(
    Object.entries(params).filter(([, v]) => v != null && v !== ""),
  );
  const { data } = await apiClient.get<InformeListItem[]>("/api/informes", { params: clean });
  return data;
}

export async function getInforme(id: string): Promise<InformeDetail> {
  const { data } = await apiClient.get<InformeDetail>(`/api/informes/${id}`);
  return data;
}

export async function crearInforme(body: CrearInformeBody): Promise<{ id: string; titulo: string; estado: InformeEstado }> {
  const { data } = await apiClient.post(`/api/informes`, body);
  return data;
}

export async function editarInforme(id: string, body: EditarInformeBody): Promise<{ id: string }> {
  const { data } = await apiClient.patch(`/api/informes/${id}`, body);
  return data;
}

export async function enviarInforme(id: string): Promise<{ id: string; estado: InformeEstado }> {
  const { data } = await apiClient.post(`/api/informes/${id}/enviar`);
  return data;
}

export async function responderInforme(
  id: string,
  body: { respuesta: "APROBADO" | "DEVUELTO"; comentario?: string },
): Promise<{ id: string; estado: InformeEstado }> {
  const { data } = await apiClient.post(`/api/informes/${id}/responder`, body);
  return data;
}

export async function borrarInforme(id: string): Promise<void> {
  await apiClient.delete(`/api/informes/${id}`);
}

export async function subirAdjuntoInforme(id: string, file: File): Promise<InformeAdjunto> {
  const form = new FormData();
  form.append("file", file, file.name);
  const { data } = await apiClient.post<InformeAdjunto>(`/api/informes/${id}/adjuntos`, form, {
    headers: { "Content-Type": "multipart/form-data" },
  });
  return data;
}

export async function borrarAdjuntoInforme(id: string, fileId: string): Promise<void> {
  await apiClient.delete(`/api/informes/${id}/adjuntos/${fileId}`);
}

export async function getInformesPendientesCount(): Promise<number> {
  // Llamada secundaria (badge): si fallara con 401 no debe tumbar la sesión.
  const { data } = await apiClient.get<{ count: number }>("/api/informes/pendientes/count", {
    skipAuthRedirect: true,
  });
  return data.count;
}

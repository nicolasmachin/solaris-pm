import { apiClient } from "./axios";

// Módulo Capacitación: áreas (secciones) → listas de reproducción → videos de
// Bunny, más documentos. Las miniaturas las sirve la app con un token corto en
// la URL (un <img> no puede mandar el header Authorization): ver thumbSrc().

export interface RolRef {
  id: string;
  name: string;
  label: string;
}

export interface SeccionResumen {
  id: string;
  nombre: string;
  descripcion: string | null;
  activa: boolean;
  orden: number;
  roles?: RolRef[];
  totalListas: number;
  totalVideos: number;
  totalDocumentos: number;
  videosVistos: number;
  thumbnailUrl: string | null;
}

export interface VideoItem {
  id: string;
  listaId: string;
  bunnyVideoId: string;
  titulo: string;
  descripcion: string | null;
  duracionSeg: number | null;
  orden: number;
  thumbnailUrl: string | null;
  segundosVistos: number;
  visto: boolean;
}

export interface DocumentoItem {
  id: string;
  seccionId: string;
  listaId: string | null;
  titulo: string;
  descripcion: string | null;
  filename: string;
  mimeType: string;
  sizeBytes: number;
  orden: number;
  createdAt: string;
  downloadUrl: string;
  previewUrl: string;
}

export interface ListaConVideos {
  id: string;
  titulo: string;
  descripcion: string | null;
  orden: number;
  videos: VideoItem[];
  duracionTotalSeg: number;
  videosVistos: number;
}

export interface SeccionDetalle {
  id: string;
  nombre: string;
  descripcion: string | null;
  activa: boolean;
  listas: ListaConVideos[];
  documentos: DocumentoItem[];
  mediaToken: string;
}

export interface ListaDetalle {
  id: string;
  titulo: string;
  descripcion: string | null;
  seccion: { id: string; nombre: string };
  videos: VideoItem[];
  documentos: DocumentoItem[];
  mediaToken: string;
}

export interface BunnyVideoItem {
  guid: string;
  title: string;
  length: number;
  status: number;
  thumbnailFileName: string | null;
  collectionId: string;
  dateUploaded: string;
}

const BASE_URL = import.meta.env.VITE_API_URL ?? "http://localhost:4000";

/**
 * URL absoluta de una miniatura, con el token corto que la habilita. El backend
 * lo emite en cada respuesta (`mediaToken`) porque un <img> o un enlace de
 * descarga no pueden mandar el header Authorization.
 */
export function thumbSrc(thumbnailUrl: string | null, mediaToken: string | undefined) {
  if (!thumbnailUrl || !mediaToken) return null;
  return `${BASE_URL}${thumbnailUrl}?t=${encodeURIComponent(mediaToken)}`;
}

export function bunnyThumbSrc(guid: string, filename: string | null, mediaToken: string | undefined) {
  if (!filename || !mediaToken) return null;
  return `${BASE_URL}/api/capacitacion/bunny/miniaturas/${guid}?f=${encodeURIComponent(filename)}&t=${encodeURIComponent(mediaToken)}`;
}

/** URL absoluta de un documento (descarga o vista previa), con su token. */
export function docSrc(url: string, mediaToken: string | undefined) {
  return mediaToken ? `${BASE_URL}${url}?t=${encodeURIComponent(mediaToken)}` : `${BASE_URL}${url}`;
}

// ─── Consumo ────────────────────────────────────────────────────────────────

export async function listSecciones() {
  const { data } = await apiClient.get<{
    puedeGestionar: boolean;
    mediaToken: string;
    secciones: SeccionResumen[];
  }>("/api/capacitacion/secciones");
  return data;
}

export async function getSeccion(id: string) {
  const { data } = await apiClient.get<SeccionDetalle>(`/api/capacitacion/secciones/${id}`);
  return data;
}

export async function getLista(id: string) {
  const { data } = await apiClient.get<ListaDetalle>(`/api/capacitacion/listas/${id}`);
  return data;
}

export async function getEmbed(videoId: string) {
  const { data } = await apiClient.post<{ embedUrl: string; expiresAt: string | null }>(
    `/api/capacitacion/videos/${videoId}/embed`,
  );
  return data;
}

export async function saveProgreso(videoId: string, body: { segundos: number; completado?: boolean }) {
  const { data } = await apiClient.put<{ videoId: string; segundosVistos: number; visto: boolean }>(
    `/api/capacitacion/videos/${videoId}/progreso`,
    body,
    // El guardado periódico es secundario: un 401 acá no debe tumbar la sesión.
    { skipAuthRedirect: true },
  );
  return data;
}

// ─── Gestión ────────────────────────────────────────────────────────────────

export async function listRolesAsignables() {
  const { data } = await apiClient.get<RolRef[]>("/api/capacitacion/roles");
  return data;
}

export async function createSeccion(body: { nombre: string; descripcion?: string | null; roleIds: string[] }) {
  const { data } = await apiClient.post<{ id: string; nombre: string }>("/api/capacitacion/secciones", body);
  return data;
}

export async function updateSeccion(
  id: string,
  body: { nombre?: string; descripcion?: string | null; activa?: boolean },
) {
  const { data } = await apiClient.patch(`/api/capacitacion/secciones/${id}`, body);
  return data;
}

export async function setRolesSeccion(id: string, roleIds: string[]) {
  const { data } = await apiClient.put(`/api/capacitacion/secciones/${id}/roles`, { roleIds });
  return data;
}

export async function reordenarSecciones(ids: string[]) {
  await apiClient.put("/api/capacitacion/secciones-orden", { ids });
}

export async function deleteSeccion(id: string) {
  await apiClient.delete(`/api/capacitacion/secciones/${id}`);
}

export async function createLista(seccionId: string, body: { titulo: string; descripcion?: string | null }) {
  const { data } = await apiClient.post<{ id: string; titulo: string }>(
    `/api/capacitacion/secciones/${seccionId}/listas`,
    body,
  );
  return data;
}

export async function updateLista(id: string, body: { titulo?: string; descripcion?: string | null }) {
  const { data } = await apiClient.patch(`/api/capacitacion/listas/${id}`, body);
  return data;
}

export async function reordenarListas(seccionId: string, ids: string[]) {
  await apiClient.put(`/api/capacitacion/secciones/${seccionId}/listas-orden`, { ids });
}

export async function deleteLista(id: string) {
  await apiClient.delete(`/api/capacitacion/listas/${id}`);
}

export async function getBunnyEstado() {
  const { data } = await apiClient.get<{ configurado: boolean }>("/api/capacitacion/bunny/estado");
  return data;
}

export async function listBunnyVideos(params: { page?: number; search?: string; collectionId?: string }) {
  const { data } = await apiClient.get<{
    totalItems: number;
    currentPage: number;
    itemsPerPage: number;
    items: BunnyVideoItem[];
    mediaToken: string;
  }>("/api/capacitacion/bunny/videos", { params });
  return data;
}

export async function listBunnyColecciones() {
  const { data } = await apiClient.get<Array<{ guid: string; name: string; videoCount: number }>>(
    "/api/capacitacion/bunny/colecciones",
  );
  return data;
}

export interface AltaVideosResultado {
  agregados: number;
  omitidos: Array<{ bunnyVideoId: string; titulo?: string; motivo: string }>;
}

export async function addVideosALista(listaId: string, bunnyVideoIds: string[]) {
  const { data } = await apiClient.post<AltaVideosResultado>(`/api/capacitacion/listas/${listaId}/videos`, {
    bunnyVideoIds,
  });
  return data;
}

export async function importarColeccion(seccionId: string, body: { collectionId: string; titulo: string }) {
  const { data } = await apiClient.post<AltaVideosResultado & { lista: { id: string; titulo: string } }>(
    `/api/capacitacion/secciones/${seccionId}/importar-coleccion`,
    body,
  );
  return data;
}

export async function updateVideo(id: string, body: { titulo?: string; descripcion?: string | null }) {
  const { data } = await apiClient.patch(`/api/capacitacion/videos/${id}`, body);
  return data;
}

export async function reordenarVideos(listaId: string, ids: string[]) {
  await apiClient.put(`/api/capacitacion/listas/${listaId}/videos-orden`, { ids });
}

export async function deleteVideo(id: string) {
  await apiClient.delete(`/api/capacitacion/videos/${id}`);
}

export async function uploadDocumento(
  seccionId: string,
  file: File,
  params: { titulo?: string; listaId?: string | null },
) {
  const form = new FormData();
  form.append("file", file);
  const { data } = await apiClient.post<DocumentoItem>(
    `/api/capacitacion/secciones/${seccionId}/documentos`,
    form,
    {
      params: { titulo: params.titulo || undefined, listaId: params.listaId || undefined },
      headers: { "Content-Type": "multipart/form-data" },
    },
  );
  return data;
}

export async function updateDocumento(
  id: string,
  body: { titulo?: string; descripcion?: string | null; listaId?: string | null },
) {
  const { data } = await apiClient.patch<DocumentoItem>(`/api/capacitacion/documentos/${id}`, body);
  return data;
}

export async function deleteDocumento(id: string) {
  await apiClient.delete(`/api/capacitacion/documentos/${id}`);
}

export interface SeguimientoSeccion {
  id: string;
  nombre: string;
  activa: boolean;
  listas: Array<{ id: string; titulo: string; totalVideos: number }>;
  usuarios: Array<{
    userId: string;
    nombre: string;
    rol: string;
    fueraDeRoles: boolean;
    completados: number;
    totalVideos: number;
    porLista: Record<string, number>;
    ultimaActividad: string | null;
  }>;
}

export async function getSeguimiento(seccionId?: string) {
  const { data } = await apiClient.get<SeguimientoSeccion[]>("/api/capacitacion/seguimiento", {
    params: { seccionId },
  });
  return data;
}

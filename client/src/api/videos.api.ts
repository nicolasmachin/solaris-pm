import { apiClient } from "./axios";

// ─── Tipos (matchean videos.routes.ts) ────────────────────────────────────────

export type TipoVideo = "ENSAYO_ANTI_ISLA" | "ENSAYO_ENCENDIDO" | "VISITA" | "OTRO";

export type VideoProcessingStatus = "PENDING" | "PROCESSING" | "READY" | "FAILED";

export interface ProjectVideo {
  id: string;
  tipoVideo: TipoVideo;
  descripcion: string | null;
  /** Seteado cuando el video se subió durante una visita técnica. */
  visitId: string | null;
  posterUrl: string | null;
  durationSeconds: number | null;
  width: number | null;
  height: number | null;
  sizeBytes: number | null;
  processingStatus: VideoProcessingStatus;
  processingError: string | null;
  originalFilename: string;
  originalSizeBytes: number;
  createdAt: string;
  processedAt: string | null;
  uploadedBy: { id: string; name: string | null } | null;
}

export const TIPO_VIDEO_LABEL: Record<TipoVideo, string> = {
  ENSAYO_ANTI_ISLA: "Ensayo anti-isla",
  ENSAYO_ENCENDIDO: "Ensayo encendido",
  VISITA: "Visita técnica",
  OTRO: "Otro",
};

/**
 * Tipos que el usuario puede elegir al subir desde la sección Videos. `VISITA`
 * queda afuera: ese tipo lo asigna el backend cuando el video entra por el panel
 * de la visita técnica, no se elige a mano.
 */
export const TIPOS_VIDEO_SELECCIONABLES: TipoVideo[] = [
  "ENSAYO_ANTI_ISLA",
  "ENSAYO_ENCENDIDO",
  "OTRO",
];

const API_BASE = (import.meta.env.VITE_API_URL as string | undefined) ?? "http://localhost:4000";

// ─── Videos ───────────────────────────────────────────────────────────────────

export async function getProjectVideos(projectId: string): Promise<ProjectVideo[]> {
  const { data } = await apiClient.get<{ videos: ProjectVideo[] }>(
    `/api/projects/${projectId}/videos`,
  );
  return data.videos;
}

/**
 * Sube el video. Reporta el progreso porque el archivo va crudo: desde una obra
 * con 4G, un clip de celular puede tardar minutos y sin barra parece colgado.
 *
 * Los campos de texto van ANTES del archivo en el FormData a propósito: el
 * backend lee el multipart en streaming y solo ve los campos que llegaron antes
 * de encontrarse con el archivo.
 */
export async function uploadProjectVideo(
  projectId: string,
  params: {
    file: File;
    tipoVideo: TipoVideo;
    descripcion?: string;
    substageId?: string;
    onProgress?: (percent: number) => void;
  },
): Promise<{ id: string }> {
  const form = new FormData();
  form.append("tipoVideo", params.tipoVideo);
  if (params.descripcion) form.append("descripcion", params.descripcion);
  if (params.substageId) form.append("substageId", params.substageId);
  form.append("file", params.file, params.file.name);

  const { data } = await apiClient.post<{ video: { id: string } }>(
    `/api/projects/${projectId}/videos`,
    form,
    {
      headers: { "Content-Type": "multipart/form-data" },
      onUploadProgress: (event) => {
        if (!params.onProgress || !event.total) return;
        params.onProgress(Math.round((event.loaded / event.total) * 100));
      },
    },
  );

  return data.video;
}

export async function deleteProjectVideo(videoId: string): Promise<void> {
  await apiClient.delete(`/api/videos/${videoId}`);
}

/**
 * Sube un video desde el panel de visita técnica. El backend lo asocia a la
 * visita activa del operario y lo tipa como `VISITA`; después aparece, ya
 * comprimido, en la sección Videos del proyecto junto a los ensayos.
 */
export async function uploadVisitVideo(
  projectId: string,
  params: { file: File; descripcion?: string; onProgress?: (percent: number) => void },
): Promise<{ id: string }> {
  const form = new FormData();
  if (params.descripcion) form.append("description", params.descripcion);
  form.append("file", params.file, params.file.name);

  const { data } = await apiClient.post<{ video: { id: string } }>(
    `/api/projects/${projectId}/visit-inputs/video`,
    form,
    {
      headers: { "Content-Type": "multipart/form-data" },
      onUploadProgress: (event) => {
        if (!params.onProgress || !event.total) return;
        params.onProgress(Math.round((event.loaded / event.total) * 100));
      },
    },
  );

  return data.video;
}

/** URL relativa de la miniatura, para pasarle a ProtectedImage. */
export function getVideoPosterPath(videoId: string): string {
  return `/api/videos/${videoId}/poster`;
}

/**
 * Pide permiso para reproducir y devuelve la URL del video con el token puesto.
 *
 * El token va en la URL porque un `<video src>` no puede mandar headers. Dura 15
 * minutos; si vence, el player lo vuelve a pedir. No se usa un blob URL porque
 * eso obligaría a descargar el video entero antes del primer frame y anularía
 * tanto la reproducción progresiva como el poder adelantar.
 */
export async function getVideoStreamUrl(videoId: string): Promise<string> {
  const { data } = await apiClient.post<{ token: string; expiresInSeconds: number }>(
    `/api/videos/${videoId}/stream-token`,
  );
  return `${API_BASE}/api/videos/${videoId}/stream?t=${encodeURIComponent(data.token)}`;
}

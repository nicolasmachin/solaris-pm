import { AlertTriangle, Loader2, Play, Trash2 } from "lucide-react";

import {
  TIPO_VIDEO_LABEL,
  getVideoPosterPath,
  type ProjectVideo,
  type TipoVideo,
} from "../../api/videos.api";
import { ProtectedImage } from "../obra/ProtectedImage";

interface Props {
  video: ProjectVideo;
  canDelete: boolean;
  onPlay: () => void;
  onDelete: () => void;
}

/**
 * Color de la etiqueta según el tipo. Los dos ensayos comparten color porque son
 * lo mismo a los ojos de quien revisa (evidencia de obra); la visita técnica va
 * en otro para que se distinga sin leer.
 */
const TIPO_VIDEO_BADGE: Record<TipoVideo, string> = {
  ENSAYO_ANTI_ISLA: "bg-amber-500/90 text-black",
  ENSAYO_ENCENDIDO: "bg-amber-500/90 text-black",
  VISITA: "bg-purple-500/90 text-white",
  OTRO: "bg-black/70 text-white",
};

function formatDuration(seconds: number | null): string | null {
  if (seconds == null) return null;
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}:${String(s).padStart(2, "0")}`;
}

function formatSize(bytes: number | null): string | null {
  if (bytes == null) return null;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function ProjectVideoCard({ video, canDelete, onPlay, onDelete }: Props) {
  const listo = video.processingStatus === "READY";
  const fallo = video.processingStatus === "FAILED";
  const duracion = formatDuration(video.durationSeconds);

  return (
    <div className="overflow-hidden rounded-lg border border-[var(--color-border)] bg-[var(--color-bg-app)]">
      <div className="relative aspect-video bg-black">
        {listo && video.posterUrl ? (
          <ProtectedImage
            src={getVideoPosterPath(video.id)}
            alt={TIPO_VIDEO_LABEL[video.tipoVideo]}
            className="h-full w-full cursor-pointer object-cover"
            onClick={onPlay}
          />
        ) : (
          <div className="flex h-full w-full items-center justify-center">
            {fallo ? (
              <AlertTriangle size={22} className="text-amber-500" />
            ) : (
              <Loader2 size={22} className="animate-spin text-[var(--color-text-muted)]" />
            )}
          </div>
        )}

        {listo && (
          <button
            type="button"
            onClick={onPlay}
            aria-label="Reproducir"
            className="absolute inset-0 flex items-center justify-center transition-opacity hover:bg-black/20"
          >
            <span className="rounded-full bg-black/60 p-2.5">
              <Play size={18} className="text-white" fill="white" />
            </span>
          </button>
        )}

        {/* Etiqueta del tipo sobre la miniatura: de un vistazo se distingue un
            ensayo (evidencia de obra) de un video de visita técnica. */}
        <span
          className={`absolute left-1.5 top-1.5 rounded px-1.5 py-0.5 text-[10px] font-semibold ${TIPO_VIDEO_BADGE[video.tipoVideo]}`}
        >
          {TIPO_VIDEO_LABEL[video.tipoVideo]}
        </span>

        {duracion && listo && (
          <span className="absolute bottom-1.5 right-1.5 rounded bg-black/70 px-1.5 py-0.5 font-mono text-[10px] text-white">
            {duracion}
          </span>
        )}
      </div>

      <div className="p-2.5">
        <div className="flex items-start justify-between gap-2">
          {/* El tipo ya está en la etiqueta sobre la miniatura: acá va la nota
              del operario, y si no la puso, el nombre del archivo original. */}
          <div className="min-w-0">
            <p className="truncate text-xs text-[var(--color-text-primary)]">
              {video.descripcion || video.originalFilename}
            </p>
          </div>
          {canDelete && (
            <button
              type="button"
              onClick={onDelete}
              aria-label="Eliminar video"
              className="tap-target shrink-0 rounded p-1 text-[var(--color-text-muted)] transition-colors hover:text-red-500"
            >
              <Trash2 size={13} />
            </button>
          )}
        </div>

        <p className="mt-1 font-mono text-[10px] text-[var(--color-text-muted)]">
          {listo ? (
            <>
              {formatSize(video.sizeBytes)}
              {video.uploadedBy?.name ? ` · ${video.uploadedBy.name}` : ""}
            </>
          ) : fallo ? (
            <span className="text-amber-600">No se pudo procesar</span>
          ) : (
            "Preparando el video…"
          )}
        </p>

        {fallo && video.processingError && (
          <p className="mt-1 text-[10px] leading-snug text-[var(--color-text-muted)]">
            {video.processingError.split(" — ")[0]}
          </p>
        )}
      </div>
    </div>
  );
}

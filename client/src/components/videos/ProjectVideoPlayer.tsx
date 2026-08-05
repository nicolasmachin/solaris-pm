import { useCallback, useEffect, useRef, useState } from "react";
import { X } from "lucide-react";

import { TIPO_VIDEO_LABEL, getVideoStreamUrl, type ProjectVideo } from "../../api/videos.api";

interface Props {
  video: ProjectVideo;
  onClose: () => void;
}

/**
 * Reproductor en modal.
 *
 * El `src` lleva un token de 15 minutos. Si el usuario deja el video pausado más
 * de ese rato y después adelanta, el pedido devuelve 401 y el player se quedaría
 * mudo: por eso se escucha `onError` y se renueva el permiso una vez, retomando
 * en el mismo punto en que estaba.
 */
export function ProjectVideoPlayer({ video, onClose }: Props) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [src, setSrc] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const renewing = useRef(false);

  const cargarUrl = useCallback(
    async (resumeAt?: number) => {
      try {
        const url = await getVideoStreamUrl(video.id);
        setSrc(url);
        setError(null);
        if (resumeAt != null && videoRef.current) {
          const el = videoRef.current;
          const restore = () => {
            el.currentTime = resumeAt;
            el.removeEventListener("loadedmetadata", restore);
          };
          el.addEventListener("loadedmetadata", restore);
        }
      } catch {
        setError("No se pudo abrir el video");
      }
    },
    [video.id],
  );

  useEffect(() => {
    void cargarUrl();
  }, [cargarUrl]);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  function handleError() {
    // Un solo reintento: si vuelve a fallar, el problema no es el permiso vencido.
    if (renewing.current) {
      setError("No se pudo reproducir el video");
      return;
    }
    renewing.current = true;
    void cargarUrl(videoRef.current?.currentTime);
  }

  return (
    <div
      className="fixed inset-0 z-[110] flex items-center justify-center bg-black/80 p-4"
      onClick={onClose}
    >
      <div
        className="w-full max-w-3xl rounded-lg border border-[var(--color-border)] bg-[var(--color-bg-card)] p-4"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-3 flex items-start justify-between gap-3">
          <div>
            <h4 className="text-sm font-semibold text-[var(--color-text-primary)]">
              {TIPO_VIDEO_LABEL[video.tipoVideo]}
            </h4>
            {video.descripcion && (
              <p className="mt-0.5 text-xs text-[var(--color-text-secondary)]">
                {video.descripcion}
              </p>
            )}
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Cerrar"
            className="tap-target rounded-lg p-1 text-[var(--color-text-muted)] hover:bg-[var(--color-border)]/30"
          >
            <X size={18} />
          </button>
        </div>

        {error ? (
          <div className="py-10 text-center text-sm text-[var(--color-text-muted)]">{error}</div>
        ) : !src ? (
          <div className="py-10 text-center text-xs text-[var(--color-text-muted)]">Cargando…</div>
        ) : (
          <video
            ref={videoRef}
            src={src}
            controls
            autoPlay
            playsInline
            preload="metadata"
            onError={handleError}
            className="max-h-[70vh] w-full rounded-md bg-black"
          />
        )}
      </div>
    </div>
  );
}

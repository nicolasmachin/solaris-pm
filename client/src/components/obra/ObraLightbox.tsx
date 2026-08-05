import { useEffect, useRef } from "react";
import { ChevronLeft, ChevronRight, Trash2, X } from "lucide-react";

import { ProtectedImage } from "./ProtectedImage";

/** Lo único que el lightbox necesita de una foto. */
interface LightboxPhoto {
  filename: string;
  fullUrl: string;
}

interface Props<T extends LightboxPhoto> {
  photos: T[];
  index: number;
  onClose: () => void;
  onNavigate: (index: number) => void;
  onDelete?: (photo: T) => void;
}

// Lightbox propio (sin librería): modal full-screen con navegación por
// flechas/teclado y contador. Las imágenes van por ProtectedImage (fetch
// autenticado): abrirlas en una pestaña nueva no funciona, porque una navegación
// del navegador no manda el header Authorization y la ruta responde 401.
//
// Lo usan la galería de obra y las fotos de la visita de ventas (el panel del
// lead). Es genérico sobre el tipo de foto para que `onDelete` reciba el objeto
// completo de cada lado y no una versión recortada.
export function ObraLightbox<T extends LightboxPhoto>({
  photos,
  index,
  onClose,
  onNavigate,
  onDelete,
}: Props<T>) {
  const photo = photos[index];
  const hasPrev = index > 0;
  const hasNext = index < photos.length - 1;
  const touchStartX = useRef<number | null>(null);

  // Swipe horizontal para pasar de foto (no toca flechas ni teclado).
  function onTouchStart(e: React.TouchEvent) {
    touchStartX.current = e.touches[0]?.clientX ?? null;
  }
  function onTouchEnd(e: React.TouchEvent) {
    if (touchStartX.current === null) return;
    const dx = (e.changedTouches[0]?.clientX ?? 0) - touchStartX.current;
    touchStartX.current = null;
    const THRESHOLD = 50;
    if (dx > THRESHOLD && hasPrev) onNavigate(index - 1);
    else if (dx < -THRESHOLD && hasNext) onNavigate(index + 1);
  }

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
      else if (e.key === "ArrowLeft" && index > 0) onNavigate(index - 1);
      else if (e.key === "ArrowRight" && index < photos.length - 1) onNavigate(index + 1);
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [index, photos.length, onClose, onNavigate]);

  if (!photo) return null;

  return (
    <div
      className="fixed inset-0 z-[100] flex flex-col bg-black/90"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
    >
      {/* Barra superior: contador + cerrar (respeta el notch con safe-area) */}
      <div
        className="flex items-center justify-between px-4 py-3 text-white"
        style={{ paddingTop: "calc(0.75rem + env(safe-area-inset-top))" }}
        onClick={(e) => e.stopPropagation()}
      >
        <span className="font-mono text-xs text-white/70">
          {index + 1} / {photos.length}
        </span>
        <div className="flex items-center gap-1">
          {onDelete && (
            <button
              type="button"
              onClick={() => onDelete(photo)}
              aria-label="Eliminar foto"
              className="tap-target rounded text-white/80 hover:bg-red-600/40 hover:text-white"
            >
              <Trash2 size={18} />
            </button>
          )}
          <button
            type="button"
            onClick={onClose}
            aria-label="Cerrar"
            className="tap-target rounded text-white/80 hover:bg-white/10 hover:text-white"
          >
            <X size={20} />
          </button>
        </div>
      </div>

      {/* Imagen + flechas */}
      <div
        className="relative flex flex-1 items-center justify-center overflow-hidden px-4 pb-6"
        onTouchStart={onTouchStart}
        onTouchEnd={onTouchEnd}
      >
        {hasPrev && (
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onNavigate(index - 1);
            }}
            aria-label="Anterior"
            className="tap-target absolute left-3 z-10 rounded-full bg-black/40 text-white/90 hover:bg-black/70"
          >
            <ChevronLeft size={28} />
          </button>
        )}

        <ProtectedImage
          src={photo.fullUrl}
          alt={photo.filename}
          className="max-h-full max-w-full object-contain"
        />

        {hasNext && (
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onNavigate(index + 1);
            }}
            aria-label="Siguiente"
            className="tap-target absolute right-3 z-10 rounded-full bg-black/40 text-white/90 hover:bg-black/70"
          >
            <ChevronRight size={28} />
          </button>
        )}
      </div>
    </div>
  );
}

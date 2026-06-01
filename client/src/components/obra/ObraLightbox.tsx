import { useEffect } from "react";
import { ChevronLeft, ChevronRight, X } from "lucide-react";

import type { ObraPhoto } from "../../api/obra.api";
import { ProtectedImage } from "./ProtectedImage";

interface Props {
  photos: ObraPhoto[];
  index: number;
  onClose: () => void;
  onNavigate: (index: number) => void;
}

// Lightbox propio (sin librería): modal full-screen con navegación por
// flechas/teclado y contador. Las imágenes van por ProtectedImage (fetch
// autenticado).
export function ObraLightbox({ photos, index, onClose, onNavigate }: Props) {
  const photo = photos[index];
  const hasPrev = index > 0;
  const hasNext = index < photos.length - 1;

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
      {/* Barra superior: contador + cerrar */}
      <div
        className="flex items-center justify-between px-4 py-3 text-white"
        onClick={(e) => e.stopPropagation()}
      >
        <span className="font-mono text-xs text-white/70">
          {index + 1} / {photos.length}
        </span>
        <button
          type="button"
          onClick={onClose}
          aria-label="Cerrar"
          className="rounded p-1.5 text-white/80 hover:bg-white/10 hover:text-white"
        >
          <X size={20} />
        </button>
      </div>

      {/* Imagen + flechas */}
      <div className="relative flex flex-1 items-center justify-center overflow-hidden px-4 pb-6">
        {hasPrev && (
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onNavigate(index - 1);
            }}
            aria-label="Anterior"
            className="absolute left-3 z-10 rounded-full bg-black/40 p-2 text-white/90 hover:bg-black/70"
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
            className="absolute right-3 z-10 rounded-full bg-black/40 p-2 text-white/90 hover:bg-black/70"
          >
            <ChevronRight size={28} />
          </button>
        )}
      </div>
    </div>
  );
}

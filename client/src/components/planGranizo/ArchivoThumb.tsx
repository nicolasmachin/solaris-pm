import { useEffect, useState } from "react";
import { X } from "lucide-react";
import { toast } from "react-hot-toast";

import { planGranizoApi, type ArchivoPlan } from "../../api/planGranizo.api";

// Miniatura de una foto del plan. Las imágenes piden auth, así que se traen como
// blob; al tocarla se abre la foto completa.
export function ArchivoThumb({ archivo, onDelete }: { archivo: ArchivoPlan; onDelete?: () => void }) {
  const [src, setSrc] = useState<string | null>(null);

  useEffect(() => {
    let url: string | null = null;
    let vivo = true;
    planGranizoApi
      .blobUrl(archivo.thumbnailUrl)
      .then((u) => {
        url = u;
        if (vivo) setSrc(u);
      })
      .catch(() => undefined);
    return () => {
      vivo = false;
      if (url) URL.revokeObjectURL(url);
    };
  }, [archivo.thumbnailUrl]);

  return (
    <div className="group relative h-20 w-20 shrink-0 overflow-hidden rounded-md border border-[var(--color-border)] bg-[var(--color-bg-card)]">
      <button
        type="button"
        title={archivo.filename}
        className="h-full w-full"
        onClick={() => planGranizoApi.abrirArchivo(archivo.fullUrl).catch(() => toast.error("No se pudo abrir la foto"))}
      >
        {src ? <img src={src} alt={archivo.filename} className="h-full w-full object-cover" /> : null}
      </button>
      {onDelete ? (
        <button
          type="button"
          title="Borrar foto"
          onClick={onDelete}
          className="absolute right-1 top-1 hidden rounded-full bg-black/60 p-0.5 text-white group-hover:block"
        >
          <X size={12} />
        </button>
      ) : null}
    </div>
  );
}

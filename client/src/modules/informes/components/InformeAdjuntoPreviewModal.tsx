import { useEffect, useState } from "react";
import { toast } from "react-hot-toast";
import { Download, X } from "lucide-react";

import { apiClient } from "../../../api/axios";
import { downloadAuthenticated } from "../../../hooks/useAuthBlobUrl";
import { Spinner } from "../../../components/ui/Spinner";
import type { InformeAdjunto } from "../../../api/informes.api";

// Solo PDF e imágenes se renderizan dentro del iframe; el resto de tipos
// (docx, xlsx, dwg, zip) no son previsualizables → fallback a descarga.
function esPrevisualizable(mimeType: string): boolean {
  return mimeType === "application/pdf" || mimeType.startsWith("image/");
}

interface Props {
  adjunto: InformeAdjunto;
  onClose: () => void;
}

export function InformeAdjuntoPreviewModal({ adjunto, onClose }: Props) {
  const [blobUrl, setBlobUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const previsualizable = esPrevisualizable(adjunto.mimeType);

  useEffect(() => {
    if (!previsualizable) {
      setLoading(false);
      return;
    }
    let cancelled = false;
    let createdUrl: string | null = null;
    setLoading(true);
    setError(null);

    apiClient
      .get<Blob>(adjunto.previewUrl, { responseType: "blob" })
      .then((res) => {
        if (cancelled) return;
        createdUrl = URL.createObjectURL(res.data);
        setBlobUrl(createdUrl);
      })
      .catch(() => {
        if (!cancelled) setError("No se pudo cargar la previsualización");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
      if (createdUrl) URL.revokeObjectURL(createdUrl);
      setBlobUrl(null);
    };
  }, [adjunto.previewUrl, previsualizable]);

  function descargar() {
    void downloadAuthenticated(adjunto.downloadUrl, adjunto.filename).catch(() =>
      toast.error("No se pudo descargar el archivo"),
    );
  }

  return (
    <div
      className="fixed inset-0 z-[97] flex items-center justify-center bg-black/60 p-4"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="flex h-[90vh] w-full max-w-5xl flex-col rounded-xl border border-[var(--color-border)] bg-[var(--color-bg-card)] shadow-2xl">
        <div className="flex items-center justify-between border-b border-[var(--color-border)] px-5 py-3">
          <div className="min-w-0">
            <p className="font-mono text-[10px] uppercase tracking-widest text-[var(--color-text-muted)]">
              Previsualización
            </p>
            <h3 className="truncate text-sm font-semibold text-[var(--color-text-primary)]">{adjunto.filename}</h3>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={descargar}
              className="flex items-center gap-1.5 rounded-lg bg-[var(--color-accent)] px-3 py-1.5 text-xs font-semibold text-black hover:opacity-90"
            >
              <Download className="h-3.5 w-3.5" /> Descargar
            </button>
            <button
              type="button"
              onClick={onClose}
              className="rounded-md p-1 text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)]"
              aria-label="Cerrar"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>

        <div className="relative flex-1 overflow-hidden bg-[var(--color-bg-app)]">
          {!previsualizable ? (
            <div className="flex h-full flex-col items-center justify-center gap-3 p-6 text-center text-sm text-[var(--color-text-secondary)]">
              <p>Este tipo de archivo no se puede previsualizar.</p>
              <button
                type="button"
                onClick={descargar}
                className="flex items-center gap-1.5 rounded-lg border border-[var(--color-border)] px-3 py-1.5 text-xs text-[var(--color-text-primary)] hover:bg-[var(--color-border)]/30"
              >
                <Download className="h-3.5 w-3.5" /> Descargar archivo
              </button>
            </div>
          ) : loading ? (
            <div className="flex h-full items-center justify-center gap-2 text-sm text-[var(--color-text-secondary)]">
              <Spinner size={18} /> Cargando…
            </div>
          ) : error ? (
            <div className="flex h-full items-center justify-center p-6 text-sm text-red-300">{error}</div>
          ) : blobUrl ? (
            <iframe title={adjunto.filename} src={blobUrl} className="h-full w-full border-0" />
          ) : null}
        </div>
      </div>
    </div>
  );
}

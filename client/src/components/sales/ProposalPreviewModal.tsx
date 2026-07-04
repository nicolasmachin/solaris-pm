import { useEffect, useState } from "react";
import { X } from "lucide-react";

import { apiClient } from "../../api/axios";
import { Spinner } from "../ui/Spinner";

// Modal chico de preview de un PDF. Sirve tanto para propuestas viejas
// (pdfUrl = /api/proposals/:id/download) como nuevas
// (pdfUrl = /api/proposals-v2/versions/:id/pdf/full). Baja el PDF como blob y lo
// muestra en un iframe. Solo lectura: cierra con X, Escape o click en backdrop.
export function ProposalPreviewModal({
  open,
  onClose,
  pdfUrl,
  title,
}: {
  open: boolean;
  onClose: () => void;
  pdfUrl: string;
  title: string;
}) {
  const [blobUrl, setBlobUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    let createdUrl: string | null = null;
    setLoading(true);
    setError(null);
    apiClient
      .get<Blob>(pdfUrl, { responseType: "blob" })
      .then((response) => {
        if (cancelled) return;
        const pdfBlob = new Blob([response.data], { type: "application/pdf" });
        createdUrl = URL.createObjectURL(pdfBlob);
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
  }, [open, pdfUrl]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-[97] flex items-center justify-center bg-black/60 p-4"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="flex h-[85vh] w-[80vw] max-w-5xl flex-col rounded-xl border border-[var(--color-border)] bg-[var(--color-bg-card)] shadow-2xl">
        <div className="flex items-center justify-between border-b border-[var(--color-border)] px-5 py-3">
          <div className="min-w-0">
            <p className="font-mono text-[10px] uppercase tracking-widest text-[var(--color-text-muted)]">Previsualización</p>
            <h3 className="truncate text-sm font-semibold text-[var(--color-text-primary)]">{title}</h3>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-md p-1 text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)]"
            aria-label="Cerrar"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="relative flex-1 overflow-hidden bg-[var(--color-bg-app)]">
          {loading ? (
            <div className="flex h-full items-center justify-center gap-2 text-sm text-[var(--color-text-secondary)]">
              <Spinner size={18} />
              Cargando PDF…
            </div>
          ) : error ? (
            <div className="flex h-full items-center justify-center p-6 text-sm text-red-300">{error}</div>
          ) : blobUrl ? (
            <iframe title={title} src={blobUrl} className="h-full w-full border-0" />
          ) : null}
        </div>
      </div>
    </div>
  );
}

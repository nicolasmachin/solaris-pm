import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { toast } from "react-hot-toast";
import { Download, X } from "lucide-react";
import { getPreIngenieriaVersion } from "../../../api/preingenieria.api";
import { downloadWithAuth } from "./shared";

/**
 * Vista previa inline de una versión Pre-Ingeniería. El PDF está protegido por
 * JWT, así que lo bajamos vía fetch (con Authorization), creamos un blob URL y
 * se lo damos a un <iframe> para renderizar dentro del modal. Mismo patrón que
 * el modal de unifilar, adaptado a PDF (vs. SVG).
 */
export function PreIngenieriaPreviewModal({
  versionId,
  versionNumber,
  onClose,
}: {
  versionId: string;
  versionNumber?: number;
  onClose: () => void;
}) {
  const [blobUrl, setBlobUrl] = useState<string | null>(null);

  const versionQ = useQuery({
    queryKey: ["preingenieria-version", versionId],
    queryFn: () => getPreIngenieriaVersion(versionId),
  });

  const pdfAttachment = versionQ.data?.pdfAttachment ?? null;
  const previewUrl = pdfAttachment?.previewUrl ?? null;
  const filename = pdfAttachment?.filename ?? `preingenieria_v${versionNumber ?? ""}.pdf`;

  useEffect(() => {
    if (!previewUrl) return;
    let cancelled = false;
    let createdBlobUrl: string | null = null;
    (async () => {
      const token = localStorage.getItem("voltia-token");
      const baseUrl = (import.meta.env.VITE_API_URL as string | undefined) ?? "";
      const fullUrl = previewUrl.startsWith("http") ? previewUrl : `${baseUrl}${previewUrl}`;
      try {
        const res = await fetch(fullUrl, {
          headers: token ? { Authorization: `Bearer ${token}` } : {},
        });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const blob = await res.blob();
        if (cancelled) return;
        createdBlobUrl = URL.createObjectURL(blob);
        setBlobUrl(createdBlobUrl);
      } catch {
        if (!cancelled) toast.error("No se pudo cargar el PDF");
      }
    })();
    return () => {
      cancelled = true;
      if (createdBlobUrl) URL.revokeObjectURL(createdBlobUrl);
    };
  }, [previewUrl]);

  const headerLabel = `Pre-ingeniería${versionNumber ? ` v${versionNumber}` : ""}`;
  const isLoading = versionQ.isLoading || (previewUrl && !blobUrl);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4" onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div
        className="w-full max-w-5xl h-[92vh] rounded-xl bg-white border border-[var(--color-border)] shadow-2xl overflow-hidden flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-[var(--color-border)] px-4 py-3 bg-[var(--color-bg-card)] shrink-0">
          <h3 className="text-sm font-semibold text-[var(--color-text-primary)]">{headerLabel}</h3>
          <div className="flex items-center gap-2">
            {previewUrl && (
              <button
                onClick={() =>
                  downloadWithAuth(previewUrl, filename).catch(() =>
                    toast.error("No se pudo descargar"),
                  )
                }
                className="inline-flex items-center gap-1 rounded border border-[var(--color-border)] px-2 py-1 text-[11px] hover:bg-[var(--color-bg-card-hover)]"
              >
                <Download className="w-3 h-3" /> PDF
              </button>
            )}
            <button
              onClick={onClose}
              className="p-1 rounded hover:bg-[var(--color-bg-card-hover)] text-[var(--color-text-muted)]"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>
        <div className="flex-1 overflow-hidden bg-[#525659]">
          {isLoading ? (
            <p className="text-xs text-white p-4">Cargando…</p>
          ) : !pdfAttachment ? (
            <p className="text-xs text-white p-4">
              Esta versión no tiene un PDF asociado (la generación pudo haber fallado).
            </p>
          ) : blobUrl ? (
            <iframe
              src={blobUrl}
              title={headerLabel}
              className="w-full h-full border-0"
            />
          ) : null}
        </div>
      </div>
    </div>
  );
}

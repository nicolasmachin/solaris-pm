import { useQuery } from "@tanstack/react-query";
import { toast } from "react-hot-toast";
import { Download, FileText, X } from "lucide-react";
import { unifilarPdfUrl, unifilarSvgUrl } from "../../../api/unifilar.api";
import { downloadWithAuth } from "./shared";

export function UnifilarPreviewModal({
  versionId,
  versionNumber,
  onClose,
}: {
  versionId: string;
  versionNumber?: number;
  onClose: () => void;
}) {
  const svgQ = useQuery({
    queryKey: ["unifilar-svg-preview", versionId],
    queryFn: async () => {
      const url = unifilarSvgUrl(versionId);
      const token = localStorage.getItem("voltia-token");
      const res = await fetch(url, {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      return res.text();
    },
  });

  const suffix = versionNumber ? `_v${versionNumber}` : "";

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4" onClick={onClose}>
      <div
        className="w-full max-w-3xl max-h-[92vh] rounded-xl bg-white border border-[var(--color-border)] shadow-2xl overflow-hidden flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-[var(--color-border)] px-4 py-3 bg-[var(--color-bg-card)]">
          <h3 className="text-sm font-semibold text-[var(--color-text-primary)]">
            Vista del unifilar{versionNumber ? ` v${versionNumber}` : ""}
          </h3>
          <div className="flex items-center gap-2">
            <button
              onClick={() =>
                downloadWithAuth(unifilarSvgUrl(versionId), `unifilar${suffix}.svg`).catch(() =>
                  toast.error("No se pudo descargar SVG"),
                )
              }
              className="inline-flex items-center gap-1 rounded border border-[var(--color-border)] px-2 py-1 text-[11px] hover:bg-[var(--color-bg-card-hover)]"
            >
              <Download className="w-3 h-3" /> SVG
            </button>
            <button
              onClick={() =>
                downloadWithAuth(unifilarPdfUrl(versionId), `unifilar${suffix}.pdf`).catch(() =>
                  toast.error("No se pudo descargar PDF"),
                )
              }
              className="inline-flex items-center gap-1 rounded border border-[var(--color-border)] px-2 py-1 text-[11px] hover:bg-[var(--color-bg-card-hover)]"
            >
              <FileText className="w-3 h-3" /> PDF
            </button>
            <button
              onClick={onClose}
              className="p-1 rounded hover:bg-[var(--color-bg-card-hover)] text-[var(--color-text-muted)]"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>
        <div className="flex-1 overflow-auto p-3">
          {svgQ.isLoading ? (
            <p className="text-xs text-gray-500">Cargando…</p>
          ) : svgQ.error ? (
            <p className="text-xs text-red-500">No se pudo cargar el plano</p>
          ) : (
            <div
              className="w-full [&>svg]:w-full [&>svg]:h-auto [&>svg]:max-w-full"
              dangerouslySetInnerHTML={{ __html: svgQ.data ?? "" }}
            />
          )}
        </div>
      </div>
    </div>
  );
}

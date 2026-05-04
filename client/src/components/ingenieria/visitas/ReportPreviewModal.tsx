import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { toast } from "react-hot-toast";
import { Download, X } from "lucide-react";
import {
  getVisita,
  visitReportPdfUrl,
  type VisitReportDto,
} from "../../../api/visitas.api";

/**
 * Vista previa del PDF de un reporte de visita técnica. Mismo patrón que el
 * preview de pre-ingeniería: fetch del PDF con auth, blob URL, iframe.
 */
export function ReportPreviewModal({
  visitId,
  reportId,
  onClose,
}: {
  visitId: string;
  reportId: string;
  onClose: () => void;
}) {
  const [blobUrl, setBlobUrl] = useState<string | null>(null);

  const visitQ = useQuery({
    queryKey: ["technical-visit", visitId],
    queryFn: () => getVisita(visitId),
  });

  const report: VisitReportDto | null =
    visitQ.data?.reports.find((r) => r.id === reportId) ?? null;

  const previewUrl = visitReportPdfUrl(visitId, reportId);
  const filename = `visita-v${report?.version ?? ""}.pdf`;

  useEffect(() => {
    let cancelled = false;
    let createdBlobUrl: string | null = null;
    (async () => {
      const token = localStorage.getItem("voltia-token");
      try {
        const res = await fetch(previewUrl, {
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

  async function handleDownload() {
    const token = localStorage.getItem("voltia-token");
    try {
      const res = await fetch(previewUrl, {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      setTimeout(() => URL.revokeObjectURL(url), 1000);
    } catch {
      toast.error("No se pudo descargar");
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4" onClick={onClose}>
      <div
        className="w-full max-w-5xl h-[92vh] rounded-xl bg-white border border-[var(--color-border)] shadow-2xl overflow-hidden flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-[var(--color-border)] px-4 py-3 bg-[var(--color-bg-card)] shrink-0">
          <h3 className="text-sm font-semibold text-[var(--color-text-primary)]">
            Informe de visita técnica{report ? ` v${report.version}` : ""}
          </h3>
          <div className="flex items-center gap-2">
            <button
              onClick={handleDownload}
              className="inline-flex items-center gap-1 rounded border border-[var(--color-border)] px-2 py-1 text-[11px] hover:bg-[var(--color-bg-card-hover)]"
            >
              <Download className="w-3 h-3" /> Descargar PDF
            </button>
            <button
              onClick={onClose}
              className="p-1 rounded hover:bg-[var(--color-bg-card-hover)] text-[var(--color-text-muted)]"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>
        <div className="flex-1 overflow-hidden bg-[#525659]">
          {!blobUrl ? (
            <p className="text-xs text-white p-4">Cargando PDF…</p>
          ) : (
            <iframe
              src={blobUrl}
              title={`visita-v${report?.version ?? ""}`}
              className="w-full h-full border-0"
            />
          )}
        </div>
      </div>
    </div>
  );
}

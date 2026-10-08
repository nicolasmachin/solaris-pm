import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "react-hot-toast";
import { Download, Eye, FileText, Plus, Sparkles, Trash2, X } from "lucide-react";
import {
  deleteJustificacion,
  getJustificacionPotencia,
  justificacionPdfPath,
  type JustificacionVersionItem,
} from "../../../api/justificacionPotencia.api";
import { usePermission } from "../../../hooks/usePermission";
import { downloadWithAuth, getApiErr } from "../preing/shared";
import { fmt } from "./catalogo";
import { JustificacionFormModal } from "./JustificacionFormModal";

const MONTHS_ES = ["ene", "feb", "mar", "abr", "may", "jun", "jul", "ago", "sep", "oct", "nov", "dic"];
function fmtFecha(iso: string): string {
  const d = new Date(iso);
  return `${d.getDate()} ${MONTHS_ES[d.getMonth()]} ${String(d.getFullYear()).slice(-2)}`;
}

export function JustificacionToolPanel({ projectId }: { projectId: string }) {
  const qc = useQueryClient();
  const canEdit = usePermission("INGENIERIA", "EDIT");
  const canDelete = usePermission("INGENIERIA", "DELETE");
  const [formOpen, setFormOpen] = useState(false);
  const [preview, setPreview] = useState<JustificacionVersionItem | null>(null);

  const q = useQuery({
    queryKey: ["justificacion-potencia", projectId],
    queryFn: () => getJustificacionPotencia(projectId),
  });

  const deleteMut = useMutation({
    mutationFn: (id: string) => deleteJustificacion(id),
    onSuccess: () => {
      toast.success("Versión eliminada");
      qc.invalidateQueries({ queryKey: ["justificacion-potencia", projectId] });
      qc.invalidateQueries({ queryKey: ["project-documents", projectId] });
      qc.invalidateQueries({ queryKey: ["ingenieria-workspace", projectId] });
    },
    onError: (e) => toast.error(getApiErr(e) ?? "No se pudo eliminar"),
  });

  const versions = q.data?.versions ?? [];

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-2">
        <p className="text-xs text-[var(--color-text-muted)]">
          Informe para contestarle a UTE cuando el balance anual de la cuenta da para menos potencia que la pedida.
        </p>
        {canEdit && (
          <button
            onClick={() => setFormOpen(true)}
            disabled={!q.data}
            className="inline-flex shrink-0 items-center gap-1 rounded bg-[var(--color-accent)] px-2.5 py-1 text-[11px] font-semibold text-black hover:opacity-90 disabled:opacity-50"
          >
            <Plus className="h-3 w-3" /> {versions.length === 0 ? "Armar informe" : "Nueva versión"}
          </button>
        )}
      </div>

      {q.isLoading ? (
        <p className="text-xs text-[var(--color-text-muted)]">Cargando…</p>
      ) : q.isError ? (
        <p className="text-xs text-red-400">No se pudo cargar la herramienta.</p>
      ) : versions.length === 0 ? (
        <p className="rounded-lg border border-dashed border-[var(--color-border)] bg-[var(--color-bg-app)] p-6 text-center text-xs text-[var(--color-text-muted)]">
          Sin informes. Se usa solo si UTE contesta la consulta con una potencia menor a la pedida.
        </p>
      ) : (
        <ul className="space-y-1.5">
          {versions.map((v) => (
            <li
              key={v.id}
              className="flex items-center gap-3 rounded border border-[var(--color-border)] bg-[var(--color-bg-app)] px-3 py-2"
            >
              <FileText className="h-4 w-4 shrink-0 text-[var(--color-text-muted)]" />
              <div className="min-w-0 flex-1">
                <p className="text-xs text-[var(--color-text-primary)]">
                  <span className="font-mono">v{v.versionNumber}</span> · {fmt(v.potenciaSolicitadaKw, 2)} kW
                  {v.consumoAnualProyectadoKwh != null && (
                    <span className="text-[var(--color-text-muted)]"> · consumo proyectado {fmt(v.consumoAnualProyectadoKwh)} kWh/año</span>
                  )}
                  {v.cumpleBalance === false && <span className="text-amber-500"> · no da el balance</span>}
                  {v.textosConIa && <Sparkles className="ml-1 inline h-3 w-3 text-[var(--color-text-muted)]" aria-label="Textos con IA" />}
                </p>
                <p className="mt-0.5 font-mono text-[10px] text-[var(--color-text-muted)]">
                  {fmtFecha(v.createdAt)} · {v.createdByName}
                  {v.documentoId && " · en Documentos"}
                </p>
              </div>
              <button
                onClick={() => setPreview(v)}
                className="inline-flex items-center gap-1 rounded border border-[var(--color-border)] px-2 py-1 text-[10px] hover:bg-[var(--color-bg-card-hover)]"
              >
                <Eye className="h-3 w-3" /> Ver
              </button>
              {canDelete && (
                <button
                  onClick={() => {
                    if (confirm(`¿Eliminar la versión v${v.versionNumber}? No se puede deshacer.`)) deleteMut.mutate(v.id);
                  }}
                  className="rounded p-1 text-red-400 hover:bg-red-500/20"
                  title="Eliminar"
                >
                  <Trash2 className="h-3 w-3" />
                </button>
              )}
            </li>
          ))}
        </ul>
      )}

      {formOpen && q.data && (
        <JustificacionFormModal projectId={projectId} estado={q.data} onClose={() => setFormOpen(false)} />
      )}
      {preview && <PdfPreviewModal version={preview} onClose={() => setPreview(null)} />}
    </div>
  );
}

/** El PDF está detrás del JWT: se baja con fetch y se muestra como blob. */
function PdfPreviewModal({ version, onClose }: { version: JustificacionVersionItem; onClose: () => void }) {
  const [blobUrl, setBlobUrl] = useState<string | null>(null);
  const path = justificacionPdfPath(version.id);
  const filename = `justificacion_potencia_v${version.versionNumber}.pdf`;

  useEffect(() => {
    let cancelled = false;
    let created: string | null = null;
    (async () => {
      const token = localStorage.getItem("voltia-token");
      const baseUrl = (import.meta.env.VITE_API_URL as string | undefined) ?? "";
      try {
        const res = await fetch(`${baseUrl}${path}`, { headers: token ? { Authorization: `Bearer ${token}` } : {} });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const blob = await res.blob();
        if (cancelled) return;
        created = URL.createObjectURL(blob);
        setBlobUrl(created);
      } catch {
        if (!cancelled) toast.error("No se pudo cargar el PDF");
      }
    })();
    return () => {
      cancelled = true;
      if (created) URL.revokeObjectURL(created);
    };
  }, [path]);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="flex h-[92vh] w-full max-w-5xl flex-col overflow-hidden rounded-xl border border-[var(--color-border)] bg-white shadow-2xl">
        <div className="flex shrink-0 items-center justify-between border-b border-[var(--color-border)] bg-[var(--color-bg-card)] px-4 py-3">
          <h3 className="text-sm font-semibold text-[var(--color-text-primary)]">
            Justificación de potencia v{version.versionNumber}
          </h3>
          <div className="flex items-center gap-2">
            <button
              onClick={() => downloadWithAuth(path, filename).catch(() => toast.error("No se pudo descargar"))}
              className="inline-flex items-center gap-1 rounded border border-[var(--color-border)] px-2 py-1 text-[11px] hover:bg-[var(--color-bg-card-hover)]"
            >
              <Download className="h-3 w-3" /> PDF
            </button>
            <button onClick={onClose} className="rounded p-1 text-[var(--color-text-muted)] hover:bg-[var(--color-bg-card-hover)]">
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>
        <div className="flex-1 overflow-hidden bg-[#525659]">
          {blobUrl ? (
            <iframe src={blobUrl} title="Justificación de potencia" className="h-full w-full border-0" />
          ) : (
            <p className="p-4 text-xs text-white">Cargando…</p>
          )}
        </div>
      </div>
    </div>
  );
}

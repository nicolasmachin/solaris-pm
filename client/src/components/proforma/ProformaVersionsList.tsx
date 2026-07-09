import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "react-hot-toast";
import { Download, Eye, RotateCcw, Trash2 } from "lucide-react";

import { proformaApi } from "../../api/proforma.api";
import { proformaPdfFilename } from "../../lib/proformaDraft";
import type { ProformaVersionListItem } from "../../types/proforma";
import { ConfirmDialog } from "../ui/ConfirmDialog";
import { Spinner } from "../ui/Spinner";

function relative(iso: string): string {
  const s = Math.max(0, Math.round((Date.now() - new Date(iso).getTime()) / 1000));
  if (s < 60) return "recién";
  const m = Math.round(s / 60);
  if (m < 60) return `hace ${m} min`;
  const h = Math.round(m / 60);
  if (h < 24) return `hace ${h} h`;
  const d = Math.round(h / 24);
  return `hace ${d} día${d === 1 ? "" : "s"}`;
}

function IconBtn({ title, onClick, danger, children }: { title: string; onClick: () => void; danger?: boolean; children: React.ReactNode }) {
  return (
    <button
      title={title}
      onClick={onClick}
      className={`inline-flex items-center gap-1 rounded p-1.5 text-xs hover:bg-[var(--color-bg-card)] ${
        danger ? "text-[var(--color-danger-text)]" : "text-[var(--color-text-secondary)]"
      }`}
    >
      {children}
    </button>
  );
}

// Lista de versiones de la proforma generada (dentro de la subetapa).
export function ProformaVersionsList({ projectId }: { projectId: string }) {
  const qc = useQueryClient();
  const [showDiscarded, setShowDiscarded] = useState(false);
  const [discardTarget, setDiscardTarget] = useState<ProformaVersionListItem | null>(null);

  const q = useQuery({
    queryKey: ["proforma-versions", projectId, showDiscarded],
    queryFn: () => proformaApi.listVersions(projectId, showDiscarded),
    enabled: Boolean(projectId),
  });

  const invalidate = () => qc.invalidateQueries({ queryKey: ["proforma-versions", projectId] });

  const discardMut = useMutation({
    mutationFn: (id: string) => proformaApi.discardVersion(id),
    onSuccess: () => { toast.success("Versión descartada"); invalidate(); setDiscardTarget(null); },
    onError: () => toast.error("No se pudo descartar"),
  });
  const restoreMut = useMutation({
    mutationFn: (id: string) => proformaApi.restoreVersion(id),
    onSuccess: () => { toast.success("Versión restaurada"); invalidate(); },
    onError: () => toast.error("No se pudo restaurar"),
  });

  function download(v: ProformaVersionListItem) {
    proformaApi
      .downloadVersionPdf(v.id, proformaPdfFilename(v.clientName, v.versionNumber))
      .catch(() => toast.error("No se pudo descargar el PDF"));
  }
  function preview(v: ProformaVersionListItem) {
    proformaApi.openVersionPreview(v.id).catch(() => toast.error("No se pudo abrir el preview"));
  }

  const versions = q.data ?? [];

  return (
    <div className="mt-3">
      <div className="mb-2 flex items-center justify-between">
        <span className="text-xs font-semibold uppercase tracking-wide text-[var(--color-text-muted)]">
          Proformas generadas
        </span>
        <label className="flex items-center gap-1.5 text-[11px] text-[var(--color-text-secondary)]">
          <input type="checkbox" checked={showDiscarded} onChange={(e) => setShowDiscarded(e.target.checked)} />
          Ver descartadas
        </label>
      </div>

      {q.isLoading ? (
        <Spinner size={16} />
      ) : versions.length === 0 ? (
        <p className="text-xs text-[var(--color-text-muted)]">Todavía no se generó ninguna proforma.</p>
      ) : (
        <div className="space-y-1.5">
          {versions.map((v) => (
            <div
              key={v.id}
              className="flex items-center justify-between gap-2 rounded-md border border-[var(--color-border)] bg-[var(--color-bg-app)] px-3 py-2"
            >
              <div className="min-w-0">
                <span className="text-sm font-medium text-[var(--color-text-primary)]">V{v.versionNumber}</span>
                {v.status === "DISCARDED" ? (
                  <span className="ml-2 rounded bg-[var(--color-danger-bg,#fee)] px-1.5 py-0.5 text-[10px] text-[var(--color-danger-text)]">
                    Descartada
                  </span>
                ) : null}
                <span className="ml-2 text-[11px] text-[var(--color-text-muted)]">{relative(v.publishedAt)}</span>
              </div>
              <div className="flex shrink-0 items-center">
                <IconBtn title="Previsualizar" onClick={() => preview(v)}><Eye size={14} /></IconBtn>
                <IconBtn title="Descargar" onClick={() => download(v)}><Download size={14} /></IconBtn>
                {v.status === "DISCARDED" ? (
                  <IconBtn title="Restaurar" onClick={() => restoreMut.mutate(v.id)}><RotateCcw size={14} /></IconBtn>
                ) : (
                  <IconBtn title="Descartar" danger onClick={() => setDiscardTarget(v)}><Trash2 size={14} /></IconBtn>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      <ConfirmDialog
        open={Boolean(discardTarget)}
        title="Descartar versión"
        description={discardTarget ? `¿Descartar la proforma V${discardTarget.versionNumber}? Podés restaurarla después.` : ""}
        confirmLabel="Descartar"
        destructive
        loading={discardMut.isPending}
        onConfirm={() => discardTarget && discardMut.mutate(discardTarget.id)}
        onClose={() => setDiscardTarget(null)}
      />
    </div>
  );
}

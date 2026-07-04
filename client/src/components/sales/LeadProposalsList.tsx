import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "react-hot-toast";
import { Download, Eye, FileText, RotateCcw, Trash2 } from "lucide-react";

import { downloadProposal } from "../../api/leads.api";
import { proposalsV2BuilderApi } from "../../api/proposals-v2-builder.api";
import { useLeadProposals } from "../../hooks/useLeadProposals";
import type { ProposalListItem } from "../../types/leads.types";
import { Spinner } from "../ui/Spinner";
import { ProposalPreviewModal } from "./ProposalPreviewModal";

function relative(iso: string): string {
  const s = Math.max(0, Math.round((Date.now() - new Date(iso).getTime()) / 1000));
  if (s < 60) return "recién";
  const m = Math.round(s / 60);
  if (m < 60) return `hace ${m} min`;
  const h = Math.round(m / 60);
  if (h < 24) return `hace ${h} h`;
  const d = Math.round(h / 24);
  if (d < 30) return `hace ${d} día${d === 1 ? "" : "s"}`;
  const mo = Math.round(d / 30);
  return `hace ${mo} mes${mo === 1 ? "" : "es"}`;
}

function sanitize(name: string): string {
  return (
    name
      .trim()
      .normalize("NFD")
      .replace(/[̀-ͯ]/g, "")
      .replace(/[^a-zA-Z0-9]+/g, "-")
      .replace(/^-|-$/g, "") || "cliente"
  );
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

export function LeadProposalsList({ leadId, clientName }: { leadId: string; clientName: string }) {
  const [includeDiscarded, setIncludeDiscarded] = useState(false);
  const [preview, setPreview] = useState<{ url: string; title: string } | null>(null);
  const q = useLeadProposals(leadId, includeDiscarded);
  const qc = useQueryClient();

  const invalidate = () => qc.invalidateQueries({ queryKey: ["lead-proposals", leadId] });
  const discardMut = useMutation({
    mutationFn: (id: string) => proposalsV2BuilderApi.discardVersion(id),
    onSuccess: () => { toast.success("Propuesta descartada"); invalidate(); },
    onError: () => toast.error("No se pudo descartar"),
  });
  const restoreMut = useMutation({
    mutationFn: (id: string) => proposalsV2BuilderApi.restoreVersion(id),
    onSuccess: () => { toast.success("Propuesta restaurada"); invalidate(); },
    onError: () => toast.error("No se pudo restaurar"),
  });

  const fileBase = (p: ProposalListItem) =>
    `propuesta-${sanitize(clientName)}${p.versionNumber != null ? `-v${p.versionNumber}` : ""}`;

  function downloadFull(p: ProposalListItem) {
    const fn = `${fileBase(p)}.pdf`;
    const task = p.tipo === "nueva"
      ? proposalsV2BuilderApi.downloadVersionPdf(p.id, "full", fn)
      : downloadProposal(p.id, fn);
    task.catch(() => toast.error("No se pudo descargar el PDF"));
  }
  function downloadSummary(p: ProposalListItem) {
    proposalsV2BuilderApi
      .downloadVersionPdf(p.id, "summary", `${fileBase(p)}-resumen.pdf`)
      .catch(() => toast.error("No se pudo descargar el resumen"));
  }
  function openPreview(p: ProposalListItem) {
    const url = p.tipo === "nueva" ? `/api/proposals-v2/versions/${p.id}/pdf/full` : `/api/proposals/${p.id}/download`;
    setPreview({ url, title: `${fileBase(p)}.pdf` });
  }

  const rows = q.data ?? [];

  return (
    <div>
      <div className="mb-2 flex items-center justify-end">
        <label className="flex items-center gap-2 text-xs text-[var(--color-text-secondary)]">
          <input type="checkbox" checked={includeDiscarded} onChange={(e) => setIncludeDiscarded(e.target.checked)} />
          Ver descartadas
        </label>
      </div>

      {q.isLoading ? (
        <Spinner size={18} />
      ) : rows.length === 0 ? (
        <p className="text-sm text-[var(--color-text-muted)]">Sin propuestas generadas todavía.</p>
      ) : (
        <div className="space-y-2">
          {rows.map((p) => (
            <div key={p.id} className="rounded-md border border-[var(--color-border)] bg-[var(--color-bg-app)] p-3">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <span
                      className={`rounded px-1.5 py-0.5 text-[10px] font-bold uppercase ${
                        p.tipo === "nueva"
                          ? "bg-[var(--color-accent)]/15 text-[var(--color-accent)]"
                          : "bg-[var(--color-bg-card-hover)] text-[var(--color-text-muted)]"
                      }`}
                    >
                      {p.tipo === "nueva" ? "V2" : "Excel"}
                    </span>
                    <span className="text-sm font-semibold text-[var(--color-text-primary)]">
                      {p.versionNumber != null ? `v${p.versionNumber}` : "Propuesta"}
                    </span>
                    {p.status === "descartada" ? (
                      <span className="rounded bg-[var(--color-bg-card-hover)] px-1.5 py-0.5 text-[10px] font-semibold uppercase text-[var(--color-text-muted)] line-through">
                        Descartada
                      </span>
                    ) : p.status === "activa" ? (
                      <span className="rounded bg-[var(--color-state-done-bg)] px-1.5 py-0.5 text-[10px] font-semibold uppercase text-[var(--color-state-done-text)]">
                        Activa
                      </span>
                    ) : null}
                  </div>
                  <p className="mt-0.5 text-xs text-[var(--color-text-muted)]">
                    {relative(p.createdAt)}
                    {p.totalConIva != null ? ` · USD ${Math.round(p.totalConIva).toLocaleString("es-UY")}` : ""}
                  </p>
                </div>
                <div className="flex shrink-0 items-center gap-0.5">
                  {p.actions.canPreview && (
                    <IconBtn title="Previsualizar" onClick={() => openPreview(p)}>
                      <Eye size={15} />
                    </IconBtn>
                  )}
                  {p.actions.canDownloadFull && (
                    <IconBtn title="Descargar PDF completo" onClick={() => downloadFull(p)}>
                      <Download size={15} /> Full
                    </IconBtn>
                  )}
                  {p.actions.canDownloadSummary && (
                    <IconBtn title="Descargar resumen (1 página)" onClick={() => downloadSummary(p)}>
                      <FileText size={15} /> Resumen
                    </IconBtn>
                  )}
                  {p.actions.canDiscard && (
                    <IconBtn title="Descartar" danger onClick={() => discardMut.mutate(p.id)}>
                      <Trash2 size={15} />
                    </IconBtn>
                  )}
                  {p.actions.canRestore && (
                    <IconBtn title="Restaurar" onClick={() => restoreMut.mutate(p.id)}>
                      <RotateCcw size={15} />
                    </IconBtn>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      <ProposalPreviewModal
        open={Boolean(preview)}
        onClose={() => setPreview(null)}
        pdfUrl={preview?.url ?? ""}
        title={preview?.title ?? ""}
      />
    </div>
  );
}

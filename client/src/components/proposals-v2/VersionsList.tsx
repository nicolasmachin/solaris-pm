import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "react-hot-toast";
import { Download, FileText, RotateCcw, Trash2 } from "lucide-react";

import { proposalsV2BuilderApi } from "../../api/proposals-v2-builder.api";
import { getUsers } from "../../api/users.api";
import { Button } from "../ui/Button";
import { ConfirmDialog } from "../ui/ConfirmDialog";
import { Sheet } from "../ui/Sheet";
import { Spinner } from "../ui/Spinner";
import type { ProposalVersionListItem } from "../../types/proposals-v2";

const H2 = "text-sm font-bold uppercase tracking-wide text-[var(--color-text-primary)]";

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

function sanitizeLast(name: string): string {
  const last = name.trim().split(/\s+/).pop() ?? "cliente";
  return (
    last
      .normalize("NFD")
      .replace(/[̀-ͯ]/g, "")
      .replace(/[^a-zA-Z0-9]/g, "") || "cliente"
  );
}

function IconBtn({
  title,
  onClick,
  danger,
  children,
}: {
  title: string;
  onClick: () => void;
  danger?: boolean;
  children: React.ReactNode;
}) {
  return (
    <button
      title={title}
      onClick={onClick}
      className={`rounded p-1.5 hover:bg-[var(--color-bg-app)] ${danger ? "text-[var(--color-danger-text)]" : "text-[var(--color-text-secondary)]"}`}
    >
      {children}
    </button>
  );
}

export function VersionsList({ leadId }: { leadId: string }) {
  const qc = useQueryClient();
  const [showDiscarded, setShowDiscarded] = useState(false);

  const q = useQuery({
    queryKey: ["proposal-versions", leadId, showDiscarded],
    queryFn: () => proposalsV2BuilderApi.listVersions(leadId, showDiscarded),
  });
  const usersQuery = useQuery({ queryKey: ["users-basic"], queryFn: getUsers, retry: false, staleTime: 5 * 60_000 });
  const authorName = (id: string) => usersQuery.data?.find((u) => u.id === id)?.name ?? "—";

  const [discardTarget, setDiscardTarget] = useState<ProposalVersionListItem | null>(null);
  const [reason, setReason] = useState("");
  const [restoreTarget, setRestoreTarget] = useState<ProposalVersionListItem | null>(null);

  const invalidate = () => qc.invalidateQueries({ queryKey: ["proposal-versions", leadId] });

  const discardMut = useMutation({
    mutationFn: (v: { id: string; reason: string }) => proposalsV2BuilderApi.discardVersion(v.id, v.reason || undefined),
    onSuccess: () => {
      toast.success("Versión descartada");
      invalidate();
      setDiscardTarget(null);
      setReason("");
    },
    onError: () => toast.error("No se pudo descartar la versión"),
  });
  const restoreMut = useMutation({
    mutationFn: (id: string) => proposalsV2BuilderApi.restoreVersion(id),
    onSuccess: () => {
      toast.success("Versión restaurada");
      invalidate();
      setRestoreTarget(null);
    },
    onError: () => toast.error("No se pudo restaurar la versión"),
  });

  function download(v: ProposalVersionListItem, kind: "full" | "summary") {
    const prefix = kind === "full" ? "propuesta" : "resumen";
    proposalsV2BuilderApi
      .downloadVersionPdf(v.id, kind, `${prefix}-${sanitizeLast(v.clientName ?? "cliente")}-v${v.versionNumber}.pdf`)
      .catch(() => toast.error("No se pudo descargar el PDF"));
  }

  const versions = q.data ?? [];

  return (
    <div>
      <div className="mb-3 flex items-center justify-between">
        <h2 className={H2}>Versiones publicadas</h2>
        <label className="flex items-center gap-2 text-xs text-[var(--color-text-secondary)]">
          <input type="checkbox" checked={showDiscarded} onChange={(e) => setShowDiscarded(e.target.checked)} />
          Ver descartadas
        </label>
      </div>

      {q.isLoading ? (
        <Spinner size={18} />
      ) : versions.length === 0 ? (
        <p className="text-sm text-[var(--color-text-muted)]">Todavía no hay versiones publicadas.</p>
      ) : (
        <div className="space-y-2">
          {versions.map((v) => (
            <div
              key={v.id}
              className="flex items-center justify-between gap-3 rounded-lg border border-[var(--color-border)] p-3"
            >
              <div className="flex min-w-0 items-center gap-3">
                <span className="text-lg font-bold text-[var(--color-text-primary)]">V{v.versionNumber}</span>
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    {v.status === "PUBLISHED" ? (
                      <span className="rounded bg-[var(--color-state-done-bg)] px-1.5 py-0.5 text-[10px] font-semibold uppercase text-[var(--color-state-done-text)]">
                        Publicada
                      </span>
                    ) : (
                      <span className="rounded bg-[var(--color-bg-app)] px-1.5 py-0.5 text-[10px] font-semibold uppercase text-[var(--color-text-muted)] line-through">
                        Descartada
                      </span>
                    )}
                    <span className="text-xs text-[var(--color-text-muted)]">{relative(v.publishedAt)}</span>
                  </div>
                  <p className="truncate text-xs text-[var(--color-text-muted)]">
                    por {authorName(v.publishedById)}
                    {v.totalConIva != null ? ` · USD ${Math.round(v.totalConIva).toLocaleString("es-UY")}` : ""}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-1">
                <IconBtn title="Descargar propuesta completa (PDF)" onClick={() => download(v, "full")}>
                  <Download size={16} />
                </IconBtn>
                <IconBtn title="Descargar resumen de 1 página (PDF)" onClick={() => download(v, "summary")}>
                  <FileText size={16} />
                </IconBtn>
                {v.status === "PUBLISHED" ? (
                  <IconBtn
                    title="Descartar esta versión (podés restaurarla después)"
                    danger
                    onClick={() => {
                      setReason("");
                      setDiscardTarget(v);
                    }}
                  >
                    <Trash2 size={16} />
                  </IconBtn>
                ) : (
                  <IconBtn title="Restaurar esta versión (vuelve a publicada)" onClick={() => setRestoreTarget(v)}>
                    <RotateCcw size={16} />
                  </IconBtn>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Modal de descarte (con razón opcional) */}
      <Sheet
        open={Boolean(discardTarget)}
        onClose={() => (discardMut.isPending ? undefined : setDiscardTarget(null))}
        title={discardTarget ? `¿Descartar V${discardTarget.versionNumber}?` : ""}
        footer={
          <>
            <Button variant="secondary" size="sm" disabled={discardMut.isPending} onClick={() => setDiscardTarget(null)}>
              Cancelar
            </Button>
            <Button
              variant="danger"
              size="sm"
              loading={discardMut.isPending}
              onClick={() => discardTarget && discardMut.mutate({ id: discardTarget.id, reason })}
            >
              Descartar
            </Button>
          </>
        }
      >
        <div className="space-y-3 text-sm">
          <p className="text-[var(--color-text-secondary)]">
            Podés restaurarla después. Los archivos y el snapshot no se borran.
          </p>
          <label className="block">
            <span className="mb-1 block text-xs text-[var(--color-text-secondary)]">Razón (opcional)</span>
            <textarea
              className="min-h-[70px] w-full resize-y rounded-md border border-[var(--color-border)] bg-[var(--color-bg-app)] px-3 py-2 text-sm text-[var(--color-text-primary)]"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
            />
          </label>
        </div>
      </Sheet>

      {/* Confirmación de restauración */}
      <ConfirmDialog
        open={Boolean(restoreTarget)}
        title={restoreTarget ? `¿Restaurar V${restoreTarget.versionNumber}?` : ""}
        description="Vuelve a estado publicada y se puede descargar de nuevo."
        confirmLabel="Restaurar"
        loading={restoreMut.isPending}
        onConfirm={() => restoreTarget && restoreMut.mutate(restoreTarget.id)}
        onClose={() => setRestoreTarget(null)}
      />
    </div>
  );
}

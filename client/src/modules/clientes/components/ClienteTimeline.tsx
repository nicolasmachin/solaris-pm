import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { toast } from "react-hot-toast";
import { ArrowLeftRight, FileText, GitBranch, MessageSquare, Pencil, Phone, Star, Ticket, Trash2 } from "lucide-react";

import { getClienteTimeline, type TimelineItem } from "../../../api/clientes.api";
import { Button } from "../../../components/ui/Button";
import { ConfirmDialog } from "../../../components/ui/ConfirmDialog";
import { Spinner } from "../../../components/ui/Spinner";
import { useAuthStore } from "../../../store/auth.store";
import { CHANNEL_LABELS, DIRECTION_LABELS, REASON_LABELS } from "../constants";
import { useDeleteInteraction, useEditInteraction } from "../hooks/useClienteInteractions";

const MAX = 2000;

function getApiErr(err: unknown): string | undefined {
  return (err as { response?: { data?: { message?: string } } })?.response?.data?.message;
}

// Las interacciones de la bitácora llegan al feed con el id prefijado (`ci-…`).
// Se recupera el id real para poder editarlas y borrarlas desde acá: el feed es
// el único lugar donde se ven, así que también tiene que ser donde se corrigen.
function idInteraccion(it: TimelineItem): string | null {
  return it.source === "client" && it.kind === "interaction" && it.id.startsWith("ci-")
    ? it.id.slice(3)
    : null;
}

// Feed unificado (solo lectura): Ventas + comentarios + interacciones CX +
// avances de etapa + documentos + traspasos + tickets.
// La etiqueta dice **de qué módulo viene** la entrada, no qué tipo de cosa es:
// eso ya lo dice el ícono. Antes el trámite UTE y la obra caían los dos en
// "Proyecto", así que había que leer el texto para saber de qué se hablaba.
const SOURCE_META: Record<TimelineItem["source"], { label: string; className: string }> = {
  sales: { label: "Ventas", className: "bg-blue-500/15 text-blue-400" },
  project: { label: "Operaciones", className: "bg-purple-500/15 text-purple-400" },
  ute: { label: "Trámite UTE", className: "bg-sky-500/15 text-sky-400" },
  client: { label: "Experiencia Solar", className: "bg-emerald-500/15 text-emerald-400" },
  ticket: { label: "Ticket", className: "bg-amber-500/15 text-amber-500" },
  survey: { label: "Encuesta", className: "bg-teal-500/15 text-teal-400" },
};

function KindIcon({ kind }: { kind: TimelineItem["kind"] }) {
  const cls = "text-[var(--color-text-muted)]";
  if (kind === "stage_change") return <GitBranch size={14} className={cls} />;
  if (kind === "interaction") return <Phone size={14} className={cls} />;
  if (kind === "document") return <FileText size={14} className={cls} />;
  if (kind === "handoff") return <ArrowLeftRight size={14} className={cls} />;
  if (kind === "ticket") return <Ticket size={14} className={cls} />;
  if (kind === "survey") return <Star size={14} className={cls} />;
  return <MessageSquare size={14} className={cls} />;
}

// Sub-línea "Canal · Dirección · Motivo" para las interacciones CX.
function interactionMeta(meta: TimelineItem["meta"]): string | null {
  if (!meta) return null;
  const parts = [
    meta.channel ? CHANNEL_LABELS[meta.channel] : null,
    meta.direction ? DIRECTION_LABELS[meta.direction] : null,
    meta.reason ? REASON_LABELS[meta.reason] : null,
  ].filter(Boolean);
  return parts.length ? parts.join(" · ") : null;
}

function fmtDateTime(iso: string): string {
  return new Date(iso).toLocaleString("es-UY", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function ClienteTimeline({ projectId }: { projectId: string }) {
  const q = useQuery({
    queryKey: ["cliente-timeline", projectId],
    queryFn: () => getClienteTimeline(projectId),
    enabled: Boolean(projectId),
  });
  const user = useAuthStore((s) => s.user);
  const editMut = useEditInteraction(projectId);
  const delMut = useDeleteInteraction(projectId);
  const [editando, setEditando] = useState<string | null>(null);
  const [draft, setDraft] = useState("");
  const [confirmId, setConfirmId] = useState<string | null>(null);

  function guardar(id: string) {
    const texto = draft.trim();
    if (!texto || texto.length > MAX) {
      toast.error(`El texto debe tener entre 1 y ${MAX} caracteres`);
      return;
    }
    editMut.mutate(
      { id, content: texto },
      {
        onSuccess: () => setEditando(null),
        onError: (err) => toast.error(getApiErr(err) ?? "No se pudo guardar"),
      },
    );
  }

  if (q.isLoading) return <Spinner size={18} />;
  const items = q.data ?? [];
  if (items.length === 0) {
    return <p className="text-sm text-[var(--color-text-muted)]">Sin historial todavía.</p>;
  }

  return (
    <>
      <ol className="space-y-2">
      {items.map((it) => {
        const src = SOURCE_META[it.source];
        const metaLine = it.kind === "interaction" ? interactionMeta(it.meta) : null;
        // Comentarios dejados dentro de una etapa/subetapa/tarea: mostrar de dónde
        // salieron, para que no lleguen sueltos a la ficha.
        const origen =
          it.kind === "comment" && typeof it.meta?.origen === "string" ? it.meta.origen : null;
        // Solo el autor (o un admin) puede corregir su propio registro.
        const interId = idInteraccion(it);
        const editable = !!interId && !!user && (user.id === it.autor?.id || user.role === "ADMIN");
        const enEdicion = editando === interId;
        return (
          <li
            key={it.id}
            className="group/it relative flex gap-3 rounded-md border border-[var(--color-border)] bg-[var(--color-bg-app)] p-3"
          >
            <div className="mt-0.5">
              <KindIcon kind={it.kind} />
            </div>
            <div className="min-w-0 flex-1">
              <div className="mb-0.5 flex flex-wrap items-center gap-2">
                <span className={`rounded px-1.5 py-0.5 text-[10px] font-semibold uppercase ${src.className}`}>
                  {src.label}
                </span>
                <span className="text-xs text-[var(--color-text-muted)]">
                  {it.autor?.nombre ?? "—"} · {fmtDateTime(it.createdAt)}
                </span>
                {origen && (
                  <span className="rounded border border-[var(--color-border)] px-1.5 py-0.5 text-[10px] text-[var(--color-text-muted)]">
                    en {origen}
                  </span>
                )}
              </div>
              {metaLine && (
                <p className="mb-0.5 text-[11px] font-medium text-[var(--color-text-secondary)]">{metaLine}</p>
              )}
              {enEdicion && interId ? (
                <div className="space-y-2">
                  <textarea
                    autoFocus
                    rows={3}
                    maxLength={MAX}
                    value={draft}
                    onChange={(e) => setDraft(e.target.value)}
                    className="w-full resize-none rounded-lg border border-[var(--color-border)] bg-[var(--color-bg-card)] px-3 py-2 text-sm text-[var(--color-text-primary)] focus:outline-none focus:ring-2 focus:ring-[var(--color-accent)]"
                  />
                  <div className="flex items-center justify-end gap-2">
                    <Button variant="secondary" size="sm" onClick={() => setEditando(null)} disabled={editMut.isPending}>
                      Cancelar
                    </Button>
                    <Button size="sm" loading={editMut.isPending} onClick={() => guardar(interId)} disabled={!draft.trim()}>
                      Guardar
                    </Button>
                  </div>
                </div>
              ) : (
                <p className="whitespace-pre-wrap break-words text-sm text-[var(--color-text-primary)]">{it.text}</p>
              )}
              {it.kind === "survey" && typeof it.meta?.comentario === "string" && it.meta.comentario && (
                <p className="mt-0.5 text-[12px] italic text-[var(--color-text-muted)]">“{it.meta.comentario}”</p>
              )}
            </div>

            {editable && !enEdicion && interId && (
              <div className="absolute right-2 top-2 flex items-center gap-1 opacity-0 transition-opacity group-hover/it:opacity-100">
                <button
                  type="button"
                  onClick={() => {
                    setEditando(interId);
                    setDraft(it.text);
                  }}
                  aria-label="Editar el registro"
                  className="rounded p-1 text-[var(--color-text-muted)] hover:bg-[var(--color-border)]/40 hover:text-[var(--color-text-primary)]"
                >
                  <Pencil className="h-3.5 w-3.5" />
                </button>
                <button
                  type="button"
                  onClick={() => setConfirmId(interId)}
                  aria-label="Borrar el registro"
                  className="rounded p-1 text-[var(--color-text-muted)] hover:bg-[var(--color-danger-bg)] hover:text-[var(--color-danger-text)]"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              </div>
            )}
          </li>
        );
      })}
      </ol>

      <ConfirmDialog
        open={!!confirmId}
        title="¿Borrar este registro?"
        description="Esta acción no se puede deshacer desde la app."
        confirmLabel="Borrar"
        destructive
        loading={delMut.isPending}
        onConfirm={() =>
          confirmId &&
          delMut.mutate(confirmId, {
            onSuccess: () => {
              setConfirmId(null);
              toast.success("Registro borrado");
            },
            onError: (err) => toast.error(getApiErr(err) ?? "No se pudo borrar"),
          })
        }
        onClose={() => setConfirmId(null)}
      />
    </>
  );
}

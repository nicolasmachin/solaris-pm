import { useQuery } from "@tanstack/react-query";
import { ArrowLeftRight, FileText, GitBranch, MessageSquare, Phone, Star, Ticket } from "lucide-react";

import { getClienteTimeline, type TimelineItem } from "../../../api/clientes.api";
import { Spinner } from "../../../components/ui/Spinner";
import { CHANNEL_LABELS, DIRECTION_LABELS, REASON_LABELS } from "../constants";

// Feed unificado (solo lectura): Ventas + comentarios + interacciones CX +
// avances de etapa + documentos + traspasos + tickets.
const SOURCE_META: Record<TimelineItem["source"], { label: string; className: string }> = {
  sales: { label: "Ventas", className: "bg-blue-500/15 text-blue-400" },
  project: { label: "Proyecto", className: "bg-purple-500/15 text-purple-400" },
  client: { label: "Cliente", className: "bg-emerald-500/15 text-emerald-400" },
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

  if (q.isLoading) return <Spinner size={18} />;
  const items = q.data ?? [];
  if (items.length === 0) {
    return <p className="text-sm text-[var(--color-text-muted)]">Sin historial todavía.</p>;
  }

  return (
    <ol className="space-y-2">
      {items.map((it) => {
        const src = SOURCE_META[it.source];
        const metaLine = it.kind === "interaction" ? interactionMeta(it.meta) : null;
        // Comentarios dejados dentro de una etapa/subetapa/tarea: mostrar de dónde
        // salieron, para que no lleguen sueltos a la ficha.
        const origen =
          it.kind === "comment" && typeof it.meta?.origen === "string" ? it.meta.origen : null;
        return (
          <li
            key={it.id}
            className="flex gap-3 rounded-md border border-[var(--color-border)] bg-[var(--color-bg-app)] p-3"
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
              <p className="whitespace-pre-wrap break-words text-sm text-[var(--color-text-primary)]">{it.text}</p>
              {it.kind === "survey" && typeof it.meta?.comentario === "string" && it.meta.comentario && (
                <p className="mt-0.5 text-[12px] italic text-[var(--color-text-muted)]">“{it.meta.comentario}”</p>
              )}
            </div>
          </li>
        );
      })}
    </ol>
  );
}

import { useQuery } from "@tanstack/react-query";
import { GitBranch, MessageSquare, Phone } from "lucide-react";

import { getClienteTimeline, type TimelineItem } from "../../../api/clientes.api";
import { Spinner } from "../../../components/ui/Spinner";

// Feed unificado (solo lectura): actividades de Ventas + comentarios + interacciones.
const SOURCE_META: Record<TimelineItem["source"], { label: string; className: string }> = {
  sales: { label: "Ventas", className: "bg-blue-500/15 text-blue-400" },
  project: { label: "Proyecto", className: "bg-purple-500/15 text-purple-400" },
  client: { label: "Cliente", className: "bg-emerald-500/15 text-emerald-400" },
};

function KindIcon({ kind }: { kind: TimelineItem["kind"] }) {
  if (kind === "stage_change") return <GitBranch size={14} className="text-[var(--color-text-muted)]" />;
  if (kind === "interaction") return <Phone size={14} className="text-[var(--color-text-muted)]" />;
  return <MessageSquare size={14} className="text-[var(--color-text-muted)]" />;
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
              </div>
              <p className="whitespace-pre-wrap break-words text-sm text-[var(--color-text-primary)]">{it.text}</p>
            </div>
          </li>
        );
      })}
    </ol>
  );
}

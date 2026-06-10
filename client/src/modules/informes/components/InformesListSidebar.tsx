import { Search, Plus, FileText } from "lucide-react";

import type { InformeBox, InformeListItem } from "../../../api/informes.api";
import { EstadoBadge } from "./EstadoBadge";

const BOXES: { key: InformeBox; label: string }[] = [
  { key: "recibidos", label: "Recibidos" },
  { key: "enviados", label: "Enviados" },
  { key: "todos", label: "Todos" },
];

interface Props {
  box: InformeBox;
  onBoxChange: (box: InformeBox) => void;
  search: string;
  onSearchChange: (s: string) => void;
  informes: InformeListItem[];
  loading: boolean;
  selectedId: string | null;
  onSelect: (id: string) => void;
  onNuevo: () => void;
  canCreate: boolean;
  showTodos: boolean;
}

function fecha(iso: string): string {
  return new Date(iso).toLocaleDateString("es-UY", { day: "2-digit", month: "short" });
}

export function InformesListSidebar({
  box,
  onBoxChange,
  search,
  onSearchChange,
  informes,
  loading,
  selectedId,
  onSelect,
  onNuevo,
  canCreate,
  showTodos,
}: Props) {
  const boxes = showTodos ? BOXES : BOXES.filter((b) => b.key !== "todos");

  return (
    <aside className="flex h-full w-72 flex-shrink-0 flex-col border-r border-[var(--color-border)] bg-[var(--color-bg-card)]">
      <div className="flex items-center justify-between px-3 py-3">
        <h2 className="text-sm font-semibold text-[var(--color-text-primary)]">Informes</h2>
        {canCreate && (
          <button
            onClick={onNuevo}
            className="flex items-center gap-1 rounded-lg bg-[var(--color-accent)] px-2 py-1 text-xs font-semibold text-black hover:opacity-90"
          >
            <Plus className="h-3.5 w-3.5" /> Nuevo
          </button>
        )}
      </div>

      <div className="flex gap-1 px-3 pb-2">
        {boxes.map((b) => (
          <button
            key={b.key}
            onClick={() => onBoxChange(b.key)}
            className={`flex-1 rounded-lg px-2 py-1 text-xs font-medium transition-colors ${
              box === b.key
                ? "bg-[var(--color-accent)]/15 text-[var(--color-accent)]"
                : "text-[var(--color-text-muted)] hover:bg-[var(--color-border)]/30"
            }`}
          >
            {b.label}
          </button>
        ))}
      </div>

      <div className="px-3 pb-2">
        <div className="relative">
          <Search className="absolute left-2 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-[var(--color-text-muted)]" />
          <input
            type="search"
            value={search}
            onChange={(e) => onSearchChange(e.target.value)}
            placeholder="Buscar…"
            className="w-full rounded-lg border border-[var(--color-border)] bg-[var(--color-bg-app)] py-1.5 pl-8 pr-2 text-xs text-[var(--color-text-primary)] focus:outline-none focus:ring-2 focus:ring-[var(--color-accent)]"
          />
        </div>
      </div>

      <div className="flex-1 overflow-y-auto px-2 pb-3">
        {loading ? (
          <p className="px-3 py-6 text-center text-xs text-[var(--color-text-muted)]">Cargando…</p>
        ) : informes.length === 0 ? (
          <div className="flex flex-col items-center gap-2 px-3 py-10 text-center text-xs text-[var(--color-text-muted)]">
            <FileText className="h-6 w-6 opacity-40" />
            <span>No hay informes</span>
          </div>
        ) : (
          informes.map((inf) => {
            const active = inf.id === selectedId;
            return (
              <button
                key={inf.id}
                onClick={() => onSelect(inf.id)}
                className={`mb-1 w-full rounded-lg border px-3 py-2 text-left transition-colors ${
                  active
                    ? "border-[var(--color-accent)]/50 bg-[var(--color-accent)]/10"
                    : "border-transparent hover:bg-[var(--color-border)]/25"
                }`}
              >
                <div className="flex items-start justify-between gap-2">
                  <span className="line-clamp-2 text-xs font-medium text-[var(--color-text-primary)]">{inf.titulo}</span>
                  <EstadoBadge estado={inf.estado} compact />
                </div>
                <div className="mt-1 flex items-center justify-between text-[10px] text-[var(--color-text-muted)]">
                  <span className="truncate">
                    {box === "recibidos" ? inf.autor.nombre : `${inf.respondidos}/${inf.totalDestinatarios} resp.`}
                  </span>
                  <span>{fecha(inf.enviadoAt ?? inf.createdAt)}</span>
                </div>
                {inf.project && (
                  <div className="mt-0.5 truncate text-[10px] text-[var(--color-accent)]/80">
                    {inf.project.codigo} · {inf.project.nombre}
                  </div>
                )}
              </button>
            );
          })
        )}
      </div>
    </aside>
  );
}

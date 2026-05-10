import { useEffect, useMemo, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Check, ChevronDown, Search, X } from "lucide-react";

import { getProjects, type ProjectListItem } from "../../api/projects.api";

const baseInput =
  "w-full rounded-lg border border-[var(--color-border)] bg-[var(--color-bg-app)] px-3 py-2 text-sm text-[var(--color-text-primary)] focus:outline-none focus:ring-2 focus:ring-[var(--color-accent)]";

type Props = {
  value: string;
  onChange: (projectId: string) => void;
  placeholder?: string;
  /** Texto que aparece cuando no hay nada elegido. */
  emptyLabel?: string;
};

export function ProjectPicker({
  value,
  onChange,
  placeholder = "Buscar proyecto por cliente o código…",
  emptyLabel = "Sin proyecto",
}: Props) {
  const { data: projects = [] } = useQuery({
    queryKey: ["projects-list-finance"],
    queryFn: () => getProjects(),
  });
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const wrapperRef = useRef<HTMLDivElement>(null);

  // Cerrar al click fuera.
  useEffect(() => {
    function onDocClick(e: MouseEvent) {
      if (!wrapperRef.current?.contains(e.target as Node)) {
        setOpen(false);
        setQuery("");
      }
    }
    document.addEventListener("mousedown", onDocClick);
    return () => document.removeEventListener("mousedown", onDocClick);
  }, []);

  const selected = useMemo(
    () => projects.find((p) => p.id === value) ?? null,
    [projects, value],
  );

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return projects.slice(0, 30);
    return projects
      .filter(
        (p) =>
          p.clientName.toLowerCase().includes(q) ||
          p.code.toLowerCase().includes(q),
      )
      .slice(0, 30);
  }, [projects, query]);

  function pick(p: ProjectListItem | null) {
    onChange(p?.id ?? "");
    setOpen(false);
    setQuery("");
  }

  return (
    <div className="relative" ref={wrapperRef}>
      {/* Botón "input" que abre el dropdown. */}
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className={`${baseInput} text-left flex items-center justify-between gap-2`}
      >
        <span className="truncate">
          {selected ? (
            <span className="text-[var(--color-text-primary)]">
              {selected.code} · {selected.clientName}
            </span>
          ) : (
            <span className="text-[var(--color-text-muted)]">{emptyLabel}</span>
          )}
        </span>
        <div className="flex items-center gap-1 shrink-0">
          {selected && (
            <span
              onClick={(e) => {
                e.stopPropagation();
                pick(null);
              }}
              className="text-[var(--color-text-muted)] hover:text-red-400 cursor-pointer"
              role="button"
              aria-label="Quitar proyecto"
            >
              <X className="w-3.5 h-3.5" />
            </span>
          )}
          <ChevronDown className="w-3.5 h-3.5 text-[var(--color-text-muted)]" />
        </div>
      </button>

      {open && (
        <div className="absolute z-50 mt-1 w-full bg-[var(--color-bg-card)] border border-[var(--color-border)] rounded-lg shadow-2xl overflow-hidden">
          <div className="p-2 border-b border-[var(--color-border)]">
            <div className="relative">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-[var(--color-text-muted)]" />
              <input
                type="text"
                autoFocus
                placeholder={placeholder}
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                className="w-full pl-8 pr-2 py-1.5 rounded border border-[var(--color-border)] bg-[var(--color-bg-app)] text-sm text-[var(--color-text-primary)] focus:outline-none focus:ring-2 focus:ring-[var(--color-accent)]"
              />
            </div>
          </div>
          <div className="max-h-72 overflow-y-auto">
            <button
              type="button"
              onClick={() => pick(null)}
              className={`w-full text-left px-3 py-2 text-sm hover:bg-[var(--color-bg-card-hover)] flex items-center gap-2 ${
                !value ? "bg-[var(--color-bg-card-hover)]" : ""
              }`}
            >
              {!value && <Check className="w-3.5 h-3.5 text-[var(--color-accent)]" />}
              {value && <span className="w-3.5" />}
              <span className="text-[var(--color-text-muted)]">{emptyLabel}</span>
            </button>
            {filtered.length === 0 ? (
              <p className="text-xs text-[var(--color-text-muted)] text-center py-4">
                Sin resultados
              </p>
            ) : (
              filtered.map((p) => (
                <button
                  type="button"
                  key={p.id}
                  onClick={() => pick(p)}
                  className={`w-full text-left px-3 py-2 text-sm hover:bg-[var(--color-bg-card-hover)] flex items-center gap-2 ${
                    p.id === value ? "bg-[var(--color-bg-card-hover)]" : ""
                  }`}
                >
                  {p.id === value ? (
                    <Check className="w-3.5 h-3.5 text-[var(--color-accent)]" />
                  ) : (
                    <span className="w-3.5" />
                  )}
                  <div className="flex-1 min-w-0">
                    <p className="text-[var(--color-text-primary)] truncate">{p.clientName}</p>
                    <p className="text-[10px] font-mono text-[var(--color-text-muted)]">{p.code}</p>
                  </div>
                </button>
              ))
            )}
          </div>
          {projects.length > filtered.length && (
            <p className="text-[10px] text-[var(--color-text-muted)] text-center py-1.5 border-t border-[var(--color-border)]">
              Mostrando {filtered.length} de {projects.length}. Escribí para filtrar.
            </p>
          )}
        </div>
      )}
    </div>
  );
}

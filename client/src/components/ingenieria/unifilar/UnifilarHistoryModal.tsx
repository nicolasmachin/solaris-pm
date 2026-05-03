import { useMemo, useState } from "react";
import { X } from "lucide-react";
import type {
  TipoRed,
  UnifilarVersionListItem,
} from "../../../api/unifilar.api";
import { TIPO_RED_OPTIONS, inp, lbl } from "./shared";
import { UnifilarVersionsTable } from "./UnifilarVersionsTable";

type RedFilter = "todas" | TipoRed;

const RED_FILTER_OPTIONS: { value: RedFilter; label: string }[] = [
  { value: "todas", label: "Todas" },
  ...TIPO_RED_OPTIONS.map((o) => ({ value: o.value as RedFilter, label: o.label })),
];

/**
 * Modal con el historial completo de versiones de unifilar de un proyecto.
 * Permite buscar por etiqueta y filtrar por tipo de red.
 */
export function UnifilarHistoryModal({
  versions,
  onClose,
  onPreview,
  onDuplicate,
  onDelete,
}: {
  versions: UnifilarVersionListItem[];
  onClose: () => void;
  onPreview: (id: string) => void;
  onDuplicate: (id: string) => void;
  onDelete: (id: string) => void;
}) {
  const [search, setSearch] = useState("");
  const [redFilter, setRedFilter] = useState<RedFilter>("todas");

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return versions.filter((v) => {
      if (redFilter !== "todas" && v.tipoRed !== redFilter) return false;
      if (!q) return true;
      const label = (v.label ?? "").toLowerCase();
      const versionStr = `v${v.versionNumber}`;
      return label.includes(q) || versionStr.includes(q);
    });
  }, [versions, search, redFilter]);

  const total = versions.length;
  const showing = filtered.length;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4"
      onClick={onClose}
    >
      <div
        className="w-full max-w-5xl max-h-[92vh] rounded-xl bg-[var(--color-bg-card)] border border-[var(--color-border)] shadow-2xl overflow-hidden flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-[var(--color-border)] px-4 py-3">
          <h3 className="text-sm font-semibold text-[var(--color-text-primary)]">
            Historial de versiones — Unifilar
          </h3>
          <button
            onClick={onClose}
            className="p-1 rounded hover:bg-[var(--color-bg-card-hover)] text-[var(--color-text-muted)]"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="px-4 py-3 border-b border-[var(--color-border)] grid grid-cols-1 md:grid-cols-[1fr_220px] gap-2 items-end">
          <div>
            <label className={lbl}>Buscar por etiqueta o versión</label>
            <input
              type="search"
              className={inp}
              placeholder="Ej: borrador, v3…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
          <div>
            <label className={lbl}>Tipo de red</label>
            <select
              className={inp}
              value={redFilter}
              onChange={(e) => setRedFilter(e.target.value as RedFilter)}
            >
              {RED_FILTER_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="flex-1 overflow-auto px-4 py-3">
          <p className="text-[10px] text-[var(--color-text-muted)] mb-2 font-mono">
            {showing === total ? `${total} versiones` : `${showing} de ${total} versiones`}
          </p>
          {filtered.length === 0 ? (
            <p className="rounded-lg border border-dashed border-[var(--color-border)] bg-[var(--color-bg-app)] p-6 text-center text-xs text-[var(--color-text-muted)]">
              Sin versiones que coincidan con el filtro.
            </p>
          ) : (
            <UnifilarVersionsTable
              versions={filtered}
              onPreview={onPreview}
              onDuplicate={onDuplicate}
              onDelete={onDelete}
            />
          )}
        </div>
      </div>
    </div>
  );
}

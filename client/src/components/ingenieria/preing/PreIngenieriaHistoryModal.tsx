import { useState } from "react";
import { X } from "lucide-react";
import type { PreIngenieriaVersionListItem } from "../../../api/preingenieria.api";
import { inp, lbl } from "./shared";

const MONTHS_ES = ["ene", "feb", "mar", "abr", "may", "jun", "jul", "ago", "sep", "oct", "nov", "dic"];
function fmt(iso: string): string {
  const d = new Date(iso);
  return `${d.getDate()} ${MONTHS_ES[d.getMonth()]} ${String(d.getFullYear()).slice(-2)}`;
}

export function PreIngenieriaHistoryModal({
  versions,
  onClose,
  onPreview,
  onDelete,
}: {
  versions: PreIngenieriaVersionListItem[];
  onClose: () => void;
  onPreview: (id: string) => void;
  onDelete: (id: string) => void;
}) {
  const [search, setSearch] = useState("");
  const filtered = versions.filter((v) => {
    const q = search.trim().toLowerCase();
    if (!q) return true;
    const label = (v.label ?? "").toLowerCase();
    return label.includes(q) || `v${v.versionNumber}`.includes(q);
  });

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4" onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div
        className="w-full max-w-3xl max-h-[92vh] rounded-xl bg-[var(--color-bg-card)] border border-[var(--color-border)] shadow-2xl overflow-hidden flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-[var(--color-border)] px-4 py-3">
          <h3 className="text-sm font-semibold text-[var(--color-text-primary)]">
            Historial de pre-ingeniería
          </h3>
          <button onClick={onClose} className="p-1 rounded hover:bg-[var(--color-bg-card-hover)] text-[var(--color-text-muted)]">
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="px-4 py-3 border-b border-[var(--color-border)]">
          <label className={lbl}>Buscar por etiqueta o versión</label>
          <input
            type="search"
            className={inp}
            placeholder="Ej: borrador, v3…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>

        <div className="flex-1 overflow-auto px-4 py-3">
          <p className="text-[10px] text-[var(--color-text-muted)] mb-2 font-mono">
            {filtered.length === versions.length
              ? `${versions.length} versiones`
              : `${filtered.length} de ${versions.length} versiones`}
          </p>
          {filtered.length === 0 ? (
            <p className="rounded-lg border border-dashed border-[var(--color-border)] bg-[var(--color-bg-app)] p-6 text-center text-xs text-[var(--color-text-muted)]">
              Sin versiones que coincidan.
            </p>
          ) : (
            <table className="w-full text-xs">
              <thead className="text-[10px] uppercase tracking-wider font-mono text-[var(--color-text-muted)]">
                <tr className="text-left">
                  <th className="px-2 py-1.5 w-12">#</th>
                  <th className="px-2 py-1.5">Etiqueta</th>
                  <th className="px-2 py-1.5">Creada</th>
                  <th className="px-2 py-1.5 text-right">Acciones</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--color-border)]">
                {filtered.map((v) => (
                  <tr key={v.id} className="hover:bg-[var(--color-bg-card-hover)]">
                    <td className="px-2 py-1.5 font-mono">v{v.versionNumber}</td>
                    <td className="px-2 py-1.5 text-[var(--color-text-primary)]">
                      {v.label || <span className="text-[var(--color-text-muted)] italic">—</span>}
                    </td>
                    <td className="px-2 py-1.5 text-[10px] text-[var(--color-text-muted)]">
                      {fmt(v.createdAt)}
                    </td>
                    <td className="px-2 py-1.5 text-right">
                      <div className="flex items-center gap-1 justify-end">
                        <button
                          onClick={() => onPreview(v.id)}
                          className="px-2 py-0.5 rounded text-[10px] border border-[var(--color-border)] hover:bg-[var(--color-bg-card-hover)]"
                        >
                          Ver PDF
                        </button>
                        <button
                          onClick={() => onDelete(v.id)}
                          className="px-2 py-0.5 rounded text-[10px] border border-red-500/30 text-red-400 hover:bg-red-500/10"
                        >
                          Eliminar
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  );
}

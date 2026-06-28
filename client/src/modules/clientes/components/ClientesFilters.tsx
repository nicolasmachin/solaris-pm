import { Search, X } from "lucide-react";

import type { ClienteEstado, ClienteRecorrido, ClientesFilters as Filters } from "../../../api/clientes.api";
import {
  DEPARTAMENTOS_UY,
  ESTADO_LABELS,
  RECORRIDO_SHORT,
  RECORRIDO_OPTIONS,
} from "../constants";

const selectClass =
  "rounded-md border border-[var(--color-border)] bg-[var(--color-bg-app)] px-2.5 py-1.5 text-xs text-[var(--color-text-primary)] focus:outline-none focus:ring-2 focus:ring-[var(--color-accent)]";

interface Asesor {
  id: string;
  nombre: string;
}

interface ClientesFiltersProps {
  filters: Filters;
  onChange: (patch: Partial<Filters>) => void;
  asesores: Asesor[];
}

export function ClientesFilters({ filters, onChange, asesores }: ClientesFiltersProps) {
  return (
    <div className="flex flex-wrap items-center gap-2">
      <div className="relative min-w-[220px] flex-1">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--color-text-muted)]" />
        <input
          type="text"
          placeholder="Buscar por nombre, mail o teléfono"
          value={filters.search ?? ""}
          onChange={(e) => onChange({ search: e.target.value || undefined })}
          className="w-full rounded-lg border border-[var(--color-border)] bg-[var(--color-bg-card)] py-2 pl-9 pr-3 text-sm text-[var(--color-text-primary)] focus:outline-none focus:ring-2 focus:ring-[var(--color-accent)]"
        />
      </div>

      <select
        className={selectClass}
        value={filters.estado ?? ""}
        onChange={(e) => onChange({ estado: (e.target.value || undefined) as ClienteEstado | undefined })}
      >
        <option value="">Estado: todos</option>
        {(Object.keys(ESTADO_LABELS) as ClienteEstado[]).map((v) => (
          <option key={v} value={v}>
            {ESTADO_LABELS[v]}
          </option>
        ))}
      </select>

      <select
        className={selectClass}
        value={filters.etapa ?? ""}
        onChange={(e) => onChange({ etapa: (e.target.value || undefined) as ClienteRecorrido | undefined })}
      >
        <option value="">Etapa: todas</option>
        {RECORRIDO_OPTIONS.map((v) => (
          <option key={v} value={v}>
            {RECORRIDO_SHORT[v]}
          </option>
        ))}
      </select>

      <select
        className={selectClass}
        value={filters.asesorId ?? ""}
        onChange={(e) => onChange({ asesorId: e.target.value || undefined })}
      >
        <option value="">Asesor: todos</option>
        {asesores.map((a) => (
          <option key={a.id} value={a.id}>
            {a.nombre}
          </option>
        ))}
      </select>

      <select
        className={selectClass}
        value={filters.departamento ?? ""}
        onChange={(e) => onChange({ departamento: e.target.value || undefined })}
      >
        <option value="">Departamento: todos</option>
        {DEPARTAMENTOS_UY.map((d) => (
          <option key={d} value={d}>
            {d}
          </option>
        ))}
      </select>
    </div>
  );
}

// Chips de filtros activos con "limpiar". sortBy/sortDir no son chips (no son
// filtros de contenido, sino de orden).
interface ActiveFilterChipsProps {
  filters: Filters;
  asesores: Asesor[];
  onChange: (patch: Partial<Filters>) => void;
  onClearAll: () => void;
}

export function ActiveFilterChips({ filters, asesores, onChange, onClearAll }: ActiveFilterChipsProps) {
  const chips: Array<{ key: keyof Filters; label: string }> = [];
  if (filters.search) chips.push({ key: "search", label: `“${filters.search}”` });
  if (filters.estado) chips.push({ key: "estado", label: ESTADO_LABELS[filters.estado] });
  if (filters.etapa) chips.push({ key: "etapa", label: RECORRIDO_SHORT[filters.etapa] });
  if (filters.asesorId) {
    const a = asesores.find((x) => x.id === filters.asesorId);
    chips.push({ key: "asesorId", label: a ? a.nombre : "Asesor" });
  }
  if (filters.departamento) chips.push({ key: "departamento", label: filters.departamento });

  if (chips.length === 0) return null;

  return (
    <div className="flex flex-wrap items-center gap-2">
      {chips.map((c) => (
        <button
          key={c.key}
          type="button"
          onClick={() => onChange({ [c.key]: undefined } as Partial<Filters>)}
          className="inline-flex items-center gap-1 rounded-full border border-[var(--color-border)] bg-[var(--color-bg-card)] px-2.5 py-0.5 text-xs text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)]"
        >
          {c.label}
          <X className="h-3 w-3" />
        </button>
      ))}
      <button
        type="button"
        onClick={onClearAll}
        className="text-xs text-[var(--color-text-muted)] underline hover:text-[var(--color-text-primary)]"
      >
        Limpiar
      </button>
    </div>
  );
}

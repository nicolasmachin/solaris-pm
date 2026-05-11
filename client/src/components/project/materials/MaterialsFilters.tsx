import { useEffect, useMemo, useRef, useState } from 'react';
import { ChevronDown, Search, X } from 'lucide-react';

import {
  type MaterialRowColor,
  type MaterialStatus,
  type ProjectMaterial,
  MATERIAL_STATUSES,
} from '../../../types/materials.types';
import { ROW_COLOR_SWATCHES, STATUS_META, hasAnyFilter } from './types';
import { toggle, useMaterialsFilters } from './useMaterialsFilters';

// ─── Tipos de props ────────────────────────────────────────────────────────

type Props = {
  materials: ProjectMaterial[];
  filtered: ProjectMaterial[];
};

export function MaterialsFilters({ materials, filtered }: Props) {
  const { state, update, clear } = useMaterialsFilters();

  const allCategories = useMemo(() => {
    const map = new Map<string, { id: string; nombre: string; count: number; orden: number }>();
    for (const m of materials) {
      const c = m.materialItem?.category;
      if (!c) continue;
      const e = map.get(c.id);
      if (e) e.count += 1;
      else map.set(c.id, { id: c.id, nombre: c.nombre, count: 1, orden: c.orden });
    }
    return Array.from(map.values()).sort((a, b) => a.orden - b.orden);
  }, [materials]);

  const statusCounts = useMemo(() => {
    const c: Record<MaterialStatus, number> = { PENDIENTE: 0, PEDIDO: 0, RECIBIDO: 0, EN_STOCK: 0 };
    for (const m of materials) c[m.status] += 1;
    return c;
  }, [materials]);

  const colorCounts = useMemo(() => {
    const c: Record<string, number> = { none: 0, yellow: 0, green: 0, blue: 0, purple: 0, red: 0, gray: 0 };
    for (const m of materials) c[m.rowColor ?? 'none'] += 1;
    return c;
  }, [materials]);

  const filtersActive = hasAnyFilter(state);

  return (
    <>
      {/* ─── Barra de filtros ─────────────────────────────────────────── */}
      <div className="flex flex-wrap items-center gap-2 px-4 py-3 bg-[var(--color-bg-app)]/40 border-b border-[var(--color-border)]">
        {/* Buscador */}
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-[var(--color-text-muted)]" />
          <input
            type="text"
            placeholder="Buscar material..."
            value={state.q}
            onChange={(e) => update((p) => ({ ...p, q: e.target.value }))}
            className="w-full pl-9 pr-3 py-1.5 text-xs rounded-md border border-[var(--color-border)] bg-[var(--color-bg-card)] text-[var(--color-text-primary)] focus:outline-none focus:ring-2 focus:ring-[var(--color-accent)]"
          />
        </div>

        {/* Categoría */}
        <Dropdown
          icon="📂"
          label="Categoría"
          count={state.categoryIds.length}
        >
          {allCategories.length === 0 ? (
            <p className="px-2 py-1 text-[10px] text-[var(--color-text-muted)]">Sin categorías</p>
          ) : (
            allCategories.map((c) => (
              <CheckboxRow
                key={c.id}
                checked={state.categoryIds.includes(c.id)}
                onChange={() => update((p) => ({ ...p, categoryIds: toggle(p.categoryIds, c.id) }))}
                count={c.count}
                label={c.nombre}
              />
            ))
          )}
          {state.categoryIds.length > 0 && (
            <ClearRow onClick={() => update((p) => ({ ...p, categoryIds: [] }))} />
          )}
        </Dropdown>

        {/* Estado */}
        <Dropdown icon="🏷️" label="Estado" count={state.statuses.length}>
          {MATERIAL_STATUSES.map((s) => (
            <CheckboxRow
              key={s}
              checked={state.statuses.includes(s)}
              onChange={() => update((p) => ({ ...p, statuses: toggle(p.statuses, s) }))}
              count={statusCounts[s]}
              label={STATUS_META[s].label}
              dot={STATUS_META[s].dot}
            />
          ))}
          {state.statuses.length > 0 && (
            <ClearRow onClick={() => update((p) => ({ ...p, statuses: [] }))} />
          )}
        </Dropdown>

        {/* Color */}
        <Dropdown icon="🎨" label="Color" count={state.colors.length}>
          <CheckboxRow
            key="none"
            checked={state.colors.includes('none')}
            onChange={() => update((p) => ({ ...p, colors: toggle(p.colors, 'none') }))}
            count={colorCounts.none}
            label="Sin color"
            dot="transparent"
          />
          {ROW_COLOR_SWATCHES.map((c) => (
            <CheckboxRow
              key={c.value}
              checked={state.colors.includes(c.value)}
              onChange={() => update((p) => ({ ...p, colors: toggle(p.colors, c.value) }))}
              count={colorCounts[c.value]}
              label={c.label}
              dot={c.swatch}
            />
          ))}
          {state.colors.length > 0 && (
            <ClearRow onClick={() => update((p) => ({ ...p, colors: [] }))} />
          )}
        </Dropdown>

        {/* Más filtros */}
        <Dropdown
          icon="⋯"
          label="Más filtros"
          count={state.addedRoles.length + (state.crossed === 'all' ? 0 : 1)}
        >
          <SectionLabel>Agregado por</SectionLabel>
          <CheckboxRow
            checked={state.addedRoles.includes('AUTO')}
            onChange={() => update((p) => ({ ...p, addedRoles: toggle(p.addedRoles, 'AUTO') }))}
            label="Auto (ingeniería)"
            count={materials.filter((m) => !m.addedBy).length}
          />
          <CheckboxRow
            checked={state.addedRoles.includes('HUMANO')}
            onChange={() => update((p) => ({ ...p, addedRoles: toggle(p.addedRoles, 'HUMANO') }))}
            label="Agregado manualmente"
            count={materials.filter((m) => !!m.addedBy).length}
          />
          <SectionLabel>Tachados</SectionLabel>
          <RadioRow
            checked={state.crossed === 'all'}
            onChange={() => update((p) => ({ ...p, crossed: 'all' }))}
            label="Todos"
          />
          <RadioRow
            checked={state.crossed === 'yes'}
            onChange={() => update((p) => ({ ...p, crossed: 'yes' }))}
            label="Solo tachados"
            count={materials.filter((m) => m.crossed).length}
          />
          <RadioRow
            checked={state.crossed === 'no'}
            onChange={() => update((p) => ({ ...p, crossed: 'no' }))}
            label="Solo NO tachados"
            count={materials.filter((m) => !m.crossed).length}
          />
        </Dropdown>
      </div>

      {/* ─── Chips de filtros activos ─────────────────────────────────── */}
      {filtersActive && (
        <div className="flex flex-wrap items-center gap-2 px-4 py-2 bg-[var(--color-warning-bg)]/20 border-b border-[var(--color-border)] text-[11px]">
          <span className="font-mono uppercase tracking-wider text-[var(--color-text-muted)]">
            Filtros activos:
          </span>
          {state.q.trim() && (
            <Chip
              label={`"${state.q}"`}
              onRemove={() => update((p) => ({ ...p, q: '' }))}
            />
          )}
          {state.categoryIds.map((id) => {
            const c = allCategories.find((x) => x.id === id);
            return (
              <Chip
                key={id}
                label={`📂 ${c?.nombre ?? id}`}
                onRemove={() => update((p) => ({ ...p, categoryIds: p.categoryIds.filter((x) => x !== id) }))}
              />
            );
          })}
          {state.statuses.map((s) => (
            <Chip
              key={s}
              label={`🏷️ ${STATUS_META[s].label}`}
              onRemove={() => update((p) => ({ ...p, statuses: p.statuses.filter((x) => x !== s) }))}
            />
          ))}
          {state.colors.map((c) => {
            const label = c === 'none' ? 'Sin color' : ROW_COLOR_SWATCHES.find((s) => s.value === c)?.label ?? c;
            return (
              <Chip
                key={c}
                label={`🎨 ${label}`}
                onRemove={() => update((p) => ({ ...p, colors: p.colors.filter((x) => x !== c) }))}
              />
            );
          })}
          {state.addedRoles.map((r) => (
            <Chip
              key={r}
              label={`+ ${r === 'AUTO' ? 'Auto' : 'Manual'}`}
              onRemove={() => update((p) => ({ ...p, addedRoles: p.addedRoles.filter((x) => x !== r) }))}
            />
          ))}
          {state.crossed !== 'all' && (
            <Chip
              label={state.crossed === 'yes' ? '✓ Tachados' : '✓ No tachados'}
              onRemove={() => update((p) => ({ ...p, crossed: 'all' }))}
            />
          )}
          <button
            type="button"
            onClick={clear}
            className="ml-auto text-[var(--color-danger-text)] underline hover:no-underline font-semibold"
          >
            Limpiar todo
          </button>
        </div>
      )}

      {/* ─── Stats ─────────────────────────────────────────────────────── */}
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-2 px-4 py-3 bg-[var(--color-bg-app)]/40 border-b border-[var(--color-border)]">
        <StatCard
          label={filtersActive ? 'Mostrando' : 'Total'}
          value={filtersActive ? `${filtered.length} / ${materials.length}` : `${materials.length}`}
          active={filtersActive}
        />
        {MATERIAL_STATUSES.map((s) => {
          const meta = STATUS_META[s];
          const isActive = state.statuses.includes(s);
          return (
            <StatCard
              key={s}
              label={meta.label}
              value={String(statusCounts[s])}
              dot={meta.dot}
              active={isActive}
              onClick={() =>
                update((p) => ({
                  ...p,
                  statuses: isActive ? p.statuses.filter((x) => x !== s) : [...p.statuses, s],
                }))
              }
            />
          );
        })}
      </div>
    </>
  );
}

// ─── Sub-componentes ───────────────────────────────────────────────────────

function Dropdown({
  icon,
  label,
  count,
  children,
}: {
  icon: string;
  label: string;
  count: number;
  children: React.ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    function onDocClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener('mousedown', onDocClick);
    return () => document.removeEventListener('mousedown', onDocClick);
  }, [open]);

  const hasSelection = count > 0;

  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className={`inline-flex items-center gap-1.5 px-2.5 py-1.5 text-[11px] font-semibold rounded-md border transition-colors ${
          hasSelection
            ? 'bg-[var(--color-warning-bg)]/30 border-[var(--color-warning-bg)] text-[var(--color-warning-text)]'
            : 'bg-[var(--color-bg-card)] border-[var(--color-border)] text-[var(--color-text-secondary)] hover:bg-[var(--color-bg-card-hover)]'
        }`}
      >
        <span>{icon}</span>
        <span>{label}</span>
        {count > 0 && (
          <span className="bg-[var(--color-accent)] text-gray-900 text-[9px] font-bold min-w-[16px] h-4 px-1 rounded-full inline-flex items-center justify-center">
            {count}
          </span>
        )}
        <ChevronDown className="w-3 h-3" />
      </button>
      {open && (
        <div className="absolute top-full left-0 mt-1 min-w-[220px] max-h-[320px] overflow-y-auto rounded-lg border border-[var(--color-border)] bg-[var(--color-bg-card)] shadow-xl z-20 p-1.5">
          {children}
        </div>
      )}
    </div>
  );
}

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <p className="px-2 pt-2 pb-1 text-[9px] font-bold uppercase tracking-wider text-[var(--color-text-muted)]">
      {children}
    </p>
  );
}

function CheckboxRow({
  checked,
  onChange,
  label,
  count,
  dot,
}: {
  checked: boolean;
  onChange: () => void;
  label: string;
  count?: number;
  dot?: string;
}) {
  return (
    <label className="flex items-center gap-2 px-2 py-1.5 rounded cursor-pointer hover:bg-[var(--color-bg-card-hover)]">
      <input type="checkbox" checked={checked} onChange={onChange} className="accent-[var(--color-accent)]" />
      {dot && (
        <span
          className="inline-block w-2 h-2 rounded-full shrink-0"
          style={{ background: dot, border: dot === 'transparent' ? '1px dashed var(--color-text-muted)' : 'none' }}
        />
      )}
      <span className="text-xs text-[var(--color-text-primary)] truncate">{label}</span>
      {count !== undefined && (
        <span className="ml-auto text-[10px] tabular-nums text-[var(--color-text-muted)]">{count}</span>
      )}
    </label>
  );
}

function RadioRow({
  checked,
  onChange,
  label,
  count,
}: {
  checked: boolean;
  onChange: () => void;
  label: string;
  count?: number;
}) {
  return (
    <label className="flex items-center gap-2 px-2 py-1.5 rounded cursor-pointer hover:bg-[var(--color-bg-card-hover)]">
      <input type="radio" checked={checked} onChange={onChange} className="accent-[var(--color-accent)]" />
      <span className="text-xs text-[var(--color-text-primary)] truncate">{label}</span>
      {count !== undefined && (
        <span className="ml-auto text-[10px] tabular-nums text-[var(--color-text-muted)]">{count}</span>
      )}
    </label>
  );
}

function ClearRow({ onClick }: { onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="w-full mt-1 pt-1.5 border-t border-[var(--color-border)] text-[11px] text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)]"
    >
      Limpiar
    </button>
  );
}

function Chip({ label, onRemove }: { label: string; onRemove: () => void }) {
  return (
    <span className="inline-flex items-center gap-1.5 pl-2 pr-1 py-0.5 rounded-full border border-[var(--color-warning-bg)] bg-[var(--color-bg-card)] text-[var(--color-warning-text)] text-[11px] font-semibold">
      {label}
      <button
        type="button"
        onClick={onRemove}
        className="inline-flex items-center justify-center w-4 h-4 rounded-full bg-[var(--color-accent)] text-gray-900 hover:bg-[var(--color-accent-hover)]"
        aria-label={`Quitar filtro ${label}`}
      >
        <X className="w-2.5 h-2.5" />
      </button>
    </span>
  );
}

function StatCard({
  label,
  value,
  dot,
  active,
  onClick,
}: {
  label: string;
  value: string;
  dot?: string;
  active: boolean;
  onClick?: () => void;
}) {
  const clickable = !!onClick;
  return (
    <button
      type="button"
      disabled={!clickable}
      onClick={onClick}
      className={`text-left px-3 py-2 rounded-md border transition-colors ${
        active
          ? 'bg-[var(--color-warning-bg)]/30 border-[var(--color-warning-bg)]'
          : 'bg-[var(--color-bg-card)] border-[var(--color-border)] hover:bg-[var(--color-bg-card-hover)]'
      } ${clickable ? 'cursor-pointer' : 'cursor-default'}`}
    >
      <p className="flex items-center gap-1.5 text-[10px] font-mono uppercase tracking-wider text-[var(--color-text-muted)]">
        {dot && <span className="inline-block w-2 h-2 rounded-full" style={{ background: dot }} />}
        {label}
      </p>
      <p className="text-base font-bold tabular-nums text-[var(--color-text-primary)] mt-0.5">{value}</p>
    </button>
  );
}

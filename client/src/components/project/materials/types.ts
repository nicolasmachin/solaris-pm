import type { MaterialRowColor, MaterialStatus, ProjectMaterial } from '../../../types/materials.types';

// ─── Filtros ───────────────────────────────────────────────────────────────
//
// El estado del filtro vive en la URL (querystring) y se rehidrata al cargar.
// Convenciones:
//   ?q=texto                  - búsqueda libre
//   ?cat=ID1,ID2              - categorías (multi)
//   ?status=PENDIENTE,PEDIDO  - estados (multi)
//   ?color=yellow,red,none    - colores (multi). "none" = sin color asignado.
//   ?added=INGENIERIA,OPERACIONES - rol que agregó (multi)
//   ?crossed=yes              - "yes" oculta sólo tachados, "no" oculta sólo
//                                no-tachados, ausente = ambos.

export type FilterState = {
  q: string;
  categoryIds: string[];
  statuses: MaterialStatus[];
  colors: Array<MaterialRowColor | 'none'>;
  addedRoles: string[];
  crossed: 'all' | 'yes' | 'no';
};

export const EMPTY_FILTERS: FilterState = {
  q: '',
  categoryIds: [],
  statuses: [],
  colors: [],
  addedRoles: [],
  crossed: 'all',
};

export function hasAnyFilter(f: FilterState): boolean {
  return (
    f.q.trim() !== '' ||
    f.categoryIds.length > 0 ||
    f.statuses.length > 0 ||
    f.colors.length > 0 ||
    f.addedRoles.length > 0 ||
    f.crossed !== 'all'
  );
}

export function applyFilters(materials: ProjectMaterial[], f: FilterState): ProjectMaterial[] {
  const q = f.q.trim().toLowerCase();
  return materials.filter((m) => {
    if (q && !matchesQuery(m, q)) return false;
    if (f.categoryIds.length > 0) {
      const catId = m.materialItem?.category?.id;
      if (!catId || !f.categoryIds.includes(catId)) return false;
    }
    if (f.statuses.length > 0 && !f.statuses.includes(m.status)) return false;
    if (f.colors.length > 0) {
      const c = m.rowColor ?? 'none';
      if (!f.colors.includes(c)) return false;
    }
    if (f.addedRoles.length > 0) {
      // Solo filtra por addedRoles si el material fue agregado por alguien
      // (auto-generados de ingeniería tienen addedBy=null).
      // "auto" como valor especial captura los null.
      if (!m.addedBy) {
        if (!f.addedRoles.includes('AUTO')) return false;
      } else {
        // No tenemos el rol directo del adder; comparamos por lastEditedRole
        // como heurística — si el creador fue ingeniería y nadie editó, el
        // lastEditedRole coincide. Para el filtro "agregado por", devolvemos
        // siempre true si addedBy existe y "agregado por" pide HUMANO.
        if (!f.addedRoles.includes('HUMANO')) return false;
      }
    }
    if (f.crossed === 'yes' && !m.crossed) return false;
    if (f.crossed === 'no' && m.crossed) return false;
    return true;
  });
}

function matchesQuery(m: ProjectMaterial, q: string): boolean {
  const nombre = m.materialItem?.nombre?.toLowerCase() ?? '';
  const notes = m.notes?.toLowerCase() ?? '';
  const catNombre = m.materialItem?.category?.nombre?.toLowerCase() ?? '';
  const supplier = m.supplier?.nombre?.toLowerCase() ?? '';
  return (
    nombre.includes(q) ||
    notes.includes(q) ||
    catNombre.includes(q) ||
    supplier.includes(q)
  );
}

// ─── Constantes UI ─────────────────────────────────────────────────────────

export const STATUS_META: Record<MaterialStatus, { label: string; dot: string; pillClass: string }> = {
  PENDIENTE: {
    label: 'Pendiente',
    dot: '#94a3b8',
    pillClass: 'border-[var(--color-border)] text-[var(--color-text-secondary)]',
  },
  PEDIDO: {
    label: 'Pedido',
    dot: '#f59e0b',
    pillClass: 'border-[var(--color-warning-bg)] bg-[var(--color-warning-bg)]/30 text-[var(--color-warning-text)]',
  },
  RECIBIDO: {
    label: 'Recibido',
    dot: '#10b981',
    pillClass: 'border-[var(--color-success-bg)] bg-[var(--color-success-bg)]/30 text-[var(--color-success-text)]',
  },
  EN_STOCK: {
    label: 'En stock',
    dot: '#3b82f6',
    pillClass: 'border-[var(--color-info-bg)] bg-[var(--color-info-bg)]/30 text-[var(--color-info-text)]',
  },
};

export const ROW_COLOR_SWATCHES: Array<{ value: MaterialRowColor; label: string; swatch: string }> = [
  { value: 'yellow', label: 'Amarillo', swatch: '#fbbf24' },
  { value: 'green', label: 'Verde', swatch: '#4ade80' },
  { value: 'blue', label: 'Azul', swatch: '#60a5fa' },
  { value: 'purple', label: 'Violeta', swatch: '#c4b5fd' },
  { value: 'red', label: 'Rojo', swatch: '#fca5a5' },
  { value: 'gray', label: 'Gris', swatch: '#94a3b8' },
];

// Tono de badge por categoría. Si la categoría no está en el mapa, usa neutral.
export function categoryBadgeClass(nombre: string | undefined): string {
  const n = (nombre ?? '').toLowerCase();
  if (n.includes('panel')) return 'bg-orange-500/15 text-orange-400 border-orange-500/30';
  if (n.includes('inversor monof')) return 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30';
  if (n.includes('inversor trif')) return 'bg-teal-500/15 text-teal-400 border-teal-500/30';
  if (n.includes('estructura')) return 'bg-sky-500/15 text-sky-400 border-sky-500/30';
  if (n.includes('electric') || n.includes('eléctric')) return 'bg-yellow-500/15 text-yellow-400 border-yellow-500/30';
  if (n.includes('mano de obra')) return 'bg-violet-500/15 text-violet-400 border-violet-500/30';
  return 'bg-[var(--color-border)] text-[var(--color-text-secondary)] border-[var(--color-border)]';
}

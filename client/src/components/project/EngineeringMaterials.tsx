import { useEffect, useMemo, useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'react-hot-toast';
import { AlertTriangle, ChevronDown, DollarSign, FileText, LayoutTemplate, Plus, Search, X } from 'lucide-react';
import {
  getProjectMaterials, createProjectMaterial,
  exportMaterialsPdf,
  getMaterialCategories, getMaterialItems, removeZeroProjectMaterials,
} from '../../api/materials.api';
import { getMaterialTemplates, applyMaterialTemplate } from '../../api/materialTemplates.api';
import type { MaterialItem, ProjectMaterial } from '../../types/materials.types';
import { PHASE_TYPE_LABELS } from '../../types/materials.types';
import { useAuthStore } from '../../store/auth.store';
import { usePermission } from '../../hooks/usePermission';

import { MaterialPhotoButton } from '../materials/MaterialPhoto';
import { MaterialsFilters } from './materials/MaterialsFilters';
import { MaterialsTable } from './materials/MaterialsTable';
import { applyFilters, hasAnyFilter, isZero } from './materials/types';
import { useMaterialsFilters } from './materials/useMaterialsFilters';

function klass(...p: (string | false | undefined)[]) { return p.filter(Boolean).join(' '); }

function getApiErr(err: unknown) {
  return (err as { response?: { data?: { message?: string } } })?.response?.data?.message;
}

function fmtMoney(n: number, moneda: string) {
  return `${n.toLocaleString('es-UY', { minimumFractionDigits: 2 })} ${moneda}`;
}

function formatRelative(value: string) {
  const diffMs = Date.now() - new Date(value).getTime();
  const minutes = Math.floor(diffMs / 60000);
  if (minutes < 1) return 'hace instantes';
  if (minutes < 60) return `hace ${minutes} min`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `hace ${hours} h`;
  const days = Math.floor(hours / 24);
  return `hace ${days} día${days === 1 ? '' : 's'}`;
}

function roleLabel(role: string | null | undefined): string {
  if (!role) return '';
  const map: Record<string, string> = {
    ADMIN: 'Admin',
    INGENIERIA: 'Ingeniería',
    OPERACIONES: 'Operaciones',
    ASESOR_COMERCIAL: 'Ventas',
    FINANZAS: 'Finanzas',
  };
  return map[role] ?? role.charAt(0) + role.slice(1).toLowerCase();
}

// ─── Modal: Agregar ítem desde catálogo ────────────────────────────────────────

function AddItemModal({ projectId, existingItemIds, canEdit, initialCategoryId, onClose }: { projectId: string; existingItemIds: Set<string>; canEdit: boolean; initialCategoryId?: string | null; onClose: () => void }) {
  const qc = useQueryClient();
  const [search, setSearch] = useState('');
  const [adding, setAdding] = useState<string | null>(null);
  const [addedIds, setAddedIds] = useState<Set<string>>(new Set());
  // Desde el "+ Agregar" de una sección de la lista llega abierta esa sección.
  const [expandedCats, setExpandedCats] = useState<Set<string>>(
    () => new Set(initialCategoryId ? [initialCategoryId] : []),
  );

  const { data: categories = [] } = useQuery({
    queryKey: ['material-categories', 'true'],
    queryFn: () => getMaterialCategories({ activa: 'true' }),
  });

  const { data: items = [], isLoading } = useQuery({
    queryKey: ['material-items', 'all-active'],
    queryFn: () => getMaterialItems({ activo: 'true' }),
  });

  const filteredItems = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return items;
    return items.filter(it => it.nombre.toLowerCase().includes(q) || (it.descripcion?.toLowerCase().includes(q) ?? false));
  }, [items, search]);

  const itemsByCategory = useMemo(() => {
    const map = new Map<string, MaterialItem[]>();
    for (const it of filteredItems) {
      if (!map.has(it.categoryId)) map.set(it.categoryId, []);
      map.get(it.categoryId)!.push(it);
    }
    return map;
  }, [filteredItems]);

  const effectivelyExpanded = useMemo(() => {
    if (search.trim()) return new Set(categories.map(c => c.id));
    return expandedCats;
  }, [search, expandedCats, categories]);

  function toggleCat(id: string) {
    setExpandedCats(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  async function handleAdd(it: MaterialItem) {
    setAdding(it.id);
    try {
      await createProjectMaterial(projectId, { materialItemId: it.id, quantity: 1 });
      setAddedIds(p => new Set(p).add(it.id));
      qc.invalidateQueries({ queryKey: ['project-materials', projectId] });
    } catch (err) {
      toast.error(getApiErr(err) ?? 'Error al agregar');
    } finally {
      setAdding(null);
    }
  }

  return (
    <div className="fixed inset-0 bg-black/60 z-[60] flex items-center justify-center p-4" onMouseDown={e => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="bg-[var(--color-bg-card)] border border-[var(--color-border)] rounded-xl w-full max-w-2xl max-h-[80vh] flex flex-col shadow-2xl">
        <div className="flex items-center justify-between p-4 border-b border-[var(--color-border)]">
          <p className="text-sm font-semibold text-[var(--color-text-primary)]">Agregar ítem desde catálogo</p>
          <button onClick={onClose} className="text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)]"><X className="w-5 h-5" /></button>
        </div>

        <div className="p-4 border-b border-[var(--color-border)]">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[var(--color-text-muted)]" />
            <input
              autoFocus
              type="text"
              placeholder="Buscar ítems..."
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="w-full pl-9 pr-3 py-2 rounded-lg border border-[var(--color-border)] bg-[var(--color-bg-app)] text-sm text-[var(--color-text-primary)] focus:outline-none focus:ring-2 focus:ring-[var(--color-accent)]"
            />
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-2">
          {isLoading ? (
            <p className="text-sm text-[var(--color-text-muted)] text-center py-8">Cargando catálogo...</p>
          ) : items.length === 0 ? (
            <p className="text-sm text-[var(--color-text-muted)] text-center py-8">No hay ítems en el catálogo. Cargalos desde Admin → Materiales.</p>
          ) : filteredItems.length === 0 ? (
            <p className="text-sm text-[var(--color-text-muted)] text-center py-8">No se encontraron ítems</p>
          ) : (
            <div className="space-y-1">
              {categories.filter(c => itemsByCategory.has(c.id)).map(c => {
                const catItems = itemsByCategory.get(c.id) ?? [];
                const isOpen = effectivelyExpanded.has(c.id);
                return (
                  <div key={c.id} className="rounded-lg border border-[var(--color-border)] overflow-hidden">
                    <button
                      onClick={() => toggleCat(c.id)}
                      className="w-full flex items-center justify-between px-3 py-2 bg-[var(--color-bg-card-hover)] text-left text-sm font-medium text-[var(--color-text-primary)] hover:bg-[var(--color-border)] transition-colors"
                    >
                      {/* El rubro va como contexto: "Eléctrica › Cables". Los
                          ítems cuelgan de la subcategoría, nunca del rubro. */}
                      <span>
                        {c.parentNombre && (
                          <span className="text-[var(--color-text-muted)] font-normal">{c.parentNombre} › </span>
                        )}
                        {c.nombre}
                      </span>
                      <span className="text-xs text-[var(--color-text-muted)] font-mono">{catItems.length} ítem{catItems.length !== 1 ? 's' : ''}</span>
                    </button>
                    {isOpen && (
                      <div className="divide-y divide-[var(--color-border)]">
                        {catItems.map(it => {
                          const already = existingItemIds.has(it.id) || addedIds.has(it.id);
                          return (
                            <div key={it.id} className="flex items-center gap-3 px-3 py-2 bg-[var(--color-bg-card)]">
                              {/* La foto acá es clave: es el momento en que se elige
                                  entre ítems de nombre parecido. */}
                              <MaterialPhotoButton itemId={it.id} nombre={it.nombre} canEdit={canEdit} />
                              <div className="flex-1 min-w-0">
                                <p className="text-sm text-[var(--color-text-primary)] truncate">{it.nombre}</p>
                                <p className="text-xs text-[var(--color-text-muted)]">
                                  {it.unidad}
                                  {it.precioSugerido != null ? ` · ${fmtMoney(it.precioSugerido, it.moneda)}` : ' · sin precio'}
                                  {it.defaultSupplier ? ` · ${it.defaultSupplier.nombre}` : ''}
                                </p>
                              </div>
                              <button
                                onClick={() => handleAdd(it)}
                                disabled={adding === it.id || already}
                                className={klass(
                                  'px-3 py-1 rounded text-xs font-semibold transition-colors',
                                  already
                                    ? 'bg-[var(--color-state-done-bg)] text-[var(--color-state-done-text)] cursor-default'
                                    : 'bg-[var(--color-accent)] text-gray-900 hover:bg-[var(--color-accent-hover)] disabled:opacity-60',
                                )}
                              >
                                {already ? '✓ Agregado' : adding === it.id ? '...' : '+ Agregar'}
                              </button>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>

        <div className="p-3 border-t border-[var(--color-border)] flex justify-end">
          <button onClick={onClose} className="px-4 py-2 rounded-lg bg-[var(--color-accent)] text-gray-900 text-sm font-semibold hover:bg-[var(--color-accent-hover)] transition-colors">
            Listo
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Modal: Aplicar plantilla ──────────────────────────────────────────────────

function ApplyTemplateModal({ projectId, existingCount, onClose }: { projectId: string; existingCount: number; onClose: () => void }) {
  const qc = useQueryClient();
  const [applyingId, setApplyingId] = useState<string | null>(null);

  const { data: templates = [], isLoading } = useQuery({
    queryKey: ['material-templates'],
    queryFn: () => getMaterialTemplates({ activa: 'true' }),
  });

  async function handleApply(templateId: string) {
    setApplyingId(templateId);
    try {
      const res = await applyMaterialTemplate(projectId, templateId);
      await qc.invalidateQueries({ queryKey: ['project-materials', projectId] });
      if (res.agregados === 0) {
        toast(`Todos los ítems de "${res.plantilla}" ya estaban cargados`);
      } else {
        toast.success(
          `${res.agregados} material${res.agregados === 1 ? '' : 'es'} agregado${res.agregados === 1 ? '' : 's'}` +
            (res.salteados > 0 ? ` (${res.salteados} ya estaban)` : ''),
        );
      }
      onClose();
    } catch (err) {
      toast.error(getApiErr(err) ?? 'Error al aplicar la plantilla');
    } finally {
      setApplyingId(null);
    }
  }

  return (
    <div className="fixed inset-0 bg-black/60 z-[60] flex items-center justify-center p-4" onMouseDown={e => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="bg-[var(--color-bg-card)] border border-[var(--color-border)] rounded-xl w-full max-w-lg max-h-[80vh] flex flex-col shadow-2xl">
        <div className="flex items-center justify-between p-4 border-b border-[var(--color-border)]">
          <p className="text-sm font-semibold text-[var(--color-text-primary)]">Usar plantilla de materiales</p>
          <button onClick={onClose} className="text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)]"><X className="w-5 h-5" /></button>
        </div>

        <div className="px-4 py-3 border-b border-[var(--color-border)]">
          <p className="text-xs text-[var(--color-text-muted)]">
            Precarga los materiales que siempre van, con la cantidad en cero para completar. Solo se agregan los que aún no están en la lista
            {existingCount > 0 ? ` (hoy tenés ${existingCount} cargado${existingCount === 1 ? '' : 's'})` : ''}. Lo que dependa de la obra (2P o 4P, 1" o 1¼") se cambia en cada renglón con ⇄.
          </p>
        </div>

        <div className="flex-1 overflow-y-auto p-3 space-y-2">
          {isLoading ? (
            <p className="text-sm text-[var(--color-text-muted)] text-center py-8">Cargando plantillas...</p>
          ) : templates.length === 0 ? (
            <p className="text-sm text-[var(--color-text-muted)] text-center py-8">No hay plantillas activas. Se administran desde Admin → Plantillas de materiales.</p>
          ) : (
            templates.map(t => (
              <div key={t.id} className="flex items-center gap-3 px-3 py-2.5 rounded-lg border border-[var(--color-border)] bg-[var(--color-bg-card)]">
                <LayoutTemplate className="w-4 h-4 text-[var(--color-accent)] shrink-0" />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-[var(--color-text-primary)] truncate">{t.nombre}</p>
                  <p className="text-xs text-[var(--color-text-muted)]">
                    {t.phaseType ? `${PHASE_TYPE_LABELS[t.phaseType]} · ` : ''}{t.itemCount} ítem{t.itemCount === 1 ? '' : 's'}
                  </p>
                </div>
                <button
                  onClick={() => handleApply(t.id)}
                  disabled={applyingId !== null}
                  className="px-3 py-1.5 rounded text-xs font-semibold bg-[var(--color-accent)] text-gray-900 hover:bg-[var(--color-accent-hover)] disabled:opacity-60 shrink-0"
                >
                  {applyingId === t.id ? 'Aplicando…' : 'Aplicar'}
                </button>
              </div>
            ))
          )}
        </div>

        <div className="p-3 border-t border-[var(--color-border)] flex justify-end">
          <button onClick={onClose} className="px-4 py-2 rounded-lg border border-[var(--color-border)] text-[var(--color-text-secondary)] text-sm font-medium hover:bg-[var(--color-bg-card-hover)] transition-colors">
            Cerrar
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Control de costos por categoría (sin IVA) ──────────────────────────────────

function CostBreakdown({ projectId, rows, filtersActive }: { projectId: string; rows: ProjectMaterial[]; filtersActive: boolean }) {
  const storageKey = `materials-costs-collapsed-${projectId}`;
  const [collapsed, setCollapsed] = useState(() => {
    try { return localStorage.getItem(storageKey) === '1'; } catch { return false; }
  });
  function toggleCollapsed() {
    setCollapsed(c => {
      const next = !c;
      try { localStorage.setItem(storageKey, next ? '1' : '0'); } catch { /* ignore */ }
      return next;
    });
  }

  const { byCategory, totals } = useMemo(() => {
    const cats = new Map<string, { nombre: string; orden: number; sums: Record<string, number>; count: number }>();
    const tot: Record<string, number> = {};
    for (const m of rows) {
      const cat = m.materialItem?.category;
      const id = cat?.id ?? '__none__';
      const nombre = cat?.nombre ?? 'Sin categoría';
      const orden = cat?.orden ?? 9999;
      const e = cats.get(id) ?? { nombre, orden, sums: {}, count: 0 };
      e.sums[m.moneda] = (e.sums[m.moneda] ?? 0) + m.subtotal;
      e.count += 1;
      cats.set(id, e);
      tot[m.moneda] = (tot[m.moneda] ?? 0) + m.subtotal;
    }
    return { byCategory: Array.from(cats.values()).sort((a, b) => a.orden - b.orden), totals: tot };
  }, [rows]);

  function fmtSums(sums: Record<string, number>) {
    const parts = Object.entries(sums)
      .filter(([, v]) => v !== 0)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([cur, v]) => fmtMoney(v, cur));
    return parts.length ? parts.join('  +  ') : fmtMoney(0, 'USD');
  }

  return (
    <div className="px-4 py-3 bg-[var(--color-bg-app)]/40 border-b border-[var(--color-border)]">
      <div className="rounded-lg border border-[var(--color-border)] bg-[var(--color-bg-card)] overflow-hidden">
        <button
          type="button"
          onClick={toggleCollapsed}
          className="w-full flex items-center gap-2 px-3 py-2 hover:bg-[var(--color-bg-card-hover)] transition-colors"
        >
          <DollarSign className="w-3.5 h-3.5 text-[var(--color-accent)]" />
          <span className="text-[11px] font-mono uppercase tracking-wider text-[var(--color-text-muted)]">
            Control de costos{filtersActive ? ' (filtrado)' : ''} · sin IVA
          </span>
          <span className="ml-auto text-sm font-bold tabular-nums text-[var(--color-text-primary)]">{fmtSums(totals)}</span>
          <ChevronDown className={klass('w-4 h-4 text-[var(--color-text-muted)] transition-transform', !collapsed && 'rotate-180')} />
        </button>

        {!collapsed && (
          <div className="border-t border-[var(--color-border)] divide-y divide-[var(--color-border)]">
            {byCategory.length === 0 ? (
              <p className="px-3 py-3 text-xs text-[var(--color-text-muted)] text-center">Sin materiales</p>
            ) : (
              byCategory.map((c) => (
                <div key={c.nombre} className="flex items-center gap-3 px-3 py-1.5">
                  <span className="text-xs text-[var(--color-text-secondary)] truncate">{c.nombre}</span>
                  <span className="text-[10px] text-[var(--color-text-muted)] tabular-nums">{c.count}</span>
                  <span className="ml-auto text-xs tabular-nums text-[var(--color-text-primary)]">{fmtSums(c.sums)}</span>
                </div>
              ))
            )}
            <div className="flex items-center gap-3 px-3 py-2 bg-[var(--color-bg-app)]/40">
              <span className="text-xs font-semibold text-[var(--color-text-primary)]">Total{filtersActive ? ' filtrado' : ''}</span>
              <span className="ml-auto text-sm font-bold tabular-nums text-[var(--color-text-primary)]">{fmtSums(totals)}</span>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Componente principal ──────────────────────────────────────────────────────

export function EngineeringMaterials({ projectId }: { projectId: string; plannedWorkStart?: string | null }) {
  const qc = useQueryClient();
  const currentUser = useAuthStore(s => s.user);
  const isAdmin = currentUser?.role === 'ADMIN';

  const canEditIng = usePermission('INGENIERIA', 'EDIT');
  const canEditOps = usePermission('OPERACIONES', 'EDIT');
  const canEdit = canEditIng || canEditOps || isAdmin;
  const canViewCatalog = usePermission('CONFIGURACION', 'VIEW') || isAdmin;

  const [showAdd, setShowAdd] = useState(false);
  const [addCategoryId, setAddCategoryId] = useState<string | null>(null);
  const [showTemplate, setShowTemplate] = useState(false);
  const [pdfLoading, setPdfLoading] = useState(false);
  const [pdfDropOpen, setPdfDropOpen] = useState(false);

  const { state: filterState } = useMaterialsFilters();

  const { data: materials = [], isLoading } = useQuery({
    queryKey: ['project-materials', projectId],
    queryFn: () => getProjectMaterials(projectId),
  });

  const filtered = useMemo(() => applyFilters(materials, filterState), [materials, filterState]);

  // Renglones en cero = "a completar" (los deja la plantilla base). No salen en
  // el PDF, ni en compras, ni en el flujo de fondos hasta que tengan cantidad.
  const zeroCount = useMemo(() => materials.filter(isZero).length, [materials]);
  const removeZeroMut = useMutation({
    mutationFn: () => removeZeroProjectMaterials(projectId),
    onSuccess: (r) => {
      toast.success(`${r.eliminados} material${r.eliminados === 1 ? '' : 'es'} en cero quitado${r.eliminados === 1 ? '' : 's'}`);
      qc.invalidateQueries({ queryKey: ['project-materials', projectId] });
    },
    onError: (err) => toast.error(getApiErr(err) ?? 'No se pudieron quitar'),
  });

  // Metadata para el header
  const categoryCount = useMemo(() => {
    const ids = new Set<string>();
    for (const m of materials) {
      if (m.materialItem?.category?.id) ids.add(m.materialItem.category.id);
    }
    return ids.size;
  }, [materials]);

  const lastEdited = useMemo(() => {
    let best: { at: string; role: string } | null = null;
    for (const m of materials) {
      if (!m.lastEditedAt) continue;
      if (!best || m.lastEditedAt > best.at) {
        best = { at: m.lastEditedAt, role: m.lastEditedRole ?? '' };
      }
    }
    return best;
  }, [materials]);

  async function handleExportPdf(includePrecios: boolean) {
    setPdfDropOpen(false);
    if (
      zeroCount > 0 &&
      !window.confirm(
        `Hay ${zeroCount} material${zeroCount === 1 ? '' : 'es'} sin cantidad. No van a salir en el PDF.\n\n¿Exportar igual?`,
      )
    ) return;
    setPdfLoading(true);
    try {
      await exportMaterialsPdf(projectId, includePrecios);
      toast.success(
        includePrecios
          ? 'PDF con precios generado y guardado en Documentos'
          : 'PDF sin precios generado y guardado en Documentos',
      );
      qc.invalidateQueries({ queryKey: ['project-documents', projectId] });
      qc.invalidateQueries({ queryKey: ['ingenieria-workspace', projectId] });
    } catch (err) {
      toast.error(getApiErr(err) ?? 'Error al generar PDF');
    } finally {
      setPdfLoading(false);
    }
  }

  const existingItemIds = useMemo(() => new Set(materials.map(m => m.materialItemId)), [materials]);

  // Estado colapsable persistido por proyecto en localStorage
  const collapsedKey = `materials-collapsed-${projectId}`;
  const [collapsed, setCollapsed] = useState(() => {
    if (typeof window === 'undefined') return false;
    return window.localStorage.getItem(collapsedKey) === 'true';
  });
  useEffect(() => {
    if (typeof window === 'undefined') return;
    window.localStorage.setItem(collapsedKey, String(collapsed));
  }, [collapsed, collapsedKey]);


  return (
    <section className="rounded-lg border border-[var(--color-border)] bg-[var(--color-bg-card)] overflow-hidden">
      {/* Header */}
      <div className="px-4 py-3 border-b border-[var(--color-border)] flex items-start justify-between gap-3 flex-wrap">
        <div className="min-w-0 flex-1">
          <button
            type="button"
            onClick={() => setCollapsed(c => !c)}
            className="flex items-center gap-1.5 font-mono text-[10px] uppercase tracking-widest text-[var(--color-text-muted)] hover:text-[var(--color-text-secondary)] transition-colors"
            title={collapsed ? 'Expandir' : 'Colapsar'}
          >
            <ChevronDown className={klass('w-3 h-3 transition-transform', collapsed && '-rotate-90')} />
            Lista de materiales
          </button>
          <p className="text-[11px] text-[var(--color-text-muted)] mt-1">
            {materials.length} material{materials.length === 1 ? '' : 'es'}
            {categoryCount > 0 && ` · ${categoryCount} categoría${categoryCount === 1 ? '' : 's'}`}
            {lastEdited && (
              <>
                {' · '}
                <span className="text-[var(--color-text-secondary)]">
                  Última edición {roleLabel(lastEdited.role) || '—'} {formatRelative(lastEdited.at)}
                </span>
              </>
            )}
          </p>
        </div>

        {!collapsed && (
          <div className="flex items-center gap-1.5 flex-wrap">
            {materials.length > 0 && (
              <div className="relative">
                <button
                  onClick={() => setPdfDropOpen(o => !o)}
                  disabled={pdfLoading}
                  className="flex items-center gap-1 text-[11px] px-2.5 py-1.5 rounded-md border border-[var(--color-border)] text-[var(--color-text-secondary)] hover:bg-[var(--color-bg-card-hover)] disabled:opacity-60"
                >
                  <FileText className="w-3 h-3" />
                  {pdfLoading ? 'Generando...' : 'Exportar'}
                  <ChevronDown className="w-3 h-3" />
                </button>
                {pdfDropOpen && (
                  <>
                    <div className="fixed inset-0 z-10" onClick={() => setPdfDropOpen(false)} />
                    <div className="absolute right-0 top-full mt-1 z-20 min-w-[200px] rounded-lg border border-[var(--color-border)] bg-[var(--color-bg-card)] shadow-lg overflow-hidden">
                      <button
                        type="button"
                        onClick={() => handleExportPdf(false)}
                        className="flex w-full items-center gap-2 px-3 py-2 text-left text-[11px] text-[var(--color-text-primary)] hover:bg-[var(--color-bg-card-hover)]"
                      >
                        <FileText className="w-3.5 h-3.5 shrink-0 text-[var(--color-text-muted)]" />
                        <span>
                          <span className="block font-medium">Sin precios</span>
                          <span className="text-[10px] text-[var(--color-text-muted)]">Para proveedores</span>
                        </span>
                      </button>
                      <button
                        type="button"
                        onClick={() => handleExportPdf(true)}
                        className="flex w-full items-center gap-2 px-3 py-2 text-left text-[11px] text-[var(--color-text-primary)] hover:bg-[var(--color-bg-card-hover)]"
                      >
                        <DollarSign className="w-3.5 h-3.5 shrink-0 text-[var(--color-text-muted)]" />
                        <span>
                          <span className="block font-medium">Con precios</span>
                          <span className="text-[10px] text-[var(--color-text-muted)]">Uso interno</span>
                        </span>
                      </button>
                    </div>
                  </>
                )}
              </div>
            )}
            {canEdit && (
              <button
                onClick={() => setShowTemplate(true)}
                className="flex items-center gap-1 text-[11px] px-2.5 py-1.5 rounded-md border border-[var(--color-border)] text-[var(--color-text-secondary)] hover:bg-[var(--color-bg-card-hover)]"
                title="Precargar materiales desde una plantilla"
              >
                <LayoutTemplate className="w-3 h-3" /> Usar plantilla
              </button>
            )}
            {canEdit && (
              <button
                onClick={() => setShowAdd(true)}
                className="flex items-center gap-1 text-[11px] px-3 py-1.5 rounded-md bg-[var(--color-accent)] text-gray-900 font-semibold hover:bg-[var(--color-accent-hover)]"
              >
                <Plus className="w-3 h-3" /> Agregar
              </button>
            )}
          </div>
        )}
      </div>

      {!collapsed && (
        <>
          <MaterialsFilters materials={materials} filtered={filtered} />

          {canEdit && zeroCount > 0 && (
            <div className="mx-4 mt-3 flex items-center gap-2 flex-wrap rounded-lg border border-[var(--color-warning-text)]/40 bg-[var(--color-warning-bg)]/30 px-3 py-2">
              <AlertTriangle className="w-4 h-4 text-[var(--color-warning-text)] shrink-0" />
              <p className="text-xs text-[var(--color-text-primary)] flex-1 min-w-[200px]">
                <strong>{zeroCount}</strong> material{zeroCount === 1 ? '' : 'es'} sin cantidad. Mientras estén en cero no salen en el PDF ni en compras.
              </p>
              <button
                type="button"
                onClick={() => {
                  if (window.confirm(`¿Quitar los ${zeroCount} materiales que quedaron en cero? Se quitan los que no van en esta obra.`)) {
                    removeZeroMut.mutate();
                  }
                }}
                disabled={removeZeroMut.isPending}
                className="text-[11px] px-2.5 py-1 rounded-md border border-[var(--color-border)] text-[var(--color-text-secondary)] hover:bg-[var(--color-bg-card-hover)] disabled:opacity-60"
              >
                {removeZeroMut.isPending ? 'Quitando…' : 'Quitar los que están en cero'}
              </button>
            </div>
          )}

          {materials.length > 0 && (
            <CostBreakdown projectId={projectId} rows={filtered} filtersActive={hasAnyFilter(filterState)} />
          )}

          {/* Tabla */}
          <div className="p-4">
            {isLoading ? (
              <p className="text-xs text-[var(--color-text-muted)] text-center py-6">Cargando...</p>
            ) : materials.length === 0 ? (
              <div className="text-center py-8 rounded-lg border border-dashed border-[var(--color-border)]">
                <p className="text-xs text-[var(--color-text-muted)] mb-2">Sin materiales cargados</p>
                {canEdit && (
                  <div className="flex items-center justify-center gap-3">
                    <button
                      onClick={() => setShowTemplate(true)}
                      className="inline-flex items-center gap-1 text-xs text-[var(--color-accent)] hover:underline"
                    >
                      <LayoutTemplate className="w-3 h-3" /> Usar plantilla
                    </button>
                    <span className="text-[var(--color-text-muted)]">·</span>
                    <button
                      onClick={() => setShowAdd(true)}
                      className="inline-flex items-center gap-1 text-xs text-[var(--color-accent)] hover:underline"
                    >
                      <Plus className="w-3 h-3" /> Agregar primer ítem
                    </button>
                  </div>
                )}
              </div>
            ) : (
              <MaterialsTable
                projectId={projectId}
                rows={filtered}
                canEdit={canEdit}
                canViewCatalog={canViewCatalog}
                existingItemIds={existingItemIds}
                onAddInSection={(categoryId) => { setAddCategoryId(categoryId); setShowAdd(true); }}
              />
            )}
          </div>
        </>
      )}

      {showAdd && (
        <AddItemModal
          projectId={projectId}
          existingItemIds={existingItemIds}
          canEdit={canEdit}
          initialCategoryId={addCategoryId}
          onClose={() => { setShowAdd(false); setAddCategoryId(null); }}
        />
      )}

      {showTemplate && (
        <ApplyTemplateModal
          projectId={projectId}
          existingCount={materials.length}
          onClose={() => setShowTemplate(false)}
        />
      )}

    </section>
  );
}

// Re-export bajo el nombre nuevo para uso desde otros lugares (ej. ProjectDetail
// "Compras"). Internamente es el MISMO componente — UI compartida.
export { EngineeringMaterials as ProjectMaterialsList };

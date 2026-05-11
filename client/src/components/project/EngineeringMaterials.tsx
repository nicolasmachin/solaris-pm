import { useEffect, useMemo, useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'react-hot-toast';
import { ChevronDown, DollarSign, FileText, Plus, RefreshCw, Search, Sparkles, X } from 'lucide-react';
import {
  getProjectMaterials, createProjectMaterial,
  generateProjectPrevistos, regenerateProjectPrevistos, exportMaterialsPdf,
  getMaterialCategories, getMaterialItems, getRegenerateImpact,
} from '../../api/materials.api';
import type { MaterialItem, ProjectMaterial } from '../../types/materials.types';
import { useAuthStore } from '../../store/auth.store';
import { usePermission } from '../../hooks/usePermission';
import { todayLocalISO } from '../../utils/date';

import { MaterialsFilters } from './materials/MaterialsFilters';
import { MaterialsTable } from './materials/MaterialsTable';
import { applyFilters } from './materials/types';
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

// ─── Modal: Confirmar generación de previstos con fecha ───────────────────────

function GeneratePrevistosModal({
  isRegenerate, projectId, pendingCount, expectedDate, onDateChange, onCancel, onConfirm, isLoading,
}: {
  isRegenerate: boolean;
  projectId: string;
  pendingCount: number;
  expectedDate: string;
  onDateChange: (d: string) => void;
  onCancel: () => void;
  onConfirm: () => void;
  isLoading: boolean;
}) {
  const oneYearFromNow = new Date();
  oneYearFromNow.setFullYear(oneYearFromNow.getFullYear() + 1);
  const isFarFuture = expectedDate && new Date(expectedDate) > oneYearFromNow;
  const [showPreserved, setShowPreserved] = useState(false);

  const { data: impact, isLoading: loadingImpact } = useQuery({
    queryKey: ['regenerate-impact', projectId],
    queryFn: () => getRegenerateImpact(projectId),
    enabled: isRegenerate,
    staleTime: 30_000,
  });

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
      <div className="w-full max-w-md rounded-xl border border-[var(--color-border)] bg-[var(--color-bg-card)] shadow-2xl max-h-[90vh] overflow-y-auto">
        <div className="border-b border-[var(--color-border)] px-5 py-4">
          <p className="text-sm font-semibold text-[var(--color-text-primary)]">
            {isRegenerate ? 'Regenerar previstos' : 'Generar previstos'}
          </p>
        </div>
        <div className="px-5 py-4 space-y-4">
          <p className="text-sm text-[var(--color-text-secondary)]">
            {isRegenerate
              ? 'Se va a regenerar la lista de previstos para este proyecto. Se crean agrupados por categoría (un movimiento por categoría con el detalle de los ítems).'
              : `Se crearán movimientos previstos en Finanzas, agrupados por categoría, basados en los materiales de esta lista (${pendingCount} ítem${pendingCount !== 1 ? 's' : ''} pendiente${pendingCount !== 1 ? 's' : ''}).`}
          </p>

          {isRegenerate && (
            <div className="rounded-md border border-[var(--color-border)] bg-[var(--color-bg-app)] px-3 py-2 text-[11px] text-[var(--color-text-secondary)] space-y-1">
              {loadingImpact ? (
                <p>Calculando impacto…</p>
              ) : impact ? (
                <>
                  <p>
                    🗑️ <strong>{impact.toDelete}</strong> movimiento{impact.toDelete !== 1 ? 's' : ''} <em>previsto</em> {impact.toDelete !== 1 ? 'serán eliminados' : 'será eliminado'}.
                  </p>
                  <p>
                    🔒 <strong>{impact.toPreserve}</strong> movimiento{impact.toPreserve !== 1 ? 's' : ''} en estado avanzado (Comprometido / A pagar / Pagado) {impact.toPreserve !== 1 ? 'se conservan' : 'se conserva'} sin tocar.
                    {impact.toPreserve > 0 && (
                      <button
                        type="button"
                        onClick={() => setShowPreserved(v => !v)}
                        className="ml-2 underline text-[var(--color-accent)]"
                      >
                        {showPreserved ? 'Ocultar detalle' : 'Ver detalle'}
                      </button>
                    )}
                  </p>
                  {showPreserved && impact.preservedDetails.length > 0 && (
                    <ul className="mt-1 ml-3 list-disc text-[10px] space-y-0.5">
                      {impact.preservedDetails.map(d => (
                        <li key={d.id}>{d.descripcion} — {fmtMoney(d.monto, d.moneda)}</li>
                      ))}
                    </ul>
                  )}
                </>
              ) : null}
            </div>
          )}

          <div>
            <label className="block text-[11px] font-mono uppercase tracking-wider text-[var(--color-text-muted)] mb-1">
              Fecha esperada de compra
            </label>
            <input
              type="date"
              value={expectedDate}
              onChange={e => onDateChange(e.target.value)}
              className="w-full px-3 py-2 rounded-md border border-[var(--color-border)] bg-[var(--color-bg-app)] text-sm text-[var(--color-text-primary)] focus:outline-none focus:ring-2 focus:ring-[var(--color-accent)]"
            />
            {isFarFuture && (
              <p className="text-[11px] text-[var(--color-warning-text)] mt-1">
                ⚠️ La fecha está a más de un año. ¿Es correcto?
              </p>
            )}
          </div>
        </div>
        <div className="border-t border-[var(--color-border)] px-5 py-3 flex justify-end gap-2">
          <button
            type="button"
            onClick={onCancel}
            disabled={isLoading}
            className="rounded-md border border-[var(--color-border)] px-3 py-1.5 text-sm text-[var(--color-text-secondary)] hover:bg-[var(--color-bg-card-hover)] disabled:opacity-50"
          >
            Cancelar
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={!expectedDate || isLoading}
            className="rounded-md bg-[var(--color-accent)] px-3 py-1.5 text-sm font-semibold text-black hover:opacity-90 disabled:opacity-50"
          >
            {isLoading ? 'Generando...' : (isRegenerate ? 'Regenerar previstos' : 'Generar previstos')}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Modal: Agregar ítem desde catálogo ────────────────────────────────────────

function AddItemModal({ projectId, existingItemIds, onClose }: { projectId: string; existingItemIds: Set<string>; onClose: () => void }) {
  const qc = useQueryClient();
  const [search, setSearch] = useState('');
  const [adding, setAdding] = useState<string | null>(null);
  const [addedIds, setAddedIds] = useState<Set<string>>(new Set());
  const [expandedCats, setExpandedCats] = useState<Set<string>>(new Set());

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
    <div className="fixed inset-0 bg-black/60 z-[60] flex items-center justify-center p-4" onClick={e => { if (e.target === e.currentTarget) onClose(); }}>
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
                      <span>{c.nombre}</span>
                      <span className="text-xs text-[var(--color-text-muted)] font-mono">{catItems.length} ítem{catItems.length !== 1 ? 's' : ''}</span>
                    </button>
                    {isOpen && (
                      <div className="divide-y divide-[var(--color-border)]">
                        {catItems.map(it => {
                          const already = existingItemIds.has(it.id) || addedIds.has(it.id);
                          return (
                            <div key={it.id} className="flex items-center gap-3 px-3 py-2 bg-[var(--color-bg-card)]">
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

// ─── Componente principal ──────────────────────────────────────────────────────

export function EngineeringMaterials({ projectId, plannedWorkStart }: { projectId: string; plannedWorkStart?: string | null }) {
  const qc = useQueryClient();
  const currentUser = useAuthStore(s => s.user);
  const isAdmin = currentUser?.role === 'ADMIN';

  const canEditIng = usePermission('INGENIERIA', 'EDIT');
  const canEditOps = usePermission('OPERACIONES', 'EDIT');
  const canEdit = canEditIng || canEditOps || isAdmin;
  const canGeneratePrevistos = canEditIng || isAdmin;
  const canViewCatalog = usePermission('CONFIGURACION', 'VIEW') || isAdmin;

  const [showAdd, setShowAdd] = useState(false);
  const [showGenerateModal, setShowGenerateModal] = useState(false);
  const [isRegenerateMode, setIsRegenerateMode] = useState(false);
  const [pdfLoading, setPdfLoading] = useState(false);
  const [pdfDropOpen, setPdfDropOpen] = useState(false);

  const { state: filterState } = useMaterialsFilters();

  const { data: materials = [], isLoading } = useQuery({
    queryKey: ['project-materials', projectId],
    queryFn: () => getProjectMaterials(projectId),
  });

  const filtered = useMemo(() => applyFilters(materials, filterState), [materials, filterState]);

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

  // Generación de previstos
  const hasGenerated = materials.some(m => m.movementId);
  const allGenerated = materials.length > 0 && materials.every(m => m.movementId);
  const pendingGeneration = materials.filter(m => !m.movementId).length;

  const todayIso = todayLocalISO();
  const [expectedDate, setExpectedDate] = useState<string>(plannedWorkStart ?? todayIso);

  const generateMut = useMutation({
    mutationFn: (d: string) => generateProjectPrevistos(projectId, d),
    onSuccess: (r) => {
      if (r.created > 0) toast.success(`${r.created} previsto${r.created !== 1 ? 's' : ''} generado${r.created !== 1 ? 's' : ''} en Finanzas`);
      else toast(`Ya hay previstos generados (${r.alreadyExisted})`);
      qc.invalidateQueries({ queryKey: ['project-materials', projectId] });
    },
    onError: (err) => toast.error(getApiErr(err) ?? 'Error al generar previstos'),
  });

  const regenerateMut = useMutation({
    mutationFn: (d: string) => regenerateProjectPrevistos(projectId, d),
    onSuccess: (r) => {
      const parts: string[] = [];
      parts.push(`${r.created} previsto${r.created !== 1 ? 's' : ''} creado${r.created !== 1 ? 's' : ''}`);
      if (r.preservedCount > 0) parts.push(`${r.preservedCount} conservado${r.preservedCount !== 1 ? 's' : ''} sin tocar`);
      toast.success(parts.join(' · '));
      qc.invalidateQueries({ queryKey: ['project-materials', projectId] });
      qc.invalidateQueries({ queryKey: ['regenerate-impact', projectId] });
    },
    onError: (err) => toast.error(getApiErr(err) ?? 'Error al regenerar'),
  });

  function openGenerateModal(regenerate: boolean) {
    if (regenerate && !isAdmin) { toast('Solo un administrador puede regenerar previstos.'); return; }
    setIsRegenerateMode(regenerate);
    setExpectedDate(plannedWorkStart ?? todayIso);
    setShowGenerateModal(true);
  }

  function handleGenerate() {
    if (hasGenerated && pendingGeneration === 0) {
      if (isAdmin) openGenerateModal(true);
      else toast('Solo un administrador puede regenerar previstos.');
      return;
    }
    openGenerateModal(false);
  }

  function submitGenerateModal() {
    if (!expectedDate) { toast.error('Debe especificar la fecha esperada de compra'); return; }
    setShowGenerateModal(false);
    if (isRegenerateMode) regenerateMut.mutate(expectedDate);
    else generateMut.mutate(expectedDate);
  }

  async function handleExportPdf(includePrecios: boolean) {
    setPdfDropOpen(false);
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

  const isWorking = generateMut.isPending || regenerateMut.isPending;

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
            {canGeneratePrevistos && materials.length > 0 && (
              <button
                onClick={handleGenerate}
                disabled={isWorking}
                className="flex items-center gap-1 text-[11px] px-2.5 py-1.5 rounded-md border border-[var(--color-border)] text-[var(--color-text-secondary)] hover:bg-[var(--color-bg-card-hover)] disabled:opacity-60"
                title={allGenerated ? 'Regenerar previstos en Finanzas' : 'Generar previstos en Finanzas'}
              >
                {hasGenerated && allGenerated ? <RefreshCw className={klass('w-3 h-3', isWorking && 'animate-spin')} /> : <Sparkles className="w-3 h-3" />}
                {isWorking ? '…' : (allGenerated ? 'Regenerar' : hasGenerated ? `Generar ${pendingGeneration} más` : 'Generar previstos')}
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

          {/* Tabla */}
          <div className="p-4">
            {isLoading ? (
              <p className="text-xs text-[var(--color-text-muted)] text-center py-6">Cargando...</p>
            ) : materials.length === 0 ? (
              <div className="text-center py-8 rounded-lg border border-dashed border-[var(--color-border)]">
                <p className="text-xs text-[var(--color-text-muted)] mb-2">Sin materiales cargados</p>
                {canEdit && (
                  <button
                    onClick={() => setShowAdd(true)}
                    className="inline-flex items-center gap-1 text-xs text-[var(--color-accent)] hover:underline"
                  >
                    <Plus className="w-3 h-3" /> Agregar primer ítem
                  </button>
                )}
              </div>
            ) : (
              <MaterialsTable
                projectId={projectId}
                rows={filtered}
                canEdit={canEdit}
                canViewCatalog={canViewCatalog}
              />
            )}
          </div>
        </>
      )}

      {showAdd && (
        <AddItemModal
          projectId={projectId}
          existingItemIds={existingItemIds}
          onClose={() => setShowAdd(false)}
        />
      )}

      {showGenerateModal && (
        <GeneratePrevistosModal
          isRegenerate={isRegenerateMode}
          projectId={projectId}
          pendingCount={isRegenerateMode ? materials.filter(m => m.movementId).length : pendingGeneration}
          expectedDate={expectedDate}
          onDateChange={setExpectedDate}
          onCancel={() => setShowGenerateModal(false)}
          onConfirm={submitGenerateModal}
          isLoading={generateMut.isPending || regenerateMut.isPending}
        />
      )}
    </section>
  );
}

// Re-export bajo el nombre nuevo para uso desde otros lugares (ej. ProjectDetail
// "Compras"). Internamente es el MISMO componente — UI compartida.
export { EngineeringMaterials as ProjectMaterialsList };

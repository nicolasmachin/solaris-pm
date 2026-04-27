import { Fragment, useEffect, useMemo, useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'react-hot-toast';
import { Plus, X, Search, Sparkles, RefreshCw, Trash2, StickyNote, FileText, DollarSign, ChevronDown } from 'lucide-react';
import {
  getProjectMaterials, createProjectMaterial, patchProjectMaterial, deleteProjectMaterial,
  generateProjectPrevistos, regenerateProjectPrevistos, exportMaterialsPdf,
  getMaterialCategories, getMaterialItems,
} from '../../api/materials.api';
import { getSuppliers } from '../../api/finance.api';
import type { MaterialItem, ProjectMaterial } from '../../types/materials.types';
import { useAuthStore } from '../../store/auth.store';

function klass(...p: (string | false | undefined)[]) { return p.filter(Boolean).join(' '); }

function getApiErr(err: unknown) {
  return (err as { response?: { data?: { message?: string } } })?.response?.data?.message;
}

function fmtMoney(n: number, moneda: string) {
  return `${n.toLocaleString('es-UY', { minimumFractionDigits: 2 })} ${moneda}`;
}

const STATUS_LABEL: Record<string, string> = {
  PREVISTO: 'Previsto',
  COMPROMETIDO: 'Comprometido',
  A_PAGAR: 'A pagar',
  PAGADO: 'Pagado',
};

const STATUS_COLOR: Record<string, string> = {
  PREVISTO: 'bg-[var(--color-border)] text-[var(--color-text-muted)]',
  COMPROMETIDO: 'bg-[var(--color-info-bg)] text-[var(--color-info-text)]',
  A_PAGAR: 'bg-[var(--color-warning-bg)] text-[var(--color-warning-text)]',
  PAGADO: 'bg-[var(--color-state-done-bg)] text-[var(--color-state-done-text)]',
};

// ─── Modal: Agregar ítem desde catálogo ────────────────────────────────────────

// ─── Modal: Confirmar generación de previstos con fecha ───────────────────────

function GeneratePrevistosModal({
  isRegenerate, pendingCount, expectedDate, onDateChange, onCancel, onConfirm, isLoading,
}: {
  isRegenerate: boolean;
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

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
      <div className="w-full max-w-sm rounded-xl border border-[var(--color-border)] bg-[var(--color-bg-card)] shadow-2xl">
        <div className="border-b border-[var(--color-border)] px-5 py-4">
          <p className="text-sm font-semibold text-[var(--color-text-primary)]">
            {isRegenerate ? 'Regenerar previstos' : 'Generar previstos'}
          </p>
        </div>
        <div className="px-5 py-4 space-y-4">
          <p className="text-sm text-[var(--color-text-secondary)]">
            {isRegenerate
              ? `Se eliminarán los previstos actuales y se crearán ${pendingCount} nuevo${pendingCount !== 1 ? 's' : ''} en Finanzas basados en la lista actual.`
              : `Se crearán ${pendingCount} movimiento${pendingCount !== 1 ? 's' : ''} previsto${pendingCount !== 1 ? 's' : ''} en Finanzas basados en los materiales de esta lista.`}
          </p>
          <div>
            <label className="mb-1.5 flex items-center gap-1 text-[11px] font-medium text-[var(--color-text-primary)]">
              Fecha esperada de compra
              <span className="text-red-500">*</span>
            </label>
            <input
              type="date"
              value={expectedDate}
              onChange={(e) => onDateChange(e.target.value)}
              required
              className="w-full rounded-md border border-[var(--color-border)] bg-[var(--color-bg-app)] px-3 py-2 text-sm text-[var(--color-text-primary)] focus:border-[var(--color-accent)] focus:outline-none"
            />
            <p className="mt-1.5 text-[11px] text-[var(--color-text-muted)]">
              Se aplicará a todos los previstos generados
            </p>
            {isFarFuture && (
              <p className="mt-1.5 text-[11px] text-amber-600 dark:text-amber-400">
                ⚠ La fecha está muy lejana, ¿es correcto?
              </p>
            )}
          </div>
        </div>
        <div className="flex justify-end gap-2 border-t border-[var(--color-border)] px-5 py-3">
          <button
            type="button"
            onClick={onCancel}
            className="rounded-md border border-[var(--color-border)] px-3 py-1.5 text-sm text-[var(--color-text-secondary)] hover:bg-[var(--color-bg-app)]"
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

  // Auto-expand categorías cuando hay búsqueda
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

  // Expandir todas si hay búsqueda
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

// ─── Fila de material editable inline ──────────────────────────────────────────

function MaterialRow({ projectId, pm, suppliers }: {
  projectId: string;
  pm: ProjectMaterial;
  suppliers: { id: string; nombre: string }[];
}) {
  const qc = useQueryClient();
  const [qty, setQty] = useState(pm.quantity.toString());
  const [price, setPrice] = useState(pm.unitPrice.toString());
  const [supplierId, setSupplierId] = useState(pm.supplierId ?? '');
  const [showNotes, setShowNotes] = useState(false);
  const [notes, setNotes] = useState(pm.notes ?? '');

  // Sincronizar valores externos cuando cambien
  useEffect(() => { setQty(pm.quantity.toString()); }, [pm.quantity]);
  useEffect(() => { setPrice(pm.unitPrice.toString()); }, [pm.unitPrice]);
  useEffect(() => { setSupplierId(pm.supplierId ?? ''); }, [pm.supplierId]);
  useEffect(() => { setNotes(pm.notes ?? ''); }, [pm.notes]);

  const patchMut = useMutation({
    mutationFn: (body: Partial<{ quantity: number; unitPrice: number; supplierId: string | null; notes: string | null }>) =>
      patchProjectMaterial(projectId, pm.id, body),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['project-materials', projectId] }),
    onError: (err) => toast.error(getApiErr(err) ?? 'Error al actualizar'),
  });

  const deleteMut = useMutation({
    mutationFn: () => deleteProjectMaterial(projectId, pm.id),
    onSuccess: (r) => {
      toast.success(r.previstoEliminado ? 'Material eliminado (previsto en Finanzas también eliminado)' : 'Material eliminado');
      qc.invalidateQueries({ queryKey: ['project-materials', projectId] });
      qc.invalidateQueries({ queryKey: ['finance-movements'] });
    },
    onError: (err) => toast.error(getApiErr(err) ?? 'Error al eliminar'),
  });

  function commitQty() {
    const n = parseInt(qty, 10);
    if (!isFinite(n) || n <= 0) { setQty(pm.quantity.toString()); return; }
    if (n !== pm.quantity) patchMut.mutate({ quantity: n });
  }
  function commitPrice() {
    const n = parseFloat(price);
    if (!isFinite(n) || n < 0) { setPrice(pm.unitPrice.toString()); return; }
    if (n !== pm.unitPrice) patchMut.mutate({ unitPrice: n });
  }
  function commitSupplier(v: string) {
    setSupplierId(v);
    patchMut.mutate({ supplierId: v || null });
  }
  function commitNotes() {
    if (notes !== (pm.notes ?? '')) patchMut.mutate({ notes: notes || null });
    setShowNotes(false);
  }

  const subtotal = pm.subtotal;
  const movementStatus = pm.movement?.status;

  return (
    <>
      <tr className="hover:bg-[var(--color-bg-card-hover)] transition-colors">
        <td className="px-3 py-2 text-sm text-[var(--color-text-primary)]">
          <div className="font-medium">{pm.materialItem?.nombre ?? '—'}</div>
          {movementStatus && (
            <span className={klass('text-[9px] font-mono px-1.5 py-0.5 rounded uppercase mt-1 inline-block', STATUS_COLOR[movementStatus] ?? '')}>
              {STATUS_LABEL[movementStatus] ?? movementStatus}
            </span>
          )}
        </td>
        <td className="px-2 py-2">
          <div className="flex items-center gap-1.5">
            <button
              title="Eliminar material"
              onClick={() => deleteMut.mutate()}
              disabled={deleteMut.isPending}
              className="p-1 rounded hover:bg-red-500/15 text-red-500 hover:text-red-700 disabled:opacity-50 transition-colors flex-shrink-0"
              aria-label="Eliminar material"
            >
              <Trash2 className="w-4 h-4" />
            </button>
            <input
              type="number" min="1" step="1"
              className="w-20 px-2 py-1 rounded text-xs bg-[var(--color-bg-app)] border border-[var(--color-border)] text-[var(--color-text-primary)] tabular-nums focus:outline-none focus:ring-1 focus:ring-[var(--color-accent)]"
              value={qty}
              onChange={e => setQty(e.target.value)}
              onBlur={commitQty}
              onKeyDown={e => { if (e.key === 'Enter') (e.target as HTMLInputElement).blur(); }}
            />
            <span className="text-[10px] text-[var(--color-text-muted)]">{pm.materialItem?.unidad}</span>
          </div>
        </td>
        <td className="px-2 py-2">
          <div className="flex items-center gap-1">
            <input
              type="number" min="0" step="0.01"
              className="w-24 px-2 py-1 rounded text-xs bg-[var(--color-bg-app)] border border-[var(--color-border)] text-[var(--color-text-primary)] tabular-nums focus:outline-none focus:ring-1 focus:ring-[var(--color-accent)]"
              value={price}
              onChange={e => setPrice(e.target.value)}
              onBlur={commitPrice}
              onKeyDown={e => { if (e.key === 'Enter') (e.target as HTMLInputElement).blur(); }}
            />
            <span className="text-[10px] text-[var(--color-text-muted)]">{pm.moneda}</span>
          </div>
        </td>
        <td className="px-2 py-2">
          <select
            className="w-full max-w-[140px] px-2 py-1 rounded text-xs bg-[var(--color-bg-app)] border border-[var(--color-border)] text-[var(--color-text-primary)] focus:outline-none focus:ring-1 focus:ring-[var(--color-accent)]"
            value={supplierId}
            onChange={e => commitSupplier(e.target.value)}
          >
            <option value="">— sin —</option>
            {suppliers.map(s => <option key={s.id} value={s.id}>{s.nombre}</option>)}
          </select>
        </td>
        <td className="px-2 py-2 text-sm font-semibold text-[var(--color-text-primary)] tabular-nums whitespace-nowrap">
          {fmtMoney(subtotal, pm.moneda)}
        </td>
        <td className="px-2 py-2">
          <button
            title={pm.notes ? 'Editar nota' : 'Agregar nota'}
            onClick={() => setShowNotes(v => !v)}
            className={klass(
              'p-1 rounded hover:bg-[var(--color-border)]',
              pm.notes ? 'text-[var(--color-accent)]' : 'text-[var(--color-text-muted)]',
            )}
          >
            <StickyNote className="w-3.5 h-3.5" />
          </button>
        </td>
      </tr>
      {showNotes && (
        <tr>
          <td colSpan={6} className="px-3 py-2 bg-[var(--color-bg-app)]">
            <div className="flex items-start gap-2">
              <textarea
                className="flex-1 px-2 py-1 rounded text-xs bg-[var(--color-bg-card)] border border-[var(--color-border)] text-[var(--color-text-primary)] focus:outline-none focus:ring-1 focus:ring-[var(--color-accent)] resize-none"
                rows={2}
                placeholder="Nota sobre este material..."
                value={notes}
                onChange={e => setNotes(e.target.value)}
              />
              <button onClick={commitNotes} className="px-2 py-1 rounded bg-[var(--color-accent)] text-gray-900 text-xs font-semibold hover:bg-[var(--color-accent-hover)]">
                OK
              </button>
            </div>
          </td>
        </tr>
      )}
    </>
  );
}

// ─── Componente principal ──────────────────────────────────────────────────────

export function EngineeringMaterials({ projectId, plannedWorkStart }: { projectId: string; plannedWorkStart?: string | null }) {
  const qc = useQueryClient();
  const currentUser = useAuthStore(s => s.user);
  const isAdmin = currentUser?.role === 'ADMIN';
  const [showAdd, setShowAdd] = useState(false);

  const { data: materials = [], isLoading } = useQuery({
    queryKey: ['project-materials', projectId],
    queryFn: () => getProjectMaterials(projectId),
  });

  const { data: suppliers = [] } = useQuery({
    queryKey: ['suppliers', 'true'],
    queryFn: () => getSuppliers({ activo: 'true' }),
  });

  const generatedAt = useMemo(() => {
    const withMov = materials.filter(m => m.movementId);
    if (withMov.length === 0) return null;
    // El generatedAt no lo guardamos en DB; aproximamos con el updatedAt del primer material vinculado
    return withMov[0].updatedAt;
  }, [materials]);

  const hasGenerated = materials.some(m => m.movementId);
  const allGenerated = materials.length > 0 && materials.every(m => m.movementId);
  const pendingGeneration = materials.filter(m => !m.movementId).length;

  // Agrupar por categoría
  const groups = useMemo(() => {
    const map = new Map<string, { nombre: string; orden: number; items: ProjectMaterial[]; subtotal: number; moneda: string }>();
    for (const pm of materials) {
      const cat = pm.materialItem?.category;
      const key = cat?.id ?? 'sin-cat';
      const nombre = cat?.nombre ?? 'Sin categoría';
      const orden = cat?.orden ?? 9999;
      if (!map.has(key)) map.set(key, { nombre, orden, items: [], subtotal: 0, moneda: pm.moneda });
      const g = map.get(key)!;
      g.items.push(pm);
      g.subtotal += pm.subtotal;
    }
    return Array.from(map.values()).sort((a, b) => a.orden - b.orden);
  }, [materials]);

  // Total — si hay mezcla de monedas, se muestra desglosado
  const totalsByMoneda = useMemo(() => {
    const m: Record<string, number> = {};
    for (const pm of materials) m[pm.moneda] = (m[pm.moneda] ?? 0) + pm.subtotal;
    return m;
  }, [materials]);

  const generateMut = useMutation({
    mutationFn: (expectedDate: string) => generateProjectPrevistos(projectId, expectedDate),
    onSuccess: (r) => {
      if (r.created > 0) toast.success(`${r.created} previsto${r.created !== 1 ? 's' : ''} generado${r.created !== 1 ? 's' : ''} en Finanzas`);
      else toast(`Ya hay previstos generados (${r.alreadyExisted})`);
      qc.invalidateQueries({ queryKey: ['project-materials', projectId] });
    },
    onError: (err) => toast.error(getApiErr(err) ?? 'Error al generar previstos'),
  });

  const regenerateMut = useMutation({
    mutationFn: (expectedDate: string) => regenerateProjectPrevistos(projectId, expectedDate),
    onSuccess: (r) => {
      toast.success(`Previstos regenerados (${r.regenerated} eliminados, ${r.created} nuevos)`);
      qc.invalidateQueries({ queryKey: ['project-materials', projectId] });
    },
    onError: (err) => toast.error(getApiErr(err) ?? 'Error al regenerar'),
  });

  const todayIso = new Date().toISOString().slice(0, 10);
  const [showGenerateModal, setShowGenerateModal] = useState(false);
  const [isRegenerateMode, setIsRegenerateMode] = useState(false);
  const [expectedDate, setExpectedDate] = useState<string>(plannedWorkStart ?? todayIso);

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

  function handleRegenerate() {
    openGenerateModal(true);
  }

  function submitGenerateModal() {
    if (!expectedDate) { toast.error('Debe especificar la fecha esperada de compra'); return; }
    setShowGenerateModal(false);
    if (isRegenerateMode) regenerateMut.mutate(expectedDate);
    else generateMut.mutate(expectedDate);
  }

  const existingItemIds = useMemo(() => new Set(materials.map(m => m.materialItemId)), [materials]);
  const [pdfLoading, setPdfLoading] = useState(false);
  const [pdfDropOpen, setPdfDropOpen] = useState(false);

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
    } catch (err) {
      toast.error(getApiErr(err) ?? 'Error al generar PDF');
    } finally {
      setPdfLoading(false);
    }
  }

  const isWorking = generateMut.isPending || regenerateMut.isPending;

  return (
    <section>
      <div className="flex items-center justify-between mb-3">
        <p className="font-mono text-[9px] uppercase tracking-widest text-[var(--color-text-muted)]">
          Lista de materiales ({materials.length})
        </p>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowAdd(true)}
            className="text-[10px] text-[var(--color-accent)] hover:underline"
          >
            + Agregar ítem
          </button>
          {materials.length > 0 && (
            <>
              <div className="relative">
                <button
                  onClick={() => setPdfDropOpen(o => !o)}
                  disabled={pdfLoading}
                  title="Exportar lista de materiales como PDF"
                  className="flex items-center gap-1 text-[10px] px-2 py-1 rounded border border-[var(--color-border)] text-[var(--color-text-secondary)] hover:bg-[var(--color-bg-card-hover)] disabled:opacity-60"
                >
                  <FileText className="w-3 h-3" />
                  {pdfLoading ? 'Generando...' : 'Exportar PDF'}
                  <ChevronDown className="w-3 h-3 ml-0.5" />
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
              <button
                onClick={handleGenerate}
                disabled={isWorking}
                className="flex items-center gap-1 text-[10px] px-2 py-1 rounded bg-[var(--color-accent)] text-gray-900 font-semibold hover:bg-[var(--color-accent-hover)] disabled:opacity-60"
              >
                <Sparkles className="w-3 h-3" />
                {isWorking ? 'Procesando...' : (allGenerated ? 'Ya generado' : (hasGenerated ? `Generar ${pendingGeneration} faltante${pendingGeneration !== 1 ? 's' : ''}` : 'Generar previstos'))}
              </button>
            </>
          )}
        </div>
      </div>

      {hasGenerated && generatedAt && (
        <div className="flex items-center gap-2 mb-3 px-3 py-2 rounded-lg bg-[var(--color-info-bg)]/50 border border-[var(--color-info-bg)]">
          <span className="text-[10px] font-mono uppercase text-[var(--color-info-text)]">Previstos generados</span>
          <span className="text-[10px] text-[var(--color-text-muted)]">
            última actualización {new Date(generatedAt).toLocaleDateString('es-UY')}
          </span>
          {isAdmin && (
            <button onClick={handleRegenerate} disabled={isWorking} className="ml-auto flex items-center gap-1 text-[10px] text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)] disabled:opacity-60">
              <RefreshCw className={klass('w-3 h-3', isWorking && 'animate-spin')} />
              Regenerar
            </button>
          )}
        </div>
      )}

      {isLoading ? (
        <p className="text-xs text-[var(--color-text-muted)] text-center py-6">Cargando...</p>
      ) : materials.length === 0 ? (
        <div className="text-center py-6 rounded-lg border border-dashed border-[var(--color-border)]">
          <p className="text-xs text-[var(--color-text-muted)] mb-2">Sin materiales cargados</p>
          <button
            onClick={() => setShowAdd(true)}
            className="inline-flex items-center gap-1 text-xs text-[var(--color-accent)] hover:underline"
          >
            <Plus className="w-3 h-3" /> Agregar primer ítem
          </button>
        </div>
      ) : (
        <div className="rounded-lg border border-[var(--color-border)] overflow-hidden">
          <table className="w-full text-xs">
            <thead>
              <tr className="bg-[var(--color-bg-card-hover)] text-[10px] font-mono uppercase tracking-wider text-[var(--color-text-muted)]">
                <th className="px-3 py-2 text-left font-medium">Ítem</th>
                <th className="px-2 py-2 text-left font-medium">Cant.</th>
                <th className="px-2 py-2 text-left font-medium">Precio</th>
                <th className="px-2 py-2 text-left font-medium">Proveedor</th>
                <th className="px-2 py-2 text-left font-medium">Subtotal</th>
                <th className="px-2 py-2 w-16" />
              </tr>
            </thead>
            <tbody>
              {groups.map(g => (
                <Fragment key={g.nombre}>
                  <tr className="bg-[var(--color-bg-app)]">
                    <td colSpan={4} className="px-3 py-1.5 text-[11px] font-semibold text-[var(--color-text-secondary)]">
                      {g.nombre}
                    </td>
                    <td className="px-2 py-1.5 text-[11px] font-semibold text-[var(--color-text-secondary)] tabular-nums">
                      {fmtMoney(g.subtotal, g.moneda)}
                    </td>
                    <td className="px-2 py-1.5" />
                  </tr>
                  {g.items.map(pm => (
                    <MaterialRow key={pm.id} projectId={projectId} pm={pm} suppliers={suppliers} />
                  ))}
                </Fragment>
              ))}
            </tbody>
            <tfoot>
              <tr className="border-t border-[var(--color-border)] bg-[var(--color-bg-card-hover)]">
                <td colSpan={4} className="px-3 py-2 text-[11px] font-semibold text-[var(--color-text-primary)] uppercase font-mono">Total estimado</td>
                <td colSpan={2} className="px-2 py-2 text-sm font-bold text-[var(--color-text-primary)] tabular-nums">
                  {Object.entries(totalsByMoneda).map(([m, v]) => fmtMoney(v, m)).join(' · ')}
                </td>
              </tr>
            </tfoot>
          </table>
        </div>
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

import { useEffect, useMemo, useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'react-hot-toast';
import { X, Search, Plus, Trash2, AlertTriangle, CheckCircle2 } from 'lucide-react';
import {
  getInvoiceItems, createInvoiceItem, patchInvoiceItem, deleteInvoiceItem,
  confirmInvoiceItems, markNoMateriales,
} from '../../api/finance.api';
import { getMaterialCategories } from '../../api/materials.api';
import { getStockProducts } from '../../api/stock.api';
import { fmtCurrency } from '../../lib/finance';
import type { InvoiceItem } from '../../api/finance.api';
import type { StockProduct } from '../../types/finance.types';

function klass(...p: (string | false | undefined)[]) { return p.filter(Boolean).join(' '); }

function getApiErr(err: unknown) {
  return (err as { response?: { data?: { message?: string } } })?.response?.data?.message;
}

interface Props {
  movementId: string;
  onClose: () => void;
}

export function InvoiceItemsDetail({ movementId, onClose }: Props) {
  const qc = useQueryClient();
  const [showAdd, setShowAdd] = useState(false);

  const { data, isLoading, refetch } = useQuery({
    queryKey: ['invoice-items', movementId],
    queryFn: () => getInvoiceItems(movementId),
  });

  const noMatMut = useMutation({
    mutationFn: () => markNoMateriales(movementId),
    onSuccess: () => {
      toast.success('Movimiento marcado como sin materiales');
      qc.invalidateQueries({ queryKey: ['invoice-items', movementId] });
      qc.invalidateQueries({ queryKey: ['finance-movements'] });
      qc.invalidateQueries({ queryKey: ['pending-detail'] });
      onClose();
    },
    onError: (err: unknown) => toast.error(getApiErr(err) ?? 'Error al marcar como sin materiales'),
  });

  const confirmMut = useMutation({
    mutationFn: () => confirmInvoiceItems(movementId),
    onSuccess: (r) => {
      toast.success(`Desglose confirmado · ${r.itemsCount} ítem(s) ingresaron al stock`);
      qc.invalidateQueries({ queryKey: ['invoice-items', movementId] });
      qc.invalidateQueries({ queryKey: ['finance-movements'] });
      qc.invalidateQueries({ queryKey: ['pending-detail'] });
      qc.invalidateQueries({ queryKey: ['stock-products'] });
      qc.invalidateQueries({ queryKey: ['stock-alerts'] });
      qc.invalidateQueries({ queryKey: ['stock-movements-recent'] });
      onClose();
    },
    onError: (err: unknown) => toast.error(getApiErr(err) ?? 'Error al confirmar desglose'),
  });

  if (isLoading || !data) {
    return (
      <div className="fixed inset-0 bg-black/60 z-[60] flex items-center justify-center p-4" onClick={e => { if (e.target === e.currentTarget) onClose(); }}>
        <div className="bg-[var(--color-bg-card)] border border-[var(--color-border)] rounded-xl w-full max-w-3xl p-6">
          <p className="text-sm text-[var(--color-text-muted)] text-center">Cargando…</p>
        </div>
      </div>
    );
  }

  const { movement, items, totalItems, diff, matches } = data;
  const noMaterialesActive = movement.noTieneMateriales;
  const confirmed = movement.hasItemDetail && !movement.noTieneMateriales;

  return (
    <div className="fixed inset-0 bg-black/60 z-[60] flex items-center justify-center p-4" onClick={e => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="bg-[var(--color-bg-card)] border border-[var(--color-border)] rounded-xl w-full max-w-3xl max-h-[90vh] flex flex-col shadow-2xl">
        {/* Header */}
        <div className="flex items-start justify-between p-4 border-b border-[var(--color-border)]">
          <div>
            <p className="text-sm font-semibold text-[var(--color-text-primary)]">Desglose de factura</p>
            <p className="text-xs text-[var(--color-text-muted)] mt-0.5">
              Total objetivo: <span className="font-semibold text-[var(--color-text-primary)] tabular-nums">{fmtCurrency(movement.monto, movement.moneda)}</span>
            </p>
          </div>
          <button onClick={onClose} className="text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)]"><X className="w-5 h-5" /></button>
        </div>

        {/* Toggle "sin materiales" / Estado confirmado */}
        <div className="px-4 py-3 border-b border-[var(--color-border)] bg-[var(--color-bg-app)]/50">
          {confirmed ? (
            <div className="flex items-center gap-2 text-sm text-[var(--color-state-done-text)]">
              <CheckCircle2 className="w-4 h-4" />
              <span className="font-semibold">Desglose confirmado.</span>
              <span className="text-[var(--color-text-muted)]">{items.length} ítem(s) ingresaron al stock.</span>
            </div>
          ) : noMaterialesActive ? (
            <div className="flex items-center gap-2 text-sm text-[var(--color-text-secondary)]">
              <CheckCircle2 className="w-4 h-4 text-[var(--color-text-muted)]" />
              Marcado como factura sin materiales. Esta compra no impactará en el stock.
            </div>
          ) : (
            <label className="flex items-center gap-2 text-sm text-[var(--color-text-secondary)] cursor-pointer">
              <input
                type="checkbox"
                checked={false}
                disabled={items.length > 0 || noMatMut.isPending}
                onChange={() => {
                  if (items.length > 0) {
                    toast.error('Eliminá los ítems cargados antes de marcar como sin materiales');
                    return;
                  }
                  if (confirm('¿Marcar esta factura como sin materiales? No impactará en el stock.')) {
                    noMatMut.mutate();
                  }
                }}
              />
              Esta factura no tiene materiales (servicios, mano de obra, etc.)
            </label>
          )}
        </div>

        {/* Body */}
        {!noMaterialesActive && (
          <div className="flex-1 overflow-y-auto p-3">
            {items.length === 0 && !showAdd ? (
              <div className="text-center py-10 rounded-lg border border-dashed border-[var(--color-border)]">
                <p className="text-sm text-[var(--color-text-muted)] mb-3">Sin ítems cargados</p>
                {!confirmed && (
                  <button
                    onClick={() => setShowAdd(true)}
                    className="inline-flex items-center gap-1 text-sm text-[var(--color-accent)] hover:underline"
                  >
                    <Plus className="w-3.5 h-3.5" /> Agregar primer ítem
                  </button>
                )}
              </div>
            ) : (
              <div className="rounded-lg border border-[var(--color-border)] overflow-hidden">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="bg-[var(--color-bg-card-hover)] text-[10px] font-mono uppercase tracking-wider text-[var(--color-text-muted)]">
                      <th className="px-3 py-2 text-left font-medium">Ítem</th>
                      <th className="px-2 py-2 text-left font-medium w-24">Cantidad</th>
                      <th className="px-2 py-2 text-left font-medium w-32">Precio unit.</th>
                      <th className="px-2 py-2 text-right font-medium w-32">Subtotal</th>
                      {!confirmed && <th className="px-2 py-2 w-10" />}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[var(--color-border)]">
                    {items.map(it => (
                      <ItemRow key={it.id} movementId={movementId} item={it} moneda={movement.moneda} confirmed={confirmed} onChanged={refetch} />
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            {!confirmed && items.length > 0 && (
              <div className="mt-3 flex justify-end">
                <button
                  onClick={() => setShowAdd(true)}
                  className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg bg-[var(--color-bg-app)] border border-[var(--color-border)] text-sm text-[var(--color-text-secondary)] hover:bg-[var(--color-bg-card-hover)]"
                >
                  <Plus className="w-3.5 h-3.5" /> Agregar producto
                </button>
              </div>
            )}
          </div>
        )}

        {/* Footer con totales y confirmar */}
        {!noMaterialesActive && !confirmed && (
          <div className="px-4 py-3 border-t border-[var(--color-border)] flex items-center justify-between flex-wrap gap-3">
            <div className="text-sm">
              <span className="text-[var(--color-text-muted)]">Total ítems:</span>
              <span className="ml-2 font-semibold text-[var(--color-text-primary)] tabular-nums">{fmtCurrency(totalItems, movement.moneda)}</span>
              <span className="ml-3 text-[var(--color-text-muted)]">Diferencia:</span>
              <span className={klass(
                'ml-2 font-semibold tabular-nums',
                matches ? 'text-[var(--color-state-done-text)]' : 'text-red-400',
              )}>
                {diff > 0 ? '+' : ''}{fmtCurrency(diff, movement.moneda)}
                {!matches && (
                  <AlertTriangle className="w-3.5 h-3.5 inline ml-1 mb-0.5" />
                )}
              </span>
            </div>
            <button
              onClick={() => confirmMut.mutate()}
              disabled={!matches || items.length === 0 || confirmMut.isPending}
              className={klass(
                'px-4 py-2 rounded-lg text-sm font-semibold transition-colors',
                matches && items.length > 0 && !confirmMut.isPending
                  ? 'bg-[var(--color-accent)] text-gray-900 hover:bg-[var(--color-accent-hover)]'
                  : 'bg-[var(--color-border)] text-[var(--color-text-muted)] cursor-not-allowed',
              )}
              title={!matches ? 'La suma de ítems debe coincidir con el monto del movimiento' : undefined}
            >
              {confirmMut.isPending ? 'Confirmando…' : 'Confirmar desglose'}
            </button>
          </div>
        )}

        {/* Footer cuando ya está confirmado o sin materiales */}
        {(confirmed || noMaterialesActive) && (
          <div className="px-4 py-3 border-t border-[var(--color-border)] flex justify-end">
            <button onClick={onClose} className="px-4 py-2 rounded-lg bg-[var(--color-accent)] text-gray-900 text-sm font-semibold hover:bg-[var(--color-accent-hover)]">
              Cerrar
            </button>
          </div>
        )}

        {/* Modal sub-modal: agregar producto */}
        {showAdd && !confirmed && !noMaterialesActive && (
          <AddItemPicker
            movementId={movementId}
            existingIds={new Set(items.map(i => i.materialItemId))}
            moneda={movement.moneda}
            onClose={() => { setShowAdd(false); refetch(); }}
          />
        )}
      </div>
    </div>
  );
}

// ─── Fila editable ─────────────────────────────────────────────────────────────

function ItemRow({ movementId, item, moneda, confirmed, onChanged }: {
  movementId: string;
  item: InvoiceItem;
  moneda: 'USD' | 'UYU';
  confirmed: boolean;
  onChanged: () => void;
}) {
  const qc = useQueryClient();
  const [qty, setQty] = useState(item.quantity.toString());
  const [price, setPrice] = useState(item.unitPrice.toString());

  useEffect(() => { setQty(item.quantity.toString()); }, [item.quantity]);
  useEffect(() => { setPrice(item.unitPrice.toString()); }, [item.unitPrice]);

  const patchMut = useMutation({
    mutationFn: (body: Partial<{ quantity: number; unitPrice: number }>) =>
      patchInvoiceItem(movementId, item.id, body),
    onSuccess: () => { onChanged(); qc.invalidateQueries({ queryKey: ['invoice-items', movementId] }); },
    onError: (err: unknown) => toast.error(getApiErr(err) ?? 'Error al actualizar'),
  });

  const deleteMut = useMutation({
    mutationFn: () => deleteInvoiceItem(movementId, item.id),
    onSuccess: () => { onChanged(); qc.invalidateQueries({ queryKey: ['invoice-items', movementId] }); toast.success('Ítem eliminado'); },
    onError: (err: unknown) => toast.error(getApiErr(err) ?? 'Error al eliminar'),
  });

  function commitQty() {
    const n = parseFloat(qty);
    if (!isFinite(n) || n <= 0) { setQty(item.quantity.toString()); return; }
    if (n !== item.quantity) patchMut.mutate({ quantity: n });
  }
  function commitPrice() {
    const n = parseFloat(price);
    if (!isFinite(n) || n < 0) { setPrice(item.unitPrice.toString()); return; }
    if (n !== item.unitPrice) patchMut.mutate({ unitPrice: n });
  }

  return (
    <tr className="hover:bg-[var(--color-bg-card-hover)] transition-colors">
      <td className="px-3 py-2 text-sm text-[var(--color-text-primary)]">
        <div className="font-medium">{item.materialItem?.nombre ?? '—'}</div>
        <div className="text-[11px] text-[var(--color-text-muted)]">{item.materialItem?.category.nombre ?? '—'} · {item.materialItem?.unidad}</div>
      </td>
      <td className="px-2 py-2">
        {confirmed ? (
          <span className="text-sm tabular-nums">{item.quantity}</span>
        ) : (
          <input
            type="number" min="0" step="0.01"
            className="w-20 px-2 py-1 rounded text-xs bg-[var(--color-bg-app)] border border-[var(--color-border)] text-[var(--color-text-primary)] tabular-nums focus:outline-none focus:ring-1 focus:ring-[var(--color-accent)]"
            value={qty}
            onChange={e => setQty(e.target.value)}
            onBlur={commitQty}
            onKeyDown={e => { if (e.key === 'Enter') (e.target as HTMLInputElement).blur(); }}
          />
        )}
      </td>
      <td className="px-2 py-2">
        {confirmed ? (
          <span className="text-sm tabular-nums">{fmtCurrency(item.unitPrice, moneda)}</span>
        ) : (
          <div className="flex items-center gap-1">
            <input
              type="number" min="0" step="0.01"
              className="w-24 px-2 py-1 rounded text-xs bg-[var(--color-bg-app)] border border-[var(--color-border)] text-[var(--color-text-primary)] tabular-nums focus:outline-none focus:ring-1 focus:ring-[var(--color-accent)]"
              value={price}
              onChange={e => setPrice(e.target.value)}
              onBlur={commitPrice}
              onKeyDown={e => { if (e.key === 'Enter') (e.target as HTMLInputElement).blur(); }}
            />
            <span className="text-[10px] text-[var(--color-text-muted)]">{moneda}</span>
          </div>
        )}
      </td>
      <td className="px-2 py-2 text-right text-sm font-semibold text-[var(--color-text-primary)] tabular-nums">
        {fmtCurrency(item.subtotal, moneda)}
      </td>
      {!confirmed && (
        <td className="px-2 py-2">
          <button
            title="Eliminar"
            onClick={() => { if (confirm('¿Eliminar este ítem?')) deleteMut.mutate(); }}
            className="p-1 rounded hover:bg-red-500/15 text-red-400"
          >
            <Trash2 className="w-3.5 h-3.5" />
          </button>
        </td>
      )}
    </tr>
  );
}

// ─── Sub-modal: agregar producto desde catálogo ───────────────────────────────

function AddItemPicker({ movementId, existingIds, moneda, onClose }: {
  movementId: string;
  existingIds: Set<string>;
  moneda: 'USD' | 'UYU';
  onClose: () => void;
}) {
  const qc = useQueryClient();
  const [search, setSearch] = useState('');
  const [adding, setAdding] = useState<string | null>(null);
  const [addedIds, setAddedIds] = useState<Set<string>>(new Set());

  const { data: categories = [] } = useQuery({
    queryKey: ['material-categories', 'true'],
    queryFn: () => getMaterialCategories({ activa: 'true' }),
  });

  // Sólo productos físicos (gestionaStock=true)
  const { data: products = [], isLoading } = useQuery({
    queryKey: ['stock-products-for-invoice'],
    queryFn: () => getStockProducts({ activo: true, gestionaStock: 'true' }),
  });

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return products;
    return products.filter(p =>
      p.nombre.toLowerCase().includes(q)
      || (p.descripcion?.toLowerCase().includes(q) ?? false)
      || p.categoria.toLowerCase().includes(q),
    );
  }, [products, search]);

  // Agrupar por categoría
  const byCategory = useMemo(() => {
    const m = new Map<string, StockProduct[]>();
    for (const p of filtered) {
      const k = p.categoryId ?? 'sin-cat';
      if (!m.has(k)) m.set(k, []);
      m.get(k)!.push(p);
    }
    return m;
  }, [filtered]);

  async function handleAdd(p: StockProduct) {
    setAdding(p.id);
    try {
      const unitPrice = p.precioSugerido ?? 0;
      await createInvoiceItem(movementId, {
        materialItemId: p.id,
        quantity: 1,
        unitPrice,
        moneda,
      });
      setAddedIds(prev => new Set(prev).add(p.id));
      qc.invalidateQueries({ queryKey: ['invoice-items', movementId] });
    } catch (err) {
      toast.error(getApiErr(err) ?? 'Error al agregar');
    } finally {
      setAdding(null);
    }
  }

  return (
    <div className="fixed inset-0 bg-black/60 z-[70] flex items-center justify-center p-4" onClick={e => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="bg-[var(--color-bg-card)] border border-[var(--color-border)] rounded-xl w-full max-w-2xl max-h-[80vh] flex flex-col shadow-2xl">
        <div className="flex items-center justify-between p-4 border-b border-[var(--color-border)]">
          <p className="text-sm font-semibold text-[var(--color-text-primary)]">Agregar producto al desglose</p>
          <button onClick={onClose} className="text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)]"><X className="w-5 h-5" /></button>
        </div>
        <div className="p-3 border-b border-[var(--color-border)]">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[var(--color-text-muted)]" />
            <input
              autoFocus
              type="text"
              placeholder="Buscar productos físicos…"
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="w-full pl-9 pr-3 py-2 rounded-lg border border-[var(--color-border)] bg-[var(--color-bg-app)] text-sm text-[var(--color-text-primary)] focus:outline-none focus:ring-2 focus:ring-[var(--color-accent)]"
            />
          </div>
        </div>
        <div className="flex-1 overflow-y-auto p-2">
          {isLoading ? (
            <p className="text-sm text-[var(--color-text-muted)] text-center py-8">Cargando catálogo…</p>
          ) : filtered.length === 0 ? (
            <p className="text-sm text-[var(--color-text-muted)] text-center py-8">
              {products.length === 0 ? 'No hay productos físicos en el catálogo' : 'No se encontraron productos'}
            </p>
          ) : (
            <div className="space-y-2">
              {categories.filter(c => byCategory.has(c.id)).map(c => (
                <div key={c.id} className="rounded-lg border border-[var(--color-border)] overflow-hidden">
                  <div className="px-3 py-1.5 bg-[var(--color-bg-card-hover)] text-xs font-semibold text-[var(--color-text-secondary)]">
                    {c.nombre}
                  </div>
                  <div className="divide-y divide-[var(--color-border)]">
                    {(byCategory.get(c.id) ?? []).map(p => {
                      const already = existingIds.has(p.id) || addedIds.has(p.id);
                      return (
                        <div key={p.id} className="flex items-center gap-3 px-3 py-2 bg-[var(--color-bg-card)]">
                          <div className="flex-1 min-w-0">
                            <p className="text-sm text-[var(--color-text-primary)] truncate">{p.nombre}</p>
                            <p className="text-xs text-[var(--color-text-muted)]">
                              {p.unidad}
                              {p.precioSugerido != null ? ` · ${fmtCurrency(p.precioSugerido, p.moneda)}` : ' · sin precio sugerido'}
                              {p.gestionaStock && ` · stock: ${p.stockActual}`}
                            </p>
                          </div>
                          <button
                            onClick={() => handleAdd(p)}
                            disabled={adding === p.id || already}
                            className={klass(
                              'px-3 py-1 rounded text-xs font-semibold transition-colors',
                              already
                                ? 'bg-[var(--color-state-done-bg)] text-[var(--color-state-done-text)] cursor-default'
                                : 'bg-[var(--color-accent)] text-gray-900 hover:bg-[var(--color-accent-hover)] disabled:opacity-60',
                            )}
                          >
                            {already ? '✓ Agregado' : adding === p.id ? '...' : '+ Agregar'}
                          </button>
                        </div>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
        <div className="p-3 border-t border-[var(--color-border)] flex justify-end">
          <button onClick={onClose} className="px-4 py-2 rounded-lg bg-[var(--color-accent)] text-gray-900 text-sm font-semibold hover:bg-[var(--color-accent-hover)]">
            Listo
          </button>
        </div>
      </div>
    </div>
  );
}

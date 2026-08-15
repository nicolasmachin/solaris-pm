import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'react-hot-toast';
import { Plus, X, AlertTriangle, Package, ChevronLeft, ChevronRight, ArrowDown, ArrowUp, SlidersHorizontal } from 'lucide-react';
import { Spinner } from '../components/ui/Spinner';
import { MaterialPhotoButton } from '../components/materials/MaterialPhoto';
import { usePermission } from '../hooks/usePermission';
import {
  createStockMovement, getProductMovements, getStockAlerts, getStockMovements, getStockProducts,
} from '../api/stock.api';
import {
  getMaterialCategories, createMaterialItem, patchMaterialItem, deleteMaterialItem,
} from '../api/materials.api';
import { getSuppliers } from '../api/finance.api';
import { apiClient } from '../api/axios';
import { fmtCurrency, fmtDate } from '../lib/finance';
import type { Moneda, StockProduct, TipoMovimientoStock } from '../types/finance.types';
import { todayLocalISO } from '../utils/date';

function klass(...p: (string | false | undefined)[]) { return p.filter(Boolean).join(' '); }

const inp = 'w-full rounded-lg border border-[var(--color-border)] bg-[var(--color-bg-app)] px-3 py-2 text-sm text-[var(--color-text-primary)] focus:outline-none focus:ring-2 focus:ring-[var(--color-accent)]';
const lbl = 'block text-xs font-mono text-[var(--color-text-muted)] mb-1 uppercase tracking-wider';

function getApiErr(err: unknown) {
  return (err as { response?: { data?: { message?: string } } })?.response?.data?.message;
}

// ─── Product (MaterialItem) Form ──────────────────────────────────────────────

function ProductForm({ initial, productId, onSuccess, onCancel }: {
  initial?: StockProduct | null;
  productId?: string;
  onSuccess: () => void;
  onCancel: () => void;
}) {
  const { data: categories = [] } = useQuery({
    queryKey: ['material-categories', 'true'],
    queryFn: () => getMaterialCategories({ activa: 'true' }),
  });
  const { data: suppliers = [] } = useQuery({
    queryKey: ['suppliers', 'true'],
    queryFn: () => getSuppliers({ activo: 'true' }),
  });

  const [form, setForm] = useState({
    categoryId: initial?.categoryId ?? '',
    nombre: initial?.nombre ?? '',
    descripcion: initial?.descripcion ?? '',
    unidad: initial?.unidad ?? 'un',
    precioSugerido: initial?.precioSugerido?.toString() ?? '',
    moneda: (initial?.moneda ?? 'USD') as Moneda,
    defaultSupplierId: initial?.defaultSupplier?.id ?? '',
    gestionaStock: initial?.gestionaStock ?? true,
    stockMinimo: initial?.stockMinimo?.toString() ?? '',
    ubicacionDeposito: initial?.ubicacionDeposito ?? '',
    activo: initial?.activo ?? true,
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  function setF<K extends keyof typeof form>(key: K, v: typeof form[K]) {
    setForm(p => ({ ...p, [key]: v }));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const precio = form.precioSugerido === '' ? undefined : parseFloat(form.precioSugerido);
      const stockMin = form.stockMinimo === '' ? undefined : parseFloat(form.stockMinimo);
      if (productId) {
        await patchMaterialItem(productId, {
          categoryId: form.categoryId,
          nombre: form.nombre,
          descripcion: form.descripcion || null,
          unidad: form.unidad,
          precioSugerido: precio === undefined ? null : precio,
          moneda: form.moneda,
          defaultSupplierId: form.defaultSupplierId || null,
          gestionaStock: form.gestionaStock,
          stockMinimo: stockMin === undefined ? null : stockMin,
          ubicacionDeposito: form.ubicacionDeposito || null,
          activo: form.activo,
        });
        toast.success('Producto actualizado');
      } else {
        if (!form.categoryId) {
          setError('Elegí una categoría');
          setLoading(false);
          return;
        }
        await createMaterialItem({
          categoryId: form.categoryId,
          nombre: form.nombre,
          ...(form.descripcion ? { descripcion: form.descripcion } : {}),
          unidad: form.unidad,
          ...(precio !== undefined ? { precioSugerido: precio } : {}),
          moneda: form.moneda,
          ...(form.defaultSupplierId ? { defaultSupplierId: form.defaultSupplierId } : {}),
          gestionaStock: form.gestionaStock,
          ...(stockMin !== undefined ? { stockMinimo: stockMin } : {}),
          ...(form.ubicacionDeposito ? { ubicacionDeposito: form.ubicacionDeposito } : {}),
        });
        toast.success('Producto creado');
      }
      onSuccess();
    } catch (err: unknown) {
      setError(getApiErr(err) ?? 'Error al guardar');
    } finally {
      setLoading(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className={lbl}>Categoría *</label>
          <select className={inp} value={form.categoryId} onChange={e => setF('categoryId', e.target.value)} required>
            <option value="">— Seleccioná —</option>
            {categories.filter(c => c.activa || c.id === form.categoryId).map(c => (
              <option key={c.id} value={c.id}>{c.nombre}</option>
            ))}
          </select>
        </div>
        <div>
          <label className={lbl}>Unidad *</label>
          <input className={inp} value={form.unidad} onChange={e => setF('unidad', e.target.value)} required placeholder="un, kg, m" />
        </div>
      </div>
      <div><label className={lbl}>Nombre *</label><input className={inp} value={form.nombre} onChange={e => setF('nombre', e.target.value)} required /></div>
      <div><label className={lbl}>Descripción</label><input className={inp} value={form.descripcion} onChange={e => setF('descripcion', e.target.value)} /></div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className={lbl}>Precio sugerido</label>
          <div className="flex gap-2">
            <select className="rounded-lg border border-[var(--color-border)] bg-[var(--color-bg-app)] px-2 py-2 text-sm text-[var(--color-text-primary)] focus:outline-none" value={form.moneda} onChange={e => setF('moneda', e.target.value as Moneda)}>
              <option value="USD">USD</option><option value="UYU">UYU</option>
            </select>
            <input type="number" className={klass(inp, 'flex-1')} min="0" step="0.01" value={form.precioSugerido} onChange={e => setF('precioSugerido', e.target.value)} />
          </div>
        </div>
        <div>
          <label className={lbl}>Stock mínimo</label>
          <input type="number" className={inp} min="0" step="1" value={form.stockMinimo} onChange={e => setF('stockMinimo', e.target.value)} />
        </div>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className={lbl}>Proveedor por defecto</label>
          <select className={inp} value={form.defaultSupplierId} onChange={e => setF('defaultSupplierId', e.target.value)}>
            <option value="">— Sin proveedor —</option>
            {suppliers.map(s => <option key={s.id} value={s.id}>{s.nombre}</option>)}
          </select>
        </div>
        <div>
          <label className={lbl}>Ubicación depósito</label>
          <input className={inp} value={form.ubicacionDeposito} onChange={e => setF('ubicacionDeposito', e.target.value)} placeholder="Estante A-3" />
        </div>
      </div>
      <div className="flex flex-wrap gap-4 pt-1">
        <label className="flex items-center gap-2 text-sm text-[var(--color-text-secondary)] cursor-pointer">
          <input type="checkbox" checked={form.gestionaStock} onChange={e => setF('gestionaStock', e.target.checked)} className="accent-[var(--color-accent)]" />
          Gestiona stock (físico, entra/sale del depósito)
        </label>
        {productId && (
          <label className="flex items-center gap-2 text-sm text-[var(--color-text-secondary)] cursor-pointer">
            <input type="checkbox" checked={form.activo} onChange={e => setF('activo', e.target.checked)} className="accent-[var(--color-accent)]" />
            Activo
          </label>
        )}
      </div>
      {error && <p className="text-sm text-red-400 bg-red-500/10 rounded-lg px-3 py-2">{error}</p>}
      <div className="flex gap-3">
        <button type="submit" disabled={loading} className="flex-1 py-2 rounded-lg bg-[var(--color-accent)] text-gray-900 text-sm font-semibold hover:bg-[var(--color-accent-hover)] transition-colors disabled:opacity-60">
          {loading ? 'Guardando...' : (productId ? 'Guardar cambios' : 'Crear producto')}
        </button>
        <button type="button" onClick={onCancel} className="px-4 py-2 rounded-lg border border-[var(--color-border)] text-sm text-[var(--color-text-secondary)] hover:bg-[var(--color-bg-card-hover)] transition-colors">
          Cancelar
        </button>
      </div>
    </form>
  );
}

// ─── Ingreso Modal ────────────────────────────────────────────────────────────

function IngresoModal({ product, onSuccess, onClose }: { product: StockProduct; onSuccess: () => void; onClose: () => void }) {
  const today = todayLocalISO();
  const [form, setForm] = useState({
    fecha: today, cantidad: '', costoUnitario: '', moneda: 'USD' as Moneda,
    supplierId: '', referencia: '', observaciones: '',
    causaIngreso: 'OTRO' as 'FACTURA' | 'DEVOLUCION_PROVEEDOR' | 'AJUSTE_INVENTARIO' | 'IMPORTACION_INICIAL' | 'OTRO',
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const { data: suppliers = [] } = useQuery({ queryKey: ['suppliers', 'true'], queryFn: () => getSuppliers({ activo: 'true' }) });

  function setF<K extends keyof typeof form>(k: K, v: typeof form[K]) { setForm(p => ({ ...p, [k]: v })); }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      await createStockMovement({
        fecha: form.fecha,
        materialItemId: product.id,
        tipo: 'INGRESO',
        cantidad: parseInt(form.cantidad, 10),
        costoUnitario: parseFloat(form.costoUnitario) || undefined,
        moneda: form.moneda,
        causaIngreso: form.causaIngreso,
        ...(form.supplierId ? { supplierId: form.supplierId } : {}),
        ...(form.referencia ? { referencia: form.referencia } : {}),
        ...(form.observaciones ? { observaciones: form.observaciones } : {}),
      });
      toast.success(`Ingreso registrado. Nuevo stock: ${product.stockActual + parseFloat(form.cantidad)} ${product.unidad}`);
      onSuccess();
    } catch (err: unknown) {
      setError(getApiErr(err) ?? 'Error al registrar ingreso');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4" onMouseDown={e => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="bg-[var(--color-bg-card)] border border-[var(--color-border)] rounded-xl p-6 w-full max-w-md shadow-2xl">
        <div className="flex items-center justify-between mb-1">
          <p className="text-sm font-semibold text-[var(--color-text-primary)]">Registrar ingreso</p>
          <button onClick={onClose} className="text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)]"><X className="w-4 h-4" /></button>
        </div>
        <p className="text-xs text-[var(--color-text-muted)] mb-4">{product.nombre} · Stock actual: <strong>{product.stockActual} {product.unidad}</strong></p>
        <form onSubmit={handleSubmit} className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div><label className={lbl}>Fecha *</label><input type="date" className={inp} value={form.fecha} onChange={e => setF('fecha', e.target.value)} required /></div>
            <div><label className={lbl}>Cantidad * <span className="text-[var(--color-text-muted)]">({product.unidad})</span></label><input type="number" className={inp} min="1" step="1" value={form.cantidad} onChange={e => setF('cantidad', e.target.value)} required /></div>
          </div>
          <div>
            <label className={lbl}>Costo unitario</label>
            <div className="flex gap-2">
              <select className="rounded-lg border border-[var(--color-border)] bg-[var(--color-bg-app)] px-2 py-2 text-sm text-[var(--color-text-primary)] focus:outline-none" value={form.moneda} onChange={e => setF('moneda', e.target.value as Moneda)}>
                <option value="USD">USD</option><option value="UYU">UYU</option>
              </select>
              <input type="number" className={klass(inp, 'flex-1')} min="0" step="0.01" value={form.costoUnitario} onChange={e => setF('costoUnitario', e.target.value)} />
            </div>
          </div>
          <div>
            <label className={lbl}>Causa de ingreso</label>
            <select className={inp} value={form.causaIngreso} onChange={e => setF('causaIngreso', e.target.value as typeof form.causaIngreso)}>
              <option value="OTRO">Otro</option>
              <option value="FACTURA">Factura</option>
              <option value="DEVOLUCION_PROVEEDOR">Devolución de proveedor</option>
              <option value="AJUSTE_INVENTARIO">Ajuste de inventario</option>
              <option value="IMPORTACION_INICIAL">Importación inicial</option>
            </select>
            <p className="text-[10px] text-[var(--color-text-muted)] mt-1">
              Si esta compra ya tiene una factura registrada en Finanzas, conviene cargar el desglose desde ahí (entra al stock automáticamente).
            </p>
          </div>
          <div>
            <label className={lbl}>Proveedor</label>
            <select className={inp} value={form.supplierId} onChange={e => setF('supplierId', e.target.value)}>
              <option value="">Sin proveedor</option>
              {suppliers.map(s => <option key={s.id} value={s.id}>{s.nombre}</option>)}
            </select>
          </div>
          <div><label className={lbl}>Referencia</label><input className={inp} value={form.referencia} onChange={e => setF('referencia', e.target.value)} /></div>
          <div><label className={lbl}>Observaciones</label><textarea className={klass(inp, 'resize-none')} rows={2} value={form.observaciones} onChange={e => setF('observaciones', e.target.value)} /></div>
          {error && <p className="text-sm text-red-400 bg-red-500/10 rounded-lg px-3 py-2">{error}</p>}
          <div className="flex gap-3 pt-1">
            <button type="submit" disabled={loading} className="flex-1 py-2 rounded-lg bg-green-600 text-white text-sm font-semibold hover:bg-green-700 transition-colors disabled:opacity-60">
              {loading ? 'Registrando...' : 'Registrar ingreso'}
            </button>
            <button type="button" onClick={onClose} className="px-4 py-2 rounded-lg border border-[var(--color-border)] text-sm text-[var(--color-text-secondary)] hover:bg-[var(--color-bg-card-hover)] transition-colors">Cancelar</button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ─── Egreso Modal ─────────────────────────────────────────────────────────────

function EgresoModal({ product, onSuccess, onClose }: { product: StockProduct; onSuccess: () => void; onClose: () => void }) {
  const today = todayLocalISO();
  const [form, setForm] = useState({ fecha: today, cantidad: '', projectId: '', observaciones: '' });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const { data: projects = [] } = useQuery({
    queryKey: ['active-projects-for-stock'],
    queryFn: () => apiClient.get<{ id: string; code: string; clientName: string }[]>('/api/projects?status=ACTIVE').then(r => r.data),
  });

  function setF(k: keyof typeof form, v: string) { setForm(p => ({ ...p, [k]: v })); }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    const qty = parseFloat(form.cantidad);
    if (qty > product.stockActual) {
      setError(`Stock insuficiente. Disponible: ${product.stockActual} ${product.unidad}`);
      return;
    }
    setLoading(true);
    try {
      await createStockMovement({
        fecha: form.fecha,
        materialItemId: product.id,
        tipo: 'EGRESO',
        cantidad: qty,
        ...(form.projectId ? { projectId: form.projectId } : {}),
        ...(form.observaciones ? { observaciones: form.observaciones } : {}),
      });
      toast.success(`Egreso registrado. Nuevo stock: ${product.stockActual - qty} ${product.unidad}`);
      onSuccess();
    } catch (err: unknown) {
      const errData = (err as { response?: { data?: { message?: string; code?: string } } })?.response?.data;
      if (errData?.code === 'INSUFFICIENT_STOCK') {
        setError(errData.message ?? `Stock insuficiente. Disponible: ${product.stockActual} ${product.unidad}`);
      } else {
        setError(errData?.message ?? 'Error al registrar egreso');
      }
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4" onMouseDown={e => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="bg-[var(--color-bg-card)] border border-[var(--color-border)] rounded-xl p-6 w-full max-w-md shadow-2xl">
        <div className="flex items-center justify-between mb-1">
          <p className="text-sm font-semibold text-[var(--color-text-primary)]">Registrar egreso</p>
          <button onClick={onClose} className="text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)]"><X className="w-4 h-4" /></button>
        </div>
        <p className="text-xs text-[var(--color-text-muted)] mb-4">{product.nombre} · Stock actual: <strong className={product.bajominimo ? 'text-red-400' : ''}>{product.stockActual} {product.unidad}</strong></p>
        <form onSubmit={handleSubmit} className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div><label className={lbl}>Fecha *</label><input type="date" className={inp} value={form.fecha} onChange={e => setF('fecha', e.target.value)} required /></div>
            <div>
              <label className={lbl}>Cantidad * <span className="text-[var(--color-text-muted)]">({product.unidad})</span></label>
              <input type="number" className={inp} min="1" step="1" max={product.stockActual}
                value={form.cantidad} onChange={e => setF('cantidad', e.target.value)} required />
            </div>
          </div>
          <div>
            <label className={lbl}>Proyecto (obra)</label>
            <select className={inp} value={form.projectId} onChange={e => setF('projectId', e.target.value)}>
              <option value="">— Sin proyecto asociado —</option>
              {projects.map(p => <option key={p.id} value={p.id}>{p.code} — {p.clientName}</option>)}
            </select>
          </div>
          <div><label className={lbl}>Observaciones</label><textarea className={klass(inp, 'resize-none')} rows={2} value={form.observaciones} onChange={e => setF('observaciones', e.target.value)} /></div>
          {error && (
            <div className="flex items-start gap-2 bg-red-500/10 border border-red-500/30 rounded-lg px-3 py-2.5">
              <AlertTriangle className="w-4 h-4 text-red-400 shrink-0 mt-0.5" />
              <p className="text-sm text-red-400">{error}</p>
            </div>
          )}
          <div className="flex gap-3 pt-1">
            <button type="submit" disabled={loading} className="flex-1 py-2 rounded-lg bg-red-600 text-white text-sm font-semibold hover:bg-red-700 transition-colors disabled:opacity-60">
              {loading ? 'Registrando...' : 'Registrar egreso'}
            </button>
            <button type="button" onClick={onClose} className="px-4 py-2 rounded-lg border border-[var(--color-border)] text-sm text-[var(--color-text-secondary)] hover:bg-[var(--color-bg-card-hover)] transition-colors">Cancelar</button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ─── Ajuste Modal ─────────────────────────────────────────────────────────────

function AjusteModal({ product, onSuccess, onClose }: { product: StockProduct; onSuccess: () => void; onClose: () => void }) {
  const today = todayLocalISO();
  const [form, setForm] = useState({ fecha: today, nuevoStock: String(product.stockActual), motivo: '' });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  function setF(k: keyof typeof form, v: string) { setForm(p => ({ ...p, [k]: v })); }

  const diff = parseFloat(form.nuevoStock || '0') - product.stockActual;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    if (!form.motivo.trim()) { setError('El motivo del ajuste es requerido'); return; }
    setLoading(true);
    try {
      await createStockMovement({
        fecha: form.fecha,
        materialItemId: product.id,
        tipo: 'AJUSTE',
        cantidad: parseInt(form.nuevoStock, 10),
        causaIngreso: 'AJUSTE_INVENTARIO',
        observaciones: form.motivo,
      });
      toast.success(`Stock ajustado a ${form.nuevoStock} ${product.unidad}`);
      onSuccess();
    } catch (err: unknown) {
      setError(getApiErr(err) ?? 'Error al registrar ajuste');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4" onMouseDown={e => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="bg-[var(--color-bg-card)] border border-[var(--color-border)] rounded-xl p-6 w-full max-w-md shadow-2xl">
        <div className="flex items-center justify-between mb-1">
          <p className="text-sm font-semibold text-[var(--color-text-primary)]">Ajuste de inventario</p>
          <button onClick={onClose} className="text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)]"><X className="w-4 h-4" /></button>
        </div>
        <p className="text-xs text-[var(--color-text-muted)] mb-4">{product.nombre} · Stock actual: <strong>{product.stockActual} {product.unidad}</strong></p>
        <form onSubmit={handleSubmit} className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div><label className={lbl}>Fecha *</label><input type="date" className={inp} value={form.fecha} onChange={e => setF('fecha', e.target.value)} required /></div>
            <div>
              <label className={lbl}>Nuevo stock *</label>
              <input type="number" className={inp} min="0" step="1" value={form.nuevoStock} onChange={e => setF('nuevoStock', e.target.value)} required />
            </div>
          </div>
          {form.nuevoStock && (
            <div className={klass('text-xs px-3 py-2 rounded-lg',
              diff > 0 ? 'bg-green-500/10 text-green-400' : diff < 0 ? 'bg-red-500/10 text-red-400' : 'bg-[var(--color-border)] text-[var(--color-text-muted)]')}>
              Diferencia: {diff > 0 ? '+' : ''}{diff.toFixed(3)} {product.unidad}
            </div>
          )}
          <div>
            <label className={lbl}>Motivo del ajuste *</label>
            <textarea className={klass(inp, 'resize-none')} rows={3} value={form.motivo} onChange={e => setF('motivo', e.target.value)} required />
          </div>
          {error && <p className="text-sm text-red-400 bg-red-500/10 rounded-lg px-3 py-2">{error}</p>}
          <div className="flex gap-3 pt-1">
            <button type="submit" disabled={loading} className="flex-1 py-2 rounded-lg bg-[var(--color-accent)] text-gray-900 text-sm font-semibold hover:bg-[var(--color-accent-hover)] transition-colors disabled:opacity-60">
              {loading ? 'Ajustando...' : 'Confirmar ajuste'}
            </button>
            <button type="button" onClick={onClose} className="px-4 py-2 rounded-lg border border-[var(--color-border)] text-sm text-[var(--color-text-secondary)] hover:bg-[var(--color-bg-card-hover)] transition-colors">Cancelar</button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ─── Product Panel ────────────────────────────────────────────────────────────

type ActiveModal = 'ingreso' | 'egreso' | 'ajuste' | null;

function ProductPanel({ product, onClose, onRefresh }: { product: StockProduct; onClose: () => void; onRefresh: () => void }) {
  const [tab, setTab] = useState<'movimientos' | 'editar'>('movimientos');
  const [activeModal, setActiveModal] = useState<ActiveModal>(null);
  const [movPage, setMovPage] = useState(1);

  const { data: movData, refetch: refetchMovs } = useQuery({
    queryKey: ['product-movements', product.id, movPage],
    queryFn: () => getProductMovements(product.id, { page: movPage, limit: 10 }),
  });

  const qc = useQueryClient();
  const deleteMut = useMutation({
    mutationFn: () => deleteMaterialItem(product.id),
    onSuccess: (r) => {
      toast.success(r.deactivated ? 'Producto desactivado (en uso)' : 'Producto eliminado');
      qc.invalidateQueries({ queryKey: ['stock-products'] });
      qc.invalidateQueries({ queryKey: ['stock-alerts'] });
      qc.invalidateQueries({ queryKey: ['material-items'] });
      onClose();
    },
    onError: (err) => toast.error(getApiErr(err) ?? 'No se pudo eliminar'),
  });

  function handleMovSuccess() {
    setActiveModal(null);
    refetchMovs();
    onRefresh();
  }

  const stockMin = product.stockMinimo ?? 0;
  const stockPct = stockMin > 0 ? Math.min(100, (product.stockActual / stockMin) * 100) : 100;

  return (
    <>
      <div className="fixed inset-0 z-40 flex justify-end" onMouseDown={e => { if (e.target === e.currentTarget) onClose(); }}>
        <div className="w-full max-w-md bg-[var(--color-bg-card)] border-l border-[var(--color-border)] h-full overflow-y-auto shadow-2xl">
          {/* Header */}
          <div className="flex items-start justify-between p-5 border-b border-[var(--color-border)]">
            <div className="flex items-center gap-3">
              <div className={klass('w-10 h-10 rounded-lg flex items-center justify-center shrink-0', product.bajominimo ? 'bg-red-500/15' : 'bg-[var(--color-info-bg)]')}>
                <Package className={klass('w-5 h-5', product.bajominimo ? 'text-red-400' : 'text-[var(--color-info-text)]')} />
              </div>
              <div>
                <p className="font-semibold text-[var(--color-text-primary)]">{product.nombre}</p>
                <p className="text-xs text-[var(--color-text-muted)]">
                  {product.categoria} · {product.unidad}
                  {!product.gestionaStock && <span className="ml-2 text-[10px] font-mono bg-[var(--color-border)] text-[var(--color-text-muted)] px-1.5 py-0.5 rounded uppercase">Sin stock</span>}
                </p>
              </div>
            </div>
            <button onClick={onClose} className="text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)]"><X className="w-5 h-5" /></button>
          </div>

          {/* Stock bar (sólo si gestiona stock) */}
          {product.gestionaStock && (
            <div className="px-5 py-3 border-b border-[var(--color-border)]">
              <div className="flex items-center justify-between mb-1.5">
                <span className="text-xs text-[var(--color-text-muted)]">Stock actual</span>
                <div className="flex items-center gap-2">
                  {product.bajominimo && (
                    <span className="text-[10px] font-mono bg-red-500/20 text-red-400 px-2 py-0.5 rounded uppercase">Bajo mínimo</span>
                  )}
                  <span className={klass('text-sm font-bold', product.bajominimo ? 'text-red-400' : 'text-[var(--color-text-primary)]')}>
                    {product.stockActual} {product.unidad}
                  </span>
                </div>
              </div>
              {stockMin > 0 && (
                <>
                  <div className="h-2 rounded-full bg-[var(--color-border)] overflow-hidden">
                    <div className={klass('h-full rounded-full', product.bajominimo ? 'bg-red-400' : 'bg-green-400')} style={{ width: `${stockPct}%` }} />
                  </div>
                  <div className="flex justify-between mt-1">
                    <span className="text-[11px] text-[var(--color-text-muted)]">Mín: {stockMin} {product.unidad}</span>
                    {product.precioSugerido != null && <span className="text-[11px] text-[var(--color-text-muted)]">Precio sug: {fmtCurrency(product.precioSugerido, product.moneda)}</span>}
                  </div>
                </>
              )}
              {product.ubicacionDeposito && (
                <p className="text-[11px] text-[var(--color-text-muted)] mt-1">📍 {product.ubicacionDeposito}</p>
              )}
            </div>
          )}

          {/* Action buttons (sólo si gestiona stock) */}
          {product.gestionaStock && (
            <div className="grid grid-cols-3 gap-2 px-5 py-3 border-b border-[var(--color-border)]">
              <button onClick={() => setActiveModal('ingreso')}
                className="flex flex-col items-center gap-1 py-2.5 rounded-lg bg-green-500/10 hover:bg-green-500/20 text-green-400 transition-colors">
                <ArrowDown className="w-4 h-4" />
                <span className="text-[11px] font-medium">Ingreso</span>
              </button>
              <button onClick={() => setActiveModal('egreso')}
                className="flex flex-col items-center gap-1 py-2.5 rounded-lg bg-red-500/10 hover:bg-red-500/20 text-red-400 transition-colors">
                <ArrowUp className="w-4 h-4" />
                <span className="text-[11px] font-medium">Egreso</span>
              </button>
              <button onClick={() => setActiveModal('ajuste')}
                className="flex flex-col items-center gap-1 py-2.5 rounded-lg bg-[var(--color-border)]/50 hover:bg-[var(--color-border)] text-[var(--color-text-secondary)] transition-colors">
                <SlidersHorizontal className="w-4 h-4" />
                <span className="text-[11px] font-medium">Ajuste</span>
              </button>
            </div>
          )}

          {/* Tabs */}
          <div className="flex border-b border-[var(--color-border)]">
            {(['movimientos', 'editar'] as const).map(t => (
              <button key={t} onClick={() => setTab(t)}
                className={klass('flex-1 py-2.5 text-xs font-mono uppercase tracking-wider transition-colors border-b-2',
                  tab === t ? 'border-[var(--color-accent)] text-[var(--color-accent)]' : 'border-transparent text-[var(--color-text-muted)] hover:text-[var(--color-text-secondary)]')}>
                {t}
              </button>
            ))}
          </div>

          <div className="p-5 space-y-3">
            {tab === 'editar' && (
              <div className="space-y-4">
                <ProductForm
                  initial={product}
                  productId={product.id}
                  onSuccess={() => { onRefresh(); setTab('movimientos'); }}
                  onCancel={() => setTab('movimientos')}
                />
                <button onClick={() => { if (confirm('¿Eliminar este producto? Si tiene movimientos vinculados quedará desactivado en lugar de borrarse.')) deleteMut.mutate(); }}
                  className="w-full py-2 rounded-lg bg-red-500/15 text-red-400 text-sm font-semibold hover:bg-red-500/25 transition-colors">
                  Eliminar producto
                </button>
              </div>
            )}

            {tab === 'movimientos' && (
              <>
                {!movData?.data.length ? (
                  <p className="text-sm text-[var(--color-text-muted)] text-center py-4">Sin movimientos</p>
                ) : (
                  <div className="space-y-2">
                    {movData.data.map(m => (
                      <div key={m.id} className="flex items-center justify-between gap-2 px-3 py-2 rounded-lg bg-[var(--color-bg-app)]">
                        <div className="min-w-0">
                          <div className="flex items-center gap-2">
                            <span className={klass('text-[10px] font-mono px-1.5 py-0.5 rounded uppercase',
                              m.tipo === 'INGRESO' ? 'bg-green-500/20 text-green-400' : m.tipo === 'EGRESO' ? 'bg-red-500/20 text-red-400' : 'bg-blue-500/20 text-blue-400')}>
                              {m.tipo}
                            </span>
                            <span className="text-xs text-[var(--color-text-muted)]">{fmtDate(m.fecha)}</span>
                          </div>
                          {(m.referencia || m.observaciones) && (
                            <p className="text-[11px] text-[var(--color-text-muted)] truncate mt-0.5">{m.referencia ?? m.observaciones}</p>
                          )}
                          {m.project && <p className="text-[11px] text-[var(--color-text-muted)] truncate">{m.project.clientName}</p>}
                        </div>
                        <div className="text-right shrink-0">
                          <p className={klass('text-sm font-semibold tabular-nums', m.tipo === 'EGRESO' ? 'text-red-400' : 'text-green-400')}>
                            {m.tipo === 'EGRESO' ? '-' : '+'}{m.cantidad}
                          </p>
                          <p className="text-[11px] text-[var(--color-text-muted)]">→ {m.stockResultante}</p>
                        </div>
                      </div>
                    ))}
                    {movData.totalPages > 1 && (
                      <div className="flex items-center justify-between pt-1">
                        <span className="text-xs text-[var(--color-text-muted)]">{movData.total} mov.</span>
                        <div className="flex gap-2">
                          <button onClick={() => setMovPage(p => Math.max(1, p - 1))} disabled={movPage === 1}
                            className="p-1 rounded border border-[var(--color-border)] disabled:opacity-40 hover:bg-[var(--color-bg-card-hover)]">
                            <ChevronLeft className="w-3 h-3 text-[var(--color-text-secondary)]" />
                          </button>
                          <button onClick={() => setMovPage(p => Math.min(movData.totalPages, p + 1))} disabled={movPage === movData.totalPages}
                            className="p-1 rounded border border-[var(--color-border)] disabled:opacity-40 hover:bg-[var(--color-bg-card-hover)]">
                            <ChevronRight className="w-3 h-3 text-[var(--color-text-secondary)]" />
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </>
            )}
          </div>
        </div>
      </div>

      {activeModal === 'ingreso' && <IngresoModal product={product} onSuccess={handleMovSuccess} onClose={() => setActiveModal(null)} />}
      {activeModal === 'egreso' && <EgresoModal product={product} onSuccess={handleMovSuccess} onClose={() => setActiveModal(null)} />}
      {activeModal === 'ajuste' && <AjusteModal product={product} onSuccess={handleMovSuccess} onClose={() => setActiveModal(null)} />}
    </>
  );
}

// ─── Stock Page ───────────────────────────────────────────────────────────────

export function Stock() {
  const qc = useQueryClient();
  const canEditStock = usePermission('STOCK', 'EDIT');
  const [newModal, setNewModal] = useState(false);
  const [selectedProduct, setSelectedProduct] = useState<StockProduct | null>(null);
  const [filterCat, setFilterCat] = useState('');
  const [filterAlert, setFilterAlert] = useState(false);
  const [includeServices, setIncludeServices] = useState(false);
  const [onlyWithStock, setOnlyWithStock] = useState(false);

  const { data: products = [], isLoading, refetch: refetchProducts } = useQuery({
    queryKey: ['stock-products', filterCat, filterAlert, includeServices],
    queryFn: () => getStockProducts({
      ...(filterCat ? { categoria: filterCat } : {}),
      gestionaStock: includeServices ? 'all' : 'true',
    }),
  });

  const { data: alerts = [] } = useQuery({
    queryKey: ['stock-alerts'],
    queryFn: getStockAlerts,
  });

  const { data: recentMovements } = useQuery({
    queryKey: ['stock-movements-recent'],
    queryFn: () => getStockMovements({ limit: 5, page: 1 }),
  });

  const activeProducts = products.filter(p => p.activo);
  const physicalProducts = products.filter(p => p.gestionaStock);
  const bajominimo = products.filter(p => p.bajominimo);
  const valorTotal = physicalProducts.reduce((sum, p) => sum + p.stockActual * (p.precioSugerido ?? 0), 0);

  let displayedProducts = filterAlert ? products.filter(p => p.bajominimo) : products;
  if (onlyWithStock) displayedProducts = displayedProducts.filter(p => p.gestionaStock && p.stockActual > 0);
  const categorias = [...new Set(products.map(p => p.categoria))].sort();

  function handleProductRefresh() {
    qc.invalidateQueries({ queryKey: ['stock-products'] });
    qc.invalidateQueries({ queryKey: ['stock-alerts'] });
    qc.invalidateQueries({ queryKey: ['stock-movements-recent'] });
    qc.invalidateQueries({ queryKey: ['material-items'] });
    if (selectedProduct) {
      refetchProducts().then(result => {
        const updated = result.data?.find(p => p.id === selectedProduct.id);
        if (updated) setSelectedProduct(updated);
      });
    }
  }

  return (
    <div className="p-6 space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-display text-2xl font-bold text-[var(--color-text-primary)]">Stock</h1>
          <p className="text-sm text-[var(--color-text-muted)] mt-0.5">Gestión de inventario · catálogo unificado con Materiales</p>
        </div>
        <button onClick={() => setNewModal(true)}
          className="flex items-center gap-2 px-4 py-2 rounded-lg bg-[var(--color-accent)] text-gray-900 text-sm font-semibold hover:bg-[var(--color-accent-hover)] transition-colors">
          <Plus className="w-4 h-4" /> Nuevo producto
        </button>
      </div>

      {/* KPI cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-[var(--color-bg-card)] border border-[var(--color-border)] rounded-xl p-4">
          <p className="text-xs text-[var(--color-text-muted)] mb-1">Productos activos</p>
          <p className="text-2xl font-bold font-display text-[var(--color-text-primary)]">{activeProducts.length}</p>
          <p className="text-xs text-[var(--color-text-muted)] mt-0.5">{categorias.length} categoría{categorias.length !== 1 ? 's' : ''}</p>
        </div>
        <div className={klass('border rounded-xl p-4', bajominimo.length > 0 ? 'bg-red-500/10 border-red-500/30' : 'bg-[var(--color-bg-card)] border-[var(--color-border)]')}>
          <p className="text-xs text-[var(--color-text-muted)] mb-1">Bajo mínimo</p>
          <p className={klass('text-2xl font-bold font-display', bajominimo.length > 0 ? 'text-red-400' : 'text-[var(--color-text-primary)]')}>{bajominimo.length}</p>
          <p className="text-xs text-[var(--color-text-muted)] mt-0.5">{bajominimo.length === 0 ? 'Todo en orden' : 'requieren atención'}</p>
        </div>
        <div className="bg-[var(--color-bg-card)] border border-[var(--color-border)] rounded-xl p-4">
          <p className="text-xs text-[var(--color-text-muted)] mb-1">Valor inventario</p>
          <p className="text-base font-bold text-[var(--color-text-primary)] tabular-nums">{fmtCurrency(valorTotal)}</p>
          <p className="text-xs text-[var(--color-text-muted)] mt-0.5">a precio sugerido</p>
        </div>
        <div className="bg-[var(--color-bg-card)] border border-[var(--color-border)] rounded-xl p-4">
          <p className="text-xs text-[var(--color-text-muted)] mb-1">Ult. movimiento</p>
          {recentMovements?.data[0] ? (
            <>
              <p className="text-sm font-medium text-[var(--color-text-primary)] truncate">{recentMovements.data[0].materialItem?.nombre ?? recentMovements.data[0].product?.nombre ?? '—'}</p>
              <p className="text-xs text-[var(--color-text-muted)] mt-0.5">{fmtDate(recentMovements.data[0].fecha)} · {recentMovements.data[0].tipo}</p>
            </>
          ) : (
            <p className="text-sm text-[var(--color-text-muted)]">Sin movimientos</p>
          )}
        </div>
      </div>

      {/* Últimos 5 movimientos */}
      {recentMovements?.data && recentMovements.data.length > 0 && (
        <div className="bg-[var(--color-bg-card)] border border-[var(--color-border)] rounded-xl overflow-hidden">
          <p className="px-5 py-3 text-xs font-mono text-[var(--color-text-muted)] uppercase tracking-wider border-b border-[var(--color-border)]">Últimos movimientos</p>
          <div className="divide-y divide-[var(--color-border)]">
            {recentMovements.data.slice(0, 5).map(m => {
              const itemName = m.materialItem?.nombre ?? m.product?.nombre ?? '—';
              const itemUnidad = m.materialItem?.unidad ?? m.product?.unidad ?? '';
              return (
                <div key={m.id} className="px-5 py-2.5 flex items-center gap-3">
                  <span className={klass('text-[10px] font-mono px-1.5 py-0.5 rounded uppercase shrink-0',
                    m.tipo === 'INGRESO' ? 'bg-green-500/20 text-green-400' : m.tipo === 'EGRESO' ? 'bg-red-500/20 text-red-400' : 'bg-blue-500/20 text-blue-400')}>
                    {m.tipo}
                  </span>
                  <span className="text-sm text-[var(--color-text-primary)] truncate flex-1">{itemName}</span>
                  <span className={klass('text-sm font-semibold tabular-nums shrink-0', m.tipo === 'EGRESO' ? 'text-red-400' : 'text-green-400')}>
                    {m.tipo === 'EGRESO' ? '-' : '+'}{m.cantidad} {itemUnidad}
                  </span>
                  <span className="text-xs text-[var(--color-text-muted)] shrink-0">{fmtDate(m.fecha)}</span>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-2">
        <select
          className="rounded-lg border border-[var(--color-border)] bg-[var(--color-bg-card)] px-3 py-1.5 text-sm text-[var(--color-text-primary)] focus:outline-none focus:ring-1 focus:ring-[var(--color-accent)]"
          value={filterCat}
          onChange={e => setFilterCat(e.target.value)}
        >
          <option value="">Todas las categorías</option>
          {categorias.map(c => <option key={c} value={c}>{c}</option>)}
        </select>
        <label className="flex items-center gap-2 text-sm text-[var(--color-text-secondary)] cursor-pointer">
          <input type="checkbox" checked={filterAlert} onChange={e => setFilterAlert(e.target.checked)} className="accent-[var(--color-accent)]" />
          Solo alertas ({bajominimo.length})
        </label>
        <label className="flex items-center gap-2 text-sm text-[var(--color-text-secondary)] cursor-pointer">
          <input type="checkbox" checked={onlyWithStock} onChange={e => setOnlyWithStock(e.target.checked)} className="accent-[var(--color-accent)]" />
          Solo con stock disponible
        </label>
        <label className="flex items-center gap-2 text-sm text-[var(--color-text-secondary)] cursor-pointer">
          <input type="checkbox" checked={includeServices} onChange={e => setIncludeServices(e.target.checked)} className="accent-[var(--color-accent)]" />
          Incluir servicios (sin stock)
        </label>
      </div>

      {/* Products table */}
      <div className="bg-[var(--color-bg-card)] border border-[var(--color-border)] rounded-xl overflow-hidden">
        {isLoading ? (
          <div className="flex items-center justify-center py-12"><Spinner /></div>
        ) : displayedProducts.length === 0 ? (
          <p className="text-sm text-[var(--color-text-muted)] text-center py-12">
            {filterAlert ? 'Sin productos bajo mínimo 👍' : 'Sin productos registrados'}
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-[var(--color-border)] text-xs font-mono text-[var(--color-text-muted)] uppercase tracking-wider">
                  <th className="px-2 py-3 text-center font-medium w-12">Foto</th>
                  {['Producto', 'Categoría', 'Unidad', 'Stock', 'Mínimo', 'Ubicación', 'Precio sug.'].map(h => (
                    <th key={h} className="px-4 py-3 text-left font-medium">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--color-border)]">
                {displayedProducts.map(p => (
                  <tr key={p.id} onClick={() => setSelectedProduct(p)}
                    className={klass('cursor-pointer hover:bg-[var(--color-bg-card-hover)] transition-colors',
                      p.bajominimo && 'bg-red-500/5',
                      !p.activo && 'opacity-60')}>
                    {/* La fila abre el detalle del producto: el ojito no debe dispararlo. */}
                    <td className="px-2 py-3 text-center" onClick={e => e.stopPropagation()}>
                      <MaterialPhotoButton itemId={p.id} nombre={p.nombre} canEdit={canEditStock} />
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        {p.bajominimo && <AlertTriangle className="w-3.5 h-3.5 text-red-400 shrink-0" />}
                        <div>
                          <span className="font-medium text-[var(--color-text-primary)]">{p.nombre}</span>
                          {p.bajominimo && <span className="ml-2 text-[10px] font-mono bg-red-500/20 text-red-400 px-1.5 py-0.5 rounded uppercase">Bajo mín</span>}
                          {!p.gestionaStock && <span className="ml-2 text-[10px] font-mono bg-[var(--color-border)] text-[var(--color-text-muted)] px-1.5 py-0.5 rounded uppercase">Servicio</span>}
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-[var(--color-text-muted)]">{p.categoria}</td>
                    <td className="px-4 py-3 text-[var(--color-text-muted)]">{p.unidad}</td>
                    <td className={klass('px-4 py-3 font-semibold tabular-nums',
                      !p.gestionaStock ? 'text-[var(--color-text-muted)]' : p.bajominimo ? 'text-red-400' : 'text-[var(--color-text-primary)]')}>
                      {p.gestionaStock ? p.stockActual : '—'}
                    </td>
                    <td className="px-4 py-3 text-[var(--color-text-muted)] tabular-nums">{p.stockMinimo ?? '—'}</td>
                    <td className="px-4 py-3 text-[var(--color-text-muted)]">{p.ubicacionDeposito ?? '—'}</td>
                    <td className="px-4 py-3 text-[var(--color-text-secondary)] tabular-nums">
                      {p.precioSugerido != null ? `${p.precioSugerido.toLocaleString('es-UY', { minimumFractionDigits: 2 })} ${p.moneda}` : '—'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* New product modal */}
      {newModal && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4">
          <div className="bg-[var(--color-bg-card)] border border-[var(--color-border)] rounded-xl p-6 w-full max-w-lg shadow-2xl">
            <div className="flex items-center justify-between mb-4">
              <p className="text-sm font-semibold text-[var(--color-text-primary)]">Nuevo producto</p>
              <button onClick={() => setNewModal(false)} className="text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)]"><X className="w-5 h-5" /></button>
            </div>
            <ProductForm
              onSuccess={() => {
                setNewModal(false);
                qc.invalidateQueries({ queryKey: ['stock-products'] });
                qc.invalidateQueries({ queryKey: ['stock-alerts'] });
                qc.invalidateQueries({ queryKey: ['material-items'] });
              }}
              onCancel={() => setNewModal(false)}
            />
          </div>
        </div>
      )}

      {/* Product panel */}
      {selectedProduct && (
        <ProductPanel
          product={selectedProduct}
          onClose={() => setSelectedProduct(null)}
          onRefresh={handleProductRefresh}
        />
      )}
    </div>
  );
}

// Re-export tipos por si los importan desde Stock.tsx
export type { TipoMovimientoStock };

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'react-hot-toast';
import { Plus, X, Building2 } from 'lucide-react';
import { Spinner } from '../components/ui/Spinner';
import {
  getSuppliers, createSupplier, patchSupplier, deleteSupplier,
  getComprobantes, createComprobante, registrarPagoComprobante,
} from '../api/finance.api';
import { fmtCurrency, fmtDate } from '../lib/finance';
import type {
  EstadoComprobante,
  FinanceComprobante,
  MetodoPago,
  Moneda,
  Supplier,
  TipoComprobante,
} from '../types/finance.types';
import { ESTADO_COMPROBANTE_LABEL, METODO_PAGO_LABEL } from '../types/finance.types';

function klass(...p: (string | false | undefined)[]) { return p.filter(Boolean).join(' '); }

const ESTADO_COMPROBANTE_COLOR: Record<EstadoComprobante, string> = {
  PENDIENTE: 'bg-[var(--color-warning-bg)] text-[var(--color-warning-text)]',
  PARCIALMENTE_PAGADO: 'bg-[var(--color-info-bg)] text-[var(--color-info-text)]',
  PAGADO: 'bg-[var(--color-state-done-bg)] text-[var(--color-state-done-text)]',
  VENCIDO: 'bg-[var(--color-danger-bg)] text-[var(--color-danger-text)]',
  ANULADO: 'bg-[var(--color-border)] text-[var(--color-text-muted)]',
};

const inp = 'w-full rounded-lg border border-[var(--color-border)] bg-[var(--color-bg-app)] px-3 py-2 text-sm text-[var(--color-text-primary)] focus:outline-none focus:ring-2 focus:ring-[var(--color-accent)]';
const lbl = 'block text-xs font-mono text-[var(--color-text-muted)] mb-1 uppercase tracking-wider';

// ─── Supplier Form ────────────────────────────────────────────────────────────

function SupplierForm({ initial, supplierId, onSuccess, onCancel }: {
  initial?: Supplier | null;
  supplierId?: string;
  onSuccess: () => void;
  onCancel: () => void;
}) {
  const [form, setForm] = useState({
    nombre: initial?.nombre ?? '',
    email: initial?.email ?? '',
    telefono: initial?.telefono ?? '',
    rut: initial?.rut ?? '',
    condicionPago: initial?.condicionPago ?? '',
    notas: initial?.notas ?? '',
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const body = {
        nombre: form.nombre,
        ...(form.email ? { email: form.email } : {}),
        ...(form.telefono ? { telefono: form.telefono } : {}),
        ...(form.rut ? { rut: form.rut } : {}),
        ...(form.condicionPago ? { condicionPago: form.condicionPago } : {}),
        ...(form.notas ? { notas: form.notas } : {}),
      };
      if (supplierId) {
        await patchSupplier(supplierId, body);
        toast.success('Proveedor actualizado');
      } else {
        await createSupplier(body);
        toast.success('Proveedor creado');
      }
      onSuccess();
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message;
      setError(msg ?? 'Error al guardar');
    } finally {
      setLoading(false);
    }
  }

  function setF(key: keyof typeof form, v: string) { setForm(p => ({ ...p, [key]: v })); }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div><label className={lbl}>Nombre *</label><input className={inp} value={form.nombre} onChange={e => setF('nombre', e.target.value)} required /></div>
      <div className="grid grid-cols-2 gap-3">
        <div><label className={lbl}>Email</label><input type="email" className={inp} value={form.email} onChange={e => setF('email', e.target.value)} /></div>
        <div><label className={lbl}>Teléfono</label><input className={inp} value={form.telefono} onChange={e => setF('telefono', e.target.value)} /></div>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div><label className={lbl}>RUT / CUIT</label><input className={inp} value={form.rut} onChange={e => setF('rut', e.target.value)} /></div>
        <div><label className={lbl}>Condición de pago</label><input className={inp} placeholder="Ej: 30 días" value={form.condicionPago} onChange={e => setF('condicionPago', e.target.value)} /></div>
      </div>
      <div><label className={lbl}>Notas</label><textarea className={klass(inp, 'resize-none')} rows={2} value={form.notas} onChange={e => setF('notas', e.target.value)} /></div>
      {error && <p className="text-sm text-red-400 bg-red-500/10 rounded-lg px-3 py-2">{error}</p>}
      <div className="flex gap-3">
        <button type="submit" disabled={loading}
          className="flex-1 py-2 rounded-lg bg-[var(--color-accent)] text-gray-900 text-sm font-semibold hover:bg-[var(--color-accent-hover)] transition-colors disabled:opacity-60">
          {loading ? 'Guardando...' : (supplierId ? 'Guardar cambios' : 'Crear proveedor')}
        </button>
        <button type="button" onClick={onCancel}
          className="px-4 py-2 rounded-lg border border-[var(--color-border)] text-sm text-[var(--color-text-secondary)] hover:bg-[var(--color-bg-card-hover)] transition-colors">
          Cancelar
        </button>
      </div>
    </form>
  );
}

// ─── Comprobante Form ─────────────────────────────────────────────────────────

function ComprobanteForm({ supplierId, onSuccess, onCancel }: { supplierId: string; onSuccess: () => void; onCancel: () => void }) {
  const today = new Date().toISOString().split('T')[0];
  const [form, setForm] = useState({
    tipo: 'FACTURA' as TipoComprobante,
    concepto: '',
    monto: '',
    moneda: 'USD' as Moneda,
    fechaEmision: today,
    fechaVencimiento: '',
    numero: '',
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      await createComprobante({
        supplierId,
        tipo: form.tipo,
        concepto: form.concepto,
        monto: parseFloat(form.monto),
        moneda: form.moneda,
        fechaEmision: form.fechaEmision,
        ...(form.fechaVencimiento ? { fechaVencimiento: form.fechaVencimiento } : {}),
        ...(form.numero ? { numero: form.numero } : {}),
      });
      toast.success('Comprobante registrado');
      onSuccess();
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message;
      setError(msg ?? 'Error al guardar');
    } finally {
      setLoading(false);
    }
  }

  function setF(key: keyof typeof form, v: string) { setForm(p => ({ ...p, [key]: v })); }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className={lbl}>Tipo *</label>
          <select className={inp} value={form.tipo} onChange={e => setF('tipo', e.target.value)}>
            {(['FACTURA', 'RECIBO', 'NOTA_CREDITO', 'PRESUPUESTO', 'OTRO'] as TipoComprobante[]).map(t => (
              <option key={t} value={t}>{t.replace('_', ' ')}</option>
            ))}
          </select>
        </div>
        <div><label className={lbl}>Número</label><input className={inp} value={form.numero} onChange={e => setF('numero', e.target.value)} /></div>
      </div>
      <div><label className={lbl}>Concepto *</label><input className={inp} value={form.concepto} onChange={e => setF('concepto', e.target.value)} required /></div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className={lbl}>Monto *</label>
          <div className="flex gap-2">
            <select className="rounded-lg border border-[var(--color-border)] bg-[var(--color-bg-app)] px-2 py-2 text-sm text-[var(--color-text-primary)] focus:outline-none focus:ring-2 focus:ring-[var(--color-accent)]"
              value={form.moneda} onChange={e => setF('moneda', e.target.value)}>
              <option value="USD">USD</option>
              <option value="UYU">UYU</option>
            </select>
            <input type="number" className={klass(inp, 'flex-1')} min="0" step="0.01" value={form.monto} onChange={e => setF('monto', e.target.value)} required />
          </div>
        </div>
        <div><label className={lbl}>Emisión *</label><input type="date" className={inp} value={form.fechaEmision} onChange={e => setF('fechaEmision', e.target.value)} required /></div>
      </div>
      <div><label className={lbl}>Vencimiento</label><input type="date" className={inp} value={form.fechaVencimiento} onChange={e => setF('fechaVencimiento', e.target.value)} /></div>
      {error && <p className="text-sm text-red-400 bg-red-500/10 rounded-lg px-3 py-2">{error}</p>}
      <div className="flex gap-3">
        <button type="submit" disabled={loading}
          className="flex-1 py-2 rounded-lg bg-[var(--color-accent)] text-gray-900 text-sm font-semibold hover:bg-[var(--color-accent-hover)] transition-colors disabled:opacity-60">
          {loading ? 'Guardando...' : 'Registrar comprobante'}
        </button>
        <button type="button" onClick={onCancel}
          className="px-4 py-2 rounded-lg border border-[var(--color-border)] text-sm text-[var(--color-text-secondary)] hover:bg-[var(--color-bg-card-hover)] transition-colors">
          Cancelar
        </button>
      </div>
    </form>
  );
}

// ─── Pago Form ────────────────────────────────────────────────────────────────

function PagoForm({ comprobanteId, onSuccess, onCancel }: { comprobanteId: string; onSuccess: () => void; onCancel: () => void }) {
  const today = new Date().toISOString().split('T')[0];
  const [form, setForm] = useState({ fecha: today, monto: '', moneda: 'USD' as Moneda, metodoPago: 'TRANSFERENCIA' as MetodoPago, referencia: '' });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      await registrarPagoComprobante(comprobanteId, {
        fecha: form.fecha,
        monto: parseFloat(form.monto),
        moneda: form.moneda,
        metodoPago: form.metodoPago,
        ...(form.referencia ? { referencia: form.referencia } : {}),
      });
      toast.success('Pago registrado');
      onSuccess();
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message;
      setError(msg ?? 'Error al registrar pago');
    } finally {
      setLoading(false);
    }
  }

  function setF(key: keyof typeof form, v: string) { setForm(p => ({ ...p, [key]: v })); }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="grid grid-cols-2 gap-3">
        <div><label className={lbl}>Fecha *</label><input type="date" className={inp} value={form.fecha} onChange={e => setF('fecha', e.target.value)} required /></div>
        <div>
          <label className={lbl}>Monto *</label>
          <div className="flex gap-2">
            <select className="rounded-lg border border-[var(--color-border)] bg-[var(--color-bg-app)] px-2 py-2 text-sm text-[var(--color-text-primary)] focus:outline-none" value={form.moneda} onChange={e => setF('moneda', e.target.value)}>
              <option value="USD">USD</option><option value="UYU">UYU</option>
            </select>
            <input type="number" className={klass(inp, 'flex-1')} min="0" step="0.01" value={form.monto} onChange={e => setF('monto', e.target.value)} required />
          </div>
        </div>
      </div>
      <div>
        <label className={lbl}>Método de pago</label>
        <select className={inp} value={form.metodoPago} onChange={e => setF('metodoPago', e.target.value)}>
          {(Object.keys(METODO_PAGO_LABEL) as MetodoPago[]).map(m => <option key={m} value={m}>{METODO_PAGO_LABEL[m]}</option>)}
        </select>
      </div>
      <div><label className={lbl}>Referencia</label><input className={inp} value={form.referencia} onChange={e => setF('referencia', e.target.value)} /></div>
      {error && <p className="text-sm text-red-400 bg-red-500/10 rounded-lg px-3 py-2">{error}</p>}
      <div className="flex gap-3">
        <button type="submit" disabled={loading}
          className="flex-1 py-2 rounded-lg bg-[var(--color-accent)] text-gray-900 text-sm font-semibold hover:bg-[var(--color-accent-hover)] transition-colors disabled:opacity-60">
          {loading ? 'Registrando...' : 'Registrar pago'}
        </button>
        <button type="button" onClick={onCancel} className="px-4 py-2 rounded-lg border border-[var(--color-border)] text-sm text-[var(--color-text-secondary)] hover:bg-[var(--color-bg-card-hover)] transition-colors">
          Cancelar
        </button>
      </div>
    </form>
  );
}

// ─── Supplier Detail Panel ────────────────────────────────────────────────────

function SupplierPanel({ supplier, onClose, qc }: { supplier: Supplier; onClose: () => void; qc: ReturnType<typeof useQueryClient> }) {
  const [tab, setTab] = useState<'info' | 'comprobantes'>('comprobantes');
  const [editMode, setEditMode] = useState(false);
  const [newComprobante, setNewComprobante] = useState(false);
  const [payingId, setPayingId] = useState<string | null>(null);

  const { data: comprobantes = [], refetch: refetchComp } = useQuery({
    queryKey: ['comprobantes', supplier.id],
    queryFn: () => getComprobantes({ supplierId: supplier.id }),
  });

  const deleteMut = useMutation({
    mutationFn: () => deleteSupplier(supplier.id),
    onSuccess: () => {
      toast.success('Proveedor eliminado');
      qc.invalidateQueries({ queryKey: ['suppliers'] });
      onClose();
    },
    onError: () => toast.error('No se pudo eliminar (puede tener comprobantes asociados)'),
  });

  const totalDeuda = comprobantes
    .filter(c => c.estado !== 'PAGADO' && c.estado !== 'ANULADO')
    .reduce((s, c) => s + c.saldoPendiente, 0);

  return (
    <div className="fixed inset-0 z-40 flex justify-end" onClick={e => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="w-full max-w-md bg-[var(--color-bg-card)] border-l border-[var(--color-border)] h-full overflow-y-auto shadow-2xl">
        {/* Header */}
        <div className="flex items-start justify-between p-5 border-b border-[var(--color-border)]">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-[var(--color-info-bg)] flex items-center justify-center shrink-0">
              <Building2 className="w-5 h-5 text-[var(--color-info-text)]" />
            </div>
            <div>
              <p className="font-semibold text-[var(--color-text-primary)]">{supplier.nombre}</p>
              {totalDeuda > 0 && <p className="text-xs text-red-400 font-mono">Debe {fmtCurrency(totalDeuda)}</p>}
            </div>
          </div>
          <button onClick={onClose} className="text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)]"><X className="w-5 h-5" /></button>
        </div>

        {/* Tabs */}
        <div className="flex border-b border-[var(--color-border)]">
          {(['comprobantes', 'info'] as const).map(t => (
            <button key={t} onClick={() => setTab(t)}
              className={klass('flex-1 py-2.5 text-xs font-mono uppercase tracking-wider transition-colors border-b-2',
                tab === t ? 'border-[var(--color-accent)] text-[var(--color-accent)]' : 'border-transparent text-[var(--color-text-muted)] hover:text-[var(--color-text-secondary)]'
              )}>
              {t}
            </button>
          ))}
        </div>

        <div className="p-5 space-y-4">
          {tab === 'info' && (
            editMode ? (
              <SupplierForm
                initial={supplier}
                supplierId={supplier.id}
                onSuccess={() => { setEditMode(false); qc.invalidateQueries({ queryKey: ['suppliers'] }); }}
                onCancel={() => setEditMode(false)}
              />
            ) : (
              <div className="space-y-3">
                {[
                  { label: 'Email', value: supplier.email ?? '—' },
                  { label: 'Teléfono', value: supplier.telefono ?? '—' },
                  { label: 'RUT/CUIT', value: supplier.rut ?? '—' },
                  { label: 'Cond. de pago', value: supplier.condicionPago ?? '—' },
                  { label: 'Notas', value: supplier.notas ?? '—' },
                  { label: 'Estado', value: supplier.activo ? 'Activo' : 'Inactivo' },
                ].map(({ label, value }) => (
                  <div key={label} className="flex justify-between gap-4 text-sm">
                    <span className="text-[var(--color-text-muted)]">{label}</span>
                    <span className="text-[var(--color-text-primary)] text-right">{value}</span>
                  </div>
                ))}
                <div className="flex gap-2 pt-2">
                  <button onClick={() => setEditMode(true)}
                    className="flex-1 py-2 rounded-lg bg-[var(--color-accent)] text-gray-900 text-sm font-semibold hover:bg-[var(--color-accent-hover)] transition-colors">
                    Editar
                  </button>
                  <button onClick={() => { if (confirm('¿Eliminar este proveedor?')) deleteMut.mutate(); }}
                    className="px-4 py-2 rounded-lg bg-red-500/15 text-red-400 text-sm font-semibold hover:bg-red-500/25 transition-colors">
                    Eliminar
                  </button>
                </div>
              </div>
            )
          )}

          {tab === 'comprobantes' && (
            <div className="space-y-3">
              <button onClick={() => setNewComprobante(true)}
                className="w-full flex items-center justify-center gap-2 py-2 rounded-lg border border-dashed border-[var(--color-border)] text-sm text-[var(--color-text-muted)] hover:border-[var(--color-border-hover)] hover:text-[var(--color-text-secondary)] transition-colors">
                <Plus className="w-4 h-4" /> Nuevo comprobante
              </button>

              {newComprobante && (
                <div className="bg-[var(--color-bg-app)] border border-[var(--color-border)] rounded-xl p-4">
                  <ComprobanteForm
                    supplierId={supplier.id}
                    onSuccess={() => { setNewComprobante(false); refetchComp(); }}
                    onCancel={() => setNewComprobante(false)}
                  />
                </div>
              )}

              {comprobantes.length === 0 ? (
                <p className="text-sm text-[var(--color-text-muted)] text-center py-6">Sin comprobantes registrados</p>
              ) : (
                comprobantes.map(c => (
                  <ComprobanteCard
                    key={c.id}
                    c={c}
                    onPagar={() => setPayingId(c.id)}
                    paying={payingId === c.id}
                    onPagoSuccess={() => { setPayingId(null); refetchComp(); }}
                    onPagoCancel={() => setPayingId(null)}
                  />
                ))
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function ComprobanteCard({ c, onPagar, paying, onPagoSuccess, onPagoCancel }: {
  c: FinanceComprobante;
  onPagar: () => void;
  paying: boolean;
  onPagoSuccess: () => void;
  onPagoCancel: () => void;
}) {
  const today = new Date().toISOString().split('T')[0];
  const vencido = c.fechaVencimiento && c.fechaVencimiento < today;
  return (
    <div className={klass('border rounded-xl p-4 space-y-2', vencido ? 'border-red-500/30 bg-red-500/5' : 'border-[var(--color-border)] bg-[var(--color-bg-app)]')}>
      <div className="flex items-start justify-between gap-2">
        <div>
          <p className="text-sm font-medium text-[var(--color-text-primary)]">{c.concepto}</p>
          <p className="text-xs text-[var(--color-text-muted)]">{c.tipo}{c.numero ? ` #${c.numero}` : ''} · {fmtDate(c.fechaEmision)}</p>
        </div>
        <span className={klass('text-[10px] font-mono px-2 py-0.5 rounded uppercase shrink-0', ESTADO_COMPROBANTE_COLOR[c.estado])}>
          {ESTADO_COMPROBANTE_LABEL[c.estado]}
        </span>
      </div>
      <div className="flex items-center justify-between text-sm">
        <span className="text-[var(--color-text-muted)]">Total: {fmtCurrency(c.monto, c.moneda)}</span>
        {c.saldoPendiente > 0 && (
          <span className="font-semibold text-red-400">Pendiente: {fmtCurrency(c.saldoPendiente, c.moneda)}</span>
        )}
      </div>
      {c.fechaVencimiento && (
        <p className={klass('text-xs', vencido ? 'text-red-400 font-medium' : 'text-[var(--color-text-muted)]')}>
          {vencido ? '⚠ Vencido: ' : 'Vence: '}{fmtDate(c.fechaVencimiento)}
        </p>
      )}
      {c.estado !== 'PAGADO' && c.estado !== 'ANULADO' && !paying && (
        <button onClick={onPagar}
          className="w-full py-1.5 rounded-lg bg-green-500/15 text-green-400 text-xs font-semibold hover:bg-green-500/25 transition-colors">
          Registrar pago
        </button>
      )}
      {paying && (
        <div className="bg-[var(--color-bg-card)] border border-[var(--color-border)] rounded-xl p-3">
          <PagoForm comprobanteId={c.id} onSuccess={onPagoSuccess} onCancel={onPagoCancel} />
        </div>
      )}
    </div>
  );
}

// ─── Finance Suppliers Page ───────────────────────────────────────────────────

export function FinanceSuppliers() {
  const qc = useQueryClient();
  const [newModal, setNewModal] = useState(false);
  const [selectedSupplier, setSelectedSupplier] = useState<Supplier | null>(null);

  const { data: suppliers = [], isLoading } = useQuery({
    queryKey: ['suppliers'],
    queryFn: () => getSuppliers(),
  });

  return (
    <div className="p-6 space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-display text-2xl font-bold text-[var(--color-text-primary)]">Proveedores</h1>
          <p className="text-sm text-[var(--color-text-muted)] mt-0.5">{suppliers.length} proveedor{suppliers.length !== 1 ? 'es' : ''}</p>
        </div>
        <button onClick={() => setNewModal(true)}
          className="flex items-center gap-2 px-4 py-2 rounded-lg bg-[var(--color-accent)] text-gray-900 text-sm font-semibold hover:bg-[var(--color-accent-hover)] transition-colors">
          <Plus className="w-4 h-4" /> Nuevo proveedor
        </button>
      </div>

      {/* Table */}
      <div className="bg-[var(--color-bg-card)] border border-[var(--color-border)] rounded-xl overflow-hidden">
        {isLoading ? (
          <div className="flex items-center justify-center py-12"><Spinner /></div>
        ) : suppliers.length === 0 ? (
          <p className="text-sm text-[var(--color-text-muted)] text-center py-12">Sin proveedores registrados</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-[var(--color-border)] text-xs font-mono text-[var(--color-text-muted)] uppercase tracking-wider">
                  {['Nombre', 'Email', 'Teléfono', 'Cond. pago', 'Estado'].map(h => (
                    <th key={h} className="px-4 py-3 text-left font-medium">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--color-border)]">
                {suppliers.map(s => (
                  <tr key={s.id} onClick={() => setSelectedSupplier(s)}
                    className="cursor-pointer hover:bg-[var(--color-bg-card-hover)] transition-colors">
                    <td className="px-4 py-3 font-medium text-[var(--color-text-primary)]">{s.nombre}</td>
                    <td className="px-4 py-3 text-[var(--color-text-muted)]">{s.email ?? '—'}</td>
                    <td className="px-4 py-3 text-[var(--color-text-muted)]">{s.telefono ?? '—'}</td>
                    <td className="px-4 py-3 text-[var(--color-text-muted)]">{s.condicionPago ?? '—'}</td>
                    <td className="px-4 py-3">
                      <span className={klass('text-[10px] font-mono px-2 py-0.5 rounded uppercase',
                        s.activo ? 'bg-[var(--color-state-done-bg)] text-[var(--color-state-done-text)]' : 'bg-[var(--color-border)] text-[var(--color-text-muted)]')}>
                        {s.activo ? 'Activo' : 'Inactivo'}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* New supplier modal */}
      {newModal && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4">
          <div className="bg-[var(--color-bg-card)] border border-[var(--color-border)] rounded-xl p-6 w-full max-w-lg shadow-2xl">
            <div className="flex items-center justify-between mb-4">
              <p className="text-sm font-semibold text-[var(--color-text-primary)]">Nuevo proveedor</p>
              <button onClick={() => setNewModal(false)} className="text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)]"><X className="w-5 h-5" /></button>
            </div>
            <SupplierForm
              onSuccess={() => { setNewModal(false); qc.invalidateQueries({ queryKey: ['suppliers'] }); }}
              onCancel={() => setNewModal(false)}
            />
          </div>
        </div>
      )}

      {/* Supplier detail panel */}
      {selectedSupplier && (
        <SupplierPanel
          supplier={selectedSupplier}
          onClose={() => setSelectedSupplier(null)}
          qc={qc}
        />
      )}
    </div>
  );
}

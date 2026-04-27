import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'react-hot-toast';
import { Plus, X, Search, ArrowRight } from 'lucide-react';
import { Spinner } from '../components/ui/Spinner';
import { getPayments, createPayment } from '../api/payments.api';
import { getSuppliers } from '../api/finance.api';
import { fmtCurrency, fmtDate } from '../lib/finance';
import type { MetodoPago, Moneda } from '../types/finance.types';
import type { Payment } from '../types/payments.types';
import { ApplyPaymentModal } from '../components/finance/ApplyPaymentModal';
import { PaymentDetailPanel } from '../components/finance/PaymentDetailPanel';

function klass(...p: (string | false | undefined)[]) { return p.filter(Boolean).join(' '); }
function getApiErr(err: unknown) {
  return (err as { response?: { data?: { message?: string } } })?.response?.data?.message;
}

const FILTERS_KEY = 'finance-payments-filters-v1';

const METODO_LABEL: Record<MetodoPago, string> = {
  TRANSFERENCIA: 'Transferencia',
  EFECTIVO: 'Efectivo',
  CHEQUE: 'Cheque',
  TARJETA_DEBITO: 'Tarjeta débito',
  TARJETA_CREDITO: 'Tarjeta crédito',
  CRYPTO: 'Crypto',
  OTRO: 'Otro',
};

const inp = 'rounded-lg border border-[var(--color-border)] bg-[var(--color-bg-card)] px-3 py-1.5 text-sm text-[var(--color-text-primary)] focus:outline-none focus:ring-1 focus:ring-[var(--color-accent)]';

interface PersistedFilters {
  supplierId?: string;
  fechaDesde?: string;
  fechaHasta?: string;
  conSaldoSinAplicar?: boolean;
}

// ─── Página ───────────────────────────────────────────────────────────────────

export function FinancePayments() {
  const [supplierId, setSupplierId] = useState<string>('');
  const [fechaDesde, setFechaDesde] = useState<string>('');
  const [fechaHasta, setFechaHasta] = useState<string>('');
  const [conSaldo, setConSaldo] = useState(false);

  const [newModalOpen, setNewModalOpen] = useState(false);
  const [applyForId, setApplyForId] = useState<string | null>(null);
  const [detailForId, setDetailForId] = useState<string | null>(null);

  // Persistencia
  useEffect(() => {
    try {
      const raw = localStorage.getItem(FILTERS_KEY);
      if (raw) {
        const p = JSON.parse(raw) as PersistedFilters;
        if (p.supplierId) setSupplierId(p.supplierId);
        if (p.fechaDesde) setFechaDesde(p.fechaDesde);
        if (p.fechaHasta) setFechaHasta(p.fechaHasta);
        if (p.conSaldoSinAplicar) setConSaldo(p.conSaldoSinAplicar);
      }
    } catch { /* ignore */ }
  }, []);
  useEffect(() => {
    localStorage.setItem(FILTERS_KEY, JSON.stringify({ supplierId, fechaDesde, fechaHasta, conSaldoSinAplicar: conSaldo } satisfies PersistedFilters));
  }, [supplierId, fechaDesde, fechaHasta, conSaldo]);

  const { data: suppliers = [] } = useQuery({
    queryKey: ['suppliers', 'all-for-payments'],
    queryFn: () => getSuppliers({ activo: 'all' }),
  });

  const { data: payments = [], isLoading } = useQuery({
    queryKey: ['payments', { supplierId, fechaDesde, fechaHasta, conSaldo }],
    queryFn: () => getPayments({
      ...(supplierId ? { supplierId } : {}),
      ...(fechaDesde ? { fechaDesde } : {}),
      ...(fechaHasta ? { fechaHasta } : {}),
      ...(conSaldo ? { conSaldoSinAplicar: 'true' as const } : {}),
    }),
  });

  // KPIs (sobre payments del filtro)
  const kpis = useMemo(() => {
    const now = new Date();
    const month = now.getUTCMonth() + 1;
    const year = now.getUTCFullYear();
    let pagosMesUSD = 0, pagosMesUYU = 0;
    let aplicadoUSD = 0, aplicadoUYU = 0;
    let saldoUSD = 0, saldoUYU = 0;
    for (const p of payments) {
      const d = new Date(p.fecha);
      const mismaFecha = d.getUTCMonth() + 1 === month && d.getUTCFullYear() === year;
      if (mismaFecha) {
        if (p.moneda === 'USD') pagosMesUSD += p.monto; else pagosMesUYU += p.monto;
      }
      if (p.moneda === 'USD') aplicadoUSD += p.montoAplicado; else aplicadoUYU += p.montoAplicado;
      if (p.moneda === 'USD') saldoUSD += p.saldoSinAplicar; else saldoUYU += p.saldoSinAplicar;
    }
    return { pagosMesUSD, pagosMesUYU, aplicadoUSD, aplicadoUYU, saldoUSD, saldoUYU };
  }, [payments]);

  return (
    <div className="p-6 space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="font-display text-2xl font-bold text-[var(--color-text-primary)]">Pagos</h1>
          <p className="text-sm text-[var(--color-text-muted)] mt-0.5">Pagos a proveedores y aplicación a facturas</p>
        </div>
        <div className="flex items-center gap-2">
          <Link to="/finanzas/movimientos" className="text-xs text-[var(--color-accent)] hover:underline">Ver movimientos →</Link>
          <button
            onClick={() => setNewModalOpen(true)}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-[var(--color-accent)] text-gray-900 text-sm font-semibold hover:bg-[var(--color-accent-hover)] transition-colors"
          >
            <Plus className="w-4 h-4" />
            Registrar pago
          </button>
        </div>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
        <KpiBox label="Pagos del mes" usd={kpis.pagosMesUSD} uyu={kpis.pagosMesUYU} tone="info" />
        <KpiBox label="Total aplicado" usd={kpis.aplicadoUSD} uyu={kpis.aplicadoUYU} tone="success" />
        <KpiBox label="Saldo sin aplicar (créditos)" usd={kpis.saldoUSD} uyu={kpis.saldoUYU} tone="warning" highlight={kpis.saldoUSD + kpis.saldoUYU > 0} />
      </div>

      {/* Filtros */}
      <div className="flex flex-wrap items-center gap-2">
        <select className={inp} value={supplierId} onChange={e => setSupplierId(e.target.value)}>
          <option value="">Todos los proveedores</option>
          {suppliers.map(s => <option key={s.id} value={s.id}>{s.nombre}</option>)}
        </select>
        <input type="date" className={inp} value={fechaDesde} onChange={e => setFechaDesde(e.target.value)} placeholder="Desde" />
        <input type="date" className={inp} value={fechaHasta} onChange={e => setFechaHasta(e.target.value)} placeholder="Hasta" />
        <label className="flex items-center gap-2 text-sm text-[var(--color-text-secondary)] cursor-pointer">
          <input type="checkbox" checked={conSaldo} onChange={e => setConSaldo(e.target.checked)} className="accent-[var(--color-accent)]" />
          Solo con saldo sin aplicar
        </label>
      </div>

      {/* Tabla */}
      <div className="bg-[var(--color-bg-card)] border border-[var(--color-border)] rounded-xl overflow-hidden">
        {isLoading ? (
          <div className="flex items-center justify-center py-12"><Spinner /></div>
        ) : payments.length === 0 ? (
          <p className="text-sm text-[var(--color-text-muted)] text-center py-12">Sin pagos registrados</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-[var(--color-border)] text-xs font-mono text-[var(--color-text-muted)] uppercase tracking-wider">
                  {['Fecha', 'Proveedor', 'Método', 'Referencia', 'Monto', 'Aplicado', 'Estado', ''].map(h => (
                    <th key={h} className="px-4 py-3 text-left font-medium">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--color-border)]">
                {payments.map(p => {
                  const tieneSaldo = p.saldoSinAplicar > 0.005;
                  return (
                    <tr key={p.id}
                      onClick={() => setDetailForId(p.id)}
                      className={klass('cursor-pointer hover:bg-[var(--color-bg-card-hover)] transition-colors', tieneSaldo && 'bg-[var(--color-warning-bg)]/10')}>
                      <td className="px-4 py-3 whitespace-nowrap text-[var(--color-text-muted)]">{fmtDate(p.fecha)}</td>
                      <td className="px-4 py-3 text-[var(--color-text-primary)] truncate max-w-xs">{p.supplier?.nombre ?? '—'}</td>
                      <td className="px-4 py-3 whitespace-nowrap text-[var(--color-text-secondary)]">{METODO_LABEL[p.metodo]}</td>
                      <td className="px-4 py-3 text-[var(--color-text-muted)] text-[11px] truncate max-w-[140px]">{p.referencia ?? '—'}</td>
                      <td className="px-4 py-3 text-right tabular-nums whitespace-nowrap text-[var(--color-text-primary)]">
                        {fmtCurrency(p.monto, p.moneda)}
                      </td>
                      <td className="px-4 py-3 text-right tabular-nums whitespace-nowrap text-[var(--color-text-secondary)]">
                        {fmtCurrency(p.montoAplicado, p.moneda)}
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap">
                        {tieneSaldo ? (
                          <span className="text-[10px] font-mono px-2 py-0.5 rounded uppercase bg-[var(--color-warning-bg)] text-[var(--color-warning-text)]">
                            Saldo: {fmtCurrency(p.saldoSinAplicar, p.moneda)}
                          </span>
                        ) : (
                          <span className="text-[10px] font-mono px-2 py-0.5 rounded uppercase bg-[var(--color-state-done-bg)] text-[var(--color-state-done-text)]">
                            Aplicado
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap">
                        {tieneSaldo && (
                          <button
                            onClick={e => { e.stopPropagation(); setApplyForId(p.id); }}
                            className="inline-flex items-center gap-1 text-[10px] px-2 py-1 rounded bg-[var(--color-accent)] text-gray-900 font-semibold hover:bg-[var(--color-accent-hover)]"
                            title="Aplicar a facturas"
                          >
                            <ArrowRight className="w-3 h-3" />
                            Aplicar
                          </button>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Modales */}
      {newModalOpen && (
        <NewPaymentModal
          suppliers={suppliers}
          onClose={() => setNewModalOpen(false)}
          onCreatedAndApply={(id) => { setNewModalOpen(false); setApplyForId(id); }}
        />
      )}
      {applyForId && (
        <ApplyPaymentModal paymentId={applyForId} onClose={() => setApplyForId(null)} />
      )}
      {detailForId && (
        <PaymentDetailPanel paymentId={detailForId} onClose={() => setDetailForId(null)} />
      )}
    </div>
  );
}

// ─── KPI box ──────────────────────────────────────────────────────────────────

function KpiBox({ label, usd, uyu, tone, highlight = false }: {
  label: string; usd: number; uyu: number;
  tone: 'info' | 'success' | 'warning';
  highlight?: boolean;
}) {
  const toneClass =
    tone === 'success' ? 'border-[var(--color-state-done-bg)]' :
    tone === 'warning' ? (highlight ? 'border-[var(--color-warning-bg)] bg-[var(--color-warning-bg)]/10' : 'border-[var(--color-border)]') :
    'border-[var(--color-info-bg)]';
  const valColor =
    tone === 'success' ? 'text-[var(--color-state-done-text)]' :
    tone === 'warning' ? 'text-[var(--color-warning-text)]' :
    'text-[var(--color-info-text)]';
  return (
    <div className={klass('rounded-xl border bg-[var(--color-bg-card)] p-4', toneClass)}>
      <p className="text-[10px] font-mono uppercase tracking-wider text-[var(--color-text-muted)] mb-1">{label}</p>
      <div className={klass('text-base font-bold tabular-nums', valColor)}>
        {usd > 0 && <div>{fmtCurrency(usd, 'USD')}</div>}
        {uyu > 0 && <div>{fmtCurrency(uyu, 'UYU')}</div>}
        {usd === 0 && uyu === 0 && <div className="text-[var(--color-text-muted)] font-normal text-sm">—</div>}
      </div>
    </div>
  );
}

// ─── Modal: Registrar pago ───────────────────────────────────────────────────

function NewPaymentModal({ suppliers, onClose, onCreatedAndApply }: {
  suppliers: { id: string; nombre: string }[];
  onClose: () => void;
  onCreatedAndApply: (id: string) => void;
}) {
  const qc = useQueryClient();
  const today = new Date().toISOString().slice(0, 10);
  const [form, setForm] = useState({
    supplierId: '',
    supplierSearch: '',
    fecha: today,
    monto: '',
    moneda: 'USD' as Moneda,
    metodo: 'TRANSFERENCIA' as MetodoPago,
    referencia: '',
    notas: '',
    aplicarAhora: true,
  });
  const [showSupplierList, setShowSupplierList] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const filteredSuppliers = useMemo(() => {
    const q = form.supplierSearch.trim().toLowerCase();
    if (!q) return suppliers.slice(0, 50);
    return suppliers.filter(s => s.nombre.toLowerCase().includes(q)).slice(0, 50);
  }, [suppliers, form.supplierSearch]);

  function setF<K extends keyof typeof form>(k: K, v: typeof form[K]) {
    setForm(p => ({ ...p, [k]: v }));
  }

  const selectedSupplier = suppliers.find(s => s.id === form.supplierId);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    if (!form.supplierId) { setError('Elegí un proveedor'); return; }
    const monto = parseFloat(form.monto);
    if (!isFinite(monto) || monto <= 0) { setError('El monto debe ser mayor a 0'); return; }
    setSaving(true);
    try {
      const created = await createPayment({
        supplierId: form.supplierId,
        fecha: form.fecha,
        monto,
        moneda: form.moneda,
        metodo: form.metodo,
        ...(form.referencia ? { referencia: form.referencia } : {}),
        ...(form.notas ? { notas: form.notas } : {}),
      });
      qc.invalidateQueries({ queryKey: ['payments'] });
      qc.invalidateQueries({ queryKey: ['account-summary'] });
      if (form.aplicarAhora) {
        toast.success('Pago registrado · aplicalo a facturas');
        onCreatedAndApply(created.id);
      } else {
        toast.success('Pago registrado. Aplicalo desde el detalle del pago o del proveedor.');
        onClose();
      }
    } catch (err) {
      setError(getApiErr(err) ?? 'Error al guardar');
    } finally {
      setSaving(false);
    }
  }

  const inpStyle = 'w-full rounded-lg border border-[var(--color-border)] bg-[var(--color-bg-app)] px-3 py-2 text-sm text-[var(--color-text-primary)] focus:outline-none focus:ring-2 focus:ring-[var(--color-accent)]';
  const lbl = 'block text-xs font-mono text-[var(--color-text-muted)] mb-1 uppercase tracking-wider';

  return (
    <div className="fixed inset-0 bg-black/60 z-50 flex items-start justify-center p-4 overflow-y-auto" onClick={e => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="bg-[var(--color-bg-card)] border border-[var(--color-border)] rounded-xl p-6 w-full max-w-lg my-8 shadow-2xl">
        <div className="flex items-center justify-between mb-4">
          <p className="text-sm font-semibold text-[var(--color-text-primary)]">Registrar pago</p>
          <button onClick={onClose} className="text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)]"><X className="w-5 h-5" /></button>
        </div>
        <form onSubmit={submit} className="space-y-4">
          {/* Proveedor */}
          <div>
            <label className={lbl}>Proveedor *</label>
            {selectedSupplier ? (
              <div className="flex items-center gap-2">
                <span className="flex-1 px-3 py-2 rounded-lg bg-[var(--color-bg-app)] border border-[var(--color-border)] text-sm text-[var(--color-text-primary)]">
                  {selectedSupplier.nombre}
                </span>
                <button type="button" onClick={() => { setF('supplierId', ''); setShowSupplierList(true); }} className="text-xs text-[var(--color-accent)] hover:underline">
                  Cambiar
                </button>
              </div>
            ) : (
              <>
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[var(--color-text-muted)]" />
                  <input
                    type="text"
                    autoFocus
                    placeholder="Buscar proveedor…"
                    value={form.supplierSearch}
                    onChange={e => { setF('supplierSearch', e.target.value); setShowSupplierList(true); }}
                    onFocus={() => setShowSupplierList(true)}
                    className={klass(inpStyle, 'pl-9')}
                  />
                </div>
                {showSupplierList && filteredSuppliers.length > 0 && (
                  <div className="mt-1 rounded-lg border border-[var(--color-border)] bg-[var(--color-bg-app)] max-h-40 overflow-y-auto">
                    {filteredSuppliers.map(s => (
                      <button
                        key={s.id}
                        type="button"
                        onClick={() => { setF('supplierId', s.id); setF('supplierSearch', s.nombre); setShowSupplierList(false); }}
                        className="w-full text-left px-3 py-1.5 text-sm text-[var(--color-text-primary)] hover:bg-[var(--color-bg-card-hover)]"
                      >
                        {s.nombre}
                      </button>
                    ))}
                  </div>
                )}
              </>
            )}
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={lbl}>Fecha *</label>
              <input type="date" className={inpStyle} value={form.fecha} onChange={e => setF('fecha', e.target.value)} required />
            </div>
            <div>
              <label className={lbl}>Monto *</label>
              <div className="flex gap-2">
                <select className="rounded-lg border border-[var(--color-border)] bg-[var(--color-bg-app)] px-2 py-2 text-sm text-[var(--color-text-primary)]" value={form.moneda} onChange={e => setF('moneda', e.target.value as Moneda)}>
                  <option value="USD">USD</option><option value="UYU">UYU</option>
                </select>
                <input type="number" min="0" step="0.01" className={klass(inpStyle, 'flex-1')} value={form.monto} onChange={e => setF('monto', e.target.value)} required />
              </div>
            </div>
          </div>

          <div>
            <label className={lbl}>Método</label>
            <select className={inpStyle} value={form.metodo} onChange={e => setF('metodo', e.target.value as MetodoPago)}>
              <option value="TRANSFERENCIA">Transferencia</option>
              <option value="EFECTIVO">Efectivo</option>
              <option value="CHEQUE">Cheque</option>
              <option value="TARJETA_DEBITO">Tarjeta débito</option>
              <option value="TARJETA_CREDITO">Tarjeta crédito</option>
              <option value="OTRO">Otro</option>
            </select>
          </div>

          <div><label className={lbl}>Referencia</label><input className={inpStyle} value={form.referencia} onChange={e => setF('referencia', e.target.value)} placeholder="N° transferencia, cheque, etc." /></div>
          <div><label className={lbl}>Notas</label><textarea className={klass(inpStyle, 'resize-none')} rows={2} value={form.notas} onChange={e => setF('notas', e.target.value)} /></div>

          <label className="flex items-center gap-2 text-sm text-[var(--color-text-secondary)] cursor-pointer pt-1">
            <input type="checkbox" checked={form.aplicarAhora} onChange={e => setF('aplicarAhora', e.target.checked)} className="accent-[var(--color-accent)]" />
            Aplicar a facturas ahora
          </label>

          {error && <p className="text-sm text-red-400 bg-red-500/10 rounded-lg px-3 py-2">{error}</p>}
          <div className="flex gap-3 pt-2">
            <button type="submit" disabled={saving} className="flex-1 py-2 rounded-lg bg-[var(--color-accent)] text-gray-900 text-sm font-semibold hover:bg-[var(--color-accent-hover)] disabled:opacity-60">
              {saving ? 'Guardando…' : 'Registrar pago'}
            </button>
            <button type="button" onClick={onClose} className="px-4 py-2 rounded-lg border border-[var(--color-border)] text-sm text-[var(--color-text-secondary)] hover:bg-[var(--color-bg-card-hover)]">
              Cancelar
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

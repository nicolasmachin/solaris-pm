import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'react-hot-toast';
import { ArrowRight, AlertTriangle, DollarSign } from 'lucide-react';
import { Spinner } from '../components/ui/Spinner';
import { getMovements, transitionMovement } from '../api/finance.api';
import { NewPaymentForSupplierModal } from '../components/finance/NewPaymentForSupplierModal';
import { ApplyPaymentModal } from '../components/finance/ApplyPaymentModal';
import { InvoiceItemsDetail } from '../components/finance/InvoiceItemsDetail';
import { fmtCurrency, fmtDate } from '../lib/finance';
import {
  CATEGORIA_LABEL,
  STATUS_COLOR,
  STATUS_LABEL,
} from '../types/finance.types';
import type { FinanceMovement, FinanceMovementStatus } from '../types/finance.types';

function klass(...p: (string | false | undefined)[]) { return p.filter(Boolean).join(' '); }

const FILTERS_KEY = 'finance-apagar-filters-v1';
type RangeFilter = 'all' | 'overdue' | 'this-week' | 'this-month' | 'next-30';

interface PersistedFilters {
  range?: RangeFilter;
  projectId?: string;
  supplierId?: string;
}

function todayIso() { return new Date().toISOString().slice(0, 10); }
function isoDaysFromNow(days: number) {
  const d = new Date();
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
}
function endOfMonthIso() {
  const d = new Date();
  const last = new Date(d.getFullYear(), d.getMonth() + 1, 0);
  return last.toISOString().slice(0, 10);
}
function endOfWeekIso() {
  const d = new Date();
  const day = d.getDay();           // 0 = Sun
  const offset = day === 0 ? 0 : 7 - day;
  d.setDate(d.getDate() + offset);
  return d.toISOString().slice(0, 10);
}

export function FinanceAPagar() {
  const qc = useQueryClient();
  const [range, setRange] = useState<RangeFilter>('all');
  const [projectId, setProjectId] = useState<string>('');
  const [supplierId, setSupplierId] = useState<string>('');
  const [payForMov, setPayForMov] = useState<FinanceMovement | null>(null);
  const [createdPaymentId, setCreatedPaymentId] = useState<string | null>(null);
  const [preselectMovementForPay, setPreselectMovementForPay] = useState<string | null>(null);
  const [desgloseMovId, setDesgloseMovId] = useState<string | null>(null);

  // Persistencia
  useEffect(() => {
    try {
      const raw = localStorage.getItem(FILTERS_KEY);
      if (raw) {
        const p = JSON.parse(raw) as PersistedFilters;
        if (p.range) setRange(p.range);
        if (p.projectId) setProjectId(p.projectId);
        if (p.supplierId) setSupplierId(p.supplierId);
      }
    } catch { /* ignore */ }
  }, []);
  useEffect(() => {
    localStorage.setItem(FILTERS_KEY, JSON.stringify({ range, projectId, supplierId } satisfies PersistedFilters));
  }, [range, projectId, supplierId]);

  // Traemos COMPROMETIDOS, A_PAGAR y PARCIALMENTE_PAGADO en paralelo
  const queryComprometidos = useQuery({
    queryKey: ['finance-apagar', 'COMPROMETIDO'],
    queryFn: () => getMovements({ status: 'COMPROMETIDO', limit: 100 }),
  });
  const queryAPagar = useQuery({
    queryKey: ['finance-apagar', 'A_PAGAR'],
    queryFn: () => getMovements({ status: 'A_PAGAR', limit: 100 }),
  });
  const queryParcial = useQuery({
    queryKey: ['finance-apagar', 'PARCIALMENTE_PAGADO'],
    queryFn: () => getMovements({ status: 'PARCIALMENTE_PAGADO', limit: 100 }),
  });

  const isLoading = queryComprometidos.isLoading || queryAPagar.isLoading || queryParcial.isLoading;
  const all: FinanceMovement[] = useMemo(() => {
    const a = queryComprometidos.data?.data ?? [];
    const b = queryAPagar.data?.data ?? [];
    const c = queryParcial.data?.data ?? [];
    return [...a, ...b, ...c];
  }, [queryComprometidos.data, queryAPagar.data, queryParcial.data]);

  // Filtros de UI
  const filtered = useMemo(() => {
    const today = todayIso();
    const eow = endOfWeekIso();
    const eom = endOfMonthIso();
    const next30 = isoDaysFromNow(30);
    return all.filter(m => {
      const ref = m.dueDate ?? m.expectedDate;
      if (range === 'overdue') {
        if (!m.dueDate || (m.status !== 'A_PAGAR' && m.status !== 'PARCIALMENTE_PAGADO') || m.dueDate >= today) return false;
      } else if (range === 'this-week') {
        if (!ref || ref > eow || (m.dueDate && m.dueDate < today)) return false;
      } else if (range === 'this-month') {
        if (!ref || ref > eom) return false;
      } else if (range === 'next-30') {
        if (!ref || ref > next30) return false;
      }
      if (projectId && m.projectId !== projectId) return false;
      if (supplierId && m.supplierId !== supplierId) return false;
      return true;
    }).sort((a, b) => {
      const ar = a.dueDate ?? a.expectedDate ?? '9999-12-31';
      const br = b.dueDate ?? b.expectedDate ?? '9999-12-31';
      return ar < br ? -1 : ar > br ? 1 : 0;
    });
  }, [all, range, projectId, supplierId]);

  const today = todayIso();
  const eow = endOfWeekIso();

  // Totales se calculan sobre el saldoPendiente (no el monto total) para
  // reflejar lo que realmente queda por pagar.
  const totals = useMemo(() => {
    let comprometidoUsd = 0, comprometidoUyu = 0;
    let aPagarUsd = 0, aPagarUyu = 0;
    let vencidoUsd = 0, vencidoUyu = 0;
    let semanaUsd = 0, semanaUyu = 0;
    for (const m of all) {
      const isUsd = m.moneda === 'USD';
      const saldo = m.saldoPendiente;
      if (m.status === 'COMPROMETIDO') {
        if (isUsd) comprometidoUsd += saldo; else comprometidoUyu += saldo;
      } else if (m.status === 'A_PAGAR' || m.status === 'PARCIALMENTE_PAGADO') {
        if (isUsd) aPagarUsd += saldo; else aPagarUyu += saldo;
        if (m.dueDate && m.dueDate < today) {
          if (isUsd) vencidoUsd += saldo; else vencidoUyu += saldo;
        }
        if (m.dueDate && m.dueDate >= today && m.dueDate <= eow) {
          if (isUsd) semanaUsd += saldo; else semanaUyu += saldo;
        }
      }
    }
    return { comprometidoUsd, comprometidoUyu, aPagarUsd, aPagarUyu, vencidoUsd, vencidoUyu, semanaUsd, semanaUyu };
  }, [all, today, eow]);

  // Opciones de filtros (deduplicadas desde la lista)
  const projectOpts = useMemo(() => {
    const seen = new Set<string>();
    const opts: { id: string; label: string }[] = [];
    for (const m of all) {
      if (!m.project || seen.has(m.project.id)) continue;
      seen.add(m.project.id);
      opts.push({ id: m.project.id, label: m.project.clientName });
    }
    return opts.sort((a, b) => a.label.localeCompare(b.label));
  }, [all]);
  const supplierOpts = useMemo(() => {
    const seen = new Set<string>();
    const opts: { id: string; label: string }[] = [];
    for (const m of all) {
      if (!m.supplier || seen.has(m.supplier.id)) continue;
      seen.add(m.supplier.id);
      opts.push({ id: m.supplier.id, label: m.supplier.nombre });
    }
    return opts.sort((a, b) => a.label.localeCompare(b.label));
  }, [all]);

  const transitionMut = useMutation({
    mutationFn: (args: { id: string; newStatus: FinanceMovementStatus; paidDate?: string; dueDate?: string }) =>
      transitionMovement(args.id, { newStatus: args.newStatus, ...(args.paidDate ? { paidDate: args.paidDate } : {}), ...(args.dueDate ? { dueDate: args.dueDate } : {}) }),
    onSuccess: (r) => {
      qc.invalidateQueries({ queryKey: ['finance-apagar'] });
      qc.invalidateQueries({ queryKey: ['finance-movements'] });
      qc.invalidateQueries({ queryKey: ['finance-dashboard'] });
      if (r.requiresItemDetail) {
        toast.success('Estado actualizado · cargá el desglose de la factura');
        setDesgloseMovId(r.id);
      } else {
        toast.success('Estado actualizado');
      }
    },
    onError: (err: unknown) => {
      const msg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message;
      toast.error(msg ?? 'Error al actualizar');
    },
  });

  function handlePagar(mov: FinanceMovement) {
    const paid = window.prompt('Fecha de pago (YYYY-MM-DD):', todayIso());
    if (!paid) return;
    if (!/^\d{4}-\d{2}-\d{2}$/.test(paid)) { toast.error('Formato inválido'); return; }
    transitionMut.mutate({ id: mov.id, newStatus: 'PAGADO', paidDate: paid });
  }

  function handlePromover(mov: FinanceMovement) {
    const due = window.prompt('Fecha de vencimiento (YYYY-MM-DD):', todayIso());
    if (!due) return;
    if (!/^\d{4}-\d{2}-\d{2}$/.test(due)) { toast.error('Formato inválido'); return; }
    transitionMut.mutate({ id: mov.id, newStatus: 'A_PAGAR', dueDate: due });
  }

  const inp = 'rounded-lg border border-[var(--color-border)] bg-[var(--color-bg-card)] px-3 py-1.5 text-sm text-[var(--color-text-primary)] focus:outline-none focus:ring-1 focus:ring-[var(--color-accent)]';

  return (
    <div className="p-6 space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="font-display text-2xl font-bold text-[var(--color-text-primary)]">Cuentas a pagar</h1>
          <p className="text-sm text-[var(--color-text-muted)] mt-0.5">Compromisos y pagos pendientes</p>
        </div>
        <Link to="/finanzas/movimientos" className="text-xs text-[var(--color-accent)] hover:underline">
          ← Volver a movimientos
        </Link>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <KpiBox label="Comprometido" usd={totals.comprometidoUsd} uyu={totals.comprometidoUyu} tone="info" />
        <KpiBox label="A pagar" usd={totals.aPagarUsd} uyu={totals.aPagarUyu} tone="warning" />
        <KpiBox label="Vencido" usd={totals.vencidoUsd} uyu={totals.vencidoUyu} tone="danger" highlight={totals.vencidoUsd + totals.vencidoUyu > 0} />
        <KpiBox label="Vence esta semana" usd={totals.semanaUsd} uyu={totals.semanaUyu} tone="warning" />
      </div>

      {/* Filtros */}
      <div className="flex flex-wrap gap-2">
        <select className={inp} value={range} onChange={e => setRange(e.target.value as RangeFilter)}>
          <option value="all">Todos los vencimientos</option>
          <option value="overdue">Vencidos</option>
          <option value="this-week">Esta semana</option>
          <option value="this-month">Este mes</option>
          <option value="next-30">Próximos 30 días</option>
        </select>
        <select className={inp} value={projectId} onChange={e => setProjectId(e.target.value)}>
          <option value="">Todos los proyectos</option>
          {projectOpts.map(p => <option key={p.id} value={p.id}>{p.label}</option>)}
        </select>
        <select className={inp} value={supplierId} onChange={e => setSupplierId(e.target.value)}>
          <option value="">Todos los proveedores</option>
          {supplierOpts.map(s => <option key={s.id} value={s.id}>{s.label}</option>)}
        </select>
      </div>

      {/* Tabla */}
      <div className="bg-[var(--color-bg-card)] border border-[var(--color-border)] rounded-xl overflow-hidden">
        {isLoading ? (
          <div className="flex items-center justify-center py-12"><Spinner /></div>
        ) : filtered.length === 0 ? (
          <p className="text-sm text-[var(--color-text-muted)] text-center py-12">
            {all.length === 0 ? 'No hay compromisos pendientes' : 'Ningún movimiento coincide con los filtros'}
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-[var(--color-border)] text-xs font-mono text-[var(--color-text-muted)] uppercase tracking-wider">
                  {['Vencimiento', 'Descripción', 'Categoría', 'Proveedor', 'Proyecto', 'Monto', 'Estado', 'Acción'].map(h => (
                    <th key={h} className="px-4 py-3 text-left font-medium">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--color-border)]">
                {filtered.map(m => {
                  const ref = m.dueDate ?? m.expectedDate;
                  const overdue = m.status === 'A_PAGAR' && m.dueDate != null && m.dueDate < today;
                  return (
                    <tr key={m.id} className={klass('hover:bg-[var(--color-bg-card-hover)] transition-colors', overdue && 'bg-red-500/5')}>
                      <td className={klass('px-4 py-3 whitespace-nowrap', overdue ? 'text-red-400 font-semibold' : 'text-[var(--color-text-secondary)]')}>
                        {overdue && <AlertTriangle className="w-3.5 h-3.5 inline mr-1" />}
                        {ref ? fmtDate(ref) : '—'}
                        {!m.dueDate && m.expectedDate && <span className="text-[10px] text-[var(--color-text-muted)] ml-1">(esperada)</span>}
                      </td>
                      <td className="px-4 py-3 max-w-xs truncate text-[var(--color-text-primary)]">{m.descripcion}</td>
                      <td className="px-4 py-3 whitespace-nowrap text-[var(--color-text-secondary)]">{CATEGORIA_LABEL[m.categoriaPrincipal]}</td>
                      <td className="px-4 py-3 whitespace-nowrap text-[var(--color-text-muted)]">{m.supplier?.nombre ?? '—'}</td>
                      <td className="px-4 py-3 text-[var(--color-text-muted)] truncate max-w-[180px]">
                        {m.project ? (
                          <Link to={`/proyectos/${m.project.id}`} className="hover:underline" onClick={e => e.stopPropagation()} title={m.project.clientName}>
                            {m.project.clientName}
                          </Link>
                        ) : '—'}
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap font-semibold tabular-nums text-red-400">
                        <div>-{fmtCurrency(m.saldoPendiente, m.moneda)}</div>
                        {m.saldoPendiente !== m.monto && (
                          <div className="text-[10px] text-[var(--color-text-muted)] font-normal">de {fmtCurrency(m.monto, m.moneda)}</div>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        <span className={klass('text-[10px] font-mono px-2 py-0.5 rounded uppercase', STATUS_COLOR[m.status])}>
                          {STATUS_LABEL[m.status]}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-1">
                          {m.supplierId && (m.status === 'A_PAGAR' || m.status === 'PARCIALMENTE_PAGADO') && (
                            <button
                              onClick={() => setPayForMov(m)}
                              className="flex items-center gap-1 text-[10px] px-2 py-1 rounded bg-[var(--color-accent)] text-gray-900 font-semibold hover:bg-[var(--color-accent-hover)]"
                              title="Registrar pago"
                            >
                              <DollarSign className="w-3 h-3" />
                              Pagar
                            </button>
                          )}
                          {m.status === 'A_PAGAR' && !m.supplierId && (
                            <button
                              onClick={() => handlePagar(m)}
                              disabled={transitionMut.isPending}
                              className="flex items-center gap-1 text-[10px] px-2 py-1 rounded bg-[var(--color-state-done-bg)] text-[var(--color-state-done-text)] font-semibold hover:opacity-80 disabled:opacity-60"
                              title="Marcar como pagado (sin proveedor)"
                            >
                              <ArrowRight className="w-3 h-3" /> Pagado
                            </button>
                          )}
                          {m.status === 'COMPROMETIDO' && (
                            <button
                              onClick={() => handlePromover(m)}
                              disabled={transitionMut.isPending}
                              className="flex items-center gap-1 text-[10px] px-2 py-1 rounded bg-[var(--color-warning-bg)] text-[var(--color-warning-text)] font-semibold hover:opacity-80 disabled:opacity-60"
                            >
                              <ArrowRight className="w-3 h-3" /> A pagar
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {payForMov && payForMov.supplierId && payForMov.supplier && (
        <NewPaymentForSupplierModal
          supplierId={payForMov.supplierId}
          supplierName={payForMov.supplier.nombre}
          defaultAmount={payForMov.saldoPendiente}
          defaultMoneda={payForMov.moneda}
          onClose={() => setPayForMov(null)}
          onCreatedAndApply={(paymentId) => {
            setPreselectMovementForPay(payForMov.id);
            setCreatedPaymentId(paymentId);
            setPayForMov(null);
          }}
        />
      )}

      {createdPaymentId && (
        <ApplyPaymentModal
          paymentId={createdPaymentId}
          preselectMovementId={preselectMovementForPay ?? undefined}
          onClose={() => { setCreatedPaymentId(null); setPreselectMovementForPay(null); }}
        />
      )}

      {desgloseMovId && (
        <InvoiceItemsDetail
          movementId={desgloseMovId}
          onClose={() => {
            setDesgloseMovId(null);
            qc.invalidateQueries({ queryKey: ['finance-apagar'] });
            qc.invalidateQueries({ queryKey: ['finance-movements'] });
          }}
        />
      )}
    </div>
  );
}

function KpiBox({ label, usd, uyu, tone, highlight = false }: { label: string; usd: number; uyu: number; tone: 'info' | 'warning' | 'danger'; highlight?: boolean }) {
  const toneClass =
    tone === 'danger' ? (highlight ? 'border-red-500/40 bg-red-500/10' : 'border-[var(--color-border)] bg-[var(--color-bg-card)]') :
    tone === 'warning' ? 'border-[var(--color-warning-bg)] bg-[var(--color-bg-card)]' :
    'border-[var(--color-info-bg)] bg-[var(--color-bg-card)]';
  const valColor =
    tone === 'danger' ? 'text-red-400' :
    tone === 'warning' ? 'text-yellow-400' :
    'text-[var(--color-info-text)]';
  return (
    <div className={`rounded-xl border p-4 ${toneClass}`}>
      <p className="text-[10px] font-mono uppercase tracking-wider text-[var(--color-text-muted)] mb-1">{label}</p>
      <div className={`text-base font-bold tabular-nums ${valColor}`}>
        {usd > 0 && <div>{fmtCurrency(usd, 'USD')}</div>}
        {uyu > 0 && <div>{fmtCurrency(uyu, 'UYU')}</div>}
        {usd === 0 && uyu === 0 && <div className="text-[var(--color-text-muted)] font-normal text-sm">Sin pendientes</div>}
      </div>
    </div>
  );
}

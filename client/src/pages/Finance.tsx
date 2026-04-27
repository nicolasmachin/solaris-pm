import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'react-hot-toast';
import { TrendingUp, TrendingDown, Wallet, Clock, AlertTriangle, ArrowRight, RefreshCw, Plus } from 'lucide-react';
import { Spinner } from '../components/ui/Spinner';
import { getDashboard, getCashflow, getExchangeRate, createExchangeRate, getComprobantes, getBcuExchangeRatePreview, getPendingDetailMovements } from '../api/finance.api';
import { getStockAlerts } from '../api/stock.api';
import { fmtCurrency, fmtDate, currentMonthYear, MONTH_NAMES } from '../lib/finance';
import type { FinanceMovement, TipoMovimiento } from '../types/finance.types';

// ─── Shared helpers ────────────────────────────────────────────────────────────

function klass(...parts: (string | false | undefined)[]) {
  return parts.filter(Boolean).join(' ');
}

const TIPO_COLOR: Record<TipoMovimiento, string> = {
  INGRESO: 'bg-green-500/20 text-green-400',
  GASTO: 'bg-red-500/20 text-red-400',
  AJUSTE: 'bg-blue-500/20 text-blue-400',
};

const TIPO_BAR: Record<TipoMovimiento, string> = {
  INGRESO: 'bg-green-400',
  GASTO: 'bg-red-400',
  AJUSTE: 'bg-blue-400',
};

// ─── Exchange Rate Card ────────────────────────────────────────────────────────

function ExchangeRateCard() {
  const qc = useQueryClient();
  const { data: rate, isLoading } = useQuery({ queryKey: ['exchange-rate'], queryFn: getExchangeRate });
  const [modalOpen, setModalOpen] = useState(false);
  const [newRate, setNewRate] = useState('');
  const [saving, setSaving] = useState(false);
  const [bcuLoading, setBcuLoading] = useState(false);
  const [bcuInfo, setBcuInfo] = useState<{ fechaIso: string; usdToUyu: number } | null>(null);

  const today = new Date().toISOString().split('T')[0];

  async function handleSave() {
    const n = parseFloat(newRate);
    if (!n || n <= 0) { toast.error('Ingresá un valor válido'); return; }
    setSaving(true);
    try {
      await createExchangeRate({ date: today, usdToUyu: n });
      toast.success('Tipo de cambio actualizado');
      qc.invalidateQueries({ queryKey: ['exchange-rate'] });
      setModalOpen(false);
      setNewRate('');
      setBcuInfo(null);
    } catch {
      toast.error('Error al actualizar tipo de cambio');
    } finally {
      setSaving(false);
    }
  }

  async function handleConsultBcu() {
    setBcuLoading(true);
    try {
      const data = await getBcuExchangeRatePreview();
      setBcuInfo(data);
      setNewRate(data.usdToUyu.toString());
    } catch {
      toast.error('No se pudo consultar el BCU. Probá de nuevo o ingresá el valor a mano.');
    } finally {
      setBcuLoading(false);
    }
  }

  return (
    <>
      <div className="bg-[var(--color-bg-card)] border border-[var(--color-border)] rounded-xl px-5 py-4 flex items-center justify-between gap-4">
        <div>
          {isLoading ? (
            <span className="text-sm text-[var(--color-text-muted)]">Cargando tipo de cambio...</span>
          ) : rate ? (
            <>
              <p className="text-xs text-[var(--color-text-muted)] uppercase tracking-wider font-mono mb-0.5">Tipo de cambio</p>
              <p className="text-lg font-bold text-[var(--color-text-primary)]">1 USD = {rate.usdToUyu.toLocaleString('es-UY', { minimumFractionDigits: 2 })} UYU</p>
              <p className="text-xs text-[var(--color-text-muted)]">Actualizado: {fmtDate(rate.date)}</p>
            </>
          ) : (
            <p className="text-sm text-[var(--color-text-muted)]">Sin tipo de cambio registrado</p>
          )}
        </div>
        <button
          onClick={() => setModalOpen(true)}
          className="flex items-center gap-2 px-3 py-2 rounded-lg bg-[var(--color-border)] hover:bg-[var(--color-border-hover)] transition-colors text-sm text-[var(--color-text-secondary)]"
        >
          <RefreshCw className="w-4 h-4" />
          Actualizar
        </button>
      </div>

      {modalOpen && (
        <div
          className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4"
          onClick={e => { if (e.target === e.currentTarget) setModalOpen(false); }}
        >
          <div className="bg-[var(--color-bg-card)] border border-[var(--color-border)] rounded-xl p-6 w-full max-w-sm shadow-2xl">
            <h3 className="text-sm font-semibold text-[var(--color-text-primary)] mb-4">Actualizar tipo de cambio</h3>

            <button
              onClick={handleConsultBcu}
              disabled={bcuLoading}
              type="button"
              className="mb-3 inline-flex items-center gap-2 rounded-lg border border-[var(--color-border)] bg-[var(--color-bg-app)] px-3 py-2 text-xs text-[var(--color-text-secondary)] hover:bg-[var(--color-bg-card-hover)] transition-colors disabled:opacity-60"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${bcuLoading ? 'animate-spin' : ''}`} />
              {bcuLoading ? 'Consultando BCU...' : 'Consultar TC oficial del BCU'}
            </button>
            {bcuInfo ? (
              <p className="mb-3 text-[11px] text-[var(--color-text-muted)]">
                BCU sugiere <span className="font-semibold text-[var(--color-text-secondary)]">1 USD = {bcuInfo.usdToUyu.toLocaleString('es-UY', { minimumFractionDigits: 2 })} UYU</span> (cotización del {fmtDate(bcuInfo.fechaIso)}). Editalo si querés y dale Guardar.
              </p>
            ) : null}

            <label className="block text-xs text-[var(--color-text-muted)] mb-1 font-mono uppercase tracking-wider">1 USD = ? UYU</label>
            <input
              type="number"
              className="w-full rounded-lg border border-[var(--color-border)] bg-[var(--color-bg-app)] px-3 py-2 text-sm text-[var(--color-text-primary)] focus:outline-none focus:ring-2 focus:ring-[var(--color-accent)] mb-4"
              value={newRate}
              onChange={e => setNewRate(e.target.value)}
              autoFocus
              min="0"
              step="0.01"
            />
            <div className="flex gap-3">
              <button
                onClick={handleSave}
                disabled={saving}
                className="flex-1 py-2 rounded-lg bg-[var(--color-accent)] text-gray-900 text-sm font-semibold hover:bg-[var(--color-accent-hover)] transition-colors disabled:opacity-60"
              >
                {saving ? 'Guardando...' : 'Guardar'}
              </button>
              <button
                onClick={() => { setModalOpen(false); setBcuInfo(null); }}
                className="px-4 py-2 rounded-lg border border-[var(--color-border)] text-sm text-[var(--color-text-secondary)] hover:bg-[var(--color-bg-card-hover)] transition-colors"
              >
                Cancelar
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

// ─── KPI Card ─────────────────────────────────────────────────────────────────

function KpiCard({ label, value, moneda = 'USD', icon: Icon, colorClass, sub }: {
  label: string;
  value: number;
  moneda?: 'USD' | 'UYU';
  icon: React.ElementType;
  colorClass: string;
  sub?: string;
}) {
  return (
    <div className="bg-[var(--color-bg-card)] border border-[var(--color-border)] rounded-xl p-4 flex items-center gap-3">
      <div className={klass('w-10 h-10 rounded-lg flex items-center justify-center shrink-0', colorClass)}>
        <Icon className="w-5 h-5" />
      </div>
      <div className="min-w-0">
        <p className="text-xs text-[var(--color-text-muted)] truncate">{label}</p>
        <p className="text-base font-bold text-[var(--color-text-primary)] tabular-nums">{fmtCurrency(value, moneda)}</p>
        {sub && <p className="text-xs text-[var(--color-text-muted)]">{sub}</p>}
      </div>
    </div>
  );
}

// ─── Cuentas a pagar ──────────────────────────────────────────────────────────

function CuentasPagarWidget() {
  const { data: comprobantes = [], isLoading } = useQuery({
    queryKey: ['comprobantes-widget'],
    queryFn: () => getComprobantes({ estado: 'PENDIENTE' }),
    select: data => data.filter(c => c.estado !== 'PAGADO' && c.estado !== 'ANULADO'),
  });

  const today = new Date().toISOString().split('T')[0];
  const in7 = new Date(Date.now() + 7 * 86400000).toISOString().split('T')[0];

  const totalPendiente = comprobantes.reduce((s, c) => s + c.saldoPendiente, 0);
  const totalVencido = comprobantes.filter(c => c.fechaVencimiento && c.fechaVencimiento < today).reduce((s, c) => s + c.saldoPendiente, 0);
  const vencen7 = comprobantes.filter(c => c.fechaVencimiento && c.fechaVencimiento >= today && c.fechaVencimiento <= in7).reduce((s, c) => s + c.saldoPendiente, 0);

  if (isLoading) return (
    <div className="bg-[var(--color-bg-card)] border border-[var(--color-border)] rounded-xl p-5">
      <p className="text-sm font-semibold text-[var(--color-text-primary)] mb-3">Cuentas a pagar</p>
      <div className="space-y-2">{[1,2,3].map(i => <div key={i} className="h-8 rounded-lg bg-[var(--color-border)] animate-pulse" />)}</div>
    </div>
  );

  if (totalPendiente === 0) return (
    <div className="bg-[var(--color-bg-card)] border border-[var(--color-border)] rounded-xl p-5 flex items-center justify-between">
      <p className="text-sm font-semibold text-[var(--color-text-primary)]">Cuentas a pagar</p>
      <p className="text-sm text-[var(--color-text-muted)]">Sin deuda pendiente</p>
    </div>
  );

  const urgentes = comprobantes
    .filter(c => c.fechaVencimiento)
    .sort((a, b) => (a.fechaVencimiento ?? '') < (b.fechaVencimiento ?? '') ? -1 : 1)
    .slice(0, 5);

  return (
    <div className="bg-[var(--color-bg-card)] border border-[var(--color-border)] rounded-xl p-5 space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm font-semibold text-[var(--color-text-primary)]">Cuentas a pagar</p>
        <Link to="/finanzas/proveedores" className="text-xs text-[var(--color-accent)] hover:underline">Ver proveedores →</Link>
      </div>

      <div className="grid grid-cols-3 gap-3">
        {[
          { label: 'Total pendiente', value: totalPendiente, color: 'text-red-400' },
          { label: 'Vencido', value: totalVencido, color: totalVencido > 0 ? 'text-orange-400' : 'text-[var(--color-text-muted)]' },
          { label: 'Próximos 7d', value: vencen7, color: vencen7 > 0 ? 'text-yellow-400' : 'text-[var(--color-text-muted)]' },
        ].map(({ label, value, color }) => (
          <div key={label} className="text-center">
            <p className="text-xs text-[var(--color-text-muted)] mb-0.5">{label}</p>
            <p className={klass('text-sm font-bold tabular-nums', color)}>{fmtCurrency(value)}</p>
          </div>
        ))}
      </div>

      {urgentes.length > 0 && (
        <div className="space-y-1.5">
          {urgentes.map(c => {
            const vencido = c.fechaVencimiento && c.fechaVencimiento < today;
            return (
              <div key={c.id} className={klass('flex items-center justify-between gap-2 px-3 py-2 rounded-lg', vencido ? 'bg-red-500/10 border border-red-500/20' : 'bg-[var(--color-bg-app)]')}>
                <div className="min-w-0 flex-1">
                  <p className="text-xs font-medium text-[var(--color-text-primary)] truncate">{c.concepto}</p>
                  <p className="text-[11px] text-[var(--color-text-muted)]">
                    {c.supplier?.nombre ?? '—'} · {vencido ? '⚠ ' : ''}{fmtDate(c.fechaVencimiento)}
                  </p>
                </div>
                <p className="text-xs font-bold text-red-400 tabular-nums shrink-0">{fmtCurrency(c.saldoPendiente, c.moneda)}</p>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ─── Cashflow Section ─────────────────────────────────────────────────────────

function CashflowSection({ cashflow }: { cashflow: import('../types/finance.types').FinanceCashflow }) {
  const [includePrevistos, setIncludePrevistos] = useState(true);
  const projected = includePrevistos ? cashflow.saldoProyectado - cashflow.previstoTotal : cashflow.saldoProyectadoSinPrevistos;
  // Cuando el toggle está ON, "saldoProyectado" del backend ya considera todo lo no pagado (incluye previstos).
  // El backend devuelve `saldoProyectado` como saldoActual + porCobrar - porPagar (donde porPagar = todo lo no pagado).
  // Para que el toggle tenga efecto: si OFF, restamos sólo comprometido + a_pagar (sin previstos).
  const projectedFinal = includePrevistos ? cashflow.saldoProyectado : cashflow.saldoProyectadoSinPrevistos;
  void projected;
  return (
    <div className="bg-[var(--color-bg-card)] border border-[var(--color-border)] rounded-xl p-5">
      <div className="flex items-center justify-between mb-4 flex-wrap gap-2">
        <p className="text-sm font-semibold text-[var(--color-text-primary)]">Flujo de fondos proyectado</p>
        <label className="flex items-center gap-2 text-xs text-[var(--color-text-secondary)] cursor-pointer">
          <input type="checkbox" checked={includePrevistos} onChange={e => setIncludePrevistos(e.target.checked)} className="accent-[var(--color-accent)]" />
          Incluir previstos en proyección
        </label>
      </div>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
        {[
          { label: 'Saldo actual', value: cashflow.saldoActual, color: 'text-[var(--color-text-primary)]' },
          { label: 'Por cobrar', value: cashflow.porCobrar, color: 'text-green-400', prefix: '+' },
          { label: 'Por pagar', value: cashflow.porPagar, color: 'text-red-400', prefix: '-' },
          { label: 'Proyectado', value: projectedFinal, color: projectedFinal >= 0 ? 'text-[var(--color-text-primary)]' : 'text-red-400' },
        ].map(({ label, value, color, prefix }) => (
          <div key={label}>
            <p className="text-xs text-[var(--color-text-muted)] mb-1">{label}</p>
            <p className={klass('text-base font-bold tabular-nums', color)}>
              {prefix}{fmtCurrency(value)}
            </p>
          </div>
        ))}
      </div>
      <div className="grid grid-cols-3 gap-3 pt-4 border-t border-[var(--color-border)]">
        <CommitmentTile label="Previsto" value={cashflow.previstoTotal} tone="muted" />
        <CommitmentTile label="Comprometido" value={cashflow.comprometidoTotal} tone="info" />
        <CommitmentTile label="A pagar" value={cashflow.aPagarTotal} tone="warning" />
      </div>
    </div>
  );
}

function CommitmentTile({ label, value, tone }: { label: string; value: number; tone: 'muted' | 'info' | 'warning' }) {
  const color = tone === 'warning' ? 'text-yellow-400' : tone === 'info' ? 'text-[var(--color-info-text)]' : 'text-[var(--color-text-muted)]';
  return (
    <div className="text-center">
      <p className="text-[10px] font-mono uppercase tracking-wider text-[var(--color-text-muted)] mb-1">{label}</p>
      <p className={klass('text-sm font-semibold tabular-nums', color)}>
        {value > 0 ? `-${fmtCurrency(value)}` : '—'}
      </p>
    </div>
  );
}

// ─── Finance Page ─────────────────────────────────────────────────────────────

export function Finance() {
  const { mes, anio } = currentMonthYear();
  const mesLabel = `${MONTH_NAMES[mes - 1]} ${anio}`;

  const { data: dash, isLoading: loadingDash } = useQuery({
    queryKey: ['finance-dashboard', mes, anio],
    queryFn: () => getDashboard(mes, anio),
  });

  const { data: cashflow, isLoading: loadingCF } = useQuery({
    queryKey: ['finance-cashflow'],
    queryFn: () => getCashflow(),
  });

  const { data: alerts = [] } = useQuery({
    queryKey: ['stock-alerts'],
    queryFn: getStockAlerts,
  });

  const { data: pendingDetail = [] } = useQuery({
    queryKey: ['pending-detail'],
    queryFn: getPendingDetailMovements,
  });

  const loading = loadingDash || loadingCF;

  return (
    <div className="space-y-5 p-6">
      {/* Header */}
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="font-display text-2xl font-bold text-[var(--color-text-primary)]">Finanzas</h1>
          <p className="text-sm text-[var(--color-text-muted)] mt-0.5">{mesLabel}</p>
        </div>
        <div className="flex items-center gap-2">
          <Link
            to="/finanzas/pagos"
            className="inline-flex items-center gap-2 px-3 py-2 rounded-lg border border-[var(--color-border)] text-sm text-[var(--color-text-secondary)] hover:bg-[var(--color-bg-card-hover)] transition-colors shrink-0"
          >
            Pagos
          </Link>
          <Link
            to="/finanzas/a-pagar"
            className="inline-flex items-center gap-2 px-3 py-2 rounded-lg border border-[var(--color-border)] text-sm text-[var(--color-text-secondary)] hover:bg-[var(--color-bg-card-hover)] transition-colors shrink-0"
          >
            Cuentas a pagar
          </Link>
          <Link
            to="/finanzas/movimientos?new=1"
            className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-[var(--color-accent)] text-gray-900 text-sm font-semibold hover:bg-[var(--color-accent-hover)] transition-colors shrink-0"
          >
            <Plus className="w-4 h-4" />
            Nuevo movimiento
          </Link>
        </div>
      </div>

      {/* Tipo de cambio */}
      <ExchangeRateCard />

      {/* Stock alerts */}
      {alerts.length > 0 && (
        <Link to="/stock" className="flex items-center gap-3 bg-yellow-500/10 border border-yellow-500/30 rounded-xl px-5 py-3 hover:bg-yellow-500/15 transition-colors">
          <AlertTriangle className="w-5 h-5 text-yellow-400 shrink-0" />
          <span className="text-sm text-yellow-300 font-medium">{alerts.length} producto{alerts.length > 1 ? 's' : ''} con stock bajo mínimo</span>
          <ArrowRight className="w-4 h-4 text-yellow-400 ml-auto" />
        </Link>
      )}

      {/* Movimientos pendientes de desglose */}
      {pendingDetail.length > 0 && (
        <Link to="/finanzas/movimientos" className="flex items-center gap-3 bg-amber-500/10 border border-amber-500/30 rounded-xl px-5 py-3 hover:bg-amber-500/15 transition-colors">
          <AlertTriangle className="w-5 h-5 text-amber-400 shrink-0" />
          <span className="text-sm text-amber-300 font-medium">
            {pendingDetail.length} factura{pendingDetail.length > 1 ? 's' : ''} pendiente{pendingDetail.length > 1 ? 's' : ''} de desglose
          </span>
          <span className="text-xs text-amber-200/80">— el stock todavía no ingresó</span>
          <ArrowRight className="w-4 h-4 text-amber-400 ml-auto" />
        </Link>
      )}

      {/* KPI grid */}
      {loading ? (
        <div className="grid grid-cols-2 lg:grid-cols-3 gap-4">
          {[1,2,3,4,5].map(i => <div key={i} className="h-20 bg-[var(--color-bg-card)] border border-[var(--color-border)] rounded-xl animate-pulse" />)}
        </div>
      ) : (
        <div className="grid grid-cols-2 lg:grid-cols-3 gap-4">
          <KpiCard label="Ingresos del mes" value={dash?.ingresos ?? 0} icon={TrendingUp} colorClass="bg-green-500/15 text-green-400" />
          <KpiCard label="Gastos del mes" value={dash?.gastos ?? 0} icon={TrendingDown} colorClass="bg-red-500/15 text-red-400" />
          <KpiCard
            label="Resultado"
            value={dash?.resultado ?? 0}
            icon={Wallet}
            colorClass={(dash?.resultado ?? 0) >= 0 ? 'bg-[var(--color-info-bg)] text-[var(--color-info-text)]' : 'bg-orange-500/15 text-orange-400'}
          />
          <KpiCard label="Pendiente cobro" value={dash?.pendienteCobro ?? 0} icon={Clock} colorClass="bg-yellow-500/15 text-yellow-400" sub="por cobrar" />
          <KpiCard label="Pendiente pago" value={dash?.pendientePago ?? 0} icon={Clock} colorClass="bg-orange-500/15 text-orange-400" sub="por pagar" />
        </div>
      )}

      {/* Flujo de fondos */}
      {!loading && cashflow && <CashflowSection cashflow={cashflow} />}

      {/* DEPRECADO: widget de Comprobantes — reemplazado por Payment + PaymentApplication
          en v2.4. La página /finanzas/a-pagar y /finanzas/pagos cubren este flujo.
          Mantener oculto hasta confirmar no-uso (revisar mayo 2026).
      <CuentasPagarWidget /> */}

      {/* Últimos movimientos */}
      <div className="bg-[var(--color-bg-card)] border border-[var(--color-border)] rounded-xl overflow-hidden">
        <div className="flex items-center justify-between px-5 py-4 border-b border-[var(--color-border)]">
          <p className="text-sm font-semibold text-[var(--color-text-primary)]">Últimos movimientos</p>
          <Link to="/finanzas/movimientos" className="flex items-center gap-1 text-xs text-[var(--color-accent)] hover:underline">
            Ver todos <ArrowRight className="w-3 h-3" />
          </Link>
        </div>
        {loadingDash ? (
          <div className="flex items-center justify-center py-8"><Spinner /></div>
        ) : !dash?.ultimosMovimientos?.length ? (
          <p className="text-sm text-[var(--color-text-muted)] text-center py-8">No hay movimientos registrados</p>
        ) : (
          <div className="divide-y divide-[var(--color-border)]">
            {dash.ultimosMovimientos.map(mov => (
              <div key={mov.id} className="px-5 py-3 flex items-center gap-3">
                <div className={klass('w-1.5 h-8 rounded-full shrink-0', TIPO_BAR[mov.tipoMovimiento])} />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-[var(--color-text-primary)] truncate">{mov.descripcion}</p>
                  <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                    <span className="text-xs text-[var(--color-text-muted)]">{fmtDate(mov.fecha)}</span>
                    {mov.project && (
                      <span className="text-[10px] font-mono bg-[var(--color-info-bg)] text-[var(--color-info-text)] px-1.5 py-0.5 rounded uppercase">
                        {mov.project.code}
                      </span>
                    )}
                  </div>
                </div>
                <div className="text-right shrink-0">
                  <p className={klass('text-sm font-semibold tabular-nums',
                    mov.tipoMovimiento === 'INGRESO' ? 'text-green-400' :
                    mov.tipoMovimiento === 'AJUSTE' ? 'text-blue-400' : 'text-red-400'
                  )}>
                    {mov.tipoMovimiento === 'GASTO' ? '-' : '+'}{fmtCurrency(mov.monto, mov.moneda)}
                  </p>
                  <span className={klass('text-[10px] font-mono px-1.5 py-0.5 rounded uppercase', TIPO_COLOR[mov.tipoMovimiento])}>
                    {mov.tipoMovimiento}
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

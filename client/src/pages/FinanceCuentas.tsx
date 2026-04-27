import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { ArrowLeft, X, ArrowDown, ArrowUp, Wallet, CreditCard, Banknote, MoreHorizontal } from 'lucide-react';
import { Spinner } from '../components/ui/Spinner';
import { getAccounts, getAccountsSummary } from '../api/accounts.api';
import { getMovements } from '../api/finance.api';
import { getPayments } from '../api/payments.api';
import { fmtCurrency, fmtDate } from '../lib/finance';
import type { Account } from '../types/accounts.types';
import { ACCOUNT_TYPE_LABEL } from '../types/accounts.types';

function klass(...p: (string | false | undefined)[]) { return p.filter(Boolean).join(' '); }

const TYPE_ICON = {
  BANCO: Banknote,
  EFECTIVO: Wallet,
  TARJETA: CreditCard,
  OTRO: MoreHorizontal,
} as const;

export function FinanceCuentas() {
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const { data: summary, isLoading: loadingSummary } = useQuery({
    queryKey: ['accounts-summary'],
    queryFn: getAccountsSummary,
  });

  const { data: accounts = [] } = useQuery({
    queryKey: ['accounts', 'all'],
    queryFn: () => getAccounts({ activa: 'all' }),
  });

  return (
    <div className="p-6 space-y-5">
      <div className="flex items-start justify-between flex-wrap gap-3">
        <div>
          <Link to="/finanzas" className="inline-flex items-center gap-1 text-xs text-[var(--color-accent)] hover:underline mb-2">
            <ArrowLeft className="w-3 h-3" /> Finanzas
          </Link>
          <h1 className="font-display text-2xl font-bold text-[var(--color-text-primary)]">Cuentas</h1>
          <p className="text-sm text-[var(--color-text-muted)] mt-0.5">Cajas, bancos y otras cuentas de pago</p>
        </div>
        <Link to="/admin" className="text-xs text-[var(--color-accent)] hover:underline">
          Gestionar cuentas en Admin →
        </Link>
      </div>

      {/* Total unificado */}
      {loadingSummary || !summary ? (
        <div className="flex items-center justify-center py-8"><Spinner /></div>
      ) : (
        <>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <SummaryBox label="Total USD" value={summary.totalesPorMoneda.USD} moneda="USD" tone="primary" />
            <SummaryBox label="Total UYU" value={summary.totalesPorMoneda.UYU} moneda="UYU" tone="primary" />
            <SummaryBox
              label="Total unificado"
              value={summary.totalUnificadoUSD}
              moneda="USD"
              tone="accent"
              subtitle={summary.exchangeRate ? `con TC ${summary.exchangeRate.usdToUyu.toLocaleString('es-UY', { minimumFractionDigits: 2 })}` : 'sin TC'}
            />
          </div>

          {/* Cards por cuenta */}
          {summary.porCuenta.length === 0 ? (
            <div className="rounded-xl border border-dashed border-[var(--color-border)] p-8 text-center">
              <p className="text-sm text-[var(--color-text-muted)] mb-3">Aún no hay cuentas registradas.</p>
              <Link to="/admin" className="inline-flex items-center gap-1 text-sm text-[var(--color-accent)] hover:underline">
                Crear primera cuenta en Admin →
              </Link>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
              {summary.porCuenta.map(c => {
                const account = accounts.find(a => a.id === c.id);
                const Icon = TYPE_ICON[c.tipo];
                return (
                  <button
                    key={c.id}
                    onClick={() => setSelectedId(c.id)}
                    className="text-left rounded-xl border border-[var(--color-border)] bg-[var(--color-bg-card)] p-4 hover:bg-[var(--color-bg-card-hover)] transition-colors"
                  >
                    <div className="flex items-start justify-between gap-2 mb-3">
                      <div className="flex items-center gap-2 min-w-0">
                        <div className="w-8 h-8 rounded-lg bg-[var(--color-info-bg)] text-[var(--color-info-text)] flex items-center justify-center shrink-0">
                          <Icon className="w-4 h-4" />
                        </div>
                        <div className="min-w-0">
                          <p className="text-sm font-semibold text-[var(--color-text-primary)] truncate">{c.nombre}</p>
                          <p className="text-[10px] font-mono uppercase text-[var(--color-text-muted)]">{ACCOUNT_TYPE_LABEL[c.tipo]} · {c.moneda}</p>
                        </div>
                      </div>
                      {account && !account.activa && (
                        <span className="text-[9px] font-mono uppercase px-1.5 py-0.5 rounded bg-[var(--color-border)] text-[var(--color-text-muted)] shrink-0">Inactiva</span>
                      )}
                    </div>
                    <p className={klass(
                      'text-xl font-bold tabular-nums',
                      c.saldoActual < 0 ? 'text-red-400' : 'text-[var(--color-text-primary)]',
                    )}>
                      {fmtCurrency(c.saldoActual, c.moneda)}
                    </p>
                    {account?.saldoInicial !== undefined && (
                      <p className="text-[11px] text-[var(--color-text-muted)] mt-1">
                        Inicial: {fmtCurrency(account.saldoInicial, c.moneda)}
                      </p>
                    )}
                  </button>
                );
              })}
            </div>
          )}
        </>
      )}

      {selectedId && (
        <AccountDrawer accountId={selectedId} onClose={() => setSelectedId(null)} />
      )}
    </div>
  );
}

// ─── Summary card ─────────────────────────────────────────────────────────────

function SummaryBox({ label, value, moneda, tone, subtitle }: {
  label: string; value: number; moneda: 'USD' | 'UYU';
  tone: 'primary' | 'accent';
  subtitle?: string;
}) {
  const toneClass = tone === 'accent'
    ? 'border-[var(--color-accent)]/40 bg-[var(--color-warning-bg)]/30'
    : 'border-[var(--color-border)]';
  return (
    <div className={klass('rounded-xl border bg-[var(--color-bg-card)] p-4', toneClass)}>
      <p className="text-[10px] font-mono uppercase tracking-wider text-[var(--color-text-muted)] mb-1">{label}</p>
      <p className={klass(
        'text-xl font-bold tabular-nums',
        value < 0 ? 'text-red-400' : 'text-[var(--color-text-primary)]',
      )}>
        {fmtCurrency(value, moneda)}
      </p>
      {subtitle && <p className="text-[11px] text-[var(--color-text-muted)] mt-1">{subtitle}</p>}
    </div>
  );
}

// ─── Drawer del detalle de cuenta ─────────────────────────────────────────────

function AccountDrawer({ accountId, onClose }: { accountId: string; onClose: () => void }) {
  const { data: accounts = [] } = useQuery({
    queryKey: ['accounts', 'all'],
    queryFn: () => getAccounts({ activa: 'all' }),
  });
  const account = accounts.find(a => a.id === accountId);

  const { data: movements } = useQuery({
    queryKey: ['account-movements', accountId],
    // Traemos hasta 100 mov pagados/cobrados con esta cuenta
    queryFn: () => getMovements({ limit: 100 }),
  });

  const { data: payments = [] } = useQuery({
    queryKey: ['account-payments', accountId],
    queryFn: () => getPayments(),
  });

  // Filtrar localmente — el endpoint actual no filtra por accountId
  const movs = useMemo(() => {
    if (!movements?.data) return [];
    return movements.data.filter(m => {
      if ((m as unknown as { accountId?: string }).accountId !== accountId) return false;
      // Sólo los que afectan saldo
      return (m.tipoMovimiento === 'GASTO' && m.pagado) || (m.tipoMovimiento === 'INGRESO' && m.cobrado);
    });
  }, [movements, accountId]);

  const pays = useMemo(() => payments.filter(p => p.accountId === accountId), [payments, accountId]);

  // Mezclar en una sola línea de tiempo descendente
  type Row = { id: string; fecha: string; tipo: 'in' | 'out'; descripcion: string; monto: number; moneda: 'USD' | 'UYU' };
  const timeline = useMemo<Row[]>(() => {
    const rows: Row[] = [];
    for (const m of movs) {
      rows.push({
        id: m.id,
        fecha: m.fecha,
        tipo: m.tipoMovimiento === 'INGRESO' ? 'in' : 'out',
        descripcion: m.descripcion,
        monto: m.monto,
        moneda: m.moneda,
      });
    }
    for (const p of pays) {
      rows.push({
        id: p.id,
        fecha: p.fecha,
        tipo: p.monto < 0 ? 'in' : 'out',
        descripcion: `Pago a ${p.supplier?.nombre ?? '—'}${p.referencia ? ` · ${p.referencia}` : ''}`,
        monto: Math.abs(p.monto),
        moneda: p.moneda,
      });
    }
    rows.sort((a, b) => b.fecha.localeCompare(a.fecha));
    return rows;
  }, [movs, pays]);

  if (!account) {
    return (
      <div className="fixed inset-0 z-40 flex justify-end" onClick={e => { if (e.target === e.currentTarget) onClose(); }}>
        <div className="w-full max-w-md bg-[var(--color-bg-card)] border-l border-[var(--color-border)] h-full p-6">
          <p className="text-sm text-[var(--color-text-muted)]">Cargando...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 z-40 flex justify-end" onClick={e => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="w-full max-w-lg bg-[var(--color-bg-card)] border-l border-[var(--color-border)] h-full overflow-y-auto shadow-2xl">
        <div className="p-5 border-b border-[var(--color-border)] flex items-center justify-between">
          <div>
            <p className="text-sm font-semibold text-[var(--color-text-primary)]">{account.nombre}</p>
            <p className="text-xs text-[var(--color-text-muted)] mt-0.5">{ACCOUNT_TYPE_LABEL[account.tipo]} · {account.moneda}</p>
          </div>
          <button onClick={onClose} className="text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)]"><X className="w-5 h-5" /></button>
        </div>

        <div className="p-5 border-b border-[var(--color-border)]">
          {account.balance ? (
            <>
              <p className="text-[10px] font-mono uppercase tracking-wider text-[var(--color-text-muted)] mb-1">Saldo actual</p>
              <p className={klass(
                'text-2xl font-bold tabular-nums',
                account.balance.saldoActual < 0 ? 'text-red-400' : 'text-[var(--color-text-primary)]',
              )}>
                {fmtCurrency(account.balance.saldoActual, account.moneda)}
              </p>
              <div className="grid grid-cols-3 gap-2 mt-3 text-xs">
                <div>
                  <p className="text-[10px] text-[var(--color-text-muted)]">Inicial</p>
                  <p className="font-semibold tabular-nums">{fmtCurrency(account.balance.saldoInicial, account.moneda)}</p>
                </div>
                <div>
                  <p className="text-[10px] text-green-500">+ Ingresos</p>
                  <p className="font-semibold tabular-nums text-green-500">{fmtCurrency(account.balance.ingresos, account.moneda)}</p>
                </div>
                <div>
                  <p className="text-[10px] text-red-500">− Salidas</p>
                  <p className="font-semibold tabular-nums text-red-500">{fmtCurrency(account.balance.gastos + account.balance.pagos, account.moneda)}</p>
                </div>
              </div>
            </>
          ) : (
            <p className="text-xs text-[var(--color-text-muted)]">Saldo no disponible</p>
          )}
          {account.notas && <p className="mt-3 text-[11px] italic text-[var(--color-text-muted)]">"{account.notas}"</p>}
        </div>

        <div className="p-5">
          <p className="text-xs font-semibold text-[var(--color-text-primary)] mb-3">Movimientos ({timeline.length})</p>
          {timeline.length === 0 ? (
            <p className="text-sm text-[var(--color-text-muted)] text-center py-6">Sin movimientos en esta cuenta</p>
          ) : (
            <div className="space-y-1.5">
              {timeline.map(row => (
                <div key={row.id} className="flex items-center gap-3 px-3 py-2 rounded-lg bg-[var(--color-bg-app)] border border-[var(--color-border)]">
                  <div className={klass(
                    'w-7 h-7 rounded-md flex items-center justify-center shrink-0',
                    row.tipo === 'in' ? 'bg-green-500/10 text-green-500' : 'bg-red-500/10 text-red-500',
                  )}>
                    {row.tipo === 'in' ? <ArrowDown className="w-3.5 h-3.5" /> : <ArrowUp className="w-3.5 h-3.5" />}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-medium text-[var(--color-text-primary)] truncate">{row.descripcion}</p>
                    <p className="text-[10px] text-[var(--color-text-muted)]">{fmtDate(row.fecha)}</p>
                  </div>
                  <p className={klass(
                    'text-sm font-semibold tabular-nums shrink-0',
                    row.tipo === 'in' ? 'text-green-500' : 'text-red-500',
                  )}>
                    {row.tipo === 'in' ? '+' : '−'}{fmtCurrency(row.monto, row.moneda)}
                  </p>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

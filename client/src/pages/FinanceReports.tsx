import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Spinner } from '../components/ui/Spinner';
import { getResults, getCashflow } from '../api/finance.api';
import { fmtCurrency, currentMonthYear, MONTH_NAMES } from '../lib/finance';

function klass(...p: (string | false | undefined)[]) { return p.filter(Boolean).join(' '); }

function numCell(v: number, highlight = false) {
  const negative = v < 0;
  return (
    <span className={klass('tabular-nums', highlight && 'font-bold', negative ? 'text-red-400' : '')}>
      {fmtCurrency(v)}
    </span>
  );
}

// ─── Estado de Resultados ─────────────────────────────────────────────────────

function TabResultados() {
  const { anio: curAnio } = currentMonthYear();
  const [anio, setAnio] = useState(curAnio);

  const { data, isLoading } = useQuery({
    queryKey: ['finance-results', anio],
    queryFn: () => getResults(anio),
  });

  type RowKey = 'entradas' | 'costoInstalaciones' | 'resultadoBruto' | 'costosFijos' | 'costosVariables' | 'totalCostosOp' | 'resultadoOperativo';
  const rows: { key: RowKey; label: string; highlight?: boolean }[] = [
    { key: 'entradas', label: 'Entradas' },
    { key: 'costoInstalaciones', label: 'Costo instalaciones' },
    { key: 'resultadoBruto', label: 'Resultado bruto', highlight: true },
    { key: 'costosFijos', label: 'Costos fijos' },
    { key: 'costosVariables', label: 'Costos variables' },
    { key: 'totalCostosOp', label: 'Total costos operativos' },
    { key: 'resultadoOperativo', label: 'Resultado operativo', highlight: true },
  ];

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <label className="text-sm text-[var(--color-text-muted)]">Año:</label>
        <select
          className="rounded-lg border border-[var(--color-border)] bg-[var(--color-bg-card)] px-3 py-1.5 text-sm text-[var(--color-text-primary)] focus:outline-none focus:ring-1 focus:ring-[var(--color-accent)]"
          value={anio}
          onChange={e => setAnio(Number(e.target.value))}
        >
          {[curAnio - 2, curAnio - 1, curAnio, curAnio + 1].map(y => <option key={y} value={y}>{y}</option>)}
        </select>
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center py-12"><Spinner /></div>
      ) : !data ? (
        <p className="text-sm text-[var(--color-text-muted)] py-8 text-center">Sin datos para {anio}</p>
      ) : (
        <div className="bg-[var(--color-bg-card)] border border-[var(--color-border)] rounded-xl overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-[var(--color-border)]">
                  <th className="px-4 py-3 text-left text-xs font-mono text-[var(--color-text-muted)] uppercase tracking-wider sticky left-0 bg-[var(--color-bg-card)] min-w-40">
                    Concepto
                  </th>
                  {MONTH_NAMES.map((m, i) => (
                    <th key={i} className="px-3 py-3 text-right text-xs font-mono text-[var(--color-text-muted)] uppercase tracking-wider whitespace-nowrap min-w-28">
                      {m}
                    </th>
                  ))}
                  <th className="px-4 py-3 text-right text-xs font-mono text-[var(--color-accent)] uppercase tracking-wider whitespace-nowrap min-w-32 bg-[var(--color-border)]/20">
                    Total
                  </th>
                </tr>
              </thead>
              <tbody>
                {rows.map(({ key, label, highlight }) => (
                  <tr key={key} className={klass('border-b border-[var(--color-border)]', highlight && 'bg-[var(--color-border)]/10')}>
                    <td className={klass('px-4 py-2.5 text-sm sticky left-0 bg-inherit',
                      highlight ? 'font-semibold text-[var(--color-text-primary)]' : 'text-[var(--color-text-secondary)]')}>
                      {label}
                    </td>
                    {data.meses.map(m => (
                      <td key={m.mes} className="px-3 py-2.5 text-right text-xs">
                        {numCell(m[key], highlight)}
                      </td>
                    ))}
                    <td className={klass('px-4 py-2.5 text-right text-xs bg-[var(--color-border)]/20', highlight && 'font-bold')}>
                      {numCell(data.totales[key], highlight)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Flujo de Fondos ──────────────────────────────────────────────────────────

function TabCashflow() {
  const [desde, setDesde] = useState('');
  const [hasta, setHasta] = useState('');

  const { data, isLoading, refetch } = useQuery({
    queryKey: ['finance-cashflow', desde, hasta],
    queryFn: () => getCashflow({
      ...(desde ? { fechaDesde: desde } : {}),
      ...(hasta ? { fechaHasta: hasta } : {}),
    }),
  });

  const inp = 'rounded-lg border border-[var(--color-border)] bg-[var(--color-bg-card)] px-3 py-1.5 text-sm text-[var(--color-text-primary)] focus:outline-none focus:ring-1 focus:ring-[var(--color-accent)]';

  return (
    <div className="space-y-5">
      {/* Date filters */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="flex items-center gap-2">
          <label className="text-sm text-[var(--color-text-muted)]">Desde:</label>
          <input type="date" className={inp} value={desde} onChange={e => setDesde(e.target.value)} />
        </div>
        <div className="flex items-center gap-2">
          <label className="text-sm text-[var(--color-text-muted)]">Hasta:</label>
          <input type="date" className={inp} value={hasta} onChange={e => setHasta(e.target.value)} />
        </div>
        <button onClick={() => refetch()}
          className="px-3 py-1.5 rounded-lg bg-[var(--color-border)] hover:bg-[var(--color-border-hover)] text-sm text-[var(--color-text-secondary)] transition-colors">
          Aplicar
        </button>
        {(desde || hasta) && (
          <button onClick={() => { setDesde(''); setHasta(''); }}
            className="text-xs text-[var(--color-text-muted)] hover:text-[var(--color-text-secondary)]">
            Limpiar
          </button>
        )}
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center py-12"><Spinner /></div>
      ) : !data ? null : (
        <div className="space-y-4">
          {/* KPI grid */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {[
              { label: 'Saldo actual', value: data.saldoActual, color: 'text-[var(--color-text-primary)]', bg: 'bg-[var(--color-bg-card)]' },
              { label: 'Por cobrar', value: data.porCobrar, color: 'text-green-400', bg: 'bg-green-500/5' },
              { label: 'Por pagar', value: data.porPagar, color: 'text-red-400', bg: 'bg-red-500/5' },
              {
                label: 'Saldo proyectado',
                value: data.saldoProyectado,
                color: data.saldoProyectado >= 0 ? 'text-[var(--color-text-primary)]' : 'text-red-400',
                bg: data.saldoProyectado >= 0 ? 'bg-[var(--color-bg-card)]' : 'bg-red-500/5',
              },
            ].map(({ label, value, color, bg }) => (
              <div key={label} className={klass('border border-[var(--color-border)] rounded-xl p-4', bg)}>
                <p className="text-xs text-[var(--color-text-muted)] mb-1">{label}</p>
                <p className={klass('text-xl font-bold tabular-nums', color)}>{fmtCurrency(value)}</p>
              </div>
            ))}
          </div>

          {/* Saldo proyectado destacado */}
          <div className={klass(
            'border rounded-xl p-6 text-center',
            data.saldoProyectado >= 0 ? 'border-green-500/30 bg-green-500/5' : 'border-red-500/30 bg-red-500/5'
          )}>
            <p className="text-xs text-[var(--color-text-muted)] uppercase tracking-wider font-mono mb-2">Saldo proyectado total</p>
            <p className={klass('text-4xl font-display font-bold tabular-nums', data.saldoProyectado >= 0 ? 'text-green-400' : 'text-red-400')}>
              {fmtCurrency(data.saldoProyectado)}
            </p>
            <p className="text-xs text-[var(--color-text-muted)] mt-2">
              Saldo actual {fmtCurrency(data.saldoActual)} + cobrar {fmtCurrency(data.porCobrar)} − pagar {fmtCurrency(data.porPagar)}
            </p>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Finance Reports Page ─────────────────────────────────────────────────────

type ReportTab = 'resultados' | 'cashflow';

export function FinanceReports() {
  const [tab, setTab] = useState<ReportTab>('resultados');

  const tabs: { id: ReportTab; label: string }[] = [
    { id: 'resultados', label: 'Estado de resultados' },
    { id: 'cashflow', label: 'Flujo de fondos' },
  ];

  return (
    <div className="p-6 space-y-5">
      <div>
        <h1 className="font-display text-2xl font-bold text-[var(--color-text-primary)]">Reportes financieros</h1>
        <p className="text-sm text-[var(--color-text-muted)] mt-0.5">Análisis de resultados y flujo de caja</p>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-[var(--color-border)]">
        {tabs.map(t => (
          <button key={t.id} onClick={() => setTab(t.id)}
            className={klass('px-5 py-2.5 text-sm font-medium border-b-2 transition-colors',
              tab === t.id
                ? 'border-[var(--color-accent)] text-[var(--color-accent)]'
                : 'border-transparent text-[var(--color-text-muted)] hover:text-[var(--color-text-secondary)]'
            )}>
            {t.label}
          </button>
        ))}
      </div>

      {tab === 'resultados' && <TabResultados />}
      {tab === 'cashflow' && <TabCashflow />}
    </div>
  );
}

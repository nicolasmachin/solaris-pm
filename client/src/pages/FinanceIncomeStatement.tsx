import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { ChevronDown, ChevronRight } from 'lucide-react';
import { Spinner } from '../components/ui/Spinner';
import { getIncomeStatement, getIncomeStatementYearly } from '../api/finance.api';
import type { CategoriaSummary } from '../api/finance.api';
import { fmtCurrency, MONTH_NAMES } from '../lib/finance';
import { CATEGORIA_LABEL } from '../types/finance.types';
import type { CategoriaPrincipal } from '../types/finance.types';

function klass(...p: (string | false | undefined)[]) { return p.filter(Boolean).join(' '); }

function formatPct(v: number) {
  return `${v.toFixed(1)}%`;
}

function categoriaLabel(c: string): string {
  return CATEGORIA_LABEL[c as CategoriaPrincipal] ?? c;
}

const today = new Date();
const DEFAULT_MES = today.getUTCMonth() + 1;
const DEFAULT_ANIO = today.getUTCFullYear();

export function FinanceIncomeStatement() {
  const [mes, setMes] = useState(DEFAULT_MES);
  const [anio, setAnio] = useState(DEFAULT_ANIO);

  const { data, isLoading } = useQuery({
    queryKey: ['income-statement', mes, anio],
    queryFn: () => getIncomeStatement(mes, anio),
  });

  const { data: yearly } = useQuery({
    queryKey: ['income-statement-yearly', anio],
    queryFn: () => getIncomeStatementYearly(anio),
  });

  return (
    <div className="p-6 space-y-5">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="font-display text-2xl font-bold text-[var(--color-text-primary)]">Estado de resultado</h1>
          <p className="text-sm text-[var(--color-text-muted)] mt-0.5">P&amp;L mensual basado en plata real (PAGADOS / COBRADOS)</p>
        </div>
        <div className="flex gap-2">
          <select
            value={mes}
            onChange={e => setMes(Number(e.target.value))}
            className="px-3 py-2 rounded-lg border border-[var(--color-border)] bg-[var(--color-bg-card)] text-sm text-[var(--color-text-primary)]"
          >
            {MONTH_NAMES.map((name, i) => (
              <option key={i + 1} value={i + 1}>{name}</option>
            ))}
          </select>
          <select
            value={anio}
            onChange={e => setAnio(Number(e.target.value))}
            className="px-3 py-2 rounded-lg border border-[var(--color-border)] bg-[var(--color-bg-card)] text-sm text-[var(--color-text-primary)]"
          >
            {[DEFAULT_ANIO - 1, DEFAULT_ANIO, DEFAULT_ANIO + 1].map(y => (
              <option key={y} value={y}>{y}</option>
            ))}
          </select>
        </div>
      </div>

      {isLoading || !data ? (
        <div className="flex justify-center py-16"><Spinner /></div>
      ) : (
        <PnLCard data={data} />
      )}

      {yearly && (
        <YearlyCard yearly={yearly} selectedMes={mes} onSelectMes={setMes} />
      )}
    </div>
  );
}

function PnLCard({ data }: { data: import('../api/finance.api').IncomeStatement }) {
  return (
    <div className="bg-[var(--color-bg-card)] border border-[var(--color-border)] rounded-xl p-5 space-y-4">
      <div>
        <p className="text-xs font-mono uppercase tracking-wider text-[var(--color-text-muted)]">Período</p>
        <p className="text-lg font-semibold text-[var(--color-text-primary)]">
          {MONTH_NAMES[data.periodo.mes - 1]} {data.periodo.anio}
        </p>
      </div>

      <PnLRow
        label="Ingresos brutos"
        value={data.ingresosBrutos.total}
        valueClass="text-emerald-400"
        sign="+"
        bold
        detalle={data.ingresosBrutos.detalleCategorias}
      />

      <PnLRow
        label="(-) Costos directos"
        value={data.costosDirectos.total}
        valueClass="text-red-400"
        sign="-"
        bold
        detalle={data.costosDirectos.detalleCategorias}
      />

      <Divider />

      <SummaryRow
        label="= Margen bruto"
        value={data.margenBruto.valor}
        porcentaje={data.margenBruto.porcentaje}
        positive={data.margenBruto.valor >= 0}
      />

      <PnLRow
        label="(-) Gastos operativos"
        value={data.gastosOperativos.total}
        valueClass="text-red-400"
        sign="-"
        bold
        detalle={data.gastosOperativos.detalleCategorias}
      />

      <Divider />

      <div className={klass(
        'flex justify-between items-baseline px-3 py-3 rounded-lg font-bold text-xl',
        data.resultadoNeto.valor >= 0 ? 'bg-emerald-500/10 text-emerald-400' : 'bg-red-500/10 text-red-400',
      )}>
        <span>= Resultado neto</span>
        <span className="tabular-nums">
          {fmtCurrency(data.resultadoNeto.valor, 'USD')}
          <span className="text-xs ml-2 opacity-80">({formatPct(data.resultadoNeto.porcentaje)})</span>
        </span>
      </div>

      <div className="text-[11px] text-[var(--color-text-muted)] pt-2 border-t border-[var(--color-border)]">
        Pagos a proveedores en el mes: {data.pagosProveedor.cantidad} · {fmtCurrency(data.pagosProveedor.total, 'USD')} (incluidos en costos directos).
      </div>
    </div>
  );
}

function PnLRow({ label, value, valueClass, sign, bold, detalle }: {
  label: string;
  value: number;
  valueClass: string;
  sign: '+' | '-';
  bold?: boolean;
  detalle: CategoriaSummary[];
}) {
  const [open, setOpen] = useState(false);
  const tieneDetalle = detalle.length > 0;
  return (
    <div>
      <div className="flex items-center justify-between gap-3">
        <button
          onClick={() => tieneDetalle && setOpen(o => !o)}
          disabled={!tieneDetalle}
          className={klass(
            'flex items-center gap-1 text-left',
            bold && 'font-semibold text-[var(--color-text-primary)]',
            tieneDetalle && 'hover:underline cursor-pointer',
          )}
        >
          {tieneDetalle && (open ? <ChevronDown className="w-3.5 h-3.5 text-[var(--color-text-muted)]" /> : <ChevronRight className="w-3.5 h-3.5 text-[var(--color-text-muted)]" />)}
          <span>{label}</span>
        </button>
        <span className={klass('tabular-nums', valueClass, bold && 'font-semibold')}>
          {sign}{fmtCurrency(value, 'USD')}
        </span>
      </div>
      {open && tieneDetalle && (
        <div className="mt-2 ml-5 rounded border border-[var(--color-border)] overflow-hidden">
          <table className="w-full text-xs">
            <tbody>
              {detalle.map(c => (
                <tr key={c.categoria} className="border-t border-[var(--color-border)] first:border-t-0">
                  <td className="px-3 py-1.5 text-[var(--color-text-secondary)]">
                    {categoriaLabel(c.categoria)}
                    <span className="text-[10px] text-[var(--color-text-muted)] ml-1.5">({c.cantidadMovimientos})</span>
                  </td>
                  <td className="px-3 py-1.5 text-right tabular-nums text-[var(--color-text-primary)]">
                    {fmtCurrency(c.total, 'USD')}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function SummaryRow({ label, value, porcentaje, positive }: { label: string; value: number; porcentaje: number; positive: boolean }) {
  return (
    <div className={klass(
      'flex justify-between items-baseline font-bold text-lg',
      positive ? 'text-emerald-400' : 'text-red-400',
    )}>
      <span>{label}</span>
      <span className="tabular-nums">
        {fmtCurrency(value, 'USD')}
        <span className="text-xs ml-2 opacity-80">({formatPct(porcentaje)})</span>
      </span>
    </div>
  );
}

function Divider() {
  return <div className="border-t border-[var(--color-border)]" />;
}

function YearlyCard({ yearly, selectedMes, onSelectMes }: {
  yearly: import('../api/finance.api').IncomeStatementYearly;
  selectedMes: number;
  onSelectMes: (m: number) => void;
}) {
  const maxAbs = useMemo(() => {
    let m = 0;
    for (const row of yearly.meses) {
      m = Math.max(m, Math.abs(row.ingresos), Math.abs(row.resultadoNeto));
    }
    return m > 0 ? m : 1;
  }, [yearly]);

  return (
    <div className="bg-[var(--color-bg-card)] border border-[var(--color-border)] rounded-xl p-5 space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div>
          <p className="text-sm font-semibold text-[var(--color-text-primary)]">Evolución {yearly.anio}</p>
          <p className="text-[11px] text-[var(--color-text-muted)]">Click en una barra o fila para cambiar el mes.</p>
        </div>
        <div className="flex items-center gap-3 text-[11px]">
          <span className="flex items-center gap-1 text-[var(--color-text-secondary)]">
            <span className="w-2.5 h-2.5 rounded-sm bg-emerald-400" /> Ingresos
          </span>
          <span className="flex items-center gap-1 text-[var(--color-text-secondary)]">
            <span className="w-2.5 h-2.5 rounded-sm bg-blue-400" /> Resultado neto
          </span>
        </div>
      </div>

      {/* Mini bar chart inline */}
      <div className="grid grid-cols-12 gap-2 items-end h-40">
        {yearly.meses.map((row) => {
          const ingresoH = (row.ingresos / maxAbs) * 100;
          const resultadoAbs = Math.abs(row.resultadoNeto);
          const resultadoH = (resultadoAbs / maxAbs) * 100;
          const isSelected = row.mes === selectedMes;
          return (
            <button
              key={row.mes}
              onClick={() => onSelectMes(row.mes)}
              className={klass(
                'flex flex-col items-center justify-end h-full gap-1 px-1 rounded transition-colors',
                isSelected ? 'bg-[var(--color-bg-card-hover)]' : 'hover:bg-[var(--color-bg-card-hover)]/50',
              )}
              title={`${MONTH_NAMES[row.mes - 1]}: ingresos ${fmtCurrency(row.ingresos, 'USD')}, resultado ${fmtCurrency(row.resultadoNeto, 'USD')}`}
            >
              <div className="flex-1 flex items-end gap-0.5 w-full justify-center">
                <div
                  className="w-3 bg-emerald-400/80 rounded-t-sm"
                  style={{ height: `${Math.max(2, ingresoH)}%` }}
                />
                <div
                  className={klass(
                    'w-3 rounded-t-sm',
                    row.resultadoNeto >= 0 ? 'bg-blue-400/80' : 'bg-red-400/80',
                  )}
                  style={{ height: `${Math.max(2, resultadoH)}%` }}
                />
              </div>
              <span className={klass(
                'text-[9px] font-mono uppercase',
                isSelected ? 'text-[var(--color-accent)] font-semibold' : 'text-[var(--color-text-muted)]',
              )}>
                {MONTH_NAMES[row.mes - 1].slice(0, 3)}
              </span>
            </button>
          );
        })}
      </div>

      {/* Tabla de evolución */}
      <div className="overflow-x-auto rounded border border-[var(--color-border)]">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-[var(--color-bg-app)] text-[10px] font-mono uppercase tracking-wider text-[var(--color-text-muted)]">
              <th className="px-3 py-2 text-left">Mes</th>
              <th className="px-3 py-2 text-right">Ingresos</th>
              <th className="px-3 py-2 text-right">Costos directos</th>
              <th className="px-3 py-2 text-right">Margen bruto</th>
              <th className="px-3 py-2 text-right">Gtos. operativos</th>
              <th className="px-3 py-2 text-right">Resultado neto</th>
            </tr>
          </thead>
          <tbody>
            {yearly.meses.map(row => (
              <tr
                key={row.mes}
                onClick={() => onSelectMes(row.mes)}
                className={klass(
                  'border-t border-[var(--color-border)] cursor-pointer hover:bg-[var(--color-bg-card-hover)]',
                  row.mes === selectedMes && 'bg-[var(--color-bg-card-hover)]/70',
                )}
              >
                <td className="px-3 py-2 text-[var(--color-text-secondary)]">{MONTH_NAMES[row.mes - 1]}</td>
                <td className="px-3 py-2 text-right tabular-nums text-emerald-400">
                  {row.ingresos > 0 ? `+${fmtCurrency(row.ingresos, 'USD')}` : '—'}
                </td>
                <td className="px-3 py-2 text-right tabular-nums text-[var(--color-text-muted)]">
                  {row.costosDirectos > 0 ? `-${fmtCurrency(row.costosDirectos, 'USD')}` : '—'}
                </td>
                <td className={klass(
                  'px-3 py-2 text-right tabular-nums',
                  row.margenBruto >= 0 ? 'text-[var(--color-text-primary)]' : 'text-red-400',
                )}>
                  {fmtCurrency(row.margenBruto, 'USD')}
                </td>
                <td className="px-3 py-2 text-right tabular-nums text-[var(--color-text-muted)]">
                  {row.gastosOperativos > 0 ? `-${fmtCurrency(row.gastosOperativos, 'USD')}` : '—'}
                </td>
                <td className={klass(
                  'px-3 py-2 text-right tabular-nums font-semibold',
                  row.resultadoNeto >= 0 ? 'text-emerald-400' : 'text-red-400',
                )}>
                  {fmtCurrency(row.resultadoNeto, 'USD')}
                </td>
              </tr>
            ))}
            <tr className="border-t-2 border-[var(--color-border)] font-bold bg-[var(--color-bg-app)]">
              <td className="px-3 py-2 text-[var(--color-text-primary)]">Total {yearly.anio}</td>
              <td className="px-3 py-2 text-right tabular-nums text-emerald-400">+{fmtCurrency(yearly.totales.ingresos, 'USD')}</td>
              <td className="px-3 py-2 text-right tabular-nums text-[var(--color-text-secondary)]">-{fmtCurrency(yearly.totales.costosDirectos, 'USD')}</td>
              <td className={klass(
                'px-3 py-2 text-right tabular-nums',
                yearly.totales.margenBruto >= 0 ? 'text-[var(--color-text-primary)]' : 'text-red-400',
              )}>
                {fmtCurrency(yearly.totales.margenBruto, 'USD')}
              </td>
              <td className="px-3 py-2 text-right tabular-nums text-[var(--color-text-secondary)]">-{fmtCurrency(yearly.totales.gastosOperativos, 'USD')}</td>
              <td className={klass(
                'px-3 py-2 text-right tabular-nums',
                yearly.totales.resultadoNeto >= 0 ? 'text-emerald-400' : 'text-red-400',
              )}>
                {fmtCurrency(yearly.totales.resultadoNeto, 'USD')}
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  );
}

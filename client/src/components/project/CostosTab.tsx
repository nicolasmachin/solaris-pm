import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { Spinner } from '../ui/Spinner';
import { getMovements } from '../../api/finance.api';
import { fmtCurrency, fmtDate } from '../../lib/finance';
import {
  CATEGORIA_LABEL,
  STATUS_COLOR,
  STATUS_LABEL,
} from '../../types/finance.types';
import type { FinanceMovement, FinanceMovementStatus } from '../../types/finance.types';

function klass(...p: (string | false | undefined)[]) { return p.filter(Boolean).join(' '); }

const STATUS_OPTIONS: ('all' | FinanceMovementStatus)[] = ['all', 'PREVISTO', 'COMPROMETIDO', 'A_PAGAR', 'PAGADO'];
const STATUS_OPT_LABEL: Record<'all' | FinanceMovementStatus, string> = {
  all: 'Todos',
  PREVISTO: 'Previstos',
  COMPROMETIDO: 'Comprometidos',
  A_PAGAR: 'A pagar',
  PAGADO: 'Pagados',
};

export function CostosTab({ projectId, budgetUsd }: { projectId: string; budgetUsd?: number | null }) {
  const [filter, setFilter] = useState<'all' | FinanceMovementStatus>('all');

  const { data, isLoading } = useQuery({
    queryKey: ['project-movements', projectId],
    queryFn: () => getMovements({ projectId, limit: 200 }),
  });

  const movements: FinanceMovement[] = useMemo(() => data?.data ?? [], [data]);

  const filtered = useMemo(() => {
    return filter === 'all' ? movements : movements.filter(m => m.status === filter);
  }, [movements, filter]);

  // Totales por estado, separados por moneda
  const totals = useMemo(() => {
    const init = (): Record<string, number> => ({});
    const t = {
      previsto: init(),
      comprometido: init(),
      a_pagar: init(),
      pagado: init(),
      ingresos: init(),
    };
    for (const m of movements) {
      if (m.tipoMovimiento === 'INGRESO') {
        t.ingresos[m.moneda] = (t.ingresos[m.moneda] ?? 0) + m.monto;
        continue;
      }
      const bucket = m.status === 'PREVISTO' ? t.previsto : m.status === 'COMPROMETIDO' ? t.comprometido : m.status === 'A_PAGAR' ? t.a_pagar : t.pagado;
      bucket[m.moneda] = (bucket[m.moneda] ?? 0) + m.monto;
    }
    return t;
  }, [movements]);

  // Total estimado para margen: previsto + comprometido + a_pagar + pagado, en USD asumiendo UYU se ignora si no hay TC
  const totalCostosUsd = useMemo(() => {
    const sum = (b: Record<string, number>) => (b.USD ?? 0);
    return sum(totals.previsto) + sum(totals.comprometido) + sum(totals.a_pagar) + sum(totals.pagado);
  }, [totals]);

  const margenUsd = budgetUsd != null && budgetUsd > 0 ? budgetUsd - totalCostosUsd : null;
  const margenPct = budgetUsd != null && budgetUsd > 0 ? (margenUsd! / budgetUsd) * 100 : null;

  function fmtBucket(b: Record<string, number>) {
    const parts = Object.entries(b).filter(([, v]) => v > 0).map(([m, v]) => fmtCurrency(v, m as 'USD' | 'UYU'));
    return parts.length === 0 ? '—' : parts.join(' · ');
  }

  return (
    <div className="space-y-4">
      {/* KPIs */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <KpiBox label="Previsto" value={fmtBucket(totals.previsto)} tone="muted" />
        <KpiBox label="Comprometido" value={fmtBucket(totals.comprometido)} tone="info" />
        <KpiBox label="A pagar" value={fmtBucket(totals.a_pagar)} tone="warning" />
        <KpiBox label="Pagado" value={fmtBucket(totals.pagado)} tone="success" />
      </div>

      {budgetUsd != null && budgetUsd > 0 && (
        <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-bg-card)] px-4 py-3 flex items-center justify-between flex-wrap gap-3">
          <div className="flex items-center gap-6">
            <div>
              <p className="text-[10px] font-mono uppercase tracking-wider text-[var(--color-text-muted)]">Presupuesto</p>
              <p className="text-sm font-semibold text-[var(--color-text-primary)] tabular-nums">{fmtCurrency(budgetUsd, 'USD')}</p>
            </div>
            <div>
              <p className="text-[10px] font-mono uppercase tracking-wider text-[var(--color-text-muted)]">Costos totales (USD)</p>
              <p className="text-sm font-semibold text-[var(--color-text-primary)] tabular-nums">{fmtCurrency(totalCostosUsd, 'USD')}</p>
            </div>
            <div>
              <p className="text-[10px] font-mono uppercase tracking-wider text-[var(--color-text-muted)]">Margen estimado</p>
              <p className={klass('text-sm font-semibold tabular-nums', (margenUsd ?? 0) >= 0 ? 'text-green-400' : 'text-red-400')}>
                {fmtCurrency(margenUsd ?? 0, 'USD')} {margenPct != null && `(${margenPct.toFixed(1)}%)`}
              </p>
            </div>
          </div>
          <p className="text-[10px] text-[var(--color-text-muted)] max-w-xs">
            Margen = presupuesto − todos los costos (previsto + comprometido + a pagar + pagado, en USD).
            Los UYU no se convierten automáticamente.
          </p>
        </div>
      )}

      {/* Filtros */}
      <div className="flex items-center gap-2 flex-wrap">
        <span className="text-xs text-[var(--color-text-muted)]">Filtrar por estado:</span>
        {STATUS_OPTIONS.map(s => (
          <button
            key={s}
            onClick={() => setFilter(s)}
            className={klass(
              'text-xs px-2.5 py-1 rounded-full border transition-colors',
              filter === s
                ? 'bg-[var(--color-accent)] border-[var(--color-accent)] text-gray-900 font-semibold'
                : 'border-[var(--color-border)] text-[var(--color-text-secondary)] hover:bg-[var(--color-bg-card-hover)]',
            )}
          >
            {STATUS_OPT_LABEL[s]}
          </button>
        ))}
        <Link to="/finanzas/movimientos" className="ml-auto text-xs text-[var(--color-accent)] hover:underline">
          Ver todos los movimientos →
        </Link>
      </div>

      {/* Tabla */}
      {isLoading ? (
        <div className="flex items-center justify-center py-12"><Spinner /></div>
      ) : filtered.length === 0 ? (
        <p className="text-sm text-[var(--color-text-muted)] text-center py-12">
          {movements.length === 0 ? 'Sin movimientos vinculados al proyecto' : 'Ningún movimiento coincide con el filtro'}
        </p>
      ) : (
        <div className="overflow-x-auto rounded-lg border border-[var(--color-border)]">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-[var(--color-border)] bg-[var(--color-bg-card-hover)] text-xs font-mono text-[var(--color-text-muted)] uppercase tracking-wider">
                {['Fecha', 'Descripción', 'Categoría', 'Proveedor', 'Monto', 'Estado'].map(h => (
                  <th key={h} className="px-3 py-2 text-left font-medium">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--color-border)]">
              {filtered.map(m => {
                const showFecha = m.status === 'PAGADO' ? m.fecha : (m.expectedDate ?? m.dueDate ?? m.fecha);
                const prefix = m.status === 'PAGADO' || m.tipoMovimiento === 'INGRESO' ? '' : (m.expectedDate ? '~' : m.dueDate ? '⏰' : '');
                return (
                  <tr key={m.id} className="hover:bg-[var(--color-bg-card-hover)]">
                    <td className="px-3 py-2 whitespace-nowrap text-[var(--color-text-muted)]">
                      {prefix}{fmtDate(showFecha)}
                    </td>
                    <td className="px-3 py-2 max-w-xs truncate text-[var(--color-text-primary)]">{m.descripcion}</td>
                    <td className="px-3 py-2 whitespace-nowrap text-[var(--color-text-secondary)]">{CATEGORIA_LABEL[m.categoriaPrincipal]}</td>
                    <td className="px-3 py-2 whitespace-nowrap text-[var(--color-text-muted)]">{m.supplier?.nombre ?? '—'}</td>
                    <td className={klass('px-3 py-2 whitespace-nowrap font-semibold tabular-nums',
                      m.tipoMovimiento === 'INGRESO' ? 'text-green-400' : m.tipoMovimiento === 'AJUSTE' ? 'text-blue-400' : 'text-red-400')}>
                      {m.tipoMovimiento === 'GASTO' ? '-' : '+'}{fmtCurrency(m.monto, m.moneda)}
                    </td>
                    <td className="px-3 py-2">
                      <span className={klass('text-[10px] font-mono px-2 py-0.5 rounded uppercase', STATUS_COLOR[m.status])}>
                        {STATUS_LABEL[m.status]}
                      </span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function KpiBox({ label, value, tone }: { label: string; value: string; tone: 'muted' | 'info' | 'warning' | 'success' }) {
  const toneClass =
    tone === 'success' ? 'border-[var(--color-state-done-bg)]' :
    tone === 'warning' ? 'border-[var(--color-warning-bg)]' :
    tone === 'info' ? 'border-[var(--color-info-bg)]' :
    'border-[var(--color-border)]';
  return (
    <div className={`rounded-xl border bg-[var(--color-bg-card)] p-3 ${toneClass}`}>
      <p className="text-[10px] font-mono uppercase tracking-wider text-[var(--color-text-muted)] mb-1">{label}</p>
      <p className="text-sm font-semibold text-[var(--color-text-primary)] tabular-nums">{value}</p>
    </div>
  );
}

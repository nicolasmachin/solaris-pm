import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { Spinner } from '../ui/Spinner';
import { getProjectCostSummary } from '../../api/finance.api';
import { fmtCurrency, fmtDate } from '../../lib/finance';

function klass(...p: (string | false | undefined)[]) { return p.filter(Boolean).join(' '); }

export function CostosTab({ projectId }: { projectId: string; budgetUsd?: number | null }) {
  const { data, isLoading, error } = useQuery({
    queryKey: ['project-cost-summary', projectId],
    queryFn: () => getProjectCostSummary(projectId),
  });

  if (isLoading) return <div className="flex items-center justify-center py-12"><Spinner /></div>;
  if (error || !data) return <p className="text-sm text-[var(--color-text-muted)] text-center py-6">No se pudo cargar el resumen de costos</p>;

  const usdAndUyu: { val: number; moneda: 'USD' | 'UYU' }[] = [];
  if (data.totalUsedUSD > 0) usdAndUyu.push({ val: data.totalUsedUSD, moneda: 'USD' });
  if (data.totalUsedUYU > 0) usdAndUyu.push({ val: data.totalUsedUYU, moneda: 'UYU' });

  return (
    <div className="space-y-4">
      {/* KPIs */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <KpiBox
          label="Costo total"
          value={
            usdAndUyu.length === 0
              ? '—'
              : usdAndUyu.map(t => fmtCurrency(t.val, t.moneda)).join(' · ')
          }
          subtitle={`equivalente ${fmtCurrency(data.totalUsedUsdAll, 'USD')}`}
          tone="info"
        />
        <KpiBox
          label="Ítems consumidos"
          value={data.itemCount.toString()}
          subtitle={data.itemCount === 1 ? 'movimiento' : 'movimientos'}
          tone="muted"
        />
        <KpiBox
          label="Presupuesto"
          value={data.budgetUsd != null ? fmtCurrency(data.budgetUsd, 'USD') : '—'}
          subtitle={data.budgetUsd != null ? 'USD' : 'sin definir'}
          tone="muted"
        />
        <KpiBox
          label="Margen estimado"
          value={
            data.marginUSD != null
              ? `${fmtCurrency(data.marginUSD, 'USD')}${data.marginPercent != null ? ` (${data.marginPercent.toFixed(1)}%)` : ''}`
              : '—'
          }
          subtitle={data.marginUSD == null ? 'requiere presupuesto' : data.marginUSD >= 0 ? 'positivo' : 'negativo'}
          tone={data.marginUSD == null ? 'muted' : data.marginUSD >= 0 ? 'success' : 'danger'}
        />
      </div>

      {/* Tabla por categoría */}
      {data.byCategoryUSD.length > 0 && (
        <div className="rounded-lg border border-[var(--color-border)] overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-[var(--color-bg-card-hover)] text-[10px] font-mono uppercase tracking-wider text-[var(--color-text-muted)]">
                <th className="px-3 py-2 text-left font-medium">Categoría</th>
                <th className="px-2 py-2 text-right font-medium w-32">Ítems</th>
                <th className="px-2 py-2 text-right font-medium w-40">Total (USD)</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--color-border)]">
              {data.byCategoryUSD.map(c => (
                <tr key={c.id} className="hover:bg-[var(--color-bg-card-hover)]">
                  <td className="px-3 py-2 text-[var(--color-text-primary)]">{c.nombre}</td>
                  <td className="px-2 py-2 text-right text-[var(--color-text-muted)] tabular-nums">{c.itemCount}</td>
                  <td className="px-2 py-2 text-right font-semibold text-[var(--color-text-primary)] tabular-nums">{fmtCurrency(c.totalUSD, 'USD')}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Detalle de movimientos */}
      <div className="rounded-lg border border-[var(--color-border)] overflow-hidden">
        <div className="px-3 py-2 bg-[var(--color-bg-card-hover)] flex items-center justify-between">
          <p className="text-xs font-mono uppercase tracking-wider text-[var(--color-text-muted)]">
            Consumos del proyecto ({data.movements.length})
          </p>
          <Link to="/stock" className="text-[10px] text-[var(--color-accent)] hover:underline">
            Ir a Stock →
          </Link>
        </div>
        {data.movements.length === 0 ? (
          <p className="text-sm text-[var(--color-text-muted)] text-center py-8">
            Aún no se consumió stock en este proyecto.
            <br />
            <span className="text-xs">Los consumos se registran desde Stock → Egreso o desde la pestaña Materiales del proyecto.</span>
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-[var(--color-border)] text-[10px] font-mono uppercase tracking-wider text-[var(--color-text-muted)]">
                  <th className="px-3 py-2 text-left font-medium">Ítem</th>
                  <th className="px-2 py-2 text-left font-medium">Categoría</th>
                  <th className="px-2 py-2 text-right font-medium">Cant.</th>
                  <th className="px-2 py-2 text-right font-medium">Precio</th>
                  <th className="px-2 py-2 text-right font-medium">Subtotal</th>
                  <th className="px-2 py-2 text-right font-medium">Fecha</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--color-border)]">
                {data.movements.map(m => (
                  <tr key={m.id} className="hover:bg-[var(--color-bg-card-hover)]">
                    <td className="px-3 py-2 text-[var(--color-text-primary)]">
                      <div className="font-medium">{m.materialItemName}</div>
                      <div className="text-[10px] text-[var(--color-text-muted)]">{m.unidad}</div>
                    </td>
                    <td className="px-2 py-2 text-[var(--color-text-secondary)]">{m.categoryName}</td>
                    <td className="px-2 py-2 text-right tabular-nums text-[var(--color-text-primary)]">{m.quantity}</td>
                    <td className="px-2 py-2 text-right tabular-nums text-[var(--color-text-secondary)]">
                      {fmtCurrency(m.unitPrice, m.moneda)}
                      {m.priceSource === 'catalog' && (
                        <span className="ml-1 text-[9px] font-mono text-[var(--color-text-muted)]" title="Precio tomado del catálogo (no había costo grabado en el movimiento)">cat.</span>
                      )}
                    </td>
                    <td className="px-2 py-2 text-right tabular-nums font-semibold text-[var(--color-text-primary)]">{fmtCurrency(m.subtotal, m.moneda)}</td>
                    <td className="px-2 py-2 text-right text-[var(--color-text-muted)] text-[11px]">{fmtDate(m.fecha)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <p className="text-[11px] text-[var(--color-text-muted)] leading-relaxed">
        Cómo se calcula: cada egreso de stock vinculado al proyecto se valora con el costo unitario que tenía al consumirse;
        si no hay costo grabado, se usa el precio sugerido actual del catálogo (marcado <span className="font-mono">cat.</span>).
        UYU se convierte a USD con el último tipo de cambio
        {data.exchangeRate ? ` (1 USD = ${data.exchangeRate.usdToUyu.toLocaleString('es-UY', { minimumFractionDigits: 2 })} UYU del ${fmtDate(data.exchangeRate.date)})` : ''}.
      </p>
    </div>
  );
}

function KpiBox({ label, value, subtitle, tone }: { label: string; value: string; subtitle?: string; tone: 'muted' | 'info' | 'success' | 'danger' }) {
  const toneClass =
    tone === 'success' ? 'border-[var(--color-state-done-bg)]' :
    tone === 'danger' ? 'border-red-500/40' :
    tone === 'info' ? 'border-[var(--color-info-bg)]' :
    'border-[var(--color-border)]';
  const valColor =
    tone === 'success' ? 'text-green-400' :
    tone === 'danger' ? 'text-red-400' :
    tone === 'info' ? 'text-[var(--color-info-text)]' :
    'text-[var(--color-text-primary)]';
  return (
    <div className={klass('rounded-xl border bg-[var(--color-bg-card)] p-3', toneClass)}>
      <p className="text-[10px] font-mono uppercase tracking-wider text-[var(--color-text-muted)] mb-1">{label}</p>
      <p className={klass('text-sm font-semibold tabular-nums', valColor)}>{value}</p>
      {subtitle && <p className="text-[10px] text-[var(--color-text-muted)] mt-0.5">{subtitle}</p>}
    </div>
  );
}

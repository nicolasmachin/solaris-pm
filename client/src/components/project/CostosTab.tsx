import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'react-hot-toast';
import { Trash2 } from 'lucide-react';
import { Spinner } from '../ui/Spinner';
import { usePermission } from '../../hooks/usePermission';
import {
  getProjectCostSummary,
  createNonMaterialCost,
  deleteNonMaterialCost,
  type CostSummaryNoMaterial,
} from '../../api/finance.api';
import type { Moneda } from '../../types/finance.types';
import { fmtCurrency, fmtDate } from '../../lib/finance';

function klass(...p: (string | false | undefined)[]) { return p.filter(Boolean).join(' '); }

export function CostosTab({ projectId }: { projectId: string; budgetUsd?: number | null }) {
  const { data, isLoading, error } = useQuery({
    queryKey: ['project-cost-summary', projectId],
    queryFn: () => getProjectCostSummary(projectId),
  });
  const canEdit = usePermission('OPERACIONES', 'EDIT');

  if (isLoading) return <div className="flex items-center justify-center py-12"><Spinner /></div>;
  if (error || !data) return <p className="text-sm text-[var(--color-text-muted)] text-center py-6">No se pudo cargar el resumen de costos</p>;

  const tieneBudget = data.budgetUsd != null;
  const previstoVal = formatMixedTotal(data.costoPrevistoUSD, data.costoPrevistoUYU, data.costoPrevistoTotalUSD);
  const realVal = formatMixedTotal(data.costoRealUSD, data.costoRealUYU, data.costoRealTotalUSD);
  const desviacionUSD = data.costoRealTotalUSD - data.costoPrevistoTotalUSD;
  const desviacionPercent = data.costoPrevistoTotalUSD > 0
    ? Math.round((desviacionUSD / data.costoPrevistoTotalUSD) * 1000) / 10
    : null;

  return (
    <div className="space-y-6">
      {/* KPI superior: presupuesto + desviación previsto vs real */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <KpiBox
          label="Presupuesto"
          value={tieneBudget ? fmtCurrency(data.budgetUsd!, 'USD') : '—'}
          subtitle={tieneBudget ? 'USD' : 'sin definir'}
          tone="muted"
        />
        <KpiBox
          label="Costo previsto vs real"
          value={
            data.costoPrevistoTotalUSD === 0 && data.costoRealTotalUSD === 0
              ? '—'
              : `${fmtCurrency(desviacionUSD, 'USD')}${desviacionPercent != null ? ` (${desviacionPercent.toFixed(1)}%)` : ''}`
          }
          subtitle={
            desviacionUSD === 0 ? 'sin desviación' :
            desviacionUSD > 0 ? 'gasto por encima de lo previsto' :
            'gasto por debajo de lo previsto'
          }
          tone={desviacionUSD === 0 ? 'muted' : desviacionUSD > 0 ? 'danger' : 'success'}
        />
        <KpiBox
          label="Margen real estimado"
          value={
            data.margenRealObraUSD != null
              ? `${fmtCurrency(data.margenRealObraUSD, 'USD')}${data.margenRealObraPercent != null ? ` (${data.margenRealObraPercent.toFixed(1)}%)` : ''}`
              : '—'
          }
          subtitle={
            data.margenRealObraUSD == null
              ? 'requiere presupuesto'
              : data.costoNoMaterialTotalUSD > 0
                ? 'incluye costo no-material'
                : data.margenRealObraUSD >= 0 ? 'positivo' : 'negativo'
          }
          tone={data.margenRealObraUSD == null ? 'muted' : data.margenRealObraUSD >= 0 ? 'success' : 'danger'}
        />
        <KpiBox
          label="Costo real por kW"
          value={data.costoRealPorKwUSD != null ? `${fmtCurrency(data.costoRealPorKwUSD, 'USD')}/kW` : '—'}
          subtitle={
            data.capacityKwp == null || data.capacityKwp <= 0
              ? 'sin potencia cargada'
              : data.costoPrevistoPorKwUSD != null
                ? `previsto ${fmtCurrency(data.costoPrevistoPorKwUSD, 'USD')}/kW · ${data.capacityKwp} kWp`
                : `${data.capacityKwp} kWp`
          }
          tone="muted"
        />
      </div>

      {/* Dos secciones paralelas: Previsto y Real */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* PREVISTO */}
        <section className="rounded-xl border border-[var(--color-border)] bg-[var(--color-bg-card)] overflow-hidden">
          <header className="px-4 py-3 border-b border-[var(--color-border)] bg-[var(--color-bg-card-hover)]">
            <h3 className="text-xs font-mono uppercase tracking-wider text-[var(--color-text-muted)]">Costo previsto</h3>
            <p className="text-[10px] text-[var(--color-text-muted)] mt-0.5">según lista de Ingeniería</p>
          </header>
          <div className="p-4 space-y-3">
            <div>
              <p className="text-[10px] font-mono uppercase tracking-wider text-[var(--color-text-muted)]">Total sin IVA</p>
              <p className="text-base font-semibold text-[var(--color-text-primary)] tabular-nums">{previstoVal.main}</p>
              {previstoVal.sub && <p className="text-[11px] text-[var(--color-text-muted)] tabular-nums">{previstoVal.sub}</p>}
              {data.costoPrevistoTotalConIvaUSD != null && (
                <p className="text-[11px] text-[var(--color-text-muted)] mt-0.5">
                  Con IVA: {fmtCurrency(data.costoPrevistoTotalConIvaUSD, 'USD')}
                </p>
              )}
            </div>
            {tieneBudget && (
              <div className="pt-2 border-t border-[var(--color-border)]">
                <p className="text-[10px] font-mono uppercase tracking-wider text-[var(--color-text-muted)]">Margen previsto</p>
                <p className={klass(
                  'text-sm font-semibold tabular-nums',
                  data.margenPrevistoUSD == null ? 'text-[var(--color-text-muted)]' :
                  data.margenPrevistoUSD >= 0 ? 'text-green-400' : 'text-red-400'
                )}>
                  {data.margenPrevistoUSD != null ? fmtCurrency(data.margenPrevistoUSD, 'USD') : '—'}
                  {data.margenPrevistoPercent != null ? ` (${data.margenPrevistoPercent.toFixed(1)}%)` : ''}
                </p>
              </div>
            )}
            <CategoryBreakdown items={data.desglose.previstoPorCategoria} empty="Sin lista de materiales" />
          </div>
        </section>

        {/* REAL */}
        <section className="rounded-xl border border-[var(--color-border)] bg-[var(--color-bg-card)] overflow-hidden">
          <header className="px-4 py-3 border-b border-[var(--color-border)] bg-[var(--color-bg-card-hover)] flex items-center justify-between">
            <div>
              <h3 className="text-xs font-mono uppercase tracking-wider text-[var(--color-text-muted)]">Costo real</h3>
              <p className="text-[10px] text-[var(--color-text-muted)] mt-0.5">consumos de stock</p>
            </div>
            <Link to="/stock" className="text-[10px] text-[var(--color-accent)] hover:underline">Ir a Stock →</Link>
          </header>
          <div className="p-4 space-y-3">
            <div>
              <p className="text-[10px] font-mono uppercase tracking-wider text-[var(--color-text-muted)]">Total sin IVA</p>
              <p className="text-base font-semibold text-[var(--color-text-primary)] tabular-nums">{realVal.main}</p>
              {realVal.sub && <p className="text-[11px] text-[var(--color-text-muted)] tabular-nums">{realVal.sub}</p>}
              {data.costoRealTotalConIvaUSD != null && (
                <p className="text-[11px] text-[var(--color-text-muted)] mt-0.5">
                  Con IVA: {fmtCurrency(data.costoRealTotalConIvaUSD, 'USD')}
                </p>
              )}
            </div>
            {tieneBudget && (
              <div className="pt-2 border-t border-[var(--color-border)]">
                <p className="text-[10px] font-mono uppercase tracking-wider text-[var(--color-text-muted)]">Margen real</p>
                <p className={klass(
                  'text-sm font-semibold tabular-nums',
                  data.margenRealUSD == null ? 'text-[var(--color-text-muted)]' :
                  data.margenRealUSD >= 0 ? 'text-green-400' : 'text-red-400'
                )}>
                  {data.margenRealUSD != null ? fmtCurrency(data.margenRealUSD, 'USD') : '—'}
                  {data.margenRealPercent != null ? ` (${data.margenRealPercent.toFixed(1)}%)` : ''}
                </p>
              </div>
            )}
            <CategoryBreakdown items={data.desglose.realPorCategoria} empty="Aún no hay consumos" />
          </div>
        </section>
      </div>

      {/* Costo no-material (cargas manuales: mano de obra, tercerizados, fletes) */}
      <NoMaterialCostsSection
        projectId={projectId}
        items={data.costosNoMaterial}
        totalUSD={data.costoNoMaterialTotalUSD}
        canEdit={canEdit}
      />

      {/* Comparación item por item */}
      <div className="rounded-lg border border-[var(--color-border)] overflow-hidden">
        <div className="px-3 py-2 bg-[var(--color-bg-card-hover)]">
          <p className="text-xs font-mono uppercase tracking-wider text-[var(--color-text-muted)]">
            Comparación por ítem ({data.desglose.comparacionPorItem.length})
          </p>
        </div>
        {data.desglose.comparacionPorItem.length === 0 ? (
          <p className="text-sm text-[var(--color-text-muted)] text-center py-8">
            Sin ítems para comparar.
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-[var(--color-border)] text-[10px] font-mono uppercase tracking-wider text-[var(--color-text-muted)]">
                  <th className="px-3 py-2 text-left font-medium">Ítem</th>
                  <th className="px-2 py-2 text-left font-medium">Categoría</th>
                  <th className="px-2 py-2 text-right font-medium" colSpan={3}>Cantidad</th>
                  <th className="px-2 py-2 text-right font-medium" colSpan={3}>USD</th>
                </tr>
                <tr className="border-b border-[var(--color-border)] text-[10px] font-mono uppercase tracking-wider text-[var(--color-text-muted)]">
                  <th></th>
                  <th></th>
                  <th className="px-2 py-1 text-right font-medium">Prev.</th>
                  <th className="px-2 py-1 text-right font-medium">Real</th>
                  <th className="px-2 py-1 text-right font-medium">Δ</th>
                  <th className="px-2 py-1 text-right font-medium">Prev.</th>
                  <th className="px-2 py-1 text-right font-medium">Real</th>
                  <th className="px-2 py-1 text-right font-medium">Δ</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--color-border)]">
                {data.desglose.comparacionPorItem.map(c => {
                  const qDiffTone = c.quantityDiff === 0 ? 'text-[var(--color-text-muted)]' : c.quantityDiff > 0 ? 'text-red-400' : 'text-green-400';
                  const usdDiffTone = c.subtotalDiffUSD === 0 ? 'text-[var(--color-text-muted)]' : c.subtotalDiffUSD > 0 ? 'text-red-400' : 'text-green-400';
                  return (
                    <tr key={c.materialItemId} className="hover:bg-[var(--color-bg-card-hover)]">
                      <td className="px-3 py-2 text-[var(--color-text-primary)]">
                        <div className="font-medium">{c.nombre}</div>
                        <div className="text-[10px] text-[var(--color-text-muted)]">{c.unidad}</div>
                      </td>
                      <td className="px-2 py-2 text-[var(--color-text-secondary)]">{c.categoryName}</td>
                      <td className="px-2 py-2 text-right tabular-nums text-[var(--color-text-secondary)]">{c.quantityPrevista || '—'}</td>
                      <td className="px-2 py-2 text-right tabular-nums text-[var(--color-text-primary)]">{c.quantityReal || '—'}</td>
                      <td className={klass('px-2 py-2 text-right tabular-nums', qDiffTone)}>
                        {c.quantityDiff === 0 ? '—' : (c.quantityDiff > 0 ? `+${c.quantityDiff}` : c.quantityDiff)}
                      </td>
                      <td className="px-2 py-2 text-right tabular-nums text-[var(--color-text-secondary)]">{c.subtotalPrevistoUSD ? fmtCurrency(c.subtotalPrevistoUSD, 'USD') : '—'}</td>
                      <td className="px-2 py-2 text-right tabular-nums text-[var(--color-text-primary)] font-semibold">{c.subtotalRealUSD ? fmtCurrency(c.subtotalRealUSD, 'USD') : '—'}</td>
                      <td className={klass('px-2 py-2 text-right tabular-nums font-semibold', usdDiffTone)}>
                        {c.subtotalDiffUSD === 0 ? '—' : (c.subtotalDiffUSD > 0 ? `+${fmtCurrency(c.subtotalDiffUSD, 'USD')}` : fmtCurrency(c.subtotalDiffUSD, 'USD'))}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Detalle de consumos reales */}
      <div className="rounded-lg border border-[var(--color-border)] overflow-hidden">
        <div className="px-3 py-2 bg-[var(--color-bg-card-hover)]">
          <p className="text-xs font-mono uppercase tracking-wider text-[var(--color-text-muted)]">
            Consumos del proyecto ({data.desglose.consumosDeStock.length})
          </p>
        </div>
        {data.desglose.consumosDeStock.length === 0 ? (
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
                {data.desglose.consumosDeStock.map(m => (
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
        Cómo se calcula: el <span className="font-medium">costo previsto</span> sale de la lista de materiales cargada por Ingeniería (cantidad × precio unitario).
        El <span className="font-medium">costo real</span> sale de los egresos de stock vinculados al proyecto, valorados al costo unitario que tenían al consumirse;
        si no hay costo grabado, se usa el precio sugerido del catálogo (marcado <span className="font-mono">cat.</span>).
        Los <span className="font-medium">costos no-material</span> (mano de obra, tercerizados, fletes) se cargan a mano y se suman al costo real de obra, al margen real y al costo por kW.
        UYU se convierte a USD con el último tipo de cambio
        {data.exchangeRate ? ` (1 USD = ${data.exchangeRate.usdToUyu.toLocaleString('es-UY', { minimumFractionDigits: 2 })} UYU del ${fmtDate(data.exchangeRate.date)})` : ''}.
      </p>
    </div>
  );
}

function formatMixedTotal(usd: number, uyu: number, totalUsd: number): { main: string; sub: string | null } {
  const parts: string[] = [];
  if (usd > 0) parts.push(fmtCurrency(usd, 'USD'));
  if (uyu > 0) parts.push(fmtCurrency(uyu, 'UYU'));
  if (parts.length === 0) return { main: '—', sub: null };
  if (parts.length === 1 && usd > 0) return { main: parts[0], sub: null };
  return { main: parts.join(' · '), sub: `equivalente ${fmtCurrency(totalUsd, 'USD')}` };
}

function CategoryBreakdown({ items, empty }: { items: { id: string; nombre: string; totalUSD: number; itemCount: number }[]; empty: string }) {
  if (items.length === 0) {
    return <p className="text-[11px] text-[var(--color-text-muted)] italic pt-2 border-t border-[var(--color-border)]">{empty}</p>;
  }
  return (
    <div className="pt-2 border-t border-[var(--color-border)]">
      <p className="text-[10px] font-mono uppercase tracking-wider text-[var(--color-text-muted)] mb-1">Por categoría</p>
      <div className="space-y-1">
        {items.map(c => (
          <div key={c.id} className="flex items-center justify-between text-[12px]">
            <span className="text-[var(--color-text-secondary)] truncate">{c.nombre} <span className="text-[var(--color-text-muted)] text-[10px]">({c.itemCount})</span></span>
            <span className="tabular-nums font-medium text-[var(--color-text-primary)]">{fmtCurrency(c.totalUSD, 'USD')}</span>
          </div>
        ))}
      </div>
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

function NoMaterialCostsSection({
  projectId,
  items,
  totalUSD,
  canEdit,
}: {
  projectId: string;
  items: CostSummaryNoMaterial[];
  totalUSD: number;
  canEdit: boolean;
}) {
  const qc = useQueryClient();
  const [concepto, setConcepto] = useState('');
  const [monto, setMonto] = useState('');
  const [moneda, setMoneda] = useState<Moneda>('USD');
  const [fecha, setFecha] = useState('');

  const invalidate = () => qc.invalidateQueries({ queryKey: ['project-cost-summary', projectId] });

  const createMut = useMutation({
    mutationFn: () =>
      createNonMaterialCost(projectId, {
        concepto: concepto.trim(),
        monto: Number(monto),
        moneda,
        fecha: fecha || undefined,
      }),
    onSuccess: () => {
      toast.success('Costo agregado');
      setConcepto(''); setMonto(''); setFecha('');
      invalidate();
    },
    onError: () => toast.error('No se pudo agregar el costo'),
  });

  const deleteMut = useMutation({
    mutationFn: (costId: string) => deleteNonMaterialCost(projectId, costId),
    onSuccess: () => { toast.success('Costo eliminado'); invalidate(); },
    onError: () => toast.error('No se pudo eliminar'),
  });

  const montoNum = Number(monto);
  const canSubmit = concepto.trim().length > 0 && montoNum > 0 && !createMut.isPending;

  return (
    <div className="rounded-lg border border-[var(--color-border)] overflow-hidden">
      <div className="px-3 py-2 bg-[var(--color-bg-card-hover)] flex items-center justify-between">
        <p className="text-xs font-mono uppercase tracking-wider text-[var(--color-text-muted)]">
          Costo no-material ({items.length})
        </p>
        <p className="text-xs font-semibold tabular-nums text-[var(--color-text-primary)]">
          {totalUSD > 0 ? fmtCurrency(totalUSD, 'USD') : '—'}
        </p>
      </div>

      {canEdit && (
        <form
          onSubmit={(e) => { e.preventDefault(); if (canSubmit) createMut.mutate(); }}
          className="flex flex-wrap items-end gap-2 px-3 py-3 border-b border-[var(--color-border)]"
        >
          <div className="flex-1 min-w-[160px]">
            <label className="block text-[10px] font-mono uppercase tracking-wider text-[var(--color-text-muted)] mb-1">Concepto</label>
            <input
              type="text"
              value={concepto}
              onChange={(e) => setConcepto(e.target.value)}
              placeholder="Mano de obra, flete, tercerizado…"
              className="w-full rounded border border-[var(--color-border)] bg-[var(--color-bg-app)] px-2 py-1.5 text-sm text-[var(--color-text-primary)] focus:border-[var(--color-accent)] focus:outline-none"
            />
          </div>
          <div className="w-28">
            <label className="block text-[10px] font-mono uppercase tracking-wider text-[var(--color-text-muted)] mb-1">Monto</label>
            <input
              type="number"
              min="0"
              step="0.01"
              value={monto}
              onChange={(e) => setMonto(e.target.value)}
              placeholder="0.00"
              className="w-full rounded border border-[var(--color-border)] bg-[var(--color-bg-app)] px-2 py-1.5 text-sm text-[var(--color-text-primary)] tabular-nums focus:border-[var(--color-accent)] focus:outline-none"
            />
          </div>
          <div className="w-20">
            <label className="block text-[10px] font-mono uppercase tracking-wider text-[var(--color-text-muted)] mb-1">Moneda</label>
            <select
              value={moneda}
              onChange={(e) => setMoneda(e.target.value as Moneda)}
              className="w-full rounded border border-[var(--color-border)] bg-[var(--color-bg-app)] px-2 py-1.5 text-sm text-[var(--color-text-primary)] focus:border-[var(--color-accent)] focus:outline-none"
            >
              <option value="USD">USD</option>
              <option value="UYU">UYU</option>
            </select>
          </div>
          <div className="w-36">
            <label className="block text-[10px] font-mono uppercase tracking-wider text-[var(--color-text-muted)] mb-1">Fecha (opc.)</label>
            <input
              type="date"
              value={fecha}
              onChange={(e) => setFecha(e.target.value)}
              className="w-full rounded border border-[var(--color-border)] bg-[var(--color-bg-app)] px-2 py-1.5 text-sm text-[var(--color-text-primary)] focus:border-[var(--color-accent)] focus:outline-none"
            />
          </div>
          <button
            type="submit"
            disabled={!canSubmit}
            className="rounded bg-[var(--color-accent)] px-3 py-1.5 text-sm font-medium text-gray-900 hover:bg-[var(--color-accent-hover,var(--color-accent))] disabled:opacity-40"
          >
            Agregar
          </button>
        </form>
      )}

      {items.length === 0 ? (
        <p className="text-sm text-[var(--color-text-muted)] text-center py-6">
          Sin costos no-material cargados.
          {canEdit && <><br /><span className="text-xs">Agregá mano de obra, tercerizados o fletes con el formulario de arriba.</span></>}
        </p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-[var(--color-border)] text-[10px] font-mono uppercase tracking-wider text-[var(--color-text-muted)]">
                <th className="px-3 py-2 text-left font-medium">Concepto</th>
                <th className="px-2 py-2 text-right font-medium">Monto</th>
                <th className="px-2 py-2 text-right font-medium">USD</th>
                <th className="px-2 py-2 text-right font-medium">Fecha</th>
                {canEdit && <th className="px-2 py-2"></th>}
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--color-border)]">
              {items.map((c) => (
                <tr key={c.id} className="hover:bg-[var(--color-bg-card-hover)]">
                  <td className="px-3 py-2 text-[var(--color-text-primary)]">
                    <div className="font-medium">{c.concepto}</div>
                    {c.notas && <div className="text-[10px] text-[var(--color-text-muted)]">{c.notas}</div>}
                  </td>
                  <td className="px-2 py-2 text-right tabular-nums text-[var(--color-text-secondary)]">{fmtCurrency(c.monto, c.moneda)}</td>
                  <td className="px-2 py-2 text-right tabular-nums font-semibold text-[var(--color-text-primary)]">{fmtCurrency(c.montoUSD, 'USD')}</td>
                  <td className="px-2 py-2 text-right text-[var(--color-text-muted)] text-[11px]">{c.fecha ? fmtDate(c.fecha) : '—'}</td>
                  {canEdit && (
                    <td className="px-2 py-2 text-right">
                      <button
                        type="button"
                        onClick={() => deleteMut.mutate(c.id)}
                        disabled={deleteMut.isPending}
                        title="Eliminar costo"
                        className="text-[var(--color-text-muted)] hover:text-red-400 disabled:opacity-40"
                      >
                        <Trash2 size={14} />
                      </button>
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

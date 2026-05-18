import { useEffect, useMemo, useState } from 'react';
import { X, AlertTriangle, Info } from 'lucide-react';
import { fmtCurrency, fmtDate } from '../../lib/finance';
import type { Moneda } from '../../types/finance.types';
import type { PendingInvoiceForSupplier } from '../../api/finance.api';

function klass(...p: (string | false | undefined)[]) { return p.filter(Boolean).join(' '); }

export type ApplyDistribution = { movementId: string; monto: number }[];

interface Props {
  /** Total que sale de la cuenta (= form.monto). */
  totalPago: number;
  moneda: Moneda;
  facturas: PendingInvoiceForSupplier[];
  /** Distribución existente (si el usuario abre y reabre el modal). */
  initialDistribution?: ApplyDistribution;
  onClose: () => void;
  onConfirm: (distribution: ApplyDistribution) => void;
}

export function ApplyToPendingFromMovementModal({
  totalPago,
  moneda,
  facturas,
  initialDistribution,
  onClose,
  onConfirm,
}: Props) {
  const [montos, setMontos] = useState<Record<string, string>>({});
  const [selected, setSelected] = useState<Set<string>>(new Set());

  useEffect(() => {
    if (initialDistribution && initialDistribution.length > 0) {
      const next: Record<string, string> = {};
      const sel = new Set<string>();
      for (const d of initialDistribution) {
        next[d.movementId] = d.monto.toFixed(2);
        sel.add(d.movementId);
      }
      setMontos(next);
      setSelected(sel);
      return;
    }
    // Default: rellenar facturas en orden hasta consumir el monto.
    const next: Record<string, string> = {};
    const sel = new Set<string>();
    let restante = totalPago;
    for (const f of facturas) {
      if (restante <= 0.005) break;
      const aplicar = Math.min(f.saldoPendiente, restante);
      if (aplicar > 0.005) {
        next[f.id] = aplicar.toFixed(2);
        sel.add(f.id);
        restante = Math.round((restante - aplicar) * 100) / 100;
      }
    }
    setMontos(next);
    setSelected(sel);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function toggleSel(id: string, f: PendingInvoiceForSupplier) {
    setSelected(prev => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
        if (!montos[id]) {
          const yaAplicado = Object.entries(montos)
            .filter(([k]) => prev.has(k))
            .reduce((acc, [, v]) => acc + (parseFloat(v) || 0), 0);
          const restante = Math.max(0, totalPago - yaAplicado);
          const propuesto = Math.min(f.saldoPendiente, restante);
          if (propuesto > 0.005) setMontos(p => ({ ...p, [id]: propuesto.toFixed(2) }));
        }
      }
      return next;
    });
  }

  function setMonto(id: string, v: string) {
    setMontos(p => ({ ...p, [id]: v }));
  }

  const totalAAplicar = useMemo(() => {
    let total = 0;
    for (const id of selected) {
      const v = parseFloat(montos[id] || '0');
      if (isFinite(v) && v > 0) total += v;
    }
    return Math.round(total * 100) / 100;
  }, [selected, montos]);

  const sobrante = Math.round((totalPago - totalAAplicar) * 100) / 100;
  const excede = sobrante < -0.005;
  const sinSobrante = Math.abs(sobrante) <= 0.005;
  const algunaInvalida = useMemo(() => {
    for (const id of selected) {
      const f = facturas.find(x => x.id === id);
      if (!f) continue;
      const v = parseFloat(montos[id] || '0');
      if (!isFinite(v) || v <= 0) return true;
      if (v > f.saldoPendiente + 0.005) return true;
    }
    return false;
  }, [selected, montos, facturas]);

  function confirm() {
    const distribution: ApplyDistribution = Array.from(selected)
      .map(id => ({ movementId: id, monto: parseFloat(montos[id] || '0') }))
      .filter(d => d.monto > 0.005);
    onConfirm(distribution);
  }

  return (
    <div className="fixed inset-0 bg-black/60 z-[70] flex items-center justify-center p-4" onMouseDown={e => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="bg-[var(--color-bg-card)] border border-[var(--color-border)] rounded-xl w-full max-w-3xl max-h-[85vh] flex flex-col shadow-2xl">
        <div className="flex items-center justify-between p-4 border-b border-[var(--color-border)]">
          <div>
            <p className="text-sm font-semibold text-[var(--color-text-primary)]">Aplicar pago a facturas pendientes</p>
            <p className="text-xs text-[var(--color-text-muted)] mt-0.5">
              Total del pago: <strong className="text-[var(--color-text-primary)] tabular-nums">{fmtCurrency(totalPago, moneda)}</strong>
              <span className="mx-1">·</span>
              {facturas.length} factura{facturas.length === 1 ? '' : 's'} pendiente{facturas.length === 1 ? '' : 's'}
            </p>
          </div>
          <button onClick={onClose} className="text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)]"><X className="w-5 h-5" /></button>
        </div>

        <div className="flex-1 overflow-y-auto p-3">
          <div className="rounded-lg border border-[var(--color-border)] overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-[var(--color-bg-card-hover)] text-[10px] font-mono uppercase tracking-wider text-[var(--color-text-muted)]">
                  <th className="px-2 py-2 w-10" />
                  <th className="px-3 py-2 text-left font-medium">Factura</th>
                  <th className="px-2 py-2 text-left font-medium w-24">Vence</th>
                  <th className="px-2 py-2 text-right font-medium w-32">Saldo pendiente</th>
                  <th className="px-2 py-2 text-right font-medium w-28">Estado</th>
                  <th className="px-2 py-2 text-right font-medium w-32">A aplicar</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--color-border)]">
                {facturas.map(f => {
                  const sel = selected.has(f.id);
                  const inputVal = parseFloat(montos[f.id] || '0');
                  const excedeRow = sel && isFinite(inputVal) && inputVal > f.saldoPendiente + 0.005;
                  return (
                    <tr key={f.id} className={klass('hover:bg-[var(--color-bg-card-hover)]', sel && 'bg-[var(--color-bg-card-hover)]/50')}>
                      <td className="px-2 py-2">
                        <input type="checkbox" checked={sel} onChange={() => toggleSel(f.id, f)} />
                      </td>
                      <td className="px-3 py-2 text-[var(--color-text-primary)]">
                        <div className="font-medium truncate max-w-[280px]">{f.descripcion}</div>
                        <div className="text-[10px] text-[var(--color-text-muted)]">{fmtDate(f.fecha)} · monto factura {fmtCurrency(f.monto, f.moneda)}</div>
                      </td>
                      <td className="px-2 py-2 text-[var(--color-text-muted)] text-[11px]">
                        {f.dueDate ? fmtDate(f.dueDate) : '—'}
                      </td>
                      <td className="px-2 py-2 text-right tabular-nums text-[var(--color-text-primary)]">
                        {fmtCurrency(f.saldoPendiente, f.moneda)}
                      </td>
                      <td className="px-2 py-2 text-right text-[10px] font-mono text-[var(--color-text-muted)]">
                        {f.status === 'PARCIALMENTE_PAGADO' ? 'Parcial' : 'A pagar'}
                      </td>
                      <td className="px-2 py-2 text-right">
                        <input
                          type="number" min="0" step="0.01"
                          disabled={!sel}
                          className={klass(
                            'w-24 px-2 py-1 rounded text-xs bg-[var(--color-bg-app)] border text-[var(--color-text-primary)] tabular-nums focus:outline-none focus:ring-1 focus:ring-[var(--color-accent)] disabled:opacity-40',
                            excedeRow ? 'border-red-500' : 'border-[var(--color-border)]',
                          )}
                          value={sel ? (montos[f.id] ?? '') : ''}
                          onChange={e => setMonto(f.id, e.target.value)}
                        />
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {sinSobrante && totalAAplicar > 0 && (
            <div className="mt-3 rounded-lg border border-blue-500/30 bg-blue-500/10 px-3 py-2 text-xs text-[var(--color-text-secondary)] flex items-start gap-2">
              <Info className="w-4 h-4 text-blue-400 shrink-0 mt-0.5" />
              <div>
                Todo el pago se aplicará a facturas pendientes. <strong>No se creará un movimiento nuevo</strong>. El flujo equivale a "Registrar pago" desde Pagos.
              </div>
            </div>
          )}
        </div>

        <div className="px-4 py-3 border-t border-[var(--color-border)] flex items-center justify-between flex-wrap gap-3">
          <div className="text-sm space-x-3">
            <span className="text-[var(--color-text-muted)]">Aplicado a facturas:</span>
            <span className="font-semibold text-[var(--color-text-primary)] tabular-nums">{fmtCurrency(totalAAplicar, moneda)}</span>
            <span className="text-[var(--color-text-muted)]">Resto al movimiento nuevo:</span>
            <span className={klass(
              'font-semibold tabular-nums',
              excede ? 'text-red-400' : sinSobrante ? 'text-[var(--color-text-muted)]' : 'text-[var(--color-state-done-text)]',
            )}>
              {fmtCurrency(sobrante, moneda)}
              {excede && <AlertTriangle className="w-3.5 h-3.5 inline ml-1 mb-0.5" />}
            </span>
          </div>
          <div className="flex gap-2">
            <button onClick={onClose} className="px-3 py-2 rounded-lg border border-[var(--color-border)] text-sm text-[var(--color-text-secondary)] hover:bg-[var(--color-bg-card-hover)]">
              Cancelar
            </button>
            <button
              onClick={confirm}
              disabled={excede || algunaInvalida || totalAAplicar <= 0}
              className={klass(
                'px-4 py-2 rounded-lg text-sm font-semibold transition-colors',
                excede || algunaInvalida || totalAAplicar <= 0
                  ? 'bg-[var(--color-border)] text-[var(--color-text-muted)] cursor-not-allowed'
                  : 'bg-[var(--color-accent)] text-gray-900 hover:bg-[var(--color-accent-hover)]',
              )}
            >
              Confirmar aplicación
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

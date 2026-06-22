import { useEffect, useMemo, useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'react-hot-toast';
import { AlertTriangle } from 'lucide-react';
import { Sheet } from '../ui/Sheet';
import { applyPayment, getPayment } from '../../api/payments.api';
import { getMovements, isMovementRow } from '../../api/finance.api';
import { fmtCurrency, fmtDate } from '../../lib/finance';
import type { FinanceMovement } from '../../types/finance.types';

function klass(...p: (string | false | undefined)[]) { return p.filter(Boolean).join(' '); }
function getApiErr(err: unknown) {
  return (err as { response?: { data?: { message?: string } } })?.response?.data?.message;
}

interface Props {
  paymentId: string;
  onClose: () => void;
  /** Si se pasa, sólo permite aplicar a este movimiento (oculta el resto) */
  preselectMovementId?: string;
}

export function ApplyPaymentModal({ paymentId, onClose, preselectMovementId }: Props) {
  const qc = useQueryClient();
  const [montos, setMontos] = useState<Record<string, string>>({});
  const [selected, setSelected] = useState<Set<string>>(new Set());

  const { data: payment, isLoading: loadingPayment } = useQuery({
    queryKey: ['payment', paymentId],
    queryFn: () => getPayment(paymentId),
  });

  // Facturas pendientes del mismo proveedor y misma moneda (sin pagar 100%)
  const { data: facturas, isLoading: loadingFacturas } = useQuery({
    queryKey: ['movements-pendientes-proveedor', payment?.supplierId],
    queryFn: () => getMovements({
      // El backend acepta status pero la UI usa filtro local; pedimos todo lo del proveedor
      // y filtramos después en cliente.
      limit: 100,
    }),
    enabled: !!payment?.supplierId,
  });

  // Facturas elegibles: gasto, mismo proveedor, misma moneda, status A_PAGAR/COMPROMETIDO/PARCIALMENTE_PAGADO
  const elegibles = useMemo(() => {
    if (!payment || !facturas) return [];
    const all = facturas.data.filter(isMovementRow).filter(m =>
      m.tipoMovimiento === 'GASTO'
      && m.supplierId === payment.supplierId
      && m.moneda === payment.moneda
      && (m.status === 'A_PAGAR' || m.status === 'COMPROMETIDO' || m.status === 'PARCIALMENTE_PAGADO'),
    );
    if (preselectMovementId) return all.filter(m => m.id === preselectMovementId);
    return all;
  }, [payment, facturas, preselectMovementId]);

  // Pre-seleccionar y pre-llenar cuando se trae preselectMovementId o se carga payment
  useEffect(() => {
    if (preselectMovementId && elegibles.length > 0) {
      const next: Record<string, string> = {};
      const sel = new Set<string>();
      for (const m of elegibles) {
        const saldo = computeSaldo(m);
        const aplicable = Math.min(saldo, payment?.saldoSinAplicar ?? 0);
        if (aplicable > 0) {
          next[m.id] = aplicable.toString();
          sel.add(m.id);
        }
      }
      setMontos(next);
      setSelected(sel);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [preselectMovementId, elegibles.length]);

  function computeSaldo(m: FinanceMovement): number {
    // El listing devuelve saldoPendiente real (calculado contra applications activas).
    return m.saldoPendiente;
  }

  function toggleSel(id: string, m: FinanceMovement) {
    setSelected(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else {
        next.add(id);
        // Pre-rellenar monto con el saldo aproximado o lo que reste del pago
        const saldoSinAplicar = (payment?.saldoSinAplicar ?? 0)
          - Object.entries(montos).filter(([k]) => prev.has(k)).reduce((acc, [, v]) => acc + (parseFloat(v) || 0), 0);
        const propuesto = Math.min(computeSaldo(m), saldoSinAplicar);
        if (propuesto > 0 && !montos[id]) {
          setMontos(p => ({ ...p, [id]: propuesto.toFixed(2) }));
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
      if (isFinite(v)) total += v;
    }
    return Math.round(total * 100) / 100;
  }, [selected, montos]);

  const saldoSinAplicar = payment?.saldoSinAplicar ?? 0;
  const saldoDespues = Math.round((saldoSinAplicar - totalAAplicar) * 100) / 100;
  const excede = totalAAplicar > saldoSinAplicar + 0.005;
  const seleccionadas = selected.size;

  const applyMut = useMutation({
    mutationFn: () => {
      const apps = Array.from(selected)
        .map(id => ({ movementId: id, monto: parseFloat(montos[id] || '0') }))
        .filter(a => a.monto > 0);
      return applyPayment(paymentId, apps);
    },
    onSuccess: () => {
      toast.success(`${seleccionadas} aplicación(es) registradas`);
      qc.invalidateQueries({ queryKey: ['payments'] });
      qc.invalidateQueries({ queryKey: ['payment', paymentId] });
      qc.invalidateQueries({ queryKey: ['finance-movements'] });
      qc.invalidateQueries({ queryKey: ['finance-dashboard'] });
      qc.invalidateQueries({ queryKey: ['account-summary'] });
      onClose();
    },
    onError: (err: unknown) => toast.error(getApiErr(err) ?? 'Error al aplicar pago'),
  });

  if (loadingPayment || !payment) {
    return (
      <Sheet open onClose={onClose} elevated size="wide" title="Aplicar pago a facturas">
        <p className="text-sm text-[var(--color-text-muted)] text-center py-8">Cargando…</p>
      </Sheet>
    );
  }

  return (
    <Sheet
      open
      onClose={onClose}
      elevated
      size="wide"
      title="Aplicar pago a facturas"
      footer={
        <>
          <button onClick={onClose} className="px-3 py-2 rounded-lg border border-[var(--color-border)] text-sm text-[var(--color-text-secondary)] hover:bg-[var(--color-bg-card-hover)]">
            Cancelar
          </button>
          <button
            onClick={() => applyMut.mutate()}
            disabled={excede || seleccionadas === 0 || totalAAplicar <= 0 || applyMut.isPending}
            className={klass(
              'px-4 py-2 rounded-lg text-sm font-semibold transition-colors',
              excede || seleccionadas === 0 || totalAAplicar <= 0 || applyMut.isPending
                ? 'bg-[var(--color-border)] text-[var(--color-text-muted)] cursor-not-allowed'
                : 'bg-[var(--color-accent)] text-gray-900 hover:bg-[var(--color-accent-hover)]',
            )}
          >
            {applyMut.isPending ? 'Aplicando…' : 'Aplicar'}
          </button>
        </>
      }
    >
        <p className="mb-3 text-xs text-[var(--color-text-muted)]">
          Pago de <strong className="text-[var(--color-text-primary)] tabular-nums">{fmtCurrency(payment.monto, payment.moneda)}</strong>
          <span className="mx-1">·</span>
          Saldo sin aplicar: <strong className={klass('tabular-nums', saldoSinAplicar > 0 ? 'text-[var(--color-warning-text)]' : 'text-[var(--color-text-muted)]')}>
            {fmtCurrency(saldoSinAplicar, payment.moneda)}
          </strong>
          <span className="mx-1">·</span>
          Proveedor: <strong className="text-[var(--color-text-primary)]">{payment.supplier?.nombre ?? '—'}</strong>
        </p>

        <div>
          {loadingFacturas ? (
            <p className="text-sm text-[var(--color-text-muted)] text-center py-8">Cargando facturas…</p>
          ) : elegibles.length === 0 ? (
            <p className="text-sm text-[var(--color-text-muted)] text-center py-8">
              No hay facturas pendientes para este proveedor en {payment.moneda}.
            </p>
          ) : (
            <div className="rounded-lg border border-[var(--color-border)] overflow-hidden">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-[var(--color-bg-card-hover)] text-[10px] font-mono uppercase tracking-wider text-[var(--color-text-muted)]">
                    <th className="px-2 py-2 w-10" />
                    <th className="px-3 py-2 text-left font-medium">Factura</th>
                    <th className="px-2 py-2 text-left font-medium w-24">Vence</th>
                    <th className="px-2 py-2 text-right font-medium w-32">Monto</th>
                    <th className="px-2 py-2 text-right font-medium w-32">Estado</th>
                    <th className="px-2 py-2 text-right font-medium w-32">A aplicar</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[var(--color-border)]">
                  {elegibles.map(m => {
                    const sel = selected.has(m.id);
                    return (
                      <tr key={m.id} className={klass('hover:bg-[var(--color-bg-card-hover)]', sel && 'bg-[var(--color-bg-card-hover)]/50')}>
                        <td className="px-2 py-2">
                          <input type="checkbox" checked={sel} onChange={() => toggleSel(m.id, m)} />
                        </td>
                        <td className="px-3 py-2 text-[var(--color-text-primary)]">
                          <div className="font-medium truncate max-w-[260px]">{m.descripcion}</div>
                          <div className="text-[10px] text-[var(--color-text-muted)]">{fmtDate(m.fecha)}</div>
                        </td>
                        <td className="px-2 py-2 text-[var(--color-text-muted)] text-[11px]">
                          {m.dueDate ? fmtDate(m.dueDate) : '—'}
                        </td>
                        <td className="px-2 py-2 text-right tabular-nums text-[var(--color-text-primary)]">
                          <div>{fmtCurrency(m.monto, m.moneda)}</div>
                          {m.saldoPendiente !== m.monto && (
                            <div className="text-[10px] text-[var(--color-text-muted)]">saldo: {fmtCurrency(m.saldoPendiente, m.moneda)}</div>
                          )}
                        </td>
                        <td className="px-2 py-2 text-right text-[10px] font-mono text-[var(--color-text-muted)]">
                          {m.status === 'PARCIALMENTE_PAGADO' ? 'Parcial' : m.status === 'A_PAGAR' ? 'A pagar' : 'Comprometido'}
                        </td>
                        <td className="px-2 py-2 text-right">
                          <input
                            type="number" min="0" step="0.01"
                            disabled={!sel}
                            className="w-24 px-2 py-1 rounded text-xs bg-[var(--color-bg-app)] border border-[var(--color-border)] text-[var(--color-text-primary)] tabular-nums focus:outline-none focus:ring-1 focus:ring-[var(--color-accent)] disabled:opacity-40"
                            value={sel ? (montos[m.id] ?? '') : ''}
                            onChange={e => setMonto(m.id, e.target.value)}
                          />
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>

        <div className="mt-3 border-t border-[var(--color-border)] pt-3 text-sm">
          <span className="text-[var(--color-text-muted)]">Total a aplicar:</span>
          <span className="ml-2 font-semibold text-[var(--color-text-primary)] tabular-nums">{fmtCurrency(totalAAplicar, payment.moneda)}</span>
          <span className="ml-3 text-[var(--color-text-muted)]">Saldo después:</span>
          <span className={klass(
            'ml-2 font-semibold tabular-nums',
            excede ? 'text-red-400' : saldoDespues === 0 ? 'text-[var(--color-state-done-text)]' : 'text-[var(--color-warning-text)]',
          )}>
            {fmtCurrency(saldoDespues, payment.moneda)}
            {excede && <AlertTriangle className="w-3.5 h-3.5 inline ml-1 mb-0.5" />}
          </span>
        </div>
    </Sheet>
  );
}

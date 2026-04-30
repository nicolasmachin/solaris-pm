import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'react-hot-toast';
import { X, Wallet, ChevronDown, ChevronRight, Info } from 'lucide-react';
import { applySaldoAFavorToMovement } from '../../api/finance.api';
import type { SaldoAFavorResponse } from '../../api/finance.api';
import { fmtCurrency, fmtDate } from '../../lib/finance';
import { METODO_PAGO_LABEL } from '../../types/finance.types';

function klass(...p: (string | false | undefined)[]) { return p.filter(Boolean).join(' '); }
function getApiErr(err: unknown) {
  return (err as { response?: { data?: { message?: string } } })?.response?.data?.message;
}

interface Props {
  movementId: string;
  movementMonto: number;
  movementMoneda: 'USD' | 'UYU';
  movementMontoPagado: number;
  supplierName: string;
  saldoAFavor: SaldoAFavorResponse;
  onClose: () => void;
  onApplied?: () => void;
  /** Texto del botón "no aplicar". Por defecto "No aplicar". */
  skipLabel?: string;
}

export function ApplySaldoAFavorModal({
  movementId, movementMonto, movementMoneda, movementMontoPagado, supplierName,
  saldoAFavor, onClose, onApplied, skipLabel = 'No aplicar',
}: Props) {
  const qc = useQueryClient();
  const [showDetail, setShowDetail] = useState(false);

  const saldoPendienteFactura = Math.max(0, movementMonto - movementMontoPagado);
  const aplicable = Math.min(saldoAFavor.total, saldoPendienteFactura);
  const saldoPendienteDespues = Math.max(0, saldoPendienteFactura - aplicable);

  const mut = useMutation({
    mutationFn: () => applySaldoAFavorToMovement(movementId),
    onSuccess: (res) => {
      const msg = res.newStatus === 'PAGADO'
        ? `Saldo a favor aplicado. Factura PAGADA (${fmtCurrency(res.totalAplicado, movementMoneda)} desde ${res.applicationsCreadas.length} pago(s)).`
        : `Saldo a favor aplicado: ${fmtCurrency(res.totalAplicado, movementMoneda)} (factura PARCIALMENTE_PAGADA, falta ${fmtCurrency(res.saldoPendiente, movementMoneda)}).`;
      toast.success(msg, { duration: 6000 });
      qc.invalidateQueries({ queryKey: ['finance-movements'] });
      qc.invalidateQueries({ queryKey: ['movement-detail', movementId] });
      qc.invalidateQueries({ queryKey: ['payments'] });
      qc.invalidateQueries({ queryKey: ['suppliers'] });
      qc.invalidateQueries({ queryKey: ['supplier-account-summary'] });
      qc.invalidateQueries({ queryKey: ['account-balance'] });
      qc.invalidateQueries({ queryKey: ['finance-invariant-check'] });
      onApplied?.();
      onClose();
    },
    onError: (err) => toast.error(getApiErr(err) ?? 'No se pudo aplicar el saldo a favor'),
  });

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4" onClick={e => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="w-full max-w-md max-h-[92vh] overflow-y-auto rounded-xl border border-[var(--color-border)] bg-[var(--color-bg-card)] shadow-2xl">
        <div className="flex items-center justify-between border-b border-[var(--color-border)] px-5 py-3">
          <div className="flex items-center gap-2">
            <Wallet className="h-4 w-4 text-emerald-400" />
            <p className="text-sm font-semibold text-[var(--color-text-primary)]">Hay saldo a favor disponible</p>
          </div>
          <button onClick={onClose} className="rounded p-1 text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)]" aria-label="Cerrar">
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="px-5 py-4 space-y-4">
          <p className="text-sm text-[var(--color-text-secondary)]">
            <strong className="text-[var(--color-text-primary)]">{supplierName}</strong> tiene{' '}
            <strong className="text-emerald-400">{fmtCurrency(saldoAFavor.total, movementMoneda)}</strong>{' '}
            de saldo a favor (Pagos sin aplicar totalmente).
          </p>

          <div className="rounded-md border border-[var(--color-border)] bg-[var(--color-bg-app)] p-3 space-y-1.5 text-sm">
            <div className="flex justify-between">
              <span className="text-[var(--color-text-muted)]">Factura nueva:</span>
              <span className="tabular-nums text-[var(--color-text-primary)]">{fmtCurrency(movementMonto, movementMoneda)}</span>
            </div>
            {movementMontoPagado > 0.005 && (
              <div className="flex justify-between">
                <span className="text-[var(--color-text-muted)]">Ya pagado:</span>
                <span className="tabular-nums text-emerald-400">{fmtCurrency(movementMontoPagado, movementMoneda)}</span>
              </div>
            )}
            <div className="flex justify-between border-t border-[var(--color-border)] pt-1.5">
              <span className="text-[var(--color-text-muted)]">Aplicable ahora:</span>
              <span className="tabular-nums font-semibold text-[var(--color-accent)]">{fmtCurrency(aplicable, movementMoneda)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-[var(--color-text-muted)]">Saldo pendiente después:</span>
              <span className={klass('tabular-nums font-semibold', saldoPendienteDespues > 0.005 ? 'text-amber-400' : 'text-emerald-400')}>
                {fmtCurrency(saldoPendienteDespues, movementMoneda)}
              </span>
            </div>
          </div>

          <div>
            <button
              onClick={() => setShowDetail(v => !v)}
              className="flex items-center gap-1 text-xs font-mono uppercase tracking-wider text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)]"
            >
              {showDetail ? <ChevronDown className="w-3 h-3" /> : <ChevronRight className="w-3 h-3" />}
              Ver detalle FIFO ({saldoAFavor.payments.length} pago{saldoAFavor.payments.length === 1 ? '' : 's'})
            </button>
            {showDetail && (
              <div className="mt-2 rounded border border-[var(--color-border)] overflow-hidden">
                <table className="w-full text-[11px]">
                  <thead>
                    <tr className="bg-[var(--color-bg-app)] text-[10px] font-mono uppercase tracking-wider text-[var(--color-text-muted)]">
                      <th className="px-2 py-1.5 text-left">Fecha</th>
                      <th className="px-2 py-1.5 text-left">Método / Ref.</th>
                      <th className="px-2 py-1.5 text-right">Saldo s/aplicar</th>
                    </tr>
                  </thead>
                  <tbody>
                    {saldoAFavor.payments.map(p => (
                      <tr key={p.id} className="border-t border-[var(--color-border)]">
                        <td className="px-2 py-1.5 text-[var(--color-text-secondary)]">{fmtDate(p.fecha)}</td>
                        <td className="px-2 py-1.5 text-[var(--color-text-muted)]">
                          {METODO_PAGO_LABEL[p.metodo]}{p.referencia ? ` · ${p.referencia}` : ''}
                        </td>
                        <td className="px-2 py-1.5 text-right tabular-nums text-emerald-400">
                          {fmtCurrency(p.saldoSinAplicar, movementMoneda)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          <div className="rounded-md border border-blue-500/30 bg-blue-500/10 px-3 py-2 flex items-start gap-2">
            <Info className="h-4 w-4 text-blue-400 shrink-0 mt-0.5" />
            <p className="text-[11px] text-[var(--color-text-secondary)]">
              Al confirmar se aplicará el saldo automáticamente, empezando por el pago más antiguo (FIFO).
              No se afecta el saldo de cuentas — sólo se reduce el saldo a favor del proveedor y se cierra (parcial o totalmente) la factura.
            </p>
          </div>
        </div>

        <div className="flex justify-end gap-2 border-t border-[var(--color-border)] px-5 py-3">
          <button
            onClick={onClose}
            className="rounded-md border border-[var(--color-border)] px-3 py-1.5 text-sm text-[var(--color-text-secondary)] hover:bg-[var(--color-bg-app)]"
          >
            {skipLabel}
          </button>
          <button
            onClick={() => mut.mutate()}
            disabled={mut.isPending || aplicable < 0.005}
            className={klass(
              'rounded-md px-4 py-1.5 text-sm font-semibold transition-colors',
              mut.isPending || aplicable < 0.005
                ? 'bg-[var(--color-border)] text-[var(--color-text-muted)] cursor-not-allowed'
                : 'bg-[var(--color-accent)] text-gray-900 hover:bg-[var(--color-accent-hover)]',
            )}
          >
            {mut.isPending ? 'Aplicando…' : 'Aplicar saldo a favor'}
          </button>
        </div>
      </div>
    </div>
  );
}

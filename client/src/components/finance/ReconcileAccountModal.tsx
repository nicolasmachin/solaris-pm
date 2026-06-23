import { useEffect, useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'react-hot-toast';
import { ArrowUpCircle, ArrowDownCircle, CheckCircle2, AlertTriangle } from 'lucide-react';
import { Sheet } from '../ui/Sheet';
import { getAccountBalance } from '../../api/accounts.api';
import { reconcileAccount } from '../../api/accounts.api';
import type { Account } from '../../types/accounts.types';
import { todayLocalISO, formatDate } from '../../utils/date';

function fmt(n: number, currency: string) {
  return `${n.toLocaleString('es-UY', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ${currency}`;
}

export function ReconcileAccountModal({ account, onClose }: { account: Account; onClose: () => void }) {
  const qc = useQueryClient();
  const today = todayLocalISO();

  const { data: balance } = useQuery({
    queryKey: ['account-balance', account.id],
    queryFn: () => getAccountBalance(account.id),
  });

  const saldoCalculado = balance?.saldoActual ?? 0;
  const [saldoRealStr, setSaldoRealStr] = useState<string>('');
  const [fecha, setFecha] = useState(today);
  const [notas, setNotas] = useState('');

  const saldoReal = Number.parseFloat(saldoRealStr);
  const saldoRealValido = Number.isFinite(saldoReal);
  const diferencia = saldoRealValido ? Math.round((saldoReal - saldoCalculado) * 100) / 100 : 0;
  const cuadra = saldoRealValido && Math.abs(diferencia) <= 0.01;

  // Pre-llenar saldoReal con el calculado para que el usuario edite
  useEffect(() => {
    if (balance && saldoRealStr === '') {
      setSaldoRealStr(saldoCalculado.toFixed(2));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [balance]);

  const mut = useMutation({
    mutationFn: () => reconcileAccount(account.id, {
      fecha,
      saldoReal,
      notas: notas || null,
    }),
    onSuccess: (r) => {
      if (Math.abs(Number(r.diferencia)) <= 0.01) {
        toast.success('Conciliación exitosa. La cuenta cuadra.', { duration: 5000 });
      } else {
        const sign = Number(r.diferencia) > 0 ? '+' : '';
        toast.success(
          `Saldo actualizado a ${fmt(saldoReal, account.moneda)}. Diferencia anterior: ${sign}${fmt(Number(r.diferencia), account.moneda)}.`,
          { duration: 6000 },
        );
      }
      qc.invalidateQueries({ queryKey: ['accounts'] });
      qc.invalidateQueries({ queryKey: ['accounts-summary'] });
      qc.invalidateQueries({ queryKey: ['account-balance'] });
      qc.invalidateQueries({ queryKey: ['account-reconciliations', account.id] });
      qc.invalidateQueries({ queryKey: ['reconciliation-alerts'] });
      qc.invalidateQueries({ queryKey: ['finance-movements'] });
      qc.invalidateQueries({ queryKey: ['finance-cashflow'] });
      qc.invalidateQueries({ queryKey: ['finance-invariant-check'] });
      onClose();
    },
    onError: (err) => {
      const msg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message;
      toast.error(msg ?? 'Error al guardar conciliación');
    },
  });

  return (
    <Sheet
      open
      onClose={onClose}
      title={`Conciliar ${account.nombre}`}
      footer={
        <>
          <button
            type="button"
            onClick={onClose}
            className="rounded-md border border-[var(--color-border)] px-3 py-1.5 text-sm text-[var(--color-text-secondary)] hover:bg-[var(--color-bg-app)]"
          >
            Cancelar
          </button>
          <button
            type="button"
            onClick={() => mut.mutate()}
            disabled={!saldoRealValido || mut.isPending}
            className="rounded-md bg-[var(--color-accent)] px-3 py-1.5 text-sm font-semibold text-[var(--color-bg-app)] hover:opacity-90 disabled:opacity-50"
          >
            {mut.isPending ? 'Guardando…' : 'Confirmar conciliación'}
          </button>
        </>
      }
    >
        <div className="space-y-4">
          <div className="rounded-md border border-[var(--color-border)] bg-[var(--color-bg-app)] px-3 py-2.5">
            <p className="text-[10px] font-mono uppercase tracking-wider text-[var(--color-text-muted)]">Saldo según el sistema</p>
            <p className="text-xl font-bold tabular-nums text-[var(--color-text-primary)]">{fmt(saldoCalculado, account.moneda)}</p>
            <p className="mt-1 text-[10px] text-[var(--color-text-muted)]">Calculado por movimientos cargados</p>
          </div>

          <div>
            <label className="mb-1 block text-[11px] font-medium text-[var(--color-text-primary)]">
              Saldo real (según home banking) <span className="text-red-500">*</span>
            </label>
            <input
              type="number"
              step="0.01"
              value={saldoRealStr}
              onChange={(e) => setSaldoRealStr(e.target.value)}
              className="w-full rounded-md border border-[var(--color-border)] bg-[var(--color-bg-app)] px-3 py-2 text-sm text-[var(--color-text-primary)] focus:border-[var(--color-accent)] focus:outline-none"
              autoFocus
            />
          </div>

          <div>
            <label className="mb-1 block text-[11px] font-medium text-[var(--color-text-primary)]">
              Fecha del saldo real <span className="text-red-500">*</span>
            </label>
            <input
              type="date"
              value={fecha}
              onChange={(e) => setFecha(e.target.value)}
              className="w-full rounded-md border border-[var(--color-border)] bg-[var(--color-bg-app)] px-3 py-2 text-sm text-[var(--color-text-primary)] focus:border-[var(--color-accent)] focus:outline-none"
            />
          </div>

          {saldoRealValido && cuadra && (
            <div className="rounded-md border border-emerald-500/40 bg-emerald-500/10 px-3 py-2.5">
              <p className="text-sm flex items-center gap-2 text-emerald-500">
                <CheckCircle2 className="h-4 w-4" /> Cuenta conciliada — el saldo real coincide con el calculado.
              </p>
            </div>
          )}

          {saldoRealValido && !cuadra && (
            <div className="rounded-md border border-amber-500/40 bg-amber-500/10 px-3 py-2.5 space-y-2">
              <p className="text-sm flex items-center gap-2 font-semibold text-[var(--color-text-primary)]">
                {diferencia > 0 ? <ArrowUpCircle className="h-4 w-4 text-emerald-500" /> : <ArrowDownCircle className="h-4 w-4 text-amber-500" />}
                Diferencia: {diferencia > 0 ? '+' : ''}{fmt(diferencia, account.moneda)}
              </p>
              <p className="text-[11px] text-[var(--color-text-secondary)]">
                El sistema dice <strong>{fmt(saldoCalculado, account.moneda)}</strong> pero el banco dice <strong>{fmt(saldoReal, account.moneda)}</strong>.
              </p>
              <p className="text-[11px] text-[var(--color-text-secondary)]">
                El saldo real representa el <strong>cierre del {formatDate(fecha)}</strong>, ya incluye TODOS los movimientos de ese día.
              </p>
              <div className="text-[11px] text-[var(--color-text-secondary)] flex items-start gap-1.5">
                <AlertTriangle className="h-3.5 w-3.5 text-amber-400 shrink-0 mt-0.5" />
                <div>
                  <strong className="text-[var(--color-text-primary)]">Al confirmar:</strong>
                  <ul className="list-disc pl-4 mt-1 space-y-0.5">
                    <li>El saldo del sistema queda en {fmt(saldoReal, account.moneda)} (cierre del {formatDate(fecha)}).</li>
                    <li>NO se crea ningún movimiento de gasto/ingreso.</li>
                    <li>Movimientos del {formatDate(fecha)} y anteriores quedan absorbidos en el nuevo saldo (no se aplican otra vez).</li>
                    <li>Sólo movimientos del día siguiente en adelante afectan al saldo nuevo.</li>
                  </ul>
                </div>
              </div>
            </div>
          )}

          <div>
            <label className="mb-1 block text-[11px] font-medium text-[var(--color-text-primary)]">Notas (opcional)</label>
            <textarea
              value={notas}
              onChange={(e) => setNotas(e.target.value)}
              rows={2}
              className="w-full rounded-md border border-[var(--color-border)] bg-[var(--color-bg-app)] px-3 py-2 text-sm text-[var(--color-text-primary)] focus:border-[var(--color-accent)] focus:outline-none resize-none"
              placeholder="Ej: Conciliación mensual con extracto del banco"
            />
          </div>
        </div>
    </Sheet>
  );
}

import { useEffect, useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'react-hot-toast';
import { X, Scale, ArrowUpCircle, ArrowDownCircle, CheckCircle2 } from 'lucide-react';
import { getAccountBalance } from '../../api/accounts.api';
import { reconcileAccount } from '../../api/accounts.api';
import type { Account } from '../../types/accounts.types';

function fmt(n: number, currency: string) {
  return `${n.toLocaleString('es-UY', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ${currency}`;
}

export function ReconcileAccountModal({ account, onClose }: { account: Account; onClose: () => void }) {
  const qc = useQueryClient();
  const today = new Date().toISOString().slice(0, 10);

  const { data: balance } = useQuery({
    queryKey: ['account-balance', account.id],
    queryFn: () => getAccountBalance(account.id),
  });

  const saldoCalculado = balance?.saldoActual ?? 0;
  const [saldoRealStr, setSaldoRealStr] = useState<string>('');
  const [fecha, setFecha] = useState(today);
  const [notas, setNotas] = useState('');
  const [aplicarAjuste, setAplicarAjuste] = useState(true);

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
      aplicarAjuste: !cuadra && aplicarAjuste,
    }),
    onSuccess: (r) => {
      const msg = r.ajusteMovementId
        ? `Conciliación guardada. Se generó ${r.ajusteMovement?.tipoMovimiento === 'INGRESO' ? 'INGRESO' : 'GASTO'} de ajuste por ${fmt(Math.abs(Number(r.ajusteMovement?.monto ?? 0)), account.moneda)}.`
        : 'Conciliación guardada (sin diferencia).';
      toast.success(msg, { duration: 5000 });
      qc.invalidateQueries({ queryKey: ['accounts'] });
      qc.invalidateQueries({ queryKey: ['accounts-summary'] });
      qc.invalidateQueries({ queryKey: ['account-balance'] });
      qc.invalidateQueries({ queryKey: ['account-reconciliations', account.id] });
      qc.invalidateQueries({ queryKey: ['reconciliation-alerts'] });
      qc.invalidateQueries({ queryKey: ['finance-movements'] });
      qc.invalidateQueries({ queryKey: ['finance-cashflow'] });
      onClose();
    },
    onError: (err) => {
      const msg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message;
      toast.error(msg ?? 'Error al guardar conciliación');
    },
  });

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
      <div className="w-full max-w-md max-h-[92vh] overflow-y-auto rounded-xl border border-[var(--color-border)] bg-[var(--color-bg-card)] shadow-2xl">
        <div className="flex items-center justify-between border-b border-[var(--color-border)] px-5 py-3">
          <div className="flex items-center gap-2">
            <Scale className="h-4 w-4 text-[var(--color-accent)]" />
            <p className="text-sm font-semibold text-[var(--color-text-primary)]">Conciliar {account.nombre}</p>
          </div>
          <button onClick={onClose} className="rounded p-1 text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)]" aria-label="Cerrar">
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="px-5 py-4 space-y-4">
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

          {saldoRealValido && (
            <div
              className={
                cuadra
                  ? 'rounded-md border border-emerald-500/40 bg-emerald-500/10 px-3 py-2.5'
                  : diferencia > 0
                    ? 'rounded-md border border-emerald-500/30 bg-emerald-500/5 px-3 py-2.5'
                    : 'rounded-md border border-amber-500/40 bg-amber-500/10 px-3 py-2.5'
              }
            >
              {cuadra ? (
                <p className="text-sm flex items-center gap-2 text-emerald-500">
                  <CheckCircle2 className="h-4 w-4" /> Cuenta conciliada — el saldo real coincide con el calculado.
                </p>
              ) : (
                <>
                  <p className="text-sm flex items-center gap-2 font-semibold text-[var(--color-text-primary)]">
                    {diferencia > 0 ? <ArrowUpCircle className="h-4 w-4 text-emerald-500" /> : <ArrowDownCircle className="h-4 w-4 text-amber-500" />}
                    Diferencia: {diferencia > 0 ? '+' : ''}{fmt(diferencia, account.moneda)}
                  </p>
                  <p className="mt-1 text-[11px] text-[var(--color-text-secondary)]">
                    {diferencia > 0
                      ? '⬆ Tenés MÁS plata de la que el sistema cree. Probablemente falta cargar un INGRESO.'
                      : '⬇ Tenés MENOS plata de la que el sistema cree. Probablemente falta cargar un GASTO.'}
                  </p>
                </>
              )}
            </div>
          )}

          {saldoRealValido && !cuadra && (
            <label className="flex items-start gap-2 rounded-md border border-[var(--color-border)] px-3 py-2.5 cursor-pointer">
              <input
                type="checkbox"
                checked={aplicarAjuste}
                onChange={(e) => setAplicarAjuste(e.target.checked)}
                className="mt-0.5"
              />
              <span className="text-[11px] text-[var(--color-text-secondary)]">
                <strong className="text-[var(--color-text-primary)]">Crear movimiento de ajuste automático.</strong>
                <br />
                Se generará un {diferencia > 0 ? 'INGRESO' : 'GASTO'} de {fmt(Math.abs(diferencia), account.moneda)} con categoría "Ajuste conciliación" para que el saldo calculado coincida con el real.
              </span>
            </label>
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

        <div className="flex justify-end gap-2 border-t border-[var(--color-border)] px-5 py-3">
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
        </div>
      </div>
    </div>
  );
}

import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { CheckCircle2, AlertTriangle } from 'lucide-react';
import { getFinanceInvariantCheck } from '../../api/finance.api';
import { fmtCurrency } from '../../lib/finance';

/** Widget compacto para /admin: muestra el estado del invariante financiero. */
export function FinanceHealthWidget() {
  const { data, isLoading, isError } = useQuery({
    queryKey: ['finance-invariant-check'],
    queryFn: getFinanceInvariantCheck,
    refetchInterval: 60_000, // re-chequea cada minuto si la pestaña está abierta
    refetchOnWindowFocus: true,
  });

  if (isLoading) {
    return (
      <div className="rounded-lg border border-[var(--color-border)] bg-[var(--color-bg-card)] px-4 py-3 text-xs text-[var(--color-text-muted)]">
        Verificando salud financiera…
      </div>
    );
  }
  if (isError || !data) {
    return null;
  }

  if (data.ok) {
    return (
      <div className="rounded-lg border border-emerald-500/30 bg-emerald-500/10 px-4 py-3 flex items-center gap-3">
        <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0" />
        <div className="flex-1">
          <p className="text-sm font-semibold text-[var(--color-text-primary)]">Salud financiera: coherente</p>
          <p className="text-[11px] text-[var(--color-text-muted)] mt-0.5">
            Saldo cuentas = {fmtCurrency(data.details.saldoCuentasUSD, 'USD')} · Saldo flujo (PAGADOS/COBRADOS hasta hoy) coincide.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="rounded-lg border border-amber-500/40 bg-amber-500/10 px-4 py-3 flex items-start gap-3">
      <AlertTriangle className="w-5 h-5 text-amber-400 shrink-0 mt-0.5" />
      <div className="flex-1">
        <p className="text-sm font-semibold text-[var(--color-text-primary)]">
          Descalce de {fmtCurrency(Math.abs(data.details.diferencia), 'USD')} entre saldo de cuentas y flujo de fondos
        </p>
        <p className="text-[11px] text-[var(--color-text-muted)] mt-0.5">
          Saldo cuentas: {fmtCurrency(data.details.saldoCuentasUSD, 'USD')} · Saldo flujo: {fmtCurrency(data.details.saldoFlujoUSD, 'USD')}
        </p>
        <Link
          to="/finanzas/cuentas"
          className="inline-block mt-2 px-3 py-1.5 rounded-lg bg-[var(--color-accent)] text-gray-900 text-xs font-semibold hover:bg-[var(--color-accent-hover)] transition-colors"
        >
          Conciliar cuentas
        </Link>
      </div>
    </div>
  );
}

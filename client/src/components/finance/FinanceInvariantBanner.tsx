import { Link, useLocation } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { AlertTriangle } from 'lucide-react';
import { getFinanceInvariantCheck } from '../../api/finance.api';
import { fmtCurrency } from '../../lib/finance';

/** Banner global que aparece en cualquier página de /finanzas/* cuando hay
 *  descalce entre saldo de cuentas y flujo de fondos. Si el invariante está OK,
 *  no renderiza nada. */
export function FinanceInvariantBanner() {
  const location = useLocation();
  const isFinancePage = location.pathname.startsWith('/finanzas');

  const { data } = useQuery({
    queryKey: ['finance-invariant-check'],
    queryFn: getFinanceInvariantCheck,
    enabled: isFinancePage,
    refetchInterval: 60_000,
    refetchOnWindowFocus: true,
  });

  if (!isFinancePage) return null;
  if (!data) return null;
  if (data.ok) return null;

  return (
    <div className="rounded-lg border border-amber-500/40 bg-amber-500/10 px-4 py-3 mb-4 flex items-start gap-3">
      <AlertTriangle className="w-5 h-5 text-amber-400 shrink-0 mt-0.5" />
      <div className="flex-1">
        <p className="text-sm font-semibold text-[var(--color-text-primary)]">
          Hay un descalce de {fmtCurrency(Math.abs(data.details.diferencia), 'USD')} entre el saldo de cuentas y el flujo de fondos
        </p>
        <p className="text-[11px] text-[var(--color-text-muted)] mt-0.5">
          Saldo cuentas: {fmtCurrency(data.details.saldoCuentasUSD, 'USD')} · Saldo flujo (PAGADOS/COBRADOS hasta hoy): {fmtCurrency(data.details.saldoFlujoUSD, 'USD')}.
          Esto puede indicar movimientos faltantes o duplicados.
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

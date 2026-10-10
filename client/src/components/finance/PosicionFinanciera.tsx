import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { ChevronDown, ChevronRight } from 'lucide-react';

import { getPosicion, type TramosPosicion } from '../../api/posicion.api';
import { fmtCurrency } from '../../lib/finance';

function klass(...p: (string | false | undefined)[]) { return p.filter(Boolean).join(' '); }

const TRAMOS: Array<{ key: keyof TramosPosicion; label: string }> = [
  { key: 'VENCIDO', label: 'Vencido' },
  { key: 'HASTA_7', label: '7 días' },
  { key: 'HASTA_30', label: '8 a 30 días' },
  { key: 'MAS_30', label: 'Más de 30' },
  { key: 'SIN_FECHA', label: 'Sin fecha' },
];

const usd = (n: number) => fmtCurrency(n, 'USD');

function FilaTramos({ label, t, tono, sub }: { label: string; t: TramosPosicion; tono?: string; sub?: boolean }) {
  return (
    <tr className={klass('border-t border-[var(--color-border)]', sub && 'text-[12px] text-[var(--color-text-muted)]')}>
      <td className={klass('py-1.5 pr-3', sub ? 'pl-6' : 'font-medium text-[var(--color-text-primary)]')}>{label}</td>
      {TRAMOS.map((x) => (
        <td key={x.key} className={klass('py-1.5 px-2 text-right tabular-nums', x.key === 'VENCIDO' && t.VENCIDO > 0.005 && !sub && tono)}>
          {t[x.key] > 0.005 ? usd(t[x.key]) : '—'}
        </td>
      ))}
      <td className={klass('py-1.5 pl-2 text-right tabular-nums', !sub && 'font-semibold')}>{usd(t.total)}</td>
    </tr>
  );
}

/**
 * Posición financiera: la caja más lo que nos deben menos lo que debemos.
 * Va arriba de Flujo de fondos y de Estado de resultados, que solo miran la plata
 * que entra y sale.
 */
export function PosicionFinanciera() {
  const [abierto, setAbierto] = useState(false);
  const { data } = useQuery({ queryKey: ['finance-posicion'], queryFn: getPosicion, staleTime: 60_000 });
  if (!data) return null;
  const d = data.debemos.desglose;

  return (
    <section className="rounded-xl border border-[var(--color-border)] bg-[var(--color-bg-card)] p-4 space-y-3">
      <div className="flex items-baseline justify-between gap-2 flex-wrap">
        <h2 className="text-sm font-semibold text-[var(--color-text-primary)]">Posición: lo que hay, lo que nos deben y lo que debemos</h2>
        <span className="text-[11px] text-[var(--color-text-muted)]">En USD · pesos a 1 USD = {data.usdToUyu.toLocaleString('es-UY')} UYU</span>
      </div>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Dato label="En cuentas" valor={data.caja.totalUsd} />
        <Dato label="Nos deben" valor={data.nosDeben.total} tono="text-green-400" signo="+" />
        <Dato label="Debemos" valor={data.debemos.total - data.debemos.saldoAFavorProveedores} tono="text-red-400" signo="−" />
        <Dato label="Si se cobrara y pagara todo hoy" valor={data.netoConCaja} destacado />
      </div>

      <button type="button" onClick={() => setAbierto((v) => !v)}
        className="inline-flex items-center gap-1 text-xs text-[var(--color-accent)] hover:underline">
        {abierto ? <ChevronDown className="w-3.5 h-3.5" /> : <ChevronRight className="w-3.5 h-3.5" />}
        Ver por vencimiento
      </button>
      {abierto && (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-[11px] uppercase tracking-wider text-[var(--color-text-muted)]">
                <th className="py-1 pr-3 text-left" />
                {TRAMOS.map((t) => <th key={t.key} className="py-1 px-2 text-right">{t.label}</th>)}
                <th className="py-1 pl-2 text-right">Total</th>
              </tr>
            </thead>
            <tbody>
              <FilaTramos label="Nos deben (obras)" t={data.nosDeben} tono="text-amber-400" />
              <FilaTramos label="Debemos" t={data.debemos} tono="text-red-400" />
              <FilaTramos label="Proveedores" t={d.proveedores} sub />
              <FilaTramos label="Comisiones de asesores" t={d.comisiones} sub />
              <FilaTramos label="Instaladores" t={d.instaladores} sub />
              <FilaTramos label="Otros compromisos" t={d.otrosCompromisos} sub />
            </tbody>
          </table>
          <ul className="mt-2 space-y-0.5 text-[11px] text-[var(--color-text-muted)]">
            <li>
              "Nos deben" es lo que falta cobrar de cada obra vendida. Lo que tiene fecha sale del plan de pagos;
              {data.nosDeben.obrasSinPlanCompleto > 0
                ? ` ${data.nosDeben.obrasSinPlanCompleto} obra${data.nosDeben.obrasSinPlanCompleto === 1 ? '' : 's'} deben más de lo que tienen previsto en su plan: esa parte queda "sin fecha" (ver `
                : ' (ver '}
              <Link to="/finanzas/cobros" className="text-[var(--color-accent)] hover:underline">Cobros</Link>).
            </li>
            {data.debemos.saldoAFavorProveedores > 0.005 && (
              <li>Se descuentan {usd(data.debemos.saldoAFavorProveedores)} de saldo a favor con proveedores.</li>
            )}
            <li>Los costos fijos no entran: no son deuda hasta que llega el mes.</li>
          </ul>
        </div>
      )}
    </section>
  );
}

function Dato({ label, valor, tono, signo, destacado }: { label: string; valor: number; tono?: string; signo?: string; destacado?: boolean }) {
  return (
    <div className={klass('rounded-lg p-3', destacado ? 'bg-[var(--color-accent)]/10' : 'bg-[var(--color-bg-app)]')}>
      <p className="text-[11px] uppercase tracking-wider text-[var(--color-text-muted)] font-mono">{label}</p>
      <p className={klass('mt-1 text-lg font-semibold tabular-nums', tono, valor < 0 && destacado && 'text-red-400')}>
        {signo ? `${signo} ` : ''}{usd(valor)}
      </p>
    </div>
  );
}

import type { CobroDetail } from '../../api/finance.api';
import { fmtDate } from '../../lib/finance';

type Cobro = CobroDetail['cobros'][number];

// Cuotas del plan atadas a un momento de la obra: no tienen fecha hasta que se
// cobran. En la columna de fecha va el momento ("Previo a la obra").
export function fechaOMomento(c: Cobro): string {
  if (c.fecha) return fmtDate(c.fecha);
  if (c.hito) return c.hito.hitoLabel;
  return fmtDate(c.dueDate ?? '');
}

/** Etiqueta del estado de una cuota sin cobrar: lista, vencida o prevista. */
export function EstadoCuota({ c }: { c: Cobro }) {
  const base = 'rounded border px-1.5 py-0.5 text-[9px] font-mono font-semibold uppercase tracking-wider';
  if (c.hito?.vencida) {
    return (
      <span className={`${base} border-red-500/30 bg-red-500/15 text-red-300`} title={`Venció el ${fmtDate(c.hito.venceEl ?? '')}`}>
        Vencida
      </span>
    );
  }
  if (c.hito?.listo) {
    return (
      <span className={`${base} border-emerald-500/30 bg-emerald-500/15 text-emerald-300`} title={`Vence el ${fmtDate(c.hito.venceEl ?? '')}`}>
        Lista para cobrar
      </span>
    );
  }
  return <span className={`${base} border-amber-500/30 bg-amber-500/15 text-amber-300`}>Previsto</span>;
}

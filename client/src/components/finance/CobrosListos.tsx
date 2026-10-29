import { HandCoins } from 'lucide-react';

import type { CobroProjectItem, EstadoCobranza } from '../../api/finance.api';
import { fmtCurrency } from '../../lib/finance';

// Lo que tienen en común los listados de cobros de Finanzas y de Experiencia
// Solar: las cuotas cuyo momento de la obra llegó ("listas para cobrar").

type Listo = NonNullable<CobroProjectItem['listoParaCobrar']>;

function klass(...p: (string | false | undefined)[]) { return p.filter(Boolean).join(' '); }

// 'por_cobrar' (por defecto): todo menos los que ya pagaron todo, que si no
// llenan la lista con cada obra que alguna vez tuvo un proyecto.
// 'listos': los que tienen una cuota del plan lista para cobrar.
export type EstadoFiltroCobros = 'por_cobrar' | 'listos' | 'all' | EstadoCobranza;

export function filtrarCobros<T extends CobroProjectItem>(projects: T[], estado: EstadoFiltroCobros, search: string): T[] {
  let out = projects;
  if (estado === 'por_cobrar') out = out.filter(p => p.estadoCobranza !== 'COMPLETO');
  else if (estado === 'listos') out = out.filter(p => p.listoParaCobrar);
  else if (estado !== 'all') out = out.filter(p => p.estadoCobranza === estado);
  const q = search.trim().toLowerCase();
  if (q) out = out.filter(p => p.clientName.toLowerCase().includes(q) || p.code.toLowerCase().includes(q));
  // Los listos para cobrar arriba (los vencidos primero).
  const peso = (p: T) => (p.listoParaCobrar ? (p.listoParaCobrar.vencidas ? 0 : 1) : 2);
  return [...out].sort((a, b) => peso(a) - peso(b));
}

export function OpcionesFiltroCobros() {
  return (
    <>
      <option value="por_cobrar">Por cobrar (sin los completos)</option>
      <option value="listos">Listos para cobrar</option>
      <option value="all">Todos, también los completos</option>
      <option value="PENDIENTE">Pendientes</option>
      <option value="PARCIAL">Parciales</option>
      <option value="COMPLETO">Completos</option>
      <option value="EXCEDIDO">Excedidos</option>
      <option value="SIN_PRESUPUESTO">Sin presupuesto</option>
    </>
  );
}

// Marca de "cuota lista para cobrar" en el listado: verde, o roja si ya venció.
export function ListoParaCobrar({ l }: { l: Listo }) {
  return (
    <span
      title={`${l.descripciones.join(' · ')} — ${fmtCurrency(l.montoUSD, 'USD')}`}
      className={klass(
        'inline-flex items-center gap-1 text-[10px] font-mono px-2 py-0.5 rounded uppercase border',
        l.vencidas ? 'bg-red-500/15 text-red-300 border-red-500/30' : 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30',
      )}
    >
      <HandCoins className="h-3 w-3" />
      {l.vencidas ? 'Cuota vencida' : 'Listo para cobrar'}
    </span>
  );
}

// Columna "A cobrar ahora": el monto de las cuotas listas y cuáles son.
export function ACobrarAhora({ p }: { p: CobroProjectItem }) {
  if (!p.listoParaCobrar) return <span className="text-[var(--color-text-muted)]">—</span>;
  return (
    <span className="flex flex-col items-end">
      <span className={klass('font-semibold tabular-nums', p.listoParaCobrar.vencidas ? 'text-red-300' : 'text-emerald-300')}>
        {fmtCurrency(p.listoParaCobrar.montoUSD, 'USD')}
      </span>
      <span className="text-[10px] text-[var(--color-text-muted)]">{p.listoParaCobrar.descripciones.map(d => d.replace(/^\[PLAN\] /, '')).join(' · ')}</span>
    </span>
  );
}

export function AvisoListos({ listos, onVer }: { listos: CobroProjectItem[]; onVer: () => void }) {
  if (listos.length === 0) return null;
  const vencidos = listos.filter(p => p.listoParaCobrar!.vencidas).length;
  return (
    <div className="flex flex-wrap items-center gap-3 rounded-xl border border-emerald-500/40 bg-emerald-500/10 px-4 py-3">
      <HandCoins className="h-5 w-5 shrink-0 text-emerald-400" />
      <p className="flex-1 text-sm text-[var(--color-text-primary)]">
        <span className="font-semibold">{listos.length} cliente{listos.length !== 1 ? 's' : ''}</span>{' '}
        {listos.length !== 1 ? 'están listos' : 'está listo'} para cobrar una cuota
        {vencidos > 0 && <span className="text-red-300"> · {vencidos} con la cuota vencida</span>}
      </p>
      <button
        onClick={onVer}
        className="rounded-lg bg-emerald-500 px-3 py-1.5 text-xs font-semibold text-black hover:bg-emerald-400"
      >
        Ver solo esos
      </button>
    </div>
  );
}

// Pie del listado: cuánto está listo para cobrar y cuánto de eso ya venció.
export function TotalesListos({ filas }: { filas: CobroProjectItem[] }) {
  if (!filas.some(p => p.listoParaCobrar)) return null;
  return (
    <div className="flex flex-wrap justify-end gap-6 border-t border-[var(--color-border)] px-4 py-3 text-sm">
      <span className="text-[var(--color-text-secondary)]">
        Listo para cobrar:{' '}
        <b className="tabular-nums text-emerald-300">{fmtCurrency(filas.reduce((a, p) => a + (p.listoParaCobrar?.montoUSD ?? 0), 0), 'USD')}</b>
      </span>
      <span className="text-[var(--color-text-secondary)]">
        De eso, vencido:{' '}
        <b className="tabular-nums text-red-300">{fmtCurrency(filas.reduce((a, p) => a + (p.listoParaCobrar?.montoVencidoUSD ?? 0), 0), 'USD')}</b>
      </span>
    </div>
  );
}

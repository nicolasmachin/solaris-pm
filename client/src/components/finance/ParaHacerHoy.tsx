import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { AlertTriangle, ChevronRight, CircleDot, Info } from 'lucide-react';

import { getParaHacerHoy, type ItemHoy } from '../../api/bancoConciliacion.api';

// "Para hacer hoy": todo lo pendiente de Finanzas en una sola lista, con cuántos
// hay y un enlace a donde se resuelve. Se calcula solo: cuando algo se
// resuelve, desaparece. Lo vencido primero.

const ESTILO: Record<ItemHoy['gravedad'], { icono: typeof AlertTriangle; cls: string; label: string }> = {
  VENCIDO: { icono: AlertTriangle, cls: 'text-red-400', label: 'Vencido' },
  HOY: { icono: CircleDot, cls: 'text-amber-300', label: 'Para hoy' },
  AVISO: { icono: Info, cls: 'text-sky-300', label: 'Para mirar' },
};

export function ParaHacerHoy() {
  const { data: items = [], isLoading } = useQuery({
    queryKey: ['para-hacer-hoy'],
    queryFn: getParaHacerHoy,
    refetchInterval: 5 * 60_000,
  });
  if (isLoading) return null;

  return (
    <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-bg-card)] p-4">
      <p className="mb-2 text-base font-semibold text-[var(--color-text-primary)]">Para hacer hoy</p>
      {items.length === 0 ? (
        <p className="text-sm text-emerald-300">No hay nada pendiente en Finanzas.</p>
      ) : (
        <ul className="divide-y divide-[var(--color-border)]">
          {items.map((i) => {
            const e = ESTILO[i.gravedad];
            const Icono = e.icono;
            return (
              <li key={i.clave}>
                <Link to={i.link} className="flex items-center gap-3 py-2 text-sm hover:bg-[var(--color-bg-card-hover)] -mx-2 px-2 rounded-lg">
                  <Icono className={`h-4 w-4 shrink-0 ${e.cls}`} aria-label={e.label} />
                  <span className="w-8 shrink-0 text-right font-semibold tabular-nums text-[var(--color-text-primary)]">{i.cantidad}</span>
                  <span className="flex-1 text-[var(--color-text-secondary)]">{i.texto}</span>
                  <span className="hidden sm:inline text-[11px] text-[var(--color-text-muted)]">{i.grupo}</span>
                  <ChevronRight className="h-4 w-4 text-[var(--color-text-muted)]" />
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

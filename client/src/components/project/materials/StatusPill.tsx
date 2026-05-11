import { useEffect, useRef, useState } from 'react';
import { ChevronDown } from 'lucide-react';

import type { MaterialStatus } from '../../../types/materials.types';
import { MATERIAL_STATUSES } from '../../../types/materials.types';
import { STATUS_META } from './types';

// Pill clickeable con dropdown que cambia el estado del material.
// `status` puede recibir el valor especial "MIXED" usado por el consolidador
// para indicar que los proyectos tienen estados distintos. En ese caso el
// dropdown sigue funcionando — clickear un estado iguala todo a ese valor.
export type StatusPillValue = MaterialStatus | 'MIXED';

export function StatusPill({
  status,
  disabled,
  onChange,
}: {
  status: StatusPillValue;
  disabled: boolean;
  onChange: (s: MaterialStatus) => void;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    function onDocClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener('mousedown', onDocClick);
    return () => document.removeEventListener('mousedown', onDocClick);
  }, [open]);

  const isMixed = status === 'MIXED';
  const meta = isMixed
    ? {
        label: 'Mixto',
        dot: '#94a3b8',
        pillClass:
          'border-[var(--color-border)] bg-[var(--color-bg-card-hover)]/40 text-[var(--color-text-secondary)] italic',
      }
    : STATUS_META[status];

  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        disabled={disabled}
        onClick={() => !disabled && setOpen((v) => !v)}
        title={isMixed ? 'Estados distintos en los proyectos. Cambiar acá iguala a todos.' : undefined}
        className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[10px] font-semibold border ${meta.pillClass} ${
          disabled ? 'opacity-60 cursor-not-allowed' : 'cursor-pointer hover:opacity-80'
        }`}
      >
        <span className="inline-block w-1.5 h-1.5 rounded-full" style={{ background: meta.dot }} />
        {meta.label}
        {!disabled && <ChevronDown className="w-2.5 h-2.5 opacity-60" />}
      </button>
      {open && (
        <div className="absolute top-full left-0 mt-1 min-w-[140px] rounded-lg border border-[var(--color-border)] bg-[var(--color-bg-card)] shadow-xl z-30 p-1">
          {MATERIAL_STATUSES.map((s) => {
            const m = STATUS_META[s];
            const isCurrent = !isMixed && s === status;
            return (
              <button
                key={s}
                type="button"
                onClick={() => {
                  setOpen(false);
                  if (!isCurrent) onChange(s);
                }}
                className={`w-full flex items-center gap-2 px-2 py-1.5 rounded text-left text-[11px] hover:bg-[var(--color-bg-card-hover)] ${
                  isCurrent ? 'bg-[var(--color-bg-card-hover)]/60' : ''
                }`}
              >
                <span className="inline-block w-2 h-2 rounded-full" style={{ background: m.dot }} />
                <span className="text-[var(--color-text-primary)]">{m.label}</span>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

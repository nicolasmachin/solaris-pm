import { useCallback, useMemo } from 'react';
import { useSearchParams } from 'react-router-dom';

import { EMPTY_FILTERS, type FilterState } from './types';
import type { MaterialRowColor, MaterialStatus } from '../../../types/materials.types';

const VALID_STATUSES: MaterialStatus[] = ['PENDIENTE', 'PEDIDO', 'RECIBIDO', 'EN_STOCK'];
const VALID_COLORS: Array<MaterialRowColor | 'none'> = ['yellow', 'green', 'blue', 'purple', 'red', 'gray', 'none'];

function splitCsv(v: string | null): string[] {
  if (!v) return [];
  return v.split(',').map((s) => s.trim()).filter(Boolean);
}

export function useMaterialsFilters() {
  const [params, setParams] = useSearchParams();

  const state = useMemo<FilterState>(() => {
    const statuses = splitCsv(params.get('status')).filter((s): s is MaterialStatus =>
      VALID_STATUSES.includes(s as MaterialStatus),
    );
    const colors = splitCsv(params.get('color')).filter((c): c is MaterialRowColor | 'none' =>
      VALID_COLORS.includes(c as MaterialRowColor | 'none'),
    );
    const crossedRaw = params.get('crossed');
    const crossed: FilterState['crossed'] = crossedRaw === 'yes' || crossedRaw === 'no' ? crossedRaw : 'all';
    return {
      q: params.get('q') ?? '',
      categoryIds: splitCsv(params.get('cat')),
      statuses,
      colors,
      addedRoles: splitCsv(params.get('added')),
      crossed,
    };
  }, [params]);

  const update = useCallback(
    (mut: (prev: FilterState) => FilterState) => {
      setParams(
        (current) => {
          // Construir el nuevo objeto desde el state actual derivado de params.
          const fromCurrent: FilterState = {
            q: current.get('q') ?? '',
            categoryIds: splitCsv(current.get('cat')),
            statuses: splitCsv(current.get('status')) as MaterialStatus[],
            colors: splitCsv(current.get('color')) as Array<MaterialRowColor | 'none'>,
            addedRoles: splitCsv(current.get('added')),
            crossed: (current.get('crossed') === 'yes' || current.get('crossed') === 'no'
              ? current.get('crossed')
              : 'all') as FilterState['crossed'],
          };
          const next = mut(fromCurrent);
          const out = new URLSearchParams(current);

          if (next.q.trim()) out.set('q', next.q); else out.delete('q');
          if (next.categoryIds.length) out.set('cat', next.categoryIds.join(',')); else out.delete('cat');
          if (next.statuses.length) out.set('status', next.statuses.join(',')); else out.delete('status');
          if (next.colors.length) out.set('color', next.colors.join(',')); else out.delete('color');
          if (next.addedRoles.length) out.set('added', next.addedRoles.join(',')); else out.delete('added');
          if (next.crossed !== 'all') out.set('crossed', next.crossed); else out.delete('crossed');

          return out;
        },
        { replace: true },
      );
    },
    [setParams],
  );

  const clear = useCallback(() => {
    setParams(
      (current) => {
        const out = new URLSearchParams(current);
        for (const k of ['q', 'cat', 'status', 'color', 'added', 'crossed']) out.delete(k);
        return out;
      },
      { replace: true },
    );
  }, [setParams]);

  return { state, update, clear, empty: EMPTY_FILTERS };
}

// Toggle membership helper para multi-select.
export function toggle<T>(arr: T[], v: T): T[] {
  return arr.includes(v) ? arr.filter((x) => x !== v) : [...arr, v];
}

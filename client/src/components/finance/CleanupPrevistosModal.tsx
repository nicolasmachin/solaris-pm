import { Fragment, useMemo, useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'react-hot-toast';
import { X, Search } from 'lucide-react';
import { getPrevistosPendientes, cleanupPrevistos } from '../../api/finance.api';
import { fmtCurrency } from '../../lib/finance';
import type { PrevistoPendiente } from '../../types/finance.types';

function klass(...p: (string | false | undefined)[]) { return p.filter(Boolean).join(' '); }

interface Props {
  onClose: () => void;
  defaultProjectId?: string;
}

export function CleanupPrevistosModal({ onClose, defaultProjectId }: Props) {
  const qc = useQueryClient();
  const [search, setSearch] = useState('');
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [collapsedProjects, setCollapsedProjects] = useState<Set<string>>(new Set());

  const { data: previstos = [], isLoading } = useQuery({
    queryKey: ['previstos-pendientes'],
    queryFn: () => getPrevistosPendientes(),
  });

  const cleanupMut = useMutation({
    mutationFn: (ids: string[]) => cleanupPrevistos(ids),
    onSuccess: (r) => {
      toast.success(`${r.deleted} previsto${r.deleted !== 1 ? 's' : ''} eliminado${r.deleted !== 1 ? 's' : ''}`);
      qc.invalidateQueries({ queryKey: ['previstos-pendientes'] });
      qc.invalidateQueries({ queryKey: ['finance-movements'] });
      qc.invalidateQueries({ queryKey: ['project-materials'] });
      qc.invalidateQueries({ queryKey: ['finance-dashboard'] });
      onClose();
    },
    onError: (err: unknown) => {
      const msg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message;
      toast.error(msg ?? 'Error al limpiar previstos');
    },
  });

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return previstos;
    return previstos.filter(p =>
      p.descripcion.toLowerCase().includes(q)
      || (p.materialItem?.nombre.toLowerCase().includes(q) ?? false)
      || (p.materialItem?.category.nombre.toLowerCase().includes(q) ?? false)
      || (p.supplier?.nombre.toLowerCase().includes(q) ?? false)
      || (p.project?.code.toLowerCase().includes(q) ?? false)
      || (p.project?.clientName.toLowerCase().includes(q) ?? false),
    );
  }, [previstos, search]);

  // Agrupar por proyecto
  const groups = useMemo(() => {
    const map = new Map<string, { projectKey: string; projectLabel: string; items: PrevistoPendiente[] }>();
    for (const p of filtered) {
      const key = p.project?.id ?? 'sin-proyecto';
      const label = p.project ? p.project.clientName : 'Sin proyecto';
      if (!map.has(key)) map.set(key, { projectKey: key, projectLabel: label, items: [] });
      map.get(key)!.items.push(p);
    }
    return Array.from(map.values()).sort((a, b) => a.projectLabel.localeCompare(b.projectLabel));
  }, [filtered]);

  // Pre-expandir el proyecto del default
  function isCollapsed(key: string) {
    if (collapsedProjects.has(key)) return true;
    return false;
  }
  function toggleProject(key: string) {
    setCollapsedProjects(prev => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  }

  function toggle(id: string) {
    setSelected(prev => {
      const n = new Set(prev);
      if (n.has(id)) n.delete(id);
      else n.add(id);
      return n;
    });
  }

  function toggleProjectAll(items: PrevistoPendiente[]) {
    const allSelected = items.every(it => selected.has(it.id));
    setSelected(prev => {
      const n = new Set(prev);
      for (const it of items) {
        if (allSelected) n.delete(it.id);
        else n.add(it.id);
      }
      return n;
    });
  }

  // Pre-seleccionar previstos del proyecto default si se pasó
  const initializedDefault = useMemo(() => {
    if (!defaultProjectId || previstos.length === 0) return false;
    const ids = previstos.filter(p => p.project?.id === defaultProjectId).map(p => p.id);
    if (ids.length > 0) setSelected(prev => prev.size === 0 ? new Set(ids) : prev);
    return true;
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [defaultProjectId, previstos.length]);
  void initializedDefault;

  const selectedTotalsByCcy = useMemo(() => {
    const t: Record<string, number> = {};
    for (const p of previstos) if (selected.has(p.id)) t[p.moneda] = (t[p.moneda] ?? 0) + p.monto;
    return t;
  }, [previstos, selected]);

  const totalLabel = Object.entries(selectedTotalsByCcy).map(([m, v]) => fmtCurrency(v, m as 'USD' | 'UYU')).join(' · ');

  return (
    <div className="fixed inset-0 bg-black/60 z-[60] flex items-center justify-center p-4" onMouseDown={e => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="bg-[var(--color-bg-card)] border border-[var(--color-border)] rounded-xl w-full max-w-3xl max-h-[85vh] flex flex-col shadow-2xl">
        <div className="flex items-center justify-between p-4 border-b border-[var(--color-border)]">
          <div>
            <p className="text-sm font-semibold text-[var(--color-text-primary)]">Limpiar previstos asociados</p>
            <p className="text-xs text-[var(--color-text-muted)] mt-0.5">
              Marcá los previstos que ya cubre la compra real. Se eliminarán para no contar dos veces.
            </p>
          </div>
          <button onClick={onClose} className="text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)]">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-4 border-b border-[var(--color-border)]">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[var(--color-text-muted)]" />
            <input
              autoFocus
              type="text"
              placeholder="Buscar por proyecto, ítem, categoría, proveedor…"
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="w-full pl-9 pr-3 py-2 rounded-lg border border-[var(--color-border)] bg-[var(--color-bg-app)] text-sm text-[var(--color-text-primary)] focus:outline-none focus:ring-2 focus:ring-[var(--color-accent)]"
            />
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-3 space-y-2">
          {isLoading ? (
            <p className="text-sm text-[var(--color-text-muted)] text-center py-8">Cargando previstos…</p>
          ) : groups.length === 0 ? (
            <p className="text-sm text-[var(--color-text-muted)] text-center py-8">
              {previstos.length === 0 ? 'No hay previstos pendientes' : 'Ningún previsto coincide con el filtro'}
            </p>
          ) : (
            groups.map(g => {
              const collapsed = isCollapsed(g.projectKey);
              const allSelected = g.items.every(it => selected.has(it.id));
              const partial = !allSelected && g.items.some(it => selected.has(it.id));
              return (
                <Fragment key={g.projectKey}>
                  <div className="rounded-lg border border-[var(--color-border)] overflow-hidden">
                    <div className="flex items-center gap-2 px-3 py-2 bg-[var(--color-bg-card-hover)]">
                      <input
                        type="checkbox"
                        checked={allSelected}
                        ref={el => { if (el) el.indeterminate = partial; }}
                        onChange={() => toggleProjectAll(g.items)}
                      />
                      <button onClick={() => toggleProject(g.projectKey)} className="flex-1 text-left text-sm font-medium text-[var(--color-text-primary)] hover:underline">
                        {g.projectLabel} <span className="text-xs text-[var(--color-text-muted)]">({g.items.length})</span>
                      </button>
                      <span className="text-[10px] text-[var(--color-text-muted)] font-mono">
                        {Object.entries(g.items.reduce<Record<string, number>>((acc, it) => { acc[it.moneda] = (acc[it.moneda] ?? 0) + it.monto; return acc; }, {})).map(([m, v]) => fmtCurrency(v, m as 'USD' | 'UYU')).join(' · ')}
                      </span>
                    </div>
                    {!collapsed && (
                      <div className="divide-y divide-[var(--color-border)]">
                        {g.items.map(it => (
                          <label key={it.id} className="flex items-center gap-2 px-3 py-2 cursor-pointer hover:bg-[var(--color-bg-card-hover)]">
                            <input type="checkbox" checked={selected.has(it.id)} onChange={() => toggle(it.id)} />
                            <div className="flex-1 min-w-0">
                              <p className="text-sm text-[var(--color-text-primary)] truncate">{it.descripcion}</p>
                              <p className="text-[11px] text-[var(--color-text-muted)]">
                                {it.materialItem?.category.nombre ?? '—'}
                                {it.supplier ? ` · ${it.supplier.nombre}` : ''}
                              </p>
                            </div>
                            <p className="text-sm font-semibold text-red-400 tabular-nums shrink-0">
                              {fmtCurrency(it.monto, it.moneda)}
                            </p>
                          </label>
                        ))}
                      </div>
                    )}
                  </div>
                </Fragment>
              );
            })
          )}
        </div>

        <div className="flex items-center justify-between gap-3 p-3 border-t border-[var(--color-border)]">
          <p className="text-sm text-[var(--color-text-secondary)]">
            <span className="font-semibold">{selected.size}</span> seleccionado{selected.size !== 1 ? 's' : ''}
            {totalLabel && <span className="ml-2 text-[var(--color-text-muted)]">· {totalLabel}</span>}
          </p>
          <div className="flex gap-2">
            <button onClick={onClose} className="px-3 py-2 rounded-lg border border-[var(--color-border)] text-sm text-[var(--color-text-secondary)] hover:bg-[var(--color-bg-card-hover)] transition-colors">
              Cancelar
            </button>
            <button
              onClick={() => {
                if (selected.size === 0) return;
                if (!confirm(`¿Eliminar ${selected.size} previsto${selected.size !== 1 ? 's' : ''}? Esta acción no se puede deshacer.`)) return;
                cleanupMut.mutate(Array.from(selected));
              }}
              disabled={selected.size === 0 || cleanupMut.isPending}
              className={klass(
                'px-4 py-2 rounded-lg text-sm font-semibold transition-colors',
                selected.size === 0 || cleanupMut.isPending
                  ? 'bg-[var(--color-border)] text-[var(--color-text-muted)] cursor-not-allowed'
                  : 'bg-red-500/15 text-red-400 hover:bg-red-500/25',
              )}
            >
              {cleanupMut.isPending ? 'Eliminando…' : 'Eliminar seleccionados'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

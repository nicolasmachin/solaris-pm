import { useState, useEffect, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'react-hot-toast';
import { Search } from 'lucide-react';
import { Spinner } from '../components/ui/Spinner';
import { ResponsiveTable, type Column } from '../components/ui/ResponsiveTable';
import { getFacturacion, patchFacturacion, type FacturacionRow } from '../api/finance.api';
import { usePermission } from '../hooks/usePermission';
import { fmtCurrency, fmtDate } from '../lib/finance';

function klass(...p: (string | false | undefined)[]) { return p.filter(Boolean).join(' '); }

const FILTER_KEY = 'finance-facturacion-filters-v1';

type EstadoFilter = 'pendiente' | 'emitida' | 'todas';

export function FinanceFacturacionTab() {
  const queryClient = useQueryClient();
  const canEdit = usePermission('FINANZAS', 'EDIT');
  const [estado, setEstado] = useState<EstadoFilter>('pendiente');
  const [search, setSearch] = useState('');
  // Nota en edición: null = ninguna. Se edita en un pequeño modal.
  const [editing, setEditing] = useState<{ id: string; clientName: string; value: string } | null>(null);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(FILTER_KEY);
      if (raw) {
        const p = JSON.parse(raw) as { estado?: EstadoFilter; search?: string };
        if (p.estado === 'pendiente' || p.estado === 'emitida' || p.estado === 'todas') setEstado(p.estado);
        if (typeof p.search === 'string') setSearch(p.search);
      }
    } catch { /* ignore */ }
  }, []);
  useEffect(() => {
    localStorage.setItem(FILTER_KEY, JSON.stringify({ estado, search }));
  }, [estado, search]);

  const { data, isLoading } = useQuery({
    queryKey: ['facturacion', estado],
    queryFn: () => getFacturacion({ estado }),
  });

  const projects = data?.projects ?? [];
  const totales = data?.totales;

  const marcarMutation = useMutation({
    mutationFn: (vars: { id: string; emitida: boolean }) =>
      patchFacturacion(vars.id, { facturaEmitida: vars.emitida }),
    onSuccess: (_r, vars) => {
      toast.success(vars.emitida ? 'Factura marcada como emitida' : 'Emisión revertida');
      queryClient.invalidateQueries({ queryKey: ['facturacion'] });
    },
    onError: (err: unknown) => {
      const msg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message;
      toast.error(msg ?? 'No se pudo actualizar');
    },
  });

  const notaMutation = useMutation({
    mutationFn: (vars: { id: string; nota: string | null }) =>
      patchFacturacion(vars.id, { facturaNota: vars.nota }),
    onSuccess: () => {
      toast.success('Nota actualizada');
      queryClient.invalidateQueries({ queryKey: ['facturacion'] });
      setEditing(null);
    },
    onError: (err: unknown) => {
      const msg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message;
      toast.error(msg ?? 'No se pudo guardar la nota');
    },
  });

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return projects;
    return projects.filter(p => p.clientName.toLowerCase().includes(q) || p.code.toLowerCase().includes(q));
  }, [projects, search]);

  const columns: Column<FacturacionRow>[] = [
    {
      key: 'cliente', label: 'Cliente / Proyecto', cardRole: 'title',
      render: (p) => (
        <>
          <span className="font-medium text-[var(--color-text-primary)]">{p.clientName}</span>
          <div className="text-[10px] text-[var(--color-text-muted)] font-mono">
            {p.code} · {p.status}
          </div>
        </>
      ),
    },
    {
      key: 'vendedor', label: 'Vendedor', className: 'text-[var(--color-text-secondary)] text-[13px]',
      render: (p) => p.salesperson?.name ?? '—',
    },
    {
      key: 'presupuesto', label: 'Presupuesto USD', align: 'right',
      className: 'tabular-nums text-[var(--color-text-primary)]',
      render: (p) => (p.budgetUsd != null ? fmtCurrency(p.budgetUsd, 'USD') : '—'),
    },
    {
      key: 'venta', label: 'Fecha venta', className: 'text-[var(--color-text-muted)] text-[11px]',
      render: (p) => (p.saleDate ? fmtDate(p.saleDate) : '—'),
    },
    {
      key: 'nota', label: 'Nota',
      render: (p) => (
        <div className="flex items-start gap-2 max-w-[280px]">
          <span className="text-[12px] text-[var(--color-text-secondary)] whitespace-pre-wrap break-words">
            {p.nota || <span className="text-[var(--color-text-muted)] italic">Sin nota</span>}
          </span>
          {canEdit && (
            <button
              onClick={() => setEditing({ id: p.id, clientName: p.clientName, value: p.nota ?? '' })}
              className="shrink-0 text-[10px] text-[var(--color-accent)] hover:underline"
              title="Editar nota"
            >
              ✎
            </button>
          )}
        </div>
      ),
    },
    {
      key: 'estado', label: 'Estado', cardRole: 'highlight',
      render: (p) => (
        <div className="flex flex-col gap-0.5">
          <span className={klass(
            'text-[10px] font-mono px-2 py-0.5 rounded uppercase border w-fit',
            p.facturaEmitida
              ? 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30'
              : 'bg-amber-500/15 text-amber-300 border-amber-500/30',
          )}>
            {p.facturaEmitida ? 'Emitida' : 'Pendiente'}
          </span>
          {p.facturaEmitida && p.facturaEmitidaEn && (
            <span className="text-[10px] text-[var(--color-text-muted)]">{fmtDate(p.facturaEmitidaEn)}</span>
          )}
        </div>
      ),
    },
    ...(canEdit ? [{
      key: 'accion', label: '', align: 'right' as const,
      render: (p: FacturacionRow) => (
        p.facturaEmitida ? (
          <button
            onClick={() => marcarMutation.mutate({ id: p.id, emitida: false })}
            disabled={marcarMutation.isPending}
            className="text-[11px] px-2.5 py-1 rounded-md border border-[var(--color-border)] text-[var(--color-text-secondary)] hover:bg-[var(--color-bg-card-hover)] disabled:opacity-50"
          >
            Revertir
          </button>
        ) : (
          <button
            onClick={() => marcarMutation.mutate({ id: p.id, emitida: true })}
            disabled={marcarMutation.isPending}
            className="text-[11px] px-2.5 py-1 rounded-md bg-[var(--color-accent)] text-gray-900 font-semibold hover:opacity-90 disabled:opacity-50"
          >
            Marcar emitida
          </button>
        )
      ),
    }] : []),
  ];

  return (
    <div className="p-6 space-y-5">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="font-display text-2xl font-bold text-[var(--color-text-primary)]">Facturación al cliente</h1>
          <p className="text-sm text-[var(--color-text-muted)] mt-0.5">
            {filtered.length} de {projects.length} proyecto{projects.length !== 1 ? 's' : ''} que llevan factura
          </p>
        </div>
      </div>

      {totales && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 max-w-md">
          <div className="bg-[var(--color-bg-card)] border border-[var(--color-border)] rounded-xl p-4">
            <p className="text-[10px] font-mono uppercase tracking-wider text-[var(--color-text-muted)]">Pendientes de emitir</p>
            <p className="text-lg font-bold tabular-nums text-amber-400 mt-1">{totales.pendientes}</p>
          </div>
          <div className="bg-[var(--color-bg-card)] border border-[var(--color-border)] rounded-xl p-4">
            <p className="text-[10px] font-mono uppercase tracking-wider text-[var(--color-text-muted)]">Emitidas</p>
            <p className="text-lg font-bold tabular-nums text-emerald-400 mt-1">{totales.emitidas}</p>
          </div>
        </div>
      )}

      {/* Filtros */}
      <div className="flex items-center gap-3 flex-wrap">
        <div className="relative flex-1 min-w-[220px] max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[var(--color-text-muted)]" />
          <input
            type="text"
            placeholder="Buscar por cliente o código"
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="w-full pl-9 pr-3 py-2 rounded-lg border border-[var(--color-border)] bg-[var(--color-bg-card)] text-sm text-[var(--color-text-primary)] focus:outline-none focus:ring-2 focus:ring-[var(--color-accent)]"
          />
        </div>
        <div className="flex rounded-lg border border-[var(--color-border)] overflow-hidden text-xs font-mono uppercase tracking-wider">
          {([['pendiente', 'Pendientes'], ['emitida', 'Emitidas'], ['todas', 'Todas']] as const).map(([val, label]) => (
            <button
              key={val}
              onClick={() => setEstado(val)}
              className={klass(
                'tap-target px-3 py-2 transition-colors',
                estado === val
                  ? 'bg-[var(--color-accent)] text-gray-900 font-semibold'
                  : 'bg-[var(--color-bg-card)] text-[var(--color-text-secondary)] hover:bg-[var(--color-bg-card-hover)]',
              )}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      <div className="bg-[var(--color-bg-card)] border border-[var(--color-border)] rounded-xl overflow-hidden">
        {isLoading ? (
          <div className="flex items-center justify-center py-12"><Spinner /></div>
        ) : filtered.length === 0 ? (
          <p className="text-sm text-[var(--color-text-muted)] text-center py-12">
            {projects.length === 0
              ? (estado === 'pendiente' ? 'No hay facturas pendientes de emitir' : 'Sin proyectos que lleven factura')
              : 'Ningún proyecto coincide con la búsqueda'}
          </p>
        ) : (
          <div className="overflow-x-auto">
            <ResponsiveTable columns={columns} data={filtered} rowKey={(p) => p.id} />
          </div>
        )}
      </div>

      {/* Modal de edición de nota */}
      {editing && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 px-4"
          onMouseDown={(e) => { if (e.target === e.currentTarget) setEditing(null); }}
        >
          <div className="w-full max-w-md rounded-xl border border-[var(--color-border)] bg-[var(--color-bg-card)] p-5 shadow-2xl">
            <p className="text-[11px] font-mono uppercase tracking-widest text-[var(--color-text-muted)] mb-1">
              Nota de facturación
            </p>
            <p className="text-sm font-medium text-[var(--color-text-primary)] mb-3">{editing.clientName}</p>
            <textarea
              rows={4}
              value={editing.value}
              onChange={(e) => setEditing({ ...editing, value: e.target.value })}
              placeholder="RUT, razón social, a nombre de quién facturar, etc."
              className="w-full rounded-md border border-[var(--color-border)] bg-[var(--color-bg-app)] px-3 py-2 text-sm text-[var(--color-text-primary)] focus:border-[var(--color-accent)] focus:outline-none resize-vertical"
            />
            <div className="flex justify-end gap-3 mt-4">
              <button
                onClick={() => setEditing(null)}
                className="px-3 py-1.5 rounded-md border border-[var(--color-border)] text-sm text-[var(--color-text-secondary)]"
              >
                Cancelar
              </button>
              <button
                onClick={() => notaMutation.mutate({ id: editing.id, nota: editing.value.trim() || null })}
                disabled={notaMutation.isPending}
                className="px-3 py-1.5 rounded-md bg-[var(--color-accent)] text-gray-900 text-sm font-semibold disabled:opacity-50"
              >
                {notaMutation.isPending ? 'Guardando...' : 'Guardar'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

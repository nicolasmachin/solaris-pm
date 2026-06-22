import { useState, useEffect, useMemo } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { Search } from 'lucide-react';
import { Spinner } from '../components/ui/Spinner';
import { ResponsiveTable, type Column } from '../components/ui/ResponsiveTable';
import { getCobrosByProject } from '../api/finance.api';
import type { EstadoCobranza } from '../api/finance.api';
import { fmtCurrency, fmtDate } from '../lib/finance';

function klass(...p: (string | false | undefined)[]) { return p.filter(Boolean).join(' '); }

const FILTER_KEY = 'finance-cobros-filters-v1';

const ESTADO_LABEL: Record<EstadoCobranza, string> = {
  SIN_PRESUPUESTO: 'Sin presupuesto',
  PENDIENTE: 'Pendiente',
  PARCIAL: 'Parcial',
  COMPLETO: 'Completo',
  EXCEDIDO: 'Excedido',
};

const ESTADO_BADGE_CLASS: Record<EstadoCobranza, string> = {
  SIN_PRESUPUESTO: 'bg-[var(--color-border)] text-[var(--color-text-muted)]',
  PENDIENTE: 'bg-red-500/15 text-red-300 border-red-500/30',
  PARCIAL: 'bg-amber-500/15 text-amber-300 border-amber-500/30',
  COMPLETO: 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30',
  EXCEDIDO: 'bg-blue-500/15 text-blue-300 border-blue-500/30',
};

type EstadoFilter = 'all' | EstadoCobranza;
type ActivosFilter = 'true' | 'all';

export function FinanceCobros() {
  const navigate = useNavigate();
  const [estado, setEstado] = useState<EstadoFilter>('all');
  const [activos, setActivos] = useState<ActivosFilter>('true');
  const [search, setSearch] = useState('');

  useEffect(() => {
    try {
      const raw = localStorage.getItem(FILTER_KEY);
      if (raw) {
        const p = JSON.parse(raw) as { estado?: EstadoFilter; activos?: ActivosFilter; search?: string };
        if (p.estado) setEstado(p.estado);
        if (p.activos === 'true' || p.activos === 'all') setActivos(p.activos);
        if (typeof p.search === 'string') setSearch(p.search);
      }
    } catch { /* ignore */ }
  }, []);
  useEffect(() => {
    localStorage.setItem(FILTER_KEY, JSON.stringify({ estado, activos, search }));
  }, [estado, activos, search]);

  const { data, isLoading } = useQuery({
    queryKey: ['cobros-by-project', activos],
    queryFn: () => getCobrosByProject({ activos: activos === 'true' ? 'true' : undefined }),
  });

  const projects = data?.projects ?? [];
  const totales = data?.totales;

  const filtered = useMemo(() => {
    let out = projects;
    if (estado !== 'all') out = out.filter(p => p.estadoCobranza === estado);
    const q = search.trim().toLowerCase();
    if (q) out = out.filter(p => p.clientName.toLowerCase().includes(q) || p.code.toLowerCase().includes(q));
    return out;
  }, [projects, estado, search]);

  // Columnas declarativas para <ResponsiveTable>. En ≥md tabla equivalente;
  // en <md cards (title=Cliente/Proyecto, highlight=Pendiente USD, resto cuerpo).
  type CobroRow = (typeof projects)[number];
  const columns: Column<CobroRow>[] = [
    {
      key: 'cliente', label: 'Cliente / Proyecto', cardRole: 'title',
      render: (p) => (
        <>
          <Link to={`/finanzas/cobros/${p.id}`} className="font-medium text-[var(--color-text-primary)] hover:underline">
            {p.clientName}
          </Link>
          <div className="text-[10px] text-[var(--color-text-muted)] font-mono">
            {p.code} · {p.capacity} kWp · {p.status}
          </div>
        </>
      ),
    },
    {
      key: 'presupuesto', label: 'Presupuesto USD', align: 'right',
      className: 'tabular-nums text-[var(--color-text-primary)]',
      render: (p) => (p.presupuestoUSD != null ? fmtCurrency(p.presupuestoUSD, 'USD') : '—'),
    },
    {
      key: 'cobrado', label: 'Cobrado USD', align: 'right',
      className: 'tabular-nums text-emerald-400',
      render: (p) => fmtCurrency(p.totalCobradoUSD, 'USD'),
    },
    {
      key: 'pendiente', label: 'Pendiente USD', align: 'right', cardRole: 'highlight',
      render: (p) => (
        <span className={klass(
          'tabular-nums',
          p.estadoCobranza === 'EXCEDIDO' ? 'text-blue-400'
            : p.saldoPendienteUSD > 0.005 ? 'text-amber-400'
            : 'text-[var(--color-text-muted)]',
        )}>
          {p.estadoCobranza === 'EXCEDIDO'
            ? `+${fmtCurrency(p.saldoAFavorUSD, 'USD')}`
            : p.presupuestoUSD != null ? fmtCurrency(p.saldoPendienteUSD, 'USD') : '—'}
        </span>
      ),
    },
    {
      key: 'estado', label: 'Estado',
      render: (p) => (
        <span className={klass('text-[10px] font-mono px-2 py-0.5 rounded uppercase border', ESTADO_BADGE_CLASS[p.estadoCobranza])}>
          {ESTADO_LABEL[p.estadoCobranza]}
        </span>
      ),
    },
    {
      key: 'ultcobro', label: 'Últ. cobro', className: 'text-[var(--color-text-muted)] text-[11px]',
      render: (p) => (p.ultimoCobro ? fmtDate(p.ultimoCobro) : '—'),
    },
  ];

  return (
    <div className="p-6 space-y-5">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="font-display text-2xl font-bold text-[var(--color-text-primary)]">Cobros por proyecto</h1>
          <p className="text-sm text-[var(--color-text-muted)] mt-0.5">{filtered.length} de {projects.length} proyecto{projects.length !== 1 ? 's' : ''}</p>
        </div>
      </div>

      {/* KPIs globales */}
      {totales && (
        <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
          <div className="bg-[var(--color-bg-card)] border border-[var(--color-border)] rounded-xl p-4">
            <p className="text-[10px] font-mono uppercase tracking-wider text-[var(--color-text-muted)]">Total presupuestado</p>
            <p className="text-lg font-bold tabular-nums text-[var(--color-text-primary)] mt-1">{fmtCurrency(totales.totalPresupuestadoUSD, 'USD')}</p>
          </div>
          <div className="bg-[var(--color-bg-card)] border border-[var(--color-border)] rounded-xl p-4">
            <p className="text-[10px] font-mono uppercase tracking-wider text-[var(--color-text-muted)]">Total cobrado</p>
            <p className="text-lg font-bold tabular-nums text-emerald-400 mt-1">{fmtCurrency(totales.totalCobradoUSD, 'USD')}</p>
          </div>
          <div className="bg-[var(--color-bg-card)] border border-[var(--color-border)] rounded-xl p-4">
            <p className="text-[10px] font-mono uppercase tracking-wider text-[var(--color-text-muted)]">Total pendiente</p>
            <p className="text-lg font-bold tabular-nums text-amber-400 mt-1">{fmtCurrency(totales.totalPendienteUSD, 'USD')}</p>
          </div>
          <div className="bg-[var(--color-bg-card)] border border-[var(--color-border)] rounded-xl p-4">
            <p className="text-[10px] font-mono uppercase tracking-wider text-[var(--color-text-muted)]">A favor cliente</p>
            <p className="text-lg font-bold tabular-nums text-blue-400 mt-1">{fmtCurrency(totales.totalSaldoAFavorUSD, 'USD')}</p>
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
        <select
          value={estado}
          onChange={e => setEstado(e.target.value as EstadoFilter)}
          className="px-3 py-2 rounded-lg border border-[var(--color-border)] bg-[var(--color-bg-card)] text-sm text-[var(--color-text-primary)]"
        >
          <option value="all">Todos los estados</option>
          <option value="PENDIENTE">Pendientes</option>
          <option value="PARCIAL">Parciales</option>
          <option value="COMPLETO">Completos</option>
          <option value="EXCEDIDO">Excedidos</option>
          <option value="SIN_PRESUPUESTO">Sin presupuesto</option>
        </select>
        <div className="flex rounded-lg border border-[var(--color-border)] overflow-hidden text-xs font-mono uppercase tracking-wider">
          {([['true', 'Activos'], ['all', 'Todos']] as const).map(([val, label]) => (
            <button
              key={val}
              onClick={() => setActivos(val)}
              className={klass(
                'tap-target px-3 py-2 transition-colors',
                activos === val
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
            {projects.length === 0 ? 'Sin proyectos registrados' : 'Ningún proyecto coincide con los filtros'}
          </p>
        ) : (
          <div className="overflow-x-auto">
            <ResponsiveTable
              columns={columns}
              data={filtered}
              rowKey={(p) => p.id}
              onRowClick={(p) => navigate(`/finanzas/cobros/${p.id}`)}
              rowClickableOnDesktop
            />
          </div>
        )}
      </div>
    </div>
  );
}

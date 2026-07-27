import { useState, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'react-hot-toast';
import { Search, Copy, X } from 'lucide-react';
import { Spinner } from '../../../components/ui/Spinner';
import { ResponsiveTable, type Column } from '../../../components/ui/ResponsiveTable';
import {
  getCobrosByProject,
  getCobroProjectDetail,
  registrarCobroCliente,
  patchCobroCliente,
  type EstadoCobranza,
  type CobroProjectItem,
  type CobroDetail,
} from '../../../api/finance.api';
import { fmtCurrency, fmtDate } from '../../../lib/finance';
import { todayLocalISO } from '../../../utils/date';

function klass(...p: (string | false | undefined)[]) { return p.filter(Boolean).join(' '); }
function stripPlan(desc: string) { return desc.startsWith('[PLAN] ') ? desc.slice(7) : desc; }

const ESTADO_LABEL: Record<EstadoCobranza, string> = {
  SIN_PRESUPUESTO: 'Sin presupuesto',
  PENDIENTE: 'Pendiente',
  PARCIAL: 'Parcial',
  COMPLETO: 'Completo',
  EXCEDIDO: 'Excedido',
};
const ESTADO_BADGE: Record<EstadoCobranza, string> = {
  SIN_PRESUPUESTO: 'bg-[var(--color-border)] text-[var(--color-text-muted)]',
  PENDIENTE: 'bg-red-500/15 text-red-300 border-red-500/30',
  PARCIAL: 'bg-amber-500/15 text-amber-300 border-amber-500/30',
  COMPLETO: 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30',
  EXCEDIDO: 'bg-blue-500/15 text-blue-300 border-blue-500/30',
};

// Resumen para pegar en WhatsApp (los *...* son la negrita de WhatsApp).
function buildResumenWhatsApp(data: CobroDetail): string {
  const { project, kpis, cobros } = data;
  const usd = kpis.USD;
  const fechaKey = (c: CobroDetail['cobros'][number]) => c.fecha ?? c.dueDate ?? '';
  const fmtFila = (c: CobroDetail['cobros'][number], emoji: string) =>
    `${emoji} ${fmtDate(fechaKey(c))} · ${stripPlan(c.descripcion)} · ${fmtCurrency(c.monto, c.moneda)}`;
  const recibidos = cobros.filter(c => c.status !== 'PREVISTO').sort((a, b) => fechaKey(a).localeCompare(fechaKey(b)));
  const previstos = cobros.filter(c => c.status === 'PREVISTO').sort((a, b) => fechaKey(a).localeCompare(fechaKey(b)));

  const lines: string[] = [];
  lines.push(`*Resumen de pagos — ${project.clientName}*`);
  lines.push(`Obra ${project.code}${project.capacity ? ` · ${project.capacity} kWp` : ''}`);
  lines.push('');
  lines.push(`💰 *Presupuesto:* ${fmtCurrency(usd.presupuesto, 'USD')}`);
  lines.push(`✅ *Cobrado:* ${fmtCurrency(usd.cobrado, 'USD')}`);
  lines.push(`⏳ *Pendiente:* ${fmtCurrency(usd.pendiente, 'USD')}`);
  if (recibidos.length > 0) {
    lines.push('');
    lines.push('*Pagos recibidos*');
    recibidos.forEach(c => lines.push(fmtFila(c, '✅')));
  }
  if (previstos.length > 0) {
    lines.push('');
    lines.push('*Próximos pagos*');
    previstos.forEach(c => lines.push(fmtFila(c, '⏳')));
  }
  return lines.join('\n');
}

type EstadoFilter = 'all' | EstadoCobranza;

export function ClientesCobros() {
  const [activos, setActivos] = useState<'true' | 'all'>('true');
  const [estado, setEstado] = useState<EstadoFilter>('all');
  const [search, setSearch] = useState('');
  const [detailProject, setDetailProject] = useState<{ id: string; clientName: string } | null>(null);

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

  const columns: Column<CobroProjectItem>[] = [
    {
      key: 'cliente', label: 'Cliente / Obra', cardRole: 'title',
      render: (p) => (
        <>
          <span className="font-medium text-[var(--color-text-primary)]">{p.clientName}</span>
          <div className="text-[10px] text-[var(--color-text-muted)] font-mono">{p.code} · {p.capacity} kWp</div>
        </>
      ),
    },
    {
      key: 'presupuesto', label: 'Presupuesto', align: 'right', className: 'tabular-nums text-[var(--color-text-primary)]',
      render: (p) => (p.presupuestoUSD != null ? fmtCurrency(p.presupuestoUSD, 'USD') : '—'),
    },
    {
      key: 'cobrado', label: 'Cobrado', align: 'right', className: 'tabular-nums text-emerald-400',
      render: (p) => fmtCurrency(p.totalCobradoUSD, 'USD'),
    },
    {
      key: 'pendiente', label: 'Pendiente', align: 'right', cardRole: 'highlight',
      render: (p) => (
        <span className={klass('tabular-nums', p.estadoCobranza === 'EXCEDIDO' ? 'text-blue-400' : p.saldoPendienteUSD > 0.005 ? 'text-amber-400' : 'text-[var(--color-text-muted)]')}>
          {p.estadoCobranza === 'EXCEDIDO' ? `+${fmtCurrency(p.saldoAFavorUSD, 'USD')}` : p.presupuestoUSD != null ? fmtCurrency(p.saldoPendienteUSD, 'USD') : '—'}
        </span>
      ),
    },
    {
      key: 'estado', label: 'Estado',
      render: (p) => (
        <span className={klass('text-[10px] font-mono px-2 py-0.5 rounded uppercase border', ESTADO_BADGE[p.estadoCobranza])}>
          {ESTADO_LABEL[p.estadoCobranza]}
        </span>
      ),
    },
  ];

  return (
    <div className="space-y-5">
      <div>
        <h2 className="font-display text-xl font-bold text-[var(--color-text-primary)]">Cobros a clientes</h2>
        <p className="text-sm text-[var(--color-text-muted)] mt-0.5">
          {filtered.length} de {projects.length} cliente{projects.length !== 1 ? 's' : ''}. Tocá un cliente para ver, registrar o marcar pagos.
        </p>
      </div>

      {totales && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
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
        </div>
      )}

      <div className="flex items-center gap-3 flex-wrap">
        <div className="relative flex-1 min-w-[220px] max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[var(--color-text-muted)]" />
          <input
            type="text" placeholder="Buscar por cliente o código" value={search} onChange={e => setSearch(e.target.value)}
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
            <button key={val} onClick={() => setActivos(val)}
              className={klass('tap-target px-3 py-2 transition-colors', activos === val ? 'bg-[var(--color-accent)] text-gray-900 font-semibold' : 'bg-[var(--color-bg-card)] text-[var(--color-text-secondary)] hover:bg-[var(--color-bg-card-hover)]')}>
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
            {projects.length === 0 ? 'Sin clientes' : 'Ningún cliente coincide con la búsqueda'}
          </p>
        ) : (
          <div className="overflow-x-auto">
            <ResponsiveTable
              columns={columns} data={filtered} rowKey={(p) => p.id}
              onRowClick={(p) => setDetailProject({ id: p.id, clientName: p.clientName })}
              rowClickableOnDesktop
            />
          </div>
        )}
      </div>

      {detailProject && (
        <CobroDetailModal projectId={detailProject.id} onClose={() => setDetailProject(null)} />
      )}
    </div>
  );
}

// ─── Modal de detalle: cobros del cliente + acciones ────────────────────────

function CobroDetailModal({ projectId, onClose }: { projectId: string; onClose: () => void }) {
  const qc = useQueryClient();
  const [showRegistrar, setShowRegistrar] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [editMonto, setEditMonto] = useState('');

  const { data, isLoading } = useQuery({
    queryKey: ['cobros-by-project', projectId],
    queryFn: () => getCobroProjectDetail(projectId),
  });

  const invalidate = () => qc.invalidateQueries({ queryKey: ['cobros-by-project'] });

  const marcarPagado = useMutation({
    mutationFn: (id: string) => patchCobroCliente(id, { estado: 'PAGADO', fecha: todayLocalISO() }),
    onSuccess: () => { toast.success('Cobro marcado como pagado'); invalidate(); },
    onError: (e: unknown) => toast.error((e as { response?: { data?: { message?: string } } })?.response?.data?.message ?? 'No se pudo marcar'),
  });

  const editarMonto = useMutation({
    mutationFn: (v: { id: string; monto: number }) => patchCobroCliente(v.id, { monto: v.monto }),
    onSuccess: () => { toast.success('Monto actualizado'); setEditId(null); invalidate(); },
    onError: (e: unknown) => toast.error((e as { response?: { data?: { message?: string } } })?.response?.data?.message ?? 'No se pudo actualizar'),
  });

  function copiarResumen() {
    if (!data) return;
    const texto = buildResumenWhatsApp(data);
    navigator.clipboard.writeText(texto).then(
      () => toast.success('Resumen copiado — pegalo en WhatsApp'),
      () => toast.error('No se pudo copiar'),
    );
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 px-4" onMouseDown={e => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="w-full max-w-2xl max-h-[90vh] overflow-hidden rounded-xl border border-[var(--color-border)] bg-[var(--color-bg-card)] shadow-2xl flex flex-col">
        <div className="flex items-center justify-between border-b border-[var(--color-border)] px-5 py-3.5">
          <div>
            <h3 className="font-display text-lg font-bold text-[var(--color-text-primary)]">
              {data?.project.clientName ?? 'Cobros'}
            </h3>
            {data && <p className="text-xs text-[var(--color-text-muted)]">{data.project.code} · {data.project.capacity} kWp</p>}
          </div>
          <button onClick={onClose} className="p-1 text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)]"><X className="w-5 h-5" /></button>
        </div>

        <div className="overflow-y-auto px-5 py-4 space-y-4">
          {isLoading || !data ? (
            <div className="flex items-center justify-center py-12"><Spinner /></div>
          ) : (
            <>
              {/* KPIs */}
              <div className="grid grid-cols-3 gap-3">
                <Kpi label="Presupuesto" value={fmtCurrency(data.kpis.USD.presupuesto, 'USD')} />
                <Kpi label="Cobrado" value={fmtCurrency(data.kpis.USD.cobrado, 'USD')} tone="text-emerald-400" />
                <Kpi label="Pendiente" value={fmtCurrency(data.kpis.USD.pendiente, 'USD')} tone="text-amber-400" />
              </div>

              {/* Acciones */}
              <div className="flex items-center gap-2 flex-wrap">
                <button onClick={() => setShowRegistrar(v => !v)}
                  className="text-xs px-3 py-1.5 rounded-md bg-[var(--color-accent)] text-gray-900 font-semibold hover:opacity-90">
                  {showRegistrar ? 'Cancelar' : 'Registrar cobro'}
                </button>
                <button onClick={copiarResumen}
                  className="text-xs px-3 py-1.5 rounded-md border border-[var(--color-border)] text-[var(--color-text-secondary)] hover:bg-[var(--color-bg-card-hover)] inline-flex items-center gap-1.5">
                  <Copy className="w-3.5 h-3.5" /> Copiar resumen (WhatsApp)
                </button>
              </div>

              {showRegistrar && (
                <RegistrarCobroForm projectId={projectId} onDone={() => { setShowRegistrar(false); invalidate(); }} />
              )}

              {/* Lista de cobros */}
              <div className="space-y-2">
                {data.cobros.length === 0 ? (
                  <p className="text-sm text-[var(--color-text-muted)] py-4 text-center">Todavía no hay cobros cargados.</p>
                ) : (
                  [...data.cobros]
                    .sort((a, b) => (a.fecha ?? '').localeCompare(b.fecha ?? ''))
                    .map(c => {
                      const previsto = c.status === 'PREVISTO';
                      const editing = editId === c.id;
                      return (
                        <div key={c.id} className="flex items-center justify-between gap-3 rounded-lg border border-[var(--color-border)] bg-[var(--color-bg-app)]/30 px-3 py-2">
                          <div className="min-w-0">
                            <div className="flex items-center gap-2">
                              <span className={klass('text-[9px] font-mono px-1.5 py-0.5 rounded uppercase border', previsto ? 'bg-amber-500/15 text-amber-300 border-amber-500/30' : 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30')}>
                                {previsto ? 'Previsto' : 'Cobrado'}
                              </span>
                              <span className="text-sm text-[var(--color-text-primary)] truncate">{stripPlan(c.descripcion)}</span>
                            </div>
                            <div className="text-[10px] text-[var(--color-text-muted)] mt-0.5">{fmtDate(c.fecha ?? c.dueDate ?? '')}</div>
                          </div>
                          <div className="flex items-center gap-2 shrink-0">
                            {editing ? (
                              <>
                                <input type="number" step="0.01" value={editMonto} onChange={e => setEditMonto(e.target.value)}
                                  className="w-24 rounded border border-[var(--color-border)] bg-[var(--color-bg-app)] px-2 py-1 text-sm text-right tabular-nums text-[var(--color-text-primary)]" autoFocus />
                                <button onClick={() => { const m = Number(editMonto); if (m > 0) editarMonto.mutate({ id: c.id, monto: m }); }}
                                  disabled={editarMonto.isPending}
                                  className="text-[11px] px-2 py-1 rounded bg-[var(--color-accent)] text-gray-900 font-semibold disabled:opacity-50">Guardar</button>
                                <button onClick={() => setEditId(null)} className="text-[11px] px-2 py-1 rounded border border-[var(--color-border)] text-[var(--color-text-secondary)]">Cancelar</button>
                              </>
                            ) : (
                              <>
                                <span className="text-sm tabular-nums text-[var(--color-text-primary)]">{fmtCurrency(c.monto, c.moneda)}</span>
                                <button onClick={() => { setEditId(c.id); setEditMonto(String(c.monto)); }}
                                  className="text-[11px] px-2 py-1 rounded border border-[var(--color-border)] text-[var(--color-text-secondary)] hover:bg-[var(--color-bg-card-hover)]">Editar monto</button>
                                {previsto && (
                                  <button onClick={() => marcarPagado.mutate(c.id)} disabled={marcarPagado.isPending}
                                    className="text-[11px] px-2 py-1 rounded bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 hover:bg-emerald-500/30 disabled:opacity-50">Marcar pagado</button>
                                )}
                              </>
                            )}
                          </div>
                        </div>
                      );
                    })
                )}
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

function Kpi({ label, value, tone }: { label: string; value: string; tone?: string }) {
  return (
    <div className="bg-[var(--color-bg-app)]/40 border border-[var(--color-border)] rounded-lg p-2.5">
      <p className="text-[9px] font-mono uppercase tracking-wider text-[var(--color-text-muted)]">{label}</p>
      <p className={klass('text-sm font-bold tabular-nums mt-0.5', tone ?? 'text-[var(--color-text-primary)]')}>{value}</p>
    </div>
  );
}

function RegistrarCobroForm({ projectId, onDone }: { projectId: string; onDone: () => void }) {
  const [descripcion, setDescripcion] = useState('Pago');
  const [monto, setMonto] = useState('');
  const [moneda, setMoneda] = useState<'USD' | 'UYU'>('USD');
  const [fecha, setFecha] = useState(todayLocalISO());
  const [modo, setModo] = useState<'COBRADO' | 'PREVISTO'>('COBRADO');

  const mut = useMutation({
    mutationFn: () => registrarCobroCliente({ projectId, descripcion: descripcion.trim(), monto: Number(monto), moneda, fecha, modo }),
    onSuccess: () => { toast.success(modo === 'COBRADO' ? 'Cobro registrado' : 'Cobro previsto registrado'); onDone(); },
    onError: (e: unknown) => toast.error((e as { response?: { data?: { message?: string } } })?.response?.data?.message ?? 'No se pudo registrar'),
  });

  const input = 'w-full rounded-md border border-[var(--color-border)] bg-[var(--color-bg-app)] px-2.5 py-1.5 text-sm text-[var(--color-text-primary)] focus:border-[var(--color-accent)] focus:outline-none';

  return (
    <div className="rounded-lg border border-[var(--color-border)] bg-[var(--color-bg-app)]/30 p-3 space-y-3">
      <div className="grid grid-cols-2 gap-2.5">
        <label className="block col-span-2">
          <span className="text-[10px] font-mono uppercase text-[var(--color-text-muted)]">Descripción</span>
          <input className={input} value={descripcion} onChange={e => setDescripcion(e.target.value)} />
        </label>
        <label className="block">
          <span className="text-[10px] font-mono uppercase text-[var(--color-text-muted)]">Monto</span>
          <input type="number" step="0.01" min="0" className={input} value={monto} onChange={e => setMonto(e.target.value)} />
        </label>
        <label className="block">
          <span className="text-[10px] font-mono uppercase text-[var(--color-text-muted)]">Moneda</span>
          <select className={input} value={moneda} onChange={e => setMoneda(e.target.value as 'USD' | 'UYU')}>
            <option value="USD">USD</option>
            <option value="UYU">UYU</option>
          </select>
        </label>
        <label className="block">
          <span className="text-[10px] font-mono uppercase text-[var(--color-text-muted)]">Fecha</span>
          <input type="date" className={input} value={fecha} onChange={e => setFecha(e.target.value)} />
        </label>
        <label className="block">
          <span className="text-[10px] font-mono uppercase text-[var(--color-text-muted)]">Estado</span>
          <select className={input} value={modo} onChange={e => setModo(e.target.value as 'COBRADO' | 'PREVISTO')}>
            <option value="COBRADO">Cobrado (ya pagó)</option>
            <option value="PREVISTO">Previsto (pendiente)</option>
          </select>
        </label>
      </div>
      <div className="flex justify-end">
        <button onClick={() => { if (Number(monto) > 0 && descripcion.trim()) mut.mutate(); else toast.error('Completá descripción y monto'); }}
          disabled={mut.isPending}
          className="text-xs px-3 py-1.5 rounded-md bg-[var(--color-accent)] text-gray-900 font-semibold disabled:opacity-50">
          {mut.isPending ? 'Guardando...' : 'Guardar cobro'}
        </button>
      </div>
    </div>
  );
}

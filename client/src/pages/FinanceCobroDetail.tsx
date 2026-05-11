import { useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'react-hot-toast';
import { ChevronLeft, Plus, ExternalLink, X } from 'lucide-react';
import { Spinner } from '../components/ui/Spinner';
import { getCobroProjectDetail, createMovement } from '../api/finance.api';
import { getAccounts } from '../api/accounts.api';
import { fmtCurrency, fmtDate } from '../lib/finance';
import type { Moneda } from '../types/finance.types';
import type { EstadoCobranza } from '../api/finance.api';
import { ACCOUNT_TYPE_LABEL } from '../types/accounts.types';
import { todayLocalISO } from '../utils/date';

function klass(...p: (string | false | undefined)[]) { return p.filter(Boolean).join(' '); }
function getApiErr(err: unknown) {
  return (err as { response?: { data?: { message?: string } } })?.response?.data?.message;
}

const ESTADO_LABEL: Record<EstadoCobranza, string> = {
  SIN_PRESUPUESTO: 'Sin presupuesto',
  PENDIENTE: 'Pendiente',
  PARCIAL: 'Parcial',
  COMPLETO: 'Completo',
  EXCEDIDO: 'Excedido',
};

const ESTADO_BADGE_CLASS: Record<EstadoCobranza, string> = {
  SIN_PRESUPUESTO: 'bg-[var(--color-border)] text-[var(--color-text-muted)] border-[var(--color-border)]',
  PENDIENTE: 'bg-red-500/15 text-red-300 border-red-500/30',
  PARCIAL: 'bg-amber-500/15 text-amber-300 border-amber-500/30',
  COMPLETO: 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30',
  EXCEDIDO: 'bg-blue-500/15 text-blue-300 border-blue-500/30',
};

type Tab = 'cobros' | 'estado';

export function FinanceCobroDetail() {
  const { id: projectId } = useParams<{ id: string }>();
  const [tab, setTab] = useState<Tab>('cobros');
  const [showCobroModal, setShowCobroModal] = useState(false);

  const { data, isLoading, error } = useQuery({
    queryKey: ['cobros-by-project', projectId],
    queryFn: () => getCobroProjectDetail(projectId!),
    enabled: !!projectId,
  });

  if (!projectId) return null;
  if (isLoading) return <div className="flex justify-center py-12"><Spinner /></div>;
  if (error || !data) {
    return (
      <div className="p-6">
        <p className="text-sm text-red-400">Error al cargar: {getApiErr(error)}</p>
        <Link to="/finanzas/cobros" className="text-sm text-[var(--color-accent)] hover:underline mt-2 inline-block">← Volver</Link>
      </div>
    );
  }

  const { project, kpis, totals, cobros, estadoCuenta } = data;

  return (
    <div className="p-6 space-y-5">
      <div>
        <Link to="/finanzas/cobros" className="inline-flex items-center gap-1 text-xs text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)]">
          <ChevronLeft className="w-3 h-3" /> Cobros
        </Link>
        <div className="flex items-start justify-between gap-3 flex-wrap mt-2">
          <div>
            <h1 className="font-display text-2xl font-bold text-[var(--color-text-primary)]">{project.clientName}</h1>
            <p className="text-sm text-[var(--color-text-muted)] font-mono mt-0.5">
              {project.code} · {project.capacity} kWp · {project.status}
              <span className={klass('ml-3 text-[10px] font-mono px-2 py-0.5 rounded uppercase border', ESTADO_BADGE_CLASS[totals.estadoCobranza])}>
                {ESTADO_LABEL[totals.estadoCobranza]}
              </span>
            </p>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setShowCobroModal(true)}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-[var(--color-accent)] text-gray-900 text-sm font-semibold hover:bg-[var(--color-accent-hover)] transition-colors"
            >
              <Plus className="w-4 h-4" /> Registrar cobro
            </button>
            <Link
              to={`/projects/${project.id}`}
              className="inline-flex items-center gap-2 px-3 py-2 rounded-lg border border-[var(--color-border)] text-sm text-[var(--color-text-secondary)] hover:bg-[var(--color-bg-card-hover)]"
            >
              <ExternalLink className="w-3.5 h-3.5" /> Ver proyecto
            </Link>
          </div>
        </div>
      </div>

      {/* KPIs por moneda */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        <KpiCard moneda="USD" data={kpis.USD} />
        <KpiCard moneda="UYU" data={kpis.UYU} />
      </div>

      {/* Tabs */}
      <div className="flex gap-0 border-b border-[var(--color-border)]">
        {(['cobros', 'estado'] as Tab[]).map(t => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={klass(
              'px-4 py-2 text-xs font-mono uppercase tracking-wider transition-colors border-b-2 -mb-px',
              tab === t
                ? 'text-[var(--color-accent)] border-[var(--color-accent)] font-semibold'
                : 'text-[var(--color-text-muted)] border-transparent hover:text-[var(--color-text-secondary)]',
            )}
          >
            {t === 'cobros' ? `Cobros (${cobros.length})` : 'Estado de cuenta'}
          </button>
        ))}
      </div>

      {tab === 'cobros' && (
        <div className="bg-[var(--color-bg-card)] border border-[var(--color-border)] rounded-xl overflow-hidden">
          {cobros.length === 0 ? (
            <p className="text-sm text-[var(--color-text-muted)] text-center py-12">Sin cobros registrados todavía</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-[var(--color-border)] text-xs font-mono text-[var(--color-text-muted)] uppercase tracking-wider">
                    <th className="px-4 py-3 text-left font-medium">Fecha</th>
                    <th className="px-4 py-3 text-left font-medium">Descripción</th>
                    <th className="px-4 py-3 text-right font-medium">Monto</th>
                    <th className="px-4 py-3 text-left font-medium">Cuenta</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[var(--color-border)]">
                  {cobros.map(c => (
                    <tr key={c.id} className="hover:bg-[var(--color-bg-card-hover)] transition-colors">
                      <td className="px-4 py-3 text-[var(--color-text-secondary)] tabular-nums">{fmtDate(c.fecha)}</td>
                      <td className="px-4 py-3 text-[var(--color-text-primary)]">{c.descripcion}</td>
                      <td className="px-4 py-3 text-right tabular-nums text-emerald-400">{fmtCurrency(c.monto, c.moneda)}</td>
                      <td className="px-4 py-3 text-[var(--color-text-muted)] text-[11px]">{c.accountName ?? '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {tab === 'estado' && (
        <div className="bg-[var(--color-bg-card)] border border-[var(--color-border)] rounded-xl overflow-hidden">
          {estadoCuenta.length === 0 ? (
            <p className="text-sm text-[var(--color-text-muted)] text-center py-12">Sin movimientos en el estado de cuenta</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-[var(--color-border)] text-xs font-mono text-[var(--color-text-muted)] uppercase tracking-wider">
                    <th className="px-4 py-3 text-left font-medium">Fecha</th>
                    <th className="px-4 py-3 text-left font-medium">Descripción</th>
                    <th className="px-4 py-3 text-right font-medium">Monto</th>
                    <th className="px-4 py-3 text-right font-medium">Acumulado USD</th>
                    <th className="px-4 py-3 text-right font-medium">Falta USD</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[var(--color-border)]">
                  {estadoCuenta.map((row, i) => (
                    <tr key={i} className="hover:bg-[var(--color-bg-card-hover)]">
                      <td className="px-4 py-3 text-[var(--color-text-secondary)] tabular-nums">{fmtDate(row.fecha)}</td>
                      <td className="px-4 py-3 text-[var(--color-text-primary)]">{row.descripcion}</td>
                      <td className="px-4 py-3 text-right tabular-nums text-emerald-400">+{fmtCurrency(row.monto, row.moneda)}</td>
                      <td className="px-4 py-3 text-right tabular-nums text-[var(--color-text-primary)]">{fmtCurrency(row.acumuladoCobradoUSD, 'USD')}</td>
                      <td className="px-4 py-3 text-right tabular-nums text-[var(--color-text-muted)]">
                        {row.saldoRestanteUSD != null ? fmtCurrency(Math.max(0, row.saldoRestanteUSD), 'USD') : '—'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {showCobroModal && (
        <RegisterCobroModal
          projectId={project.id}
          projectName={project.clientName}
          onClose={() => setShowCobroModal(false)}
        />
      )}
    </div>
  );
}

function KpiCard({ moneda, data }: { moneda: Moneda; data: { presupuesto: number; cobrado: number; pendiente: number; saldoAFavor: number } }) {
  const hasData = data.presupuesto > 0 || data.cobrado > 0;
  if (!hasData) return null;
  return (
    <div className="bg-[var(--color-bg-card)] border border-[var(--color-border)] rounded-xl p-4">
      <p className="text-[10px] font-mono uppercase tracking-wider text-[var(--color-text-muted)]">{moneda}</p>
      <div className="grid grid-cols-3 gap-2 mt-2">
        <div>
          <p className="text-[10px] text-[var(--color-text-muted)]">Presupuesto</p>
          <p className="text-sm font-semibold tabular-nums text-[var(--color-text-primary)]">{fmtCurrency(data.presupuesto, moneda)}</p>
        </div>
        <div>
          <p className="text-[10px] text-[var(--color-text-muted)]">Cobrado</p>
          <p className="text-sm font-semibold tabular-nums text-emerald-400">{fmtCurrency(data.cobrado, moneda)}</p>
        </div>
        <div>
          <p className="text-[10px] text-[var(--color-text-muted)]">{data.saldoAFavor > 0 ? 'A favor cliente' : 'Pendiente'}</p>
          <p className={klass(
            'text-sm font-semibold tabular-nums',
            data.saldoAFavor > 0 ? 'text-blue-400'
              : data.pendiente > 0 ? 'text-amber-400'
              : 'text-[var(--color-text-muted)]',
          )}>
            {fmtCurrency(data.saldoAFavor > 0 ? data.saldoAFavor : data.pendiente, moneda)}
          </p>
        </div>
      </div>
    </div>
  );
}

// ─── Modal: Registrar cobro ──────────────────────────────────────────────────

function RegisterCobroModal({ projectId, projectName, onClose }: { projectId: string; projectName: string; onClose: () => void }) {
  const qc = useQueryClient();
  const [form, setForm] = useState({
    modo: 'COBRADO' as 'COBRADO' | 'PREVISTO',
    descripcion: '',
    fecha: todayLocalISO(),
    monto: '',
    moneda: 'USD' as Moneda,
    accountId: '',
    observaciones: '',
  });
  const [error, setError] = useState('');

  const { data: accounts = [] } = useQuery({
    queryKey: ['accounts', 'true'],
    queryFn: () => getAccounts({ activa: 'true' }),
  });

  const accountsFiltered = accounts.filter(a => a.moneda === form.moneda);
  const monto = Number.parseFloat(form.monto);
  const montoValido = Number.isFinite(monto) && monto > 0;
  const esPrevisto = form.modo === 'PREVISTO';
  const requiereCuenta = !esPrevisto;
  const accountInvalida = requiereCuenta && !form.accountId;

  const mut = useMutation({
    mutationFn: () => createMovement({
      fecha: form.fecha,
      tipoMovimiento: 'INGRESO',
      categoriaPrincipal: 'PROYECTO_ENTRADA',
      descripcion: form.descripcion.trim(),
      monto,
      moneda: form.moneda,
      pagado: false,
      cobrado: !esPrevisto,
      impactaFlujo: true,
      status: esPrevisto ? 'PREVISTO' : 'PAGADO',
      estadoAprobacion: 'REGISTRADO',
      proyectoId: projectId,
      ...(esPrevisto ? { dueDate: form.fecha } : {}),
      ...(!esPrevisto && form.accountId ? { accountId: form.accountId } : {}),
      ...(form.observaciones ? { observaciones: form.observaciones } : {}),
    }),
    onSuccess: () => {
      toast.success(esPrevisto ? 'Cobro previsto agendado' : 'Cobro registrado');
      qc.invalidateQueries({ queryKey: ['cobros-by-project'] });
      qc.invalidateQueries({ queryKey: ['accounts'] });
      qc.invalidateQueries({ queryKey: ['account-balance'] });
      qc.invalidateQueries({ queryKey: ['finance-movements'] });
      qc.invalidateQueries({ queryKey: ['finance-invariant-check'] });
      qc.invalidateQueries({ queryKey: ['finance-pending'] });
      qc.invalidateQueries({ queryKey: ['finance-cashflow'] });
      onClose();
    },
    onError: (err) => setError(getApiErr(err) ?? 'Error al guardar'),
  });

  const submitDisabled = !form.descripcion.trim() || !montoValido || accountInvalida || mut.isPending;

  return (
    <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4">
      <div className="bg-[var(--color-bg-card)] border border-[var(--color-border)] rounded-xl w-full max-w-lg shadow-2xl">
        <div className="flex items-center justify-between p-4 border-b border-[var(--color-border)]">
          <div>
            <p className="text-sm font-semibold text-[var(--color-text-primary)]">Registrar cobro</p>
            <p className="text-[11px] text-[var(--color-text-muted)] mt-0.5">{projectName}</p>
          </div>
          <button onClick={onClose} className="text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)]"><X className="w-5 h-5" /></button>
        </div>

        <div className="p-4 space-y-3">
          <div>
            <label className="block text-[11px] font-mono uppercase tracking-wider text-[var(--color-text-muted)] mb-1">Tipo *</label>
            <div className="flex gap-2">
              {(['COBRADO', 'PREVISTO'] as const).map(m => (
                <button
                  key={m}
                  type="button"
                  onClick={() => setForm({ ...form, modo: m, accountId: m === 'PREVISTO' ? '' : form.accountId })}
                  className={klass(
                    'flex-1 px-3 py-2 rounded-lg text-sm border transition-colors',
                    form.modo === m
                      ? 'border-[var(--color-accent)] bg-[var(--color-accent)]/10 text-[var(--color-text-primary)]'
                      : 'border-[var(--color-border)] text-[var(--color-text-secondary)]',
                  )}
                >
                  {m === 'COBRADO' ? 'Cobrado' : 'Previsto'}
                </button>
              ))}
            </div>
            <p className="text-[10px] text-[var(--color-text-muted)] mt-1">
              {esPrevisto
                ? 'El dinero todavía no entró — se agenda como cobro previsto.'
                : 'El dinero ya entró a una cuenta — registra el ingreso real.'}
            </p>
          </div>

          <div>
            <label className="block text-[11px] font-mono uppercase tracking-wider text-[var(--color-text-muted)] mb-1">Descripción *</label>
            <input
              type="text"
              value={form.descripcion}
              onChange={e => setForm({ ...form, descripcion: e.target.value })}
              placeholder={esPrevisto ? 'Ej: Anticipo 50% obra' : 'Ej: Pago 50% obra'}
              className="w-full px-3 py-2 rounded-lg border border-[var(--color-border)] bg-[var(--color-bg-app)] text-sm text-[var(--color-text-primary)] focus:outline-none focus:ring-2 focus:ring-[var(--color-accent)]"
              autoFocus
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-[11px] font-mono uppercase tracking-wider text-[var(--color-text-muted)] mb-1">
                {esPrevisto ? 'Fecha esperada *' : 'Fecha *'}
              </label>
              <input
                type="date"
                value={form.fecha}
                max={esPrevisto ? undefined : todayLocalISO()}
                onChange={e => setForm({ ...form, fecha: e.target.value })}
                className="w-full px-3 py-2 rounded-lg border border-[var(--color-border)] bg-[var(--color-bg-app)] text-sm text-[var(--color-text-primary)] focus:outline-none focus:ring-2 focus:ring-[var(--color-accent)]"
              />
            </div>
            <div>
              <label className="block text-[11px] font-mono uppercase tracking-wider text-[var(--color-text-muted)] mb-1">Monto *</label>
              <div className="flex gap-2">
                <select
                  value={form.moneda}
                  onChange={e => setForm({ ...form, moneda: e.target.value as Moneda, accountId: '' })}
                  className="px-2 py-2 rounded-lg border border-[var(--color-border)] bg-[var(--color-bg-app)] text-sm text-[var(--color-text-primary)]"
                >
                  <option value="USD">USD</option>
                  <option value="UYU">UYU</option>
                </select>
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  value={form.monto}
                  onChange={e => setForm({ ...form, monto: e.target.value })}
                  className="flex-1 px-3 py-2 rounded-lg border border-[var(--color-border)] bg-[var(--color-bg-app)] text-sm text-[var(--color-text-primary)] focus:outline-none focus:ring-2 focus:ring-[var(--color-accent)] tabular-nums"
                />
              </div>
            </div>
          </div>

          {!esPrevisto && (
            <div>
              <label className="block text-[11px] font-mono uppercase tracking-wider text-[var(--color-text-muted)] mb-1">
                Cuenta donde entró el dinero *
              </label>
              <select
                value={form.accountId}
                onChange={e => setForm({ ...form, accountId: e.target.value })}
                className="w-full px-3 py-2 rounded-lg border border-[var(--color-border)] bg-[var(--color-bg-app)] text-sm text-[var(--color-text-primary)]"
              >
                <option value="">— Elegí una cuenta —</option>
                {accountsFiltered.map(a => (
                  <option key={a.id} value={a.id}>{a.nombre} ({ACCOUNT_TYPE_LABEL[a.tipo]} · {a.moneda})</option>
                ))}
              </select>
              {accountsFiltered.length === 0 && (
                <p className="text-[10px] text-amber-400 mt-1">
                  No hay cuentas activas en {form.moneda}. Creá una desde Admin → Cuentas.
                </p>
              )}
            </div>
          )}

          <div>
            <label className="block text-[11px] font-mono uppercase tracking-wider text-[var(--color-text-muted)] mb-1">Observaciones</label>
            <textarea
              rows={2}
              value={form.observaciones}
              onChange={e => setForm({ ...form, observaciones: e.target.value })}
              className="w-full px-3 py-2 rounded-lg border border-[var(--color-border)] bg-[var(--color-bg-app)] text-sm text-[var(--color-text-primary)] focus:outline-none focus:ring-2 focus:ring-[var(--color-accent)] resize-none"
            />
          </div>

          {error && <p className="text-sm text-red-400 bg-red-500/10 rounded-lg px-3 py-2">{error}</p>}
        </div>

        <div className="flex justify-end gap-2 p-4 border-t border-[var(--color-border)]">
          <button
            onClick={onClose}
            className="px-3 py-2 rounded-lg border border-[var(--color-border)] text-sm text-[var(--color-text-secondary)] hover:bg-[var(--color-bg-card-hover)]"
          >
            Cancelar
          </button>
          <button
            onClick={() => mut.mutate()}
            disabled={submitDisabled}
            className={klass(
              'px-4 py-2 rounded-lg text-sm font-semibold transition-colors',
              submitDisabled
                ? 'bg-[var(--color-border)] text-[var(--color-text-muted)] cursor-not-allowed'
                : 'bg-[var(--color-accent)] text-gray-900 hover:bg-[var(--color-accent-hover)]',
            )}
          >
            {mut.isPending ? 'Guardando…' : 'Confirmar cobro'}
          </button>
        </div>
      </div>
    </div>
  );
}


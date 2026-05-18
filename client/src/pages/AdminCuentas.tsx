import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'react-hot-toast';
import { Plus, X, Pencil, Power } from 'lucide-react';
import { getAccounts, createAccount, patchAccount, deleteAccount } from '../api/accounts.api';
import { fmtCurrency, fmtDate } from '../lib/finance';
import type { Account, AccountType } from '../types/accounts.types';
import { ACCOUNT_TYPE_LABEL } from '../types/accounts.types';
import type { Moneda } from '../types/finance.types';
import { todayLocalISO } from '../utils/date';

function klass(...p: (string | false | undefined)[]) { return p.filter(Boolean).join(' '); }
function getApiErr(err: unknown) {
  return (err as { response?: { data?: { message?: string } } })?.response?.data?.message;
}

const inp = 'w-full rounded-lg border border-[var(--color-border)] bg-[var(--color-bg-app)] px-3 py-2 text-sm text-[var(--color-text-primary)] focus:outline-none focus:ring-2 focus:ring-[var(--color-accent)]';
const lbl = 'block text-xs font-mono text-[var(--color-text-muted)] mb-1 uppercase tracking-wider';

function AccountForm({ initial, accountId, onSuccess, onCancel }: {
  initial?: Account | null;
  accountId?: string;
  onSuccess: () => void;
  onCancel: () => void;
}) {
  const [form, setForm] = useState({
    nombre: initial?.nombre ?? '',
    tipo: (initial?.tipo ?? 'BANCO') as AccountType,
    moneda: (initial?.moneda ?? 'USD') as Moneda,
    saldoInicial: initial?.saldoInicial?.toString() ?? '0',
    fechaSaldoInicial: initial?.fechaSaldoInicial ?? '',
    notas: initial?.notas ?? '',
    activa: initial?.activa ?? true,
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  function setF<K extends keyof typeof form>(k: K, v: typeof form[K]) { setForm(p => ({ ...p, [k]: v })); }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const saldo = parseFloat(form.saldoInicial) || 0;
      if (accountId) {
        await patchAccount(accountId, {
          nombre: form.nombre,
          tipo: form.tipo,
          moneda: form.moneda,
          saldoInicial: saldo,
          fechaSaldoInicial: form.fechaSaldoInicial || null,
          notas: form.notas || null,
          activa: form.activa,
        });
        toast.success('Cuenta actualizada');
      } else {
        await createAccount({
          nombre: form.nombre,
          tipo: form.tipo,
          moneda: form.moneda,
          saldoInicial: saldo,
          ...(form.fechaSaldoInicial ? { fechaSaldoInicial: form.fechaSaldoInicial } : {}),
          ...(form.notas ? { notas: form.notas } : {}),
        });
        toast.success('Cuenta creada');
      }
      onSuccess();
    } catch (err) {
      setError(getApiErr(err) ?? 'Error al guardar');
    } finally {
      setLoading(false);
    }
  }

  return (
    <form onSubmit={submit} className="space-y-4">
      <div><label className={lbl}>Nombre *</label><input className={inp} value={form.nombre} onChange={e => setF('nombre', e.target.value)} required autoFocus /></div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className={lbl}>Tipo *</label>
          <select className={inp} value={form.tipo} onChange={e => setF('tipo', e.target.value as AccountType)}>
            <option value="BANCO">Banco</option>
            <option value="EFECTIVO">Efectivo</option>
            <option value="TARJETA">Tarjeta</option>
            <option value="OTRO">Otro</option>
          </select>
        </div>
        <div>
          <label className={lbl}>Moneda *</label>
          <select className={inp} value={form.moneda} onChange={e => setF('moneda', e.target.value as Moneda)}>
            <option value="USD">USD</option>
            <option value="UYU">UYU</option>
          </select>
        </div>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className={lbl}>Saldo inicial</label>
          <input type="number" step="0.01" className={inp} value={form.saldoInicial} onChange={e => setF('saldoInicial', e.target.value)} />
        </div>
        <div>
          <label className={lbl}>Fecha del saldo</label>
          <input
            type="date"
            className={inp}
            value={form.fechaSaldoInicial}
            max={todayLocalISO()}
            onChange={e => setF('fechaSaldoInicial', e.target.value)}
          />
          <p className="text-[10px] text-[var(--color-text-muted)] mt-1">
            "Saldo inicial" representa el saldo al CIERRE de esta fecha. Los movimientos de ese día y anteriores quedan absorbidos en el saldo inicial; sólo los del día siguiente en adelante afectan el saldo calculado.
          </p>
        </div>
      </div>
      <div><label className={lbl}>Notas</label><textarea className={klass(inp, 'resize-none')} rows={2} value={form.notas} onChange={e => setF('notas', e.target.value)} /></div>
      {accountId && (
        <label className="flex items-center gap-2 text-sm text-[var(--color-text-secondary)] cursor-pointer">
          <input type="checkbox" checked={form.activa} onChange={e => setF('activa', e.target.checked)} />
          Activa
        </label>
      )}
      {error && <p className="text-sm text-red-400 bg-red-500/10 rounded-lg px-3 py-2">{error}</p>}
      <div className="flex gap-3">
        <button type="submit" disabled={loading} className="flex-1 py-2 rounded-lg bg-[var(--color-accent)] text-gray-900 text-sm font-semibold hover:bg-[var(--color-accent-hover)] transition-colors disabled:opacity-60">
          {loading ? 'Guardando...' : (accountId ? 'Guardar cambios' : 'Crear cuenta')}
        </button>
        <button type="button" onClick={onCancel} className="px-4 py-2 rounded-lg border border-[var(--color-border)] text-sm text-[var(--color-text-secondary)] hover:bg-[var(--color-bg-card-hover)] transition-colors">Cancelar</button>
      </div>
    </form>
  );
}

export function TabCuentas() {
  const qc = useQueryClient();
  const [showAll, setShowAll] = useState(true);
  const [creating, setCreating] = useState(false);
  const [editing, setEditing] = useState<Account | null>(null);

  const { data: accounts = [], isLoading } = useQuery({
    queryKey: ['accounts', showAll ? 'all' : 'true'],
    queryFn: () => getAccounts({ activa: showAll ? 'all' : 'true' }),
  });

  function invalidateFinanceLiquidity() {
    qc.invalidateQueries({ queryKey: ['accounts'] });
    qc.invalidateQueries({ queryKey: ['accounts-summary'] });
    qc.invalidateQueries({ queryKey: ['finance-movements'] });
    qc.invalidateQueries({ queryKey: ['finance-dashboard'] });
  }

  async function toggleActive(a: Account) {
    try {
      await patchAccount(a.id, { activa: !a.activa });
      invalidateFinanceLiquidity();
    } catch (err) {
      toast.error(getApiErr(err) ?? 'No se pudo cambiar el estado');
    }
  }

  async function handleDelete(a: Account) {
    if (!confirm(`¿Eliminar la cuenta "${a.nombre}"? Si tiene movimientos asociados, no se va a poder borrar.`)) return;
    try {
      await deleteAccount(a.id);
      toast.success('Cuenta eliminada');
      invalidateFinanceLiquidity();
    } catch (err) {
      toast.error(getApiErr(err) ?? 'Error al eliminar');
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <label className="flex items-center gap-2 text-sm text-[var(--color-text-secondary)] cursor-pointer">
          <input type="checkbox" checked={showAll} onChange={e => setShowAll(e.target.checked)} />
          Mostrar inactivas
        </label>
        <button onClick={() => setCreating(true)} className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-[var(--color-accent)] text-gray-900 text-sm font-semibold hover:bg-[var(--color-accent-hover)] transition-colors">
          <Plus className="w-4 h-4" /> Nueva cuenta
        </button>
      </div>

      {isLoading ? (
        <p className="text-sm text-[var(--color-text-muted)] text-center py-8">Cargando...</p>
      ) : accounts.length === 0 ? (
        <p className="text-sm text-[var(--color-text-muted)] text-center py-8">Sin cuentas registradas</p>
      ) : (
        <div className="bg-[var(--color-bg-card)] border border-[var(--color-border)] rounded-xl overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-[var(--color-border)] text-xs font-mono text-[var(--color-text-muted)] uppercase tracking-wider">
                {['Nombre', 'Tipo', 'Moneda', 'Saldo inicial', 'Fecha', 'Estado', ''].map(h => (
                  <th key={h} className="px-4 py-3 text-left font-medium">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--color-border)]">
              {accounts.map(a => (
                <tr key={a.id} className={klass('hover:bg-[var(--color-bg-card-hover)] transition-colors', !a.activa && 'opacity-60')}>
                  <td className="px-4 py-3 font-medium text-[var(--color-text-primary)]">
                    <div>{a.nombre}</div>
                    {a.notas && <div className="text-xs text-[var(--color-text-muted)]">{a.notas}</div>}
                  </td>
                  <td className="px-4 py-3 text-[var(--color-text-muted)]">{ACCOUNT_TYPE_LABEL[a.tipo]}</td>
                  <td className="px-4 py-3 text-[var(--color-text-muted)]">{a.moneda}</td>
                  <td className="px-4 py-3 tabular-nums text-[var(--color-text-secondary)]">{fmtCurrency(a.saldoInicial, a.moneda)}</td>
                  <td className="px-4 py-3 text-xs text-[var(--color-text-muted)]">{a.fechaSaldoInicial ? fmtDate(a.fechaSaldoInicial) : '—'}</td>
                  <td className="px-4 py-3">
                    <span className={klass('text-[10px] font-mono px-2 py-0.5 rounded uppercase', a.activa ? 'bg-[var(--color-state-done-bg)] text-[var(--color-state-done-text)]' : 'bg-[var(--color-border)] text-[var(--color-text-muted)]')}>
                      {a.activa ? 'Activa' : 'Inactiva'}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-right">
                    <div className="inline-flex gap-1">
                      <button title="Editar" onClick={() => setEditing(a)} className="p-1.5 rounded hover:bg-[var(--color-border)] text-[var(--color-text-secondary)]">
                        <Pencil className="w-4 h-4" />
                      </button>
                      <button title={a.activa ? 'Desactivar' : 'Activar'} onClick={() => toggleActive(a)} className="p-1.5 rounded hover:bg-[var(--color-border)] text-[var(--color-text-secondary)]">
                        <Power className="w-4 h-4" />
                      </button>
                      <button title="Eliminar" onClick={() => handleDelete(a)} className="p-1.5 rounded hover:bg-red-500/15 text-red-400">
                        <X className="w-4 h-4" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {creating && (
        <Modal title="Nueva cuenta" onClose={() => setCreating(false)}>
          <AccountForm onSuccess={() => { setCreating(false); invalidateFinanceLiquidity(); }} onCancel={() => setCreating(false)} />
        </Modal>
      )}
      {editing && (
        <Modal title={`Editar "${editing.nombre}"`} onClose={() => setEditing(null)}>
          <AccountForm initial={editing} accountId={editing.id} onSuccess={() => { setEditing(null); invalidateFinanceLiquidity(); }} onCancel={() => setEditing(null)} />
        </Modal>
      )}
    </div>
  );
}

function Modal({ title, onClose, children }: { title: string; onClose: () => void; children: React.ReactNode }) {
  return (
    <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4" onMouseDown={e => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="bg-[var(--color-bg-card)] border border-[var(--color-border)] rounded-xl p-6 w-full max-w-md shadow-2xl">
        <div className="flex items-center justify-between mb-4">
          <p className="text-sm font-semibold text-[var(--color-text-primary)]">{title}</p>
          <button onClick={onClose} className="text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)]"><X className="w-5 h-5" /></button>
        </div>
        {children}
      </div>
    </div>
  );
}

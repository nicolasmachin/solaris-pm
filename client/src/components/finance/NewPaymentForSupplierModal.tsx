import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'react-hot-toast';
import { X } from 'lucide-react';
import { createPayment } from '../../api/payments.api';
import { getAccounts } from '../../api/accounts.api';
import { ACCOUNT_TYPE_LABEL } from '../../types/accounts.types';
import type { MetodoPago, Moneda } from '../../types/finance.types';

function klass(...p: (string | false | undefined)[]) { return p.filter(Boolean).join(' '); }
function getApiErr(err: unknown) {
  return (err as { response?: { data?: { message?: string } } })?.response?.data?.message;
}

interface Props {
  supplierId: string;
  supplierName: string;
  defaultAmount?: number;
  defaultMoneda?: Moneda;
  onClose: () => void;
  /** Se llama con el id del payment recién creado si el usuario eligió "aplicar ahora". */
  onCreatedAndApply: (paymentId: string) => void;
  /** Se llama con el id sin abrir el modal de aplicación. */
  onCreated?: (paymentId: string) => void;
}

export function NewPaymentForSupplierModal({
  supplierId,
  supplierName,
  defaultAmount,
  defaultMoneda,
  onClose,
  onCreatedAndApply,
  onCreated,
}: Props) {
  const qc = useQueryClient();
  const today = new Date().toISOString().slice(0, 10);
  const [form, setForm] = useState({
    fecha: today,
    monto: defaultAmount != null ? defaultAmount.toString() : '',
    moneda: (defaultMoneda ?? 'USD') as Moneda,
    metodo: 'TRANSFERENCIA' as MetodoPago,
    accountId: '',
    referencia: '',
    notas: '',
    aplicarAhora: true,
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const { data: accounts = [] } = useQuery({
    queryKey: ['accounts', 'true'],
    queryFn: () => getAccounts({ activa: 'true' }),
  });
  const accountsForCurrency = accounts.filter(a => a.moneda === form.moneda);

  function setF<K extends keyof typeof form>(k: K, v: typeof form[K]) {
    setForm(p => ({ ...p, [k]: v }));
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    const monto = parseFloat(form.monto);
    if (!isFinite(monto) || Math.abs(monto) < 0.005) { setError('El monto no puede ser 0'); return; }
    if (!form.accountId) { setError('Elegí una cuenta'); return; }
    setSaving(true);
    try {
      const created = await createPayment({
        supplierId,
        accountId: form.accountId,
        fecha: form.fecha,
        monto,
        moneda: form.moneda,
        metodo: form.metodo,
        ...(form.referencia ? { referencia: form.referencia } : {}),
        ...(form.notas ? { notas: form.notas } : {}),
      });
      qc.invalidateQueries({ queryKey: ['payments'] });
      qc.invalidateQueries({ queryKey: ['account-summary'] });
      qc.invalidateQueries({ queryKey: ['suppliers'] });
      if (form.aplicarAhora) {
        toast.success('Pago registrado · aplicalo a facturas');
        onCreatedAndApply(created.id);
      } else {
        toast.success('Pago registrado');
        if (onCreated) onCreated(created.id);
        else onClose();
      }
    } catch (err) {
      setError(getApiErr(err) ?? 'Error al guardar');
    } finally {
      setSaving(false);
    }
  }

  const inpStyle = 'w-full rounded-lg border border-[var(--color-border)] bg-[var(--color-bg-app)] px-3 py-2 text-sm text-[var(--color-text-primary)] focus:outline-none focus:ring-2 focus:ring-[var(--color-accent)]';
  const lblStyle = 'block text-xs font-mono text-[var(--color-text-muted)] mb-1 uppercase tracking-wider';

  return (
    <div className="fixed inset-0 bg-black/60 z-50 flex items-start justify-center p-4 overflow-y-auto" onClick={e => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="bg-[var(--color-bg-card)] border border-[var(--color-border)] rounded-xl p-6 w-full max-w-lg my-8 shadow-2xl">
        <div className="flex items-center justify-between mb-4">
          <p className="text-sm font-semibold text-[var(--color-text-primary)]">Pago a {supplierName}</p>
          <button onClick={onClose} className="text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)]"><X className="w-5 h-5" /></button>
        </div>
        <form onSubmit={submit} className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div><label className={lblStyle}>Fecha *</label><input type="date" className={inpStyle} value={form.fecha} onChange={e => setF('fecha', e.target.value)} required /></div>
            <div>
              <label className={lblStyle}>Monto *</label>
              <div className="flex gap-2">
                <select className="rounded-lg border border-[var(--color-border)] bg-[var(--color-bg-app)] px-2 py-2 text-sm text-[var(--color-text-primary)]" value={form.moneda} onChange={e => setF('moneda', e.target.value as Moneda)}>
                  <option value="USD">USD</option><option value="UYU">UYU</option>
                </select>
                <input type="number" step="0.01" className={klass(inpStyle, 'flex-1')} value={form.monto} onChange={e => setF('monto', e.target.value)} required />
              </div>
            </div>
          </div>
          <div>
            <label className={lblStyle}>Cuenta * <span className="text-[var(--color-text-muted)] normal-case lowercase">— de dónde sale el dinero</span></label>
            <select className={inpStyle} value={form.accountId} onChange={e => setF('accountId', e.target.value)} required>
              <option value="">— Elegí una cuenta —</option>
              {accountsForCurrency.map(a => (
                <option key={a.id} value={a.id}>{a.nombre} ({ACCOUNT_TYPE_LABEL[a.tipo]} · {a.moneda})</option>
              ))}
            </select>
            {accountsForCurrency.length === 0 && (
              <p className="text-[10px] text-[var(--color-warning-text)] mt-1">
                No hay cuentas activas en {form.moneda}. Creá una desde Admin → Cuentas.
              </p>
            )}
          </div>
          <div>
            <label className={lblStyle}>Método</label>
            <select className={inpStyle} value={form.metodo} onChange={e => setF('metodo', e.target.value as MetodoPago)}>
              <option value="TRANSFERENCIA">Transferencia</option>
              <option value="EFECTIVO">Efectivo</option>
              <option value="CHEQUE">Cheque</option>
              <option value="TARJETA_DEBITO">Tarjeta débito</option>
              <option value="TARJETA_CREDITO">Tarjeta crédito</option>
              <option value="OTRO">Otro</option>
            </select>
          </div>
          {parseFloat(form.monto) < 0 && (
            <p className="text-[11px] text-[var(--color-warning-text)] bg-[var(--color-warning-bg)]/30 rounded-lg px-3 py-2">
              ⚠ Monto negativo: equivale a una nota de crédito o devolución del proveedor.
            </p>
          )}
          <div><label className={lblStyle}>Referencia</label><input className={inpStyle} value={form.referencia} onChange={e => setF('referencia', e.target.value)} /></div>
          <div><label className={lblStyle}>Notas</label><textarea className={klass(inpStyle, 'resize-none')} rows={2} value={form.notas} onChange={e => setF('notas', e.target.value)} /></div>
          <label className="flex items-center gap-2 text-sm text-[var(--color-text-secondary)] cursor-pointer">
            <input type="checkbox" checked={form.aplicarAhora} onChange={e => setF('aplicarAhora', e.target.checked)} className="accent-[var(--color-accent)]" />
            Aplicar a facturas ahora
          </label>
          {error && <p className="text-sm text-red-400 bg-red-500/10 rounded-lg px-3 py-2">{error}</p>}
          <div className="flex gap-3">
            <button type="submit" disabled={saving} className="flex-1 py-2 rounded-lg bg-[var(--color-accent)] text-gray-900 text-sm font-semibold hover:bg-[var(--color-accent-hover)] disabled:opacity-60">
              {saving ? 'Guardando…' : 'Registrar pago'}
            </button>
            <button type="button" onClick={onClose} className="px-4 py-2 rounded-lg border border-[var(--color-border)] text-sm text-[var(--color-text-secondary)] hover:bg-[var(--color-bg-card-hover)]">
              Cancelar
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

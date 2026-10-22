import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'react-hot-toast';
import { Sheet } from '../ui/Sheet';
import { createPayment } from '../../api/payments.api';
import { getAccounts } from '../../api/accounts.api';
import { getExchangeRate } from '../../api/finance.api';
import { ACCOUNT_TYPE_LABEL } from '../../types/accounts.types';
import type { MetodoPago, Moneda } from '../../types/finance.types';
import { fmtCurrency } from '../../lib/finance';
import { todayLocalISO } from '../../utils/date';

function klass(...p: (string | false | undefined)[]) { return p.filter(Boolean).join(' '); }
function getApiErr(err: unknown) {
  return (err as { response?: { data?: { message?: string } } })?.response?.data?.message;
}

interface Props {
  supplierId: string;
  supplierName: string;
  defaultAmount?: number;
  defaultMoneda?: Moneda;
  /** Valor inicial del check "aplicar automáticamente". Default true.
   *  Poner false cuando se paga una factura puntual (aplicación dirigida). */
  defaultAutoAplicar?: boolean;
  onClose: () => void;
  /** Se llama con el id del payment recién creado si el usuario eligió aplicación manual. */
  onCreatedAndApply: (paymentId: string) => void;
  /** Se llama con el id sin abrir el modal de aplicación (ej. tras auto-aplicar). */
  onCreated?: (paymentId: string) => void;
}

export function NewPaymentForSupplierModal({
  supplierId,
  supplierName,
  defaultAmount,
  defaultMoneda,
  defaultAutoAplicar = true,
  onClose,
  onCreatedAndApply,
  onCreated,
}: Props) {
  const qc = useQueryClient();
  const today = todayLocalISO();
  const [form, setForm] = useState({
    fecha: today,
    monto: defaultAmount != null ? defaultAmount.toString() : '',
    moneda: (defaultMoneda ?? 'USD') as Moneda,
    metodo: 'TRANSFERENCIA' as MetodoPago,
    accountId: '',
    referencia: '',
    notas: '',
    autoAplicar: defaultAutoAplicar,
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const { data: accounts = [] } = useQuery({
    queryKey: ['accounts', 'true'],
    queryFn: () => getAccounts({ activa: 'true' }),
  });
  const accountsForCurrency = accounts.filter(a => a.moneda === form.moneda);
  // Una deuda en pesos se puede pagar desde una cuenta en dólares y al revés,
  // con la cotización del día (editable): la deuda baja en su moneda y de la
  // cuenta sale el equivalente.
  const otrasCuentas = accounts.filter(a => a.moneda !== form.moneda);
  const cuenta = accounts.find(a => a.id === form.accountId);
  const otraMoneda = !!cuenta && cuenta.moneda !== form.moneda;
  const { data: cotizacion } = useQuery({ queryKey: ['exchange-rate'], queryFn: getExchangeRate, enabled: otraMoneda, retry: false });
  const [tcTxt, setTcTxt] = useState('');
  const tc = parseFloat((tcTxt || (cotizacion ? String(cotizacion.usdToUyu) : '')).replace(',', '.'));
  const montoNum = parseFloat(form.monto);
  const saleDeCuenta = otraMoneda && tc > 0 && isFinite(montoNum)
    ? (cuenta!.moneda === 'UYU' ? montoNum * tc : montoNum / tc)
    : null;

  function setF<K extends keyof typeof form>(k: K, v: typeof form[K]) {
    setForm(p => ({ ...p, [k]: v }));
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    const monto = parseFloat(form.monto);
    if (!isFinite(monto) || Math.abs(monto) < 0.005) { setError('El monto no puede ser 0'); return; }
    if (!form.accountId) { setError('Elegí una cuenta'); return; }
    if (otraMoneda && !(tc > 0)) { setError('Falta la cotización del día'); return; }
    setSaving(true);
    try {
      const created = await createPayment({
        supplierId,
        accountId: form.accountId,
        fecha: form.fecha,
        monto,
        moneda: form.moneda,
        metodo: form.metodo,
        autoAplicar: form.autoAplicar,
        ...(otraMoneda ? { tipoCambio: tc } : {}),
        ...(form.referencia ? { referencia: form.referencia } : {}),
        ...(form.notas ? { notas: form.notas } : {}),
      });
      qc.invalidateQueries({ queryKey: ['payments'] });
      qc.invalidateQueries({ queryKey: ['account-summary'] });
      qc.invalidateQueries({ queryKey: ['accounts-summary'] });
      qc.invalidateQueries({ queryKey: ['finance-movements'] });
      qc.invalidateQueries({ queryKey: ['finance-dashboard'] });
      qc.invalidateQueries({ queryKey: ['suppliers'] });
      if (form.autoAplicar) {
        // El backend ya aplicó FIFO a las facturas más viejas.
        const { facturasAfectadas, totalAplicado, saldoAFavor } = created.aplicacion;
        if (facturasAfectadas > 0) {
          const extra = saldoAFavor > 0.005 ? ` · ${fmtCurrency(saldoAFavor, form.moneda)} a favor` : '';
          toast.success(`Pago aplicado a ${facturasAfectadas} factura(s) (${fmtCurrency(totalAplicado, form.moneda)})${extra}`);
        } else {
          toast.success(`Pago registrado · ${fmtCurrency(saldoAFavor, form.moneda)} a favor del proveedor (sin facturas pendientes)`);
        }
        if (onCreated) onCreated(created.id);
        else onClose();
      } else {
        toast.success('Pago registrado · aplicalo a facturas');
        onCreatedAndApply(created.id);
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
    <Sheet
      open
      onClose={onClose}
      title={`Pago a ${supplierName}`}
      footer={
        <>
          <button type="button" onClick={onClose} className="px-4 py-2 rounded-lg border border-[var(--color-border)] text-sm text-[var(--color-text-secondary)] hover:bg-[var(--color-bg-card-hover)]">
            Cancelar
          </button>
          <button type="submit" form="supplier-payment-form" disabled={saving} className="px-4 py-2 rounded-lg bg-[var(--color-accent)] text-gray-900 text-sm font-semibold hover:bg-[var(--color-accent-hover)] disabled:opacity-60">
            {saving ? 'Guardando…' : 'Registrar pago'}
          </button>
        </>
      }
    >
        <form id="supplier-payment-form" onSubmit={submit} className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div><label className={lblStyle}>Fecha *</label><input type="date" className={inpStyle} value={form.fecha} onChange={e => setF('fecha', e.target.value)} required /></div>
            <div>
              <label className={lblStyle}>Monto (de la deuda) *</label>
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
              {otrasCuentas.length > 0 && (
                <optgroup label={`En otra moneda (se convierte a la cotización)`}>
                  {otrasCuentas.map(a => (
                    <option key={a.id} value={a.id}>{a.nombre} ({ACCOUNT_TYPE_LABEL[a.tipo]} · {a.moneda})</option>
                  ))}
                </optgroup>
              )}
            </select>
            {otraMoneda && (
              <div className="mt-2 grid grid-cols-2 gap-3 rounded-lg border border-[var(--color-border)] p-3">
                <div>
                  <label className={lblStyle}>Cotización (pesos por dólar) *</label>
                  <input
                    className={inpStyle} inputMode="decimal"
                    value={tcTxt || (cotizacion ? String(cotizacion.usdToUyu) : '')}
                    onChange={e => setTcTxt(e.target.value)}
                  />
                  <p className="mt-1 text-[10px] text-[var(--color-text-muted)]">
                    {cotizacion && !tcTxt ? `La del ${cotizacion.date.slice(8, 10)}/${cotizacion.date.slice(5, 7)}. Cambiala si el banco usó otra.` : 'La que usó el banco.'}
                  </p>
                </div>
                <div>
                  <label className={lblStyle}>Sale de la cuenta</label>
                  <p className="py-2 text-sm font-semibold tabular-nums text-[var(--color-text-primary)]">
                    {saleDeCuenta != null ? fmtCurrency(Math.round(saleDeCuenta * 100) / 100, cuenta!.moneda) : '—'}
                  </p>
                  <p className="text-[10px] text-[var(--color-text-muted)]">La deuda baja {form.monto ? fmtCurrency(montoNum || 0, form.moneda) : 'en ' + form.moneda}.</p>
                </div>
              </div>
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
          <label className="flex items-start gap-2 text-sm text-[var(--color-text-secondary)] cursor-pointer">
            <input type="checkbox" checked={form.autoAplicar} onChange={e => setF('autoAplicar', e.target.checked)} className="accent-[var(--color-accent)] mt-0.5" />
            <span>
              Aplicar automáticamente a las facturas más viejas
              <span className="block text-[11px] text-[var(--color-text-muted)]">
                Descuenta el pago del estado de cuenta (facturas más antiguas primero). El sobrante queda a favor del proveedor.
              </span>
            </span>
          </label>
          {error && <p className="text-sm text-red-400 bg-red-500/10 rounded-lg px-3 py-2">{error}</p>}
        </form>
    </Sheet>
  );
}

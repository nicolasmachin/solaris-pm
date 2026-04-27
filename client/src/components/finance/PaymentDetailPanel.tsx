import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'react-hot-toast';
import { X, Trash2, Plus, Pencil } from 'lucide-react';
import { getPayment, deleteApplication, deletePayment, patchPayment } from '../../api/payments.api';
import { fmtCurrency, fmtDate } from '../../lib/finance';
import { ApplyPaymentModal } from './ApplyPaymentModal';
import type { MetodoPago, Moneda } from '../../types/finance.types';

function klass(...p: (string | false | undefined)[]) { return p.filter(Boolean).join(' '); }
function getApiErr(err: unknown) {
  return (err as { response?: { data?: { message?: string } } })?.response?.data?.message;
}

const STATUS_BADGE: Record<string, string> = {
  PREVISTO: 'bg-[var(--color-border)] text-[var(--color-text-muted)]',
  COMPROMETIDO: 'bg-[var(--color-info-bg)] text-[var(--color-info-text)]',
  A_PAGAR: 'bg-[var(--color-warning-bg)] text-[var(--color-warning-text)]',
  PARCIALMENTE_PAGADO: 'bg-amber-500/20 text-amber-300',
  PAGADO: 'bg-[var(--color-state-done-bg)] text-[var(--color-state-done-text)]',
};

const METODO_LABEL: Record<MetodoPago, string> = {
  TRANSFERENCIA: 'Transferencia',
  EFECTIVO: 'Efectivo',
  CHEQUE: 'Cheque',
  TARJETA_DEBITO: 'Tarjeta débito',
  TARJETA_CREDITO: 'Tarjeta crédito',
  CRYPTO: 'Crypto',
  OTRO: 'Otro',
};

export function PaymentDetailPanel({ paymentId, onClose }: { paymentId: string; onClose: () => void }) {
  const qc = useQueryClient();
  const [showApply, setShowApply] = useState(false);
  const [editing, setEditing] = useState(false);

  const { data: payment, isLoading } = useQuery({
    queryKey: ['payment', paymentId],
    queryFn: () => getPayment(paymentId),
  });

  const deleteAppMut = useMutation({
    mutationFn: (applicationId: string) => deleteApplication(paymentId, applicationId),
    onSuccess: () => {
      toast.success('Aplicación quitada');
      qc.invalidateQueries({ queryKey: ['payment', paymentId] });
      qc.invalidateQueries({ queryKey: ['payments'] });
      qc.invalidateQueries({ queryKey: ['finance-movements'] });
      qc.invalidateQueries({ queryKey: ['finance-dashboard'] });
      qc.invalidateQueries({ queryKey: ['account-summary'] });
    },
    onError: (err: unknown) => toast.error(getApiErr(err) ?? 'Error al quitar aplicación'),
  });

  const cancelMut = useMutation({
    mutationFn: () => deletePayment(paymentId),
    onSuccess: (r) => {
      toast.success(r.revertedApplications > 0
        ? `Pago anulado · ${r.revertedApplications} aplicación(es) revertidas`
        : 'Pago anulado');
      qc.invalidateQueries({ queryKey: ['payments'] });
      qc.invalidateQueries({ queryKey: ['finance-movements'] });
      qc.invalidateQueries({ queryKey: ['finance-dashboard'] });
      qc.invalidateQueries({ queryKey: ['account-summary'] });
      onClose();
    },
    onError: (err: unknown) => toast.error(getApiErr(err) ?? 'Error al anular'),
  });

  if (isLoading || !payment) {
    return (
      <div className="fixed inset-0 z-40 flex justify-end" onClick={e => { if (e.target === e.currentTarget) onClose(); }}>
        <div className="w-full max-w-md bg-[var(--color-bg-card)] border-l border-[var(--color-border)] h-full p-6">
          <p className="text-sm text-[var(--color-text-muted)]">Cargando…</p>
        </div>
      </div>
    );
  }

  const aplicado = payment.applications?.reduce((acc, a) => acc + a.montoAplicado, 0) ?? 0;
  const saldoSinAplicar = Math.round((payment.monto - aplicado) * 100) / 100;
  const fullyApplied = saldoSinAplicar < 0.005;

  return (
    <>
      <div className="fixed inset-0 z-40 flex justify-end" onClick={e => { if (e.target === e.currentTarget) onClose(); }}>
        <div className="w-full max-w-md bg-[var(--color-bg-card)] border-l border-[var(--color-border)] h-full overflow-y-auto shadow-2xl">
          <div className="flex items-center justify-between p-5 border-b border-[var(--color-border)]">
            <div>
              <p className="text-sm font-semibold text-[var(--color-text-primary)]">Pago a {payment.supplier?.nombre ?? '—'}</p>
              <p className="text-xs text-[var(--color-text-muted)] mt-0.5">
                {fmtDate(payment.fecha)} · {METODO_LABEL[payment.metodo]}
                {payment.referencia ? ` · ref. ${payment.referencia}` : ''}
              </p>
            </div>
            <button onClick={onClose} className="text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)]"><X className="w-5 h-5" /></button>
          </div>

          {/* Datos principales */}
          <div className="px-5 py-4 border-b border-[var(--color-border)]">
            {editing ? (
              <PaymentEditForm payment={payment} onClose={() => setEditing(false)} />
            ) : (
              <>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <p className="text-[10px] font-mono uppercase tracking-wider text-[var(--color-text-muted)]">Monto</p>
                    <p className="text-base font-semibold tabular-nums text-[var(--color-text-primary)]">{fmtCurrency(payment.monto, payment.moneda)}</p>
                  </div>
                  <div>
                    <p className="text-[10px] font-mono uppercase tracking-wider text-[var(--color-text-muted)]">Aplicado</p>
                    <p className="text-base font-semibold tabular-nums text-[var(--color-text-primary)]">{fmtCurrency(aplicado, payment.moneda)}</p>
                  </div>
                </div>
                <div className="mt-3">
                  <p className="text-[10px] font-mono uppercase tracking-wider text-[var(--color-text-muted)]">Saldo sin aplicar</p>
                  <p className={klass(
                    'text-base font-semibold tabular-nums',
                    fullyApplied ? 'text-[var(--color-state-done-text)]' : 'text-[var(--color-warning-text)]',
                  )}>
                    {fmtCurrency(saldoSinAplicar, payment.moneda)}
                    {!fullyApplied && <span className="ml-2 text-[10px] font-mono px-1.5 py-0.5 rounded bg-[var(--color-warning-bg)] text-[var(--color-warning-text)] uppercase">A favor del proveedor</span>}
                  </p>
                </div>
                {payment.notas && (
                  <p className="mt-3 text-[11px] text-[var(--color-text-muted)] italic">"{payment.notas}"</p>
                )}
                <button
                  onClick={() => setEditing(true)}
                  className="mt-3 inline-flex items-center gap-1 text-xs text-[var(--color-accent)] hover:underline"
                >
                  <Pencil className="w-3 h-3" />
                  Editar datos del pago
                </button>
              </>
            )}
          </div>

          {/* Aplicaciones existentes */}
          <div className="p-5 space-y-3">
            <div className="flex items-center justify-between">
              <p className="text-sm font-semibold text-[var(--color-text-primary)]">
                Aplicaciones ({payment.applications?.length ?? 0})
              </p>
              {!fullyApplied && (
                <button
                  onClick={() => setShowApply(true)}
                  className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-[var(--color-accent)] text-gray-900 text-xs font-semibold hover:bg-[var(--color-accent-hover)]"
                >
                  <Plus className="w-3 h-3" />
                  Aplicar a más facturas
                </button>
              )}
            </div>
            {!payment.applications || payment.applications.length === 0 ? (
              <p className="text-xs text-[var(--color-text-muted)] text-center py-4">Sin aplicaciones</p>
            ) : (
              <div className="space-y-2">
                {payment.applications.map(a => (
                  <div key={a.id} className="rounded-lg border border-[var(--color-border)] p-3 bg-[var(--color-bg-app)]">
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-medium text-[var(--color-text-primary)] truncate">
                          {a.movement?.descripcion ?? '—'}
                        </p>
                        <p className="text-[11px] text-[var(--color-text-muted)]">
                          Factura: {a.movement ? fmtCurrency(a.movement.monto, a.movement.moneda) : '—'}
                          {a.movement?.status && (
                            <span className={klass('ml-2 px-1.5 py-0.5 rounded text-[9px] font-mono uppercase', STATUS_BADGE[a.movement.status] ?? '')}>
                              {a.movement.status === 'PARCIALMENTE_PAGADO' ? 'Parcial' : a.movement.status}
                            </span>
                          )}
                        </p>
                      </div>
                      <button
                        title="Quitar aplicación"
                        onClick={() => { if (confirm('¿Quitar esta aplicación? El saldo del movimiento se recalcula.')) deleteAppMut.mutate(a.id); }}
                        className="p-1 rounded hover:bg-red-500/15 text-red-400 shrink-0"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                    <p className="text-sm font-semibold tabular-nums text-[var(--color-text-primary)] mt-1">
                      Aplicado: {fmtCurrency(a.montoAplicado, payment.moneda)}
                    </p>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="p-5 border-t border-[var(--color-border)]">
            <button
              onClick={() => {
                if (confirm('¿Anular este pago? Si tiene aplicaciones, los saldos de las facturas se recalculan.')) {
                  cancelMut.mutate();
                }
              }}
              className="w-full py-2 rounded-lg border border-red-500/40 text-red-400 text-sm font-semibold hover:bg-red-500/15"
            >
              Anular pago
            </button>
          </div>
        </div>
      </div>

      {showApply && (
        <ApplyPaymentModal
          paymentId={paymentId}
          onClose={() => setShowApply(false)}
        />
      )}
    </>
  );
}

// ─── Form de edición ─────────────────────────────────────────────────────────

function PaymentEditForm({ payment, onClose }: {
  payment: { id: string; fecha: string; monto: number; moneda: Moneda; metodo: MetodoPago; referencia: string | null; notas: string | null };
  onClose: () => void;
}) {
  const qc = useQueryClient();
  const [form, setForm] = useState({
    fecha: payment.fecha,
    monto: payment.monto.toString(),
    moneda: payment.moneda,
    metodo: payment.metodo,
    referencia: payment.referencia ?? '',
    notas: payment.notas ?? '',
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  function setF<K extends keyof typeof form>(k: K, v: typeof form[K]) {
    setForm(p => ({ ...p, [k]: v }));
  }

  async function save() {
    setError('');
    setSaving(true);
    try {
      await patchPayment(payment.id, {
        fecha: form.fecha,
        monto: parseFloat(form.monto),
        moneda: form.moneda,
        metodo: form.metodo,
        referencia: form.referencia || null,
        notas: form.notas || null,
      });
      toast.success('Pago actualizado');
      qc.invalidateQueries({ queryKey: ['payment', payment.id] });
      qc.invalidateQueries({ queryKey: ['payments'] });
      onClose();
    } catch (err) {
      setError(getApiErr(err) ?? 'Error al guardar');
    } finally {
      setSaving(false);
    }
  }

  const inp = 'w-full rounded-lg border border-[var(--color-border)] bg-[var(--color-bg-app)] px-3 py-2 text-sm text-[var(--color-text-primary)] focus:outline-none focus:ring-2 focus:ring-[var(--color-accent)]';
  const lbl = 'block text-xs font-mono text-[var(--color-text-muted)] mb-1 uppercase tracking-wider';

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className={lbl}>Fecha</label>
          <input type="date" className={inp} value={form.fecha} onChange={e => setF('fecha', e.target.value)} />
        </div>
        <div>
          <label className={lbl}>Monto</label>
          <div className="flex gap-2">
            <select className="rounded-lg border border-[var(--color-border)] bg-[var(--color-bg-app)] px-2 py-2 text-sm text-[var(--color-text-primary)]" value={form.moneda} onChange={e => setF('moneda', e.target.value as Moneda)}>
              <option value="USD">USD</option><option value="UYU">UYU</option>
            </select>
            <input type="number" min="0" step="0.01" className={klass(inp, 'flex-1')} value={form.monto} onChange={e => setF('monto', e.target.value)} />
          </div>
        </div>
      </div>
      <div>
        <label className={lbl}>Método</label>
        <select className={inp} value={form.metodo} onChange={e => setF('metodo', e.target.value as MetodoPago)}>
          <option value="TRANSFERENCIA">Transferencia</option>
          <option value="EFECTIVO">Efectivo</option>
          <option value="CHEQUE">Cheque</option>
          <option value="TARJETA_DEBITO">Tarjeta débito</option>
          <option value="TARJETA_CREDITO">Tarjeta crédito</option>
          <option value="OTRO">Otro</option>
        </select>
      </div>
      <div><label className={lbl}>Referencia</label><input className={inp} value={form.referencia} onChange={e => setF('referencia', e.target.value)} /></div>
      <div><label className={lbl}>Notas</label><textarea className={klass(inp, 'resize-none')} rows={2} value={form.notas} onChange={e => setF('notas', e.target.value)} /></div>
      {error && <p className="text-sm text-red-400 bg-red-500/10 rounded-lg px-3 py-2">{error}</p>}
      <div className="flex gap-2">
        <button onClick={save} disabled={saving} className="flex-1 py-2 rounded-lg bg-[var(--color-accent)] text-gray-900 text-sm font-semibold hover:bg-[var(--color-accent-hover)] disabled:opacity-60">
          {saving ? 'Guardando…' : 'Guardar'}
        </button>
        <button onClick={onClose} className="px-4 py-2 rounded-lg border border-[var(--color-border)] text-sm text-[var(--color-text-secondary)] hover:bg-[var(--color-bg-card-hover)]">
          Cancelar
        </button>
      </div>
    </div>
  );
}

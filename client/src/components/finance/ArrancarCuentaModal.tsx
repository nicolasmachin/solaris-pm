import { useEffect, useMemo, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'react-hot-toast';
import { Sheet } from '../ui/Sheet';
import { arrancarCuentaProveedor, getDeudasAbiertas } from '../../api/payments.api';
import type { Moneda } from '../../types/finance.types';
import { fmtCurrency, fmtDate } from '../../lib/finance';
import { todayLocalISO } from '../../utils/date';

// "Arrancar cuenta": deja lo que se le debe a un proveedor igual a lo que dice su
// estado de cuenta. Se marcan las deudas que siguen vigentes; las otras se cierran
// con un ajuste (no es plata). Si el proveedor dice que se le debe más, la
// diferencia entra como "Saldo anterior"; si dice menos, se baja con un ajuste.
// Los movimientos de caja no se tocan.

const inp = 'w-full rounded-lg border border-[var(--color-border)] bg-[var(--color-bg-app)] px-3 py-2 text-sm text-[var(--color-text-primary)] focus:outline-none focus:ring-2 focus:ring-[var(--color-accent)]';
const lbl = 'block text-xs font-mono text-[var(--color-text-muted)] mb-1 uppercase tracking-wider';

// Las deudas cargadas antes de esta fecha y que no vienen de una factura
// recibida por Biller se proponen cerrar: son de antes de ordenar la cuenta.
const DESDE_BILLER = '2026-10-01';

function apiErr(e: unknown) {
  return (e as { response?: { data?: { message?: string } } })?.response?.data?.message;
}

interface Props {
  supplierId: string;
  supplierName: string;
  defaultMoneda?: Moneda;
  /** Saldo leído del estado de cuenta (desde la conciliación). */
  defaultSaldo?: number;
  defaultFecha?: string;
  onClose: () => void;
}

export function ArrancarCuentaModal({ supplierId, supplierName, defaultMoneda = 'USD', defaultSaldo, defaultFecha, onClose }: Props) {
  const qc = useQueryClient();
  const [moneda, setMoneda] = useState<Moneda>(defaultMoneda);
  const [fecha, setFecha] = useState(defaultFecha ?? todayLocalISO());
  const [saldoTxt, setSaldoTxt] = useState(defaultSaldo != null ? String(defaultSaldo) : '');
  const [nota, setNota] = useState('');
  const [vigentes, setVigentes] = useState<Set<string>>(new Set());
  const [saving, setSaving] = useState(false);

  const { data, isLoading } = useQuery({
    queryKey: ['deudas-abiertas', supplierId, moneda],
    queryFn: () => getDeudasAbiertas(supplierId, moneda),
  });
  const deudas = useMemo(() => data?.deudas ?? [], [data]);

  useEffect(() => {
    setVigentes(new Set(deudas.filter((d) => d.deFacturaRecibida || (d.fecha ?? '') >= DESDE_BILLER).map((d) => d.id)));
  }, [deudas]);

  const saldo = Number(saldoTxt.replace(/\./g, '').replace(',', '.'));
  const saldoValido = saldoTxt.trim() !== '' && Number.isFinite(saldo);
  const aCerrar = deudas.filter((d) => !vigentes.has(d.id));
  const totalCerrar = aCerrar.reduce((a, d) => a + d.saldo, 0);
  const deudaVigente = deudas.filter((d) => vigentes.has(d.id)).reduce((a, d) => a + d.saldo, 0);
  const diferencia = Math.round(((saldoValido ? saldo : 0) - deudaVigente) * 100) / 100;

  async function confirmar() {
    if (!saldoValido) { toast.error('Escribí el saldo que dice el estado de cuenta'); return; }
    setSaving(true);
    try {
      await arrancarCuentaProveedor(supplierId, { moneda, fecha, saldoEstadoCuenta: saldo, cerrar: aCerrar.map((d) => d.id), ...(nota.trim() ? { nota: nota.trim() } : {}) });
      toast.success(`Cuenta con ${supplierName} ordenada: se le debe ${fmtCurrency(saldo, moneda)}`);
      for (const k of ['account-summary', 'deudas-abiertas', 'suppliers', 'cuentas-por-pagar', 'payments', 'finance-pending', 'finance-cashflow', 'posicion']) {
        qc.invalidateQueries({ queryKey: [k] });
      }
      onClose();
    } catch (e) {
      toast.error(apiErr(e) ?? 'No se pudo arrancar la cuenta');
    } finally {
      setSaving(false);
    }
  }

  return (
    <Sheet
      open
      onClose={onClose}
      title={`Arrancar cuenta con ${supplierName}`}
      size="wide"
      footer={
        <>
          <button type="button" onClick={onClose} className="px-4 py-2 rounded-lg border border-[var(--color-border)] text-sm text-[var(--color-text-secondary)] hover:bg-[var(--color-bg-card-hover)]">Cancelar</button>
          <button type="button" onClick={confirmar} disabled={saving || !saldoValido} className="px-4 py-2 rounded-lg bg-[var(--color-accent)] text-gray-900 text-sm font-semibold hover:bg-[var(--color-accent-hover)] disabled:opacity-60">
            {saving ? 'Guardando…' : 'Confirmar'}
          </button>
        </>
      }
    >
      <div className="space-y-4">
        <p className="text-[12px] text-[var(--color-text-secondary)]">
          Deja lo que se le debe a este proveedor igual a lo que dice su estado de cuenta. Los pagos y
          gastos ya cargados no se tocan: lo que se cierra se cierra con un <b>ajuste</b>, que no es plata.
        </p>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <div>
            <label className={lbl}>Moneda</label>
            <select className={inp} value={moneda} onChange={(e) => setMoneda(e.target.value as Moneda)}>
              <option value="USD">Dólares</option>
              <option value="UYU">Pesos</option>
            </select>
          </div>
          <div>
            <label className={lbl}>Fecha del estado de cuenta</label>
            <input type="date" className={inp} value={fecha} onChange={(e) => setFecha(e.target.value)} />
          </div>
          <div>
            <label className={lbl}>Saldo que dice</label>
            <input className={inp} inputMode="decimal" value={saldoTxt} onChange={(e) => setSaldoTxt(e.target.value)} placeholder="0,00" />
          </div>
        </div>

        <div>
          <p className={lbl}>Deudas abiertas en Voltia PM — tildá las que siguen vigentes</p>
          {isLoading ? (
            <p className="text-sm text-[var(--color-text-muted)]">Cargando…</p>
          ) : deudas.length === 0 ? (
            <p className="text-sm text-[var(--color-text-muted)]">No hay deudas abiertas en {moneda === 'USD' ? 'dólares' : 'pesos'}.</p>
          ) : (
            <div className="rounded-lg border border-[var(--color-border)] divide-y divide-[var(--color-border)]">
              {deudas.map((d) => (
                <label key={d.id} className="flex items-center gap-3 px-3 py-2 text-sm cursor-pointer hover:bg-[var(--color-bg-card-hover)]">
                  <input
                    type="checkbox"
                    className="accent-[var(--color-accent)]"
                    checked={vigentes.has(d.id)}
                    onChange={(e) => setVigentes((prev) => {
                      const n = new Set(prev);
                      if (e.target.checked) n.add(d.id); else n.delete(d.id);
                      return n;
                    })}
                  />
                  <span className="w-20 shrink-0 text-[12px] text-[var(--color-text-muted)]">{d.fecha ? fmtDate(d.fecha) : '—'}</span>
                  <span className="flex-1 text-[var(--color-text-primary)]">
                    {d.descripcion}
                    {d.deFacturaRecibida && <span className="ml-2 text-[10px] text-sky-300">factura electrónica</span>}
                  </span>
                  <span className="tabular-nums text-[var(--color-text-secondary)]">{fmtCurrency(d.saldo, moneda)}</span>
                </label>
              ))}
            </div>
          )}
        </div>

        <div className="rounded-lg bg-[var(--color-bg-app)] border border-[var(--color-border)] px-3 py-2 text-sm space-y-1">
          <p>Deuda vigente en Voltia PM: <b className="tabular-nums">{fmtCurrency(deudaVigente, moneda)}</b></p>
          {aCerrar.length > 0 && (
            <p className="text-[var(--color-text-secondary)]">
              Se cierran {aCerrar.length} deuda{aCerrar.length > 1 ? 's' : ''} por <b className="tabular-nums">{fmtCurrency(totalCerrar, moneda)}</b> con un ajuste.
            </p>
          )}
          {saldoValido && (
            Math.abs(diferencia) < 0.005 ? (
              <p className="text-emerald-300">Coincide con el estado de cuenta.</p>
            ) : diferencia > 0 ? (
              <p className="text-amber-300">El proveedor dice que se le debe {fmtCurrency(diferencia, moneda)} más: entra como <b>Saldo anterior</b>.</p>
            ) : (
              <p className="text-amber-300">El proveedor dice que se le debe {fmtCurrency(-diferencia, moneda)} menos: se baja con un ajuste.</p>
            )
          )}
        </div>

        <div>
          <label className={lbl}>Nota (opcional)</label>
          <input className={inp} value={nota} onChange={(e) => setNota(e.target.value)} placeholder="Ej.: incluye la cuenta de la unipersonal" />
        </div>
      </div>
    </Sheet>
  );
}

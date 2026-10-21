import { useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { toast } from 'react-hot-toast';
import { Sheet } from '../ui/Sheet';
import { crearAjusteProveedor } from '../../api/payments.api';
import type { Moneda } from '../../types/finance.types';
import { fmtCurrency } from '../../lib/finance';
import { todayLocalISO } from '../../utils/date';

// Ajuste suelto: baja lo que se le debe a un proveedor sin que sea plata (una
// diferencia con su estado de cuenta que no tiene explicación, una factura que
// no correspondía). Se reparte de la deuda más vieja a la más nueva. Antes de
// usarlo, conviene corregir la causa (cargar la factura que falta, vincular un
// pago): el ajuste es para lo que queda sin explicar.

const inp = 'w-full rounded-lg border border-[var(--color-border)] bg-[var(--color-bg-app)] px-3 py-2 text-sm text-[var(--color-text-primary)] focus:outline-none focus:ring-2 focus:ring-[var(--color-accent)]';
const lbl = 'block text-xs font-mono text-[var(--color-text-muted)] mb-1 uppercase tracking-wider';

interface Props {
  supplierId: string;
  supplierName: string;
  defaultMoneda?: Moneda;
  defaultMonto?: number;
  defaultMotivo?: string;
  onClose: () => void;
}

export function AjusteProveedorModal({ supplierId, supplierName, defaultMoneda = 'USD', defaultMonto, defaultMotivo, onClose }: Props) {
  const qc = useQueryClient();
  const [moneda, setMoneda] = useState<Moneda>(defaultMoneda);
  const [montoTxt, setMontoTxt] = useState(defaultMonto ? String(defaultMonto) : '');
  const [fecha, setFecha] = useState(todayLocalISO());
  const [motivo, setMotivo] = useState(defaultMotivo ?? '');
  const [saving, setSaving] = useState(false);

  const monto = Number(montoTxt.replace(/\./g, '').replace(',', '.'));
  const valido = monto > 0 && motivo.trim().length >= 5;

  async function guardar() {
    setSaving(true);
    try {
      const r = await crearAjusteProveedor(supplierId, { moneda, monto, fecha, motivo: motivo.trim() });
      toast.success(`Ajuste de ${fmtCurrency(r.total, moneda)} registrado`);
      for (const k of ['account-summary', 'deudas-abiertas', 'suppliers', 'cuentas-por-pagar', 'payments', 'finance-pending', 'finance-cashflow', 'posicion']) {
        qc.invalidateQueries({ queryKey: [k] });
      }
      onClose();
    } catch (e) {
      toast.error((e as { response?: { data?: { message?: string } } })?.response?.data?.message ?? 'No se pudo registrar el ajuste');
    } finally {
      setSaving(false);
    }
  }

  return (
    <Sheet
      open
      onClose={onClose}
      title={`Ajustar deuda con ${supplierName}`}
      footer={
        <>
          <button type="button" onClick={onClose} className="px-4 py-2 rounded-lg border border-[var(--color-border)] text-sm text-[var(--color-text-secondary)] hover:bg-[var(--color-bg-card-hover)]">Cancelar</button>
          <button type="button" onClick={guardar} disabled={saving || !valido} className="px-4 py-2 rounded-lg bg-[var(--color-accent)] text-gray-900 text-sm font-semibold hover:bg-[var(--color-accent-hover)] disabled:opacity-60">
            {saving ? 'Guardando…' : 'Registrar ajuste'}
          </button>
        </>
      }
    >
      <div className="space-y-4">
        <p className="text-[12px] text-[var(--color-text-secondary)]">
          Baja lo que se le debe sin que sea plata: no sale de ninguna cuenta ni cuenta como gasto. Se
          descuenta de la deuda más vieja a la más nueva. Primero conviene corregir la causa; el ajuste es
          para la diferencia que no se puede explicar.
        </p>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className={lbl}>Monto</label>
            <div className="flex gap-2">
              <select className="rounded-lg border border-[var(--color-border)] bg-[var(--color-bg-app)] px-2 py-2 text-sm text-[var(--color-text-primary)]" value={moneda} onChange={(e) => setMoneda(e.target.value as Moneda)}>
                <option value="USD">USD</option>
                <option value="UYU">UYU</option>
              </select>
              <input className={inp} inputMode="decimal" value={montoTxt} onChange={(e) => setMontoTxt(e.target.value)} />
            </div>
          </div>
          <div>
            <label className={lbl}>Fecha</label>
            <input type="date" className={inp} value={fecha} onChange={(e) => setFecha(e.target.value)} />
          </div>
        </div>
        <div>
          <label className={lbl}>Motivo (queda registrado)</label>
          <input className={inp} value={motivo} onChange={(e) => setMotivo(e.target.value)} placeholder="Ej.: diferencia con el estado de cuenta al 31/10 sin explicar" />
        </div>
      </div>
    </Sheet>
  );
}

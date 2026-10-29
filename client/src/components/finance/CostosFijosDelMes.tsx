import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'react-hot-toast';

import { getAccounts } from '../../api/accounts.api';
import { createMovement } from '../../api/finance.api';
import { listPendingFixedCosts, type FixedCostPendingDto } from '../../api/fixedCosts.api';
import { fmtCurrency } from '../../lib/finance';
import { todayLocalISO } from '../../utils/date';
import { Sheet } from '../ui/Sheet';

// Lo que falta pagar de los costos fijos en un mes. Cada uno se paga desde acá
// (cuenta, fecha y monto) y sale de la lista: un costo fijo cuenta como pagado
// en el mes cuando tiene un gasto PAGADO de ese mes vinculado.

const MESES = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];
const inp = 'w-full rounded-lg border border-[var(--color-border)] bg-[var(--color-bg-app)] px-3 py-2 text-sm text-[var(--color-text-primary)] focus:outline-none focus:ring-2 focus:ring-[var(--color-accent)]';
const lbl = 'block text-[10px] font-mono uppercase tracking-wider text-[var(--color-text-muted)] mb-1';

export function CostosFijosDelMes() {
  const hoy = new Date();
  const [mes, setMes] = useState(hoy.getMonth() + 1);
  const [anio, setAnio] = useState(hoy.getFullYear());
  const [pagando, setPagando] = useState<FixedCostPendingDto | null>(null);

  const { data: pendientes = [], isLoading } = useQuery({
    queryKey: ['fixed-costs-pending', mes, anio],
    queryFn: () => listPendingFixedCosts(mes, anio),
  });

  const correr = (delta: number) => {
    const d = new Date(anio, mes - 1 + delta, 1);
    setMes(d.getMonth() + 1);
    setAnio(d.getFullYear());
  };
  const vencido = (fc: FixedCostPendingDto) => {
    const vence = new Date(anio, mes - 1, Math.min(fc.diaDelMes, 28));
    return vence < new Date(hoy.getFullYear(), hoy.getMonth(), hoy.getDate());
  };
  const totales = pendientes.reduce<Record<string, number>>((a, fc) => ({ ...a, [fc.moneda]: (a[fc.moneda] ?? 0) + fc.ultimoMontoPagado }), {});

  return (
    <section className="mb-6 space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-base font-semibold text-[var(--color-text-primary)]">Falta pagar en {MESES[mes - 1]} {anio}</h2>
          <p className="text-xs text-[var(--color-text-muted)]">
            Cada costo fijo sale de la lista cuando se paga. El monto propuesto es el último que se pagó.
          </p>
        </div>
        <div className="flex items-center gap-1 text-sm">
          <button className="rounded-lg border border-[var(--color-border)] px-2 py-1" onClick={() => correr(-1)} aria-label="Mes anterior">‹</button>
          <span className="w-32 text-center capitalize text-[var(--color-text-secondary)]">{MESES[mes - 1]} {anio}</span>
          <button className="rounded-lg border border-[var(--color-border)] px-2 py-1" onClick={() => correr(1)} aria-label="Mes siguiente">›</button>
        </div>
      </div>

      {isLoading ? (
        <p className="text-sm text-[var(--color-text-muted)]">Cargando…</p>
      ) : pendientes.length === 0 ? (
        <p className="rounded-xl border border-emerald-500/30 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-300">
          Todo pagado en {MESES[mes - 1]}.
        </p>
      ) : (
        <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-bg-card)] divide-y divide-[var(--color-border)]">
          {pendientes.map((fc) => (
            <div key={fc.id} className="flex flex-wrap items-center gap-3 px-4 py-2.5 text-sm">
              <span className="flex-1 min-w-[160px] text-[var(--color-text-primary)]">{fc.nombre}</span>
              <span className={`w-28 text-[12px] ${vencido(fc) ? 'text-red-400' : 'text-[var(--color-text-muted)]'}`}>
                {vencido(fc) ? 'Venció el ' : 'Vence el '}{Math.min(fc.diaDelMes, 31)}/{mes}
              </span>
              <span className="w-32 text-right tabular-nums text-[var(--color-text-secondary)]">{fmtCurrency(fc.ultimoMontoPagado, fc.moneda)}</span>
              <button
                onClick={() => setPagando(fc)}
                className="rounded-lg bg-[var(--color-accent)] px-3 py-1 text-xs font-semibold text-gray-900 hover:bg-[var(--color-accent-hover)]"
              >
                Pagar
              </button>
            </div>
          ))}
          <div className="flex justify-end gap-4 px-4 py-2 text-xs text-[var(--color-text-muted)]">
            Total: {Object.entries(totales).map(([m, v]) => fmtCurrency(v, m as 'USD' | 'UYU')).join(' + ')}
          </div>
        </div>
      )}

      {pagando && <PagarCostoFijoModal fc={pagando} mes={mes} anio={anio} onClose={() => setPagando(null)} />}
    </section>
  );
}

function PagarCostoFijoModal({ fc, mes, anio, onClose }: { fc: FixedCostPendingDto; mes: number; anio: number; onClose: () => void }) {
  const qc = useQueryClient();
  const { data: cuentas = [] } = useQuery({ queryKey: ['accounts', 'true'], queryFn: () => getAccounts({ activa: 'true' }) });
  const [accountId, setAccountId] = useState('');
  // Si se paga un mes que no es el actual, se propone una fecha dentro de ese mes.
  const hoyIso = todayLocalISO();
  const delMes = `${anio}-${String(mes).padStart(2, '0')}`;
  const [fecha, setFecha] = useState(hoyIso.startsWith(delMes) ? hoyIso : `${delMes}-${String(Math.min(fc.diaDelMes, 28)).padStart(2, '0')}`);
  const [monto, setMonto] = useState(String(fc.ultimoMontoPagado));
  const cuenta = cuentas.find((c) => c.id === accountId);
  const deLaMoneda = cuentas.filter((c) => c.moneda === fc.moneda);

  const pagar = useMutation({
    mutationFn: () => createMovement({
      fecha,
      tipoMovimiento: 'GASTO',
      categoriaPrincipal: 'FIJO',
      descripcion: `${fc.nombre} — ${MESES[mes - 1]} ${anio}`,
      monto: Number(monto.replace(',', '.')),
      moneda: cuenta?.moneda ?? fc.moneda,
      accountId,
      status: 'PAGADO',
      pagado: true,
      cobrado: false,
      impactaFlujo: true,
      estadoAprobacion: 'APROBADO',
      fixedCostId: fc.id,
      periodoMes: mes,
      periodoAnio: anio,
    }),
    onSuccess: () => {
      toast.success(`${fc.nombre} pagado`);
      for (const k of ['fixed-costs-pending', 'finance-movements-tab', 'finance-movements', 'finance-pending', 'finance-cashflow', 'accounts-summary', 'banco-pendientes', 'por-conciliar', 'para-hacer-hoy', 'para-hacer-hoy-total']) {
        qc.invalidateQueries({ queryKey: [k] });
      }
      onClose();
    },
    onError: (e: unknown) => toast.error((e as { response?: { data?: { message?: string } } })?.response?.data?.message ?? 'No se pudo registrar el pago'),
  });

  return (
    <Sheet
      open
      onClose={onClose}
      title={`Pagar ${fc.nombre}`}
      footer={(
        <>
          <button type="button" onClick={onClose} className="px-4 py-2 rounded-lg border border-[var(--color-border)] text-sm text-[var(--color-text-secondary)]">Cancelar</button>
          <button
            type="button"
            disabled={pagar.isPending || !accountId || !(Number(monto.replace(',', '.')) > 0)}
            onClick={() => pagar.mutate()}
            className="px-4 py-2 rounded-lg bg-[var(--color-accent)] text-gray-900 text-sm font-semibold disabled:opacity-60"
          >
            {pagar.isPending ? 'Guardando…' : 'Registrar el pago'}
          </button>
        </>
      )}
    >
      <div className="space-y-3">
        <p className="text-sm text-[var(--color-text-secondary)]">Pago de {MESES[mes - 1]} {anio}. Sale de la lista de lo que falta pagar.</p>
        <div>
          <label className={lbl}>Cuenta de donde sale *</label>
          <select className={inp} value={accountId} onChange={(e) => setAccountId(e.target.value)}>
            <option value="">— Elegí —</option>
            {deLaMoneda.map((c) => <option key={c.id} value={c.id}>{c.nombre}</option>)}
            {cuentas.filter((c) => c.moneda !== fc.moneda).length > 0 && (
              <optgroup label="En otra moneda (cargá el monto en esa moneda)">
                {cuentas.filter((c) => c.moneda !== fc.moneda).map((c) => <option key={c.id} value={c.id}>{c.nombre} ({c.moneda})</option>)}
              </optgroup>
            )}
          </select>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className={lbl}>Fecha del pago *</label>
            <input type="date" className={inp} value={fecha} onChange={(e) => setFecha(e.target.value)} />
          </div>
          <div>
            <label className={lbl}>Monto ({cuenta?.moneda ?? fc.moneda}) *</label>
            <input className={inp} inputMode="decimal" value={monto} onChange={(e) => setMonto(e.target.value)} />
          </div>
        </div>
      </div>
    </Sheet>
  );
}

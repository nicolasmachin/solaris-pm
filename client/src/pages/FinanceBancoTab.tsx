import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'react-hot-toast';

import { Spinner } from '../components/ui/Spinner';
import {
  deshacerNoVaBanco, desvincularBanco, getPendientesBanco, getRegistroBanco, marcarNoVaBanco, vincularBanco,
  type EstadoBanco, type MovimientoBancoRegistro,
} from '../api/bancoConciliacion.api';
import { usePermission } from '../hooks/usePermission';
import { fmtCurrency, fmtDate } from '../lib/finance';
import { todayLocalISO } from '../utils/date';

// Banco: todo lo que leyó el lector del banco, con su estado y su pareja en
// Voltia PM. Es la otra punta de la conciliación: cada movimiento del banco
// tiene que tener su movimiento en Voltia PM.
//  - Confirmada: una persona fijó la pareja; ya no se mueve.
//  - Coincide: Voltia PM propone una pareja (monto y fecha parecidos). Se confirma con un clic.
//  - Falta cargar: no hay nada en Voltia PM. "Cargar" abre el formulario completado.
//  - No va: se decidió no cargarlo (con motivo).

const ESTADO: Record<EstadoBanco, { label: string; cls: string }> = {
  CONFIRMADA: { label: 'Confirmada', cls: 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30' },
  COINCIDE: { label: 'Coincide', cls: 'bg-sky-500/15 text-sky-300 border-sky-500/30' },
  FALTA_CARGAR: { label: 'Falta cargar', cls: 'bg-amber-500/15 text-amber-300 border-amber-500/30' },
  NO_VA: { label: 'No va', cls: 'bg-[var(--color-border)] text-[var(--color-text-muted)] border-[var(--color-border)]' },
  NO_SE_COMPARA: { label: 'Antes de comparar', cls: 'bg-[var(--color-border)] text-[var(--color-text-muted)] border-[var(--color-border)]' },
};

function apiErr(e: unknown) {
  return (e as { response?: { data?: { message?: string } } })?.response?.data?.message;
}

const sel = 'rounded-lg border border-[var(--color-border)] bg-[var(--color-bg-card)] px-2 py-1.5 text-sm text-[var(--color-text-primary)]';
const btn = 'text-[11px] px-2 py-1 rounded-md border border-[var(--color-border)] text-[var(--color-text-secondary)] hover:bg-[var(--color-bg-card-hover)] disabled:opacity-50';

export function FinanceBancoTab() {
  const qc = useQueryClient();
  const navigate = useNavigate();
  const canEdit = usePermission('FINANZAS', 'EDIT');
  const hoy = todayLocalISO();
  const [accountId, setAccountId] = useState('');
  const [desde, setDesde] = useState(`${hoy.slice(0, 8)}01`);
  const [hasta, setHasta] = useState(hoy);
  const [estado, setEstado] = useState<EstadoBanco | ''>('');

  const { data: cuentas = [] } = useQuery({ queryKey: ['banco-pendientes'], queryFn: getPendientesBanco });
  const { data: movimientos = [], isLoading } = useQuery({
    queryKey: ['banco-registro', accountId, desde, hasta],
    queryFn: () => getRegistroBanco({ ...(accountId ? { accountId } : {}), desde, hasta }),
  });

  const invalidar = () => {
    qc.invalidateQueries({ queryKey: ['banco-registro'] });
    qc.invalidateQueries({ queryKey: ['banco-pendientes'] });
  };
  const accion = useMutation({
    mutationFn: async (a: { tipo: 'confirmar' | 'soltar' | 'noVa' | 'deshacer'; m: MovimientoBancoRegistro; motivo?: string }) => {
      if (a.tipo === 'confirmar' && a.m.pareja) {
        return vincularBanco(a.m.id, a.m.pareja.tipo === 'PAGO' ? { paymentId: a.m.pareja.id } : { movementId: a.m.pareja.id });
      }
      if (a.tipo === 'soltar') return desvincularBanco(a.m.id);
      if (a.tipo === 'noVa') return marcarNoVaBanco(a.m.id, a.motivo!);
      return deshacerNoVaBanco(a.m.id);
    },
    onSuccess: () => invalidar(),
    onError: (e) => toast.error(apiErr(e) ?? 'No se pudo'),
  });

  const filtrados = useMemo(() => (estado ? movimientos.filter((m) => m.estado === estado) : movimientos), [movimientos, estado]);
  const conteo = useMemo(() => {
    const c: Partial<Record<EstadoBanco, number>> = {};
    for (const m of movimientos) c[m.estado] = (c[m.estado] ?? 0) + 1;
    return c;
  }, [movimientos]);

  function cargar(m: MovimientoBancoRegistro) {
    const q = new URLSearchParams({
      new: '1', tipo: m.tipo, accountId: m.accountId, fecha: m.fecha,
      descripcion: m.descripcion, monto: String(m.monto), moneda: m.moneda,
    });
    navigate(`/finanzas/movimientos?${q.toString()}`);
  }

  return (
    <div className="space-y-5">
      <p className="text-sm text-[var(--color-text-secondary)]">
        Todo lo que leyó el lector del banco, con su pareja en Voltia PM. Cada movimiento del banco tiene que
        tener su movimiento cargado: lo que coincide se confirma con un clic, lo que falta se carga desde acá.
      </p>

      {cuentas.length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-3">
          {cuentas.map((c) => (
            <div key={c.accountId} className="rounded-xl border border-[var(--color-border)] bg-[var(--color-bg-card)] p-4">
              <p className="text-[11px] font-mono uppercase tracking-wider text-[var(--color-text-muted)]">{c.nombre}</p>
              <p className="mt-1 text-lg font-semibold tabular-nums">{c.bancoSaldo != null ? fmtCurrency(c.bancoSaldo, c.moneda) : '—'}</p>
              <p className="text-[11px] text-[var(--color-text-muted)]">
                Saldo en el banco · {c.bancoLeidoEn ? `leído ${new Date(c.bancoLeidoEn).toLocaleString('es-UY')}` : 'todavía no se leyó'}
              </p>
              <p className="mt-1 text-[11px] text-[var(--color-text-secondary)]">
                {c.conciliados} con pareja · <span className={c.pendientes.length ? 'text-amber-300' : ''}>{c.pendientes.length} falta cargar</span>
              </p>
            </div>
          ))}
        </div>
      )}
      {cuentas.length === 0 && (
        <p className="rounded-lg border border-[var(--color-border)] px-3 py-2 text-sm text-[var(--color-text-muted)]">
          Ninguna cuenta tiene cargado su número de banco. Se carga en Administración → Cuentas, y es como el
          lector sabe de qué cuenta es cada movimiento.
        </p>
      )}

      <div className="flex flex-wrap items-center gap-2">
        <select className={sel} value={accountId} onChange={(e) => setAccountId(e.target.value)}>
          <option value="">Todas las cuentas</option>
          {cuentas.map((c) => <option key={c.accountId} value={c.accountId}>{c.nombre}</option>)}
        </select>
        <input type="date" className={sel} value={desde} onChange={(e) => setDesde(e.target.value)} />
        <input type="date" className={sel} value={hasta} onChange={(e) => setHasta(e.target.value)} />
        <div className="flex rounded-lg border border-[var(--color-border)] overflow-hidden text-xs">
          {(['', 'FALTA_CARGAR', 'COINCIDE', 'CONFIRMADA', 'NO_VA'] as const).map((e) => (
            <button key={e || 'todos'} onClick={() => setEstado(e)}
              className={`px-2.5 py-1.5 ${estado === e ? 'bg-[var(--color-accent)] text-gray-900 font-semibold' : 'bg-[var(--color-bg-card)] text-[var(--color-text-secondary)] hover:bg-[var(--color-bg-card-hover)]'}`}>
              {e ? `${ESTADO[e].label} (${conteo[e] ?? 0})` : `Todos (${movimientos.length})`}
            </button>
          ))}
        </div>
      </div>

      <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-bg-card)] overflow-x-auto">
        {isLoading ? (
          <div className="flex justify-center py-10"><Spinner /></div>
        ) : filtrados.length === 0 ? (
          <p className="py-10 text-center text-sm text-[var(--color-text-muted)]">No hay movimientos del banco en ese período.</p>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-[11px] uppercase tracking-wider text-[var(--color-text-muted)] border-b border-[var(--color-border)]">
                <th className="px-3 py-2 font-medium">Fecha</th>
                <th className="px-3 py-2 font-medium">Cuenta</th>
                <th className="px-3 py-2 font-medium">En el banco</th>
                <th className="px-3 py-2 font-medium text-right">Monto</th>
                <th className="px-3 py-2 font-medium">Estado</th>
                <th className="px-3 py-2 font-medium">En Voltia PM</th>
                {canEdit && <th className="px-3 py-2" />}
              </tr>
            </thead>
            <tbody>
              {filtrados.map((m) => (
                <tr key={m.id} className="border-b border-[var(--color-border)] align-top">
                  <td className="px-3 py-2 whitespace-nowrap">{fmtDate(m.fecha)}</td>
                  <td className="px-3 py-2 text-[12px] text-[var(--color-text-secondary)]">{m.cuenta}</td>
                  <td className="px-3 py-2">
                    {m.descripcion}
                    {m.documento && <span className="block text-[11px] text-[var(--color-text-muted)]">Doc. {m.documento}</span>}
                  </td>
                  <td className={`px-3 py-2 text-right tabular-nums ${m.tipo === 'INGRESO' ? 'text-emerald-300' : ''}`}>
                    {m.tipo === 'INGRESO' ? '+' : '−'}{fmtCurrency(m.monto, m.moneda)}
                  </td>
                  <td className="px-3 py-2">
                    <span className={`text-[10px] font-mono px-1.5 py-0.5 rounded uppercase border ${ESTADO[m.estado].cls}`}>{ESTADO[m.estado].label}</span>
                    {m.estado === 'NO_VA' && m.noVaMotivo && (
                      <span className="block mt-0.5 text-[11px] text-[var(--color-text-muted)]">{m.noVaMotivo}{m.noVaPor ? ` · ${m.noVaPor}` : ''}</span>
                    )}
                  </td>
                  <td className="px-3 py-2 text-[12px] text-[var(--color-text-secondary)]">
                    {m.pareja ? (
                      <>
                        {m.pareja.tipo === 'PAGO' ? 'Pago a proveedor' : 'Movimiento'}: {m.pareja.descripcion}
                        <span className="block text-[11px] text-[var(--color-text-muted)]">
                          {fmtDate(m.pareja.fecha)} · {fmtCurrency(m.pareja.monto, m.moneda)}
                        </span>
                      </>
                    ) : '—'}
                  </td>
                  {canEdit && (
                    <td className="px-3 py-2">
                      <div className="flex flex-wrap justify-end gap-1">
                        {m.estado === 'COINCIDE' && (
                          <button className={btn} disabled={accion.isPending} onClick={() => accion.mutate({ tipo: 'confirmar', m })}
                            title="Fijar esta pareja: ya no se mueve aunque se cargue algo parecido después">
                            Confirmar
                          </button>
                        )}
                        {m.estado === 'CONFIRMADA' && (
                          <button className={btn} disabled={accion.isPending} onClick={() => accion.mutate({ tipo: 'soltar', m })}>Soltar</button>
                        )}
                        {m.estado === 'FALTA_CARGAR' && (
                          <>
                            <button className={btn} onClick={() => cargar(m)}>Cargar</button>
                            <button className={btn} disabled={accion.isPending} onClick={() => {
                              const motivo = window.prompt('¿Por qué no se carga? (por ejemplo, "transferencia entre cuentas propias ya cargada")');
                              if (motivo && motivo.trim().length >= 3) accion.mutate({ tipo: 'noVa', m, motivo: motivo.trim() });
                            }}>No va</button>
                          </>
                        )}
                        {m.estado === 'NO_VA' && (
                          <button className={btn} disabled={accion.isPending} onClick={() => accion.mutate({ tipo: 'deshacer', m })}>Volver a comparar</button>
                        )}
                      </div>
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}

import { Link, useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';

import { FaltaCargarBanco } from './FaltaCargarBanco';
import { getPorConciliar } from '../../api/bancoConciliacion.api';
import { fmtCurrency, fmtDate } from '../../lib/finance';

// "Por conciliar": todo lo que falta que se encuentre, en una sola lista.
//  1. Lo que leyó el banco y no está cargado (con "Cargar" y "No va").
//  2. Lo cargado en Voltia PM (pagado o cobrado desde una cuenta del banco) que el banco no muestra.
//  3. Facturas de proveedores por revisar.
//  4. Posibles gastos cargados dos veces.
export function PorConciliar() {
  const navigate = useNavigate();
  const { data } = useQuery({ queryKey: ['por-conciliar'], queryFn: getPorConciliar });

  const nada = data && data.sinBanco.length === 0 && data.facturas.total === 0 && data.duplicados.length === 0
    && data.banco.every((b) => b.faltaCargar === 0);

  return (
    <div className="space-y-3">
      <h2 className="text-base font-semibold text-[var(--color-text-primary)]">Por conciliar</h2>
      {nada && <p className="text-sm text-emerald-300">Todo conciliado: las facturas, los movimientos y el banco se encuentran.</p>}

      <FaltaCargarBanco
        onCargar={(p) => {
          const q = new URLSearchParams({
            new: '1', tipo: p.tipo, accountId: p.accountId, fecha: p.fecha,
            descripcion: p.descripcion, monto: p.monto, moneda: p.moneda,
          });
          navigate(`/finanzas/movimientos?${q.toString()}`);
        }}
      />

      {data && data.sinBanco.length > 0 && (
        <div className="rounded-xl border border-amber-500/40 bg-[var(--color-bg-card)] p-4">
          <p className="text-sm font-semibold text-[var(--color-text-primary)]">
            Cargado en Voltia PM que el banco no muestra ({data.sinBanco.length})
          </p>
          <p className="mb-2 text-[11px] text-[var(--color-text-muted)]">
            Pagado o cobrado desde una cuenta del banco hace más de 3 días, y no hay un movimiento del banco que coincida.
            Puede tener mal la cuenta, la fecha o el monto, o estar cargado dos veces.
          </p>
          <ul className="space-y-1 text-[12px] text-[var(--color-text-secondary)]">
            {data.sinBanco.slice(0, 15).map((s) => (
              <li key={s.id}>
                {fmtDate(s.fecha)} · {s.cuenta} · {s.tipo === 'PAGO' ? 'Pago a proveedor' : s.sentido === 'INGRESO' ? 'Cobro' : 'Gasto'}: {s.descripcion} ·{' '}
                <b className="tabular-nums">{fmtCurrency(s.monto, s.moneda)}</b>
              </li>
            ))}
            {data.sinBanco.length > 15 && <li className="text-[var(--color-text-muted)]">y {data.sinBanco.length - 15} más.</li>}
          </ul>
        </div>
      )}

      {data && data.facturas.total > 0 && (
        <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-bg-card)] p-4 text-sm">
          <Link to="/finanzas/facturas-proveedores" className="font-semibold text-[var(--color-accent)] hover:underline">
            {data.facturas.total} factura{data.facturas.total > 1 ? 's' : ''} de proveedores por revisar
          </Link>
          <span className="text-[12px] text-[var(--color-text-muted)]">
            {data.facturas.sinProveedor > 0 && ` · ${data.facturas.sinProveedor} de un RUT sin proveedor`}
            {data.facturas.atrasadas > 0 && ` · ${data.facturas.atrasadas} con más de una semana`}
          </span>
        </div>
      )}

      {data && data.duplicados.length > 0 && (
        <div className="rounded-xl border border-red-500/30 bg-[var(--color-bg-card)] p-4">
          <p className="text-sm font-semibold text-[var(--color-text-primary)]">Posibles gastos cargados dos veces ({data.duplicados.length})</p>
          <p className="mb-2 text-[11px] text-[var(--color-text-muted)]">
            Mismo proveedor y mismo monto a menos de una semana. Puede ser una compra que se cargó a mano y además llegó su factura.
          </p>
          <ul className="space-y-1 text-[12px] text-[var(--color-text-secondary)]">
            {data.duplicados.slice(0, 15).map((d, i) => (
              <li key={i}>
                {d.proveedor} · <b className="tabular-nums">{fmtCurrency(d.monto, d.moneda)}</b>: «{d.a.descripcion}» ({d.a.fecha ? fmtDate(d.a.fecha) : '—'}) y «{d.b.descripcion}» ({d.b.fecha ? fmtDate(d.b.fecha) : '—'})
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

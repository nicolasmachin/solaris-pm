import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'react-hot-toast';

import { Spinner } from '../components/ui/Spinner';
import {
  clasificarGastoTarjeta, crearTitular, getPersonales, getResumenTarjeta, getTarjetas, marcarDescontado,
  type ClasificacionGasto, type ReglaTarjeta, type Titular,
} from '../api/tarjetas.api';
import { usePermission } from '../hooks/usePermission';
import { fmtCurrency, fmtDate, MONTH_NAMES } from '../lib/finance';

// Tarjetas de crédito. Una tarjeta es una cuenta: cada gasto se carga en
// Movimientos con esa cuenta, y el pago es una transferencia desde el banco.
// Acá se dice quién hizo cada gasto y si es de Voltia o personal:
//  - de Voltia: gasto de la empresa;
//  - personal del socio: cuenta del socio (lo que le debe a Voltia);
//  - personal de un empleado: adelanto que se le descuenta del sueldo.
// Lo personal no entra al resultado. Si después del pago el saldo queda en cero, cierra.

const REGLA: Record<ReglaTarjeta, string> = { VOLTIA: 'Siempre de Voltia', PERSONAL: 'Siempre personal', MIXTA: 'Se decide gasto por gasto' };
const CLASIF: Record<ClasificacionGasto, { label: string; cls: string }> = {
  VOLTIA: { label: 'Voltia', cls: 'text-emerald-300' },
  SOCIO: { label: 'Personal (socio)', cls: 'text-fuchsia-300' },
  ADELANTO: { label: 'Personal (a descontar)', cls: 'text-fuchsia-300' },
  SIN_TITULAR: { label: '¿Quién lo hizo?', cls: 'text-amber-300' },
  SIN_DECIDIR: { label: 'Por decidir', cls: 'text-amber-300' },
};

function apiErr(e: unknown) {
  return (e as { response?: { data?: { message?: string } } })?.response?.data?.message;
}
const card = 'rounded-xl border border-[var(--color-border)] bg-[var(--color-bg-card)] p-4';
const sel = 'rounded-lg border border-[var(--color-border)] bg-[var(--color-bg-card)] px-2 py-1.5 text-sm text-[var(--color-text-primary)]';
const btn = 'text-[11px] px-2 py-1 rounded-md border border-[var(--color-border)] text-[var(--color-text-secondary)] hover:bg-[var(--color-bg-card-hover)] disabled:opacity-50';

export function FinanceTarjetasTab() {
  const qc = useQueryClient();
  const canEdit = usePermission('FINANZAS', 'EDIT');
  const hoy = new Date();
  const [tarjetaId, setTarjetaId] = useState('');
  const [anio, setAnio] = useState(hoy.getFullYear());
  const [mes, setMes] = useState(hoy.getMonth() + 1);

  const { data: tarjetas = [], isLoading } = useQuery({ queryKey: ['tarjetas'], queryFn: getTarjetas });
  useEffect(() => { if (!tarjetaId && tarjetas[0]) setTarjetaId(tarjetas[0].id); }, [tarjetas, tarjetaId]);
  const tarjeta = tarjetas.find((t) => t.id === tarjetaId);

  const { data: resumen } = useQuery({
    queryKey: ['tarjeta-resumen', tarjetaId, anio, mes],
    queryFn: () => getResumenTarjeta(tarjetaId, anio, mes),
    enabled: !!tarjetaId,
  });
  const { data: personales } = useQuery({ queryKey: ['personales'], queryFn: getPersonales });

  const invalidar = () => {
    for (const k of ['tarjetas', 'tarjeta-resumen', 'personales', 'finance-movements']) qc.invalidateQueries({ queryKey: [k] });
  };
  const clasificar = useMutation({
    mutationFn: (v: { id: string; body: Parameters<typeof clasificarGastoTarjeta>[1] }) => clasificarGastoTarjeta(v.id, v.body),
    onSuccess: invalidar,
    onError: (e) => toast.error(apiErr(e) ?? 'No se pudo'),
  });
  const descontar = useMutation({
    mutationFn: (v: { id: string; descontado: boolean }) => marcarDescontado(v.id, v.descontado),
    onSuccess: () => { toast.success('Listo'); invalidar(); },
    onError: (e) => toast.error(apiErr(e) ?? 'No se pudo'),
  });

  const pendientesDescontar = useMemo(() => (personales?.adelantos ?? []).filter((a) => !a.descontadoAt), [personales]);

  if (isLoading) return <div className="flex justify-center py-10"><Spinner /></div>;

  return (
    <div className="space-y-5">
      <p className="text-sm text-[var(--color-text-secondary)]">
        Cada tarjeta es una cuenta: sus gastos se cargan en Movimientos eligiendo la tarjeta como cuenta, y el pago
        es una transferencia desde el banco a la tarjeta. Acá se marca quién hizo cada gasto y si es de Voltia o
        personal. Lo personal no es gasto de la empresa: queda en la cuenta del socio o como adelanto a descontar.
      </p>

      {tarjetas.length === 0 ? (
        <p className={card + ' text-sm text-[var(--color-text-muted)]'}>
          Todavía no hay tarjetas. Se crean en <Link to="/finanzas/cuentas" className="text-[var(--color-accent)] underline">Cuentas</Link> con
          el tipo «Tarjeta» (una por tarjeta: BBVA, Scotiabank).
        </p>
      ) : (
        <>
          <div className="flex flex-wrap items-center gap-2">
            <select className={sel} value={tarjetaId} onChange={(e) => setTarjetaId(e.target.value)}>
              {tarjetas.map((t) => <option key={t.id} value={t.id}>{t.nombre}</option>)}
            </select>
            <select className={sel} value={mes} onChange={(e) => setMes(Number(e.target.value))}>
              {MONTH_NAMES.map((m, i) => <option key={m} value={i + 1}>{m}</option>)}
            </select>
            <select className={sel} value={anio} onChange={(e) => setAnio(Number(e.target.value))}>
              {[hoy.getFullYear() - 1, hoy.getFullYear()].map((a) => <option key={a} value={a}>{a}</option>)}
            </select>
          </div>

          {tarjeta && <Titulares tarjetaId={tarjeta.id} titulares={tarjeta.titulares} canEdit={canEdit} onCambio={invalidar} />}

          {resumen && (
            <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
              {[
                ['De Voltia', resumen.totales.voltia],
                ['Personal del socio', resumen.totales.socio],
                ['A descontar', resumen.totales.adelantos],
                ['Pagado a la tarjeta', resumen.totales.pagos],
              ].map(([l, v]) => (
                <div key={l as string} className={card}>
                  <p className="text-[11px] font-mono uppercase tracking-wider text-[var(--color-text-muted)]">{l}</p>
                  <p className="mt-1 text-lg font-semibold tabular-nums">{fmtCurrency(v as number, resumen.tarjeta.moneda)}</p>
                </div>
              ))}
              <div className={card}>
                <p className="text-[11px] font-mono uppercase tracking-wider text-[var(--color-text-muted)]">Saldo de la tarjeta</p>
                <p className={`mt-1 text-lg font-semibold tabular-nums ${Math.abs(resumen.saldo) < 0.01 ? 'text-emerald-300' : 'text-amber-300'}`}>
                  {Math.abs(resumen.saldo) < 0.01 ? 'Cierra en cero' : fmtCurrency(-resumen.saldo, resumen.tarjeta.moneda)}
                </p>
                {Math.abs(resumen.saldo) >= 0.01 && <p className="text-[11px] text-[var(--color-text-muted)]">lo que se le debe hoy</p>}
              </div>
            </div>
          )}

          {resumen && (resumen.totales.sinTitular > 0 || resumen.totales.sinDecidir > 0) && (
            <p className="text-[12px] text-amber-300">
              Falta decidir: {resumen.totales.sinTitular > 0 && `${fmtCurrency(resumen.totales.sinTitular, resumen.tarjeta.moneda)} sin saber quién lo hizo`}
              {resumen.totales.sinTitular > 0 && resumen.totales.sinDecidir > 0 && ' · '}
              {resumen.totales.sinDecidir > 0 && `${fmtCurrency(resumen.totales.sinDecidir, resumen.tarjeta.moneda)} de una tarjeta mixta sin marcar si es de Voltia o personal`}.
            </p>
          )}

          {resumen && (
            <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-bg-card)] overflow-x-auto">
              {resumen.gastos.length === 0 ? (
                <p className="py-10 text-center text-sm text-[var(--color-text-muted)]">
                  No hay gastos de esta tarjeta en {MONTH_NAMES[mes - 1]} {anio}. Se cargan en Movimientos con la tarjeta como cuenta.
                </p>
              ) : (
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-left text-[11px] uppercase tracking-wider text-[var(--color-text-muted)] border-b border-[var(--color-border)]">
                      <th className="px-3 py-2 font-medium">Fecha</th>
                      <th className="px-3 py-2 font-medium">Gasto</th>
                      <th className="px-3 py-2 font-medium text-right">Monto</th>
                      <th className="px-3 py-2 font-medium">Quién</th>
                      <th className="px-3 py-2 font-medium">Es</th>
                      {canEdit && <th className="px-3 py-2" />}
                    </tr>
                  </thead>
                  <tbody>
                    {resumen.gastos.map((g) => {
                      const tit = tarjeta?.titulares.find((t) => t.id === g.titular?.id);
                      const personal = g.clasificacion === 'SOCIO' || g.clasificacion === 'ADELANTO';
                      return (
                        <tr key={g.id} className="border-b border-[var(--color-border)]">
                          <td className="px-3 py-2 whitespace-nowrap">{fmtDate(g.fecha)}</td>
                          <td className="px-3 py-2">{g.descripcion}{g.proveedor && <span className="block text-[11px] text-[var(--color-text-muted)]">{g.proveedor}</span>}</td>
                          <td className="px-3 py-2 text-right tabular-nums">{fmtCurrency(g.monto, g.moneda)}</td>
                          <td className="px-3 py-2">
                            {canEdit ? (
                              <select className={sel} value={g.titular?.id ?? ''} disabled={clasificar.isPending}
                                onChange={(e) => clasificar.mutate({ id: g.id, body: { titularId: e.target.value || null } })}>
                                <option value="">¿Quién?</option>
                                {tarjeta?.titulares.map((t) => <option key={t.id} value={t.id}>{t.nombre}</option>)}
                              </select>
                            ) : (g.titular?.nombre ?? '—')}
                          </td>
                          <td className={`px-3 py-2 text-[12px] ${CLASIF[g.clasificacion].cls}`}>{CLASIF[g.clasificacion].label}</td>
                          {canEdit && (
                            <td className="px-3 py-2">
                              <div className="flex justify-end gap-1">
                                {g.titular && (!personal || g.clasificacion === 'SIN_DECIDIR') && (
                                  <button className={btn} disabled={clasificar.isPending} onClick={() => {
                                    let autorizadoPor: string | undefined;
                                    if (tit?.regla === 'VOLTIA') {
                                      const a = window.prompt('Es una tarjeta de la empresa: ¿quién autorizó el gasto personal?');
                                      if (!a?.trim()) return;
                                      autorizadoPor = a.trim();
                                    }
                                    clasificar.mutate({ id: g.id, body: { clasificacion: 'PERSONAL', ...(autorizadoPor ? { autorizadoPor } : {}) } });
                                  }}>Es personal</button>
                                )}
                                {g.titular && (personal || g.clasificacion === 'SIN_DECIDIR') && (
                                  <button className={btn} disabled={clasificar.isPending}
                                    onClick={() => clasificar.mutate({ id: g.id, body: { clasificacion: 'VOLTIA' } })}>Es de Voltia</button>
                                )}
                              </div>
                            </td>
                          )}
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              )}
            </div>
          )}
        </>
      )}

      {personales && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
          <div className={card}>
            <p className="text-sm font-semibold text-[var(--color-text-primary)]">Cuenta del socio</p>
            <p className="mb-2 text-[11px] text-[var(--color-text-muted)]">
              Gastos personales del socio pagados por Voltia, menos lo que devolvió. La contadora lo cancela (sueldo formal,
              utilidades o devolución).
            </p>
            {Object.keys(personales.saldoSocio).length === 0 ? <p className="text-sm text-[var(--color-text-muted)]">En cero.</p> : (
              Object.entries(personales.saldoSocio).map(([m, v]) => (
                <p key={m} className="text-lg font-semibold tabular-nums">{fmtCurrency(v ?? 0, m as 'USD' | 'UYU')}</p>
              ))
            )}
          </div>
          <div className={card}>
            <p className="text-sm font-semibold text-[var(--color-text-primary)]">A descontar del sueldo ({pendientesDescontar.length})</p>
            <p className="mb-2 text-[11px] text-[var(--color-text-muted)]">
              Gastos personales autorizados de empleados con una tarjeta de la empresa. Los marca descontados quien liquida los sueldos.
            </p>
            {pendientesDescontar.length === 0 ? <p className="text-sm text-[var(--color-text-muted)]">Nada pendiente.</p> : (
              <ul className="space-y-1 text-[12px] text-[var(--color-text-secondary)]">
                {pendientesDescontar.map((a) => (
                  <li key={a.id} className="flex items-center justify-between gap-2">
                    <span>
                      {fmtDate(a.fecha)} · {a.persona ?? '—'} · {a.descripcion} · <b className="tabular-nums">{fmtCurrency(a.monto, a.moneda)}</b>
                      {a.autorizadoPor && <span className="text-[var(--color-text-muted)]"> · autorizó {a.autorizadoPor}</span>}
                    </span>
                    {canEdit && (
                      <button className={btn} disabled={descontar.isPending} onClick={() => descontar.mutate({ id: a.id, descontado: true })}>Descontado</button>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function Titulares({ tarjetaId, titulares, canEdit, onCambio }: { tarjetaId: string; titulares: Titular[]; canEdit: boolean; onCambio: () => void }) {
  const [nombre, setNombre] = useState('');
  const [regla, setRegla] = useState<ReglaTarjeta>('VOLTIA');
  const [esSocio, setEsSocio] = useState(false);
  const crear = useMutation({
    mutationFn: () => crearTitular(tarjetaId, { nombre: nombre.trim(), regla, personalComo: esSocio ? 'CUENTA_SOCIO' : 'ADELANTO_PERSONAL' }),
    onSuccess: () => { setNombre(''); toast.success('Agregado'); onCambio(); },
    onError: (e) => toast.error(apiErr(e) ?? 'No se pudo agregar'),
  });
  return (
    <div className={card}>
      <p className="text-sm font-semibold text-[var(--color-text-primary)]">Quién usa esta tarjeta</p>
      {titulares.length === 0 && <p className="text-[12px] text-[var(--color-text-muted)]">Todavía no se cargó el titular ni los adicionales.</p>}
      <ul className="mt-1 space-y-0.5 text-[12px] text-[var(--color-text-secondary)]">
        {titulares.map((t) => (
          <li key={t.id}>{t.nombre} · {REGLA[t.regla]} · lo personal va a {t.personalComo === 'CUENTA_SOCIO' ? 'la cuenta del socio' : 'adelanto a descontar'}</li>
        ))}
      </ul>
      {canEdit && (
        <div className="mt-3 flex flex-wrap items-center gap-2">
          <input className={sel} placeholder="Nombre (titular o adicional)" value={nombre} onChange={(e) => setNombre(e.target.value)} />
          <select className={sel} value={regla} onChange={(e) => setRegla(e.target.value as ReglaTarjeta)}>
            {(Object.keys(REGLA) as ReglaTarjeta[]).map((r) => <option key={r} value={r}>{REGLA[r]}</option>)}
          </select>
          <label className="flex items-center gap-1 text-[12px] text-[var(--color-text-secondary)]">
            <input type="checkbox" className="accent-[var(--color-accent)]" checked={esSocio} onChange={(e) => setEsSocio(e.target.checked)} />
            Es el socio (lo personal va a su cuenta)
          </label>
          <button className={btn} disabled={nombre.trim().length < 2 || crear.isPending} onClick={() => crear.mutate()}>Agregar</button>
        </div>
      )}
    </div>
  );
}

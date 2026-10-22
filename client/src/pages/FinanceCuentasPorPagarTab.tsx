import { Fragment, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'react-hot-toast';
import { ChevronDown, ChevronRight, RefreshCw } from 'lucide-react';

import { Spinner } from '../components/ui/Spinner';
import { getSuppliers } from '../api/finance.api';
import {
  confirmarFacturaRecibida, crearProveedorDesdeRut, descartarFacturaRecibida, getCuentasPorPagar, getFacturasRecibidas,
  reabrirFacturaRecibida, sincronizarFacturasRecibidas, vincularFacturaRecibida, asignarProveedorPorRut,
  type EstadoFacturaRecibida, type FacturaRecibida, type ProveedorAPagar, type TotalesTramo,
} from '../api/cuentasPorPagar.api';
import { usePermission } from '../hooks/usePermission';
import { PdfFacturaRecibida } from '../components/finance/PdfFacturaRecibida';
import { CargarFacturaRecibidaModal } from '../components/finance/CargarFacturaRecibidaModal';
import { fmtCurrency, fmtDate } from '../lib/finance';

function klass(...p: (string | false | undefined)[]) { return p.filter(Boolean).join(' '); }
function apiErr(err: unknown) {
  return (err as { response?: { data?: { message?: string } } })?.response?.data?.message;
}

const TRAMOS: Array<{ key: keyof TotalesTramo; label: string }> = [
  { key: 'VENCIDO', label: 'Vencido' },
  { key: 'HASTA_7', label: 'Vence en 7 días' },
  { key: 'HASTA_30', label: '8 a 30 días' },
  { key: 'MAS_30', label: 'Más de 30 días' },
];

const card = 'bg-[var(--color-bg-card)] border border-[var(--color-border)] rounded-xl';
const btn = 'rounded-md border border-[var(--color-border)] px-2.5 py-1 text-xs text-[var(--color-text-secondary)] hover:bg-[var(--color-bg-card-hover)] disabled:opacity-50';
const btnAccent = 'rounded-md bg-[var(--color-accent)] px-2.5 py-1 text-xs font-semibold text-gray-900 hover:bg-[var(--color-accent-hover)] disabled:opacity-50';

/** Un monto en USD y, debajo, el de pesos si hay. */
function Montos({ usd, uyu, tone }: { usd: number; uyu: number; tone?: string }) {
  if (usd < 0.005 && uyu < 0.005) return <span className="text-[var(--color-text-muted)]">—</span>;
  return (
    <span className={klass('tabular-nums', tone)}>
      {usd >= 0.005 && <span className="block">{fmtCurrency(usd, 'USD')}</span>}
      {uyu >= 0.005 && <span className="block">{fmtCurrency(uyu, 'UYU')}</span>}
    </span>
  );
}

function Metric({ label, usd, uyu, tone }: { label: string; usd: number; uyu: number; tone?: string }) {
  return (
    <div className={klass(card, 'p-4')}>
      <p className="text-[11px] uppercase tracking-wider text-[var(--color-text-muted)] font-mono">{label}</p>
      <div className="mt-1 text-lg font-semibold text-[var(--color-text-primary)]">
        <Montos usd={usd} uyu={uyu} tone={tone} />
      </div>
    </div>
  );
}

function LimiteCell({ p }: { p: ProveedorAPagar }) {
  if (!p.limite) return <span className="text-[11px] text-[var(--color-text-muted)]">Sin límite</span>;
  const pct = Math.min(100, (p.limite.usado / p.limite.monto) * 100);
  return (
    <div className="min-w-[140px]">
      <div className="flex justify-between text-[11px] tabular-nums">
        <span className={p.limite.excedido ? 'text-red-400 font-semibold' : 'text-[var(--color-text-secondary)]'}>
          {fmtCurrency(p.limite.usado, p.limite.moneda)}
        </span>
        <span className="text-[var(--color-text-muted)]">de {fmtCurrency(p.limite.monto, p.limite.moneda)}</span>
      </div>
      <div className="mt-1 h-1.5 rounded-full bg-[var(--color-border)] overflow-hidden">
        <div
          className={klass('h-full rounded-full', p.limite.excedido ? 'bg-red-500' : pct > 80 ? 'bg-amber-500' : 'bg-green-500')}
          style={{ width: `${pct}%` }}
        />
      </div>
      {p.limite.excedido && <p className="mt-0.5 text-[11px] text-red-400">Pasado del límite</p>}
    </div>
  );
}

function ProveedoresTabla({ proveedores }: { proveedores: ProveedorAPagar[] }) {
  const [abierto, setAbierto] = useState<string | null>(null);
  if (proveedores.length === 0) {
    return <p className={klass(card, 'p-8 text-center text-sm text-[var(--color-text-muted)]')}>No se le debe nada a ningún proveedor.</p>;
  }
  return (
    <div className={klass(card, 'overflow-x-auto')}>
      <table className="w-full text-sm">
        <thead>
          <tr className="text-left text-[11px] uppercase tracking-wider text-[var(--color-text-muted)] border-b border-[var(--color-border)]">
            <th className="px-3 py-2">Proveedor</th>
            {TRAMOS.map((t) => <th key={t.key} className="px-3 py-2 text-right">{t.label}</th>)}
            <th className="px-3 py-2 text-right">Total</th>
            <th className="px-3 py-2 text-right">A favor</th>
            <th className="px-3 py-2">Límite</th>
          </tr>
        </thead>
        <tbody>
          {proveedores.map((p) => {
            const open = abierto === p.supplier.id;
            return (
              <Fragment key={p.supplier.id}>
                <tr
                  className="border-b border-[var(--color-border)] hover:bg-[var(--color-bg-card-hover)] cursor-pointer align-top"
                  onClick={() => setAbierto(open ? null : p.supplier.id)}
                >
                  <td className="px-3 py-2">
                    <div className="flex items-start gap-1">
                      {open ? <ChevronDown className="w-4 h-4 mt-0.5 shrink-0" /> : <ChevronRight className="w-4 h-4 mt-0.5 shrink-0" />}
                      <div>
                        <span className="font-medium text-[var(--color-text-primary)]">{p.supplier.nombre}</span>
                        <span className="block text-[11px] text-[var(--color-text-muted)]">
                          Plazo {p.supplier.plazoCreditoDias} días
                          {p.proximoVencimiento ? ` · próximo vto. ${fmtDate(p.proximoVencimiento)}` : ''}
                        </span>
                      </div>
                    </div>
                  </td>
                  {TRAMOS.map((t) => (
                    <td key={t.key} className="px-3 py-2 text-right">
                      <Montos usd={p.USD[t.key]} uyu={p.UYU[t.key]} tone={t.key === 'VENCIDO' ? 'text-red-400' : undefined} />
                    </td>
                  ))}
                  <td className="px-3 py-2 text-right font-semibold"><Montos usd={p.USD.total} uyu={p.UYU.total} /></td>
                  <td className="px-3 py-2 text-right"><Montos usd={p.saldoAFavor.USD} uyu={p.saldoAFavor.UYU} tone="text-green-400" /></td>
                  <td className="px-3 py-2"><LimiteCell p={p} /></td>
                </tr>
                {open && (
                  <tr className="border-b border-[var(--color-border)] bg-[var(--color-bg-app)]">
                    <td colSpan={8} className="px-6 py-3">
                      <table className="w-full text-xs">
                        <thead>
                          <tr className="text-left text-[var(--color-text-muted)]">
                            <th className="py-1">Factura</th><th className="py-1">Emitida</th><th className="py-1">Vence</th>
                            <th className="py-1">Obra</th><th className="py-1 text-right">Monto</th><th className="py-1 text-right">Saldo</th>
                          </tr>
                        </thead>
                        <tbody>
                          {p.facturas.map((f) => (
                            <tr key={f.id} className="border-t border-[var(--color-border)]">
                              <td className="py-1">{f.invoiceNumber ? `${f.invoiceNumber} · ` : ''}{f.descripcion}</td>
                              <td className="py-1">{fmtDate(f.fechaEmision)}</td>
                              <td className={klass('py-1', f.tramo === 'VENCIDO' && 'text-red-400 font-medium')}>
                                {fmtDate(f.vencimiento)}
                                <span className="text-[var(--color-text-muted)]">
                                  {' '}({f.diasParaVencer < 0 ? `hace ${-f.diasParaVencer} d` : f.diasParaVencer === 0 ? 'hoy' : `en ${f.diasParaVencer} d`})
                                </span>
                              </td>
                              <td className="py-1">{f.project ? `${f.project.code} · ${f.project.clientName}` : '—'}</td>
                              <td className="py-1 text-right tabular-nums">{fmtCurrency(f.monto, f.moneda)}</td>
                              <td className="py-1 text-right tabular-nums font-medium">{fmtCurrency(f.saldo, f.moneda)}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                      <Link to={`/finanzas/proveedores/${p.supplier.id}`} className="mt-2 inline-block text-xs text-[var(--color-accent)] hover:underline">
                        Ver estado de cuenta del proveedor →
                      </Link>
                    </td>
                  </tr>
                )}
              </Fragment>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

// ─── Bandeja de facturas recibidas ─────────────────────────────────────────

function FilaRecibida({ f, canEdit, proveedores }: {
  f: FacturaRecibida;
  canEdit: boolean;
  proveedores: Array<{ id: string; nombre: string }>;
}) {
  const qc = useQueryClient();
  const invalidar = () => {
    qc.invalidateQueries({ queryKey: ['facturas-recibidas'] });
    qc.invalidateQueries({ queryKey: ['por-conciliar'] });
    qc.invalidateQueries({ queryKey: ['cuentas-por-pagar'] });
    qc.invalidateQueries({ queryKey: ['suppliers'] });
    qc.invalidateQueries({ queryKey: ['finance-cashflow'] });
    qc.invalidateQueries({ queryKey: ['finance-pending'] });
  };
  const confirmar = useMutation({
    mutationFn: () => confirmarFacturaRecibida(f.id, {}),
    onSuccess: () => { toast.success(f.esNotaCredito ? 'Nota de crédito descontada de la deuda' : 'Factura cargada como deuda'); invalidar(); },
    onError: (e) => toast.error(apiErr(e) ?? 'No se pudo confirmar'),
  });
  const vincular = useMutation({
    mutationFn: (movementId: string) => vincularFacturaRecibida(f.id, movementId),
    onSuccess: () => { toast.success('Vinculada a la factura ya cargada'); invalidar(); },
    onError: (e) => toast.error(apiErr(e) ?? 'No se pudo vincular'),
  });
  const descartar = useMutation({
    mutationFn: (motivo: string) => descartarFacturaRecibida(f.id, motivo),
    onSuccess: () => { toast.success('Factura descartada'); invalidar(); },
    onError: (e) => toast.error(apiErr(e) ?? 'No se pudo descartar'),
  });
  const reabrir = useMutation({
    mutationFn: () => reabrirFacturaRecibida(f.id),
    onSuccess: () => { toast.success('Volvió a la bandeja'); invalidar(); },
    onError: (e) => toast.error(apiErr(e) ?? 'No se pudo'),
  });
  // Elegir el proveedor lo asigna a todas las facturas de la bandeja con ese RUT.
  const asignar = useMutation({
    mutationFn: (supplierId: string) => asignarProveedorPorRut(f.rutEmisor, supplierId),
    onSuccess: (r) => {
      toast.success(r.facturasAsignadas > 1
        ? `${r.nombre}: asignado a las ${r.facturasAsignadas} facturas del RUT ${f.rutEmisor}`
        : `${r.nombre} asignado`);
      invalidar();
    },
    onError: (e) => toast.error(apiErr(e) ?? 'No se pudo asignar el proveedor'),
  });
  const alta = useMutation({
    mutationFn: (nombre?: string) => crearProveedorDesdeRut(f.rutEmisor, nombre),
    onSuccess: (r) => { toast.success(`${r.nombre} dado de alta`); invalidar(); },
    onError: (e) => toast.error(apiErr(e) ?? 'No se pudo dar de alta'),
  });
  function darDeAlta() {
    const nombre = window.prompt(`Nombre del proveedor con RUT ${f.rutEmisor}:`, f.razonSocialEmisor ?? '');
    if (nombre !== null) alta.mutate(nombre.trim() || undefined);
  }
  const ocupado = asignar.isPending || alta.isPending || confirmar.isPending || vincular.isPending || descartar.isPending || reabrir.isPending;

  function pedirMotivo() {
    const motivo = window.prompt(
      f.esNotaCredito
        ? 'Nota de crédito: ¿cómo se registró? (por ejemplo, "descontada de la factura 123")'
        : '¿Por qué se descarta? (por ejemplo, "no es de Voltia", "duplicada")',
    );
    if (motivo && motivo.trim().length >= 3) descartar.mutate(motivo.trim());
  }

  const vtoDistinto = f.fechaVencimientoCfe && f.vencimientoPorPlazo && f.fechaVencimientoCfe !== f.vencimientoPorPlazo;

  return (
    <tr className="border-b border-[var(--color-border)] align-top">
      <td className="px-3 py-2 whitespace-nowrap">{fmtDate(f.fechaEmision)}</td>
      <td className="px-3 py-2">
        <span className="font-medium text-[var(--color-text-primary)]">{f.supplier?.nombre ?? f.razonSocialEmisor ?? 'Proveedor sin identificar'}</span>
        <span className="block text-[11px] text-[var(--color-text-muted)]">RUT {f.rutEmisor}</span>
      </td>
      <td className="px-3 py-2">
        <span className={f.esNotaCredito ? 'text-green-400' : undefined}>{f.tipoLabel}</span> {f.serie}-{f.numero}
        <span className="block text-[11px] text-[var(--color-text-muted)]">
          {[f.enDgi && 'DGI', f.enMail && 'mail', f.enManual && 'a mano'].filter(Boolean).join(' + ')}
        </span>
        <span className="mt-1 block"><PdfFacturaRecibida id={f.id} pdf={f.pdf} /></span>
      </td>
      <td className="px-3 py-2 text-right tabular-nums">{fmtCurrency(f.total, f.moneda)}</td>
      <td className="px-3 py-2 text-[12px]">
        {f.vencimientoPorPlazo ? fmtDate(f.vencimientoPorPlazo) : '—'}
        {vtoDistinto && (
          <span className="block text-[11px] text-amber-400">La factura dice {fmtDate(f.fechaVencimientoCfe)}</span>
        )}
      </td>
      <td className="px-3 py-2">
        {f.estado === 'CONFIRMADA' && (
          <span className="text-[12px] text-green-400">
            Deuda{f.movement ? `: ${f.movement.descripcion}` : ''}
            {f.cargadaSola && <span className="ml-1 text-[11px] text-sky-300" title="Proveedor de cuenta corriente: pasó sola a deuda. Se revisa una vez por semana.">· entró sola</span>}
          </span>
        )}
        {f.estado === 'DESCARTADA' && (
          <div className="text-[12px] text-[var(--color-text-muted)]">
            Descartada: {f.motivoDescarte}
            {canEdit && <button className={klass(btn, 'ml-2')} disabled={ocupado} onClick={() => reabrir.mutate()}>Volver a la bandeja</button>}
          </div>
        )}
        {f.estado === 'PENDIENTE' && canEdit && (
          <div className="flex flex-col gap-1.5">
            {f.candidatas.length > 0 && (
              <span className="text-[11px] text-[var(--color-text-muted)]">¿Ya está cargada? Gastos parecidos:</span>
            )}
            {f.candidatas.map((c) => (
              <button key={c.id} className={klass(btn, 'text-left')} disabled={ocupado} onClick={() => vincular.mutate(c.id)}
                title="Si es esta compra, se vincula al gasto ya cargado y no se crea deuda nueva">
                <span className={klass('mr-1.5 rounded px-1 text-[9px] font-mono uppercase', (c.puntaje ?? 100) >= 75 ? 'bg-emerald-500/20 text-emerald-300' : 'bg-amber-500/20 text-amber-300')}>
                  {(c.puntaje ?? 100) >= 75 ? 'Muy probable' : 'Probable'}
                </span>
                {c.fecha ? `${c.fecha.slice(8, 10)}/${c.fecha.slice(5, 7)} · ` : ''}{c.descripcion} ({fmtCurrency(c.monto, c.moneda ?? f.moneda)})
                {c.sinProveedor && <span className="text-[var(--color-text-muted)]"> · sin proveedor</span>}
                {c.motivos?.length ? <span className="block text-[10px] text-[var(--color-text-muted)]">{c.motivos.join(' · ')}</span> : null}
              </button>
            ))}
            <div className="flex flex-wrap gap-1.5">
              {!f.supplier && (
                <select className="rounded-md border border-[var(--color-border)] bg-[var(--color-bg-app)] px-2 py-1 text-xs"
                  value="" disabled={ocupado} onChange={(e) => { if (e.target.value) asignar.mutate(e.target.value); }}
                  title="Se asigna a todas las facturas de este RUT">
                  <option value="">¿De qué proveedor es?</option>
                  {proveedores.map((p) => <option key={p.id} value={p.id}>{p.nombre}</option>)}
                </select>
              )}
              <button className={btnAccent} disabled={ocupado || !f.supplier} onClick={() => confirmar.mutate()}
                title={f.esNotaCredito ? 'Baja lo que se le debe al proveedor (de la deuda más vieja a la más nueva), sin mover plata' : undefined}>
                {f.esNotaCredito ? 'Descontar de la deuda' : 'Cargar como deuda'}
              </button>
              {!f.supplier && (
                <button className={btn} disabled={ocupado} onClick={darDeAlta} title="Crea el proveedor con este RUT">
                  Dar de alta proveedor
                </button>
              )}
              <button className={btn} disabled={ocupado} onClick={pedirMotivo}>
                {f.esNotaCredito ? 'Marcar registrada' : 'Descartar'}
              </button>
            </div>
            {f.esNotaCredito && (
              <span className="text-[11px] text-[var(--color-text-muted)]">
                Si ya se descontó a mano, usá «Marcar registrada» y anotá cómo.
              </span>
            )}
          </div>
        )}
      </td>
    </tr>
  );
}

function BandejaRecibidas() {
  const qc = useQueryClient();
  const canEdit = usePermission('FINANZAS', 'EDIT');
  const [estado, setEstado] = useState<EstadoFacturaRecibida | 'todas'>('PENDIENTE');
  const { data, isLoading } = useQuery({
    queryKey: ['facturas-recibidas', estado],
    queryFn: () => getFacturasRecibidas(estado),
  });
  const { data: proveedores = [] } = useQuery({
    queryKey: ['suppliers', 'activos-bandeja'],
    queryFn: () => getSuppliers({ activo: 'true' }),
  });
  const sync = useMutation({
    mutationFn: sincronizarFacturasRecibidas,
    onSuccess: (r) => {
      const n = r.resultado?.nuevas ?? 0;
      toast.success(n > 0 ? `${n} factura${n === 1 ? '' : 's'} nueva${n === 1 ? '' : 's'}` : 'No hay facturas nuevas');
      qc.invalidateQueries({ queryKey: ['facturas-recibidas'] });
    },
    onError: (e) => toast.error(apiErr(e) ?? 'No se pudo consultar Biller'),
  });

  const [cargando, setCargando] = useState(false);
  // Filtros sobre lo que trajo la vista elegida. El proveedor sale de las mismas
  // facturas: así aparecen también los RUT que todavía no tienen proveedor.
  const [proveedor, setProveedor] = useState('');
  const [tipo, setTipo] = useState<'todos' | 'facturas' | 'nc'>('todos');
  const [desde, setDesde] = useState('');
  const [hasta, setHasta] = useState('');
  const [buscar, setBuscar] = useState('');
  const claveProv = (f: FacturaRecibida) => f.supplier?.id ?? `rut:${f.rutEmisor}`;
  const opcionesProv = useMemo(() => {
    const m = new Map<string, string>();
    for (const f of data?.facturas ?? []) {
      if (!m.has(claveProv(f))) m.set(claveProv(f), f.supplier?.nombre ?? f.razonSocialEmisor ?? `RUT ${f.rutEmisor}`);
    }
    return [...m.entries()].sort((a, b) => a[1].localeCompare(b[1]));
  }, [data]);
  const facturas = useMemo(() => {
    const q = buscar.trim().toLowerCase();
    return (data?.facturas ?? []).filter((f) =>
      (!proveedor || claveProv(f) === proveedor)
      && (tipo === 'todos' || (tipo === 'nc') === f.esNotaCredito)
      && (!desde || f.fechaEmision.slice(0, 10) >= desde)
      && (!hasta || f.fechaEmision.slice(0, 10) <= hasta)
      && (!q || [`${f.serie}-${f.numero}`, String(f.numero), f.rutEmisor, f.razonSocialEmisor ?? '', f.supplier?.nombre ?? '']
        .some((t) => t.toLowerCase().includes(q))));
  }, [data, proveedor, tipo, desde, hasta, buscar]);
  const hayFiltro = !!(proveedor || tipo !== 'todos' || desde || hasta || buscar.trim());
  const ultima = data?.ultimaSync;
  return (
    <section className="space-y-3">
      {cargando && <CargarFacturaRecibidaModal onClose={() => setCargando(false)} />}
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="text-base font-semibold text-[var(--color-text-primary)]">Facturas recibidas</h2>
          <p className="text-xs text-[var(--color-text-muted)]">
            Las que los proveedores le emiten a Voltia: traídas de la facturación electrónica (DGI y mail) o cargadas a mano. Ninguna suma a la deuda hasta que se confirma.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <select className="rounded-lg border border-[var(--color-border)] bg-[var(--color-bg-card)] px-3 py-1.5 text-sm"
            value={estado} onChange={(e) => setEstado(e.target.value as EstadoFacturaRecibida | 'todas')}>
            <option value="PENDIENTE">Por revisar</option>
            <option value="CONFIRMADA">Deuda (cargadas)</option>
            <option value="DESCARTADA">Descartadas</option>
            <option value="todas">Todas</option>
          </select>
          {canEdit && (
            <button className={klass(btn, 'py-1.5')} onClick={() => setCargando(true)}>Cargar a mano</button>
          )}
          {canEdit && data?.billerConfigurado && (
            <button className={klass(btn, 'flex items-center gap-1 py-1.5')} disabled={sync.isPending} onClick={() => sync.mutate()}>
              <RefreshCw className={klass('w-3.5 h-3.5', sync.isPending && 'animate-spin')} /> Buscar facturas nuevas
            </button>
          )}
        </div>
      </div>
      {data && !data.billerConfigurado && (
        <p className="rounded-lg bg-amber-500/10 px-3 py-2 text-xs text-amber-400">
          La conexión con la facturación electrónica todavía no está configurada.
        </p>
      )}
      {ultima && (
        <p className={klass('text-[11px]', ultima.ok ? 'text-[var(--color-text-muted)]' : 'text-red-400')}>
          Última consulta: {new Date(ultima.at).toLocaleString('es-UY')}
          {ultima.ok ? '' : ` — falló: ${ultima.error}`}
        </p>
      )}
      {(data?.facturas.length ?? 0) > 0 && (
        <div className="flex flex-wrap items-center gap-2 text-sm">
          <select className="rounded-lg border border-[var(--color-border)] bg-[var(--color-bg-card)] px-3 py-1.5" value={proveedor} onChange={(e) => setProveedor(e.target.value)}>
            <option value="">Todos los proveedores</option>
            {opcionesProv.map(([k, n]) => <option key={k} value={k}>{n}</option>)}
          </select>
          <select className="rounded-lg border border-[var(--color-border)] bg-[var(--color-bg-card)] px-3 py-1.5" value={tipo} onChange={(e) => setTipo(e.target.value as typeof tipo)}>
            <option value="todos">Facturas y notas de crédito</option>
            <option value="facturas">Solo facturas</option>
            <option value="nc">Solo notas de crédito</option>
          </select>
          <label className="flex items-center gap-1 text-xs text-[var(--color-text-muted)]">Desde
            <input type="date" className="rounded-lg border border-[var(--color-border)] bg-[var(--color-bg-card)] px-2 py-1 text-sm" value={desde} onChange={(e) => setDesde(e.target.value)} />
          </label>
          <label className="flex items-center gap-1 text-xs text-[var(--color-text-muted)]">Hasta
            <input type="date" className="rounded-lg border border-[var(--color-border)] bg-[var(--color-bg-card)] px-2 py-1 text-sm" value={hasta} onChange={(e) => setHasta(e.target.value)} />
          </label>
          <input className="min-w-[180px] rounded-lg border border-[var(--color-border)] bg-[var(--color-bg-card)] px-3 py-1.5" placeholder="Buscar número, RUT, razón social…" value={buscar} onChange={(e) => setBuscar(e.target.value)} />
          {hayFiltro && (
            <button className="text-xs text-[var(--color-accent)] hover:underline" onClick={() => { setProveedor(''); setTipo('todos'); setDesde(''); setHasta(''); setBuscar(''); }}>
              Limpiar filtros
            </button>
          )}
          <span className="text-xs text-[var(--color-text-muted)]">{facturas.length} de {data!.facturas.length}</span>
        </div>
      )}
      {isLoading ? <Spinner /> : facturas.length === 0 ? (
        <p className={klass(card, 'p-6 text-center text-sm text-[var(--color-text-muted)]')}>
          {hayFiltro ? 'Ninguna factura coincide con los filtros.' : estado === 'PENDIENTE' ? 'No hay facturas por revisar.' : 'No hay facturas en esta vista.'}
        </p>
      ) : (
        <div className={klass(card, 'overflow-x-auto')}>
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-[11px] uppercase tracking-wider text-[var(--color-text-muted)] border-b border-[var(--color-border)]">
                <th className="px-3 py-2">Emitida</th><th className="px-3 py-2">Proveedor</th><th className="px-3 py-2">Comprobante</th>
                <th className="px-3 py-2 text-right">Total</th><th className="px-3 py-2">Vence (plazo)</th><th className="px-3 py-2">Qué hacer</th>
              </tr>
            </thead>
            <tbody>
              {facturas.map((f) => <FilaRecibida key={f.id} f={f} canEdit={canEdit} proveedores={proveedores} />)}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}

// ─── Pantalla ───────────────────────────────────────────────────────────────

/** Lo que se le debe a cada proveedor, por vencimiento. Va arriba de Proveedores. */
export function CuentasPorPagarResumen() {
  const { data, isLoading } = useQuery({ queryKey: ['cuentas-por-pagar'], queryFn: getCuentasPorPagar });
  const excedidos = useMemo(() => (data?.proveedores ?? []).filter((p) => p.limite?.excedido), [data]);

  return (
    <div className="space-y-6">
      <p className="text-sm text-[var(--color-text-secondary)]">
        Lo que Voltia le debe a cada proveedor, ordenado por cuándo vence. Cada factura vence según el plazo
        acordado con ese proveedor.
      </p>
      {isLoading || !data ? <Spinner /> : (
        <>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <Metric label="Total a pagar" usd={data.totales.USD.total} uyu={data.totales.UYU.total} />
            <Metric label="Vencido" usd={data.totales.USD.VENCIDO} uyu={data.totales.UYU.VENCIDO} tone="text-red-400" />
            <Metric label="Vence en 7 días" usd={data.totales.USD.HASTA_7} uyu={data.totales.UYU.HASTA_7} />
            <Metric label="8 a 30 días" usd={data.totales.USD.HASTA_30} uyu={data.totales.UYU.HASTA_30} />
          </div>
          {excedidos.length > 0 && (
            <p className="rounded-lg bg-red-500/10 px-3 py-2 text-sm text-red-400">
              Pasados del límite de crédito: {excedidos.map((p) => p.supplier.nombre).join(', ')}.
            </p>
          )}
          <ProveedoresTabla proveedores={data.proveedores} />
        </>
      )}
    </div>
  );
}

/** La bandeja de facturas recibidas. Va arriba de Facturas. */
export { BandejaRecibidas };

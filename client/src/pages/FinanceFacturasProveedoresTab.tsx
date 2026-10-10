import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'react-hot-toast';

import { Spinner } from '../components/ui/Spinner';
import { getSuppliers } from '../api/finance.api';
import {
  crearProveedorDesdeRut, getFacturasProveedores, type FacturaProveedorFila,
} from '../api/cuentasPorPagar.api';
import { usePermission } from '../hooks/usePermission';
import { PdfFacturaRecibida } from '../components/finance/PdfFacturaRecibida';
import { CargarFacturaRecibidaModal } from '../components/finance/CargarFacturaRecibidaModal';
import { fmtCurrency, fmtDate } from '../lib/finance';

function klass(...p: (string | false | undefined)[]) { return p.filter(Boolean).join(' '); }
function apiErr(err: unknown) {
  return (err as { response?: { data?: { message?: string } } })?.response?.data?.message;
}

const sel = 'rounded-lg border border-[var(--color-border)] bg-[var(--color-bg-card)] px-3 py-2 text-sm text-[var(--color-text-primary)]';

const ESTADO_PAGO: Record<string, string> = {
  COMPROMETIDO: 'Comprometida',
  A_PAGAR: 'A pagar',
  PARCIALMENTE_PAGADO: 'Pago parcial',
  PAGADO: 'Pagada',
};

/** En qué está la factura, en palabras: bandeja, deuda o pago. */
function Estado({ f }: { f: FacturaProveedorFila }) {
  if (f.estadoBandeja === 'PENDIENTE') return <span className="text-amber-400">Por revisar</span>;
  if (f.estadoBandeja === 'DESCARTADA') return <span className="text-[var(--color-text-muted)]" title={f.motivoDescarte ?? ''}>Descartada: {f.motivoDescarte}</span>;
  if (!f.estadoPago) return <span>—</span>;
  return (
    <span className={f.estadoPago === 'PAGADO' ? 'text-green-400' : undefined}>
      {ESTADO_PAGO[f.estadoPago] ?? f.estadoPago}
      {f.saldo != null && f.saldo > 0.005 && f.estadoPago !== 'PAGADO' && (
        <span className="block text-[11px] text-[var(--color-text-muted)]">Saldo {fmtCurrency(f.saldo, f.moneda)}</span>
      )}
    </span>
  );
}

const FILTROS_KEY = 'finance-facturas-proveedores-v1';

export function FinanceFacturasProveedoresTab() {
  const qc = useQueryClient();
  const canEdit = usePermission('FINANZAS', 'EDIT');
  const [proveedor, setProveedor] = useState('');
  const [desde, setDesde] = useState('');
  const [hasta, setHasta] = useState('');
  const [origen, setOrigen] = useState<'todas' | 'electronica' | 'manual'>('todas');
  const [buscar, setBuscar] = useState('');
  const [cargando, setCargando] = useState(false);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(FILTROS_KEY);
      if (raw) {
        const p = JSON.parse(raw) as { proveedor?: string; origen?: typeof origen };
        if (typeof p.proveedor === 'string') setProveedor(p.proveedor);
        if (p.origen === 'todas' || p.origen === 'electronica' || p.origen === 'manual') setOrigen(p.origen);
      }
    } catch { /* sin preferencias guardadas */ }
  }, []);
  useEffect(() => {
    try { localStorage.setItem(FILTROS_KEY, JSON.stringify({ proveedor, origen })); } catch { /* ignore */ }
  }, [proveedor, origen]);

  const params = {
    ...(proveedor ? { proveedor } : {}),
    ...(desde ? { desde } : {}),
    ...(hasta ? { hasta } : {}),
    origen,
    ...(buscar.trim() ? { buscar: buscar.trim() } : {}),
  };
  const { data, isLoading } = useQuery({
    queryKey: ['facturas-proveedores', params],
    queryFn: () => getFacturasProveedores(params),
  });
  const { data: proveedores = [] } = useQuery({
    queryKey: ['suppliers', 'todos-registro'],
    queryFn: () => getSuppliers({ activo: 'all' }),
  });

  const alta = useMutation({
    mutationFn: (v: { rut: string; nombre?: string }) => crearProveedorDesdeRut(v.rut, v.nombre),
    onSuccess: (r) => {
      toast.success(`${r.nombre} dado de alta (${r.facturasAsignadas} factura${r.facturasAsignadas === 1 ? '' : 's'})`);
      qc.invalidateQueries({ queryKey: ['facturas-proveedores'] });
      qc.invalidateQueries({ queryKey: ['facturas-recibidas'] });
      qc.invalidateQueries({ queryKey: ['suppliers'] });
    },
    onError: (e) => toast.error(apiErr(e) ?? 'No se pudo dar de alta'),
  });

  function darDeAlta(rut: string, razonSocial: string | null) {
    const nombre = window.prompt(`Nombre del proveedor con RUT ${rut}:`, razonSocial ?? '');
    if (nombre === null) return;
    alta.mutate({ rut, nombre: nombre.trim() || undefined });
  }

  const sinAlta = data?.emisoresSinAlta ?? [];

  return (
    <div className="space-y-5">
      <p className="text-sm text-[var(--color-text-secondary)]">
        Todas las facturas de proveedores: las que llegaron por la facturación electrónica —también las de
        empresas que todavía no están dadas de alta como proveedor— y las que se cargaron a mano.
      </p>

      {cargando && <CargarFacturaRecibidaModal onClose={() => setCargando(false)} />}
      <div className="flex flex-wrap gap-2">
        {canEdit && (
          <button className="rounded-lg bg-[var(--color-accent)] px-3 py-2 text-sm font-semibold text-gray-900 hover:bg-[var(--color-accent-hover)]"
            onClick={() => setCargando(true)}>Cargar factura a mano</button>
        )}
        <select className={sel} value={proveedor} onChange={(e) => setProveedor(e.target.value)}>
          <option value="">Todos los proveedores</option>
          <option value="sin-proveedor">Sin proveedor en el sistema{sinAlta.length ? ` (${sinAlta.length})` : ''}</option>
          <optgroup label="Proveedores">
            {proveedores.map((p) => <option key={p.id} value={p.id}>{p.nombre}{p.activo ? '' : ' (inactivo)'}</option>)}
          </optgroup>
          {sinAlta.length > 0 && (
            <optgroup label="Emisores sin dar de alta">
              {sinAlta.map((e) => <option key={e.rut} value={`rut:${e.rut}`}>{e.razonSocial ?? 'Sin nombre'} · RUT {e.rut}</option>)}
            </optgroup>
          )}
        </select>
        <select className={sel} value={origen} onChange={(e) => setOrigen(e.target.value as typeof origen)}>
          <option value="todas">Electrónicas y a mano</option>
          <option value="electronica">Solo electrónicas</option>
          <option value="manual">Solo cargadas a mano</option>
        </select>
        <label className="flex items-center gap-1 text-xs text-[var(--color-text-muted)]">
          Desde <input type="date" className={sel} value={desde} onChange={(e) => setDesde(e.target.value)} />
        </label>
        <label className="flex items-center gap-1 text-xs text-[var(--color-text-muted)]">
          Hasta <input type="date" className={sel} value={hasta} onChange={(e) => setHasta(e.target.value)} />
        </label>
        <input className={klass(sel, 'min-w-[200px]')} placeholder="Buscar número, RUT, obra…" value={buscar} onChange={(e) => setBuscar(e.target.value)} />
      </div>

      {sinAlta.length > 0 && canEdit && (
        <div className="rounded-lg bg-amber-500/10 px-3 py-2 text-sm text-amber-400">
          Hay facturas de empresas que todavía no son proveedores en Voltia PM:
          <div className="mt-1 flex flex-wrap gap-2">
            {sinAlta.map((e) => (
              <button key={e.rut} disabled={alta.isPending} onClick={() => darDeAlta(e.rut, e.razonSocial)}
                className="rounded-md border border-amber-500/40 px-2 py-0.5 text-xs hover:bg-amber-500/10">
                Dar de alta {e.razonSocial ?? `RUT ${e.rut}`} ({e.facturas})
              </button>
            ))}
          </div>
        </div>
      )}

      {isLoading || !data ? <Spinner /> : (
        <>
          <p className="text-xs text-[var(--color-text-muted)]">
            {data.facturas.length} factura{data.facturas.length === 1 ? '' : 's'}
            {Object.entries(data.totales).map(([m, v]) => ` · ${fmtCurrency(v ?? 0, m as 'USD' | 'UYU')}`).join('')}
            {' '}(sin contar las descartadas; las notas de crédito restan)
          </p>
          {data.facturas.length === 0 ? (
            <p className="rounded-xl border border-[var(--color-border)] bg-[var(--color-bg-card)] p-8 text-center text-sm text-[var(--color-text-muted)]">
              No hay facturas con estos filtros.
            </p>
          ) : (
            <div className="overflow-x-auto rounded-xl border border-[var(--color-border)] bg-[var(--color-bg-card)]">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-[11px] uppercase tracking-wider text-[var(--color-text-muted)] border-b border-[var(--color-border)]">
                    <th className="px-3 py-2">Emitida</th>
                    <th className="px-3 py-2">Proveedor</th>
                    <th className="px-3 py-2">Comprobante</th>
                    <th className="px-3 py-2">Obra</th>
                    <th className="px-3 py-2 text-right">Neto</th>
                    <th className="px-3 py-2 text-right">IVA</th>
                    <th className="px-3 py-2 text-right">Total</th>
                    <th className="px-3 py-2">Vence</th>
                    <th className="px-3 py-2">Estado</th>
                  </tr>
                </thead>
                <tbody>
                  {data.facturas.map((f) => (
                    <tr key={`${f.origen}-${f.id}`} className="border-b border-[var(--color-border)] align-top">
                      <td className="px-3 py-2 whitespace-nowrap">{fmtDate(f.fechaEmision)}</td>
                      <td className="px-3 py-2">
                        {f.proveedor ? (
                          <Link to={`/finanzas/proveedores/${f.proveedor.id}`} className="font-medium text-[var(--color-text-primary)] hover:underline">
                            {f.proveedor.nombre}
                          </Link>
                        ) : (
                          <span className="font-medium text-amber-400">{f.razonSocial ?? 'Sin dar de alta'}</span>
                        )}
                        {f.rut && <span className="block text-[11px] text-[var(--color-text-muted)]">RUT {f.rut}</span>}
                      </td>
                      <td className="px-3 py-2">
                        {f.comprobante}
                        <span className="block text-[11px] text-[var(--color-text-muted)]">
                          {f.origen === 'MANUAL'
                            ? 'Cargada a mano'
                            : [f.enDgi && 'DGI', f.enMail && 'mail', f.enManual && 'a mano'].filter(Boolean).join(' + ')}
                          {f.descripcion && f.origen === 'MANUAL' ? ` · ${f.descripcion}` : ''}
                        </span>
                        {f.origen === 'ELECTRONICA' && f.pdf && (
                          <span className="mt-1 block"><PdfFacturaRecibida id={f.id} pdf={f.pdf} /></span>
                        )}
                      </td>
                      <td className="px-3 py-2 text-[12px]">{f.project ? `${f.project.code} · ${f.project.clientName}` : '—'}</td>
                      <td className="px-3 py-2 text-right tabular-nums">{f.totalNeto != null ? fmtCurrency(f.totalNeto, f.moneda) : '—'}</td>
                      <td className="px-3 py-2 text-right tabular-nums">{f.iva != null ? fmtCurrency(f.iva, f.moneda) : '—'}</td>
                      <td className={klass('px-3 py-2 text-right tabular-nums font-medium', f.total < 0 && 'text-green-400')}>{fmtCurrency(f.total, f.moneda)}</td>
                      <td className="px-3 py-2 whitespace-nowrap">{fmtDate(f.vencimiento)}</td>
                      <td className="px-3 py-2 text-[12px]"><Estado f={f} /></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}
    </div>
  );
}

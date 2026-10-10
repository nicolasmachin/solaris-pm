import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';

import { Spinner } from '../components/ui/Spinner';
import { getHistorialFinanzas } from '../api/historial.api';

const sel = 'rounded-lg border border-[var(--color-border)] bg-[var(--color-bg-card)] px-3 py-2 text-sm text-[var(--color-text-primary)]';

const ENTIDADES: Array<{ valor: string; label: string }> = [
  { valor: 'finance_movement', label: 'Movimientos y cobros' },
  { valor: 'payment', label: 'Pagos a proveedores' },
  { valor: 'payment_application', label: 'Aplicación de pagos' },
  { valor: 'supplier', label: 'Proveedores' },
  { valor: 'account', label: 'Cuentas' },
  { valor: 'commission', label: 'Comisiones' },
  { valor: 'installer_payment', label: 'Pagos a instaladores' },
  { valor: 'factura_recibida', label: 'Facturas recibidas' },
  { valor: 'conciliacion_proveedor', label: 'Conciliaciones' },
];
const LABEL_ENTIDAD = Object.fromEntries(ENTIDADES.map((e) => [e.valor, e.label]));

const ACCIONES: Record<string, string> = {
  created: 'Alta', updated: 'Cambio', deleted: 'Baja', status_changed: 'Cambio de estado',
};

/**
 * Historial de Finanzas: qué se cargó, cambió o borró, quién y cuándo, con el
 * valor anterior y el nuevo. Es la herramienta para auditar el módulo.
 */
export function FinanceHistorialTab() {
  const [desde, setDesde] = useState('');
  const [hasta, setHasta] = useState('');
  const [userId, setUserId] = useState('');
  const [entidad, setEntidad] = useState('');
  const [accion, setAccion] = useState('');
  const [buscar, setBuscar] = useState('');
  const [page, setPage] = useState(1);

  const params = {
    ...(desde ? { desde } : {}), ...(hasta ? { hasta } : {}), ...(userId ? { userId } : {}),
    ...(entidad ? { entidad } : {}), ...(accion ? { accion } : {}), ...(buscar.trim() ? { buscar: buscar.trim() } : {}),
    page,
  };
  const { data, isLoading } = useQuery({
    queryKey: ['finance-historial', params],
    queryFn: () => getHistorialFinanzas(params),
  });
  const set = <T,>(f: (v: T) => void) => (v: T) => { f(v); setPage(1); };
  const paginas = data ? Math.max(1, Math.ceil(data.total / data.porPagina)) : 1;

  return (
    <div className="space-y-4">
      <p className="text-sm text-[var(--color-text-secondary)]">
        Todo lo que se cargó, cambió o borró en Finanzas: quién, cuándo y, en cada cambio, el valor anterior y el nuevo.
      </p>
      <div className="flex flex-wrap gap-2">
        <label className="flex items-center gap-1 text-xs text-[var(--color-text-muted)]">
          Desde <input type="date" className={sel} value={desde} onChange={(e) => set(setDesde)(e.target.value)} />
        </label>
        <label className="flex items-center gap-1 text-xs text-[var(--color-text-muted)]">
          Hasta <input type="date" className={sel} value={hasta} onChange={(e) => set(setHasta)(e.target.value)} />
        </label>
        <select className={sel} value={userId} onChange={(e) => set(setUserId)(e.target.value)}>
          <option value="">Todas las personas</option>
          {(data?.usuarios ?? []).map((u) => <option key={u.id} value={u.id}>{u.name}</option>)}
        </select>
        <select className={sel} value={entidad} onChange={(e) => set(setEntidad)(e.target.value)}>
          <option value="">Todo</option>
          {ENTIDADES.map((e) => <option key={e.valor} value={e.valor}>{e.label}</option>)}
        </select>
        <select className={sel} value={accion} onChange={(e) => set(setAccion)(e.target.value)}>
          <option value="">Altas, cambios y bajas</option>
          {Object.entries(ACCIONES).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
        </select>
        <input className={`${sel} min-w-[200px]`} placeholder="Buscar en la descripción…" value={buscar}
          onChange={(e) => set(setBuscar)(e.target.value)} />
      </div>

      {isLoading || !data ? <Spinner /> : data.entradas.length === 0 ? (
        <p className="rounded-xl border border-[var(--color-border)] bg-[var(--color-bg-card)] p-8 text-center text-sm text-[var(--color-text-muted)]">
          No hay registros con estos filtros.
        </p>
      ) : (
        <>
          <div className="overflow-x-auto rounded-xl border border-[var(--color-border)] bg-[var(--color-bg-card)]">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-[11px] uppercase tracking-wider text-[var(--color-text-muted)] border-b border-[var(--color-border)]">
                  <th className="px-3 py-2">Cuándo</th>
                  <th className="px-3 py-2">Quién</th>
                  <th className="px-3 py-2">Qué</th>
                  <th className="px-3 py-2">Detalle</th>
                  <th className="px-3 py-2">Antes</th>
                  <th className="px-3 py-2">Después</th>
                </tr>
              </thead>
              <tbody>
                {data.entradas.map((e) => (
                  <tr key={e.id} className="border-b border-[var(--color-border)] align-top">
                    <td className="px-3 py-2 whitespace-nowrap text-[12px]">{new Date(e.timestamp).toLocaleString('es-UY')}</td>
                    <td className="px-3 py-2 whitespace-nowrap">{e.usuario.name}</td>
                    <td className="px-3 py-2 text-[12px]">
                      <span className="font-medium">{ACCIONES[e.accion] ?? e.accion}</span>
                      <span className="block text-[var(--color-text-muted)]">{LABEL_ENTIDAD[e.entidad] ?? e.entidad}</span>
                    </td>
                    <td className="px-3 py-2 text-[12px]">
                      {e.descripcion}
                      {e.project && <span className="block text-[var(--color-text-muted)]">{e.project.code} · {e.project.clientName}</span>}
                    </td>
                    <td className="px-3 py-2 text-[12px] text-red-400">{e.campo ? (e.antes ?? 'vacío') : ''}</td>
                    <td className="px-3 py-2 text-[12px] text-green-400">{e.campo ? (e.despues ?? 'vacío') : ''}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="flex items-center justify-between text-xs text-[var(--color-text-muted)]">
            <span>{data.total} registro{data.total === 1 ? '' : 's'}</span>
            <div className="flex items-center gap-2">
              <button className="rounded-md border border-[var(--color-border)] px-2 py-1 disabled:opacity-40" disabled={page <= 1} onClick={() => setPage(page - 1)}>Anterior</button>
              <span>Página {page} de {paginas}</span>
              <button className="rounded-md border border-[var(--color-border)] px-2 py-1 disabled:opacity-40" disabled={page >= paginas} onClick={() => setPage(page + 1)}>Siguiente</button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}

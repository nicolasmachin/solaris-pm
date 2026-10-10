import { useRef, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'react-hot-toast';
import { FileUp, RefreshCw } from 'lucide-react';

import { Spinner } from '../ui/Spinner';
import {
  abrirArchivoConciliacion, getConciliacion, getConciliaciones, recompararConciliacion, subirEstadoDeCuenta,
  type ConciliacionDetalle, type ItemVoltia, type LineaEstado,
} from '../../api/cuentasPorPagar.api';
import { usePermission } from '../../hooks/usePermission';
import { fmtCurrency, fmtDate } from '../../lib/finance';

function klass(...p: (string | false | undefined)[]) { return p.filter(Boolean).join(' '); }
function apiErr(err: unknown) {
  return (err as { response?: { data?: { message?: string } } })?.response?.data?.message;
}

const TIPO_LINEA: Record<LineaEstado['tipo'], string> = {
  FACTURA: 'Factura', NOTA_CREDITO: 'Nota de crédito', PAGO: 'Pago', OTRO: 'Otro',
};
const card = 'rounded-xl border border-[var(--color-border)] bg-[var(--color-bg-card)]';
const btn = 'inline-flex items-center gap-1 rounded-lg border border-[var(--color-border)] px-3 py-1.5 text-sm text-[var(--color-text-secondary)] hover:bg-[var(--color-bg-card-hover)] disabled:opacity-50';

function Linea({ l, moneda }: { l: LineaEstado; moneda: 'USD' | 'UYU' }) {
  return (
    <span>
      {fmtDate(l.fecha)} · {TIPO_LINEA[l.tipo]} {l.numero ?? ''} · <b className="tabular-nums">{fmtCurrency(l.importe, moneda)}</b>
    </span>
  );
}
function Voltia({ v, moneda }: { v: ItemVoltia; moneda: 'USD' | 'UYU' }) {
  return (
    <span>
      {fmtDate(v.fecha)} · {v.clase === 'PAGO' ? 'Pago' : 'Factura'} {v.numero ?? ''} {v.descripcion ? `· ${v.descripcion}` : ''} · <b className="tabular-nums">{fmtCurrency(v.importe, moneda)}</b>
    </span>
  );
}

function Bloque({ titulo, ayuda, tono, children, vacio }: { titulo: string; ayuda: string; tono?: string; children: React.ReactNode; vacio: boolean }) {
  return (
    <div className={klass(card, 'p-4')}>
      <p className={klass('text-sm font-semibold', tono ?? 'text-[var(--color-text-primary)]')}>{titulo}</p>
      <p className="mb-2 text-[11px] text-[var(--color-text-muted)]">{ayuda}</p>
      {vacio ? <p className="text-xs text-[var(--color-text-muted)]">Ninguno.</p> : <ul className="space-y-1 text-xs text-[var(--color-text-secondary)]">{children}</ul>}
    </div>
  );
}

function Detalle({ c, canEdit }: { c: ConciliacionDetalle; canEdit: boolean }) {
  const qc = useQueryClient();
  const recomparar = useMutation({
    mutationFn: () => recompararConciliacion(c.id),
    onSuccess: (d) => {
      qc.setQueryData(['conciliacion', c.id], d);
      qc.invalidateQueries({ queryKey: ['conciliaciones', c.supplierId] });
      toast.success('Comparado de nuevo con lo cargado hoy');
    },
    onError: (e) => toast.error(apiErr(e) ?? 'No se pudo comparar'),
  });
  const r = c.resultado;
  const m = c.moneda;
  const cuadra = c.diferenciaSaldo != null && Math.abs(c.diferenciaSaldo) < 0.01;

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        <div className={klass(card, 'p-4')}>
          <p className="text-[11px] uppercase tracking-wider text-[var(--color-text-muted)] font-mono">Saldo según el proveedor</p>
          <p className="mt-1 text-lg font-semibold tabular-nums">{c.saldoProveedor != null ? fmtCurrency(c.saldoProveedor, m) : 'No figura'}</p>
        </div>
        <div className={klass(card, 'p-4')}>
          <p className="text-[11px] uppercase tracking-wider text-[var(--color-text-muted)] font-mono">Saldo según Voltia PM</p>
          <p className="mt-1 text-lg font-semibold tabular-nums">{fmtCurrency(c.saldoVoltia, m)}</p>
        </div>
        <div className={klass(card, 'p-4')}>
          <p className="text-[11px] uppercase tracking-wider text-[var(--color-text-muted)] font-mono">Diferencia</p>
          <p className={klass('mt-1 text-lg font-semibold tabular-nums', cuadra ? 'text-green-400' : 'text-red-400')}>
            {c.diferenciaSaldo == null ? '—' : cuadra ? 'Cuadra' : fmtCurrency(c.diferenciaSaldo, m)}
          </p>
        </div>
      </div>
      <p className="text-[11px] text-[var(--color-text-muted)]">
        Al {fmtDate(c.fechaCorte)}{r.desde ? ` · renglones desde el ${fmtDate(r.desde)}` : ''} · comparado el {new Date(c.calculadoAt).toLocaleString('es-UY')}.
        Diferencia positiva: el proveedor dice que se le debe más de lo que figura en Voltia PM.
      </p>
      <div className="flex flex-wrap gap-2">
        <button className={btn} onClick={() => abrirArchivoConciliacion(c.id).catch(() => toast.error('No se pudo abrir'))}>
          Ver el estado de cuenta ({c.archivoNombre})
        </button>
        {canEdit && (
          <button className={btn} disabled={recomparar.isPending} onClick={() => recomparar.mutate()}
            title="Después de cargar lo que faltaba: compara el mismo estado de cuenta con lo que hay hoy, sin volver a leer el archivo">
            <RefreshCw className={klass('w-3.5 h-3.5', recomparar.isPending && 'animate-spin')} /> Volver a comparar
          </button>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
        <Bloque titulo={`Falta cargar en Voltia PM (${r.soloProveedor.length})`} tono="text-red-400"
          ayuda="Están en el estado de cuenta del proveedor y no en Voltia PM: revisar la bandeja de facturas recibidas o cargarlas."
          vacio={r.soloProveedor.length === 0}>
          {r.soloProveedor.map((l, i) => <li key={i}><Linea l={l} moneda={m} /></li>)}
        </Bloque>
        <Bloque titulo={`El proveedor no la tiene (${r.soloVoltia.length})`} tono="text-amber-400"
          ayuda="Están en Voltia PM y no en el estado de cuenta: puede ser un pago que el proveedor no imputó o una carga de más."
          vacio={r.soloVoltia.length === 0}>
          {r.soloVoltia.map((v) => <li key={v.id}><Voltia v={v} moneda={m} /></li>)}
        </Bloque>
        <Bloque titulo={`Montos distintos (${r.diferenciasMonto.length})`} tono="text-amber-400"
          ayuda="El mismo comprobante, con distinto importe de un lado y del otro."
          vacio={r.diferenciasMonto.length === 0}>
          {r.diferenciasMonto.map((d, i) => (
            <li key={i}>
              Proveedor: <Linea l={d.linea} moneda={m} /><br />
              Voltia PM: <Voltia v={d.voltia} moneda={m} />
              <span className="ml-1 font-semibold text-amber-400">({d.diferencia > 0 ? '+' : ''}{fmtCurrency(d.diferencia, m)})</span>
            </li>
          ))}
        </Bloque>
        <Bloque titulo={`Coinciden (${r.coinciden.length})`} tono="text-green-400"
          ayuda="Están de los dos lados con el mismo importe." vacio={r.coinciden.length === 0}>
          {r.coinciden.map((x, i) => <li key={i}><Linea l={x.linea} moneda={m} /></li>)}
        </Bloque>
      </div>
      {r.otras.length > 0 && (
        <Bloque titulo={`Otros renglones (${r.otras.length})`} ayuda="Renglones que no son facturas, notas de crédito ni pagos: no se comparan." vacio={false}>
          {r.otras.map((l, i) => <li key={i}><Linea l={l} moneda={m} /> {l.descripcion ? `· ${l.descripcion}` : ''}</li>)}
        </Bloque>
      )}
    </div>
  );
}

export function ConciliacionProveedor({ supplierId }: { supplierId: string }) {
  const qc = useQueryClient();
  const canEdit = usePermission('FINANZAS', 'EDIT');
  const input = useRef<HTMLInputElement>(null);
  const [seleccion, setSeleccion] = useState<string | null>(null);
  const [moneda, setMoneda] = useState<'' | 'USD' | 'UYU'>('');
  const [fechaCorte, setFechaCorte] = useState('');

  const { data: lista = [], isLoading } = useQuery({
    queryKey: ['conciliaciones', supplierId],
    queryFn: () => getConciliaciones(supplierId),
  });
  const actual = seleccion ?? lista[0]?.id ?? null;
  const { data: detalle, isLoading: cargandoDetalle } = useQuery({
    queryKey: ['conciliacion', actual],
    queryFn: () => getConciliacion(actual!),
    enabled: !!actual,
  });

  const subir = useMutation({
    mutationFn: (file: File) => subirEstadoDeCuenta(supplierId, file, {
      ...(moneda ? { moneda } : {}), ...(fechaCorte ? { fechaCorte } : {}),
    }),
    onSuccess: (d) => {
      qc.setQueryData(['conciliacion', d.id], d);
      qc.invalidateQueries({ queryKey: ['conciliaciones', supplierId] });
      setSeleccion(d.id);
      toast.success('Estado de cuenta leído y comparado');
    },
    onError: (e) => toast.error(apiErr(e) ?? 'No se pudo leer el estado de cuenta'),
  });

  return (
    <div className="space-y-4">
      <p className="text-sm text-[var(--color-text-secondary)]">
        Se sube el estado de cuenta que mandó el proveedor (PDF, Excel o una foto) y Voltia PM lo compara con lo que
        tiene cargado: qué coincide, qué falta de cada lado y si los saldos cuadran.
      </p>
      {canEdit && (
        <div className={klass(card, 'flex flex-wrap items-end gap-3 p-4')}>
          <label className="text-xs text-[var(--color-text-muted)]">
            Moneda
            <select className="mt-1 block rounded-lg border border-[var(--color-border)] bg-[var(--color-bg-app)] px-2 py-1.5 text-sm"
              value={moneda} onChange={(e) => setMoneda(e.target.value as typeof moneda)}>
              <option value="">La del documento</option>
              <option value="USD">USD</option>
              <option value="UYU">UYU</option>
            </select>
          </label>
          <label className="text-xs text-[var(--color-text-muted)]">
            Al día
            <input type="date" className="mt-1 block rounded-lg border border-[var(--color-border)] bg-[var(--color-bg-app)] px-2 py-1.5 text-sm"
              value={fechaCorte} onChange={(e) => setFechaCorte(e.target.value)} />
          </label>
          <input ref={input} type="file" accept=".pdf,.xlsx,image/*" className="hidden"
            onChange={(e) => { const f = e.target.files?.[0]; if (f) subir.mutate(f); e.target.value = ''; }} />
          <button className={klass(btn, 'bg-[var(--color-accent)] text-gray-900 font-semibold border-transparent hover:bg-[var(--color-accent-hover)]')}
            disabled={subir.isPending} onClick={() => input.current?.click()}>
            <FileUp className="w-4 h-4" /> {subir.isPending ? 'Leyendo el estado de cuenta…' : 'Subir estado de cuenta'}
          </button>
          <p className="w-full text-[11px] text-[var(--color-text-muted)]">
            Moneda y fecha: solo si el documento no las dice claro. Leerlo tarda unos segundos.
          </p>
        </div>
      )}

      {isLoading ? <Spinner /> : lista.length === 0 ? (
        <p className={klass(card, 'p-6 text-center text-sm text-[var(--color-text-muted)]')}>Todavía no se concilió ningún estado de cuenta de este proveedor.</p>
      ) : (
        <>
          {lista.length > 1 && (
            <select className="rounded-lg border border-[var(--color-border)] bg-[var(--color-bg-card)] px-3 py-1.5 text-sm"
              value={actual ?? ''} onChange={(e) => setSeleccion(e.target.value)}>
              {lista.map((c) => (
                <option key={c.id} value={c.id}>
                  Al {fmtDate(c.fechaCorte)} · subido el {new Date(c.createdAt).toLocaleDateString('es-UY')}
                  {c.diferenciaSaldo != null ? ` · diferencia ${fmtCurrency(c.diferenciaSaldo, c.moneda)}` : ''}
                </option>
              ))}
            </select>
          )}
          {cargandoDetalle || !detalle ? <Spinner /> : <Detalle c={detalle} canEdit={canEdit} />}
        </>
      )}
    </div>
  );
}

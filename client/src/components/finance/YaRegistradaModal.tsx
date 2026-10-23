import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { toast } from 'react-hot-toast';

import { getAccounts } from '../../api/accounts.api';
import {
  buscarGastosParaFactura, crearGastoDesdeFactura, marcarFacturaContemplada, vincularFacturaRecibida,
  type FacturaRecibida,
} from '../../api/cuentasPorPagar.api';
import { getExchangeRate } from '../../api/finance.api';
import { fmtCurrency, fmtDate } from '../../lib/finance';
import { todayLocalISO } from '../../utils/date';
import { Sheet } from '../ui/Sheet';
import { ProjectPicker } from './ProjectPicker';

// "Ya está registrada": una factura recibida que no va como deuda. Tres caminos:
//  - es de un gasto ya cargado (se busca y se elige a mano);
//  - es una compra de contado que nadie cargó: se crea el gasto pagado desde acá;
//  - ya está contemplada (entró en el saldo de arranque, la pagó otra empresa…).
// A diferencia de descartar, las tres siguen en el archivo de compras de la contadora.

type Modo = 'VINCULAR' | 'CREAR' | 'CONTEMPLADA';
type Categoria = 'VARIABLE' | 'FIJO' | 'PROYECTO_SALIDA' | 'COMPRA_STOCK' | 'OTRO';

const CATEGORIAS: Array<[Categoria, string]> = [
  ['VARIABLE', 'Costo variable'],
  ['FIJO', 'Costo fijo'],
  ['COMPRA_STOCK', 'Compra para stock'],
  ['OTRO', 'Otro'],
];

const inp = 'w-full rounded-lg border border-[var(--color-border)] bg-[var(--color-bg-app)] px-3 py-2 text-sm text-[var(--color-text-primary)] focus:outline-none focus:ring-2 focus:ring-[var(--color-accent)]';
const lbl = 'block text-[10px] font-mono uppercase tracking-wider text-[var(--color-text-muted)] mb-1';

function apiErr(e: unknown): string | undefined {
  return (e as { response?: { data?: { message?: string } } })?.response?.data?.message;
}

export function YaRegistradaModal({ f, onClose, onDone }: { f: FacturaRecibida; onClose: () => void; onDone: () => void }) {
  const [modo, setModo] = useState<Modo>('VINCULAR');
  const [saving, setSaving] = useState(false);

  // Vincular
  const [buscar, setBuscar] = useState('');
  const { data: gastos = [], isFetching } = useQuery({
    queryKey: ['gastos-para-factura', f.id, buscar],
    queryFn: () => buscarGastosParaFactura(f.id, buscar.trim() || undefined),
    enabled: modo === 'VINCULAR',
  });

  // Crear
  const { data: cuentas = [] } = useQuery({ queryKey: ['accounts', 'true'], queryFn: () => getAccounts({ activa: 'true' }), enabled: modo === 'CREAR' });
  const [accountId, setAccountId] = useState('');
  const [fecha, setFecha] = useState(f.fechaEmision.slice(0, 10) || todayLocalISO());
  const [categoria, setCategoria] = useState<Categoria>('VARIABLE');
  const [projectId, setProjectId] = useState('');
  const [descripcion, setDescripcion] = useState('');
  const cuenta = cuentas.find((c) => c.id === accountId);
  const otraMoneda = !!cuenta && cuenta.moneda !== f.moneda;
  const { data: cotizacion } = useQuery({ queryKey: ['exchange-rate'], queryFn: getExchangeRate, enabled: otraMoneda, retry: false });
  const [tcTxt, setTcTxt] = useState('');
  const tc = parseFloat((tcTxt || (cotizacion ? String(cotizacion.usdToUyu) : '')).replace(',', '.'));
  const saleDeCuenta = otraMoneda && tc > 0 ? (cuenta!.moneda === 'UYU' ? f.total * tc : f.total / tc) : f.total;

  // Contemplada
  const [motivo, setMotivo] = useState('');

  async function correr(fn: () => Promise<unknown>, ok: string) {
    setSaving(true);
    try {
      await fn();
      toast.success(ok);
      onDone();
      onClose();
    } catch (e) {
      toast.error(apiErr(e) ?? 'No se pudo');
    } finally {
      setSaving(false);
    }
  }

  function confirmar() {
    if (modo === 'CREAR') {
      if (!accountId) return toast.error('Elegí de qué cuenta salió la plata');
      if (otraMoneda && !(tc > 0)) return toast.error('Falta la cotización');
      return correr(() => crearGastoDesdeFactura(f.id, {
        accountId, fecha, categoriaPrincipal: projectId ? 'PROYECTO_SALIDA' : categoria,
        projectId: projectId || null, ...(descripcion.trim() ? { descripcion: descripcion.trim() } : {}),
        ...(otraMoneda ? { tipoCambio: tc } : {}),
      }), 'Gasto creado con su factura');
    }
    if (modo === 'CONTEMPLADA') {
      if (motivo.trim().length < 5) return toast.error('Escribí por qué ya está contemplada');
      return correr(() => marcarFacturaContemplada(f.id, motivo.trim()), 'Factura marcada como ya contemplada');
    }
  }

  const tab = (m: Modo, label: string) => (
    <button
      type="button"
      onClick={() => setModo(m)}
      className={`flex-1 rounded-md px-2 py-1.5 text-xs font-medium ${modo === m ? 'bg-[var(--color-accent)] text-gray-900' : 'text-[var(--color-text-secondary)] hover:bg-[var(--color-bg-card-hover)]'}`}
    >
      {label}
    </button>
  );

  return (
    <Sheet
      open
      onClose={onClose}
      size="wide"
      title="Ya está registrada"
      footer={modo === 'VINCULAR' ? (
        <button type="button" onClick={onClose} className="px-4 py-2 rounded-lg border border-[var(--color-border)] text-sm text-[var(--color-text-secondary)]">Cerrar</button>
      ) : (
        <>
          <button type="button" onClick={onClose} className="px-4 py-2 rounded-lg border border-[var(--color-border)] text-sm text-[var(--color-text-secondary)]">Cancelar</button>
          <button type="button" onClick={confirmar} disabled={saving} className="px-4 py-2 rounded-lg bg-[var(--color-accent)] text-gray-900 text-sm font-semibold disabled:opacity-60">
            {saving ? 'Guardando…' : modo === 'CREAR' ? 'Crear el gasto' : 'Marcar contemplada'}
          </button>
        </>
      )}
    >
      <div className="space-y-4">
        <p className="text-sm text-[var(--color-text-secondary)]">
          {f.supplier?.nombre ?? f.razonSocialEmisor ?? `RUT ${f.rutEmisor}`} · {f.tipoLabel} {f.serie}-{f.numero} · {fmtDate(f.fechaEmision)} ·{' '}
          <b className="tabular-nums text-[var(--color-text-primary)]">{fmtCurrency(f.total, f.moneda)}</b>
        </p>
        <div className="flex gap-1 rounded-lg border border-[var(--color-border)] p-1">
          {tab('VINCULAR', 'Es de un gasto ya cargado')}
          {tab('CREAR', 'Crear el gasto pagado')}
          {tab('CONTEMPLADA', 'Ya está contemplada')}
        </div>

        {modo === 'VINCULAR' && (
          <div className="space-y-2">
            <input className={inp} placeholder="Buscar por descripción o monto…" value={buscar} onChange={(e) => setBuscar(e.target.value)} />
            <p className="text-[11px] text-[var(--color-text-muted)]">
              Gastos sin factura del mismo proveedor o cargados sin proveedor, a menos de 90 días; los más cercanos a la fecha primero.
            </p>
            {isFetching && !gastos.length ? <p className="text-sm text-[var(--color-text-muted)]">Buscando…</p> : gastos.length === 0 ? (
              <p className="text-sm text-[var(--color-text-muted)]">No hay gastos que coincidan. Si nadie la cargó, usá «Crear el gasto pagado».</p>
            ) : (
              <div className="max-h-80 overflow-y-auto rounded-lg border border-[var(--color-border)] divide-y divide-[var(--color-border)]">
                {gastos.map((g) => (
                  <div key={g.id} className="flex items-center gap-3 px-3 py-2 text-sm">
                    <span className="w-20 shrink-0 text-[12px] text-[var(--color-text-muted)]">{g.fecha ? fmtDate(g.fecha) : '—'}</span>
                    <span className="flex-1 min-w-0">
                      <span className="text-[var(--color-text-primary)]">{g.descripcion}</span>
                      <span className="block text-[10px] text-[var(--color-text-muted)]">
                        {[g.cuenta, g.obra, g.sinProveedor && 'sin proveedor'].filter(Boolean).join(' · ')}
                      </span>
                    </span>
                    <span className="tabular-nums text-[var(--color-text-secondary)]">{fmtCurrency(g.monto, g.moneda)}</span>
                    <button
                      type="button"
                      disabled={saving}
                      onClick={() => correr(() => vincularFacturaRecibida(f.id, g.id), 'Vinculada al gasto')}
                      className="rounded-md border border-[var(--color-border)] px-2 py-1 text-xs hover:border-[var(--color-accent)]"
                    >
                      Es este
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {modo === 'CREAR' && (
          <div className="space-y-3">
            <p className="text-[11px] text-[var(--color-text-muted)]">
              Para una compra de contado que nadie cargó: crea el gasto ya pagado, con esta factura vinculada.
              {!f.supplier && ' Primero hay que elegir de qué proveedor es la factura.'}
            </p>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className={lbl}>Cuenta de donde salió *</label>
                <select className={inp} value={accountId} onChange={(e) => setAccountId(e.target.value)}>
                  <option value="">— Elegí —</option>
                  {cuentas.map((c) => <option key={c.id} value={c.id}>{c.nombre} ({c.moneda})</option>)}
                </select>
              </div>
              <div>
                <label className={lbl}>Fecha del pago *</label>
                <input type="date" className={inp} value={fecha} onChange={(e) => setFecha(e.target.value)} />
              </div>
              <div>
                <label className={lbl}>Categoría</label>
                <select className={inp} value={projectId ? 'PROYECTO_SALIDA' : categoria} disabled={!!projectId} onChange={(e) => setCategoria(e.target.value as Categoria)}>
                  {projectId && <option value="PROYECTO_SALIDA">Salida de obra</option>}
                  {CATEGORIAS.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
                </select>
              </div>
              <div>
                <label className={lbl}>Obra (opcional)</label>
                <ProjectPicker value={projectId} onChange={setProjectId} />
              </div>
            </div>
            <div>
              <label className={lbl}>Descripción (opcional)</label>
              <input className={inp} value={descripcion} onChange={(e) => setDescripcion(e.target.value)} placeholder={`${f.tipoLabel} ${f.serie}-${f.numero}`} />
            </div>
            {otraMoneda && (
              <div className="grid grid-cols-2 gap-3 rounded-lg border border-[var(--color-border)] p-3">
                <div>
                  <label className={lbl}>Cotización (pesos por dólar) *</label>
                  <input className={inp} inputMode="decimal" value={tcTxt || (cotizacion ? String(cotizacion.usdToUyu) : '')} onChange={(e) => setTcTxt(e.target.value)} />
                </div>
                <div>
                  <label className={lbl}>Sale de la cuenta</label>
                  <p className="py-2 text-sm font-semibold tabular-nums">{tc > 0 ? fmtCurrency(Math.round(saleDeCuenta * 100) / 100, cuenta!.moneda) : '—'}</p>
                </div>
              </div>
            )}
          </div>
        )}

        {modo === 'CONTEMPLADA' && (
          <div className="space-y-2">
            <p className="text-[11px] text-[var(--color-text-muted)]">
              Queda revisada sin crear deuda ni gasto, pero sigue en el archivo de compras para la contadora. Para lo que
              no es de Voltia (personal, error, repetida) va «Descartar».
            </p>
            <label className={lbl}>¿Por qué ya está contemplada? *</label>
            <textarea
              className={inp} rows={3} value={motivo} onChange={(e) => setMotivo(e.target.value)}
              placeholder="Ej.: entró en el saldo con que se arrancó la cuenta del proveedor; la pagó la unipersonal"
            />
          </div>
        )}
      </div>
    </Sheet>
  );
}

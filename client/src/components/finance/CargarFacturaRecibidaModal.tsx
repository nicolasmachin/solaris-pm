import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'react-hot-toast';

import { Sheet } from '../ui/Sheet';
import { ProjectPicker } from './ProjectPicker';
import { getSuppliers } from '../../api/finance.api';
import { cargarFacturaRecibida, subirPdfFacturaRecibida } from '../../api/cuentasPorPagar.api';
import { todayLocalISO } from '../../utils/date';

const inp = 'w-full rounded-lg border border-[var(--color-border)] bg-[var(--color-bg-app)] px-3 py-2 text-sm text-[var(--color-text-primary)] focus:outline-none focus:ring-2 focus:ring-[var(--color-accent)]';
const lbl = 'block text-[11px] uppercase tracking-wider text-[var(--color-text-muted)] mb-1 font-mono';

const TIPOS = [
  { valor: 111, label: 'e-Factura' },
  { valor: 101, label: 'e-Ticket' },
  { valor: 113, label: 'Nota de débito (e-Factura)' },
  { valor: 112, label: 'Nota de crédito (e-Factura)' },
  { valor: 102, label: 'Nota de crédito (e-Ticket)' },
];

/**
 * Tercer camino de carga de una factura que le emitieron a Voltia, además de
 * Biller (DGI y mail): a mano. Entra a la misma bandeja y con los mismos
 * controles, así que no se duplica aunque después llegue también por Biller.
 */
export function CargarFacturaRecibidaModal({ onClose }: { onClose: () => void }) {
  const qc = useQueryClient();
  const [f, setF] = useState({
    supplierId: '', rut: '', razon: '',
    tipoCfe: 111, serie: '', numero: '',
    fechaEmision: todayLocalISO(), fechaVencimiento: '',
    moneda: 'USD' as 'USD' | 'UYU', total: '', iva: '',
    cargarComoDeuda: true, projectId: '',
  });
  const [pdf, setPdf] = useState<File | null>(null);
  const set = (k: keyof typeof f, v: string | number | boolean) => setF((p) => ({ ...p, [k]: v }));

  const { data: proveedores = [] } = useQuery({
    queryKey: ['suppliers', 'activos-carga-recibida'],
    queryFn: () => getSuppliers({ activo: 'true' }),
  });
  const elegido = proveedores.find((p) => p.id === f.supplierId);
  const nuevo = f.supplierId === '__nuevo';
  const esNc = f.tipoCfe === 112 || f.tipoCfe === 102;

  const guardar = useMutation({
    mutationFn: async () => {
      const r = await cargarFacturaRecibida({
        ...(f.supplierId && !nuevo ? { supplierId: f.supplierId } : {}),
        ...(f.rut ? { rutEmisor: f.rut } : {}),
        ...(nuevo && f.razon ? { razonSocialEmisor: f.razon } : {}),
        tipoCfe: f.tipoCfe,
        serie: f.serie.trim(),
        numero: Number(f.numero),
        fechaEmision: f.fechaEmision,
        ...(f.fechaVencimiento ? { fechaVencimiento: f.fechaVencimiento } : {}),
        moneda: f.moneda,
        total: Number(f.total),
        ...(f.iva ? { totalIva: Number(f.iva) } : {}),
        cargarComoDeuda: f.cargarComoDeuda && !esNc,
        ...(f.projectId ? { projectId: f.projectId } : {}),
      });
      if (pdf) await subirPdfFacturaRecibida(r.facturaId, pdf).catch(() => toast.error('La factura se cargó, pero el PDF no se pudo subir'));
      return r;
    },
    onSuccess: (r) => {
      if (r.movementId) toast.success('Factura cargada como deuda');
      else if (r.candidatas.length > 0) toast('Quedó en la bandeja: parece que ya estaba cargada a mano. Vinculala ahí.', { icon: '⚠️', duration: 6000 });
      else if (r.sinProveedor) toast('Quedó en la bandeja: el RUT no es de ningún proveedor. Dalo de alta ahí.', { icon: 'ℹ️', duration: 6000 });
      else toast.success('Factura cargada en la bandeja');
      for (const k of ['facturas-recibidas', 'facturas-proveedores', 'cuentas-por-pagar', 'suppliers', 'finance-posicion', 'finance-cashflow']) {
        qc.invalidateQueries({ queryKey: [k] });
      }
      onClose();
    },
    onError: (e) => toast.error((e as { response?: { data?: { message?: string } } })?.response?.data?.message ?? 'No se pudo cargar la factura', { duration: 7000 }),
  });

  function enviar(e: React.FormEvent) {
    e.preventDefault();
    if (!f.supplierId) return toast.error('Elegí el proveedor');
    if ((nuevo || !elegido?.rut) && !f.rut.trim()) return toast.error('Falta el RUT del proveedor');
    if (!f.serie.trim() || !(Number(f.numero) > 0)) return toast.error('Falta la serie o el número');
    if (!(Number(f.total) > 0)) return toast.error('Falta el total');
    guardar.mutate();
  }

  return (
    <Sheet
      open
      onClose={onClose}
      title="Cargar factura recibida a mano"
      footer={
        <>
          <button type="button" onClick={onClose} className="px-4 py-2 rounded-lg border border-[var(--color-border)] text-sm text-[var(--color-text-secondary)] hover:bg-[var(--color-bg-card-hover)]">Cancelar</button>
          <button type="submit" form="carga-recibida" disabled={guardar.isPending}
            className="px-4 py-2 rounded-lg bg-[var(--color-accent)] text-gray-900 text-sm font-semibold hover:bg-[var(--color-accent-hover)] disabled:opacity-60">
            {guardar.isPending ? 'Guardando…' : 'Cargar factura'}
          </button>
        </>
      }
    >
      <form id="carga-recibida" onSubmit={enviar} className="space-y-3">
        <p className="text-xs text-[var(--color-text-muted)]">
          Para las facturas que llegan por fuera de la facturación electrónica, o mientras no esté activa. Si esa
          factura ya está en Voltia PM (por Biller o cargada antes), no se vuelve a cargar.
        </p>
        <div>
          <label className={lbl}>Proveedor *</label>
          <select className={inp} value={f.supplierId} onChange={(e) => set('supplierId', e.target.value)}>
            <option value="">— Elegí un proveedor —</option>
            {proveedores.map((p) => <option key={p.id} value={p.id}>{p.nombre}{p.rut ? '' : ' (sin RUT)'}</option>)}
            <option value="__nuevo">No está dado de alta…</option>
          </select>
        </div>
        {(nuevo || (elegido && !elegido.rut)) && (
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={lbl}>RUT del proveedor *</label>
              <input className={inp} value={f.rut} onChange={(e) => set('rut', e.target.value)} placeholder="21 1234567 0011" />
            </div>
            {nuevo && (
              <div>
                <label className={lbl}>Razón social</label>
                <input className={inp} value={f.razon} onChange={(e) => set('razon', e.target.value)} placeholder="Si se deja vacía, se toma de DGI" />
              </div>
            )}
          </div>
        )}
        <div className="grid grid-cols-3 gap-3">
          <div>
            <label className={lbl}>Tipo</label>
            <select className={inp} value={f.tipoCfe} onChange={(e) => set('tipoCfe', Number(e.target.value))}>
              {TIPOS.map((t) => <option key={t.valor} value={t.valor}>{t.label}</option>)}
            </select>
          </div>
          <div>
            <label className={lbl}>Serie *</label>
            <input className={inp} value={f.serie} onChange={(e) => set('serie', e.target.value)} placeholder="A" maxLength={4} />
          </div>
          <div>
            <label className={lbl}>Número *</label>
            <input className={inp} inputMode="numeric" value={f.numero} onChange={(e) => set('numero', e.target.value.replace(/\D/g, ''))} placeholder="123456" />
          </div>
        </div>
        <div className="grid grid-cols-3 gap-3">
          <div>
            <label className={lbl}>Moneda</label>
            <select className={inp} value={f.moneda} onChange={(e) => set('moneda', e.target.value)}>
              <option value="USD">USD</option>
              <option value="UYU">UYU</option>
            </select>
          </div>
          <div>
            <label className={lbl}>Total con IVA *</label>
            <input type="number" step="0.01" min={0} className={inp} value={f.total} onChange={(e) => set('total', e.target.value)} />
          </div>
          <div>
            <label className={lbl}>IVA (opcional)</label>
            <input type="number" step="0.01" min={0} className={inp} value={f.iva} onChange={(e) => set('iva', e.target.value)} />
          </div>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className={lbl}>Fecha de emisión *</label>
            <input type="date" className={inp} value={f.fechaEmision} onChange={(e) => set('fechaEmision', e.target.value)} />
          </div>
          <div>
            <label className={lbl}>Vencimiento</label>
            <input type="date" className={inp} value={f.fechaVencimiento} onChange={(e) => set('fechaVencimiento', e.target.value)} />
            <p className="mt-1 text-[11px] text-[var(--color-text-muted)]">
              Vacío: según el plazo del proveedor{elegido ? ` (${elegido.plazoCreditoDias} días)` : ''}.
            </p>
          </div>
        </div>
        <div>
          <label className={lbl}>Obra (opcional)</label>
          <ProjectPicker value={f.projectId} onChange={(v) => set('projectId', v)} />
        </div>
        <div>
          <label className={lbl}>PDF o foto de la factura (opcional)</label>
          <input type="file" accept=".pdf,image/*" onChange={(e) => setPdf(e.target.files?.[0] ?? null)}
            className="block w-full text-sm text-[var(--color-text-secondary)]" />
        </div>
        {esNc ? (
          <p className="rounded-lg bg-amber-500/10 px-3 py-2 text-xs text-amber-400">
            Las notas de crédito quedan en la bandeja: todavía se registran a mano.
          </p>
        ) : (
          <label className="flex items-start gap-2 text-sm text-[var(--color-text-primary)]">
            <input type="checkbox" className="mt-1 accent-[var(--color-accent)]" checked={f.cargarComoDeuda}
              onChange={(e) => set('cargarComoDeuda', e.target.checked)} />
            <span>
              Cargarla como deuda ahora
              <span className="block text-[11px] text-[var(--color-text-muted)]">
                Si no, queda en la bandeja para revisarla. Si parece que ya estaba cargada, queda en la bandeja igual, para vincularla.
              </span>
            </span>
          </label>
        )}
      </form>
    </Sheet>
  );
}

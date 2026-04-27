import { useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'react-hot-toast';
import { Plus, X, ChevronLeft, ChevronRight, ArrowRight, AlertTriangle, FileText, DollarSign, Trash2 } from 'lucide-react';
import { Spinner } from '../components/ui/Spinner';
import { getMovements, getMovement, createMovement, patchMovement, deleteMovement, transitionMovement, cancelMovement, getExchangeRate } from '../api/finance.api';
import { apiClient } from '../api/axios';
import { fmtCurrency, fmtDate, currentMonthYear, MONTH_NAMES } from '../lib/finance';
import type {
  CategoriaPrincipal,
  EstadoAprobacion,
  FinanceMovement,
  FinanceMovementStatus,
  Moneda,
  MovimientoFormData,
  TipoMovimiento,
  Subcategoria,
} from '../types/finance.types';
import {
  CATEGORIA_LABEL,
  CATEGORIAS_INGRESO,
  CATEGORIAS_POR_TIPO,
  ESTADO_APROBACION_LABEL,
  STATUS_COLOR,
  STATUS_LABEL,
  TIPO_MOV_LABEL,
} from '../types/finance.types';
import { CleanupPrevistosModal } from '../components/finance/CleanupPrevistosModal';
import { InvoiceItemsDetail } from '../components/finance/InvoiceItemsDetail';
import { NewPaymentForSupplierModal } from '../components/finance/NewPaymentForSupplierModal';
import { ApplyPaymentModal } from '../components/finance/ApplyPaymentModal';

// ─── Helpers ──────────────────────────────────────────────────────────────────

function klass(...p: (string | false | undefined)[]) { return p.filter(Boolean).join(' '); }

// ─── Movimiento Form ──────────────────────────────────────────────────────────

interface MovFormProps {
  onSuccess: () => void;
  onCancel: () => void;
  initial?: Partial<MovimientoFormData>;
  editId?: string;
  /** Si se pasa, al guardar (creación o edición) se invoca en lugar del cierre normal del modal,
   *  pasando el id para abrir el desglose de la factura. */
  onSavedOpenDesglose?: (id: string) => void;
}

function MovimientoForm({ onSuccess, onCancel, initial, editId, onSavedOpenDesglose }: MovFormProps) {
  const today = new Date().toISOString().split('T')[0];

  const [form, setForm] = useState<MovimientoFormData>({
    fecha: today,
    tipoMovimiento: 'GASTO',
    categoriaPrincipal: 'VARIABLE',
    descripcion: '',
    monto: 0,
    moneda: 'USD',
    pagado: true,
    cobrado: false,
    impactaFlujo: true,
    status: 'PAGADO',
    estadoAprobacion: 'REGISTRADO',
    ...initial,
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [showCleanup, setShowCleanup] = useState(false);
  // Intenciones extra al guardar (sólo aplican a GASTO en A_PAGAR/PAGADO):
  const [markNoMaterialesIntent, setMarkNoMaterialesIntent] = useState(false);
  const [openDesgloseAfter, setOpenDesgloseAfter] = useState(false);
  const [projects, setProjects] = useState<{ id: string; code: string; clientName: string }[]>([]);
  const [suppliers, setSuppliers] = useState<{ id: string; nombre: string }[]>([]);
  const [subcategorias, setSubcategorias] = useState<Subcategoria[]>([]);

  useEffect(() => {
    Promise.all([
      apiClient.get('/api/projects?status=ACTIVE').then(r => r.data),
      apiClient.get('/api/finance/suppliers').then(r => r.data),
    ]).then(([projs, sups]) => {
      setProjects(projs);
      setSuppliers(sups);
    }).catch(() => {});
  }, []);

  useEffect(() => {
    apiClient.get<Subcategoria[]>(`/api/finance/subcategories?categoria=${form.categoriaPrincipal}`)
      .then(r => setSubcategorias(r.data))
      .catch(() => setSubcategorias([]));
  }, [form.categoriaPrincipal]);

  // Pre-load exchange rate when moneda = UYU and tipoCambio not set
  useEffect(() => {
    if (form.moneda === 'UYU' && !form.tipoCambio) {
      getExchangeRate().then(r => {
        if (r?.usdToUyu) setForm(prev => ({ ...prev, tipoCambio: r.usdToUyu }));
      }).catch(() => {});
    }
    if (form.moneda === 'USD') {
      setForm(prev => ({ ...prev, tipoCambio: undefined }));
    }
  }, [form.moneda]);

  function setF<K extends keyof MovimientoFormData>(key: K, value: MovimientoFormData[K]) {
    setForm(prev => {
      const next = { ...prev, [key]: value };
      if (key === 'tipoMovimiento') {
        const cats = CATEGORIAS_POR_TIPO[value as TipoMovimiento] ?? [];
        if (!cats.includes(next.categoriaPrincipal)) next.categoriaPrincipal = cats[0];
        next.subcategoriaId = undefined;
      }
      if (key === 'categoriaPrincipal') next.subcategoriaId = undefined;
      if (key === 'status') {
        const s = value as FinanceMovementStatus;
        next.pagado = s === 'PAGADO';
        if (s !== 'A_PAGAR') next.dueDate = undefined;
        if (s === 'PAGADO') next.expectedDate = undefined;
      }
      return next;
    });
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      let resultId: string;
      if (editId) {
        await patchMovement(editId, form);
        resultId = editId;
        toast.success('Movimiento actualizado');
      } else {
        const created = await createMovement(form);
        resultId = created.id;
        toast.success('Movimiento registrado');
      }
      // Intent extras (sólo aplica a gastos A_PAGAR/PAGADO)
      const aplicaDesglose = form.tipoMovimiento === 'GASTO' && (form.status === 'A_PAGAR' || form.status === 'PAGADO');
      if (aplicaDesglose && markNoMaterialesIntent) {
        try {
          const { markNoMateriales } = await import('../api/finance.api');
          await markNoMateriales(resultId);
          toast.success('Marcado como factura sin materiales');
        } catch (err) {
          const msg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message;
          toast.error(msg ?? 'No se pudo marcar como sin materiales');
        }
      }
      if (aplicaDesglose && openDesgloseAfter && onSavedOpenDesglose) {
        onSavedOpenDesglose(resultId);
        return;
      }
      // Aviso ámbar si quedó como pendiente de desglose sin acción
      if (!editId && aplicaDesglose && !markNoMaterialesIntent && !openDesgloseAfter) {
        toast('Recordá cargar el desglose para que entre al stock.', { icon: '⚠️' });
      }
      onSuccess();
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message;
      setError(msg ?? 'Error al guardar');
    } finally {
      setLoading(false);
    }
  }

  const inp = 'w-full rounded-lg border border-[var(--color-border)] bg-[var(--color-bg-app)] px-3 py-2 text-sm text-[var(--color-text-primary)] focus:outline-none focus:ring-2 focus:ring-[var(--color-accent)]';
  const lbl = 'block text-xs font-mono text-[var(--color-text-muted)] mb-1 uppercase tracking-wider';
  const cats = CATEGORIAS_POR_TIPO[form.tipoMovimiento] ?? [];
  const esIngreso = CATEGORIAS_INGRESO.includes(form.categoriaPrincipal);
  const necesitaProyecto = form.categoriaPrincipal === 'PROYECTO_ENTRADA' || form.categoriaPrincipal === 'PROYECTO_SALIDA';

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {/* Tipo */}
      <div className="grid grid-cols-3 gap-2">
        {(['INGRESO', 'GASTO', 'AJUSTE'] as TipoMovimiento[]).map(tipo => (
          <button key={tipo} type="button" onClick={() => setF('tipoMovimiento', tipo)}
            className={klass('py-2 rounded-lg text-xs font-semibold border transition-colors',
              form.tipoMovimiento === tipo
                ? tipo === 'INGRESO' ? 'bg-green-600 text-white border-green-600'
                  : tipo === 'GASTO' ? 'bg-red-600 text-white border-red-600'
                  : 'bg-[var(--color-accent)] text-gray-900 border-[var(--color-accent)]'
                : 'bg-transparent text-[var(--color-text-secondary)] border-[var(--color-border)] hover:bg-[var(--color-bg-card-hover)]'
            )}
          >
            {TIPO_MOV_LABEL[tipo]}
          </button>
        ))}
      </div>

      {/* Categoría */}
      <div>
        <label className={lbl}>Categoría *</label>
        <select className={inp} value={form.categoriaPrincipal} onChange={e => setF('categoriaPrincipal', e.target.value as CategoriaPrincipal)} required>
          {cats.map(cat => <option key={cat} value={cat}>{CATEGORIA_LABEL[cat]}</option>)}
        </select>
      </div>

      {/* Subcategoría */}
      <div>
        <label className={lbl}>Subcategoría</label>
        <select className={inp} value={form.subcategoriaId ?? ''} onChange={e => setF('subcategoriaId', e.target.value || undefined)} disabled={subcategorias.length === 0}>
          <option value="">Sin subcategoría</option>
          {subcategorias.map(s => <option key={s.id} value={s.id}>{s.nombre}</option>)}
        </select>
      </div>

      {/* Descripción */}
      <div>
        <label className={lbl}>Descripción *</label>
        <input type="text" className={inp} value={form.descripcion} onChange={e => setF('descripcion', e.target.value)} required />
      </div>

      {/* Fecha + Monto */}
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className={lbl}>Fecha *</label>
          <input type="date" className={inp} value={form.fecha} onChange={e => setF('fecha', e.target.value)} required />
        </div>
        <div>
          <label className={lbl}>Monto *</label>
          <div className="flex gap-2">
            <select className="rounded-lg border border-[var(--color-border)] bg-[var(--color-bg-app)] px-2 py-2 text-sm text-[var(--color-text-primary)] focus:outline-none focus:ring-2 focus:ring-[var(--color-accent)]"
              value={form.moneda} onChange={e => setF('moneda', e.target.value as Moneda)}>
              <option value="USD">USD</option>
              <option value="UYU">UYU</option>
            </select>
            <input type="number" className={klass(inp, 'flex-1')} min="0" step="0.01"
              value={form.monto || ''} onChange={e => setF('monto', parseFloat(e.target.value) || 0)} required />
          </div>
        </div>
      </div>

      {/* Tipo de cambio (si UYU) */}
      {form.moneda === 'UYU' && (
        <div>
          <label className={lbl}>Tipo de cambio (UYU por USD)</label>
          <input type="number" className={inp} min="0" step="0.01"
            value={form.tipoCambio ?? ''} onChange={e => setF('tipoCambio', parseFloat(e.target.value) || undefined)} />
        </div>
      )}

      {/* Proyecto */}
      <div>
        <label className={lbl}>Proyecto {necesitaProyecto ? '*' : '(opcional)'}</label>
        <select className={inp} value={form.proyectoId ?? ''} onChange={e => setF('proyectoId', e.target.value || undefined)} required={necesitaProyecto}>
          <option value="">— Empresa general —</option>
          {projects.map(p => <option key={p.id} value={p.id}>{p.code} — {p.clientName}</option>)}
        </select>
      </div>

      {/* Proveedor */}
      <div>
        <label className={lbl}>Proveedor (opcional)</label>
        <select className={inp} value={form.proveedorId ?? ''} onChange={e => setF('proveedorId', e.target.value || undefined)}>
          <option value="">Sin proveedor</option>
          {suppliers.map(s => <option key={s.id} value={s.id}>{s.nombre}</option>)}
        </select>
      </div>

      {/* Estado del movimiento (PREVISTO/COMPROMETIDO/A_PAGAR/PAGADO) */}
      {!esIngreso && (
        <div>
          <label className={lbl}>Estado *</label>
          <div className="grid grid-cols-3 gap-2">
            {(['COMPROMETIDO', 'A_PAGAR', 'PAGADO'] as FinanceMovementStatus[]).map(s => (
              <button key={s} type="button" onClick={() => setF('status', s)}
                className={klass('py-1.5 rounded-lg text-xs font-semibold border transition-colors',
                  form.status === s
                    ? 'bg-[var(--color-accent)] text-gray-900 border-[var(--color-accent)]'
                    : 'bg-transparent text-[var(--color-text-secondary)] border-[var(--color-border)] hover:bg-[var(--color-bg-card-hover)]'
                )}>
                {STATUS_LABEL[s]}
              </button>
            ))}
          </div>
          <p className="text-[10px] text-[var(--color-text-muted)] mt-1">
            "Previsto" se genera automáticamente desde la lista de materiales del proyecto, no se crea acá.
          </p>
        </div>
      )}

      {/* Fechas según estado */}
      {!esIngreso && form.status === 'COMPROMETIDO' && (
        <div>
          <label className={lbl}>Fecha esperada (opcional)</label>
          <input type="date" className={inp} value={form.expectedDate ?? ''} onChange={e => setF('expectedDate', e.target.value || undefined)} />
        </div>
      )}
      {!esIngreso && form.status === 'A_PAGAR' && (
        <div>
          <label className={lbl}>Vencimiento *</label>
          <input type="date" className={inp} value={form.dueDate ?? ''} onChange={e => setF('dueDate', e.target.value || undefined)} required />
        </div>
      )}

      {/* Checkboxes */}
      <div className="flex flex-wrap gap-4 py-1">
        {esIngreso && (
          <label className="flex items-center gap-2 text-sm text-[var(--color-text-secondary)] cursor-pointer">
            <input type="checkbox" checked={form.cobrado} onChange={e => setF('cobrado', e.target.checked)} className="accent-[var(--color-accent)]" />
            Cobrado
          </label>
        )}
        <label className="flex items-center gap-2 text-sm text-[var(--color-text-secondary)] cursor-pointer">
          <input type="checkbox" checked={form.impactaFlujo} onChange={e => setF('impactaFlujo', e.target.checked)} className="accent-[var(--color-accent)]" />
          Impacta flujo de fondos
        </label>
      </div>

      {/* Cleanup de previstos cuando estamos comprometiendo o vamos a pagar */}
      {!esIngreso && (form.status === 'COMPROMETIDO' || form.status === 'A_PAGAR') && (
        <button
          type="button"
          onClick={() => setShowCleanup(true)}
          className="w-full py-2 rounded-lg border border-dashed border-[var(--color-border)] text-xs text-[var(--color-text-secondary)] hover:bg-[var(--color-bg-card-hover)] transition-colors"
        >
          🧹 Limpiar previstos asociados a esta compra…
        </button>
      )}

      {/* Desglose de factura (D.3) — sólo para GASTO en A_PAGAR/PAGADO,
          y sólo en CREACIÓN. En EDICIÓN se muestra el botón en el detail panel. */}
      {!editId && !esIngreso && (form.status === 'A_PAGAR' || form.status === 'PAGADO') && (
        <div className="rounded-lg border border-[var(--color-warning-bg)] bg-[var(--color-warning-bg)]/20 p-3 space-y-2">
          <p className="text-xs font-semibold text-[var(--color-text-primary)]">Esta factura puede tener ítems para stock</p>
          <p className="text-[11px] text-[var(--color-text-muted)]">¿Cargás el desglose ahora? Los ítems entrarán al stock al confirmarlo.</p>
          <div className="flex gap-2 flex-wrap">
            <button
              type="submit"
              disabled={loading}
              onClick={() => { setOpenDesgloseAfter(true); setMarkNoMaterialesIntent(false); }}
              className="px-3 py-1.5 rounded-lg bg-[var(--color-accent)] text-gray-900 text-xs font-semibold hover:bg-[var(--color-accent-hover)] disabled:opacity-60"
            >
              Cargar desglose ahora
            </button>
            <label className="flex items-center gap-2 text-xs text-[var(--color-text-secondary)] cursor-pointer">
              <input
                type="checkbox"
                checked={markNoMaterialesIntent}
                onChange={e => { setMarkNoMaterialesIntent(e.target.checked); if (e.target.checked) setOpenDesgloseAfter(false); }}
                className="accent-[var(--color-accent)]"
              />
              Esta factura no tiene materiales
            </label>
          </div>
        </div>
      )}

      {/* Aprobación */}
      <div>
        <label className={lbl}>Aprobación</label>
        <select className={inp} value={form.estadoAprobacion} onChange={e => setF('estadoAprobacion', e.target.value as EstadoAprobacion)}>
          {(['BORRADOR', 'REGISTRADO', 'PENDIENTE_APROBACION', 'APROBADO'] as EstadoAprobacion[]).map(s => (
            <option key={s} value={s}>{ESTADO_APROBACION_LABEL[s]}</option>
          ))}
        </select>
      </div>

      {/* Observaciones */}
      <div>
        <label className={lbl}>Observaciones</label>
        <textarea className={klass(inp, 'resize-none')} rows={2}
          value={form.observaciones ?? ''} onChange={e => setF('observaciones', e.target.value || undefined)} />
      </div>

      {error && <p className="text-sm text-red-400 bg-red-500/10 rounded-lg px-3 py-2">{error}</p>}

      <div className="flex gap-3 pt-2">
        <button type="submit" disabled={loading}
          className="flex-1 py-2 rounded-lg bg-[var(--color-accent)] text-gray-900 text-sm font-semibold hover:bg-[var(--color-accent-hover)] transition-colors disabled:opacity-60">
          {loading ? 'Guardando...' : (editId ? 'Guardar cambios' : 'Registrar movimiento')}
        </button>
        <button type="button" onClick={onCancel}
          className="px-4 py-2 rounded-lg border border-[var(--color-border)] text-sm text-[var(--color-text-secondary)] hover:bg-[var(--color-bg-card-hover)] transition-colors">
          Cancelar
        </button>
      </div>
      {showCleanup && (
        <CleanupPrevistosModal onClose={() => setShowCleanup(false)} />
      )}
    </form>
  );
}

// ─── Detail Panel ─────────────────────────────────────────────────────────────

function DetailPanel({ mov, onClose, onEdit, onDelete, onCancel, onOpenDesglose, onApplyPayment }: {
  mov: FinanceMovement;
  onClose: () => void;
  onEdit: () => void;
  onDelete: () => void;
  onCancel: () => void;
  onOpenDesglose: () => void;
  onApplyPayment: () => void;
}) {
  const esIngreso = CATEGORIAS_INGRESO.includes(mov.categoriaPrincipal);
  const needsDetail = (mov.status === 'A_PAGAR' || mov.status === 'PAGADO' || mov.status === 'PARCIALMENTE_PAGADO')
    && !mov.hasItemDetail && !mov.noTieneMateriales
    && mov.tipoMovimiento === 'GASTO';
  const canCancel = mov.hasItemDetail && !mov.noTieneMateriales;
  // Pago: aplica si es gasto con supplier y saldo > 0
  const canRegisterPayment = mov.tipoMovimiento === 'GASTO'
    && !!mov.supplierId
    && (mov.saldoPendiente ?? mov.monto) > 0.005
    && (mov.status === 'A_PAGAR' || mov.status === 'COMPROMETIDO' || mov.status === 'PARCIALMENTE_PAGADO');

  // Cargar detalle (con paymentApplications) si tiene supplierId (las facturas con pagos)
  const { data: detail } = useQuery({
    queryKey: ['movement-detail', mov.id],
    queryFn: () => getMovement(mov.id),
    enabled: mov.tipoMovimiento === 'GASTO' && !!mov.supplierId,
  });

  return (
    <div className="fixed inset-0 z-40 flex justify-end" onClick={e => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="w-full max-w-md bg-[var(--color-bg-card)] border-l border-[var(--color-border)] h-full overflow-y-auto shadow-2xl p-5 space-y-4">
        <div className="flex items-center justify-between">
          <p className="text-sm font-semibold text-[var(--color-text-primary)]">Detalle</p>
          <button onClick={onClose} className="text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)]"><X className="w-5 h-5" /></button>
        </div>

        {needsDetail && (
          <div className="rounded-lg border border-[var(--color-warning-bg)] bg-[var(--color-warning-bg)]/30 p-3 flex items-start gap-2">
            <AlertTriangle className="w-4 h-4 text-[var(--color-warning-text)] shrink-0 mt-0.5" />
            <div className="flex-1">
              <p className="text-xs font-semibold text-[var(--color-warning-text)] mb-1">Desglose pendiente</p>
              <p className="text-[11px] text-[var(--color-text-secondary)] mb-2">Esta factura todavía no impactó en el stock.</p>
              <button onClick={onOpenDesglose} className="text-xs px-2.5 py-1 rounded-lg bg-[var(--color-accent)] text-gray-900 font-semibold hover:bg-[var(--color-accent-hover)]">
                Cargar desglose
              </button>
            </div>
          </div>
        )}

        <div className="space-y-3">
          <Row label="Descripción" value={mov.descripcion} />
          <Row label="Fecha" value={fmtDate(mov.fecha)} />
          <Row label="Tipo" value={mov.tipoMovimiento} />
          <Row label="Categoría" value={CATEGORIA_LABEL[mov.categoriaPrincipal]} />
          {mov.subcategoria && <Row label="Subcategoría" value={mov.subcategoria.nombre} />}
          <Row label="Monto" value={fmtCurrency(mov.monto, mov.moneda)} />
          {mov.tipoCambio && <Row label="T. Cambio" value={`${mov.tipoCambio} UYU/USD`} />}
          {mov.project && <Row label="Proyecto" value={`${mov.project.code} — ${mov.project.clientName}`} />}
          {mov.supplier && <Row label="Proveedor" value={mov.supplier.nombre} />}
          <Row label="Estado" value={STATUS_LABEL[mov.status]} />
          {mov.expectedDate && <Row label="Fecha esperada" value={fmtDate(mov.expectedDate)} />}
          {mov.dueDate && <Row label="Vencimiento" value={fmtDate(mov.dueDate)} />}
          {mov.sourceType === 'PROJECT_MATERIALS' && <Row label="Origen" value="Lista de materiales" />}
          {mov.materialItem && <Row label="Ítem" value={`${mov.materialItem.nombre}${mov.quantity != null ? ` (x${mov.quantity} ${mov.materialItem.unidad})` : ''}`} />}
          {mov.hasItemDetail && !mov.noTieneMateriales && <Row label="Stock" value="Ingresado vía desglose" />}
          {mov.noTieneMateriales && <Row label="Stock" value="Sin materiales" />}
          {mov.tipoMovimiento === 'GASTO' && mov.montoPagado > 0 && (
            <>
              <Row label="Monto pagado" value={fmtCurrency(mov.montoPagado, mov.moneda)} />
              <Row label="Saldo pendiente" value={fmtCurrency(mov.saldoPendiente, mov.moneda)} />
            </>
          )}
          <Row label={esIngreso ? 'Cobrado' : 'Pagado'} value={esIngreso ? (mov.cobrado ? 'Sí' : 'No') : (mov.pagado ? 'Sí' : 'No')} />
          <Row label="Aprobación" value={ESTADO_APROBACION_LABEL[mov.estadoAprobacion]} />
          {mov.observaciones && <Row label="Observaciones" value={mov.observaciones} />}
          <Row label="Registrado" value={fmtDate(mov.createdAt)} />
        </div>

        {/* Aplicaciones de pago */}
        {detail && detail.paymentApplications && detail.paymentApplications.length > 0 && (
          <div className="rounded-lg border border-[var(--color-border)] bg-[var(--color-bg-app)]/50 p-3 space-y-2">
            <p className="text-xs font-semibold text-[var(--color-text-primary)]">
              Aplicaciones de pago ({detail.paymentApplications.length})
            </p>
            <div className="space-y-1.5">
              {detail.paymentApplications.map(a => (
                <div key={a.id} className="flex items-center justify-between text-xs">
                  <div>
                    <span className="text-[var(--color-text-secondary)]">{fmtDate(a.payment.fecha)}</span>
                    <span className="text-[var(--color-text-muted)] mx-1">·</span>
                    <span className="text-[var(--color-text-muted)]">{a.payment.metodo.replace('_', ' ').toLowerCase()}</span>
                    {a.payment.referencia && <span className="text-[var(--color-text-muted)] ml-1">({a.payment.referencia})</span>}
                  </div>
                  <span className="font-semibold tabular-nums text-[var(--color-state-done-text)]">
                    {fmtCurrency(a.montoAplicado, mov.moneda)}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Botón Registrar pago */}
        {canRegisterPayment && (
          <button
            onClick={onApplyPayment}
            className="w-full py-2 rounded-lg bg-[var(--color-accent)] text-gray-900 text-sm font-semibold hover:bg-[var(--color-accent-hover)] transition-colors inline-flex items-center justify-center gap-2"
          >
            <DollarSign className="w-4 h-4" />
            Registrar pago a este proveedor
          </button>
        )}

        {(mov.status === 'A_PAGAR' || mov.status === 'PAGADO') && mov.tipoMovimiento === 'GASTO' && !needsDetail && (
          <button onClick={onOpenDesglose} className="w-full py-2 rounded-lg border border-[var(--color-border)] text-sm text-[var(--color-text-secondary)] hover:bg-[var(--color-bg-card-hover)] inline-flex items-center justify-center gap-2">
            <FileText className="w-4 h-4" />
            Ver desglose de factura
          </button>
        )}

        <div className="flex gap-2 pt-2">
          <button onClick={onEdit} className="flex-1 py-2 rounded-lg bg-[var(--color-accent)] text-gray-900 text-sm font-semibold hover:bg-[var(--color-accent-hover)] transition-colors">
            Editar
          </button>
          <button onClick={onDelete} className="px-4 py-2 rounded-lg bg-red-500/15 text-red-400 text-sm font-semibold hover:bg-red-500/25 transition-colors">
            Eliminar
          </button>
        </div>
        {canCancel && (
          <button
            onClick={onCancel}
            className="w-full py-2 rounded-lg border border-red-500/40 text-red-400 text-sm font-semibold hover:bg-red-500/15 transition-colors"
            title="Esto revertirá el stock que ingresó por esta factura"
          >
            Anular movimiento (revierte stock)
          </button>
        )}
      </div>
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between gap-4 text-sm">
      <span className="text-[var(--color-text-muted)] shrink-0">{label}</span>
      <span className="text-[var(--color-text-primary)] text-right">{value}</span>
    </div>
  );
}

// ─── Movements Page ───────────────────────────────────────────────────────────

const FILTERS_KEY = 'finance-movements-filters-v2';

interface PersistedFilters {
  mes?: number;
  anio?: number;
  tipo?: string;
  cat?: string;
  status?: '' | FinanceMovementStatus;
  search?: string;
}

export function FinanceMovements() {
  const qc = useQueryClient();
  const { mes: curMes, anio: curAnio } = currentMonthYear();

  const [mes, setMes] = useState(curMes);
  const [anio, setAnio] = useState(curAnio);
  const [tipo, setTipo] = useState('');
  const [cat, setCat] = useState('');
  const [status, setStatus] = useState<'' | FinanceMovementStatus>('');
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);

  const [newModal, setNewModal] = useState(false);
  const [editMov, setEditMov] = useState<FinanceMovement | null>(null);
  const [detailMov, setDetailMov] = useState<FinanceMovement | null>(null);
  const [desgloseMovId, setDesgloseMovId] = useState<string | null>(null);
  const [pendingFilter, setPendingFilter] = useState(false);
  const [payForMov, setPayForMov] = useState<FinanceMovement | null>(null);
  const [createdPaymentId, setCreatedPaymentId] = useState<string | null>(null);
  const [preselectMovementForPay, setPreselectMovementForPay] = useState<string | null>(null);

  // Persistencia de filtros
  useEffect(() => {
    try {
      const raw = localStorage.getItem(FILTERS_KEY);
      if (raw) {
        const p = JSON.parse(raw) as PersistedFilters;
        if (typeof p.mes === 'number') setMes(p.mes);
        if (typeof p.anio === 'number') setAnio(p.anio);
        if (typeof p.tipo === 'string') setTipo(p.tipo);
        if (typeof p.cat === 'string') setCat(p.cat);
        if (p.status === '' || p.status === 'PREVISTO' || p.status === 'COMPROMETIDO' || p.status === 'A_PAGAR' || p.status === 'PAGADO') setStatus(p.status);
        if (typeof p.search === 'string') setSearch(p.search);
      }
    } catch { /* ignore */ }
  }, []);
  useEffect(() => {
    localStorage.setItem(FILTERS_KEY, JSON.stringify({ mes, anio, tipo, cat, status, search } satisfies PersistedFilters));
  }, [mes, anio, tipo, cat, status, search]);

  // Si el usuario llega con ?new=1 (típicamente desde el botón "Nuevo
  // movimiento" del dashboard de Finanzas), abrimos el modal y limpiamos
  // el query param para que un refresh no lo vuelva a abrir.
  const [searchParams, setSearchParams] = useSearchParams();
  useEffect(() => {
    if (searchParams.get('new') === '1') {
      setNewModal(true);
      const next = new URLSearchParams(searchParams);
      next.delete('new');
      setSearchParams(next, { replace: true });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const { data, isLoading } = useQuery({
    queryKey: ['finance-movements', mes, anio, tipo, cat, status, search, page],
    queryFn: () => getMovements({
      mes, anio, page, limit: 20,
      ...(tipo ? { tipo } : {}),
      ...(cat ? { categoria: cat } : {}),
      ...(status ? { status: status as FinanceMovementStatus } : {}),
      ...(search ? { search } : {}),
    }),
    placeholderData: prev => prev,
  });

  const transitionMut = useMutation({
    mutationFn: (args: { id: string; newStatus: FinanceMovementStatus; paidDate?: string; dueDate?: string }) =>
      transitionMovement(args.id, { newStatus: args.newStatus, ...(args.paidDate ? { paidDate: args.paidDate } : {}), ...(args.dueDate ? { dueDate: args.dueDate } : {}) }),
    onSuccess: () => {
      toast.success('Estado actualizado');
      qc.invalidateQueries({ queryKey: ['finance-movements'] });
      qc.invalidateQueries({ queryKey: ['finance-dashboard'] });
      qc.invalidateQueries({ queryKey: ['comprobantes-widget'] });
      qc.invalidateQueries({ queryKey: ['pending-detail'] });
    },
    onError: (err: unknown) => {
      const msg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message;
      toast.error(msg ?? 'Error al cambiar estado');
    },
  });

  const cancelMut = useMutation({
    mutationFn: (id: string) => cancelMovement(id),
    onSuccess: (r) => {
      const msg = r.reversedStockMovements > 0
        ? `Movimiento anulado · ${r.reversedStockMovements} ingreso(s) de stock revertido(s)`
        : 'Movimiento anulado';
      toast.success(msg);
      qc.invalidateQueries({ queryKey: ['finance-movements'] });
      qc.invalidateQueries({ queryKey: ['finance-dashboard'] });
      qc.invalidateQueries({ queryKey: ['pending-detail'] });
      qc.invalidateQueries({ queryKey: ['stock-products'] });
      qc.invalidateQueries({ queryKey: ['stock-alerts'] });
      setDetailMov(null);
    },
    onError: (err: unknown) => {
      const msg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message;
      toast.error(msg ?? 'Error al anular');
    },
  });

  function handleQuickTransition(mov: FinanceMovement) {
    if (mov.status === 'COMPROMETIDO') {
      const due = window.prompt('Fecha de vencimiento (YYYY-MM-DD):', new Date().toISOString().slice(0, 10));
      if (!due) return;
      if (!/^\d{4}-\d{2}-\d{2}$/.test(due)) { toast.error('Formato inválido'); return; }
      transitionMut.mutate({ id: mov.id, newStatus: 'A_PAGAR', dueDate: due });
    } else if (mov.status === 'A_PAGAR') {
      const paid = window.prompt('Fecha de pago (YYYY-MM-DD):', new Date().toISOString().slice(0, 10));
      if (!paid) return;
      if (!/^\d{4}-\d{2}-\d{2}$/.test(paid)) { toast.error('Formato inválido'); return; }
      transitionMut.mutate({ id: mov.id, newStatus: 'PAGADO', paidDate: paid });
    }
  }

  const deleteMut = useMutation({
    mutationFn: (id: string) => deleteMovement(id),
    onSuccess: () => {
      toast.success('Movimiento eliminado');
      qc.invalidateQueries({ queryKey: ['finance-movements'] });
      setDetailMov(null);
    },
    onError: () => toast.error('Error al eliminar'),
  });

  function handleSuccess() {
    qc.invalidateQueries({ queryKey: ['finance-movements'] });
    qc.invalidateQueries({ queryKey: ['finance-dashboard'] });
    setNewModal(false);
    setEditMov(null);
    setDetailMov(null);
  }

  const TIPO_OPTS = [
    { value: '', label: 'Todos los tipos' },
    { value: 'INGRESO', label: 'Ingreso' },
    { value: 'GASTO', label: 'Gasto' },
    { value: 'AJUSTE', label: 'Ajuste' },
  ];

  const CAT_OPTS = [
    { value: '', label: 'Todas las categorías' },
    ...Object.entries(CATEGORIA_LABEL).map(([v, l]) => ({ value: v, label: l })),
  ];

  const inp = 'rounded-lg border border-[var(--color-border)] bg-[var(--color-bg-card)] px-3 py-1.5 text-sm text-[var(--color-text-primary)] focus:outline-none focus:ring-1 focus:ring-[var(--color-accent)]';

  return (
    <div className="p-6 space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-display text-2xl font-bold text-[var(--color-text-primary)]">Movimientos</h1>
          <p className="text-sm text-[var(--color-text-muted)] mt-0.5">Registro de ingresos y gastos</p>
        </div>
        <div className="flex items-center gap-2">
          <Link to="/finanzas/a-pagar" className="text-xs text-[var(--color-accent)] hover:underline">Cuentas a pagar →</Link>
          <button onClick={() => setNewModal(true)}
            className="flex items-center gap-2 px-4 py-2 rounded-lg bg-[var(--color-accent)] text-gray-900 text-sm font-semibold hover:bg-[var(--color-accent-hover)] transition-colors">
            <Plus className="w-4 h-4" /> Nuevo movimiento
          </button>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-2">
        <select className={inp} value={mes} onChange={e => { setMes(Number(e.target.value)); setPage(1); }}>
          {MONTH_NAMES.map((m, i) => <option key={i} value={i + 1}>{m}</option>)}
        </select>
        <select className={inp} value={anio} onChange={e => { setAnio(Number(e.target.value)); setPage(1); }}>
          {[curAnio - 1, curAnio, curAnio + 1].map(y => <option key={y} value={y}>{y}</option>)}
        </select>
        <select className={inp} value={tipo} onChange={e => { setTipo(e.target.value); setPage(1); }}>
          {TIPO_OPTS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
        </select>
        <select className={inp} value={cat} onChange={e => { setCat(e.target.value); setPage(1); }}>
          {CAT_OPTS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
        </select>
        <select className={inp} value={status} onChange={e => { setStatus(e.target.value as '' | FinanceMovementStatus); setPage(1); }}>
          <option value="">Todos los estados</option>
          <option value="PREVISTO">Previstos</option>
          <option value="COMPROMETIDO">Comprometidos</option>
          <option value="A_PAGAR">A pagar</option>
          <option value="PARCIALMENTE_PAGADO">Parcialmente pagados</option>
          <option value="PAGADO">Pagados</option>
        </select>
        <input type="text" className={klass(inp, 'min-w-40 flex-1')} placeholder="Buscar..." value={search} onChange={e => { setSearch(e.target.value); setPage(1); }} />
        <label className="flex items-center gap-2 text-xs text-[var(--color-text-secondary)] cursor-pointer ml-1">
          <input type="checkbox" checked={pendingFilter} onChange={e => setPendingFilter(e.target.checked)} className="accent-[var(--color-accent)]" />
          Pendientes de desglose
        </label>
      </div>

      {/* Table */}
      <div className="bg-[var(--color-bg-card)] border border-[var(--color-border)] rounded-xl overflow-hidden">
        {isLoading ? (
          <div className="flex items-center justify-center py-12"><Spinner /></div>
        ) : (() => {
          const filteredRows = pendingFilter
            ? (data?.data ?? []).filter(m =>
                (m.status === 'A_PAGAR' || m.status === 'PAGADO')
                && !m.hasItemDetail
                && !m.noTieneMateriales,
              )
            : (data?.data ?? []);
          if (filteredRows.length === 0) {
            return (
              <p className="text-sm text-[var(--color-text-muted)] text-center py-12">
                {pendingFilter ? 'Sin movimientos pendientes de desglose en este período' : 'Sin movimientos en este período'}
              </p>
            );
          }
          return (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-[var(--color-border)] text-xs font-mono text-[var(--color-text-muted)] uppercase tracking-wider">
                  {['Fecha', 'Descripción', 'Categoría', 'Proyecto', 'Vence', 'Monto', 'Estado', ''].map(h => (
                    <th key={h} className="px-4 py-3 text-left font-medium">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--color-border)]">
                {filteredRows.map(mov => {
                  const today = new Date().toISOString().slice(0, 10);
                  const overdue = mov.dueDate != null && mov.dueDate < today && mov.status === 'A_PAGAR';
                  const needsDetail = (mov.status === 'A_PAGAR' || mov.status === 'PAGADO')
                    && !mov.hasItemDetail && !mov.noTieneMateriales
                    && mov.tipoMovimiento === 'GASTO';
                  const showFecha = mov.status === 'PAGADO' || mov.tipoMovimiento === 'INGRESO' || mov.tipoMovimiento === 'AJUSTE'
                    ? mov.fecha
                    : (mov.expectedDate ?? mov.fecha);
                  const fechaLabel = mov.status === 'PAGADO' || mov.tipoMovimiento === 'INGRESO' || mov.tipoMovimiento === 'AJUSTE'
                    ? null
                    : (mov.expectedDate ? '~' : null);
                  return (
                    <tr key={mov.id}
                      onClick={() => setDetailMov(mov)}
                      className={klass('cursor-pointer hover:bg-[var(--color-bg-card-hover)] transition-colors', overdue && 'bg-red-500/5')}
                    >
                      <td className="px-4 py-3 whitespace-nowrap text-[var(--color-text-muted)]">
                        {fechaLabel}{fmtDate(showFecha)}
                      </td>
                      <td className="px-4 py-3 max-w-xs truncate text-[var(--color-text-primary)]">
                        <div className="flex items-center gap-2">
                          <span className="truncate">{mov.descripcion}</span>
                          {needsDetail && (
                            <span className="shrink-0 inline-flex items-center gap-1 text-[10px] font-mono px-1.5 py-0.5 rounded uppercase bg-[var(--color-warning-bg)] text-[var(--color-warning-text)]" title="Esta factura aún no tiene desglose">
                              <AlertTriangle className="w-3 h-3" />
                              Desglose pendiente
                            </span>
                          )}
                          {mov.hasItemDetail && !mov.noTieneMateriales && (
                            <span className="shrink-0 text-[10px] font-mono px-1.5 py-0.5 rounded uppercase bg-[var(--color-state-done-bg)] text-[var(--color-state-done-text)]" title="Stock ingresado">
                              ✓ Stock
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap text-[var(--color-text-secondary)]">{CATEGORIA_LABEL[mov.categoriaPrincipal]}</td>
                      <td className="px-4 py-3 whitespace-nowrap text-[var(--color-text-muted)]">{mov.project?.code ?? '—'}</td>
                      <td className={klass('px-4 py-3 whitespace-nowrap', overdue ? 'text-red-400 font-semibold' : 'text-[var(--color-text-muted)]')}>
                        {mov.dueDate ? (overdue ? '⚠ ' : '') + fmtDate(mov.dueDate) : '—'}
                      </td>
                      <td className={klass('px-4 py-3 whitespace-nowrap font-semibold tabular-nums',
                        mov.tipoMovimiento === 'INGRESO' ? 'text-green-400' : mov.tipoMovimiento === 'AJUSTE' ? 'text-blue-400' : 'text-red-400')}>
                        {mov.tipoMovimiento === 'GASTO' ? '-' : '+'}{fmtCurrency(mov.monto, mov.moneda)}
                      </td>
                      <td className="px-4 py-3">
                        <span className={klass('text-[10px] font-mono px-2 py-0.5 rounded uppercase', STATUS_COLOR[mov.status])}>
                          {STATUS_LABEL[mov.status]}
                        </span>
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap">
                        <div className="flex items-center gap-1">
                          {needsDetail && (
                            <button
                              onClick={e => { e.stopPropagation(); setDesgloseMovId(mov.id); }}
                              className="text-[10px] px-2 py-1 rounded bg-[var(--color-warning-bg)] text-[var(--color-warning-text)] font-semibold hover:opacity-80 inline-flex items-center gap-1"
                              title="Cargar desglose de factura"
                            >
                              <FileText className="w-3 h-3" />
                              Desglose
                            </button>
                          )}
                          {(mov.status === 'COMPROMETIDO' || mov.status === 'A_PAGAR') && (
                            <button
                              onClick={e => { e.stopPropagation(); handleQuickTransition(mov); }}
                              disabled={transitionMut.isPending}
                              className={klass(
                                'text-[10px] px-2 py-1 rounded font-semibold transition-colors disabled:opacity-60',
                                mov.status === 'COMPROMETIDO'
                                  ? 'bg-[var(--color-warning-bg)] text-[var(--color-warning-text)] hover:opacity-80'
                                  : 'bg-[var(--color-state-done-bg)] text-[var(--color-state-done-text)] hover:opacity-80',
                              )}
                              title={mov.status === 'COMPROMETIDO' ? 'Pasar a A pagar' : 'Marcar como pagado'}
                            >
                              <ArrowRight className="w-3 h-3 inline" />
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          );
        })()}

        {/* Pagination */}
        {data && data.totalPages > 1 && (
          <div className="flex items-center justify-between px-4 py-3 border-t border-[var(--color-border)]">
            <span className="text-xs text-[var(--color-text-muted)]">{data.total} movimientos · Página {data.page}/{data.totalPages}</span>
            <div className="flex gap-2">
              <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1}
                className="p-1.5 rounded border border-[var(--color-border)] text-[var(--color-text-secondary)] disabled:opacity-40 hover:bg-[var(--color-bg-card-hover)] transition-colors">
                <ChevronLeft className="w-4 h-4" />
              </button>
              <button onClick={() => setPage(p => Math.min(data.totalPages, p + 1))} disabled={page === data.totalPages}
                className="p-1.5 rounded border border-[var(--color-border)] text-[var(--color-text-secondary)] disabled:opacity-40 hover:bg-[var(--color-bg-card-hover)] transition-colors">
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}
      </div>

      {/* New movement modal */}
      {(newModal || editMov) && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-start justify-center p-4 overflow-y-auto">
          <div className="bg-[var(--color-bg-card)] border border-[var(--color-border)] rounded-xl p-6 w-full max-w-lg my-8 shadow-2xl">
            <div className="flex items-center justify-between mb-4">
              <p className="text-sm font-semibold text-[var(--color-text-primary)]">{editMov ? 'Editar movimiento' : 'Nuevo movimiento'}</p>
              <button onClick={() => { setNewModal(false); setEditMov(null); }} className="text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)]">
                <X className="w-5 h-5" />
              </button>
            </div>
            <MovimientoForm
              onSuccess={handleSuccess}
              onCancel={() => { setNewModal(false); setEditMov(null); }}
              editId={editMov?.id}
              onSavedOpenDesglose={(id) => {
                setNewModal(false);
                setEditMov(null);
                setDesgloseMovId(id);
                qc.invalidateQueries({ queryKey: ['finance-movements'] });
                qc.invalidateQueries({ queryKey: ['finance-dashboard'] });
              }}
              initial={editMov ? {
                fecha: editMov.fecha.split('T')[0],
                tipoMovimiento: editMov.tipoMovimiento,
                categoriaPrincipal: editMov.categoriaPrincipal,
                descripcion: editMov.descripcion,
                monto: editMov.monto,
                moneda: editMov.moneda,
                tipoCambio: editMov.tipoCambio ?? undefined,
                pagado: editMov.pagado,
                cobrado: editMov.cobrado,
                impactaFlujo: editMov.impactaFlujo,
                status: editMov.status,
                expectedDate: editMov.expectedDate ?? undefined,
                dueDate: editMov.dueDate ?? undefined,
                estadoAprobacion: editMov.estadoAprobacion,
                proyectoId: editMov.projectId ?? undefined,
                proveedorId: editMov.supplierId ?? undefined,
                subcategoriaId: editMov.subcategoriaId ?? undefined,
                observaciones: editMov.observaciones ?? undefined,
              } : undefined}
            />
          </div>
        </div>
      )}

      {/* Detail panel */}
      {detailMov && (
        <DetailPanel
          mov={detailMov}
          onClose={() => setDetailMov(null)}
          onEdit={() => { setEditMov(detailMov); setDetailMov(null); }}
          onDelete={() => {
            if (confirm('¿Eliminar este movimiento?')) {
              deleteMut.mutate(detailMov.id);
            }
          }}
          onCancel={() => {
            if (confirm('Esto anulará el movimiento y revertirá el stock que ingresó por esta factura. ¿Continuar?')) {
              cancelMut.mutate(detailMov.id);
            }
          }}
          onOpenDesglose={() => { setDesgloseMovId(detailMov.id); setDetailMov(null); }}
          onApplyPayment={() => { setPayForMov(detailMov); setDetailMov(null); }}
        />
      )}

      {payForMov && payForMov.supplierId && payForMov.supplier && (
        <NewPaymentForSupplierModal
          supplierId={payForMov.supplierId}
          supplierName={payForMov.supplier.nombre}
          defaultAmount={payForMov.saldoPendiente > 0 ? payForMov.saldoPendiente : payForMov.monto}
          defaultMoneda={payForMov.moneda}
          onClose={() => setPayForMov(null)}
          onCreatedAndApply={(paymentId) => {
            setPreselectMovementForPay(payForMov.id);
            setCreatedPaymentId(paymentId);
            setPayForMov(null);
          }}
        />
      )}

      {createdPaymentId && (
        <ApplyPaymentModal
          paymentId={createdPaymentId}
          preselectMovementId={preselectMovementForPay ?? undefined}
          onClose={() => { setCreatedPaymentId(null); setPreselectMovementForPay(null); }}
        />
      )}

      {/* Desglose modal */}
      {desgloseMovId && (
        <InvoiceItemsDetail
          movementId={desgloseMovId}
          onClose={() => setDesgloseMovId(null)}
        />
      )}
    </div>
  );
}

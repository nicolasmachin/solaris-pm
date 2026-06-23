import { useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'react-hot-toast';
import { ArrowLeft, ArrowRight, Plus, Pencil, CheckCircle2, AlertTriangle, FileText, Trash2 } from 'lucide-react';
import { Spinner } from '../components/ui/Spinner';
import { Sheet } from '../components/ui/Sheet';
import { getSupplier, deleteSupplier, deleteMovement } from '../api/finance.api';
import { usePermission } from '../hooks/usePermission';
import { getSupplierAccountSummary } from '../api/payments.api';
import { fmtCurrency, fmtDate } from '../lib/finance';
import {
  STATUS_COLOR,
  STATUS_LABEL,
  METODO_PAGO_LABEL,
} from '../types/finance.types';
import type { FinanceMovementStatus } from '../types/finance.types';
import { todayLocalISO } from '../utils/date';
import { ApplyPaymentModal } from '../components/finance/ApplyPaymentModal';
import { PaymentDetailPanel } from '../components/finance/PaymentDetailPanel';
import { NewPaymentForSupplierModal } from '../components/finance/NewPaymentForSupplierModal';
import { NewSupplierInvoiceModal, type EditableInvoice } from '../components/finance/NewSupplierInvoiceModal';
import { SupplierForm } from './FinanceSuppliers';

function klass(...p: (string | false | undefined)[]) { return p.filter(Boolean).join(' '); }
function getApiErr(err: unknown) {
  return (err as { response?: { data?: { message?: string } } })?.response?.data?.message;
}

type Tab = 'facturas' | 'pagos' | 'estado';

export function FinanceSupplierDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const [tab, setTab] = useState<Tab>('facturas');
  const [editing, setEditing] = useState(false);
  const [newPaymentOpen, setNewPaymentOpen] = useState(false);
  const [newInvoiceOpen, setNewInvoiceOpen] = useState(false);
  const [editInvoice, setEditInvoice] = useState<EditableInvoice | null>(null);
  const [createdPaymentId, setCreatedPaymentId] = useState<string | null>(null);
  const canEditFinance = usePermission('FINANZAS', 'EDIT');
  const canDeleteFinance = usePermission('FINANZAS', 'DELETE');
  const [selectedPaymentId, setSelectedPaymentId] = useState<string | null>(null);
  const [filterFacturas, setFilterFacturas] = useState<'all' | 'pending' | 'paid' | 'partial'>('all');
  const [filterPagos, setFilterPagos] = useState<'all' | 'with-balance' | 'applied'>('all');

  const { data: supplier, isLoading: loadingSupplier } = useQuery({
    queryKey: ['supplier', id],
    queryFn: () => getSupplier(id!),
    enabled: !!id,
  });

  const { data: summary, isLoading: loadingSummary } = useQuery({
    queryKey: ['account-summary', id],
    queryFn: () => getSupplierAccountSummary(id!),
    enabled: !!id,
  });

  const deleteMut = useMutation({
    mutationFn: () => deleteSupplier(id!),
    onSuccess: () => {
      toast.success('Proveedor eliminado');
      qc.invalidateQueries({ queryKey: ['suppliers'] });
      navigate('/finanzas/proveedores');
    },
    onError: (err) => toast.error(getApiErr(err) ?? 'No se pudo eliminar (puede tener movimientos asociados)'),
  });

  const deleteInvoiceMut = useMutation({
    mutationFn: (invoiceId: string) => deleteMovement(invoiceId),
    onSuccess: (res) => {
      const freed = res?.liberatedApplications ?? 0;
      toast.success(
        freed > 0
          ? `Factura eliminada · se liberaron ${freed} pago(s) como saldo a favor del proveedor`
          : 'Factura eliminada',
      );
      qc.invalidateQueries({ queryKey: ['account-summary', id] });
      qc.invalidateQueries({ queryKey: ['supplier', id] });
      qc.invalidateQueries({ queryKey: ['finance-movements'] });
      qc.invalidateQueries({ queryKey: ['finance-pending'] });
      qc.invalidateQueries({ queryKey: ['finance-cashflow'] });
    },
    onError: (err) => toast.error(getApiErr(err) ?? 'No se pudo eliminar la factura'),
  });

  if (loadingSupplier || !supplier) {
    return <div className="flex items-center justify-center py-20"><Spinner /></div>;
  }

  const facturasFiltered = (summary?.facturas ?? []).filter(f => {
    if (filterFacturas === 'pending') return f.saldoPendiente > 0.005 && f.status !== 'PAGADO';
    if (filterFacturas === 'paid') return f.status === 'PAGADO';
    if (filterFacturas === 'partial') return f.status === 'PARCIALMENTE_PAGADO';
    return true;
  });
  const pagosFiltered = (summary?.pagos ?? []).filter(p => {
    if (filterPagos === 'with-balance') return p.saldoSinAplicar > 0.005;
    if (filterPagos === 'applied') return p.saldoSinAplicar < 0.005;
    return true;
  });

  return (
    <div className="p-6 space-y-5">
      {/* Header */}
      <div>
        <Link to="/finanzas/proveedores" className="inline-flex items-center gap-1 text-xs text-[var(--color-accent)] hover:underline mb-2">
          <ArrowLeft className="w-3 h-3" /> Proveedores
        </Link>
        <div className="flex items-start justify-between gap-3 flex-wrap">
          <div>
            <h1 className="font-display text-2xl font-bold text-[var(--color-text-primary)]">{supplier.nombre}</h1>
            <p className="text-sm text-[var(--color-text-muted)] mt-0.5">
              {supplier.rut ? `RUT ${supplier.rut}` : 'Sin RUT'}
              {supplier.contactoNombre ? ` · ${supplier.contactoNombre}` : ''}
              {supplier.email ? ` · ${supplier.email}` : ''}
              {supplier.telefono ? ` · ${supplier.telefono}` : ''}
              {!supplier.activo && <span className="ml-2 text-[10px] font-mono px-1.5 py-0.5 rounded uppercase bg-[var(--color-border)] text-[var(--color-text-muted)]">Inactivo</span>}
            </p>
            {supplier.condicionPago && <p className="text-xs text-[var(--color-text-muted)] mt-1 italic">Condición: {supplier.condicionPago}</p>}
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            <button
              onClick={() => setEditing(true)}
              className="inline-flex items-center gap-1 px-3 py-2 rounded-lg border border-[var(--color-border)] text-sm text-[var(--color-text-secondary)] hover:bg-[var(--color-bg-card-hover)]"
            >
              <Pencil className="w-3.5 h-3.5" /> Editar
            </button>
            <button
              onClick={() => setNewInvoiceOpen(true)}
              className="inline-flex items-center gap-1 px-3 py-2 rounded-lg border border-[var(--color-border)] text-sm font-semibold text-[var(--color-text-primary)] hover:bg-[var(--color-bg-card-hover)]"
            >
              <FileText className="w-3.5 h-3.5" /> Cargar factura
            </button>
            <button
              onClick={() => setNewPaymentOpen(true)}
              className="inline-flex items-center gap-1 px-3 py-2 rounded-lg bg-[var(--color-accent)] text-gray-900 text-sm font-semibold hover:bg-[var(--color-accent-hover)]"
            >
              <Plus className="w-3.5 h-3.5" /> Registrar pago
            </button>
            <Link
              to="/finanzas/movimientos?new=1"
              className="inline-flex items-center gap-1 px-3 py-2 rounded-lg border border-[var(--color-border)] text-sm text-[var(--color-text-secondary)] hover:bg-[var(--color-bg-card-hover)]"
            >
              <Plus className="w-3.5 h-3.5" /> Nuevo gasto
            </Link>
          </div>
        </div>
      </div>

      {/* KPIs de saldo */}
      {loadingSummary || !summary ? (
        <div className="flex items-center justify-center py-8"><Spinner /></div>
      ) : (
        <>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <BalanceCard
              label="Total adeudado"
              usd={summary.totals.facturasPendientesUSD}
              uyu={summary.totals.facturasPendientesUYU}
              tone="danger"
            />
            <BalanceCard
              label="Saldo a favor"
              usd={summary.totals.saldoAFavorUSD}
              uyu={summary.totals.saldoAFavorUYU}
              tone="info"
            />
            <BalanceCard
              label="Saldo neto"
              usd={summary.totals.saldoNetoUSD}
              uyu={summary.totals.saldoNetoUYU}
              tone="net"
            />
          </div>

          {/* Tabs */}
          <div className="flex gap-2 border-b border-[var(--color-border)]">
            {(['facturas', 'pagos', 'estado'] as const).map(t => (
              <button
                key={t}
                onClick={() => setTab(t)}
                className={klass(
                  'px-4 py-2 text-sm font-medium transition-colors -mb-px border-b-2',
                  tab === t
                    ? 'border-[var(--color-accent)] text-[var(--color-accent)]'
                    : 'border-transparent text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)]',
                )}
              >
                {t === 'facturas' && `Facturas (${summary.facturas.length})`}
                {t === 'pagos' && `Pagos (${summary.pagos.length})`}
                {t === 'estado' && 'Estado de cuenta'}
              </button>
            ))}
          </div>

          {/* Tab content */}
          {tab === 'facturas' && (
            <FacturasTab
              facturas={facturasFiltered}
              total={summary.facturas.length}
              filter={filterFacturas}
              onFilterChange={setFilterFacturas}
              canEdit={canEditFinance}
              canDelete={canDeleteFinance}
              onEdit={(f) => setEditInvoice({ id: f.id, descripcion: f.descripcion, monto: f.monto, moneda: f.moneda, fecha: f.fecha.slice(0, 10), dueDate: f.dueDate })}
              onDelete={(f) => {
                if (confirm(`¿Eliminar la factura "${f.descripcion}"?${f.montoPagado > 0.005 ? '\n\nTiene pagos aplicados: se liberarán como saldo a favor del proveedor.' : ''}`)) {
                  deleteInvoiceMut.mutate(f.id);
                }
              }}
              deletingId={deleteInvoiceMut.isPending ? deleteInvoiceMut.variables ?? null : null}
            />
          )}
          {tab === 'pagos' && (
            <PagosTab
              pagos={pagosFiltered}
              total={summary.pagos.length}
              filter={filterPagos}
              onFilterChange={setFilterPagos}
              onPagoClick={setSelectedPaymentId}
            />
          )}
          {tab === 'estado' && (
            <EstadoCuentaTab
              eventos={summary.estadoDeCuenta}
              tcInfo={summary.exchangeRate}
            />
          )}
        </>
      )}

      {/* Edit modal */}
      {editing && (
        <Sheet open onClose={() => setEditing(false)} title="Editar proveedor">
          <SupplierForm
            initial={supplier}
            supplierId={supplier.id}
            onSuccess={() => {
              setEditing(false);
              qc.invalidateQueries({ queryKey: ['supplier', id] });
              qc.invalidateQueries({ queryKey: ['suppliers'] });
            }}
            onCancel={() => setEditing(false)}
          />
          <div className="mt-4 pt-4 border-t border-[var(--color-border)]">
            <button
              onClick={() => { if (confirm('¿Eliminar este proveedor?')) deleteMut.mutate(); }}
              className="w-full py-2 rounded-lg bg-red-500/15 text-red-400 text-sm font-semibold hover:bg-red-500/25 transition-colors"
            >
              Eliminar proveedor
            </button>
          </div>
        </Sheet>
      )}

      {/* Modal cargar factura a pagar (proveedor prefijado) */}
      {newInvoiceOpen && (
        <NewSupplierInvoiceModal
          supplierId={supplier.id}
          supplierName={supplier.nombre}
          onClose={() => setNewInvoiceOpen(false)}
          onCreated={() => qc.invalidateQueries({ queryKey: ['account-summary', id] })}
        />
      )}

      {/* Modal editar factura existente */}
      {editInvoice && (
        <NewSupplierInvoiceModal
          supplierName={supplier.nombre}
          invoice={editInvoice}
          onClose={() => setEditInvoice(null)}
          onCreated={() => qc.invalidateQueries({ queryKey: ['account-summary', id] })}
        />
      )}

      {/* Modal registrar pago (con prefill del proveedor) */}
      {newPaymentOpen && (
        <NewPaymentForSupplierModal
          supplierId={supplier.id}
          supplierName={supplier.nombre}
          onClose={() => setNewPaymentOpen(false)}
          onCreatedAndApply={(paymentId) => {
            setNewPaymentOpen(false);
            setCreatedPaymentId(paymentId);
          }}
        />
      )}

      {createdPaymentId && (
        <ApplyPaymentModal
          paymentId={createdPaymentId}
          onClose={() => setCreatedPaymentId(null)}
        />
      )}

      {selectedPaymentId && (
        <PaymentDetailPanel
          paymentId={selectedPaymentId}
          onClose={() => setSelectedPaymentId(null)}
        />
      )}
    </div>
  );
}

// ─── Sub-componentes ─────────────────────────────────────────────────────────

function BalanceCard({ label, usd, uyu, tone }: {
  label: string; usd: number; uyu: number; tone: 'danger' | 'info' | 'net';
}) {
  function colorFor(v: number) {
    if (tone === 'danger') return v > 0 ? 'text-red-400' : 'text-[var(--color-text-muted)]';
    if (tone === 'info') return v > 0 ? 'text-[var(--color-info-text)]' : 'text-[var(--color-text-muted)]';
    if (v > 0) return 'text-red-400';
    if (v < 0) return 'text-green-400';
    return 'text-[var(--color-text-muted)]';
  }
  const subtitle = tone === 'net'
    ? (usd > 0 || uyu > 0 ? 'Le debemos' : usd < 0 || uyu < 0 ? 'Saldo a favor' : 'Sin saldo')
    : undefined;
  return (
    <div className={klass(
      'rounded-xl border bg-[var(--color-bg-card)] p-4',
      tone === 'danger' && (usd + uyu > 0 ? 'border-red-500/30' : 'border-[var(--color-border)]'),
      tone === 'info' && (usd + uyu > 0 ? 'border-[var(--color-info-bg)]' : 'border-[var(--color-border)]'),
      tone === 'net' && 'border-[var(--color-border)]',
    )}>
      <p className="text-[10px] font-mono uppercase tracking-wider text-[var(--color-text-muted)] mb-1">{label}</p>
      <div className="space-y-0.5">
        {usd !== 0 && <div className={klass('text-base font-bold tabular-nums', colorFor(usd))}>{fmtCurrency(usd, 'USD')}</div>}
        {uyu !== 0 && <div className={klass('text-base font-bold tabular-nums', colorFor(uyu))}>{fmtCurrency(uyu, 'UYU')}</div>}
        {usd === 0 && uyu === 0 && <div className="text-base text-[var(--color-text-muted)] font-normal">$0</div>}
      </div>
      {subtitle && <p className="text-[10px] text-[var(--color-text-muted)] mt-1">{subtitle}</p>}
    </div>
  );
}

type FacturaRow = { id: string; fecha: string; descripcion: string; monto: number; moneda: 'USD' | 'UYU'; montoPagado: number; saldoPendiente: number; status: FinanceMovementStatus; dueDate: string | null };

function FacturasTab({ facturas, total, filter, onFilterChange, canEdit, canDelete, onEdit, onDelete, deletingId }: {
  facturas: FacturaRow[];
  total: number;
  filter: 'all' | 'pending' | 'paid' | 'partial';
  onFilterChange: (f: 'all' | 'pending' | 'paid' | 'partial') => void;
  canEdit: boolean;
  canDelete: boolean;
  onEdit: (f: FacturaRow) => void;
  onDelete: (f: FacturaRow) => void;
  deletingId: string | null;
}) {
  const showActions = canEdit || canDelete;
  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2 flex-wrap">
        <span className="text-xs text-[var(--color-text-muted)]">Filtrar:</span>
        {(['all', 'pending', 'partial', 'paid'] as const).map(f => (
          <button
            key={f}
            onClick={() => onFilterChange(f)}
            className={klass(
              'text-xs px-2.5 py-1 rounded-full border transition-colors',
              filter === f
                ? 'bg-[var(--color-accent)] border-[var(--color-accent)] text-gray-900 font-semibold'
                : 'border-[var(--color-border)] text-[var(--color-text-secondary)] hover:bg-[var(--color-bg-card-hover)]',
            )}
          >
            {f === 'all' ? `Todas (${total})` : f === 'pending' ? 'Pendientes' : f === 'partial' ? 'Parciales' : 'Pagadas'}
          </button>
        ))}
      </div>
      {facturas.length === 0 ? (
        <p className="text-sm text-[var(--color-text-muted)] text-center py-12">Sin facturas</p>
      ) : (
        <div className="rounded-lg border border-[var(--color-border)] overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-[var(--color-bg-card-hover)] text-[10px] font-mono uppercase tracking-wider text-[var(--color-text-muted)]">
                <th className="px-3 py-2 text-left font-medium">Fecha</th>
                <th className="px-3 py-2 text-left font-medium">Descripción</th>
                <th className="px-2 py-2 text-left font-medium w-24">Vence</th>
                <th className="px-2 py-2 text-right font-medium w-32">Monto</th>
                <th className="px-2 py-2 text-right font-medium w-32">Pagado</th>
                <th className="px-2 py-2 text-right font-medium w-32">Saldo</th>
                <th className="px-2 py-2 text-right font-medium w-32">Estado</th>
                {showActions && <th className="px-2 py-2 text-right font-medium w-20">Acciones</th>}
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--color-border)]">
              {facturas.map(f => {
                const today = todayLocalISO();
                const overdue = f.dueDate != null && f.dueDate < today && f.saldoPendiente > 0.005;
                return (
                  <tr key={f.id} className={klass('hover:bg-[var(--color-bg-card-hover)]', overdue && 'bg-red-500/5')}>
                    <td className="px-3 py-2 text-[var(--color-text-muted)] whitespace-nowrap">{fmtDate(f.fecha)}</td>
                    <td className="px-3 py-2 text-[var(--color-text-primary)] truncate max-w-xs">
                      <Link to={`/finanzas/movimientos`} className="hover:underline">{f.descripcion}</Link>
                    </td>
                    <td className={klass('px-2 py-2 text-[11px] whitespace-nowrap', overdue ? 'text-red-400 font-semibold' : 'text-[var(--color-text-muted)]')}>
                      {f.dueDate ? (overdue ? '⚠ ' : '') + fmtDate(f.dueDate) : '—'}
                    </td>
                    <td className="px-2 py-2 text-right tabular-nums whitespace-nowrap text-[var(--color-text-primary)]">{fmtCurrency(f.monto, f.moneda)}</td>
                    <td className="px-2 py-2 text-right tabular-nums whitespace-nowrap text-[var(--color-text-secondary)]">{fmtCurrency(f.montoPagado, f.moneda)}</td>
                    <td className={klass('px-2 py-2 text-right tabular-nums whitespace-nowrap font-semibold', f.saldoPendiente > 0.005 ? 'text-[var(--color-warning-text)]' : 'text-[var(--color-state-done-text)]')}>
                      {fmtCurrency(f.saldoPendiente, f.moneda)}
                    </td>
                    <td className="px-2 py-2 text-right whitespace-nowrap">
                      <span className={klass('text-[10px] font-mono px-2 py-0.5 rounded uppercase', STATUS_COLOR[f.status])}>
                        {STATUS_LABEL[f.status]}
                      </span>
                    </td>
                    {showActions && (
                      <td className="px-2 py-2 text-right whitespace-nowrap">
                        <div className="inline-flex items-center gap-1">
                          {canEdit && (
                            <button
                              type="button"
                              onClick={() => onEdit(f)}
                              title="Editar factura"
                              aria-label="Editar factura"
                              className="p-1 rounded text-[var(--color-text-muted)] hover:bg-[var(--color-bg-card-hover)] hover:text-[var(--color-text-primary)]"
                            >
                              <Pencil className="w-3.5 h-3.5" />
                            </button>
                          )}
                          {canDelete && (
                            <button
                              type="button"
                              onClick={() => onDelete(f)}
                              disabled={deletingId === f.id}
                              title="Eliminar factura"
                              aria-label="Eliminar factura"
                              className="p-1 rounded text-[var(--color-text-muted)] hover:bg-red-500/15 hover:text-red-400 disabled:opacity-50"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          )}
                        </div>
                      </td>
                    )}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function isAutoPayment(p: { referencia: string | null; metodo: string }) {
  return p.metodo === 'OTRO' && !!p.referencia && (p.referencia.startsWith('Auto-pago:') || p.referencia.startsWith('[BACKFILL]'));
}

function PagosTab({ pagos, total, filter, onFilterChange, onPagoClick }: {
  pagos: { id: string; fecha: string; monto: number; moneda: 'USD' | 'UYU'; metodo: string; referencia: string | null; montoAplicado: number; saldoSinAplicar: number }[];
  total: number;
  filter: 'all' | 'with-balance' | 'applied';
  onFilterChange: (f: 'all' | 'with-balance' | 'applied') => void;
  onPagoClick: (id: string) => void;
}) {
  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2 flex-wrap">
        <span className="text-xs text-[var(--color-text-muted)]">Filtrar:</span>
        {(['all', 'with-balance', 'applied'] as const).map(f => (
          <button
            key={f}
            onClick={() => onFilterChange(f)}
            className={klass(
              'text-xs px-2.5 py-1 rounded-full border transition-colors',
              filter === f
                ? 'bg-[var(--color-accent)] border-[var(--color-accent)] text-gray-900 font-semibold'
                : 'border-[var(--color-border)] text-[var(--color-text-secondary)] hover:bg-[var(--color-bg-card-hover)]',
            )}
          >
            {f === 'all' ? `Todos (${total})` : f === 'with-balance' ? 'Con saldo' : 'Aplicados'}
          </button>
        ))}
      </div>
      {pagos.length === 0 ? (
        <p className="text-sm text-[var(--color-text-muted)] text-center py-12">Sin pagos</p>
      ) : (
        <div className="rounded-lg border border-[var(--color-border)] overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-[var(--color-bg-card-hover)] text-[10px] font-mono uppercase tracking-wider text-[var(--color-text-muted)]">
                <th className="px-3 py-2 text-left font-medium">Fecha</th>
                <th className="px-2 py-2 text-left font-medium">Método</th>
                <th className="px-3 py-2 text-left font-medium">Referencia</th>
                <th className="px-2 py-2 text-right font-medium w-32">Monto</th>
                <th className="px-2 py-2 text-right font-medium w-32">Aplicado</th>
                <th className="px-2 py-2 text-right font-medium w-32">Estado</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--color-border)]">
              {pagos.map(p => {
                const conSaldo = p.saldoSinAplicar > 0.005;
                return (
                  <tr key={p.id} onClick={() => onPagoClick(p.id)} className="cursor-pointer hover:bg-[var(--color-bg-card-hover)]">
                    <td className="px-3 py-2 text-[var(--color-text-muted)] whitespace-nowrap">{fmtDate(p.fecha)}</td>
                    <td className="px-2 py-2 text-[var(--color-text-secondary)] whitespace-nowrap">
                      <div className="flex items-center gap-1.5">
                        <span>{METODO_PAGO_LABEL[p.metodo as keyof typeof METODO_PAGO_LABEL] ?? p.metodo}</span>
                        {isAutoPayment(p) && (
                          <span
                            title={p.referencia?.startsWith('[BACKFILL]') ? 'Pago retroactivo creado por el backfill de G.8' : 'Pago generado automáticamente al crear el movimiento PAGADO directamente'}
                            className="text-[9px] font-mono px-1.5 py-0.5 rounded uppercase border border-[var(--color-border)] text-[var(--color-text-muted)]"
                          >
                            Auto
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="px-3 py-2 text-[var(--color-text-muted)] text-[11px] truncate max-w-[200px]">{p.referencia ?? '—'}</td>
                    <td className="px-2 py-2 text-right tabular-nums whitespace-nowrap text-[var(--color-text-primary)]">{fmtCurrency(p.monto, p.moneda)}</td>
                    <td className="px-2 py-2 text-right tabular-nums whitespace-nowrap text-[var(--color-text-secondary)]">{fmtCurrency(p.montoAplicado, p.moneda)}</td>
                    <td className="px-2 py-2 text-right whitespace-nowrap">
                      {conSaldo ? (
                        <span className="inline-flex items-center gap-1 text-[10px] font-mono px-2 py-0.5 rounded uppercase bg-[var(--color-warning-bg)] text-[var(--color-warning-text)]">
                          <AlertTriangle className="w-3 h-3" />
                          Saldo: {fmtCurrency(p.saldoSinAplicar, p.moneda)}
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 text-[10px] font-mono px-2 py-0.5 rounded uppercase bg-[var(--color-state-done-bg)] text-[var(--color-state-done-text)]">
                          <CheckCircle2 className="w-3 h-3" />
                          Aplicado
                        </span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function EstadoCuentaTab({ eventos, tcInfo }: {
  eventos: { tipo: 'factura' | 'pago'; fecha: string; monto: number; moneda: 'USD' | 'UYU'; descripcion: string; saldoAcumuladoUSD: number }[];
  tcInfo: { usdToUyu: number; date: string } | null;
}) {
  if (eventos.length === 0) {
    return <p className="text-sm text-[var(--color-text-muted)] text-center py-12">Sin movimientos para mostrar</p>;
  }
  return (
    <div className="space-y-3">
      <p className="text-[11px] text-[var(--color-text-muted)] leading-relaxed">
        Línea de tiempo cronológica de facturas y pagos. El saldo acumulado se calcula en USD;
        UYU se convierte con el último tipo de cambio
        {tcInfo ? ` (1 USD = ${tcInfo.usdToUyu.toLocaleString('es-UY', { minimumFractionDigits: 2 })} UYU del ${fmtDate(tcInfo.date)})` : ''}.
        Saldo positivo = le debemos al proveedor; negativo = saldo a favor del proveedor.
      </p>
      <div className="rounded-lg border border-[var(--color-border)] overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-[var(--color-bg-card-hover)] text-[10px] font-mono uppercase tracking-wider text-[var(--color-text-muted)]">
              <th className="px-3 py-2 text-left font-medium w-24">Fecha</th>
              <th className="px-2 py-2 text-left font-medium w-20">Tipo</th>
              <th className="px-3 py-2 text-left font-medium">Descripción</th>
              <th className="px-2 py-2 text-right font-medium w-32">Monto</th>
              <th className="px-2 py-2 text-right font-medium w-32">Saldo (USD)</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[var(--color-border)]">
            {eventos.map((e, idx) => (
              <tr key={idx} className="hover:bg-[var(--color-bg-card-hover)]">
                <td className="px-3 py-2 text-[var(--color-text-muted)] whitespace-nowrap">{fmtDate(e.fecha)}</td>
                <td className="px-2 py-2">
                  <span className={klass(
                    'text-[10px] font-mono px-2 py-0.5 rounded uppercase',
                    e.tipo === 'factura' ? 'bg-red-500/15 text-red-300' : 'bg-green-500/15 text-green-300',
                  )}>
                    {e.tipo === 'factura' ? 'Factura' : 'Pago'}
                  </span>
                </td>
                <td className="px-3 py-2 text-[var(--color-text-primary)] truncate max-w-xs">{e.descripcion}</td>
                <td className={klass(
                  'px-2 py-2 text-right tabular-nums whitespace-nowrap font-semibold',
                  e.tipo === 'factura' ? 'text-red-400' : 'text-green-400',
                )}>
                  {e.tipo === 'factura' ? '+' : '-'}{fmtCurrency(e.monto, e.moneda)}
                </td>
                <td className={klass(
                  'px-2 py-2 text-right tabular-nums whitespace-nowrap',
                  e.saldoAcumuladoUSD > 0.005 ? 'text-red-400' : e.saldoAcumuladoUSD < -0.005 ? 'text-green-400' : 'text-[var(--color-text-muted)]',
                )}>
                  {fmtCurrency(e.saldoAcumuladoUSD, 'USD')}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// Re-uso del icono ArrowRight para evitar warning de unused import
void ArrowRight;

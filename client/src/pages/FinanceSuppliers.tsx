import { useState, useEffect, useMemo } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'react-hot-toast';
import { Plus, X, Search, FileText } from 'lucide-react';
import { Spinner } from '../components/ui/Spinner';
import { ResponsiveTable, type Column } from '../components/ui/ResponsiveTable';
import {
  getSuppliers, createSupplier, patchSupplier,
} from '../api/finance.api';
import { NewSupplierInvoiceModal } from '../components/finance/NewSupplierInvoiceModal';
import { fmtCurrency, fmtDate } from '../lib/finance';
import type { Supplier } from '../types/finance.types';

function klass(...p: (string | false | undefined)[]) { return p.filter(Boolean).join(' '); }
function getApiErr(err: unknown) {
  return (err as { response?: { data?: { message?: string } } })?.response?.data?.message;
}

const inp = 'w-full rounded-lg border border-[var(--color-border)] bg-[var(--color-bg-app)] px-3 py-2 text-sm text-[var(--color-text-primary)] focus:outline-none focus:ring-2 focus:ring-[var(--color-accent)]';
const lbl = 'block text-xs font-mono text-[var(--color-text-muted)] mb-1 uppercase tracking-wider';

// ─── Supplier Form ────────────────────────────────────────────────────────────

export function SupplierForm({ initial, supplierId, onSuccess, onCancel }: {
  initial?: Supplier | null;
  supplierId?: string;
  onSuccess: () => void;
  onCancel: () => void;
}) {
  const [form, setForm] = useState({
    nombre: initial?.nombre ?? '',
    rut: initial?.rut ?? '',
    contactoNombre: initial?.contactoNombre ?? '',
    email: initial?.email ?? '',
    telefono: initial?.telefono ?? '',
    direccion: initial?.direccion ?? '',
    condicionPago: initial?.condicionPago ?? '',
    notas: initial?.notas ?? '',
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const body = {
        nombre: form.nombre,
        ...(form.rut ? { rut: form.rut } : {}),
        ...(form.contactoNombre ? { contactoNombre: form.contactoNombre } : {}),
        ...(form.email ? { email: form.email } : {}),
        ...(form.telefono ? { telefono: form.telefono } : {}),
        ...(form.direccion ? { direccion: form.direccion } : {}),
        ...(form.condicionPago ? { condicionPago: form.condicionPago } : {}),
        ...(form.notas ? { notas: form.notas } : {}),
      };
      if (supplierId) {
        await patchSupplier(supplierId, body);
        toast.success('Proveedor actualizado');
      } else {
        await createSupplier(body);
        toast.success('Proveedor creado');
      }
      onSuccess();
    } catch (err) {
      setError(getApiErr(err) ?? 'Error al guardar');
    } finally {
      setLoading(false);
    }
  }

  function setF(key: keyof typeof form, v: string) { setForm(p => ({ ...p, [key]: v })); }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div><label className={lbl}>Nombre *</label><input className={inp} value={form.nombre} onChange={e => setF('nombre', e.target.value)} required /></div>
      <div className="grid grid-cols-2 gap-3">
        <div><label className={lbl}>RUT / CUIT</label><input className={inp} value={form.rut} onChange={e => setF('rut', e.target.value)} /></div>
        <div><label className={lbl}>Persona de contacto</label><input className={inp} value={form.contactoNombre} onChange={e => setF('contactoNombre', e.target.value)} /></div>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div><label className={lbl}>Email</label><input type="email" className={inp} value={form.email} onChange={e => setF('email', e.target.value)} /></div>
        <div><label className={lbl}>Teléfono</label><input className={inp} value={form.telefono} onChange={e => setF('telefono', e.target.value)} /></div>
      </div>
      <div><label className={lbl}>Dirección</label><input className={inp} value={form.direccion} onChange={e => setF('direccion', e.target.value)} /></div>
      <div><label className={lbl}>Condición de pago</label><textarea className={klass(inp, 'resize-none')} rows={2} value={form.condicionPago} onChange={e => setF('condicionPago', e.target.value)} /></div>
      <div><label className={lbl}>Notas</label><textarea className={klass(inp, 'resize-none')} rows={2} value={form.notas} onChange={e => setF('notas', e.target.value)} /></div>
      {error && <p className="text-sm text-red-400 bg-red-500/10 rounded-lg px-3 py-2">{error}</p>}
      <div className="flex gap-3">
        <button type="submit" disabled={loading}
          className="flex-1 py-2 rounded-lg bg-[var(--color-accent)] text-gray-900 text-sm font-semibold hover:bg-[var(--color-accent-hover)] transition-colors disabled:opacity-60">
          {loading ? 'Guardando...' : (supplierId ? 'Guardar cambios' : 'Crear proveedor')}
        </button>
        <button type="button" onClick={onCancel}
          className="px-4 py-2 rounded-lg border border-[var(--color-border)] text-sm text-[var(--color-text-secondary)] hover:bg-[var(--color-bg-card-hover)] transition-colors">
          Cancelar
        </button>
      </div>
    </form>
  );
}

// ─── Saldo neto helper ───────────────────────────────────────────────────────

function SaldoNetoCell({ supplier }: { supplier: Supplier }) {
  const b = supplier.balance;
  if (!b) return <span className="text-[var(--color-text-muted)]">—</span>;
  const usd = b.saldoNetoUSD;
  const uyu = b.saldoNetoUYU;
  if (usd === 0 && uyu === 0) return <span className="text-[var(--color-text-muted)] tabular-nums">$0</span>;
  function colorFor(v: number) {
    if (v > 0) return 'text-red-400';      // debemos (positivo)
    if (v < 0) return 'text-green-400';    // a favor del proveedor (saldo a favor)
    return 'text-[var(--color-text-muted)]';
  }
  return (
    <div className="space-y-0.5">
      {usd !== 0 && <div className={klass('text-sm font-semibold tabular-nums', colorFor(usd))}>{fmtCurrency(usd, 'USD')}</div>}
      {uyu !== 0 && <div className={klass('text-sm font-semibold tabular-nums', colorFor(uyu))}>{fmtCurrency(uyu, 'UYU')}</div>}
    </div>
  );
}

// ─── Lista de proveedores ────────────────────────────────────────────────────

type ActivoFilter = 'true' | 'false' | 'all';
const FILTER_KEY = 'finance-suppliers-filters-v2';

export function FinanceSuppliers() {
  const qc = useQueryClient();
  const navigate = useNavigate();
  const [newModal, setNewModal] = useState(false);
  const [showNewInvoice, setShowNewInvoice] = useState(false);
  const [activoFilter, setActivoFilter] = useState<ActivoFilter>('true');
  const [search, setSearch] = useState('');

  useEffect(() => {
    try {
      const raw = localStorage.getItem(FILTER_KEY);
      if (raw) {
        const p = JSON.parse(raw) as { activo?: ActivoFilter; search?: string };
        if (p.activo === 'true' || p.activo === 'false' || p.activo === 'all') setActivoFilter(p.activo);
        if (typeof p.search === 'string') setSearch(p.search);
      }
    } catch { /* ignore */ }
  }, []);
  useEffect(() => {
    localStorage.setItem(FILTER_KEY, JSON.stringify({ activo: activoFilter, search }));
  }, [activoFilter, search]);

  const { data: suppliers = [], isLoading } = useQuery({
    queryKey: ['suppliers', activoFilter, 'with-balance'],
    queryFn: () => getSuppliers({ activo: activoFilter, withBalance: 'true' }),
  });

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return suppliers;
    return suppliers.filter(s =>
      s.nombre.toLowerCase().includes(q)
      || (s.rut?.toLowerCase().includes(q) ?? false)
      || (s.contactoNombre?.toLowerCase().includes(q) ?? false)
      || (s.email?.toLowerCase().includes(q) ?? false),
    );
  }, [suppliers, search]);

  // Columnas declarativas para <ResponsiveTable>. En ≥md tabla equivalente;
  // en <md cards (title=Nombre, highlight=Saldo neto, resto en cuerpo).
  const columns: Column<Supplier>[] = [
    {
      key: 'nombre', label: 'Nombre', cardRole: 'title',
      className: 'font-medium text-[var(--color-text-primary)]',
      render: (s) => (
        <Link to={`/finanzas/proveedores/${s.id}`} className="hover:underline">{s.nombre}</Link>
      ),
    },
    { key: 'rut', label: 'RUT', className: 'text-[var(--color-text-muted)]', render: (s) => s.rut ?? '—' },
    { key: 'contacto', label: 'Contacto', className: 'text-[var(--color-text-muted)]', render: (s) => s.contactoNombre ?? '—' },
    { key: 'saldo', label: 'Saldo neto', cardRole: 'highlight', render: (s) => <SaldoNetoCell supplier={s} /> },
    {
      key: 'pendientes', label: 'Pendientes', className: 'text-[var(--color-text-muted)] tabular-nums',
      render: (s) => (s.balance ? s.balance.facturasPendientesCount : '—'),
    },
    {
      key: 'actividad', label: 'Últ. actividad', className: 'text-[var(--color-text-muted)] text-[11px]',
      render: (s) => (s.balance?.ultimaActividad ? fmtDate(s.balance.ultimaActividad) : '—'),
    },
    {
      key: 'estado', label: 'Estado',
      render: (s) => (
        <span className={klass('text-[10px] font-mono px-2 py-0.5 rounded uppercase',
          s.activo ? 'bg-[var(--color-state-done-bg)] text-[var(--color-state-done-text)]' : 'bg-[var(--color-border)] text-[var(--color-text-muted)]')}>
          {s.activo ? 'Activo' : 'Inactivo'}
        </span>
      ),
    },
  ];

  return (
    <div className="p-6 space-y-5">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="font-display text-2xl font-bold text-[var(--color-text-primary)]">Proveedores</h1>
          <p className="text-sm text-[var(--color-text-muted)] mt-0.5">{filtered.length} de {suppliers.length} proveedor{suppliers.length !== 1 ? 'es' : ''}</p>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={() => setShowNewInvoice(true)}
            className="flex items-center gap-2 px-4 py-2 rounded-lg border border-[var(--color-border)] bg-[var(--color-bg-card)] text-sm font-semibold text-[var(--color-text-primary)] hover:bg-[var(--color-bg-card-hover)] transition-colors">
            <FileText className="w-4 h-4" /> Nueva factura a pagar
          </button>
          <button onClick={() => setNewModal(true)}
            className="flex items-center gap-2 px-4 py-2 rounded-lg bg-[var(--color-accent)] text-gray-900 text-sm font-semibold hover:bg-[var(--color-accent-hover)] transition-colors">
            <Plus className="w-4 h-4" /> Nuevo proveedor
          </button>
        </div>
      </div>

      <div className="flex items-center gap-3 flex-wrap">
        <div className="relative flex-1 min-w-[220px] max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[var(--color-text-muted)]" />
          <input
            type="text"
            placeholder="Buscar por nombre, RUT, contacto o email"
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="w-full pl-9 pr-3 py-2 rounded-lg border border-[var(--color-border)] bg-[var(--color-bg-card)] text-sm text-[var(--color-text-primary)] focus:outline-none focus:ring-2 focus:ring-[var(--color-accent)]"
          />
        </div>
        <div className="flex rounded-lg border border-[var(--color-border)] overflow-hidden text-xs font-mono uppercase tracking-wider">
          {([['true', 'Activos'], ['all', 'Todos'], ['false', 'Inactivos']] as const).map(([val, label]) => (
            <button
              key={val}
              onClick={() => setActivoFilter(val)}
              className={klass(
                'tap-target px-3 py-2 transition-colors',
                activoFilter === val
                  ? 'bg-[var(--color-accent)] text-gray-900 font-semibold'
                  : 'bg-[var(--color-bg-card)] text-[var(--color-text-secondary)] hover:bg-[var(--color-bg-card-hover)]',
              )}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      <div className="bg-[var(--color-bg-card)] border border-[var(--color-border)] rounded-xl overflow-hidden">
        {isLoading ? (
          <div className="flex items-center justify-center py-12"><Spinner /></div>
        ) : filtered.length === 0 ? (
          <p className="text-sm text-[var(--color-text-muted)] text-center py-12">
            {suppliers.length === 0 ? 'Sin proveedores registrados' : 'Ningún proveedor coincide con los filtros'}
          </p>
        ) : (
          <div className="overflow-x-auto">
            <ResponsiveTable
              columns={columns}
              data={filtered}
              rowKey={(s) => s.id}
              onRowClick={(s) => navigate(`/finanzas/proveedores/${s.id}`)}
              rowClickableOnDesktop
            />
          </div>
        )}
      </div>

      {newModal && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4">
          <div className="bg-[var(--color-bg-card)] border border-[var(--color-border)] rounded-xl p-6 w-full max-w-lg shadow-2xl">
            <div className="flex items-center justify-between mb-4">
              <p className="text-sm font-semibold text-[var(--color-text-primary)]">Nuevo proveedor</p>
              <button onClick={() => setNewModal(false)} className="text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)]"><X className="w-5 h-5" /></button>
            </div>
            <SupplierForm
              onSuccess={() => { setNewModal(false); qc.invalidateQueries({ queryKey: ['suppliers'] }); }}
              onCancel={() => setNewModal(false)}
            />
          </div>
        </div>
      )}

      {showNewInvoice && (
        <NewSupplierInvoiceModal
          onClose={() => setShowNewInvoice(false)}
          onCreated={() => qc.invalidateQueries({ queryKey: ['suppliers'] })}
        />
      )}
    </div>
  );
}

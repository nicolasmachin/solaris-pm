import { useEffect, useMemo, useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'react-hot-toast';
import { Plus, X, Search, ChevronUp, ChevronDown, Pencil, Power } from 'lucide-react';
import {
  getMaterialCategories, createMaterialCategory, patchMaterialCategory, deleteMaterialCategory, reorderMaterialCategories,
  getMaterialItems, createMaterialItem, patchMaterialItem, deleteMaterialItem,
} from '../api/materials.api';
import { getSuppliers } from '../api/finance.api';
import type { MaterialCategory, MaterialItem } from '../types/materials.types';
import type { Moneda } from '../types/finance.types';

function klass(...p: (string | false | undefined)[]) { return p.filter(Boolean).join(' '); }

const inp = 'w-full rounded-lg border border-[var(--color-border)] bg-[var(--color-bg-app)] px-3 py-2 text-sm text-[var(--color-text-primary)] focus:outline-none focus:ring-2 focus:ring-[var(--color-accent)]';
const lbl = 'block text-xs font-mono text-[var(--color-text-muted)] mb-1 uppercase tracking-wider';

const FILTER_KEY = 'admin-materiales-filters-v1';

type Sub = 'categorias' | 'items';

function getApiErr(err: unknown) {
  return (err as { response?: { data?: { message?: string } } })?.response?.data?.message;
}

// ─── Modal genérico ────────────────────────────────────────────────────────────

function Modal({ title, onClose, children, maxWidth = 'max-w-md' }: { title: string; onClose: () => void; children: React.ReactNode; maxWidth?: string }) {
  return (
    <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4" onClick={e => { if (e.target === e.currentTarget) onClose(); }}>
      <div className={klass('bg-[var(--color-bg-card)] border border-[var(--color-border)] rounded-xl p-6 w-full shadow-2xl', maxWidth)}>
        <div className="flex items-center justify-between mb-4">
          <p className="text-sm font-semibold text-[var(--color-text-primary)]">{title}</p>
          <button onClick={onClose} className="text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)]"><X className="w-5 h-5" /></button>
        </div>
        {children}
      </div>
    </div>
  );
}

// ─── Categoría — form ──────────────────────────────────────────────────────────

function CategoryForm({ initial, onSuccess, onCancel }: { initial?: MaterialCategory | null; onSuccess: () => void; onCancel: () => void }) {
  const [nombre, setNombre] = useState(initial?.nombre ?? '');
  const [descripcion, setDescripcion] = useState(initial?.descripcion ?? '');
  const [activa, setActiva] = useState(initial?.activa ?? true);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      if (initial) {
        await patchMaterialCategory(initial.id, {
          nombre,
          descripcion: descripcion || null,
          activa,
        });
        toast.success('Categoría actualizada');
      } else {
        await createMaterialCategory({ nombre, ...(descripcion ? { descripcion } : {}) });
        toast.success('Categoría creada');
      }
      onSuccess();
    } catch (err) {
      setError(getApiErr(err) ?? 'Error al guardar');
    } finally {
      setLoading(false);
    }
  }

  return (
    <form onSubmit={submit} className="space-y-4">
      <div><label className={lbl}>Nombre *</label><input className={inp} value={nombre} onChange={e => setNombre(e.target.value)} required autoFocus /></div>
      <div><label className={lbl}>Descripción</label><textarea className={klass(inp, 'resize-none')} rows={2} value={descripcion} onChange={e => setDescripcion(e.target.value)} /></div>
      {initial && (
        <label className="flex items-center gap-2 text-sm text-[var(--color-text-secondary)] cursor-pointer">
          <input type="checkbox" checked={activa} onChange={e => setActiva(e.target.checked)} />
          Activa
        </label>
      )}
      {error && <p className="text-sm text-red-400 bg-red-500/10 rounded-lg px-3 py-2">{error}</p>}
      <div className="flex gap-3">
        <button type="submit" disabled={loading} className="flex-1 py-2 rounded-lg bg-[var(--color-accent)] text-gray-900 text-sm font-semibold hover:bg-[var(--color-accent-hover)] transition-colors disabled:opacity-60">
          {loading ? 'Guardando...' : (initial ? 'Guardar cambios' : 'Crear categoría')}
        </button>
        <button type="button" onClick={onCancel} className="px-4 py-2 rounded-lg border border-[var(--color-border)] text-sm text-[var(--color-text-secondary)] hover:bg-[var(--color-bg-card-hover)] transition-colors">Cancelar</button>
      </div>
    </form>
  );
}

// ─── Categorías — listado ──────────────────────────────────────────────────────

function CategoriesPanel() {
  const qc = useQueryClient();
  const [showAll, setShowAll] = useState(true);
  const [editing, setEditing] = useState<MaterialCategory | null>(null);
  const [creating, setCreating] = useState(false);

  const { data: categories = [], isLoading } = useQuery({
    queryKey: ['material-categories', showAll ? 'all' : 'true'],
    queryFn: () => getMaterialCategories({ activa: showAll ? 'all' : 'true' }),
  });

  const reorderMut = useMutation({
    mutationFn: (ids: string[]) => reorderMaterialCategories(ids),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['material-categories'] }),
  });

  function move(idx: number, dir: -1 | 1) {
    const target = idx + dir;
    if (target < 0 || target >= categories.length) return;
    const next = categories.slice();
    [next[idx], next[target]] = [next[target], next[idx]];
    reorderMut.mutate(next.map(c => c.id));
  }

  async function toggleActive(c: MaterialCategory) {
    try {
      await patchMaterialCategory(c.id, { activa: !c.activa });
      qc.invalidateQueries({ queryKey: ['material-categories'] });
    } catch (err) {
      toast.error(getApiErr(err) ?? 'No se pudo cambiar el estado');
    }
  }

  async function handleDelete(c: MaterialCategory) {
    if (!confirm(`¿Eliminar la categoría "${c.nombre}"?` + ((c._count?.items ?? 0) > 0 ? ' Tiene ítems vinculados, será desactivada.' : ''))) return;
    try {
      const result = await deleteMaterialCategory(c.id);
      toast.success(result.deactivated ? 'Categoría desactivada (tiene ítems)' : 'Categoría eliminada');
      qc.invalidateQueries({ queryKey: ['material-categories'] });
    } catch (err) {
      toast.error(getApiErr(err) ?? 'Error al eliminar');
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <label className="flex items-center gap-2 text-sm text-[var(--color-text-secondary)] cursor-pointer">
          <input type="checkbox" checked={showAll} onChange={e => setShowAll(e.target.checked)} />
          Mostrar inactivas
        </label>
        <button onClick={() => setCreating(true)} className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-[var(--color-accent)] text-gray-900 text-sm font-semibold hover:bg-[var(--color-accent-hover)] transition-colors">
          <Plus className="w-4 h-4" /> Nueva categoría
        </button>
      </div>

      {isLoading ? (
        <p className="text-sm text-[var(--color-text-muted)] text-center py-8">Cargando...</p>
      ) : categories.length === 0 ? (
        <p className="text-sm text-[var(--color-text-muted)] text-center py-8">Sin categorías</p>
      ) : (
        <div className="bg-[var(--color-bg-card)] border border-[var(--color-border)] rounded-xl overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-[var(--color-border)] text-xs font-mono text-[var(--color-text-muted)] uppercase tracking-wider">
                <th className="px-4 py-3 text-left font-medium w-20">Orden</th>
                <th className="px-4 py-3 text-left font-medium">Nombre</th>
                <th className="px-4 py-3 text-left font-medium w-24">Ítems</th>
                <th className="px-4 py-3 text-left font-medium w-24">Estado</th>
                <th className="px-4 py-3 text-right font-medium w-32">Acciones</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--color-border)]">
              {categories.map((c, idx) => (
                <tr key={c.id} className={klass('hover:bg-[var(--color-bg-card-hover)] transition-colors', !c.activa && 'opacity-60')}>
                  <td className="px-4 py-2">
                    <div className="flex items-center gap-1">
                      <button onClick={() => move(idx, -1)} disabled={idx === 0 || reorderMut.isPending} className="p-1 rounded hover:bg-[var(--color-border)] disabled:opacity-30">
                        <ChevronUp className="w-4 h-4" />
                      </button>
                      <button onClick={() => move(idx, 1)} disabled={idx === categories.length - 1 || reorderMut.isPending} className="p-1 rounded hover:bg-[var(--color-border)] disabled:opacity-30">
                        <ChevronDown className="w-4 h-4" />
                      </button>
                    </div>
                  </td>
                  <td className="px-4 py-2 font-medium text-[var(--color-text-primary)]">
                    <div>{c.nombre}</div>
                    {c.descripcion && <div className="text-xs text-[var(--color-text-muted)]">{c.descripcion}</div>}
                  </td>
                  <td className="px-4 py-2 text-[var(--color-text-muted)] tabular-nums">{c._count?.items ?? 0}</td>
                  <td className="px-4 py-2">
                    <span className={klass('text-[10px] font-mono px-2 py-0.5 rounded uppercase', c.activa ? 'bg-[var(--color-state-done-bg)] text-[var(--color-state-done-text)]' : 'bg-[var(--color-border)] text-[var(--color-text-muted)]')}>
                      {c.activa ? 'Activa' : 'Inactiva'}
                    </span>
                  </td>
                  <td className="px-4 py-2 text-right">
                    <div className="inline-flex gap-1">
                      <button title="Editar" onClick={() => setEditing(c)} className="p-1.5 rounded hover:bg-[var(--color-border)] text-[var(--color-text-secondary)]">
                        <Pencil className="w-4 h-4" />
                      </button>
                      <button title={c.activa ? 'Desactivar' : 'Activar'} onClick={() => toggleActive(c)} className="p-1.5 rounded hover:bg-[var(--color-border)] text-[var(--color-text-secondary)]">
                        <Power className="w-4 h-4" />
                      </button>
                      <button title="Eliminar" onClick={() => handleDelete(c)} className="p-1.5 rounded hover:bg-red-500/15 text-red-400">
                        <X className="w-4 h-4" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {creating && (
        <Modal title="Nueva categoría" onClose={() => setCreating(false)}>
          <CategoryForm onSuccess={() => { setCreating(false); qc.invalidateQueries({ queryKey: ['material-categories'] }); }} onCancel={() => setCreating(false)} />
        </Modal>
      )}
      {editing && (
        <Modal title={`Editar "${editing.nombre}"`} onClose={() => setEditing(null)}>
          <CategoryForm initial={editing} onSuccess={() => { setEditing(null); qc.invalidateQueries({ queryKey: ['material-categories'] }); }} onCancel={() => setEditing(null)} />
        </Modal>
      )}
    </div>
  );
}

// ─── Ítem — form ───────────────────────────────────────────────────────────────

function ItemForm({ initial, categories, suppliers, onSuccess, onCancel }: {
  initial?: MaterialItem | null;
  categories: MaterialCategory[];
  suppliers: { id: string; nombre: string }[];
  onSuccess: () => void;
  onCancel: () => void;
}) {
  const [form, setForm] = useState({
    categoryId: initial?.categoryId ?? (categories[0]?.id ?? ''),
    nombre: initial?.nombre ?? '',
    descripcion: initial?.descripcion ?? '',
    unidad: initial?.unidad ?? 'un',
    precioSugerido: initial?.precioSugerido?.toString() ?? '',
    moneda: (initial?.moneda ?? 'USD') as Moneda,
    ivaTasa: (initial?.ivaTasa ?? 22).toString(),
    defaultSupplierId: initial?.defaultSupplierId ?? '',
    activo: initial?.activo ?? true,
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  function setF<K extends keyof typeof form>(k: K, v: typeof form[K]) { setForm(p => ({ ...p, [k]: v })); }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const precio = form.precioSugerido === '' ? undefined : parseFloat(form.precioSugerido);
      const ivaTasa = parseFloat(form.ivaTasa);
      if (initial) {
        await patchMaterialItem(initial.id, {
          categoryId: form.categoryId,
          nombre: form.nombre,
          descripcion: form.descripcion || null,
          unidad: form.unidad,
          precioSugerido: precio === undefined ? null : precio,
          moneda: form.moneda,
          ivaTasa: isFinite(ivaTasa) ? ivaTasa : 22,
          defaultSupplierId: form.defaultSupplierId || null,
          activo: form.activo,
        });
        toast.success('Ítem actualizado');
      } else {
        await createMaterialItem({
          categoryId: form.categoryId,
          nombre: form.nombre,
          ...(form.descripcion ? { descripcion: form.descripcion } : {}),
          unidad: form.unidad,
          ...(precio !== undefined ? { precioSugerido: precio } : {}),
          moneda: form.moneda,
          ivaTasa: isFinite(ivaTasa) ? ivaTasa : 22,
          ...(form.defaultSupplierId ? { defaultSupplierId: form.defaultSupplierId } : {}),
        });
        toast.success('Ítem creado');
      }
      onSuccess();
    } catch (err) {
      setError(getApiErr(err) ?? 'Error al guardar');
    } finally {
      setLoading(false);
    }
  }

  return (
    <form onSubmit={submit} className="space-y-4">
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className={lbl}>Categoría *</label>
          <select className={inp} value={form.categoryId} onChange={e => setF('categoryId', e.target.value)} required>
            {categories.filter(c => c.activa || c.id === form.categoryId).map(c => (
              <option key={c.id} value={c.id}>{c.nombre}</option>
            ))}
          </select>
        </div>
        <div>
          <label className={lbl}>Unidad *</label>
          <input className={inp} value={form.unidad} onChange={e => setF('unidad', e.target.value)} required placeholder="un, kg, m, m²" />
        </div>
      </div>
      <div><label className={lbl}>Nombre *</label><input className={inp} value={form.nombre} onChange={e => setF('nombre', e.target.value)} required /></div>
      <div><label className={lbl}>Descripción</label><textarea className={klass(inp, 'resize-none')} rows={2} value={form.descripcion} onChange={e => setF('descripcion', e.target.value)} /></div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className={lbl}>Precio sugerido</label>
          <div className="flex gap-2">
            <select className="rounded-lg border border-[var(--color-border)] bg-[var(--color-bg-app)] px-2 py-2 text-sm text-[var(--color-text-primary)] focus:outline-none focus:ring-2 focus:ring-[var(--color-accent)]" value={form.moneda} onChange={e => setF('moneda', e.target.value as Moneda)}>
              <option value="USD">USD</option>
              <option value="UYU">UYU</option>
            </select>
            <input type="number" min="0" step="0.01" className={klass(inp, 'flex-1')} value={form.precioSugerido} onChange={e => setF('precioSugerido', e.target.value)} placeholder="0" />
          </div>
        </div>
        <div>
          <label className={lbl}>IVA %</label>
          <input type="number" min="0" max="100" step="0.5" className={inp} value={form.ivaTasa} onChange={e => setF('ivaTasa', e.target.value)} placeholder="22" />
          <p className="text-[10px] text-[var(--color-text-muted)] mt-1">Default: 22% (tasa estándar Uruguay)</p>
        </div>
      </div>
      <div>
        <label className={lbl}>Proveedor por defecto</label>
        <select className={inp} value={form.defaultSupplierId} onChange={e => setF('defaultSupplierId', e.target.value)}>
          <option value="">— Sin proveedor —</option>
          {suppliers.map(s => <option key={s.id} value={s.id}>{s.nombre}</option>)}
        </select>
      </div>
      {initial && (
        <label className="flex items-center gap-2 text-sm text-[var(--color-text-secondary)] cursor-pointer">
          <input type="checkbox" checked={form.activo} onChange={e => setF('activo', e.target.checked)} />
          Activo
        </label>
      )}
      {error && <p className="text-sm text-red-400 bg-red-500/10 rounded-lg px-3 py-2">{error}</p>}
      <div className="flex gap-3">
        <button type="submit" disabled={loading} className="flex-1 py-2 rounded-lg bg-[var(--color-accent)] text-gray-900 text-sm font-semibold hover:bg-[var(--color-accent-hover)] transition-colors disabled:opacity-60">
          {loading ? 'Guardando...' : (initial ? 'Guardar cambios' : 'Crear ítem')}
        </button>
        <button type="button" onClick={onCancel} className="px-4 py-2 rounded-lg border border-[var(--color-border)] text-sm text-[var(--color-text-secondary)] hover:bg-[var(--color-bg-card-hover)] transition-colors">Cancelar</button>
      </div>
    </form>
  );
}

// ─── Ítems — listado ───────────────────────────────────────────────────────────

function ItemsPanel() {
  const qc = useQueryClient();
  const [categoryId, setCategoryId] = useState<string>('all');
  const [search, setSearch] = useState('');
  const [showAll, setShowAll] = useState(false);
  const [editing, setEditing] = useState<MaterialItem | null>(null);
  const [creating, setCreating] = useState(false);

  // Persistencia de filtros
  useEffect(() => {
    try {
      const raw = localStorage.getItem(FILTER_KEY);
      if (raw) {
        const p = JSON.parse(raw) as { categoryId?: string; search?: string; showAll?: boolean };
        if (typeof p.categoryId === 'string') setCategoryId(p.categoryId);
        if (typeof p.search === 'string') setSearch(p.search);
        if (typeof p.showAll === 'boolean') setShowAll(p.showAll);
      }
    } catch { /* ignore */ }
  }, []);
  useEffect(() => {
    localStorage.setItem(FILTER_KEY, JSON.stringify({ categoryId, search, showAll }));
  }, [categoryId, search, showAll]);

  const { data: categories = [] } = useQuery({
    queryKey: ['material-categories', 'all'],
    queryFn: () => getMaterialCategories({ activa: 'all' }),
  });

  const { data: suppliers = [] } = useQuery({
    queryKey: ['suppliers', 'true'],
    queryFn: () => getSuppliers({ activo: 'true' }),
  });

  const { data: items = [], isLoading } = useQuery({
    queryKey: ['material-items', categoryId, showAll ? 'all' : 'true'],
    queryFn: () => getMaterialItems({
      ...(categoryId !== 'all' ? { categoryId } : {}),
      activo: showAll ? 'all' : 'true',
    }),
  });

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return items;
    return items.filter(i => i.nombre.toLowerCase().includes(q) || (i.descripcion?.toLowerCase().includes(q) ?? false));
  }, [items, search]);

  async function toggleActive(it: MaterialItem) {
    try {
      await patchMaterialItem(it.id, { activo: !it.activo });
      qc.invalidateQueries({ queryKey: ['material-items'] });
    } catch (err) {
      toast.error(getApiErr(err) ?? 'No se pudo cambiar el estado');
    }
  }

  async function handleDelete(it: MaterialItem) {
    const inUse = (it._count?.projectMaterials ?? 0) > 0;
    if (!confirm(`¿Eliminar el ítem "${it.nombre}"?` + (inUse ? ' Está usado en proyectos, será desactivado.' : ''))) return;
    try {
      const r = await deleteMaterialItem(it.id);
      toast.success(r.deactivated ? 'Ítem desactivado (en uso)' : 'Ítem eliminado');
      qc.invalidateQueries({ queryKey: ['material-items'] });
    } catch (err) {
      toast.error(getApiErr(err) ?? 'Error al eliminar');
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3 flex-wrap">
        <div className="relative flex-1 min-w-[220px] max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[var(--color-text-muted)]" />
          <input type="text" placeholder="Buscar por nombre o descripción" value={search} onChange={e => setSearch(e.target.value)}
            className="w-full pl-9 pr-3 py-2 rounded-lg border border-[var(--color-border)] bg-[var(--color-bg-card)] text-sm text-[var(--color-text-primary)] focus:outline-none focus:ring-2 focus:ring-[var(--color-accent)]" />
        </div>
        <select value={categoryId} onChange={e => setCategoryId(e.target.value)}
          className="rounded-lg border border-[var(--color-border)] bg-[var(--color-bg-card)] px-3 py-2 text-sm text-[var(--color-text-primary)] focus:outline-none focus:ring-2 focus:ring-[var(--color-accent)]">
          <option value="all">Todas las categorías</option>
          {categories.map(c => <option key={c.id} value={c.id}>{c.nombre}{!c.activa ? ' (inactiva)' : ''}</option>)}
        </select>
        <label className="flex items-center gap-2 text-sm text-[var(--color-text-secondary)] cursor-pointer">
          <input type="checkbox" checked={showAll} onChange={e => setShowAll(e.target.checked)} />
          Mostrar inactivos
        </label>
        <button onClick={() => setCreating(true)} disabled={categories.filter(c => c.activa).length === 0}
          className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-[var(--color-accent)] text-gray-900 text-sm font-semibold hover:bg-[var(--color-accent-hover)] transition-colors disabled:opacity-60 ml-auto">
          <Plus className="w-4 h-4" /> Nuevo ítem
        </button>
      </div>

      {isLoading ? (
        <p className="text-sm text-[var(--color-text-muted)] text-center py-8">Cargando...</p>
      ) : filtered.length === 0 ? (
        <p className="text-sm text-[var(--color-text-muted)] text-center py-8">{items.length === 0 ? 'Sin ítems' : 'Ningún ítem coincide con los filtros'}</p>
      ) : (
        <div className="bg-[var(--color-bg-card)] border border-[var(--color-border)] rounded-xl overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-[var(--color-border)] text-xs font-mono text-[var(--color-text-muted)] uppercase tracking-wider">
                  {['Categoría', 'Nombre', 'Unidad', 'Precio sug.', 'IVA %', 'Precio sug. c/IVA', 'Proveedor default', 'Usado', 'Estado', ''].map((h, i) => (
                    <th key={i} className={klass('px-4 py-3 text-left font-medium', i === 9 && 'text-right')}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--color-border)]">
                {filtered.map(it => (
                  <tr key={it.id} className={klass('hover:bg-[var(--color-bg-card-hover)] transition-colors', !it.activo && 'opacity-60')}>
                    <td className="px-4 py-2 text-[var(--color-text-muted)]">{it.category?.nombre ?? '—'}</td>
                    <td className="px-4 py-2 font-medium text-[var(--color-text-primary)]">
                      <div>{it.nombre}</div>
                      {it.descripcion && <div className="text-xs text-[var(--color-text-muted)]">{it.descripcion}</div>}
                    </td>
                    <td className="px-4 py-2 text-[var(--color-text-muted)]">{it.unidad}</td>
                    <td className="px-4 py-2 tabular-nums text-[var(--color-text-secondary)]">
                      {it.precioSugerido != null ? `${it.precioSugerido.toLocaleString('es-UY', { minimumFractionDigits: 2 })} ${it.moneda}` : '—'}
                    </td>
                    <td className="px-4 py-2 tabular-nums text-[var(--color-text-secondary)]">{(it.ivaTasa ?? 22)}%</td>
                    <td className="px-4 py-2 tabular-nums text-[var(--color-text-muted)]">
                      {it.precioSugerido != null ? `${(it.precioSugerido * (1 + (it.ivaTasa ?? 22) / 100)).toLocaleString('es-UY', { minimumFractionDigits: 2 })} ${it.moneda}` : '—'}
                    </td>
                    <td className="px-4 py-2 text-[var(--color-text-muted)]">{it.defaultSupplier?.nombre ?? '—'}</td>
                    <td className="px-4 py-2 text-[var(--color-text-muted)] tabular-nums">{it._count?.projectMaterials ?? 0}</td>
                    <td className="px-4 py-2">
                      <span className={klass('text-[10px] font-mono px-2 py-0.5 rounded uppercase', it.activo ? 'bg-[var(--color-state-done-bg)] text-[var(--color-state-done-text)]' : 'bg-[var(--color-border)] text-[var(--color-text-muted)]')}>
                        {it.activo ? 'Activo' : 'Inactivo'}
                      </span>
                    </td>
                    <td className="px-4 py-2 text-right">
                      <div className="inline-flex gap-1">
                        <button title="Editar" onClick={() => setEditing(it)} className="p-1.5 rounded hover:bg-[var(--color-border)] text-[var(--color-text-secondary)]">
                          <Pencil className="w-4 h-4" />
                        </button>
                        <button title={it.activo ? 'Desactivar' : 'Activar'} onClick={() => toggleActive(it)} className="p-1.5 rounded hover:bg-[var(--color-border)] text-[var(--color-text-secondary)]">
                          <Power className="w-4 h-4" />
                        </button>
                        <button title="Eliminar" onClick={() => handleDelete(it)} className="p-1.5 rounded hover:bg-red-500/15 text-red-400">
                          <X className="w-4 h-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {creating && (
        <Modal title="Nuevo ítem" maxWidth="max-w-lg" onClose={() => setCreating(false)}>
          <ItemForm
            categories={categories}
            suppliers={suppliers}
            onSuccess={() => { setCreating(false); qc.invalidateQueries({ queryKey: ['material-items'] }); }}
            onCancel={() => setCreating(false)}
          />
        </Modal>
      )}
      {editing && (
        <Modal title={`Editar "${editing.nombre}"`} maxWidth="max-w-lg" onClose={() => setEditing(null)}>
          <ItemForm
            initial={editing}
            categories={categories}
            suppliers={suppliers}
            onSuccess={() => { setEditing(null); qc.invalidateQueries({ queryKey: ['material-items'] }); }}
            onCancel={() => setEditing(null)}
          />
        </Modal>
      )}
    </div>
  );
}

// ─── Tab principal ─────────────────────────────────────────────────────────────

export function TabMateriales() {
  const [sub, setSub] = useState<Sub>('categorias');
  return (
    <div className="space-y-5">
      <div className="flex gap-2 border-b border-[var(--color-border)]">
        {(['categorias', 'items'] as const).map(s => (
          <button
            key={s}
            onClick={() => setSub(s)}
            className={klass(
              'px-4 py-2 text-sm font-medium transition-colors -mb-px border-b-2',
              sub === s ? 'border-[var(--color-accent)] text-[var(--color-accent)]' : 'border-transparent text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)]',
            )}
          >
            {s === 'categorias' ? 'Categorías' : 'Ítems'}
          </button>
        ))}
      </div>
      {sub === 'categorias' ? <CategoriesPanel /> : <ItemsPanel />}
    </div>
  );
}

import { useMemo, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'react-hot-toast';
import { Plus, X, Search, Pencil, Power, ListChecks, Trash2 } from 'lucide-react';
import {
  getMaterialTemplates, createMaterialTemplate, patchMaterialTemplate,
  deleteMaterialTemplate, setMaterialTemplateItems,
} from '../api/materialTemplates.api';
import { getMaterialCategories, getMaterialItems } from '../api/materials.api';
import { MaterialPhotoButton } from '../components/materials/MaterialPhoto';
import type { MaterialTemplate, PhaseType } from '../types/materials.types';
import { PHASE_TYPE_LABELS } from '../types/materials.types';

function klass(...p: (string | false | undefined)[]) { return p.filter(Boolean).join(' '); }

const inp = 'w-full rounded-lg border border-[var(--color-border)] bg-[var(--color-bg-app)] px-3 py-2 text-sm text-[var(--color-text-primary)] focus:outline-none focus:ring-2 focus:ring-[var(--color-accent)]';
const lbl = 'block text-xs font-mono text-[var(--color-text-muted)] mb-1 uppercase tracking-wider';

const PHASE_OPTIONS: PhaseType[] = ['MONOFASICO', 'TRIFASICO_230', 'TRIFASICO_400'];

function getApiErr(err: unknown) {
  return (err as { response?: { data?: { message?: string } } })?.response?.data?.message;
}

// ─── Modal genérico ────────────────────────────────────────────────────────────

function Modal({ title, onClose, children, maxWidth = 'max-w-md' }: { title: string; onClose: () => void; children: React.ReactNode; maxWidth?: string }) {
  return (
    <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4" onMouseDown={e => { if (e.target === e.currentTarget) onClose(); }}>
      <div className={klass('bg-[var(--color-bg-card)] border border-[var(--color-border)] rounded-xl w-full shadow-2xl', maxWidth)}>
        <div className="flex items-center justify-between p-4 border-b border-[var(--color-border)]">
          <p className="text-sm font-semibold text-[var(--color-text-primary)]">{title}</p>
          <button onClick={onClose} className="text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)]"><X className="w-5 h-5" /></button>
        </div>
        {children}
      </div>
    </div>
  );
}

// ─── Plantilla — form de metadatos ─────────────────────────────────────────────

function TemplateForm({ initial, onSuccess, onCancel }: { initial?: MaterialTemplate | null; onSuccess: () => void; onCancel: () => void }) {
  const [nombre, setNombre] = useState(initial?.nombre ?? '');
  const [descripcion, setDescripcion] = useState(initial?.descripcion ?? '');
  const [phaseType, setPhaseType] = useState<PhaseType | ''>(initial?.phaseType ?? '');
  const [activa, setActiva] = useState(initial?.activa ?? true);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      if (initial) {
        await patchMaterialTemplate(initial.id, {
          nombre,
          descripcion: descripcion || null,
          phaseType: phaseType || null,
          activa,
        });
        toast.success('Plantilla actualizada');
      } else {
        await createMaterialTemplate({
          nombre,
          ...(descripcion ? { descripcion } : {}),
          ...(phaseType ? { phaseType } : {}),
        });
        toast.success('Plantilla creada');
      }
      onSuccess();
    } catch (err) {
      setError(getApiErr(err) ?? 'Error al guardar');
    } finally {
      setLoading(false);
    }
  }

  return (
    <form onSubmit={submit} className="space-y-4 p-4">
      <div><label className={lbl}>Nombre *</label><input className={inp} value={nombre} onChange={e => setNombre(e.target.value)} required autoFocus /></div>
      <div><label className={lbl}>Descripción</label><textarea className={klass(inp, 'resize-none')} rows={2} value={descripcion} onChange={e => setDescripcion(e.target.value)} /></div>
      <div>
        <label className={lbl}>Tipo de instalación</label>
        <select className={inp} value={phaseType} onChange={e => setPhaseType(e.target.value as PhaseType | '')}>
          <option value="">— Sin tipo —</option>
          {PHASE_OPTIONS.map(p => <option key={p} value={p}>{PHASE_TYPE_LABELS[p]}</option>)}
        </select>
      </div>
      {initial && (
        <label className="flex items-center gap-2 text-sm text-[var(--color-text-secondary)] cursor-pointer">
          <input type="checkbox" checked={activa} onChange={e => setActiva(e.target.checked)} />
          Activa
        </label>
      )}
      {error && <p className="text-sm text-red-400 bg-red-500/10 rounded-lg px-3 py-2">{error}</p>}
      <div className="flex gap-3">
        <button type="submit" disabled={loading} className="flex-1 py-2 rounded-lg bg-[var(--color-accent)] text-gray-900 text-sm font-semibold hover:bg-[var(--color-accent-hover)] transition-colors disabled:opacity-60">
          {loading ? 'Guardando...' : (initial ? 'Guardar cambios' : 'Crear plantilla')}
        </button>
        <button type="button" onClick={onCancel} className="px-4 py-2 rounded-lg border border-[var(--color-border)] text-sm text-[var(--color-text-secondary)] hover:bg-[var(--color-bg-card-hover)] transition-colors">Cancelar</button>
      </div>
    </form>
  );
}

// ─── Editor de ítems de la plantilla ────────────────────────────────────────────

interface WorkingLine { materialItemId: string; nombre: string; unidad: string; categoria: string; quantity: string }

function TemplateItemsEditor({ template, onSuccess, onClose }: { template: MaterialTemplate; onSuccess: () => void; onClose: () => void }) {
  const [lines, setLines] = useState<WorkingLine[]>(() =>
    template.items.map(it => ({
      materialItemId: it.materialItemId,
      nombre: it.materialItem?.nombre ?? '(ítem)',
      unidad: it.materialItem?.unidad ?? '',
      categoria: it.materialItem?.category?.nombre ?? '',
      quantity: String(it.quantity),
    })),
  );
  const [search, setSearch] = useState('');
  const [saving, setSaving] = useState(false);

  const { data: categories = [] } = useQuery({
    queryKey: ['material-categories', 'true'],
    queryFn: () => getMaterialCategories({ activa: 'true' }),
  });
  const { data: catalog = [], isLoading } = useQuery({
    queryKey: ['material-items', 'all', 'true'],
    queryFn: () => getMaterialItems({ activo: 'true' }),
  });

  const inSet = useMemo(() => new Set(lines.map(l => l.materialItemId)), [lines]);

  const filteredCatalog = useMemo(() => {
    const q = search.trim().toLowerCase();
    return catalog.filter(it =>
      !inSet.has(it.id) && (!q || it.nombre.toLowerCase().includes(q) || (it.descripcion?.toLowerCase().includes(q) ?? false)),
    );
  }, [catalog, inSet, search]);

  const catalogByCategory = useMemo(() => {
    const map = new Map<string, typeof filteredCatalog>();
    for (const it of filteredCatalog) {
      const arr = map.get(it.categoryId) ?? [];
      arr.push(it);
      map.set(it.categoryId, arr);
    }
    return map;
  }, [filteredCatalog]);

  function addItem(it: { id: string; nombre: string; unidad: string; category?: { nombre: string } }) {
    setLines(prev => [...prev, {
      materialItemId: it.id,
      nombre: it.nombre,
      unidad: it.unidad,
      categoria: it.category?.nombre ?? '',
      quantity: '1',
    }]);
  }
  function removeItem(id: string) { setLines(prev => prev.filter(l => l.materialItemId !== id)); }
  function setQty(id: string, v: string) { setLines(prev => prev.map(l => l.materialItemId === id ? { ...l, quantity: v } : l)); }

  async function save() {
    setSaving(true);
    try {
      await setMaterialTemplateItems(
        template.id,
        lines.map((l, idx) => {
          const q = parseFloat(l.quantity.replace(',', '.'));
          return { materialItemId: l.materialItemId, quantity: isFinite(q) && q > 0 ? q : 1, orden: idx };
        }),
      );
      toast.success(`Plantilla "${template.nombre}" guardada (${lines.length} ítems)`);
      onSuccess();
    } catch (err) {
      toast.error(getApiErr(err) ?? 'Error al guardar la plantilla');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4" onMouseDown={e => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="bg-[var(--color-bg-card)] border border-[var(--color-border)] rounded-xl w-full max-w-4xl max-h-[85vh] flex flex-col shadow-2xl">
        <div className="flex items-center justify-between p-4 border-b border-[var(--color-border)]">
          <p className="text-sm font-semibold text-[var(--color-text-primary)]">Ítems de "{template.nombre}"</p>
          <button onClick={onClose} className="text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)]"><X className="w-5 h-5" /></button>
        </div>

        <div className="flex-1 min-h-0 grid grid-cols-2 divide-x divide-[var(--color-border)]">
          {/* Ítems en la plantilla */}
          <div className="flex flex-col min-h-0">
            <div className="px-4 py-2 border-b border-[var(--color-border)] text-xs font-mono uppercase tracking-wider text-[var(--color-text-muted)]">
              En la plantilla · {lines.length}
            </div>
            <div className="flex-1 overflow-y-auto p-2 space-y-1">
              {lines.length === 0 ? (
                <p className="text-sm text-[var(--color-text-muted)] text-center py-8">Sin ítems. Agregá desde el catálogo →</p>
              ) : (
                lines.map(l => (
                  <div key={l.materialItemId} className="flex items-center gap-2 px-2 py-1.5 rounded-lg border border-[var(--color-border)]">
                    <MaterialPhotoButton itemId={l.materialItemId} nombre={l.nombre} canEdit={false} />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm text-[var(--color-text-primary)] truncate">{l.nombre}</p>
                      <p className="text-xs text-[var(--color-text-muted)] truncate">{l.categoria}</p>
                    </div>
                    <input
                      type="number" min="0" step="0.01" value={l.quantity}
                      onChange={e => setQty(l.materialItemId, e.target.value)}
                      className="w-16 rounded border border-[var(--color-border)] bg-[var(--color-bg-app)] px-2 py-1 text-sm text-right text-[var(--color-text-primary)] focus:outline-none focus:ring-1 focus:ring-[var(--color-accent)]"
                    />
                    <span className="text-xs text-[var(--color-text-muted)] w-8">{l.unidad}</span>
                    <button onClick={() => removeItem(l.materialItemId)} title="Quitar" className="p-1 rounded hover:bg-red-500/15 text-red-400"><Trash2 className="w-4 h-4" /></button>
                  </div>
                ))
              )}
            </div>
          </div>

          {/* Catálogo */}
          <div className="flex flex-col min-h-0">
            <div className="p-2 border-b border-[var(--color-border)]">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[var(--color-text-muted)]" />
                <input type="text" placeholder="Buscar en el catálogo..." value={search} onChange={e => setSearch(e.target.value)}
                  className="w-full pl-9 pr-3 py-2 rounded-lg border border-[var(--color-border)] bg-[var(--color-bg-app)] text-sm text-[var(--color-text-primary)] focus:outline-none focus:ring-2 focus:ring-[var(--color-accent)]" />
              </div>
            </div>
            <div className="flex-1 overflow-y-auto p-2 space-y-2">
              {isLoading ? (
                <p className="text-sm text-[var(--color-text-muted)] text-center py-8">Cargando catálogo...</p>
              ) : filteredCatalog.length === 0 ? (
                <p className="text-sm text-[var(--color-text-muted)] text-center py-8">{search ? 'Sin resultados' : 'Todos los ítems ya están en la plantilla'}</p>
              ) : (
                categories.filter(c => catalogByCategory.has(c.id)).map(c => (
                  <div key={c.id}>
                    <p className="text-xs font-mono uppercase tracking-wider text-[var(--color-text-muted)] px-1 py-1">{c.nombre}</p>
                    <div className="space-y-1">
                      {(catalogByCategory.get(c.id) ?? []).map(it => (
                        <div key={it.id} className="flex items-center gap-2 px-2 py-1.5 rounded-lg border border-[var(--color-border)] bg-[var(--color-bg-card)]">
                          <MaterialPhotoButton itemId={it.id} nombre={it.nombre} canEdit={false} />
                          <div className="flex-1 min-w-0">
                            <p className="text-sm text-[var(--color-text-primary)] truncate">{it.nombre}</p>
                            <p className="text-xs text-[var(--color-text-muted)]">{it.unidad}</p>
                          </div>
                          <button onClick={() => addItem(it)} className="px-2.5 py-1 rounded text-xs font-semibold bg-[var(--color-accent)] text-gray-900 hover:bg-[var(--color-accent-hover)]">+ Agregar</button>
                        </div>
                      ))}
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>

        <div className="p-3 border-t border-[var(--color-border)] flex justify-between items-center">
          <span className="text-xs text-[var(--color-text-muted)]">{lines.length} ítem{lines.length === 1 ? '' : 's'} en la plantilla</span>
          <div className="flex gap-3">
            <button onClick={onClose} className="px-4 py-2 rounded-lg border border-[var(--color-border)] text-sm text-[var(--color-text-secondary)] hover:bg-[var(--color-bg-card-hover)] transition-colors">Cancelar</button>
            <button onClick={save} disabled={saving} className="px-4 py-2 rounded-lg bg-[var(--color-accent)] text-gray-900 text-sm font-semibold hover:bg-[var(--color-accent-hover)] transition-colors disabled:opacity-60">
              {saving ? 'Guardando...' : 'Guardar plantilla'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Tab principal ─────────────────────────────────────────────────────────────

export function TabMaterialTemplates() {
  const qc = useQueryClient();
  const [showAll, setShowAll] = useState(true);
  const [creating, setCreating] = useState(false);
  const [editing, setEditing] = useState<MaterialTemplate | null>(null);
  const [editingItems, setEditingItems] = useState<MaterialTemplate | null>(null);

  const { data: templates = [], isLoading } = useQuery({
    queryKey: ['material-templates', showAll ? 'all' : 'true'],
    queryFn: () => getMaterialTemplates({ activa: showAll ? 'all' : 'true' }),
  });

  function invalidate() { qc.invalidateQueries({ queryKey: ['material-templates'] }); }

  async function toggleActive(t: MaterialTemplate) {
    try {
      await patchMaterialTemplate(t.id, { activa: !t.activa });
      invalidate();
    } catch (err) {
      toast.error(getApiErr(err) ?? 'No se pudo cambiar el estado');
    }
  }

  async function handleDelete(t: MaterialTemplate) {
    if (!confirm(`¿Eliminar la plantilla "${t.nombre}"?` + (t.itemCount > 0 ? ' Tiene ítems; será desactivada.' : ''))) return;
    try {
      const r = await deleteMaterialTemplate(t.id);
      toast.success(r.deactivated ? 'Plantilla desactivada (tiene ítems)' : 'Plantilla eliminada');
      invalidate();
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
          <Plus className="w-4 h-4" /> Nueva plantilla
        </button>
      </div>

      {isLoading ? (
        <p className="text-sm text-[var(--color-text-muted)] text-center py-8">Cargando...</p>
      ) : templates.length === 0 ? (
        <p className="text-sm text-[var(--color-text-muted)] text-center py-8">Sin plantillas</p>
      ) : (
        <div className="bg-[var(--color-bg-card)] border border-[var(--color-border)] rounded-xl overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-[var(--color-border)] text-xs font-mono text-[var(--color-text-muted)] uppercase tracking-wider">
                <th className="px-4 py-3 text-left font-medium">Nombre</th>
                <th className="px-4 py-3 text-left font-medium w-40">Tipo</th>
                <th className="px-4 py-3 text-left font-medium w-24">Ítems</th>
                <th className="px-4 py-3 text-left font-medium w-24">Estado</th>
                <th className="px-4 py-3 text-right font-medium w-40">Acciones</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--color-border)]">
              {templates.map(t => (
                <tr key={t.id} className={klass('hover:bg-[var(--color-bg-card-hover)] transition-colors', !t.activa && 'opacity-60')}>
                  <td className="px-4 py-2 font-medium text-[var(--color-text-primary)]">
                    <div>{t.nombre}</div>
                    {t.descripcion && <div className="text-xs text-[var(--color-text-muted)] max-w-md truncate">{t.descripcion}</div>}
                  </td>
                  <td className="px-4 py-2 text-[var(--color-text-muted)]">{t.phaseType ? PHASE_TYPE_LABELS[t.phaseType] : '—'}</td>
                  <td className="px-4 py-2 text-[var(--color-text-muted)] tabular-nums">{t.itemCount}</td>
                  <td className="px-4 py-2">
                    <span className={klass('text-[10px] font-mono px-2 py-0.5 rounded uppercase', t.activa ? 'bg-[var(--color-state-done-bg)] text-[var(--color-state-done-text)]' : 'bg-[var(--color-border)] text-[var(--color-text-muted)]')}>
                      {t.activa ? 'Activa' : 'Inactiva'}
                    </span>
                  </td>
                  <td className="px-4 py-2 text-right">
                    <div className="inline-flex gap-1">
                      <button title="Editar ítems" onClick={() => setEditingItems(t)} className="p-1.5 rounded hover:bg-[var(--color-border)] text-[var(--color-text-secondary)]">
                        <ListChecks className="w-4 h-4" />
                      </button>
                      <button title="Editar datos" onClick={() => setEditing(t)} className="p-1.5 rounded hover:bg-[var(--color-border)] text-[var(--color-text-secondary)]">
                        <Pencil className="w-4 h-4" />
                      </button>
                      <button title={t.activa ? 'Desactivar' : 'Activar'} onClick={() => toggleActive(t)} className="p-1.5 rounded hover:bg-[var(--color-border)] text-[var(--color-text-secondary)]">
                        <Power className="w-4 h-4" />
                      </button>
                      <button title="Eliminar" onClick={() => handleDelete(t)} className="p-1.5 rounded hover:bg-red-500/15 text-red-400">
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
        <Modal title="Nueva plantilla" onClose={() => setCreating(false)}>
          <TemplateForm onSuccess={() => { setCreating(false); invalidate(); }} onCancel={() => setCreating(false)} />
        </Modal>
      )}
      {editing && (
        <Modal title={`Editar "${editing.nombre}"`} onClose={() => setEditing(null)}>
          <TemplateForm initial={editing} onSuccess={() => { setEditing(null); invalidate(); }} onCancel={() => setEditing(null)} />
        </Modal>
      )}
      {editingItems && (
        <TemplateItemsEditor
          template={editingItems}
          onSuccess={() => { setEditingItems(null); invalidate(); }}
          onClose={() => setEditingItems(null)}
        />
      )}
    </div>
  );
}

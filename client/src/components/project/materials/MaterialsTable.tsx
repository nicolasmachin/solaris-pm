import { Fragment, memo, useEffect, useMemo, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'react-hot-toast';
import { ArrowLeftRight, Check, ExternalLink, MoreHorizontal, Palette, Plus, StickyNote, Trash2 } from 'lucide-react';

import { patchProjectMaterial, deleteProjectMaterial, getMaterialItems } from '../../../api/materials.api';
import { MaterialPhotoButton } from '../../materials/MaterialPhoto';
import type { MaterialRowColor, ProjectMaterial } from '../../../types/materials.types';
import { ROW_COLOR_SWATCHES, categoryBadgeClass, groupBySection, isZero } from './types';
import { StatusPill } from './StatusPill';

// ─── Tabla principal ───────────────────────────────────────────────────────

type Props = {
  projectId: string;
  rows: ProjectMaterial[];
  canEdit: boolean;
  canViewCatalog: boolean;
  /** Ítems que ya están en la lista completa (no solo en las filas filtradas). */
  existingItemIds: Set<string>;
  /** Abre el alta de materiales con esa sección del catálogo desplegada. */
  onAddInSection?: (categoryId: string) => void;
};

export function MaterialsTable({ projectId, rows, canEdit, canViewCatalog, existingItemIds, onAddInSection }: Props) {
  const groups = useMemo(() => groupBySection(rows), [rows]);

  if (rows.length === 0) {
    return (
      <div className="text-center py-10 text-xs text-[var(--color-text-muted)] border border-dashed border-[var(--color-border)] rounded-lg">
        No hay materiales que coincidan con los filtros.
      </div>
    );
  }
  return (
    <div className="overflow-x-auto rounded-lg border border-[var(--color-border)]">
      <table className="w-full text-xs">
        <thead>
          <tr
            className="text-[10px] font-mono uppercase tracking-wider"
            style={{ background: 'var(--color-table-header-bg)', color: 'var(--color-table-header-text)' }}
          >
            <th className="px-2 py-2 text-left font-semibold w-10">#</th>
            <th className="px-1 py-2 text-center font-semibold w-8" title="Foto del material">Foto</th>
            <th className="px-3 py-2 text-left font-semibold">Material</th>
            <th className="px-2 py-2 text-left font-semibold w-32">Categoría</th>
            <th className="px-2 py-2 text-right font-semibold w-20">Cantidad</th>
            <th className="px-2 py-2 text-left font-semibold w-16">Unidad</th>
            <th className="px-2 py-2 text-left font-semibold w-32">Estado</th>
            <th className="px-2 py-2 text-center font-semibold w-28">Acciones</th>
          </tr>
        </thead>
        <tbody>
          {(() => {
            let n = 0;
            return groups.map(({ section, rows: sectionRows }) => {
              const zeros = sectionRows.filter(isZero).length;
              return (
                <Fragment key={section.key}>
                  <tr className="bg-[var(--color-bg-app)]/60 border-t border-[var(--color-border)]">
                    <td colSpan={8} className="px-3 py-1.5">
                      <div className="flex items-center gap-2">
                        <span className="text-[11px] font-semibold text-[var(--color-text-primary)]">
                          {section.parentLabel && (
                            <span className="font-normal text-[var(--color-text-muted)]">{section.parentLabel} › </span>
                          )}
                          {section.label}
                        </span>
                        <span className="text-[10px] text-[var(--color-text-muted)] tabular-nums">{sectionRows.length}</span>
                        {zeros > 0 && (
                          <span className="text-[10px] px-1.5 py-0.5 rounded bg-[var(--color-warning-bg)]/40 text-[var(--color-warning-text)]">
                            {zeros} sin cantidad
                          </span>
                        )}
                        {canEdit && onAddInSection && section.categoryId && (
                          <button
                            type="button"
                            onClick={() => onAddInSection(section.categoryId!)}
                            className="ml-auto inline-flex items-center gap-1 text-[10px] text-[var(--color-accent)] hover:underline"
                            title="Agregar un material de esta sección"
                          >
                            <Plus className="w-3 h-3" /> Agregar
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                  {sectionRows.map((row) => {
                    n += 1;
                    return (
                      <MaterialRow
                        key={row.id}
                        projectId={projectId}
                        row={row}
                        index={n}
                        canEdit={canEdit}
                        canViewCatalog={canViewCatalog}
                        existingItemIds={existingItemIds}
                      />
                    );
                  })}
                </Fragment>
              );
            });
          })()}
        </tbody>
      </table>
    </div>
  );
}

// ─── Fila individual (memoizada) ───────────────────────────────────────────

const MaterialRow = memo(function MaterialRow({
  projectId,
  row,
  index,
  canEdit,
  canViewCatalog,
  existingItemIds,
}: {
  projectId: string;
  row: ProjectMaterial;
  index: number;
  canEdit: boolean;
  canViewCatalog: boolean;
  existingItemIds: Set<string>;
}) {
  const qc = useQueryClient();

  const patchMut = useMutation({
    mutationFn: (body: Parameters<typeof patchProjectMaterial>[2]) =>
      patchProjectMaterial(projectId, row.id, body),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['project-materials', projectId] });
    },
    onError: (err) =>
      toast.error(
        (err as { response?: { data?: { message?: string } } })?.response?.data?.message ?? 'No se pudo guardar el cambio',
      ),
  });

  const deleteMut = useMutation({
    mutationFn: () => deleteProjectMaterial(projectId, row.id),
    onSuccess: () => {
      toast.success('Material eliminado');
      qc.invalidateQueries({ queryKey: ['project-materials', projectId] });
    },
    onError: () => toast.error('No se pudo eliminar'),
  });

  const tag = row.materialItem?.category?.nombre ?? 'Otros';
  const unidad = row.materialItem?.unidad ?? '';
  const rowClasses = [row.crossed ? 'material-crossed' : '', 'hover:bg-[var(--color-bg-card-hover)]/40']
    .filter(Boolean)
    .join(' ');

  return (
    <tr className={rowClasses} data-row-bg={row.rowColor ?? undefined}>
      <td className="px-2 py-2 text-[10px] text-[var(--color-text-muted)] tabular-nums align-top">
        <span className="inline-flex items-center gap-1">
          {index}
          {row.addedBy && (
            <span
              title={`Agregado por ${row.addedBy.name}`}
              className="inline-block w-1.5 h-1.5 rounded-full bg-[var(--color-accent)]"
            />
          )}
        </span>
      </td>
      <td className="px-1 py-2 align-top text-center">
        {row.materialItem && (
          <MaterialPhotoButton
            itemId={row.materialItem.id}
            nombre={row.materialItem.nombre}
            canEdit={canEdit}
          />
        )}
      </td>
      <td className="px-3 py-2 align-top">
        <div className="flex items-start gap-1">
          <div className="crossable font-semibold text-[var(--color-text-primary)]">
            {row.materialItem?.nombre ?? '—'}
          </div>
          {/* Cambiar de variante solo mientras no se pidió ni se pagó. */}
          {canEdit && row.materialItem && row.status === 'PENDIENTE' && !row.movementId && (
            <VariantSwap
              row={row}
              existingItemIds={existingItemIds}
              disabled={patchMut.isPending}
              onPick={(itemId) => patchMut.mutate({ materialItemId: itemId })}
            />
          )}
        </div>
        {row.notes && (
          <div className="crossable text-[10px] text-[var(--color-text-muted)] mt-0.5">{row.notes}</div>
        )}
        {row.addedBy && (
          <div className="text-[9px] font-mono uppercase tracking-wider text-[var(--color-accent)]/80 mt-0.5">
            + Agregado por {row.addedBy.name}
          </div>
        )}
      </td>
      <td className="px-2 py-2 align-top">
        <span className={`inline-flex items-center px-2 py-0.5 rounded text-[10px] font-semibold border ${categoryBadgeClass(tag)}`}>
          {tag}
        </span>
      </td>
      <td className="px-2 py-2 text-right tabular-nums align-top">
        {canEdit ? (
          <QuantityInput
            value={row.quantity}
            zero={isZero(row)}
            disabled={patchMut.isPending}
            onCommit={(q) => patchMut.mutate({ quantity: q })}
          />
        ) : (
          <span className={isZero(row) ? 'text-[var(--color-warning-text)]' : 'crossable'}>{row.quantity}</span>
        )}
      </td>
      <td className="px-2 py-2 align-top">
        <span className="crossable text-[var(--color-text-muted)]">{unidad}</span>
      </td>
      <td className="px-2 py-2 align-top">
        <StatusPill
          status={row.status}
          disabled={!canEdit || patchMut.isPending}
          onChange={(s) => patchMut.mutate({ status: s })}
        />
      </td>
      <td className="px-2 py-2 align-top">
        <div className="flex items-center justify-center gap-1">
          {canEdit && (
            <>
              <IconBtn
                title={row.crossed ? 'Destachar' : 'Tachar'}
                active={row.crossed}
                onClick={() => patchMut.mutate({ crossed: !row.crossed })}
                disabled={patchMut.isPending}
              >
                <Check className="w-3.5 h-3.5" />
              </IconBtn>
              <ColorPicker
                current={row.rowColor}
                onChange={(c) => patchMut.mutate({ rowColor: c })}
                disabled={patchMut.isPending}
              />
              <MoreMenu
                row={row}
                canEdit={canEdit}
                canViewCatalog={canViewCatalog}
                onPatch={(body) => patchMut.mutate(body)}
                onDelete={() => {
                  if (window.confirm(`¿Eliminar "${row.materialItem?.nombre}"?`)) deleteMut.mutate();
                }}
              />
            </>
          )}
          {!canEdit && canViewCatalog && row.materialItem && (
            <Link
              to="/admin?tab=materiales"
              className="inline-flex items-center gap-1 text-[10px] text-[var(--color-accent)] hover:underline"
            >
              <ExternalLink className="w-3 h-3" /> Catálogo
            </Link>
          )}
        </div>
      </td>
    </tr>
  );
});

// ─── Quantity inline editor ────────────────────────────────────────────────

function QuantityInput({
  value,
  zero,
  disabled,
  onCommit,
}: {
  value: number;
  /** En cero = falta completar: se resalta para que no pase de largo. */
  zero: boolean;
  disabled: boolean;
  onCommit: (q: number) => void;
}) {
  const [draft, setDraft] = useState(String(value));
  useEffect(() => {
    setDraft(String(value));
  }, [value]);

  const commit = () => {
    const trimmed = draft.trim().replace(',', '.');
    if (trimmed === '') {
      setDraft(String(value));
      return;
    }
    const n = Number(trimmed);
    if (!Number.isFinite(n) || n < 0) {
      setDraft(String(value));
      return;
    }
    if (n !== value) onCommit(n);
  };

  return (
    <input
      type="text"
      inputMode="decimal"
      value={draft}
      disabled={disabled}
      onChange={(e) => setDraft(e.target.value)}
      onBlur={commit}
      onKeyDown={(e) => {
        if (e.key === 'Enter') {
          // Enter guarda y salta a la cantidad siguiente (Shift+Enter, a la
          // anterior): la plantilla Base se completa de corrido, sin mouse.
          const el = e.target as HTMLInputElement;
          const all = Array.from(document.querySelectorAll<HTMLInputElement>('input[data-qty-input]'));
          const next = all[all.indexOf(el) + (e.shiftKey ? -1 : 1)];
          e.preventDefault();
          el.blur();
          if (next) {
            next.focus();
            next.select();
          }
        } else if (e.key === 'Escape') {
          setDraft(String(value));
          (e.target as HTMLInputElement).blur();
        }
      }}
      onFocus={(e) => e.target.select()}
      data-qty-input=""
      title={zero ? 'Falta la cantidad · Enter pasa a la siguiente' : 'Enter pasa a la siguiente'}
      className={`w-16 px-1.5 py-0.5 text-right text-xs tabular-nums bg-[var(--color-bg-app)] text-[var(--color-text-primary)] border rounded focus:outline-none focus:border-[var(--color-accent)] disabled:opacity-50 ${
        zero ? 'border-[var(--color-warning-text)]' : 'border-[var(--color-border)]'
      }`}
    />
  );
}

// ─── Cambiar variante ──────────────────────────────────────────────────────
//
// Ofrece los demás ítems activos del mismo grupo del catálogo (la misma
// subcategoría): así un solo renglón de la plantilla cubre diferencial 2P o 4P,
// caño de 1" o 1¼", sin tener los dos renglones y que uno quede siempre en cero.

function VariantSwap({
  row,
  existingItemIds,
  disabled,
  onPick,
}: {
  row: ProjectMaterial;
  existingItemIds: Set<string>;
  disabled: boolean;
  onPick: (itemId: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const categoryId = row.materialItem?.categoryId;

  // Misma query que el alta de materiales: queda en caché para toda la lista.
  const { data: items = [], isLoading } = useQuery({
    queryKey: ['material-items', 'all-active'],
    queryFn: () => getMaterialItems({ activo: 'true' }),
    enabled: open,
  });
  const options = useMemo(
    () =>
      items
        .filter((it) => it.categoryId === categoryId && it.id !== row.materialItemId)
        .sort((a, b) => a.nombre.localeCompare(b.nombre)),
    [items, categoryId, row.materialItemId],
  );

  useEffect(() => {
    if (!open) return;
    function onDocClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener('mousedown', onDocClick);
    return () => document.removeEventListener('mousedown', onDocClick);
  }, [open]);

  return (
    <div className="relative shrink-0" ref={ref}>
      <button
        type="button"
        title="Cambiar por otra variante del mismo grupo"
        disabled={disabled}
        onClick={() => setOpen((v) => !v)}
        className="mt-px p-0.5 rounded text-[var(--color-text-muted)] hover:text-[var(--color-accent)] hover:bg-[var(--color-bg-card-hover)] disabled:opacity-50"
      >
        <ArrowLeftRight className="w-3 h-3" />
      </button>
      {open && (
        <div className="absolute left-0 top-full mt-1 z-30 w-72 max-h-64 overflow-y-auto rounded-lg border border-[var(--color-border)] bg-[var(--color-bg-card)] shadow-xl p-1">
          <p className="px-2 py-1 text-[10px] font-mono uppercase tracking-wider text-[var(--color-text-muted)]">
            Cambiar por
          </p>
          {isLoading ? (
            <p className="px-2 py-2 text-[11px] text-[var(--color-text-muted)]">Cargando…</p>
          ) : options.length === 0 ? (
            <p className="px-2 py-2 text-[11px] text-[var(--color-text-muted)]">No hay otros ítems en este grupo.</p>
          ) : (
            options.map((it) => {
              const already = existingItemIds.has(it.id);
              return (
                <button
                  key={it.id}
                  type="button"
                  disabled={already}
                  onClick={() => {
                    setOpen(false);
                    onPick(it.id);
                  }}
                  className="w-full flex items-center justify-between gap-2 px-2 py-1.5 rounded text-left text-[11px] text-[var(--color-text-primary)] hover:bg-[var(--color-bg-card-hover)] disabled:opacity-50 disabled:cursor-default disabled:hover:bg-transparent"
                >
                  <span className="truncate">{it.nombre}</span>
                  {already && <span className="shrink-0 text-[9px] text-[var(--color-text-muted)]">ya está</span>}
                </button>
              );
            })
          )}
        </div>
      )}
    </div>
  );
}

// ─── Color picker popover ──────────────────────────────────────────────────

function ColorPicker({
  current,
  onChange,
  disabled,
}: {
  current: MaterialRowColor | null;
  onChange: (c: MaterialRowColor | null) => void;
  disabled: boolean;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    function onDocClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener('mousedown', onDocClick);
    return () => document.removeEventListener('mousedown', onDocClick);
  }, [open]);

  return (
    <div className="relative" ref={ref}>
      <IconBtn
        title="Color de fila"
        active={!!current}
        onClick={() => !disabled && setOpen((v) => !v)}
        disabled={disabled}
      >
        <Palette className="w-3.5 h-3.5" />
      </IconBtn>
      {open && (
        <div
          className="absolute top-full right-0 mt-1 rounded-lg border border-[var(--color-border)] bg-[var(--color-bg-card)] shadow-xl z-30 p-2.5"
          style={{ width: 'max-content' }}
        >
          <div className="flex flex-row items-center gap-2 whitespace-nowrap">
            <button
              type="button"
              title="Sin color"
              onClick={() => {
                setOpen(false);
                onChange(null);
              }}
              className={`w-5 h-5 shrink-0 rounded-full border flex items-center justify-center transition-shadow ${
                current === null
                  ? 'border-[var(--color-accent)] bg-[var(--color-bg-card-hover)] ring-2 ring-[var(--color-accent)] ring-offset-2 ring-offset-[var(--color-bg-card)]'
                  : 'border-[var(--color-border)] hover:border-[var(--color-border-hover)]'
              }`}
            >
              <span className="text-[9px] leading-none text-[var(--color-text-muted)]">∅</span>
            </button>
            {ROW_COLOR_SWATCHES.map((s) => (
              <button
                key={s.value}
                type="button"
                title={s.label}
                onClick={() => {
                  setOpen(false);
                  onChange(s.value);
                }}
                className={`w-5 h-5 shrink-0 rounded-full border transition-shadow ${
                  current === s.value
                    ? 'border-[var(--color-accent)] ring-2 ring-[var(--color-accent)] ring-offset-2 ring-offset-[var(--color-bg-card)]'
                    : 'border-[var(--color-border)] hover:border-[var(--color-border-hover)]'
                }`}
                style={{ background: s.swatch }}
              />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// ─── ⋯ Más menú ────────────────────────────────────────────────────────────

function MoreMenu({
  row,
  canEdit,
  canViewCatalog,
  onPatch,
  onDelete,
}: {
  row: ProjectMaterial;
  canEdit: boolean;
  canViewCatalog: boolean;
  onPatch: (body: Parameters<typeof patchProjectMaterial>[2]) => void;
  onDelete: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [editingNotes, setEditingNotes] = useState(false);
  const [notes, setNotes] = useState(row.notes ?? '');
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    function onDocClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener('mousedown', onDocClick);
    return () => document.removeEventListener('mousedown', onDocClick);
  }, [open]);

  function saveNotes() {
    const trimmed = notes.trim();
    onPatch({ notes: trimmed || null });
    setEditingNotes(false);
    setOpen(false);
  }

  return (
    <div className="relative" ref={ref}>
      <IconBtn title="Más opciones" active={false} onClick={() => setOpen((v) => !v)} disabled={false}>
        <MoreHorizontal className="w-3.5 h-3.5" />
      </IconBtn>
      {open && (
        <div className="absolute top-full right-0 mt-1 min-w-[180px] rounded-lg border border-[var(--color-border)] bg-[var(--color-bg-card)] shadow-xl z-30 p-1">
          {!editingNotes && (
            <button
              type="button"
              onClick={() => {
                setEditingNotes(true);
                setNotes(row.notes ?? '');
              }}
              className="w-full flex items-center gap-2 px-2 py-1.5 rounded text-left text-[11px] hover:bg-[var(--color-bg-card-hover)] text-[var(--color-text-primary)]"
            >
              <StickyNote className="w-3.5 h-3.5 text-[var(--color-text-muted)]" />
              {row.notes ? 'Editar notas' : 'Agregar notas'}
            </button>
          )}
          {editingNotes && (
            <div className="p-2 min-w-[240px]">
              <textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Notas internas..."
                maxLength={500}
                rows={3}
                className="w-full px-2 py-1 text-[11px] rounded border border-[var(--color-border)] bg-[var(--color-bg-app)] text-[var(--color-text-primary)] resize-none focus:outline-none focus:ring-1 focus:ring-[var(--color-accent)]"
                autoFocus
              />
              <p className="text-[9px] text-[var(--color-text-muted)] mt-1">{notes.length}/500</p>
              <div className="flex gap-1.5 mt-1.5">
                <button
                  type="button"
                  onClick={saveNotes}
                  className="flex-1 px-2 py-1 rounded bg-[var(--color-accent)] text-gray-900 text-[10px] font-semibold hover:bg-[var(--color-accent-hover)]"
                >
                  Guardar
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setEditingNotes(false);
                    setNotes(row.notes ?? '');
                  }}
                  className="px-2 py-1 rounded border border-[var(--color-border)] text-[10px] text-[var(--color-text-secondary)] hover:bg-[var(--color-bg-card-hover)]"
                >
                  Cancelar
                </button>
              </div>
            </div>
          )}

          {canViewCatalog && row.materialItem && !editingNotes && (
            <Link
              to="/admin?tab=materiales"
              className="w-full flex items-center gap-2 px-2 py-1.5 rounded text-left text-[11px] hover:bg-[var(--color-bg-card-hover)] text-[var(--color-text-primary)]"
              onClick={() => setOpen(false)}
            >
              <ExternalLink className="w-3.5 h-3.5 text-[var(--color-text-muted)]" />
              Ver en catálogo →
            </Link>
          )}

          {canEdit && !editingNotes && (
            <button
              type="button"
              onClick={() => {
                setOpen(false);
                onDelete();
              }}
              className="w-full flex items-center gap-2 px-2 py-1.5 rounded text-left text-[11px] hover:bg-[var(--color-danger-bg)]/40 text-[var(--color-danger-text)]"
            >
              <Trash2 className="w-3.5 h-3.5" />
              Eliminar
            </button>
          )}
        </div>
      )}
    </div>
  );
}

// ─── Botón ícono compartido ────────────────────────────────────────────────

function IconBtn({
  title,
  active,
  onClick,
  disabled,
  children,
}: {
  title: string;
  active: boolean;
  onClick: () => void;
  disabled: boolean;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      title={title}
      disabled={disabled}
      onClick={onClick}
      className={`w-6 h-6 inline-flex items-center justify-center rounded border transition-colors ${
        active
          ? 'bg-[var(--color-warning-bg)]/40 border-[var(--color-warning-bg)] text-[var(--color-warning-text)]'
          : 'bg-[var(--color-bg-card)] border-[var(--color-border)] text-[var(--color-text-muted)] hover:bg-[var(--color-bg-card-hover)] hover:text-[var(--color-text-primary)]'
      } ${disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}`}
    >
      {children}
    </button>
  );
}

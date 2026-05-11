import { memo, useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'react-hot-toast';
import { Check, ExternalLink, MoreHorizontal, Palette, StickyNote, Trash2 } from 'lucide-react';

import { patchProjectMaterial, deleteProjectMaterial } from '../../../api/materials.api';
import type { MaterialRowColor, ProjectMaterial } from '../../../types/materials.types';
import { ROW_COLOR_SWATCHES, categoryBadgeClass } from './types';
import { StatusPill } from './StatusPill';

// ─── Tabla principal ───────────────────────────────────────────────────────

type Props = {
  projectId: string;
  rows: ProjectMaterial[];
  canEdit: boolean;
  canViewCatalog: boolean;
};

export function MaterialsTable({ projectId, rows, canEdit, canViewCatalog }: Props) {
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
            <th className="px-3 py-2 text-left font-semibold">Material</th>
            <th className="px-2 py-2 text-left font-semibold w-32">Categoría</th>
            <th className="px-2 py-2 text-right font-semibold w-20">Cantidad</th>
            <th className="px-2 py-2 text-left font-semibold w-16">Unidad</th>
            <th className="px-2 py-2 text-left font-semibold w-32">Estado</th>
            <th className="px-2 py-2 text-center font-semibold w-28">Acciones</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row, idx) => (
            <MaterialRow
              key={row.id}
              projectId={projectId}
              row={row}
              index={idx + 1}
              canEdit={canEdit}
              canViewCatalog={canViewCatalog}
            />
          ))}
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
}: {
  projectId: string;
  row: ProjectMaterial;
  index: number;
  canEdit: boolean;
  canViewCatalog: boolean;
}) {
  const qc = useQueryClient();

  const patchMut = useMutation({
    mutationFn: (body: Parameters<typeof patchProjectMaterial>[2]) =>
      patchProjectMaterial(projectId, row.id, body),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['project-materials', projectId] });
    },
    onError: () => toast.error('No se pudo guardar el cambio'),
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
      <td className="px-3 py-2 align-top">
        <div className="crossable font-semibold text-[var(--color-text-primary)]">
          {row.materialItem?.nombre ?? '—'}
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
        <span className="crossable">{row.quantity}</span>
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
              to={`/admin/materiales?item=${row.materialItem.id}`}
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
              to={`/admin/materiales?item=${row.materialItem.id}`}
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

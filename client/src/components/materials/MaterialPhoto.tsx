import { useCallback, useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'react-hot-toast';
import { Eye, ImagePlus, Loader2, Trash2, Upload } from 'lucide-react';

import {
  deleteMaterialItemFoto,
  getMaterialPhotoIndex,
  materialItemFotoUrl,
  uploadMaterialItemFoto,
} from '../../api/materials.api';
import { useAuthBlobUrl } from '../../hooks/useAuthBlobUrl';

/**
 * Foto de referencia del material — el "ojito" que aparece en todas las listas.
 *
 * Sirve para distinguir ítems de nombre parecido a la hora de comprar o de
 * preparar la salida a obra. La imagen se carga recién cuando el usuario pasa
 * el mouse: en una lista de 60 filas no se descarga nada hasta que se mira algo.
 *
 * El índice de qué ítems tienen foto es UNA sola query compartida por todas las
 * listas (`material-photo-index`), en vez de un campo en cada endpoint que
 * devuelve materiales.
 */

const PHOTO_INDEX_KEY = ['material-photo-index'] as const;

export function useMaterialPhotoIndex() {
  return useQuery({
    queryKey: PHOTO_INDEX_KEY,
    queryFn: getMaterialPhotoIndex,
    staleTime: 5 * 60 * 1000,
  });
}

type Props = {
  itemId: string;
  nombre: string;
  /** Si puede subir, reemplazar o quitar la foto. */
  canEdit: boolean;
  /**
   * Versión de la foto (epoch de `fotoUpdatedAt`), o `undefined` si el ítem no
   * tiene. Si no se pasa, se resuelve del índice compartido.
   */
  version?: number;
};

export function MaterialPhotoButton({ itemId, nombre, canEdit, version }: Props) {
  const qc = useQueryClient();
  const { data: index } = useMaterialPhotoIndex();
  const resolvedVersion = version ?? index?.[itemId];
  const hasPhoto = resolvedVersion !== undefined;

  const [open, setOpen] = useState(false);
  const [pinned, setPinned] = useState(false);
  const [anchor, setAnchor] = useState<{ top: number; left: number } | null>(null);
  const btnRef = useRef<HTMLButtonElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const invalidate = useCallback(() => {
    qc.invalidateQueries({ queryKey: PHOTO_INDEX_KEY });
  }, [qc]);

  const uploadMut = useMutation({
    mutationFn: (file: File) => uploadMaterialItemFoto(itemId, file),
    onSuccess: () => {
      toast.success('Foto guardada');
      invalidate();
    },
    onError: (err) => {
      const msg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message;
      toast.error(msg ?? 'No se pudo guardar la foto');
    },
  });

  const deleteMut = useMutation({
    mutationFn: () => deleteMaterialItemFoto(itemId),
    onSuccess: () => {
      toast.success('Foto quitada');
      setOpen(false);
      setPinned(false);
      invalidate();
    },
    onError: () => toast.error('No se pudo quitar la foto'),
  });

  // El popover va en un portal con posición fija: las tablas de materiales
  // tienen `overflow-x-auto` y un absolute quedaría recortado.
  function placePopover() {
    const rect = btnRef.current?.getBoundingClientRect();
    if (!rect) return;
    setAnchor({ top: rect.bottom + 6, left: rect.left });
  }

  function show() {
    placePopover();
    setOpen(true);
  }

  function hide() {
    if (!pinned) setOpen(false);
  }

  useEffect(() => {
    if (!pinned) return;
    function onDocClick(e: MouseEvent) {
      const target = e.target as Node;
      if (btnRef.current?.contains(target)) return;
      if ((target as HTMLElement).closest?.('[data-material-photo-popover]')) return;
      setPinned(false);
      setOpen(false);
    }
    function onEsc(e: KeyboardEvent) {
      if (e.key === 'Escape') {
        setPinned(false);
        setOpen(false);
      }
    }
    document.addEventListener('mousedown', onDocClick);
    document.addEventListener('keydown', onEsc);
    return () => {
      document.removeEventListener('mousedown', onDocClick);
      document.removeEventListener('keydown', onEsc);
    };
  }, [pinned]);

  function pickFile() {
    fileRef.current?.click();
  }

  function handleClick() {
    if (!hasPhoto) {
      if (canEdit) pickFile();
      return;
    }
    // Con foto, el click fija el popover (necesario en touch, donde no hay hover).
    if (pinned) {
      setPinned(false);
      setOpen(false);
    } else {
      placePopover();
      setPinned(true);
      setOpen(true);
    }
  }

  if (!hasPhoto && !canEdit) {
    return <span className="inline-block w-6" aria-hidden />;
  }

  const busy = uploadMut.isPending || deleteMut.isPending;

  return (
    <>
      <button
        ref={btnRef}
        type="button"
        title={hasPhoto ? `Ver foto de "${nombre}"` : `Agregar foto a "${nombre}"`}
        disabled={busy}
        onClick={handleClick}
        onMouseEnter={() => hasPhoto && show()}
        onMouseLeave={hide}
        onFocus={() => hasPhoto && show()}
        onBlur={hide}
        className={`w-6 h-6 inline-flex items-center justify-center rounded border transition-colors ${
          hasPhoto
            ? 'bg-[var(--color-accent)]/15 border-[var(--color-accent)]/40 text-[var(--color-accent)] hover:bg-[var(--color-accent)]/25'
            : 'bg-transparent border-dashed border-[var(--color-border)] text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)] hover:border-[var(--color-border-hover)]'
        } ${busy ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}`}
      >
        {busy ? (
          <Loader2 className="w-3.5 h-3.5 animate-spin" />
        ) : hasPhoto ? (
          <Eye className="w-3.5 h-3.5" />
        ) : (
          <ImagePlus className="w-3.5 h-3.5" />
        )}
      </button>

      {canEdit && (
        <input
          ref={fileRef}
          type="file"
          accept="image/*,.heic,.heif"
          className="hidden"
          onChange={(e) => {
            const file = e.target.files?.[0];
            e.target.value = '';
            if (file) uploadMut.mutate(file);
          }}
        />
      )}

      {open && hasPhoto && anchor
        ? createPortal(
            <PhotoPopover
              itemId={itemId}
              nombre={nombre}
              version={resolvedVersion}
              top={anchor.top}
              left={anchor.left}
              pinned={pinned}
              canEdit={canEdit}
              busy={busy}
              onReplace={pickFile}
              onDelete={() => {
                if (window.confirm(`¿Quitar la foto de "${nombre}"?`)) deleteMut.mutate();
              }}
            />,
            document.body,
          )
        : null}
    </>
  );
}

const POPOVER_W = 240;

function PhotoPopover({
  itemId,
  nombre,
  version,
  top,
  left,
  pinned,
  canEdit,
  busy,
  onReplace,
  onDelete,
}: {
  itemId: string;
  nombre: string;
  version: number;
  top: number;
  left: number;
  pinned: boolean;
  canEdit: boolean;
  busy: boolean;
  onReplace: () => void;
  onDelete: () => void;
}) {
  const { blobUrl, loading, error } = useAuthBlobUrl(materialItemFotoUrl(itemId, version));

  // Encajar dentro del viewport: cerca del borde derecho el popover se corre a
  // la izquierda, y si no entra abajo se muestra por encima del botón.
  const maxLeft = window.innerWidth - POPOVER_W - 8;
  const clampedLeft = Math.max(8, Math.min(left, maxLeft));
  const estimatedHeight = canEdit ? 300 : 264;
  const flipUp = top + estimatedHeight > window.innerHeight;
  const finalTop = flipUp ? Math.max(8, top - estimatedHeight - 34) : top;

  return (
    <div
      data-material-photo-popover
      style={{ position: 'fixed', top: finalTop, left: clampedLeft, width: POPOVER_W, zIndex: 60 }}
      className="rounded-lg border border-[var(--color-border)] bg-[var(--color-bg-card)] shadow-2xl p-2"
    >
      <div className="h-[200px] w-full rounded bg-[var(--color-bg-app)] flex items-center justify-center overflow-hidden">
        {loading ? (
          <Loader2 className="w-5 h-5 animate-spin text-[var(--color-text-muted)]" />
        ) : error || !blobUrl ? (
          <span className="text-[10px] text-[var(--color-text-muted)]">No se pudo cargar la foto</span>
        ) : (
          <img src={blobUrl} alt={nombre} className="max-h-full max-w-full object-contain" />
        )}
      </div>
      <p className="mt-1.5 text-[10px] text-[var(--color-text-muted)] leading-tight line-clamp-2">{nombre}</p>
      {canEdit && pinned && (
        <div className="flex gap-1.5 mt-2">
          <button
            type="button"
            disabled={busy}
            onClick={onReplace}
            className="flex-1 inline-flex items-center justify-center gap-1 px-2 py-1 rounded border border-[var(--color-border)] text-[10px] text-[var(--color-text-secondary)] hover:bg-[var(--color-bg-card-hover)] disabled:opacity-50"
          >
            <Upload className="w-3 h-3" /> Cambiar
          </button>
          <button
            type="button"
            disabled={busy}
            onClick={onDelete}
            className="inline-flex items-center justify-center gap-1 px-2 py-1 rounded border border-[var(--color-border)] text-[10px] text-[var(--color-danger-text)] hover:bg-[var(--color-danger-bg)]/40 disabled:opacity-50"
          >
            <Trash2 className="w-3 h-3" /> Quitar
          </button>
        </div>
      )}
      {canEdit && !pinned && (
        <p className="mt-1 text-[9px] text-[var(--color-text-muted)]">Click para cambiar o quitar</p>
      )}
    </div>
  );
}

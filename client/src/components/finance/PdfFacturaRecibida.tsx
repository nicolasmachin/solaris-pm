import { useRef } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'react-hot-toast';
import { FileText, Upload } from 'lucide-react';

import { abrirPdfFacturaRecibida, subirPdfFacturaRecibida } from '../../api/cuentasPorPagar.api';
import { usePermission } from '../../hooks/usePermission';

async function motivoError(err: unknown): Promise<string | null> {
  const data = (err as { response?: { data?: unknown } })?.response?.data;
  if (data instanceof Blob) {
    try { return (JSON.parse(await data.text()) as { message?: string }).message ?? null; } catch { return null; }
  }
  return (data as { message?: string } | undefined)?.message ?? null;
}

/**
 * "Ver PDF" de una factura recibida y, si no hay, "Subir PDF". El PDF sale de
 * Biller (si la factura llegó por mail) o se sube a mano (si llegó solo por DGI,
 * que no lo guarda).
 */
export function PdfFacturaRecibida({ id, pdf }: { id: string; pdf: 'GUARDADO' | 'EN_BILLER' | 'NO' }) {
  const qc = useQueryClient();
  const canEdit = usePermission('FINANZAS', 'EDIT');
  const input = useRef<HTMLInputElement>(null);
  const subir = useMutation({
    mutationFn: (f: File) => subirPdfFacturaRecibida(id, f),
    onSuccess: () => {
      toast.success('PDF guardado');
      qc.invalidateQueries({ queryKey: ['facturas-recibidas'] });
      qc.invalidateQueries({ queryKey: ['facturas-proveedores'] });
    },
    onError: () => toast.error('No se pudo subir el PDF'),
  });
  const ver = useMutation({
    mutationFn: () => abrirPdfFacturaRecibida(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['facturas-proveedores'] }),
    onError: async (e) => toast.error((await motivoError(e)) ?? 'No hay PDF de esta factura'),
  });
  const btn = 'inline-flex items-center gap-1 rounded-md border border-[var(--color-border)] px-2 py-0.5 text-[11px] text-[var(--color-text-secondary)] hover:bg-[var(--color-bg-card-hover)] disabled:opacity-50';

  return (
    <span className="inline-flex gap-1">
      {pdf !== 'NO' && (
        <button type="button" className={btn} disabled={ver.isPending} onClick={() => ver.mutate()}>
          <FileText className="w-3 h-3" /> {ver.isPending ? 'Buscando…' : 'Ver PDF'}
        </button>
      )}
      {canEdit && pdf !== 'GUARDADO' && (
        <>
          <input ref={input} type="file" accept=".pdf,image/*" className="hidden"
            onChange={(e) => { const f = e.target.files?.[0]; if (f) subir.mutate(f); e.target.value = ''; }} />
          <button type="button" className={btn} disabled={subir.isPending} onClick={() => input.current?.click()}
            title="Subir el PDF que mandó el proveedor">
            <Upload className="w-3 h-3" /> {subir.isPending ? 'Subiendo…' : 'Subir PDF'}
          </button>
        </>
      )}
    </span>
  );
}

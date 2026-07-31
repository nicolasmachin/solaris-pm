import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "react-hot-toast";
import { X } from "lucide-react";

import { createTicket, type TicketPrioridad } from "../../api/tickets.api";
import { ProjectPicker } from "../../components/finance/ProjectPicker";
import { Button } from "../../components/ui/Button";
import { useLockBodyScroll } from "../../hooks/useLockBodyScroll";

const inputClass =
  "w-full rounded-lg border border-[var(--color-border)] bg-[var(--color-bg-app)] px-3 py-2 text-sm text-[var(--color-text-primary)] focus:outline-none focus:ring-2 focus:ring-[var(--color-accent)]";

function getApiErr(err: unknown): string | undefined {
  return (err as { response?: { data?: { message?: string } } })?.response?.data?.message;
}

// Modal chico para abrir un ticket. Si se pasa `presetProjectId` (entrada desde
// la ficha de un proyecto/Generador) se oculta el selector de proyecto.
export function CrearTicketModal({
  open,
  onClose,
  presetProjectId,
  onCreated,
}: {
  open: boolean;
  onClose: () => void;
  presetProjectId?: string;
  onCreated?: (ticketId: string) => void;
}) {
  useLockBodyScroll(open);
  const qc = useQueryClient();
  const [projectId, setProjectId] = useState(presetProjectId ?? "");
  const [titulo, setTitulo] = useState("");
  const [descripcion, setDescripcion] = useState("");
  const [prioridad, setPrioridad] = useState<TicketPrioridad>("MEDIA");

  const crear = useMutation({
    mutationFn: () => createTicket({ projectId, titulo: titulo.trim(), descripcion: descripcion.trim(), prioridad }),
    onSuccess: (t) => {
      toast.success("Ticket abierto");
      qc.invalidateQueries({ queryKey: ["tickets"] });
      setTitulo("");
      setDescripcion("");
      setPrioridad("MEDIA");
      if (!presetProjectId) setProjectId("");
      onCreated?.(t.id);
      onClose();
    },
    onError: (err) => toast.error(getApiErr(err) ?? "No se pudo abrir el ticket"),
  });

  if (!open) return null;

  const canSubmit = projectId && titulo.trim().length > 0 && descripcion.trim().length > 0 && !crear.isPending;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/50" aria-hidden="true" onClick={onClose} />
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Abrir ticket"
        className="relative w-full max-w-lg rounded-xl border border-[var(--color-border)] bg-[var(--color-bg-app)] shadow-2xl"
      >
        <div className="flex items-center justify-between border-b border-[var(--color-border)] px-4 py-3">
          <h2 className="font-display text-lg font-semibold text-[var(--color-text-primary)]">Abrir ticket</h2>
          <button onClick={onClose} aria-label="Cerrar" className="rounded-md p-1 text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)]">
            <X size={18} />
          </button>
        </div>

        <div className="space-y-3 p-4">
          {!presetProjectId && (
            <div>
              <label className="mb-1 block text-[10px] font-mono uppercase tracking-wider text-[var(--color-text-muted)]">Proyecto / Generador</label>
              <ProjectPicker value={projectId} onChange={setProjectId} emptyLabel="Elegí un proyecto" includeLivianos />
            </div>
          )}
          <div>
            <label className="mb-1 block text-[10px] font-mono uppercase tracking-wider text-[var(--color-text-muted)]">Título</label>
            <input value={titulo} onChange={(e) => setTitulo(e.target.value)} maxLength={200} placeholder="Resumen del reclamo o consulta" className={inputClass} />
          </div>
          <div>
            <label className="mb-1 block text-[10px] font-mono uppercase tracking-wider text-[var(--color-text-muted)]">Descripción</label>
            <textarea value={descripcion} onChange={(e) => setDescripcion(e.target.value)} rows={4} maxLength={4000} placeholder="Detalle del problema…" className={`${inputClass} resize-none`} />
          </div>
          <div>
            <label className="mb-1 block text-[10px] font-mono uppercase tracking-wider text-[var(--color-text-muted)]">Prioridad</label>
            <select value={prioridad} onChange={(e) => setPrioridad(e.target.value as TicketPrioridad)} className={inputClass}>
              <option value="BAJA">Baja</option>
              <option value="MEDIA">Media</option>
              <option value="ALTA">Alta</option>
            </select>
          </div>
        </div>

        <div className="flex justify-end gap-2 border-t border-[var(--color-border)] px-4 py-3">
          <Button variant="ghost" size="sm" onClick={onClose}>Cancelar</Button>
          <Button size="sm" loading={crear.isPending} disabled={!canSubmit} onClick={() => crear.mutate()}>Abrir ticket</Button>
        </div>
      </div>
    </div>
  );
}

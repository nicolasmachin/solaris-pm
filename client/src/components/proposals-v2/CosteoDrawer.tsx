// Drawer del costeo de la cotización. Vive detrás de su propio botón —y de su
// propio permiso (VENTAS:EDIT)— y no dentro del formulario: son los costos del
// negocio, no un dato de la propuesta, y no tienen por qué estar a la vista de
// todo el que cotiza.
//
// Va aparte del drawer de debug a propósito: aquel es de solo lectura y es de
// administración; este edita el borrador y lo usa quien cotiza. Comparten la
// forma, no el permiso.

import { useEffect } from "react";
import { X } from "lucide-react";

import { CosteoPanel } from "./CosteoPanel";
import { useLockBodyScroll } from "../../hooks/useLockBodyScroll";
import type { ProposalDraftData, ProposalVariante } from "../../types/proposals-v2";

export function CosteoDrawer({
  open,
  onClose,
  data,
  onChange,
  leadId,
  variante,
  leadName,
  savedTick,
}: {
  open: boolean;
  onClose: () => void;
  data: ProposalDraftData;
  onChange: (next: ProposalDraftData) => void;
  leadId: string;
  variante: ProposalVariante;
  leadName: string;
  savedTick: number;
}) {
  useLockBodyScroll(open);

  useEffect(() => {
    if (!open) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[60]">
      <div className="absolute inset-0 bg-black/40" onClick={onClose} aria-hidden="true" />
      <aside
        role="dialog"
        aria-label="Costeo de la cotización"
        // Más ancho que el drawer de debug: acá hay tablas de cinco columnas.
        className="absolute right-0 top-0 flex h-full w-[860px] max-w-full flex-col bg-[var(--color-bg-card)] shadow-2xl"
      >
        <header className="flex items-start justify-between gap-3 border-b border-[var(--color-border)] px-4 py-3">
          <div className="min-w-0">
            <h2 className="text-sm font-bold text-[var(--color-text-primary)]">
              Costeo de la cotización
            </h2>
            <p className="truncate text-xs text-[var(--color-text-muted)]">{leadName}</p>
          </div>
          <button
            onClick={onClose}
            aria-label="Cerrar"
            className="rounded p-1 text-[var(--color-text-secondary)] hover:bg-[var(--color-bg-app)] hover:text-[var(--color-text-primary)]"
          >
            <X size={18} />
          </button>
        </header>

        <div className="min-h-0 flex-1 overflow-y-auto p-4">
          <CosteoPanel
            data={data}
            onChange={onChange}
            leadId={leadId}
            variante={variante}
            savedTick={savedTick}
            enabled={open}
          />
        </div>
      </aside>
    </div>
  );
}

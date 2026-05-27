import { useEffect, useState } from "react";
import { Button } from "../ui/Button";

// Modal de "cerrar como perdido" pidiendo lostReason. Extracción del JSX
// inline que vivía en LeadPanel para que también lo use LeadsListView.
// El value (reason) se administra acá; el caller solo recibe el string
// confirmado en onConfirm.

interface Props {
  open: boolean;
  // Defecto: vacío. Si el caller quiere pre-rellenar (ej. lead que ya
  // tenía un lostReason previo), lo pasa por acá.
  initialReason?: string;
  onCancel: () => void;
  onConfirm: (reason: string) => void;
  isPending?: boolean;
}

export function LostReasonModal({
  open,
  initialReason = "",
  onCancel,
  onConfirm,
  isPending,
}: Props) {
  const [reason, setReason] = useState(initialReason);

  // Sincronizar al abrir (por si el modal se reabre con otro initial).
  useEffect(() => {
    if (open) setReason(initialReason);
  }, [open, initialReason]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-[96] flex items-center justify-center bg-black/60 p-4"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onCancel();
      }}
    >
      <div className="w-full max-w-md rounded-xl border border-[var(--color-border)] bg-[var(--color-bg-card)] p-6">
        <h3 className="mb-3 font-display text-lg font-bold text-[var(--color-text-primary)]">
          Cerrar como perdido
        </h3>
        <p className="mb-3 text-xs text-[var(--color-text-muted)]">
          Indicá el motivo de pérdida. Queda registrado en el lead y se
          puede consultar después.
        </p>
        <textarea
          className="min-h-[110px] w-full rounded-md border border-[var(--color-border)] bg-[var(--color-bg-app)] px-3 py-2 text-sm text-[var(--color-text-primary)] focus:border-[var(--color-accent)] focus:outline-none"
          value={reason}
          onChange={(event) => setReason(event.target.value)}
          autoFocus
        />
        <div className="mt-4 flex justify-end gap-2">
          <Button variant="ghost" onClick={onCancel}>
            Cancelar
          </Button>
          <Button
            disabled={!reason.trim()}
            loading={isPending}
            onClick={() => onConfirm(reason.trim())}
          >
            Confirmar
          </Button>
        </div>
      </div>
    </div>
  );
}

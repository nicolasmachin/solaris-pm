import { Button } from "../ui/Button";

// Modal de confirmación "marcar como ganado". Extracción del JSX inline
// de LeadPanel. La conversión real a proyecto se maneja por separado
// (LeadToProjectModal) — este componente solo confirma la transición
// de stage. El caller decide qué abrir después de onConfirm.

interface Props {
  open: boolean;
  onCancel: () => void;
  onConfirm: () => void;
  isPending?: boolean;
}

export function MarkAsWonModal({ open, onCancel, onConfirm, isPending }: Props) {
  if (!open) return null;
  return (
    <div
      className="fixed inset-0 z-[96] flex items-center justify-center bg-black/60 p-4"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onCancel();
      }}
    >
      <div className="w-full max-w-lg rounded-xl border border-[var(--color-border)] bg-[var(--color-bg-card)] p-6">
        <h3 className="mb-2 font-display text-lg font-bold text-[var(--color-text-primary)]">
          Marcar como Ganado
        </h3>
        <p className="text-sm text-[var(--color-text-secondary)]">
          El lead pasa a etapa Cerrado como Ganado. Después vas a poder completar
          los datos que falten para crear el proyecto (ciudad, provincia, potencia,
          presupuesto).
        </p>
        <div className="mt-4 flex justify-end gap-2">
          <Button variant="ghost" onClick={onCancel}>
            Cancelar
          </Button>
          <Button loading={isPending} onClick={onConfirm}>
            Confirmar
          </Button>
        </div>
      </div>
    </div>
  );
}

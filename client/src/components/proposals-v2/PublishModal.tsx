import { Button } from "../ui/Button";
import { Sheet } from "../ui/Sheet";

// Modal de confirmación de publicación. Muestra warning si el borrador no tiene
// cambios respecto a la última versión (igual se publica una nueva).
export function PublishModal({
  open,
  versionLabel,
  hasChanges,
  publishing,
  error,
  onConfirm,
  onClose,
}: {
  open: boolean;
  versionLabel: string; // "V3"
  hasChanges: boolean;
  publishing: boolean;
  error: string | null;
  onConfirm: () => void;
  onClose: () => void;
}) {
  return (
    <Sheet
      open={open}
      onClose={publishing ? () => undefined : onClose}
      title={`Publicar versión ${versionLabel}`}
      footer={
        <>
          <Button variant="secondary" size="sm" onClick={onClose} disabled={publishing}>
            Cancelar
          </Button>
          <Button size="sm" onClick={onConfirm} loading={publishing}>
            Publicar {versionLabel}
          </Button>
        </>
      }
    >
      <div className="space-y-3 text-sm">
        {hasChanges ? (
          <p className="text-[var(--color-text-secondary)]">
            Se creará la versión {versionLabel} a partir del borrador actual. ¿Continuar?
          </p>
        ) : (
          <div className="rounded-md border border-[var(--color-warning-bg)] bg-[var(--color-warning-bg)]/20 p-3 text-[var(--color-warning-text)]">
            El borrador no tiene cambios respecto a la última versión publicada. Esto crea igual una
            versión nueva ({versionLabel}) con la fecha de hoy; no modifica la versión anterior.
          </div>
        )}
        {error ? <p className="text-red-400">{error}</p> : null}
      </div>
    </Sheet>
  );
}

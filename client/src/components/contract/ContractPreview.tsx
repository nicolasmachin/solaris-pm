import { Spinner } from "../ui/Spinner";
import type { PreviewStatus } from "../../hooks/useDraftPreview";

// Columna de preview: iframe con el PDF del contrato + overlays de estado.
export function ContractPreview({
  blobUrl,
  status,
  errorMsg,
}: {
  blobUrl: string | null;
  status: PreviewStatus;
  errorMsg: string | null;
}) {
  return (
    <div className="relative h-full overflow-hidden rounded-lg border border-[var(--color-border)] bg-[var(--color-bg-card)]">
      {blobUrl ? (
        <iframe title="Preview del contrato" src={blobUrl} className="h-full w-full bg-white" />
      ) : null}

      {!blobUrl && status !== "loading" ? (
        <div className="flex h-full items-center justify-center p-6 text-center">
          <p className="text-sm text-[var(--color-text-muted)]">
            {status === "error" ? errorMsg : "El preview se genera al completar los datos."}
          </p>
        </div>
      ) : null}

      {status === "loading" ? (
        <div className="absolute inset-0 flex items-center justify-center gap-2 bg-[var(--color-bg-card)]/70">
          <Spinner size={18} />
          <span className="text-sm text-[var(--color-text-secondary)]">Actualizando preview…</span>
        </div>
      ) : null}

      {status === "error" && blobUrl ? (
        <div className="absolute inset-x-0 top-0 bg-red-500/90 px-3 py-1.5 text-center text-xs text-white">
          {errorMsg}
        </div>
      ) : null}
    </div>
  );
}

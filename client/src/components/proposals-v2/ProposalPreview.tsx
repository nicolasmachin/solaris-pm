import { Spinner } from "../ui/Spinner";
import type { PreviewStatus } from "../../hooks/useDraftPreview";

// Columna de preview: iframe con el PDF + overlays de estado.
export function ProposalPreview({
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
        <iframe title="Preview de la propuesta" src={blobUrl} className="h-full w-full bg-white" />
      ) : null}

      {/* Estado sin PDF todavía (o error sin PDF previo) */}
      {!blobUrl && status !== "loading" ? (
        <div className="flex h-full items-center justify-center p-6 text-center">
          <p className="text-sm text-[var(--color-text-muted)]">
            {status === "error" ? errorMsg : "El preview se genera al completar los datos."}
          </p>
        </div>
      ) : null}

      {/* Overlay de "actualizando" (semi-transparente sobre el PDF existente) */}
      {status === "loading" ? (
        <div className="absolute inset-0 flex items-center justify-center gap-2 bg-[var(--color-bg-card)]/70">
          <Spinner size={18} />
          <span className="text-sm text-[var(--color-text-secondary)]">Actualizando preview…</span>
        </div>
      ) : null}

      {/* Error con PDF previo: banner arriba, sin tapar el PDF viejo */}
      {status === "error" && blobUrl ? (
        <div className="absolute inset-x-0 top-0 bg-red-500/90 px-3 py-1.5 text-center text-xs text-white">
          {errorMsg}
        </div>
      ) : null}
    </div>
  );
}

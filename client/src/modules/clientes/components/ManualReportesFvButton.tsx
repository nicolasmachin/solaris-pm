import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { BookOpen, Download, X } from "lucide-react";

import { getManualInfo, manualPdfUrl } from "../../../api/reportesFv.api";
import { downloadAuthenticated, useAuthBlobUrl } from "../../../hooks/useAuthBlobUrl";
import { Spinner } from "../../../components/ui/Spinner";

/**
 * Botón del manual de uso, compartido por las pestañas del módulo.
 *
 * Abre una vista previa antes de descargar: el manual se consulta más de lo que
 * se guarda, y bajar un PDF para leer dos párrafos es una fricción tonta.
 * La descarga queda a un clic dentro de la vista previa.
 *
 * El PDF va por un endpoint autenticado, así que el <iframe> no puede pedirlo
 * solo (no manda el header). De ahí el blob URL.
 */
export function ManualReportesFvButton() {
  const [abierto, setAbierto] = useState(false);

  const { data: manual } = useQuery({
    queryKey: ["reportes-fv", "manual"],
    queryFn: getManualInfo,
  });

  // Sólo se descarga el PDF cuando se abre la vista previa, no al montar.
  const { blobUrl, loading, error } = useAuthBlobUrl(abierto ? manualPdfUrl() : null);

  const nombreArchivo = `manual-reportes-fv-v${manual?.version ?? ""}.pdf`;

  return (
    <>
      <button
        onClick={() => setAbierto(true)}
        title={manual ? `Manual v${manual.version} · ${manual.actualizado}` : "Manual de uso"}
        className="flex items-center gap-1.5 rounded-lg border border-[var(--color-border)] px-3 py-1.5 text-sm text-[var(--color-text-secondary)] transition-colors hover:text-[var(--color-text-primary)]"
      >
        <BookOpen size={14} /> Manual de uso{manual ? ` (v${manual.version})` : ""}
      </button>

      {abierto && (
        <div
          className="fixed inset-0 z-50 flex flex-col bg-black/70 p-4 sm:p-8"
          role="dialog"
          aria-modal="true"
          aria-label="Manual de uso"
          onClick={() => setAbierto(false)}
        >
          <div
            className="mx-auto flex h-full w-full max-w-5xl flex-col overflow-hidden rounded-xl border border-[var(--color-border)] bg-[var(--color-bg-card)]"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between gap-3 border-b border-[var(--color-border)] px-4 py-2.5">
              <div>
                <h2 className="font-display text-base font-bold text-[var(--color-text-primary)]">
                  Manual de uso — Reportes y datos de generación
                </h2>
                {manual && (
                  <p className="text-[11px] text-[var(--color-text-muted)]">
                    Versión {manual.version} · actualizado el {manual.actualizado}
                  </p>
                )}
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => downloadAuthenticated(manualPdfUrl(), nombreArchivo)}
                  className="flex items-center gap-1.5 rounded-lg bg-[var(--color-accent)] px-3 py-1.5 text-sm font-medium text-black"
                >
                  <Download size={14} /> Descargar
                </button>
                <button
                  onClick={() => setAbierto(false)}
                  aria-label="Cerrar"
                  className="rounded-lg p-1.5 text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)]"
                >
                  <X size={18} />
                </button>
              </div>
            </div>

            <div className="flex-1 overflow-hidden bg-[var(--color-bg-app)]">
              {loading && (
                <div className="flex h-full items-center justify-center">
                  <Spinner />
                </div>
              )}
              {error && (
                <div className="flex h-full items-center justify-center px-6 text-center text-sm text-[var(--color-text-muted)]">
                  No se pudo abrir la vista previa. Probá con el botón Descargar.
                </div>
              )}
              {blobUrl && !error && (
                <iframe src={blobUrl} title="Manual de uso" className="h-full w-full border-0" />
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
}

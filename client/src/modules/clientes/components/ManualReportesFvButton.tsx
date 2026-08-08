import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { BookOpen, Download, ListChecks, X } from "lucide-react";

import {
  getManualInfo,
  getOperacionInfo,
  manualPdfUrl,
  operacionPdfUrl,
} from "../../../api/reportesFv.api";
import { downloadAuthenticated, useAuthBlobUrl } from "../../../hooks/useAuthBlobUrl";
import { Spinner } from "../../../components/ui/Spinner";

/**
 * Documentos del módulo, cada uno con su botón: el **manual de uso** explica
 * cómo funciona cada cosa, y la **guía de operación mensual** es la receta de
 * qué apretar este mes. Se consultan en momentos distintos, por eso no están
 * en el mismo documento.
 *
 * Los dos abren una vista previa antes de descargar: el documento se consulta
 * más de lo que se guarda, y bajar un PDF para leer dos párrafos es fricción
 * inútil. La descarga queda a un clic adentro.
 */
type Doc = "manual" | "operacion";

const DOCS = {
  manual: {
    label: "Manual de uso",
    titulo: "Manual de uso — Reportes y datos de generación",
    icono: BookOpen,
    url: manualPdfUrl,
    archivo: (v: string) => `manual-reportes-fv-v${v}.pdf`,
  },
  operacion: {
    label: "Paso a paso mensual",
    titulo: "Operación mensual — qué hacer cada mes",
    icono: ListChecks,
    url: operacionPdfUrl,
    archivo: (v: string) => `operacion-mensual-reportes-fv-v${v}.pdf`,
  },
} as const;

function BotonDoc({ doc, version, actualizado }: { doc: Doc; version?: string; actualizado?: string }) {
  const [abierto, setAbierto] = useState(false);
  const cfg = DOCS[doc];
  const Icono = cfg.icono;

  // El PDF se pide recién al abrir la vista previa, no al montar la pantalla.
  const { blobUrl, loading, error } = useAuthBlobUrl(abierto ? cfg.url() : null);

  return (
    <>
      <button
        onClick={() => setAbierto(true)}
        title={version ? `v${version} · ${actualizado}` : cfg.label}
        className="flex items-center gap-1.5 rounded-lg border border-[var(--color-border)] px-3 py-1.5 text-sm text-[var(--color-text-secondary)] transition-colors hover:text-[var(--color-text-primary)]"
      >
        <Icono size={14} /> {cfg.label}
        {version ? ` (v${version})` : ""}
      </button>

      {abierto && (
        <div
          className="fixed inset-0 z-50 flex flex-col bg-black/70 p-4 sm:p-8"
          role="dialog"
          aria-modal="true"
          aria-label={cfg.titulo}
          onClick={() => setAbierto(false)}
        >
          <div
            className="mx-auto flex h-full w-full max-w-5xl flex-col overflow-hidden rounded-xl border border-[var(--color-border)] bg-[var(--color-bg-card)]"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between gap-3 border-b border-[var(--color-border)] px-4 py-2.5">
              <div>
                <h2 className="font-display text-base font-bold text-[var(--color-text-primary)]">
                  {cfg.titulo}
                </h2>
                {version && (
                  <p className="text-[11px] text-[var(--color-text-muted)]">
                    Versión {version} · actualizado el {actualizado}
                  </p>
                )}
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => downloadAuthenticated(cfg.url(), cfg.archivo(version ?? ""))}
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
                <iframe src={blobUrl} title={cfg.titulo} className="h-full w-full border-0" />
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
}

export function ManualReportesFvButton() {
  const { data: manual } = useQuery({
    queryKey: ["reportes-fv", "manual"],
    queryFn: getManualInfo,
  });
  const { data: operacion } = useQuery({
    queryKey: ["reportes-fv", "operacion"],
    queryFn: getOperacionInfo,
  });

  return (
    <div className="flex flex-wrap items-center gap-2">
      <BotonDoc doc="operacion" version={operacion?.version} actualizado={operacion?.actualizado} />
      <BotonDoc doc="manual" version={manual?.version} actualizado={manual?.actualizado} />
    </div>
  );
}

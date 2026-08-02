import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Download, FileText, Sun } from "lucide-react";

import { getPortalReportes, portalReportePdfUrl, type PortalReporteRow } from "../api/portal.api";
import { useAuthBlobUrl, downloadAuthenticated } from "../hooks/useAuthBlobUrl";
import { Spinner } from "../components/ui/Spinner";

const MESES = [
  "enero", "febrero", "marzo", "abril", "mayo", "junio",
  "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre",
];

function mesEs(periodo: string): string {
  const [, m] = periodo.split("-");
  return MESES[Number(m) - 1] ?? periodo;
}

const fmtPesos = (v: number | null) =>
  v == null ? null : `$${new Intl.NumberFormat("es-UY", { maximumFractionDigits: 0 }).format(v)}`;

export function PortalReportes() {
  const { data: reportes = [], isLoading } = useQuery({
    queryKey: ["portal-reportes"],
    queryFn: getPortalReportes,
  });

  const [abierto, setAbierto] = useState<string | null>(null);

  // Agrupados por año, más reciente primero.
  const porAnio = useMemo(() => {
    const grupos = new Map<number, PortalReporteRow[]>();
    for (const r of reportes) {
      const g = grupos.get(r.anio) ?? [];
      g.push(r);
      grupos.set(r.anio, g);
    }
    return [...grupos.entries()].sort((a, b) => b[0] - a[0]);
  }, [reportes]);

  const relativeUrl = abierto ? `/api/client/reportes/${abierto}/pdf` : null;
  const { blobUrl, loading } = useAuthBlobUrl(relativeUrl);

  if (isLoading) return <Spinner />;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-2xl font-bold text-[var(--color-text-primary)]">
          Mis reportes solares
        </h1>
        <p className="text-sm text-[var(--color-text-muted)]">
          El detalle mensual de tu generación, consumo y ahorro.
        </p>
      </div>

      {reportes.length === 0 ? (
        <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-bg-card)] p-8 text-center">
          <Sun size={28} className="mx-auto mb-2 text-[var(--color-text-muted)]" />
          <p className="text-sm text-[var(--color-text-muted)]">
            Todavía no tenés reportes disponibles. Cuando emitamos el primero, aparecerá acá.
          </p>
        </div>
      ) : (
        porAnio.map(([anio, items]) => (
          <div key={anio}>
            <h2 className="mb-2 font-mono text-xs uppercase tracking-wider text-[var(--color-text-muted)]">
              {anio}
            </h2>
            <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
              {items.map((r) => (
                <div
                  key={r.id}
                  className="rounded-xl border border-[var(--color-border)] bg-[var(--color-bg-card)] p-4"
                >
                  <div className="flex items-center justify-between">
                    <span className="font-display font-semibold capitalize text-[var(--color-text-primary)]">
                      {mesEs(r.periodo)}
                    </span>
                    <FileText size={16} className="text-[var(--color-accent)]" />
                  </div>
                  {fmtPesos(r.ahorroTotal) && (
                    <div className="mt-1 text-sm text-[var(--color-text-secondary)]">
                      Ahorro del mes: <strong>{fmtPesos(r.ahorroTotal)}</strong>
                    </div>
                  )}
                  <div className="mt-3 flex gap-2">
                    <button
                      type="button"
                      onClick={() => setAbierto(r.id)}
                      className="flex-1 rounded-lg bg-[var(--color-accent)] px-3 py-1.5 text-sm font-medium text-white"
                    >
                      Ver
                    </button>
                    <button
                      type="button"
                      aria-label="Descargar"
                      onClick={() =>
                        downloadAuthenticated(portalReportePdfUrl(r.id), `reporte-${r.periodo}.pdf`)
                      }
                      className="rounded-lg border border-[var(--color-border)] px-3 py-1.5 text-[var(--color-text-secondary)]"
                    >
                      <Download size={15} />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        ))
      )}

      {/* Visor del PDF */}
      {abierto && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-2 sm:p-6"
          onMouseDown={(e) => {
            if (e.target === e.currentTarget) setAbierto(null);
          }}
        >
          <div className="flex h-full w-full max-w-4xl flex-col overflow-hidden rounded-xl bg-[var(--color-bg-app)]">
            <div className="flex items-center justify-between border-b border-[var(--color-border)] px-4 py-2">
              <span className="text-sm font-medium text-[var(--color-text-primary)]">
                Reporte fotovoltaico
              </span>
              <button
                type="button"
                onClick={() => setAbierto(null)}
                className="rounded px-2 py-1 text-sm text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)]"
              >
                Cerrar
              </button>
            </div>
            <div className="flex-1 bg-[#525659]">
              {loading || !blobUrl ? (
                <div className="flex h-full items-center justify-center text-sm text-white/70">
                  Cargando PDF…
                </div>
              ) : (
                <iframe src={blobUrl} title="Reporte fotovoltaico" className="h-full w-full border-0" />
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

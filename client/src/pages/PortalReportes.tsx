import { useMemo, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Download, FileText, Sun, CalendarClock } from "lucide-react";
import toast from "react-hot-toast";

import {
  getPortalReportes,
  portalReportePdfUrl,
  getPortalDiaCorte,
  setPortalDiaCorte,
  type PortalReporteRow,
} from "../api/portal.api";
import { useAuthBlobUrl, downloadAuthenticated } from "../hooks/useAuthBlobUrl";
import { Spinner } from "../components/ui/Spinner";
import { PortalEnergiaDashboard } from "../components/portal/PortalEnergiaDashboard";

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

/** Panel donde el cliente alinea el reporte a su ciclo de facturación de UTE. */
function DiaCorteSection() {
  const qc = useQueryClient();
  const { data: generadores = [] } = useQuery({
    queryKey: ["portal-dia-corte"],
    queryFn: getPortalDiaCorte,
  });
  const [editando, setEditando] = useState<Record<string, string>>({});

  const mutation = useMutation({
    mutationFn: ({ projectId, valor }: { projectId: string; valor: number | null }) =>
      setPortalDiaCorte(projectId, valor),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["portal-dia-corte"] });
      toast.success("Día de corte actualizado");
    },
    onError: () => toast.error("No se pudo guardar el día de corte"),
  });

  if (generadores.length === 0) return null;

  const guardar = (projectId: string) => {
    const raw = (editando[projectId] ?? "").trim();
    if (raw === "") {
      mutation.mutate({ projectId, valor: null });
      return;
    }
    const n = Number(raw);
    if (!Number.isInteger(n) || n < 1 || n > 31) {
      toast.error("Ingresá un día entre 1 y 31");
      return;
    }
    mutation.mutate({ projectId, valor: n });
  };

  return (
    <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-bg-card)] p-4">
      <div className="mb-1 flex items-center gap-2">
        <CalendarClock size={16} className="text-[var(--color-accent)]" />
        <h2 className="font-display font-semibold text-[var(--color-text-primary)]">
          Alineá tus reportes con tu factura de UTE
        </h2>
      </div>
      <p className="mb-3 text-sm text-[var(--color-text-muted)]">
        Por defecto el reporte cubre el mes calendario (del 1 al último día). Si cargás el día en que UTE lee
        tu medidor (lo ves en tu factura), a partir del próximo reporte usaremos tu ciclo de facturación para
        que los números se parezcan más a lo que pagás. Dejalo vacío para volver al mes calendario.
      </p>
      <div className="space-y-2">
        {generadores.map((g) => {
          const valorActual = editando[g.projectId] ?? (g.diaCorteMedidor?.toString() ?? "");
          return (
            <div
              key={g.projectId}
              className="flex flex-wrap items-center gap-2 rounded-lg border border-[var(--color-border)] p-2"
            >
              <span className="flex-1 text-sm text-[var(--color-text-secondary)]">{g.projectName}</span>
              <input
                type="number"
                min={1}
                max={31}
                placeholder="Mes calendario"
                value={valorActual}
                onChange={(e) =>
                  setEditando((s) => ({ ...s, [g.projectId]: e.target.value }))
                }
                className="w-36 rounded-lg border border-[var(--color-border)] bg-[var(--color-bg-app)] px-2 py-1 text-sm text-[var(--color-text-primary)]"
              />
              <button
                type="button"
                disabled={mutation.isPending}
                onClick={() => guardar(g.projectId)}
                className="rounded-lg bg-[var(--color-accent)] px-3 py-1 text-sm font-medium text-white disabled:opacity-60"
              >
                Guardar
              </button>
            </div>
          );
        })}
      </div>
    </div>
  );
}

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

      <PortalEnergiaDashboard />

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

      {reportes.length > 0 && <DiaCorteSection />}

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

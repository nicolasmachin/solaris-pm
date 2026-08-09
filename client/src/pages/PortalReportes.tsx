import { useMemo, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Download, FileText, Sun, CalendarClock } from "lucide-react";
import toast from "react-hot-toast";

import {
  getPortalReportes,
  portalReportePdfUrl,
  getPortalDiaCorte,
  setPortalDatosUte,
  type PortalTarifaUte,
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

const TARIFAS: Array<{ value: PortalTarifaUte; label: string; ayuda: string }> = [
  { value: "SIMPLE", label: "Simple", ayuda: "Un solo precio todo el día" },
  { value: "DOBLE", label: "Doble horario", ayuda: "Punta y fuera de punta" },
  { value: "TRIPLE", label: "Triple horario", ayuda: "Punta, llano y valle" },
  { value: "ZAFRAL", label: "Zafral", ayuda: "Tarifa de temporada" },
];

/**
 * Datos que el cliente tiene en su factura de UTE y nosotros muchas veces no.
 *
 * Sin la potencia contratada el reporte se calcula con una estimación de 5 kW y
 * sale con una nota aclarándolo; sin la tarifa, a las empresas directamente no
 * se les puede calcular. Que los cargue el titular es más rápido y más confiable
 * que perseguir el dato.
 */
function MisDatosUteSection() {
  const qc = useQueryClient();
  const { data: generadores = [] } = useQuery({
    queryKey: ["portal-dia-corte"],
    queryFn: getPortalDiaCorte,
  });
  const [corte, setCorte] = useState<Record<string, string>>({});
  const [potencia, setPotencia] = useState<Record<string, string>>({});

  const invalidar = () => qc.invalidateQueries({ queryKey: ["portal-dia-corte"] });

  const mutCorte = useMutation({
    mutationFn: ({ projectId, valor }: { projectId: string; valor: number | null }) =>
      setPortalDiaCorte(projectId, valor),
    onSuccess: () => {
      invalidar();
      toast.success("Día de corte actualizado");
    },
    onError: () => toast.error("No se pudo guardar el día de corte"),
  });

  const mutDatos = useMutation({
    mutationFn: ({
      projectId,
      tarifaContratada,
      potenciaContratadaKw,
    }: {
      projectId: string;
      tarifaContratada: PortalTarifaUte | null;
      potenciaContratadaKw: number | null;
    }) => setPortalDatosUte(projectId, { tarifaContratada, potenciaContratadaKw }),
    onSuccess: () => {
      invalidar();
      toast.success("Datos actualizados");
    },
    onError: () => toast.error("No se pudieron guardar los datos"),
  });

  if (generadores.length === 0) return null;

  const guardarCorte = (projectId: string, actual: number | null) => {
    const raw = (corte[projectId] ?? actual?.toString() ?? "").trim();
    if (raw === "") return mutCorte.mutate({ projectId, valor: null });
    const n = Number(raw);
    if (!Number.isInteger(n) || n < 1 || n > 31) {
      toast.error("Ingresá un día entre 1 y 31");
      return;
    }
    mutCorte.mutate({ projectId, valor: n });
  };

  const guardarPotencia = (
    projectId: string,
    actual: number | null,
    tarifa: PortalTarifaUte | null,
  ) => {
    const raw = (potencia[projectId] ?? actual?.toString() ?? "").trim();
    if (raw !== "") {
      const n = Number(raw.replace(",", "."));
      if (!Number.isFinite(n) || n <= 0) {
        toast.error("Ingresá la potencia en kW, por ejemplo 5.5");
        return;
      }
      mutDatos.mutate({ projectId, tarifaContratada: tarifa, potenciaContratadaKw: n });
      return;
    }
    mutDatos.mutate({ projectId, tarifaContratada: tarifa, potenciaContratadaKw: null });
  };

  return (
    <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-bg-card)] p-4">
      <div className="mb-1 flex items-center gap-2">
        <CalendarClock size={16} className="text-[var(--color-accent)]" />
        <h2 className="font-display font-semibold text-[var(--color-text-primary)]">
          Mis datos de UTE
        </h2>
      </div>
      <p className="mb-4 text-sm text-[var(--color-text-muted)]">
        Estos tres datos están en tu factura de UTE y hacen que tu reporte sea más preciso. Si no los
        cargás, igual recibís el reporte: usamos valores de referencia y te lo aclaramos ahí mismo.
      </p>

      <div className="space-y-4">
        {generadores.map((g) => (
          <div key={g.projectId} className="rounded-lg border border-[var(--color-border)] p-3">
            {generadores.length > 1 && (
              <p className="mb-2 text-sm font-medium text-[var(--color-text-primary)]">
                {g.projectName}
              </p>
            )}

            <div className="grid gap-3 sm:grid-cols-2">
              <label className="text-sm">
                <span className="mb-1 block text-[var(--color-text-secondary)]">
                  Tarifa contratada
                </span>
                <select
                  value={g.tarifaContratada ?? ""}
                  onChange={(e) =>
                    mutDatos.mutate({
                      projectId: g.projectId,
                      tarifaContratada: (e.target.value || null) as PortalTarifaUte | null,
                      potenciaContratadaKw: g.potenciaContratadaKw,
                    })
                  }
                  className="w-full rounded-lg border border-[var(--color-border)] bg-[var(--color-bg-app)] px-2 py-1.5 text-sm text-[var(--color-text-primary)]"
                >
                  <option value="">No la sé</option>
                  {TARIFAS.map((t) => (
                    <option key={t.value} value={t.value}>
                      {t.label} — {t.ayuda}
                    </option>
                  ))}
                </select>
              </label>

              <label className="text-sm">
                <span className="mb-1 block text-[var(--color-text-secondary)]">
                  Potencia contratada (kW)
                </span>
                <div className="flex gap-2">
                  <input
                    inputMode="decimal"
                    placeholder="Ej: 5.5"
                    value={potencia[g.projectId] ?? g.potenciaContratadaKw?.toString() ?? ""}
                    onChange={(e) =>
                      setPotencia((s) => ({ ...s, [g.projectId]: e.target.value }))
                    }
                    className="w-full rounded-lg border border-[var(--color-border)] bg-[var(--color-bg-app)] px-2 py-1.5 text-sm text-[var(--color-text-primary)]"
                  />
                  <button
                    type="button"
                    disabled={mutDatos.isPending}
                    onClick={() =>
                      guardarPotencia(g.projectId, g.potenciaContratadaKw, g.tarifaContratada)
                    }
                    className="shrink-0 rounded-lg bg-[var(--color-accent)] px-3 py-1 text-sm font-medium text-gray-900 disabled:opacity-60"
                  >
                    Guardar
                  </button>
                </div>
              </label>

              <label className="text-sm sm:col-span-2">
                <span className="mb-1 block text-[var(--color-text-secondary)]">
                  Día en que UTE lee tu medidor
                </span>
                <div className="flex gap-2">
                  <input
                    type="number"
                    min={1}
                    max={31}
                    placeholder="Mes calendario"
                    value={corte[g.projectId] ?? g.diaCorteMedidor?.toString() ?? ""}
                    onChange={(e) => setCorte((s) => ({ ...s, [g.projectId]: e.target.value }))}
                    className="w-full rounded-lg border border-[var(--color-border)] bg-[var(--color-bg-app)] px-2 py-1.5 text-sm text-[var(--color-text-primary)] sm:w-48"
                  />
                  <button
                    type="button"
                    disabled={mutCorte.isPending}
                    onClick={() => guardarCorte(g.projectId, g.diaCorteMedidor)}
                    className="shrink-0 rounded-lg bg-[var(--color-accent)] px-3 py-1 text-sm font-medium text-gray-900 disabled:opacity-60"
                  >
                    Guardar
                  </button>
                </div>
                <span className="mt-1 block text-xs text-[var(--color-text-muted)]">
                  Si lo cargás, el reporte va a cubrir tu ciclo de facturación en vez del mes
                  calendario, y los números se van a parecer más a lo que pagás. Dejalo vacío para
                  volver al mes calendario.
                </span>
              </label>
            </div>
          </div>
        ))}
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
                      className="flex-1 rounded-lg bg-[var(--color-accent)] px-3 py-1.5 text-sm font-medium text-gray-900"
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

      {/* Sin condicionar a que ya tenga reportes: un cliente que todavía no
          recibió ninguno es justamente el que más necesita cargar estos datos,
          porque son los que faltan para poder calcularle el primero. */}
      <MisDatosUteSection />

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

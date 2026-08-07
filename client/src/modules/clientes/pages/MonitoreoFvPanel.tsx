import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { AlertTriangle, RefreshCw, Search } from "lucide-react";
import toast from "react-hot-toast";

import {
  correrMonitor,
  DIAGNOSTICO_BADGE,
  DIAGNOSTICO_LABEL,
  DIAGNOSTICO_ORDER,
  getCorridasMonitor,
  getEstadoMonitor,
  getIncidencias,
  type FilaMonitor,
  type FvDiagnostico,
} from "../../../api/monitorFv.api";
import { ResponsiveTable, type Column } from "../../../components/ui/ResponsiveTable";
import { Spinner } from "../../../components/ui/Spinner";
import { usePermission } from "../../../hooks/usePermission";
import { MonitorPlantaDrawer } from "../components/MonitorPlantaDrawer";

type FiltroSilencio = "ocultar" | "mostrar" | "solo";

function KpiCard({
  label,
  value,
  tone,
  activo,
  onClick,
}: {
  label: string;
  value: number;
  tone?: string;
  activo?: boolean;
  onClick?: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`rounded-xl border p-3 text-left transition-colors ${
        activo
          ? "border-[var(--color-accent)] bg-[var(--color-bg-card)]"
          : "border-[var(--color-border)] bg-[var(--color-bg-card)] hover:border-[var(--color-text-muted)]"
      }`}
    >
      <div className="font-mono text-[10px] uppercase tracking-wider text-[var(--color-text-muted)]">
        {label}
      </div>
      <div className={`mt-0.5 font-display text-2xl font-bold ${tone ?? "text-[var(--color-text-primary)]"}`}>
        {value}
      </div>
    </button>
  );
}

function fechaCorta(iso: string | null): string {
  if (!iso) return "—";
  const d = new Date(iso.length === 10 ? `${iso}T00:00:00` : iso);
  return d.toLocaleDateString("es-UY", { day: "numeric", month: "short" });
}

function haceCuanto(dia: string | null): string {
  if (!dia) return "—";
  const dias = Math.round((Date.now() - new Date(`${dia}T00:00:00`).getTime()) / 86_400_000);
  if (dias <= 0) return "hoy";
  if (dias === 1) return "ayer";
  return `hace ${dias} días`;
}

export function MonitoreoFvPanel() {
  const qc = useQueryClient();
  const canCreate = usePermission("EXPERIENCIA_CLIENTES", "CREATE");

  const [vista, setVista] = useState<"estado" | "historial" | "corridas">("estado");
  const [busqueda, setBusqueda] = useState("");
  const [diagnosticos, setDiagnosticos] = useState<Set<FvDiagnostico>>(new Set());
  const [silencio, setSilencio] = useState<FiltroSilencio>("mostrar");
  const [soloSinRevisar, setSoloSinRevisar] = useState(false);
  const [seleccionada, setSeleccionada] = useState<FilaMonitor | null>(null);

  const { data, isLoading } = useQuery({
    queryKey: ["monitor-fv", "estado"],
    queryFn: getEstadoMonitor,
  });

  const { data: incidencias } = useQuery({
    queryKey: ["monitor-fv", "incidencias"],
    queryFn: () => getIncidencias({ limit: 200 }),
    enabled: vista === "historial",
  });

  const { data: corridas } = useQuery({
    queryKey: ["monitor-fv", "corridas"],
    queryFn: () => getCorridasMonitor(30),
    enabled: vista === "corridas",
  });

  const correr = useMutation({
    mutationFn: () => correrMonitor({ enviarEmail: false }),
    onSuccess: () => {
      toast.success("Revisión lanzada. Tarda unos minutos; actualizá en un rato.");
      qc.invalidateQueries({ queryKey: ["monitor-fv"] });
    },
    onError: () => toast.error("No se pudo lanzar la revisión"),
  });

  const plantas = data?.plantas ?? [];

  const filtradas = useMemo(() => {
    const q = busqueda.trim().toLowerCase();
    return plantas.filter((p) => {
      if (q && !`${p.clientName ?? ""} ${p.plantName}`.toLowerCase().includes(q)) return false;
      if (diagnosticos.size > 0 && !diagnosticos.has(p.diagnostico)) return false;
      const silenciada = p.silenciadaHasta != null;
      if (silencio === "ocultar" && silenciada) return false;
      if (silencio === "solo" && !silenciada) return false;
      if (soloSinRevisar && !(p.incidenciaId && !p.revisada)) return false;
      return true;
    });
  }, [plantas, busqueda, diagnosticos, silencio, soloSinRevisar]);

  const toggleDiagnostico = (d: FvDiagnostico) => {
    setDiagnosticos((prev) => {
      const next = new Set(prev);
      if (next.has(d)) next.delete(d);
      else next.add(d);
      return next;
    });
  };

  const limpiar = () => {
    setBusqueda("");
    setDiagnosticos(new Set());
    setSilencio("mostrar");
    setSoloSinRevisar(false);
  };

  const columnas: Column<FilaMonitor>[] = [
    {
      key: "clientName",
      label: "Cliente",
      cardRole: "title",
      render: (r) => (
        <div>
          <div className="font-medium text-[var(--color-text-primary)]">
            {r.clientName ?? r.plantName}
          </div>
          {r.clientName && r.clientName !== r.plantName && (
            <div className="text-[11px] text-[var(--color-text-muted)]">{r.plantName}</div>
          )}
        </div>
      ),
    },
    {
      key: "diagnostico",
      label: "Estado",
      cardRole: "highlight",
      render: (r) => (
        <div>
          <span
            className={`inline-block rounded px-2 py-0.5 font-mono text-[10px] uppercase ${DIAGNOSTICO_BADGE[r.diagnostico]}`}
          >
            {DIAGNOSTICO_LABEL[r.diagnostico]}
          </span>
          {r.detalle && (
            <div className="mt-1 max-w-md text-[11px] text-[var(--color-text-muted)]">{r.detalle}</div>
          )}
        </div>
      ),
    },
    {
      key: "generacionAyerKwh",
      label: "Ayer (kWh)",
      align: "right",
      sortable: true,
      render: (r) => (r.generacionAyerKwh != null ? r.generacionAyerKwh.toFixed(1) : "—"),
    },
    {
      key: "diasSinGeneracion",
      label: "Días sin generar",
      align: "right",
      sortable: true,
      render: (r) =>
        r.diasSinGeneracion > 0 ? (
          <span className={r.diasSinGeneracion >= 3 ? "font-semibold text-red-400" : ""}>
            {r.diasSinGeneracion}
          </span>
        ) : (
          "—"
        ),
    },
    {
      key: "ultimaGeneracionEn",
      label: "Última generación",
      render: (r) => (r.ultimaGeneracionEn ? fechaCorta(r.ultimaGeneracionEn) : "—"),
    },
    {
      key: "incidenciaDesde",
      label: "Abierta desde",
      render: (r) => (r.incidenciaDesde ? haceCuanto(r.incidenciaDesde) : "—"),
    },
    {
      key: "revisada",
      label: "Revisada",
      cardRole: "hidden",
      render: (r) => (r.incidenciaId ? (r.revisada ? "Sí" : "—") : ""),
    },
  ];

  if (isLoading) return <Spinner />;

  const k = data?.kpis;
  const corrida = data?.ultimaCorrida;
  const conProblema = (k?.sinGeneracion ?? 0) + (k?.errorDispositivo ?? 0) + (k?.sinComunicacion ?? 0);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="max-w-2xl text-sm text-[var(--color-text-muted)]">
            Todos los días a la mañana se revisa que cada planta haya generado el día anterior. Si no
            generó, se busca la causa: falla del equipo, sin conexión a internet o todavía sin
            habilitar.
          </p>
          {corrida && (
            <p className="mt-1 text-[11px] text-[var(--color-text-muted)]">
              Última revisión: {fechaCorta(corrida.fecha)} · {corrida.plantasTotal} plantas ·{" "}
              {corrida.estado === "OK"
                ? "sin problemas de consulta"
                : corrida.estado === "PARCIAL"
                  ? `${corrida.plantasError} no se pudieron consultar`
                  : "la revisión falló"}
            </p>
          )}
        </div>
        {canCreate && (
          <button
            onClick={() => correr.mutate()}
            disabled={correr.isPending}
            className="flex items-center gap-1.5 rounded-lg border border-[var(--color-border)] px-3 py-1.5 text-sm text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)] disabled:opacity-50"
          >
            <RefreshCw className={`h-4 w-4 ${correr.isPending ? "animate-spin" : ""}`} />
            Revisar ahora
          </button>
        )}
      </div>

      {corrida?.estado === "ERROR" && (
        <div className="flex items-start gap-2 rounded-xl border border-red-500/30 bg-red-500/10 p-3 text-sm text-red-300">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
          <div>
            <div className="font-medium">La última revisión no se pudo completar.</div>
            <div className="text-[13px] opacity-90">
              {corrida.errorMessage ??
                "Growatt no respondió. No se abrió ni cerró ninguna incidencia."}
            </div>
          </div>
        </div>
      )}

      <div className="flex items-center gap-1 border-b border-[var(--color-border)]">
        {(
          [
            ["estado", "Estado de las plantas"],
            ["historial", "Historial de incidencias"],
            ["corridas", "Revisiones"],
          ] as const
        ).map(([id, label]) => (
          <button
            key={id}
            onClick={() => setVista(id)}
            className={`-mb-[1px] border-b-2 px-3 py-2 text-sm transition-colors ${
              vista === id
                ? "border-[var(--color-accent)] font-medium text-[var(--color-text-primary)]"
                : "border-transparent text-[var(--color-text-muted)] hover:text-[var(--color-text-secondary)]"
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {vista === "estado" && (
        <>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-6">
            <KpiCard label="Con problema" value={conProblema} tone="text-red-400" />
            <KpiCard label="Sin comunicación" value={k?.sinComunicacion ?? 0} tone="text-amber-400" />
            <KpiCard label="Falla de equipo" value={k?.errorDispositivo ?? 0} tone="text-red-400" />
            <KpiCard label="Funcionando" value={k?.ok ?? 0} tone="text-emerald-400" />
            <KpiCard label="Esperando habilitación" value={k?.esperandoHabilitacion ?? 0} />
            <KpiCard
              label="Sin revisar"
              value={k?.sinRevisar ?? 0}
              tone="text-blue-400"
              activo={soloSinRevisar}
              onClick={() => setSoloSinRevisar((v) => !v)}
            />
          </div>

          <div className="space-y-2 rounded-xl border border-[var(--color-border)] bg-[var(--color-bg-card)] p-3">
            <div className="flex flex-wrap items-center gap-3">
              <div className="relative">
                <Search className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--color-text-muted)]" />
                <input
                  value={busqueda}
                  onChange={(e) => setBusqueda(e.target.value)}
                  placeholder="Buscar cliente o planta…"
                  className="w-56 rounded-lg border border-[var(--color-border)] bg-[var(--color-bg-app)] py-1.5 pl-8 pr-2 text-sm text-[var(--color-text-primary)]"
                />
              </div>
              <label className="flex items-center gap-1.5 text-[11px] text-[var(--color-text-muted)]">
                <span className="font-mono uppercase tracking-wider">Silenciadas</span>
                <select
                  value={silencio}
                  onChange={(e) => setSilencio(e.target.value as FiltroSilencio)}
                  className="rounded-lg border border-[var(--color-border)] bg-[var(--color-bg-app)] px-2 py-1 text-sm text-[var(--color-text-primary)]"
                >
                  <option value="mostrar">Mostrar</option>
                  <option value="ocultar">Ocultar</option>
                  <option value="solo">Sólo silenciadas</option>
                </select>
              </label>
            </div>

            <div className="flex flex-wrap gap-1.5">
              {DIAGNOSTICO_ORDER.map((d) => (
                <button
                  key={d}
                  onClick={() => toggleDiagnostico(d)}
                  className={`rounded px-2 py-0.5 font-mono text-[10px] uppercase transition-opacity ${
                    DIAGNOSTICO_BADGE[d]
                  } ${diagnosticos.size > 0 && !diagnosticos.has(d) ? "opacity-40" : ""}`}
                >
                  {DIAGNOSTICO_LABEL[d]}
                </button>
              ))}
            </div>

            <div className="flex items-center gap-3 text-[11px] text-[var(--color-text-muted)]">
              <span>
                Mostrando {filtradas.length} de {plantas.length}
              </span>
              {(busqueda || diagnosticos.size > 0 || silencio !== "mostrar" || soloSinRevisar) && (
                <button onClick={limpiar} className="underline hover:text-[var(--color-text-secondary)]">
                  Limpiar filtros
                </button>
              )}
            </div>
          </div>

          <ResponsiveTable
            columns={columnas}
            data={filtradas}
            rowKey={(r) => r.growattPlantId}
            onRowClick={(r) => setSeleccionada(r)}
            dense
            stickyHeader
            emptyMessage="No hay plantas que coincidan con el filtro."
          />
        </>
      )}

      {vista === "historial" && (
        <div className="overflow-x-auto rounded-xl border border-[var(--color-border)]">
          <table className="w-full text-sm">
            <thead className="bg-[var(--color-bg-card)] text-[11px] uppercase tracking-wider text-[var(--color-text-muted)]">
              <tr>
                <th className="px-3 py-2 text-left">Cliente</th>
                <th className="px-3 py-2 text-left">Problema</th>
                <th className="px-3 py-2 text-left">Desde</th>
                <th className="px-3 py-2 text-left">Hasta</th>
                <th className="px-3 py-2 text-right">Días</th>
                <th className="px-3 py-2 text-left">Estado</th>
                <th className="px-3 py-2 text-left">Nota</th>
              </tr>
            </thead>
            <tbody>
              {(incidencias ?? []).map((i) => (
                <tr key={i.id} className="border-t border-[var(--color-border)]">
                  <td className="px-3 py-2">{i.clientName ?? i.plantName}</td>
                  <td className="px-3 py-2">
                    <span
                      className={`inline-block rounded px-2 py-0.5 font-mono text-[10px] uppercase ${DIAGNOSTICO_BADGE[i.diagnostico]}`}
                    >
                      {DIAGNOSTICO_LABEL[i.diagnostico]}
                    </span>
                  </td>
                  <td className="px-3 py-2">{fechaCorta(i.primeraDeteccionEn)}</td>
                  <td className="px-3 py-2">{i.resueltaEn ? fechaCorta(i.resueltaEn) : "—"}</td>
                  <td className="px-3 py-2 text-right">{i.diasAfectados}</td>
                  <td className="px-3 py-2 text-[var(--color-text-muted)]">
                    {i.estado === "ABIERTA" ? "Abierta" : i.estado === "RESUELTA" ? "Resuelta" : "Descartada"}
                  </td>
                  <td className="px-3 py-2 text-[11px] text-[var(--color-text-muted)]">{i.nota ?? "—"}</td>
                </tr>
              ))}
              {(incidencias ?? []).length === 0 && (
                <tr>
                  <td colSpan={7} className="px-3 py-6 text-center text-[var(--color-text-muted)]">
                    Todavía no hay incidencias registradas.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      {vista === "corridas" && (
        <div className="overflow-x-auto rounded-xl border border-[var(--color-border)]">
          <table className="w-full text-sm">
            <thead className="bg-[var(--color-bg-card)] text-[11px] uppercase tracking-wider text-[var(--color-text-muted)]">
              <tr>
                <th className="px-3 py-2 text-left">Día revisado</th>
                <th className="px-3 py-2 text-left">Origen</th>
                <th className="px-3 py-2 text-left">Resultado</th>
                <th className="px-3 py-2 text-right">Plantas</th>
                <th className="px-3 py-2 text-right">Sin consultar</th>
                <th className="px-3 py-2 text-right">Nuevas</th>
                <th className="px-3 py-2 text-right">Resueltas</th>
                <th className="px-3 py-2 text-left">Mail</th>
              </tr>
            </thead>
            <tbody>
              {(corridas ?? []).map((c) => (
                <tr key={c.id} className="border-t border-[var(--color-border)]">
                  <td className="px-3 py-2">{fechaCorta(c.fecha)}</td>
                  <td className="px-3 py-2 text-[var(--color-text-muted)]">
                    {c.modo === "CRON" ? "Automática" : "Manual"}
                  </td>
                  <td className="px-3 py-2">
                    {c.estado === "OK" ? "Completa" : c.estado === "PARCIAL" ? "Parcial" : c.estado === "ERROR" ? "Falló" : "En curso"}
                  </td>
                  <td className="px-3 py-2 text-right">{c.plantasTotal}</td>
                  <td className="px-3 py-2 text-right">{c.plantasError}</td>
                  <td className="px-3 py-2 text-right">{c.incidenciasAbiertas}</td>
                  <td className="px-3 py-2 text-right">{c.incidenciasCerradas}</td>
                  <td className="px-3 py-2 text-[var(--color-text-muted)]">{c.emailEnviado ? "Enviado" : "—"}</td>
                </tr>
              ))}
              {(corridas ?? []).length === 0 && (
                <tr>
                  <td colSpan={8} className="px-3 py-6 text-center text-[var(--color-text-muted)]">
                    Todavía no corrió ninguna revisión.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      {seleccionada && (
        <MonitorPlantaDrawer planta={seleccionada} onClose={() => setSeleccionada(null)} />
      )}
    </div>
  );
}

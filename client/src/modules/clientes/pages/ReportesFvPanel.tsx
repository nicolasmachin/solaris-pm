import { useEffect, useMemo, useRef, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { AlertTriangle, Download, FileText, Search, Send } from "lucide-react";
import toast from "react-hot-toast";

import { usePermission } from "../../../hooks/usePermission";
import { ResponsiveTable, type Column } from "../../../components/ui/ResponsiveTable";
import { Spinner } from "../../../components/ui/Spinner";
import {
  dispararIngesta,
  getIngesta,
  getPanel,
  getPeriodos,
  type EstadoGenerador,
  type FilaPanel,
} from "../../../api/reportesFv.api";
import { ReporteFvDetalle } from "../components/ReporteFvDetalle";
import { PlantasGrowattModal } from "../components/PlantasGrowattModal";

// El semáforo de estados: mismo patrón de tokens que el resto del módulo.
const ESTADO_BADGE: Record<EstadoGenerador, string> = {
  SIN_ALTA: "bg-[var(--color-border)] text-[var(--color-text-muted)]",
  DESHABILITADO: "bg-[var(--color-border)] text-[var(--color-text-muted)]",
  BLOQUEADO: "bg-red-500/15 text-red-400 border border-red-500/30",
  SIN_LECTURA: "bg-amber-500/15 text-amber-400 border border-amber-500/30",
  LECTURA_INCOMPLETA: "bg-amber-500/15 text-amber-400 border border-amber-500/30",
  CALCULADO: "bg-blue-500/15 text-blue-400 border border-blue-500/30",
  PDF_LISTO: "bg-emerald-500/15 text-emerald-400 border border-emerald-500/30",
  ENVIADO: "bg-emerald-600/20 text-emerald-300 border border-emerald-600/40",
};

const ESTADO_LABEL: Record<EstadoGenerador, string> = {
  SIN_ALTA: "Sin alta",
  DESHABILITADO: "Deshabilitado",
  BLOQUEADO: "Bloqueado",
  SIN_LECTURA: "Sin lectura",
  LECTURA_INCOMPLETA: "Datos incompletos",
  CALCULADO: "Calculado",
  PDF_LISTO: "PDF listo",
  ENVIADO: "Enviado",
};

const fmtKwh = (v: number | null) =>
  v == null ? "—" : `${new Intl.NumberFormat("es-UY", { maximumFractionDigits: 0 }).format(v)}`;
const fmtPesos = (v: number | null) =>
  v == null ? "—" : `$${new Intl.NumberFormat("es-UY", { maximumFractionDigits: 0 }).format(v)}`;

function KpiCard({ label, value, tone }: { label: string; value: number; tone?: string }) {
  return (
    <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-bg-card)] p-3">
      <div className="font-mono text-[10px] uppercase tracking-wider text-[var(--color-text-muted)]">{label}</div>
      <div className={`mt-0.5 font-display text-2xl font-bold ${tone ?? "text-[var(--color-text-primary)]"}`}>
        {value}
      </div>
    </div>
  );
}

export function ReportesFvPanel() {
  const canView = usePermission("EXPERIENCIA_CLIENTES", "VIEW");
  const canCreate = usePermission("EXPERIENCIA_CLIENTES", "CREATE");
  const qc = useQueryClient();
  const [periodo, setPeriodo] = useState<string>("");
  const [search, setSearch] = useState("");
  const [soloConProblemas, setSoloConProblemas] = useState(false);
  const [detalleId, setDetalleId] = useState<string | null>(null);
  const [plantasAbierto, setPlantasAbierto] = useState(false);
  const [ingestaId, setIngestaId] = useState<string | null>(null);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const { data: periodos = [] } = useQuery({
    queryKey: ["reportes-fv", "periodos"],
    queryFn: getPeriodos,
    enabled: canView,
  });

  // El periodo por defecto es el primero disponible (el más reciente).
  const periodoActivo = periodo || periodos[0] || "";

  const { data: panel, isLoading } = useQuery({
    queryKey: ["reportes-fv", "panel", periodoActivo],
    queryFn: () => getPanel(periodoActivo),
    enabled: canView && Boolean(periodoActivo),
  });

  // Ingesta: dispara y hace polling del progreso hasta que termina.
  const [ingestaProgreso, setIngestaProgreso] = useState<string | null>(null);
  useEffect(() => {
    if (!ingestaId) return;
    pollRef.current = setInterval(async () => {
      const i = await getIngesta(ingestaId);
      setIngestaProgreso(`${i.plantasOk + i.plantasError}/${i.plantasTotal} plantas`);
      if (i.estado !== "EN_CURSO") {
        if (pollRef.current) clearInterval(pollRef.current);
        setIngestaId(null);
        setIngestaProgreso(null);
        const detalle = i.plantasError > 0 ? ` (${i.plantasError} con error)` : "";
        if (i.estado === "OK") toast.success(`Ingesta completa: ${i.plantasOk} plantas`);
        else if (i.estado === "PARCIAL") toast.success(`Ingesta parcial: ${i.plantasOk} ok${detalle}`);
        else toast.error(`Ingesta con error${i.errorMessage ? `: ${i.errorMessage}` : detalle}`);
        qc.invalidateQueries({ queryKey: ["reportes-fv", "panel"] });
      }
    }, 3000);
    return () => {
      if (pollRef.current) clearInterval(pollRef.current);
    };
  }, [ingestaId, qc]);

  async function iniciarIngesta() {
    try {
      const { ingestaId: id } = await dispararIngesta(periodoActivo);
      setIngestaId(id);
      setIngestaProgreso("iniciando…");
      toast.success("Ingesta iniciada — trayendo datos de Growatt");
    } catch (e: any) {
      toast.error(e?.response?.data?.message ?? "No se pudo iniciar la ingesta");
    }
  }

  const generadores = useMemo(() => {
    let items = panel?.generadores ?? [];
    const q = search.trim().toLowerCase();
    if (q) items = items.filter((g) => g.clientName.toLowerCase().includes(q));
    if (soloConProblemas) {
      items = items.filter(
        (g) =>
          g.estado === "BLOQUEADO" ||
          g.estado === "SIN_LECTURA" ||
          g.estado === "LECTURA_INCOMPLETA" ||
          g.potenciaEstimada ||
          (g.dadoDeAlta && g.habilitado && !g.tieneDestinatario),
      );
    }
    return items;
  }, [panel, search, soloConProblemas]);

  const columns: Column<FilaPanel>[] = [
    {
      key: "clientName",
      label: "Generador",
      cardRole: "title",
      render: (g) => (
        <div className="flex items-center gap-2">
          <span className="font-medium text-[var(--color-text-primary)]">{g.clientName}</span>
          {!g.dadoDeAlta && (
            <span className="rounded bg-[var(--color-border)] px-1.5 py-0.5 font-mono text-[9px] uppercase text-[var(--color-text-muted)]">
              sin alta
            </span>
          )}
          {g.origenDatos === "MANUAL" && (
            <span className="rounded bg-[var(--color-accent)]/10 px-1.5 py-0.5 font-mono text-[9px] uppercase text-[var(--color-accent)]">
              manual
            </span>
          )}
        </div>
      ),
    },
    {
      key: "estado",
      label: "Estado",
      render: (g) => (
        <span
          className={`inline-block rounded px-2 py-0.5 font-mono text-[10px] uppercase ${ESTADO_BADGE[g.estado]}`}
        >
          {ESTADO_LABEL[g.estado]}
        </span>
      ),
    },
    { key: "gen", label: "Generación", className: "tabular-nums", render: (g) => fmtKwh(g.generacionKwh) },
    { key: "cons", label: "Consumo", className: "tabular-nums", render: (g) => fmtKwh(g.consumoKwh) },
    { key: "exp", label: "Exportación", className: "tabular-nums", render: (g) => fmtKwh(g.exportacionKwh) },
    {
      key: "ahorro",
      label: "Ahorro mes",
      cardRole: "highlight",
      className: "tabular-nums",
      render: (g) => fmtPesos(g.ahorroTotal),
    },
    {
      key: "flags",
      label: "",
      render: (g) => (
        <div className="flex items-center gap-1.5">
          {g.potenciaEstimada && (
            <span title="Potencia contratada estimada">
              <AlertTriangle size={13} className="text-amber-400" />
            </span>
          )}
          {g.emisionId && (
            <span title={`PDF v${g.emisionVersion}`}>
              <FileText size={13} className="text-emerald-400" />
            </span>
          )}
          {g.enviado && (
            <span title="Enviado">
              <Send size={13} className="text-emerald-300" />
            </span>
          )}
        </div>
      ),
    },
  ];

  if (!canView) return null;

  return (
    <div className="space-y-4">
      {/* Controles */}
      <div className="flex flex-wrap items-center gap-3">
        <div>
          <label className="mr-2 font-mono text-[11px] uppercase tracking-wider text-[var(--color-text-muted)]">
            Periodo
          </label>
          <select
            value={periodoActivo}
            onChange={(e) => setPeriodo(e.target.value)}
            className="rounded-lg border border-[var(--color-border)] bg-[var(--color-bg-app)] px-3 py-1.5 text-sm text-[var(--color-text-primary)]"
          >
            {periodos.map((p) => (
              <option key={p} value={p}>
                {p}
              </option>
            ))}
          </select>
        </div>

        <div className="relative flex-1 min-w-[180px] max-w-xs">
          <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-[var(--color-text-muted)]" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Buscar generador…"
            className="w-full rounded-lg border border-[var(--color-border)] bg-[var(--color-bg-app)] py-1.5 pl-8 pr-3 text-sm text-[var(--color-text-primary)]"
          />
        </div>

        <label className="flex items-center gap-1.5 text-sm text-[var(--color-text-secondary)]">
          <input
            type="checkbox"
            checked={soloConProblemas}
            onChange={(e) => setSoloConProblemas(e.target.checked)}
          />
          Solo con pendientes
        </label>

        {canCreate && (
          <div className="ml-auto flex items-center gap-2">
            {ingestaProgreso && (
              <span className="flex items-center gap-1.5 text-xs text-[var(--color-text-muted)]">
                <Spinner size={13} /> {ingestaProgreso}
              </span>
            )}
            <button
              type="button"
              onClick={() => setPlantasAbierto(true)}
              className="rounded-lg border border-[var(--color-border)] px-3 py-1.5 text-sm text-[var(--color-text-secondary)]"
            >
              Plantas Growatt
            </button>
            <button
              type="button"
              disabled={Boolean(ingestaId)}
              onClick={iniciarIngesta}
              className="flex items-center gap-1.5 rounded-lg bg-[var(--color-accent)] px-3 py-1.5 text-sm font-medium text-white disabled:opacity-50"
            >
              <Download size={14} /> Traer datos de Growatt
            </button>
          </div>
        )}
      </div>

      {/* KPIs */}
      {panel && (
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4 lg:grid-cols-7">
          <KpiCard label="Generadores" value={panel.kpis.total} />
          <KpiCard label="Dados de alta" value={panel.kpis.dadosDeAlta} />
          <KpiCard label="Sin alta" value={panel.kpis.sinAlta} tone={panel.kpis.sinAlta > 0 ? "text-[var(--color-text-muted)]" : undefined} />
          <KpiCard label="Con datos" value={panel.kpis.conLecturaCompleta} />
          <KpiCard label="Calculados" value={panel.kpis.calculados} tone="text-blue-400" />
          <KpiCard label="PDF listos" value={panel.kpis.pdfListos} tone="text-emerald-400" />
          <KpiCard label="Enviados" value={panel.kpis.enviados} tone="text-emerald-300" />
        </div>
      )}

      {/* Tabla */}
      {isLoading ? (
        <Spinner />
      ) : (
        <div className="overflow-hidden rounded-xl border border-[var(--color-border)] bg-[var(--color-bg-card)]">
          <div className="max-h-[calc(100vh-24rem)] overflow-auto">
            <ResponsiveTable
              columns={columns}
              data={generadores}
              rowKey={(g) => g.projectId}
              onRowClick={(g) => setDetalleId(g.projectId)}
              rowClickableOnDesktop
              stickyHeader
              emptyMessage="Ningún generador coincide con el filtro."
            />
          </div>
        </div>
      )}

      {detalleId && (
        <ReporteFvDetalle
          projectId={detalleId}
          periodo={periodoActivo}
          onClose={() => setDetalleId(null)}
        />
      )}

      {plantasAbierto && <PlantasGrowattModal onClose={() => setPlantasAbierto(false)} />}
    </div>
  );
}

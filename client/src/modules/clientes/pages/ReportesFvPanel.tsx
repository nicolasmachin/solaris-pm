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
import { ManualReportesFvButton } from "../components/ManualReportesFvButton";

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

// Orden de los estados en la fila de chips (de "peor" a "mejor").
const ESTADO_ORDER: EstadoGenerador[] = [
  "SIN_ALTA",
  "DESHABILITADO",
  "BLOQUEADO",
  "SIN_LECTURA",
  "LECTURA_INCOMPLETA",
  "CALCULADO",
  "PDF_LISTO",
  "ENVIADO",
];

function FiltroSelect<T extends string>({
  label,
  value,
  onChange,
  options,
}: {
  label: string;
  value: T;
  onChange: (v: T) => void;
  options: { value: T; label: string }[];
}) {
  return (
    <label className="flex items-center gap-1.5 text-[11px] text-[var(--color-text-muted)]">
      <span className="font-mono uppercase tracking-wider">{label}</span>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value as T)}
        className="rounded-lg border border-[var(--color-border)] bg-[var(--color-bg-app)] px-2 py-1 text-sm text-[var(--color-text-primary)]"
      >
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
    </label>
  );
}

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
  const [estados, setEstados] = useState<Set<EstadoGenerador>>(new Set());
  const [alta, setAlta] = useState<"todos" | "alta" | "sin_alta">("todos");
  const [origen, setOrigen] = useState<"todos" | "GROWATT" | "MANUAL">("todos");
  const [tipo, setTipo] = useState<"todos" | "residencial" | "empresa">("todos");
  const [envio, setEnvio] = useState<"todos" | "enviados" | "pendientes">("todos");
  const [pdf, setPdf] = useState<"todos" | "con" | "sin">("todos");
  const [soloPotenciaEstimada, setSoloPotenciaEstimada] = useState(false);
  const [soloSinDestinatario, setSoloSinDestinatario] = useState(false);
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

  // Por defecto se saltean los generadores que ya tienen la lectura completa del
  // mes: no tiene sentido volver a preguntarle a Growatt algo que ya está, y el
  // rate limit de su API es ajustado. Con `force` se re-consulta todo, que es lo
  // que hace falta cuando se sospecha que un dato quedó mal.
  async function iniciarIngesta(force = false) {
    try {
      const { ingestaId: id } = await dispararIngesta(periodoActivo, { force });
      setIngestaId(id);
      setIngestaProgreso("iniciando…");
      toast.success(
        force
          ? "Trayendo todo de nuevo desde Growatt"
          : "Trayendo de Growatt lo que falta del mes",
      );
    } catch (e: any) {
      toast.error(e?.response?.data?.message ?? "No se pudo iniciar la ingesta");
    }
  }

  const total = panel?.generadores.length ?? 0;

  const generadores = useMemo(() => {
    let items = panel?.generadores ?? [];
    const q = search.trim().toLowerCase();
    if (q) items = items.filter((g) => g.clientName.toLowerCase().includes(q));
    if (estados.size) items = items.filter((g) => estados.has(g.estado));
    if (alta === "alta") items = items.filter((g) => g.dadoDeAlta);
    else if (alta === "sin_alta") items = items.filter((g) => !g.dadoDeAlta);
    if (origen !== "todos") items = items.filter((g) => g.origenDatos === origen);
    if (tipo !== "todos") items = items.filter((g) => g.tipoCliente === tipo);
    if (envio === "enviados") items = items.filter((g) => g.enviado);
    else if (envio === "pendientes") items = items.filter((g) => !g.enviado);
    if (pdf === "con") items = items.filter((g) => g.emisionId != null);
    else if (pdf === "sin") items = items.filter((g) => g.emisionId == null);
    if (soloPotenciaEstimada) items = items.filter((g) => g.potenciaEstimada);
    if (soloSinDestinatario)
      items = items.filter((g) => g.dadoDeAlta && g.habilitado && !g.tieneDestinatario);
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
  }, [
    panel,
    search,
    estados,
    alta,
    origen,
    tipo,
    envio,
    pdf,
    soloPotenciaEstimada,
    soloSinDestinatario,
    soloConProblemas,
  ]);

  const hayFiltros =
    Boolean(search) ||
    estados.size > 0 ||
    alta !== "todos" ||
    origen !== "todos" ||
    tipo !== "todos" ||
    envio !== "todos" ||
    pdf !== "todos" ||
    soloPotenciaEstimada ||
    soloSinDestinatario ||
    soloConProblemas;

  function limpiarFiltros() {
    setSearch("");
    setEstados(new Set());
    setAlta("todos");
    setOrigen("todos");
    setTipo("todos");
    setEnvio("todos");
    setPdf("todos");
    setSoloPotenciaEstimada(false);
    setSoloSinDestinatario(false);
    setSoloConProblemas(false);
  }

  function toggleEstado(e: EstadoGenerador) {
    setEstados((prev) => {
      const next = new Set(prev);
      if (next.has(e)) next.delete(e);
      else next.add(e);
      return next;
    });
  }

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
      {/* Encabezado + manual */}
      <div className="flex items-center justify-between">
        <p className="text-sm text-[var(--color-text-muted)]">
          Gestión de los reportes mensuales de generación de cada cliente.
        </p>
        <ManualReportesFvButton />
      </div>

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
              onClick={() => iniciarIngesta(false)}
              title="Trae de Growatt sólo los generadores a los que les falta algún dato del mes"
              className="flex items-center gap-1.5 rounded-lg bg-[var(--color-accent)] px-3 py-1.5 text-sm font-medium text-white disabled:opacity-50"
            >
              <Download size={14} /> Traer datos de Growatt
            </button>
            <button
              type="button"
              disabled={Boolean(ingestaId)}
              onClick={() => iniciarIngesta(true)}
              title="Vuelve a consultar TODOS los generadores, incluso los que ya tienen la lectura completa. Tarda bastante más."
              className="rounded-lg border border-[var(--color-border)] px-3 py-1.5 text-sm text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)] disabled:opacity-50"
            >
              Traer todo de nuevo
            </button>
          </div>
        )}
      </div>

      {/* El salteo de los ya completos es deliberado, pero invisible: sin este
          aviso, "trajo 14 de 57" parece un error y no una optimización. */}
      <p className="text-[11px] text-[var(--color-text-muted)]">
        "Traer datos de Growatt" consulta sólo los generadores a los que les falta algún dato del mes
        elegido; los que ya están completos se saltean para no gastar consultas de más. Si necesitás
        rehacer un mes entero, usá "Traer todo de nuevo".
      </p>

      {/* Filtros */}
      <div className="space-y-2 rounded-xl border border-[var(--color-border)] bg-[var(--color-bg-card)] p-3">
        <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
          <FiltroSelect
            label="Alta"
            value={alta}
            onChange={setAlta}
            options={[
              { value: "todos", label: "Todas" },
              { value: "alta", label: "Dados de alta" },
              { value: "sin_alta", label: "Sin alta" },
            ]}
          />
          <FiltroSelect
            label="Origen"
            value={origen}
            onChange={setOrigen}
            options={[
              { value: "todos", label: "Todos" },
              { value: "GROWATT", label: "Growatt" },
              { value: "MANUAL", label: "Manual" },
            ]}
          />
          <FiltroSelect
            label="Tipo"
            value={tipo}
            onChange={setTipo}
            options={[
              { value: "todos", label: "Todos" },
              { value: "residencial", label: "Residencial" },
              { value: "empresa", label: "Empresa" },
            ]}
          />
          <FiltroSelect
            label="Envío"
            value={envio}
            onChange={setEnvio}
            options={[
              { value: "todos", label: "Todos" },
              { value: "enviados", label: "Enviados" },
              { value: "pendientes", label: "Pendientes" },
            ]}
          />
          <FiltroSelect
            label="PDF"
            value={pdf}
            onChange={setPdf}
            options={[
              { value: "todos", label: "Todos" },
              { value: "con", label: "Con PDF" },
              { value: "sin", label: "Sin PDF" },
            ]}
          />
          <label className="flex items-center gap-1.5 text-sm text-[var(--color-text-secondary)]">
            <input
              type="checkbox"
              checked={soloPotenciaEstimada}
              onChange={(e) => setSoloPotenciaEstimada(e.target.checked)}
            />
            Potencia estimada
          </label>
          <label className="flex items-center gap-1.5 text-sm text-[var(--color-text-secondary)]">
            <input
              type="checkbox"
              checked={soloSinDestinatario}
              onChange={(e) => setSoloSinDestinatario(e.target.checked)}
            />
            Sin destinatario
          </label>
          <label className="flex items-center gap-1.5 text-sm text-[var(--color-text-secondary)]">
            <input
              type="checkbox"
              checked={soloConProblemas}
              onChange={(e) => setSoloConProblemas(e.target.checked)}
            />
            Con pendientes
          </label>
        </div>

        {/* Chips de estado (multi-selección) */}
        <div className="flex flex-wrap items-center gap-1.5">
          <span className="mr-1 font-mono text-[11px] uppercase tracking-wider text-[var(--color-text-muted)]">
            Estado
          </span>
          {ESTADO_ORDER.map((e) => {
            const activo = estados.has(e);
            return (
              <button
                key={e}
                type="button"
                onClick={() => toggleEstado(e)}
                className={`rounded px-2 py-0.5 font-mono text-[10px] uppercase transition ${
                  activo
                    ? ESTADO_BADGE[e]
                    : "border border-[var(--color-border)] text-[var(--color-text-muted)] opacity-60 hover:opacity-100"
                }`}
              >
                {ESTADO_LABEL[e]}
              </button>
            );
          })}
        </div>

        <div className="flex items-center justify-between pt-0.5">
          <span className="text-xs text-[var(--color-text-muted)]">
            Mostrando <strong className="text-[var(--color-text-secondary)]">{generadores.length}</strong> de{" "}
            {total}
          </span>
          {hayFiltros && (
            <button
              type="button"
              onClick={limpiarFiltros}
              className="text-xs text-[var(--color-accent)] hover:underline"
            >
              Limpiar filtros
            </button>
          )}
        </div>
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

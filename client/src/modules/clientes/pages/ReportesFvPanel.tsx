import { useEffect, useMemo, useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { AlertTriangle, Check, Download, FileText, Search, Send, X } from "lucide-react";
import toast from "react-hot-toast";

import { usePermission } from "../../../hooks/usePermission";
import { ResponsiveTable, type Column } from "../../../components/ui/ResponsiveTable";
import { Spinner } from "../../../components/ui/Spinner";
import {
  dispararIngesta,
  emitirLote,
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

/**
 * Filtro de dos o más opciones excluyentes, como botones que se prenden y
 * apagan. Volver a apretar el que está activo lo apaga y muestra todo.
 *
 * Se prefirió esto a un desplegable porque deja **ver todas las opciones sin
 * abrir nada**: de un vistazo se sabe qué se puede filtrar y qué está filtrado.
 * Con selects había que abrir cinco menús para entender el estado del listado.
 */
function ToggleFiltro<T extends string>({
  label,
  value,
  onChange,
  options,
  todos,
}: {
  label: string;
  value: T;
  onChange: (v: T) => void;
  options: { value: T; label: string }[];
  /** Valor que significa "sin filtrar". */
  todos: T;
}) {
  return (
    <div className="flex min-w-[7.5rem] flex-col gap-1">
      <span className="font-mono text-[10px] uppercase tracking-wider text-[var(--color-text-muted)]">
        {label}
      </span>
      {options.map((o) => {
        const activo = value === o.value;
        return (
          <button
            key={o.value}
            type="button"
            aria-pressed={activo}
            onClick={() => onChange(activo ? todos : o.value)}
            className={`rounded px-2 py-0.5 text-left text-[11px] transition ${
              activo
                ? "bg-[var(--color-accent)] font-medium text-gray-900"
                : "border border-[var(--color-border)] text-[var(--color-text-muted)] hover:text-[var(--color-text-secondary)]"
            }`}
          >
            {o.label}
          </button>
        );
      })}
    </div>
  );
}

/**
 * Cómo se ordena cada columna. Los booleanos se comparan como número (false=0),
 * así que ascendente deja arriba los "no" — que suele ser lo que se busca:
 * "mostrame los que todavía NO tienen PDF".
 *
 * El estado no se ordena alfabéticamente sino por avance del proceso, que es lo
 * que uno espera al hacer clic: de lo más atrasado a lo más terminado.
 */
const VALOR_ORDEN: Record<string, (g: FilaPanel) => string | number | boolean | null> = {
  clientName: (g) => g.clientName,
  estado: (g) => ESTADO_ORDER.indexOf(g.estado),
  f_habilitado: (g) => g.habilitado,
  f_alta: (g) => g.dadoDeAlta,
  f_calculado: (g) => g.ahorroTotal != null,
  f_pdf: (g) => g.emisionId != null,
  f_enviado: (g) => g.enviado,
  gen: (g) => g.generacionKwh,
  cons: (g) => g.consumoKwh,
  exp: (g) => g.exportacionKwh,
  ahorro: (g) => g.ahorroTotal,
};

/** Tick verde o cruz roja. El title da el detalle sin ocupar lugar en la tabla. */
function SiNo({ v, titulo }: { v: boolean; titulo?: string }) {
  return (
    <span title={titulo ?? (v ? "Sí" : "No")} aria-label={v ? "Sí" : "No"}>
      {v ? (
        <Check size={15} className="mx-auto text-emerald-400" />
      ) : (
        <X size={15} className="mx-auto text-red-400/70" />
      )}
    </span>
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
  const [origen, setOrigen] = useState<"todos" | "GROWATT" | "HUAWEI" | "MANUAL">("todos");
  const [tipo, setTipo] = useState<"todos" | "residencial" | "empresa">("todos");
  const [envio, setEnvio] = useState<"todos" | "enviados" | "pendientes">("todos");
  const [pdf, setPdf] = useState<"todos" | "con" | "sin">("todos");
  const [habilitado, setHabilitado] = useState<"todos" | "si" | "no">("todos");
  const [lectura, setLectura] = useState<"todos" | "completa" | "incompleta" | "sin">("todos");
  const [calculo, setCalculo] = useState<"todos" | "si" | "no">("todos");
  const [soloBloqueados, setSoloBloqueados] = useState(false);
  const [soloPotenciaEstimada, setSoloPotenciaEstimada] = useState(false);
  const [soloSinDestinatario, setSoloSinDestinatario] = useState(false);
  const [orden, setOrden] = useState<{ key: string; dir: "asc" | "desc" } | null>(null);
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
          ? "Trayendo todo de nuevo desde Growatt y Huawei"
          : "Trayendo de Growatt y Huawei lo que falta del mes",
      );
    } catch (e: any) {
      toast.error(e?.response?.data?.message ?? "No se pudo iniciar la ingesta");
    }
  }

  // Generar los PDF de a uno con 57 generadores no es viable. Este botón usa la
  // misma lógica que el cron mensual: saltea los que tienen la configuración
  // incompleta o les falta la lectura del mes, y reporta qué pasó con cada grupo
  // en vez de fallar en silencio.
  const emitirTodos = useMutation({
    mutationFn: () => emitirLote(periodoActivo),
    onSuccess: (r) => {
      const partes = [
        r.generados ? `${r.generados} generados` : null,
        r.yaEmitidos ? `${r.yaEmitidos} ya tenían PDF` : null,
        r.esperandoDatos ? `${r.esperandoDatos} sin datos del mes` : null,
        r.bloqueados ? `${r.bloqueados} con configuración incompleta` : null,
        r.errores ? `${r.errores} con error` : null,
      ].filter(Boolean);
      if (r.generados > 0) toast.success(`PDF: ${partes.join(" · ")}`, { duration: 6000 });
      else toast(`No se generó ninguno: ${partes.join(" · ") || "nada pendiente"}`, { duration: 6000 });
      qc.invalidateQueries({ queryKey: ["reportes-fv", "panel"] });
    },
    onError: (e: any) => toast.error(e?.response?.data?.message ?? "No se pudieron generar los PDF"),
  });

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
    if (habilitado === "si") items = items.filter((g) => g.habilitado);
    else if (habilitado === "no") items = items.filter((g) => !g.habilitado);
    if (lectura === "completa") items = items.filter((g) => g.lecturaCompleta);
    else if (lectura === "incompleta")
      items = items.filter((g) => !g.lecturaCompleta && g.generacionKwh != null);
    else if (lectura === "sin") items = items.filter((g) => g.generacionKwh == null);
    if (calculo === "si") items = items.filter((g) => g.ahorroTotal != null);
    else if (calculo === "no") items = items.filter((g) => g.ahorroTotal == null);
    if (pdf === "con") items = items.filter((g) => g.emisionId != null);
    else if (pdf === "sin") items = items.filter((g) => g.emisionId == null);
    if (soloBloqueados) items = items.filter((g) => g.estado === "BLOQUEADO");
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

    if (orden) {
      const valor = VALOR_ORDEN[orden.key];
      if (valor) {
        const signo = orden.dir === "asc" ? 1 : -1;
        items = [...items].sort((a, b) => {
          const x = valor(a);
          const y = valor(b);
          // Los vacíos van siempre al final, ordene como ordene: un generador
          // sin ahorro no es "el que menos ahorró", es uno del que no se sabe.
          if (x == null && y == null) return 0;
          if (x == null) return 1;
          if (y == null) return -1;
          if (typeof x === "string" && typeof y === "string") {
            return x.localeCompare(y, "es", { sensitivity: "base" }) * signo;
          }
          return (Number(x) - Number(y)) * signo;
        });
      }
    }

    return items;
  }, [
    orden,
    soloBloqueados,
    habilitado,
    lectura,
    calculo,
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
    setSoloBloqueados(false);
    setHabilitado("todos");
    setLectura("todos");
    setCalculo("todos");
    setOrden(null);
  }

  function toggleEstado(e: EstadoGenerador) {
    setEstados((prev) => {
      const next = new Set(prev);
      if (next.has(e)) next.delete(e);
      else next.add(e);
      return next;
    });
  }

  // Un clic ordena ascendente, el segundo invierte, el tercero vuelve al orden
  // natural (alfabético por generador). Sin esa tercera vuelta no hay forma de
  // deshacer un orden sin recargar la página.
  function ordenarPor(key: string) {
    if (orden?.key !== key) return setOrden({ key, dir: "asc" });
    if (orden.dir === "asc") return setOrden({ key, dir: "desc" });
    return setOrden(null);
  }

  const columns: Column<FilaPanel>[] = [
    {
      key: "clientName",
      sortable: true,
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
      sortable: true,
      label: "Estado",
      render: (g) => (
        <span
          className={`inline-block rounded px-2 py-0.5 font-mono text-[10px] uppercase ${ESTADO_BADGE[g.estado]}`}
        >
          {ESTADO_LABEL[g.estado]}
        </span>
      ),
    },
    // Las cinco condiciones del generador, cada una en su columna. El badge de
    // Estado resume la situación en una palabra, pero al resumir esconde el
    // detalle: un "Sin lectura" no dice si además está dado de alta o si ya se
    // le mandó algo el mes pasado. Acá se ve todo de un vistazo.
    { key: "f_habilitado", sortable: true, label: "Habilitado", align: "center", cardRole: "hidden", render: (g) => <SiNo v={g.habilitado} /> },
    { key: "f_alta", sortable: true, label: "De alta", align: "center", cardRole: "hidden", render: (g) => <SiNo v={g.dadoDeAlta} /> },
    {
      key: "f_calculado",
      sortable: true,
      label: "Calculado",
      align: "center",
      cardRole: "hidden",
      render: (g) => <SiNo v={g.ahorroTotal != null} />,
    },
    {
      key: "f_pdf",
      sortable: true,
      label: "PDF",
      align: "center",
      cardRole: "hidden",
      render: (g) => <SiNo v={Boolean(g.emisionId)} titulo={g.emisionVersion ? `PDF v${g.emisionVersion}` : undefined} />,
    },
    { key: "f_enviado", sortable: true, label: "Enviado", align: "center", cardRole: "hidden", render: (g) => <SiNo v={g.enviado} /> },
    { key: "gen", sortable: true, label: "Generación", className: "tabular-nums", render: (g) => fmtKwh(g.generacionKwh) },
    { key: "cons", sortable: true, label: "Consumo", className: "tabular-nums", render: (g) => fmtKwh(g.consumoKwh) },
    { key: "exp", sortable: true, label: "Exportación", className: "tabular-nums", render: (g) => fmtKwh(g.exportacionKwh) },
    {
      key: "ahorro",
      sortable: true,
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
              title="Trae de Growatt y de Huawei sólo los generadores a los que les falta algún dato del mes"
              className="flex items-center gap-1.5 rounded-lg bg-[var(--color-accent)] px-3 py-1.5 text-sm font-medium text-gray-900 disabled:opacity-50"
            >
              <Download size={14} /> Traer datos de las plantas
            </button>
            <button
              type="button"
              disabled={emitirTodos.isPending || Boolean(ingestaId)}
              onClick={() => emitirTodos.mutate()}
              title="Genera el PDF de todos los generadores que tengan los datos del mes completos"
              className="flex items-center gap-1.5 rounded-lg bg-[var(--color-accent)] px-3 py-1.5 text-sm font-medium text-gray-900 disabled:opacity-50"
            >
              <FileText size={14} />
              {emitirTodos.isPending ? "Generando…" : "Generar PDF de todos"}
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
        "Traer datos de las plantas" consulta Growatt y Huawei, sólo para los generadores a los que les falta algún dato del mes
        elegido; los que ya están completos se saltean para no gastar consultas de más. Si necesitás
        rehacer un mes entero, usá "Traer todo de nuevo".
      </p>

      {/* Filtros */}
      <div className="space-y-2 rounded-xl border border-[var(--color-border)] bg-[var(--color-bg-card)] p-3">
        <div className="flex flex-wrap items-start gap-x-4 gap-y-3">
          <ToggleFiltro
            label="Alta"
            value={alta}
            onChange={setAlta}
            todos="todos"
            options={[
              { value: "alta", label: "De alta" },
              { value: "sin_alta", label: "Sin alta" },
            ]}
          />
          <ToggleFiltro
            label="Reporte"
            value={habilitado}
            onChange={setHabilitado}
            todos="todos"
            options={[
              { value: "si", label: "Habilitados" },
              { value: "no", label: "Deshabilitados" },
            ]}
          />
          <ToggleFiltro
            label="Lectura"
            value={lectura}
            onChange={setLectura}
            todos="todos"
            options={[
              { value: "completa", label: "Con lectura" },
              { value: "incompleta", label: "Incompleta" },
              { value: "sin", label: "Sin lectura" },
            ]}
          />
          <ToggleFiltro
            label="Cálculo"
            value={calculo}
            onChange={setCalculo}
            todos="todos"
            options={[
              { value: "si", label: "Calculados" },
              { value: "no", label: "Sin calcular" },
            ]}
          />
          <ToggleFiltro
            label="PDF"
            value={pdf}
            onChange={setPdf}
            todos="todos"
            options={[
              { value: "con", label: "Con PDF" },
              { value: "sin", label: "Sin PDF" },
            ]}
          />
          <ToggleFiltro
            label="Enviado"
            value={envio}
            onChange={setEnvio}
            todos="todos"
            options={[
              { value: "enviados", label: "Enviados" },
              { value: "pendientes", label: "Sin enviar" },
            ]}
          />
          <ToggleFiltro
            label="Origen"
            value={origen}
            onChange={setOrigen}
            todos="todos"
            options={[
              { value: "GROWATT", label: "Growatt" },
              { value: "HUAWEI", label: "Huawei" },
              { value: "MANUAL", label: "Manual" },
            ]}
          />
          <ToggleFiltro
            label="Tipo"
            value={tipo}
            onChange={setTipo}
            todos="todos"
            options={[
              { value: "residencial", label: "Residencial" },
              { value: "empresa", label: "Empresa" },
            ]}
          />
          <div className="flex min-w-[7.5rem] flex-col gap-1">
            <span className="font-mono text-[10px] uppercase tracking-wider text-[var(--color-text-muted)]">
              Revisar
            </span>
            {(
              [
                ["Bloqueados", soloBloqueados, setSoloBloqueados],
                ["Potencia estimada", soloPotenciaEstimada, setSoloPotenciaEstimada],
                ["Sin destinatario", soloSinDestinatario, setSoloSinDestinatario],
                ["Con pendientes", soloConProblemas, setSoloConProblemas],
              ] as [string, boolean, (v: boolean) => void][]
            ).map(([label, activo, set]) => (
              <button
                key={label}
                type="button"
                aria-pressed={activo}
                onClick={() => set(!activo)}
                className={`rounded px-2 py-0.5 text-left text-[11px] transition ${
                  activo
                    ? "bg-[var(--color-accent)] font-medium text-gray-900"
                    : "border border-[var(--color-border)] text-[var(--color-text-muted)] hover:text-[var(--color-text-secondary)]"
                }`}
              >
                {label}
              </button>
            ))}
          </div>
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
        sortBy={orden?.key}
        sortOrder={orden?.dir}
        onSort={ordenarPor}
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

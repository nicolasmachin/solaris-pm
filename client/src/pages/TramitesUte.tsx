import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "react-hot-toast";
import {
  FileCheck,
  LayoutList,
  Kanban,
  Plus,
  X,
  ExternalLink,
  Trash2,
  Palette,
} from "lucide-react";
import {
  createUteProcess,
  deleteUteProcess,
  getUteProcesses,
  patchUteProcess,
  UTE_COLOR_PALETTE,
  UTE_DEFAULT_COLOR,
  UTE_STAGE_LABEL,
  UTE_STAGE_ORDER,
  UTE_STATUS_LABEL,
  type UteActionKey,
  type UteColorHex,
  type UteListParams,
  type UteProcess,
  type UteSortBy,
  type UteStage,
  type UteStatus,
} from "../api/uteProcess.api";
import { getProjects, patchProject } from "../api/projects.api";
import type { ProjectListItem } from "../types/api.types";
import { Button } from "../components/ui/Button";
import { Spinner } from "../components/ui/Spinner";
import { useAuthStore } from "../store/auth.store";
import { usePermission } from "../hooks/usePermission";
import {
  STAGE_BADGE_COLORS,
  STATUS_BADGE_COLORS,
  UteProcessDetail,
} from "../components/ute/UteProcessDetail";
import { UteKanbanBoard } from "../components/ute/UteKanbanBoard";

const FILTER_STORAGE_KEY = "ute-filters";
const VIEW_STORAGE_KEY = "ute-view-mode";

type ViewMode = "table" | "kanban";

const MONTHS_ES = ["ene","feb","mar","abr","may","jun","jul","ago","sep","oct","nov","dic"];

function fmtShort(iso: string | null): string {
  if (!iso) return "—";
  const d = new Date(iso);
  if (isNaN(d.getTime())) return "—";
  // Las fechas de UTE se guardan como medianoche UTC (ej: "2026-04-25T00:00:00Z").
  // Leer con getDate()/getMonth() en zona UY (UTC-3) convierte a las 21:00 del día
  // anterior y mostraría un día menos. Por eso usamos los getters UTC.
  return `${d.getUTCDate()}-${MONTHS_ES[d.getUTCMonth()]}`;
}

function toInputDate(iso: string | null): string {
  return iso ? iso.slice(0, 10) : "";
}

// Alpha transparencia al 15% sobre el hex para el fondo de celdas coloreadas.
function hexToBgAlpha(hex: string): string {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return `rgba(${r},${g},${b},0.20)`;
}

type PersistedFilters = {
  stage: UteStage | "ALL";
  status: UteStatus | "ALL";
  search: string;
  sortBy: UteSortBy;
  sortOrder: "asc" | "desc";
};

const DEFAULT_FILTERS: PersistedFilters = {
  stage: "ALL",
  status: "ALL",
  search: "",
  sortBy: "updatedAt",
  sortOrder: "desc",
};

const SORT_LABELS: Record<UteSortBy, string> = {
  updatedAt: "Última actualización",
  createdAt: "Fecha de creación",
  currentStage: "Etapa",
  currentStatus: "Estado",
  client: "Cliente",
  duration: "Duración",
};

function loadFilters(): PersistedFilters {
  if (typeof window === "undefined") return DEFAULT_FILTERS;
  try {
    const raw = window.localStorage.getItem(FILTER_STORAGE_KEY);
    if (!raw) return DEFAULT_FILTERS;
    const parsed = JSON.parse(raw);
    return {
      stage: parsed.stage ?? DEFAULT_FILTERS.stage,
      status: parsed.status ?? DEFAULT_FILTERS.status,
      search: parsed.search ?? DEFAULT_FILTERS.search,
      sortBy: (parsed.sortBy as UteSortBy) ?? DEFAULT_FILTERS.sortBy,
      sortOrder: parsed.sortOrder === "asc" ? "asc" : DEFAULT_FILTERS.sortOrder,
    };
  } catch {
    return DEFAULT_FILTERS;
  }
}

function saveFilters(f: PersistedFilters) {
  try {
    window.localStorage.setItem(FILTER_STORAGE_KEY, JSON.stringify(f));
  } catch {
    /* noop */
  }
}

function loadViewMode(): ViewMode {
  if (typeof window === "undefined") return "table";
  const v = window.localStorage.getItem(VIEW_STORAGE_KEY);
  return v === "kanban" ? "kanban" : "table";
}

// ─── Página ─────────────────────────────────────────────────────────────────

export function TramitesUte() {
  const [searchParams, setSearchParams] = useSearchParams();
  const [filters, setFilters] = useState<PersistedFilters>(loadFilters);
  const [view, setView] = useState<ViewMode>(loadViewMode);
  const [selectedId, setSelectedId] = useState<string | null>(
    searchParams.get("id") ?? searchParams.get("highlight"),
  );
  const [newModalOpen, setNewModalOpen] = useState(false);

  useEffect(() => saveFilters(filters), [filters]);
  useEffect(() => {
    try {
      window.localStorage.setItem(VIEW_STORAGE_KEY, view);
    } catch {
      /* noop */
    }
  }, [view]);

  useEffect(() => {
    const next = new URLSearchParams(searchParams);
    if (selectedId) next.set("id", selectedId);
    else next.delete("id");
    next.delete("highlight");
    if (next.toString() !== searchParams.toString()) {
      setSearchParams(next, { replace: true });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedId]);

  const queryParams = useMemo<UteListParams>(
    () => ({
      stage: filters.stage === "ALL" ? null : filters.stage,
      status: filters.status === "ALL" ? null : filters.status,
      search: filters.search.trim() || null,
      sortBy: filters.sortBy,
      sortOrder: filters.sortOrder,
    }),
    [filters],
  );

  const { data: processes = [], isLoading, isError, refetch } = useQuery({
    queryKey: ["ute-processes", queryParams],
    queryFn: () => getUteProcesses(queryParams),
  });

  const activeCount = processes.filter((p) => p.currentStatus !== "CERRADO").length;
  const finalizedCount = processes.filter((p) => p.currentStatus === "CERRADO").length;

  const selected = selectedId ? processes.find((p) => p.id === selectedId) ?? null : null;

  return (
    <div>
      {/* Header */}
      <div className="mb-5 flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
        <div>
          <h1 className="flex items-center gap-2 font-display text-2xl font-bold text-[var(--color-text-primary)]">
            <FileCheck size={22} className="text-[var(--color-accent)]" />
            Trámites UTE
          </h1>
          <p className="mt-1 text-sm text-[var(--color-text-secondary)]">
            {activeCount} trámites activos · {finalizedCount} finalizados
          </p>
        </div>
        <div className="flex items-center gap-2">
          <div className="inline-flex rounded-md border border-[var(--color-border)] bg-[var(--color-bg-app)] p-0.5">
            <button
              type="button"
              onClick={() => setView("table")}
              className={`inline-flex items-center gap-1.5 rounded px-3 py-1.5 text-xs transition-colors ${
                view === "table"
                  ? "bg-[var(--color-accent)] text-black font-semibold"
                  : "text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)]"
              }`}
              aria-pressed={view === "table"}
            >
              <LayoutList size={14} />
              Tabla
            </button>
            <button
              type="button"
              onClick={() => setView("kanban")}
              className={`inline-flex items-center gap-1.5 rounded px-3 py-1.5 text-xs transition-colors ${
                view === "kanban"
                  ? "bg-[var(--color-accent)] text-black font-semibold"
                  : "text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)]"
              }`}
              aria-pressed={view === "kanban"}
            >
              <Kanban size={14} />
              Kanban
            </button>
          </div>
          <Button onClick={() => setNewModalOpen(true)} size="sm">
            <Plus size={14} />
            Nuevo trámite
          </Button>
        </div>
      </div>

      {/* Filtros */}
      <div className="mb-4 flex flex-wrap items-center gap-3 rounded-xl border border-[var(--color-border)] bg-[var(--color-bg-card)] p-3">
        <label className="inline-flex items-center gap-2 text-xs text-[var(--color-text-muted)]">
          <span className="font-mono uppercase tracking-widest">Etapa</span>
          <select
            value={filters.stage}
            onChange={(e) => setFilters((f) => ({ ...f, stage: e.target.value as UteStage | "ALL" }))}
            className="rounded-md border border-[var(--color-border)] bg-[var(--color-bg-app)] px-2 py-1 text-xs text-[var(--color-text-primary)] focus:border-[var(--color-accent)] focus:outline-none"
          >
            <option value="ALL">Todas</option>
            {UTE_STAGE_ORDER.map((s) => (
              <option key={s} value={s}>{UTE_STAGE_LABEL[s]}</option>
            ))}
          </select>
        </label>
        <label className="inline-flex items-center gap-2 text-xs text-[var(--color-text-muted)]">
          <span className="font-mono uppercase tracking-widest">Estado</span>
          <select
            value={filters.status}
            onChange={(e) => setFilters((f) => ({ ...f, status: e.target.value as UteStatus | "ALL" }))}
            className="rounded-md border border-[var(--color-border)] bg-[var(--color-bg-app)] px-2 py-1 text-xs text-[var(--color-text-primary)] focus:border-[var(--color-accent)] focus:outline-none"
          >
            <option value="ALL">Todos</option>
            {(Object.keys(UTE_STATUS_LABEL) as UteStatus[]).map((s) => (
              <option key={s} value={s}>{UTE_STATUS_LABEL[s]}</option>
            ))}
          </select>
        </label>
        <input
          type="search"
          placeholder="Buscar cliente…"
          value={filters.search}
          onChange={(e) => setFilters((f) => ({ ...f, search: e.target.value }))}
          className="flex-1 min-w-[180px] rounded-md border border-[var(--color-border)] bg-[var(--color-bg-app)] px-3 py-1.5 text-xs text-[var(--color-text-primary)] focus:border-[var(--color-accent)] focus:outline-none"
        />
        <label className="inline-flex items-center gap-2 text-xs text-[var(--color-text-muted)]">
          <span className="font-mono uppercase tracking-widest">Ordenar</span>
          <select
            value={filters.sortBy}
            onChange={(e) => setFilters((f) => ({ ...f, sortBy: e.target.value as UteSortBy }))}
            className="rounded-md border border-[var(--color-border)] bg-[var(--color-bg-app)] px-2 py-1 text-xs text-[var(--color-text-primary)] focus:border-[var(--color-accent)] focus:outline-none"
          >
            {(Object.keys(SORT_LABELS) as UteSortBy[]).map((k) => (
              <option key={k} value={k}>{SORT_LABELS[k]}</option>
            ))}
          </select>
          <button
            type="button"
            onClick={() =>
              setFilters((f) => ({ ...f, sortOrder: f.sortOrder === "asc" ? "desc" : "asc" }))
            }
            className="rounded-md border border-[var(--color-border)] bg-[var(--color-bg-app)] px-2 py-1 font-mono text-[11px] text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)]"
            title={filters.sortOrder === "asc" ? "Ascendente" : "Descendente"}
            aria-label="Cambiar dirección del orden"
          >
            {filters.sortOrder === "asc" ? "↑" : "↓"}
          </button>
        </label>
      </div>

      {/* Contenido */}
      {isLoading ? (
        <div className="flex min-h-[240px] items-center justify-center">
          <Spinner />
        </div>
      ) : isError ? (
        <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-bg-card)] p-8 text-center">
          <p className="text-sm text-[var(--color-text-secondary)]">No se pudieron cargar los trámites.</p>
          <Button onClick={() => refetch()} variant="secondary" size="sm" className="mt-3">
            Reintentar
          </Button>
        </div>
      ) : processes.length === 0 ? (
        <div className="rounded-xl border border-dashed border-[var(--color-border)] bg-[var(--color-bg-card)] p-10 text-center">
          <p className="font-display text-base font-semibold text-[var(--color-text-primary)]">
            Sin trámites
          </p>
          <p className="mt-1 text-sm text-[var(--color-text-secondary)]">
            No hay trámites UTE que coincidan con los filtros.
          </p>
        </div>
      ) : view === "table" ? (
        <UteTable processes={processes} onRowClick={(id) => setSelectedId(id)} />
      ) : (
        <UteKanbanBoard processes={processes} onCardClick={(id) => setSelectedId(id)} />
      )}

      {/* Drawer detalle */}
      {selected ? (
        <UteDetailDrawer process={selected} onClose={() => setSelectedId(null)} />
      ) : null}

      {/* Modal nuevo */}
      {newModalOpen ? (
        <NewUteModal
          onClose={() => setNewModalOpen(false)}
          onCreated={(p) => {
            setNewModalOpen(false);
            setSelectedId(p.id);
          }}
        />
      ) : null}
    </div>
  );
}

// ─── Vista Tabla ────────────────────────────────────────────────────────────

const TABLE_DATE_COLUMNS: Array<{ key: UteActionKey; label: string; short: string }> = [
  { key: "consultaSentAt",     label: "Consulta enviada",  short: "Cons.env" },
  { key: "caseOpenedAt",       label: "Caso abierto",      short: "Caso" },
  { key: "consultaApprovedAt", label: "Consulta aprobada", short: "Cons.apr" },
  { key: "solicitudSentAt",    label: "Solicitud enviada", short: "Solic.env" },
  { key: "proyectoApprovedAt", label: "Proyecto aprobado", short: "Proy.apr" },
  { key: "docs1SentAt",        label: "Docs 1 enviados",   short: "D1.env" },
  { key: "docs1ApprovedAt",    label: "Docs 1 aprobados",  short: "D1.apr" },
  { key: "ensayosSentAt",      label: "Ensayos enviados",  short: "Ens.env" },
  { key: "ensayosApprovedAt",  label: "Ensayos aprobados", short: "Ens.apr" },
  { key: "docs2SentAt",        label: "Docs 2 enviados",   short: "D2.env" },
  { key: "finalizedAt",        label: "Finalizado",        short: "Final" },
];

function UteTable({
  processes,
  onRowClick,
}: {
  processes: UteProcess[];
  onRowClick: (id: string) => void;
}) {
  return (
    <div className="overflow-x-auto rounded-xl border border-[var(--color-border)] bg-[var(--color-bg-card)]">
      <table className="min-w-full text-xs">
        <thead className="bg-[var(--color-bg-app)] text-[10px] uppercase tracking-wider text-[var(--color-text-muted)]">
          <tr>
            <th className="sticky left-0 z-10 bg-[var(--color-bg-app)] px-3 py-2 text-left font-mono">Cliente</th>
            <th className="px-3 py-2 text-left font-mono">Etapa</th>
            <th className="px-3 py-2 text-left font-mono">Estado</th>
            <th className="px-3 py-2 text-left font-mono">Caso</th>
            {TABLE_DATE_COLUMNS.map((c) => (
              <th key={c.key} className="px-2 py-2 text-center font-mono" title={c.label}>
                {c.short}
              </th>
            ))}
            <th className="px-3 py-2 text-right font-mono" title="Duración total">Dur.</th>
            <th className="px-3 py-2 text-right font-mono" title="Tiempo del lado nuestro">T.nos</th>
            <th className="px-3 py-2 text-right font-mono" title="Tiempo del lado UTE">T.UTE</th>
            <th className="px-3 py-2 text-left font-mono">Notas</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-[var(--color-border)]">
          {processes.map((p) => (
            <UteTableRow key={p.id} process={p} onRowClick={onRowClick} />
          ))}
        </tbody>
      </table>
    </div>
  );
}

function UteTableRow({
  process,
  onRowClick,
}: {
  process: UteProcess;
  onRowClick: (id: string) => void;
}) {
  const qc = useQueryClient();
  const [caseValue, setCaseValue] = useState(process.caseNumber ?? "");
  // Resincronizar sólo cuando cambia el trámite, no cuando cambia el campo
  // editable (evita que la respuesta del server pise lo que se está tipeando).
  useEffect(() => {
    setCaseValue(process.caseNumber ?? "");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [process.id]);

  const patch = useMutation({
    mutationFn: (body: Parameters<typeof patchUteProcess>[1]) => patchUteProcess(process.id, body),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["ute-processes"] }),
    onError: (e: unknown) => {
      const msg =
        (e as { response?: { data?: { error?: { message?: string } } } })?.response?.data?.error
          ?.message ?? "No se pudo guardar";
      toast.error(msg);
    },
  });

  return (
    <tr className="hover:bg-[var(--color-bg-card-hover)]">
      <td className="sticky left-0 z-10 bg-[var(--color-bg-card)] px-3 py-2 font-semibold text-[var(--color-text-primary)] hover:bg-[var(--color-bg-card-hover)]">
        <div
          className="cursor-pointer truncate max-w-[200px]"
          onClick={() => onRowClick(process.id)}
        >
          {process.project.clientName}
        </div>
        <div className="mt-0.5 flex items-center gap-1 text-[11px]">
          <UteCodigoInline
            projectId={process.project.id}
            field="uteCodigoPS"
            label="PS"
            value={process.project.uteCodigoPS}
          />
          <span className="text-[var(--color-text-muted)]">·</span>
          <UteCodigoInline
            projectId={process.project.id}
            field="uteCodigoAS"
            label="AS"
            value={process.project.uteCodigoAS}
          />
        </div>
      </td>
      <td className="px-2 py-2" onClick={(e) => e.stopPropagation()}>
        <select
          value={process.currentStage}
          onClick={(e) => e.stopPropagation()}
          onChange={(e) => {
            patch.mutate({ currentStage: e.target.value as UteStage });
            toast.success("Etapa actualizada");
          }}
          className="w-full max-w-[120px] rounded border border-transparent bg-transparent px-1.5 py-0.5 font-mono text-[10px] font-bold uppercase tracking-wider cursor-pointer focus:border-[var(--color-accent)] focus:outline-none"
          style={{
            background: STAGE_BADGE_COLORS[process.currentStage].bg,
            color: STAGE_BADGE_COLORS[process.currentStage].text,
          }}
          aria-label="Cambiar etapa"
        >
          {UTE_STAGE_ORDER.map((s) => (
            <option key={s} value={s}>
              {UTE_STAGE_LABEL[s]}
            </option>
          ))}
        </select>
      </td>
      <td className="px-2 py-2" onClick={(e) => e.stopPropagation()}>
        <select
          value={process.currentStatus}
          onClick={(e) => e.stopPropagation()}
          onChange={(e) => {
            patch.mutate({ currentStatus: e.target.value as UteStatus });
            toast.success("Estado actualizado");
          }}
          className="w-full max-w-[120px] rounded border border-transparent bg-transparent px-1.5 py-0.5 text-[10px] font-semibold cursor-pointer focus:border-[var(--color-accent)] focus:outline-none"
          style={{
            background: STATUS_BADGE_COLORS[process.currentStatus].bg,
            color: STATUS_BADGE_COLORS[process.currentStatus].text,
          }}
          aria-label="Cambiar estado"
        >
          {(Object.keys(UTE_STATUS_LABEL) as UteStatus[]).map((s) => (
            <option key={s} value={s}>
              {UTE_STATUS_LABEL[s]}
            </option>
          ))}
        </select>
      </td>
      <td className="px-2 py-2" onClick={(e) => e.stopPropagation()}>
        <input
          type="text"
          value={caseValue}
          onChange={(e) => setCaseValue(e.target.value)}
          onClick={(e) => e.stopPropagation()}
          onBlur={() => {
            if (caseValue !== (process.caseNumber ?? "")) {
              patch.mutate({ caseNumber: caseValue.trim() || null });
              toast.success("Caso actualizado");
            }
          }}
          placeholder="—"
          className="w-full max-w-[140px] rounded border border-transparent bg-transparent px-1.5 py-0.5 font-mono text-[11px] text-[var(--color-text-secondary)] hover:border-[var(--color-border)] focus:border-[var(--color-accent)] focus:bg-[var(--color-bg-app)] focus:outline-none"
          aria-label="Número de caso"
        />
      </td>
      {TABLE_DATE_COLUMNS.map((c) => (
        <UteDateCell
          key={c.key}
          processId={process.id}
          fieldKey={c.key}
          label={c.label}
          value={process[c.key]}
          color={(process.dateColors[c.key] ?? UTE_DEFAULT_COLOR) as UteColorHex}
        />
      ))}
      <td className="px-3 py-2 text-right font-mono text-[11px] text-[var(--color-text-secondary)] cursor-pointer" onClick={() => onRowClick(process.id)}>
        {process.totalDays}
      </td>
      <td
        className="px-3 py-2 text-right font-mono text-[11px] cursor-pointer"
        onClick={() => onRowClick(process.id)}
        style={{ color: process.ourTimeDays > 30 ? "#f87171" : "var(--color-text-secondary)" }}
      >
        {process.ourTimeDays}
      </td>
      <td className="px-3 py-2 text-right font-mono text-[11px] cursor-pointer" style={{ color: "#60a5fa" }} onClick={() => onRowClick(process.id)}>
        {process.uteTimeDays}
      </td>
      <td className="px-2 py-2 max-w-[200px]" onClick={(e) => e.stopPropagation()}>
        <NotesCellButton
          processId={process.id}
          value={process.notes}
          clientName={process.project.clientName}
        />
      </td>
    </tr>
  );
}

// ─── Edición inline de códigos UTE (PS/AS) del proyecto ─────────────────────

function stripNonDigits(s: string): string {
  return s.replace(/\D+/g, "");
}

function UteCodigoInline({
  projectId,
  field,
  label,
  value,
}: {
  projectId: string;
  field: "uteCodigoPS" | "uteCodigoAS";
  label: "PS" | "AS";
  value: string | null;
}) {
  const canEdit = usePermission("OPERACIONES", "EDIT");
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(value ?? "");
  const inputRef = useRef<HTMLInputElement | null>(null);
  const qc = useQueryClient();

  // Resincronizar draft sólo al cambiar de projectId (evita race con save).
  useEffect(() => {
    setDraft(value ?? "");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [projectId]);

  useEffect(() => {
    if (editing && inputRef.current) {
      inputRef.current.focus();
      inputRef.current.select();
    }
  }, [editing]);

  const save = useMutation({
    mutationFn: (next: string | null) => patchProject(projectId, { [field]: next } as any),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["ute-processes"] });
      qc.invalidateQueries({ queryKey: ["project", projectId] });
      setEditing(false);
    },
    onError: () => {
      toast.error(`No se pudo guardar ${label}`);
      // Revert al valor anterior
      setDraft(value ?? "");
      setEditing(false);
    },
  });

  function commit() {
    const clean = stripNonDigits(draft);
    const next = clean || null;
    if (next === value) {
      setEditing(false);
      return;
    }
    save.mutate(next);
  }

  function cancel() {
    setDraft(value ?? "");
    setEditing(false);
  }

  if (!canEdit) {
    return (
      <span className="inline-flex items-baseline gap-0.5 whitespace-nowrap">
        <span className="text-[var(--color-text-muted)]">{label}:</span>
        <span className={value ? "text-[var(--color-text-secondary)]" : "text-[var(--color-text-muted)]"}>
          {value ?? "—"}
        </span>
      </span>
    );
  }

  if (editing) {
    return (
      <span className="inline-flex items-baseline gap-0.5 whitespace-nowrap">
        <span className="text-[var(--color-text-muted)]">{label}:</span>
        <input
          ref={inputRef}
          type="text"
          inputMode="numeric"
          pattern="[0-9]*"
          maxLength={50}
          aria-label={`Código ${label}`}
          value={draft}
          disabled={save.isPending}
          onChange={(e) => setDraft(stripNonDigits(e.target.value))}
          onPaste={(e) => {
            e.preventDefault();
            const pasted = e.clipboardData.getData("text");
            setDraft(stripNonDigits(pasted));
          }}
          onClick={(e) => e.stopPropagation()}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              commit();
            } else if (e.key === "Escape") {
              e.preventDefault();
              cancel();
            }
          }}
          onBlur={commit}
          className="w-[80px] rounded border border-[var(--color-accent)] bg-[var(--color-bg-app)] px-1 py-0 text-[11px] font-mono text-[var(--color-text-primary)] focus:outline-none"
        />
      </span>
    );
  }

  return (
    <span
      role="button"
      tabIndex={0}
      onClick={(e) => {
        e.stopPropagation();
        setEditing(true);
      }}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          setEditing(true);
        }
      }}
      className="inline-flex cursor-text items-baseline gap-0.5 whitespace-nowrap rounded px-1 py-0 -mx-1 hover:bg-[var(--color-bg-card-hover)] focus:bg-[var(--color-bg-card-hover)] focus:outline-none"
      title={`Editar código ${label}`}
    >
      <span className="text-[var(--color-text-muted)]">{label}:</span>
      <span className={value ? "font-mono text-[var(--color-text-secondary)]" : "text-[var(--color-text-muted)]"}>
        {value ?? "—"}
      </span>
    </span>
  );
}

function NotesCellButton({
  processId,
  value,
  clientName,
}: {
  processId: string;
  value: string | null;
  clientName: string;
}) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          setOpen(true);
        }}
        className="w-full truncate rounded px-1.5 py-1 text-left text-[12px] text-[var(--color-text-secondary)] hover:bg-[var(--color-bg-card-hover)] hover:text-[var(--color-text-primary)]"
        title={value ?? "Agregar nota"}
      >
        {value ?? <span className="text-[var(--color-text-muted)]">—</span>}
      </button>
      {open ? (
        <NotesMiniEditor
          processId={processId}
          initialValue={value ?? ""}
          clientName={clientName}
          onClose={() => setOpen(false)}
        />
      ) : null}
    </>
  );
}

function NotesMiniEditor({
  processId,
  initialValue,
  clientName,
  onClose,
}: {
  processId: string;
  initialValue: string;
  clientName: string;
  onClose: () => void;
}) {
  const [value, setValue] = useState(initialValue);
  const qc = useQueryClient();

  const save = useMutation({
    mutationFn: (next: string | null) =>
      patchUteProcess(processId, { notes: next } as any),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["ute-processes"] });
      qc.invalidateQueries({ queryKey: ["project", processId] });
      toast.success("Nota actualizada");
      onClose();
    },
    onError: () => toast.error("No se pudo guardar la nota"),
  });

  return (
    <div
      className="fixed inset-0 z-[60] flex items-center justify-center bg-black/60 p-4"
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div className="w-full max-w-md rounded-xl border border-[var(--color-border)] bg-[var(--color-bg-card)] p-5 shadow-2xl">
        <div className="mb-3 flex items-start justify-between">
          <div>
            <h3 className="font-display text-base font-semibold text-[var(--color-text-primary)]">
              Nota del trámite
            </h3>
            <p className="text-[11px] text-[var(--color-text-muted)]">{clientName}</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded p-1 text-[var(--color-text-muted)] hover:bg-[var(--color-bg-card-hover)]"
          >
            <X size={16} />
          </button>
        </div>
        <textarea
          value={value}
          onChange={(e) => setValue(e.target.value)}
          rows={5}
          maxLength={5000}
          autoFocus
          className="w-full rounded-md border border-[var(--color-border)] bg-[var(--color-bg-app)] px-3 py-2 text-sm text-[var(--color-text-primary)] focus:border-[var(--color-accent)] focus:outline-none"
          placeholder="Escribí una nota…"
        />
        <div className="mt-1 text-right text-[10px] text-[var(--color-text-muted)]">
          {value.length} / 5000
        </div>
        <div className="mt-3 flex items-center justify-end gap-2">
          <Button variant="secondary" size="sm" onClick={onClose}>Cancelar</Button>
          <Button
            size="sm"
            onClick={() => save.mutate(value.trim() || null)}
            loading={save.isPending}
          >
            Guardar
          </Button>
        </div>
      </div>
    </div>
  );
}

function UteDateCell({
  processId,
  fieldKey,
  label,
  value,
  color,
}: {
  processId: string;
  fieldKey: UteActionKey;
  label: string;
  value: string | null;
  color: UteColorHex;
}) {
  const [showDateEditor, setShowDateEditor] = useState(false);
  const [showColorPicker, setShowColorPicker] = useState(false);
  const qc = useQueryClient();

  const saveDate = useMutation({
    mutationFn: (v: string | null) => patchUteProcess(processId, { [fieldKey]: v } as any),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["ute-processes"] });
      toast.success("Fecha actualizada");
      setShowDateEditor(false);
    },
    onError: (e: unknown) => {
      const msg =
        (e as { response?: { data?: { error?: { message?: string } } } })?.response?.data?.error
          ?.message ?? "No se pudo guardar";
      toast.error(msg);
    },
  });

  const saveColor = useMutation({
    mutationFn: (hex: string) =>
      patchUteProcess(processId, { dateColors: { [fieldKey]: hex } } as any),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["ute-processes"] });
      toast.success("Color asignado");
      setShowColorPicker(false);
    },
    onError: () => toast.error("No se pudo cambiar el color"),
  });

  const filled = !!value;
  return (
    <td
      className="group relative px-1 py-1 text-center"
      style={filled ? { background: hexToBgAlpha(color) } : undefined}
      onClick={(e) => e.stopPropagation()}
      onContextMenu={(e) => {
        if (filled) {
          e.preventDefault();
          setShowColorPicker(true);
        }
      }}
    >
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          setShowDateEditor(true);
        }}
        className="w-full rounded px-1 py-1 text-[11px] font-mono hover:bg-[var(--color-bg-card-hover)]"
        title={label}
        style={{ color: filled ? color : "var(--color-text-muted)" }}
      >
        {fmtShort(value)}
      </button>

      {filled ? (
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            setShowColorPicker(true);
          }}
          className="absolute right-0 top-0 hidden rounded bg-[var(--color-bg-app)] p-0.5 text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)] group-hover:block"
          title="Cambiar color"
          aria-label="Cambiar color"
        >
          <Palette size={10} />
        </button>
      ) : null}

      {showDateEditor ? (
        <MiniDateEditor
          label={label}
          currentValue={value}
          onSave={(v) => saveDate.mutate(v)}
          onClose={() => setShowDateEditor(false)}
          loading={saveDate.isPending}
        />
      ) : null}

      {showColorPicker ? (
        <ColorPickerPopover
          current={color}
          onSelect={(hex) => saveColor.mutate(hex)}
          onClose={() => setShowColorPicker(false)}
        />
      ) : null}
    </td>
  );
}

function MiniDateEditor({
  label,
  currentValue,
  onSave,
  onClose,
  loading,
}: {
  label: string;
  currentValue: string | null;
  onSave: (v: string | null) => void;
  onClose: () => void;
  loading: boolean;
}) {
  const [value, setValue] = useState(toInputDate(currentValue));
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50"
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div className="w-full max-w-sm rounded-xl border border-[var(--color-border)] bg-[var(--color-bg-card)] p-5 shadow-2xl">
        <div className="mb-3 flex items-start justify-between">
          <h3 className="font-display text-base font-semibold text-[var(--color-text-primary)]">{label}</h3>
          <button
            type="button"
            onClick={onClose}
            className="rounded p-1 text-[var(--color-text-muted)] hover:bg-[var(--color-bg-card-hover)]"
          >
            <X size={16} />
          </button>
        </div>
        <input
          type="date"
          value={value}
          onChange={(e) => setValue(e.target.value)}
          className="w-full rounded-md border border-[var(--color-border)] bg-[var(--color-bg-app)] px-3 py-2 text-sm text-[var(--color-text-primary)] focus:border-[var(--color-accent)] focus:outline-none"
          autoFocus
        />
        <div className="mt-4 flex items-center justify-between gap-2">
          {currentValue ? (
            <Button variant="ghost" size="sm" onClick={() => onSave(null)} loading={loading}>
              Limpiar
            </Button>
          ) : (
            <span />
          )}
          <div className="flex gap-2">
            <Button variant="secondary" size="sm" onClick={onClose}>Cancelar</Button>
            <Button size="sm" onClick={() => onSave(value || null)} loading={loading} disabled={!value}>
              Guardar
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}

function ColorPickerPopover({
  current,
  onSelect,
  onClose,
}: {
  current: string;
  onSelect: (hex: string) => void;
  onClose: () => void;
}) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    function onDocClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) onClose();
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    setTimeout(() => {
      document.addEventListener("mousedown", onDocClick);
      document.addEventListener("keydown", onKey);
    }, 0);
    return () => {
      document.removeEventListener("mousedown", onDocClick);
      document.removeEventListener("keydown", onKey);
    };
  }, [onClose]);

  return (
    <div
      ref={ref}
      role="dialog"
      aria-label="Elegir color"
      className="absolute right-0 top-full z-50 mt-1 flex items-center gap-1 rounded-lg border border-[var(--color-border)] bg-[var(--color-bg-card)] p-1.5 shadow-xl"
    >
      {UTE_COLOR_PALETTE.map((hex) => (
        <button
          key={hex}
          type="button"
          onClick={() => onSelect(hex)}
          className={`h-5 w-5 rounded-full border-2 transition-all ${
            current === hex ? "border-white scale-110" : "border-transparent hover:border-white/50"
          }`}
          style={{ backgroundColor: hex }}
          title={hex}
          aria-label={`Color ${hex}`}
        />
      ))}
    </div>
  );
}

// ─── Drawer de detalle ──────────────────────────────────────────────────────

function UteDetailDrawer({
  process,
  onClose,
}: {
  process: UteProcess;
  onClose: () => void;
}) {
  const navigate = useNavigate();
  const qc = useQueryClient();
  const currentUser = useAuthStore((s) => s.user);
  const isAdmin = currentUser?.role === "ADMIN";

  const del = useMutation({
    mutationFn: () => deleteUteProcess(process.id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["ute-processes"] });
      toast.success("Trámite eliminado");
      onClose();
    },
    onError: () => toast.error("No se pudo eliminar"),
  });

  return (
    <div className="fixed inset-0 z-40 flex">
      <div className="flex-1 bg-black/50" onClick={onClose} />
      <aside
        className="flex w-full max-w-xl flex-col overflow-y-auto border-l border-[var(--color-border)] bg-[var(--color-bg-app)] shadow-2xl"
        role="dialog"
        aria-label="Detalle del trámite UTE"
      >
        <div className="sticky top-0 z-10 border-b border-[var(--color-border)] bg-[var(--color-bg-app)] p-5">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <h2 className="font-display text-lg font-bold text-[var(--color-text-primary)] truncate">
                {process.project.clientName}
              </h2>
              <button
                type="button"
                onClick={() => navigate(`/projects/${process.projectId}`)}
                className="mt-1 inline-flex items-center gap-1 text-xs text-[var(--color-accent)] hover:underline"
              >
                Ver proyecto <ExternalLink size={12} />
              </button>
              <div className="mt-2 flex flex-wrap items-center gap-2">
                <span
                  className="rounded px-2 py-0.5 font-mono text-[10px] font-bold uppercase tracking-wider"
                  style={{
                    background: STAGE_BADGE_COLORS[process.currentStage].bg,
                    color: STAGE_BADGE_COLORS[process.currentStage].text,
                  }}
                >
                  {UTE_STAGE_LABEL[process.currentStage]}
                </span>
                <span
                  className="rounded px-2 py-0.5 text-[10px] font-semibold"
                  style={{
                    background: STATUS_BADGE_COLORS[process.currentStatus].bg,
                    color: STATUS_BADGE_COLORS[process.currentStatus].text,
                  }}
                >
                  {UTE_STATUS_LABEL[process.currentStatus]}
                </span>
              </div>
            </div>
            <button
              type="button"
              onClick={onClose}
              className="rounded p-1.5 text-[var(--color-text-muted)] hover:bg-[var(--color-bg-card-hover)]"
              aria-label="Cerrar"
            >
              <X size={18} />
            </button>
          </div>
        </div>

        <UteProcessDetail process={process} />

        <div className="flex items-center justify-between gap-2 px-5 py-4">
          {isAdmin ? (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => {
                if (confirm("¿Eliminar este trámite? No se puede deshacer desde la UI.")) del.mutate();
              }}
              loading={del.isPending}
            >
              <Trash2 size={14} />
              Eliminar
            </Button>
          ) : (
            <span />
          )}
          <Button variant="secondary" size="sm" onClick={onClose}>Cerrar</Button>
        </div>
      </aside>
    </div>
  );
}

// ─── Modal de nuevo trámite ─────────────────────────────────────────────────

function NewUteModal({
  onClose,
  onCreated,
}: {
  onClose: () => void;
  onCreated: (p: UteProcess) => void;
}) {
  const [projectId, setProjectId] = useState<string>("");
  const [caseNumber, setCaseNumber] = useState("");
  const [notes, setNotes] = useState("");
  const [consultaSentAt, setConsultaSentAt] = useState("");
  const qc = useQueryClient();

  const { data: projects = [], isLoading: loadingProjects } = useQuery({
    queryKey: ["projects", "for-ute"],
    queryFn: () => getProjects(),
    staleTime: 60_000,
  });

  const { data: existing = [] } = useQuery({
    queryKey: ["ute-processes", "all"],
    queryFn: () => getUteProcesses(),
    staleTime: 30_000,
  });
  const projectsWithUte = new Set(existing.map((u) => u.projectId));
  const availableProjects = projects.filter((p: ProjectListItem) => !projectsWithUte.has(p.id));

  const create = useMutation({
    mutationFn: () =>
      createUteProcess({
        projectId,
        caseNumber: caseNumber.trim() || null,
        notes: notes.trim() || null,
        consultaSentAt: consultaSentAt || null,
      }),
    onSuccess: (p) => {
      qc.invalidateQueries({ queryKey: ["ute-processes"] });
      toast.success("Trámite creado");
      onCreated(p);
    },
    onError: (e: unknown) => {
      const msg =
        (e as { response?: { data?: { error?: { message?: string } } } })?.response?.data?.error
          ?.message ?? "No se pudo crear el trámite";
      toast.error(msg);
    },
  });

  function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!projectId) return;
    create.mutate();
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4"
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <form
        onSubmit={onSubmit}
        className="w-full max-w-md rounded-xl border border-[var(--color-border)] bg-[var(--color-bg-card)] p-5 shadow-2xl"
      >
        <div className="mb-4 flex items-start justify-between">
          <h3 className="font-display text-lg font-bold text-[var(--color-text-primary)]">Nuevo trámite UTE</h3>
          <button type="button" onClick={onClose} className="rounded p-1 text-[var(--color-text-muted)] hover:bg-[var(--color-bg-card-hover)]">
            <X size={18} />
          </button>
        </div>

        <label className="block">
          <span className="text-xs text-[var(--color-text-secondary)]">Proyecto</span>
          <select
            value={projectId}
            onChange={(e) => setProjectId(e.target.value)}
            required
            className="mt-1 w-full rounded-md border border-[var(--color-border)] bg-[var(--color-bg-app)] px-3 py-2 text-sm text-[var(--color-text-primary)] focus:border-[var(--color-accent)] focus:outline-none"
          >
            <option value="">{loadingProjects ? "Cargando…" : "Elegí un proyecto"}</option>
            {availableProjects.map((p: ProjectListItem) => (
              <option key={p.id} value={p.id}>
                [{p.code}] {p.clientName}
              </option>
            ))}
          </select>
          {!loadingProjects && availableProjects.length === 0 ? (
            <p className="mt-1 text-[11px] text-[var(--color-text-muted)]">
              Todos los proyectos activos ya tienen un trámite UTE.
            </p>
          ) : null}
        </label>

        <label className="mt-3 block">
          <span className="text-xs text-[var(--color-text-secondary)]">Número de caso (opcional)</span>
          <input
            type="text"
            value={caseNumber}
            onChange={(e) => setCaseNumber(e.target.value)}
            className="mt-1 w-full rounded-md border border-[var(--color-border)] bg-[var(--color-bg-app)] px-3 py-2 text-sm text-[var(--color-text-primary)] focus:border-[var(--color-accent)] focus:outline-none"
          />
        </label>

        <label className="mt-3 block">
          <span className="text-xs text-[var(--color-text-secondary)]">Fecha de consulta enviada (opcional)</span>
          <input
            type="date"
            value={consultaSentAt}
            onChange={(e) => setConsultaSentAt(e.target.value)}
            className="mt-1 w-full rounded-md border border-[var(--color-border)] bg-[var(--color-bg-app)] px-3 py-2 text-sm text-[var(--color-text-primary)] focus:border-[var(--color-accent)] focus:outline-none"
          />
        </label>

        <label className="mt-3 block">
          <span className="text-xs text-[var(--color-text-secondary)]">Nota inicial (opcional)</span>
          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            rows={2}
            maxLength={5000}
            className="mt-1 w-full rounded-md border border-[var(--color-border)] bg-[var(--color-bg-app)] px-3 py-2 text-sm text-[var(--color-text-primary)] focus:border-[var(--color-accent)] focus:outline-none"
          />
        </label>

        <div className="mt-5 flex items-center justify-end gap-2">
          <Button type="button" variant="secondary" size="sm" onClick={onClose}>Cancelar</Button>
          <Button type="submit" size="sm" disabled={!projectId} loading={create.isPending}>
            Crear trámite
          </Button>
        </div>
      </form>
    </div>
  );
}

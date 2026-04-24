import { useEffect, useMemo, useState } from "react";
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
  Send,
  Inbox,
} from "lucide-react";
import {
  createUteProcess,
  deleteUteProcess,
  getUteProcesses,
  patchUteProcess,
  UTE_ACTIONS_ORDERED,
  UTE_STAGE_LABEL,
  UTE_STAGE_ORDER,
  UTE_STATUS_LABEL,
  type UteActionKey,
  type UteListParams,
  type UteProcess,
  type UteStage,
  type UteStatus,
} from "../api/uteProcess.api";
import { getProjects } from "../api/projects.api";
import type { ProjectListItem } from "../types/api.types";
import { Button } from "../components/ui/Button";
import { Spinner } from "../components/ui/Spinner";
import { EmptyState } from "../components/ui/EmptyState";
import { useAuthStore } from "../store/auth.store";

// ─── Constantes de presentación ─────────────────────────────────────────────

const FILTER_STORAGE_KEY = "ute-filters";
const VIEW_STORAGE_KEY = "ute-view-mode";

type ViewMode = "table" | "kanban";

const STAGE_COLORS: Record<UteStage, { bg: string; text: string }> = {
  CONSULTA:   { bg: "rgba(59,130,246,0.18)",  text: "#60a5fa" },
  SOLICITUD:  { bg: "rgba(139,92,246,0.18)",  text: "#a78bfa" },
  DOCS_1:     { bg: "rgba(16,185,129,0.18)",  text: "#34d399" },
  DOCS_2:     { bg: "rgba(249,115,22,0.18)",  text: "#fb923c" },
  RELEVAR:    { bg: "rgba(234,179,8,0.18)",   text: "#facc15" },
  ENSAYOS:    { bg: "rgba(239,68,68,0.18)",   text: "#f87171" },
  FINALIZADO: { bg: "rgba(45,212,191,0.18)",  text: "#5eead4" },
};

const STATUS_COLORS: Record<UteStatus, { bg: string; text: string }> = {
  CERRADO:    { bg: "rgba(16,185,129,0.18)", text: "#34d399" },
  EN_PROCESO: { bg: "rgba(59,130,246,0.18)", text: "#60a5fa" },
  ESPERANDO:  { bg: "rgba(148,163,184,0.22)", text: "#cbd5e1" },
  PENDIENTE:  { bg: "rgba(239,68,68,0.18)",  text: "#f87171" },
};

const MONTHS_ES = ["ene","feb","mar","abr","may","jun","jul","ago","sep","oct","nov","dic"];

function fmtShort(iso: string | null): string {
  if (!iso) return "—";
  const d = new Date(iso);
  if (isNaN(d.getTime())) return "—";
  return `${d.getDate()}-${MONTHS_ES[d.getMonth()]}`;
}

function toInputDate(iso: string | null): string {
  if (!iso) return "";
  return iso.slice(0, 10);
}

// ─── Persistencia de filtros ────────────────────────────────────────────────

type PersistedFilters = {
  stage: UteStage | "ALL";
  status: UteStatus | "ALL";
  search: string;
};

function loadFilters(): PersistedFilters {
  if (typeof window === "undefined") return { stage: "ALL", status: "ALL", search: "" };
  try {
    const raw = window.localStorage.getItem(FILTER_STORAGE_KEY);
    if (!raw) return { stage: "ALL", status: "ALL", search: "" };
    const parsed = JSON.parse(raw);
    return {
      stage: parsed.stage ?? "ALL",
      status: parsed.status ?? "ALL",
      search: parsed.search ?? "",
    };
  } catch {
    return { stage: "ALL", status: "ALL", search: "" };
  }
}

function saveFilters(f: PersistedFilters) {
  try {
    window.localStorage.setItem(FILTER_STORAGE_KEY, JSON.stringify(f));
  } catch {
    // noop
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
  const [selectedId, setSelectedId] = useState<string | null>(searchParams.get("id"));
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
        <EmptyState
          title="Sin trámites"
          description="No hay trámites UTE que coincidan con los filtros."
        />
      ) : view === "table" ? (
        <UteTable processes={processes} onRowClick={(id) => setSelectedId(id)} />
      ) : (
        <UteKanbanPlaceholder processes={processes} onCardClick={(id) => setSelectedId(id)} />
      )}

      {/* Drawer detalle */}
      {selected ? (
        <UteDetailDrawer
          process={selected}
          onClose={() => setSelectedId(null)}
        />
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
            <th className="px-3 py-2 text-left font-mono">Teléfono</th>
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
  const [editingKey, setEditingKey] = useState<UteActionKey | null>(null);
  const stageColor = STAGE_COLORS[process.currentStage];
  const statusColor = STATUS_COLORS[process.currentStatus];

  return (
    <tr className="hover:bg-[var(--color-bg-card-hover)]">
      <td
        className="sticky left-0 z-10 cursor-pointer bg-[var(--color-bg-card)] px-3 py-2 font-semibold text-[var(--color-text-primary)] hover:bg-[var(--color-bg-card-hover)]"
        onClick={() => onRowClick(process.id)}
      >
        <div className="truncate max-w-[180px]">{process.project.clientName}</div>
        <div className="font-mono text-[10px] text-[var(--color-text-muted)]">{process.project.code}</div>
      </td>
      <td className="px-3 py-2 cursor-pointer" onClick={() => onRowClick(process.id)}>
        <span
          className="inline-block rounded px-2 py-0.5 font-mono text-[10px] font-bold uppercase tracking-wider whitespace-nowrap"
          style={{ background: stageColor.bg, color: stageColor.text }}
        >
          {UTE_STAGE_LABEL[process.currentStage]}
        </span>
      </td>
      <td className="px-3 py-2 cursor-pointer" onClick={() => onRowClick(process.id)}>
        <span
          className="inline-block rounded px-2 py-0.5 text-[10px] font-semibold whitespace-nowrap"
          style={{ background: statusColor.bg, color: statusColor.text }}
        >
          {UTE_STATUS_LABEL[process.currentStatus]}
        </span>
      </td>
      <td className="px-3 py-2 font-mono text-[11px] text-[var(--color-text-secondary)] cursor-pointer" onClick={() => onRowClick(process.id)}>
        {process.caseNumber ?? "—"}
      </td>
      <td className="px-3 py-2 text-[var(--color-text-secondary)] cursor-pointer" onClick={() => onRowClick(process.id)}>
        {process.project.notificationPhone ?? "—"}
      </td>
      {TABLE_DATE_COLUMNS.map((c) => {
        const value = process[c.key];
        const filled = !!value;
        return (
          <td
            key={c.key}
            className="px-1 py-1 text-center"
            style={filled ? { background: "rgba(16,185,129,0.10)" } : undefined}
          >
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                setEditingKey(c.key);
              }}
              className="w-full rounded px-1 py-1 text-[11px] font-mono hover:bg-[var(--color-bg-card-hover)]"
              title={c.label}
              style={{ color: filled ? "var(--color-state-done-text)" : "var(--color-text-muted)" }}
            >
              {fmtShort(value)}
            </button>
          </td>
        );
      })}
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
      <td className="px-3 py-2 max-w-[200px] cursor-pointer" onClick={() => onRowClick(process.id)}>
        <div className="truncate text-[var(--color-text-secondary)]" title={process.notes ?? undefined}>
          {process.notes ?? "—"}
        </div>
      </td>

      {editingKey ? (
        <MiniDateEditor
          processId={process.id}
          fieldKey={editingKey}
          label={TABLE_DATE_COLUMNS.find((c) => c.key === editingKey)!.label}
          currentValue={process[editingKey]}
          onClose={() => setEditingKey(null)}
        />
      ) : null}
    </tr>
  );
}

// ─── Mini editor de fecha ───────────────────────────────────────────────────

function MiniDateEditor({
  processId,
  fieldKey,
  label,
  currentValue,
  onClose,
}: {
  processId: string;
  fieldKey: UteActionKey;
  label: string;
  currentValue: string | null;
  onClose: () => void;
}) {
  const [value, setValue] = useState(toInputDate(currentValue));
  const qc = useQueryClient();

  const save = useMutation({
    mutationFn: (v: string | null) => patchUteProcess(processId, { [fieldKey]: v } as any),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["ute-processes"] });
      toast.success("Fecha actualizada");
      onClose();
    },
    onError: (e: any) => {
      const msg = e?.response?.data?.error?.message ?? "No se pudo guardar";
      toast.error(msg);
    },
  });

  return (
    <td colSpan={100} className="p-0">
      <div
        className="fixed inset-0 z-50 flex items-center justify-center bg-black/50"
        onClick={(e) => {
          if (e.target === e.currentTarget) onClose();
        }}
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
              <Button
                variant="ghost"
                size="sm"
                onClick={() => save.mutate(null)}
                loading={save.isPending}
              >
                Limpiar
              </Button>
            ) : (
              <span />
            )}
            <div className="flex gap-2">
              <Button variant="secondary" size="sm" onClick={onClose}>Cancelar</Button>
              <Button
                size="sm"
                onClick={() => save.mutate(value || null)}
                loading={save.isPending}
                disabled={!value}
              >
                Guardar
              </Button>
            </div>
          </div>
        </div>
      </div>
    </td>
  );
}

// ─── Kanban placeholder (se implementa en Fase C con dnd-kit) ───────────────

function UteKanbanPlaceholder({
  processes,
  onCardClick,
}: {
  processes: UteProcess[];
  onCardClick: (id: string) => void;
}) {
  const byStage = useMemo(() => {
    const map = new Map<UteStage, UteProcess[]>();
    for (const s of UTE_STAGE_ORDER) map.set(s, []);
    for (const p of processes) map.get(p.currentStage)?.push(p);
    return map;
  }, [processes]);

  return (
    <div className="overflow-x-auto">
      <div className="flex gap-3 pb-2" style={{ minWidth: "max-content" }}>
        {UTE_STAGE_ORDER.map((stage) => {
          const items = byStage.get(stage) ?? [];
          const c = STAGE_COLORS[stage];
          return (
            <div
              key={stage}
              className="flex w-[260px] shrink-0 flex-col rounded-xl border border-[var(--color-border)] bg-[var(--color-bg-card)]"
              style={{ borderTop: `3px solid ${c.text}` }}
            >
              <div className="border-b border-[var(--color-border)] px-3 py-2">
                <div className="font-display text-sm font-semibold text-[var(--color-text-primary)]">
                  {UTE_STAGE_LABEL[stage]}
                </div>
                <div className="text-[11px] text-[var(--color-text-muted)]">{items.length} trámites</div>
              </div>
              <div className="flex-1 space-y-2 p-2">
                {items.length === 0 ? (
                  <p className="py-6 text-center text-[11px] text-[var(--color-text-muted)]">Sin trámites</p>
                ) : (
                  items.map((p) => (
                    <button
                      key={p.id}
                      type="button"
                      onClick={() => onCardClick(p.id)}
                      className="block w-full rounded-lg border border-[var(--color-border)] bg-[var(--color-bg-app)] p-2.5 text-left transition-colors hover:bg-[var(--color-bg-card-hover)]"
                    >
                      <div className="mb-1 text-[12px] font-semibold text-[var(--color-text-primary)] line-clamp-1">
                        {p.project.clientName}
                      </div>
                      <div className="mb-1.5">
                        <span
                          className="inline-block rounded px-1.5 py-0.5 text-[9px] font-semibold"
                          style={{ background: STATUS_COLORS[p.currentStatus].bg, color: STATUS_COLORS[p.currentStatus].text }}
                        >
                          {UTE_STATUS_LABEL[p.currentStatus]}
                        </span>
                      </div>
                      {p.notes ? (
                        <p className="mb-1 line-clamp-1 text-[11px] text-[var(--color-text-secondary)]">{p.notes}</p>
                      ) : null}
                      <div className="flex items-center justify-between text-[10px] text-[var(--color-text-muted)]">
                        <span>{p.totalDays} días</span>
                        {p.caseNumber ? <span className="font-mono">#{p.caseNumber}</span> : null}
                      </div>
                    </button>
                  ))
                )}
              </div>
            </div>
          );
        })}
      </div>
      <p className="mt-3 text-[11px] text-[var(--color-text-muted)]">
        Drag & drop entre columnas disponible en la próxima versión.
      </p>
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
  const [notesValue, setNotesValue] = useState(process.notes ?? "");
  const [caseValue, setCaseValue] = useState(process.caseNumber ?? "");

  useEffect(() => setNotesValue(process.notes ?? ""), [process.notes]);
  useEffect(() => setCaseValue(process.caseNumber ?? ""), [process.caseNumber]);

  const patch = useMutation({
    mutationFn: (body: any) => patchUteProcess(process.id, body),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["ute-processes"] });
      toast.success("Guardado");
    },
    onError: (e: any) => {
      const msg = e?.response?.data?.error?.message ?? "No se pudo guardar";
      toast.error(msg);
    },
  });

  const del = useMutation({
    mutationFn: () => deleteUteProcess(process.id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["ute-processes"] });
      toast.success("Trámite eliminado");
      onClose();
    },
    onError: () => toast.error("No se pudo eliminar"),
  });

  function saveDateField(key: UteActionKey, value: string) {
    patch.mutate({ [key]: value || null });
  }

  const completedPct = process.totalDays > 0 ? Math.round((process.ourTimeDays / process.totalDays) * 100) : 0;
  const utePct = process.totalDays > 0 ? 100 - completedPct : 0;
  const invariantOk = process.totalDays === process.ourTimeDays + process.uteTimeDays;

  return (
    <div className="fixed inset-0 z-40 flex">
      <div className="flex-1 bg-black/50" onClick={onClose} />
      <aside
        className="flex w-full max-w-xl flex-col overflow-y-auto border-l border-[var(--color-border)] bg-[var(--color-bg-app)] shadow-2xl"
        role="dialog"
        aria-label="Detalle del trámite UTE"
      >
        {/* Header */}
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
                  style={{ background: STAGE_COLORS[process.currentStage].bg, color: STAGE_COLORS[process.currentStage].text }}
                >
                  {UTE_STAGE_LABEL[process.currentStage]}
                </span>
                <span
                  className="rounded px-2 py-0.5 text-[10px] font-semibold"
                  style={{ background: STATUS_COLORS[process.currentStatus].bg, color: STATUS_COLORS[process.currentStatus].text }}
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

        {/* Pipeline visual */}
        <div className="border-b border-[var(--color-border)] px-5 py-4">
          <div className="flex items-center gap-0.5">
            {UTE_STAGE_ORDER.map((stage, idx) => {
              const pos = UTE_STAGE_ORDER.indexOf(process.currentStage);
              const reached = idx <= pos && process.currentStage !== "RELEVAR";
              const isCurrent = stage === process.currentStage;
              return (
                <div key={stage} className="flex-1">
                  <div
                    className="h-1.5 rounded-full"
                    style={{
                      background: isCurrent
                        ? "var(--color-accent)"
                        : reached
                          ? "var(--color-state-done-text)"
                          : "var(--color-border)",
                    }}
                  />
                  <div className="mt-1 text-center text-[9px] uppercase tracking-wide text-[var(--color-text-muted)]">
                    {stage === "CONSULTA" ? "1" : stage === "SOLICITUD" ? "2" : stage === "DOCS_1" ? "3" : stage === "DOCS_2" ? "4" : stage === "RELEVAR" ? "5" : stage === "ENSAYOS" ? "6" : "7"}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Fechas */}
        <div className="border-b border-[var(--color-border)] px-5 py-4">
          <h3 className="mb-3 font-mono text-[10px] uppercase tracking-widest text-[var(--color-text-muted)]">
            Fechas de acciones
          </h3>
          <div className="space-y-2">
            {UTE_ACTIONS_ORDERED.map((a) => {
              const Icon = a.side === "ours" ? Send : Inbox;
              const value = process[a.key];
              return (
                <div
                  key={a.key}
                  className="flex items-center gap-3 rounded-lg border border-[var(--color-border)] bg-[var(--color-bg-card)] px-3 py-2"
                >
                  <Icon
                    size={14}
                    className={a.side === "ours" ? "text-[#60a5fa]" : "text-[#34d399]"}
                    aria-label={a.side === "ours" ? "Nuestro" : "De UTE"}
                  />
                  <label className="flex-1 text-xs text-[var(--color-text-secondary)]">{a.label}</label>
                  <input
                    type="date"
                    value={toInputDate(value)}
                    onBlur={(e) => {
                      const next = e.target.value;
                      if (next !== toInputDate(value)) saveDateField(a.key, next);
                    }}
                    onChange={(e) => {
                      // controlled-ish: saveDateField en blur evita spam
                      e.target.value;
                    }}
                    defaultValue={toInputDate(value)}
                    className="rounded border border-[var(--color-border)] bg-[var(--color-bg-app)] px-2 py-1 text-xs text-[var(--color-text-primary)] focus:border-[var(--color-accent)] focus:outline-none"
                  />
                  {value ? (
                    <button
                      type="button"
                      onClick={() => saveDateField(a.key, "")}
                      className="rounded p-1 text-[var(--color-text-muted)] hover:bg-[var(--color-bg-card-hover)] hover:text-red-400"
                      title="Limpiar fecha"
                    >
                      <X size={12} />
                    </button>
                  ) : null}
                </div>
              );
            })}
          </div>
        </div>

        {/* Notas */}
        <div className="border-b border-[var(--color-border)] px-5 py-4">
          <h3 className="mb-2 font-mono text-[10px] uppercase tracking-widest text-[var(--color-text-muted)]">
            Notas
          </h3>
          <textarea
            value={notesValue}
            onChange={(e) => setNotesValue(e.target.value)}
            onBlur={() => {
              if (notesValue !== (process.notes ?? "")) patch.mutate({ notes: notesValue || null });
            }}
            rows={3}
            className="w-full rounded-md border border-[var(--color-border)] bg-[var(--color-bg-card)] px-3 py-2 text-sm text-[var(--color-text-primary)] focus:border-[var(--color-accent)] focus:outline-none"
            placeholder="Agregá una nota…"
          />
        </div>

        {/* Caso */}
        <div className="border-b border-[var(--color-border)] px-5 py-4">
          <h3 className="mb-2 font-mono text-[10px] uppercase tracking-widest text-[var(--color-text-muted)]">
            Datos del caso
          </h3>
          <label className="block text-xs text-[var(--color-text-secondary)]">
            Número de caso UTE
            <input
              type="text"
              value={caseValue}
              onChange={(e) => setCaseValue(e.target.value)}
              onBlur={() => {
                if (caseValue !== (process.caseNumber ?? "")) patch.mutate({ caseNumber: caseValue.trim() || null });
              }}
              className="mt-1 w-full rounded-md border border-[var(--color-border)] bg-[var(--color-bg-card)] px-3 py-2 text-sm text-[var(--color-text-primary)] focus:border-[var(--color-accent)] focus:outline-none"
              placeholder="UTE-2026-…"
            />
          </label>
          <p className="mt-2 text-[11px] text-[var(--color-text-muted)]">
            Teléfono: {process.project.notificationPhone ?? "—"}
          </p>
        </div>

        {/* Métricas */}
        <div className="border-b border-[var(--color-border)] px-5 py-4">
          <h3 className="mb-2 font-mono text-[10px] uppercase tracking-widest text-[var(--color-text-muted)]">
            Métricas del trámite
          </h3>
          <div className="grid grid-cols-3 gap-3 text-center">
            <div className="rounded-lg border border-[var(--color-border)] bg-[var(--color-bg-card)] p-3">
              <div className="font-display text-xl font-bold text-[var(--color-text-primary)]">{process.totalDays}</div>
              <div className="text-[10px] uppercase tracking-widest text-[var(--color-text-muted)]">Total (días)</div>
            </div>
            <div className="rounded-lg border border-[var(--color-border)] bg-[var(--color-bg-card)] p-3">
              <div className="font-display text-xl font-bold" style={{ color: "#f87171" }}>{process.ourTimeDays}</div>
              <div className="text-[10px] uppercase tracking-widest text-[var(--color-text-muted)]">Nuestro ({completedPct}%)</div>
            </div>
            <div className="rounded-lg border border-[var(--color-border)] bg-[var(--color-bg-card)] p-3">
              <div className="font-display text-xl font-bold" style={{ color: "#60a5fa" }}>{process.uteTimeDays}</div>
              <div className="text-[10px] uppercase tracking-widest text-[var(--color-text-muted)]">UTE ({utePct}%)</div>
            </div>
          </div>
          <p className="mt-2 text-[11px] text-[var(--color-text-muted)]">
            {invariantOk ? "✓" : "⚠"} Verificación: nuestro + UTE = total
          </p>
        </div>

        {/* Footer */}
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
          ) : <span />}
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
    onError: (e: any) => {
      const msg = e?.response?.data?.error?.message ?? "No se pudo crear el trámite";
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

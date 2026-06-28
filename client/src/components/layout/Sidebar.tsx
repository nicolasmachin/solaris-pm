import { memo, useEffect, useMemo, useState } from "react";
import { NavLink } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { getProjects } from "../../api/projects.api";
import type { ProjectListItem } from "../../types/api.types";
import { NewProjectModal } from "../project/NewProjectModal";

type StatusFilter = "all" | "active" | "prospect" | "completed" | "paused";
type SortKey =
  | "recent"
  | "oldest"
  | "installation_asc"
  | "installation_desc"
  | "progress_desc"
  | "progress_asc"
  | "az"
  | "za";
type StageFilter =
  | "all"
  | "ONBOARDING"
  | "INGENIERIA"
  | "OPERACIONES"
  | "HABILITACION_UTE"
  | "POSTVENTA";

const STATUS_OPTIONS: { value: StatusFilter; label: string }[] = [
  { value: "all", label: "Todos" },
  { value: "active", label: "En ejecución" },
  { value: "prospect", label: "En cotización" },
  { value: "completed", label: "Completado" },
  { value: "paused", label: "Pausado" },
];

const SORT_OPTIONS: { value: SortKey; label: string }[] = [
  { value: "recent", label: "Más recientes" },
  { value: "oldest", label: "Más antiguos" },
  { value: "installation_asc", label: "Próxima instalación" },
  { value: "installation_desc", label: "Última instalación" },
  { value: "progress_desc", label: "Más avanzados" },
  { value: "progress_asc", label: "Menos avanzados" },
  { value: "az", label: "Alfabético A-Z" },
  { value: "za", label: "Alfabético Z-A" },
];

const STAGE_OPTIONS: { value: StageFilter; label: string }[] = [
  { value: "all", label: "Todas las etapas" },
  { value: "ONBOARDING", label: "Onboarding" },
  { value: "INGENIERIA", label: "Ingeniería" },
  { value: "OPERACIONES", label: "Operaciones" },
  { value: "HABILITACION_UTE", label: "Habilitación UTE" },
  { value: "POSTVENTA", label: "Post-Habilitación" },
];

const STAGE_LABELS: Record<string, string> = {
  ONBOARDING: "Onboarding",
  INGENIERIA: "Ingeniería",
  OPERACIONES: "Operaciones",
  HABILITACION_UTE: "Habilitación UTE",
  POSTVENTA: "Post-Habilitación",
};

// Persistencia en localStorage
const FILTER_STORAGE_KEY = "projects-sidebar-filter";
interface PersistedFilter {
  statusFilter: StatusFilter;
  stageFilter: StageFilter;
  sortKey: SortKey;
}

function loadPersistedFilter(): PersistedFilter | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(FILTER_STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as PersistedFilter;
    return parsed;
  } catch {
    return null;
  }
}

function savePersistedFilter(f: PersistedFilter) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(FILTER_STORAGE_KEY, JSON.stringify(f));
  } catch {
    // ignore
  }
}

function matchesStatus(p: ProjectListItem, filter: StatusFilter): boolean {
  if (filter === "all") return true;
  if (filter === "active") return ["ACTIVE", "PLANNING", "IN_PROGRESS"].includes(p.status);
  if (filter === "prospect") return p.status === "PROSPECT";
  if (filter === "completed") return p.status === "COMPLETED";
  if (filter === "paused") return ["PAUSED", "ON_HOLD", "CANCELLED"].includes(p.status);
  return true;
}

function matchesStage(p: ProjectListItem, filter: StageFilter): boolean {
  if (filter === "all") return true;
  return (p.currentStages ?? []).includes(filter);
}

function sortProjects(list: ProjectListItem[], key: SortKey): ProjectListItem[] {
  const copy = [...list];
  switch (key) {
    case "recent":
      return copy.sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());
    case "oldest":
      return copy.sort(
        (a, b) => new Date(a.createdAt ?? a.updatedAt).getTime() - new Date(b.createdAt ?? b.updatedAt).getTime(),
      );
    case "installation_asc":
      // Nulls al final
      return copy.sort((a, b) => {
        if (a.plannedWorkStart && b.plannedWorkStart) return a.plannedWorkStart.localeCompare(b.plannedWorkStart);
        if (a.plannedWorkStart) return -1;
        if (b.plannedWorkStart) return 1;
        return 0;
      });
    case "installation_desc":
      return copy.sort((a, b) => {
        if (a.plannedWorkStart && b.plannedWorkStart) return b.plannedWorkStart.localeCompare(a.plannedWorkStart);
        if (a.plannedWorkStart) return -1;
        if (b.plannedWorkStart) return 1;
        return 0;
      });
    case "progress_desc":
      return copy.sort((a, b) => b.completionPercent - a.completionPercent);
    case "progress_asc":
      return copy.sort((a, b) => a.completionPercent - b.completionPercent);
    case "az":
      return copy.sort((a, b) => a.clientName.localeCompare(b.clientName, "es"));
    case "za":
      return copy.sort((a, b) => b.clientName.localeCompare(a.clientName, "es"));
    default:
      return copy;
  }
}

// Color de la barra de progreso según % (visualización rápida).
function progressBarClass(pct: number): string {
  if (pct >= 100) return "bg-[#1F7A3A]";   // verde oscuro
  if (pct >= 66) return "bg-emerald-500";   // verde
  if (pct >= 33) return "bg-sky-500";       // azul
  return "bg-[var(--color-text-muted)]";    // muted
}

function ProjectSkeleton() {
  return (
    <div className="px-3 py-3 space-y-2">
      <div className="skeleton h-3 w-3/4 rounded" />
      <div className="skeleton h-2 w-1/2 rounded" />
      <div className="skeleton h-1 w-full rounded" />
    </div>
  );
}

interface SidebarProps {
  open: boolean;
  onClose: () => void;
}

export const Sidebar = memo(function Sidebar({ open, onClose }: SidebarProps) {
  const { data: projects, isLoading } = useQuery({
    queryKey: ["projects"],
    queryFn: () => getProjects(),
    staleTime: 60_000,
  });

  const persisted = useMemo(loadPersistedFilter, []);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>(
    persisted?.statusFilter ?? "active",
  );
  const [stageFilter, setStageFilter] = useState<StageFilter>(
    persisted?.stageFilter ?? "all",
  );
  const [sortKey, setSortKey] = useState<SortKey>(persisted?.sortKey ?? "recent");
  const [showModal, setShowModal] = useState(false);

  // Persistir filtros al cambiar
  useEffect(() => {
    savePersistedFilter({ statusFilter, stageFilter, sortKey });
  }, [statusFilter, stageFilter, sortKey]);

  const filtered = useMemo(() => {
    const all = projects ?? [];
    const q = search.trim().toLowerCase();
    const byStatus = all.filter((p) => matchesStatus(p, statusFilter));
    const byStage = byStatus.filter((p) => matchesStage(p, stageFilter));
    const bySearch = q
      ? byStage.filter(
          (p) =>
            p.clientName.toLowerCase().includes(q) ||
            p.code.toLowerCase().includes(q),
        )
      : byStage;
    return sortProjects(bySearch, sortKey);
  }, [projects, search, statusFilter, stageFilter, sortKey]);

  const total = (projects ?? []).length;
  const showing = filtered.length;

  return (
    <>
      {/* Mobile overlay */}
      {open && (
        <div
          className="fixed inset-0 bg-black/50 z-30 md:hidden"
          onClick={onClose}
        />
      )}

      <aside
        className={`
          fixed left-0 bottom-0 z-30 flex flex-col
          bg-[var(--color-bg-sidebar)] border-r border-[var(--color-border)]
          transition-transform duration-200 overflow-y-auto
          md:translate-x-0
          ${open ? "translate-x-0" : "-translate-x-full md:translate-x-0"}
        `}
        style={{ top: 52, width: 220 }}
      >
        {/* Header with "Nuevo" button */}
        <div className="flex items-center justify-between px-3 pt-3 pb-1">
          <p className="text-[9px] font-mono font-medium uppercase tracking-widest text-[var(--color-text-muted)]">
            Clientes activos
          </p>
          <button
            type="button"
            onClick={() => setShowModal(true)}
            className="flex items-center gap-1 rounded bg-[var(--color-accent)] px-2 py-0.5 text-[10px] font-semibold text-black hover:opacity-90 transition-opacity"
          >
            <span className="text-[12px] leading-none">+</span> Nuevo
          </button>
        </div>

        {/* Controls */}
        <div className="px-2 pb-2 space-y-1.5 border-b border-[var(--color-border)]">
          <input
            type="search"
            placeholder="Buscar..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full rounded border border-[var(--color-border)] bg-[var(--color-bg-app)] px-2 py-1 text-[11px] text-[var(--color-text-primary)] placeholder:text-[var(--color-text-muted)] focus:border-[var(--color-accent)] focus:outline-none"
          />
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value as StatusFilter)}
            className="w-full rounded border border-[var(--color-border)] bg-[var(--color-bg-app)] px-2 py-1 text-[11px] text-[var(--color-text-primary)] focus:border-[var(--color-accent)] focus:outline-none"
          >
            {STATUS_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>{o.label}</option>
            ))}
          </select>
          <select
            value={stageFilter}
            onChange={(e) => setStageFilter(e.target.value as StageFilter)}
            className="w-full rounded border border-[var(--color-border)] bg-[var(--color-bg-app)] px-2 py-1 text-[11px] text-[var(--color-text-primary)] focus:border-[var(--color-accent)] focus:outline-none"
            aria-label="Filtrar por etapa en proceso"
          >
            {STAGE_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>{o.label}</option>
            ))}
          </select>
          <select
            value={sortKey}
            onChange={(e) => setSortKey(e.target.value as SortKey)}
            className="w-full rounded border border-[var(--color-border)] bg-[var(--color-bg-app)] px-2 py-1 text-[11px] text-[var(--color-text-primary)] focus:border-[var(--color-accent)] focus:outline-none"
          >
            {SORT_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>{o.label}</option>
            ))}
          </select>
          {!isLoading && (
            <p className="text-[10px] text-[var(--color-text-muted)] text-right">
              {showing === total ? `${total} proyectos` : `${showing} de ${total} proyectos`}
            </p>
          )}
        </div>

        {/* List */}
        <div className="flex-1 pt-2 pb-4">
          {isLoading && (
            <>
              <ProjectSkeleton />
              <ProjectSkeleton />
              <ProjectSkeleton />
            </>
          )}

          {!isLoading && filtered.length === 0 && (
            <p className="px-3 pt-4 text-[11px] text-center text-[var(--color-text-muted)]">
              Sin proyectos que coincidan con el filtro
            </p>
          )}

          {filtered.map((project) => (
            <ProjectItem key={project.id} project={project} onClick={onClose} />
          ))}
        </div>
      </aside>

      {showModal && (
        <NewProjectModal onClose={() => setShowModal(false)} />
      )}
    </>
  );
});

function ProjectItem({
  project,
  onClick,
}: {
  project: ProjectListItem;
  onClick: () => void;
}) {
  const primaryStage = project.currentStages?.[0] ?? null;
  const stageLabel = primaryStage
    ? `${STAGE_LABELS[primaryStage] ?? primaryStage} en curso`
    : project.currentStage?.label ?? project.currentStage?.name ?? "Sin etapa";

  return (
    <NavLink
      to={`/projects/${project.id}`}
      onClick={onClick}
      className={({ isActive }) =>
        `block px-3 py-3 transition-colors border-l-2 ${
          isActive
            ? "bg-[var(--color-bg-card-hover)] border-l-[var(--color-accent)]"
            : "border-l-transparent hover:bg-[var(--color-bg-card-hover)]"
        }`
      }
    >
      <div className="flex items-center gap-1.5">
        <p className="truncate text-xs font-medium leading-snug text-[var(--color-text-primary)]">
          {project.clientName}
        </p>
      </div>
      <p className="text-[10px] font-mono text-[var(--color-text-muted)] mt-0.5 truncate">
        {project.capacityKwp} kWp
      </p>
      <p className="text-[10px] text-[var(--color-text-secondary)] mt-0.5 truncate">
        {stageLabel}
      </p>
      {/* Barra de progreso con color progresivo según completionPercent */}
      <div
        className="mt-1.5 h-[3px] w-full overflow-hidden rounded-full bg-[var(--color-border)]"
        title={`${project.completionPercent}% completado`}
      >
        <div
          className={`h-full rounded-full transition-all ${progressBarClass(project.completionPercent)}`}
          style={{ width: `${project.completionPercent}%` }}
        />
      </div>
    </NavLink>
  );
}

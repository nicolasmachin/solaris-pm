import { memo, useMemo, useState } from "react";
import { NavLink } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { getProjects } from "../../api/projects.api";
import { ProgressBar } from "../ui/ProgressBar";
import type { ProjectListItem } from "../../types/api.types";
import { NewProjectModal } from "../project/NewProjectModal";

type StatusFilter = "all" | "active" | "prospect" | "completed" | "paused";
type SortKey = "recent" | "oldest" | "progress_desc" | "progress_asc" | "az" | "za";

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
  { value: "progress_desc", label: "Mayor avance" },
  { value: "progress_asc", label: "Menor avance" },
  { value: "az", label: "A → Z" },
  { value: "za", label: "Z → A" },
];

function matchesStatus(p: ProjectListItem, filter: StatusFilter): boolean {
  if (filter === "all") return true;
  if (filter === "active") return ["ACTIVE", "PLANNING", "IN_PROGRESS"].includes(p.status);
  if (filter === "prospect") return p.status === "PROSPECT";
  if (filter === "completed") return p.status === "COMPLETED";
  if (filter === "paused") return ["PAUSED", "ON_HOLD", "CANCELLED"].includes(p.status);
  return true;
}

function sortProjects(list: ProjectListItem[], key: SortKey): ProjectListItem[] {
  const copy = [...list];
  switch (key) {
    case "recent":
      return copy.sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());
    case "oldest":
      return copy.sort((a, b) => new Date(a.updatedAt).getTime() - new Date(b.updatedAt).getTime());
    case "progress_desc":
      return copy.sort((a, b) => b.progressPercent - a.progressPercent);
    case "progress_asc":
      return copy.sort((a, b) => a.progressPercent - b.progressPercent);
    case "az":
      return copy.sort((a, b) => a.clientName.localeCompare(b.clientName, "es"));
    case "za":
      return copy.sort((a, b) => b.clientName.localeCompare(a.clientName, "es"));
    default:
      return copy;
  }
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
    queryFn: getProjects,
    staleTime: 60_000,
  });

  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("active");
  const [sortKey, setSortKey] = useState<SortKey>("recent");
  const [showModal, setShowModal] = useState(false);

  const filtered = useMemo(() => {
    const all = projects ?? [];
    const q = search.trim().toLowerCase();
    const byStatus = all.filter((p) => matchesStatus(p, statusFilter));
    const bySearch = q
      ? byStatus.filter(
          (p) =>
            p.clientName.toLowerCase().includes(q) ||
            p.code.toLowerCase().includes(q),
        )
      : byStatus;
    return sortProjects(bySearch, sortKey);
  }, [projects, search, statusFilter, sortKey]);

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
  const showDelayAlert = project.delayDays > 5;
  const showOverdueStageAlert = Boolean(project.hasOverdueStage);
  const tooltip = [
    showDelayAlert ? `Proyecto con desvío acumulado de ${project.delayDays} días` : null,
    showOverdueStageAlert ? "Tiene una etapa vencida que sigue en curso" : null,
  ]
    .filter(Boolean)
    .join(" · ");

  return (
    <NavLink
      to={`/projects/${project.id}`}
      onClick={onClick}
      title={tooltip || undefined}
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
        {showDelayAlert ? <span className="text-xs text-[var(--color-accent)]">⚠</span> : null}
        {showOverdueStageAlert ? <span className="inline-block h-2 w-2 rounded-full bg-[var(--color-alert-dot)]" /> : null}
      </div>
      <p className="text-[10px] font-mono text-[var(--color-text-muted)] mt-0.5 truncate">
        {project.capacityKwp} kWp · {project.currentStage?.label ?? project.currentStage?.name ?? "Sin etapa"}
      </p>
      <ProgressBar value={project.progressPercent} height={3} className="mt-1.5" />
    </NavLink>
  );
}

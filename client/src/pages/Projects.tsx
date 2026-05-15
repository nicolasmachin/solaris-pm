import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "react-hot-toast";
import { deleteProject, getProjects, patchProject } from "../api/projects.api";
import { NewProjectModal } from "../components/project/NewProjectModal";
import { Badge } from "../components/ui/Badge";
import { Button } from "../components/ui/Button";
import { EmptyState } from "../components/ui/EmptyState";
import { ProgressBar } from "../components/ui/ProgressBar";
import { Spinner } from "../components/ui/Spinner";
import { MultiSelectFilter } from "../components/ui/MultiSelectFilter";
import type { ProjectListItem, ProjectStatus, SolarSystem } from "../types/api.types";
import { getProjectTeamColor, getProjectTeamName, getProjectTeamType } from "../components/project/projectTeamColor";
import {
  formatSolarSystemPanels,
  formatSolarSystemPrimary,
  getPhaseTypeShortLabel,
} from "../components/project/SolarSystemFields";

type SortKey =
  | "client"
  | "location"
  | "status"
  | "progress"
  | "currentStage"
  | "installationDate"
  | "inverter"
  | "panels"
  | "dates"
  | "saleDate";
type SortDirection = "asc" | "desc";

type StageFilter =
  | "all"
  | "ONBOARDING"
  | "INGENIERIA"
  | "OPERACIONES"
  | "HABILITACION_UTE"
  | "POSTVENTA";

const STATUS_OPTIONS: Array<{ value: ProjectStatus; label: string }> = [
  { value: "ACTIVE", label: "Activos" },
  { value: "PROSPECT", label: "Prospectos" },
  { value: "COMPLETED", label: "Completados" },
  { value: "PAUSED", label: "Pausados" },
  { value: "ARCHIVED", label: "Archivados" },
];

// Por defecto se muestran todos los estados EXCEPTO completados — los
// proyectos completados rara vez interesan en el día a día.
const DEFAULT_STATUSES: ProjectStatus[] = ["PROSPECT", "ACTIVE", "PAUSED", "ARCHIVED"];

const STAGE_OPTIONS: Array<{ value: StageFilter; label: string }> = [
  { value: "all", label: "Todas las etapas" },
  { value: "ONBOARDING", label: "Onboarding" },
  { value: "INGENIERIA", label: "Ingeniería" },
  { value: "OPERACIONES", label: "Operaciones" },
  { value: "HABILITACION_UTE", label: "Habilitación UTE" },
  { value: "POSTVENTA", label: "Postventa" },
];

const STAGE_LABELS: Record<string, string> = {
  ONBOARDING: "Onboarding",
  INGENIERIA: "Ingeniería",
  OPERACIONES: "Operaciones",
  HABILITACION_UTE: "Habilitación UTE",
  POSTVENTA: "Postventa",
};

// Persistencia local de filtros de la página
const PAGE_FILTER_KEY = "projects-page-filter";
interface PagePersistedFilter {
  // Antes era single value; ahora multi-select como array.
  statusFilters: ProjectStatus[];
  stageFilter: StageFilter;
  sortKey: SortKey;
  sortDirection: SortDirection;
}

function loadPageFilter(): PagePersistedFilter | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(PAGE_FILTER_KEY);
    if (!raw) return null;
    return JSON.parse(raw) as PagePersistedFilter;
  } catch {
    return null;
  }
}

function savePageFilter(f: PagePersistedFilter) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(PAGE_FILTER_KEY, JSON.stringify(f));
  } catch {
    // ignore
  }
}

function progressBarClass(pct: number): string {
  if (pct >= 100) return "bg-[#1F7A3A]";
  if (pct >= 66) return "bg-emerald-500";
  if (pct >= 33) return "bg-sky-500";
  return "bg-[var(--color-text-muted)]";
}

function formatDate(date: string | null) {
  if (!date) return "—";
  return new Intl.DateTimeFormat("es-UY", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  }).format(new Date(`${date}T00:00:00`));
}

function compareText(a: string, b: string) {
  return a.localeCompare(b, "es", { sensitivity: "base" });
}

function getPrimarySolarSystem(project: ProjectListItem) {
  return project.solarSystems[0] ?? null;
}

function getAdditionalSystemsTooltip(systems: SolarSystem[]) {
  if (systems.length <= 1) return undefined;
  return systems
    .slice(1)
    .map((system, index) => {
      const label = system.description || `Sistema ${index + 2}`;
      return `${label}: ${formatSolarSystemPrimary(system)} · ${formatSolarSystemPanels(system)}`;
    })
    .join("\n");
}

function sortProjects(projects: ProjectListItem[], sortKey: SortKey, direction: SortDirection) {
  const multiplier = direction === "asc" ? 1 : -1;

  return [...projects].sort((a, b) => {
    const solarA = getPrimarySolarSystem(a);
    const solarB = getPrimarySolarSystem(b);

    let result = 0;
    switch (sortKey) {
      case "client":
        result = compareText(a.clientName, b.clientName) || compareText(a.code, b.code);
        break;
      case "location":
        result = compareText(`${a.locationProvince} ${a.locationCity}`, `${b.locationProvince} ${b.locationCity}`);
        break;
      case "status":
        result = compareText(a.status, b.status);
        break;
      case "progress":
        result = a.completionPercent - b.completionPercent;
        break;
      case "currentStage": {
        const aStage = a.currentStages?.[0] ?? "";
        const bStage = b.currentStages?.[0] ?? "";
        if (aStage && bStage) result = compareText(aStage, bStage);
        else if (aStage) result = -1;
        else if (bStage) result = 1;
        else result = 0;
        break;
      }
      case "installationDate":
        if (a.plannedWorkStart && b.plannedWorkStart) {
          result = a.plannedWorkStart < b.plannedWorkStart ? -1 : a.plannedWorkStart > b.plannedWorkStart ? 1 : 0;
        } else if (a.plannedWorkStart) result = -1;
        else if (b.plannedWorkStart) result = 1;
        else result = 0;
        break;
      case "inverter":
        result = compareText(formatSolarSystemPrimary(solarA ?? emptySolarSystem), formatSolarSystemPrimary(solarB ?? emptySolarSystem));
        break;
      case "panels":
        result = (solarA?.panelQuantity ?? 0) - (solarB?.panelQuantity ?? 0) || (solarA?.panelPowerW ?? 0) - (solarB?.panelPowerW ?? 0);
        break;
      case "dates":
        result = new Date(a.startDate ?? "2100-01-01").getTime() - new Date(b.startDate ?? "2100-01-01").getTime();
        break;
      case "saleDate":
        // null va al final independientemente de la dirección
        if (a.saleDate && b.saleDate) result = a.saleDate < b.saleDate ? -1 : a.saleDate > b.saleDate ? 1 : 0;
        else if (a.saleDate) result = -1;
        else if (b.saleDate) result = 1;
        else result = 0;
        break;
    }

    return result * multiplier;
  });
}

function teamTypeLabel(type: "PROPIO" | "TERCERIZADO" | null | undefined) {
  if (type === "PROPIO") return "Equipo propio";
  if (type === "TERCERIZADO") return "Tercerizado";
  return "Sin definir";
}

const emptySolarSystem: SolarSystem = {
  id: "empty",
  projectId: "empty",
  order: 1,
  description: null,
  inverterBrand: null,
  inverterPowerKw: null,
  inverterQuantity: null,
  inverterPhaseType: null,
  inverterModel: null,
  panelQuantity: null,
  panelPowerW: null,
  panelBrand: null,
  panelModel: null,
  deletedAt: null,
  createdAt: "",
  updatedAt: "",
};

function SortHeader({
  label,
  sortKey,
  currentSortKey,
  direction,
  onSort,
}: {
  label: string;
  sortKey: SortKey;
  currentSortKey: SortKey;
  direction: SortDirection;
  onSort: (key: SortKey) => void;
}) {
  const active = currentSortKey === sortKey;
  return (
    <button
      type="button"
      onClick={() => onSort(sortKey)}
      className="flex items-center gap-1 text-left text-[11px] font-mono uppercase tracking-widest text-[var(--color-table-header-text)] transition-colors hover:text-white"
    >
      <span>{label}</span>
      <span className={active ? "text-[var(--color-accent)]" : "opacity-40"}>{active && direction === "asc" ? "↑" : "↓"}</span>
    </button>
  );
}

export function Projects() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const persisted = useMemo(loadPageFilter, []);
  const [query, setQuery] = useState("");
  const [statusFilters, setStatusFilters] = useState<Set<ProjectStatus>>(
    () => new Set(persisted?.statusFilters ?? DEFAULT_STATUSES),
  );
  const [stageFilter, setStageFilter] = useState<StageFilter>(persisted?.stageFilter ?? "all");
  const [sortKey, setSortKey] = useState<SortKey>(persisted?.sortKey ?? "client");
  const [sortDirection, setSortDirection] = useState<SortDirection>(persisted?.sortDirection ?? "asc");
  const [showNewProject, setShowNewProject] = useState(false);
  const [projectToDelete, setProjectToDelete] = useState<ProjectListItem | null>(null);

  useEffect(() => {
    savePageFilter({
      statusFilters: Array.from(statusFilters),
      stageFilter,
      sortKey,
      sortDirection,
    });
  }, [statusFilters, stageFilter, sortKey, sortDirection]);

  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ["projects"],
    queryFn: () => getProjects(),
    staleTime: 60_000,
  });

  const archiveMutation = useMutation({
    mutationFn: ({ id, archive }: { id: string; archive: boolean }) =>
      patchProject(id, { status: archive ? "ARCHIVED" : "ACTIVE" }),
    onSuccess: (_, { archive }) => {
      queryClient.invalidateQueries({ queryKey: ["projects"] });
      toast.success(archive ? "Proyecto archivado" : "Proyecto restaurado");
    },
    onError: () => {
      toast.error("No se pudo cambiar el estado del proyecto");
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => deleteProject(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["projects"] });
      queryClient.invalidateQueries({ queryKey: ["metrics"] });
      toast.success("Proyecto eliminado");
      setProjectToDelete(null);
    },
    onError: () => {
      toast.error("No se pudo eliminar el proyecto");
    },
  });

  const projects = data ?? [];

  const filteredProjects = useMemo(() => {
    const term = query.trim().toLowerCase();
    const filtered = projects.filter((project) => {
      // Si no hay estados seleccionados, no se muestra nada (interpretación
      // razonable: el usuario explícitamente vació el filtro).
      const matchesStatus = statusFilters.has(project.status as ProjectStatus);
      const matchesStageFilter =
        stageFilter === "all" ? true : (project.currentStages ?? []).includes(stageFilter);
      const matchesQuery = term
        ? project.clientName.toLowerCase().includes(term) || project.code.toLowerCase().includes(term)
        : true;
      return matchesStatus && matchesStageFilter && matchesQuery;
    });

    return sortProjects(filtered, sortKey, sortDirection);
  }, [projects, query, sortKey, sortDirection, statusFilters, stageFilter]);

  const ownTeamProjects = useMemo(
    () => filteredProjects.filter((project) => getProjectTeamType(project) === "PROPIO"),
    [filteredProjects],
  );
  const outsourcedTeamProjects = useMemo(
    () => filteredProjects.filter((project) => getProjectTeamType(project) === "TERCERIZADO"),
    [filteredProjects],
  );
  const uncategorizedProjects = useMemo(
    () => filteredProjects.filter((project) => getProjectTeamType(project) == null),
    [filteredProjects],
  );

  function handleSort(nextKey: SortKey) {
    if (sortKey === nextKey) {
      setSortDirection((current) => (current === "asc" ? "desc" : "asc"));
      return;
    }
    setSortKey(nextKey);
    // Direcciones default por tipo de columna:
    // - progress → mayor avance primero (desc)
    // - installationDate → próxima primero (asc)
    // - saleDate → venta más reciente primero (desc)
    // - resto → asc
    const defaultDir: SortDirection =
      nextKey === "progress" || nextKey === "saleDate"
        ? "desc"
        : nextKey === "installationDate"
          ? "asc"
          : "asc";
    setSortDirection(defaultDir);
  }

  if (isLoading) {
    return (
      <div className="flex min-h-[40vh] items-center justify-center">
        <Spinner />
      </div>
    );
  }

  if (isError) {
    return (
      <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-bg-card)] p-6">
        <p className="text-sm text-[var(--color-text-secondary)]">No se pudo cargar la lista de proyectos.</p>
        <Button className="mt-4" onClick={() => refetch()}>
          Reintentar
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-4 rounded-xl border border-[var(--color-border)] bg-[var(--color-bg-card)] p-5 md:flex-row md:items-end md:justify-between">
        <div>
          <p className="text-[10px] font-mono uppercase tracking-[0.2em] text-[var(--color-text-muted)]">Proyectos</p>
          <h1 className="mt-1 font-display text-2xl text-[var(--color-text-primary)]">Resumen de cartera</h1>
          <p className="mt-2 text-sm text-[var(--color-text-secondary)]">
            Mostrando {filteredProjects.length} de {projects.length} proyectos
          </p>
        </div>

        <div className="flex flex-col gap-3 md:flex-row md:items-center">
          <input
            type="search"
            placeholder="Buscar por cliente o código"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            className="w-full rounded-md border border-[var(--color-border)] bg-[var(--color-bg-app)] px-3 py-2 text-sm text-[var(--color-text-primary)] placeholder:text-[var(--color-text-muted)] focus:border-[var(--color-accent)] focus:outline-none md:w-72"
          />
          <MultiSelectFilter
            options={STATUS_OPTIONS}
            selected={statusFilters}
            onChange={setStatusFilters}
            buttonLabel="estados"
            allLabel="Todos los estados"
          />
          <select
            value={stageFilter}
            onChange={(event) => setStageFilter(event.target.value as StageFilter)}
            aria-label="Filtrar por etapa en proceso"
            className="rounded-md border border-[var(--color-border)] bg-[var(--color-bg-app)] px-3 py-2 text-sm text-[var(--color-text-primary)] focus:border-[var(--color-accent)] focus:outline-none"
          >
            {STAGE_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
          <Button onClick={() => setShowNewProject(true)}>Nuevo proyecto</Button>
        </div>
      </div>

      {projects.length === 0 ? (
        <div className="rounded-xl border border-dashed border-[var(--color-border)] bg-[var(--color-bg-card)] p-8">
          <EmptyState title="No hay proyectos. Crear el primero." description="Empezá cargando un proyecto y, si querés, también su sistema fotovoltaico." />
          <div className="mt-4 flex justify-center">
            <Button onClick={() => setShowNewProject(true)}>Nuevo proyecto</Button>
          </div>
        </div>
      ) : filteredProjects.length === 0 ? (
        <div className="rounded-xl border border-dashed border-[var(--color-border)] bg-[var(--color-bg-card)] p-8">
          <EmptyState title="No hay proyectos para ese filtro" description="Probá cambiando el estado o la búsqueda." />
        </div>
      ) : (
        <div className="space-y-4">
          <ProjectGroupTable
            title="Proyectos con equipo propio"
            description="Instalaciones asignadas a equipos internos."
            projects={ownTeamProjects}
            sortKey={sortKey}
            sortDirection={sortDirection}
            onSort={handleSort}
            onOpenProject={(id) => navigate(`/projects/${id}`)}
            onArchive={(project) => archiveMutation.mutate({ id: project.id, archive: project.status !== "ARCHIVED" })}
            onDelete={setProjectToDelete}
          />
          <ProjectGroupTable
            title="Proyectos con equipo tercerizado"
            description="Instalaciones asignadas a contratistas o cuadrillas externas."
            projects={outsourcedTeamProjects}
            sortKey={sortKey}
            sortDirection={sortDirection}
            onSort={handleSort}
            onOpenProject={(id) => navigate(`/projects/${id}`)}
            onArchive={(project) => archiveMutation.mutate({ id: project.id, archive: project.status !== "ARCHIVED" })}
            onDelete={setProjectToDelete}
          />
          {uncategorizedProjects.length > 0 ? (
            <ProjectGroupTable
              title="Proyectos sin clasificación de equipo"
              description="Proyectos sin equipo asignado o con equipos todavía sin tipo definido."
              projects={uncategorizedProjects}
              sortKey={sortKey}
              sortDirection={sortDirection}
              onSort={handleSort}
              onOpenProject={(id) => navigate(`/projects/${id}`)}
              onArchive={(project) => archiveMutation.mutate({ id: project.id, archive: project.status !== "ARCHIVED" })}
              onDelete={setProjectToDelete}
            />
          ) : null}
        </div>
      )}

      {showNewProject ? <NewProjectModal onClose={() => setShowNewProject(false)} /> : null}

      {projectToDelete ? (
        <DeleteProjectModal
          project={projectToDelete}
          onCancel={() => setProjectToDelete(null)}
          onConfirm={() => deleteMutation.mutate(projectToDelete.id)}
          isDeleting={deleteMutation.isPending}
        />
      ) : null}
    </div>
  );
}

function ProjectGroupTable({
  title,
  description,
  projects,
  sortKey,
  sortDirection,
  onSort,
  onOpenProject,
  onArchive,
  onDelete,
}: {
  title: string;
  description: string;
  projects: ProjectListItem[];
  sortKey: SortKey;
  sortDirection: SortDirection;
  onSort: (key: SortKey) => void;
  onOpenProject: (id: string) => void;
  onArchive: (project: ProjectListItem) => void;
  onDelete: (project: ProjectListItem) => void;
}) {
  if (projects.length === 0) {
    return (
      <section className="rounded-xl border border-dashed border-[var(--color-border)] bg-[var(--color-bg-card)] p-5">
        <p className="text-[10px] font-mono uppercase tracking-[0.2em] text-[var(--color-text-muted)]">{title}</p>
        <p className="mt-1 text-sm text-[var(--color-text-secondary)]">{description}</p>
        <p className="mt-4 text-sm text-[var(--color-text-muted)]">No hay proyectos en este grupo.</p>
      </section>
    );
  }

  return (
    <section className="overflow-hidden rounded-xl border border-[var(--color-border)] bg-[var(--color-bg-card)]">
      <div className="border-b border-[var(--color-border)] bg-[var(--color-bg-card-hover)] px-5 py-4">
        <p className="text-[10px] font-mono uppercase tracking-[0.2em] text-[var(--color-text-muted)]">{title}</p>
        <p className="mt-1 text-sm text-[var(--color-text-secondary)]">
          {description} <span className="text-[var(--color-text-muted)]">· {projects.length} proyecto{projects.length === 1 ? "" : "s"}</span>
        </p>
      </div>
      <div className="overflow-x-auto">
        <table className="min-w-full border-collapse">
          <thead>
            <tr className="bg-[var(--color-table-header-bg)] text-[var(--color-table-header-text)]">
              <th className="px-4 py-3"><SortHeader label="Cliente" sortKey="client" currentSortKey={sortKey} direction={sortDirection} onSort={onSort} /></th>
              <th className="px-4 py-3"><SortHeader label="Ubicación" sortKey="location" currentSortKey={sortKey} direction={sortDirection} onSort={onSort} /></th>
              <th className="px-4 py-3"><SortHeader label="Estado" sortKey="status" currentSortKey={sortKey} direction={sortDirection} onSort={onSort} /></th>
              <th className="px-4 py-3"><SortHeader label="Etapa actual" sortKey="currentStage" currentSortKey={sortKey} direction={sortDirection} onSort={onSort} /></th>
              <th className="px-4 py-3"><SortHeader label="Avance" sortKey="progress" currentSortKey={sortKey} direction={sortDirection} onSort={onSort} /></th>
              <th className="px-4 py-3"><SortHeader label="Inversor" sortKey="inverter" currentSortKey={sortKey} direction={sortDirection} onSort={onSort} /></th>
              <th className="px-4 py-3"><SortHeader label="Paneles" sortKey="panels" currentSortKey={sortKey} direction={sortDirection} onSort={onSort} /></th>
              <th className="px-4 py-3"><SortHeader label="Instalación" sortKey="installationDate" currentSortKey={sortKey} direction={sortDirection} onSort={onSort} /></th>
              <th className="px-4 py-3"><SortHeader label="Inicio" sortKey="dates" currentSortKey={sortKey} direction={sortDirection} onSort={onSort} /></th>
              <th className="px-4 py-3"><SortHeader label="Venta" sortKey="saleDate" currentSortKey={sortKey} direction={sortDirection} onSort={onSort} /></th>
              <th className="px-4 py-3 text-left text-[11px] font-mono uppercase tracking-widest text-[var(--color-table-header-text)]">Acciones</th>
            </tr>
          </thead>
          <tbody>
            {projects.map((project) => {
              const solarSystem = getPrimarySolarSystem(project);
              const extraCount = Math.max(0, project.solarSystems.length - 1);
              const tooltip = getAdditionalSystemsTooltip(project.solarSystems);
              const teamColor = getProjectTeamColor(project);
              const teamName = getProjectTeamName(project);
              const teamType = getProjectTeamType(project);

              return (
                <tr
                  key={project.id}
                  onClick={() => onOpenProject(project.id)}
                  className="cursor-pointer border-b border-[var(--color-border)]/70 transition-colors hover:bg-[var(--color-row-hover)]"
                >
                  <td className="px-4 py-4 align-top">
                    <div className="font-medium text-[var(--color-text-primary)]">{project.clientName}</div>
                    {teamColor && teamName ? (
                      <div
                        className="mt-2 inline-flex items-center gap-2 rounded-md border px-2.5 py-1"
                        style={{ borderColor: `${teamColor}55`, backgroundColor: `${teamColor}1A` }}
                      >
                        <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: teamColor }} />
                        <span className="text-[10px] font-mono uppercase tracking-wider text-[var(--color-text-secondary)]">
                          {teamName} · {teamTypeLabel(teamType)}
                        </span>
                      </div>
                    ) : null}
                  </td>
                  <td className="px-4 py-4 align-top">
                    <div className="text-sm text-[var(--color-text-primary)]">{project.locationCity}</div>
                    <div className="mt-1 text-xs text-[var(--color-text-muted)]">{project.locationProvince}</div>
                  </td>
                  <td className="px-4 py-4 align-top">
                    <Badge variant={project.status} />
                  </td>
                  <td className="px-4 py-4 align-top">
                    {project.currentStages && project.currentStages.length > 0 ? (
                      <div>
                        <div className="text-sm text-[var(--color-text-primary)]">
                          {STAGE_LABELS[project.currentStages[0]] ?? project.currentStages[0]}
                        </div>
                        {project.currentStages.length > 1 ? (
                          <div className="mt-0.5 text-[10px] text-[var(--color-text-muted)]">
                            +{project.currentStages.length - 1} en paralelo
                          </div>
                        ) : null}
                      </div>
                    ) : (
                      <span className="text-sm text-[var(--color-text-muted)]">—</span>
                    )}
                  </td>
                  <td className="px-4 py-4 align-top">
                    <div className="flex min-w-[150px] items-center gap-3">
                      <div className="min-w-0 flex-1">
                        <div
                          className="h-2 w-full overflow-hidden rounded-full bg-[var(--color-border)]"
                          title={`${project.completionPercent}% completado`}
                        >
                          <div
                            className={`h-full rounded-full transition-all ${progressBarClass(project.completionPercent)}`}
                            style={{ width: `${project.completionPercent}%` }}
                          />
                        </div>
                      </div>
                      <span className="text-sm font-medium text-[var(--color-text-primary)]">
                        {project.completionPercent}%
                      </span>
                    </div>
                  </td>
                  <td className="px-4 py-4 align-top">
                    {solarSystem ? (
                      <div>
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="text-sm text-[var(--color-text-primary)]">{formatSolarSystemPrimary(solarSystem)}</span>
                          <Badge label={getPhaseTypeShortLabel(solarSystem.inverterPhaseType)} className="bg-[var(--color-border)] text-[var(--color-text-primary)]" />
                          {extraCount > 0 ? (
                            <span title={tooltip} className="inline-flex rounded-full border border-[var(--color-border)] px-2 py-0.5 text-[10px] font-mono text-[var(--color-text-secondary)]">
                              +{extraCount}
                            </span>
                          ) : null}
                        </div>
                        {solarSystem.inverterModel ? (
                          <div className="mt-1 text-xs text-[var(--color-text-muted)]">{solarSystem.inverterModel}</div>
                        ) : null}
                      </div>
                    ) : (
                      <span className="text-sm text-[var(--color-text-muted)]">Sin datos</span>
                    )}
                  </td>
                  <td className="px-4 py-4 align-top">
                    <span className="text-sm text-[var(--color-text-primary)]">
                      {solarSystem ? formatSolarSystemPanels(solarSystem) : "Sin datos"}
                    </span>
                  </td>
                  <td className="px-4 py-4 align-top">
                    {project.plannedWorkStart ? (
                      <div className="text-sm text-[var(--color-text-primary)]">
                        {formatDate(project.plannedWorkStart)}
                      </div>
                    ) : (
                      <span className="text-sm text-[var(--color-text-muted)]">Sin agendar</span>
                    )}
                  </td>
                  <td className="px-4 py-4 align-top">
                    <div className="text-sm text-[var(--color-text-primary)]">{formatDate(project.startDate)}</div>
                  </td>
                  <td className="px-4 py-4 align-top">
                    {project.saleDate ? (
                      <div className="text-sm text-[var(--color-text-primary)]">{formatDate(project.saleDate)}</div>
                    ) : (
                      <span className="text-sm text-[var(--color-text-muted)]">—</span>
                    )}
                  </td>
                  <td className="px-4 py-4 align-top">
                    <div className="flex items-center gap-2">
                      <Button
                        size="sm"
                        variant="secondary"
                        onClick={(event) => {
                          event.stopPropagation();
                          onOpenProject(project.id);
                        }}
                      >
                        Ver
                      </Button>
                      <button
                        type="button"
                        title={project.status === "ARCHIVED" ? "Restaurar proyecto" : "Archivar proyecto"}
                        onClick={(event) => {
                          event.stopPropagation();
                          onArchive(project);
                        }}
                        className="p-1.5 rounded text-[var(--color-text-muted)] hover:text-[var(--color-text-secondary)] hover:bg-[var(--color-border)] transition-colors"
                      >
                        {project.status === "ARCHIVED" ? (
                          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                            <polyline points="1 4 1 10 7 10" />
                            <path d="M3.51 15a9 9 0 1 0 .49-3.51" />
                          </svg>
                        ) : (
                          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                            <polyline points="21 8 21 21 3 21 3 8" />
                            <rect x="1" y="3" width="22" height="5" />
                            <line x1="10" y1="12" x2="14" y2="12" />
                          </svg>
                        )}
                      </button>
                      <button
                        type="button"
                        title="Eliminar proyecto"
                        onClick={(event) => {
                          event.stopPropagation();
                          onDelete(project);
                        }}
                        className="p-1.5 rounded text-[var(--color-text-muted)] hover:text-red-400 hover:bg-red-500/10 transition-colors"
                      >
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                          <polyline points="3 6 5 6 21 6" />
                          <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6" />
                          <path d="M10 11v6" />
                          <path d="M14 11v6" />
                          <path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2" />
                        </svg>
                      </button>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </section>
  );
}

function DeleteProjectModal({
  project,
  onCancel,
  onConfirm,
  isDeleting,
}: {
  project: ProjectListItem;
  onCancel: () => void;
  onConfirm: () => void;
  isDeleting: boolean;
}) {
  const [typedCode, setTypedCode] = useState("");
  const canConfirm = typedCode.trim().toUpperCase() === project.code.toUpperCase();

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4"
      onClick={onCancel}
    >
      <div
        className="w-full max-w-md rounded-xl border border-[var(--color-border)] bg-[var(--color-bg-card)] p-6 shadow-xl"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="flex items-start gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-red-500/20 text-red-400">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
              <line x1="12" y1="9" x2="12" y2="13" />
              <line x1="12" y1="17" x2="12.01" y2="17" />
            </svg>
          </div>
          <div className="min-w-0 flex-1">
            <h2 className="font-display text-lg font-semibold text-[var(--color-text-primary)]">
              Eliminar proyecto
            </h2>
            <p className="mt-1 text-sm text-[var(--color-text-secondary)]">
              Vas a eliminar <strong>{project.clientName}</strong> ({project.code}).
              Se ocultará de todas las vistas y métricas. Esta acción no se puede deshacer desde la aplicación.
            </p>
          </div>
        </div>

        <div className="mt-5">
          <label className="block text-xs text-[var(--color-text-muted)] mb-1.5">
            Para confirmar, escribí el código del proyecto: <span className="font-mono text-[var(--color-text-primary)]">{project.code}</span>
          </label>
          <input
            type="text"
            autoFocus
            value={typedCode}
            onChange={(event) => setTypedCode(event.target.value)}
            placeholder={project.code}
            className="w-full rounded-md border border-[var(--color-border)] bg-[var(--color-bg-app)] px-3 py-2 text-sm font-mono text-[var(--color-text-primary)] placeholder:text-[var(--color-text-muted)] focus:border-red-500 focus:outline-none"
            disabled={isDeleting}
          />
        </div>

        <div className="mt-6 flex justify-end gap-2">
          <Button variant="secondary" onClick={onCancel} disabled={isDeleting}>
            Cancelar
          </Button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={!canConfirm || isDeleting}
            className="rounded-md bg-red-500 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-red-600 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {isDeleting ? "Eliminando..." : "Eliminar definitivamente"}
          </button>
        </div>
      </div>
    </div>
  );
}

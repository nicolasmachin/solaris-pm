import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "react-hot-toast";
import { getProjects, patchProject } from "../api/projects.api";
import { NewProjectModal } from "../components/project/NewProjectModal";
import { Badge } from "../components/ui/Badge";
import { Button } from "../components/ui/Button";
import { EmptyState } from "../components/ui/EmptyState";
import { ProgressBar } from "../components/ui/ProgressBar";
import { Spinner } from "../components/ui/Spinner";
import type { ProjectListItem, ProjectStatus, SolarSystem } from "../types/api.types";
import {
  formatSolarSystemPanels,
  formatSolarSystemPrimary,
  getPhaseTypeShortLabel,
} from "../components/project/SolarSystemFields";

type SortKey = "client" | "location" | "status" | "progress" | "inverter" | "panels" | "dates" | "delay";
type SortDirection = "asc" | "desc";

const STATUS_OPTIONS: Array<{ value: "all" | ProjectStatus; label: string }> = [
  { value: "all", label: "Todos" },
  { value: "ACTIVE", label: "Activos" },
  { value: "PROSPECT", label: "Prospectos" },
  { value: "COMPLETED", label: "Completados" },
  { value: "PAUSED", label: "Pausados" },
  { value: "ARCHIVED", label: "Archivados" },
];

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
        result = a.progressPercent - b.progressPercent;
        break;
      case "inverter":
        result = compareText(formatSolarSystemPrimary(solarA ?? emptySolarSystem), formatSolarSystemPrimary(solarB ?? emptySolarSystem));
        break;
      case "panels":
        result = (solarA?.panelQuantity ?? 0) - (solarB?.panelQuantity ?? 0) || (solarA?.panelPowerW ?? 0) - (solarB?.panelPowerW ?? 0);
        break;
      case "dates":
        result = new Date(a.startDate ?? "2100-01-01").getTime() - new Date(b.startDate ?? "2100-01-01").getTime();
        if (result === 0) {
          result = new Date(a.plannedEndDate ?? "2100-01-01").getTime() - new Date(b.plannedEndDate ?? "2100-01-01").getTime();
        }
        break;
      case "delay":
        result = a.delayDays - b.delayDays;
        break;
    }

    return result * multiplier;
  });
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
      className="flex items-center gap-1 text-left text-[11px] font-mono uppercase tracking-widest text-[var(--color-text-muted)] transition-colors hover:text-[var(--color-text-primary)]"
    >
      <span>{label}</span>
      <span className={active ? "text-[var(--color-accent)]" : "opacity-40"}>{active && direction === "asc" ? "↑" : "↓"}</span>
    </button>
  );
}

export function Projects() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<"all" | ProjectStatus>("ACTIVE");
  const [sortKey, setSortKey] = useState<SortKey>("client");
  const [sortDirection, setSortDirection] = useState<SortDirection>("asc");
  const [showNewProject, setShowNewProject] = useState(false);

  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ["projects"],
    queryFn: getProjects,
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

  const projects = data ?? [];

  const filteredProjects = useMemo(() => {
    const term = query.trim().toLowerCase();
    const filtered = projects.filter((project) => {
      const matchesStatus =
        statusFilter === "all"
          ? project.status !== "ARCHIVED"
          : project.status === statusFilter;
      const matchesQuery = term
        ? project.clientName.toLowerCase().includes(term) || project.code.toLowerCase().includes(term)
        : true;
      return matchesStatus && matchesQuery;
    });

    return sortProjects(filtered, sortKey, sortDirection);
  }, [projects, query, sortKey, sortDirection, statusFilter]);

  function handleSort(nextKey: SortKey) {
    if (sortKey === nextKey) {
      setSortDirection((current) => (current === "asc" ? "desc" : "asc"));
      return;
    }
    setSortKey(nextKey);
    setSortDirection(nextKey === "delay" || nextKey === "progress" ? "desc" : "asc");
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
            Mostrando {filteredProjects.length} de {projects.filter((p) => p.status !== "ARCHIVED").length} proyectos
            {statusFilter !== "ARCHIVED" && projects.some((p) => p.status === "ARCHIVED") && (
              <button
                type="button"
                onClick={() => setStatusFilter("ARCHIVED")}
                className="ml-2 text-[var(--color-text-muted)] underline hover:text-[var(--color-text-secondary)] transition-colors"
              >
                ({projects.filter((p) => p.status === "ARCHIVED").length} archivados)
              </button>
            )}
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
          <select
            value={statusFilter}
            onChange={(event) => setStatusFilter(event.target.value as "all" | ProjectStatus)}
            className="rounded-md border border-[var(--color-border)] bg-[var(--color-bg-app)] px-3 py-2 text-sm text-[var(--color-text-primary)] focus:border-[var(--color-accent)] focus:outline-none"
          >
            {STATUS_OPTIONS.map((option) => (
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
        <div className="overflow-hidden rounded-xl border border-[var(--color-border)] bg-[var(--color-bg-card)]">
          <div className="overflow-x-auto">
            <table className="min-w-full border-collapse">
              <thead>
                <tr className="border-b border-[var(--color-border)] bg-[var(--color-bg-app)]/50">
                  <th className="px-4 py-3"><SortHeader label="Cliente" sortKey="client" currentSortKey={sortKey} direction={sortDirection} onSort={handleSort} /></th>
                  <th className="px-4 py-3"><SortHeader label="Ubicación" sortKey="location" currentSortKey={sortKey} direction={sortDirection} onSort={handleSort} /></th>
                  <th className="px-4 py-3"><SortHeader label="Estado" sortKey="status" currentSortKey={sortKey} direction={sortDirection} onSort={handleSort} /></th>
                  <th className="px-4 py-3"><SortHeader label="Avance" sortKey="progress" currentSortKey={sortKey} direction={sortDirection} onSort={handleSort} /></th>
                  <th className="px-4 py-3"><SortHeader label="Inversor" sortKey="inverter" currentSortKey={sortKey} direction={sortDirection} onSort={handleSort} /></th>
                  <th className="px-4 py-3"><SortHeader label="Paneles" sortKey="panels" currentSortKey={sortKey} direction={sortDirection} onSort={handleSort} /></th>
                  <th className="px-4 py-3"><SortHeader label="Fechas" sortKey="dates" currentSortKey={sortKey} direction={sortDirection} onSort={handleSort} /></th>
                  <th className="px-4 py-3"><SortHeader label="Desvío" sortKey="delay" currentSortKey={sortKey} direction={sortDirection} onSort={handleSort} /></th>
                  <th className="px-4 py-3 text-left text-[11px] font-mono uppercase tracking-widest text-[var(--color-text-muted)]">Acciones</th>
                </tr>
              </thead>
              <tbody>
                {filteredProjects.map((project) => {
                  const solarSystem = getPrimarySolarSystem(project);
                  const extraCount = Math.max(0, project.solarSystems.length - 1);
                  const tooltip = getAdditionalSystemsTooltip(project.solarSystems);
                  return (
                    <tr
                      key={project.id}
                      onClick={() => navigate(`/projects/${project.id}`)}
                      className="cursor-pointer border-b border-[var(--color-border)]/70 transition-colors hover:bg-[var(--color-bg-card-hover)]"
                    >
                      <td className="px-4 py-4 align-top">
                        <div className="font-medium text-[var(--color-text-primary)]">{project.clientName}</div>
                        <div className="mt-1 text-xs text-[var(--color-text-muted)]">{project.code}</div>
                      </td>
                      <td className="px-4 py-4 align-top">
                        <div className="text-sm text-[var(--color-text-primary)]">{project.locationCity}</div>
                        <div className="mt-1 text-xs text-[var(--color-text-muted)]">{project.locationProvince}</div>
                      </td>
                      <td className="px-4 py-4 align-top">
                        <Badge variant={project.status} />
                      </td>
                      <td className="px-4 py-4 align-top">
                        <div className="flex min-w-[150px] items-center gap-3">
                          <div className="min-w-0 flex-1">
                            <ProgressBar value={project.progressPercent} height={8} />
                          </div>
                          <span className="text-sm font-medium text-[var(--color-text-primary)]">{project.progressPercent}%</span>
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
                        <div className="text-sm text-[var(--color-text-primary)]">{formatDate(project.startDate)}</div>
                        <div className="mt-1 text-xs text-[var(--color-text-muted)]">{formatDate(project.plannedEndDate)}</div>
                      </td>
                      <td className="px-4 py-4 align-top">
                        {project.delayDays === 0 ? (
                          <span className="text-sm text-[var(--color-text-muted)]">0 días</span>
                        ) : (
                          <span className={`text-sm font-medium ${project.delayDays > 0 ? "text-red-400" : "text-emerald-400"}`}>
                            {project.delayDays > 0 ? "+" : ""}
                            {project.delayDays} días
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-4 align-top">
                        <div className="flex items-center gap-2">
                          <Button
                            size="sm"
                            variant="secondary"
                            onClick={(event) => {
                              event.stopPropagation();
                              navigate(`/projects/${project.id}`);
                            }}
                          >
                            Ver
                          </Button>
                          <button
                            type="button"
                            title={project.status === "ARCHIVED" ? "Restaurar proyecto" : "Archivar proyecto"}
                            onClick={(event) => {
                              event.stopPropagation();
                              archiveMutation.mutate({ id: project.id, archive: project.status !== "ARCHIVED" });
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
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {showNewProject ? <NewProjectModal onClose={() => setShowNewProject(false)} /> : null}
    </div>
  );
}

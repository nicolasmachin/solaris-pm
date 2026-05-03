import { memo, useEffect, useMemo, useState } from "react";
import { NavLink } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import {
  getIngenieriaDashboard,
  type IngenieriaDashboardProject,
  type IngenieriaEstado,
} from "../../api/ingenieria.api";

/**
 * Sidebar lateral del módulo Ingeniería. Visible sólo en `/ingenieria/proyecto/:id`.
 *
 * Es un componente gemelo del Sidebar de Proyectos (mismas medidas, paleta y
 * patrón visual) pero con data y navegación propias del módulo. Reusa la query
 * `["ingenieria-dashboard"]` para no hacer doble fetch cuando el usuario viene
 * del dashboard del módulo.
 */

type EstadoFilter = "todas" | "en-cola" | "en-proceso" | "completadas";

const ESTADO_OPTIONS: { value: EstadoFilter; label: string }[] = [
  { value: "todas", label: "Todas" },
  { value: "en-cola", label: "En cola" },
  { value: "en-proceso", label: "En proceso" },
  { value: "completadas", label: "Completadas" },
];

const FILTER_STORAGE_KEY = "ingenieria-sidebar-filter";

interface PersistedFilter {
  estadoFilter: EstadoFilter;
}

function loadPersistedFilter(): PersistedFilter | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(FILTER_STORAGE_KEY);
    if (!raw) return null;
    return JSON.parse(raw) as PersistedFilter;
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

function matchesEstado(p: IngenieriaDashboardProject, f: EstadoFilter): boolean {
  if (f === "todas") return true;
  if (f === "en-cola") return p.stageStatus === "PENDING";
  if (f === "en-proceso") return p.stageStatus === "IN_PROGRESS";
  if (f === "completadas") return p.stageStatus === "COMPLETED";
  return true;
}

// Igual a la del Sidebar de Proyectos para que la barra se vea idéntica.
function progressBarClass(pct: number): string {
  if (pct >= 100) return "bg-[#1F7A3A]";
  if (pct >= 66) return "bg-emerald-500";
  if (pct >= 33) return "bg-sky-500";
  return "bg-[var(--color-text-muted)]";
}

function estadoColor(estado: IngenieriaEstado): string {
  if (estado === "Completada") return "text-emerald-400";
  if (estado === "En proceso") return "text-blue-400";
  if (estado === "Sin iniciar") return "text-[var(--color-text-muted)]";
  return "text-[var(--color-text-muted)]";
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

export const EngineeringProjectsSidebar = memo(function EngineeringProjectsSidebar() {
  const { data, isLoading } = useQuery({
    queryKey: ["ingenieria-dashboard"],
    queryFn: getIngenieriaDashboard,
    staleTime: 60_000,
  });

  const persisted = useMemo(loadPersistedFilter, []);
  const [search, setSearch] = useState("");
  const [estadoFilter, setEstadoFilter] = useState<EstadoFilter>(
    persisted?.estadoFilter ?? "todas",
  );

  useEffect(() => {
    savePersistedFilter({ estadoFilter });
  }, [estadoFilter]);

  const filtered = useMemo(() => {
    const all = data?.projects ?? [];
    const q = search.trim().toLowerCase();
    return all.filter((p) => {
      if (!matchesEstado(p, estadoFilter)) return false;
      if (!q) return true;
      return (
        p.cliente.toLowerCase().includes(q) ||
        p.projectCode.toLowerCase().includes(q) ||
        p.ubicacion.toLowerCase().includes(q)
      );
    });
  }, [data, search, estadoFilter]);

  const total = data?.projects.length ?? 0;
  const showing = filtered.length;

  return (
    <aside
      className="fixed left-0 bottom-0 z-30 hidden md:flex flex-col bg-[var(--color-bg-sidebar)] border-r border-[var(--color-border)] overflow-y-auto"
      style={{ top: 52, width: 220 }}
    >
      {/* Header */}
      <div className="flex items-center justify-between px-3 pt-3 pb-1">
        <p className="text-[9px] font-mono font-medium uppercase tracking-widest text-[var(--color-text-muted)]">
          Proyectos
        </p>
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
          value={estadoFilter}
          onChange={(e) => setEstadoFilter(e.target.value as EstadoFilter)}
          className="w-full rounded border border-[var(--color-border)] bg-[var(--color-bg-app)] px-2 py-1 text-[11px] text-[var(--color-text-primary)] focus:border-[var(--color-accent)] focus:outline-none"
          aria-label="Filtrar por estado de etapa Ingeniería"
        >
          {ESTADO_OPTIONS.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
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
          <ProjectItem key={project.projectId} project={project} />
        ))}
      </div>
    </aside>
  );
});

function ProjectItem({ project }: { project: IngenieriaDashboardProject }) {
  return (
    <NavLink
      to={`/ingenieria/proyecto/${project.projectId}`}
      className={({ isActive }) =>
        `block px-3 py-3 transition-colors border-l-2 ${
          isActive
            ? "bg-[var(--color-bg-card-hover)] border-l-[var(--color-accent)]"
            : "border-l-transparent hover:bg-[var(--color-bg-card-hover)]"
        }`
      }
    >
      <p className="truncate text-xs font-medium leading-snug text-[var(--color-text-primary)]">
        {project.cliente}
      </p>
      <p className="text-[10px] font-mono text-[var(--color-text-muted)] mt-0.5 truncate">
        {project.potenciaKwp} kWp
      </p>
      <p className={`text-[10px] mt-0.5 truncate ${estadoColor(project.estado)}`}>
        {project.estado}
        {project.subetapasTotales > 0 && (
          <span className="text-[var(--color-text-muted)]">
            {" "}
            · {project.subetapasCompletas}/{project.subetapasTotales}
          </span>
        )}
      </p>
      <div
        className="mt-1.5 h-[3px] w-full overflow-hidden rounded-full bg-[var(--color-border)]"
        title={`${project.progressPercent}% completado`}
      >
        <div
          className={`h-full rounded-full transition-all ${progressBarClass(project.progressPercent)}`}
          style={{ width: `${project.progressPercent}%` }}
        />
      </div>
    </NavLink>
  );
}

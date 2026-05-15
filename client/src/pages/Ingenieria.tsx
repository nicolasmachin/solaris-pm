import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { ArrowRight, HardHat, Package, Search } from "lucide-react";
import {
  getIngenieriaDashboard,
  type IngenieriaDashboardProject,
  type IngenieriaEstado,
} from "../api/ingenieria.api";
import { MultiSelectFilter } from "../components/ui/MultiSelectFilter";

type ScopeFilter = "en-cola" | "en-proceso" | "completadas";

function klass(...p: (string | false | undefined)[]) {
  return p.filter(Boolean).join(" ");
}

const SCOPE_OPTIONS: Array<{ value: ScopeFilter; label: string }> = [
  { value: "en-cola", label: "En cola" },
  { value: "en-proceso", label: "En proceso" },
  { value: "completadas", label: "Completadas" },
];

// Por defecto: todos los scopes EXCEPTO completadas (los terminados rara
// vez interesan en el día a día).
const DEFAULT_SCOPES: ScopeFilter[] = ["en-cola", "en-proceso"];

function matchesScopes(p: IngenieriaDashboardProject, scopes: Set<ScopeFilter>): boolean {
  if (scopes.size === 0) return false;
  if (p.stageStatus === "PENDING" && scopes.has("en-cola")) return true;
  if (p.stageStatus === "IN_PROGRESS" && scopes.has("en-proceso")) return true;
  if (p.stageStatus === "COMPLETED" && scopes.has("completadas")) return true;
  return false;
}

function estadoColor(estado: IngenieriaEstado): { bg: string; text: string } {
  if (estado === "Completada") return { bg: "rgba(16,185,129,0.15)", text: "#34d399" };
  if (estado === "En proceso") return { bg: "rgba(59,130,246,0.15)", text: "#60a5fa" };
  if (estado === "Sin iniciar") return { bg: "rgba(156,163,175,0.15)", text: "#9ca3af" };
  return { bg: "rgba(239,68,68,0.15)", text: "#f87171" };
}

export function Ingenieria() {
  const navigate = useNavigate();
  const [scopes, setScopes] = useState<Set<ScopeFilter>>(() => new Set(DEFAULT_SCOPES));
  const [search, setSearch] = useState("");

  const { data, isLoading, isError } = useQuery({
    queryKey: ["ingenieria-dashboard"],
    queryFn: getIngenieriaDashboard,
  });

  const filtered = useMemo(() => {
    const projects = data?.projects ?? [];
    const q = search.toLowerCase().trim();
    return projects.filter((p) => {
      if (!matchesScopes(p, scopes)) return false;
      if (!q) return true;
      return (
        p.cliente.toLowerCase().includes(q) ||
        p.projectCode.toLowerCase().includes(q) ||
        p.ubicacion.toLowerCase().includes(q)
      );
    });
  }, [data, scopes, search]);

  return (
    <div className="space-y-5">
      <header className="flex items-center justify-between gap-3 flex-wrap">
        <div>
          <h1 className="text-lg font-semibold text-[var(--color-text-primary)] flex items-center gap-2">
            <HardHat className="w-5 h-5 text-[var(--color-accent)]" />
            Ingeniería
          </h1>
          <p className="text-xs text-[var(--color-text-muted)] mt-0.5">
            Workspace técnico — herramientas, planos y documentación de cada proyecto.
          </p>
        </div>
      </header>

      {/* Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <StatCard label="En cola" value={data?.stats.enCola ?? 0} loading={isLoading} />
        <StatCard label="En proceso" value={data?.stats.enProceso ?? 0} loading={isLoading} highlight />
        <StatCard
          label="Completadas (últimos 30d)"
          value={data?.stats.completadas30d ?? 0}
          loading={isLoading}
        />
      </div>

      {/* Herramientas globales del módulo */}
      <section>
        <p className="font-mono text-[10px] uppercase tracking-widest text-[var(--color-text-muted)] mb-2">
          Herramientas globales
        </p>
        <button
          onClick={() => navigate("/ingenieria/materiales-consolidados")}
          className="w-full flex items-center gap-3 rounded-lg border border-[var(--color-border)] bg-[var(--color-bg-card)] px-4 py-3 text-left hover:border-[var(--color-accent)]/40 hover:bg-[var(--color-bg-card-hover)] transition-colors"
        >
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded bg-[var(--color-accent)]/15">
            <Package className="w-5 h-5 text-[var(--color-accent)]" />
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-sm font-medium text-[var(--color-text-primary)]">
              Consolidador de materiales
            </p>
            <p className="text-[11px] text-[var(--color-text-muted)] mt-0.5">
              Unificá listas de materiales de varios proyectos para hacer las compras.
            </p>
          </div>
          <ArrowRight className="w-4 h-4 text-[var(--color-text-muted)] shrink-0" />
        </button>
      </section>

      {/* Filtros */}
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <MultiSelectFilter
          options={SCOPE_OPTIONS}
          selected={scopes}
          onChange={setScopes}
          buttonLabel="estados"
          allLabel="Todos los estados"
        />
        <div className="relative max-w-xs w-full">
          <Search className="absolute left-2 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-[var(--color-text-muted)]" />
          <input
            type="search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Buscar por cliente, código o ubicación…"
            className="w-full rounded border border-[var(--color-border)] bg-[var(--color-bg-app)] pl-7 pr-2 py-1.5 text-xs text-[var(--color-text-primary)] focus:outline-none focus:ring-1 focus:ring-[var(--color-accent)]"
          />
        </div>
      </div>

      {/* Lista */}
      {isLoading ? (
        <div className="rounded-lg border border-[var(--color-border)] bg-[var(--color-bg-card)] p-8 text-center text-sm text-[var(--color-text-muted)]">
          Cargando…
        </div>
      ) : isError ? (
        <div className="rounded-lg border border-red-500/30 bg-red-500/10 p-4 text-sm text-red-400">
          No se pudo cargar el dashboard.
        </div>
      ) : filtered.length === 0 ? (
        <div className="rounded-lg border border-dashed border-[var(--color-border)] bg-[var(--color-bg-card)] p-10 text-center">
          <p className="text-sm text-[var(--color-text-secondary)]">
            {(data?.projects.length ?? 0) === 0
              ? "No hay proyectos en ingeniería todavía."
              : "Sin coincidencias para los filtros actuales."}
          </p>
        </div>
      ) : (
        <ul className="space-y-1.5">
          {filtered.map((p) => {
            const c = estadoColor(p.estado);
            return (
              <li key={p.projectId}>
                <button
                  type="button"
                  onClick={() => navigate(`/ingenieria/proyecto/${p.projectId}`)}
                  className="flex w-full items-center gap-3 rounded-lg border border-[var(--color-border)] bg-[var(--color-bg-card)] px-4 py-3 text-left transition-colors hover:bg-[var(--color-bg-card-hover)]"
                >
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-mono text-[10px] text-[var(--color-text-muted)] tracking-wider">
                        {p.projectCode}
                      </span>
                      <p className="text-sm font-medium text-[var(--color-text-primary)] truncate">
                        {p.cliente}
                      </p>
                      <span
                        className="rounded px-1.5 py-0.5 text-[10px] font-mono uppercase tracking-wider"
                        style={{ background: c.bg, color: c.text }}
                      >
                        {p.estado}
                      </span>
                    </div>
                    <p className="text-[11px] text-[var(--color-text-muted)] mt-0.5 font-mono">
                      {p.potenciaKwp} kWp · {p.ubicacion} · Subetapas {p.subetapasCompletas}/
                      {p.subetapasTotales} · {p.progressPercent}%
                    </p>
                  </div>
                  <ArrowRight className="w-4 h-4 text-[var(--color-text-muted)] shrink-0" />
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

function StatCard({
  label,
  value,
  loading,
  highlight,
}: {
  label: string;
  value: number;
  loading: boolean;
  highlight?: boolean;
}) {
  return (
    <div
      className={klass(
        "rounded-lg border bg-[var(--color-bg-card)] p-4",
        highlight ? "border-blue-500/40" : "border-[var(--color-border)]",
      )}
    >
      <p className="font-mono text-[10px] uppercase tracking-widest text-[var(--color-text-muted)]">
        {label}
      </p>
      <p
        className={klass(
          "text-2xl font-bold tabular-nums mt-1",
          highlight ? "text-blue-400" : "text-[var(--color-text-primary)]",
        )}
      >
        {loading ? "—" : value}
      </p>
    </div>
  );
}

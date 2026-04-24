import { useQuery } from "@tanstack/react-query";
import { getProjects } from "../api/projects.api";
import { Spinner } from "../components/ui/Spinner";

export function Dashboard() {
  const { data: projects, isLoading } = useQuery({
    queryKey: ["projects"],
    queryFn: () => getProjects(),
    staleTime: 60_000,
  });

  const activeCount = projects?.filter(
    (p) => p.status === "ACTIVE" || p.status === "IN_PROGRESS"
  ).length ?? 0;

  const totalKwp = projects?.reduce((sum, p) => sum + p.capacityKwp, 0) ?? 0;

  const completedCount = projects?.filter(
    (p) => p.status === "COMPLETED"
  ).length ?? 0;

  return (
    <div>
      <div className="mb-6">
        <h1 className="font-display text-2xl font-bold text-[var(--color-text-primary)]">
          Dashboard
        </h1>
        <p className="text-sm text-[var(--color-text-secondary)] mt-1">
          Resumen general de proyectos
        </p>
      </div>

      {isLoading ? (
        <div className="flex items-center gap-3 text-[var(--color-text-muted)] text-sm py-12">
          <Spinner />
          Cargando datos...
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
          <KpiCard
            title="Proyectos activos"
            value={activeCount}
            unit="proyectos"
            icon="⚡"
          />
          <KpiCard
            title="kWp totales"
            value={totalKwp.toFixed(1)}
            unit="kWp instalados"
            icon="☀️"
          />
          <KpiCard
            title="Completados"
            value={completedCount}
            unit="proyectos entregados"
            icon="✅"
          />
        </div>
      )}

    </div>
  );
}

interface KpiCardProps {
  title: string;
  value: string | number;
  unit: string;
  icon: string;
  highlight?: boolean;
}

function KpiCard({ title, value, unit, icon, highlight = false }: KpiCardProps) {
  return (
    <div className="bg-[var(--color-bg-card)] border border-[var(--color-border)] rounded-xl px-5 py-4 hover:bg-[var(--color-bg-card-hover)] transition-colors">
      <div className="flex items-center justify-between mb-3">
        <span className="text-xs font-medium text-[var(--color-text-secondary)] uppercase tracking-wide">
          {title}
        </span>
        <span className="text-lg">{icon}</span>
      </div>
      <p
        className={`text-3xl font-display font-bold ${
          highlight
            ? "text-orange-400"
            : "text-[var(--color-text-primary)]"
        }`}
      >
        {value}
      </p>
      <p className="text-xs text-[var(--color-text-muted)] mt-1">{unit}</p>
    </div>
  );
}

import { Link } from "react-router-dom";
import { Badge } from "../ui/Badge";
import type { MetricsProjectRow } from "../../types/api.types";

interface ProjectRankingProps {
  projects: MetricsProjectRow[];
}

export function ProjectRanking({ projects }: ProjectRankingProps) {
  if (projects.length === 0) {
    return (
      <p className="text-sm text-[var(--color-text-muted)]">
        No hay proyectos para mostrar.
      </p>
    );
  }

  return (
    <div className="overflow-x-auto">
      <table className="min-w-full text-left text-sm">
        <thead>
          <tr className="text-[11px] uppercase tracking-wide text-[var(--color-text-muted)]">
            <th className="pb-2 pr-2 w-6">#</th>
            <th className="pb-2 pr-3">Proyecto</th>
            <th className="pb-2 pr-3 text-right">Avance</th>
            <th className="pb-2">Estado</th>
          </tr>
        </thead>
        <tbody>
          {projects.map((p, i) => (
            <tr
              key={p.id}
              className="border-t border-[var(--color-border)]"
            >
              <td className="py-2.5 pr-2 text-[var(--color-text-muted)] tabular-nums text-xs align-top pt-3">
                {i + 1}
              </td>

              <td className="py-2.5 pr-3">
                <Link
                  to={`/projects/${p.id}`}
                  className="font-medium text-[var(--color-text-primary)] hover:text-[var(--color-accent)] transition-colors"
                >
                  {p.clientName}
                </Link>
                <div className="text-[10px] text-[var(--color-text-muted)] font-mono mt-0.5">
                  {p.code} · {p.capacityKwp.toLocaleString("es-UY", { maximumFractionDigits: 1 })} kWp
                </div>
                <div className="mt-1.5 w-20 h-1.5 rounded-full bg-[var(--color-bg-app)]">
                  <div
                    className="h-1.5 rounded-full bg-[var(--color-accent)]"
                    style={{ width: `${p.progressPercent}%` }}
                  />
                </div>
                <p className="text-[10px] text-[var(--color-text-muted)] mt-0.5">
                  {p.daysElapsed} días desde venta
                </p>
              </td>

              <td className="py-2.5 pr-3 text-right align-top pt-3">
                <span className="text-sm font-semibold tabular-nums text-[var(--color-text-primary)]">
                  {p.progressPercent}%
                </span>
              </td>

              <td className="py-2.5 align-top pt-3">
                <Badge variant={p.status} />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

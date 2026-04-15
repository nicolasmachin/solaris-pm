import type { Project } from "../../types/api.types";

function fmtSignedDays(value: number) {
  if (value > 0) return `+${value} días`;
  if (value < 0) return `${value} días`;
  return "0 días";
}

export function ProjectTimelineIndicators({ project }: { project: Project }) {
  const metrics = project.metrics;
  const totalPlannedDays = Math.max(metrics.totalPlannedDays, 1);
  const timeConsumedPercent = Math.max(0, Math.min(100, (metrics.daysElapsed / totalPlannedDays) * 100));
  const adjustedEndDate =
    project.plannedEndDate && metrics.delayDays !== 0
      ? new Date(new Date(project.plannedEndDate).getTime() + metrics.delayDays * 24 * 60 * 60 * 1000)
      : null;
  const plannedEndDate = project.plannedEndDate ? new Date(project.plannedEndDate) : null;
  const rhythmAtRisk = timeConsumedPercent > metrics.progressPercent + 15;

  return (
    <div className="mb-4 grid gap-3 md:grid-cols-3">
      <section className="rounded-lg border border-[var(--color-border)] bg-[var(--color-bg-card)] p-4">
        <p className="mb-2 font-mono text-[9px] uppercase tracking-widest text-[var(--color-text-muted)]">
          Tiempo consumido vs avance
        </p>
        <div className="relative h-3 overflow-hidden rounded-full bg-[var(--color-bg-app)]">
          <div
            className="absolute inset-y-0 left-0 rounded-full bg-sky-500/40"
            style={{ width: `${timeConsumedPercent}%` }}
          />
          <div
            className="absolute inset-y-0 left-0 rounded-full bg-[var(--color-state-done-text)]/70"
            style={{ width: `${metrics.progressPercent}%` }}
          />
        </div>
        <div className="mt-2 flex items-center justify-between text-[11px] text-[var(--color-text-secondary)]">
          <span>Tiempo {timeConsumedPercent.toFixed(1)}%</span>
          <span>Avance {metrics.progressPercent}%</span>
        </div>
        {rhythmAtRisk ? (
          <p className="mt-2 text-xs text-[var(--color-accent)]">⚠ Ritmo en riesgo</p>
        ) : (
          <p className="mt-2 text-xs text-[var(--color-text-muted)]">Ritmo alineado al plan</p>
        )}
      </section>

      <section className="rounded-lg border border-[var(--color-border)] bg-[var(--color-bg-card)] p-4">
        <p className="mb-2 font-mono text-[9px] uppercase tracking-widest text-[var(--color-text-muted)]">
          Desvío acumulado
        </p>
        <div
          className={`font-display text-3xl font-bold ${
            metrics.delayDays > 0
              ? "text-red-400"
              : metrics.delayDays < 0
                ? "text-[var(--color-state-done-text)]"
                : "text-[var(--color-text-primary)]"
          }`}
        >
          {fmtSignedDays(metrics.delayDays)}
        </div>
        <p className="mt-2 text-xs text-[var(--color-text-secondary)]">
          {metrics.delayDays > 0
            ? "Acumula retraso respecto del plan"
            : metrics.delayDays < 0
              ? "Viene adelantado frente al plan"
              : "Sin desvíos acumulados"}
        </p>
      </section>

      <section className="rounded-lg border border-[var(--color-border)] bg-[var(--color-bg-card)] p-4">
        <p className="mb-2 font-mono text-[9px] uppercase tracking-widest text-[var(--color-text-muted)]">
          Entrega ajustada
        </p>
        <div className="font-display text-2xl font-bold text-[var(--color-text-primary)]">
          {adjustedEndDate
            ? adjustedEndDate.toLocaleDateString("es-UY", { day: "2-digit", month: "short", year: "numeric" })
            : "Sin cambio"}
        </div>
        <p className="mt-2 text-xs text-[var(--color-text-secondary)]">
          Plan original:{" "}
          {plannedEndDate
            ? plannedEndDate.toLocaleDateString("es-UY", { day: "2-digit", month: "short", year: "numeric" })
            : "—"}
        </p>
      </section>
    </div>
  );
}

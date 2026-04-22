import type { Project } from "../../types/api.types";

function daysBetween(fromIso: string | null, to: Date): number | null {
  if (!fromIso) return null;
  const from = new Date(fromIso);
  if (isNaN(from.getTime())) return null;
  const DAY_MS = 24 * 60 * 60 * 1000;
  return Math.max(0, Math.round((to.getTime() - from.getTime()) / DAY_MS));
}

export function ProjectTimelineIndicators({ project }: { project: Project }) {
  const metrics = project.metrics;
  const now = new Date();
  const daysSinceSale = daysBetween(project.createdAt, now);
  const currentStage = project.currentStage;

  return (
    <div className="mb-4 grid gap-3 md:grid-cols-3">
      <section className="rounded-lg border border-[var(--color-border)] bg-[var(--color-bg-card)] p-4">
        <p className="mb-2 font-mono text-[9px] uppercase tracking-widest text-[var(--color-text-muted)]">
          Avance general
        </p>
        <div className="relative h-3 overflow-hidden rounded-full bg-[var(--color-bg-app)]">
          <div
            className="absolute inset-y-0 left-0 rounded-full bg-[var(--color-state-done-text)]/80"
            style={{ width: `${metrics.progressPercent}%` }}
          />
        </div>
        <p className="mt-2 text-[11px] text-[var(--color-text-secondary)]">
          {metrics.progressPercent}% completado
        </p>
      </section>

      <section className="rounded-lg border border-[var(--color-border)] bg-[var(--color-bg-card)] p-4">
        <p className="mb-2 font-mono text-[9px] uppercase tracking-widest text-[var(--color-text-muted)]">
          Tiempo desde venta
        </p>
        <div className="font-display text-3xl font-bold text-[var(--color-text-primary)]">
          {daysSinceSale != null ? `${daysSinceSale}` : "—"}
          {daysSinceSale != null && (
            <span className="ml-2 text-sm font-normal text-[var(--color-text-muted)]">días</span>
          )}
        </div>
        <p className="mt-2 text-xs text-[var(--color-text-secondary)]">
          Desde la creación del proyecto
        </p>
      </section>

      <section className="rounded-lg border border-[var(--color-border)] bg-[var(--color-bg-card)] p-4">
        <p className="mb-2 font-mono text-[9px] uppercase tracking-widest text-[var(--color-text-muted)]">
          Etapa actual
        </p>
        <div className="font-display text-2xl font-bold text-[var(--color-text-primary)]">
          {currentStage ? (currentStage.label || currentStage.name) : "—"}
        </div>
        <p className="mt-2 text-xs text-[var(--color-text-secondary)]">
          {currentStage ? `${currentStage.progressPercent}% de avance en esta etapa` : "Sin etapa en curso"}
        </p>
      </section>
    </div>
  );
}

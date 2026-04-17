import type { MetricsStageRow } from "../../types/api.types";

function fmt(v: number, d = 1): string {
  if (!isFinite(v) || isNaN(v)) return "—";
  return v.toLocaleString("es-UY", { maximumFractionDigits: d });
}

interface StageTimingChartProps {
  stages: MetricsStageRow[];
}

export function StageTimingChart({ stages }: StageTimingChartProps) {
  const filtered = stages.filter(
    (s) => s.stageName !== "POSTVENTA" && s.completedCount > 0,
  );
  const maxDays = Math.max(1, ...filtered.flatMap((s) => [s.avgPlannedDays, s.avgActualDays]));

  if (filtered.length === 0) {
    return (
      <p className="text-sm text-[var(--color-text-muted)]">
        Todavía no hay proyectos completados para calcular promedios.
      </p>
    );
  }

  return (
    <div>
      {/* Leyenda */}
      <div className="flex items-center gap-4 mb-4">
        <span className="flex items-center gap-1.5 text-[11px] text-[var(--color-text-muted)]">
          <span
            className="inline-block w-3 h-3 rounded-sm"
            style={{ background: "rgba(14,165,233,0.7)" }}
          />
          Plan
        </span>
        <span className="flex items-center gap-1.5 text-[11px] text-[var(--color-text-muted)]">
          <span
            className="inline-block w-3 h-3 rounded-sm"
            style={{ background: "rgba(245,158,11,0.7)" }}
          />
          Real
        </span>
      </div>

      <div className="space-y-5">
        {filtered.map((stage) => (
          <div key={stage.stageName}>
            {/* Header de etapa */}
            <div className="flex items-center justify-between mb-1.5">
              <div>
                <span className="text-sm font-medium text-[var(--color-text-primary)]">
                  {stage.stageLabel}
                </span>
                <span className="ml-2 text-[10px] text-[var(--color-text-muted)]">
                  {stage.completedCount} proy.
                </span>
              </div>
              <span
                className={`text-sm font-semibold tabular-nums ${
                  stage.avgDelayDays > 0
                    ? "text-red-400"
                    : stage.avgDelayDays < 0
                      ? "text-green-400"
                      : "text-[var(--color-text-muted)]"
                }`}
              >
                {stage.avgDelayDays > 0 ? "+" : ""}
                {fmt(stage.avgDelayDays)}d
              </span>
            </div>

            {/* Barra Plan */}
            <div className="mb-1">
              <div className="h-2 rounded-full bg-[var(--color-bg-app)] overflow-hidden">
                <div
                  className="h-2 rounded-full transition-all duration-500"
                  style={{
                    width: `${(stage.avgPlannedDays / maxDays) * 100}%`,
                    background: "rgba(14,165,233,0.7)",
                  }}
                />
              </div>
              <p className="text-[10px] text-[var(--color-text-muted)] mt-0.5">
                plan {fmt(stage.avgPlannedDays)}d
              </p>
            </div>

            {/* Barra Real */}
            <div>
              <div className="h-2 rounded-full bg-[var(--color-bg-app)] overflow-hidden">
                <div
                  className="h-2 rounded-full transition-all duration-500"
                  style={{
                    width: `${(stage.avgActualDays / maxDays) * 100}%`,
                    background: "rgba(245,158,11,0.7)",
                  }}
                />
              </div>
              <p className="text-[10px] text-[var(--color-text-muted)] mt-0.5">
                real {fmt(stage.avgActualDays)}d
              </p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

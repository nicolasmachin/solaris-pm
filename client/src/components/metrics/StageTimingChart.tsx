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
  const maxDays = Math.max(1, ...filtered.map((s) => s.maxActualDays));

  if (filtered.length === 0) {
    return (
      <p className="text-sm text-[var(--color-text-muted)]">
        Todavía no hay etapas completadas para calcular duraciones.
      </p>
    );
  }

  return (
    <div>
      <div className="flex items-center gap-4 mb-4">
        <span className="flex items-center gap-1.5 text-[11px] text-[var(--color-text-muted)]">
          <span
            className="inline-block w-3 h-3 rounded-sm"
            style={{ background: "rgba(55,138,221,0.7)" }}
          />
          Promedio real
        </span>
        <span className="text-[11px] text-[var(--color-text-muted)]">
          (min/max = rango observado)
        </span>
      </div>

      <div className="space-y-5">
        {filtered.map((stage) => {
          const avgPct = (stage.avgActualDays / maxDays) * 100;
          const minPct = (stage.minActualDays / maxDays) * 100;
          const maxPct = (stage.maxActualDays / maxDays) * 100;
          return (
            <div key={stage.stageName}>
              <div className="flex items-center justify-between mb-1.5">
                <div>
                  <span className="text-sm font-medium text-[var(--color-text-primary)]">
                    {stage.stageLabel}
                  </span>
                  <span className="ml-2 text-[10px] text-[var(--color-text-muted)]">
                    {stage.completedCount} etapas completadas
                  </span>
                  {stage.complianceRate != null && (
                    <span
                      className="ml-2 rounded px-1.5 py-0.5 text-[10px] font-semibold"
                      style={{
                        background:
                          stage.complianceRate >= 80
                            ? "var(--color-success-bg-soft)"
                            : stage.complianceRate >= 50
                              ? "var(--color-warning-bg)"
                              : "var(--color-danger-bg)",
                        color:
                          stage.complianceRate >= 80
                            ? "var(--color-success-text-strong)"
                            : stage.complianceRate >= 50
                              ? "var(--color-warning-text)"
                              : "var(--color-danger-text)",
                      }}
                      title={`${stage.withinSlaCount} en plazo · ${stage.overSlaCount} fuera de plazo (SLA ${stage.slaDiasHabiles} días háb.)`}
                    >
                      {stage.complianceRate}% en plazo
                    </span>
                  )}
                </div>
                <span className="text-sm font-semibold tabular-nums text-[var(--color-text-primary)]">
                  {fmt(stage.avgActualDays)}d
                </span>
              </div>

              <div className="relative h-2 rounded-full bg-[var(--color-bg-app)] overflow-hidden">
                <div
                  className="absolute top-0 h-2 rounded-full"
                  style={{
                    left: `${minPct}%`,
                    width: `${Math.max(maxPct - minPct, 0.5)}%`,
                    background: "rgba(55,138,221,0.25)",
                  }}
                />
                <div
                  className="absolute top-0 h-2 rounded-full transition-all duration-500"
                  style={{
                    width: `${avgPct}%`,
                    background: "rgba(55,138,221,0.9)",
                  }}
                />
              </div>
              <p className="text-[10px] text-[var(--color-text-muted)] mt-0.5 flex justify-between">
                <span>min {fmt(stage.minActualDays)}d</span>
                {stage.slaDiasHabiles != null && (
                  <span>
                    plazo {stage.slaDiasHabiles} días háb.
                    {stage.avgDelayBusinessDays != null && (
                      <span
                        style={{
                          color:
                            stage.avgDelayBusinessDays > 0
                              ? "var(--color-danger-text)"
                              : "var(--color-success-text-strong)",
                        }}
                      >
                        {" "}
                        · desvío prom. {stage.avgDelayBusinessDays > 0 ? "+" : ""}
                        {fmt(stage.avgDelayBusinessDays)}d háb.
                      </span>
                    )}
                  </span>
                )}
                <span>max {fmt(stage.maxActualDays)}d</span>
              </p>
            </div>
          );
        })}
      </div>
    </div>
  );
}

import type { Stage, SubstageStatus } from "../../types/api.types";

const STATUS_BAR_COLOR: Record<SubstageStatus, string> = {
  COMPLETED: "var(--color-state-done-text)",
  IN_PROGRESS: "var(--color-accent)",
  BLOCKED: "var(--color-danger-text)",
  PENDING: "var(--color-border-hover)",
};

const STATUS_PCT: Record<SubstageStatus, number> = {
  COMPLETED: 100,
  IN_PROGRESS: 50,
  BLOCKED: 0,
  PENDING: 0,
};

interface ProgressPanelProps {
  stages: Stage[];
}

export function ProgressPanel({ stages }: ProgressPanelProps) {
  const activeStage =
    stages.find((s) => s.status === "IN_PROGRESS") ??
    [...stages].reverse().find((s) => s.status === "COMPLETED");

  const substages = activeStage?.substages ?? [];

  return (
    <div className="bg-[var(--color-bg-card)] border border-[var(--color-border)] rounded-lg p-4">
      <p className="font-mono text-[9px] uppercase tracking-widest text-[var(--color-text-muted)] mb-1">
        Avance por área
      </p>
      {activeStage && (
        <p className="text-[10px] text-[var(--color-text-secondary)] mb-3">
          Etapa: {activeStage.name}
        </p>
      )}

      {substages.length === 0 ? (
        <p className="text-xs text-[var(--color-text-muted)]">Sin subetapas</p>
      ) : (
        <ul className="space-y-2.5">
          {substages.map((sub) => {
            const pct = STATUS_PCT[sub.status];
            const color = STATUS_BAR_COLOR[sub.status];
            return (
              <li key={sub.id}>
                <div className="flex items-center justify-between mb-1">
                  <p className="text-[10px] text-[var(--color-text-primary)] truncate flex-1 pr-2">
                    {sub.name}
                  </p>
                  <span className="font-mono text-[10px] text-[var(--color-text-muted)] shrink-0">
                    {pct}%
                  </span>
                </div>
                <div
                  className="w-full rounded-full overflow-hidden"
                  style={{ height: 4, background: "var(--color-border)" }}
                >
                  <div
                    className="h-full rounded-full transition-all duration-500"
                    style={{ width: `${pct}%`, background: color }}
                  />
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

import type { Project } from "../../types/api.types";

interface KpiCardProps {
  label: string;
  value: string | number;
  unit: string;
  delta?: React.ReactNode;
  warning?: string;
}

function KpiCard({ label, value, unit, delta, warning }: KpiCardProps) {
  return (
    <div className="bg-[var(--color-bg-card)] border border-[var(--color-border)] rounded-lg px-4 py-3">
      <p className="font-mono text-[9px] uppercase tracking-widest text-[var(--color-text-muted)] mb-2">
        {label}
      </p>
      <div className="flex items-baseline gap-1">
        <span className="font-display text-2xl font-bold text-[var(--color-text-primary)]">
          {value}
        </span>
        <span className="text-xs text-[var(--color-text-muted)]">{unit}</span>
      </div>
      {delta && <div className="mt-1 text-[10px]">{delta}</div>}
      {warning && (
        <p className="mt-1 text-[10px] text-[var(--color-accent)]">{warning}</p>
      )}
    </div>
  );
}

function fmt(n: number) {
  return n.toLocaleString("es-AR");
}

interface KpiCardsProps {
  project: Project;
}

export function KpiCards({ project }: KpiCardsProps) {
  const m = project.metrics;

  // Card 1 — Avance
  const avanceWarning =
    m.timeEfficiency < 85 ? "⚠ Ritmo en riesgo" : undefined;

  // Card 2 — Días
  let daysDelta: React.ReactNode;
  if (m.delayDays > 0) {
    daysDelta = (
      <span className="text-[var(--color-accent)]">⚠ +{m.delayDays} días desvío</span>
    );
  } else if (m.delayDays < 0) {
    daysDelta = (
      <span className="text-[var(--color-state-done-text,#4ade80)]">
        ↑ {Math.abs(m.delayDays)} días adelanto
      </span>
    );
  } else {
    daysDelta = <span className="text-[var(--color-state-done-text)]">↑ En tiempo</span>;
  }

  const daysValue = m.daysRemaining > 0 ? m.daysRemaining : 0;

  // Card 3 — Presupuesto
  const budgetDelta = (
    <span className="text-[var(--color-text-muted)]">
      USD {fmt(project.executedUsd)} / {fmt(project.budgetUsd)}
    </span>
  );

  // Card 4 — Generación
  const co2Delta = project.co2TonsAvoided ? (
    <span className="text-[var(--color-state-done-text)]">{project.co2TonsAvoided} ton CO₂ evitadas</span>
  ) : null;

  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4">
      <KpiCard
        label="Avance global"
        value={m.progressPercent}
        unit="%"
        delta={<span className="text-[var(--color-text-muted)]">↑ +0% este mes</span>}
        warning={avanceWarning}
      />
      <KpiCard
        label="Para entrega"
        value={daysValue}
        unit="d"
        delta={daysDelta}
      />
      <KpiCard
        label="Presupuesto ejec."
        value={m.budgetUsedPercent.toFixed(1)}
        unit="%"
        delta={budgetDelta}
      />
      <KpiCard
        label="Generación est./año"
        value={project.estimatedMwhYear ?? "—"}
        unit="MWh"
        delta={co2Delta}
      />
    </div>
  );
}

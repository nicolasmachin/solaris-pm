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
        <p className="mt-1 text-[10px] text-[var(--color-warn-inline)]">{warning}</p>
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

  // Card 2 — Días desde venta
  const daysSinceSaleDelta = (
    <span className="text-[var(--color-text-muted)]">Desde creación del proyecto</span>
  );

  // Card 3 — Presupuesto
  const budgetDelta = project.budgetUsd != null ? (
    <span className="text-[var(--color-text-muted)]">
      USD {fmt(project.executedUsd)} / {fmt(project.budgetUsd)}
    </span>
  ) : (
    <span className="text-[var(--color-text-muted)]">
      USD {fmt(project.executedUsd)} · sin presupuesto
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
      />
      <KpiCard
        label="Días desde venta"
        value={m.daysElapsed}
        unit="d"
        delta={daysSinceSaleDelta}
      />
      <KpiCard
        label="Presupuesto ejec."
        value={m.budgetUsedPercent != null ? m.budgetUsedPercent.toFixed(1) : "—"}
        unit={m.budgetUsedPercent != null ? "%" : ""}
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

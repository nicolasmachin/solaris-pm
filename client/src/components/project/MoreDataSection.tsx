import { useState } from "react";
import type { Project } from "../../types/api.types";
import { ProgressPanel } from "./ProgressPanel";

function fmt(n: number | null | undefined, d = 0): string {
  if (n == null || !isFinite(n)) return "—";
  return n.toLocaleString("es-AR", { maximumFractionDigits: d, minimumFractionDigits: d > 0 ? 1 : 0 });
}

function Stat({ label, value, unit }: { label: string; value: string | number; unit?: string }) {
  return (
    <div className="rounded-lg border border-[var(--color-border)] bg-[var(--color-bg-app)] px-3 py-2">
      <p className="font-mono text-[9px] uppercase tracking-widest text-[var(--color-text-muted)]">
        {label}
      </p>
      <p className="mt-1 font-display text-lg font-bold text-[var(--color-text-primary)] leading-none">
        {value}
        {unit ? <span className="ml-1 text-xs font-normal text-[var(--color-text-muted)]">{unit}</span> : null}
      </p>
    </div>
  );
}

export function MoreDataSection({ project }: { project: Project }) {
  const [expanded, setExpanded] = useState(false);

  const m = project.metrics;
  const budgetPct = m?.budgetUsedPercent != null ? fmt(m.budgetUsedPercent, 1) : "—";
  const budgetSub = project.budgetUsd != null
    ? `USD ${fmt(project.executedUsd)} / ${fmt(project.budgetUsd)}`
    : "Sin presupuesto cargado";

  return (
    <section className="mt-4 rounded-xl border border-[var(--color-border)] bg-[var(--color-bg-card)]">
      <button
        type="button"
        onClick={() => setExpanded((v) => !v)}
        className="flex w-full items-center justify-between px-5 py-3 text-left"
      >
        <span className="font-mono text-[10px] uppercase tracking-[0.2em] text-[var(--color-text-muted)]">
          Más datos del proyecto
        </span>
        <span className="text-xs text-[var(--color-text-muted)]">
          {expanded ? "▲ Ocultar" : "▼ Mostrar"}
        </span>
      </button>
      {expanded ? (
        <div className="space-y-4 border-t border-[var(--color-border)] p-5">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
            <Stat label="Presupuesto ejec." value={budgetPct} unit={budgetPct === "—" ? undefined : "%"} />
            <Stat
              label="Generación est./año"
              value={project.estimatedMwhYear != null ? fmt(project.estimatedMwhYear) : "—"}
              unit={project.estimatedMwhYear != null ? "MWh" : undefined}
            />
            <Stat
              label="CO₂ evitado"
              value={project.co2TonsAvoided != null ? fmt(project.co2TonsAvoided, 1) : "—"}
              unit={project.co2TonsAvoided != null ? "tCO₂" : undefined}
            />
            <Stat
              label="Capacidad"
              value={project.capacityKwp ? fmt(project.capacityKwp, 1) : "—"}
              unit={project.capacityKwp ? "kWp" : undefined}
            />
          </div>
          <p className="text-[11px] text-[var(--color-text-muted)]">{budgetSub}</p>
          <ProgressPanel stages={project.stages} />
        </div>
      ) : null}
    </section>
  );
}

import type { Project, Stage } from "../../types/api.types";
import { stageLabel } from "../../constants/stages";

const DAY_MS = 24 * 60 * 60 * 1000;

function daysSince(fromIso: string | null | undefined): number | null {
  if (!fromIso) return null;
  const from = new Date(fromIso);
  if (isNaN(from.getTime())) return null;
  return Math.max(0, Math.round((Date.now() - from.getTime()) / DAY_MS));
}

function pickCurrentStage(stages: Stage[]): Stage | null {
  // Primero la etapa IN_PROGRESS más reciente (por actualStartDate); si no hay,
  // la primera PENDING por orden.
  const inProgress = stages
    .filter((s) => s.status === "IN_PROGRESS")
    .sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
  if (inProgress.length > 0) return inProgress[0];
  const pending = stages
    .filter((s) => s.status === "PENDING")
    .sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
  return pending[0] ?? null;
}

interface KpiCardProps {
  label: string;
  value: string | number;
  subtitle?: string;
}

function KpiCard({ label, value, subtitle }: KpiCardProps) {
  return (
    <div className="rounded-lg border border-[var(--color-border)] bg-[var(--color-bg-card)] px-4 py-3">
      <p className="font-mono text-[9px] uppercase tracking-widest text-[var(--color-text-muted)] mb-2">
        {label}
      </p>
      <p className="font-display text-2xl font-bold text-[var(--color-text-primary)] leading-none">
        {value}
      </p>
      {subtitle ? (
        <p className="mt-1.5 text-[11px] text-[var(--color-text-secondary)]">{subtitle}</p>
      ) : null}
    </div>
  );
}

export function KpiCards({ project }: { project: Project }) {
  const stages = project.stages ?? [];
  const total = stages.length;
  const completed = stages.filter((s) => s.status === "COMPLETED").length;
  const progressPercent = project.metrics?.progressPercent ?? 0;
  const daysFromSale = daysSince(project.createdAt);
  // La etapa MOSTRADA viene resuelta del backend (respeta el override manual);
  // si no vino, se deriva localmente.
  const currentStage = project.currentStage ?? pickCurrentStage(stages);
  const currentStageName = currentStage ? stageLabel(currentStage.name) : "—";
  const currentStageDays =
    currentStage?.status === "IN_PROGRESS"
      ? daysSince(currentStage.actualStartDate)
      : null;

  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mb-4">
      <KpiCard
        label="Avance"
        value={`${progressPercent}%`}
        subtitle={total > 0 ? `${completed} de ${total} etapas` : undefined}
      />
      <KpiCard
        label="Días desde venta"
        value={daysFromSale ?? "—"}
        subtitle={daysFromSale != null ? "desde la creación" : undefined}
      />
      <KpiCard
        label="Etapa actual"
        value={currentStageName}
        subtitle={
          currentStageDays != null
            ? `${currentStageDays} ${currentStageDays === 1 ? "día" : "días"} en curso`
            : currentStage?.status === "PENDING"
              ? "Sin iniciar"
              : undefined
        }
      />
    </div>
  );
}

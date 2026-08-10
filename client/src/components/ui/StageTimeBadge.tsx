import type { StageCountdown, CountdownStatus } from "../../types/api.types";
import { OutlineDotBadge } from "./Badge";

// Semáforo de plazo por etapa. Verde (ok) = falta; amarillo (warning) = falta
// poco; rojo (overdue) = vencida con cuenta negativa creciente. La cuenta la
// calcula el backend (stage-sla.service) en días hábiles.

const TONE_BY_STATUS: Record<CountdownStatus, "success" | "warning" | "danger"> = {
  ok: "success",
  warning: "warning",
  overdue: "danger",
};

function diasLabel(n: number): string {
  const abs = Math.abs(n);
  return `${abs} ${abs === 1 ? "día háb." : "días háb."}`;
}

// Texto corto de la cuenta regresiva de una etapa EN CURSO.
export function countdownText(c: StageCountdown): string {
  if (c.status === "overdue") {
    return `Vencida · ${diasLabel(c.remainingBusinessDays)} de atraso`;
  }
  if (c.remainingBusinessDays === 0) return "Vence hoy";
  return `Faltan ${diasLabel(c.remainingBusinessDays)}`;
}

// Badge de cuenta regresiva (etapa en curso).
export function CountdownBadge({
  countdown,
  className = "",
}: {
  countdown: StageCountdown;
  className?: string;
}) {
  return (
    <OutlineDotBadge
      tone={TONE_BY_STATUS[countdown.status]}
      label={countdownText(countdown)}
      className={className}
    />
  );
}

// Cuenta regresiva "grande" para la cabecera del proyecto: número + estado.
export function CountdownHero({ countdown }: { countdown: StageCountdown }) {
  const tone = TONE_BY_STATUS[countdown.status];
  const colorVar =
    tone === "danger"
      ? "var(--color-danger-text)"
      : tone === "warning"
        ? "var(--color-warning-text)"
        : "var(--color-success-text-strong)";
  const overdue = countdown.status === "overdue";
  const big = Math.abs(countdown.remainingBusinessDays);
  return (
    <div className="flex items-baseline gap-1.5">
      <span className="text-2xl font-bold tabular-nums" style={{ color: colorVar }}>
        {overdue ? `−${big}` : big}
      </span>
      <span className="text-xs" style={{ color: "var(--color-text-muted)" }}>
        {overdue
          ? "días háb. de atraso"
          : countdown.remainingBusinessDays === 1
            ? "día háb. restante"
            : "días háb. restantes"}
      </span>
    </div>
  );
}

// Marca de cumplimiento para una etapa COMPLETADA: días que duró + si cumplió.
// Usa el countdown (calculado sobre actualStart→actualEnd) para el color.
export function StageDoneBadge({
  actualDurationDays,
  countdown,
  className = "",
}: {
  actualDurationDays: number | null;
  countdown?: StageCountdown | null;
  className?: string;
}) {
  const dias = actualDurationDays ?? 0;
  const base = `${dias} ${dias === 1 ? "día" : "días"}`;
  if (!countdown) {
    return <OutlineDotBadge tone="neutral" label={base} className={className} />;
  }
  const overdue = countdown.status === "overdue";
  const label = overdue
    ? `${base} · +${diasLabel(countdown.remainingBusinessDays)} tarde`
    : `${base} · en plazo`;
  return (
    <OutlineDotBadge
      tone={overdue ? "danger" : "success"}
      label={label}
      className={className}
    />
  );
}

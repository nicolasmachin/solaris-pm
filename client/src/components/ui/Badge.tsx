import type { StageStatus, TaskStatus, TaskPriority, ProjectStatus } from "../../types/api.types";

type BadgeVariant = StageStatus | TaskStatus | TaskPriority | ProjectStatus | "default";

const VARIANT_STYLES: Record<BadgeVariant, string> = {
  COMPLETED: "text-[var(--color-state-done-text)] bg-[var(--color-state-done-bg)]",
  IN_PROGRESS: "text-[var(--color-state-active-text)] bg-[var(--color-state-active-bg)]",
  PENDING: "text-[var(--color-state-pending-text)] bg-[var(--color-state-pending-bg)]",
  BLOCKED: "text-[var(--color-danger-text)] bg-[var(--color-danger-bg)]",
  WAITING: "text-[var(--color-warning-text)] bg-[var(--color-warning-bg)]",
  CANCELLED: "text-[var(--color-text-muted)] bg-[var(--color-bg-card)]",
  LOW: "text-[var(--color-text-secondary)] bg-[var(--color-border)]",
  MEDIUM: "text-[var(--color-info-text)] bg-[var(--color-info-bg)]",
  HIGH: "text-[var(--color-warning-text)] bg-[var(--color-warning-bg)]",
  URGENT: "text-[var(--color-danger-text)] bg-[var(--color-danger-bg)]",
  ARCHIVED: "text-[var(--color-text-muted)] bg-[var(--color-bg-app)]",
  PROSPECT: "text-[var(--color-info-text)] bg-[var(--color-info-bg)]",
  PLANNING: "text-[var(--color-info-text)] bg-[var(--color-info-bg)]",
  ACTIVE: "text-[var(--color-state-active-text)] bg-[var(--color-state-active-bg)]",
  PAUSED: "text-[var(--color-warning-text)] bg-[var(--color-warning-bg)]",
  ON_HOLD: "text-[var(--color-warning-text)] bg-[var(--color-warning-bg)]",
  NORMAL: "text-[var(--color-text-secondary)] bg-[var(--color-border)]",
  default: "text-[var(--color-text-secondary)] bg-[var(--color-border)]",
};

const LABELS: Partial<Record<BadgeVariant, string>> = {
  IN_PROGRESS: "En Progreso",
  COMPLETED: "Completado",
  PENDING: "Pendiente",
  BLOCKED: "Bloqueado",
  WAITING: "En espera",
  CANCELLED: "Cancelado",
  LOW: "Baja",
  MEDIUM: "Media",
  HIGH: "Alta",
  URGENT: "Urgente",
  ARCHIVED: "Archivado",
  PROSPECT: "Prospecto",
  PLANNING: "Planificación",
  ACTIVE: "Activo",
  PAUSED: "Pausado",
  ON_HOLD: "En Pausa",
  NORMAL: "Normal",
};

interface BadgeProps {
  variant?: BadgeVariant;
  label?: string;
  className?: string;
}

export function Badge({ variant = "default", label, className = "" }: BadgeProps) {
  const styles = VARIANT_STYLES[variant] ?? VARIANT_STYLES.default;
  const text = label ?? LABELS[variant] ?? variant;
  return (
    <span
      className={`inline-flex items-center px-2 py-0.5 rounded text-[10px] font-medium font-mono uppercase tracking-wide ${styles} ${className}`}
    >
      {text}
    </span>
  );
}

// ─── Variante "outline + dot" ────────────────────────────────────────────────
// Estilo distinto al Badge clásico (filled): pill con borde, dot de color
// adelante y bg suave. Pensado para status interactivos tipo "Esperando",
// "Pendiente", "En proceso". No reemplaza al Badge existente.

type OutlineDotTone = "neutral" | "danger" | "warning" | "info" | "success";

const OUTLINE_DOT_TONES: Record<
  OutlineDotTone,
  { bg: string; text: string; border: string; dot: string }
> = {
  neutral: {
    bg: "var(--color-bg-card)",
    text: "var(--color-text-secondary)",
    border: "var(--color-border)",
    dot: "var(--color-text-muted)",
  },
  danger: {
    bg: "var(--color-danger-bg)",
    text: "var(--color-danger-text)",
    border: "var(--color-danger-text)",
    dot: "var(--color-danger-text)",
  },
  warning: {
    bg: "var(--color-warning-bg)",
    text: "var(--color-warning-text)",
    border: "var(--color-warning-text)",
    dot: "var(--color-warning-text)",
  },
  info: {
    bg: "var(--color-info-bg)",
    text: "var(--color-info-text)",
    border: "var(--color-info-text)",
    dot: "var(--color-info-text)",
  },
  success: {
    bg: "var(--color-success-bg-soft)",
    text: "var(--color-success-text-strong)",
    border: "var(--color-success-text-strong)",
    dot: "var(--color-success-text-strong)",
  },
};

export function OutlineDotBadge({
  label,
  tone = "neutral",
  className = "",
}: {
  label: string;
  tone?: OutlineDotTone;
  className?: string;
}) {
  const t = OUTLINE_DOT_TONES[tone];
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-[10.5px] font-semibold ${className}`}
      style={{ background: t.bg, color: t.text, border: `1px solid ${t.border}` }}
    >
      <span
        aria-hidden
        className="inline-block h-1.5 w-1.5 rounded-full"
        style={{ background: t.dot }}
      />
      {label}
    </span>
  );
}

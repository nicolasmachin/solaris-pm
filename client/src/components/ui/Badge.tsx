import type { StageStatus, TaskStatus, TaskPriority, ProjectStatus } from "../../types/api.types";

type BadgeVariant = StageStatus | TaskStatus | TaskPriority | ProjectStatus | "default";

const VARIANT_STYLES: Record<BadgeVariant, string> = {
  COMPLETED: "text-[var(--color-state-done-text)] bg-[var(--color-state-done-bg)]",
  IN_PROGRESS: "text-[var(--color-state-active-text)] bg-[var(--color-state-active-bg)]",
  PENDING: "text-[var(--color-state-pending-text)] bg-[var(--color-state-pending-bg)]",
  BLOCKED: "text-[var(--color-danger-text)] bg-[var(--color-danger-bg)]",
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

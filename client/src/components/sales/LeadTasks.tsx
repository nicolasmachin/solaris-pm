import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Check, PauseCircle, Plus, User as UserIcon } from "lucide-react";
import { getLeadTasks, type LeadTaskItem } from "../../api/leads.api";
import { useAuthStore } from "../../store/auth.store";
import { useStandaloneTasks } from "../../hooks/useStandaloneTasks";
import { TaskDetailModal } from "../tasks/TaskDetailModal";
import { Spinner } from "../ui/Spinner";

// Pendientes colgados de un lead, dentro del panel del lead. Muestra los de
// todos los usuarios (no sólo los del que mira): el trabajo pendiente de un
// lead es información del lead, igual que sus comentarios o adjuntos.

interface Props {
  leadId: string;
  canEdit: boolean;
}

const MONTHS_ES = ["ene", "feb", "mar", "abr", "may", "jun", "jul", "ago", "sep", "oct", "nov", "dic"];

function formatDay(iso: string | null): string {
  if (!iso) return "";
  const d = new Date(iso.length === 10 ? `${iso}T00:00:00` : iso);
  if (isNaN(d.getTime())) return "";
  return `${String(d.getDate()).padStart(2, "0")} ${MONTHS_ES[d.getMonth()]}`;
}

type AlertKind = "overdue" | "today" | "upcoming" | "future" | "none";

function getAlertKind(iso: string | null): { kind: AlertKind; daysAbs: number } {
  if (!iso) return { kind: "none", daysAbs: 0 };
  const d = new Date(`${iso}T00:00:00`);
  if (isNaN(d.getTime())) return { kind: "none", daysAbs: 0 };
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const diffDays = Math.round((d.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
  if (diffDays < 0) return { kind: "overdue", daysAbs: Math.abs(diffDays) };
  if (diffDays === 0) return { kind: "today", daysAbs: 0 };
  if (diffDays <= 2) return { kind: "upcoming", daysAbs: diffDays };
  return { kind: "future", daysAbs: diffDays };
}

function badgeClassForAlert(kind: AlertKind): string {
  switch (kind) {
    case "overdue":
      return "bg-red-500/15 text-red-400 border-red-500/30";
    case "today":
    case "upcoming":
      return "bg-amber-500/15 text-amber-400 border-amber-500/30";
    default:
      return "bg-[var(--color-bg-app)] text-[var(--color-text-muted)] border-[var(--color-border)]";
  }
}

function badgeText(iso: string | null, kind: AlertKind, daysAbs: number): string {
  if (kind === "none" || !iso) return "Sin fecha";
  if (kind === "overdue") return `Vencida hace ${daysAbs}d`;
  if (kind === "today") return "Hoy";
  if (kind === "upcoming") return daysAbs === 1 ? "Mañana" : `En ${daysAbs}d`;
  return formatDay(iso);
}

export function LeadTasks({ leadId, canEdit }: Props) {
  const currentUserId = useAuthStore((s) => s.user?.id ?? null);
  const isAdmin = useAuthStore((s) => s.user?.role) === "ADMIN";
  const { completeTask, updateTask } = useStandaloneTasks();
  const [showCompleted, setShowCompleted] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);

  const tasksQuery = useQuery({
    queryKey: ["lead-tasks", leadId, { showCompleted }],
    queryFn: () => getLeadTasks(leadId, { includeCompleted: showCompleted }),
  });
  const tasks: LeadTaskItem[] = tasksQuery.data ?? [];

  return (
    <section className="mb-5 rounded-xl border border-[var(--color-border)] bg-[var(--color-bg-card)] p-4">
      <div className="mb-3 flex items-center justify-between gap-2">
        <div>
          <h3 className="text-sm font-semibold text-[var(--color-text-primary)]">Pendientes</h3>
          <p className="text-[11px] text-[var(--color-text-muted)]">
            Tareas asignadas a este cliente potencial
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setShowCompleted((v) => !v)}
            className="rounded-md border border-[var(--color-border)] px-2 py-1 text-[11px] text-[var(--color-text-secondary)] transition-colors hover:bg-[var(--color-bg-app)]"
          >
            {showCompleted ? "Ocultar completadas" : "Ver completadas"}
          </button>
          {canEdit ? (
            <button
              type="button"
              onClick={() => setCreating(true)}
              className="inline-flex items-center gap-1 rounded-md bg-[var(--color-accent)] px-2.5 py-1 text-[11px] font-medium text-gray-900 transition-colors hover:opacity-90"
            >
              <Plus size={13} />
              Nueva
            </button>
          ) : null}
        </div>
      </div>

      {tasksQuery.isLoading ? (
        <div className="flex justify-center py-4">
          <Spinner size={16} />
        </div>
      ) : tasks.length === 0 ? (
        <p className="py-3 text-center text-[12px] text-[var(--color-text-muted)]">
          {showCompleted ? "Sin pendientes en este cliente potencial" : "No hay pendientes abiertos"}
        </p>
      ) : (
        <ul className="divide-y divide-[var(--color-border)]">
          {tasks.map((t) => {
            const isDone = t.status === "COMPLETED";
            const isWaiting = t.status === "WAITING";
            const alertDate = isWaiting ? (t.followUpAt ?? t.dueDate) : t.dueDate;
            const alert = getAlertKind(alertDate);
            const assignees = t.assignees ?? [];
            const isMine = assignees.some((a) => a.id === currentUserId);
            let assigneeLabel: string | null = null;
            if (assignees.length > 0) {
              const others = assignees.filter((a) => a.id !== currentUserId);
              if (isMine) {
                assigneeLabel = others.length > 0 ? `(yo) +${others.length}` : "(yo)";
              } else {
                assigneeLabel =
                  assignees.length > 1
                    ? `${assignees[0].name} +${assignees.length - 1}`
                    : assignees[0].name;
              }
            }
            // Completar/reabrir lo permite el server solo a los asignados (y a
            // ADMIN). Sin eso el clic devolvería 403: mejor no ofrecerlo.
            const canToggle = isAdmin || isMine;
            const toggling = completeTask.isPending || updateTask.isPending;
            return (
              <li
                key={t.id}
                onClick={() => setEditingId(t.id)}
                className="flex cursor-pointer items-center gap-3 py-2.5 hover:bg-[var(--color-bg-app)]/40"
              >
                <button
                  type="button"
                  aria-label={isDone ? "Reabrir tarea" : "Marcar como completada"}
                  title={
                    canToggle
                      ? isDone
                        ? "Reabrir tarea"
                        : "Marcar como completada"
                      : "Solo los responsables pueden completarla"
                  }
                  onClick={(e) => {
                    e.stopPropagation();
                    if (!canToggle) return;
                    if (isDone) updateTask.mutate({ id: t.id, body: { status: "PENDING" } });
                    else completeTask.mutate(t.id);
                  }}
                  disabled={toggling || !canToggle}
                  className={`flex h-5 w-5 flex-shrink-0 items-center justify-center rounded border transition-colors ${
                    isDone
                      ? "border-emerald-500 bg-emerald-500 text-white"
                      : "border-[var(--color-border)] hover:border-[var(--color-accent)]"
                  } ${canToggle ? "" : "cursor-default opacity-50"}`}
                >
                  {isDone ? <Check size={12} /> : null}
                </button>
                <div className="min-w-0 flex-1">
                  <div
                    className={`truncate text-sm ${
                      isDone
                        ? "text-[var(--color-text-muted)] line-through"
                        : "text-[var(--color-text-primary)]"
                    }`}
                  >
                    {t.title}
                  </div>
                  {isWaiting && t.waitingReason ? (
                    <div className="mt-0.5 flex items-center gap-1 truncate text-[11px] text-amber-400">
                      <PauseCircle size={11} className="flex-shrink-0" />
                      {t.waitingReason}
                    </div>
                  ) : t.description ? (
                    <div className="mt-0.5 truncate text-[11px] text-[var(--color-text-muted)]">
                      {t.description}
                    </div>
                  ) : null}
                </div>
                <div className="flex flex-shrink-0 items-center gap-2">
                  {assigneeLabel ? (
                    <span
                      title={assignees.map((a) => a.name).join(", ")}
                      className="inline-flex items-center gap-1 text-[11px] text-[var(--color-text-muted)]"
                    >
                      <UserIcon size={11} />
                      {assigneeLabel}
                    </span>
                  ) : null}
                  {isDone ? (
                    <span className="text-[10px] text-[var(--color-text-muted)]">
                      {t.completedAt ? `Completada ${formatDay(t.completedAt)}` : "Completada"}
                    </span>
                  ) : (
                    <span
                      title={isWaiting ? "Fecha de recontacto" : "Vencimiento"}
                      className={`inline-flex items-center rounded border px-2 py-0.5 text-[10px] font-medium ${badgeClassForAlert(alert.kind)}`}
                    >
                      {isWaiting ? "Reconsultar " : ""}
                      {badgeText(alertDate, alert.kind, alert.daysAbs)}
                    </span>
                  )}
                </div>
              </li>
            );
          })}
        </ul>
      )}

      {creating ? (
        <TaskDetailModal isOpen defaultLeadId={leadId} onClose={() => setCreating(false)} />
      ) : null}
      {editingId ? (
        <TaskDetailModal isOpen taskId={editingId} onClose={() => setEditingId(null)} />
      ) : null}
    </section>
  );
}

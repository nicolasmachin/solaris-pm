import { useState } from "react";
import { Check, Plus, User as UserIcon } from "lucide-react";
import type { StandaloneTaskItem } from "../../api/myTasks.api";
import { useStandaloneTasks } from "../../hooks/useStandaloneTasks";
import { TaskDetailModal } from "./TaskDetailModal";

interface Props {
  tasks: StandaloneTaskItem[];
  // ID del usuario para el que se está viendo el panel (puede ser otro
  // distinto al autenticado si un ADMIN abrió ?userId=). Sólo se usa para
  // decidir si mostrar el nombre del asignado o "(yo)".
  currentUserId: string | null;
  // Si true, el bloque está mostrando tareas sueltas COMPLETADAS (sigue el
  // mismo toggle Pendientes/Completadas que las tareas de proyecto).
  completed?: boolean;
}

const MONTHS_ES = ["ene", "feb", "mar", "abr", "may", "jun", "jul", "ago", "sep", "oct", "nov", "dic"];
function formatCompletedAt(iso: string | null): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (isNaN(d.getTime())) return "";
  return `${String(d.getDate()).padStart(2, "0")} ${MONTHS_ES[d.getMonth()]} ${d.getFullYear()}`;
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
    case "future":
      return "bg-[var(--color-bg-app)] text-[var(--color-text-muted)] border-[var(--color-border)]";
    default:
      return "bg-[var(--color-bg-app)] text-[var(--color-text-muted)] border-[var(--color-border)]";
  }
}

function badgeText(iso: string | null, kind: AlertKind, daysAbs: number): string {
  if (kind === "none" || !iso) return "Sin fecha";
  if (kind === "overdue") return `Vencida hace ${daysAbs}d`;
  if (kind === "today") return "Hoy";
  if (kind === "upcoming") return daysAbs === 1 ? "Mañana" : `En ${daysAbs}d`;
  // future
  const d = new Date(`${iso}T00:00:00`);
  const dd = String(d.getDate()).padStart(2, "0");
  const months = ["ene", "feb", "mar", "abr", "may", "jun", "jul", "ago", "sep", "oct", "nov", "dic"];
  return `${dd}-${months[d.getMonth()]}`;
}

export function StandaloneTasksBlock({ tasks, currentUserId, completed = false }: Props) {
  const { completeTask, updateTask } = useStandaloneTasks();
  const [editing, setEditing] = useState<StandaloneTaskItem | null>(null);
  const [creating, setCreating] = useState(false);

  return (
    <section className="rounded-lg border border-[var(--color-border)] bg-[var(--color-bg-card)] overflow-hidden">
      <header className="flex items-center justify-between px-4 py-3 border-b border-[var(--color-border)]">
        <div>
          <h2 className="font-display font-bold text-sm text-[var(--color-text-primary)]">
            Tareas sueltas
          </h2>
          <p className="text-[11px] text-[var(--color-text-muted)] mt-0.5">
            {completed ? "Completadas, sin proyecto asociado" : "Pendientes sin proyecto asociado"}
          </p>
        </div>
        <button
          type="button"
          onClick={() => setCreating(true)}
          className="inline-flex items-center gap-1 px-3 py-1.5 rounded-md text-xs font-medium bg-[var(--color-accent)] text-gray-900 hover:bg-[var(--color-accent-hover,var(--color-accent))] transition-colors"
        >
          <Plus size={14} />
          Nueva
        </button>
      </header>

      {tasks.length === 0 ? (
        <div className="px-4 py-6 text-center text-[12px] text-[var(--color-text-muted)]">
          {completed ? "Todavía no completaste tareas sueltas" : "No tenés tareas sueltas pendientes"}
        </div>
      ) : (
        <ul className="divide-y divide-[var(--color-border)]">
          {tasks.map((t) => {
            const alert = getAlertKind(t.dueDate);
            const isMine = !!t.assignedUserId && t.assignedUserId === currentUserId;
            const isDone = t.status === "COMPLETED";
            const toggling = completeTask.isPending || updateTask.isPending;
            return (
              <li
                key={t.id}
                className="px-4 py-3 hover:bg-[var(--color-bg-card-hover)]/40 cursor-pointer flex items-center gap-3"
                onClick={() => setEditing(t)}
              >
                <button
                  type="button"
                  aria-label={isDone ? "Reabrir tarea" : "Marcar como completada"}
                  title={isDone ? "Reabrir tarea" : "Marcar como completada"}
                  onClick={(e) => {
                    e.stopPropagation();
                    if (isDone) updateTask.mutate({ id: t.id, body: { status: "PENDING" } });
                    else completeTask.mutate(t.id);
                  }}
                  disabled={toggling}
                  className={`w-5 h-5 rounded border flex items-center justify-center transition-colors flex-shrink-0 ${
                    isDone
                      ? "border-emerald-500 bg-emerald-500 text-white"
                      : "border-[var(--color-border)] hover:border-[var(--color-accent)]"
                  }`}
                >
                  <Check size={12} className={isDone ? "" : "text-[var(--color-text-muted)] opacity-0 group-hover:opacity-100"} />
                </button>
                <div className="flex-1 min-w-0">
                  <div className={`text-sm truncate ${isDone ? "text-[var(--color-text-muted)] line-through" : "text-[var(--color-text-primary)]"}`}>
                    {t.title}
                  </div>
                  {t.description ? (
                    <div className="text-[11px] text-[var(--color-text-muted)] truncate mt-0.5">
                      {t.description}
                    </div>
                  ) : null}
                </div>
                <div className="flex items-center gap-2 flex-shrink-0">
                  {t.assignedUser ? (
                    <span className="inline-flex items-center gap-1 text-[11px] text-[var(--color-text-muted)]">
                      <UserIcon size={11} />
                      {isMine ? "(yo)" : t.assignedUser.name}
                    </span>
                  ) : null}
                  {isDone ? (
                    <span className="text-[10px] text-[var(--color-text-muted)]">
                      {t.completedAt ? `Completada el ${formatCompletedAt(t.completedAt)}` : "Completada"}
                    </span>
                  ) : (
                    <span
                      className={`inline-flex items-center px-2 py-0.5 rounded text-[10px] font-medium border ${badgeClassForAlert(alert.kind)}`}
                    >
                      {badgeText(t.dueDate, alert.kind, alert.daysAbs)}
                    </span>
                  )}
                </div>
              </li>
            );
          })}
        </ul>
      )}

      {creating && (
        <TaskDetailModal isOpen onClose={() => setCreating(false)} />
      )}
      {editing && (
        <TaskDetailModal isOpen taskId={editing.id} onClose={() => setEditing(null)} />
      )}
    </section>
  );
}

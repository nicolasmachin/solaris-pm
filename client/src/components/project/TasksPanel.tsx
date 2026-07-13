import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import toast from "react-hot-toast";
import { Check } from "lucide-react";
import type { Task } from "../../types/api.types";
import { patchTask, deleteTask } from "../../api/tasks.api";
import { Button } from "../ui/Button";
import { MultiUserSelect } from "../ui/MultiUserSelect";
import { AssigneeLabel } from "../ui/AssigneeLabel";
import { CommentThread } from "../comments/CommentThread";

interface TasksPanelProps {
  projectId: string;
  tasks: Task[];
  onNewTask: () => void;
  onTasksChanged?: () => void;
}

const inputStyle: React.CSSProperties = {
  width: "100%",
  background: "var(--color-bg-app)",
  border: "1px solid var(--color-border)",
  borderRadius: 5,
  padding: "5px 8px",
  color: "var(--color-text-primary)",
  fontSize: 12,
  outline: "none",
};

const STATUS_OPTIONS: Task["status"][] = ["PENDING", "IN_PROGRESS", "COMPLETED", "CANCELLED"];
const STATUS_LABELS: Record<Task["status"], string> = {
  PENDING: "Pendiente",
  IN_PROGRESS: "En progreso",
  COMPLETED: "Completado",
  CANCELLED: "Cancelado",
};

const PRIORITY_OPTIONS: Task["priority"][] = ["LOW", "NORMAL", "MEDIUM", "HIGH", "URGENT"];
const PRIORITY_LABELS: Record<Task["priority"], string> = {
  LOW: "Baja",
  NORMAL: "Normal",
  MEDIUM: "Media",
  HIGH: "Alta",
  URGENT: "Urgente",
};

function TaskRow({
  task,
  projectId,
  onChanged,
  isCompletedView,
}: {
  task: Task;
  projectId: string;
  onChanged: () => void;
  isCompletedView: boolean;
}) {
  const [expanded, setExpanded] = useState(false);
  const [editing, setEditing] = useState(false);
  const [title, setTitle] = useState(task.title);
  const [description, setDescription] = useState(task.description ?? "");
  const [status, setStatus] = useState<Task["status"]>(task.status);
  const [priority, setPriority] = useState<Task["priority"]>(task.priority);
  const [assignedUserIds, setAssignedUserIds] = useState<string[]>(
    task.assignees?.map((a) => a.id) ?? (task.userId ? [task.userId] : []),
  );
  const [dueDate, setDueDate] = useState(task.dueDate?.slice(0, 10) ?? "");
  const [confirmDelete, setConfirmDelete] = useState(false);

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const overdue = task.dueDate ? new Date(task.dueDate) < today : false;

  const { mutate: saveEdit, isPending: saving } = useMutation({
    mutationFn: () => patchTask(projectId, task.id, {
      title, description: description || null, status, priority,
      assignedUserIds, dueDate: dueDate || null,
    }),
    onSuccess: () => {
      toast.success("Tarea actualizada");
      setEditing(false);
      onChanged();
    },
    onError: () => toast.error("Error al actualizar tarea"),
  });

  const { mutate: remove, isPending: deleting } = useMutation({
    mutationFn: () => deleteTask(projectId, task.id),
    onSuccess: () => {
      toast.success("Tarea eliminada");
      onChanged();
    },
    onError: () => toast.error("Error al eliminar tarea"),
  });

  const { mutate: complete, isPending: completing } = useMutation({
    mutationFn: () =>
      patchTask(projectId, task.id, {
        status: isCompletedView ? "PENDING" : "COMPLETED",
      }),
    onSuccess: () => {
      toast.success(isCompletedView ? "Tarea reabierta" : "Tarea completada");
      onChanged();
    },
    onError: () =>
      toast.error(isCompletedView ? "Error al reabrir tarea" : "Error al completar tarea"),
  });

  const priorityDot: Record<Task["priority"], string> = {
    URGENT: "var(--color-accent)",
    HIGH: "#8cc7ff",
    MEDIUM: "#4fa6ff",
    NORMAL: "#4fa6ff",
    LOW: "var(--color-border-hover)",
  };

  function formatDue(d: string | null) {
    if (!d) return null;
    return new Date(d).toLocaleDateString("es-AR", { day: "2-digit", month: "short" });
  }

  function formatCompletedAt(iso: string) {
    const d = new Date(iso);
    if (isNaN(d.getTime())) return "—";
    return d.toLocaleDateString("es-AR", { day: "2-digit", month: "short", year: "2-digit" }) +
      " " +
      d.toLocaleTimeString("es-AR", { hour: "2-digit", minute: "2-digit" });
  }

  return (
    <li>
      <div
        className="flex items-start gap-2 cursor-pointer"
        onClick={() => { if (!editing) setExpanded(v => !v); }}
      >
        {isCompletedView ? (
          <span
            aria-hidden="true"
            className="inline-flex h-4 w-4 shrink-0 items-center justify-center rounded-full bg-emerald-500/20 text-emerald-400 mt-0.5"
          >
            <Check size={10} />
          </span>
        ) : (
          <button
            type="button"
            aria-label="Marcar como completada"
            title="Marcar como completada"
            onClick={(e) => {
              e.stopPropagation();
              if (completing) return;
              complete();
            }}
            disabled={completing}
            className="group relative inline-flex h-4 w-4 shrink-0 items-center justify-center rounded-full border border-[var(--color-border)] bg-[var(--color-bg-app)] text-[var(--color-text-muted)] transition-colors hover:border-emerald-400 hover:bg-emerald-500/10 hover:text-emerald-400 disabled:opacity-50 mt-0.5"
          >
            <Check size={10} className="opacity-0 group-hover:opacity-100 transition-opacity" />
          </button>
        )}
        <span
          className="w-1.5 h-1.5 rounded-full shrink-0 mt-1.5"
          style={{ background: priorityDot[task.priority] ?? "#60a5fa" }}
        />
        <div className="flex-1 min-w-0">
          <p
            className={`text-xs leading-snug truncate ${
              isCompletedView
                ? "text-[var(--color-text-muted)] line-through"
                : "text-[var(--color-text-primary)]"
            }`}
          >
            {task.title}
          </p>
          {isCompletedView && task.completedAt ? (
            <p className="font-mono text-[10px] text-emerald-400">
              ✓ {formatCompletedAt(task.completedAt)}
            </p>
          ) : task.dueDate && !isCompletedView ? (
            <p className={`font-mono text-[10px] ${overdue ? "text-red-400" : "text-[var(--color-text-muted)]"}`}>
              {overdue ? "⚠ " : ""}{formatDue(task.dueDate)}
            </p>
          ) : null}
        </div>
        {isCompletedView ? (
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              if (completing) return;
              complete();
            }}
            disabled={completing}
            className="shrink-0 rounded border border-[var(--color-border)] px-1.5 py-0.5 text-[9px] font-mono uppercase tracking-wider text-[var(--color-text-secondary)] hover:bg-[var(--color-bg-card-hover)] disabled:opacity-50"
          >
            {completing ? "…" : "Reabrir"}
          </button>
        ) : task.priority === "URGENT" ? (
          <span className="shrink-0 text-[9px] font-mono font-bold text-[var(--color-accent)] uppercase">URG</span>
        ) : null}
      </div>

      {expanded && !editing && (
        <div style={{ marginTop: 6, marginLeft: 14, padding: "10px 12px", background: "var(--color-bg-app)", border: "1px solid var(--color-border)", borderRadius: 6 }}>
          {task.description && (
            <p style={{ fontSize: 11, color: "var(--color-text-secondary)", marginBottom: 8 }}>{task.description}</p>
          )}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "4px 12px", fontSize: 11, color: "var(--color-text-muted)", marginBottom: 10 }}>
            <span>Estado: <span style={{ color: "var(--color-text-secondary)" }}>{STATUS_LABELS[task.status]}</span></span>
            <span>Prioridad: <span style={{ color: "var(--color-text-secondary)" }}>{PRIORITY_LABELS[task.priority]}</span></span>
            <span>
              {task.assignees && task.assignees.length > 1 ? "Responsables: " : "Responsable: "}
              {task.assignees && task.assignees.length > 0 ? (
                <span style={{ color: "var(--color-text-secondary)" }}>
                  {task.assignees.map((a) => a.name).join(", ")}
                </span>
              ) : (
                <AssigneeLabel user={task.user} legacyText={task.responsible} />
              )}
            </span>
            {task.dueDate && <span>Vence: <span style={{ color: "var(--color-text-secondary)" }}>{formatDue(task.dueDate)}</span></span>}
          </div>
          <div style={{ display: "flex", gap: 6 }}>
            <button
              onClick={e => { e.stopPropagation(); setEditing(true); }}
              style={{ padding: "3px 10px", borderRadius: 4, border: "1px solid var(--color-border)", background: "none", color: "var(--color-text-secondary)", fontSize: 11, cursor: "pointer" }}
            >
              Editar
            </button>
            <button
              onClick={e => { e.stopPropagation(); setConfirmDelete(true); }}
              style={{ padding: "3px 10px", borderRadius: 4, border: "1px solid #7f1d1d", background: "none", color: "#f87171", fontSize: 11, cursor: "pointer" }}
            >
              Eliminar
            </button>
          </div>
          <div style={{ marginTop: 12 }}>
            <CommentThread projectId={projectId} taskId={task.id} level="task" />
          </div>
        </div>
      )}

      {editing && (
        <div
          style={{ marginTop: 6, marginLeft: 14, padding: "10px 12px", background: "var(--color-bg-app)", border: "1px solid var(--color-border)", borderRadius: 6 }}
          onClick={e => e.stopPropagation()}
        >
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            <input style={{ ...inputStyle, fontSize: 12 }} value={title} onChange={e => setTitle(e.target.value)} />
            <input style={inputStyle} value={description} onChange={e => setDescription(e.target.value)} />
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
              <select style={{ ...inputStyle, cursor: "pointer" }} value={status} onChange={e => setStatus(e.target.value as Task["status"])}>
                {STATUS_OPTIONS.map(s => <option key={s} value={s}>{STATUS_LABELS[s]}</option>)}
              </select>
              <select style={{ ...inputStyle, cursor: "pointer" }} value={priority} onChange={e => setPriority(e.target.value as Task["priority"])}>
                {PRIORITY_OPTIONS.map(p => <option key={p} value={p}>{PRIORITY_LABELS[p]}</option>)}
              </select>
            </div>
            <div>
              <div style={{ fontSize: 10, color: "var(--color-text-muted)", marginBottom: 2 }}>Responsables</div>
              <MultiUserSelect
                value={assignedUserIds}
                onChange={setAssignedUserIds}
                ariaLabel="Responsables de la tarea"
              />
              {assignedUserIds.length === 0 && task.responsible && task.responsible.trim() !== "" ? (
                <p style={{ marginTop: 4, fontSize: 10, color: "var(--color-text-muted)" }}>
                  Texto legacy: <span style={{ fontStyle: "italic" }}>{task.responsible}</span>
                </p>
              ) : null}
            </div>
            <input style={inputStyle} type="date" value={dueDate} onChange={e => setDueDate(e.target.value)} />
            <div style={{ display: "flex", gap: 6 }}>
              <button
                onClick={() => saveEdit()}
                disabled={saving}
                style={{ padding: "4px 12px", borderRadius: 4, border: "none", background: "var(--color-accent)", color: "#000", fontSize: 11, fontWeight: 600, cursor: saving ? "not-allowed" : "pointer", opacity: saving ? 0.6 : 1 }}
              >
                {saving ? "Guardando..." : "Guardar"}
              </button>
              <button
                onClick={() => setEditing(false)}
                style={{ padding: "4px 10px", borderRadius: 4, border: "1px solid var(--color-border)", background: "none", color: "var(--color-text-secondary)", fontSize: 11, cursor: "pointer" }}
              >
                Cancelar
              </button>
            </div>
          </div>
        </div>
      )}

      {confirmDelete && (
        <div
          style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.6)", zIndex: 200, display: "flex", alignItems: "center", justifyContent: "center" }}
          onMouseDown={e => { if (e.target === e.currentTarget) setConfirmDelete(false); }}
        >
          <div style={{ background: "var(--color-bg-card)", border: "1px solid var(--color-border)", borderRadius: 10, padding: 24, width: 340 }}>
            <p style={{ fontSize: 14, color: "var(--color-text-primary)", marginBottom: 8 }}>¿Eliminar tarea?</p>
            <p style={{ fontSize: 12, color: "var(--color-text-muted)", marginBottom: 20 }}><strong>{task.title}</strong></p>
            <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
              <button onClick={() => setConfirmDelete(false)} style={{ padding: "7px 14px", borderRadius: 6, border: "1px solid var(--color-border)", background: "none", color: "var(--color-text-secondary)", fontSize: 13, cursor: "pointer" }}>
                Cancelar
              </button>
              <button onClick={() => { remove(); setConfirmDelete(false); }} disabled={deleting} style={{ padding: "7px 14px", borderRadius: 6, border: "none", background: "#dc2626", color: "#fff", fontSize: 13, fontWeight: 600, cursor: deleting ? "not-allowed" : "pointer" }}>
                {deleting ? "Eliminando..." : "Eliminar"}
              </button>
            </div>
          </div>
        </div>
      )}
    </li>
  );
}

export function TasksPanel({ projectId, tasks, onNewTask, onTasksChanged }: TasksPanelProps) {
  const qc = useQueryClient();
  const [scope, setScope] = useState<"pending" | "completed">("pending");

  const visible = (() => {
    if (scope === "pending") {
      return tasks
        .filter((t) => t.status !== "COMPLETED" && t.status !== "CANCELLED")
        .sort((a, b) => {
          if (!a.dueDate) return 1;
          if (!b.dueDate) return -1;
          return new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime();
        })
        .slice(0, 8);
    }
    // Completadas: orden descendente por completedAt (más recientes primero).
    return tasks
      .filter((t) => t.status === "COMPLETED")
      .sort((a, b) => {
        const ta = a.completedAt ? new Date(a.completedAt).getTime() : 0;
        const tb = b.completedAt ? new Date(b.completedAt).getTime() : 0;
        return tb - ta;
      })
      .slice(0, 20);
  })();

  function handleChanged() {
    if (onTasksChanged) {
      onTasksChanged();
    } else {
      qc.invalidateQueries({ queryKey: ["project"] });
    }
  }

  return (
    <div className="bg-[var(--color-bg-card)] border border-[var(--color-border)] rounded-lg p-4 flex flex-col">
      <div className="flex items-center justify-between gap-2 mb-3">
        <p className="font-mono text-[9px] uppercase tracking-widest text-[var(--color-text-muted)]">
          Tareas
        </p>
        <div className="inline-flex rounded-md border border-[var(--color-border)] bg-[var(--color-bg-app)] p-0.5 text-[10px]">
          <button
            type="button"
            onClick={() => setScope("pending")}
            className={`rounded px-2 py-0.5 transition-colors ${
              scope === "pending"
                ? "bg-[var(--color-accent)] text-black font-semibold"
                : "text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)]"
            }`}
          >
            Pendientes
          </button>
          <button
            type="button"
            onClick={() => setScope("completed")}
            className={`rounded px-2 py-0.5 transition-colors ${
              scope === "completed"
                ? "bg-[var(--color-accent)] text-black font-semibold"
                : "text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)]"
            }`}
          >
            Completadas
          </button>
        </div>
      </div>

      {visible.length === 0 ? (
        <p className="text-xs text-[var(--color-text-muted)] flex-1 flex items-center">
          {scope === "pending" ? "Sin tareas pendientes" : "Aún no se completaron tareas"}
        </p>
      ) : (
        <ul className="space-y-2 flex-1">
          {visible.map((task) => (
            <TaskRow
              key={task.id}
              task={task}
              projectId={projectId}
              onChanged={handleChanged}
              isCompletedView={scope === "completed"}
            />
          ))}
        </ul>
      )}

      <div className="mt-3 pt-3 border-t border-[var(--color-border)]">
        <Button variant="ghost" size="sm" onClick={onNewTask} className="w-full justify-center text-[var(--color-accent)]">
          + Nueva tarea
        </Button>
      </div>
    </div>
  );
}

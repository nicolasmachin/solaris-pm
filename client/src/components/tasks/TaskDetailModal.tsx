import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ExternalLink } from "lucide-react";
import { getProjects } from "../../api/projects.api";
import {
  createStandaloneTask,
  deleteStandaloneTask,
  getTask,
  updateStandaloneTask,
} from "../../api/standaloneTasks.api";
import { Button } from "../ui/Button";
import { MultiUserSelect } from "../ui/MultiUserSelect";
import { Spinner } from "../ui/Spinner";
import { CommentThread } from "../comments/CommentThread";
import toast from "react-hot-toast";

// Modal unificado para crear y editar tareas (sueltas o de proyecto).
// Modo creación: sin `taskId`. Renderiza solo el form, sin comentarios.
// Modo edición: con `taskId`. Hace fetch del detalle y muestra comments
// abajo. Reemplaza a StandaloneTaskModal y al TaskModal viejo del módulo
// project.

interface Props {
  isOpen: boolean;
  onClose: () => void;
  // Edición: pasar taskId — el modal carga el detalle del server.
  taskId?: string;
  // Creación: pre-fills opcionales.
  defaultProjectId?: string | null;
  defaultDueDate?: string;
}

export function TaskDetailModal({
  isOpen,
  onClose,
  taskId,
  defaultProjectId,
  defaultDueDate,
}: Props) {
  const isEdit = Boolean(taskId);
  const qc = useQueryClient();

  // Cerrar con Escape
  useEffect(() => {
    if (!isOpen) return;
    const fn = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", fn);
    return () => window.removeEventListener("keydown", fn);
  }, [isOpen, onClose]);

  const taskQuery = useQuery({
    queryKey: ["task", taskId],
    queryFn: () => getTask(taskId as string),
    enabled: Boolean(taskId) && isOpen,
  });

  // Form state — se sincroniza al cargar la tarea en modo edición.
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [dueDate, setDueDate] = useState("");
  const [projectId, setProjectId] = useState<string>("");
  const [assignedUserIds, setAssignedUserIds] = useState<string[]>([]);
  const [confirmDelete, setConfirmDelete] = useState(false);
  // Panel de "poner en espera". Se despliega al elegir el estado: el motivo es
  // obligatorio (el server lo exige) porque sin él la espera no se distingue de
  // un pendiente.
  const [waitingOpen, setWaitingOpen] = useState(false);
  const [waitingReason, setWaitingReason] = useState("");
  const [followUpAt, setFollowUpAt] = useState("");

  // Re-seed cuando se abre el modal o cambia la tarea cargada.
  useEffect(() => {
    if (!isOpen) return;
    if (isEdit && taskQuery.data) {
      const t = taskQuery.data;
      setTitle(t.title);
      setDescription(t.description ?? "");
      setDueDate(t.dueDate ?? "");
      setProjectId(t.projectId ?? "");
      setAssignedUserIds(t.assignees?.map((a) => a.id) ?? (t.userId ? [t.userId] : []));
      setConfirmDelete(false);
      setWaitingReason(t.waitingReason ?? "");
      setFollowUpAt(t.followUpAt ?? "");
      setWaitingOpen(t.status === "WAITING");
    } else if (!isEdit) {
      setTitle("");
      setDescription("");
      setDueDate(defaultDueDate ?? "");
      setProjectId(defaultProjectId ?? "");
      setAssignedUserIds([]);
      setConfirmDelete(false);
      setWaitingReason("");
      setFollowUpAt("");
      setWaitingOpen(false);
    }
  }, [isOpen, isEdit, taskQuery.data, defaultProjectId, defaultDueDate]);

  const projectsQuery = useQuery({
    queryKey: ["projects", "active-for-task-select"],
    queryFn: () => getProjects({ status: "ACTIVE", sortBy: "recent" }),
    staleTime: 5 * 60_000,
    enabled: isOpen,
  });
  const projectOptions = useMemo(() => projectsQuery.data ?? [], [projectsQuery.data]);

  const createMut = useMutation({
    mutationFn: () =>
      createStandaloneTask({
        title: title.trim(),
        description: description.trim() || null,
        dueDate: dueDate || null,
        projectId: projectId || null,
        assignedUserIds,
      }),
    onSuccess: () => {
      toast.success("Tarea creada");
      qc.invalidateQueries({ queryKey: ["my-tasks"] });
      qc.invalidateQueries({ queryKey: ["dashboard-my-tasks"] });
      onClose();
    },
    onError: () => toast.error("No se pudo crear la tarea"),
  });

  const updateMut = useMutation({
    mutationFn: () =>
      updateStandaloneTask(taskId as string, {
        title: title.trim(),
        description: description.trim() || null,
        dueDate: dueDate || null,
        projectId: projectId || null,
        assignedUserIds,
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["task", taskId] });
      qc.invalidateQueries({ queryKey: ["my-tasks"] });
      qc.invalidateQueries({ queryKey: ["dashboard-my-tasks"] });
      onClose();
    },
    onError: () => toast.error("No se pudo guardar"),
  });

  // Toggle de estado: completar/reabrir inmediato (sin pasar por el botón
  // Guardar). Útil para marcar completada sin tener que tocar el resto.
  const statusMut = useMutation({
    mutationFn: (next: "PENDING" | "COMPLETED" | "WAITING") =>
      updateStandaloneTask(taskId as string, {
        status: next,
        ...(next === "WAITING"
          ? { waitingReason: waitingReason.trim(), followUpAt: followUpAt || null }
          : {}),
      }),
    onSuccess: (_, next) => {
      const msg =
        next === "COMPLETED"
          ? "Marcada como completada"
          : next === "WAITING"
            ? "Queda en espera"
            : "Reabierta";
      toast.success(msg);
      if (next !== "WAITING") setWaitingOpen(false);
      qc.invalidateQueries({ queryKey: ["task", taskId] });
      qc.invalidateQueries({ queryKey: ["my-tasks"] });
      qc.invalidateQueries({ queryKey: ["dashboard-my-tasks"] });
    },
    onError: () => toast.error("No se pudo cambiar el estado"),
  });

  const deleteMut = useMutation({
    mutationFn: () => deleteStandaloneTask(taskId as string),
    onSuccess: () => {
      toast.success("Tarea eliminada");
      qc.invalidateQueries({ queryKey: ["my-tasks"] });
      qc.invalidateQueries({ queryKey: ["dashboard-my-tasks"] });
      onClose();
    },
    onError: () => toast.error("No se pudo eliminar"),
  });

  if (!isOpen) return null;

  const submitting = createMut.isPending || updateMut.isPending;
  const canSubmit = title.trim().length > 0 && !submitting;
  const status = taskQuery.data?.status ?? "PENDING";
  const isCompleted = status === "COMPLETED";
  const isWaiting = status === "WAITING";
  const isPending = !isCompleted && !isWaiting;

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center bg-black/60 p-4 overflow-y-auto"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="relative my-8 w-full max-w-xl bg-[var(--color-bg-card)] border border-[var(--color-border)] rounded-xl shadow-2xl p-6">
        <div className="flex items-center justify-between mb-5">
          <h2 className="font-display font-bold text-base text-[var(--color-text-primary)]">
            {isEdit ? "Detalle de tarea" : "Nueva tarea"}
          </h2>
          <button
            onClick={onClose}
            type="button"
            className="p-1.5 rounded hover:bg-[var(--color-border)] text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)] transition-colors"
          >
            ✕
          </button>
        </div>

        {isEdit && taskQuery.isLoading ? (
          <div className="flex min-h-[120px] items-center justify-center">
            <Spinner />
          </div>
        ) : (
          <>
            <form
              onSubmit={(e) => {
                e.preventDefault();
                if (!canSubmit) return;
                if (isEdit) updateMut.mutate();
                else createMut.mutate();
              }}
              className="space-y-3"
            >
              <div>
                <label className="block text-xs font-medium text-[var(--color-text-secondary)] mb-1">
                  Título *
                </label>
                <input
                  required
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  className="w-full px-3 py-2 rounded-md text-sm bg-[var(--color-bg-app)] border border-[var(--color-border)] text-[var(--color-text-primary)] focus:outline-none focus:border-[var(--color-accent)]"
                  autoFocus
                />
              </div>

              {isEdit && (
                <div>
                  <label className="block text-xs font-medium text-[var(--color-text-secondary)] mb-1">
                    Estado
                  </label>
                  <div className="inline-flex rounded-md border border-[var(--color-border)] bg-[var(--color-bg-app)] p-0.5 text-xs">
                    <button
                      type="button"
                      onClick={() => {
                        if (isPending) return;
                        statusMut.mutate("PENDING");
                      }}
                      disabled={statusMut.isPending}
                      className={`px-3 py-1 rounded transition-colors ${
                        isPending
                          ? "bg-[var(--color-bg-card)] text-[var(--color-text-primary)] font-medium"
                          : "text-[var(--color-text-muted)] hover:text-[var(--color-text-secondary)]"
                      }`}
                    >
                      Pendiente
                    </button>
                    <button
                      type="button"
                      // No dispara el cambio: despliega el panel, porque sin
                      // motivo el server rechaza la transición.
                      onClick={() => setWaitingOpen(true)}
                      disabled={statusMut.isPending}
                      className={`px-3 py-1 rounded transition-colors ${
                        isWaiting
                          ? "bg-amber-500/20 text-amber-300 font-medium"
                          : "text-[var(--color-text-muted)] hover:text-[var(--color-text-secondary)]"
                      }`}
                    >
                      En espera
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        if (isCompleted) return;
                        statusMut.mutate("COMPLETED");
                      }}
                      disabled={statusMut.isPending}
                      className={`px-3 py-1 rounded transition-colors ${
                        isCompleted
                          ? "bg-[var(--color-accent)] text-gray-900 font-medium"
                          : "text-[var(--color-text-muted)] hover:text-[var(--color-text-secondary)]"
                      }`}
                    >
                      Completada
                    </button>
                  </div>

                  {waitingOpen && (
                    <div className="mt-2 space-y-2 rounded-md border border-amber-500/30 bg-amber-500/5 p-3">
                      <div>
                        <label className="block text-xs font-medium text-[var(--color-text-secondary)] mb-1">
                          ¿Qué se está esperando? *
                        </label>
                        <input
                          value={waitingReason}
                          onChange={(e) => setWaitingReason(e.target.value)}
                          maxLength={500}
                          placeholder="Respuesta del cliente, permiso municipal…"
                          className="w-full px-3 py-2 rounded-md text-sm bg-[var(--color-bg-app)] border border-[var(--color-border)] text-[var(--color-text-primary)] focus:outline-none focus:border-[var(--color-accent)]"
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-medium text-[var(--color-text-secondary)] mb-1">
                          Reconsultar el
                        </label>
                        <input
                          type="date"
                          value={followUpAt}
                          onChange={(e) => setFollowUpAt(e.target.value)}
                          className="w-full px-3 py-2 rounded-md text-sm bg-[var(--color-bg-app)] border border-[var(--color-border)] text-[var(--color-text-primary)] focus:outline-none focus:border-[var(--color-accent)]"
                        />
                      </div>
                      <div className="flex gap-2">
                        <button
                          type="button"
                          onClick={() => statusMut.mutate("WAITING")}
                          disabled={statusMut.isPending || waitingReason.trim().length === 0}
                          className="rounded-md bg-amber-500 px-3 py-1.5 text-xs font-semibold text-gray-900 disabled:opacity-50"
                        >
                          {isWaiting ? "Actualizar espera" : "Poner en espera"}
                        </button>
                        {!isWaiting && (
                          <button
                            type="button"
                            onClick={() => setWaitingOpen(false)}
                            className="rounded-md border border-[var(--color-border)] px-3 py-1.5 text-xs text-[var(--color-text-secondary)]"
                          >
                            Cancelar
                          </button>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              )}

              {isEdit && taskQuery.data?.lead ? (
                <div className="rounded-md border border-[var(--color-border)] bg-[var(--color-bg-app)] px-3 py-2 text-xs">
                  <span className="text-[var(--color-text-muted)]">Cliente potencial: </span>
                  <span className="text-[var(--color-text-primary)]">
                    {taskQuery.data.lead.name}
                  </span>
                  <span className="ml-1 font-mono text-[10px] text-[var(--color-text-muted)]">
                    {taskQuery.data.lead.code}
                  </span>
                </div>
              ) : null}

              <div>
                <label className="block text-xs font-medium text-[var(--color-text-secondary)] mb-1">
                  Descripción
                </label>
                <textarea
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  rows={3}
                  className="w-full px-3 py-2 rounded-md text-sm bg-[var(--color-bg-app)] border border-[var(--color-border)] text-[var(--color-text-primary)] focus:outline-none focus:border-[var(--color-accent)] resize-none"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-[var(--color-text-secondary)] mb-1">
                    Fecha
                  </label>
                  <input
                    type="date"
                    value={dueDate}
                    onChange={(e) => setDueDate(e.target.value)}
                    className="w-full px-3 py-2 rounded-md text-sm bg-[var(--color-bg-app)] border border-[var(--color-border)] text-[var(--color-text-primary)] focus:outline-none focus:border-[var(--color-accent)]"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-[var(--color-text-secondary)] mb-1">
                    Asignados
                  </label>
                  <MultiUserSelect
                    value={assignedUserIds}
                    onChange={setAssignedUserIds}
                    ariaLabel="Asignados a la tarea"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-[var(--color-text-secondary)] mb-1">
                  Proyecto (opcional)
                </label>
                <select
                  value={projectId}
                  onChange={(e) => setProjectId(e.target.value)}
                  disabled={projectsQuery.isLoading}
                  className="w-full px-3 py-2 rounded-md text-sm bg-[var(--color-bg-app)] border border-[var(--color-border)] text-[var(--color-text-primary)] focus:outline-none focus:border-[var(--color-accent)] disabled:opacity-60"
                >
                  <option value="">Sin proyecto (tarea suelta)</option>
                  {projectOptions.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.code} · {p.clientName}
                    </option>
                  ))}
                </select>
                {isEdit && taskQuery.data?.project ? (
                  <Link
                    to={`/projects/${taskQuery.data.project.id}`}
                    onClick={onClose}
                    className="mt-1.5 inline-flex items-center gap-1 text-[11px] text-[var(--color-accent)] hover:underline"
                  >
                    <ExternalLink size={11} />
                    Ir a {taskQuery.data.project.name}
                  </Link>
                ) : null}
              </div>

              <div className="flex gap-3 pt-2">
                <Button
                  type="submit"
                  loading={submitting}
                  disabled={!canSubmit}
                  className="flex-1"
                >
                  {isEdit ? "Guardar cambios" : "Crear tarea"}
                </Button>
                <Button type="button" variant="ghost" onClick={onClose}>
                  Cancelar
                </Button>
                {isEdit && (
                  <Button
                    type="button"
                    variant="ghost"
                    onClick={() => setConfirmDelete(true)}
                    className="text-red-400 hover:text-red-300"
                  >
                    Eliminar
                  </Button>
                )}
              </div>

              {confirmDelete && (
                <div className="rounded-md border border-red-500/30 bg-red-500/10 p-3 text-xs">
                  <p className="text-[var(--color-text-primary)] mb-2">
                    ¿Eliminar esta tarea? Esta acción no se puede deshacer.
                  </p>
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={() => deleteMut.mutate()}
                      disabled={deleteMut.isPending}
                      className="rounded-md bg-red-600 px-3 py-1.5 text-xs font-semibold text-white"
                    >
                      Sí, eliminar
                    </button>
                    <button
                      type="button"
                      onClick={() => setConfirmDelete(false)}
                      className="rounded-md border border-[var(--color-border)] px-3 py-1.5 text-xs text-[var(--color-text-secondary)]"
                    >
                      Cancelar
                    </button>
                  </div>
                </div>
              )}
            </form>

            {isEdit && taskId ? (
              <div className="mt-5">
                <CommentThread level="task" taskId={taskId} />
              </div>
            ) : null}
          </>
        )}
      </div>
    </div>
  );
}

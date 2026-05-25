import { useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { getProjects } from "../../api/projects.api";
import type { StandaloneTaskItem } from "../../api/myTasks.api";
import { useStandaloneTasks } from "../../hooks/useStandaloneTasks";
import { Button } from "../ui/Button";
import { UserSelect } from "../ui/UserSelect";

interface Props {
  // Modo edición si viene `task`; modo creación si es undefined.
  task?: StandaloneTaskItem;
  // Si se pasa, se pre-rellena el selector de proyecto (modo "crear desde
  // la página del proyecto"). El usuario puede limpiarlo desde el modal.
  defaultProjectId?: string | null;
  // Pre-rellena el campo de fecha de vencimiento (modo "crear desde el
  // calendario"). YYYY-MM-DD.
  defaultDueDate?: string;
  onClose: () => void;
}

export function StandaloneTaskModal({ task, defaultProjectId, defaultDueDate, onClose }: Props) {
  const isEdit = !!task;
  const { createTask, updateTask } = useStandaloneTasks();

  const [title, setTitle] = useState(task?.title ?? "");
  const [description, setDescription] = useState(task?.description ?? "");
  const [dueDate, setDueDate] = useState(task?.dueDate ?? defaultDueDate ?? "");
  const [projectId, setProjectId] = useState<string>(defaultProjectId ?? "");
  const [assignedUserId, setAssignedUserId] = useState<string | null>(
    task?.assignedUserId ?? null,
  );

  // Carga de proyectos activos para el selector. ARCHIVED/COMPLETED se
  // filtran del lado del backend con sortBy recent — alcanza para que las
  // tareas sueltas vinculen a algo en curso. Si el usuario edita una tarea
  // que estaba atada a un proyecto archivado, sigue mostrándose en la
  // opción seleccionada porque la mantenemos aparte abajo.
  const { data: projects, isLoading: projectsLoading } = useQuery({
    queryKey: ["projects", "active-for-task-select"],
    queryFn: () => getProjects({ status: "ACTIVE", sortBy: "recent" }),
    staleTime: 5 * 60_000,
  });

  // Cerrar con Escape
  useEffect(() => {
    const fn = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", fn);
    return () => window.removeEventListener("keydown", fn);
  }, [onClose]);

  const projectOptions = useMemo(() => projects ?? [], [projects]);

  const submitting = createTask.isPending || updateTask.isPending;
  const canSubmit = title.trim().length > 0 && !submitting;

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!canSubmit) return;
    const body = {
      title: title.trim(),
      description: description.trim() || null,
      dueDate: dueDate || null,
      projectId: projectId || null,
      assignedUserId: assignedUserId ?? null,
    };
    if (isEdit && task) {
      updateTask.mutate(
        { id: task.id, body },
        { onSuccess: () => onClose() },
      );
    } else {
      createTask.mutate(body, { onSuccess: () => onClose() });
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="relative w-full max-w-md bg-[var(--color-bg-card)] border border-[var(--color-border)] rounded-xl shadow-2xl p-6">
        <div className="flex items-center justify-between mb-5">
          <h2 className="font-display font-bold text-base text-[var(--color-text-primary)]">
            {isEdit ? "Editar tarea" : "Nueva tarea suelta"}
          </h2>
          <button
            onClick={onClose}
            className="p-1.5 rounded hover:bg-[var(--color-border)] text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)] transition-colors"
            type="button"
          >
            ✕
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-3">
          <div>
            <label className="block text-xs font-medium text-[var(--color-text-secondary)] mb-1">
              Título *
            </label>
            <input
              required
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="w-full px-3 py-2 rounded-md text-sm bg-[var(--color-bg-app)] border border-[var(--color-border)] text-[var(--color-text-primary)] placeholder-[var(--color-text-muted)] focus:outline-none focus:border-[var(--color-accent)]"
              autoFocus
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-[var(--color-text-secondary)] mb-1">
              Descripción
            </label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={2}
              className="w-full px-3 py-2 rounded-md text-sm bg-[var(--color-bg-app)] border border-[var(--color-border)] text-[var(--color-text-primary)] placeholder-[var(--color-text-muted)] focus:outline-none focus:border-[var(--color-accent)] resize-none"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-[var(--color-text-secondary)] mb-1">
                Fecha de vencimiento
              </label>
              <input
                type="date"
                value={dueDate ?? ""}
                onChange={(e) => setDueDate(e.target.value)}
                className="w-full px-3 py-2 rounded-md text-sm bg-[var(--color-bg-app)] border border-[var(--color-border)] text-[var(--color-text-primary)] focus:outline-none focus:border-[var(--color-accent)]"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-[var(--color-text-secondary)] mb-1">
                Asignado a
              </label>
              <UserSelect
                value={assignedUserId}
                onChange={setAssignedUserId}
                ariaLabel="Asignado a"
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
              disabled={projectsLoading}
              className="w-full px-3 py-2 rounded-md text-sm bg-[var(--color-bg-app)] border border-[var(--color-border)] text-[var(--color-text-primary)] focus:outline-none focus:border-[var(--color-accent)] disabled:opacity-60"
            >
              <option value="">Sin proyecto (tarea suelta)</option>
              {projectOptions.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.code} · {p.clientName}
                </option>
              ))}
            </select>
            {isEdit && projectId && (
              <p className="mt-1 text-[10px] italic text-[var(--color-text-muted)]">
                Si la dejás sin proyecto, deja de aparecer en el bloque del proyecto y queda en "Tareas sueltas".
              </p>
            )}
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
          </div>
        </form>
      </div>
    </div>
  );
}

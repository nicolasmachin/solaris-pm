import { useEffect, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import toast from "react-hot-toast";
import { createTask } from "../../api/tasks.api";
import type { Stage } from "../../types/api.types";
import { Button } from "../ui/Button";

interface TaskModalProps {
  projectId: string;
  stages: Stage[];
  onClose: () => void;
}

export function TaskModal({ projectId, stages, onClose }: TaskModalProps) {
  const qc = useQueryClient();

  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [responsible, setResponsible] = useState("");
  const [priority, setPriority] = useState<"NORMAL" | "URGENT">("NORMAL");
  const [dueDate, setDueDate] = useState("");
  const [stageId, setStageId] = useState("");

  useEffect(() => {
    const fn = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", fn);
    return () => window.removeEventListener("keydown", fn);
  }, [onClose]);

  const mutation = useMutation({
    mutationFn: () =>
      createTask(projectId, {
        title,
        responsible,
        description: description || null,
        priority,
        stageId: stageId || null,
        dueDate: dueDate || null,
      }),
    onSuccess: () => {
      toast.success("Tarea creada correctamente");
      qc.invalidateQueries({ queryKey: ["project", projectId] });
      onClose();
    },
    onError: () => toast.error("Error al crear la tarea"),
  });

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center px-4">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/60" onClick={onClose} />

      {/* Modal */}
      <div className="relative w-full max-w-md bg-[var(--color-bg-card)] border border-[var(--color-border)] rounded-xl shadow-2xl p-6 z-10">
        <div className="flex items-center justify-between mb-5">
          <h2 className="font-display font-bold text-base text-[var(--color-text-primary)]">
            Nueva tarea
          </h2>
          <button
            onClick={onClose}
            className="p-1.5 rounded hover:bg-[var(--color-border)] text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)] transition-colors"
          >
            ✕
          </button>
        </div>

        <form
          onSubmit={(e) => {
            e.preventDefault();
            mutation.mutate();
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
              className="w-full px-3 py-2 rounded-md text-sm bg-[var(--color-bg-app)] border border-[var(--color-border)] text-[var(--color-text-primary)] placeholder-[var(--color-text-muted)] focus:outline-none focus:border-[var(--color-accent)]"
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

          <div>
            <label className="block text-xs font-medium text-[var(--color-text-secondary)] mb-1">
              Responsable *
            </label>
            <input
              required
              value={responsible}
              onChange={(e) => setResponsible(e.target.value)}
              className="w-full px-3 py-2 rounded-md text-sm bg-[var(--color-bg-app)] border border-[var(--color-border)] text-[var(--color-text-primary)] placeholder-[var(--color-text-muted)] focus:outline-none focus:border-[var(--color-accent)]"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-[var(--color-text-secondary)] mb-1">
                Prioridad
              </label>
              <div className="flex rounded-md overflow-hidden border border-[var(--color-border)]">
                {(["NORMAL", "URGENT"] as const).map((p) => (
                  <button
                    key={p}
                    type="button"
                    onClick={() => setPriority(p)}
                    className={`flex-1 py-1.5 text-xs font-medium transition-colors ${
                      priority === p
                        ? p === "URGENT"
                          ? "bg-[var(--color-accent)] text-gray-900"
                          : "bg-[var(--color-border)] text-[var(--color-text-primary)]"
                        : "text-[var(--color-text-muted)] hover:text-[var(--color-text-secondary)]"
                    }`}
                  >
                    {p === "URGENT" ? "⚡ Urgente" : "Normal"}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label className="block text-xs font-medium text-[var(--color-text-secondary)] mb-1">
                Fecha límite
              </label>
              <input
                type="date"
                value={dueDate}
                onChange={(e) => setDueDate(e.target.value)}
                className="w-full px-3 py-2 rounded-md text-sm bg-[var(--color-bg-app)] border border-[var(--color-border)] text-[var(--color-text-primary)] focus:outline-none focus:border-[var(--color-accent)]"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-[var(--color-text-secondary)] mb-1">
              Etapa relacionada
            </label>
            <select
              value={stageId}
              onChange={(e) => setStageId(e.target.value)}
              className="w-full px-3 py-2 rounded-md text-sm bg-[var(--color-bg-app)] border border-[var(--color-border)] text-[var(--color-text-primary)] focus:outline-none focus:border-[var(--color-accent)]"
            >
              <option value="">Sin etapa</option>
              {stages.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.order}. {s.name}
                </option>
              ))}
            </select>
          </div>

          <div className="flex gap-3 pt-2">
            <Button
              type="submit"
              loading={mutation.isPending}
              disabled={!title || !responsible}
              className="flex-1"
            >
              Crear tarea
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

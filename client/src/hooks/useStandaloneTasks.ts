import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "react-hot-toast";
import {
  createStandaloneTask,
  deleteStandaloneTask,
  updateStandaloneTask,
  type CreateStandaloneTaskBody,
  type UpdateStandaloneTaskBody,
} from "../api/standaloneTasks.api";

// Hook con las mutaciones de tareas sueltas. El listado se lee desde el
// response de /api/my-tasks (campo `standaloneTasks`), por eso acá solo
// hay mutaciones que invalidan esa query.
export function useStandaloneTasks() {
  const qc = useQueryClient();

  const invalidate = () => {
    qc.invalidateQueries({ queryKey: ["my-tasks"] });
    qc.invalidateQueries({ queryKey: ["dashboard-my-tasks"] });
    // Los pendientes colgados de un lead también se listan en el panel del lead.
    qc.invalidateQueries({ queryKey: ["lead-tasks"] });
  };

  const createMut = useMutation({
    mutationFn: (body: CreateStandaloneTaskBody) => createStandaloneTask(body),
    onSuccess: () => {
      toast.success("Tarea creada");
      invalidate();
    },
    onError: () => toast.error("No se pudo crear la tarea"),
  });

  const updateMut = useMutation({
    mutationFn: ({ id, body }: { id: string; body: UpdateStandaloneTaskBody }) =>
      updateStandaloneTask(id, body),
    onSuccess: () => {
      invalidate();
    },
    onError: () => toast.error("No se pudo actualizar la tarea"),
  });

  const completeMut = useMutation({
    mutationFn: (id: string) => updateStandaloneTask(id, { status: "COMPLETED" }),
    onSuccess: () => {
      invalidate();
    },
    onError: () => toast.error("No se pudo completar la tarea"),
  });

  const deleteMut = useMutation({
    mutationFn: (id: string) => deleteStandaloneTask(id),
    onSuccess: () => {
      toast.success("Tarea eliminada");
      invalidate();
    },
    onError: () => toast.error("No se pudo eliminar la tarea"),
  });

  return {
    createTask: createMut,
    updateTask: updateMut,
    completeTask: completeMut,
    deleteTask: deleteMut,
  };
}

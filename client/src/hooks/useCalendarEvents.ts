import { useMemo } from "react";
import type {
  MyTaskBlock,
  MyTaskItem,
  MyTasksResponse,
  StandaloneTaskItem,
} from "../api/myTasks.api";

export type CalendarEventType = "substage" | "task" | "standalone";

export interface CalendarEvent {
  id: string;          // id único para react keys (puede prefijarse para evitar colisiones)
  title: string;
  date: Date;          // dueDate parseada
  type: CalendarEventType;
  status: string;
  projectName?: string;
  // ID del item original (substageId, taskId o standalone task id) para
  // abrir el modal/navegación correspondiente.
  originalId: string;
  // Color semántico — el componente que renderiza lo traduce a clases.
  color: "blue" | "purple" | "amber";
  // Contexto extra que necesitan los handlers de click.
  projectId?: string;
  stageId?: string | null;
  substageId?: string | null;
}

// Convierte un string ISO YYYY-MM-DD a Date local a las 00:00. Devuelve
// null si la fecha no se puede parsear o si viene null/undefined.
function parseDate(iso: string | null | undefined): Date | null {
  if (!iso) return null;
  const d = new Date(`${iso}T00:00:00`);
  if (isNaN(d.getTime())) return null;
  return d;
}

function fromSubstage(block: MyTaskBlock): CalendarEvent[] {
  const out: CalendarEvent[] = [];
  for (const sub of block.substages) {
    if (sub.status === "COMPLETED") continue;
    const date = parseDate(sub.dueDate);
    if (!date) continue;
    out.push({
      id: `substage:${sub.id}`,
      originalId: sub.id,
      title: sub.name,
      date,
      type: "substage",
      status: sub.status,
      projectName: block.projectName,
      projectId: block.projectId,
      stageId: block.stageId,
      substageId: sub.id,
      color: "blue",
    });
  }
  return out;
}

function fromTask(task: MyTaskItem): CalendarEvent | null {
  if (task.status === "COMPLETED") return null;
  const date = parseDate(task.dueDate);
  if (!date) return null;
  return {
    id: `task:${task.id}`,
    originalId: task.id,
    title: task.title,
    date,
    type: "task",
    status: task.status,
    projectName: task.projectName,
    projectId: task.projectId,
    stageId: task.stageId,
    substageId: task.substageId,
    color: "purple",
  };
}

function fromStandalone(task: StandaloneTaskItem): CalendarEvent | null {
  if (task.status === "COMPLETED") return null;
  const date = parseDate(task.dueDate);
  if (!date) return null;
  return {
    id: `standalone:${task.id}`,
    originalId: task.id,
    title: task.title,
    date,
    type: "standalone",
    status: task.status,
    color: "amber",
  };
}

// Transforma el response de /api/my-tasks en eventos del calendario.
// Excluye items sin fecha y items COMPLETED. Si data es undefined o
// null devuelve array vacío.
export function useCalendarEvents(data: MyTasksResponse | undefined | null): CalendarEvent[] {
  return useMemo(() => {
    if (!data) return [];
    const events: CalendarEvent[] = [];
    for (const block of data.blocks ?? []) {
      events.push(...fromSubstage(block));
    }
    for (const task of data.tasks ?? []) {
      const e = fromTask(task);
      if (e) events.push(e);
    }
    for (const task of data.standaloneTasks ?? []) {
      const e = fromStandalone(task);
      if (e) events.push(e);
    }
    return events;
  }, [data]);
}

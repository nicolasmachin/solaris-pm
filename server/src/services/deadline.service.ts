import { DeadlineRuleTipo, type DeadlineRule, type Substage, type StageType } from "@prisma/client";
import { prisma } from "../lib/prisma.js";

export interface RecalculateResult {
  total: number;
  updated: number;
  preserved: number;
  cleared: number;
}

// Resuelve la regla aplicable a una subetapa: prioridad sopCode > substageName
// > default de etapa (sopCode y substageName ambos null).
export async function findRuleForSubstage(
  stageType: StageType,
  sopCode: string | null,
  substageName: string,
): Promise<DeadlineRule | null> {
  if (sopCode) {
    const bySop = await prisma.deadlineRule.findFirst({
      where: { stageType, sopCode, activa: true },
    });
    if (bySop) return bySop;
  }
  const byName = await prisma.deadlineRule.findFirst({
    where: { stageType, sopCode: null, substageName, activa: true },
  });
  if (byName) return byName;
  return prisma.deadlineRule.findFirst({
    where: { stageType, sopCode: null, substageName: null, activa: true },
  });
}

// Calcula el deadline para una subetapa según su regla. Devuelve null si:
// - No hay regla activa
// - La regla es SIN_DEADLINE
// - La regla es DIAS_ANTES_INSTALACION pero el proyecto no tiene cronograma
//
// Para tipo MANUAL: respeta substage.deadline (lo que ya está guardado).
export async function calculateSubstageDeadline(
  substage: Pick<Substage, "id" | "stageId" | "projectId" | "name" | "sopCode" | "deadline">,
  project: { id: string; createdAt: Date },
): Promise<Date | null> {
  const stage = await prisma.stage.findUnique({
    where: { id: substage.stageId },
    select: { name: true },
  });
  if (!stage) return null;

  const rule = await findRuleForSubstage(stage.name, substage.sopCode ?? null, substage.name);
  if (!rule || !rule.activa) return null;

  switch (rule.tipo) {
    case DeadlineRuleTipo.SIN_DEADLINE:
      return null;

    case DeadlineRuleTipo.MANUAL:
      return substage.deadline ?? null;

    case DeadlineRuleTipo.DIAS_DESDE_CREACION: {
      if (!rule.dias) return null;
      const d = new Date(project.createdAt);
      d.setUTCDate(d.getUTCDate() + rule.dias);
      d.setUTCHours(0, 0, 0, 0);
      return d;
    }

    case DeadlineRuleTipo.DIAS_ANTES_INSTALACION: {
      if (!rule.dias) return null;
      const schedule = await prisma.installationSchedule.findFirst({
        where: { projectId: project.id, deletedAt: null },
        include: { segments: { orderBy: { startDate: "asc" }, take: 1 } },
      });
      if (!schedule || schedule.segments.length === 0) return null;
      const earliestStart = schedule.segments[0].startDate;
      const d = new Date(earliestStart);
      d.setUTCDate(d.getUTCDate() - rule.dias);
      d.setUTCHours(0, 0, 0, 0);
      return d;
    }

    default:
      return null;
  }
}

// Cuenta cuántas subetapas del proyecto tienen deadline editado manualmente.
// Usado para detectar conflictos antes de un recálculo masivo.
export async function countProjectManualOverrides(projectId: string): Promise<number> {
  return prisma.substage.count({
    where: {
      projectId,
      deletedAt: null,
      isActive: true,
      deadlineManuallySet: true,
    },
  });
}

// Aplica las reglas de deadline a TODAS las subetapas del proyecto.
// Si forceOverrides=false → respeta las subetapas con deadlineManuallySet=true.
// Si forceOverrides=true → recalcula también las que tienen override manual.
export async function recalculateProjectDeadlines(
  projectId: string,
  forceOverrides: boolean = false,
): Promise<RecalculateResult> {
  const project = await prisma.project.findUnique({
    where: { id: projectId },
    select: { id: true, createdAt: true },
  });
  if (!project) return { total: 0, updated: 0, preserved: 0, cleared: 0 };

  const stages = await prisma.stage.findMany({
    where: { projectId, deletedAt: null },
    select: {
      id: true,
      name: true,
      substages: {
        where: { deletedAt: null, isActive: true },
        select: {
          id: true,
          stageId: true,
          projectId: true,
          name: true,
          sopCode: true,
          deadline: true,
          deadlineManuallySet: true,
        },
      },
    },
  });

  let updated = 0;
  let preserved = 0;
  let cleared = 0;
  let total = 0;

  for (const stage of stages) {
    for (const substage of stage.substages) {
      total++;
      if (substage.deadlineManuallySet && !forceOverrides) {
        preserved++;
        continue;
      }
      const newDeadline = await calculateSubstageDeadline(substage, project);
      const previousDeadline = substage.deadline;
      const sameDate =
        (newDeadline?.toISOString().slice(0, 10) ?? null) ===
        (previousDeadline?.toISOString().slice(0, 10) ?? null);

      if (sameDate && !substage.deadlineManuallySet) continue;

      await prisma.substage.update({
        where: { id: substage.id },
        data: { deadline: newDeadline, deadlineManuallySet: false },
      });
      if (newDeadline) updated++;
      else cleared++;
    }
  }

  return { total, updated, preserved, cleared };
}

// Llamado al crear un proyecto: pobla el deadline inicial de todas sus subetapas
// segun las reglas activas. No respeta overrides porque no los hay todavía.
export async function applyDeadlineRulesToProject(projectId: string): Promise<RecalculateResult> {
  return recalculateProjectDeadlines(projectId, true);
}

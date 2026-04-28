import { DeadlineRuleTipo, type DeadlineRule, type Substage, type StageType } from "@prisma/client";
import { prisma } from "../lib/prisma.js";

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

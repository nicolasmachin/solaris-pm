import {
  ModalidadPago,
  PhaseType,
  Prisma,
  ProjectStatus,
  StageStatus,
  StageType,
  SubstageStatus,
  TaskStatus,
  TipoObra,
} from "@prisma/client";

import { prisma } from "../lib/prisma.js";
import {
  PARALLEL_STAGE_TYPES,
  PIPELINE_DEFINITIONS,
  getActivePipelineTemplate,
  getStageLabel,
  isParallelStage,
} from "./pipeline-definitions.js";
import { STAGE_TO_TRASPASO, STAGE_TO_TRASPASO_EXTRA } from "./traspasos/catalogo.js";
import { crearTraspasoSiNoExiste } from "./traspasos/traspasos.service.js";
import { fireStageSurveys } from "./encuestas/encuestas.service.js";
import { addDays, diffInDays, startOfUtcDay, todayUtc } from "../utils/dates.js";
import { decimalToNumber, serializeDate, serializeDateOnly } from "../utils/serialization.js";

// Una subetapa cuenta como "resuelta" (a efectos del cierre de la etapa y del
// disparo del traspaso) si está COMPLETED o NO_APLICA. NO_APLICA es el escape
// para sub-tareas condicionales que no corresponden en este proyecto.
function isSubstageResolved(status: SubstageStatus) {
  return status === SubstageStatus.COMPLETED || status === SubstageStatus.NO_APLICA;
}

function substageStatusWeight(status: SubstageStatus) {
  switch (status) {
    case SubstageStatus.COMPLETED:
    case SubstageStatus.NO_APLICA:
      return 100;
    case SubstageStatus.IN_PROGRESS:
      return 45;
    case SubstageStatus.BLOCKED:
      return 15;
    default:
      return 0;
  }
}

export function isChecklistItemApplicable(
  item: { appliesWhenModalidadPago?: ModalidadPago | null },
  modalidadPago?: ModalidadPago | null,
) {
  if (!item.appliesWhenModalidadPago) {
    return true;
  }

  return item.appliesWhenModalidadPago === modalidadPago;
}

export function calculateSubstageProgress(params: {
  status: SubstageStatus;
  checklistItems?: Array<{
    completed: boolean;
    appliesWhenModalidadPago?: ModalidadPago | null;
  }>;
  modalidadPago?: ModalidadPago | null;
}) {
  // NO_APLICA es "resuelta" sin importar el checklist (la sub-tarea no corresponde).
  if (params.status === SubstageStatus.NO_APLICA) {
    return 100;
  }

  const applicableItems =
    params.checklistItems?.filter((item) => isChecklistItemApplicable(item, params.modalidadPago)) ?? [];

  if (applicableItems.length === 0) {
    return substageStatusWeight(params.status);
  }

  const completedCount = applicableItems.filter((item) => item.completed).length;
  return Math.round((completedCount / applicableItems.length) * 100);
}

export function calculateStageProgress(
  substages: Array<{
    status: SubstageStatus;
    progressPercent?: number;
    isActive?: boolean;
    deletedAt?: Date | null;
    checklistItems?: Array<{
      completed: boolean;
      appliesWhenModalidadPago?: ModalidadPago | null;
    }>;
  }>,
  modalidadPago?: ModalidadPago | null,
) {
  if (!substages || substages.length === 0) {
    return 0;
  }

  const activeSubstages = substages.filter(
    (substage) => !substage.deletedAt && (substage.isActive !== false)
  );
  if (activeSubstages.length === 0) {
    return 0;
  }

  const completedSubstages = activeSubstages.filter(
    (substage) => isSubstageResolved(substage.status)
  ).length;
  const progressPercent = Math.round(
    (completedSubstages / activeSubstages.length) * 100
  );

  return progressPercent;
}

export async function syncStageProgress(stageId: string, opts?: { actorUserId?: string }) {
  const stage = await prisma.stage.findUnique({
    where: { id: stageId },
    include: {
      project: {
        select: {
          modalidadPago: true,
        },
      },
      substages: {
        where: { deletedAt: null, isActive: true },
        include: {
          checklistItems: true,
        },
      },
    },
  });

  if (!stage) {
    return null;
  }

  const progressPercent = calculateStageProgress(stage.substages, stage.project.modalidadPago);

  const updateData: Record<string, unknown> = { progressPercent };
  const now = todayUtc();
  const subs = stage.substages;
  const hasAny = subs.length > 0;
  // Una etapa se completa cuando TODAS sus sub-tareas activas están "resueltas"
  // (COMPLETED o NO_APLICA). No hay flag de obligatoriedad por subetapa: toda
  // subetapa activa es obligatoria y NO_APLICA es el escape para las condicionales.
  const allResolved = hasAny && subs.every((s) => isSubstageResolved(s.status));
  const anyResolved = hasAny && subs.some((s) => isSubstageResolved(s.status));

  // ¿Esta llamada transiciona la etapa a COMPLETED? (para disparar el traspaso).
  let justCompleted = false;

  if (allResolved) {
    // Todas resueltas → COMPLETED
    if (stage.status !== StageStatus.COMPLETED) {
      updateData.status = StageStatus.COMPLETED;
      if (!stage.actualStartDate) updateData.actualStartDate = now;
      if (!stage.actualEndDate) updateData.actualEndDate = now;
      justCompleted = true;
    }
  } else if (anyResolved) {
    // Al menos una resuelta → IN_PROGRESS
    if (stage.status === StageStatus.PENDING || stage.status === StageStatus.COMPLETED) {
      updateData.status = StageStatus.IN_PROGRESS;
      if (!stage.actualStartDate) updateData.actualStartDate = now;
      updateData.actualEndDate = null;
    }
  } else {
    // Ninguna resuelta → volver a PENDING
    if (stage.status === StageStatus.IN_PROGRESS || stage.status === StageStatus.COMPLETED) {
      updateData.status = StageStatus.PENDING;
      updateData.actualEndDate = null;
    }
  }

  const updatedStage = await prisma.stage.update({
    where: { id: stageId },
    data: updateData,
  });

  // Verificar si todas las etapas del proyecto quedaron completas, sin importar si
  // esta llamada transicionó la etapa. Cubre el caso donde la última etapa ya estaba
  // COMPLETED pero el proyecto no se marcó por un flow previo que falló.
  const finalStatus = (updateData.status as StageStatus | undefined) ?? stage.status;
  if (finalStatus === StageStatus.COMPLETED) {
    await completeProjectIfAllStagesDone(stage.projectId, now);
  }

  // Traspaso entre áreas: se dispara cuando la etapa se COMPLETA por sus sub-tareas
  // (todas resueltas), no por marcado manual. Requiere un actor (quien resolvió la
  // última sub-tarea) porque es quien queda como responsable de la confirmación.
  // Idempotente por (proyecto, tipo) y best-effort (nunca interrumpe el sync).
  if (justCompleted) {
    if (opts?.actorUserId) {
      await fireStageTraspasos(updatedStage.name, stage.projectId, opts.actorUserId);
    }
    // Encuestas de satisfacción por hito (obra / habilitación). No requieren
    // actor (las genera el sistema). Idempotente y best-effort.
    await fireStageSurveys(updatedStage.name, stage.projectId);
  }

  return updatedStage;
}

// Dispara el/los traspaso(s) de cierre de una etapa (principal + extra, ej.
// VALIDACION_OPERACIONES dispara T3 y además T4). Idempotente y best-effort.
async function fireStageTraspasos(stageName: StageType, projectId: string, actorUserId: string) {
  const tipos = [STAGE_TO_TRASPASO[stageName], STAGE_TO_TRASPASO_EXTRA[stageName]].filter(
    (t): t is NonNullable<typeof t> => Boolean(t),
  );
  for (const tipo of tipos) {
    await crearTraspasoSiNoExiste({ tipo, projectId, actorUserId });
  }
}

/**
 * Marca el proyecto como COMPLETED si TODAS sus etapas están COMPLETED y todavía
 * no quedó cerrado. `completedAt` se usa como actualEndDate sólo si el proyecto
 * no tenía ya una fecha previa. Idempotente: si ya está COMPLETED con fecha, no
 * hace nada.
 *
 * Extraído de syncStageProgress para reusarlo desde el avance automático de
 * POSTVENTA al finalizar el trámite UTE (ute-sync.service), evitando duplicar la
 * regla de cierre del proyecto.
 */
export async function completeProjectIfAllStagesDone(projectId: string, completedAt: Date) {
  const allProjectStages = await prisma.stage.findMany({
    where: { projectId, name: { notIn: PARALLEL_STAGE_TYPES } },
    select: { status: true },
  });
  const allStagesDone =
    allProjectStages.length > 0 && allProjectStages.every((s) => s.status === StageStatus.COMPLETED);
  if (!allStagesDone) return;

  const project = await prisma.project.findUnique({
    where: { id: projectId },
    select: { status: true, actualEndDate: true },
  });
  if (project && (project.status !== ProjectStatus.COMPLETED || !project.actualEndDate)) {
    await prisma.project.update({
      where: { id: projectId },
      data: {
        status: ProjectStatus.COMPLETED,
        actualEndDate: project.actualEndDate ?? completedAt,
      },
    });
  }
}

export async function syncSubstageProgress(substageId: string) {
  const substage = await prisma.substage.findUnique({
    where: { id: substageId },
    include: {
      project: {
        select: {
          modalidadPago: true,
        },
      },
      checklistItems: true,
    },
  });

  if (!substage) {
    return null;
  }

  const progressPercent = calculateSubstageProgress({
    status: substage.status,
    checklistItems: substage.checklistItems,
    modalidadPago: substage.project.modalidadPago,
  });

  return prisma.substage.update({
    where: { id: substageId },
    data: { progressPercent },
  });
}

export async function calculateProjectProgress(projectId: string) {
  const stages = await prisma.stage.findMany({
    where: { projectId, name: { notIn: PARALLEL_STAGE_TYPES } },
    orderBy: { order: "asc" },
  });

  if (stages.length === 0) {
    return 0;
  }

  const total = stages.reduce((sum, stage) => sum + stage.progressPercent, 0);
  return Math.round(total / stages.length);
}

export async function sumProjectDelayDays(projectId: string) {
  const result = await prisma.stage.aggregate({
    where: {
      projectId,
      status: StageStatus.COMPLETED,
    },
    _sum: {
      delayDays: true,
    },
  });

  return result._sum.delayDays ?? 0;
}

export function getCurrentStage<T extends { status: StageStatus; order: number; name: string }>(stages: T[]) {
  // Las etapas paralelas de Experiencia Solar no cuentan como "etapa en curso".
  const linear = stages.filter((stage) => !isParallelStage(stage.name));
  return (
    linear.find((stage) => stage.status === StageStatus.IN_PROGRESS) ??
    [...linear]
      .filter((stage) => stage.status === StageStatus.COMPLETED)
      .sort((a, b) => b.order - a.order)[0] ??
    [...linear].sort((a, b) => a.order - b.order)[0] ??
    null
  );
}

// Etapa MOSTRADA del proyecto, aplicando el override manual con la regla
// "empujón hacia adelante": es la más avanzada entre la etapa derivada de las
// sub-tareas y la fijada a mano (`stageOverride`). Nunca muestra una etapa
// anterior a la real; si el trabajo real ya pasó el override, gana lo real.
export function getDisplayStage<T extends { status: StageStatus; order: number; name: string }>(
  stages: T[],
  stageOverride: string | null | undefined,
) {
  const derived = getCurrentStage(stages);
  if (!stageOverride) return derived;
  const overrideStage = stages.find((s) => s.name === stageOverride && !isParallelStage(s.name));
  if (!overrideStage) return derived;
  if (!derived) return overrideStage;
  return overrideStage.order > derived.order ? overrideStage : derived;
}

export async function generateProjectCode() {
  const year = new Date().getUTCFullYear();
  const prefix = `PRY-${year}-`;

  const projects = await prisma.project.findMany({
    where: {
      code: {
        startsWith: prefix,
      },
    },
    select: {
      code: true,
    },
  });

  const maxSequence = projects.reduce((max, project) => {
    const parsed = Number(project.code.split("-")[2]);
    return Number.isFinite(parsed) ? Math.max(max, parsed) : max;
  }, 0);

  const nextSequence = String(maxSequence + 1).padStart(3, "0");
  return `${prefix}${nextSequence}`;
}

export function buildInitialStages(
  startDate: Date,
  plannedEndDate: Date,
  modalidadPago?: ModalidadPago | null,
  template?: typeof PIPELINE_DEFINITIONS,
) {
  const activeTemplate = template ?? PIPELINE_DEFINITIONS;
  const totalDays = Math.max(1, diffInDays(startDate, plannedEndDate) + 1);
  // POST_HABILITACION (ex POSTVENTA) es indefinida: no tiene fechas y no consume
  // tiempo del cronograma. Los días totales se distribuyen sólo entre las etapas
  // "datadas", usando los weights relativos entre ellas.
  const datedDefs = activeTemplate.filter(
    (s) => s.name !== StageType.POST_HABILITACION && s.name !== StageType.POSTVENTA && !isParallelStage(s.name),
  );
  const totalWeight = datedDefs.reduce((sum, s) => sum + s.weight, 0);

  let cursor = startOfUtcDay(startDate);
  let consumedDays = 0;
  let datedIndex = -1;

  return activeTemplate.map((stageConfig) => {
    const substages = stageConfig.substages.map((substage) => ({
      order: substage.order,
      name: substage.name,
      sopCode: substage.sopCode ?? null,
      responsableRol: substage.responsableRol ?? null,
      responsible: substage.responsible,
      status: SubstageStatus.PENDING,
      progressPercent: 0,
      isSystem: substage.isSystem ?? true,
      isActive: substage.isActive ?? true,
      checklistItems: (substage.checklist ?? []).map((item, checklistIndex) => ({
        order: checklistIndex + 1,
        label: item.label,
        isRequired: item.isRequired ?? false,
        isBlocker: item.isBlocker ?? false,
        appliesWhenModalidadPago: item.appliesWhenModalidadPago ?? null,
      })),
    }));

    if (
      stageConfig.name === StageType.POST_HABILITACION ||
      stageConfig.name === StageType.POSTVENTA ||
      isParallelStage(stageConfig.name)
    ) {
      return {
        order: stageConfig.order,
        name: stageConfig.name,
        status: StageStatus.PENDING,
        progressPercent: 0,
        tipoObra: null,
        plannedStartDate: null as Date | null,
        plannedEndDate: null as Date | null,
        plannedDurationDays: null as number | null,
        substages,
      };
    }

    datedIndex++;
    const isLastDated = datedIndex === datedDefs.length - 1;
    const stageDays = isLastDated
      ? Math.max(1, totalDays - consumedDays)
      : Math.max(1, Math.round((totalDays * stageConfig.weight) / totalWeight));
    const plannedStartDate = cursor;
    const plannedEndDateForStage = addDays(plannedStartDate, Math.max(stageDays - 1, 0));
    cursor = addDays(plannedEndDateForStage, 1);
    consumedDays += stageDays;

    return {
      order: stageConfig.order,
      name: stageConfig.name,
      // El proyecto arranca activo en Onboarding: esa etapa nace IN_PROGRESS
      // para que getCurrentStage la marque como etapa actual desde la creación.
      // El resto de las etapas datadas quedan PENDING.
      status: stageConfig.name === StageType.ONBOARDING ? StageStatus.IN_PROGRESS : StageStatus.PENDING,
      progressPercent: 0,
      tipoObra: null,
      plannedStartDate: plannedStartDate as Date | null,
      plannedEndDate: plannedEndDateForStage as Date | null,
      plannedDurationDays: stageDays as number | null,
      substages,
    };
  });
}

export async function createInitialPipeline(
  projectId: string,
  startDate: Date,
  plannedEndDate: Date,
  modalidadPago?: ModalidadPago | null,
) {
  // Usar template activo (del setting si existe, si no fallback al const)
  const template = await getActivePipelineTemplate();
  const stageBlueprints = buildInitialStages(startDate, plannedEndDate, modalidadPago, template);

  for (const stage of stageBlueprints) {
    const createdStage = await prisma.stage.create({
      data: {
        projectId,
        order: stage.order,
        name: stage.name,
        status: stage.status,
        progressPercent: stage.progressPercent,
        tipoObra: stage.tipoObra,
        plannedStartDate: stage.plannedStartDate,
        plannedEndDate: stage.plannedEndDate,
        plannedDurationDays: stage.plannedDurationDays,
      },
    });

    for (const substage of stage.substages) {
      const createdSubstage = await prisma.substage.create({
        data: {
          projectId,
          stageId: createdStage.id,
          order: substage.order,
          name: substage.name,
          sopCode: substage.sopCode,
          responsableRol: substage.responsableRol,
          status: substage.status,
          progressPercent: substage.progressPercent,
          responsible: substage.responsible,
          isSystem: substage.isSystem,
          isActive: substage.isActive,
        },
      });

      if (substage.checklistItems.length > 0) {
        await prisma.checklistItem.createMany({
          data: substage.checklistItems.map((item) => ({
            substageId: createdSubstage.id,
            projectId,
            order: item.order,
            label: item.label,
            isRequired: item.isRequired,
            isBlocker: item.isBlocker,
            appliesWhenModalidadPago: item.appliesWhenModalidadPago,
          })),
        });
      }
    }
  }
}

export function calculateProjectMetrics(project: {
  startDate: Date;
  plannedEndDate: Date | null;
  budgetUsd: Prisma.Decimal | null;
  executedUsd: Prisma.Decimal;
  stages: Array<{
    progressPercent: number;
    status: StageStatus;
  }>;
}) {
  const today = todayUtc();
  const daysElapsed = Math.max(0, diffInDays(project.startDate, today));
  const progressPercent =
    project.stages.length > 0
      ? Math.round(project.stages.reduce((sum, stage) => sum + stage.progressPercent, 0) / project.stages.length)
      : 0;
  const budgetNumber = decimalToNumber(project.budgetUsd);
  const executedNumber = decimalToNumber(project.executedUsd) ?? 0;
  const budgetUsedPercent =
    budgetNumber && budgetNumber > 0
      ? Number(((executedNumber / budgetNumber) * 100).toFixed(2))
      : null;

  return {
    progressPercent,
    daysElapsed,
    budgetUsedPercent,
  };
}

export function serializeProject(project: {
  id: string;
  code: string;
  clientName: string;
  capacityKwp: Prisma.Decimal;
  pesoObra: number;
  locationCity: string;
  locationProvince: string;
  status: ProjectStatus;
  startDate: Date;
  saleDate?: Date | null;
  plannedEndDate: Date | null;
  actualEndDate: Date | null;
  budgetUsd: Prisma.Decimal | null;
  executedUsd: Prisma.Decimal;
  estimatedMwhYear: Prisma.Decimal | null;
  co2TonsAvoided: Prisma.Decimal | null;
  modalidadPago: ModalidadPago | null;
  clientEmail: string | null;
  clientPhone: string | null;
  clientAddress: string | null;
  uteCodigoPS?: string | null;
  uteCodigoAS?: string | null;
  nombreCliente?: string;
  ciCliente?: string;
  calle?: string;
  numCalle?: string;
  personaFisica?: boolean;
  empresa?: boolean;
  cedulaPath?: string | null;
  facturaUtePath?: string | null;
  salespersonId: string | null;
  salesperson?: { id: string; name: string } | null;
  firstDateScheduledAt?: Date | null;
  actualOnboardingEnd?: Date | null;
  actualEngineeringEnd?: Date | null;
  actualUteStart?: Date | null;
  actualUteEnd?: Date | null;
  createdById: string;
  createdAt: Date;
  updatedAt: Date;
  deletedAt: Date | null;
  stages?: Array<{
    name: StageType;
    plannedStartDate: Date | null;
    plannedEndDate: Date | null;
    actualStartDate: Date | null;
    actualEndDate: Date | null;
  }>;
}) {
  const { stages, ...rest } = project;
  // La "fecha fin del proyecto" a mostrar en la UI deriva de Habilitación UTE,
  // NO de Postventa (que es indefinida) ni del campo Project.plannedEndDate
  // cuando éste pudo haber quedado desincronizado.
  const uteStage = stages?.find(
    (s) => s.name === StageType.HABILITACION_UTE || s.name === StageType.TRAMITACION_UTE,
  );
  const displayedPlannedEnd = uteStage?.plannedEndDate ?? rest.plannedEndDate;
  const displayedActualEnd =
    uteStage?.actualEndDate ?? rest.actualUteEnd ?? rest.actualEndDate;
  return {
    ...rest,
    capacityKwp: decimalToNumber(rest.capacityKwp),
    budgetUsd: decimalToNumber(rest.budgetUsd),
    executedUsd: decimalToNumber(rest.executedUsd),
    estimatedMwhYear: decimalToNumber(rest.estimatedMwhYear),
    co2TonsAvoided: decimalToNumber(rest.co2TonsAvoided),
    startDate: serializeDateOnly(rest.startDate),
    saleDate: rest.saleDate ? serializeDateOnly(rest.saleDate) : null,
    plannedEndDate: serializeDateOnly(displayedPlannedEnd),
    actualEndDate: serializeDateOnly(displayedActualEnd),
    actualOnboardingEnd: rest.actualOnboardingEnd ? serializeDateOnly(rest.actualOnboardingEnd) : null,
    actualEngineeringEnd: rest.actualEngineeringEnd ? serializeDateOnly(rest.actualEngineeringEnd) : null,
    actualUteStart: rest.actualUteStart ? serializeDateOnly(rest.actualUteStart) : null,
    actualUteEnd: rest.actualUteEnd ? serializeDateOnly(rest.actualUteEnd) : null,
    firstDateScheduledAt: rest.firstDateScheduledAt ? serializeDate(rest.firstDateScheduledAt) : null,
    createdAt: serializeDate(rest.createdAt),
    updatedAt: serializeDate(rest.updatedAt),
    deletedAt: serializeDate(rest.deletedAt),
    salesperson: rest.salesperson || null,
    uteCodigoPS: rest.uteCodigoPS ?? null,
    uteCodigoAS: rest.uteCodigoAS ?? null,
  };
}

export function serializeSolarSystem(system: {
  id: string;
  projectId: string;
  order: number;
  description: string | null;
  inverterBrand: string | null;
  inverterPowerKw: Prisma.Decimal | null;
  inverterQuantity: number | null;
  inverterPhaseType: PhaseType | null;
  inverterModel: string | null;
  panelQuantity: number | null;
  panelPowerW: number | null;
  panelBrand: string | null;
  panelModel: string | null;
  deletedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}) {
  return {
    ...system,
    inverterPowerKw: decimalToNumber(system.inverterPowerKw),
    createdAt: serializeDate(system.createdAt),
    updatedAt: serializeDate(system.updatedAt),
    deletedAt: serializeDate(system.deletedAt),
  };
}

type ResponsibleUserRef = {
  id: string;
  name: string;
  role: { name: string } | string | null;
};

function serializeResponsibleUser(user: ResponsibleUserRef | null | undefined) {
  if (!user) return null;
  const role = typeof user.role === "string" ? user.role : user.role?.name ?? null;
  return { id: user.id, name: user.name, role };
}

export function serializeStage(stage: {
  id: string;
  projectId: string;
  order: number;
  name: StageType;
  status: StageStatus;
  progressPercent: number;
  tipoObra: TipoObra | null;
  plannedStartDate: Date | null;
  plannedEndDate: Date | null;
  actualStartDate: Date | null;
  actualEndDate: Date | null;
  plannedDurationDays: number | null;
  actualDurationDays: number | null;
  delayDays: number | null;
  responsibleName: string | null;
  responsibleUserId?: string | null;
  responsibleUser?: ResponsibleUserRef | null;
  notes: string | null;
  createdAt: Date;
  updatedAt: Date;
}) {
  const { responsibleUser, ...rest } = stage;
  return {
    ...rest,
    label: getStageLabel(stage.name),
    responsibleUserId: stage.responsibleUserId ?? null,
    responsibleUser: serializeResponsibleUser(responsibleUser),
    plannedStartDate: serializeDateOnly(stage.plannedStartDate),
    plannedEndDate: serializeDateOnly(stage.plannedEndDate),
    actualStartDate: serializeDateOnly(stage.actualStartDate),
    actualEndDate: serializeDateOnly(stage.actualEndDate),
    createdAt: serializeDate(stage.createdAt),
    updatedAt: serializeDate(stage.updatedAt),
  };
}

export function serializeSubstage(substage: {
  id: string;
  stageId: string;
  projectId: string;
  order: number;
  name: string;
  sopCode: string | null;
  responsableRol: string | null;
  status: SubstageStatus;
  progressPercent: number;
  responsible: string;
  userId: string | null;
  user?: ResponsibleUserRef | null;
  dueDate: Date | null;
  plannedStartDate: Date | null;
  plannedEndDate: Date | null;
  actualStartDate: Date | null;
  actualEndDate: Date | null;
  actualDurationDays: number | null;
  delayDays: number | null;
  notes: string | null;
  isSystem: boolean;
  isActive: boolean;
  uteAction?: string | null;
  deadline?: Date | null;
  deadlineManuallySet?: boolean;
  deletedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}) {
  const { user, ...rest } = substage;
  return {
    ...rest,
    user: serializeResponsibleUser(user),
    dueDate: serializeDateOnly(substage.dueDate),
    plannedStartDate: serializeDateOnly(substage.plannedStartDate),
    plannedEndDate: serializeDateOnly(substage.plannedEndDate),
    actualStartDate: serializeDateOnly(substage.actualStartDate),
    actualEndDate: serializeDateOnly(substage.actualEndDate),
    deadline: serializeDateOnly(substage.deadline ?? null),
    deadlineManuallySet: substage.deadlineManuallySet ?? false,
    deletedAt: serializeDate(substage.deletedAt),
    createdAt: serializeDate(substage.createdAt),
    updatedAt: serializeDate(substage.updatedAt),
  };
}

export function serializeChecklistItem(item: {
  id: string;
  substageId: string;
  projectId: string;
  order: number;
  label: string;
  completed: boolean;
  completedAt: Date | null;
  completedBy: string | null;
  notes: string | null;
  isRequired: boolean;
  isBlocker: boolean;
  isCustom: boolean;
  appliesWhenModalidadPago: ModalidadPago | null;
  createdAt: Date;
  updatedAt: Date;
}) {
  return {
    ...item,
    completedAt: serializeDate(item.completedAt),
    createdAt: serializeDate(item.createdAt),
    updatedAt: serializeDate(item.updatedAt),
  };
}

// Include canónico para traer los asignados de una tarea listos para
// serializeTask. Usar en cada query cuyo resultado se pase a serializeTask.
export const taskAssigneesInclude = {
  assignees: {
    include: { user: { select: { id: true, name: true, email: true } } },
    orderBy: { createdAt: "asc" },
  },
} as const;

export function serializeTask(task: {
  id: string;
  projectId: string | null;
  stageId: string | null;
  substageId: string | null;
  title: string;
  description: string | null;
  status: TaskStatus;
  priority: string;
  responsible: string;
  userId: string | null;
  user?: ResponsibleUserRef | null;
  assignees?: Array<{ user: { id: string; name: string; email?: string } }> | null;
  dueDate: Date | null;
  completedAt: Date | null;
  deletedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}) {
  const { user, assignees, ...rest } = task;
  return {
    ...rest,
    user: serializeResponsibleUser(user),
    // `assignees` = fuente de verdad de la asignación (varios responsables).
    // Se serializa como array plano de usuarios. Si la query no incluyó la
    // relación (assignees === undefined), se omite el campo para no romper a
    // los consumidores que todavía leen `user`.
    ...(assignees !== undefined
      ? {
          assignees: (assignees ?? []).map((a) => ({
            id: a.user.id,
            name: a.user.name,
            email: a.user.email ?? null,
          })),
        }
      : {}),
    dueDate: serializeDateOnly(task.dueDate),
    completedAt: serializeDate(task.completedAt),
    deletedAt: serializeDate(task.deletedAt),
    createdAt: serializeDate(task.createdAt),
    updatedAt: serializeDate(task.updatedAt),
  };
}

export function serializeFile(file: {
  id: string;
  projectId: string | null;
  stageId: string | null;
  substageId: string | null;
  filename: string;
  storedFilename: string;
  mimeType: string;
  sizeBytes: number;
  url: string;
  uploadedById: string;
  deletedAt: Date | null;
  createdAt: Date;
}) {
  return {
    ...file,
    deletedAt: serializeDate(file.deletedAt),
    createdAt: serializeDate(file.createdAt),
  };
}

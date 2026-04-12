import {
  ModalidadPago,
  Prisma,
  ProjectStatus,
  StageStatus,
  StageType,
  SubstageStatus,
  TaskStatus,
  TipoObra,
} from "@prisma/client";

import { prisma } from "../lib/prisma.js";
import { PIPELINE_DEFINITIONS, getStageLabel } from "./pipeline-definitions.js";
import { addDays, diffInDays, startOfUtcDay, todayUtc } from "../utils/dates.js";
import { decimalToNumber, serializeDate, serializeDateOnly } from "../utils/serialization.js";

function substageStatusWeight(status: SubstageStatus) {
  switch (status) {
    case SubstageStatus.COMPLETED:
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
  const activeSubstages = substages.filter((substage) => !substage.deletedAt && substage.isActive !== false);
  if (activeSubstages.length === 0) {
    return 0;
  }

  const total = activeSubstages.reduce((sum, substage) => {
    const progress =
      substage.progressPercent ??
      calculateSubstageProgress({
        status: substage.status,
        checklistItems: substage.checklistItems,
        modalidadPago,
      });

    return sum + progress;
  }, 0);

  return Math.round(total / activeSubstages.length);
}

export async function syncStageProgress(stageId: string) {
  const stage = await prisma.stage.findUnique({
    where: { id: stageId },
    include: {
      project: {
        select: {
          modalidadPago: true,
        },
      },
      substages: {
        where: { deletedAt: null },
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

  return prisma.stage.update({
    where: { id: stageId },
    data: { progressPercent },
  });
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
    where: { projectId },
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

export function getCurrentStage<T extends { status: StageStatus; order: number }>(stages: T[]) {
  return (
    stages.find((stage) => stage.status === StageStatus.IN_PROGRESS) ??
    [...stages]
      .filter((stage) => stage.status === StageStatus.COMPLETED)
      .sort((a, b) => b.order - a.order)[0] ??
    [...stages].sort((a, b) => a.order - b.order)[0] ??
    null
  );
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

export function buildInitialStages(startDate: Date, plannedEndDate: Date, modalidadPago?: ModalidadPago | null) {
  const totalDays = Math.max(1, diffInDays(startDate, plannedEndDate) + 1);
  let cursor = startOfUtcDay(startDate);
  let consumedDays = 0;

  return PIPELINE_DEFINITIONS.map((stageConfig, index) => {
    const isLast = index === PIPELINE_DEFINITIONS.length - 1;
    const stageDays = isLast
      ? Math.max(1, totalDays - consumedDays)
      : Math.max(1, Math.round((totalDays * stageConfig.weight) / 100));
    const plannedStartDate = cursor;
    const plannedEndDateForStage = addDays(plannedStartDate, Math.max(stageDays - 1, 0));
    cursor = addDays(plannedEndDateForStage, 1);
    consumedDays += stageDays;

    return {
      order: stageConfig.order,
      name: stageConfig.name,
      status: StageStatus.PENDING,
      progressPercent: 0,
      tipoObra: null,
      plannedStartDate,
      plannedEndDate: plannedEndDateForStage,
      plannedDurationDays: stageDays,
      substages: stageConfig.substages.map((substage) => ({
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
        })),
    };
  });
}

export async function createInitialPipeline(
  projectId: string,
  startDate: Date,
  plannedEndDate: Date,
  modalidadPago?: ModalidadPago | null,
) {
  const stageBlueprints = buildInitialStages(startDate, plannedEndDate, modalidadPago);

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
  plannedEndDate: Date;
  budgetUsd: Prisma.Decimal;
  executedUsd: Prisma.Decimal;
  stages: Array<{
    progressPercent: number;
    plannedDurationDays: number | null;
    delayDays: number | null;
    status: StageStatus;
  }>;
}) {
  const today = todayUtc();
  const daysElapsed = Math.max(0, diffInDays(project.startDate, today));
  const daysRemaining = diffInDays(today, project.plannedEndDate);
  const progressPercent =
    project.stages.length > 0
      ? Math.round(project.stages.reduce((sum, stage) => sum + stage.progressPercent, 0) / project.stages.length)
      : 0;
  const totalPlannedDays = Math.max(
    1,
    project.stages.reduce((sum, stage) => sum + (stage.plannedDurationDays ?? 0), 0),
  );
  const delayDays = project.stages
    .filter((stage) => stage.status === StageStatus.COMPLETED)
    .reduce((sum, stage) => sum + (stage.delayDays ?? 0), 0);
  const expectedProgress = Math.max(0.01, daysElapsed / totalPlannedDays);
  const timeEfficiency = Number((((progressPercent / 100) / expectedProgress) * 100).toFixed(2));
  const budgetUsedPercent = Number(
    (
      (decimalToNumber(project.executedUsd) ?? 0) /
      Math.max(decimalToNumber(project.budgetUsd) ?? 1, 1) *
      100
    ).toFixed(2),
  );

  return {
    progressPercent,
    daysElapsed,
    daysRemaining,
    delayDays,
    timeEfficiency,
    budgetUsedPercent,
    totalPlannedDays,
  };
}

export function serializeProject(project: {
  id: string;
  code: string;
  clientName: string;
  capacityKwp: Prisma.Decimal;
  locationCity: string;
  locationProvince: string;
  status: ProjectStatus;
  startDate: Date;
  plannedEndDate: Date;
  actualEndDate: Date | null;
  budgetUsd: Prisma.Decimal;
  executedUsd: Prisma.Decimal;
  estimatedMwhYear: Prisma.Decimal;
  co2TonsAvoided: Prisma.Decimal;
  modalidadPago: ModalidadPago | null;
  notificationEmail: string;
  notificationPhone: string;
  createdById: string;
  createdAt: Date;
  updatedAt: Date;
  deletedAt: Date | null;
}) {
  return {
    ...project,
    capacityKwp: decimalToNumber(project.capacityKwp),
    budgetUsd: decimalToNumber(project.budgetUsd),
    executedUsd: decimalToNumber(project.executedUsd),
    estimatedMwhYear: decimalToNumber(project.estimatedMwhYear),
    co2TonsAvoided: decimalToNumber(project.co2TonsAvoided),
    startDate: serializeDateOnly(project.startDate),
    plannedEndDate: serializeDateOnly(project.plannedEndDate),
    actualEndDate: serializeDateOnly(project.actualEndDate),
    createdAt: serializeDate(project.createdAt),
    updatedAt: serializeDate(project.updatedAt),
    deletedAt: serializeDate(project.deletedAt),
  };
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
  notes: string | null;
  createdAt: Date;
  updatedAt: Date;
}) {
  return {
    ...stage,
    label: getStageLabel(stage.name),
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
  dueDate: Date | null;
  plannedStartDate: Date | null;
  plannedEndDate: Date | null;
  actualStartDate: Date | null;
  actualEndDate: Date | null;
  notes: string | null;
  isSystem: boolean;
  isActive: boolean;
  deletedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}) {
  return {
    ...substage,
    dueDate: serializeDateOnly(substage.dueDate),
    plannedStartDate: serializeDateOnly(substage.plannedStartDate),
    plannedEndDate: serializeDateOnly(substage.plannedEndDate),
    actualStartDate: serializeDateOnly(substage.actualStartDate),
    actualEndDate: serializeDateOnly(substage.actualEndDate),
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
  isRequired: boolean;
  isBlocker: boolean;
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

export function serializeTask(task: {
  id: string;
  projectId: string;
  stageId: string | null;
  substageId: string | null;
  title: string;
  description: string | null;
  status: TaskStatus;
  priority: string;
  responsible: string;
  userId: string | null;
  dueDate: Date | null;
  completedAt: Date | null;
  deletedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}) {
  return {
    ...task,
    dueDate: serializeDateOnly(task.dueDate),
    completedAt: serializeDate(task.completedAt),
    deletedAt: serializeDate(task.deletedAt),
    createdAt: serializeDate(task.createdAt),
    updatedAt: serializeDate(task.updatedAt),
  };
}

export function serializeFile(file: {
  id: string;
  projectId: string;
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

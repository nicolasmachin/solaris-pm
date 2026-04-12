import {
  Prisma,
  ProjectStatus,
  StageName,
  StageStatus,
  SubstageStatus,
  TaskStatus,
} from "@prisma/client";

import { prisma } from "../lib/prisma.js";
import { addDays, diffInDays, startOfUtcDay, todayUtc } from "../utils/dates.js";
import { decimalToNumber, serializeDate, serializeDateOnly } from "../utils/serialization.js";

const STAGE_WEIGHTS: Array<{ name: StageName; weight: number }> = [
  { name: StageName.PREVENTA, weight: 12 },
  { name: StageName.INGENIERIA, weight: 18 },
  { name: StageName.COMPRAS, weight: 15 },
  { name: StageName.INSTALACION, weight: 28 },
  { name: StageName.HABILITACION, weight: 17 },
  { name: StageName.POSTVENTA, weight: 10 },
];

function substageWeight(status: SubstageStatus) {
  switch (status) {
    case SubstageStatus.COMPLETED:
      return 100;
    case SubstageStatus.IN_PROGRESS:
      return 50;
    case SubstageStatus.BLOCKED:
      return 10;
    default:
      return 0;
  }
}

export function calculateStageProgress(substages: Array<{ status: SubstageStatus; deletedAt?: Date | null }>) {
  const activeSubstages = substages.filter((substage) => !substage.deletedAt);
  if (activeSubstages.length === 0) {
    return 0;
  }

  const total = activeSubstages.reduce((sum, substage) => sum + substageWeight(substage.status), 0);
  return Math.round(total / activeSubstages.length);
}

export async function syncStageProgress(stageId: string) {
  const stage = await prisma.stage.findUnique({
    where: { id: stageId },
    include: {
      substages: true,
    },
  });

  if (!stage) {
    return null;
  }

  const progressPercent = calculateStageProgress(stage.substages);

  return prisma.stage.update({
    where: { id: stageId },
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

export function buildInitialStages(startDate: Date, plannedEndDate: Date) {
  const totalDays = Math.max(1, diffInDays(startDate, plannedEndDate));
  let cursor = startOfUtcDay(startDate);
  let consumedDays = 0;

  return STAGE_WEIGHTS.map((stageConfig, index) => {
    const isLast = index === STAGE_WEIGHTS.length - 1;
    const stageDays = isLast
      ? Math.max(1, totalDays - consumedDays)
      : Math.max(1, Math.round((totalDays * stageConfig.weight) / 100));
    const plannedStartDate = cursor;
    const plannedEndDateForStage = addDays(plannedStartDate, Math.max(stageDays - 1, 0));
    cursor = addDays(plannedEndDateForStage, 1);
    consumedDays += stageDays;

    return {
      order: index + 1,
      name: stageConfig.name,
      status: StageStatus.PENDING,
      progressPercent: 0,
      plannedStartDate,
      plannedEndDate: plannedEndDateForStage,
      plannedDurationDays: stageDays,
    };
  });
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
  const timeEfficiency = Number(((progressPercent / 100) / expectedProgress * 100).toFixed(2));
  const budgetUsedPercent = Number(
    ((decimalToNumber(project.executedUsd) ?? 0) / Math.max(decimalToNumber(project.budgetUsd) ?? 1, 1) * 100).toFixed(2),
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
  name: StageName;
  status: StageStatus;
  progressPercent: number;
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
  status: SubstageStatus;
  responsible: string;
  userId: string | null;
  dueDate: Date | null;
  plannedStartDate: Date | null;
  plannedEndDate: Date | null;
  actualStartDate: Date | null;
  actualEndDate: Date | null;
  notes: string | null;
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

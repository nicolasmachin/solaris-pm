import fs from "node:fs";

import type { FastifyInstance } from "fastify";
import { AuditAction, AuditEntityType, NotificationType, Prisma, ProjectStatus, StageStatus, SubstageStatus, TaskPriority, TaskStatus } from "@prisma/client";
import { z } from "zod";

import { prisma } from "../lib/prisma.js";
import { authenticate } from "../middleware/auth.middleware.js";
import { createAuditEntriesForChanges, createAuditEntry } from "../services/audit.service.js";
import { deleteStoredFile, getStoredFilePath, saveUploadedFile } from "../services/file-storage.service.js";
import {
  buildInitialStages,
  calculateProjectMetrics,
  calculateProjectProgress,
  calculateStageProgress,
  generateProjectCode,
  getCurrentStage,
  serializeFile,
  serializeProject,
  serializeStage,
  serializeSubstage,
  serializeTask,
  sumProjectDelayDays,
  syncStageProgress,
} from "../services/project.service.js";
import { createNotificationIfNotExists } from "../services/notification.service.js";
import { diffInDays, parseDateOnly, todayUtc } from "../utils/dates.js";
import { badRequest, conflict, notFound } from "../utils/errors.js";
import { decimalToNumber, serializeDate } from "../utils/serialization.js";

const dateOnlySchema = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Debe tener formato YYYY-MM-DD");

const projectCreateSchema = z
  .object({
    clientName: z.string().min(1),
    capacityKwp: z.coerce.number().positive(),
    locationCity: z.string().min(1),
    locationProvince: z.string().min(1),
    plannedEndDate: dateOnlySchema,
    budgetUsd: z.coerce.number().positive(),
    estimatedMwhYear: z.coerce.number().positive(),
    notificationEmail: z.string().email(),
    notificationPhone: z.string().min(1),
    startDate: dateOnlySchema.optional(),
  })
  .strict();

const projectPatchSchema = z
  .object({
    clientName: z.string().min(1).optional(),
    capacityKwp: z.coerce.number().positive().optional(),
    locationCity: z.string().min(1).optional(),
    locationProvince: z.string().min(1).optional(),
    status: z.nativeEnum(ProjectStatus).optional(),
    startDate: dateOnlySchema.optional(),
    plannedEndDate: dateOnlySchema.optional(),
    actualEndDate: dateOnlySchema.nullable().optional(),
    budgetUsd: z.coerce.number().positive().optional(),
    executedUsd: z.coerce.number().nonnegative().optional(),
    estimatedMwhYear: z.coerce.number().positive().optional(),
    notificationEmail: z.string().email().optional(),
    notificationPhone: z.string().min(1).optional(),
  })
  .strict();

const stagePatchSchema = z
  .object({
    status: z.nativeEnum(StageStatus).optional(),
    notes: z.string().nullable().optional(),
    plannedStartDate: dateOnlySchema.nullable().optional(),
    plannedEndDate: dateOnlySchema.nullable().optional(),
  })
  .strict();

const substageCreateSchema = z
  .object({
    name: z.string().min(1),
    responsible: z.string().min(1),
    userId: z.string().nullable().optional(),
    dueDate: dateOnlySchema.nullable().optional(),
    plannedStartDate: dateOnlySchema.nullable().optional(),
    plannedEndDate: dateOnlySchema.nullable().optional(),
    notes: z.string().nullable().optional(),
  })
  .strict();

const substagePatchSchema = z
  .object({
    name: z.string().min(1).optional(),
    status: z.nativeEnum(SubstageStatus).optional(),
    responsible: z.string().min(1).optional(),
    userId: z.string().nullable().optional(),
    dueDate: dateOnlySchema.nullable().optional(),
    plannedStartDate: dateOnlySchema.nullable().optional(),
    plannedEndDate: dateOnlySchema.nullable().optional(),
    notes: z.string().nullable().optional(),
  })
  .strict();

const reorderSubstagesSchema = z
  .object({
    items: z.array(
      z
        .object({
          id: z.string().min(1),
          order: z.number().int().positive(),
        })
        .strict(),
    ),
  })
  .strict();

const taskCreateSchema = z
  .object({
    title: z.string().min(1),
    description: z.string().nullable().optional(),
    status: z.nativeEnum(TaskStatus).default(TaskStatus.PENDING),
    priority: z.nativeEnum(TaskPriority).default(TaskPriority.NORMAL),
    responsible: z.string().min(1),
    userId: z.string().nullable().optional(),
    stageId: z.string().nullable().optional(),
    substageId: z.string().nullable().optional(),
    dueDate: dateOnlySchema.nullable().optional(),
  })
  .strict();

const taskPatchSchema = z
  .object({
    title: z.string().min(1).optional(),
    description: z.string().nullable().optional(),
    status: z.nativeEnum(TaskStatus).optional(),
    priority: z.nativeEnum(TaskPriority).optional(),
    responsible: z.string().min(1).optional(),
    userId: z.string().nullable().optional(),
    stageId: z.string().nullable().optional(),
    substageId: z.string().nullable().optional(),
    dueDate: dateOnlySchema.nullable().optional(),
  })
  .strict();

function ensureUser(request: import("fastify").FastifyRequest) {
  if (!request.user) {
    throw badRequest("AUTH_CONTEXT_MISSING", "No se pudo resolver el usuario autenticado");
  }

  return request.user;
}

async function findProjectOrThrow(projectId: string) {
  const project = await prisma.project.findFirst({
    where: {
      id: projectId,
      deletedAt: null,
    },
  });

  if (!project) {
    throw notFound("PROJECT_NOT_FOUND", "Proyecto no encontrado");
  }

  return project;
}

async function findStageOrThrow(projectId: string, stageId: string) {
  const stage = await prisma.stage.findFirst({
    where: {
      id: stageId,
      projectId,
    },
    include: {
      substages: {
        where: { deletedAt: null },
        orderBy: { order: "asc" },
      },
    },
  });

  if (!stage) {
    throw notFound("STAGE_NOT_FOUND", "Etapa no encontrada");
  }

  return stage;
}

async function findSubstageOrThrow(projectId: string, stageId: string, substageId: string) {
  const substage = await prisma.substage.findFirst({
    where: {
      id: substageId,
      projectId,
      stageId,
      deletedAt: null,
    },
  });

  if (!substage) {
    throw notFound("SUBSTAGE_NOT_FOUND", "Subetapa no encontrada");
  }

  return substage;
}

async function findTaskOrThrow(projectId: string, taskId: string) {
  const task = await prisma.task.findFirst({
    where: {
      id: taskId,
      projectId,
      deletedAt: null,
    },
  });

  if (!task) {
    throw notFound("TASK_NOT_FOUND", "Tarea no encontrada");
  }

  return task;
}

async function findFileOrThrow(fileId: string) {
  const file = await prisma.fileAttachment.findFirst({
    where: {
      id: fileId,
      deletedAt: null,
      project: {
        deletedAt: null,
      },
    },
  });

  if (!file) {
    throw notFound("FILE_NOT_FOUND", "Archivo no encontrado");
  }

  return file;
}

function normalizeProjectInput(input: Record<string, unknown>) {
  const source = input as Record<string, any>;
  const normalized: Record<string, unknown> = {};

  if (source.clientName !== undefined) normalized.clientName = source.clientName;
  if (source.capacityKwp !== undefined) normalized.capacityKwp = new Prisma.Decimal(source.capacityKwp);
  if (source.locationCity !== undefined) normalized.locationCity = source.locationCity;
  if (source.locationProvince !== undefined) normalized.locationProvince = source.locationProvince;
  if (source.status !== undefined) normalized.status = source.status;
  if (source.startDate !== undefined) normalized.startDate = parseDateOnly(source.startDate);
  if (source.plannedEndDate !== undefined) normalized.plannedEndDate = parseDateOnly(source.plannedEndDate);
  if (source.actualEndDate !== undefined) {
    normalized.actualEndDate = source.actualEndDate ? parseDateOnly(source.actualEndDate) : null;
  }
  if (source.budgetUsd !== undefined) normalized.budgetUsd = new Prisma.Decimal(source.budgetUsd);
  if (source.executedUsd !== undefined) normalized.executedUsd = new Prisma.Decimal(source.executedUsd);
  if (source.estimatedMwhYear !== undefined) {
    const estimatedMwhYear = Number(source.estimatedMwhYear);
    normalized.estimatedMwhYear = new Prisma.Decimal(estimatedMwhYear);
    normalized.co2TonsAvoided = new Prisma.Decimal((estimatedMwhYear * 0.5).toFixed(2));
  }
  if (source.notificationEmail !== undefined) normalized.notificationEmail = source.notificationEmail;
  if (source.notificationPhone !== undefined) normalized.notificationPhone = source.notificationPhone;

  return normalized;
}

const projectFieldLabels: Record<string, string> = {
  clientName: "cliente",
  capacityKwp: "potencia kWp",
  locationCity: "ciudad",
  locationProvince: "provincia",
  status: "estado del proyecto",
  startDate: "fecha de inicio",
  plannedEndDate: "fecha estimada de entrega",
  actualEndDate: "fecha real de fin",
  budgetUsd: "presupuesto USD",
  executedUsd: "monto ejecutado USD",
  estimatedMwhYear: "generación estimada anual",
  co2TonsAvoided: "CO2 evitado",
  notificationEmail: "email de notificación",
  notificationPhone: "teléfono de notificación",
};

const stageFieldLabels: Record<string, string> = {
  status: "estado de la etapa",
  notes: "notas",
  plannedStartDate: "fecha planificada de inicio",
  plannedEndDate: "fecha planificada de fin",
  actualStartDate: "fecha real de inicio",
  actualEndDate: "fecha real de fin",
  actualDurationDays: "duración real",
  delayDays: "desvío",
  progressPercent: "avance",
};

const substageFieldLabels: Record<string, string> = {
  name: "nombre de la subetapa",
  status: "estado de la subetapa",
  responsible: "responsable",
  userId: "usuario asignado",
  dueDate: "vencimiento",
  plannedStartDate: "inicio planificado",
  plannedEndDate: "fin planificado",
  actualStartDate: "inicio real",
  actualEndDate: "fin real",
  notes: "notas",
  order: "orden",
};

const taskFieldLabels: Record<string, string> = {
  title: "título de la tarea",
  description: "descripción",
  status: "estado de la tarea",
  priority: "prioridad",
  responsible: "responsable",
  userId: "usuario asignado",
  dueDate: "vencimiento",
  completedAt: "fecha de completado",
  stageId: "etapa asociada",
  substageId: "subetapa asociada",
};

export async function registerApiRoutes(app: FastifyInstance) {
  app.addHook("preHandler", authenticate);

  app.get("/projects", async (request) => {
    const query = z
      .object({
        status: z.nativeEnum(ProjectStatus).optional(),
        search: z.string().trim().optional(),
      })
      .parse(request.query);

    const projects = await prisma.project.findMany({
      where: {
        deletedAt: null,
        status: query.status,
        ...(query.search
          ? {
              OR: [
                { clientName: { contains: query.search, mode: "insensitive" } },
                { code: { contains: query.search, mode: "insensitive" } },
              ],
            }
          : {}),
      },
      include: {
        stages: {
          orderBy: { order: "asc" },
        },
      },
      orderBy: { updatedAt: "desc" },
    });

    return projects.map((project) => {
      const currentStage = getCurrentStage(project.stages);
      const progressPercent =
        project.stages.length > 0
          ? Math.round(project.stages.reduce((sum, stage) => sum + stage.progressPercent, 0) / project.stages.length)
          : 0;
      const delayDays = project.stages
        .filter((stage) => stage.status === StageStatus.COMPLETED)
        .reduce((sum, stage) => sum + (stage.delayDays ?? 0), 0);

      return {
        id: project.id,
        code: project.code,
        clientName: project.clientName,
        capacityKwp: decimalToNumber(project.capacityKwp),
        status: project.status,
        progressPercent,
        delayDays,
        currentStage: currentStage
          ? {
              id: currentStage.id,
              name: currentStage.name,
              status: currentStage.status,
              progressPercent: currentStage.progressPercent,
            }
          : null,
        updatedAt: serializeDate(project.updatedAt),
      };
    });
  });

  app.get("/projects/:id", async (request) => {
    const params = z.object({ id: z.string() }).parse(request.params);
    const project = await prisma.project.findFirst({
      where: {
        id: params.id,
        deletedAt: null,
      },
      include: {
        stages: {
          orderBy: { order: "asc" },
          include: {
            substages: {
              where: { deletedAt: null },
              orderBy: { order: "asc" },
            },
          },
        },
        tasks: {
          where: { deletedAt: null },
          orderBy: { updatedAt: "desc" },
          take: 10,
        },
        files: {
          where: { deletedAt: null },
          orderBy: { createdAt: "desc" },
          take: 5,
        },
      },
    });

    if (!project) {
      throw notFound("PROJECT_NOT_FOUND", "Proyecto no encontrado");
    }

    const metrics = calculateProjectMetrics(project);

    return {
      ...serializeProject(project),
      metrics,
      currentStage: (() => {
        const currentStage = getCurrentStage(project.stages.map((stage) => ({ ...stage })));
        return currentStage ? serializeStage(currentStage) : null;
      })(),
      stages: project.stages.map((stage) => ({
        ...serializeStage(stage),
        substages: stage.substages.map(serializeSubstage),
      })),
      recentTasks: project.tasks.map(serializeTask),
      recentFiles: project.files.map(serializeFile),
    };
  });

  app.post("/projects", async (request, reply) => {
    const user = ensureUser(request);
    const body = projectCreateSchema.parse(request.body);
    const startDate = body.startDate ? parseDateOnly(body.startDate) : todayUtc();
    const plannedEndDate = parseDateOnly(body.plannedEndDate);

    const code = await generateProjectCode();

    const project = await prisma.project.create({
      data: {
        code,
        clientName: body.clientName,
        capacityKwp: new Prisma.Decimal(body.capacityKwp),
        locationCity: body.locationCity,
        locationProvince: body.locationProvince,
        status: ProjectStatus.PROSPECT,
        startDate,
        plannedEndDate,
        budgetUsd: new Prisma.Decimal(body.budgetUsd),
        executedUsd: new Prisma.Decimal(0),
        estimatedMwhYear: new Prisma.Decimal(body.estimatedMwhYear),
        co2TonsAvoided: new Prisma.Decimal((body.estimatedMwhYear * 0.5).toFixed(2)),
        notificationEmail: body.notificationEmail,
        notificationPhone: body.notificationPhone,
        createdById: user.id,
        stages: {
          create: buildInitialStages(startDate, plannedEndDate),
        },
      },
      include: {
        stages: {
          orderBy: { order: "asc" },
        },
      },
    });

    await createAuditEntry({
      entityType: AuditEntityType.project,
      entityId: project.id,
      projectId: project.id,
      userId: user.id,
      action: AuditAction.created,
      description: `Creó proyecto '${project.clientName}' con código ${project.code}`,
      metadata: { stageCount: 6 },
    });

    reply.code(201);
    return {
      ...serializeProject(project),
      stages: project.stages.map(serializeStage),
    };
  });

  app.patch("/projects/:id", async (request) => {
    const user = ensureUser(request);
    const params = z.object({ id: z.string() }).parse(request.params);
    const body = projectPatchSchema.parse(request.body);
    const project = await findProjectOrThrow(params.id);

    const updateData = normalizeProjectInput(body);
    const updatedProject = await prisma.project.update({
      where: { id: project.id },
      data: updateData,
    });

    await createAuditEntriesForChanges({
      entityType: AuditEntityType.project,
      entityId: project.id,
      projectId: project.id,
      userId: user.id,
      oldData: project,
      newData: { ...project, ...updateData },
      labels: projectFieldLabels,
      formatter: ({ label, oldValue, newValue }) =>
        `Actualizó ${label} de ${oldValue ?? "vacío"} a ${newValue ?? "vacío"} en proyecto ${project.code}`,
    });

    return serializeProject(updatedProject);
  });

  app.delete("/projects/:id", async (request) => {
    const user = ensureUser(request);
    const params = z.object({ id: z.string() }).parse(request.params);
    const project = await findProjectOrThrow(params.id);

    const deletedProject = await prisma.project.update({
      where: { id: project.id },
      data: { deletedAt: new Date() },
    });

    await createAuditEntry({
      entityType: AuditEntityType.project,
      entityId: project.id,
      projectId: project.id,
      userId: user.id,
      action: AuditAction.deleted,
      description: `Eliminó lógicamente el proyecto ${project.code}`,
    });

    return serializeProject(deletedProject);
  });

  app.get("/projects/:projectId/stages", async (request) => {
    const params = z.object({ projectId: z.string() }).parse(request.params);
    await findProjectOrThrow(params.projectId);

    const stages = await prisma.stage.findMany({
      where: { projectId: params.projectId },
      include: {
        substages: {
          where: { deletedAt: null },
          orderBy: { order: "asc" },
        },
      },
      orderBy: { order: "asc" },
    });

    return stages.map((stage) => ({
      ...serializeStage(stage),
      substages: stage.substages.map(serializeSubstage),
    }));
  });

  app.patch("/projects/:projectId/stages/:stageId", async (request) => {
    const user = ensureUser(request);
    const params = z.object({ projectId: z.string(), stageId: z.string() }).parse(request.params);
    const body = stagePatchSchema.parse(request.body);
    const stage = await findStageOrThrow(params.projectId, params.stageId);

    const updateData: Record<string, unknown> = {};
    if (body.notes !== undefined) updateData.notes = body.notes;
    if (body.plannedStartDate !== undefined) updateData.plannedStartDate = body.plannedStartDate ? parseDateOnly(body.plannedStartDate) : null;
    if (body.plannedEndDate !== undefined) updateData.plannedEndDate = body.plannedEndDate ? parseDateOnly(body.plannedEndDate) : null;

    if (body.status && body.status !== stage.status) {
      if (body.status === StageStatus.IN_PROGRESS) {
        const previousStage = await prisma.stage.findFirst({
          where: {
            projectId: params.projectId,
            order: stage.order - 1,
          },
        });

        if (previousStage && previousStage.status !== StageStatus.COMPLETED) {
          throw conflict(
            "STAGE_ORDER_VIOLATION",
            "No se puede iniciar esta etapa hasta completar la etapa anterior",
          );
        }

        updateData.status = StageStatus.IN_PROGRESS;
        updateData.actualStartDate = todayUtc();

        await createAuditEntry({
          entityType: AuditEntityType.stage,
          entityId: stage.id,
          projectId: params.projectId,
          userId: user.id,
          action: AuditAction.stage_advanced,
          fieldChanged: "status",
          oldValue: stage.status,
          newValue: StageStatus.IN_PROGRESS,
          description: `Cambió estado de ${stage.name} de ${stage.status} a IN_PROGRESS`,
        });
      } else if (body.status === StageStatus.COMPLETED) {
        const actualEndDate = todayUtc();
        const actualStartDate = stage.actualStartDate ?? actualEndDate;
        const actualDurationDays = Math.max(0, diffInDays(actualStartDate, actualEndDate));
        const plannedDurationDays =
          stage.plannedDurationDays ??
          (stage.plannedStartDate && stage.plannedEndDate
            ? Math.max(0, diffInDays(stage.plannedStartDate, stage.plannedEndDate))
            : 0);

        updateData.status = StageStatus.COMPLETED;
        updateData.actualStartDate = stage.actualStartDate ?? todayUtc();
        updateData.actualEndDate = actualEndDate;
        updateData.actualDurationDays = actualDurationDays;
        updateData.delayDays = actualDurationDays - plannedDurationDays;
        updateData.progressPercent = 100;

        await createAuditEntry({
          entityType: AuditEntityType.stage,
          entityId: stage.id,
          projectId: params.projectId,
          userId: user.id,
          action: AuditAction.stage_advanced,
          fieldChanged: "status",
          oldValue: stage.status,
          newValue: StageStatus.COMPLETED,
          description: `Completó etapa ${stage.name}`,
        });
      } else {
        updateData.status = body.status;
      }
    }

    if (updateData.plannedStartDate && updateData.plannedEndDate) {
      updateData.plannedDurationDays = Math.max(
        0,
        diffInDays(updateData.plannedStartDate as Date, updateData.plannedEndDate as Date),
      );
    }

    const updatedStage = await prisma.stage.update({
      where: { id: stage.id },
      data: updateData,
    });

    const { status: _ignoredStatus, ...comparableStage } = { ...stage, ...updateData };

    await createAuditEntriesForChanges({
      entityType: AuditEntityType.stage,
      entityId: stage.id,
      projectId: params.projectId,
      userId: user.id,
      oldData: stage,
      newData: comparableStage,
      labels: stageFieldLabels,
      formatter: ({ label, oldValue, newValue }) =>
        `Actualizó ${label} de etapa ${stage.name} de ${oldValue ?? "vacío"} a ${newValue ?? "vacío"}`,
      action: AuditAction.updated,
    });

    return serializeStage(updatedStage);
  });

  app.get("/projects/:projectId/stages/:stageId/substages", async (request) => {
    const params = z.object({ projectId: z.string(), stageId: z.string() }).parse(request.params);
    await findStageOrThrow(params.projectId, params.stageId);

    const substages = await prisma.substage.findMany({
      where: {
        projectId: params.projectId,
        stageId: params.stageId,
        deletedAt: null,
      },
      orderBy: { order: "asc" },
    });

    return substages.map(serializeSubstage);
  });

  app.post("/projects/:projectId/stages/:stageId/substages", async (request, reply) => {
    const user = ensureUser(request);
    const params = z.object({ projectId: z.string(), stageId: z.string() }).parse(request.params);
    const body = substageCreateSchema.parse(request.body);
    await findStageOrThrow(params.projectId, params.stageId);

    const maxOrder = await prisma.substage.aggregate({
      where: {
        stageId: params.stageId,
      },
      _max: {
        order: true,
      },
    });

    const substage = await prisma.substage.create({
      data: {
        projectId: params.projectId,
        stageId: params.stageId,
        order: (maxOrder._max.order ?? 0) + 1,
        name: body.name,
        status: SubstageStatus.PENDING,
        responsible: body.responsible,
        userId: body.userId ?? null,
        dueDate: body.dueDate ? parseDateOnly(body.dueDate) : null,
        plannedStartDate: body.plannedStartDate ? parseDateOnly(body.plannedStartDate) : null,
        plannedEndDate: body.plannedEndDate ? parseDateOnly(body.plannedEndDate) : null,
        notes: body.notes ?? null,
      },
    });

    await createAuditEntry({
      entityType: AuditEntityType.substage,
      entityId: substage.id,
      projectId: params.projectId,
      userId: user.id,
      action: AuditAction.created,
      description: `Creó subetapa '${substage.name}' en etapa ${params.stageId}`,
    });

    reply.code(201);
    return serializeSubstage(substage);
  });

  app.patch("/projects/:projectId/stages/:stageId/substages/:substageId", async (request) => {
    const user = ensureUser(request);
    const params = z
      .object({ projectId: z.string(), stageId: z.string(), substageId: z.string() })
      .parse(request.params);
    const body = substagePatchSchema.parse(request.body);
    const substage = await findSubstageOrThrow(params.projectId, params.stageId, params.substageId);
    const updateData: Record<string, unknown> = {};

    if (body.name !== undefined) updateData.name = body.name;
    if (body.responsible !== undefined) updateData.responsible = body.responsible;
    if (body.userId !== undefined) updateData.userId = body.userId;
    if (body.dueDate !== undefined) updateData.dueDate = body.dueDate ? parseDateOnly(body.dueDate) : null;
    if (body.plannedStartDate !== undefined) updateData.plannedStartDate = body.plannedStartDate ? parseDateOnly(body.plannedStartDate) : null;
    if (body.plannedEndDate !== undefined) updateData.plannedEndDate = body.plannedEndDate ? parseDateOnly(body.plannedEndDate) : null;
    if (body.notes !== undefined) updateData.notes = body.notes;

    if (body.status && body.status !== substage.status) {
      updateData.status = body.status;
      if (body.status === SubstageStatus.IN_PROGRESS) {
        updateData.actualStartDate = todayUtc();
      }
      if (body.status === SubstageStatus.COMPLETED) {
        updateData.actualEndDate = todayUtc();
        updateData.actualStartDate = substage.actualStartDate ?? todayUtc();
      }
      if (body.status === SubstageStatus.BLOCKED) {
        await createNotificationIfNotExists({
          projectId: params.projectId,
          userId: substage.userId,
          type: NotificationType.substage_blocked,
          title: "Subetapa bloqueada",
          message: `La subetapa '${substage.name}' fue marcada como bloqueada.`,
        });
      }
    }

    const updatedSubstage = await prisma.substage.update({
      where: { id: substage.id },
      data: updateData,
    });

    await syncStageProgress(params.stageId);
    const syncedStage = await prisma.stage.findUnique({
      where: { id: params.stageId },
      include: {
        substages: {
          where: { deletedAt: null },
        },
      },
    });

    await createAuditEntriesForChanges({
      entityType: AuditEntityType.substage,
      entityId: substage.id,
      projectId: params.projectId,
      userId: user.id,
      oldData: substage,
      newData: { ...substage, ...updateData },
      labels: substageFieldLabels,
      formatter: ({ label, oldValue, newValue }) =>
        `Actualizó ${label} de subetapa '${substage.name}' de ${oldValue ?? "vacío"} a ${newValue ?? "vacío"}`,
    });

    return {
      ...serializeSubstage(updatedSubstage),
      stageProgressPercent: syncedStage ? calculateStageProgress(syncedStage.substages) : null,
    };
  });

  app.patch("/projects/:projectId/stages/:stageId/substages/reorder", async (request) => {
    const user = ensureUser(request);
    const params = z.object({ projectId: z.string(), stageId: z.string() }).parse(request.params);
    const body = reorderSubstagesSchema.parse(request.body);
    await findStageOrThrow(params.projectId, params.stageId);

    await prisma.$transaction(
      body.items.map((item) =>
        prisma.substage.update({
          where: { id: item.id },
          data: { order: item.order },
        }),
      ),
    );

    await createAuditEntry({
      entityType: AuditEntityType.substage,
      entityId: params.stageId,
      projectId: params.projectId,
      userId: user.id,
      action: AuditAction.updated,
      description: `Reordenó subetapas de la etapa ${params.stageId}`,
      metadata: { items: body.items },
    });

    return { success: true };
  });

  app.delete("/projects/:projectId/stages/:stageId/substages/:substageId", async (request) => {
    const user = ensureUser(request);
    const params = z
      .object({ projectId: z.string(), stageId: z.string(), substageId: z.string() })
      .parse(request.params);
    const substage = await findSubstageOrThrow(params.projectId, params.stageId, params.substageId);

    const deletedSubstage = await prisma.substage.update({
      where: { id: substage.id },
      data: { deletedAt: new Date() },
    });

    await syncStageProgress(params.stageId);

    await createAuditEntry({
      entityType: AuditEntityType.substage,
      entityId: substage.id,
      projectId: params.projectId,
      userId: user.id,
      action: AuditAction.deleted,
      description: `Eliminó lógicamente la subetapa '${substage.name}'`,
    });

    return serializeSubstage(deletedSubstage);
  });

  app.get("/projects/:projectId/tasks", async (request) => {
    const params = z.object({ projectId: z.string() }).parse(request.params);
    const query = z
      .object({
        status: z.nativeEnum(TaskStatus).optional(),
        priority: z.nativeEnum(TaskPriority).optional(),
        stageId: z.string().optional(),
      })
      .parse(request.query);

    await findProjectOrThrow(params.projectId);

    const tasks = await prisma.task.findMany({
      where: {
        projectId: params.projectId,
        deletedAt: null,
        status: query.status,
        priority: query.priority,
        stageId: query.stageId,
      },
      orderBy: [{ dueDate: "asc" }, { createdAt: "desc" }],
    });

    return tasks.map(serializeTask);
  });

  app.post("/projects/:projectId/tasks", async (request, reply) => {
    const user = ensureUser(request);
    const params = z.object({ projectId: z.string() }).parse(request.params);
    const body = taskCreateSchema.parse(request.body);
    await findProjectOrThrow(params.projectId);

    const task = await prisma.task.create({
      data: {
        projectId: params.projectId,
        stageId: body.stageId ?? null,
        substageId: body.substageId ?? null,
        title: body.title,
        description: body.description ?? null,
        status: body.status,
        priority: body.priority,
        responsible: body.responsible,
        userId: body.userId ?? null,
        dueDate: body.dueDate ? parseDateOnly(body.dueDate) : null,
      },
    });

    await createAuditEntry({
      entityType: AuditEntityType.task,
      entityId: task.id,
      projectId: params.projectId,
      userId: user.id,
      action: AuditAction.created,
      description: `Creó tarea '${task.title}'`,
    });

    reply.code(201);
    return serializeTask(task);
  });

  app.patch("/projects/:projectId/tasks/:taskId", async (request) => {
    const user = ensureUser(request);
    const params = z.object({ projectId: z.string(), taskId: z.string() }).parse(request.params);
    const body = taskPatchSchema.parse(request.body);
    const task = await findTaskOrThrow(params.projectId, params.taskId);
    const updateData: Record<string, unknown> = {};

    if (body.title !== undefined) updateData.title = body.title;
    if (body.description !== undefined) updateData.description = body.description;
    if (body.priority !== undefined) updateData.priority = body.priority;
    if (body.responsible !== undefined) updateData.responsible = body.responsible;
    if (body.userId !== undefined) updateData.userId = body.userId;
    if (body.stageId !== undefined) updateData.stageId = body.stageId;
    if (body.substageId !== undefined) updateData.substageId = body.substageId;
    if (body.dueDate !== undefined) updateData.dueDate = body.dueDate ? parseDateOnly(body.dueDate) : null;
    if (body.status !== undefined) {
      updateData.status = body.status;
      if (body.status === TaskStatus.COMPLETED) {
        updateData.completedAt = new Date();
      }
    }

    const updatedTask = await prisma.task.update({
      where: { id: task.id },
      data: updateData,
    });

    await createAuditEntriesForChanges({
      entityType: AuditEntityType.task,
      entityId: task.id,
      projectId: params.projectId,
      userId: user.id,
      oldData: task,
      newData: { ...task, ...updateData },
      labels: taskFieldLabels,
      formatter: ({ label, oldValue, newValue }) =>
        `Actualizó ${label} de tarea '${task.title}' de ${oldValue ?? "vacío"} a ${newValue ?? "vacío"}`,
    });

    return serializeTask(updatedTask);
  });

  app.delete("/projects/:projectId/tasks/:taskId", async (request) => {
    const user = ensureUser(request);
    const params = z.object({ projectId: z.string(), taskId: z.string() }).parse(request.params);
    const task = await findTaskOrThrow(params.projectId, params.taskId);

    const deletedTask = await prisma.task.update({
      where: { id: task.id },
      data: { deletedAt: new Date() },
    });

    await createAuditEntry({
      entityType: AuditEntityType.task,
      entityId: task.id,
      projectId: params.projectId,
      userId: user.id,
      action: AuditAction.deleted,
      description: `Eliminó lógicamente la tarea '${task.title}'`,
    });

    return serializeTask(deletedTask);
  });

  app.post("/projects/:projectId/files", async (request, reply) => {
    const user = ensureUser(request);
    const params = z.object({ projectId: z.string() }).parse(request.params);
    await findProjectOrThrow(params.projectId);

    const parts = request.parts();
    let uploadedFile: Awaited<ReturnType<typeof saveUploadedFile>> | null = null;
    let stageId: string | null = null;
    let substageId: string | null = null;

    for await (const part of parts) {
      if (part.type === "file") {
        uploadedFile = await saveUploadedFile(part, params.projectId);
      } else if (part.fieldname === "stageId") {
        stageId = String(part.value || "") || null;
      } else if (part.fieldname === "substageId") {
        substageId = String(part.value || "") || null;
      }
    }

    if (!uploadedFile) {
      throw badRequest("FILE_REQUIRED", "Debés adjuntar un archivo");
    }

    const file = await prisma.fileAttachment.create({
      data: {
        projectId: params.projectId,
        stageId,
        substageId,
        filename: uploadedFile.filename,
        storedFilename: uploadedFile.storedFilename,
        mimeType: uploadedFile.mimeType,
        sizeBytes: uploadedFile.sizeBytes,
        url: uploadedFile.url,
        uploadedById: user.id,
      },
    });

    await createAuditEntry({
      entityType: AuditEntityType.file,
      entityId: file.id,
      projectId: params.projectId,
      userId: user.id,
      action: AuditAction.file_uploaded,
      description: `Subió archivo '${file.filename}'`,
    });

    reply.code(201);
    return serializeFile(file);
  });

  app.get("/projects/:projectId/files", async (request) => {
    const params = z.object({ projectId: z.string() }).parse(request.params);
    const query = z
      .object({
        stageId: z.string().optional(),
        substageId: z.string().optional(),
      })
      .parse(request.query);

    await findProjectOrThrow(params.projectId);

    const files = await prisma.fileAttachment.findMany({
      where: {
        projectId: params.projectId,
        deletedAt: null,
        stageId: query.stageId,
        substageId: query.substageId,
      },
      orderBy: { createdAt: "desc" },
    });

    return files.map(serializeFile);
  });

  app.get("/files/:fileId/download", async (request, reply) => {
    ensureUser(request);
    const params = z.object({ fileId: z.string() }).parse(request.params);
    const file = await findFileOrThrow(params.fileId);
    const absolutePath = getStoredFilePath(file.url);

    if (!fs.existsSync(absolutePath)) {
      throw notFound("FILE_NOT_FOUND", "El archivo no existe en storage");
    }

    reply.header("Content-Type", file.mimeType);
    reply.header("Content-Disposition", `attachment; filename="${file.filename}"`);
    return reply.send(fs.createReadStream(absolutePath));
  });

  app.delete("/files/:fileId", async (request) => {
    const user = ensureUser(request);
    const params = z.object({ fileId: z.string() }).parse(request.params);
    const file = await findFileOrThrow(params.fileId);

    await deleteStoredFile(file.url);

    const deletedFile = await prisma.fileAttachment.update({
      where: { id: file.id },
      data: { deletedAt: new Date() },
    });

    await createAuditEntry({
      entityType: AuditEntityType.file,
      entityId: file.id,
      projectId: file.projectId,
      userId: user.id,
      action: AuditAction.deleted,
      description: `Eliminó archivo '${file.filename}'`,
    });

    return serializeFile(deletedFile);
  });

  app.get("/projects/:projectId/audit", async (request) => {
    const params = z.object({ projectId: z.string() }).parse(request.params);
    const query = z
      .object({
        page: z.coerce.number().int().positive().default(1),
        limit: z.coerce.number().int().positive().max(100).default(20),
        userId: z.string().optional(),
        action: z.nativeEnum(AuditAction).optional(),
        entityType: z.nativeEnum(AuditEntityType).optional(),
        desde: z.string().datetime().optional(),
        hasta: z.string().datetime().optional(),
      })
      .parse(request.query);

    await findProjectOrThrow(params.projectId);

    const auditEntries = await prisma.auditLog.findMany({
      where: {
        projectId: params.projectId,
        userId: query.userId,
        action: query.action,
        entityType: query.entityType,
        timestamp: {
          gte: query.desde ? new Date(query.desde) : undefined,
          lte: query.hasta ? new Date(query.hasta) : undefined,
        },
      },
      include: {
        user: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
      },
      orderBy: { timestamp: "desc" },
      skip: (query.page - 1) * query.limit,
      take: query.limit,
    });

    return auditEntries.map((entry) => ({
      ...entry,
      timestamp: serializeDate(entry.timestamp),
    }));
  });

  app.get("/audit/stats/:projectId", async (request) => {
    const params = z.object({ projectId: z.string() }).parse(request.params);
    const project = await prisma.project.findFirst({
      where: {
        id: params.projectId,
        deletedAt: null,
      },
      include: {
        stages: {
          orderBy: { order: "asc" },
        },
      },
    });

    if (!project) {
      throw notFound("PROJECT_NOT_FOUND", "Proyecto no encontrado");
    }

    const metrics = calculateProjectMetrics(project);
    const statusChanges = await prisma.auditLog.findMany({
      where: {
        projectId: params.projectId,
        fieldChanged: "status",
      },
      include: {
        user: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
      },
      orderBy: { timestamp: "desc" },
    });

    return {
      projectId: params.projectId,
      timeEfficiency: metrics.timeEfficiency,
      stages: project.stages.map((stage) => ({
        id: stage.id,
        name: stage.name,
        plannedDurationDays: stage.plannedDurationDays,
        actualDurationDays: stage.actualDurationDays,
        delayDays: stage.delayDays,
      })),
      statusChanges: statusChanges.map((entry) => ({
        id: entry.id,
        entityType: entry.entityType,
        entityId: entry.entityId,
        description: entry.description,
        oldValue: entry.oldValue,
        newValue: entry.newValue,
        timestamp: serializeDate(entry.timestamp),
        user: entry.user,
      })),
    };
  });

  app.get("/notifications", async (request, reply) => {
    const user = ensureUser(request);
    const query = z
      .object({
        unread: z
          .enum(["true", "false"])
          .transform((value) => value === "true")
          .optional(),
      })
      .parse(request.query);

    const where = {
      OR: [{ userId: user.id }, { userId: null }],
      ...(query.unread ? { read: false } : {}),
    };

    const [notifications, unreadCount] = await Promise.all([
      prisma.notification.findMany({
        where,
        orderBy: { createdAt: "desc" },
      }),
      prisma.notification.count({
        where: {
          OR: [{ userId: user.id }, { userId: null }],
          read: false,
        },
      }),
    ]);

    reply.header("X-Unread-Count", String(unreadCount));
    return notifications.map((notification) => ({
      ...notification,
      createdAt: serializeDate(notification.createdAt),
    }));
  });

  app.patch("/notifications/:id/read", async (request) => {
    const user = ensureUser(request);
    const params = z.object({ id: z.string() }).parse(request.params);
    const notification = await prisma.notification.findFirst({
      where: {
        id: params.id,
        OR: [{ userId: user.id }, { userId: null }],
      },
    });

    if (!notification) {
      throw notFound("NOTIFICATION_NOT_FOUND", "Notificación no encontrada");
    }

    const updatedNotification = await prisma.notification.update({
      where: { id: notification.id },
      data: { read: true },
    });

    await createAuditEntry({
      entityType: AuditEntityType.notification,
      entityId: notification.id,
      projectId: notification.projectId,
      userId: user.id,
      action: AuditAction.updated,
      fieldChanged: "read",
      oldValue: String(notification.read),
      newValue: "true",
      description: `Marcó como leída la notificación '${notification.title}'`,
    });

    return updatedNotification;
  });

  app.patch("/notifications/read-all", async (request) => {
    const user = ensureUser(request);
    const targetNotifications = await prisma.notification.findMany({
      where: {
        OR: [{ userId: user.id }, { userId: null }],
        read: false,
      },
    });

    await prisma.notification.updateMany({
      where: {
        OR: [{ userId: user.id }, { userId: null }],
        read: false,
      },
      data: { read: true },
    });

    await Promise.all(
      targetNotifications.map((notification) =>
        createAuditEntry({
          entityType: AuditEntityType.notification,
          entityId: notification.id,
          projectId: notification.projectId,
          userId: user.id,
          action: AuditAction.updated,
          fieldChanged: "read",
          oldValue: "false",
          newValue: "true",
          description: `Marcó como leída la notificación '${notification.title}'`,
        }),
      ),
    );

    return { success: true };
  });
}

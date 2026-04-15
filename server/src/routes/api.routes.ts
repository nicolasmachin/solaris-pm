import { execFile } from "node:child_process";
import { randomUUID } from "node:crypto";
import fs, { promises as fsPromises } from "node:fs";
import path from "node:path";
import { pipeline } from "node:stream/promises";
import { promisify } from "node:util";

import bcrypt from "bcryptjs";
import type { FastifyInstance } from "fastify";
import {
  Action,
  AuditAction,
  AuditEntityType,
  GoalArea,
  GoalMetric,
  GoalPeriod,
  ModalidadPago,
  Module,
  NotificationType,
  PhaseType,
  Prisma,
  ProjectStatus,
  Role,
  SalesStage,
  StageStatus,
  StageType,
  SettingKey,
  SettingLevel,
  SubstageStatus,
  TaskPriority,
  TaskStatus,
  TipoObra,
} from "@prisma/client";
import { z } from "zod";

import { prisma } from "../lib/prisma.js";
import { env } from "../config/env.js";
import { authenticate } from "../middleware/auth.middleware.js";
import { authorize } from "../middleware/authorize.middleware.js";
import { createAuditEntriesForChanges, createAuditEntry } from "../services/audit.service.js";
import { deleteStoredFile, getStoredFilePath, saveUploadedFile } from "../services/file-storage.service.js";
import {
  calculateProjectMetrics,
  calculateProjectProgress,
  calculateStageProgress,
  createInitialPipeline,
  generateProjectCode,
  getCurrentStage,
  serializeFile,
  serializeChecklistItem,
  serializeProject,
  serializeSolarSystem,
  serializeStage,
  serializeSubstage,
  serializeTask,
  sumProjectDelayDays,
  syncStageProgress,
  syncSubstageProgress,
} from "../services/project.service.js";
import { getStageLabel, getTipoObraLabel, getOperationVisibility } from "../services/pipeline-definitions.js";
import { createNotificationIfNotExists } from "../services/notification.service.js";
import { createAndSendNotification, checkProgressMilestone } from "../services/notify.service.js";
import { diffInDays, parseDateOnly, todayUtc } from "../utils/dates.js";
import { AppError, badRequest, conflict, forbidden, notFound } from "../utils/errors.js";
import { decimalToNumber, serializeDate, serializeDateOnly } from "../utils/serialization.js";

const execFileAsync = promisify(execFile);

const dateOnlySchema = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Debe tener formato YYYY-MM-DD");

const solarSystemBaseSchema = z.object({
  description: z.string().trim().min(1).nullable().optional(),
  inverterBrand: z.string().trim().min(1).nullable().optional(),
  inverterPowerKw: z.coerce.number().positive().nullable().optional(),
  inverterQuantity: z.coerce.number().int().positive().nullable().optional(),
  inverterPhaseType: z.nativeEnum(PhaseType).nullable().optional(),
  inverterModel: z.string().trim().min(1).nullable().optional(),
  panelQuantity: z.coerce.number().int().positive().nullable().optional(),
  panelPowerW: z.coerce.number().int().positive().nullable().optional(),
  panelBrand: z.string().trim().min(1).nullable().optional(),
  panelModel: z.string().trim().min(1).nullable().optional(),
});

const solarSystemCreateSchema = solarSystemBaseSchema
  .extend({
    order: z.coerce.number().int().positive().optional(),
  })
  .strict();

const solarSystemPatchSchema = solarSystemBaseSchema
  .extend({
    order: z.coerce.number().int().positive().optional(),
  })
  .strict()
  .refine((value) => Object.keys(value).length > 0, {
    message: "Debés enviar al menos un campo para actualizar",
  });

const projectCreateSchema = z
  .object({
    clientName: z.string().min(1),
    capacityKwp: z.coerce.number().positive(),
    locationCity: z.string().min(1),
    locationProvince: z.string().min(1),
    plannedEndDate: dateOnlySchema,
    budgetUsd: z.coerce.number().positive(),
    estimatedMwhYear: z.coerce.number().positive().optional().default(0),
    modalidadPago: z.nativeEnum(ModalidadPago).optional(),
    notificationEmail: z.string().email().optional().default(""),
    notificationPhone: z.string().optional().default(""),
    startDate: dateOnlySchema.optional(),
    solarSystem: solarSystemCreateSchema.optional(),
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
    modalidadPago: z.nativeEnum(ModalidadPago).nullable().optional(),
    notificationEmail: z.string().email().optional(),
    notificationPhone: z.string().min(1).optional(),
    firstDateScheduledAt: z.string().datetime({ offset: true }).nullable().optional(),
  })
  .strict();

const stagePatchSchema = z
  .object({
    status: z.nativeEnum(StageStatus).optional(),
    tipoObra: z.nativeEnum(TipoObra).nullable().optional(),
    responsibleName: z.string().trim().min(1).nullable().optional(),
    notes: z.string().nullable().optional(),
    plannedStartDate: dateOnlySchema.nullable().optional(),
    plannedEndDate: dateOnlySchema.nullable().optional(),
  })
  .strict();

const substageCreateSchema = z
  .object({
    name: z.string().min(1),
    responsible: z.string().min(1),
    sopCode: z.string().nullable().optional(),
    responsableRol: z.string().nullable().optional(),
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
    sopCode: z.string().nullable().optional(),
    responsableRol: z.string().nullable().optional(),
    status: z.nativeEnum(SubstageStatus).optional(),
    responsible: z.string().min(1).optional(),
    userId: z.string().nullable().optional(),
    dueDate: dateOnlySchema.nullable().optional(),
    plannedStartDate: dateOnlySchema.nullable().optional(),
    plannedEndDate: dateOnlySchema.nullable().optional(),
    notes: z.string().nullable().optional(),
  })
  .strict();

const checklistPatchSchema = z
  .object({
    completed: z.boolean().optional(),
    notes: z.string().nullable().optional(),
    label: z.string().trim().min(1).optional(),
    isRequired: z.boolean().optional(),
  })
  .strict()
  .refine((value) => Object.keys(value).length > 0, {
    message: "Debés enviar al menos un campo para actualizar",
  });

const checklistCreateSchema = z
  .object({
    label: z.string().min(1),
    isBlocker: z.boolean().optional(),
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

const userCreateSchema = z
  .object({
    name: z.string().min(1),
    email: z.string().email(),
    password: z.string().min(8, "La contraseña debe tener al menos 8 caracteres"),
    role: z.nativeEnum(Role),
  })
  .strict();

const userPatchSchema = z
  .object({
    name: z.string().min(1).optional(),
    email: z.string().email().optional(),
    role: z.nativeEnum(Role).optional(),
  })
  .strict();

const userPasswordPatchSchema = z
  .object({
    currentPassword: z.string().min(1).optional(),
    newPassword: z.string().min(8, "La nueva contraseña debe tener al menos 8 caracteres"),
  })
  .strict();

const commentCreateSchema = z
  .object({
    content: z.string().trim().min(1, "El comentario no puede estar vacío"),
    projectId: z.string().min(1).optional(),
    leadId: z.string().min(1).optional(),
    stageId: z.string().nullable().optional(),
    substageId: z.string().nullable().optional(),
    checklistItemId: z.string().nullable().optional(),
    taskId: z.string().nullable().optional(),
  })
  .strict()
  .refine((value) => Boolean(value.projectId || value.leadId), {
    message: "Debés indicar projectId o leadId",
  });

const commentPatchSchema = z
  .object({
    content: z.string().trim().min(1, "El comentario no puede estar vacío"),
  })
  .strict();

const settingsPatchSchema = z
  .array(
    z
      .object({
        key: z.nativeEnum(SettingKey),
        value: z.string(),
      })
      .strict(),
  )
  .min(1);

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

async function findSolarSystemOrThrow(projectId: string, solarSystemId: string) {
  const solarSystem = await prisma.solarSystem.findFirst({
    where: {
      id: solarSystemId,
      projectId,
      deletedAt: null,
    },
  });

  if (!solarSystem) {
    throw notFound("SOLAR_SYSTEM_NOT_FOUND", "Sistema fotovoltaico no encontrado");
  }

  return solarSystem;
}

async function findStageOrThrow(projectId: string, stageId: string) {
  const stage = await prisma.stage.findFirst({
    where: {
      id: stageId,
      projectId,
    },
    include: {
      project: true,
      substages: {
        where: { deletedAt: null },
        orderBy: { order: "asc" },
        include: {
          checklistItems: {
            orderBy: { order: "asc" },
          },
        },
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

async function findChecklistItemOrThrow(itemId: string) {
  const item = await prisma.checklistItem.findUnique({
    where: { id: itemId },
    include: {
      substage: {
        include: {
          stage: true,
        },
      },
      project: true,
      user: {
        select: {
          id: true,
          name: true,
          email: true,
        },
      },
    },
  });

  if (!item) {
    throw notFound("CHECKLIST_ITEM_NOT_FOUND", "Ítem de checklist no encontrado");
  }

  return item;
}

async function findCommentOrThrow(commentId: string) {
  const comment = await prisma.comment.findFirst({
    where: {
      id: commentId,
      deletedAt: null,
    },
    include: {
      author: {
        select: {
          id: true,
          name: true,
        },
      },
    },
  });

  if (!comment) {
    throw notFound("COMMENT_NOT_FOUND", "Comentario no encontrado");
  }

  return comment;
}

async function getPendingBlockers(stageId: string, modalidadPago?: ModalidadPago | null) {
  return prisma.checklistItem.findMany({
    where: {
      substage: {
        stageId,
        deletedAt: null,
        isActive: true,
      },
      isBlocker: true,
      completed: false,
      OR: [
        { appliesWhenModalidadPago: null },
        ...(modalidadPago ? [{ appliesWhenModalidadPago: modalidadPago }] : []),
      ],
    },
    orderBy: [{ substage: { order: "asc" } }, { order: "asc" }],
  });
}

async function refreshStageProgressAndProject(stageId: string, projectId: string) {
  const syncedStage = await syncStageProgress(stageId);
  const projectProgressPercent = await calculateProjectProgress(projectId);
  const projectDelayDays = await sumProjectDelayDays(projectId);

  return {
    syncedStage,
    projectProgressPercent,
    projectDelayDays,
  };
}

function formatStageStatus(status: StageStatus) {
  if (status === StageStatus.IN_PROGRESS) return "En curso";
  if (status === StageStatus.COMPLETED) return "Completa";
  return "Pendiente";
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
  if (source.modalidadPago !== undefined) normalized.modalidadPago = source.modalidadPago;
  if (source.notificationEmail !== undefined) normalized.notificationEmail = source.notificationEmail;
  if (source.notificationPhone !== undefined) normalized.notificationPhone = source.notificationPhone;
  if (source.firstDateScheduledAt !== undefined) {
    normalized.firstDateScheduledAt = source.firstDateScheduledAt ? new Date(source.firstDateScheduledAt) : null;
  }

  return normalized;
}

function normalizeSolarSystemInput(input: Record<string, unknown>) {
  const source = input as Record<string, any>;
  const normalized: Record<string, unknown> = {};

  if (source.order !== undefined) normalized.order = source.order;
  if (source.description !== undefined) normalized.description = source.description;
  if (source.inverterBrand !== undefined) normalized.inverterBrand = source.inverterBrand;
  if (source.inverterPowerKw !== undefined) {
    normalized.inverterPowerKw =
      source.inverterPowerKw === null ? null : new Prisma.Decimal(source.inverterPowerKw);
  }
  if (source.inverterQuantity !== undefined) normalized.inverterQuantity = source.inverterQuantity;
  if (source.inverterPhaseType !== undefined) normalized.inverterPhaseType = source.inverterPhaseType;
  if (source.inverterModel !== undefined) normalized.inverterModel = source.inverterModel;
  if (source.panelQuantity !== undefined) normalized.panelQuantity = source.panelQuantity;
  if (source.panelPowerW !== undefined) normalized.panelPowerW = source.panelPowerW;
  if (source.panelBrand !== undefined) normalized.panelBrand = source.panelBrand;
  if (source.panelModel !== undefined) normalized.panelModel = source.panelModel;

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
  modalidadPago: "modalidad de pago",
  notificationEmail: "email de notificación",
  notificationPhone: "teléfono de notificación",
};

const solarSystemFieldLabels: Record<string, string> = {
  order: "orden",
  description: "descripción",
  inverterBrand: "marca del inversor",
  inverterPowerKw: "potencia del inversor",
  inverterQuantity: "cantidad de inversores",
  inverterPhaseType: "tipo de fase",
  inverterModel: "modelo del inversor",
  panelQuantity: "cantidad de paneles",
  panelPowerW: "potencia por panel",
  panelBrand: "marca de paneles",
  panelModel: "modelo de paneles",
};

const stageFieldLabels: Record<string, string> = {
  status: "estado de la etapa",
  tipoObra: "tipo de obra",
  responsibleName: "responsable de la etapa",
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
  sopCode: "código SOP",
  responsableRol: "rol responsable",
  status: "estado de la subetapa",
  progressPercent: "avance de la subetapa",
  responsible: "responsable",
  userId: "usuario asignado",
  dueDate: "vencimiento",
  plannedStartDate: "inicio planificado",
  plannedEndDate: "fin planificado",
  actualStartDate: "inicio real",
  actualEndDate: "fin real",
  actualDurationDays: "duración real",
  delayDays: "desvío",
  notes: "notas",
  order: "orden",
  isActive: "visibilidad",
};

const checklistFieldLabels: Record<string, string> = {
  completed: "estado del checklist",
  label: "ítem del checklist",
  notes: "notas del checklist",
  isRequired: "ítem obligatorio",
};

function serializeComment(comment: {
  id: string;
  content: string;
  projectId: string | null;
  leadId: string | null;
  stageId: string | null;
  substageId: string | null;
  checklistItemId: string | null;
  taskId: string | null;
  isEdited: boolean;
  editedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
  author: {
    id: string;
    name: string;
  };
}) {
  return {
    id: comment.id,
    content: comment.content,
    projectId: comment.projectId,
    leadId: comment.leadId,
    stageId: comment.stageId,
    substageId: comment.substageId,
    checklistItemId: comment.checklistItemId,
    taskId: comment.taskId,
    isEdited: comment.isEdited,
    editedAt: serializeDate(comment.editedAt),
    createdAt: serializeDate(comment.createdAt),
    updatedAt: serializeDate(comment.updatedAt),
    author: comment.author,
  };
}

function serializeUserSummary(user: {
  id: string;
  name: string;
  email: string;
  role: Role;
  createdAt: Date;
}) {
  return {
    id: user.id,
    name: user.name,
    email: user.email,
    role: user.role,
    createdAt: serializeDate(user.createdAt),
  };
}

function serializeSettingEntry(setting: {
  id: string;
  level: SettingLevel;
  key: SettingKey;
  value: string;
  userId: string | null;
  projectId: string | null;
  updatedById: string;
  updatedAt: Date;
}) {
  return {
    id: setting.id,
    level: setting.level,
    key: setting.key,
    value: setting.value,
    userId: setting.userId,
    projectId: setting.projectId,
    updatedById: setting.updatedById,
    updatedAt: serializeDate(setting.updatedAt),
  };
}

function groupPermissionsByModule(
  permissions: Array<{
    module: Module;
    action: Action;
  }>,
) {
  const grouped = new Map<Module, Action[]>();

  for (const permission of permissions) {
    const currentActions = grouped.get(permission.module) ?? [];
    currentActions.push(permission.action);
    grouped.set(permission.module, currentActions);
  }

  return [...grouped.entries()].map(([module, actions]) => ({
    module,
    actions: [...new Set(actions)],
  }));
}

async function upsertSetting(params: {
  level: SettingLevel;
  key: SettingKey;
  value: string;
  updatedById: string;
  userId?: string | null;
  projectId?: string | null;
}) {
  const existing = await prisma.setting.findFirst({
    where: {
      level: params.level,
      key: params.key,
      userId: params.userId ?? null,
      projectId: params.projectId ?? null,
    },
  });

  if (existing) {
    const updated = await prisma.setting.update({
      where: { id: existing.id },
      data: {
        value: params.value,
        updatedById: params.updatedById,
      },
    });

    return {
      previousValue: existing.value,
      setting: updated,
    };
  }

  const created = await prisma.setting.create({
    data: {
      level: params.level,
      key: params.key,
      value: params.value,
      userId: params.userId ?? null,
      projectId: params.projectId ?? null,
      updatedById: params.updatedById,
    },
  });

  return {
    previousValue: null,
    setting: created,
  };
}

async function resolveSettings(params: { userId: string; projectId?: string | null }) {
  const settings = await prisma.setting.findMany({
    where: {
      OR: [
        { level: SettingLevel.SYSTEM },
        { level: SettingLevel.USER, userId: params.userId },
        ...(params.projectId ? [{ level: SettingLevel.PROJECT, projectId: params.projectId }] : []),
      ],
    },
    orderBy: { updatedAt: "asc" },
  });

  const resolved: Partial<Record<SettingKey, string>> = {};

  for (const setting of settings.filter((item) => item.level === SettingLevel.SYSTEM)) {
    resolved[setting.key] = setting.value;
  }

  for (const setting of settings.filter((item) => item.level === SettingLevel.USER && item.userId === params.userId)) {
    resolved[setting.key] = setting.value;
  }

  if (params.projectId) {
    for (const setting of settings.filter(
      (item) => item.level === SettingLevel.PROJECT && item.projectId === params.projectId,
    )) {
      resolved[setting.key] = setting.value;
    }
  }

  return resolved;
}

async function generateLeadCode() {
  const year = new Date().getUTCFullYear();
  const prefix = `LEAD-${year}-`;

  const leads = await prisma.salesLead.findMany({
    where: {
      code: {
        startsWith: prefix,
      },
    },
    select: {
      code: true,
    },
  });

  const maxSequence = leads.reduce((max, lead) => {
    const parsed = Number(lead.code.split("-")[2]);
    return Number.isFinite(parsed) ? Math.max(max, parsed) : max;
  }, 0);

  return `${prefix}${String(maxSequence + 1).padStart(3, "0")}`;
}

async function saveProposalInputFile(file: import("@fastify/multipart").MultipartFile) {
  const extension = path.extname(file.filename).toLowerCase();
  if (![".xlsx", ".xls"].includes(extension)) {
    throw badRequest("INVALID_PROPOSAL_FILE", "Solo se permiten archivos .xlsx o .xls");
  }

  const proposalsDir = path.resolve(process.cwd(), "..", env.storagePath, "proposals");
  await fsPromises.mkdir(proposalsDir, { recursive: true });

  const storedFilename = `${randomUUID()}${extension}`;
  const absolutePath = path.join(proposalsDir, storedFilename);
  const writeStream = fs.createWriteStream(absolutePath);
  await pipeline(file.file, writeStream);

  return absolutePath;
}

async function processProposalGeneration(params: {
  proposalId: string;
  generatedById: string;
  projectId?: string | null;
}) {
  const proposal = await prisma.proposalGeneration.findUnique({
    where: { id: params.proposalId },
  });

  if (!proposal) {
    return;
  }

  const resolvedSettings = await resolveSettings({
    userId: params.generatedById,
    projectId: params.projectId ?? null,
  });
  const scriptPath = resolvedSettings.PROPOSAL_SCRIPT_PATH?.trim();

  if (!scriptPath) {
    await prisma.proposalGeneration.update({
      where: { id: params.proposalId },
      data: {
        status: "FAILED",
        errorMessage: "Script de propuesta no configurado. Ir a Configuración.",
      },
    });

    await createAuditEntry({
      entityType: AuditEntityType.proposal,
      entityId: params.proposalId,
      projectId: params.projectId ?? null,
      userId: params.generatedById,
      action: AuditAction.updated,
      fieldChanged: "status",
      oldValue: proposal.status,
      newValue: "FAILED",
      description: "Falló la generación de propuesta por falta de script configurado",
    });

    return;
  }

  const extension = path.extname(proposal.inputFilePath ?? ".xlsx").toLowerCase() || ".xlsx";
  const outputPath = path.resolve(process.cwd(), "..", env.storagePath, "proposals", `${randomUUID()}_output.pdf`);

  await prisma.proposalGeneration.update({
    where: { id: params.proposalId },
    data: {
      status: "PROCESSING",
      errorMessage: null,
    },
  });

  try {
    await execFileAsync("python3", [scriptPath, proposal.inputFilePath ?? "", outputPath]);

    await prisma.proposalGeneration.update({
      where: { id: params.proposalId },
      data: {
        status: "COMPLETED",
        outputFilePath: outputPath,
        errorMessage: null,
      },
    });

    // Auto-set proposalSentAt on the associated lead if not already set
    if (proposal.leadId) {
      await prisma.salesLead.updateMany({
        where: { id: proposal.leadId, proposalSentAt: null },
        data: { proposalSentAt: new Date() },
      });
    }

    await createAuditEntry({
      entityType: AuditEntityType.proposal,
      entityId: params.proposalId,
      projectId: params.projectId ?? null,
      userId: params.generatedById,
      action: AuditAction.proposal_generated,
      description: `Generó propuesta comercial automáticamente (${extension})`,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "No se pudo ejecutar el script de propuesta";

    await prisma.proposalGeneration.update({
      where: { id: params.proposalId },
      data: {
        status: "FAILED",
        errorMessage: message,
      },
    });

    await createAuditEntry({
      entityType: AuditEntityType.proposal,
      entityId: params.proposalId,
      projectId: params.projectId ?? null,
      userId: params.generatedById,
      action: AuditAction.updated,
      fieldChanged: "status",
      oldValue: "PROCESSING",
      newValue: "FAILED",
      description: "Falló la generación automática de propuesta comercial",
      metadata: {
        error: message,
      },
    });
  }
}

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

  app.get("/projects", { preHandler: authorize(Module.OPERACIONES, Action.VIEW) }, async (request) => {
    const query = z
      .object({
        status: z.nativeEnum(ProjectStatus).optional(),
        search: z.string().trim().optional(),
        page: z.coerce.number().int().positive().optional(),
        limit: z.coerce.number().int().positive().max(100).optional(),
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
        solarSystems: {
          where: { deletedAt: null, order: 1 },
          orderBy: { order: "asc" },
        },
      },
      orderBy: { updatedAt: "desc" },
      ...(query.page || query.limit
        ? {
            skip: ((query.page ?? 1) - 1) * (query.limit ?? 20),
            take: query.limit ?? 20,
          }
        : {}),
    });

    const items = projects.map((project) => {
      const currentStage = getCurrentStage(project.stages);
      const progressPercent =
        project.stages.length > 0
          ? Math.round(project.stages.reduce((sum, stage) => sum + stage.progressPercent, 0) / project.stages.length)
          : 0;
      const delayDays = project.stages
        .filter((stage) => stage.status === StageStatus.COMPLETED)
        .reduce((sum, stage) => sum + (stage.delayDays ?? 0), 0);
      const hasOverdueStage = project.stages.some(
        (stage) =>
          stage.status === StageStatus.IN_PROGRESS &&
          stage.plannedEndDate !== null &&
          diffInDays(stage.plannedEndDate, todayUtc()) > 0,
      );

      return {
        id: project.id,
        code: project.code,
        clientName: project.clientName,
        locationCity: project.locationCity,
        locationProvince: project.locationProvince,
        capacityKwp: decimalToNumber(project.capacityKwp),
        status: project.status,
        progressPercent,
        delayDays,
        hasOverdueStage,
        startDate: serializeDateOnly(project.startDate),
        plannedEndDate: serializeDateOnly(project.plannedEndDate),
        solarSystems: project.solarSystems.map(serializeSolarSystem),
        currentStage: currentStage
          ? {
              id: currentStage.id,
              name: currentStage.name,
              label: getStageLabel(currentStage.name),
              status: currentStage.status,
              progressPercent: currentStage.progressPercent,
            }
          : null,
        updatedAt: serializeDate(project.updatedAt),
      };
    });

    if (query.page || query.limit) {
      const total = await prisma.project.count({
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
      });

      const page = query.page ?? 1;
      const limit = query.limit ?? 20;

      return {
        data: items,
        total,
        page,
        limit,
        totalPages: Math.max(1, Math.ceil(total / limit)),
      };
    }

    return items;
  });

  app.get("/projects/:id", { preHandler: authorize(Module.OPERACIONES, Action.VIEW) }, async (request) => {
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
              where: { deletedAt: null, isActive: true },
              orderBy: { order: "asc" },
              include: {
                checklistItems: {
                  orderBy: { order: "asc" },
                },
              },
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
        solarSystems: {
          where: { deletedAt: null },
          orderBy: { order: "asc" },
        },
      },
    });

    if (!project) {
      throw notFound("PROJECT_NOT_FOUND", "Proyecto no encontrado");
    }

    const metrics = calculateProjectMetrics(project);

    return {
      ...serializeProject(project),
      solarSystems: project.solarSystems.map(serializeSolarSystem),
      metrics,
      currentStage: (() => {
        const currentStage = getCurrentStage(project.stages.map((stage) => ({ ...stage })));
        return currentStage ? serializeStage(currentStage) : null;
      })(),
      stages: project.stages.map((stage) => ({
        ...serializeStage(stage),
        substages: stage.substages.map((sub) => ({
          ...serializeSubstage(sub),
          checklistItems: sub.checklistItems.map(serializeChecklistItem),
        })),
      })),
      recentTasks: project.tasks.map(serializeTask),
      recentFiles: project.files.map(serializeFile),
    };
  });

  app.post("/projects", { preHandler: authorize(Module.OPERACIONES, Action.VIEW) }, async (request, reply) => {
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
        status: ProjectStatus.ACTIVE,
        startDate,
        plannedEndDate,
        budgetUsd: new Prisma.Decimal(body.budgetUsd),
        executedUsd: new Prisma.Decimal(0),
        estimatedMwhYear: new Prisma.Decimal(body.estimatedMwhYear),
        co2TonsAvoided: new Prisma.Decimal((body.estimatedMwhYear * 0.5).toFixed(2)),
        modalidadPago: body.modalidadPago ?? null,
        notificationEmail: body.notificationEmail,
        notificationPhone: body.notificationPhone,
        createdById: user.id,
        ...(body.solarSystem
          ? {
              solarSystems: {
                create: {
                  order: body.solarSystem.order ?? 1,
                  ...normalizeSolarSystemInput(body.solarSystem),
                },
              },
            }
          : {}),
      },
    });

    await createInitialPipeline(project.id, startDate, plannedEndDate, body.modalidadPago ?? null);

    const projectWithStages = await prisma.project.findUniqueOrThrow({
      where: { id: project.id },
      include: {
        stages: {
          orderBy: { order: "asc" },
        },
        solarSystems: {
          where: { deletedAt: null },
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
      metadata: { stageCount: 5 },
    });

    reply.code(201);
    return {
      ...serializeProject(projectWithStages),
      solarSystems: projectWithStages.solarSystems.map(serializeSolarSystem),
      stages: projectWithStages.stages.map(serializeStage),
    };
  });

  app.patch("/projects/:id", { preHandler: authorize(Module.OPERACIONES, Action.EDIT) }, async (request) => {
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

  app.delete("/projects/:id", { preHandler: authorize(Module.OPERACIONES, Action.EDIT) }, async (request) => {
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

  app.get("/projects/:projectId/systems", { preHandler: authorize(Module.OPERACIONES, Action.VIEW) }, async (request) => {
    const params = z.object({ projectId: z.string() }).parse(request.params);
    await findProjectOrThrow(params.projectId);

    const solarSystems = await prisma.solarSystem.findMany({
      where: {
        projectId: params.projectId,
        deletedAt: null,
      },
      orderBy: { order: "asc" },
    });

    return solarSystems.map(serializeSolarSystem);
  });

  app.post("/projects/:projectId/systems", { preHandler: authorize(Module.OPERACIONES, Action.CREATE) }, async (request, reply) => {
    const user = ensureUser(request);
    const params = z.object({ projectId: z.string() }).parse(request.params);
    const body = solarSystemCreateSchema.parse(request.body);
    const project = await findProjectOrThrow(params.projectId);

    const nextOrder =
      body.order ??
      ((await prisma.solarSystem.aggregate({
        where: { projectId: params.projectId, deletedAt: null },
        _max: { order: true },
      }))._max.order ?? 0) + 1;

    const solarSystem = await prisma.solarSystem.create({
      data: {
        projectId: params.projectId,
        order: nextOrder,
        ...normalizeSolarSystemInput(body),
      },
    });

    await createAuditEntry({
      entityType: AuditEntityType.solar_system,
      entityId: solarSystem.id,
      projectId: params.projectId,
      userId: user.id,
      action: AuditAction.created,
      description: `Creó sistema fotovoltaico #${solarSystem.order} en proyecto ${project.code}`,
      metadata: {
        solarSystemOrder: solarSystem.order,
      },
    });

    reply.code(201);
    return serializeSolarSystem(solarSystem);
  });

  app.patch("/projects/:projectId/systems/:systemId", { preHandler: authorize(Module.OPERACIONES, Action.EDIT) }, async (request) => {
    const user = ensureUser(request);
    const params = z.object({
      projectId: z.string(),
      systemId: z.string(),
    }).parse(request.params);
    const body = solarSystemPatchSchema.parse(request.body);

    const project = await findProjectOrThrow(params.projectId);
    const solarSystem = await findSolarSystemOrThrow(params.projectId, params.systemId);
    const updateData = normalizeSolarSystemInput(body);

    const updatedSolarSystem = await prisma.solarSystem.update({
      where: { id: solarSystem.id },
      data: updateData,
    });

    await createAuditEntriesForChanges({
      entityType: AuditEntityType.solar_system,
      entityId: solarSystem.id,
      projectId: params.projectId,
      userId: user.id,
      oldData: solarSystem,
      newData: { ...solarSystem, ...updateData },
      labels: solarSystemFieldLabels,
      formatter: ({ label, oldValue, newValue }) =>
        `Actualizó ${label} de ${oldValue ?? "vacío"} a ${newValue ?? "vacío"} en sistema fotovoltaico #${solarSystem.order} de ${project.code}`,
      metadata: {
        solarSystemOrder: solarSystem.order,
      },
    });

    return serializeSolarSystem(updatedSolarSystem);
  });

  app.delete("/projects/:projectId/systems/:systemId", { preHandler: authorize(Module.OPERACIONES, Action.DELETE) }, async (request) => {
    const user = ensureUser(request);
    const params = z.object({
      projectId: z.string(),
      systemId: z.string(),
    }).parse(request.params);

    const project = await findProjectOrThrow(params.projectId);
    const solarSystem = await findSolarSystemOrThrow(params.projectId, params.systemId);

    const deletedSolarSystem = await prisma.solarSystem.update({
      where: { id: solarSystem.id },
      data: {
        deletedAt: new Date(),
      },
    });

    await createAuditEntry({
      entityType: AuditEntityType.solar_system,
      entityId: solarSystem.id,
      projectId: params.projectId,
      userId: user.id,
      action: AuditAction.deleted,
      description: `Eliminó lógicamente sistema fotovoltaico #${solarSystem.order} de ${project.code}`,
      metadata: {
        solarSystemOrder: solarSystem.order,
      },
    });

    return serializeSolarSystem(deletedSolarSystem);
  });

  app.get("/projects/:projectId/stages", { preHandler: authorize(Module.OPERACIONES, Action.VIEW) }, async (request) => {
    const params = z.object({ projectId: z.string() }).parse(request.params);
    await findProjectOrThrow(params.projectId);

    const stages = await prisma.stage.findMany({
      where: { projectId: params.projectId },
      include: {
        substages: {
          where: { deletedAt: null, isActive: true },
          orderBy: { order: "asc" },
          include: {
            checklistItems: {
              orderBy: { order: "asc" },
            },
          },
        },
      },
      orderBy: { order: "asc" },
    });

    return stages.map((stage) => ({
      ...serializeStage(stage),
      substages: stage.substages.map(serializeSubstage),
    }));
  });

  app.patch("/projects/:projectId/stages/:stageId", { preHandler: authorize(Module.OPERACIONES, Action.EDIT) }, async (request) => {
    const user = ensureUser(request);
    const params = z.object({ projectId: z.string(), stageId: z.string() }).parse(request.params);
    const body = stagePatchSchema.parse(request.body);
    const stage = await findStageOrThrow(params.projectId, params.stageId);

    if (body.status !== undefined) {
      await authorize(Module.OPERACIONES, Action.COMPLETE)(request);
    }

    const updateData: Record<string, unknown> = {};
    if (body.tipoObra !== undefined) updateData.tipoObra = body.tipoObra;
    if (body.responsibleName !== undefined) updateData.responsibleName = body.responsibleName;
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

        if (stage.name === StageType.OPERACIONES) {
          const tipoObra = body.tipoObra ?? stage.tipoObra;
          if (!tipoObra) {
            throw badRequest(
              "TIPO_OBRA_REQUIRED",
              "Debe definir el tipo de obra antes de iniciar Operaciones",
            );
          }

          updateData.tipoObra = tipoObra;
          const visibility = getOperationVisibility(tipoObra);
          await prisma.$transaction([
            prisma.substage.updateMany({
              where: {
                stageId: stage.id,
                deletedAt: null,
              },
              data: { isActive: true },
            }),
            prisma.substage.updateMany({
              where: {
                stageId: stage.id,
                name: "Ejecución de Obra Propia",
              },
              data: { isActive: visibility["Ejecución de Obra Propia"] },
            }),
            prisma.substage.updateMany({
              where: {
                stageId: stage.id,
                name: "Ejecución de Obra Tercerizada",
              },
              data: { isActive: visibility["Ejecución de Obra Tercerizada"] },
            }),
          ]);
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
          description: `Cambió estado de ${getStageLabel(stage.name)} de ${formatStageStatus(stage.status)} a En curso`,
        });

        if (updateData.tipoObra && updateData.tipoObra !== stage.tipoObra) {
          await createAuditEntry({
            entityType: AuditEntityType.stage,
            entityId: stage.id,
            projectId: params.projectId,
            userId: user.id,
            action: AuditAction.updated,
            fieldChanged: "tipoObra",
            oldValue: stage.tipoObra,
            newValue: String(updateData.tipoObra),
            description: `Definió tipo de obra ${getTipoObraLabel(updateData.tipoObra as TipoObra)} para ${getStageLabel(stage.name)}`,
          });
        }
      } else if (body.status === StageStatus.COMPLETED) {
        const blockers = await getPendingBlockers(stage.id, stage.project.modalidadPago);
        if (blockers.length > 0) {
          const blockerLabels = blockers.map((item) => item.label);
          throw conflict("BLOCKER_ITEMS_PENDING", "Hay ítems obligatorios sin completar", {
            blockers: blockerLabels,
          });
        }

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
          description: `Completó etapa ${getStageLabel(stage.name)}`,
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
        `Actualizó ${label} de etapa ${getStageLabel(stage.name)} de ${oldValue ?? "vacío"} a ${newValue ?? "vacío"}`,
      action: AuditAction.updated,
    });

    // Immediate: stage_changed notification
    if (body.status && body.status !== stage.status) {
      const project = await prisma.project.findFirst({
        where: { id: params.projectId, deletedAt: null },
        select: { clientName: true },
      });
      if (project) {
        await createAndSendNotification({
          projectId: params.projectId,
          type: NotificationType.stage_changed,
          title: `Etapa actualizada: ${getStageLabel(stage.name)}`,
          message: `La etapa ${getStageLabel(stage.name)} cambió a ${formatStageStatus(body.status as StageStatus)}.`,
          context: {
            type: "stage_changed",
            projectName: project.clientName,
            stageName: getStageLabel(stage.name),
            oldStatus: formatStageStatus(stage.status),
            newStatus: formatStageStatus(body.status as StageStatus),
            changedBy: user.name,
          },
          deduplicate: false,
        });
      }
    }

    // Check progress milestones after stage status change
    const { projectProgressPercent } = await refreshStageProgressAndProject(stage.id, params.projectId);
    if (projectProgressPercent) {
      await checkProgressMilestone(params.projectId, projectProgressPercent);
    }

    return serializeStage(updatedStage);
  });

  app.get("/projects/:projectId/stages/:stageId/substages", { preHandler: authorize(Module.OPERACIONES, Action.VIEW) }, async (request) => {
    const params = z.object({ projectId: z.string(), stageId: z.string() }).parse(request.params);
    await findStageOrThrow(params.projectId, params.stageId);

    const substages = await prisma.substage.findMany({
      where: {
        projectId: params.projectId,
        stageId: params.stageId,
        deletedAt: null,
        isActive: true,
      },
      orderBy: { order: "asc" },
    });

    return substages.map(serializeSubstage);
  });

  app.post("/projects/:projectId/stages/:stageId/substages", { preHandler: authorize(Module.OPERACIONES, Action.EDIT) }, async (request, reply) => {
    const user = ensureUser(request);
    const params = z.object({ projectId: z.string(), stageId: z.string() }).parse(request.params);
    const body = substageCreateSchema.parse(request.body);
    const stage = await findStageOrThrow(params.projectId, params.stageId);

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
        sopCode: body.sopCode ?? null,
        responsableRol: body.responsableRol ?? null,
        status: SubstageStatus.PENDING,
        progressPercent: 0,
        responsible: body.responsible,
        userId: body.userId ?? null,
        dueDate: body.dueDate ? parseDateOnly(body.dueDate) : null,
        plannedStartDate: body.plannedStartDate ? parseDateOnly(body.plannedStartDate) : null,
        plannedEndDate: body.plannedEndDate ? parseDateOnly(body.plannedEndDate) : null,
        notes: body.notes ?? null,
        isSystem: false,
        isActive: true,
      },
    });

    await refreshStageProgressAndProject(params.stageId, params.projectId);

    await createAuditEntry({
      entityType: AuditEntityType.substage,
      entityId: substage.id,
      projectId: params.projectId,
      userId: user.id,
      action: AuditAction.created,
      description: `Creó subetapa '${substage.name}' en etapa ${getStageLabel(stage.name)}`,
    });

    reply.code(201);
    return serializeSubstage(substage);
  });

  app.patch("/projects/:projectId/stages/:stageId/substages/:substageId", { preHandler: authorize(Module.OPERACIONES, Action.EDIT) }, async (request) => {
    const user = ensureUser(request);
    const params = z
      .object({ projectId: z.string(), stageId: z.string(), substageId: z.string() })
      .parse(request.params);
    const body = substagePatchSchema.parse(request.body);
    const substage = await findSubstageOrThrow(params.projectId, params.stageId, params.substageId);
    const updateData: Record<string, unknown> = {};

    if (body.status === SubstageStatus.COMPLETED) {
      await authorize(Module.OPERACIONES, Action.COMPLETE)(request);
    }

    if (body.name !== undefined) updateData.name = body.name;
    if (body.sopCode !== undefined) updateData.sopCode = body.sopCode;
    if (body.responsableRol !== undefined) updateData.responsableRol = body.responsableRol;
    if (body.responsible !== undefined) updateData.responsible = body.responsible;
    if (body.userId !== undefined) updateData.userId = body.userId;
    if (body.dueDate !== undefined) updateData.dueDate = body.dueDate ? parseDateOnly(body.dueDate) : null;
    if (body.plannedStartDate !== undefined) updateData.plannedStartDate = body.plannedStartDate ? parseDateOnly(body.plannedStartDate) : null;
    if (body.plannedEndDate !== undefined) updateData.plannedEndDate = body.plannedEndDate ? parseDateOnly(body.plannedEndDate) : null;
    if (body.notes !== undefined) updateData.notes = body.notes;

    if (body.status && body.status !== substage.status) {
      updateData.status = body.status;
      if (body.status === SubstageStatus.IN_PROGRESS) {
        updateData.actualStartDate = substage.actualStartDate ?? todayUtc();
      }
      if (body.status === SubstageStatus.COMPLETED) {
        const actualEndDate = todayUtc();
        const actualStartDate = substage.actualStartDate ?? actualEndDate;
        const actualDurationDays = Math.max(0, diffInDays(actualStartDate, actualEndDate));
        const plannedDurationDays =
          substage.plannedStartDate && substage.plannedEndDate
            ? Math.max(0, diffInDays(substage.plannedStartDate, substage.plannedEndDate))
            : 0;

        updateData.actualEndDate = actualEndDate;
        updateData.actualStartDate = actualStartDate;
        updateData.actualDurationDays = actualDurationDays;
        updateData.delayDays = actualDurationDays - plannedDurationDays;
        updateData.progressPercent = 100;
      }
      if (body.status === SubstageStatus.BLOCKED) {
        const project = await prisma.project.findFirst({
          where: { id: params.projectId, deletedAt: null },
          select: { clientName: true },
        });
        const stageForNotif = await prisma.stage.findFirst({ where: { id: params.stageId } });
        if (project) {
          await createAndSendNotification({
            projectId: params.projectId,
            userId: substage.userId,
            type: NotificationType.substage_blocked,
            title: "Subetapa bloqueada",
            message: `La subetapa '${substage.name}' fue marcada como bloqueada.`,
            context: {
              type: "substage_blocked",
              projectName: project.clientName,
              stageName: stageForNotif?.name ?? "",
              substageName: substage.name,
              responsible: substage.responsible,
            },
            deduplicate: true,
          });
        }
      }
    }

    const updatedSubstage = await prisma.substage.update({
      where: { id: substage.id },
      data: updateData,
    });

    const syncedSubstage = await syncSubstageProgress(substage.id);
    const { syncedStage, projectProgressPercent } = await refreshStageProgressAndProject(params.stageId, params.projectId);

    // Check progress milestones after substage update
    if (projectProgressPercent) {
      await checkProgressMilestone(params.projectId, projectProgressPercent);
    }

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
      ...serializeSubstage(syncedSubstage ?? updatedSubstage),
      stageProgressPercent: syncedStage?.progressPercent ?? null,
    };
  });

  app.patch("/substages/:substageId/complete", { preHandler: authorize(Module.OPERACIONES, Action.COMPLETE) }, async (request) => {
    const user = ensureUser(request);
    const params = z.object({ substageId: z.string() }).parse(request.params);

    const substage = await prisma.substage.findFirst({
      where: {
        id: params.substageId,
        deletedAt: null,
      },
      include: {
        project: {
          select: {
            id: true,
            modalidadPago: true,
          },
        },
        stage: true,
        checklistItems: {
          where: {
            deletedAt: null,
            isRequired: true,
          },
          orderBy: { order: "asc" },
        },
      },
    });

    if (!substage) {
      throw notFound("SUBSTAGE_NOT_FOUND", "Subetapa no encontrada");
    }

    const pendingItems = substage.checklistItems.filter((item) => {
      if (!item.appliesWhenModalidadPago) {
        return !item.completed;
      }

      return item.appliesWhenModalidadPago === substage.project.modalidadPago && !item.completed;
    });

    if (pendingItems.length > 0) {
      throw new AppError(400, "CHECKLIST_INCOMPLETE", "Hay ítems requeridos sin completar", {
        pendingItems: pendingItems.map((item) => ({
          id: item.id,
          label: item.label,
        })),
      });
    }

    const actualEndDate = todayUtc();
    const actualStartDate = substage.actualStartDate ?? actualEndDate;
    const actualDurationDays = Math.max(0, diffInDays(actualStartDate, actualEndDate));
    const plannedDurationDays =
      substage.plannedStartDate && substage.plannedEndDate
        ? Math.max(0, diffInDays(substage.plannedStartDate, substage.plannedEndDate))
        : 0;

    const completedSubstage = await prisma.substage.update({
      where: { id: substage.id },
      data: {
        status: SubstageStatus.COMPLETED,
        actualStartDate,
        actualEndDate,
        actualDurationDays,
        delayDays: actualDurationDays - plannedDurationDays,
        progressPercent: 100,
      },
    });

    const syncedSubstage = await syncSubstageProgress(substage.id);
    const { syncedStage, projectProgressPercent } = await refreshStageProgressAndProject(substage.stageId, substage.projectId);

    await createAuditEntry({
      entityType: AuditEntityType.substage,
      entityId: substage.id,
      projectId: substage.projectId,
      userId: user.id,
      action: AuditAction.updated,
      fieldChanged: "status",
      oldValue: substage.status,
      newValue: SubstageStatus.COMPLETED,
      description: `Completó rápidamente la subetapa '${substage.name}'`,
    });

    // Check progress milestones after quick complete
    if (projectProgressPercent) {
      await checkProgressMilestone(substage.projectId, projectProgressPercent);
    }

    return {
      ...serializeSubstage(syncedSubstage ?? completedSubstage),
      stageProgressPercent: syncedStage?.progressPercent ?? null,
    };
  });

  app.patch("/projects/:projectId/stages/:stageId/substages/reorder", { preHandler: authorize(Module.OPERACIONES, Action.EDIT) }, async (request) => {
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

  app.delete("/projects/:projectId/stages/:stageId/substages/:substageId", { preHandler: authorize(Module.OPERACIONES, Action.EDIT) }, async (request) => {
    const user = ensureUser(request);
    const params = z
      .object({ projectId: z.string(), stageId: z.string(), substageId: z.string() })
      .parse(request.params);
    const substage = await findSubstageOrThrow(params.projectId, params.stageId, params.substageId);

    if (substage.isSystem) {
      throw conflict("SYSTEM_SUBSTAGE_PROTECTED", "No se pueden eliminar las subetapas predefinidas del sistema");
    }

    const deletedSubstage = await prisma.substage.update({
      where: { id: substage.id },
      data: { deletedAt: new Date() },
    });

    await refreshStageProgressAndProject(params.stageId, params.projectId);

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

  app.get("/projects/:projectId/stages/:stageId/substages/:substageId/checklist", { preHandler: authorize(Module.OPERACIONES, Action.VIEW) }, async (request) => {
    const params = z
      .object({ projectId: z.string(), stageId: z.string(), substageId: z.string() })
      .parse(request.params);
    const substage = await findSubstageOrThrow(params.projectId, params.stageId, params.substageId);

    const checklistItems = await prisma.checklistItem.findMany({
      where: {
        substageId: substage.id,
        projectId: params.projectId,
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
      orderBy: { order: "asc" },
    });

    return checklistItems.map((item) => ({
      ...serializeChecklistItem(item),
      completedByUser: item.user,
    }));
  });

  app.post("/projects/:projectId/stages/:stageId/substages/:substageId/checklist", { preHandler: authorize(Module.OPERACIONES, Action.EDIT) }, async (request, reply) => {
    const user = ensureUser(request);
    const params = z
      .object({ projectId: z.string(), stageId: z.string(), substageId: z.string() })
      .parse(request.params);
    const body = checklistCreateSchema.parse(request.body);
    const substage = await findSubstageOrThrow(params.projectId, params.stageId, params.substageId);

    const maxOrder = await prisma.checklistItem.aggregate({
      where: { substageId: substage.id },
      _max: { order: true },
    });

    const item = await prisma.checklistItem.create({
      data: {
        substageId: substage.id,
        projectId: params.projectId,
        order: (maxOrder._max.order ?? 0) + 1,
        label: body.label,
        notes: null,
        isRequired: false,
        isBlocker: body.isBlocker ?? false,
        isCustom: true,
      },
    });

    const syncedSubstage = await syncSubstageProgress(substage.id);
    const { syncedStage } = await refreshStageProgressAndProject(params.stageId, params.projectId);

    await createAuditEntry({
      entityType: AuditEntityType.substage,
      entityId: substage.id,
      projectId: params.projectId,
      userId: user.id,
      action: AuditAction.created,
      description: `Agregó ítem '${item.label}' al checklist de '${substage.name}'`,
    });

    reply.code(201);
    return {
      ...serializeChecklistItem(item),
      substageProgressPercent: syncedSubstage?.progressPercent ?? null,
      stageProgressPercent: syncedStage?.progressPercent ?? null,
    };
  });

  app.patch("/checklist/:itemId", { preHandler: authorize(Module.OPERACIONES, Action.EDIT) }, async (request) => {
    const user = ensureUser(request);
    const params = z.object({ itemId: z.string() }).parse(request.params);
    const body = checklistPatchSchema.parse(request.body);
    const item = await findChecklistItemOrThrow(params.itemId);

    if (body.isRequired !== undefined && user.role !== Role.ADMIN) {
      throw forbidden("No tenés permiso para realizar esta acción");
    }

    if (body.label !== undefined && !item.isCustom) {
      throw badRequest("SOP_ITEM_PROTECTED", "Los ítems del SOP no se pueden editar");
    }

    const updateData: Record<string, unknown> = {};

    if (body.completed !== undefined) {
      updateData.completed = body.completed;
      updateData.completedAt = body.completed ? new Date() : null;
      updateData.completedBy = body.completed ? user.id : null;
    }

    if (body.notes !== undefined) {
      updateData.notes = body.notes;
    }

    if (body.label !== undefined) {
      updateData.label = body.label;
    }

    if (body.isRequired !== undefined) {
      updateData.isRequired = body.isRequired;
    }

    const updatedItem = await prisma.checklistItem.update({
      where: { id: item.id },
      data: updateData,
      include: {
        user: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
      },
    });

    const syncedSubstage = await syncSubstageProgress(item.substageId);
    const { syncedStage } = await refreshStageProgressAndProject(item.substage.stageId, item.projectId);

    await createAuditEntriesForChanges({
      entityType: AuditEntityType.substage,
      entityId: item.substageId,
      projectId: item.projectId,
      userId: user.id,
      oldData: item,
      newData: {
        ...item,
        ...updateData,
        completed: updatedItem.completed,
        completedAt: updatedItem.completedAt,
        completedBy: updatedItem.completedBy,
        notes: updatedItem.notes,
        label: updatedItem.label,
        isRequired: updatedItem.isRequired,
      },
      labels: checklistFieldLabels,
      formatter: ({ field, oldValue, newValue }) =>
        field === "completed"
          ? `${body.completed ? "Marcó" : "Desmarcó"} ítem '${item.label}' del checklist de '${item.substage.name}'`
          : `Actualizó ítem '${item.label}' de ${oldValue ?? "vacío"} a ${newValue ?? "vacío"}`,
    });

    return {
      ...serializeChecklistItem(updatedItem),
      completedByUser: updatedItem.user,
      substageProgressPercent: syncedSubstage?.progressPercent ?? null,
      stageProgressPercent: syncedStage?.progressPercent ?? null,
    };
  });

  app.delete("/checklist/:itemId", { preHandler: authorize(Module.OPERACIONES, Action.EDIT) }, async (request) => {
    const user = ensureUser(request);
    const params = z.object({ itemId: z.string() }).parse(request.params);
    const item = await findChecklistItemOrThrow(params.itemId);

    if (!item.isCustom) {
      throw badRequest("SOP_ITEM_PROTECTED", "Los ítems del SOP no se pueden eliminar");
    }

    await prisma.checklistItem.delete({
      where: { id: item.id },
    });

    const syncedSubstage = await syncSubstageProgress(item.substageId);
    const { syncedStage } = await refreshStageProgressAndProject(item.substage.stageId, item.projectId);

    await createAuditEntry({
      entityType: AuditEntityType.substage,
      entityId: item.substageId,
      projectId: item.projectId,
      userId: user.id,
      action: AuditAction.deleted,
      description: `Eliminó ítem '${item.label}' del checklist de '${item.substage.name}'`,
    });

    return {
      success: true,
      substageProgressPercent: syncedSubstage?.progressPercent ?? null,
      stageProgressPercent: syncedStage?.progressPercent ?? null,
    };
  });

  app.get("/projects/:projectId/tasks", { preHandler: authorize(Module.OPERACIONES, Action.EDIT) }, async (request) => {
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

  app.post("/projects/:projectId/tasks", { preHandler: authorize(Module.OPERACIONES, Action.EDIT) }, async (request, reply) => {
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

  app.patch("/projects/:projectId/tasks/:taskId", { preHandler: authorize(Module.OPERACIONES, Action.EDIT) }, async (request) => {
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

  app.delete("/projects/:projectId/tasks/:taskId", { preHandler: authorize(Module.OPERACIONES, Action.EDIT) }, async (request) => {
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

  app.post("/projects/:projectId/files", { preHandler: authorize(Module.OPERACIONES, Action.EDIT) }, async (request, reply) => {
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

  app.get("/projects/:projectId/files", { preHandler: authorize(Module.OPERACIONES, Action.EDIT) }, async (request) => {
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

  app.get("/files/:fileId/download", { preHandler: authorize(Module.OPERACIONES, Action.EDIT) }, async (request, reply) => {
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

  app.delete("/files/:fileId", { preHandler: authorize(Module.OPERACIONES, Action.EDIT) }, async (request) => {
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

  app.get("/projects/:projectId/audit", { preHandler: authorize(Module.OPERACIONES, Action.VIEW) }, async (request) => {
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

  app.get("/audit/stats/:projectId", { preHandler: authorize(Module.METRICAS, Action.VIEW) }, async (request) => {
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

  app.get("/metrics/overview", { preHandler: authorize(Module.METRICAS, Action.VIEW) }, async (request) => {
    const query = z.object({
      year: z.coerce.number().int().optional(),
      quarter: z.coerce.number().int().min(1).max(4).optional(),
    }).parse(request.query);

    const now = new Date();
    const filterYear = query.year ?? now.getFullYear();
    const filterQuarter = query.quarter ?? undefined;

    const yearStart = new Date(filterYear, 0, 1);
    const yearEnd = new Date(filterYear + 1, 0, 1);
    let quarterStart: Date | undefined;
    let quarterEnd: Date | undefined;
    if (filterQuarter) {
      quarterStart = new Date(filterYear, (filterQuarter - 1) * 3, 1);
      quarterEnd = new Date(filterYear, filterQuarter * 3, 1);
    }

    const projects = await prisma.project.findMany({
      where: { deletedAt: null },
      include: { stages: { orderBy: { order: "asc" } } },
    });

    const metricsByProject = projects.map((project) => calculateProjectMetrics(project));
    const activeAndCompletedProjects = projects.filter(
      (project) => project.status === ProjectStatus.ACTIVE || project.status === ProjectStatus.COMPLETED,
    );

    // Period-filtered completed projects
    const completedInYear = projects.filter(
      (p) => p.status === ProjectStatus.COMPLETED && p.actualEndDate && p.actualEndDate >= yearStart && p.actualEndDate < yearEnd,
    );
    const completedInQuarter = filterQuarter
      ? projects.filter(
          (p) => p.status === ProjectStatus.COMPLETED && p.actualEndDate && quarterStart && quarterEnd && p.actualEndDate >= quarterStart && p.actualEndDate < quarterEnd,
        )
      : [];

    const installationsThisYear = completedInYear.length;
    const installationsThisQuarter = completedInQuarter.length;
    const kwpInstalledThisYear = Number(
      completedInYear.reduce((sum, p) => sum + (decimalToNumber(p.capacityKwp) ?? 0), 0).toFixed(2),
    );
    const kwpInstalledThisQuarter = Number(
      completedInQuarter.reduce((sum, p) => sum + (decimalToNumber(p.capacityKwp) ?? 0), 0).toFixed(2),
    );

    // avgDaysToScheduleFirstDate for year
    const withFirstDate = projects.filter(
      (p) => p.firstDateScheduledAt && p.createdAt >= yearStart && p.createdAt < yearEnd,
    );
    const avgDaysToScheduleFirstDate =
      withFirstDate.length > 0
        ? Number(
            (
              withFirstDate.reduce((sum, p) => sum + diffInDays(p.createdAt, p.firstDateScheduledAt!), 0) /
              withFirstDate.length
            ).toFixed(1),
          )
        : null;

    return {
      filterYear,
      filterQuarter: filterQuarter ?? null,
      totalProjects: projects.length,
      activeProjects: projects.filter((project) => project.status === ProjectStatus.ACTIVE).length,
      completedProjects: projects.filter((project) => project.status === ProjectStatus.COMPLETED).length,
      installationsThisYear,
      installationsThisQuarter,
      kwpInstalledThisYear,
      kwpInstalledThisQuarter,
      avgDaysToScheduleFirstDate,
      totalKwp: Number(
        projects.reduce((sum, project) => sum + (decimalToNumber(project.capacityKwp) ?? 0), 0).toFixed(2),
      ),
      totalMwhYear: Number(
        projects.reduce((sum, project) => sum + (decimalToNumber(project.estimatedMwhYear) ?? 0), 0).toFixed(2),
      ),
      totalCo2Tons: Number(
        activeAndCompletedProjects
          .reduce((sum, project) => sum + (decimalToNumber(project.co2TonsAvoided) ?? 0), 0)
          .toFixed(2),
      ),
      totalBudgetUsd: Number(
        projects.reduce((sum, project) => sum + (decimalToNumber(project.budgetUsd) ?? 0), 0).toFixed(2),
      ),
      totalExecutedUsd: Number(
        projects.reduce((sum, project) => sum + (decimalToNumber(project.executedUsd) ?? 0), 0).toFixed(2),
      ),
      avgProgressPercent:
        metricsByProject.length > 0
          ? Number(
              (metricsByProject.reduce((sum, m) => sum + m.progressPercent, 0) / metricsByProject.length).toFixed(2),
            )
          : 0,
      projectsWithDelay: metricsByProject.filter((m) => m.delayDays > 0).length,
      avgDelayDays:
        metricsByProject.length > 0
          ? Number((metricsByProject.reduce((sum, m) => sum + m.delayDays, 0) / metricsByProject.length).toFixed(2))
          : 0,
      avgTimeEfficiency:
        metricsByProject.length > 0
          ? Number((metricsByProject.reduce((sum, m) => sum + m.timeEfficiency, 0) / metricsByProject.length).toFixed(2))
          : 0,
    };
  });

  app.get("/metrics/stages", { preHandler: authorize(Module.METRICAS, Action.VIEW) }, async () => {
    const completedStages = await prisma.stage.findMany({
      where: {
        project: {
          deletedAt: null,
          status: ProjectStatus.COMPLETED,
        },
        status: StageStatus.COMPLETED,
      },
      orderBy: [{ order: "asc" }, { createdAt: "asc" }],
    });

    const grouped = new Map<StageType, typeof completedStages>();
    for (const stage of completedStages) {
      const bucket = grouped.get(stage.name) ?? [];
      bucket.push(stage);
      grouped.set(stage.name, bucket);
    }

    return (Object.values(StageType) as StageType[]).map((stageName) => {
      const items = grouped.get(stageName) ?? [];
      const completedCount = items.length;
      const avgPlannedDays =
        completedCount > 0
          ? Number((items.reduce((sum, stage) => sum + (stage.plannedDurationDays ?? 0), 0) / completedCount).toFixed(2))
          : 0;
      const avgActualDays =
        completedCount > 0
          ? Number((items.reduce((sum, stage) => sum + (stage.actualDurationDays ?? 0), 0) / completedCount).toFixed(2))
          : 0;
      const avgDelayDays =
        completedCount > 0
          ? Number((items.reduce((sum, stage) => sum + (stage.delayDays ?? 0), 0) / completedCount).toFixed(2))
          : 0;

      return {
        stageName,
        stageLabel: getStageLabel(stageName),
        avgPlannedDays,
        avgActualDays,
        avgDelayDays,
        completedCount,
      };
    });
  });

  app.get("/metrics/projects", { preHandler: authorize(Module.METRICAS, Action.VIEW) }, async () => {
    const projects = await prisma.project.findMany({
      where: { deletedAt: null },
      include: {
        stages: {
          orderBy: { order: "asc" },
        },
      },
    });

    return projects
      .map((project) => {
        const metrics = calculateProjectMetrics(project);

        return {
          id: project.id,
          code: project.code,
          clientName: project.clientName,
          capacityKwp: decimalToNumber(project.capacityKwp),
          status: project.status,
          progressPercent: metrics.progressPercent,
          delayDays: metrics.delayDays,
          timeEfficiency: metrics.timeEfficiency,
          daysElapsed: metrics.daysElapsed,
          daysRemaining: metrics.daysRemaining,
          budgetUsd: decimalToNumber(project.budgetUsd),
          executedUsd: decimalToNumber(project.executedUsd),
        };
      })
      .sort((a, b) => b.delayDays - a.delayDays);
  });

  app.get("/metrics/projects/:id/gantt", { preHandler: authorize(Module.METRICAS, Action.VIEW) }, async (request) => {
    const params = z.object({ id: z.string() }).parse(request.params);
    const project = await prisma.project.findFirst({
      where: {
        id: params.id,
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

    return {
      projectId: project.id,
      projectCode: project.code,
      projectName: project.clientName,
      stages: project.stages.map((stage) => ({
        id: stage.id,
        name: stage.name,
        label: getStageLabel(stage.name),
        plannedStart: serializeDateOnly(stage.plannedStartDate),
        plannedEnd: serializeDateOnly(stage.plannedEndDate),
        actualStart: serializeDateOnly(stage.actualStartDate),
        actualEnd: serializeDateOnly(stage.actualEndDate),
        status: stage.status,
        progressPercent: stage.progressPercent,
        delayDays: stage.delayDays,
      })),
    };
  });

  // ─── Metrics: Sales ────────────────────────────────────────────────────────

  app.get("/metrics/sales", { preHandler: authorize(Module.METRICAS, Action.VIEW) }, async (request) => {
    const query = z.object({
      year: z.coerce.number().int().optional(),
      quarter: z.coerce.number().int().min(1).max(4).optional(),
    }).parse(request.query);

    const now = new Date();
    const filterYear = query.year ?? now.getFullYear();
    const filterQuarter = query.quarter ?? undefined;

    const yearStart = new Date(filterYear, 0, 1);
    const yearEnd = new Date(filterYear + 1, 0, 1);
    let quarterStart: Date | undefined;
    let quarterEnd: Date | undefined;
    if (filterQuarter) {
      quarterStart = new Date(filterYear, (filterQuarter - 1) * 3, 1);
      quarterEnd = new Date(filterYear, filterQuarter * 3, 1);
    }

    // Week bounds
    const weekStart = new Date(now);
    weekStart.setDate(now.getDate() - now.getDay());
    weekStart.setHours(0, 0, 0, 0);
    const weekEnd = new Date(weekStart);
    weekEnd.setDate(weekStart.getDate() + 7);

    const leads = await prisma.salesLead.findMany({
      where: { deletedAt: null },
      select: {
        stage: true,
        createdAt: true,
        proposalSentAt: true,
        visitCompletedAt: true,
        closedAt: true,
      },
    });

    function inRange(date: Date | null, start: Date, end: Date): boolean {
      return date !== null && date >= start && date < end;
    }

    const leadsCreatedThisYear = leads.filter((l) => inRange(l.createdAt, yearStart, yearEnd)).length;
    const leadsCreatedThisQuarter = filterQuarter
      ? leads.filter((l) => inRange(l.createdAt, quarterStart!, quarterEnd!)).length : null;
    const leadsCreatedThisWeek = leads.filter((l) => inRange(l.createdAt, weekStart, weekEnd)).length;

    const proposalsSentThisYear = leads.filter((l) => inRange(l.proposalSentAt, yearStart, yearEnd)).length;
    const proposalsSentThisQuarter = filterQuarter
      ? leads.filter((l) => inRange(l.proposalSentAt, quarterStart!, quarterEnd!)).length : null;
    const proposalsSentThisWeek = leads.filter((l) => inRange(l.proposalSentAt, weekStart, weekEnd)).length;

    const closedWonThisYear = leads.filter((l) => l.stage === SalesStage.CERRADO_GANADO && inRange(l.closedAt, yearStart, yearEnd)).length;
    const closedWonThisQuarter = filterQuarter
      ? leads.filter((l) => l.stage === SalesStage.CERRADO_GANADO && inRange(l.closedAt, quarterStart!, quarterEnd!)).length : null;
    const closedWonThisWeek = leads.filter((l) => l.stage === SalesStage.CERRADO_GANADO && inRange(l.closedAt, weekStart, weekEnd)).length;

    const closedLostThisYear = leads.filter((l) => l.stage === SalesStage.CERRADO_PERDIDO && inRange(l.closedAt, yearStart, yearEnd)).length;
    const closedLostThisQuarter = filterQuarter
      ? leads.filter((l) => l.stage === SalesStage.CERRADO_PERDIDO && inRange(l.closedAt, quarterStart!, quarterEnd!)).length : null;

    const totalClosed = closedWonThisYear + closedLostThisYear;
    const conversionRate = totalClosed > 0 ? Number(((closedWonThisYear / totalClosed) * 100).toFixed(1)) : null;

    // Average pipeline times (only leads with both dates, filtered by year)
    function avgDays(
      items: typeof leads,
      fromFn: (l: typeof leads[0]) => Date | null,
      toFn: (l: typeof leads[0]) => Date | null,
      rangeStart: Date,
      rangeEnd: Date,
    ): number | null {
      const valid = items.filter((l) => {
        const from = fromFn(l);
        const to = toFn(l);
        return from && to && to >= from && inRange(to, rangeStart, rangeEnd);
      });
      if (valid.length === 0) return null;
      const total = valid.reduce((sum, l) => {
        const from = fromFn(l)!;
        const to = toFn(l)!;
        return sum + Math.round((to.getTime() - from.getTime()) / 86_400_000);
      }, 0);
      return Number((total / valid.length).toFixed(1));
    }

    const periodStart = filterQuarter ? quarterStart! : yearStart;
    const periodEnd = filterQuarter ? quarterEnd! : yearEnd;

    const avgLeadToProposal = avgDays(leads, (l) => l.createdAt, (l) => l.proposalSentAt, periodStart, periodEnd);
    const avgProposalToVisit = avgDays(leads, (l) => l.proposalSentAt, (l) => l.visitCompletedAt, periodStart, periodEnd);
    const avgVisitToClose = avgDays(leads, (l) => l.visitCompletedAt, (l) => l.closedAt, periodStart, periodEnd);
    const avgProposalToClose = avgDays(leads, (l) => l.proposalSentAt, (l) => l.closedAt, periodStart, periodEnd);

    // Goals for the period
    const goals = await prisma.goal.findMany({
      where: {
        area: GoalArea.VENTAS,
        year: filterYear,
        ...(filterQuarter
          ? { OR: [{ period: GoalPeriod.QUARTERLY, quarter: filterQuarter }, { period: GoalPeriod.ANNUAL }] }
          : { period: GoalPeriod.ANNUAL }),
      },
    });

    const actualValues: Record<string, number> = {
      [GoalMetric.LEADS_CREATED]: filterQuarter ? (leadsCreatedThisQuarter ?? 0) : leadsCreatedThisYear,
      [GoalMetric.PROPOSALS_SENT]: filterQuarter ? (proposalsSentThisQuarter ?? 0) : proposalsSentThisYear,
      [GoalMetric.CLOSED_WON]: filterQuarter ? (closedWonThisQuarter ?? 0) : closedWonThisYear,
    };

    // Simple on-track: elapsed fraction of period vs achievement fraction
    function isOnTrack(actual: number, target: number, pStart: Date, pEnd: Date): boolean {
      const totalMs = pEnd.getTime() - pStart.getTime();
      const elapsedMs = Math.min(now.getTime() - pStart.getTime(), totalMs);
      const elapsedFraction = totalMs > 0 ? elapsedMs / totalMs : 1;
      const achievedFraction = target > 0 ? actual / target : 0;
      return achievedFraction >= elapsedFraction;
    }

    const goalsData = goals.map((g) => {
      const metric = g.metric as GoalMetric;
      const target = Number(g.targetValue);
      const actual = actualValues[metric] ?? 0;
      const pStart = g.period === GoalPeriod.QUARTERLY ? (quarterStart ?? yearStart) : yearStart;
      const pEnd = g.period === GoalPeriod.QUARTERLY ? (quarterEnd ?? yearEnd) : yearEnd;
      return {
        id: g.id,
        metric,
        period: g.period,
        quarter: g.quarter,
        targetValue: target,
        actualValue: actual,
        percentAchieved: target > 0 ? Number(((actual / target) * 100).toFixed(1)) : null,
        onTrack: isOnTrack(actual, target, pStart, pEnd),
      };
    });

    return {
      filterYear,
      filterQuarter: filterQuarter ?? null,
      leadsCreatedThisYear,
      leadsCreatedThisQuarter,
      leadsCreatedThisWeek,
      proposalsSentThisYear,
      proposalsSentThisQuarter,
      proposalsSentThisWeek,
      closedWonThisYear,
      closedWonThisQuarter,
      closedWonThisWeek,
      closedLostThisYear,
      closedLostThisQuarter,
      conversionRate,
      avgLeadToProposal,
      avgProposalToVisit,
      avgVisitToClose,
      avgProposalToClose,
      goals: goalsData,
    };
  });

  // ─── Goals CRUD ─────────────────────────────────────────────────────────────

  app.get("/goals", { preHandler: authorize(Module.CONFIGURACION, Action.VIEW) }, async (request) => {
    const query = z.object({
      area: z.nativeEnum(GoalArea).optional(),
      year: z.coerce.number().int().optional(),
    }).parse(request.query);

    const goals = await prisma.goal.findMany({
      where: {
        ...(query.area ? { area: query.area } : {}),
        ...(query.year ? { year: query.year } : {}),
      },
      include: { createdBy: { select: { id: true, name: true } } },
      orderBy: [{ year: "desc" }, { area: "asc" }, { metric: "asc" }, { period: "asc" }, { quarter: "asc" }],
    });

    // Group by area
    const grouped: Record<string, typeof goals> = {};
    for (const g of goals) {
      const key = g.area;
      if (!grouped[key]) grouped[key] = [];
      grouped[key].push(g);
    }

    return grouped;
  });

  const goalUpsertSchema = z.object({
    area: z.nativeEnum(GoalArea),
    metric: z.nativeEnum(GoalMetric),
    period: z.nativeEnum(GoalPeriod),
    year: z.number().int().min(2020).max(2099),
    quarter: z.number().int().min(1).max(4).nullable().optional(),
    targetValue: z.number().positive(),
  });

  app.post("/goals", { preHandler: authorize(Module.CONFIGURACION, Action.CREATE) }, async (request, reply) => {
    const user = ensureUser(request);
    const body = goalUpsertSchema.parse(request.body);
    const quarter = body.quarter ?? null;

    const existing = await prisma.goal.findFirst({
      where: { area: body.area, metric: body.metric, period: body.period, year: body.year, quarter },
    });

    const goal = existing
      ? await prisma.goal.update({
          where: { id: existing.id },
          data: { targetValue: new Prisma.Decimal(body.targetValue) },
        })
      : await prisma.goal.create({
          data: {
            area: body.area,
            metric: body.metric,
            period: body.period,
            year: body.year,
            quarter,
            targetValue: new Prisma.Decimal(body.targetValue),
            createdById: user.id,
          },
        });

    await createAuditEntry({
      entityType: AuditEntityType.project,
      entityId: goal.id,
      projectId: null,
      userId: user.id,
      action: AuditAction.updated,
      description: `Objetivo configurado: ${goal.area} / ${goal.metric} / ${goal.period} ${goal.year}${goal.quarter ? ` Q${goal.quarter}` : ""} → ${body.targetValue}`,
    });

    reply.code(201);
    return goal;
  });

  app.delete("/goals/:id", { preHandler: authorize(Module.CONFIGURACION, Action.DELETE) }, async (request, reply) => {
    const user = ensureUser(request);
    const { id } = z.object({ id: z.string() }).parse(request.params);

    const goal = await prisma.goal.findFirst({ where: { id } });
    if (!goal) throw notFound("GOAL_NOT_FOUND", "Objetivo no encontrado");

    await prisma.goal.delete({ where: { id } });

    await createAuditEntry({
      entityType: AuditEntityType.project,
      entityId: id,
      projectId: null,
      userId: user.id,
      action: AuditAction.deleted,
      description: `Objetivo eliminado: ${goal.area} / ${goal.metric} / ${goal.period} ${goal.year}${goal.quarter ? ` Q${goal.quarter}` : ""}`,
    });

    reply.code(204).send();
  });

  app.get("/notifications", { preHandler: authorize(Module.OPERACIONES, Action.VIEW) }, async (request, reply) => {
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

  app.patch("/notifications/:id/read", { preHandler: authorize(Module.OPERACIONES, Action.VIEW) }, async (request) => {
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

  app.patch("/notifications/read-all", { preHandler: authorize(Module.OPERACIONES, Action.VIEW) }, async (request) => {
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

  app.get("/users/me", async (request) => {
    const user = ensureUser(request);

    const permissions = await prisma.permission.findMany({
      where: {
        role: user.role,
      },
      select: {
        module: true,
        action: true,
      },
      orderBy: [{ module: "asc" }, { action: "asc" }],
    });

    return {
      id: user.id,
      name: user.name,
      email: user.email,
      role: user.role,
      permissions: groupPermissionsByModule(permissions),
    };
  });

  app.patch("/users/me", async (request) => {
    const user = ensureUser(request);
    const body = z.object({
      name: z.string().min(1).optional(),
      email: z.string().email().optional(),
    }).strict().parse(request.body);

    const existingUser = await prisma.user.findFirst({
      where: { id: user.id, deletedAt: null },
    });
    if (!existingUser) throw notFound("USER_NOT_FOUND", "Usuario no encontrado");

    const updatedUser = await prisma.user.update({
      where: { id: user.id },
      data: {
        ...(body.name !== undefined && { name: body.name }),
        ...(body.email !== undefined && { email: body.email }),
      },
      select: { id: true, name: true, email: true, role: true, createdAt: true },
    });

    if (body.name !== undefined && body.name !== existingUser.name) {
      await createAuditEntry({
        entityType: AuditEntityType.user,
        entityId: user.id,
        userId: user.id,
        action: AuditAction.updated,
        fieldChanged: "name",
        oldValue: existingUser.name,
        newValue: body.name,
        description: `Actualizó su propio nombre a '${body.name}'`,
      });
    }
    if (body.email !== undefined && body.email !== existingUser.email) {
      await createAuditEntry({
        entityType: AuditEntityType.user,
        entityId: user.id,
        userId: user.id,
        action: AuditAction.updated,
        fieldChanged: "email",
        oldValue: existingUser.email,
        newValue: body.email,
        description: `Actualizó su propio email`,
      });
    }

    return serializeUserSummary(updatedUser);
  });

  app.get("/users", { preHandler: authorize(Module.USUARIOS, Action.VIEW) }, async () => {
    const users = await prisma.user.findMany({
      where: {
        deletedAt: null,
      },
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        createdAt: true,
      },
      orderBy: { createdAt: "desc" },
    });

    return users.map(serializeUserSummary);
  });

  app.post("/users", { preHandler: authorize(Module.USUARIOS, Action.CREATE) }, async (request, reply) => {
    const currentUser = ensureUser(request);
    const body = userCreateSchema.parse(request.body);

    const hashedPassword = await bcrypt.hash(body.password, 10);
    const user = await prisma.user.create({
      data: {
        name: body.name,
        email: body.email,
        password: hashedPassword,
        role: body.role,
      },
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        createdAt: true,
      },
    });

    await createAuditEntry({
      entityType: AuditEntityType.user,
      entityId: user.id,
      userId: currentUser.id,
      action: AuditAction.created,
      description: `Creó usuario '${user.name}' con rol ${user.role}`,
    });

    reply.code(201);
    return serializeUserSummary(user);
  });

  app.patch("/users/:id", { preHandler: authorize(Module.USUARIOS, Action.EDIT) }, async (request) => {
    const currentUser = ensureUser(request);
    const params = z.object({ id: z.string() }).parse(request.params);
    const body = userPatchSchema.parse(request.body);

    const existingUser = await prisma.user.findFirst({
      where: {
        id: params.id,
        deletedAt: null,
      },
    });

    if (!existingUser) {
      throw notFound("USER_NOT_FOUND", "Usuario no encontrado");
    }

    const updatedUser = await prisma.user.update({
      where: { id: existingUser.id },
      data: {
        ...(body.name !== undefined && { name: body.name }),
        ...(body.email !== undefined && { email: body.email }),
        ...(body.role !== undefined && { role: body.role }),
      },
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        createdAt: true,
      },
    });

    if (body.name !== undefined && body.name !== existingUser.name) {
      await createAuditEntry({
        entityType: AuditEntityType.user,
        entityId: existingUser.id,
        userId: currentUser.id,
        action: AuditAction.updated,
        fieldChanged: "name",
        oldValue: existingUser.name,
        newValue: body.name,
        description: `Actualizó nombre del usuario '${existingUser.name}' a '${body.name}'`,
      });
    }

    if (body.email !== undefined && body.email !== existingUser.email) {
      await createAuditEntry({
        entityType: AuditEntityType.user,
        entityId: existingUser.id,
        userId: currentUser.id,
        action: AuditAction.updated,
        fieldChanged: "email",
        oldValue: existingUser.email,
        newValue: body.email,
        description: `Actualizó email del usuario '${existingUser.name}'`,
      });
    }

    if (body.role !== undefined && body.role !== existingUser.role) {
      await createAuditEntry({
        entityType: AuditEntityType.user,
        entityId: existingUser.id,
        userId: currentUser.id,
        action: AuditAction.role_changed,
        fieldChanged: "role",
        oldValue: existingUser.role,
        newValue: body.role,
        description: `Cambió rol del usuario '${existingUser.name}' de ${existingUser.role} a ${body.role}`,
      });
    }

    return serializeUserSummary(updatedUser);
  });

  app.patch("/users/:id/password", async (request) => {
    const currentUser = ensureUser(request);
    const params = z.object({ id: z.string() }).parse(request.params);
    const body = userPasswordPatchSchema.parse(request.body);

    const targetUser = await prisma.user.findFirst({
      where: {
        id: params.id,
        deletedAt: null,
      },
    });

    if (!targetUser) {
      throw notFound("USER_NOT_FOUND", "Usuario no encontrado");
    }

    const isSelf = currentUser.id === targetUser.id;
    const isAdmin = currentUser.role === Role.ADMIN;

    if (!isSelf && !isAdmin) {
      throw forbidden("No tenés permiso para realizar esta acción");
    }

    if (isSelf && !isAdmin) {
      if (!body.currentPassword) {
        throw badRequest("CURRENT_PASSWORD_REQUIRED", "Debés ingresar tu contraseña actual");
      }

      const matchesCurrentPassword = await bcrypt.compare(body.currentPassword, targetUser.password);
      if (!matchesCurrentPassword) {
        throw badRequest("INVALID_CURRENT_PASSWORD", "La contraseña actual no es correcta");
      }
    }

    const newPasswordHash = await bcrypt.hash(body.newPassword, 10);
    await prisma.user.update({
      where: { id: targetUser.id },
      data: {
        password: newPasswordHash,
      },
    });

    await createAuditEntry({
      entityType: AuditEntityType.user,
      entityId: targetUser.id,
      userId: currentUser.id,
      action: AuditAction.updated,
      fieldChanged: "password",
      description: `Actualizó contraseña del usuario '${targetUser.name}'`,
    });

    return { success: true };
  });

  app.delete("/users/:id", { preHandler: authorize(Module.USUARIOS, Action.DELETE) }, async (request) => {
    const currentUser = ensureUser(request);
    const params = z.object({ id: z.string() }).parse(request.params);

    const targetUser = await prisma.user.findFirst({
      where: {
        id: params.id,
        deletedAt: null,
      },
    });

    if (!targetUser) {
      throw notFound("USER_NOT_FOUND", "Usuario no encontrado");
    }

    if (targetUser.role === Role.ADMIN) {
      const activeAdmins = await prisma.user.count({
        where: {
          role: Role.ADMIN,
          deletedAt: null,
        },
      });

      if (activeAdmins <= 1) {
        throw conflict("LAST_ADMIN", "No podés eliminar el único administrador");
      }
    }

    await prisma.user.update({
      where: { id: targetUser.id },
      data: {
        deletedAt: new Date(),
      },
    });

    await createAuditEntry({
      entityType: AuditEntityType.user,
      entityId: targetUser.id,
      userId: currentUser.id,
      action: AuditAction.deleted,
      description: `Eliminó lógicamente al usuario '${targetUser.name}'`,
    });

    return { success: true };
  });

  app.get("/settings", async (request) => {
    const user = ensureUser(request);
    const query = z
      .object({
        projectId: z.string().optional(),
      })
      .parse(request.query);

    if (query.projectId) {
      await findProjectOrThrow(query.projectId);
    }

    return resolveSettings({
      userId: user.id,
      projectId: query.projectId ?? null,
    });
  });

  app.get("/settings/system", { preHandler: authorize(Module.CONFIGURACION, Action.VIEW) }, async () => {
    const settings = await prisma.setting.findMany({
      where: {
        level: SettingLevel.SYSTEM,
      },
      orderBy: [{ key: "asc" }],
    });

    return settings.map(serializeSettingEntry);
  });

  app.patch("/settings/system", { preHandler: authorize(Module.CONFIGURACION, Action.EDIT) }, async (request) => {
    const user = ensureUser(request);
    const body = settingsPatchSchema.parse(request.body);

    const updatedSettings = await Promise.all(
      body.map(async ({ key, value }) => {
        const { previousValue, setting } = await upsertSetting({
          level: SettingLevel.SYSTEM,
          key,
          value,
          updatedById: user.id,
        });

        await createAuditEntry({
          entityType: AuditEntityType.setting,
          entityId: setting.id,
          userId: user.id,
          action: AuditAction.setting_changed,
          fieldChanged: key,
          oldValue: previousValue,
          newValue: value,
          description:
            previousValue === null
              ? `Creó configuración del sistema '${key}' con valor '${value}'`
              : `Actualizó configuración del sistema '${key}' de '${previousValue}' a '${value}'`,
        });

        return setting;
      }),
    );

    return updatedSettings.map(serializeSettingEntry);
  });

  app.get(
    "/settings/project/:projectId",
    { preHandler: authorize(Module.CONFIGURACION, Action.VIEW) },
    async (request) => {
      const params = z.object({ projectId: z.string() }).parse(request.params);
      await findProjectOrThrow(params.projectId);

      const settings = await prisma.setting.findMany({
        where: {
          level: SettingLevel.PROJECT,
          projectId: params.projectId,
        },
        orderBy: [{ key: "asc" }],
      });

      return settings.map(serializeSettingEntry);
    },
  );

  app.patch(
    "/settings/project/:projectId",
    { preHandler: authorize(Module.CONFIGURACION, Action.EDIT) },
    async (request) => {
      const user = ensureUser(request);
      const params = z.object({ projectId: z.string() }).parse(request.params);
      const body = settingsPatchSchema.parse(request.body);
      const project = await findProjectOrThrow(params.projectId);

      const updatedSettings = await Promise.all(
        body.map(async ({ key, value }) => {
          const { previousValue, setting } = await upsertSetting({
            level: SettingLevel.PROJECT,
            key,
            value,
            updatedById: user.id,
            projectId: params.projectId,
          });

          await createAuditEntry({
            entityType: AuditEntityType.setting,
            entityId: setting.id,
            projectId: params.projectId,
            userId: user.id,
            action: AuditAction.setting_changed,
            fieldChanged: key,
            oldValue: previousValue,
            newValue: value,
            description:
              previousValue === null
                ? `Creó configuración '${key}' para el proyecto '${project.clientName}' con valor '${value}'`
                : `Actualizó configuración '${key}' del proyecto '${project.clientName}' de '${previousValue}' a '${value}'`,
          });

          return setting;
        }),
      );

      return updatedSettings.map(serializeSettingEntry);
    },
  );

  app.get("/settings/user/me", async (request) => {
    const user = ensureUser(request);
    const settings = await prisma.setting.findMany({
      where: {
        level: SettingLevel.USER,
        userId: user.id,
      },
      orderBy: [{ key: "asc" }],
    });

    return settings.map(serializeSettingEntry);
  });

  app.patch("/settings/user/me", async (request) => {
    const user = ensureUser(request);
    const body = settingsPatchSchema.parse(request.body);

    const updatedSettings = await Promise.all(
      body.map(async ({ key, value }) => {
        const { previousValue, setting } = await upsertSetting({
          level: SettingLevel.USER,
          key,
          value,
          updatedById: user.id,
          userId: user.id,
        });

        await createAuditEntry({
          entityType: AuditEntityType.setting,
          entityId: setting.id,
          userId: user.id,
          action: AuditAction.setting_changed,
          fieldChanged: key,
          oldValue: previousValue,
          newValue: value,
          description:
            previousValue === null
              ? `Creó preferencia personal '${key}' con valor '${value}'`
              : `Actualizó preferencia personal '${key}' de '${previousValue}' a '${value}'`,
        });

        return setting;
      }),
    );

    return updatedSettings.map(serializeSettingEntry);
  });

  app.post("/comments", async (request, reply) => {
    const user = ensureUser(request);
    const body = commentCreateSchema.parse(request.body);
    const lead = body.leadId
      ? await prisma.salesLead.findFirst({
          where: {
            id: body.leadId,
            deletedAt: null,
          },
        })
      : null;
    const project = body.projectId ? await findProjectOrThrow(body.projectId) : null;

    if (body.leadId && !lead) {
      throw notFound("LEAD_NOT_FOUND", "Lead no encontrado");
    }

    if (body.stageId) {
      if (!body.projectId) {
        throw badRequest("PROJECT_REQUIRED", "Debés indicar projectId para comentar una etapa");
      }
      await findStageOrThrow(body.projectId, body.stageId);
    }

    if (body.substageId) {
      if (!body.projectId) {
        throw badRequest("PROJECT_REQUIRED", "Debés indicar projectId para comentar una subetapa");
      }
      const substage = await prisma.substage.findFirst({
        where: {
          id: body.substageId,
          projectId: body.projectId,
          deletedAt: null,
        },
      });

      if (!substage) {
        throw notFound("SUBSTAGE_NOT_FOUND", "Subetapa no encontrada");
      }

      if (body.stageId && substage.stageId !== body.stageId) {
        throw badRequest("SUBSTAGE_STAGE_MISMATCH", "La subetapa no pertenece a la etapa indicada");
      }
    }

    if (body.checklistItemId) {
      if (!body.projectId) {
        throw badRequest("PROJECT_REQUIRED", "Debés indicar projectId para comentar un checklist");
      }
      const checklistItem = await prisma.checklistItem.findFirst({
        where: {
          id: body.checklistItemId,
          projectId: body.projectId,
        },
        include: {
          substage: true,
        },
      });

      if (!checklistItem) {
        throw notFound("CHECKLIST_ITEM_NOT_FOUND", "Ítem de checklist no encontrado");
      }

      if (body.substageId && checklistItem.substageId !== body.substageId) {
        throw badRequest("CHECKLIST_SUBSTAGE_MISMATCH", "El ítem no pertenece a la subetapa indicada");
      }
    }

    if (body.taskId) {
      if (!body.projectId) {
        throw badRequest("PROJECT_REQUIRED", "Debés indicar projectId para comentar una tarea");
      }
      const task = await prisma.task.findFirst({
        where: {
          id: body.taskId,
          projectId: body.projectId,
          deletedAt: null,
        },
      });

      if (!task) {
        throw notFound("TASK_NOT_FOUND", "Tarea no encontrada");
      }
    }

    const comment = await prisma.comment.create({
      data: {
        content: body.content,
        authorId: user.id,
        projectId: body.projectId ?? (lead?.convertedToProjectId ?? null),
        leadId: body.leadId ?? null,
        stageId: body.stageId ?? null,
        substageId: body.substageId ?? null,
        checklistItemId: body.checklistItemId ?? null,
        taskId: body.taskId ?? null,
      },
      include: {
        author: {
          select: {
            id: true,
            name: true,
          },
        },
      },
    });

    await createAuditEntry({
      entityType: AuditEntityType.comment,
      entityId: comment.id,
      projectId: comment.projectId,
      userId: user.id,
      action: AuditAction.comment_added,
      description:
        project
          ? `Agregó un comentario en el proyecto '${project.clientName}'`
          : `Agregó un comentario en el lead '${lead?.clientName ?? body.leadId}'`,
      metadata: {
        leadId: body.leadId ?? null,
        stageId: body.stageId ?? null,
        substageId: body.substageId ?? null,
        checklistItemId: body.checklistItemId ?? null,
        taskId: body.taskId ?? null,
      },
    });

    reply.code(201);
    return serializeComment(comment);
  });

  app.get("/projects/:projectId/comments", async (request) => {
    const params = z.object({ projectId: z.string() }).parse(request.params);
    const query = z
      .object({
        page: z.coerce.number().int().positive().default(1),
        limit: z.coerce.number().int().positive().max(100).default(30),
        stageId: z.string().optional(),
        substageId: z.string().optional(),
      })
      .parse(request.query);

    await findProjectOrThrow(params.projectId);

    if (query.stageId) {
      await findStageOrThrow(params.projectId, query.stageId);
    }

    if (query.substageId) {
      const substage = await prisma.substage.findFirst({
        where: {
          id: query.substageId,
          projectId: params.projectId,
          deletedAt: null,
        },
      });

      if (!substage) {
        throw notFound("SUBSTAGE_NOT_FOUND", "Subetapa no encontrada");
      }
    }

    const comments = await prisma.comment.findMany({
      where: {
        projectId: params.projectId,
        deletedAt: null,
        ...(query.stageId
          ? {
              OR: [
                { stageId: query.stageId },
                { substage: { stageId: query.stageId } },
                { checklistItem: { substage: { stageId: query.stageId } } },
              ],
            }
          : {}),
        ...(query.substageId
          ? {
              OR: [
                { substageId: query.substageId },
                { checklistItem: { substageId: query.substageId } },
              ],
            }
          : {}),
      },
      include: {
        author: {
          select: {
            id: true,
            name: true,
          },
        },
      },
      orderBy: { createdAt: "desc" },
      skip: (query.page - 1) * query.limit,
      take: query.limit,
    });

    return comments.map(serializeComment);
  });

  app.get("/substages/:substageId/comments", async (request) => {
    const params = z.object({ substageId: z.string() }).parse(request.params);
    const substage = await prisma.substage.findFirst({
      where: {
        id: params.substageId,
        deletedAt: null,
      },
    });

    if (!substage) {
      throw notFound("SUBSTAGE_NOT_FOUND", "Subetapa no encontrada");
    }

    const comments = await prisma.comment.findMany({
      where: {
        projectId: substage.projectId,
        deletedAt: null,
        OR: [
          { substageId: substage.id },
          { checklistItem: { substageId: substage.id } },
        ],
      },
      include: {
        author: {
          select: {
            id: true,
            name: true,
          },
        },
      },
      orderBy: { createdAt: "desc" },
    });

    return comments.map(serializeComment);
  });

  app.patch("/comments/:id", async (request) => {
    const user = ensureUser(request);
    const params = z.object({ id: z.string() }).parse(request.params);
    const body = commentPatchSchema.parse(request.body);
    const existingComment = await findCommentOrThrow(params.id);

    if (existingComment.authorId !== user.id && user.role !== Role.ADMIN) {
      throw forbidden("No tenés permiso para realizar esta acción");
    }

    const updatedComment = await prisma.comment.update({
      where: { id: existingComment.id },
      data: {
        content: body.content,
        isEdited: true,
        editedAt: new Date(),
      },
      include: {
        author: {
          select: {
            id: true,
            name: true,
          },
        },
      },
    });

    await createAuditEntry({
      entityType: AuditEntityType.comment,
      entityId: existingComment.id,
      projectId: existingComment.projectId,
      userId: user.id,
      action: AuditAction.comment_edited,
      oldValue: existingComment.content,
      newValue: body.content,
      description: "Editó un comentario",
    });

    return serializeComment(updatedComment);
  });

  app.delete("/comments/:id", async (request) => {
    const user = ensureUser(request);
    const params = z.object({ id: z.string() }).parse(request.params);
    const existingComment = await findCommentOrThrow(params.id);

    if (existingComment.authorId !== user.id && user.role !== Role.ADMIN) {
      throw forbidden("No tenés permiso para realizar esta acción");
    }

    await prisma.comment.update({
      where: { id: existingComment.id },
      data: {
        deletedAt: new Date(),
      },
    });

    await createAuditEntry({
      entityType: AuditEntityType.comment,
      entityId: existingComment.id,
      projectId: existingComment.projectId,
      userId: user.id,
      action: AuditAction.comment_deleted,
      oldValue: existingComment.content,
      description: "Eliminó lógicamente un comentario",
    });

    return { success: true };
  });

  // ─── Sales Leads ─────────────────────────────────────────────────────────────

  const leadCreateSchema = z.object({
    clientName: z.string().min(1),
    clientEmail: z.string().email().optional().nullable(),
    clientPhone: z.string().optional().nullable(),
    address: z.string().optional().nullable(),
    estimatedKwp: z.coerce.number().positive().optional().nullable(),
    estimatedBudgetUsd: z.coerce.number().positive().optional().nullable(),
    uteBillMonthlyUsd: z.coerce.number().positive().optional().nullable(),
    roofType: z.string().optional().nullable(),
    notes: z.string().optional().nullable(),
    assignedToId: z.string().optional().nullable(),
  });

  const leadPatchSchema = z.object({
    clientName: z.string().min(1).optional(),
    clientEmail: z.string().email().optional().nullable(),
    clientPhone: z.string().optional().nullable(),
    address: z.string().optional().nullable(),
    estimatedKwp: z.coerce.number().positive().optional().nullable(),
    estimatedBudgetUsd: z.coerce.number().positive().optional().nullable(),
    uteBillMonthlyUsd: z.coerce.number().positive().optional().nullable(),
    roofType: z.string().optional().nullable(),
    notes: z.string().optional().nullable(),
    assignedToId: z.string().optional().nullable(),
    proposalSentAt: z.string().datetime({ offset: true }).optional().nullable(),
    visitScheduledAt: z.string().datetime({ offset: true }).optional().nullable(),
    visitCompletedAt: z.string().datetime({ offset: true }).optional().nullable(),
    closedAt: z.string().datetime({ offset: true }).optional().nullable(),
  });

  const leadStagePatchSchema = z
    .object({
      stage: z.nativeEnum(SalesStage),
      notes: z.string().optional().nullable(),
      lostReason: z.string().optional().nullable(),
    })
    .strict();

  // GET /api/leads
  app.get("/leads", { preHandler: authorize(Module.VENTAS, Action.VIEW) }, async (request) => {
    const user = ensureUser(request);
    const query = z
      .object({
        assignedTo: z.enum(["me"]).optional(),
        search: z.string().trim().optional(),
        page: z.coerce.number().int().positive().optional(),
        limit: z.coerce.number().int().positive().max(100).optional(),
      })
      .parse(request.query);

    const where = {
      deletedAt: null,
      ...(query.assignedTo === "me" ? { assignedToId: user.id } : {}),
      ...(query.search
        ? {
            clientName: {
              contains: query.search,
              mode: "insensitive" as const,
            },
          }
        : {}),
    };

    const leads = await prisma.salesLead.findMany({
      where,
      orderBy: [{ stage: "asc" }, { createdAt: "desc" }],
      include: {
        assignedTo: { select: { id: true, name: true } },
        activities: {
          orderBy: { createdAt: "desc" },
          take: 1,
        },
      },
      ...(query.page || query.limit
        ? {
            skip: ((query.page ?? 1) - 1) * (query.limit ?? 20),
            take: query.limit ?? 20,
          }
        : {}),
    });

    const groups = Object.values(SalesStage).map((stage) => {
      const stageLeads = leads
        .filter((lead) => lead.stage === stage)
        .map((lead) => {
          const latestActivityDate = lead.activities[0]?.createdAt ?? lead.createdAt;
          return {
            id: lead.id,
            code: lead.code,
            clientName: lead.clientName,
            stage: lead.stage,
            estimatedKwp: lead.estimatedKwp ? decimalToNumber(lead.estimatedKwp) : null,
            estimatedBudgetUsd: lead.estimatedBudgetUsd ? decimalToNumber(lead.estimatedBudgetUsd) : null,
            assignedTo: lead.assignedTo,
            daysInStage: Math.max(0, diffInDays(latestActivityDate, new Date())),
          };
        });

      return {
        stage,
        count: stageLeads.length,
        leads: stageLeads,
      };
    });

    if (query.page || query.limit) {
      const total = await prisma.salesLead.count({ where });
      const page = query.page ?? 1;
      const limit = query.limit ?? 20;

      return {
        data: groups,
        total,
        page,
        limit,
        totalPages: Math.max(1, Math.ceil(total / limit)),
      };
    }

    return groups;
  });

  // GET /api/leads/:id
  app.get("/leads/:id", { preHandler: authorize(Module.VENTAS, Action.VIEW) }, async (request) => {
    const { id } = request.params as { id: string };

    const lead = await prisma.salesLead.findFirst({
      where: { id, deletedAt: null },
      include: {
        assignedTo: { select: { id: true, name: true } },
        activities: {
          orderBy: { createdAt: "desc" },
          include: { user: { select: { id: true, name: true } } },
        },
        convertedToProject: { select: { id: true, code: true, clientName: true } },
        proposals: {
          orderBy: { createdAt: "desc" },
        },
        comments: {
          where: { deletedAt: null },
          orderBy: { createdAt: "desc" },
          include: {
            author: {
              select: { id: true, name: true },
            },
          },
        },
      },
    });

    if (!lead) throw notFound("LEAD_NOT_FOUND", "Lead no encontrado");

    return {
      id: lead.id,
      code: lead.code,
      clientName: lead.clientName,
      clientEmail: lead.clientEmail,
      clientPhone: lead.clientPhone,
      address: lead.address,
      stage: lead.stage,
      estimatedKwp: lead.estimatedKwp ? decimalToNumber(lead.estimatedKwp) : null,
      estimatedBudgetUsd: lead.estimatedBudgetUsd ? decimalToNumber(lead.estimatedBudgetUsd) : null,
      uteBillMonthlyUsd: lead.uteBillMonthlyUsd ? decimalToNumber(lead.uteBillMonthlyUsd) : null,
      roofType: lead.roofType,
      notes: lead.notes,
      lostReason: lead.lostReason,
      proposalSentAt: lead.proposalSentAt ? serializeDate(lead.proposalSentAt) : null,
      visitScheduledAt: lead.visitScheduledAt ? serializeDate(lead.visitScheduledAt) : null,
      visitCompletedAt: lead.visitCompletedAt ? serializeDate(lead.visitCompletedAt) : null,
      closedAt: lead.closedAt ? serializeDate(lead.closedAt) : null,
      assignedTo: lead.assignedTo,
      convertedToProject: lead.convertedToProject,
      convertedAt: lead.convertedAt,
      comments: lead.comments.map(serializeComment),
      activities: lead.activities.map((a) => ({
        id: a.id,
        action: a.action,
        notes: a.notes,
        fromStage: a.fromStage,
        toStage: a.toStage,
        user: a.user,
        createdAt: serializeDate(a.createdAt),
      })),
      proposals: lead.proposals.map((proposal) => ({
        id: proposal.id,
        status: proposal.status,
        inputFilePath: proposal.inputFilePath,
        outputFilePath: proposal.outputFilePath,
        errorMessage: proposal.errorMessage,
        createdAt: serializeDate(proposal.createdAt),
        updatedAt: serializeDate(proposal.updatedAt),
      })),
      createdAt: serializeDate(lead.createdAt),
      updatedAt: serializeDate(lead.updatedAt),
    };
  });

  // POST /api/leads
  app.post("/leads", { preHandler: authorize(Module.VENTAS, Action.CREATE) }, async (request) => {
    const user = ensureUser(request);
    const body = leadCreateSchema.parse(request.body);
    const code = await generateLeadCode();

    const lead = await prisma.salesLead.create({
      data: {
        code,
        clientName: body.clientName,
        clientEmail: body.clientEmail ?? null,
        clientPhone: body.clientPhone ?? null,
        address: body.address ?? null,
        estimatedKwp: body.estimatedKwp ? new Prisma.Decimal(body.estimatedKwp) : null,
        estimatedBudgetUsd: body.estimatedBudgetUsd ? new Prisma.Decimal(body.estimatedBudgetUsd) : null,
        uteBillMonthlyUsd: body.uteBillMonthlyUsd ? new Prisma.Decimal(body.uteBillMonthlyUsd) : null,
        roofType: body.roofType ?? null,
        notes: body.notes ?? null,
        assignedToId: body.assignedToId ?? null,
        createdById: user.id,
      },
    });

    await prisma.salesActivity.create({
      data: {
        leadId: lead.id,
        userId: user.id,
        toStage: lead.stage,
        action: "lead_created",
        notes: `Lead creado por ${user.name}`,
      },
    });

    await createAuditEntry({
      entityType: AuditEntityType.lead,
      entityId: lead.id,
      userId: user.id,
      action: AuditAction.lead_created,
      description: `Creó lead '${lead.clientName}' con código ${lead.code}`,
    });

    return { id: lead.id, code: lead.code };
  });

  // PATCH /api/leads/:id
  app.patch("/leads/:id", { preHandler: authorize(Module.VENTAS, Action.EDIT) }, async (request) => {
    const user = ensureUser(request);
    const { id } = request.params as { id: string };
    const body = leadPatchSchema.parse(request.body);

    const existing = await prisma.salesLead.findFirst({ where: { id, deletedAt: null } });
    if (!existing) throw notFound("LEAD_NOT_FOUND", "Lead no encontrado");

    const lead = await prisma.salesLead.update({
      where: { id },
      data: {
        ...(body.clientName !== undefined && { clientName: body.clientName }),
        ...(body.clientEmail !== undefined && { clientEmail: body.clientEmail }),
        ...(body.clientPhone !== undefined && { clientPhone: body.clientPhone }),
        ...(body.address !== undefined && { address: body.address }),
        ...(body.estimatedKwp !== undefined && {
          estimatedKwp: body.estimatedKwp ? new Prisma.Decimal(body.estimatedKwp) : null,
        }),
        ...(body.estimatedBudgetUsd !== undefined && {
          estimatedBudgetUsd: body.estimatedBudgetUsd ? new Prisma.Decimal(body.estimatedBudgetUsd) : null,
        }),
        ...(body.uteBillMonthlyUsd !== undefined && {
          uteBillMonthlyUsd: body.uteBillMonthlyUsd ? new Prisma.Decimal(body.uteBillMonthlyUsd) : null,
        }),
        ...(body.roofType !== undefined && { roofType: body.roofType }),
        ...(body.notes !== undefined && { notes: body.notes }),
        ...(body.assignedToId !== undefined && { assignedToId: body.assignedToId }),
        ...(body.proposalSentAt !== undefined && { proposalSentAt: body.proposalSentAt ? new Date(body.proposalSentAt) : null }),
        ...(body.visitScheduledAt !== undefined && { visitScheduledAt: body.visitScheduledAt ? new Date(body.visitScheduledAt) : null }),
        ...(body.visitCompletedAt !== undefined && { visitCompletedAt: body.visitCompletedAt ? new Date(body.visitCompletedAt) : null }),
        ...(body.closedAt !== undefined && { closedAt: body.closedAt ? new Date(body.closedAt) : null }),
      },
    });

    await createAuditEntriesForChanges({
      entityType: AuditEntityType.lead,
      entityId: lead.id,
      userId: user.id,
      oldData: existing,
      newData: {
        ...existing,
        clientName: lead.clientName,
        clientEmail: lead.clientEmail,
        clientPhone: lead.clientPhone,
        address: lead.address,
        estimatedKwp: lead.estimatedKwp,
        estimatedBudgetUsd: lead.estimatedBudgetUsd,
        uteBillMonthlyUsd: lead.uteBillMonthlyUsd,
        roofType: lead.roofType,
        notes: lead.notes,
        assignedToId: lead.assignedToId,
      },
      formatter: ({ label, oldValue, newValue }) =>
        `Actualizó ${label} del lead '${existing.clientName}' de ${oldValue ?? "vacío"} a ${newValue ?? "vacío"}`,
    });

    return { success: true };
  });

  app.patch("/leads/:id/stage", { preHandler: authorize(Module.VENTAS, Action.EDIT) }, async (request) => {
    const user = ensureUser(request);
    const { id } = request.params as { id: string };
    const body = leadStagePatchSchema.parse(request.body);

    const existing = await prisma.salesLead.findFirst({ where: { id, deletedAt: null } });
    if (!existing) throw notFound("LEAD_NOT_FOUND", "Lead no encontrado");

    if (body.stage === SalesStage.CERRADO_PERDIDO && !body.lostReason?.trim()) {
      throw badRequest("LOST_REASON_REQUIRED", "Debés indicar el motivo de pérdida");
    }

    const isClosed = body.stage === SalesStage.CERRADO_GANADO || body.stage === SalesStage.CERRADO_PERDIDO;
    const updatedLead = await prisma.salesLead.update({
      where: { id },
      data: {
        stage: body.stage,
        notes: body.notes !== undefined ? body.notes : existing.notes,
        lostReason: body.stage === SalesStage.CERRADO_PERDIDO ? body.lostReason ?? null : existing.lostReason,
        ...(isClosed && !existing.closedAt && { closedAt: new Date() }),
      },
    });

    await prisma.salesActivity.create({
      data: {
        leadId: updatedLead.id,
        userId: user.id,
        fromStage: existing.stage,
        toStage: body.stage,
        action: "stage_changed",
        notes: body.notes ?? null,
      },
    });

    await createAuditEntry({
      entityType: AuditEntityType.lead,
      entityId: updatedLead.id,
      userId: user.id,
      action: AuditAction.lead_stage_changed,
      fieldChanged: "stage",
      oldValue: existing.stage,
      newValue: body.stage,
      description: `Movió el lead '${existing.clientName}' de ${existing.stage} a ${body.stage}`,
    });

    if (body.stage === SalesStage.CERRADO_PERDIDO) {
      await createAuditEntry({
        entityType: AuditEntityType.lead,
        entityId: updatedLead.id,
        userId: user.id,
        action: AuditAction.updated,
        fieldChanged: "lostReason",
        oldValue: existing.lostReason,
        newValue: body.lostReason ?? null,
        description: `Registró motivo de pérdida para el lead '${existing.clientName}'`,
      });
    }

    return { success: true };
  });

  app.post("/leads/:id/convert", { preHandler: authorize(Module.VENTAS, Action.CREATE) }, async (request) => {
    const user = ensureUser(request);
    const { id } = request.params as { id: string };

    const lead = await prisma.salesLead.findFirst({
      where: { id, deletedAt: null },
    });

    if (!lead) {
      throw notFound("LEAD_NOT_FOUND", "Lead no encontrado");
    }

    if (lead.stage !== SalesStage.CERRADO_GANADO) {
      throw badRequest("LEAD_NOT_WIN", "El lead debe estar en CERRADO_GANADO para convertirse");
    }

    if (lead.convertedToProjectId) {
      throw conflict("ALREADY_CONVERTED", "El lead ya fue convertido a proyecto");
    }

    if (!lead.estimatedKwp) {
      throw badRequest("LEAD_CAPACITY_REQUIRED", "El lead debe tener potencia estimada para convertirse");
    }

    const startDate = todayUtc();
    const plannedEndDate = new Date(startDate);
    plannedEndDate.setUTCDate(plannedEndDate.getUTCDate() + 90);
    const estimatedMwhYear = decimalToNumber(lead.estimatedKwp)! * 1.45;
    const code = await generateProjectCode();

    const project = await prisma.project.create({
      data: {
        code,
        clientName: lead.clientName,
        capacityKwp: lead.estimatedKwp,
        locationCity: "",
        locationProvince: "",
        status: ProjectStatus.ACTIVE,
        startDate,
        plannedEndDate,
        budgetUsd: lead.estimatedBudgetUsd ?? new Prisma.Decimal(0),
        executedUsd: new Prisma.Decimal(0),
        estimatedMwhYear: new Prisma.Decimal(estimatedMwhYear.toFixed(2)),
        co2TonsAvoided: new Prisma.Decimal((estimatedMwhYear * 0.5).toFixed(2)),
        notificationEmail: lead.clientEmail ?? "",
        notificationPhone: lead.clientPhone ?? "",
        createdById: user.id,
      },
    });

    await createInitialPipeline(project.id, startDate, plannedEndDate, null);

    await prisma.salesLead.update({
      where: { id: lead.id },
      data: {
        convertedToProjectId: project.id,
        convertedAt: new Date(),
      },
    });

    await prisma.salesActivity.create({
      data: {
        leadId: lead.id,
        userId: user.id,
        fromStage: lead.stage,
        toStage: lead.stage,
        action: "lead_converted",
        notes: `Lead convertido a proyecto ${code}`,
      },
    });

    await createAuditEntry({
      entityType: AuditEntityType.lead,
      entityId: lead.id,
      projectId: project.id,
      userId: user.id,
      action: AuditAction.lead_converted,
      description: `Convirtió lead '${lead.clientName}' al proyecto ${code}`,
    });

    await createAuditEntry({
      entityType: AuditEntityType.project,
      entityId: project.id,
      projectId: project.id,
      userId: user.id,
      action: AuditAction.created,
      description: `Creó proyecto '${project.clientName}' desde lead ${lead.code}`,
    });

    const projectWithStages = await prisma.project.findUniqueOrThrow({
      where: { id: project.id },
      include: {
        stages: {
          orderBy: { order: "asc" },
          include: {
            substages: {
              where: { deletedAt: null },
              orderBy: { order: "asc" },
              include: {
                checklistItems: {
                  orderBy: { order: "asc" },
                },
              },
            },
          },
        },
      },
    });

    return {
      ...serializeProject(projectWithStages),
      stages: projectWithStages.stages.map((stage) => ({
        ...serializeStage(stage),
        substages: stage.substages.map(serializeSubstage),
      })),
    };
  });

  // DELETE /api/leads/:id (soft delete)
  app.delete("/leads/:id", { preHandler: authorize(Module.VENTAS, Action.DELETE) }, async (request) => {
    const user = ensureUser(request);
    const { id } = request.params as { id: string };

    const existing = await prisma.salesLead.findFirst({ where: { id, deletedAt: null } });
    if (!existing) throw notFound("LEAD_NOT_FOUND", "Lead no encontrado");

    await prisma.salesLead.update({
      where: { id },
      data: { deletedAt: new Date() },
    });

    await createAuditEntry({
      entityType: AuditEntityType.lead,
      entityId: existing.id,
      userId: user.id,
      action: AuditAction.deleted,
      description: `Eliminó lógicamente el lead '${existing.clientName}'`,
    });

    return { success: true };
  });

  app.post("/proposals/generate", { preHandler: authorize(Module.VENTAS, Action.CREATE) }, async (request, reply) => {
    const user = ensureUser(request);

    const parts = request.parts();
    let uploadedFilePath: string | null = null;
    let leadId: string | null = null;
    let projectId: string | null = null;

    for await (const part of parts) {
      if (part.type === "file") {
        uploadedFilePath = await saveProposalInputFile(part);
      } else if (part.fieldname === "leadId") {
        leadId = String(part.value || "") || null;
      } else if (part.fieldname === "projectId") {
        projectId = String(part.value || "") || null;
      }
    }

    if (!uploadedFilePath) {
      throw badRequest("FILE_REQUIRED", "Debés adjuntar un archivo Excel");
    }

    if (leadId) {
      const lead = await prisma.salesLead.findFirst({
        where: { id: leadId, deletedAt: null },
      });

      if (!lead) {
        throw notFound("LEAD_NOT_FOUND", "Lead no encontrado");
      }
    }

    if (projectId) {
      await findProjectOrThrow(projectId);
    }

    const proposal = await prisma.proposalGeneration.create({
      data: {
        leadId,
        projectId,
        inputFilePath: uploadedFilePath,
        status: "PENDING",
        generatedById: user.id,
      },
    });

    await createAuditEntry({
      entityType: AuditEntityType.proposal,
      entityId: proposal.id,
      projectId,
      userId: user.id,
      action: AuditAction.proposal_generated,
      description: "Creó una solicitud de generación de propuesta comercial",
    });

    void processProposalGeneration({
      proposalId: proposal.id,
      generatedById: user.id,
      projectId,
    });

    reply.code(201);
    return { id: proposal.id, status: proposal.status };
  });

  app.get("/proposals/:id", { preHandler: authorize(Module.VENTAS, Action.VIEW) }, async (request) => {
    const params = z.object({ id: z.string() }).parse(request.params);
    const proposal = await prisma.proposalGeneration.findUnique({
      where: { id: params.id },
    });

    if (!proposal) {
      throw notFound("PROPOSAL_NOT_FOUND", "Propuesta no encontrada");
    }

    return {
      id: proposal.id,
      status: proposal.status,
      errorMessage: proposal.errorMessage,
      createdAt: serializeDate(proposal.createdAt),
      updatedAt: serializeDate(proposal.updatedAt),
      downloadUrl: proposal.status === "COMPLETED" ? `/api/proposals/${proposal.id}/download` : null,
    };
  });

  app.get("/proposals/:id/download", { preHandler: authorize(Module.VENTAS, Action.VIEW) }, async (request, reply) => {
    const params = z.object({ id: z.string() }).parse(request.params);
    const proposal = await prisma.proposalGeneration.findUnique({
      where: { id: params.id },
    });

    if (!proposal) {
      throw notFound("PROPOSAL_NOT_FOUND", "Propuesta no encontrada");
    }

    if (proposal.status !== "COMPLETED" || !proposal.outputFilePath) {
      throw badRequest("PROPOSAL_NOT_READY", "La propuesta todavía no está disponible para descarga");
    }

    if (!fs.existsSync(proposal.outputFilePath)) {
      throw notFound("PROPOSAL_FILE_NOT_FOUND", "El archivo PDF generado no existe");
    }

    reply.header("Content-Type", "application/pdf");
    reply.header("Content-Disposition", `attachment; filename=\"propuesta-${proposal.id}.pdf\"`);
    return reply.send(fs.createReadStream(proposal.outputFilePath));
  });

  app.get("/leads/:leadId/proposals", { preHandler: authorize(Module.VENTAS, Action.VIEW) }, async (request) => {
    const params = z.object({ leadId: z.string() }).parse(request.params);
    const lead = await prisma.salesLead.findFirst({
      where: { id: params.leadId, deletedAt: null },
    });

    if (!lead) {
      throw notFound("LEAD_NOT_FOUND", "Lead no encontrado");
    }

    const proposals = await prisma.proposalGeneration.findMany({
      where: {
        leadId: params.leadId,
      },
      orderBy: { createdAt: "desc" },
    });

    return proposals.map((proposal) => ({
      id: proposal.id,
      status: proposal.status,
      errorMessage: proposal.errorMessage,
      createdAt: serializeDate(proposal.createdAt),
      updatedAt: serializeDate(proposal.updatedAt),
      downloadUrl: proposal.status === "COMPLETED" ? `/api/proposals/${proposal.id}/download` : null,
    }));
  });

  // ─── PASO 5: Dev test endpoint ───────────────────────────────────────────────

  if (process.env.NODE_ENV === "development") {
    app.post("/dev/test-notification", async (request, reply) => {
      const body = z
        .object({
          type: z.nativeEnum(NotificationType),
          projectId: z.string(),
        })
        .parse(request.body);

      const project = await prisma.project.findFirst({
        where: { id: body.projectId, deletedAt: null },
        select: { clientName: true, notificationEmail: true, notificationPhone: true },
      });

      if (!project) throw notFound("PROJECT_NOT_FOUND", "Proyecto no encontrado");

      const contextMap: Record<NotificationType, Parameters<typeof createAndSendNotification>[0]["context"]> = {
        task_due: { type: "task_due", projectName: project.clientName, taskTitle: "Tarea de prueba", dueDate: new Date().toISOString().slice(0, 10) },
        stage_changed: { type: "stage_changed", projectName: project.clientName, stageName: "Etapa de prueba", oldStatus: "Pendiente", newStatus: "En curso" },
        progress_milestone: { type: "progress_milestone", projectName: project.clientName, percent: 50 },
        substage_blocked: { type: "substage_blocked", projectName: project.clientName, stageName: "Etapa de prueba", substageName: "Subetapa de prueba", responsible: "Sistema" },
        stage_overdue: { type: "stage_overdue", projectName: project.clientName, stageName: "Etapa de prueba", delayDays: 3 },
        project_delayed: { type: "project_delayed", projectName: project.clientName, delayDays: 7 },
        goals_not_configured: { type: "goals_not_configured", period: "Q2 2025" },
      };

      const titleMap: Record<NotificationType, string> = {
        task_due: "Test: tarea por vencer",
        stage_changed: "Test: cambio de etapa",
        progress_milestone: "Test: hito de progreso",
        substage_blocked: "Test: subetapa bloqueada",
        stage_overdue: "Test: etapa vencida",
        project_delayed: "Test: proyecto retrasado",
        goals_not_configured: "Test: objetivos no configurados",
      };

      await createAndSendNotification({
        projectId: body.projectId,
        type: body.type,
        title: titleMap[body.type],
        message: `Notificación de prueba (${body.type}) para proyecto ${project.clientName}`,
        context: contextMap[body.type],
        deduplicate: false,
      });

      reply.code(201);
      return {
        success: true,
        type: body.type,
        projectName: project.clientName,
        emailTarget: project.notificationEmail ?? null,
        whatsappTarget: project.notificationPhone ?? null,
      };
    });
  }
}

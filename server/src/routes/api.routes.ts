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
  CategoriaPrincipal,
  EstadoAprobacion,
  EstadoComprobante,
  GoalArea,
  GoalMetric,
  GoalPeriod,
  MetodoPago,
  ModalidadPago,
  Module,
  Moneda,
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
  TipoComprobante,
  TipoMovimiento,
  TipoMovimientoStock,
  TipoObra,
} from "@prisma/client";
import { z } from "zod";

import { prisma } from "../lib/prisma.js";
import { env } from "../config/env.js";
import { authenticate } from "../middleware/auth.middleware.js";
import { authorize, clearPermissionCache } from "../middleware/authorize.middleware.js";
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
import {
  getActivePipelineTemplate,
  getStageLabel,
  getTipoObraLabel,
  getOperationVisibility,
} from "../services/pipeline-definitions.js";
import { createNotificationIfNotExists } from "../services/notification.service.js";
import { createAndSendNotification, checkProgressMilestone } from "../services/notify.service.js";
import { addDays, diffInDays, parseDateOnly, todayUtc, toDateOnlyString } from "../utils/dates.js";
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
    // Obligatorios al crear: sólo estos 4
    clientName: z.string().min(1),
    capacityKwp: z.coerce.number().positive(),
    locationCity: z.string().min(1),
    locationProvince: z.string().min(1),
    // Todo lo demás: opcional. startDate default = hoy al crear.
    plannedEndDate: dateOnlySchema.nullable().optional(),
    budgetUsd: z.coerce.number().positive().nullable().optional(),
    estimatedMwhYear: z.coerce.number().positive().nullable().optional(),
    salespersonId: z.string().optional(),
    modalidadPago: z.nativeEnum(ModalidadPago).optional(),
    notificationEmail: z.string().email().nullable().optional(),
    notificationPhone: z.string().nullable().optional(),
    clientAddress: z.string().nullable().optional(),
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
    plannedEndDate: dateOnlySchema.nullable().optional(),
    actualEndDate: dateOnlySchema.nullable().optional(),
    budgetUsd: z.coerce.number().positive().nullable().optional(),
    executedUsd: z.coerce.number().nonnegative().optional(),
    estimatedMwhYear: z.coerce.number().positive().nullable().optional(),
    modalidadPago: z.nativeEnum(ModalidadPago).nullable().optional(),
    notificationEmail: z.union([z.string().email(), z.literal("")]).nullable().optional(),
    notificationPhone: z.string().nullable().optional(),
    clientAddress: z.string().nullable().optional(),
    firstDateScheduledAt: z.string().datetime({ offset: true }).nullable().optional(),
  })
  .strict();

const stagePatchSchema = z
  .object({
    status: z.nativeEnum(StageStatus).optional(),
    tipoObra: z.nativeEnum(TipoObra).nullable().optional(),
    /** @deprecated usar responsibleUserId. Se mantiene sólo por retrocompat. */
    responsibleName: z.string().trim().min(1).nullable().optional(),
    responsibleUserId: z.string().min(1).nullable().optional(),
    notes: z.string().nullable().optional(),
    plannedStartDate: dateOnlySchema.nullable().optional(),
    plannedEndDate: dateOnlySchema.nullable().optional(),
    actualStartDate: dateOnlySchema.nullable().optional(),
    actualEndDate: dateOnlySchema.nullable().optional(),
  })
  .strict();

const substageCreateSchema = z
  .object({
    name: z.string().min(1),
    /** @deprecated usar userId. Se acepta por retrocompat y se guarda como snapshot vacío si no viene. */
    responsible: z.string().optional(),
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
    /** @deprecated usar userId. Se acepta por retrocompat. */
    responsible: z.string().optional(),
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
    // role = name del rol en la tabla roles (ej: "ADMIN", "OPERACIONES")
    role: z.string().min(1),
  })
  .strict();

const userPatchSchema = z
  .object({
    name: z.string().min(1).optional(),
    email: z.string().email().optional(),
    role: z.string().min(1).optional(),
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
  if (source.clientAddress !== undefined) normalized.clientAddress = source.clientAddress;
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
  clientAddress: "dirección del cliente",
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
  role: { id: string; name: string; label: string };
  createdAt: Date;
}) {
  return {
    id: user.id,
    name: user.name,
    email: user.email,
    // Mantiene compat: los consumidores esperan un string con el name del rol.
    role: user.role.name,
    roleId: user.role.id,
    roleLabel: user.role.label,
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
        salesperson: {
          select: { id: true, name: true },
        },
        stages: {
          orderBy: { order: "asc" },
          include: {
            responsibleUser: { select: { id: true, name: true, role: { select: { name: true } } } },
            substages: {
              where: { deletedAt: null, isActive: true },
              orderBy: { order: "asc" },
              include: {
                user: { select: { id: true, name: true, role: { select: { name: true } } } },
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
          include: {
            user: { select: { id: true, name: true, role: { select: { name: true } } } },
          },
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
        installationSchedule: {
          where: { deletedAt: null },
          include: {
            confirmedByUser: { select: { id: true, name: true } },
            segments: { orderBy: { startDate: "asc" } },
          },
        },
      },
    });

    if (!project) {
      throw notFound("PROJECT_NOT_FOUND", "Proyecto no encontrado");
    }

    const metrics = calculateProjectMetrics(project);

    const installationSchedule = project.installationSchedule
      ? (() => {
          const segs = project.installationSchedule!.segments;
          const env = segs.length > 0 ? envelopeOf(segs) : null;
          return {
            id: project.installationSchedule!.id,
            teamName: project.installationSchedule!.teamName,
            teamColor: project.installationSchedule!.teamColor,
            plannedWorkStart: env ? serializeDateOnly(env.start) : null,
            plannedWorkEnd: env ? serializeDateOnly(env.end) : null,
            confirmedAt: serializeDate(project.installationSchedule!.confirmedAt),
            confirmedByUser: project.installationSchedule!.confirmedByUser
              ? {
                  id: project.installationSchedule!.confirmedByUser.id,
                  name: project.installationSchedule!.confirmedByUser.name,
                }
              : null,
            notes: project.installationSchedule!.notes,
            segments: segs.map((s) => ({
              id: s.id,
              startDate: serializeDateOnly(s.startDate)!,
              endDate: serializeDateOnly(s.endDate)!,
              notes: s.notes,
            })),
          };
        })()
      : null;

    return {
      ...serializeProject(project),
      installationSchedule,
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
    // plannedEndDate es opcional. Para armar el pipeline inicial si no viene,
    // asumimos 90 días desde el inicio como placeholder (no se muestra en UI).
    const plannedEndDate = body.plannedEndDate
      ? parseDateOnly(body.plannedEndDate)
      : addDays(startDate, 90);

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
        plannedEndDate: body.plannedEndDate ? plannedEndDate : null,
        budgetUsd: body.budgetUsd != null ? new Prisma.Decimal(body.budgetUsd) : null,
        executedUsd: new Prisma.Decimal(0),
        estimatedMwhYear: body.estimatedMwhYear != null ? new Prisma.Decimal(body.estimatedMwhYear) : null,
        co2TonsAvoided: body.estimatedMwhYear != null
          ? new Prisma.Decimal((body.estimatedMwhYear * 0.5).toFixed(2))
          : null,
        modalidadPago: body.modalidadPago ?? null,
        notificationEmail: body.notificationEmail || null,
        notificationPhone: body.notificationPhone || null,
        clientAddress: body.clientAddress || null,
        salespersonId: body.salespersonId ?? null,
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
        responsibleUser: { select: { id: true, name: true, role: { select: { name: true } } } },
        substages: {
          where: { deletedAt: null, isActive: true },
          orderBy: { order: "asc" },
          include: {
            user: { select: { id: true, name: true, role: { select: { name: true } } } },
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

    // POSTVENTA es indefinida: no acepta ningún cambio de fecha (plan ni real)
    const touchesAnyDate =
      body.plannedStartDate !== undefined ||
      body.plannedEndDate !== undefined ||
      body.actualStartDate !== undefined ||
      body.actualEndDate !== undefined;
    if (stage.name === StageType.POSTVENTA && touchesAnyDate) {
      throw badRequest(
        "POSTVENTA_NO_DATES",
        "La etapa Postventa no tiene fechas asociadas por ser indefinida",
      );
    }

    // Sólo ADMIN puede modificar fechas reales manualmente
    const touchesActualDates =
      body.actualStartDate !== undefined || body.actualEndDate !== undefined;
    if (touchesActualDates && user.role !== "ADMIN") {
      throw new AppError(403, "ADMIN_REQUIRED", "Solo admin puede modificar fechas reales");
    }

    let stageCompletionWarning: { code: string; message: string } | null = null;

    const updateData: Record<string, unknown> = {};
    if (body.tipoObra !== undefined) updateData.tipoObra = body.tipoObra;
    if (body.responsibleName !== undefined) updateData.responsibleName = body.responsibleName;
    if (body.responsibleUserId !== undefined) {
      if (body.responsibleUserId !== null) {
        await assertUserActiveOrThrow(body.responsibleUserId, "responsibleUserId");
      }
      updateData.responsibleUserId = body.responsibleUserId;
    }
    if (body.notes !== undefined) updateData.notes = body.notes;
    if (body.plannedStartDate !== undefined) updateData.plannedStartDate = body.plannedStartDate ? parseDateOnly(body.plannedStartDate) : null;
    if (body.plannedEndDate !== undefined) updateData.plannedEndDate = body.plannedEndDate ? parseDateOnly(body.plannedEndDate) : null;

    // Fechas reales editadas por ADMIN
    if (body.actualStartDate !== undefined) {
      updateData.actualStartDate = body.actualStartDate ? parseDateOnly(body.actualStartDate) : null;
    }
    if (body.actualEndDate !== undefined) {
      updateData.actualEndDate = body.actualEndDate ? parseDateOnly(body.actualEndDate) : null;
    }
    if (touchesActualDates) {
      // Validar rango si ambos quedan definidos post-update
      const nextStart =
        body.actualStartDate !== undefined
          ? (updateData.actualStartDate as Date | null)
          : stage.actualStartDate;
      const nextEnd =
        body.actualEndDate !== undefined
          ? (updateData.actualEndDate as Date | null)
          : stage.actualEndDate;
      if (nextStart && nextEnd && nextEnd.getTime() < nextStart.getTime()) {
        throw badRequest(
          "INVALID_DATE_RANGE",
          "La fecha fin real no puede ser anterior al inicio",
        );
      }
      updateData.actualDatesManuallyEdited = true;
    }

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

        // Regla 3: al completar OPERACIONES, validar contra fechas de instalación
        if (stage.name === StageType.OPERACIONES) {
          const installation = await prisma.installationSchedule.findFirst({
            where: { projectId: params.projectId, deletedAt: null },
            select: {
              actualWorkEnd: true,
              segments: { orderBy: { endDate: "desc" }, take: 1, select: { endDate: true } },
            },
          });
          if (installation) {
            const today = todayUtc();
            const lastEnd = installation.segments[0]?.endDate ?? null;
            // Caso A: último fin planificado todavía no pasó → bloquear
            if (lastEnd && lastEnd.getTime() > today.getTime()) {
              throw badRequest(
                "INSTALL_NOT_FINISHED",
                `La fecha de fin de instalación programada (${formatDateEs(lastEnd)}) aún no pasó. Actualizá las fechas de instalación o esperá a que finalice antes de cerrar la etapa Operaciones.`,
              );
            }
            // Caso B: fin planificado ya pasó pero actualWorkEnd es null → warning
            if (!installation.actualWorkEnd) {
              stageCompletionWarning = {
                code: "WORK_END_NOT_CONFIRMED",
                message:
                  "La fecha de fin de instalación pasó pero no fue confirmada en el sistema. Registrá el fin real de obra en la ficha del proyecto.",
              };
            }
            // Caso C: no hay plannedWorkEnd (installation=null) → permit (nada)
            // Caso D: actualWorkEnd existe y <= hoy → permit
          }
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

    // Sincronizar fechas reales de Project según la etapa tocada
    const projectSync: Prisma.ProjectUpdateInput = {};
    if (stage.name === StageType.ONBOARDING) {
      projectSync.actualOnboardingEnd = updatedStage.actualEndDate;
    }
    if (stage.name === StageType.INGENIERIA) {
      projectSync.actualEngineeringEnd = updatedStage.actualEndDate;
    }
    if (stage.name === StageType.HABILITACION_UTE) {
      projectSync.actualUteStart = updatedStage.actualStartDate;
      projectSync.actualUteEnd = updatedStage.actualEndDate;
    }
    if (Object.keys(projectSync).length > 0) {
      await prisma.project.update({
        where: { id: params.projectId },
        data: projectSync,
      });
    }

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

    const serialized = serializeStage(updatedStage);
    return stageCompletionWarning ? { ...serialized, _warning: stageCompletionWarning } : serialized;
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

    if (body.userId) {
      await assertUserActiveOrThrow(body.userId, "userId");
    }

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
        responsible: body.responsible ?? "",
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

    // Regla 2: no permitir iniciar/completar subetapa de ejecución si OPERACIONES no está activa
    if (
      body.status &&
      (body.status === SubstageStatus.IN_PROGRESS || body.status === SubstageStatus.COMPLETED) &&
      body.status !== substage.status
    ) {
      const stage = await prisma.stage.findUnique({
        where: { id: params.stageId },
        select: { name: true, status: true },
      });
      if (stage && isInstallationWorkSubstage(substage.name, stage) && stage.status !== StageStatus.IN_PROGRESS) {
        throw badRequest(
          "OPERATIONS_NOT_ACTIVE",
          "No podés iniciar la instalación si la etapa Operaciones no está en curso. Primero activá la etapa Operaciones.",
        );
      }
    }

    if (body.name !== undefined) updateData.name = body.name;
    if (body.sopCode !== undefined) updateData.sopCode = body.sopCode;
    if (body.responsableRol !== undefined) updateData.responsableRol = body.responsableRol;
    if (body.responsible !== undefined) updateData.responsible = body.responsible;
    if (body.userId !== undefined) {
      if (body.userId !== null) {
        await assertUserActiveOrThrow(body.userId, "userId");
      }
      updateData.userId = body.userId;
    }
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
    let syncedStage = await syncStageProgress(params.stageId);
    const projectProgressPercent = await calculateProjectProgress(params.projectId);

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

    // Regla 2: no completar subetapa de ejecución si OPERACIONES no está activa
    if (isInstallationWorkSubstage(substage.name, substage.stage) && substage.stage.status !== StageStatus.IN_PROGRESS) {
      throw badRequest(
        "OPERATIONS_NOT_ACTIVE",
        "No podés iniciar la instalación si la etapa Operaciones no está en curso. Primero activá la etapa Operaciones.",
      );
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

  app.patch("/projects/:projectId/stages/:stageId/complete-all", { preHandler: authorize(Module.OPERACIONES, Action.COMPLETE) }, async (request) => {
    const user = ensureUser(request);
    const params = z.object({ projectId: z.string(), stageId: z.string() }).parse(request.params);
    const stage = await findStageOrThrow(params.projectId, params.stageId);

    // Obtener todas las subetapas activas con sus checklist items
    const substages = await prisma.substage.findMany({
      where: {
        stageId: stage.id,
        deletedAt: null,
        isActive: true,
        status: { not: SubstageStatus.COMPLETED },
      },
      include: {
        checklistItems: {
          where: { deletedAt: null, completed: false },
        },
      },
    });

    const actualEndDate = todayUtc();

    await prisma.$transaction(async (tx) => {
      for (const substage of substages) {
        const actualStartDate = substage.actualStartDate ?? actualEndDate;
        const actualDurationDays = Math.max(0, diffInDays(actualStartDate, actualEndDate));
        const plannedDurationDays =
          substage.plannedStartDate && substage.plannedEndDate
            ? Math.max(0, diffInDays(substage.plannedStartDate, substage.plannedEndDate))
            : 0;

        // Completar todos los checklist items de la subetapa
        if (substage.checklistItems.length > 0) {
          await tx.checklistItem.updateMany({
            where: {
              substageId: substage.id,
              deletedAt: null,
              completed: false,
            },
            data: {
              completed: true,
              completedAt: actualEndDate,
              completedBy: user.id,
            },
          });
        }

        // Completar la subetapa
        await tx.substage.update({
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
      }
    });

    // Actualizar progreso de la etapa y del proyecto
    await syncStageProgress(stage.id);
    await calculateProjectProgress(params.projectId);

    // Audit entries
    for (const substage of substages) {
      await createAuditEntry({
        entityType: AuditEntityType.substage,
        entityId: substage.id,
        projectId: params.projectId,
        userId: user.id,
        action: AuditAction.updated,
        fieldChanged: "status",
        oldValue: substage.status,
        newValue: SubstageStatus.COMPLETED,
        description: `Completó todas las subetapas de la etapa '${stage.name}'`,
      });
    }

    // Devolver etapa actualizada
    const updatedStage = await prisma.stage.findUniqueOrThrow({
      where: { id: stage.id },
      include: {
        substages: {
          where: { deletedAt: null, isActive: true },
          orderBy: { order: "asc" },
          include: { checklistItems: { orderBy: { order: "asc" } } },
        },
      },
    });

    return {
      ...serializeStage(updatedStage),
      substages: updatedStage.substages.map((sub) => ({
        ...serializeSubstage(sub),
        checklistItems: sub.checklistItems.map(serializeChecklistItem),
      })),
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

    if (body.isRequired !== undefined && user.role !== "ADMIN") {
      throw forbidden("No tenés permiso para realizar esta acción");
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
      include: {
        user: { select: { id: true, name: true, role: { select: { name: true } } } },
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

    if (body.userId) {
      await assertUserActiveOrThrow(body.userId, "userId");
    }

    const task = await prisma.task.create({
      data: {
        projectId: params.projectId,
        stageId: body.stageId ?? null,
        substageId: body.substageId ?? null,
        title: body.title,
        description: body.description ?? null,
        status: body.status,
        priority: body.priority,
        responsible: body.responsible ?? "",
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
    if (body.userId !== undefined) {
      if (body.userId !== null) {
        await assertUserActiveOrThrow(body.userId, "userId");
      }
      updateData.userId = body.userId;
    }
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

  // Endpoint unificado para la sección "Documentos" de la ficha del proyecto.
  // Devuelve todos los archivos asociados al proyecto con etiqueta de origen
  // (etapa o subetapa). Por ahora Comment no tiene adjuntos, así que la fuente
  // es siempre stage/substage.
  app.get("/projects/:projectId/documents", { preHandler: authorize(Module.OPERACIONES, Action.VIEW) }, async (request) => {
    const params = z.object({ projectId: z.string() }).parse(request.params);
    await findProjectOrThrow(params.projectId);

    const files = await prisma.fileAttachment.findMany({
      where: { projectId: params.projectId, deletedAt: null },
      orderBy: { createdAt: "desc" },
      include: {
        stage: { select: { id: true, name: true } },
        substage: { select: { id: true, name: true, stageId: true } },
      },
    });

    return files.map((file) => {
      let source: "stage" | "substage" | "other" = "other";
      let sourceLabel = "Proyecto";
      let stageId: string | null = null;
      let substageId: string | null = null;
      if (file.substage) {
        source = "substage";
        sourceLabel = `Subetapa ${file.substage.name}`;
        stageId = file.substage.stageId;
        substageId = file.substage.id;
      } else if (file.stage) {
        source = "stage";
        sourceLabel = `Etapa ${getStageLabel(file.stage.name)}`;
        stageId = file.stage.id;
      }
      return {
        id: file.id,
        filename: file.filename,
        mimeType: file.mimeType,
        sizeBytes: file.sizeBytes,
        uploadedAt: serializeDate(file.createdAt),
        uploadedBy: file.uploadedById,
        source,
        sourceLabel,
        stageId,
        substageId,
        downloadUrl: `/api/files/${file.id}/download`,
        // El mismo endpoint sirve para preview (inline) — el front lo abre en iframe.
        previewUrl: `/api/files/${file.id}/preview`,
      };
    });
  });

  // Sirve el archivo inline (no force-download) para previews de PDF/imagen.
  app.get("/files/:fileId/preview", { preHandler: authorize(Module.OPERACIONES, Action.VIEW) }, async (request, reply) => {
    ensureUser(request);
    const params = z.object({ fileId: z.string() }).parse(request.params);
    const file = await findFileOrThrow(params.fileId);
    const absolutePath = getStoredFilePath(file.url);

    if (!fs.existsSync(absolutePath)) {
      throw notFound("FILE_NOT_FOUND", "El archivo no existe en storage");
    }

    reply.header("Content-Type", file.mimeType);
    reply.header("Content-Disposition", `inline; filename="${file.filename}"`);
    return reply.send(fs.createReadStream(absolutePath));
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
      stages: project.stages.map((stage) => ({
        id: stage.id,
        name: stage.name,
        actualDurationDays: stage.actualDurationDays,
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

    // Goals for the period (OPERACIONES area)
    const opsGoals = await prisma.goal.findMany({
      where: {
        area: GoalArea.OPERACIONES,
        year: filterYear,
        ...(filterQuarter
          ? { OR: [{ period: GoalPeriod.QUARTERLY, quarter: filterQuarter }, { period: GoalPeriod.ANNUAL }] }
          : { period: GoalPeriod.ANNUAL }),
      },
    });

    const opsActualValues: Record<string, number> = {
      [GoalMetric.INSTALLATIONS_COUNT]: filterQuarter ? installationsThisQuarter : installationsThisYear,
      [GoalMetric.KWP_INSTALLED]: filterQuarter ? kwpInstalledThisQuarter : kwpInstalledThisYear,
    };

    function opsIsOnTrack(actual: number, target: number, pStart: Date, pEnd: Date): boolean {
      const totalMs = pEnd.getTime() - pStart.getTime();
      const elapsedMs = Math.min(now.getTime() - pStart.getTime(), totalMs);
      const elapsedFraction = totalMs > 0 ? elapsedMs / totalMs : 1;
      const achievedFraction = target > 0 ? actual / target : 0;
      return achievedFraction >= elapsedFraction;
    }

    const opsGoalsData = opsGoals.map((g) => {
      const metric = g.metric as GoalMetric;
      const target = Number(g.targetValue);
      const actual = opsActualValues[metric] ?? 0;
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
        onTrack: opsIsOnTrack(actual, target, pStart, pEnd),
      };
    });

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
      // Tiempo promedio venta → entrega (en proyectos COMPLETED con actualUteEnd)
      avgSaleToDeliveryDays: (() => {
        const completed = projects.filter(
          (p) => p.status === ProjectStatus.COMPLETED && p.actualUteEnd,
        );
        if (completed.length === 0) return null;
        const totalDays = completed.reduce(
          (sum, p) => sum + Math.max(0, diffInDays(p.createdAt, p.actualUteEnd!)),
          0,
        );
        return Number((totalDays / completed.length).toFixed(1));
      })(),
      goals: opsGoalsData,
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
        // POSTVENTA es indefinida y no participa de las métricas de etapas
        name: { not: StageType.POSTVENTA },
      },
      orderBy: [{ order: "asc" }, { createdAt: "asc" }],
    });

    const grouped = new Map<StageType, typeof completedStages>();
    for (const stage of completedStages) {
      const bucket = grouped.get(stage.name) ?? [];
      bucket.push(stage);
      grouped.set(stage.name, bucket);
    }

    return (Object.values(StageType) as StageType[])
      .filter((stageName) => stageName !== StageType.POSTVENTA)
      .map((stageName) => {
        const items = grouped.get(stageName) ?? [];
        const completedCount = items.length;
        const durations = items
          .map((stage) => stage.actualDurationDays)
          .filter((d): d is number => d != null);
        const avgActualDays =
          durations.length > 0
            ? Number((durations.reduce((s, d) => s + d, 0) / durations.length).toFixed(2))
            : 0;
        const minActualDays = durations.length > 0 ? Math.min(...durations) : 0;
        const maxActualDays = durations.length > 0 ? Math.max(...durations) : 0;

        return {
          stageName,
          stageLabel: getStageLabel(stageName),
          avgActualDays,
          minActualDays,
          maxActualDays,
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
          daysElapsed: metrics.daysElapsed,
          budgetUsd: decimalToNumber(project.budgetUsd),
          executedUsd: decimalToNumber(project.executedUsd),
        };
      })
      .sort((a, b) => b.progressPercent - a.progressPercent);
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

  // Lista de usuarios activos para poblar selectores (asignar responsables,
  // etc.). Abierto a cualquier usuario autenticado porque ya se exponen estos
  // datos de forma indirecta al mostrar responsables en las pantallas.
  // El endpoint /users clásico sigue restringido a USUARIOS.VIEW.
  const userActiveSchema = z.object({
    id: z.string(),
    name: z.string(),
    email: z.string(),
    role: z.string(),
  });

  app.get("/users/active", async () => {
    const users = await prisma.user.findMany({
      where: { deletedAt: null },
      // SELECT explícito: nunca devolver password u otros campos sensibles.
      select: {
        id: true,
        name: true,
        email: true,
        role: { select: { name: true } },
      },
    });
    const flattened = users.map((u) => ({
      id: u.id,
      name: u.name,
      email: u.email,
      role: u.role.name,
    }));
    // Orden alfabético case-insensitive por nombre (Postgres no garantiza
    // "ignorar mayúsculas" sin collation extra; lo hacemos acá para ser explícitos).
    flattened.sort((a, b) => a.name.localeCompare(b.name, "es", { sensitivity: "base" }));
    return z.array(userActiveSchema).parse(flattened);
  });

  // Helper: valida que un userId corresponda a un usuario existente y activo.
  // Devuelve los campos mínimos útiles del usuario validado. Usado al asignar
  // responsables a Stage/Substage/Task y al consultar /my-tasks?userId=...
  async function assertUserActiveOrThrow(userId: string, fieldName = "userId") {
    const user = await prisma.user.findFirst({
      where: { id: userId, deletedAt: null },
      select: {
        id: true,
        name: true,
        role: { select: { name: true } },
      },
    });
    if (!user) {
      throw badRequest(
        "INVALID_USER_ID",
        `El ${fieldName} indicado no corresponde a un usuario activo`,
      );
    }
    return { id: user.id, name: user.name, role: user.role.name };
  }

  app.get("/users/me", async (request) => {
    const user = ensureUser(request);

    const permissions = await prisma.permission.findMany({
      where: {
        role: { name: user.role },
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

  // ─── "Mis tareas" ────────────────────────────────────────────────────────────
  // Dashboard personal: un bloque por (proyecto + etapa activa) con sus
  // subetapas pendientes. El usuario ve todas las subetapas pendientes de la
  // etapa (no sólo las suyas), siempre que tenga permiso VIEW sobre el módulo
  // correspondiente. Las etapas completamente terminadas no aparecen.

  const STAGE_TYPE_TO_MODULE: Record<StageType, Module> = {
    [StageType.ONBOARDING]: Module.ONBOARDING,
    [StageType.INGENIERIA]: Module.INGENIERIA,
    [StageType.OPERACIONES]: Module.OPERACIONES,
    [StageType.HABILITACION_UTE]: Module.HABILITACION,
    [StageType.POSTVENTA]: Module.POSTVENTA,
  };

  function computeInitials(name: string): string {
    const parts = name.trim().split(/\s+/).filter(Boolean);
    if (parts.length === 0) return "?";
    if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
    return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
  }

  app.get("/my-tasks", async (request) => {
    const currentUser = ensureUser(request);

    // Admins pueden consultar tareas de otro usuario vía ?userId=. Para no
    // admins el param se ignora silenciosamente (no es error).
    const query = z
      .object({ userId: z.string().min(1).optional() })
      .parse(request.query);
    const isAdmin = currentUser.role === "ADMIN";
    let targetUser: { id: string; role: string; name: string } = {
      id: currentUser.id,
      role: currentUser.role,
      name: currentUser.name,
    };
    if (isAdmin && query.userId && query.userId !== currentUser.id) {
      // Si el userId no existe o está borrado → 400 INVALID_USER_ID (mismo
      // patrón que los patches de substage/task/stage). No hacemos fallback
      // silencioso al admin porque genera confusión.
      targetUser = await assertUserActiveOrThrow(query.userId, "userId");
      // Transparencia: dejamos traza en los logs de que un admin miró tareas
      // ajenas. No vamos al audit log porque AuditAction no tiene un "viewed";
      // si más adelante queremos persistirlo, se agrega en una migración aparte.
      request.log.info(
        {
          type: "my_tasks_admin_view",
          adminId: currentUser.id,
          adminName: currentUser.name,
          targetUserId: targetUser.id,
          targetUserName: targetUser.name,
        },
        `Admin ${currentUser.name} consultó las tareas de ${targetUser.name}`,
      );
    }

    // 1. Módulos visibles para el ROL DEL USUARIO CONSULTADO (respetamos su
    //    perfil: un admin ve lo que vería el otro usuario, no lo que él mismo
    //    podría ver).
    const userPermissions = await prisma.permission.findMany({
      where: { role: { name: targetUser.role }, action: Action.VIEW },
      select: { module: true },
    });
    const visibleModules = new Set(userPermissions.map((p) => p.module));

    // 2. Etapas activas: no completadas, no borradas, proyecto activo, con al
    //    menos una subetapa no completada y visible para el usuario.
    const stages = await prisma.stage.findMany({
      where: {
        deletedAt: null,
        status: { not: StageStatus.COMPLETED },
        project: {
          deletedAt: null,
          status: { notIn: [ProjectStatus.ARCHIVED, ProjectStatus.COMPLETED] },
        },
        substages: {
          some: {
            deletedAt: null,
            isActive: true,
            status: { not: SubstageStatus.COMPLETED },
          },
        },
      },
      include: {
        project: { select: { id: true, clientName: true, code: true } },
        substages: {
          where: {
            deletedAt: null,
            isActive: true,
            status: { not: SubstageStatus.COMPLETED },
          },
          include: {
            user: { select: { id: true, name: true } },
            checklistItems: { where: { deletedAt: null }, select: { completed: true } },
          },
          orderBy: { order: "asc" },
        },
      },
    });

    const today = todayUtc();
    const sevenDaysFromNow = addDays(today, 7);

    function urgencyRank(dueDate: Date | null): number {
      // 0 = atrasada o vence hoy, 1 = ≤ 7 días, 2 = > 7 días, 3 = sin fecha
      if (!dueDate) return 3;
      if (dueDate.getTime() <= today.getTime()) return 0;
      if (dueDate.getTime() <= sevenDaysFromNow.getTime()) return 1;
      return 2;
    }

    const blocks = stages
      .filter((stage) => visibleModules.has(STAGE_TYPE_TO_MODULE[stage.name]))
      .map((stage) => {
        // Subetapas pendientes de esta etapa, ya filtradas arriba.
        const subs = stage.substages;

        // Urgencia del bloque = mínimo rank entre stageDueDate y cualquier
        // substage pendiente (la más urgente manda).
        const substageRanks = subs.map((s) => urgencyRank(s.dueDate));
        const stageRank = urgencyRank(stage.plannedEndDate);
        const blockRank = Math.min(stageRank, ...substageRanks);

        const myPendingSubstagesCount = subs.filter((s) => s.userId === targetUser.id).length;

        return {
          projectId: stage.projectId,
          projectCode: stage.project.code,
          projectName: stage.project.clientName,
          stageId: stage.id,
          stageName: stage.name,
          stageLabel: getStageLabel(stage.name),
          stageDueDate: serializeDateOnly(stage.plannedEndDate),
          pendingSubstagesCount: subs.length,
          myPendingSubstagesCount,
          blockRank,
          substages: subs
            .map((sub) => {
              const total = sub.checklistItems.length;
              const done = sub.checklistItems.filter((c) => c.completed).length;
              return {
                id: sub.id,
                name: sub.name,
                status: sub.status,
                dueDate: serializeDateOnly(sub.dueDate),
                checklistDoneCount: done,
                checklistTotalCount: total,
                assignedUser: sub.user
                  ? {
                      id: sub.user.id,
                      name: sub.user.name,
                      initials: computeInitials(sub.user.name),
                      isCurrentUser: sub.user.id === targetUser.id,
                    }
                  : sub.responsible
                    ? {
                        id: null,
                        name: sub.responsible,
                        initials: computeInitials(sub.responsible),
                        isCurrentUser: false,
                      }
                    : null,
                urgencyRank: urgencyRank(sub.dueDate),
              };
            })
            .sort((a, b) => {
              if (a.urgencyRank !== b.urgencyRank) return a.urgencyRank - b.urgencyRank;
              // Dentro del mismo rango, los que tienen fecha van antes, ordenados por fecha
              if (a.dueDate && b.dueDate) return a.dueDate.localeCompare(b.dueDate);
              if (a.dueDate) return -1;
              if (b.dueDate) return 1;
              return a.name.localeCompare(b.name, "es");
            }),
        };
      });

    // Ordenar bloques por urgencia, luego por fecha de stage, luego por nombre de proyecto.
    blocks.sort((a, b) => {
      if (a.blockRank !== b.blockRank) return a.blockRank - b.blockRank;
      if (a.stageDueDate && b.stageDueDate) return a.stageDueDate.localeCompare(b.stageDueDate);
      if (a.stageDueDate) return -1;
      if (b.stageDueDate) return 1;
      return a.projectName.localeCompare(b.projectName, "es");
    });

    return blocks;
  });

  // ─── Roles dinámicos y matriz de permisos ────────────────────────────────────

  const PERMISSION_CATALOG: Array<{ module: Module; actions: Action[] }> = [
    { module: Module.VENTAS,        actions: [Action.VIEW, Action.CREATE, Action.EDIT, Action.DELETE, Action.COMMENT] },
    { module: Module.ONBOARDING,    actions: [Action.VIEW, Action.CREATE, Action.EDIT, Action.DELETE, Action.COMPLETE, Action.COMMENT] },
    { module: Module.INGENIERIA,    actions: [Action.VIEW, Action.CREATE, Action.EDIT, Action.DELETE, Action.COMPLETE, Action.COMMENT] },
    { module: Module.OPERACIONES,   actions: [Action.VIEW, Action.CREATE, Action.EDIT, Action.DELETE, Action.COMPLETE, Action.COMMENT] },
    { module: Module.HABILITACION,  actions: [Action.VIEW, Action.CREATE, Action.EDIT, Action.DELETE, Action.COMPLETE, Action.COMMENT] },
    { module: Module.POSTVENTA,     actions: [Action.VIEW, Action.CREATE, Action.EDIT, Action.DELETE, Action.COMPLETE, Action.COMMENT] },
    { module: Module.METRICAS,      actions: [Action.VIEW] },
    { module: Module.CONFIGURACION, actions: [Action.VIEW, Action.CREATE, Action.EDIT, Action.DELETE] },
    { module: Module.USUARIOS,      actions: [Action.VIEW, Action.CREATE, Action.EDIT, Action.DELETE] },
    { module: Module.FINANZAS,      actions: [Action.VIEW, Action.CREATE, Action.EDIT, Action.DELETE] },
    { module: Module.STOCK,         actions: [Action.VIEW, Action.CREATE, Action.EDIT, Action.DELETE] },
  ];

  const roleNameSchema = z
    .string()
    .trim()
    .min(1)
    .regex(/^[A-Z][A-Z0-9_]*$/, "El nombre del rol debe ser mayúsculas, guión bajo y números (ej: SOPORTE_TECNICO)");

  const permissionEntrySchema = z
    .object({
      module: z.nativeEnum(Module),
      action: z.nativeEnum(Action),
    })
    .strict();

  const roleCreateSchema = z
    .object({
      name: roleNameSchema,
      label: z.string().trim().min(1),
      description: z.string().trim().nullable().optional(),
      permissions: z.array(permissionEntrySchema).default([]),
    })
    .strict();

  const rolePatchSchema = z
    .object({
      label: z.string().trim().min(1).optional(),
      description: z.string().trim().nullable().optional(),
      permissions: z.array(permissionEntrySchema).optional(),
    })
    .strict();

  function assertAdmin(request: import("fastify").FastifyRequest) {
    const user = ensureUser(request);
    if (user.role !== "ADMIN") {
      throw new AppError(403, "ADMIN_REQUIRED", "Solo admin puede gestionar roles");
    }
    return user;
  }

  app.get("/permissions/catalog", { preHandler: authorize(Module.USUARIOS, Action.VIEW) }, async () => {
    return PERMISSION_CATALOG;
  });

  app.get("/roles", { preHandler: authorize(Module.USUARIOS, Action.VIEW) }, async () => {
    const roles = await prisma.role.findMany({
      orderBy: [{ isSystem: "desc" }, { name: "asc" }],
      include: {
        permissions: { select: { module: true, action: true } },
        _count: { select: { users: { where: { deletedAt: null } } } },
      },
    });

    return roles.map((r) => {
      const byModule = new Map<Module, Action[]>();
      for (const p of r.permissions) {
        const arr = byModule.get(p.module) ?? [];
        arr.push(p.action);
        byModule.set(p.module, arr);
      }
      return {
        id: r.id,
        name: r.name,
        label: r.label,
        description: r.description,
        isSystem: r.isSystem,
        userCount: r._count.users,
        permissions: Array.from(byModule.entries()).map(([module, actions]) => ({
          module,
          actions,
        })),
        createdAt: serializeDate(r.createdAt),
        updatedAt: serializeDate(r.updatedAt),
      };
    });
  });

  app.post("/roles", { preHandler: authorize(Module.USUARIOS, Action.CREATE) }, async (request, reply) => {
    const user = assertAdmin(request);
    const body = roleCreateSchema.parse(request.body);

    const existing = await prisma.role.findUnique({ where: { name: body.name } });
    if (existing) {
      throw conflict("ROLE_NAME_DUPLICATE", `Ya existe un rol con el nombre "${body.name}"`);
    }

    const created = await prisma.$transaction(async (tx) => {
      const role = await tx.role.create({
        data: {
          name: body.name,
          label: body.label,
          description: body.description ?? null,
          isSystem: false,
        },
      });
      if (body.permissions.length > 0) {
        await tx.permission.createMany({
          data: body.permissions.map((p) => ({
            roleId: role.id,
            module: p.module,
            action: p.action,
          })),
          skipDuplicates: true,
        });
      }
      return role;
    });

    clearPermissionCache();

    await createAuditEntry({
      entityType: AuditEntityType.permission,
      entityId: created.id,
      userId: user.id,
      action: AuditAction.created,
      description: `Creó rol '${created.label}' (${created.name}) con ${body.permissions.length} permisos`,
    });

    reply.code(201);
    return { id: created.id, name: created.name, label: created.label };
  });

  app.patch("/roles/:id", { preHandler: authorize(Module.USUARIOS, Action.EDIT) }, async (request) => {
    const user = assertAdmin(request);
    const { id } = z.object({ id: z.string() }).parse(request.params);
    const body = rolePatchSchema.parse(request.body);

    const existing = await prisma.role.findUnique({ where: { id } });
    if (!existing) {
      throw notFound("ROLE_NOT_FOUND", "Rol no encontrado");
    }

    // No tocar permisos de ADMIN nunca
    if (existing.name === "ADMIN" && body.permissions !== undefined) {
      throw new AppError(
        403,
        "ADMIN_ROLE_PROTECTED",
        "Los permisos del rol Admin no se pueden modificar",
      );
    }

    await prisma.$transaction(async (tx) => {
      const updateData: Record<string, unknown> = {};
      if (body.label !== undefined) updateData.label = body.label;
      if (body.description !== undefined) updateData.description = body.description;
      if (Object.keys(updateData).length > 0) {
        await tx.role.update({ where: { id }, data: updateData });
      }

      if (body.permissions !== undefined) {
        // Roles system: sólo ADMIN está protegido. Para los demás system (OPERACIONES,
        // INGENIERIA, ASESOR_COMERCIAL, FINANZAS) se permite editar permisos.
        await tx.permission.deleteMany({ where: { roleId: id } });
        if (body.permissions.length > 0) {
          await tx.permission.createMany({
            data: body.permissions.map((p) => ({
              roleId: id,
              module: p.module,
              action: p.action,
            })),
            skipDuplicates: true,
          });
        }
      }
    });

    clearPermissionCache();

    await createAuditEntry({
      entityType: AuditEntityType.permission,
      entityId: id,
      userId: user.id,
      action: AuditAction.updated,
      description:
        body.permissions !== undefined
          ? `Actualizó rol '${existing.label}' (${body.permissions.length} permisos)`
          : `Actualizó metadata del rol '${existing.label}'`,
    });

    return { success: true };
  });

  app.delete("/roles/:id", { preHandler: authorize(Module.USUARIOS, Action.DELETE) }, async (request) => {
    const user = assertAdmin(request);
    const { id } = z.object({ id: z.string() }).parse(request.params);

    const existing = await prisma.role.findUnique({
      where: { id },
      include: { _count: { select: { users: { where: { deletedAt: null } } } } },
    });
    if (!existing) {
      throw notFound("ROLE_NOT_FOUND", "Rol no encontrado");
    }

    if (existing.isSystem) {
      throw new AppError(
        403,
        "SYSTEM_ROLE_PROTECTED",
        "Los roles del sistema no se pueden eliminar",
      );
    }

    if (existing._count.users > 0) {
      throw badRequest(
        "ROLE_IN_USE",
        `Este rol tiene ${existing._count.users} usuario(s) asignado(s). Reasignalos antes de eliminar.`,
      );
    }

    await prisma.role.delete({ where: { id } });
    clearPermissionCache();

    await createAuditEntry({
      entityType: AuditEntityType.permission,
      entityId: id,
      userId: user.id,
      action: AuditAction.deleted,
      description: `Eliminó rol '${existing.label}' (${existing.name})`,
    });

    return { success: true };
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
      select: {
        id: true, name: true, email: true, createdAt: true,
        role: { select: { id: true, name: true, label: true } },
      },
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
        createdAt: true,
        role: { select: { id: true, name: true, label: true } },
      },
      orderBy: { createdAt: "desc" },
    });

    return users.map(serializeUserSummary);
  });

  app.post("/users", { preHandler: authorize(Module.USUARIOS, Action.CREATE) }, async (request, reply) => {
    const currentUser = ensureUser(request);
    const body = userCreateSchema.parse(request.body);

    // Buscar rol por name (lanza 400 si no existe)
    const role = await prisma.role.findUnique({ where: { name: body.role } });
    if (!role) {
      throw badRequest("ROLE_NOT_FOUND", `El rol "${body.role}" no existe`);
    }

    const hashedPassword = await bcrypt.hash(body.password, 10);
    const user = await prisma.user.create({
      data: {
        name: body.name,
        email: body.email,
        password: hashedPassword,
        roleId: role.id,
      },
      select: {
        id: true,
        name: true,
        email: true,
        createdAt: true,
        role: { select: { id: true, name: true, label: true } },
      },
    });

    await createAuditEntry({
      entityType: AuditEntityType.user,
      entityId: user.id,
      userId: currentUser.id,
      action: AuditAction.created,
      description: `Creó usuario '${user.name}' con rol ${user.role.name}`,
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
      include: { role: { select: { id: true, name: true, label: true } } },
    });

    if (!existingUser) {
      throw notFound("USER_NOT_FOUND", "Usuario no encontrado");
    }

    let newRoleId: string | undefined;
    if (body.role !== undefined && body.role !== existingUser.role.name) {
      const role = await prisma.role.findUnique({ where: { name: body.role } });
      if (!role) {
        throw badRequest("ROLE_NOT_FOUND", `El rol "${body.role}" no existe`);
      }
      newRoleId = role.id;
    }

    const updatedUser = await prisma.user.update({
      where: { id: existingUser.id },
      data: {
        ...(body.name !== undefined && { name: body.name }),
        ...(body.email !== undefined && { email: body.email }),
        ...(newRoleId !== undefined && { roleId: newRoleId }),
      },
      select: {
        id: true,
        name: true,
        email: true,
        createdAt: true,
        role: { select: { id: true, name: true, label: true } },
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

    if (body.role !== undefined && body.role !== existingUser.role.name) {
      await createAuditEntry({
        entityType: AuditEntityType.user,
        entityId: existingUser.id,
        userId: currentUser.id,
        action: AuditAction.role_changed,
        fieldChanged: "role",
        oldValue: existingUser.role.name,
        newValue: body.role,
        description: `Cambió rol del usuario '${existingUser.name}' de ${existingUser.role.name} a ${body.role}`,
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
    const isAdmin = currentUser.role === "ADMIN";

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
      include: { role: { select: { name: true } } },
    });

    if (!targetUser) {
      throw notFound("USER_NOT_FOUND", "Usuario no encontrado");
    }

    if (targetUser.role.name === "ADMIN") {
      const activeAdmins = await prisma.user.count({
        where: {
          role: { name: "ADMIN" },
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

    if (existingComment.authorId !== user.id && user.role !== "ADMIN") {
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

    if (existingComment.authorId !== user.id && user.role !== "ADMIN") {
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

  // ─── Admin: repair completed projects without actualEndDate ─────────────────
  app.post("/admin/repair-completed-projects", { preHandler: authorize(Module.CONFIGURACION, Action.EDIT) }, async () => {
    const candidateProjects = await prisma.project.findMany({
      where: {
        status: { in: [ProjectStatus.COMPLETED, ProjectStatus.ACTIVE] },
        deletedAt: null,
      },
      include: {
        stages: { select: { status: true, actualEndDate: true, plannedEndDate: true } },
      },
    });

    let fixed = 0;
    for (const project of candidateProjects) {
      if (project.stages.length === 0) continue;
      const allDone = project.stages.every((s) => s.status === StageStatus.COMPLETED);
      if (!allDone) continue;
      const alreadyOk = project.status === ProjectStatus.COMPLETED && project.actualEndDate;
      if (alreadyOk) continue;

      const lastActualEnd = project.stages
        .map((s) => s.actualEndDate)
        .filter(Boolean)
        .sort((a, b) => (b as Date).getTime() - (a as Date).getTime())[0];
      const endDate = project.actualEndDate ?? lastActualEnd ?? todayUtc();

      await prisma.project.update({
        where: { id: project.id },
        data: {
          status: ProjectStatus.COMPLETED,
          actualEndDate: endDate,
        },
      });
      fixed++;
    }

    return { fixed, total: candidateProjects.length };
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

  // ─── Equipos instaladores ────────────────────────────────────────────────────

  const teamCreateSchema = z
    .object({
      name: z.string().trim().min(1),
      color: z
        .string()
        .trim()
        .regex(/^#[0-9A-Fa-f]{6}$/, "Color debe ser hex (#RRGGBB)")
        .default("#378ADD"),
      notes: z.string().trim().nullable().optional(),
    })
    .strict();

  const teamPatchSchema = z
    .object({
      name: z.string().trim().min(1).optional(),
      color: z
        .string()
        .trim()
        .regex(/^#[0-9A-Fa-f]{6}$/, "Color debe ser hex (#RRGGBB)")
        .optional(),
      notes: z.string().trim().nullable().optional(),
    })
    .strict();

  function serializeTeam(t: {
    id: string;
    name: string;
    color: string;
    notes: string | null;
    createdAt: Date;
    updatedAt: Date;
    deletedAt: Date | null;
  }) {
    return {
      id: t.id,
      name: t.name,
      color: t.color,
      notes: t.notes,
      createdAt: serializeDate(t.createdAt),
      updatedAt: serializeDate(t.updatedAt),
      deletedAt: serializeDate(t.deletedAt),
    };
  }

  // ─── Pipeline template (config del pipeline precargado al crear proyecto) ────

  const pipelineChecklistItemSchema = z.object({
    label: z.string().min(1),
    isRequired: z.boolean().optional(),
    isBlocker: z.boolean().optional(),
    appliesWhenModalidadPago: z.nativeEnum(ModalidadPago).nullable().optional(),
  }).strict();

  const pipelineSubstageSchema = z.object({
    order: z.number().int().min(1),
    name: z.string().min(1),
    sopCode: z.string().nullable().optional(),
    responsableRol: z.string().nullable().optional(),
    responsible: z.string().min(1),
    isSystem: z.boolean().optional(),
    isActive: z.boolean().optional(),
    operationVariant: z.nativeEnum(TipoObra).nullable().optional(),
    checklist: z.array(pipelineChecklistItemSchema).optional(),
  }).strict();

  const pipelineStageSchema = z.object({
    order: z.number().int().min(1),
    name: z.nativeEnum(StageType),
    label: z.string().trim().min(1).nullable().optional(),
    weight: z.number().min(0).max(100),
    substages: z.array(pipelineSubstageSchema),
  }).strict();

  const pipelineTemplatePutSchema = z.object({
    stages: z.array(pipelineStageSchema).length(5, "El template debe tener las 5 etapas"),
  }).strict();

  app.get("/pipeline-template", { preHandler: authorize(Module.CONFIGURACION, Action.VIEW) }, async () => {
    const template = await getActivePipelineTemplate();
    const setting = await prisma.setting.findFirst({
      where: { key: SettingKey.PIPELINE_TEMPLATE, level: SettingLevel.SYSTEM },
    });
    return {
      stages: template,
      isCustom: setting !== null,
      updatedAt: setting ? serializeDate(setting.updatedAt) : null,
    };
  });

  app.put("/pipeline-template", { preHandler: authorize(Module.CONFIGURACION, Action.EDIT) }, async (request) => {
    const user = ensureUser(request);
    if (user.role !== "ADMIN") {
      throw new AppError(403, "ADMIN_REQUIRED", "Solo admin puede editar el template del pipeline");
    }
    const body = pipelineTemplatePutSchema.parse(request.body);

    // Validar que las 5 etapas sean las esperadas, sin duplicados
    const stageNames = new Set(body.stages.map((s) => s.name));
    if (stageNames.size !== 5) {
      throw badRequest("INVALID_TEMPLATE", "El template debe tener las 5 etapas únicas (ONBOARDING, INGENIERIA, OPERACIONES, HABILITACION_UTE, POSTVENTA)");
    }
    const expected: StageType[] = [
      StageType.ONBOARDING,
      StageType.INGENIERIA,
      StageType.OPERACIONES,
      StageType.HABILITACION_UTE,
      StageType.POSTVENTA,
    ];
    for (const name of expected) {
      if (!stageNames.has(name)) {
        throw badRequest("INVALID_TEMPLATE", `Falta la etapa ${name} en el template`);
      }
    }

    const json = JSON.stringify({ stages: body.stages });
    // Setting.userId y Setting.projectId son nullable; el @@unique con nullables
    // no matchea igual → hacemos find-then-update/create manual.
    const existing = await prisma.setting.findFirst({
      where: {
        level: SettingLevel.SYSTEM,
        key: SettingKey.PIPELINE_TEMPLATE,
      },
    });
    const saved = existing
      ? await prisma.setting.update({
          where: { id: existing.id },
          data: { value: json, updatedById: user.id },
        })
      : await prisma.setting.create({
          data: {
            level: SettingLevel.SYSTEM,
            key: SettingKey.PIPELINE_TEMPLATE,
            value: json,
            updatedById: user.id,
          },
        });

    await createAuditEntry({
      entityType: AuditEntityType.setting,
      entityId: saved.id,
      userId: user.id,
      action: AuditAction.updated,
      description: "Actualizó template del pipeline",
      metadata: {
        stagesCount: body.stages.length,
        substagesCount: body.stages.reduce((sum, s) => sum + s.substages.length, 0),
        checklistCount: body.stages.reduce(
          (sum, s) => sum + s.substages.reduce((sub, ss) => sub + (ss.checklist?.length ?? 0), 0),
          0,
        ),
      },
    });

    return {
      stages: body.stages,
      isCustom: true,
      updatedAt: serializeDate(saved.updatedAt),
    };
  });

  app.delete("/pipeline-template", { preHandler: authorize(Module.CONFIGURACION, Action.DELETE) }, async (request) => {
    // Volver al default hardcoded: borra el registro en settings
    const user = ensureUser(request);
    if (user.role !== "ADMIN") {
      throw new AppError(403, "ADMIN_REQUIRED", "Solo admin puede editar el template del pipeline");
    }
    await prisma.setting.deleteMany({
      where: { key: SettingKey.PIPELINE_TEMPLATE, level: SettingLevel.SYSTEM },
    });
    await createAuditEntry({
      entityType: AuditEntityType.setting,
      entityId: "pipeline-template",
      userId: user.id,
      action: AuditAction.deleted,
      description: "Restauró el template del pipeline al default",
    });
    return { success: true };
  });

  app.get("/teams", { preHandler: authorize(Module.CONFIGURACION, Action.VIEW) }, async (request) => {
    const query = z
      .object({
        includeDeleted: z.union([z.literal("true"), z.literal("false")]).optional(),
      })
      .parse(request.query);
    const teams = await prisma.team.findMany({
      where: query.includeDeleted === "true" ? undefined : { deletedAt: null },
      orderBy: { name: "asc" },
    });
    return teams.map(serializeTeam);
  });

  app.post("/teams", { preHandler: authorize(Module.CONFIGURACION, Action.CREATE) }, async (request, reply) => {
    const user = ensureUser(request);
    const body = teamCreateSchema.parse(request.body);

    const existing = await prisma.team.findUnique({ where: { name: body.name } });
    if (existing) {
      if (existing.deletedAt === null) {
        throw conflict("TEAM_NAME_DUPLICATE", `Ya existe un equipo con el nombre "${body.name}"`);
      }
      // Reactivar equipo previamente soft-deleted con el mismo nombre
      const reactivated = await prisma.team.update({
        where: { id: existing.id },
        data: {
          deletedAt: null,
          color: body.color,
          notes: body.notes ?? null,
        },
      });
      await createAuditEntry({
        entityType: AuditEntityType.team,
        entityId: reactivated.id,
        userId: user.id,
        action: AuditAction.created,
        description: `Reactivó equipo: ${reactivated.name}`,
      });
      reply.code(201);
      return serializeTeam(reactivated);
    }

    const team = await prisma.team.create({
      data: {
        name: body.name,
        color: body.color,
        notes: body.notes ?? null,
        createdBy: user.id,
      },
    });
    await createAuditEntry({
      entityType: AuditEntityType.team,
      entityId: team.id,
      userId: user.id,
      action: AuditAction.created,
      description: `Creó equipo: ${team.name}`,
    });
    reply.code(201);
    return serializeTeam(team);
  });

  app.patch("/teams/:id", { preHandler: authorize(Module.CONFIGURACION, Action.EDIT) }, async (request) => {
    const user = ensureUser(request);
    const { id } = z.object({ id: z.string() }).parse(request.params);
    const body = teamPatchSchema.parse(request.body);

    const existing = await prisma.team.findFirst({ where: { id, deletedAt: null } });
    if (!existing) throw notFound("TEAM_NOT_FOUND", "Equipo no encontrado");

    if (body.name && body.name !== existing.name) {
      const collision = await prisma.team.findFirst({
        where: { name: body.name, NOT: { id }, deletedAt: null },
      });
      if (collision) {
        throw conflict("TEAM_NAME_DUPLICATE", `Ya existe un equipo con el nombre "${body.name}"`);
      }
    }

    const updated = await prisma.team.update({ where: { id }, data: body });

    // Si cambió el name o color, sincronizar el snapshot en installation_schedules
    const nameChanged = body.name !== undefined && body.name !== existing.name;
    const colorChanged = body.color !== undefined && body.color !== existing.color;
    if (nameChanged || colorChanged) {
      const snapshotData: Prisma.InstallationScheduleUpdateManyMutationInput = {};
      if (nameChanged) snapshotData.teamName = body.name!;
      if (colorChanged) snapshotData.teamColor = body.color!;
      await prisma.installationSchedule.updateMany({
        where: { teamId: id, deletedAt: null },
        data: snapshotData,
      });
    }

    await createAuditEntriesForChanges({
      entityType: AuditEntityType.team,
      entityId: id,
      projectId: null,
      userId: user.id,
      oldData: existing as unknown as Record<string, unknown>,
      newData: updated as unknown as Record<string, unknown>,
      labels: { name: "nombre", color: "color", notes: "notas" },
      formatter: ({ label, oldValue, newValue }) =>
        `Actualizó ${label} del equipo ${existing.name} de ${oldValue ?? "vacío"} a ${newValue ?? "vacío"}`,
    });

    return serializeTeam(updated);
  });

  app.delete("/teams/:id", { preHandler: authorize(Module.CONFIGURACION, Action.DELETE) }, async (request) => {
    const user = ensureUser(request);
    const { id } = z.object({ id: z.string() }).parse(request.params);

    const existing = await prisma.team.findFirst({ where: { id, deletedAt: null } });
    if (!existing) throw notFound("TEAM_NOT_FOUND", "Equipo no encontrado");

    await prisma.team.update({ where: { id }, data: { deletedAt: new Date() } });
    // Nullify teamId en instalaciones relacionadas; mantienen el snapshot
    await prisma.installationSchedule.updateMany({
      where: { teamId: id, deletedAt: null },
      data: { teamId: null },
    });

    await createAuditEntry({
      entityType: AuditEntityType.team,
      entityId: id,
      userId: user.id,
      action: AuditAction.deleted,
      description: `Eliminó equipo: ${existing.name}`,
    });

    return { success: true };
  });

  // ─── Calendario de instalaciones ─────────────────────────────────────────────

  const segmentInputSchema = z.object({
    startDate: dateOnlySchema,
    endDate: dateOnlySchema,
    notes: z.string().trim().nullable().optional(),
  }).strict();

  const calendarCreateSchema = z.object({
    projectId: z.string().min(1),
    teamId: z.string().min(1),
    notes: z.string().trim().optional().nullable(),
    // Acepta el formato nuevo (segments) o, por retrocompat, plannedWorkStart/End
    // (que se convierten automáticamente en un único segment).
    segments: z.array(segmentInputSchema).min(1).optional(),
    plannedWorkStart: dateOnlySchema.optional(),
    plannedWorkEnd: dateOnlySchema.optional(),
  }).refine(
    (v) => v.segments !== undefined || (v.plannedWorkStart !== undefined && v.plannedWorkEnd !== undefined),
    { message: "Hay que enviar segments o plannedWorkStart/plannedWorkEnd" },
  );

  const calendarPatchSchema = z.object({
    teamId: z.string().min(1).optional(),
    notes: z.string().trim().nullable().optional(),
    // Si viene segments se reemplazan todos los tramos.
    segments: z.array(segmentInputSchema).min(1).optional(),
    // Compat: si viene un único rango, se trata como reemplazo total por 1 segment.
    plannedWorkStart: dateOnlySchema.optional(),
    plannedWorkEnd: dateOnlySchema.optional(),
  }).strict();

  function assertSegmentsNoOverlap(segments: Array<{ startDate: Date; endDate: Date }>) {
    const sorted = [...segments].sort((a, b) => a.startDate.getTime() - b.startDate.getTime());
    for (let i = 0; i < sorted.length; i++) {
      const s = sorted[i];
      if (s.endDate.getTime() < s.startDate.getTime()) {
        throw badRequest("INVALID_DATE_RANGE", "La fecha de fin debe ser mayor o igual a la de inicio");
      }
      if (i > 0) {
        const prev = sorted[i - 1];
        if (s.startDate.getTime() <= prev.endDate.getTime()) {
          throw badRequest(
            "SEGMENTS_OVERLAP",
            `Las fechas se superponen con el tramo del ${toDateOnlyString(prev.startDate)} al ${toDateOnlyString(prev.endDate)}`,
          );
        }
      }
    }
  }

  function envelopeOf(segments: Array<{ startDate: Date; endDate: Date }>) {
    if (segments.length === 0) {
      throw badRequest("NO_SEGMENTS", "Una instalación debe tener al menos un tramo");
    }
    let start = segments[0].startDate;
    let end = segments[0].endDate;
    for (const s of segments) {
      if (s.startDate.getTime() < start.getTime()) start = s.startDate;
      if (s.endDate.getTime() > end.getTime()) end = s.endDate;
    }
    return { start, end };
  }

  function normalizeIncomingSegments(
    input: { segments?: Array<{ startDate: string; endDate: string; notes?: string | null }> } &
          { plannedWorkStart?: string; plannedWorkEnd?: string },
  ): Array<{ startDate: Date; endDate: Date; notes: string | null }> {
    const list = input.segments
      ? input.segments.map((s) => ({
          startDate: parseDateOnly(s.startDate),
          endDate: parseDateOnly(s.endDate),
          notes: s.notes ?? null,
        }))
      : input.plannedWorkStart && input.plannedWorkEnd
        ? [{
            startDate: parseDateOnly(input.plannedWorkStart),
            endDate: parseDateOnly(input.plannedWorkEnd),
            notes: null,
          }]
        : [];
    assertSegmentsNoOverlap(list);
    return list;
  }

  async function loadActiveTeamOrThrow(teamId: string) {
    const team = await prisma.team.findFirst({ where: { id: teamId, deletedAt: null } });
    if (!team) {
      throw badRequest("TEAM_NOT_FOUND", "El equipo seleccionado no existe o fue eliminado");
    }
    return team;
  }

  function formatDateEs(date: Date): string {
    return `${String(date.getUTCDate()).padStart(2, "0")}/${String(date.getUTCMonth() + 1).padStart(2, "0")}/${date.getUTCFullYear()}`;
  }

  type InstallationValidationResult =
    | { ok: false; error: { code: string; message: string } }
    | { ok: true; warning: { code: string; message: string } | null };

  // Regla 1: verificar coherencia entre fechas de instalación y etapa OPERACIONES
  async function validateInstallationAgainstOperations(
    projectId: string,
    plannedWorkStart: Date,
    plannedWorkEnd: Date,
  ): Promise<InstallationValidationResult> {
    const operations = await prisma.stage.findFirst({
      where: { projectId, name: StageType.OPERACIONES },
      select: {
        actualStartDate: true,
        actualEndDate: true,
        plannedStartDate: true,
        plannedEndDate: true,
      },
    });

    if (!operations) return { ok: true, warning: null };

    // Caso B: instalación empieza antes del inicio real de Operaciones
    if (operations.actualStartDate && plannedWorkStart.getTime() < operations.actualStartDate.getTime()) {
      return {
        ok: false,
        error: {
          code: "INSTALL_BEFORE_OPERATIONS",
          message: `La instalación no puede empezar antes del inicio real de la etapa Operaciones (${formatDateEs(operations.actualStartDate)}). Ajustá las fechas de instalación.`,
        },
      };
    }

    // Caso C: instalación termina después del fin real de Operaciones
    if (operations.actualEndDate && plannedWorkEnd.getTime() > operations.actualEndDate.getTime()) {
      return {
        ok: false,
        error: {
          code: "INSTALL_AFTER_OPERATIONS",
          message: `La instalación no puede terminar después del cierre real de la etapa Operaciones (${formatDateEs(operations.actualEndDate)}). Ajustá las fechas de instalación.`,
        },
      };
    }

    // Caso D: fuera del rango planificado (pero dentro de real) → warning
    if (operations.plannedStartDate && operations.plannedEndDate) {
      const outsidePlanned =
        plannedWorkStart.getTime() < operations.plannedStartDate.getTime() ||
        plannedWorkEnd.getTime() > operations.plannedEndDate.getTime();
      if (outsidePlanned) {
        return {
          ok: true,
          warning: {
            code: "INSTALL_OUTSIDE_PLANNED_RANGE",
            message: `La instalación queda fuera del rango planificado de la etapa Operaciones (plan: ${formatDateEs(operations.plannedStartDate)} → ${formatDateEs(operations.plannedEndDate)}). Podés continuar pero revisá la planificación.`,
          },
        };
      }
    }

    return { ok: true, warning: null };
  }

  // Regla 2: identifica si una subetapa es de ejecución de obra
  // (la spec pide OPERACIONES_OBRA_PROPIA/TERCERIZADA pero esos enums no existen;
  // las subetapas se identifican por nombre "Ejecución de Obra" bajo stage OPERACIONES)
  function isInstallationWorkSubstage(
    substageName: string,
    stage: { name: StageType },
  ): boolean {
    if (stage.name !== StageType.OPERACIONES) return false;
    return substageName.toLowerCase().includes("ejecución de obra");
  }

  function serializeSegment(seg: {
    id: string;
    scheduleId: string;
    startDate: Date;
    endDate: Date;
    notes: string | null;
    createdAt: Date;
    updatedAt: Date;
  }) {
    return {
      id: seg.id,
      scheduleId: seg.scheduleId,
      startDate: serializeDateOnly(seg.startDate)!,
      endDate: serializeDateOnly(seg.endDate)!,
      notes: seg.notes,
      createdAt: serializeDate(seg.createdAt),
      updatedAt: serializeDate(seg.updatedAt),
    };
  }

  function serializeSchedule(s: {
    id: string;
    projectId: string;
    teamId: string | null;
    team?: { id: string; name: string; color: string; deletedAt: Date | null } | null;
    teamName: string;
    teamColor: string;
    actualWorkEnd: Date | null;
    confirmedAt: Date | null;
    confirmedBy: string | null;
    confirmedByUser?: { id: string; name: string } | null;
    notes: string | null;
    createdBy: string | null;
    createdAt: Date;
    updatedAt: Date;
    deletedAt?: Date | null;
    segments: Array<{
      id: string;
      scheduleId: string;
      startDate: Date;
      endDate: Date;
      notes: string | null;
      createdAt: Date;
      updatedAt: Date;
    }>;
    project?: {
      id: string;
      clientName: string;
      code: string;
      capacityKwp: Prisma.Decimal;
      locationCity: string;
      stages?: Array<{ name: StageType; tipoObra: TipoObra | null; status: StageStatus }>;
    };
  }) {
    const operationsStage = s.project?.stages?.find((st) => st.name === StageType.OPERACIONES);
    const workType = operationsStage?.tipoObra ?? null;
    const operationsCompleted = operationsStage?.status === StageStatus.COMPLETED;
    const sortedSegments = [...s.segments].sort(
      (a, b) => a.startDate.getTime() - b.startDate.getTime(),
    );
    const envelope = sortedSegments.length > 0
      ? {
          start: sortedSegments[0].startDate,
          end: sortedSegments.reduce((acc, seg) => (seg.endDate > acc ? seg.endDate : acc), sortedSegments[0].endDate),
        }
      : null;
    return {
      id: s.id,
      projectId: s.projectId,
      teamId: s.teamId,
      team:
        s.team && s.team.deletedAt === null
          ? { id: s.team.id, name: s.team.name, color: s.team.color }
          : null,
      teamName: s.teamName,
      teamColor: s.teamColor,
      // Envelope: min/max de todos los segments. Lo seguimos exponiendo para que
      // el resto del código (lista de proyectos, chequeos, etc.) no rompa.
      plannedWorkStart: envelope ? serializeDateOnly(envelope.start) : null,
      plannedWorkEnd: envelope ? serializeDateOnly(envelope.end) : null,
      actualWorkEnd: serializeDateOnly(s.actualWorkEnd),
      confirmedAt: serializeDate(s.confirmedAt),
      confirmedBy: s.confirmedBy,
      confirmedByUser: s.confirmedByUser
        ? { id: s.confirmedByUser.id, name: s.confirmedByUser.name }
        : null,
      notes: s.notes,
      operationsCompleted,
      createdAt: serializeDate(s.createdAt),
      updatedAt: serializeDate(s.updatedAt),
      segments: sortedSegments.map(serializeSegment),
      project: s.project
        ? {
            id: s.project.id,
            clientName: s.project.clientName,
            code: s.project.code,
            capacityKwp: decimalToNumber(s.project.capacityKwp),
            locationCity: s.project.locationCity,
            workType,
          }
        : null,
    };
  }

  app.get("/calendar", { preHandler: authorize(Module.OPERACIONES, Action.VIEW) }, async (request) => {
    const query = z
      .object({
        year: z.coerce.number().int().min(2000).max(2100),
        month: z.coerce.number().int().min(1).max(12).optional(),
      })
      .parse(request.query);

    let rangeStart: Date;
    let rangeEnd: Date;

    if (query.month !== undefined) {
      // Vista mensual: grilla Lu-Do que cubre todo el mes
      const firstDay = new Date(Date.UTC(query.year, query.month - 1, 1));
      const lastDay = new Date(Date.UTC(query.year, query.month, 0));
      const firstDayDow = firstDay.getUTCDay();
      const offsetToMonday = firstDayDow === 0 ? -6 : 1 - firstDayDow;
      rangeStart = new Date(firstDay);
      rangeStart.setUTCDate(rangeStart.getUTCDate() + offsetToMonday);
      const lastDayDow = lastDay.getUTCDay();
      const offsetToSunday = lastDayDow === 0 ? 0 : 7 - lastDayDow;
      rangeEnd = new Date(lastDay);
      rangeEnd.setUTCDate(rangeEnd.getUTCDate() + offsetToSunday);
    } else {
      // Vista anual: todo el año
      rangeStart = new Date(Date.UTC(query.year, 0, 1));
      rangeEnd = new Date(Date.UTC(query.year, 11, 31));
    }

    // Traemos los schedules que tienen al menos un segment dentro del rango.
    const schedules = await prisma.installationSchedule.findMany({
      where: {
        deletedAt: null,
        segments: {
          some: {
            startDate: { lte: rangeEnd },
            endDate: { gte: rangeStart },
          },
        },
      },
      include: {
        project: {
          include: {
            stages: { select: { name: true, tipoObra: true, status: true } },
          },
        },
        team: true,
        confirmedByUser: { select: { id: true, name: true } },
        segments: { orderBy: { startDate: "asc" } },
      },
    });

    const sortedSchedules = schedules.sort((a, b) => {
      const aStart = a.segments[0]?.startDate?.getTime() ?? 0;
      const bStart = b.segments[0]?.startDate?.getTime() ?? 0;
      return aStart - bStart;
    });

    return {
      schedules: sortedSchedules.map((s) => serializeSchedule(s)),
      range: {
        start: toDateOnlyString(rangeStart),
        end: toDateOnlyString(rangeEnd),
      },
    };
  });

  app.get("/calendar/teams", { preHandler: authorize(Module.OPERACIONES, Action.VIEW) }, async () => {
    // Devuelve equipos activos para selectores y filtros del calendario
    const teams = await prisma.team.findMany({
      where: { deletedAt: null },
      orderBy: { name: "asc" },
    });
    return teams.map((t) => ({ id: t.id, teamName: t.name, teamColor: t.color }));
  });

  app.post("/calendar", { preHandler: authorize(Module.OPERACIONES, Action.CREATE) }, async (request, reply) => {
    const user = ensureUser(request);
    const body = calendarCreateSchema.parse(request.body);
    const segments = normalizeIncomingSegments(body);
    const { start: envStart, end: envEnd } = envelopeOf(segments);

    const project = await prisma.project.findFirst({
      where: { id: body.projectId, deletedAt: null },
      include: { installationSchedule: true },
    });
    if (!project) {
      throw notFound("PROJECT_NOT_FOUND", "Proyecto no encontrado");
    }

    const existing = project.installationSchedule;
    if (existing && !existing.deletedAt) {
      throw conflict(
        "INSTALLATION_ALREADY_SCHEDULED",
        `El proyecto ya tiene una instalación agendada`,
      );
    }

    // Regla 1: verificar coherencia con OPERACIONES (aplicada sobre el envelope)
    const validation = await validateInstallationAgainstOperations(body.projectId, envStart, envEnd);
    if (!validation.ok) {
      throw badRequest(validation.error.code, validation.error.message);
    }

    const team = await loadActiveTeamOrThrow(body.teamId);

    const commonData = {
      teamId: team.id,
      teamName: team.name,
      teamColor: team.color,
      notes: body.notes ?? null,
      createdBy: user.id,
    };

    let created;
    if (existing && existing.deletedAt) {
      created = await prisma.installationSchedule.update({
        where: { id: existing.id },
        data: {
          ...commonData,
          deletedAt: null,
          confirmedAt: null,
          confirmedBy: null,
          segments: {
            deleteMany: {},
            create: segments,
          },
        },
        include: {
          project: { include: { stages: { select: { name: true, tipoObra: true, status: true } } } },
          team: true,
          confirmedByUser: { select: { id: true, name: true } },
          segments: { orderBy: { startDate: "asc" } },
        },
      });
    } else {
      created = await prisma.installationSchedule.create({
        data: {
          projectId: body.projectId,
          ...commonData,
          segments: { create: segments },
        },
        include: {
          project: { include: { stages: { select: { name: true, tipoObra: true, status: true } } } },
          team: true,
          confirmedByUser: { select: { id: true, name: true } },
          segments: { orderBy: { startDate: "asc" } },
        },
      });
    }

    await createAuditEntry({
      entityType: AuditEntityType.installation_schedule,
      entityId: created.id,
      projectId: created.projectId,
      userId: user.id,
      action: AuditAction.created,
      description: `Instalación de ${project.clientName} agendada (${segments.length} tramo${segments.length === 1 ? "" : "s"})`,
      metadata: { teamName: created.teamName, teamColor: created.teamColor, segmentsCount: segments.length },
    });

    reply.code(201);
    return { data: serializeSchedule(created), warning: validation.warning };
  });

  app.patch("/calendar/:id", { preHandler: authorize(Module.OPERACIONES, Action.EDIT) }, async (request) => {
    const user = ensureUser(request);
    const params = z.object({ id: z.string() }).parse(request.params);
    const body = calendarPatchSchema.parse(request.body);

    const existing = await prisma.installationSchedule.findFirst({
      where: { id: params.id, deletedAt: null },
      include: { segments: { orderBy: { startDate: "asc" } } },
    });
    if (!existing) {
      throw notFound("INSTALLATION_NOT_FOUND", "Instalación no encontrada");
    }

    const updateData: Prisma.InstallationScheduleUpdateInput = {};
    if (body.notes !== undefined) updateData.notes = body.notes;
    if (body.teamId !== undefined) {
      const team = await loadActiveTeamOrThrow(body.teamId);
      updateData.team = { connect: { id: team.id } };
      updateData.teamName = team.name;
      updateData.teamColor = team.color;
    }

    // Si viene segments o plannedWorkStart/End, se reemplazan todos los tramos.
    const wantsSegmentReplace =
      body.segments !== undefined ||
      body.plannedWorkStart !== undefined ||
      body.plannedWorkEnd !== undefined;
    if (wantsSegmentReplace) {
      const segments = normalizeIncomingSegments(body);
      const { start: envStart, end: envEnd } = envelopeOf(segments);
      const validation = await validateInstallationAgainstOperations(existing.projectId, envStart, envEnd);
      if (!validation.ok) {
        throw badRequest(validation.error.code, validation.error.message);
      }
      updateData.segments = {
        deleteMany: {},
        create: segments,
      };
    }

    const updated = await prisma.installationSchedule.update({
      where: { id: existing.id },
      data: updateData,
      include: {
        project: { include: { stages: { select: { name: true, tipoObra: true, status: true } } } },
        team: true,
        confirmedByUser: { select: { id: true, name: true } },
        segments: { orderBy: { startDate: "asc" } },
      },
    });

    await createAuditEntry({
      entityType: AuditEntityType.installation_schedule,
      entityId: existing.id,
      projectId: existing.projectId,
      userId: user.id,
      action: AuditAction.updated,
      description: wantsSegmentReplace
        ? `Actualizó los tramos de la instalación (${updated.segments.length})`
        : `Actualizó la instalación`,
    });

    return serializeSchedule(updated);
  });

  app.patch("/calendar/:id/confirm", { preHandler: authorize(Module.OPERACIONES, Action.EDIT) }, async (request) => {
    const user = ensureUser(request);
    const params = z.object({ id: z.string() }).parse(request.params);

    const existing = await prisma.installationSchedule.findFirst({
      where: { id: params.id, deletedAt: null },
    });
    if (!existing) {
      throw notFound("INSTALLATION_NOT_FOUND", "Instalación no encontrada");
    }

    const updated = await prisma.installationSchedule.update({
      where: { id: existing.id },
      data: {
        confirmedAt: new Date(),
        confirmedBy: user.id,
      },
      include: {
        project: { include: { stages: { select: { name: true, tipoObra: true, status: true } } } },
        team: true,
        confirmedByUser: { select: { id: true, name: true } },
        segments: { orderBy: { startDate: "asc" } },
      },
    });

    await createAuditEntry({
      entityType: AuditEntityType.installation_schedule,
      entityId: existing.id,
      projectId: existing.projectId,
      userId: user.id,
      action: AuditAction.updated,
      description: "Fecha de instalación confirmada",
    });

    return serializeSchedule(updated);
  });

  app.get("/projects/:id/installation-check", { preHandler: authorize(Module.OPERACIONES, Action.VIEW) }, async (request) => {
    const params = z.object({ id: z.string() }).parse(request.params);

    const project = await prisma.project.findFirst({
      where: { id: params.id, deletedAt: null },
      include: {
        installationSchedule: {
          include: { segments: { orderBy: { startDate: "asc" } } },
        },
        stages: {
          where: { name: StageType.OPERACIONES },
          select: {
            status: true,
            plannedStartDate: true,
            plannedEndDate: true,
            actualStartDate: true,
            actualEndDate: true,
          },
          take: 1,
        },
      },
    });
    if (!project) {
      throw notFound("PROJECT_NOT_FOUND", "Proyecto no encontrado");
    }

    const install = project.installationSchedule && !project.installationSchedule.deletedAt
      ? project.installationSchedule
      : null;
    const operations = project.stages[0] ?? null;

    // Para los chequeos de coherencia usamos el envelope (primer inicio / último fin).
    const installEnvelope = install && install.segments.length > 0
      ? envelopeOf(install.segments)
      : null;

    const issues: Array<{ severity: "error" | "warning"; code: string; message: string }> = [];

    if (install && installEnvelope && operations) {
      if (
        operations.actualStartDate &&
        installEnvelope.start.getTime() < operations.actualStartDate.getTime()
      ) {
        issues.push({
          severity: "error",
          code: "INSTALL_BEFORE_OPERATIONS",
          message: `La instalación empieza el ${formatDateEs(installEnvelope.start)} pero Operaciones recién arrancó el ${formatDateEs(operations.actualStartDate)}.`,
        });
      }
      if (
        operations.actualEndDate &&
        installEnvelope.end.getTime() > operations.actualEndDate.getTime()
      ) {
        issues.push({
          severity: "error",
          code: "INSTALL_AFTER_OPERATIONS",
          message: `La instalación termina el ${formatDateEs(installEnvelope.end)} pero Operaciones cerró el ${formatDateEs(operations.actualEndDate)}.`,
        });
      }
      if (operations.plannedStartDate && operations.plannedEndDate) {
        const outside =
          installEnvelope.start.getTime() < operations.plannedStartDate.getTime() ||
          installEnvelope.end.getTime() > operations.plannedEndDate.getTime();
        if (outside) {
          issues.push({
            severity: "warning",
            code: "INSTALL_OUTSIDE_PLANNED_RANGE",
            message: `La instalación queda fuera del rango planificado de Operaciones (${formatDateEs(operations.plannedStartDate)} → ${formatDateEs(operations.plannedEndDate)}).`,
          });
        }
      }
    }

    return {
      hasInstallation: install !== null,
      plannedWorkStart: installEnvelope ? serializeDateOnly(installEnvelope.start) : null,
      plannedWorkEnd: installEnvelope ? serializeDateOnly(installEnvelope.end) : null,
      actualWorkEnd: install ? serializeDateOnly(install.actualWorkEnd) : null,
      operationsStatus: operations?.status ?? null,
      operationsActualStart: operations ? serializeDateOnly(operations.actualStartDate) : null,
      operationsActualEnd: operations ? serializeDateOnly(operations.actualEndDate) : null,
      issues,
    };
  });

  // Reprograma un tramo (segment) puntual. Si no se manda segmentId y el schedule
  // tiene exactamente 1 tramo, se toma ese como default (compat con el flujo viejo).
  app.patch("/calendar/:id/reschedule", { preHandler: authorize(Module.OPERACIONES, Action.EDIT) }, async (request) => {
    const user = ensureUser(request);
    const params = z.object({ id: z.string() }).parse(request.params);
    const body = z
      .object({
        plannedWorkStart: dateOnlySchema,
        plannedWorkEnd: dateOnlySchema,
        segmentId: z.string().optional(),
      })
      .strict()
      .parse(request.body);

    const existing = await prisma.installationSchedule.findFirst({
      where: { id: params.id, deletedAt: null },
      include: { segments: { orderBy: { startDate: "asc" } } },
    });
    if (!existing) {
      throw notFound("INSTALLATION_NOT_FOUND", "Instalación no encontrada");
    }

    const newStart = parseDateOnly(body.plannedWorkStart);
    const newEnd = parseDateOnly(body.plannedWorkEnd);
    if (newEnd.getTime() < newStart.getTime()) {
      throw badRequest("INVALID_DATE_RANGE", "La fecha de fin debe ser mayor o igual a la de inicio");
    }

    // Permitimos fechas pasadas a propósito: sirve para ajustar el calendario
    // a las fechas reales en las que se ejecutó la obra.

    const targetSegment = body.segmentId
      ? existing.segments.find((s) => s.id === body.segmentId)
      : existing.segments.length === 1
        ? existing.segments[0]
        : null;
    if (!targetSegment) {
      if (body.segmentId) {
        throw notFound("SEGMENT_NOT_FOUND", "Tramo no encontrado");
      }
      throw badRequest("SEGMENT_ID_REQUIRED", "Indicá qué tramo querés reprogramar");
    }

    // Validar que el nuevo rango del segment no pise otros tramos del mismo schedule.
    const nextSegments = existing.segments.map((s) =>
      s.id === targetSegment.id
        ? { startDate: newStart, endDate: newEnd }
        : { startDate: s.startDate, endDate: s.endDate },
    );
    assertSegmentsNoOverlap(nextSegments);

    // Regla 1 aplicada sobre el envelope resultante.
    const { start: envStart, end: envEnd } = envelopeOf(nextSegments);
    const validation = await validateInstallationAgainstOperations(existing.projectId, envStart, envEnd);
    if (!validation.ok) {
      throw badRequest(validation.error.code, validation.error.message);
    }

    await prisma.installationSegment.update({
      where: { id: targetSegment.id },
      data: { startDate: newStart, endDate: newEnd },
    });

    const updated = await prisma.installationSchedule.findUniqueOrThrow({
      where: { id: existing.id },
      include: {
        project: { include: { stages: { select: { name: true, tipoObra: true, status: true } } } },
        team: true,
        confirmedByUser: { select: { id: true, name: true } },
        segments: { orderBy: { startDate: "asc" } },
      },
    });

    await createAuditEntry({
      entityType: AuditEntityType.installation_schedule,
      entityId: existing.id,
      projectId: existing.projectId,
      userId: user.id,
      action: AuditAction.updated,
      description: `Reprogramó un tramo de la instalación: ${toDateOnlyString(targetSegment.startDate)}→${toDateOnlyString(targetSegment.endDate)} → ${toDateOnlyString(newStart)}→${toDateOnlyString(newEnd)}`,
    });

    return { data: serializeSchedule(updated), warning: validation.warning };
  });

  // ── CRUD de segments ──────────────────────────────────────────────────────────

  app.post("/calendar/:id/segments", { preHandler: authorize(Module.OPERACIONES, Action.EDIT) }, async (request, reply) => {
    const user = ensureUser(request);
    const params = z.object({ id: z.string() }).parse(request.params);
    const body = segmentInputSchema.parse(request.body);

    const existing = await prisma.installationSchedule.findFirst({
      where: { id: params.id, deletedAt: null },
      include: { segments: { orderBy: { startDate: "asc" } } },
    });
    if (!existing) {
      throw notFound("INSTALLATION_NOT_FOUND", "Instalación no encontrada");
    }

    const startDate = parseDateOnly(body.startDate);
    const endDate = parseDateOnly(body.endDate);

    const next = [
      ...existing.segments.map((s) => ({ startDate: s.startDate, endDate: s.endDate })),
      { startDate, endDate },
    ];
    assertSegmentsNoOverlap(next);

    await prisma.installationSegment.create({
      data: {
        scheduleId: existing.id,
        startDate,
        endDate,
        notes: body.notes ?? null,
      },
    });

    const updated = await prisma.installationSchedule.findUniqueOrThrow({
      where: { id: existing.id },
      include: {
        project: { include: { stages: { select: { name: true, tipoObra: true, status: true } } } },
        team: true,
        confirmedByUser: { select: { id: true, name: true } },
        segments: { orderBy: { startDate: "asc" } },
      },
    });

    await createAuditEntry({
      entityType: AuditEntityType.installation_schedule,
      entityId: existing.id,
      projectId: existing.projectId,
      userId: user.id,
      action: AuditAction.updated,
      description: `Agregó un tramo a la instalación: ${toDateOnlyString(startDate)}→${toDateOnlyString(endDate)}`,
    });

    reply.code(201);
    return serializeSchedule(updated);
  });

  app.patch("/calendar/:id/segments/:segmentId", { preHandler: authorize(Module.OPERACIONES, Action.EDIT) }, async (request) => {
    const user = ensureUser(request);
    const params = z.object({ id: z.string(), segmentId: z.string() }).parse(request.params);
    const body = z.object({
      startDate: dateOnlySchema.optional(),
      endDate: dateOnlySchema.optional(),
      notes: z.string().trim().nullable().optional(),
    }).strict().parse(request.body);

    const existing = await prisma.installationSchedule.findFirst({
      where: { id: params.id, deletedAt: null },
      include: { segments: { orderBy: { startDate: "asc" } } },
    });
    if (!existing) {
      throw notFound("INSTALLATION_NOT_FOUND", "Instalación no encontrada");
    }
    const target = existing.segments.find((s) => s.id === params.segmentId);
    if (!target) {
      throw notFound("SEGMENT_NOT_FOUND", "Tramo no encontrado");
    }

    const nextStart = body.startDate ? parseDateOnly(body.startDate) : target.startDate;
    const nextEnd = body.endDate ? parseDateOnly(body.endDate) : target.endDate;

    const nextSegments = existing.segments.map((s) =>
      s.id === target.id
        ? { startDate: nextStart, endDate: nextEnd }
        : { startDate: s.startDate, endDate: s.endDate },
    );
    assertSegmentsNoOverlap(nextSegments);

    await prisma.installationSegment.update({
      where: { id: target.id },
      data: {
        startDate: nextStart,
        endDate: nextEnd,
        ...(body.notes !== undefined ? { notes: body.notes } : {}),
      },
    });

    const updated = await prisma.installationSchedule.findUniqueOrThrow({
      where: { id: existing.id },
      include: {
        project: { include: { stages: { select: { name: true, tipoObra: true, status: true } } } },
        team: true,
        confirmedByUser: { select: { id: true, name: true } },
        segments: { orderBy: { startDate: "asc" } },
      },
    });

    await createAuditEntry({
      entityType: AuditEntityType.installation_schedule,
      entityId: existing.id,
      projectId: existing.projectId,
      userId: user.id,
      action: AuditAction.updated,
      description: `Editó un tramo: ${toDateOnlyString(target.startDate)}→${toDateOnlyString(target.endDate)} → ${toDateOnlyString(nextStart)}→${toDateOnlyString(nextEnd)}`,
    });

    return serializeSchedule(updated);
  });

  app.delete("/calendar/:id/segments/:segmentId", { preHandler: authorize(Module.OPERACIONES, Action.EDIT) }, async (request) => {
    const user = ensureUser(request);
    const params = z.object({ id: z.string(), segmentId: z.string() }).parse(request.params);

    const existing = await prisma.installationSchedule.findFirst({
      where: { id: params.id, deletedAt: null },
      include: { segments: true },
    });
    if (!existing) {
      throw notFound("INSTALLATION_NOT_FOUND", "Instalación no encontrada");
    }
    const target = existing.segments.find((s) => s.id === params.segmentId);
    if (!target) {
      throw notFound("SEGMENT_NOT_FOUND", "Tramo no encontrado");
    }
    if (existing.segments.length <= 1) {
      throw badRequest("LAST_SEGMENT", "Una instalación debe tener al menos un tramo");
    }

    await prisma.installationSegment.delete({ where: { id: target.id } });

    const updated = await prisma.installationSchedule.findUniqueOrThrow({
      where: { id: existing.id },
      include: {
        project: { include: { stages: { select: { name: true, tipoObra: true, status: true } } } },
        team: true,
        confirmedByUser: { select: { id: true, name: true } },
        segments: { orderBy: { startDate: "asc" } },
      },
    });

    await createAuditEntry({
      entityType: AuditEntityType.installation_schedule,
      entityId: existing.id,
      projectId: existing.projectId,
      userId: user.id,
      action: AuditAction.updated,
      description: `Eliminó un tramo de la instalación (${toDateOnlyString(target.startDate)}→${toDateOnlyString(target.endDate)})`,
    });

    return serializeSchedule(updated);
  });

  app.delete("/calendar/:id", { preHandler: authorize(Module.OPERACIONES, Action.DELETE) }, async (request) => {
    const user = ensureUser(request);
    const params = z.object({ id: z.string() }).parse(request.params);

    const existing = await prisma.installationSchedule.findFirst({
      where: { id: params.id, deletedAt: null },
      include: { project: { select: { clientName: true } } },
    });
    if (!existing) {
      throw notFound("INSTALLATION_NOT_FOUND", "Instalación no encontrada");
    }

    await prisma.installationSchedule.update({
      where: { id: existing.id },
      data: { deletedAt: new Date() },
    });

    await createAuditEntry({
      entityType: AuditEntityType.installation_schedule,
      entityId: existing.id,
      projectId: existing.projectId,
      userId: user.id,
      action: AuditAction.deleted,
      description: `Eliminó la programación de instalación de ${existing.project.clientName}`,
    });

    return { success: true };
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

    // ─── Finance: Exchange Rate ───────────────────────────────────────────────

    app.get("/finance/exchange-rate", async () => {
      const rate = await prisma.exchangeRate.findFirst({ orderBy: { date: "desc" } });
      if (!rate) throw notFound("EXCHANGE_RATE_NOT_FOUND", "No hay tipo de cambio registrado");
      return { usdToUyu: decimalToNumber(rate.usdToUyu), date: serializeDate(rate.date), source: rate.source };
    });

    app.post("/finance/exchange-rate", { preHandler: authorize(Module.FINANZAS, Action.CREATE) }, async (request) => {
      const user = ensureUser(request);
      const body = z.object({ usdToUyu: z.coerce.number().positive() }).strict().parse(request.body);
      const rate = await prisma.exchangeRate.create({
        data: { usdToUyu: new Prisma.Decimal(body.usdToUyu), createdBy: user.id },
      });
      await createAuditEntry({
        entityType: AuditEntityType.exchange_rate,
        entityId: rate.id,
        userId: user.id,
        action: AuditAction.created,
        description: `Tipo de cambio actualizado a 1 USD = ${body.usdToUyu} UYU`,
      });
      return { usdToUyu: decimalToNumber(rate.usdToUyu), date: serializeDate(rate.date), source: rate.source };
    });

    app.get("/finance/exchange-rate/history", { preHandler: authorize(Module.FINANZAS, Action.VIEW) }, async () => {
      const rates = await prisma.exchangeRate.findMany({ orderBy: { date: "desc" }, take: 30 });
      return rates.map((r) => ({ id: r.id, usdToUyu: decimalToNumber(r.usdToUyu), date: serializeDate(r.date), source: r.source }));
    });

    // ─── Finance: Suppliers ───────────────────────────────────────────────────

    const supplierCreateSchema = z.object({
      nombre: z.string().min(1),
      email: z.string().email().optional(),
      telefono: z.string().optional(),
      condicionPago: z.string().optional(),
      notas: z.string().optional(),
    }).strict();

    const supplierPatchSchema = z.object({
      nombre: z.string().min(1).optional(),
      email: z.string().email().nullable().optional(),
      telefono: z.string().nullable().optional(),
      condicionPago: z.string().nullable().optional(),
      notas: z.string().nullable().optional(),
      activo: z.boolean().optional(),
    }).strict();

    app.get("/finance/suppliers", { preHandler: authorize(Module.FINANZAS, Action.VIEW) }, async (request) => {
      const query = z.object({ activo: z.enum(["true", "false"]).optional() }).parse(request.query);
      const activo = query.activo === undefined ? true : query.activo === "true";
      const suppliers = await prisma.supplier.findMany({
        where: { deletedAt: null, activo },
        include: { _count: { select: { movimientos: true, comprobantes: true } } },
        orderBy: { nombre: "asc" },
      });
      return suppliers.map((s) => ({
        id: s.id, nombre: s.nombre, email: s.email, telefono: s.telefono,
        condicionPago: s.condicionPago, activo: s.activo, notas: s.notas,
        createdAt: serializeDate(s.createdAt), updatedAt: serializeDate(s.updatedAt),
        _count: s._count,
      }));
    });

    app.post("/finance/suppliers", { preHandler: authorize(Module.FINANZAS, Action.CREATE) }, async (request) => {
      const user = ensureUser(request);
      const body = supplierCreateSchema.parse(request.body);
      const supplier = await prisma.supplier.create({ data: body });
      await createAuditEntry({
        entityType: AuditEntityType.supplier,
        entityId: supplier.id,
        userId: user.id,
        action: AuditAction.created,
        description: `Creó proveedor ${supplier.nombre}`,
      });
      return supplier;
    });

    app.patch("/finance/suppliers/:id", { preHandler: authorize(Module.FINANZAS, Action.EDIT) }, async (request) => {
      const user = ensureUser(request);
      const { id } = z.object({ id: z.string() }).parse(request.params);
      const body = supplierPatchSchema.parse(request.body);
      const existing = await prisma.supplier.findFirst({ where: { id, deletedAt: null } });
      if (!existing) throw notFound("SUPPLIER_NOT_FOUND", "Proveedor no encontrado");
      const updated = await prisma.supplier.update({ where: { id }, data: body });
      await createAuditEntriesForChanges({
        entityType: AuditEntityType.supplier,
        entityId: id,
        userId: user.id,
        oldData: existing as Record<string, unknown>,
        newData: { ...existing, ...body } as Record<string, unknown>,
        formatter: ({ label, oldValue, newValue }) => `Actualizó ${label} de ${oldValue ?? "vacío"} a ${newValue ?? "vacío"} en proveedor ${existing.nombre}`,
      });
      return updated;
    });

    app.delete("/finance/suppliers/:id", { preHandler: authorize(Module.FINANZAS, Action.DELETE) }, async (request) => {
      const user = ensureUser(request);
      const { id } = z.object({ id: z.string() }).parse(request.params);
      const existing = await prisma.supplier.findFirst({ where: { id, deletedAt: null } });
      if (!existing) throw notFound("SUPPLIER_NOT_FOUND", "Proveedor no encontrado");
      await prisma.supplier.update({ where: { id }, data: { deletedAt: new Date() } });
      await createAuditEntry({
        entityType: AuditEntityType.supplier,
        entityId: id,
        userId: user.id,
        action: AuditAction.deleted,
        description: `Eliminó proveedor ${existing.nombre}`,
      });
      return { success: true };
    });

    // ─── Finance: Subcategorías ───────────────────────────────────────────────

    const subcategoryCreateSchema = z.object({
      nombre: z.string().min(1),
      categoria: z.nativeEnum(CategoriaPrincipal),
    }).strict();

    app.get("/finance/subcategories", { preHandler: authorize(Module.FINANZAS, Action.VIEW) }, async (request) => {
      const query = z.object({ categoria: z.nativeEnum(CategoriaPrincipal).optional() }).parse(request.query);
      const subcategories = await prisma.financeSubcategory.findMany({
        where: { activa: true, ...(query.categoria ? { categoria: query.categoria } : {}) },
        orderBy: [{ categoria: "asc" }, { nombre: "asc" }],
      });
      return subcategories;
    });

    app.post("/finance/subcategories", { preHandler: authorize(Module.FINANZAS, Action.CREATE) }, async (request) => {
      const body = subcategoryCreateSchema.parse(request.body);
      const existing = await prisma.financeSubcategory.findUnique({ where: { nombre_categoria: { nombre: body.nombre, categoria: body.categoria } } });
      if (existing) throw conflict("SUBCATEGORY_EXISTS", "Ya existe una subcategoría con ese nombre en esa categoría");
      return prisma.financeSubcategory.create({ data: body });
    });

    app.patch("/finance/subcategories/:id", { preHandler: authorize(Module.FINANZAS, Action.EDIT) }, async (request) => {
      const { id } = z.object({ id: z.string() }).parse(request.params);
      const body = z.object({ nombre: z.string().min(1).optional(), activa: z.boolean().optional() }).strict().parse(request.body);
      const existing = await prisma.financeSubcategory.findUnique({ where: { id } });
      if (!existing) throw notFound("SUBCATEGORY_NOT_FOUND", "Subcategoría no encontrada");
      return prisma.financeSubcategory.update({ where: { id }, data: body });
    });

    app.delete("/finance/subcategories/:id", { preHandler: authorize(Module.FINANZAS, Action.DELETE) }, async (request) => {
      const { id } = z.object({ id: z.string() }).parse(request.params);
      const existing = await prisma.financeSubcategory.findUnique({ where: { id }, include: { _count: { select: { movimientos: true } } } });
      if (!existing) throw notFound("SUBCATEGORY_NOT_FOUND", "Subcategoría no encontrada");
      if (existing._count.movimientos > 0) throw badRequest("SUBCATEGORY_IN_USE", "No se puede eliminar: la subcategoría tiene movimientos asociados");
      await prisma.financeSubcategory.update({ where: { id }, data: { activa: false } });
      return { success: true };
    });

    // ─── Finance: Movements ───────────────────────────────────────────────────

    const movementCreateSchema = z.object({
      fecha: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
      tipoMovimiento: z.nativeEnum(TipoMovimiento),
      categoriaPrincipal: z.nativeEnum(CategoriaPrincipal),
      subcategoriaId: z.string().optional(),
      descripcion: z.string().min(1),
      monto: z.coerce.number().positive(),
      moneda: z.nativeEnum(Moneda).default(Moneda.USD),
      tipoCambio: z.coerce.number().positive().optional(),
      pagado: z.boolean().default(false),
      cobrado: z.boolean().default(false),
      impactaFlujo: z.boolean().default(true),
      projectId: z.string().optional(),
      supplierId: z.string().optional(),
      observaciones: z.string().optional(),
      estadoAprobacion: z.nativeEnum(EstadoAprobacion).default(EstadoAprobacion.REGISTRADO),
      archivoAdjuntoUrl: z.string().optional(),
    }).strict();

    const movementPatchSchema = z.object({
      fecha: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
      tipoMovimiento: z.nativeEnum(TipoMovimiento).optional(),
      categoriaPrincipal: z.nativeEnum(CategoriaPrincipal).optional(),
      subcategoriaId: z.string().nullable().optional(),
      descripcion: z.string().min(1).optional(),
      monto: z.coerce.number().positive().optional(),
      moneda: z.nativeEnum(Moneda).optional(),
      tipoCambio: z.coerce.number().positive().nullable().optional(),
      pagado: z.boolean().optional(),
      cobrado: z.boolean().optional(),
      impactaFlujo: z.boolean().optional(),
      projectId: z.string().nullable().optional(),
      supplierId: z.string().nullable().optional(),
      observaciones: z.string().nullable().optional(),
      estadoAprobacion: z.nativeEnum(EstadoAprobacion).optional(),
      archivoAdjuntoUrl: z.string().nullable().optional(),
    }).strict();

    app.get("/finance/movements", { preHandler: authorize(Module.FINANZAS, Action.VIEW) }, async (request) => {
      const query = z.object({
        mes: z.coerce.number().int().min(1).max(12).optional(),
        anio: z.coerce.number().int().optional(),
        tipo: z.nativeEnum(TipoMovimiento).optional(),
        categoria: z.nativeEnum(CategoriaPrincipal).optional(),
        projectId: z.string().optional(),
        page: z.coerce.number().int().positive().optional(),
        limit: z.coerce.number().int().positive().max(100).optional(),
      }).parse(request.query);

      const take = query.limit ?? 20;
      const skip = ((query.page ?? 1) - 1) * take;

      const [movements, total] = await prisma.$transaction([
        prisma.financeMovement.findMany({
          where: {
            deletedAt: null,
            ...(query.mes ? { mes: query.mes } : {}),
            ...(query.anio ? { anio: query.anio } : {}),
            ...(query.tipo ? { tipoMovimiento: query.tipo } : {}),
            ...(query.categoria ? { categoriaPrincipal: query.categoria } : {}),
            ...(query.projectId ? { projectId: query.projectId } : {}),
          },
          include: {
            project: { select: { id: true, clientName: true, code: true } },
            supplier: { select: { id: true, nombre: true } },
            subcategoria: { select: { id: true, nombre: true, categoria: true } },
          },
          orderBy: { fecha: "desc" },
          skip,
          take,
        }),
        prisma.financeMovement.count({
          where: {
            deletedAt: null,
            ...(query.mes ? { mes: query.mes } : {}),
            ...(query.anio ? { anio: query.anio } : {}),
            ...(query.tipo ? { tipoMovimiento: query.tipo } : {}),
            ...(query.categoria ? { categoriaPrincipal: query.categoria } : {}),
            ...(query.projectId ? { projectId: query.projectId } : {}),
          },
        }),
      ]);

      return {
        data: movements.map((m) => ({
          ...m,
          monto: decimalToNumber(m.monto),
          tipoCambio: m.tipoCambio ? decimalToNumber(m.tipoCambio) : null,
          fecha: serializeDate(m.fecha),
          createdAt: serializeDate(m.createdAt),
          updatedAt: serializeDate(m.updatedAt),
        })),
        total,
        page: query.page ?? 1,
        limit: take,
        totalPages: Math.ceil(total / take),
      };
    });

    app.post("/finance/movements", { preHandler: authorize(Module.FINANZAS, Action.CREATE) }, async (request) => {
      const user = ensureUser(request);
      const body = movementCreateSchema.parse(request.body);
      const fecha = new Date(body.fecha);
      const mes = fecha.getUTCMonth() + 1;
      const anio = fecha.getUTCFullYear();

      let tipoCambio = body.tipoCambio ? new Prisma.Decimal(body.tipoCambio) : null;
      if (body.moneda === Moneda.UYU && !tipoCambio) {
        const lastRate = await prisma.exchangeRate.findFirst({ orderBy: { date: "desc" } });
        if (lastRate) tipoCambio = lastRate.usdToUyu;
      }

      const movement = await prisma.financeMovement.create({
        data: {
          fecha,
          mes,
          anio,
          tipoMovimiento: body.tipoMovimiento,
          categoriaPrincipal: body.categoriaPrincipal,
          subcategoriaId: body.subcategoriaId,
          descripcion: body.descripcion,
          monto: new Prisma.Decimal(body.monto),
          moneda: body.moneda,
          tipoCambio,
          pagado: body.pagado,
          cobrado: body.cobrado,
          impactaFlujo: body.impactaFlujo,
          projectId: body.projectId,
          supplierId: body.supplierId,
          observaciones: body.observaciones,
          estadoAprobacion: body.estadoAprobacion,
          archivoAdjuntoUrl: body.archivoAdjuntoUrl,
          creadoPorId: user.id,
        },
      });

      await createAuditEntry({
        entityType: AuditEntityType.finance_movement,
        entityId: movement.id,
        projectId: body.projectId,
        userId: user.id,
        action: AuditAction.created,
        description: `Registró movimiento: ${body.descripcion} por ${body.monto} ${body.moneda}`,
      });

      return { ...movement, monto: decimalToNumber(movement.monto), tipoCambio: movement.tipoCambio ? decimalToNumber(movement.tipoCambio) : null };
    });

    app.get("/finance/movements/:id", { preHandler: authorize(Module.FINANZAS, Action.VIEW) }, async (request) => {
      const { id } = z.object({ id: z.string() }).parse(request.params);
      const movement = await prisma.financeMovement.findFirst({
        where: { id, deletedAt: null },
        include: {
          project: { select: { id: true, clientName: true, code: true } },
          supplier: { select: { id: true, nombre: true } },
          subcategoria: true,
          pagos: { include: { supplier: { select: { id: true, nombre: true } } } },
          historial: { include: { user: { select: { id: true, name: true } } }, orderBy: { createdAt: "desc" } },
          comprobantes: { select: { id: true, numero: true, tipo: true, monto: true, moneda: true, estado: true } },
        },
      });
      if (!movement) throw notFound("MOVEMENT_NOT_FOUND", "Movimiento no encontrado");
      return {
        ...movement,
        monto: decimalToNumber(movement.monto),
        tipoCambio: movement.tipoCambio ? decimalToNumber(movement.tipoCambio) : null,
        pagos: movement.pagos.map((p) => ({ ...p, monto: decimalToNumber(p.monto) })),
        comprobantes: movement.comprobantes.map((c) => ({ ...c, monto: decimalToNumber(c.monto) })),
      };
    });

    app.patch("/finance/movements/:id", { preHandler: authorize(Module.FINANZAS, Action.EDIT) }, async (request) => {
      const user = ensureUser(request);
      const { id } = z.object({ id: z.string() }).parse(request.params);
      const body = movementPatchSchema.parse(request.body);
      const existing = await prisma.financeMovement.findFirst({ where: { id, deletedAt: null } });
      if (!existing) throw notFound("MOVEMENT_NOT_FOUND", "Movimiento no encontrado");

      const updateData: Record<string, unknown> = { ...body };
      if (body.fecha) {
        const d = new Date(body.fecha);
        updateData.fecha = d;
        updateData.mes = d.getUTCMonth() + 1;
        updateData.anio = d.getUTCFullYear();
      }
      if (body.monto !== undefined) updateData.monto = new Prisma.Decimal(body.monto);
      if (body.tipoCambio !== undefined) updateData.tipoCambio = body.tipoCambio ? new Prisma.Decimal(body.tipoCambio) : null;

      const updated = await prisma.financeMovement.update({ where: { id }, data: updateData });
      await createAuditEntry({
        entityType: AuditEntityType.finance_movement,
        entityId: id,
        projectId: existing.projectId,
        userId: user.id,
        action: AuditAction.updated,
        description: `Actualizó movimiento: ${existing.descripcion}`,
      });
      return { ...updated, monto: decimalToNumber(updated.monto), tipoCambio: updated.tipoCambio ? decimalToNumber(updated.tipoCambio) : null };
    });

    app.delete("/finance/movements/:id", { preHandler: authorize(Module.FINANZAS, Action.DELETE) }, async (request) => {
      const user = ensureUser(request);
      const { id } = z.object({ id: z.string() }).parse(request.params);
      const existing = await prisma.financeMovement.findFirst({ where: { id, deletedAt: null } });
      if (!existing) throw notFound("MOVEMENT_NOT_FOUND", "Movimiento no encontrado");
      await prisma.financeMovement.update({ where: { id }, data: { deletedAt: new Date() } });
      await createAuditEntry({
        entityType: AuditEntityType.finance_movement,
        entityId: id,
        projectId: existing.projectId,
        userId: user.id,
        action: AuditAction.deleted,
        description: `Eliminó movimiento: ${existing.descripcion}`,
      });
      return { success: true };
    });

    // ─── Finance: Comprobantes ────────────────────────────────────────────────

    const comprobanteCreateSchema = z.object({
      supplierId: z.string().min(1),
      numero: z.string().optional(),
      tipo: z.nativeEnum(TipoComprobante).default(TipoComprobante.FACTURA),
      concepto: z.string().min(1),
      monto: z.coerce.number().positive(),
      moneda: z.nativeEnum(Moneda).default(Moneda.USD),
      fechaEmision: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
      fechaVencimiento: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
      movimientoId: z.string().optional(),
      origenEmail: z.string().optional(),
      archivoUrl: z.string().optional(),
      notas: z.string().optional(),
    }).strict();

    app.get("/finance/comprobantes", { preHandler: authorize(Module.FINANZAS, Action.VIEW) }, async (request) => {
      const query = z.object({
        supplierId: z.string().optional(),
        estado: z.nativeEnum(EstadoComprobante).optional(),
      }).parse(request.query);

      const comprobantes = await prisma.financeComprobante.findMany({
        where: {
          deletedAt: null,
          ...(query.supplierId ? { supplierId: query.supplierId } : {}),
          ...(query.estado ? { estado: query.estado } : {}),
        },
        include: {
          supplier: { select: { id: true, nombre: true } },
          pagos: { select: { monto: true, moneda: true } },
        },
        orderBy: { fechaEmision: "desc" },
      });

      return comprobantes.map((c) => {
        const montoPagado = c.pagos.reduce((sum, p) => sum + (decimalToNumber(p.monto) ?? 0), 0);
        return {
          id: c.id, supplierId: c.supplierId, supplier: c.supplier,
          numero: c.numero, tipo: c.tipo, concepto: c.concepto,
          monto: decimalToNumber(c.monto), moneda: c.moneda,
          fechaEmision: serializeDate(c.fechaEmision),
          fechaVencimiento: c.fechaVencimiento ? serializeDate(c.fechaVencimiento) : null,
          estado: c.estado, movimientoId: c.movimientoId,
          montoPagado,
          saldoPendiente: (decimalToNumber(c.monto) ?? 0) - montoPagado,
          createdAt: serializeDate(c.createdAt),
        };
      });
    });

    app.post("/finance/comprobantes", { preHandler: authorize(Module.FINANZAS, Action.CREATE) }, async (request) => {
      const user = ensureUser(request);
      const body = comprobanteCreateSchema.parse(request.body);
      const supplier = await prisma.supplier.findFirst({ where: { id: body.supplierId, deletedAt: null } });
      if (!supplier) throw notFound("SUPPLIER_NOT_FOUND", "Proveedor no encontrado");
      const comprobante = await prisma.financeComprobante.create({
        data: {
          ...body,
          monto: new Prisma.Decimal(body.monto),
          fechaEmision: new Date(body.fechaEmision),
          fechaVencimiento: body.fechaVencimiento ? new Date(body.fechaVencimiento) : null,
        },
      });
      await createAuditEntry({
        entityType: AuditEntityType.finance_comprobante,
        entityId: comprobante.id,
        userId: user.id,
        action: AuditAction.created,
        description: `Registró comprobante ${body.tipo} de ${supplier.nombre} por ${body.monto} ${body.moneda}`,
      });
      return { ...comprobante, monto: decimalToNumber(comprobante.monto) };
    });

    app.patch("/finance/comprobantes/:id", { preHandler: authorize(Module.FINANZAS, Action.EDIT) }, async (request) => {
      const user = ensureUser(request);
      const { id } = z.object({ id: z.string() }).parse(request.params);
      const body = z.object({
        numero: z.string().nullable().optional(),
        concepto: z.string().min(1).optional(),
        fechaVencimiento: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable().optional(),
        notas: z.string().nullable().optional(),
        archivoUrl: z.string().nullable().optional(),
        estado: z.nativeEnum(EstadoComprobante).optional(),
      }).strict().parse(request.body);
      const existing = await prisma.financeComprobante.findFirst({ where: { id, deletedAt: null } });
      if (!existing) throw notFound("COMPROBANTE_NOT_FOUND", "Comprobante no encontrado");
      const updateData: Record<string, unknown> = { ...body };
      if (body.fechaVencimiento !== undefined) {
        updateData.fechaVencimiento = body.fechaVencimiento ? new Date(body.fechaVencimiento) : null;
      }
      const updated = await prisma.financeComprobante.update({ where: { id }, data: updateData });
      await createAuditEntry({
        entityType: AuditEntityType.finance_comprobante,
        entityId: id,
        userId: user.id,
        action: AuditAction.updated,
        description: `Actualizó comprobante ${existing.concepto}`,
      });
      return { ...updated, monto: decimalToNumber(updated.monto) };
    });

    app.post("/finance/comprobantes/:id/payments", { preHandler: authorize(Module.FINANZAS, Action.CREATE) }, async (request) => {
      const user = ensureUser(request);
      const { id } = z.object({ id: z.string() }).parse(request.params);
      const body = z.object({
        fecha: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
        monto: z.coerce.number().positive(),
        moneda: z.nativeEnum(Moneda).default(Moneda.USD),
        metodoPago: z.nativeEnum(MetodoPago).default(MetodoPago.TRANSFERENCIA),
        referencia: z.string().optional(),
        comprobanteUrl: z.string().optional(),
        observaciones: z.string().optional(),
      }).strict().parse(request.body);

      const comprobante = await prisma.financeComprobante.findFirst({
        where: { id, deletedAt: null },
        include: { pagos: { select: { monto: true } } },
      });
      if (!comprobante) throw notFound("COMPROBANTE_NOT_FOUND", "Comprobante no encontrado");

      const pago = await prisma.financeComprobantePayment.create({
        data: {
          comprobanteId: id,
          fecha: new Date(body.fecha),
          monto: new Prisma.Decimal(body.monto),
          moneda: body.moneda,
          metodoPago: body.metodoPago,
          referencia: body.referencia,
          comprobanteUrl: body.comprobanteUrl,
          observaciones: body.observaciones,
        },
      });

      const totalPagado = comprobante.pagos.reduce((s, p) => s + (decimalToNumber(p.monto) ?? 0), 0) + body.monto;
      const montoTotal = decimalToNumber(comprobante.monto) ?? 0;
      const nuevoEstado: EstadoComprobante =
        totalPagado >= montoTotal ? EstadoComprobante.PAGADO : EstadoComprobante.PARCIALMENTE_PAGADO;

      await prisma.financeComprobante.update({ where: { id }, data: { estado: nuevoEstado } });
      await createAuditEntry({
        entityType: AuditEntityType.finance_comprobante,
        entityId: id,
        userId: user.id,
        action: AuditAction.updated,
        description: `Registró pago de ${body.monto} ${body.moneda} en comprobante ${comprobante.concepto}. Estado: ${nuevoEstado}`,
      });

      return { ...pago, monto: decimalToNumber(pago.monto), nuevoEstado };
    });

    // ─── Finance: Reports ─────────────────────────────────────────────────────

    app.get("/finance/reports/results", { preHandler: authorize(Module.FINANZAS, Action.VIEW) }, async (request) => {
      const { anio } = z.object({ anio: z.coerce.number().int().default(new Date().getUTCFullYear()) }).parse(request.query);

      const lastRate = await prisma.exchangeRate.findFirst({ orderBy: { date: "desc" } });
      const fallbackRate = lastRate ? (decimalToNumber(lastRate.usdToUyu) ?? 1) : 1;

      const movements = await prisma.financeMovement.findMany({
        where: { anio, deletedAt: null },
        select: { mes: true, categoriaPrincipal: true, monto: true, moneda: true, tipoCambio: true },
      });

      function toUsd(monto: Prisma.Decimal, moneda: Moneda, tipoCambio: Prisma.Decimal | null): number {
        const amount = decimalToNumber(monto) ?? 0;
        if (moneda === Moneda.USD) return amount;
        const rate = tipoCambio ? (decimalToNumber(tipoCambio) ?? fallbackRate) : fallbackRate;
        return rate > 0 ? amount / rate : amount;
      }

      const entradaCats = new Set<CategoriaPrincipal>([CategoriaPrincipal.PROYECTO_ENTRADA, CategoriaPrincipal.COBRO_CLIENTE]);
      const costoCats = new Set<CategoriaPrincipal>([CategoriaPrincipal.PROYECTO_SALIDA, CategoriaPrincipal.COMPRA_STOCK, CategoriaPrincipal.CONSUMO_STOCK]);
      const fijoCats = new Set<CategoriaPrincipal>([CategoriaPrincipal.FIJO]);
      const variableCats = new Set<CategoriaPrincipal>([CategoriaPrincipal.VARIABLE, CategoriaPrincipal.PAGO_PROVEEDOR, CategoriaPrincipal.OTRO]);

      const byMes: Record<number, { entradas: number; costoInstalaciones: number; costosFijos: number; costosVariables: number }> = {};
      for (let m = 1; m <= 12; m++) byMes[m] = { entradas: 0, costoInstalaciones: 0, costosFijos: 0, costosVariables: 0 };

      for (const mov of movements) {
        const usd = toUsd(mov.monto, mov.moneda, mov.tipoCambio);
        if (entradaCats.has(mov.categoriaPrincipal)) byMes[mov.mes].entradas += usd;
        else if (costoCats.has(mov.categoriaPrincipal)) byMes[mov.mes].costoInstalaciones += usd;
        else if (fijoCats.has(mov.categoriaPrincipal)) byMes[mov.mes].costosFijos += usd;
        else if (variableCats.has(mov.categoriaPrincipal)) byMes[mov.mes].costosVariables += usd;
      }

      const meses = Object.entries(byMes).map(([mes, d]) => {
        const resultadoBruto = d.entradas - d.costoInstalaciones;
        const totalCostosOp = d.costosFijos + d.costosVariables;
        return {
          mes: Number(mes), entradas: d.entradas, costoInstalaciones: d.costoInstalaciones,
          resultadoBruto, costosFijos: d.costosFijos, costosVariables: d.costosVariables,
          totalCostosOp, resultadoOperativo: resultadoBruto - totalCostosOp,
        };
      });

      const totales = meses.reduce((acc, m) => ({
        entradas: acc.entradas + m.entradas,
        costoInstalaciones: acc.costoInstalaciones + m.costoInstalaciones,
        resultadoBruto: acc.resultadoBruto + m.resultadoBruto,
        costosFijos: acc.costosFijos + m.costosFijos,
        costosVariables: acc.costosVariables + m.costosVariables,
        totalCostosOp: acc.totalCostosOp + m.totalCostosOp,
        resultadoOperativo: acc.resultadoOperativo + m.resultadoOperativo,
      }), { entradas: 0, costoInstalaciones: 0, resultadoBruto: 0, costosFijos: 0, costosVariables: 0, totalCostosOp: 0, resultadoOperativo: 0 });

      return { anio, meses, totales };
    });

    app.get("/finance/reports/cashflow", { preHandler: authorize(Module.FINANZAS, Action.VIEW) }, async (request) => {
      const query = z.object({
        fechaDesde: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
        fechaHasta: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
      }).parse(request.query);

      const dateFilter = {
        ...(query.fechaDesde ? { gte: new Date(query.fechaDesde) } : {}),
        ...(query.fechaHasta ? { lte: new Date(query.fechaHasta) } : {}),
      };
      const where = { deletedAt: null, impactaFlujo: true, ...(Object.keys(dateFilter).length ? { fecha: dateFilter } : {}) };

      const movements = await prisma.financeMovement.findMany({
        where,
        select: { tipoMovimiento: true, monto: true, moneda: true, tipoCambio: true, cobrado: true, pagado: true },
      });

      const lastRate = await prisma.exchangeRate.findFirst({ orderBy: { date: "desc" } });
      const fallbackRate = lastRate ? (decimalToNumber(lastRate.usdToUyu) ?? 1) : 1;

      function toUsd(m: (typeof movements)[number]): number {
        const amount = decimalToNumber(m.monto) ?? 0;
        if (m.moneda === Moneda.USD) return amount;
        const rate = m.tipoCambio ? (decimalToNumber(m.tipoCambio) ?? fallbackRate) : fallbackRate;
        return rate > 0 ? amount / rate : amount;
      }

      let saldoActual = 0, porCobrar = 0, porPagar = 0;
      for (const m of movements) {
        const usd = toUsd(m);
        if (m.tipoMovimiento === TipoMovimiento.INGRESO) {
          if (m.cobrado) saldoActual += usd;
          else porCobrar += usd;
        } else if (m.tipoMovimiento === TipoMovimiento.GASTO) {
          if (m.pagado) saldoActual -= usd;
          else porPagar += usd;
        }
      }

      return { saldoActual, porCobrar, porPagar, saldoProyectado: saldoActual + porCobrar - porPagar };
    });

    app.get("/finance/reports/dashboard", { preHandler: authorize(Module.FINANZAS, Action.VIEW) }, async () => {
      const now = new Date();
      const mes = now.getUTCMonth() + 1;
      const anio = now.getUTCFullYear();

      const lastRate = await prisma.exchangeRate.findFirst({ orderBy: { date: "desc" } });
      const fallbackRate = lastRate ? (decimalToNumber(lastRate.usdToUyu) ?? 1) : 1;

      const movements = await prisma.financeMovement.findMany({
        where: { mes, anio, deletedAt: null },
        include: {
          project: { select: { id: true, clientName: true, code: true } },
          supplier: { select: { id: true, nombre: true } },
        },
        orderBy: { fecha: "desc" },
      });

      function toUsd(monto: Prisma.Decimal, moneda: Moneda, tipoCambio: Prisma.Decimal | null): number {
        const amount = decimalToNumber(monto) ?? 0;
        if (moneda === Moneda.USD) return amount;
        const rate = tipoCambio ? (decimalToNumber(tipoCambio) ?? fallbackRate) : fallbackRate;
        return rate > 0 ? amount / rate : amount;
      }

      let ingresos = 0, gastos = 0, pendienteCobro = 0, pendientePago = 0;
      for (const m of movements) {
        const usd = toUsd(m.monto, m.moneda, m.tipoCambio);
        if (m.tipoMovimiento === TipoMovimiento.INGRESO) {
          ingresos += usd;
          if (!m.cobrado) pendienteCobro += usd;
        } else if (m.tipoMovimiento === TipoMovimiento.GASTO) {
          gastos += usd;
          if (!m.pagado) pendientePago += usd;
        }
      }

      return {
        mes, anio, ingresos, gastos, resultado: ingresos - gastos,
        pendienteCobro, pendientePago,
        ultimosMovimientos: movements.slice(0, 10).map((m) => ({
          id: m.id, fecha: serializeDate(m.fecha), descripcion: m.descripcion,
          tipoMovimiento: m.tipoMovimiento, monto: decimalToNumber(m.monto), moneda: m.moneda,
          project: m.project, supplier: m.supplier,
        })),
      };
    });

    app.get("/finance/reports/by-project/:projectId", { preHandler: authorize(Module.FINANZAS, Action.VIEW) }, async (request) => {
      const { projectId } = z.object({ projectId: z.string() }).parse(request.params);
      const project = await prisma.project.findFirst({ where: { id: projectId, deletedAt: null }, select: { id: true, clientName: true, code: true } });
      if (!project) throw notFound("PROJECT_NOT_FOUND", "Proyecto no encontrado");

      const lastRate = await prisma.exchangeRate.findFirst({ orderBy: { date: "desc" } });
      const fallbackRate = lastRate ? (decimalToNumber(lastRate.usdToUyu) ?? 1) : 1;

      const movements = await prisma.financeMovement.findMany({
        where: { projectId, deletedAt: null },
        include: { subcategoria: { select: { id: true, nombre: true } }, supplier: { select: { id: true, nombre: true } } },
        orderBy: { fecha: "desc" },
      });

      function toUsd(monto: Prisma.Decimal, moneda: Moneda, tipoCambio: Prisma.Decimal | null): number {
        const amount = decimalToNumber(monto) ?? 0;
        if (moneda === Moneda.USD) return amount;
        const rate = tipoCambio ? (decimalToNumber(tipoCambio) ?? fallbackRate) : fallbackRate;
        return rate > 0 ? amount / rate : amount;
      }

      let totalIngresos = 0, totalGastos = 0;
      for (const m of movements) {
        const usd = toUsd(m.monto, m.moneda, m.tipoCambio);
        if (m.tipoMovimiento === TipoMovimiento.INGRESO) totalIngresos += usd;
        else totalGastos += usd;
      }

      return {
        project,
        totalIngresos,
        totalGastos,
        resultadoNeto: totalIngresos - totalGastos,
        movimientos: movements.map((m) => ({
          id: m.id, fecha: serializeDate(m.fecha), descripcion: m.descripcion,
          tipoMovimiento: m.tipoMovimiento, categoriaPrincipal: m.categoriaPrincipal,
          monto: decimalToNumber(m.monto), moneda: m.moneda,
          subcategoria: m.subcategoria, supplier: m.supplier,
          pagado: m.pagado, cobrado: m.cobrado,
        })),
      };
    });

    // ─── Stock: Products ──────────────────────────────────────────────────────

    const stockProductCreateSchema = z.object({
      nombre: z.string().min(1),
      descripcion: z.string().optional(),
      categoria: z.string().min(1),
      unidad: z.string().default("unidad"),
      stockMinimo: z.coerce.number().min(0).default(0),
      costoPromedio: z.coerce.number().min(0).default(0),
      moneda: z.nativeEnum(Moneda).default(Moneda.USD),
      notas: z.string().optional(),
    }).strict();

    const stockProductPatchSchema = z.object({
      nombre: z.string().min(1).optional(),
      descripcion: z.string().nullable().optional(),
      categoria: z.string().min(1).optional(),
      unidad: z.string().optional(),
      stockMinimo: z.coerce.number().min(0).optional(),
      costoPromedio: z.coerce.number().min(0).optional(),
      moneda: z.nativeEnum(Moneda).optional(),
      notas: z.string().nullable().optional(),
      activo: z.boolean().optional(),
    }).strict();

    app.get("/stock/products", { preHandler: authorize(Module.STOCK, Action.VIEW) }, async (request) => {
      const query = z.object({
        categoria: z.string().optional(),
        activo: z.enum(["true", "false"]).optional(),
      }).parse(request.query);
      const activo = query.activo === undefined ? true : query.activo === "true";

      const products = await prisma.stockProduct.findMany({
        where: { deletedAt: null, activo, ...(query.categoria ? { categoria: query.categoria } : {}) },
        orderBy: [{ categoria: "asc" }, { nombre: "asc" }],
      });

      return products.map((p) => ({
        id: p.id, nombre: p.nombre, descripcion: p.descripcion, categoria: p.categoria,
        unidad: p.unidad, moneda: p.moneda, activo: p.activo, notas: p.notas,
        stockActual: decimalToNumber(p.stockActual),
        stockMinimo: decimalToNumber(p.stockMinimo),
        costoPromedio: decimalToNumber(p.costoPromedio),
        bajominimo: (decimalToNumber(p.stockActual) ?? 0) <= (decimalToNumber(p.stockMinimo) ?? 0),
        createdAt: serializeDate(p.createdAt),
        updatedAt: serializeDate(p.updatedAt),
      }));
    });

    app.post("/stock/products", { preHandler: authorize(Module.STOCK, Action.CREATE) }, async (request) => {
      const user = ensureUser(request);
      const body = stockProductCreateSchema.parse(request.body);
      const product = await prisma.stockProduct.create({
        data: {
          ...body,
          stockMinimo: new Prisma.Decimal(body.stockMinimo),
          costoPromedio: new Prisma.Decimal(body.costoPromedio),
          stockActual: new Prisma.Decimal(0),
        },
      });
      await createAuditEntry({
        entityType: AuditEntityType.stock_product,
        entityId: product.id,
        userId: user.id,
        action: AuditAction.created,
        description: `Creó producto de stock: ${product.nombre}`,
      });
      return { ...product, stockActual: decimalToNumber(product.stockActual), stockMinimo: decimalToNumber(product.stockMinimo), costoPromedio: decimalToNumber(product.costoPromedio) };
    });

    app.patch("/stock/products/:id", { preHandler: authorize(Module.STOCK, Action.EDIT) }, async (request) => {
      const user = ensureUser(request);
      const { id } = z.object({ id: z.string() }).parse(request.params);
      const body = stockProductPatchSchema.parse(request.body);
      const existing = await prisma.stockProduct.findFirst({ where: { id, deletedAt: null } });
      if (!existing) throw notFound("PRODUCT_NOT_FOUND", "Producto no encontrado");

      const updateData: Record<string, unknown> = { ...body };
      if (body.stockMinimo !== undefined) updateData.stockMinimo = new Prisma.Decimal(body.stockMinimo);
      if (body.costoPromedio !== undefined) updateData.costoPromedio = new Prisma.Decimal(body.costoPromedio);

      const updated = await prisma.stockProduct.update({ where: { id }, data: updateData });
      await createAuditEntry({
        entityType: AuditEntityType.stock_product,
        entityId: id,
        userId: user.id,
        action: AuditAction.updated,
        description: `Actualizó producto de stock: ${existing.nombre}`,
      });
      return { ...updated, stockActual: decimalToNumber(updated.stockActual), stockMinimo: decimalToNumber(updated.stockMinimo), costoPromedio: decimalToNumber(updated.costoPromedio) };
    });

    app.delete("/stock/products/:id", { preHandler: authorize(Module.STOCK, Action.DELETE) }, async (request) => {
      const user = ensureUser(request);
      const { id } = z.object({ id: z.string() }).parse(request.params);
      const existing = await prisma.stockProduct.findFirst({ where: { id, deletedAt: null } });
      if (!existing) throw notFound("PRODUCT_NOT_FOUND", "Producto no encontrado");
      await prisma.stockProduct.update({ where: { id }, data: { deletedAt: new Date() } });
      await createAuditEntry({
        entityType: AuditEntityType.stock_product,
        entityId: id,
        userId: user.id,
        action: AuditAction.deleted,
        description: `Eliminó producto de stock: ${existing.nombre}`,
      });
      return { success: true };
    });

    // ─── Stock: Movements ─────────────────────────────────────────────────────

    app.get("/stock/movements", { preHandler: authorize(Module.STOCK, Action.VIEW) }, async (request) => {
      const query = z.object({
        productId: z.string().optional(),
        projectId: z.string().optional(),
        tipo: z.nativeEnum(TipoMovimientoStock).optional(),
        page: z.coerce.number().int().positive().optional(),
        limit: z.coerce.number().int().positive().max(100).optional(),
      }).parse(request.query);

      const take = query.limit ?? 20;
      const skip = ((query.page ?? 1) - 1) * take;

      const [movements, total] = await prisma.$transaction([
        prisma.stockMovement.findMany({
          where: {
            ...(query.productId ? { productId: query.productId } : {}),
            ...(query.projectId ? { projectId: query.projectId } : {}),
            ...(query.tipo ? { tipo: query.tipo } : {}),
          },
          include: {
            product: { select: { id: true, nombre: true, categoria: true, unidad: true } },
            supplier: { select: { id: true, nombre: true } },
            project: { select: { id: true, clientName: true, code: true } },
          },
          orderBy: { fecha: "desc" },
          skip,
          take,
        }),
        prisma.stockMovement.count({
          where: {
            ...(query.productId ? { productId: query.productId } : {}),
            ...(query.projectId ? { projectId: query.projectId } : {}),
            ...(query.tipo ? { tipo: query.tipo } : {}),
          },
        }),
      ]);

      return {
        data: movements.map((m) => ({
          ...m,
          cantidad: decimalToNumber(m.cantidad),
          costoUnitario: m.costoUnitario ? decimalToNumber(m.costoUnitario) : null,
          costoTotal: m.costoTotal ? decimalToNumber(m.costoTotal) : null,
          stockResultante: decimalToNumber(m.stockResultante),
          fecha: serializeDate(m.fecha),
          createdAt: serializeDate(m.createdAt),
        })),
        total,
        page: query.page ?? 1,
        limit: take,
        totalPages: Math.ceil(total / take),
      };
    });

    app.post("/stock/movements", { preHandler: authorize(Module.STOCK, Action.CREATE) }, async (request) => {
      const user = ensureUser(request);
      const body = z.object({
        fecha: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
        productId: z.string().min(1),
        tipo: z.nativeEnum(TipoMovimientoStock),
        cantidad: z.coerce.number().positive(),
        costoUnitario: z.coerce.number().min(0).optional(),
        moneda: z.nativeEnum(Moneda).default(Moneda.USD),
        supplierId: z.string().optional(),
        projectId: z.string().optional(),
        financeMovementId: z.string().optional(),
        referencia: z.string().optional(),
        observaciones: z.string().optional(),
      }).strict().parse(request.body);

      const product = await prisma.stockProduct.findFirst({ where: { id: body.productId, deletedAt: null } });
      if (!product) throw notFound("PRODUCT_NOT_FOUND", "Producto no encontrado");

      const stockActual = decimalToNumber(product.stockActual) ?? 0;
      const costoActual = decimalToNumber(product.costoPromedio) ?? 0;
      let nuevoStock: number;
      let nuevoCostoPromedio = costoActual;
      let descripcion: string;

      if (body.tipo === TipoMovimientoStock.INGRESO) {
        nuevoStock = stockActual + body.cantidad;
        if (body.costoUnitario && body.costoUnitario > 0) {
          nuevoCostoPromedio = stockActual > 0
            ? (stockActual * costoActual + body.cantidad * body.costoUnitario) / nuevoStock
            : body.costoUnitario;
        }
        descripcion = `Ingreso de ${body.cantidad} ${product.unidad} de ${product.nombre}`;
      } else if (body.tipo === TipoMovimientoStock.EGRESO) {
        if (stockActual < body.cantidad) {
          throw badRequest("INSUFFICIENT_STOCK", `Stock insuficiente. Disponible: ${stockActual} ${product.unidad}`);
        }
        nuevoStock = stockActual - body.cantidad;
        descripcion = `Egreso de ${body.cantidad} ${product.unidad} de ${product.nombre}`;
      } else {
        nuevoStock = body.cantidad;
        descripcion = `Ajuste de stock de ${product.nombre} a ${body.cantidad} ${product.unidad}`;
      }

      const costoTotal = body.costoUnitario ? body.cantidad * body.costoUnitario : null;

      const [stockMovement] = await prisma.$transaction([
        prisma.stockMovement.create({
          data: {
            fecha: new Date(body.fecha),
            productId: body.productId,
            tipo: body.tipo,
            cantidad: new Prisma.Decimal(body.cantidad),
            costoUnitario: body.costoUnitario ? new Prisma.Decimal(body.costoUnitario) : null,
            costoTotal: costoTotal ? new Prisma.Decimal(costoTotal) : null,
            moneda: body.moneda,
            stockResultante: new Prisma.Decimal(nuevoStock),
            supplierId: body.supplierId,
            projectId: body.projectId,
            financeMovementId: body.financeMovementId,
            referencia: body.referencia,
            observaciones: body.observaciones,
          },
        }),
        prisma.stockProduct.update({
          where: { id: body.productId },
          data: {
            stockActual: new Prisma.Decimal(nuevoStock),
            costoPromedio: new Prisma.Decimal(nuevoCostoPromedio.toFixed(4)),
          },
        }),
      ]);

      await createAuditEntry({
        entityType: AuditEntityType.stock_movement,
        entityId: stockMovement.id,
        projectId: body.projectId,
        userId: user.id,
        action: AuditAction.created,
        description: descripcion,
      });

      return {
        ...stockMovement,
        cantidad: decimalToNumber(stockMovement.cantidad),
        costoUnitario: stockMovement.costoUnitario ? decimalToNumber(stockMovement.costoUnitario) : null,
        costoTotal: stockMovement.costoTotal ? decimalToNumber(stockMovement.costoTotal) : null,
        stockResultante: decimalToNumber(stockMovement.stockResultante),
        nuevoStockActual: nuevoStock,
        nuevoCostoPromedio,
      };
    });

    app.get("/stock/products/:id/movements", { preHandler: authorize(Module.STOCK, Action.VIEW) }, async (request) => {
      const { id } = z.object({ id: z.string() }).parse(request.params);
      const query = z.object({
        page: z.coerce.number().int().positive().optional(),
        limit: z.coerce.number().int().positive().max(100).optional(),
      }).parse(request.query);

      const take = query.limit ?? 20;
      const skip = ((query.page ?? 1) - 1) * take;

      const product = await prisma.stockProduct.findFirst({ where: { id, deletedAt: null } });
      if (!product) throw notFound("PRODUCT_NOT_FOUND", "Producto no encontrado");

      const [movements, total] = await prisma.$transaction([
        prisma.stockMovement.findMany({
          where: { productId: id },
          include: {
            supplier: { select: { id: true, nombre: true } },
            project: { select: { id: true, clientName: true, code: true } },
          },
          orderBy: { fecha: "desc" },
          skip,
          take,
        }),
        prisma.stockMovement.count({ where: { productId: id } }),
      ]);

      return {
        product: {
          id: product.id, nombre: product.nombre, categoria: product.categoria,
          unidad: product.unidad, stockActual: decimalToNumber(product.stockActual),
        },
        data: movements.map((m) => ({
          id: m.id, fecha: serializeDate(m.fecha), tipo: m.tipo,
          cantidad: decimalToNumber(m.cantidad),
          costoUnitario: m.costoUnitario ? decimalToNumber(m.costoUnitario) : null,
          costoTotal: m.costoTotal ? decimalToNumber(m.costoTotal) : null,
          stockResultante: decimalToNumber(m.stockResultante),
          supplier: m.supplier, project: m.project,
          referencia: m.referencia, observaciones: m.observaciones,
          createdAt: serializeDate(m.createdAt),
        })),
        total, page: query.page ?? 1, limit: take, totalPages: Math.ceil(total / take),
      };
    });

    app.get("/stock/alerts", { preHandler: authorize(Module.STOCK, Action.VIEW) }, async () => {
      const products = await prisma.stockProduct.findMany({
        where: { deletedAt: null, activo: true },
        orderBy: { stockActual: "asc" },
      });

      const alerts = products
        .filter((p) => (decimalToNumber(p.stockActual) ?? 0) <= (decimalToNumber(p.stockMinimo) ?? 0))
        .map((p) => {
          const actual = decimalToNumber(p.stockActual) ?? 0;
          const minimo = decimalToNumber(p.stockMinimo) ?? 0;
          return {
            id: p.id, nombre: p.nombre, categoria: p.categoria, unidad: p.unidad,
            stockActual: actual, stockMinimo: minimo, moneda: p.moneda,
            ratio: minimo > 0 ? actual / minimo : 0,
          };
        })
        .sort((a, b) => a.ratio - b.ratio);

      return alerts;
    });
  }
}

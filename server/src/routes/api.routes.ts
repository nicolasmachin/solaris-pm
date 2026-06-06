import { execFile } from "node:child_process";
import { randomUUID } from "node:crypto";
import fs, { promises as fsPromises } from "node:fs";
import path from "node:path";
import { pipeline } from "node:stream/promises";
import { fileURLToPath } from "node:url";
import { promisify } from "node:util";

import archiver from "archiver";
import bcrypt from "bcryptjs";
import type { FastifyInstance } from "fastify";
import {
  AccountType,
  Action,
  AuditAction,
  AuditEntityType,
  CategoriaPrincipal,
  DeadlineRuleTipo,
  EstadoAprobacion,
  EstadoComprobante,
  ExpenseSourceType,
  FileAttachmentTipo,
  FinanceMovementStatus,
  FixedCostPeriodicity,
  MaterialStatus,
  MovementSourceType,
  GoalArea,
  GoalMetric,
  GoalPeriod,
  MetodoPago,
  ModalidadPago,
  Module,
  Moneda,
  ObraChecklistStatus,
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
  TeamType,
  TaskPriority,
  TaskStatus,
  TipoComprobante,
  TipoMovimiento,
  TipoMovimientoStock,
  TipoObra,
  UteStage,
  UteStatus,
} from "@prisma/client";
import PDFDocument from "pdfkit";
import { z } from "zod";

import { prisma } from "../lib/prisma.js";
import { env } from "../config/env.js";
import { authenticate } from "../middleware/auth.middleware.js";
import { authorize, authorizeAny, clearPermissionCache } from "../middleware/authorize.middleware.js";
import { createAuditEntriesForChanges, createAuditEntry } from "../services/audit.service.js";
import { createPlanPagos, getPlanPagos } from "../services/planPagos.service.js";
import { generateUteDocs, getOrCreateConfig as getOrCreateUteDocConfig, upsertConfig as upsertUteDocConfig } from "../services/ute-docs/generator.js";
import { UTE_DOC_KEYS, type UteDocKey } from "../services/ute-docs/coordinates.js";
import { extractFromDocument } from "../services/ute-extract/index.js";
import {
  deleteStoredFile,
  getStoredFilePath,
  saveUploadedFile,
  saveBufferAsAttachment,
  saveObraPhoto,
  deriveObraThumbUrl,
  deleteObraPhotoFiles,
} from "../services/file-storage.service.js";
import { copyLeadAttachmentsToProject } from "../services/sales/sales.service.js";
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
  SENT_APPROVED_PAIRS,
  UTE_ACTION_KEYS,
  UTE_PROCESS_INCLUDE,
  calculateTimes,
  deriveStage,
  serializeUteProcess,
  validateCoherence,
  validateDateColors,
  type DateColorsMap,
  type UteActionKey,
} from "../services/uteProcess.service.js";
import {
  isUteManagedSubstage,
  regenerateUteSubstages,
} from "../services/ute-sync.service.js";
import {
  getActivePipelineTemplate,
  getStageLabel,
  getTipoObraLabel,
  getOperationVisibility,
} from "../services/pipeline-definitions.js";
import { createNotificationIfNotExists } from "../services/notification.service.js";
import { notifyEngineeringCompleted } from "../services/notify.service.js";
import { fetchBcuRatePreview } from "../services/exchange-rate.service.js";
import {
  applyDeadlineRulesToProject,
  countProjectManualOverrides,
  recalculateProjectDeadlines,
  calculateSubstageDeadline,
} from "../services/deadline.service.js";
import { markSubstageActivity } from "../services/substage-activity.service.js";
import { findNextSubstage, notifyNextSubstageOwner } from "../services/substage-notifications.service.js";
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
    clientEmail: z.string().email().nullable().optional(),
    clientPhone: z.string().nullable().optional(),
    clientAddress: z.string().nullable().optional(),
    startDate: dateOnlySchema.optional(),
    saleDate: dateOnlySchema.optional(),
    solarSystem: solarSystemCreateSchema.optional(),
  })
  .strict();

const projectPatchSchema = z
  .object({
    clientName: z.string().min(1).optional(),
    capacityKwp: z.coerce.number().positive().optional(),
    // Peso de la obra para la métrica ponderada: entero ≥1, ≤999. .int() rechaza
    // decimales. La restricción a ADMIN se aplica en el handler (no en el schema).
    pesoObra: z.number().int().min(1).max(999).optional(),
    locationCity: z.string().min(1).optional(),
    locationProvince: z.string().min(1).optional(),
    status: z.nativeEnum(ProjectStatus).optional(),
    startDate: dateOnlySchema.optional(),
    saleDate: dateOnlySchema.nullable().optional(),
    plannedEndDate: dateOnlySchema.nullable().optional(),
    actualEndDate: dateOnlySchema.nullable().optional(),
    budgetUsd: z.coerce.number().positive().nullable().optional(),
    executedUsd: z.coerce.number().nonnegative().optional(),
    estimatedMwhYear: z.coerce.number().positive().nullable().optional(),
    modalidadPago: z.nativeEnum(ModalidadPago).nullable().optional(),
    clientEmail: z.union([z.string().email(), z.literal("")]).nullable().optional(),
    clientPhone: z.string().nullable().optional(),
    clientAddress: z.string().nullable().optional(),
    firstDateScheduledAt: z.string().datetime({ offset: true }).nullable().optional(),
    // Códigos PS/AS provistos por UTE. Solo dígitos o null para limpiar.
    uteCodigoPS: z
      .union([z.string().regex(/^\d+$/).max(50), z.literal("")])
      .nullable()
      .optional(),
    uteCodigoAS: z
      .union([z.string().regex(/^\d+$/).max(50), z.literal("")])
      .nullable()
      .optional(),
    // Datos generales del cliente que también se extraen con IA desde la
    // cédula / factura UTE (feature ute-doc-extraction).
    // nombreCliente: nombre tal cual figura en la cédula, usado en los docs
    // UTE. Independiente de clientName (nombre del proyecto).
    nombreCliente: z.string().optional(),
    ciCliente: z.string().optional(),
    calle: z.string().optional(),
    numCalle: z.string().optional(),
    personaFisica: z.boolean().optional(),
    empresa: z.boolean().optional(),
    cedulaPath: z.string().nullable().optional(),
    facturaUtePath: z.string().nullable().optional(),
  })
  .strict();

const stagePatchSchema = z
  .object({
    status: z.nativeEnum(StageStatus).optional(),
    tipoObra: z.nativeEnum(TipoObra).nullable().optional(),
    /** @deprecated usar responsibleUserId. Se mantiene sólo por retrocompat. */
    responsibleName: z.string().trim().min(1).nullable().optional(),
    responsibleUserId: z.string().min(1).nullable().optional(),
    // Si true y responsibleUserId != null, se asigna también a todas las
    // subetapas de la etapa que hoy no tienen responsable (userId=null).
    // Subetapas con userId distinto nunca se tocan.
    propagateResponsible: z.boolean().optional().default(false),
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
  if (source.pesoObra !== undefined) normalized.pesoObra = source.pesoObra;
  if (source.locationCity !== undefined) normalized.locationCity = source.locationCity;
  if (source.locationProvince !== undefined) normalized.locationProvince = source.locationProvince;
  if (source.status !== undefined) normalized.status = source.status;
  if (source.startDate !== undefined) normalized.startDate = parseDateOnly(source.startDate);
  if (source.saleDate !== undefined) {
    normalized.saleDate = source.saleDate ? parseDateOnly(source.saleDate) : null;
  }
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
  if (source.clientEmail !== undefined) normalized.clientEmail = source.clientEmail;
  if (source.clientPhone !== undefined) normalized.clientPhone = source.clientPhone;
  if (source.clientAddress !== undefined) normalized.clientAddress = source.clientAddress;
  if (source.firstDateScheduledAt !== undefined) {
    normalized.firstDateScheduledAt = source.firstDateScheduledAt ? new Date(source.firstDateScheduledAt) : null;
  }
  if (source.uteCodigoPS !== undefined) {
    normalized.uteCodigoPS = source.uteCodigoPS ? String(source.uteCodigoPS) : null;
  }
  if (source.uteCodigoAS !== undefined) {
    normalized.uteCodigoAS = source.uteCodigoAS ? String(source.uteCodigoAS) : null;
  }
  // Datos del cliente extraíbles con IA.
  if (source.nombreCliente !== undefined) normalized.nombreCliente = String(source.nombreCliente ?? "");
  if (source.ciCliente !== undefined) normalized.ciCliente = String(source.ciCliente ?? "");
  if (source.calle !== undefined) normalized.calle = String(source.calle ?? "");
  if (source.numCalle !== undefined) normalized.numCalle = String(source.numCalle ?? "");
  if (source.personaFisica !== undefined) normalized.personaFisica = Boolean(source.personaFisica);
  if (source.empresa !== undefined) normalized.empresa = Boolean(source.empresa);
  if (source.cedulaPath !== undefined) normalized.cedulaPath = source.cedulaPath || null;
  if (source.facturaUtePath !== undefined) normalized.facturaUtePath = source.facturaUtePath || null;

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
  pesoObra: "peso de la obra",
  locationCity: "ciudad",
  locationProvince: "provincia",
  status: "estado del proyecto",
  startDate: "fecha de inicio",
  saleDate: "fecha de venta",
  plannedEndDate: "fecha estimada de entrega",
  actualEndDate: "fecha real de fin",
  budgetUsd: "presupuesto USD",
  executedUsd: "monto ejecutado USD",
  estimatedMwhYear: "generación estimada anual",
  co2TonsAvoided: "CO2 evitado",
  modalidadPago: "modalidad de pago",
  clientEmail: "email del cliente",
  clientPhone: "teléfono del cliente",
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

// Path absoluto al script Python headless. Vive bajo server/scripts/ y se
// resuelve relativo al archivo actual para que ande dentro de Docker (cwd=/app)
// y en dev local (cwd=server/). Cualquier setting "PROPOSAL_SCRIPT_PATH" queda
// deprecado e ignorado.
const proposalScriptPath = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "..",
  "..",
  "scripts",
  "proposal-generator",
  "generate_proposal.py",
);
const proposalPythonBin = process.env.PROPOSAL_PYTHON ?? "python3";

async function processProposalGeneration(params: {
  proposalId: string;
  generatedById: string;
  projectId?: string | null;
}) {
  const proposal = await prisma.proposalGeneration.findUnique({
    where: { id: params.proposalId },
    include: { lead: { select: { id: true, clientName: true } } },
  });

  if (!proposal) {
    return;
  }

  const outputPath = path.resolve(
    process.cwd(),
    "..",
    env.storagePath,
    "proposals",
    `${randomUUID()}_output.pdf`,
  );

  await prisma.proposalGeneration.update({
    where: { id: params.proposalId },
    data: {
      status: "PROCESSING",
      errorMessage: null,
    },
  });

  try {
    await execFileAsync(
      proposalPythonBin,
      [proposalScriptPath, proposal.inputFilePath ?? "", outputPath],
      { timeout: 120_000 },
    );

    const stats = await fsPromises.stat(outputPath).catch(() => null);
    if (!stats) {
      throw new Error("El script terminó pero no se encontró el PDF generado");
    }

    // Si la propuesta es de un lead, crear un FileAttachment para que aparezca
    // en la sección "Adjuntos" del lead. Es soft-link al mismo archivo en disco.
    let attachmentId: string | null = null;
    if (proposal.leadId && proposal.lead) {
      const clientName = proposal.lead.clientName?.trim() || "Cliente";
      const fileName = `Propuesta Comercial Voltia - ${clientName} v${proposal.version}.pdf`;
      const storedFilename = path.basename(outputPath);
      const url = `proposals/${storedFilename}`;
      const attachment = await prisma.fileAttachment.create({
        data: {
          leadId: proposal.leadId,
          filename: fileName,
          storedFilename,
          mimeType: "application/pdf",
          sizeBytes: stats.size,
          url,
          tipo: "OTRO",
          toolSource: "ProposalGenerator",
          toolVersion: proposal.version,
          toolEntityId: proposal.id,
          uploadedById: params.generatedById,
        },
      });
      attachmentId = attachment.id;
    }

    await prisma.proposalGeneration.update({
      where: { id: params.proposalId },
      data: {
        status: "COMPLETED",
        outputFilePath: outputPath,
        attachmentId,
        completedAt: new Date(),
        errorMessage: null,
      },
    });

    // Auto-set proposalSentAt + auto-promover stage del lead asociado.
    // proposalSentAt: solo si está vacía (preserva edición manual).
    // stage: solo promueve si el lead todavía está en NUEVO_LEAD o
    // PENDIENTE_COTIZAR. Si ya está en una etapa posterior
    // (NEGOCIACION, VISITADO, CERRADO_*, etc.) NO retrocede — el caso
    // típico es regenerar la propuesta v2/v3 de un lead que ya está
    // negociando o cerrado. El usuario puede revertir el stage a mano
    // desde el Kanban.
    if (proposal.leadId) {
      const lead = await prisma.salesLead.findFirst({
        where: { id: proposal.leadId, deletedAt: null },
        select: { id: true, stage: true, proposalSentAt: true, clientName: true },
      });

      if (lead) {
        const shouldPromote =
          lead.stage === SalesStage.NUEVO_LEAD ||
          lead.stage === SalesStage.PENDIENTE_COTIZAR;
        const updates: { proposalSentAt?: Date; stage?: SalesStage } = {};
        if (!lead.proposalSentAt) updates.proposalSentAt = new Date();
        if (shouldPromote) updates.stage = SalesStage.COTIZADO;

        if (Object.keys(updates).length > 0) {
          await prisma.salesLead.update({
            where: { id: lead.id },
            data: updates,
          });
        }

        if (shouldPromote) {
          await prisma.salesActivity.create({
            data: {
              leadId: lead.id,
              userId: params.generatedById,
              fromStage: lead.stage,
              toStage: SalesStage.COTIZADO,
              action: "stage_changed",
              notes: `Promovido a COTIZADO automáticamente al generar la propuesta v${proposal.version}`,
            },
          });

          await createAuditEntry({
            entityType: AuditEntityType.lead,
            entityId: lead.id,
            userId: params.generatedById,
            action: AuditAction.lead_stage_changed,
            fieldChanged: "stage",
            oldValue: lead.stage,
            newValue: SalesStage.COTIZADO,
            description: `Lead '${lead.clientName}' movido a COTIZADO automáticamente al generar la propuesta v${proposal.version}`,
          });
        }
      }
    }

    await createAuditEntry({
      entityType: AuditEntityType.proposal,
      entityId: params.proposalId,
      projectId: params.projectId ?? null,
      userId: params.generatedById,
      action: AuditAction.proposal_generated,
      description: `Generó propuesta comercial v${proposal.version}`,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "No se pudo ejecutar el script de propuesta";

    await prisma.proposalGeneration.update({
      where: { id: params.proposalId },
      data: {
        status: "FAILED",
        errorMessage: message,
        completedAt: new Date(),
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

  const projectsSortBySchema = z.enum([
    "recent",
    "createdAt",
    "clientName",
    "installationDate",
    "progress",
    "saleDate",
  ]);
  const projectsSortOrderSchema = z.enum(["asc", "desc"]);

  app.get("/projects", { preHandler: authorize(Module.OPERACIONES, Action.VIEW) }, async (request) => {
    const query = z
      .object({
        status: z.nativeEnum(ProjectStatus).optional(),
        search: z.string().trim().optional(),
        stageInProgress: z.nativeEnum(StageType).optional(),
        sortBy: projectsSortBySchema.optional(),
        sortOrder: projectsSortOrderSchema.optional(),
        page: z.coerce.number().int().positive().optional(),
        limit: z.coerce.number().int().positive().max(100).optional(),
        schedulable: z.coerce.boolean().optional(),
      })
      .parse(request.query);

    // schedulable=true → solo proyectos elegibles para agendar una instalación:
    // no tienen un InstallationSchedule activo y no están en estado terminal
    // (COMPLETED / ARCHIVED). PAUSED se considera reagendable. Usa AND para
    // combinarse limpio con un filtro de status explícito si vino.
    const TERMINAL_STATUSES: ProjectStatus[] = [ProjectStatus.COMPLETED, ProjectStatus.ARCHIVED];
    const schedulableFilter = query.schedulable
      ? {
          AND: [
            { status: { notIn: TERMINAL_STATUSES } },
            { NOT: { installationSchedule: { deletedAt: null } } },
          ],
        }
      : {};

    const whereClause = {
      deletedAt: null,
      status: query.status,
      ...(query.search
        ? {
            OR: [
              { clientName: { contains: query.search, mode: "insensitive" as const } },
              { code: { contains: query.search, mode: "insensitive" as const } },
            ],
          }
        : {}),
      ...(query.stageInProgress
        ? {
            stages: {
              some: {
                name: query.stageInProgress,
                status: StageStatus.IN_PROGRESS,
              },
            },
          }
        : {}),
      ...schedulableFilter,
    };

    // Ordenamiento primario server-side (los campos calculados como progress
    // se re-ordenan client-side porque no están en la tabla).
    const baseOrder: Record<string, "asc" | "desc"> =
      query.sortBy === "clientName"
        ? { clientName: query.sortOrder ?? "asc" }
        : query.sortBy === "createdAt"
          ? { createdAt: query.sortOrder ?? "desc" }
          : query.sortBy === "saleDate"
            ? { saleDate: query.sortOrder ?? "desc" }
            : { updatedAt: query.sortOrder ?? "desc" }; // recent y fallback

    const projects = await prisma.project.findMany({
      where: whereClause,
      include: {
        stages: {
          orderBy: { order: "asc" },
        },
        solarSystems: {
          where: { deletedAt: null, order: 1 },
          orderBy: { order: "asc" },
        },
        installationSchedule: {
          where: { deletedAt: null },
          include: { segments: { orderBy: { startDate: "asc" }, take: 1 } },
        },
      },
      orderBy: baseOrder,
      ...(query.page || query.limit
        ? {
            skip: ((query.page ?? 1) - 1) * (query.limit ?? 20),
            take: query.limit ?? 20,
          }
        : {}),
    });

    let items = projects.map((project) => {
      const currentStage = getCurrentStage(project.stages);
      const progressPercent =
        project.stages.length > 0
          ? Math.round(project.stages.reduce((sum, stage) => sum + stage.progressPercent, 0) / project.stages.length)
          : 0;
      // completionPercent: % de etapas completadas excluyendo POSTVENTA
      // (POSTVENTA es indefinida; si alcanzamos Habilitación UTE cerrada → 100%).
      const countedStages = project.stages.filter((s) => s.name !== StageType.POSTVENTA);
      const completedCount = countedStages.filter((s) => s.status === StageStatus.COMPLETED).length;
      const completionPercent = countedStages.length > 0
        ? Math.round((completedCount / countedStages.length) * 100)
        : 0;
      const currentStages = project.stages
        .filter((s) => s.status === StageStatus.IN_PROGRESS)
        .map((s) => s.name);
      const plannedWorkStart = project.installationSchedule?.segments[0]?.startDate
        ? serializeDateOnly(project.installationSchedule.segments[0].startDate)
        : null;
      const installationTeamColor = project.installationSchedule?.teamColor ?? null;
      const installationTeamName = project.installationSchedule?.teamName ?? null;
      const installationTeamType = project.installationSchedule?.teamType ?? null;
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
        completionPercent,
        currentStages,
        plannedWorkStart,
        installationTeamColor,
        installationTeamName,
        installationTeamType,
        delayDays,
        hasOverdueStage,
        startDate: serializeDateOnly(project.startDate),
        saleDate: project.saleDate ? serializeDateOnly(project.saleDate) : null,
        plannedEndDate: serializeDateOnly(project.plannedEndDate),
        actualEndDate: serializeDateOnly(project.actualEndDate),
        createdAt: serializeDate(project.createdAt),
        solarSystems: project.solarSystems.map(serializeSolarSystem),
        currentStage: currentStage
          ? {
              id: currentStage.id,
              name: currentStage.name,
              label: getStageLabel(currentStage.name),
              status: currentStage.status,
              progressPercent: currentStage.progressPercent,
              responsibleUserId: currentStage.responsibleUserId,
            }
          : null,
        updatedAt: serializeDate(project.updatedAt),
      };
    });

    // Ordenamientos sobre campos calculados (no se pueden hacer en Prisma).
    if (query.sortBy === "progress") {
      const dir = query.sortOrder === "asc" ? 1 : -1;
      items = [...items].sort((a, b) => (a.completionPercent - b.completionPercent) * dir);
    } else if (query.sortBy === "installationDate") {
      const dir = query.sortOrder === "desc" ? -1 : 1;
      items = [...items].sort((a, b) => {
        // null al final independientemente del orden
        if (a.plannedWorkStart && b.plannedWorkStart) {
          return a.plannedWorkStart < b.plannedWorkStart ? -1 * dir : a.plannedWorkStart > b.plannedWorkStart ? 1 * dir : 0;
        }
        if (a.plannedWorkStart) return -1;
        if (b.plannedWorkStart) return 1;
        return 0;
      });
    }

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
          ...schedulableFilter,
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
        uteProcesses: {
          where: { deletedAt: null },
          include: UTE_PROCESS_INCLUDE,
          orderBy: { createdAt: "desc" },
          take: 1,
        },
      },
    });

    if (!project) {
      throw notFound("PROJECT_NOT_FOUND", "Proyecto no encontrado");
    }

    const uteProcess = project.uteProcesses[0]
      ? serializeUteProcess(project.uteProcesses[0])
      : null;

    const metrics = calculateProjectMetrics(project);

    const installationSchedule = project.installationSchedule
      ? (() => {
          const segs = project.installationSchedule!.segments;
          const env = segs.length > 0 ? envelopeOf(segs) : null;
          return {
            id: project.installationSchedule!.id,
            teamName: project.installationSchedule!.teamName,
            teamColor: project.installationSchedule!.teamColor,
            teamType: project.installationSchedule!.teamType,
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
      uteProcess,
    };
  });

  app.post("/projects", { preHandler: authorize(Module.OPERACIONES, Action.VIEW) }, async (request, reply) => {
    const user = ensureUser(request);
    const body = projectCreateSchema.parse(request.body);
    const startDate = body.startDate ? parseDateOnly(body.startDate) : todayUtc();
    // saleDate por defecto: hoy (fecha de creación del proyecto). Editable
    // después desde el detalle del proyecto.
    const saleDate = body.saleDate ? parseDateOnly(body.saleDate) : todayUtc();
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
        saleDate,
        plannedEndDate: body.plannedEndDate ? plannedEndDate : null,
        budgetUsd: body.budgetUsd != null ? new Prisma.Decimal(body.budgetUsd) : null,
        executedUsd: new Prisma.Decimal(0),
        estimatedMwhYear: body.estimatedMwhYear != null ? new Prisma.Decimal(body.estimatedMwhYear) : null,
        co2TonsAvoided: body.estimatedMwhYear != null
          ? new Prisma.Decimal((body.estimatedMwhYear * 0.5).toFixed(2))
          : null,
        modalidadPago: body.modalidadPago ?? null,
        clientEmail: body.clientEmail || null,
        clientPhone: body.clientPhone || null,
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

    // Aplicar reglas de deadline al pipeline recién creado (G.2). Es un proyecto
    // nuevo, no tiene overrides manuales todavía, así que recalcula todo.
    const deadlineResult = await applyDeadlineRulesToProject(project.id);
    if (deadlineResult.updated > 0 || deadlineResult.cleared > 0) {
      await createAuditEntry({
        entityType: AuditEntityType.project,
        entityId: project.id,
        projectId: project.id,
        userId: user.id,
        action: AuditAction.updated,
        description: `Deadlines calculados automáticamente (${deadlineResult.updated} subetapas con deadline)`,
      });
    }

    const newUteProcess = await prisma.uteProcess.create({
      data: {
        projectId: project.id,
        currentStage: UteStage.CONSULTA,
        currentStatus: UteStatus.PENDIENTE,
        createdById: user.id,
      },
    });

    // Genera las 11 subetapas system bajo HABILITACION_UTE.
    await regenerateUteSubstages(prisma, newUteProcess);

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

    // pesoObra solo lo edita ADMIN. Comparamos contra el valor actual para no
    // bloquear a un no-ADMIN que reenvía el peso sin cambiarlo (payload completo).
    if (
      body.pesoObra !== undefined &&
      body.pesoObra !== project.pesoObra &&
      user.role !== "ADMIN"
    ) {
      throw new AppError(403, "PESO_OBRA_ADMIN_ONLY", "Solo un administrador puede cambiar el peso de la obra");
    }

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

  // ─── Checklist de referencia por proyecto (obra) ──────────────────────────
  // Plantilla maestra (ChecklistTemplate) → instancias por proyecto
  // (ProjectChecklistItem). El GET hace lazy-init de las instancias la primera
  // vez que se consulta un proyecto sin ítems.

  type ProjectChecklistItemWithUser = Prisma.ProjectChecklistItemGetPayload<{
    include: { completedBy: { select: { id: true; name: true } } };
  }>;

  const serializeProjectChecklistItem = (item: ProjectChecklistItemWithUser) => ({
    id: item.id,
    name: item.name,
    description: item.description,
    order: item.order,
    status: item.status,
    observation: item.observation,
    isCustom: item.templateId === null,
    completedBy: item.completedBy ? { id: item.completedBy.id, name: item.completedBy.name } : null,
    completedAt: serializeDate(item.completedAt),
  });

  const projectChecklistInclude = {
    completedBy: { select: { id: true, name: true } },
  } satisfies Prisma.ProjectChecklistItemInclude;

  async function findProjectChecklistItemOrThrow(projectId: string, itemId: string) {
    const item = await prisma.projectChecklistItem.findFirst({
      where: { id: itemId, projectId },
      include: projectChecklistInclude,
    });

    if (!item) {
      throw notFound("CHECKLIST_ITEM_NOT_FOUND", "Ítem de checklist no encontrado");
    }

    return item;
  }

  const projectChecklistItemCreateSchema = z.object({
    name: z.string().min(1).max(200),
    description: z.string().max(1000).optional(),
  });

  const projectChecklistItemPatchSchema = z.object({
    status: z.enum(["OK", "PENDING"]).optional(),
    observation: z.string().max(1000).nullable().optional(),
  });

  app.get("/projects/:projectId/checklist", { preHandler: authorize(Module.OPERACIONES, Action.VIEW) }, async (request) => {
    const params = z.object({ projectId: z.string() }).parse(request.params);
    await findProjectOrThrow(params.projectId);

    const existingCount = await prisma.projectChecklistItem.count({
      where: { projectId: params.projectId },
    });

    // Lazy init: si el proyecto no tiene ningún ítem, generarlos desde las
    // plantillas activas (ordenadas por order ASC, createdAt ASC).
    if (existingCount === 0) {
      const templates = await prisma.checklistTemplate.findMany({
        where: { isActive: true },
        orderBy: [{ order: "asc" }, { createdAt: "asc" }],
      });

      if (templates.length > 0) {
        await prisma.projectChecklistItem.createMany({
          data: templates.map((template) => ({
            projectId: params.projectId,
            templateId: template.id,
            name: template.name,
            description: template.description,
            order: template.order,
            status: ObraChecklistStatus.PENDING,
          })),
        });
      }
    }

    const items = await prisma.projectChecklistItem.findMany({
      where: { projectId: params.projectId },
      include: projectChecklistInclude,
      orderBy: [{ order: "asc" }, { createdAt: "asc" }],
    });

    const total = items.length;
    const completed = items.filter((item) => item.status === ObraChecklistStatus.OK).length;
    const pending = total - completed;
    const percentComplete = total === 0 ? 0 : Math.round((completed / total) * 100);

    return {
      items: items.map(serializeProjectChecklistItem),
      summary: { total, completed, pending, percentComplete },
    };
  });

  app.post("/projects/:projectId/checklist", { preHandler: authorize(Module.OPERACIONES, Action.CREATE) }, async (request, reply) => {
    const params = z.object({ projectId: z.string() }).parse(request.params);
    const body = projectChecklistItemCreateSchema.parse(request.body);
    await findProjectOrThrow(params.projectId);

    const maxOrder = await prisma.projectChecklistItem.aggregate({
      where: { projectId: params.projectId },
      _max: { order: true },
    });

    const item = await prisma.projectChecklistItem.create({
      data: {
        projectId: params.projectId,
        templateId: null,
        name: body.name,
        description: body.description ?? null,
        order: (maxOrder._max.order ?? 0) + 1,
        status: ObraChecklistStatus.PENDING,
      },
      include: projectChecklistInclude,
    });

    reply.code(201);
    return serializeProjectChecklistItem(item);
  });

  app.patch("/projects/:projectId/checklist/:itemId", { preHandler: authorize(Module.OPERACIONES, Action.EDIT) }, async (request) => {
    const user = ensureUser(request);
    const params = z.object({ projectId: z.string(), itemId: z.string() }).parse(request.params);
    const body = projectChecklistItemPatchSchema.parse(request.body);
    await findProjectChecklistItemOrThrow(params.projectId, params.itemId);

    const updateData: Prisma.ProjectChecklistItemUpdateInput = {};

    if (body.status === "OK") {
      updateData.status = ObraChecklistStatus.OK;
      updateData.completedBy = { connect: { id: user.id } };
      updateData.completedAt = new Date();
    } else if (body.status === "PENDING") {
      updateData.status = ObraChecklistStatus.PENDING;
      updateData.completedBy = { disconnect: true };
      updateData.completedAt = null;
    }

    if (body.observation !== undefined) {
      updateData.observation = body.observation;
    }

    const updatedItem = await prisma.projectChecklistItem.update({
      where: { id: params.itemId },
      data: updateData,
      include: projectChecklistInclude,
    });

    return serializeProjectChecklistItem(updatedItem);
  });

  app.delete("/projects/:projectId/checklist/:itemId", { preHandler: authorize(Module.OPERACIONES, Action.DELETE) }, async (request, reply) => {
    const params = z.object({ projectId: z.string(), itemId: z.string() }).parse(request.params);
    const item = await findProjectChecklistItemOrThrow(params.projectId, params.itemId);

    if (item.templateId !== null) {
      throw badRequest("CHECKLIST_ITEM_NOT_CUSTOM", "Solo se pueden eliminar ítems personalizados");
    }

    await prisma.projectChecklistItem.delete({ where: { id: item.id } });

    return reply.code(204).send();
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

        // Regla 3: al completar OPERACIONES, validar contra fechas de instalación.
        // Sólo bloqueamos si la obra sigue en curso (último endDate > hoy).
        // Eliminamos el warning WORK_END_NOT_CONFIRMED para simplificar el flujo:
        // si la fecha ya pasó, se permite cerrar sin alerta.
        if (stage.name === StageType.OPERACIONES) {
          const installation = await prisma.installationSchedule.findFirst({
            where: { projectId: params.projectId, deletedAt: null },
            select: {
              segments: { orderBy: { endDate: "desc" }, take: 1, select: { endDate: true } },
            },
          });
          if (installation) {
            const today = todayUtc();
            const lastEnd = installation.segments[0]?.endDate ?? null;
            if (lastEnd && lastEnd.getTime() > today.getTime()) {
              throw badRequest(
                "INSTALL_NOT_FINISHED",
                `La instalación está programada hasta el ${formatDateEs(lastEnd)}, que aún no pasó. Ajustá las fechas de instalación o esperá a que finalice antes de cerrar Operaciones.`,
              );
            }
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

    // Propagación del responsable a subetapas sin userId: sólo aplica si el
    // flag viene en true y el nuevo responsibleUserId no es null. El
    // update del stage, la propagación y el sync de fechas del proyecto van
    // juntos en una $transaction para que sean atómicos (si falla uno,
    // revierte todo).
    const nextResponsibleUserId =
      body.responsibleUserId !== undefined ? body.responsibleUserId : stage.responsibleUserId;
    const shouldPropagateResponsible =
      body.propagateResponsible === true &&
      body.responsibleUserId !== undefined &&
      body.responsibleUserId !== null;

    const { updatedStage, propagatedCount } = await prisma.$transaction(async (tx) => {
      const stageAfter = await tx.stage.update({
        where: { id: stage.id },
        data: updateData,
      });

      let propagated = 0;
      if (shouldPropagateResponsible && nextResponsibleUserId) {
        const result = await tx.substage.updateMany({
          where: {
            stageId: stage.id,
            userId: null,
            deletedAt: null,
            isActive: true,
          },
          data: { userId: nextResponsibleUserId },
        });
        propagated = result.count;
      }

      // Sincronizar fechas reales de Project según la etapa tocada
      const projectSync: Prisma.ProjectUpdateInput = {};
      if (stage.name === StageType.ONBOARDING) {
        projectSync.actualOnboardingEnd = stageAfter.actualEndDate;
      }
      if (stage.name === StageType.INGENIERIA) {
        projectSync.actualEngineeringEnd = stageAfter.actualEndDate;
      }
      if (stage.name === StageType.HABILITACION_UTE) {
        projectSync.actualUteStart = stageAfter.actualStartDate;
        projectSync.actualUteEnd = stageAfter.actualEndDate;
      }
      if (Object.keys(projectSync).length > 0) {
        await tx.project.update({
          where: { id: params.projectId },
          data: projectSync,
        });
      }

      return { updatedStage: stageAfter, propagatedCount: propagated };
    });

    if (propagatedCount > 0) {
      // No hay AuditAction específico para "responsable propagado"; dejamos
      // traza en logs estructurados (mismo patrón que /my-tasks?userId=).
      request.log.info(
        {
          type: "stage_responsible_propagated",
          stageId: stage.id,
          projectId: params.projectId,
          responsibleUserId: nextResponsibleUserId,
          substagesUpdated: propagatedCount,
          triggeredBy: user.id,
        },
        `Stage ${getStageLabel(stage.name)}: propagó responsable a ${propagatedCount} subetapas`,
      );
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

    // Aviso a Operaciones + Admin cuando Ingeniería queda completada.
    if (
      body.status &&
      body.status !== stage.status &&
      stage.name === StageType.INGENIERIA &&
      body.status === StageStatus.COMPLETED
    ) {
      await notifyEngineeringCompleted({
        projectId: params.projectId,
        trigger: "stage_completed",
      });
    }

    await refreshStageProgressAndProject(stage.id, params.projectId);

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

  // Conteo rápido de subetapas sin responsable asignado. El frontend lo
  // consulta antes de cambiar el responsable de la etapa para decidir si
  // muestra el modal de "propagar a subetapas sin responsable".
  app.get(
    "/projects/:projectId/stages/:stageId/substages/unassigned-count",
    { preHandler: authorize(Module.OPERACIONES, Action.VIEW) },
    async (request) => {
      const params = z.object({ projectId: z.string(), stageId: z.string() }).parse(request.params);
      await findStageOrThrow(params.projectId, params.stageId);

      const count = await prisma.substage.count({
        where: {
          projectId: params.projectId,
          stageId: params.stageId,
          deletedAt: null,
          isActive: true,
          userId: null,
        },
      });

      return { count };
    },
  );

  app.post("/projects/:projectId/stages/:stageId/substages", { preHandler: authorize(Module.OPERACIONES, Action.EDIT) }, async (request, reply) => {
    const user = ensureUser(request);
    const params = z.object({ projectId: z.string(), stageId: z.string() }).parse(request.params);
    const body = substageCreateSchema.parse(request.body);
    const stage = await findStageOrThrow(params.projectId, params.stageId);

    if (stage.name === "HABILITACION_UTE") {
      throw badRequest(
        "UTE_SUBSTAGES_AUTOMATIC",
        "Las subetapas de Trámite UTE se generan automáticamente desde el módulo Trámites UTE. No se pueden crear manualmente.",
      );
    }

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

  // Mantiene dueDate y deadline sincronizados (dueDate es espejo de deadline).
  // Si el body trae `deadline`, manda deadline; si trae `dueDate`, lo replica a
  // deadline; si trae ambos, prioriza deadline. En edición manual marca
  // deadlineManuallySet=true para que el recálculo respete el override.
  function syncDeadlineDueDate(patch: { deadline?: Date | null; dueDate?: Date | null }): {
    deadline?: Date | null;
    dueDate?: Date | null;
    deadlineManuallySet?: boolean;
  } {
    if (patch.deadline !== undefined) {
      return { deadline: patch.deadline, dueDate: patch.deadline, deadlineManuallySet: true };
    }
    if (patch.dueDate !== undefined) {
      return { deadline: patch.dueDate, dueDate: patch.dueDate, deadlineManuallySet: true };
    }
    return {};
  }

  app.patch("/projects/:projectId/stages/:stageId/substages/:substageId", { preHandler: authorize(Module.OPERACIONES, Action.EDIT) }, async (request) => {
    const user = ensureUser(request);
    const params = z
      .object({ projectId: z.string(), stageId: z.string(), substageId: z.string() })
      .parse(request.params);
    const body = substagePatchSchema.parse(request.body);
    const substage = await findSubstageOrThrow(params.projectId, params.stageId, params.substageId);

    // Bloqueo: las subetapas system de HABILITACION_UTE (las 11 generadas
    // desde UteProcess) no permiten cambios de nombre, status, sopCode,
    // responsable* ni fechas planned/actual desde este endpoint. Sí permiten
    // userId, dueDate y notes.
    if (isUteManagedSubstage(substage)) {
      const blocked: Array<keyof typeof body> = [
        "name",
        "sopCode",
        "responsableRol",
        "responsible",
        "plannedStartDate",
        "plannedEndDate",
        "status",
      ];
      for (const k of blocked) {
        if (body[k] !== undefined) {
          throw badRequest(
            "UTE_SUBSTAGE_LOCKED",
            "Esta subetapa se sincroniza automáticamente desde el módulo Trámites UTE. Sólo podés editar responsable, deadline y notas.",
          );
        }
      }
    }

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
    if (body.dueDate !== undefined) {
      // Editar dueDate sincroniza deadline (espejo) y marca override manual.
      const parsedDue = body.dueDate ? parseDateOnly(body.dueDate) : null;
      Object.assign(updateData, syncDeadlineDueDate({ dueDate: parsedDue }));
    }
    if (body.plannedStartDate !== undefined) updateData.plannedStartDate = body.plannedStartDate ? parseDateOnly(body.plannedStartDate) : null;
    if (body.plannedEndDate !== undefined) updateData.plannedEndDate = body.plannedEndDate ? parseDateOnly(body.plannedEndDate) : null;
    if (body.notes !== undefined) updateData.notes = body.notes;

    // G.3: cualquier cambio en una subetapa cuenta como "actividad"
    await markSubstageActivity(substage.id);

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
      // G.3: si se reabre una subetapa completada → limpiar actualEndDate y duración
      if (substage.status === SubstageStatus.COMPLETED && body.status !== SubstageStatus.COMPLETED) {
        updateData.actualEndDate = null;
        updateData.actualDurationDays = null;
        updateData.delayDays = null;
      }
    }

    const updatedSubstage = await prisma.substage.update({
      where: { id: substage.id },
      data: updateData,
    });

    // G.3: si recién se completó esta subetapa, notificar al responsable de la
    // siguiente. Best-effort, no bloquea la respuesta si falla.
    if (body.status === SubstageStatus.COMPLETED && substage.status !== SubstageStatus.COMPLETED) {
      void notifyNextSubstageOwner(substage.id);
    }

    const syncedSubstage = await syncSubstageProgress(substage.id);
    let syncedStage = await syncStageProgress(params.stageId);
    await calculateProjectProgress(params.projectId);

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

    if (isUteManagedSubstage(substage)) {
      throw badRequest(
        "UTE_SUBSTAGE_LOCKED",
        "Esta subetapa se completa automáticamente al cargar la fecha en el módulo Trámites UTE.",
      );
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
    const { syncedStage } = await refreshStageProgressAndProject(substage.stageId, substage.projectId);

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

    // G.3: notificar al responsable de la siguiente subetapa (best-effort)
    void notifyNextSubstageOwner(substage.id);

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
    const stage = await findStageOrThrow(params.projectId, params.stageId);

    if (stage.name === "HABILITACION_UTE") {
      throw badRequest(
        "UTE_SUBSTAGES_AUTOMATIC",
        "El orden de las subetapas de Trámite UTE no se puede cambiar manualmente.",
      );
    }

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

    if (isUteManagedSubstage(substage)) {
      throw badRequest(
        "UTE_SUBSTAGE_LOCKED",
        "Esta subetapa se sincroniza automáticamente desde Trámites UTE y no puede eliminarse.",
      );
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

  // ─── Tareas sueltas (standalone) ───────────────────────────────────────────
  //
  // Endpoints sin projectId en la URL. Soportan tanto tareas sueltas como
  // tareas atadas a un proyecto. Conviven con `/projects/:projectId/tasks/*`
  // — los flujos viejos no se tocan. Permiso: usuario autenticado; la
  // autorización fina por dueño/admin se hace inline en el handler.

  app.post("/tasks", async (request, reply) => {
    const user = ensureUser(request);
    const body = z
      .object({
        title: z.string().min(1).max(200),
        description: z.string().max(2000).nullable().optional(),
        dueDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable().optional(),
        projectId: z.string().min(1).nullable().optional(),
        assignedUserId: z.string().min(1).nullable().optional(),
      })
      .strict()
      .parse(request.body);

    if (body.projectId) {
      const project = await prisma.project.findFirst({
        where: { id: body.projectId, deletedAt: null },
        select: { id: true },
      });
      if (!project) {
        throw badRequest("PROJECT_NOT_FOUND", "El proyecto especificado no existe");
      }
    }

    if (body.assignedUserId) {
      await assertUserActiveOrThrow(body.assignedUserId, "assignedUserId");
    }

    // Default de asignado: el usuario que crea la tarea. Si vino explícito
    // (incluido `null` para crearla sin asignar), respetar lo que vino.
    const assignedUserId =
      body.assignedUserId === undefined ? user.id : body.assignedUserId;

    const task = await prisma.task.create({
      data: {
        projectId: body.projectId ?? null,
        title: body.title,
        description: body.description ?? null,
        status: TaskStatus.PENDING,
        priority: TaskPriority.NORMAL,
        responsible: "",
        userId: assignedUserId,
        dueDate: body.dueDate ? parseDateOnly(body.dueDate) : null,
      },
    });

    if (task.projectId) {
      await createAuditEntry({
        entityType: AuditEntityType.task,
        entityId: task.id,
        projectId: task.projectId,
        userId: user.id,
        action: AuditAction.created,
        description: `Creó tarea '${task.title}'`,
      });
    }

    reply.code(201);
    return serializeTask(task);
  });

  app.patch("/tasks/:id", async (request) => {
    const user = ensureUser(request);
    const params = z.object({ id: z.string() }).parse(request.params);
    const body = z
      .object({
        title: z.string().min(1).max(200).optional(),
        description: z.string().max(2000).nullable().optional(),
        dueDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable().optional(),
        projectId: z.string().min(1).nullable().optional(),
        assignedUserId: z.string().min(1).nullable().optional(),
        status: z.enum([TaskStatus.PENDING, TaskStatus.COMPLETED]).optional(),
      })
      .strict()
      .parse(request.body);

    const task = await prisma.task.findFirst({
      where: { id: params.id, deletedAt: null },
    });
    if (!task) throw notFound("TASK_NOT_FOUND", "Tarea no encontrada");

    // Permisos: ADMIN puede editar cualquiera. No-ADMIN solo puede editar las
    // tareas que tiene asignadas (userId === me). No hay concepto de "creador"
    // en el modelo Task — se decidió no agregarlo en esta iteración.
    const isAdmin = user.role === "ADMIN";
    if (!isAdmin && task.userId !== user.id) {
      throw forbidden("No tenés permiso para modificar esta tarea");
    }

    if (body.projectId !== undefined && body.projectId !== null) {
      const project = await prisma.project.findFirst({
        where: { id: body.projectId, deletedAt: null },
        select: { id: true },
      });
      if (!project) {
        throw badRequest("PROJECT_NOT_FOUND", "El proyecto especificado no existe");
      }
    }

    if (body.assignedUserId !== undefined && body.assignedUserId !== null) {
      await assertUserActiveOrThrow(body.assignedUserId, "assignedUserId");
    }

    const updateData: Record<string, unknown> = {};
    if (body.title !== undefined) updateData.title = body.title;
    if (body.description !== undefined) updateData.description = body.description;
    if (body.dueDate !== undefined) updateData.dueDate = body.dueDate ? parseDateOnly(body.dueDate) : null;
    if (body.projectId !== undefined) {
      updateData.projectId = body.projectId;
      // Al cambiar de proyecto (o dejar suelta) limpiar stage/substage que
      // pertenecen al proyecto anterior.
      if (body.projectId !== task.projectId) {
        updateData.stageId = null;
        updateData.substageId = null;
      }
    }
    if (body.assignedUserId !== undefined) updateData.userId = body.assignedUserId;
    if (body.status !== undefined) {
      updateData.status = body.status;
      updateData.completedAt = body.status === TaskStatus.COMPLETED ? new Date() : null;
    }

    const updatedTask = await prisma.task.update({
      where: { id: task.id },
      data: updateData,
    });

    if (updatedTask.projectId) {
      await createAuditEntry({
        entityType: AuditEntityType.task,
        entityId: task.id,
        projectId: updatedTask.projectId,
        userId: user.id,
        action: AuditAction.updated,
        description: `Actualizó tarea '${task.title}'`,
      });
    }

    return serializeTask(updatedTask);
  });

  app.delete("/tasks/:id", async (request, reply) => {
    const user = ensureUser(request);
    const params = z.object({ id: z.string() }).parse(request.params);

    const task = await prisma.task.findFirst({
      where: { id: params.id, deletedAt: null },
    });
    if (!task) throw notFound("TASK_NOT_FOUND", "Tarea no encontrada");

    const isAdmin = user.role === "ADMIN";
    if (!isAdmin && task.userId !== user.id) {
      throw forbidden("No tenés permiso para eliminar esta tarea");
    }

    await prisma.task.update({
      where: { id: task.id },
      data: { deletedAt: new Date() },
    });

    reply.code(204);
    return null;
  });

  // ─── Detalle individual de tarea ───────────────────────────────────────────
  //
  // GET dedicado para el TaskDetailModal. Devuelve la tarea con sus
  // relaciones (project, stage, substage, user). Permiso: ADMIN o asignado.
  // Si la tarea es suelta (projectId null), cualquier autenticado puede
  // verla si es el asignado.

  app.get("/tasks/:id", async (request) => {
    const user = ensureUser(request);
    const params = z.object({ id: z.string() }).parse(request.params);

    const task = await prisma.task.findFirst({
      where: { id: params.id, deletedAt: null },
      include: {
        project: { select: { id: true, code: true, clientName: true } },
        stage: { select: { id: true, name: true } },
        substage: { select: { id: true, name: true } },
        user: { select: { id: true, name: true, email: true } },
      },
    });
    if (!task) throw notFound("TASK_NOT_FOUND", "Tarea no encontrada");

    const isAdmin = user.role === "ADMIN";
    if (!isAdmin && task.userId !== user.id) {
      throw forbidden("No tenés permiso para ver esta tarea");
    }

    return {
      id: task.id,
      title: task.title,
      description: task.description,
      status: task.status,
      priority: task.priority,
      dueDate: serializeDateOnly(task.dueDate),
      projectId: task.projectId,
      project: task.project
        ? { id: task.project.id, code: task.project.code, name: task.project.clientName }
        : null,
      stageId: task.stageId,
      stage: task.stage,
      substageId: task.substageId,
      substage: task.substage,
      userId: task.userId,
      user: task.user,
      completedAt: serializeDate(task.completedAt),
      createdAt: serializeDate(task.createdAt),
      updatedAt: serializeDate(task.updatedAt),
    };
  });

  // ─── Comentarios de tareas ─────────────────────────────────────────────────
  //
  // Endpoints específicos /api/tasks/:taskId/comments[/...]. Conviven con
  // los endpoints generales /api/comments/* pero con dos diferencias:
  //   - aceptan tareas sueltas (projectId NULL) — los viejos las bloqueaban
  //     con PROJECT_REQUIRED;
  //   - PATCH/DELETE solo permiten al autor. ADMIN no tiene poder extra
  //     sobre comentarios ajenos, a diferencia del flow viejo de
  //     comentarios de proyecto/lead.
  // Heredan el projectId de la tarea (puede ser null para sueltas) para
  // que el comentario aparezca en los listados de proyecto también si
  // corresponde.

  async function findTaskForCommentOrThrow(taskId: string, user: { id: string; role: string }) {
    const task = await prisma.task.findFirst({
      where: { id: taskId, deletedAt: null },
      select: { id: true, projectId: true, userId: true, title: true },
    });
    if (!task) throw notFound("TASK_NOT_FOUND", "Tarea no encontrada");
    const isAdmin = user.role === "ADMIN";
    if (!isAdmin && task.userId !== user.id) {
      throw forbidden("No tenés permiso para acceder a los comentarios de esta tarea");
    }
    return task;
  }

  app.get("/tasks/:taskId/comments", async (request) => {
    const user = ensureUser(request);
    const params = z.object({ taskId: z.string() }).parse(request.params);
    await findTaskForCommentOrThrow(params.taskId, user);

    const comments = await prisma.comment.findMany({
      where: { taskId: params.taskId, deletedAt: null },
      include: { author: { select: { id: true, name: true } } },
      orderBy: { createdAt: "asc" },
    });
    return comments.map(serializeComment);
  });

  app.post("/tasks/:taskId/comments", async (request, reply) => {
    const user = ensureUser(request);
    const params = z.object({ taskId: z.string() }).parse(request.params);
    const body = z
      .object({ content: z.string().trim().min(1).max(5000) })
      .strict()
      .parse(request.body);
    const task = await findTaskForCommentOrThrow(params.taskId, user);

    const comment = await prisma.comment.create({
      data: {
        content: body.content,
        authorId: user.id,
        taskId: task.id,
        // Heredamos projectId de la tarea para que el comentario aparezca
        // también en /projects/:id/comments si la tarea pertenece a un
        // proyecto. Tareas sueltas → projectId null.
        projectId: task.projectId,
      },
      include: { author: { select: { id: true, name: true } } },
    });

    if (task.projectId) {
      await createAuditEntry({
        entityType: AuditEntityType.comment,
        entityId: comment.id,
        projectId: task.projectId,
        userId: user.id,
        action: AuditAction.comment_added,
        description: `Agregó un comentario en la tarea '${task.title}'`,
        metadata: { taskId: task.id },
      });
    }

    reply.code(201);
    return serializeComment(comment);
  });

  app.patch("/tasks/:taskId/comments/:commentId", async (request) => {
    const user = ensureUser(request);
    const params = z
      .object({ taskId: z.string(), commentId: z.string() })
      .parse(request.params);
    const body = z
      .object({ content: z.string().trim().min(1).max(5000) })
      .strict()
      .parse(request.body);
    await findTaskForCommentOrThrow(params.taskId, user);

    const existing = await prisma.comment.findFirst({
      where: { id: params.commentId, taskId: params.taskId, deletedAt: null },
    });
    if (!existing) throw notFound("COMMENT_NOT_FOUND", "Comentario no encontrado");
    // ADMIN no tiene poder extra acá. Solo el autor edita lo suyo.
    if (existing.authorId !== user.id) {
      throw forbidden("Solo podés editar tus propios comentarios");
    }

    const updated = await prisma.comment.update({
      where: { id: existing.id },
      data: { content: body.content, isEdited: true, editedAt: new Date() },
      include: { author: { select: { id: true, name: true } } },
    });
    return serializeComment(updated);
  });

  app.delete("/tasks/:taskId/comments/:commentId", async (request, reply) => {
    const user = ensureUser(request);
    const params = z
      .object({ taskId: z.string(), commentId: z.string() })
      .parse(request.params);
    await findTaskForCommentOrThrow(params.taskId, user);

    const existing = await prisma.comment.findFirst({
      where: { id: params.commentId, taskId: params.taskId, deletedAt: null },
    });
    if (!existing) throw notFound("COMMENT_NOT_FOUND", "Comentario no encontrado");
    if (existing.authorId !== user.id) {
      throw forbidden("Solo podés eliminar tus propios comentarios");
    }

    await prisma.comment.update({
      where: { id: existing.id },
      data: { deletedAt: new Date() },
    });

    reply.code(204);
    return null;
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

    // G.3: marcar actividad si el archivo apunta a una subetapa
    await markSubstageActivity(substageId);

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
      let source: "stage" | "substage" | "generated" | "other" = "other";
      let sourceLabel = "Proyecto";
      let stageId: string | null = null;
      let substageId: string | null = null;
      // Documentos generados por herramientas del módulo Ingeniería (toolSource).
      // Tienen prioridad sobre el match por stage/substage para que el badge
      // "Ingeniería · Unifilar v3" se muestre coherente.
      if (file.toolSource === "unifilar") {
        source = "generated";
        sourceLabel = file.toolVersion
          ? `Ingeniería · Unifilar v${file.toolVersion}`
          : "Ingeniería · Unifilar";
      } else if (file.toolSource === "materiales-con-precios") {
        source = "generated";
        sourceLabel = file.toolVersion
          ? `Ingeniería · Materiales v${file.toolVersion} (con precios)`
          : "Ingeniería · Materiales (con precios)";
      } else if (file.toolSource === "materiales-sin-precios") {
        source = "generated";
        sourceLabel = file.toolVersion
          ? `Ingeniería · Materiales v${file.toolVersion} (sin precios)`
          : "Ingeniería · Materiales (sin precios)";
      } else if (file.toolSource === "triangulos") {
        source = "generated";
        sourceLabel = file.toolVersion
          ? `Ingeniería · Triángulos v${file.toolVersion}`
          : "Ingeniería · Triángulos";
      } else if (file.toolSource === "preing") {
        source = "generated";
        sourceLabel = file.toolVersion
          ? `Ingeniería · Pre-ingeniería v${file.toolVersion}`
          : "Ingeniería · Pre-ingeniería";
      } else if (file.toolSource === "consolidado") {
        source = "generated";
        sourceLabel = file.toolVersion
          ? `Consolidador · v${file.toolVersion}`
          : "Consolidador";
      } else if (file.tipo === FileAttachmentTipo.LISTA_MATERIALES) {
        source = "generated";
        sourceLabel = "Generado · Lista de materiales";
      } else if (file.tipo === FileAttachmentTipo.PRESUPUESTO) {
        source = "generated";
        sourceLabel = "Generado · Presupuesto";
      } else if (file.substage) {
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
        tipo: file.tipo ?? null,
        toolSource: file.toolSource,
        toolVersion: file.toolVersion,
        toolEntityId: file.toolEntityId,
        uploadedAt: serializeDate(file.createdAt),
        uploadedBy: file.uploadedById,
        source,
        sourceLabel,
        stageId,
        substageId,
        downloadUrl: `/api/files/${file.id}/download`,
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

  // Sirve el thumbnail de una foto de obra (JPEG 400px). Si no existe thumb en
  // disco (archivos que no son de obra), hace fallback al archivo original.
  app.get("/files/:fileId/thumbnail", { preHandler: authorize(Module.OPERACIONES, Action.VIEW) }, async (request, reply) => {
    ensureUser(request);
    const params = z.object({ fileId: z.string() }).parse(request.params);
    const file = await findFileOrThrow(params.fileId);

    const thumbPath = getStoredFilePath(deriveObraThumbUrl(file.url));
    if (fs.existsSync(thumbPath)) {
      reply.header("Content-Type", "image/jpeg");
      reply.header("Content-Disposition", "inline");
      return reply.send(fs.createReadStream(thumbPath));
    }

    // Fallback: servir el original (archivos sin thumbnail generado).
    const originalPath = getStoredFilePath(file.url);
    if (!fs.existsSync(originalPath)) {
      throw notFound("FILE_NOT_FOUND", "El archivo no existe en storage");
    }
    reply.header("Content-Type", file.mimeType);
    reply.header("Content-Disposition", "inline");
    return reply.send(fs.createReadStream(originalPath));
  });

  // ============================================================
  // GALERÍA DE FOTOS DE OBRA (PASO 4 + descarga ZIP PASO 4.5)
  // ============================================================

  type ObraPhotoRow = {
    id: string;
    filename: string;
    sizeBytes: number;
    createdAt: Date;
    uploadedBy: { id: string; name: string | null } | null;
  };

  const mapObraPhoto = (photo: ObraPhotoRow) => ({
    id: photo.id,
    filename: photo.filename,
    thumbnailUrl: `/api/files/${photo.id}/thumbnail`,
    fullUrl: `/api/files/${photo.id}/preview`,
    sizeBytes: photo.sizeBytes,
    uploadedBy: photo.uploadedBy
      ? { id: photo.uploadedBy.id, name: photo.uploadedBy.name }
      : null,
    createdAt: serializeDate(photo.createdAt),
  });

  app.get("/projects/:projectId/obra/photos", { preHandler: authorize(Module.OPERACIONES, Action.VIEW) }, async (request) => {
    const params = z.object({ projectId: z.string() }).parse(request.params);
    const project = await findProjectOrThrow(params.projectId);

    const photos = await prisma.fileAttachment.findMany({
      where: {
        projectId: project.id,
        toolSource: "obra-fotos",
        deletedAt: null,
      },
      orderBy: { createdAt: "desc" },
      include: { uploadedBy: { select: { id: true, name: true } } },
    });

    return {
      photos: photos.map(mapObraPhoto),
      count: photos.length,
    };
  });

  app.post("/projects/:projectId/obra/photos", { preHandler: authorize(Module.OPERACIONES, Action.CREATE) }, async (request, reply) => {
    const user = ensureUser(request);
    const params = z.object({ projectId: z.string() }).parse(request.params);
    const project = await findProjectOrThrow(params.projectId);

    const parts = request.parts();
    const created: ReturnType<typeof mapObraPhoto>[] = [];

    // El cliente sube de a UNA foto por request, pero soportamos el loop por si
    // llegan varias en un mismo multipart.
    for await (const part of parts) {
      if (part.type === "file") {
        const savedPhoto = await saveObraPhoto(part, project.id);
        const attachment = await prisma.fileAttachment.create({
          data: {
            projectId: project.id,
            filename: savedPhoto.filename,
            storedFilename: savedPhoto.storedFilename,
            mimeType: savedPhoto.mimeType,
            sizeBytes: savedPhoto.sizeBytes,
            url: savedPhoto.url,
            tipo: FileAttachmentTipo.OTRO,
            toolSource: "obra-fotos",
            uploadedById: user.id,
          },
          include: { uploadedBy: { select: { id: true, name: true } } },
        });
        created.push(mapObraPhoto(attachment));

        await createAuditEntry({
          entityType: AuditEntityType.file,
          entityId: attachment.id,
          projectId: project.id,
          userId: user.id,
          action: AuditAction.file_uploaded,
          description: `Subió foto de obra '${savedPhoto.filename}'`,
        });
      }
    }

    if (created.length === 0) {
      throw badRequest("PHOTO_REQUIRED", "Debés adjuntar al menos una foto");
    }

    reply.code(201);
    return { photos: created };
  });

  app.delete("/projects/:projectId/obra/photos/:photoId", { preHandler: authorize(Module.OPERACIONES, Action.DELETE) }, async (request, reply) => {
    const user = ensureUser(request);
    const params = z.object({ projectId: z.string(), photoId: z.string() }).parse(request.params);

    const photo = await prisma.fileAttachment.findFirst({
      where: {
        id: params.photoId,
        projectId: params.projectId,
        toolSource: "obra-fotos",
        deletedAt: null,
      },
    });
    if (!photo) {
      throw notFound("PHOTO_NOT_FOUND", "Foto no encontrada");
    }

    await prisma.fileAttachment.update({
      where: { id: photo.id },
      data: { deletedAt: new Date() },
    });

    await deleteObraPhotoFiles(photo.url);

    await createAuditEntry({
      entityType: AuditEntityType.file,
      entityId: photo.id,
      projectId: params.projectId,
      userId: user.id,
      action: AuditAction.deleted,
      description: `Eliminó foto de obra '${photo.filename}'`,
    });

    return reply.code(204).send();
  });

  // PASO 4.5: descarga de todas las fotos de obra en un ZIP (streaming).
  app.get("/projects/:projectId/obra/photos/download-all", { preHandler: authorize(Module.OPERACIONES, Action.VIEW) }, async (request, reply) => {
    ensureUser(request);
    const params = z.object({ projectId: z.string() }).parse(request.params);
    const project = await findProjectOrThrow(params.projectId);

    const photos = await prisma.fileAttachment.findMany({
      where: {
        projectId: project.id,
        toolSource: "obra-fotos",
        deletedAt: null,
      },
      orderBy: { createdAt: "asc" },
    });

    if (photos.length === 0) {
      throw notFound("NO_PHOTOS", "No hay fotos para descargar");
    }

    const zipName = `obra_${project.code}_fotos.zip`;

    // Tomamos control de la respuesta cruda para streamear el ZIP nosotros;
    // así Fastify no intenta serializar el retorno.
    reply.hijack();
    reply.raw.writeHead(200, {
      "Content-Type": "application/zip",
      "Content-Disposition": `attachment; filename="${zipName}"`,
    });

    const archive = archiver("zip", { zlib: { level: 6 } });

    archive.on("error", (err) => {
      request.log.error({ err }, "Error armando ZIP de fotos de obra");
      reply.raw.destroy(err);
    });

    archive.pipe(reply.raw);

    // Detectar nombres duplicados para desambiguar con prefijo de índice.
    const nameCounts = new Map<string, number>();
    for (const p of photos) {
      nameCounts.set(p.filename, (nameCounts.get(p.filename) ?? 0) + 1);
    }

    photos.forEach((photo, idx) => {
      const absolutePath = getStoredFilePath(photo.url);
      if (!fs.existsSync(absolutePath)) {
        return;
      }
      let entryName = photo.filename;
      if ((nameCounts.get(photo.filename) ?? 0) > 1) {
        const padded = String(idx + 1).padStart(2, "0");
        entryName = `foto_${padded}_${photo.filename}`;
      }
      archive.file(absolutePath, { name: entryName });
    });

    await archive.finalize();

    return reply;
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

    // "Instalación realizada" = el proyecto tiene la etapa OPERACIONES
    // INICIADA (actualStartDate cargado, i.e. status IN_PROGRESS o COMPLETED).
    // No exigimos un sopCode específico de subetapa porque los pipelines varían
    // (no todos tienen O2P/O2T como subetapas formales). La fecha que se usa
    // para agrupar es el actualStartDate de esa stage (cuándo arrancó la obra).
    const startedOperacionesStages = await prisma.stage.findMany({
      where: {
        deletedAt: null,
        name: StageType.OPERACIONES,
        actualStartDate: { not: null },
        project: { deletedAt: null },
      },
      select: {
        projectId: true,
        actualStartDate: true,
        project: { select: { id: true, capacityKwp: true, pesoObra: true } },
      },
    });

    type Installed = { projectId: string; installedAt: Date; capacityKwp: number; pesoObra: number };
    const installedAll: Installed[] = startedOperacionesStages
      .filter((s) => s.actualStartDate != null && s.project != null)
      .map((s) => ({
        projectId: s.projectId,
        installedAt: s.actualStartDate as Date,
        capacityKwp: decimalToNumber(s.project!.capacityKwp) ?? 0,
        pesoObra: s.project!.pesoObra,
      }));

    const completedInYear = installedAll.filter(
      (p) => p.installedAt >= yearStart && p.installedAt < yearEnd,
    );
    const completedInQuarter = filterQuarter
      ? installedAll.filter(
          (p) => quarterStart && quarterEnd && p.installedAt >= quarterStart && p.installedAt < quarterEnd,
        )
      : [];

    const installationsThisYear = completedInYear.length;
    const installationsThisQuarter = completedInQuarter.length;
    // Obras ponderadas = suma de pesoObra sobre EL MISMO conjunto que el conteo.
    const obrasRealizadasPonderadasThisYear = completedInYear.reduce((sum, p) => sum + p.pesoObra, 0);
    const obrasRealizadasPonderadasThisQuarter = completedInQuarter.reduce((sum, p) => sum + p.pesoObra, 0);
    const kwpInstalledThisYear = Number(
      completedInYear.reduce((sum, p) => sum + p.capacityKwp, 0).toFixed(2),
    );
    const kwpInstalledThisQuarter = Number(
      completedInQuarter.reduce((sum, p) => sum + p.capacityKwp, 0).toFixed(2),
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
      obrasRealizadasPonderadasThisYear,
      obrasRealizadasPonderadasThisQuarter,
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

  app.get("/metrics/stages", { preHandler: authorize(Module.METRICAS, Action.VIEW) }, async (request) => {
    // Mide la duración real de cada etapa para TODOS los proyectos no
    // borrados (independientemente del status del proyecto). Una etapa con
    // status=COMPLETED y ambas fechas reales pobladas aporta una observación.
    // POSTVENTA queda excluida por ser indefinida.
    //
    // Filtros opcionales por período (year y quarter): se aplican sobre
    // `actualEndDate` de la etapa (cuándo terminó). Si no se pasan, devuelve
    // todas las etapas completadas históricas.
    const query = z.object({
      year: z.coerce.number().int().optional(),
      quarter: z.coerce.number().int().min(1).max(4).optional(),
    }).parse(request.query);

    let fechaFilter: { gte: Date; lt: Date } | undefined;
    if (query.year && query.quarter) {
      fechaFilter = {
        gte: new Date(Date.UTC(query.year, (query.quarter - 1) * 3, 1)),
        lt: new Date(Date.UTC(query.year, query.quarter * 3, 1)),
      };
    } else if (query.year) {
      fechaFilter = {
        gte: new Date(Date.UTC(query.year, 0, 1)),
        lt: new Date(Date.UTC(query.year + 1, 0, 1)),
      };
    }

    const completedStages = await prisma.stage.findMany({
      where: {
        project: { deletedAt: null },
        status: StageStatus.COMPLETED,
        name: { not: StageType.POSTVENTA },
        ...(fechaFilter ? { actualEndDate: fechaFilter } : {}),
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
        // Calculamos duración on-the-fly desde fechas reales. La columna
        // persistida `actualDurationDays` no siempre está populada (legacy),
        // así que la ignoramos y nos basamos en lo que hay en la DB.
        const durations = items
          .filter((s) => s.actualStartDate != null && s.actualEndDate != null)
          .map((s) => {
            const ms = s.actualEndDate!.getTime() - s.actualStartDate!.getTime();
            return Math.round(ms / 86_400_000);
          })
          .filter((d) => d >= 0);
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

  // GET /api/users/assignable: usuarios activos elegibles para asignar a
  // etapas, tareas y otros recursos internos. Excluye explícitamente a los
  // CLIENT (clientes del portal) — esos viven en otro flujo (Tab "Clientes
  // portal" del Admin) y nunca deben ser asignables. Mismo shape que
  // /users/active para que UserSelect del frontend lo consuma sin cambios
  // de tipos. Si el día de mañana cambia el criterio de "asignable" (por
  // ejemplo agregar filtro por status), se cambia en un solo lugar.
  app.get("/users/assignable", async () => {
    const users = await prisma.user.findMany({
      where: {
        deletedAt: null,
        role: { name: { not: "CLIENT" } },
      },
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

    const [permissions, dbUser] = await Promise.all([
      prisma.permission.findMany({
        where: { role: { name: user.role } },
        select: { module: true, action: true },
        orderBy: [{ module: "asc" }, { action: "asc" }],
      }),
      prisma.user.findUnique({
        where: { id: user.id },
        select: { passwordTemporary: true },
      }),
    ]);

    return {
      id: user.id,
      name: user.name,
      email: user.email,
      role: user.role,
      passwordTemporary: dbUser?.passwordTemporary ?? false,
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
    // taskScope: "pending" (default) muestra tareas no-completadas, "completed"
    // muestra sólo las ya cerradas (con completedAt). Sólo afecta a la lista
    // `tasks`; el listado de etapas/subetapas siempre es el mismo.
    const query = z
      .object({
        userId: z.string().min(1).optional(),
        taskScope: z.enum(["pending", "completed"]).optional().default("pending"),
      })
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
    //    menos una subetapa pendiente que pertenece al targetUser.
    //    Pertenencia: subetapa.userId === targetUser.id (explícita) O
    //    subetapa.userId IS NULL Y stage.responsibleUserId === targetUser.id
    //    (heredada del responsable de etapa). Si la subetapa tiene userId
    //    explícito a otro usuario, NO aparece para el targetUser aunque éste
    //    sea el responsable de la etapa.
    const substagePending: Prisma.SubstageWhereInput = {
      deletedAt: null,
      isActive: true,
      status: { not: SubstageStatus.COMPLETED },
    };
    const substageBelongsToTarget: Prisma.SubstageWhereInput = {
      OR: [
        { userId: targetUser.id },
        { userId: null, stage: { responsibleUserId: targetUser.id } },
      ],
    };
    const stages = await prisma.stage.findMany({
      where: {
        deletedAt: null,
        status: { not: StageStatus.COMPLETED },
        project: {
          deletedAt: null,
          status: { notIn: [ProjectStatus.ARCHIVED, ProjectStatus.COMPLETED] },
        },
        substages: {
          some: { ...substagePending, ...substageBelongsToTarget },
        },
      },
      include: {
        project: { select: { id: true, clientName: true, code: true } },
        substages: {
          where: { ...substagePending, ...substageBelongsToTarget },
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

        // Urgencia del bloque = basada sólo en subetapas (stage.plannedEndDate
        // se genera automáticamente al crear el proyecto y no ha sido revisada
        // por el usuario; mezclarlo con las fechas explícitas de subetapas
        // genera falsos "Atrasada". Se expone en el StageDrawer para edición).
        const subsWithDue = subs.map((s) => ({ dueDate: s.dueDate, rank: urgencyRank(s.dueDate) }));
        const substageRanks = subsWithDue.map((s) => s.rank);
        const blockRank = substageRanks.length > 0 ? Math.min(...substageRanks) : 3;

        // Fecha del badge = la subetapa más urgente (la que define el blockRank).
        // Si ninguna tiene fecha, null → "Sin fecha".
        const drivingDates = subsWithDue
          .filter((s) => s.rank === blockRank && s.dueDate !== null)
          .map((s) => s.dueDate as Date)
          .sort((a, b) => a.getTime() - b.getTime());
        const badgeDate = drivingDates[0] ?? null;

        const myPendingSubstagesCount = subs.filter((s) => s.userId === targetUser.id).length;

        return {
          projectId: stage.projectId,
          projectCode: stage.project.code,
          projectName: stage.project.clientName,
          stageId: stage.id,
          stageName: stage.name,
          stageLabel: getStageLabel(stage.name),
          stageDueDate: serializeDateOnly(badgeDate),
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

    // 3. Tasks asignados al usuario target. Independiente de la lógica de
    //    stages/substages: cada Task con userId === targetUser.id que no esté
    //    completado, en proyecto activo, aparece acá. Esto incluye tareas
    //    "sueltas" (sin substageId, ni stageId), tareas atadas a una etapa, y
    //    tareas atadas a una subetapa específica. El frontend muestra cada una
    //    con el contexto que corresponda (Proyecto · Etapa · Subetapa, o
    //    Proyecto · Tarea suelta).
    const tasksRaw = await prisma.task.findMany({
      where: {
        userId: targetUser.id,
        deletedAt: null,
        // Solo tareas de proyecto. Las sueltas (projectId NULL) van en
        // standaloneTasks más abajo.
        projectId: { not: null },
        status:
          query.taskScope === "completed"
            ? TaskStatus.COMPLETED
            : { not: TaskStatus.COMPLETED },
        project: {
          deletedAt: null,
          status: { notIn: [ProjectStatus.ARCHIVED, ProjectStatus.COMPLETED] },
        },
      },
      include: {
        project: { select: { id: true, code: true, clientName: true } },
        stage: { select: { id: true, name: true } },
        substage: { select: { id: true, name: true } },
      },
    });

    const tasks = tasksRaw
      .map((t) => ({
        id: t.id,
        title: t.title,
        description: t.description,
        status: t.status,
        priority: t.priority,
        dueDate: serializeDateOnly(t.dueDate),
        completedAt: serializeDate(t.completedAt),
        urgencyRank: urgencyRank(t.dueDate),
        projectId: t.project!.id,
        projectCode: t.project!.code,
        projectName: t.project!.clientName,
        stageId: t.stage?.id ?? null,
        stageName: (t.stage?.name ?? null) as StageType | null,
        stageLabel: t.stage ? getStageLabel(t.stage.name) : null,
        substageId: t.substage?.id ?? null,
        substageName: t.substage?.name ?? null,
      }))
      .sort((a, b) => {
        // Completadas: orden descendente por completedAt (más reciente primero).
        if (query.taskScope === "completed") {
          if (a.completedAt && b.completedAt) return b.completedAt.localeCompare(a.completedAt);
          if (a.completedAt) return -1;
          if (b.completedAt) return 1;
          return a.projectName.localeCompare(b.projectName, "es");
        }
        // Pendientes: orden por urgencia.
        if (a.urgencyRank !== b.urgencyRank) return a.urgencyRank - b.urgencyRank;
        if (a.dueDate && b.dueDate) return a.dueDate.localeCompare(b.dueDate);
        if (a.dueDate) return -1;
        if (b.dueDate) return 1;
        return a.projectName.localeCompare(b.projectName, "es");
      });

    // 4. Tareas sueltas (standalone) del targetUser: projectId IS NULL,
    //    asignadas al usuario, PENDING (no se exponen completadas en
    //    standalone — el listado de Mis Tareas solo muestra pendientes).
    const standaloneTasksRaw = await prisma.task.findMany({
      where: {
        userId: targetUser.id,
        projectId: null,
        deletedAt: null,
        status: TaskStatus.PENDING,
      },
      include: {
        user: { select: { id: true, name: true, email: true } },
      },
      orderBy: [{ dueDate: "asc" }, { createdAt: "desc" }],
    });

    const standaloneTasks = standaloneTasksRaw.map((t) => ({
      id: t.id,
      title: t.title,
      description: t.description,
      status: t.status,
      dueDate: serializeDateOnly(t.dueDate),
      assignedUserId: t.userId,
      assignedUser: t.user
        ? { id: t.user.id, name: t.user.name, email: t.user.email }
        : null,
      urgencyRank: urgencyRank(t.dueDate),
      createdAt: serializeDate(t.createdAt),
      updatedAt: serializeDate(t.updatedAt),
    }));

    return { blocks, tasks, standaloneTasks };
  });

  // ─── Roles dinámicos y matriz de permisos ────────────────────────────────────

  const PERMISSION_CATALOG: Array<{ module: Module; actions: Action[] }> = [
    { module: Module.VENTAS,        actions: [Action.VIEW, Action.CREATE, Action.EDIT, Action.DELETE, Action.COMMENT] },
    { module: Module.ONBOARDING,    actions: [Action.VIEW, Action.CREATE, Action.EDIT, Action.DELETE, Action.COMPLETE, Action.COMMENT] },
    { module: Module.INGENIERIA,    actions: [Action.VIEW, Action.CREATE, Action.EDIT, Action.DELETE, Action.COMPLETE, Action.COMMENT, Action.ACCESS] },
    { module: Module.OPERACIONES,   actions: [Action.VIEW, Action.CREATE, Action.EDIT, Action.DELETE, Action.COMPLETE, Action.COMMENT] },
    { module: Module.HABILITACION,  actions: [Action.VIEW, Action.CREATE, Action.EDIT, Action.DELETE, Action.COMPLETE, Action.COMMENT] },
    { module: Module.POSTVENTA,     actions: [Action.VIEW, Action.CREATE, Action.EDIT, Action.DELETE, Action.COMPLETE, Action.COMMENT] },
    { module: Module.METRICAS,      actions: [Action.VIEW] },
    { module: Module.CONFIGURACION, actions: [Action.VIEW, Action.CREATE, Action.EDIT, Action.DELETE] },
    { module: Module.USUARIOS,      actions: [Action.VIEW, Action.CREATE, Action.EDIT, Action.DELETE] },
    { module: Module.FINANZAS,      actions: [Action.VIEW, Action.CREATE, Action.EDIT, Action.DELETE] },
    { module: Module.STOCK,         actions: [Action.VIEW, Action.CREATE, Action.EDIT, Action.DELETE] },
    { module: Module.TRAMITES_UTE,  actions: [Action.VIEW, Action.CREATE, Action.EDIT, Action.DELETE] },
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

  app.get("/users", { preHandler: authorize(Module.USUARIOS, Action.VIEW) }, async (request) => {
    // excludePortalClients=true filtra los clientes del portal (role=CLIENT).
    // Lo usa la tab "Usuarios" del Admin. Default false para preservar el
    // contrato legacy del endpoint.
    const query = z
      .object({
        excludePortalClients: z
          .enum(["true", "false"])
          .optional(),
      })
      .parse(request.query);

    const excludeClients = query.excludePortalClients === "true";

    const users = await prisma.user.findMany({
      where: {
        deletedAt: null,
        ...(excludeClients ? { role: { name: { not: "CLIENT" } } } : {}),
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

    // G.3: marcar actividad si el comentario apunta a una subetapa
    await markSubstageActivity(body.substageId);

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
    // Si viene, respeta lo que mandó el usuario (alta comercial con fecha
    // pasada). Si no viene, el handler hace new Date() como default.
    leadCreatedAt: z.string().datetime({ offset: true }).optional().nullable(),
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
    leadCreatedAt: z.string().datetime({ offset: true }).optional().nullable(),
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
  //
  // Dos modos según el flag `flat`:
  //  - default (Kanban): devuelve un array de LeadStageGroup, uno por
  //    stage del enum, con las cards mínimas para el Kanban.
  //  - flat=true (vista de lista): devuelve { data: Lead[], pagination }
  //    con leads planos, todos los campos relevantes para la tabla y
  //    paginación obligatoria. Soporta filtros completos y sort.
  //
  // El parámetro `search` se mantiene como alias deprecado de `q` para no
  // romper callers viejos.
  app.get("/leads", { preHandler: authorize(Module.VENTAS, Action.VIEW) }, async (request) => {
    const user = ensureUser(request);
    const query = z
      .object({
        flat: z.union([z.literal("true"), z.literal("false")]).optional(),
        // Filtros (válidos en ambos modos)
        assignedTo: z.enum(["me"]).optional(),
        q: z.string().trim().optional(),
        search: z.string().trim().optional(), // alias deprecado de q
        stage: z.string().trim().optional(), // CSV
        ownerId: z.string().trim().optional(), // CSV; "unassigned" → null
        dateField: z.enum(["leadCreatedAt", "proposalSentAt", "closedAt"]).optional(),
        dateFrom: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
        dateTo: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
        sortBy: z
          .enum(["clientName", "stage", "leadCreatedAt", "proposalSentAt", "closedAt", "owner"])
          .optional(),
        sortOrder: z.enum(["asc", "desc"]).optional(),
        page: z.coerce.number().int().positive().optional(),
        limit: z.coerce.number().int().positive().max(200).optional(),
      })
      .parse(request.query);

    const isFlat = query.flat === "true";
    const textSearch = query.q ?? query.search;

    // Filtro de ownerId: acepta múltiples IDs separados por coma y el
    // literal "unassigned" para incluir leads sin asignar. Combinables.
    const ownerFilter = (() => {
      if (!query.ownerId) return undefined;
      const ids = query.ownerId.split(",").map((s) => s.trim()).filter(Boolean);
      const hasUnassigned = ids.includes("unassigned");
      const realIds = ids.filter((id) => id !== "unassigned");
      if (hasUnassigned && realIds.length === 0) return { assignedToId: null };
      if (!hasUnassigned && realIds.length > 0) return { assignedToId: { in: realIds } };
      if (hasUnassigned && realIds.length > 0) {
        return {
          OR: [{ assignedToId: { in: realIds } }, { assignedToId: null }],
        };
      }
      return undefined;
    })();

    // Filtro de stage: CSV validado contra el enum, valores inválidos se ignoran.
    const validStages = new Set(Object.values(SalesStage) as string[]);
    const stageFilter = (() => {
      if (!query.stage) return undefined;
      const list = query.stage
        .split(",")
        .map((s) => s.trim())
        .filter((s) => validStages.has(s)) as SalesStage[];
      if (list.length === 0) return undefined;
      return { stage: { in: list } };
    })();

    // Filtro de fecha por campo elegido.
    const dateFilter = (() => {
      if (!query.dateField || (!query.dateFrom && !query.dateTo)) return undefined;
      const range: { gte?: Date; lte?: Date } = {};
      if (query.dateFrom) range.gte = new Date(`${query.dateFrom}T00:00:00.000Z`);
      if (query.dateTo) range.lte = new Date(`${query.dateTo}T23:59:59.999Z`);
      return { [query.dateField]: range };
    })();

    const where: Prisma.SalesLeadWhereInput = {
      deletedAt: null,
      ...(query.assignedTo === "me" ? { assignedToId: user.id } : {}),
      ...(textSearch
        ? {
            OR: [
              { clientName: { contains: textSearch, mode: "insensitive" as const } },
              { address: { contains: textSearch, mode: "insensitive" as const } },
            ],
          }
        : {}),
      ...(stageFilter ?? {}),
      ...(ownerFilter ?? {}),
      ...(dateFilter ?? {}),
    };

    // ───── Modo flat (vista de lista) ─────
    if (isFlat) {
      const page = query.page ?? 1;
      const limit = query.limit ?? 50;
      const sortBy = query.sortBy ?? "leadCreatedAt";
      const sortOrder = query.sortOrder ?? "desc";

      const orderBy: Prisma.SalesLeadOrderByWithRelationInput =
        sortBy === "owner"
          ? { assignedTo: { name: sortOrder } }
          : ({ [sortBy]: sortOrder } as Prisma.SalesLeadOrderByWithRelationInput);

      const [flatLeads, total] = await Promise.all([
        prisma.salesLead.findMany({
          where,
          orderBy,
          include: { assignedTo: { select: { id: true, name: true } } },
          skip: (page - 1) * limit,
          take: limit,
        }),
        prisma.salesLead.count({ where }),
      ]);

      return {
        data: flatLeads.map((lead) => ({
          id: lead.id,
          code: lead.code,
          clientName: lead.clientName,
          stage: lead.stage,
          address: lead.address,
          estimatedKwp: lead.estimatedKwp ? decimalToNumber(lead.estimatedKwp) : null,
          estimatedBudgetUsd: lead.estimatedBudgetUsd ? decimalToNumber(lead.estimatedBudgetUsd) : null,
          leadCreatedAt: serializeDate(lead.leadCreatedAt),
          proposalSentAt: serializeDate(lead.proposalSentAt),
          visitScheduledAt: serializeDate(lead.visitScheduledAt),
          visitCompletedAt: serializeDate(lead.visitCompletedAt),
          closedAt: serializeDate(lead.closedAt),
          assignedTo: lead.assignedTo,
          createdAt: serializeDate(lead.createdAt),
        })),
        pagination: {
          page,
          limit,
          total,
          totalPages: Math.max(1, Math.ceil(total / limit)),
        },
      };
    }

    // ───── Modo default (Kanban) ─────
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
      leadCreatedAt: lead.leadCreatedAt ? serializeDate(lead.leadCreatedAt) : null,
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
        version: proposal.version,
        status: proposal.status,
        inputFilePath: proposal.inputFilePath,
        outputFilePath: proposal.outputFilePath,
        errorMessage: proposal.errorMessage,
        attachmentId: proposal.attachmentId,
        completedAt: proposal.completedAt ? serializeDate(proposal.completedAt) : null,
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
        // Auto-fill de la fecha de alta comercial. Si el body trajo una
        // explícita (caso "cargar lead histórico con fecha pasada"),
        // respetarla. Sino, now().
        leadCreatedAt: body.leadCreatedAt ? new Date(body.leadCreatedAt) : new Date(),
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
        ...(body.leadCreatedAt !== undefined && { leadCreatedAt: body.leadCreatedAt ? new Date(body.leadCreatedAt) : null }),
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
    // Auto-fills disparados por el cambio de stage:
    //  - AGENDAR_VISITA → setea visitScheduledAt si está vacío. Si el
    //    usuario ya la cargó manualmente, NO se pisa.
    //  - CERRADO_GANADO/PERDIDO → siempre pisa closedAt con now(). Esto
    //    es intencional (decisión del usuario en mayo 2026): si el lead
    //    se reabre y se vuelve a cerrar, queda la última fecha real.
    // Pasar a otros stages no toca fechas. Volver atrás de un stage
    // cerrado tampoco borra closedAt — solo se pisa al cerrar de nuevo.
    const dateAutoFills: { visitScheduledAt?: Date; closedAt?: Date } = {};
    if (body.stage === SalesStage.AGENDAR_VISITA && !existing.visitScheduledAt) {
      dateAutoFills.visitScheduledAt = new Date();
    }
    if (isClosed) {
      dateAutoFills.closedAt = new Date();
    }

    const updatedLead = await prisma.salesLead.update({
      where: { id },
      data: {
        stage: body.stage,
        notes: body.notes !== undefined ? body.notes : existing.notes,
        lostReason: body.stage === SalesStage.CERRADO_PERDIDO ? body.lostReason ?? null : existing.lostReason,
        ...dateAutoFills,
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

  const leadConvertBodySchema = z
    .object({
      clientName: z.string().min(1).optional(),
      clientAddress: z.string().nullable().optional(),
      clientEmail: z.union([z.string().email(), z.literal("")]).nullable().optional(),
      clientPhone: z.string().nullable().optional(),
      capacityKwp: z.coerce.number().positive().optional(),
      locationCity: z.string().min(1).optional(),
      locationProvince: z.string().min(1).optional(),
      budgetUsd: z.coerce.number().nonnegative().nullable().optional(),
      plannedEndDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable().optional(),
      startDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
      modalidadPago: z.nativeEnum(ModalidadPago).nullable().optional(),
    })
    .strict()
    .optional();

  app.post("/leads/:id/convert", { preHandler: authorize(Module.VENTAS, Action.CREATE) }, async (request) => {
    const user = ensureUser(request);
    const { id } = request.params as { id: string };
    const body = leadConvertBodySchema.parse(request.body ?? undefined) ?? {};

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

    // Merge: body tiene prioridad sobre lo del lead. Si después de mezclar
    // todavía faltan los obligatorios, devolvemos un 400 con mensaje claro.
    const clientName = body.clientName?.trim() || lead.clientName;
    const clientAddress = body.clientAddress ?? lead.address ?? null;
    const clientEmail = body.clientEmail ?? lead.clientEmail ?? null;
    const clientPhone = body.clientPhone ?? lead.clientPhone ?? null;
    const capacityKwpFinal =
      body.capacityKwp ?? (lead.estimatedKwp ? decimalToNumber(lead.estimatedKwp) ?? 0 : 0);
    const locationCity = body.locationCity?.trim() ?? "";
    const locationProvince = body.locationProvince?.trim() ?? "";
    const budgetUsdFinal =
      body.budgetUsd ?? (lead.estimatedBudgetUsd ? decimalToNumber(lead.estimatedBudgetUsd) ?? 0 : 0);

    const missing: string[] = [];
    if (!clientName) missing.push("nombre del cliente");
    if (!locationCity) missing.push("ciudad");
    if (!locationProvince) missing.push("provincia");
    if (!capacityKwpFinal || capacityKwpFinal <= 0) missing.push("potencia (kWp)");
    if (missing.length > 0) {
      throw badRequest(
        "MISSING_PROJECT_FIELDS",
        `Faltan datos para crear el proyecto: ${missing.join(", ")}.`,
      );
    }

    const startDate = body.startDate ? parseDateOnly(body.startDate) : todayUtc();
    const plannedEndDate = body.plannedEndDate
      ? parseDateOnly(body.plannedEndDate)
      : (() => {
          const d = new Date(startDate);
          d.setUTCDate(d.getUTCDate() + 90);
          return d;
        })();
    const estimatedMwhYear = capacityKwpFinal * 1.45;
    const code = await generateProjectCode();

    const project = await prisma.project.create({
      data: {
        code,
        clientName,
        capacityKwp: new Prisma.Decimal(capacityKwpFinal),
        locationCity,
        locationProvince,
        clientAddress,
        status: ProjectStatus.ACTIVE,
        startDate,
        plannedEndDate,
        budgetUsd: new Prisma.Decimal(budgetUsdFinal),
        executedUsd: new Prisma.Decimal(0),
        estimatedMwhYear: new Prisma.Decimal(estimatedMwhYear.toFixed(2)),
        co2TonsAvoided: new Prisma.Decimal((estimatedMwhYear * 0.5).toFixed(2)),
        clientEmail: (body.clientEmail ?? clientEmail ?? "") || "",
        clientPhone: (body.clientPhone ?? clientPhone ?? "") || "",
        modalidadPago: body.modalidadPago ?? null,
        salespersonId: lead.assignedToId ?? null,
        createdById: user.id,
      },
    });

    await createInitialPipeline(project.id, startDate, plannedEndDate, null);

    const newUteProcessFromLead = await prisma.uteProcess.create({
      data: {
        projectId: project.id,
        currentStage: UteStage.CONSULTA,
        currentStatus: UteStatus.PENDIENTE,
        createdById: user.id,
      },
    });

    await regenerateUteSubstages(prisma, newUteProcessFromLead);

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

    // Copia de adjuntos del lead al proyecto. No falla la conversión si la
    // copia falla parcialmente (preferimos tener el proyecto creado).
    try {
      const { copied } = await prisma.$transaction((tx) =>
        copyLeadAttachmentsToProject(tx, lead.id, project.id, user.id),
      );
      if (copied > 0) {
        await createAuditEntry({
          entityType: AuditEntityType.file,
          entityId: project.id,
          projectId: project.id,
          userId: user.id,
          action: AuditAction.file_uploaded,
          description: `Copió ${copied} adjunto${copied === 1 ? "" : "s"} del lead al proyecto`,
        });
      }
    } catch (err) {
      request.log.error({ err, leadId: lead.id, projectId: project.id }, "copy lead attachments failed");
    }

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

    // Calcular versión incremental por lead. Para proyectos sin lead (uso poco
    // común) la versión queda en 1 — no usamos versionado por proyecto hoy.
    let nextVersion = 1;
    if (leadId) {
      const previous = await prisma.proposalGeneration.findFirst({
        where: { leadId },
        orderBy: { version: "desc" },
        select: { version: true },
      });
      nextVersion = (previous?.version ?? 0) + 1;
    }

    const proposal = await prisma.proposalGeneration.create({
      data: {
        leadId,
        projectId,
        version: nextVersion,
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
      version: proposal.version,
      status: proposal.status,
      errorMessage: proposal.errorMessage,
      attachmentId: proposal.attachmentId,
      completedAt: proposal.completedAt ? serializeDate(proposal.completedAt) : null,
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
      version: proposal.version,
      status: proposal.status,
      errorMessage: proposal.errorMessage,
      attachmentId: proposal.attachmentId,
      completedAt: proposal.completedAt ? serializeDate(proposal.completedAt) : null,
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
      type: z.nativeEnum(TeamType).default(TeamType.PROPIO),
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
      type: z.nativeEnum(TeamType).optional(),
      notes: z.string().trim().nullable().optional(),
    })
    .strict();

  function serializeTeam(t: {
    id: string;
    name: string;
    color: string;
    type: TeamType;
    notes: string | null;
    createdAt: Date;
    updatedAt: Date;
    deletedAt: Date | null;
  }) {
    return {
      id: t.id,
      name: t.name,
      color: t.color,
      type: t.type,
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

  // ─── Deadline Rules (G.1) ─────────────────────────────────────────────────
  // Reglas globales de cálculo de deadlines por subetapa. Una regla matchea
  // por (stageType, sopCode) o (stageType, substageName) contra el template
  // del pipeline. Se aplica a todas las subetapas correspondientes en todos
  // los proyectos. Si sopCode y substageName son null → default de etapa
  // (aplica a las subetapas que no tienen una regla más específica).

  const deadlineRuleCreateSchema = z
    .object({
      stageType: z.nativeEnum(StageType),
      sopCode: z.string().trim().min(1).nullable().optional(),
      substageName: z.string().trim().min(1).nullable().optional(),
      tipo: z.nativeEnum(DeadlineRuleTipo),
      dias: z.number().int().nullable().optional(),
      activa: z.boolean().optional().default(true),
    })
    .strict();

  const deadlineRulePatchSchema = z
    .object({
      tipo: z.nativeEnum(DeadlineRuleTipo).optional(),
      dias: z.number().int().nullable().optional(),
      activa: z.boolean().optional(),
    })
    .strict();

  function validateRuleShape(tipo: DeadlineRuleTipo, dias: number | null | undefined) {
    if (tipo === DeadlineRuleTipo.SIN_DEADLINE || tipo === DeadlineRuleTipo.MANUAL) {
      if (dias !== null && dias !== undefined) {
        throw badRequest("INVALID_DIAS", "El campo dias debe ser null para tipo SIN_DEADLINE o MANUAL");
      }
      return null;
    }
    // DIAS_DESDE_CREACION o DIAS_ANTES_INSTALACION
    if (dias === null || dias === undefined) {
      throw badRequest("DIAS_REQUIRED", "El campo dias es obligatorio para este tipo de regla");
    }
    if (dias <= 0) {
      throw badRequest("DIAS_INVALID", "dias debe ser un entero mayor a 0");
    }
    return dias;
  }

  app.get("/admin/deadline-rules", { preHandler: authorize(Module.CONFIGURACION, Action.VIEW) }, async (request) => {
    const query = z
      .object({
        stageType: z.nativeEnum(StageType).optional(),
        activa: z.union([z.literal("true"), z.literal("false")]).optional(),
      })
      .parse(request.query);
    const where: Prisma.DeadlineRuleWhereInput = {};
    if (query.stageType) where.stageType = query.stageType;
    if (query.activa !== undefined) where.activa = query.activa === "true";
    const rules = await prisma.deadlineRule.findMany({
      where,
      orderBy: [{ stageType: "asc" }, { substageName: "asc" }, { sopCode: "asc" }],
    });
    return rules;
  });

  app.get("/admin/deadline-rules/:id", { preHandler: authorize(Module.CONFIGURACION, Action.VIEW) }, async (request) => {
    const { id } = z.object({ id: z.string() }).parse(request.params);
    const rule = await prisma.deadlineRule.findUnique({ where: { id } });
    if (!rule) throw notFound("DEADLINE_RULE_NOT_FOUND", "Regla no encontrada");
    return rule;
  });

  app.post("/admin/deadline-rules", { preHandler: authorize(Module.CONFIGURACION, Action.CREATE) }, async (request, reply) => {
    const user = ensureUser(request);
    const body = deadlineRuleCreateSchema.parse(request.body);
    const dias = validateRuleShape(body.tipo, body.dias);

    try {
      const rule = await prisma.deadlineRule.create({
        data: {
          stageType: body.stageType,
          sopCode: body.sopCode ?? null,
          substageName: body.substageName ?? null,
          tipo: body.tipo,
          dias,
          activa: body.activa ?? true,
        },
      });
      await createAuditEntry({
        entityType: AuditEntityType.setting,
        entityId: rule.id,
        userId: user.id,
        action: AuditAction.created,
        description: `Creó regla de deadline: ${body.stageType}${body.sopCode ? ` / ${body.sopCode}` : body.substageName ? ` / ${body.substageName}` : ""}`,
      });
      return reply.code(201).send(rule);
    } catch (err) {
      if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002") {
        throw badRequest("RULE_ALREADY_EXISTS", "Ya existe una regla para esa combinación de etapa/subetapa");
      }
      throw err;
    }
  });

  app.patch("/admin/deadline-rules/:id", { preHandler: authorize(Module.CONFIGURACION, Action.EDIT) }, async (request) => {
    const user = ensureUser(request);
    const { id } = z.object({ id: z.string() }).parse(request.params);
    const body = deadlineRulePatchSchema.parse(request.body);
    const existing = await prisma.deadlineRule.findUnique({ where: { id } });
    if (!existing) throw notFound("DEADLINE_RULE_NOT_FOUND", "Regla no encontrada");

    const nextTipo = body.tipo ?? existing.tipo;
    const nextDias = body.dias !== undefined ? body.dias : existing.dias;
    const dias = validateRuleShape(nextTipo, nextDias);

    const updated = await prisma.deadlineRule.update({
      where: { id },
      data: {
        ...(body.tipo !== undefined ? { tipo: body.tipo } : {}),
        ...(body.dias !== undefined || body.tipo !== undefined ? { dias } : {}),
        ...(body.activa !== undefined ? { activa: body.activa } : {}),
      },
    });
    await createAuditEntry({
      entityType: AuditEntityType.setting,
      entityId: id,
      userId: user.id,
      action: AuditAction.updated,
      description: `Actualizó regla de deadline ${id}`,
    });
    return updated;
  });

  app.delete("/admin/deadline-rules/:id", { preHandler: authorize(Module.CONFIGURACION, Action.DELETE) }, async (request) => {
    const user = ensureUser(request);
    const { id } = z.object({ id: z.string() }).parse(request.params);
    const existing = await prisma.deadlineRule.findUnique({ where: { id } });
    if (!existing) throw notFound("DEADLINE_RULE_NOT_FOUND", "Regla no encontrada");
    await prisma.deadlineRule.delete({ where: { id } });
    await createAuditEntry({
      entityType: AuditEntityType.setting,
      entityId: id,
      userId: user.id,
      action: AuditAction.deleted,
      description: `Eliminó regla de deadline ${id}`,
    });
    return { success: true };
  });

  // ─── Plantillas de checklist de obra (maestro editable solo ADMIN/CONFIG) ──
  // "Soft delete" = isActive=false; no se borran filas de verdad.

  const checklistTemplateCreateSchema = z
    .object({
      name: z.string().min(1).max(200),
      description: z.string().max(1000).optional(),
      order: z.number().int().optional(),
    })
    .strict();

  const checklistTemplatePatchSchema = z
    .object({
      name: z.string().min(1).max(200).optional(),
      description: z.string().max(1000).nullable().optional(),
      order: z.number().int().optional(),
      isActive: z.boolean().optional(),
    })
    .strict();

  const checklistTemplateReorderSchema = z
    .object({
      items: z
        .array(
          z.object({
            id: z.string(),
            order: z.number().int(),
          }),
        )
        .min(1),
    })
    .strict();

  app.get("/admin/checklist-templates", { preHandler: authorize(Module.CONFIGURACION, Action.VIEW) }, async () => {
    return prisma.checklistTemplate.findMany({
      orderBy: [{ order: "asc" }, { createdAt: "asc" }],
    });
  });

  app.post("/admin/checklist-templates", { preHandler: authorize(Module.CONFIGURACION, Action.CREATE) }, async (request, reply) => {
    const user = ensureUser(request);
    const body = checklistTemplateCreateSchema.parse(request.body);
    let order = body.order;
    if (order === undefined) {
      const last = await prisma.checklistTemplate.findFirst({ orderBy: { order: "desc" } });
      order = (last?.order ?? 0) + 1;
    }
    const template = await prisma.checklistTemplate.create({
      data: {
        name: body.name,
        description: body.description ?? null,
        order,
      },
    });
    await createAuditEntry({
      entityType: AuditEntityType.setting,
      entityId: template.id,
      userId: user.id,
      action: AuditAction.created,
      description: `Creó plantilla de checklist: ${template.name}`,
    });
    return reply.code(201).send(template);
  });

  app.patch("/admin/checklist-templates/:id", { preHandler: authorize(Module.CONFIGURACION, Action.EDIT) }, async (request) => {
    const user = ensureUser(request);
    const { id } = z.object({ id: z.string() }).parse(request.params);
    const body = checklistTemplatePatchSchema.parse(request.body);
    const existing = await prisma.checklistTemplate.findUnique({ where: { id } });
    if (!existing) throw notFound("CHECKLIST_TEMPLATE_NOT_FOUND", "Plantilla de checklist no encontrada");

    const updated = await prisma.checklistTemplate.update({
      where: { id },
      data: {
        ...(body.name !== undefined ? { name: body.name } : {}),
        ...(body.description !== undefined ? { description: body.description } : {}),
        ...(body.order !== undefined ? { order: body.order } : {}),
        ...(body.isActive !== undefined ? { isActive: body.isActive } : {}),
      },
    });
    await createAuditEntry({
      entityType: AuditEntityType.setting,
      entityId: id,
      userId: user.id,
      action: AuditAction.updated,
      description: `Actualizó plantilla de checklist ${updated.name}`,
    });
    return updated;
  });

  app.delete("/admin/checklist-templates/:id", { preHandler: authorize(Module.CONFIGURACION, Action.DELETE) }, async (request) => {
    const user = ensureUser(request);
    const { id } = z.object({ id: z.string() }).parse(request.params);
    const existing = await prisma.checklistTemplate.findUnique({ where: { id } });
    if (!existing) throw notFound("CHECKLIST_TEMPLATE_NOT_FOUND", "Plantilla de checklist no encontrada");
    const updated = await prisma.checklistTemplate.update({
      where: { id },
      data: { isActive: false },
    });
    await createAuditEntry({
      entityType: AuditEntityType.setting,
      entityId: id,
      userId: user.id,
      action: AuditAction.deleted,
      description: `Desactivó plantilla de checklist ${updated.name}`,
    });
    return updated;
  });

  app.put("/admin/checklist-templates/reorder", { preHandler: authorize(Module.CONFIGURACION, Action.EDIT) }, async (request) => {
    const body = checklistTemplateReorderSchema.parse(request.body);
    await prisma.$transaction(
      body.items.map((item) =>
        prisma.checklistTemplate.update({ where: { id: item.id }, data: { order: item.order } }),
      ),
    );
    return prisma.checklistTemplate.findMany({
      orderBy: [{ order: "asc" }, { createdAt: "asc" }],
    });
  });

  // ─── Recálculo manual de deadlines a nivel proyecto (G.2) ─────────────────
  // Útil cuando se cambian reglas en Admin y se quiere aplicarlas al proyecto
  // sin esperar al próximo cambio de fecha de instalación.

  app.post("/projects/:id/recalculate-deadlines", { preHandler: authorize(Module.OPERACIONES, Action.EDIT) }, async (request, reply) => {
    const user = ensureUser(request);
    const { id } = z.object({ id: z.string() }).parse(request.params);
    const body = z.object({ forceOverrides: z.boolean().optional() }).parse(request.body ?? {});
    const force = body.forceOverrides ?? false;

    const project = await prisma.project.findFirst({ where: { id, deletedAt: null }, select: { id: true } });
    if (!project) throw notFound("PROJECT_NOT_FOUND", "Proyecto no encontrado");

    if (!force) {
      const overrideCount = await countProjectManualOverrides(id);
      if (overrideCount > 0) {
        return reply.code(409).send({
          error: true,
          code: "CONFIRM_RECALCULATE",
          overrideCount,
          message: `Hay ${overrideCount} deadline${overrideCount === 1 ? "" : "s"} editado${overrideCount === 1 ? "" : "s"} manualmente que será${overrideCount === 1 ? "" : "n"} recalculado${overrideCount === 1 ? "" : "s"}`,
        });
      }
    }

    const result = await recalculateProjectDeadlines(id, force);
    await createAuditEntry({
      entityType: AuditEntityType.project,
      entityId: id,
      projectId: id,
      userId: user.id,
      action: AuditAction.updated,
      description: `Recalculó deadlines (${result.updated} actualizados, ${result.preserved} preservados, ${result.cleared} eliminados)`,
    });
    return result;
  });

  // ─── Edición manual de deadline por subetapa (G.2) ────────────────────────
  // Permitido a ADMIN y OPERACIONES. Marca deadlineManuallySet=true para que
  // el recálculo automático no lo pise (a menos que el usuario confirme).

  app.patch("/substages/:id/deadline", async (request, reply) => {
    const user = ensureUser(request);
    if (user.role !== "ADMIN" && user.role !== "OPERACIONES") {
      return reply.code(403).send({
        error: true,
        code: "INSUFFICIENT_PERMISSIONS",
        message: "Solo ADMIN y OPERACIONES pueden editar deadlines manualmente",
      });
    }
    const { id } = z.object({ id: z.string() }).parse(request.params);
    const body = z.object({ deadline: dateOnlySchema.nullable() }).strict().parse(request.body);

    const existing = await prisma.substage.findFirst({
      where: { id, deletedAt: null },
      select: { id: true, name: true, projectId: true },
    });
    if (!existing) throw notFound("SUBSTAGE_NOT_FOUND", "Subetapa no encontrada");

    const newDeadline = body.deadline ? parseDateOnly(body.deadline) : null;
    const updated = await prisma.substage.update({
      where: { id },
      data: {
        deadline: newDeadline,
        // dueDate es espejo de deadline (lo lee /my-tasks). null queda null.
        dueDate: newDeadline,
        deadlineManuallySet: true,
        deadlineNotificationSent: false,
        deadlineNotifiedAt: null,
      },
    });

    await createAuditEntry({
      entityType: AuditEntityType.substage,
      entityId: id,
      projectId: existing.projectId,
      userId: user.id,
      action: AuditAction.updated,
      description: newDeadline
        ? `Editó deadline manualmente de "${existing.name}" → ${toDateOnlyString(newDeadline)}`
        : `Eliminó deadline de "${existing.name}"`,
    });
    return {
      id: updated.id,
      deadline: serializeDateOnly(updated.deadline),
      deadlineManuallySet: updated.deadlineManuallySet,
    };
  });

  // Resetea el override manual y recalcula con la regla actual.
  app.delete("/substages/:id/deadline-override", async (request, reply) => {
    const user = ensureUser(request);
    if (user.role !== "ADMIN" && user.role !== "OPERACIONES") {
      return reply.code(403).send({
        error: true,
        code: "INSUFFICIENT_PERMISSIONS",
        message: "Solo ADMIN y OPERACIONES pueden gestionar deadlines",
      });
    }
    const { id } = z.object({ id: z.string() }).parse(request.params);

    const existing = await prisma.substage.findFirst({
      where: { id, deletedAt: null },
      select: {
        id: true,
        name: true,
        sopCode: true,
        stageId: true,
        projectId: true,
        deadline: true,
        project: { select: { id: true, createdAt: true } },
      },
    });
    if (!existing) throw notFound("SUBSTAGE_NOT_FOUND", "Subetapa no encontrada");

    const newDeadline = await calculateSubstageDeadline(existing, existing.project);
    const updated = await prisma.substage.update({
      where: { id },
      data: {
        deadline: newDeadline,
        // dueDate es espejo de deadline (lo lee /my-tasks). null queda null.
        dueDate: newDeadline,
        deadlineManuallySet: false,
        deadlineNotificationSent: false,
        deadlineNotifiedAt: null,
      },
    });

    await createAuditEntry({
      entityType: AuditEntityType.substage,
      entityId: id,
      projectId: existing.projectId,
      userId: user.id,
      action: AuditAction.updated,
      description: newDeadline
        ? `Override manual eliminado, deadline recalculado a ${toDateOnlyString(newDeadline)}`
        : `Override manual eliminado, subetapa sin deadline (no hay regla configurada)`,
    });
    return {
      id: updated.id,
      deadline: serializeDateOnly(updated.deadline),
      deadlineManuallySet: updated.deadlineManuallySet,
    };
  });

  // ─── G.3: Edición manual de fechas reales por ADMIN ───────────────────────
  app.patch("/substages/:id/actual-dates", async (request, reply) => {
    const user = ensureUser(request);
    if (user.role !== "ADMIN") {
      return reply.code(403).send({
        error: true,
        code: "ADMIN_REQUIRED",
        message: "Solo ADMIN puede editar fechas reales manualmente",
      });
    }
    const { id } = z.object({ id: z.string() }).parse(request.params);
    const body = z
      .object({
        actualStartDate: dateOnlySchema.nullable().optional(),
        actualEndDate: dateOnlySchema.nullable().optional(),
      })
      .strict()
      .parse(request.body);

    const existing = await prisma.substage.findFirst({
      where: { id, deletedAt: null },
      select: { id: true, name: true, projectId: true, isSystem: true, uteAction: true },
    });
    if (!existing) throw notFound("SUBSTAGE_NOT_FOUND", "Subetapa no encontrada");

    if (isUteManagedSubstage(existing)) {
      throw badRequest(
        "UTE_SUBSTAGE_LOCKED",
        "Las fechas reales de subetapas de Trámite UTE se setean al cargar la acción correspondiente en /tramites-ute.",
      );
    }

    const updateData: Record<string, unknown> = {};
    if (body.actualStartDate !== undefined) {
      updateData.actualStartDate = body.actualStartDate ? parseDateOnly(body.actualStartDate) : null;
    }
    if (body.actualEndDate !== undefined) {
      updateData.actualEndDate = body.actualEndDate ? parseDateOnly(body.actualEndDate) : null;
    }
    const updated = await prisma.substage.update({ where: { id }, data: updateData });

    await createAuditEntry({
      entityType: AuditEntityType.substage,
      entityId: id,
      projectId: existing.projectId,
      userId: user.id,
      action: AuditAction.updated,
      description: `Editó manualmente fechas reales de "${existing.name}"`,
    });
    return {
      id: updated.id,
      actualStartDate: serializeDateOnly(updated.actualStartDate),
      actualEndDate: serializeDateOnly(updated.actualEndDate),
    };
  });

  // ─── G.3: Preferencias de notificación del usuario actual ────────────────

  function defaultNotifPrefs(userId: string) {
    return {
      userId,
      deadlineWarning: true,
      deadlineWarningInApp: true,
      deadlineWarningEmail: false,
      deadlineWarningWhatsapp: false,
      prevSubstageCompleted: true,
      prevSubstageCompletedInApp: true,
      prevSubstageCompletedEmail: false,
      prevSubstageCompletedWhatsapp: false,
    };
  }

  app.get("/users/me/notification-preferences", async (request) => {
    const user = ensureUser(request);
    const prefs = await prisma.userNotificationPreference.findUnique({ where: { userId: user.id } });
    if (prefs) return prefs;
    // Si no existe, devuelvo los defaults sin persistir todavía
    return { id: null, ...defaultNotifPrefs(user.id), createdAt: null, updatedAt: null };
  });

  app.patch("/users/me/notification-preferences", async (request) => {
    const user = ensureUser(request);
    const body = z
      .object({
        deadlineWarning: z.boolean().optional(),
        deadlineWarningInApp: z.boolean().optional(),
        deadlineWarningEmail: z.boolean().optional(),
        deadlineWarningWhatsapp: z.boolean().optional(),
        prevSubstageCompleted: z.boolean().optional(),
        prevSubstageCompletedInApp: z.boolean().optional(),
        prevSubstageCompletedEmail: z.boolean().optional(),
        prevSubstageCompletedWhatsapp: z.boolean().optional(),
      })
      .strict()
      .parse(request.body);

    const updated = await prisma.userNotificationPreference.upsert({
      where: { userId: user.id },
      create: { ...defaultNotifPrefs(user.id), ...body },
      update: body,
    });
    return updated;
  });

  // ─── G.3: Deadlines próximos del usuario actual (para widget dashboard) ───
  app.get("/users/me/upcoming-deadlines", async (request) => {
    const user = ensureUser(request);
    const query = z.object({ days: z.coerce.number().int().min(1).max(60).default(7) }).parse(request.query);
    const now = new Date();
    const today = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
    const horizon = new Date(today);
    horizon.setUTCDate(horizon.getUTCDate() + query.days);

    const substages = await prisma.substage.findMany({
      where: {
        userId: user.id,
        deletedAt: null,
        isActive: true,
        actualEndDate: null,
        deadline: { gte: today, lte: horizon },
      },
      orderBy: { deadline: "asc" },
      include: {
        stage: { select: { id: true, name: true, projectId: true } },
        project: { select: { id: true, code: true, clientName: true } },
      },
      take: 20,
    });

    return substages.map((s) => ({
      id: s.id,
      name: s.name,
      deadline: serializeDateOnly(s.deadline),
      deadlineManuallySet: s.deadlineManuallySet,
      stage: { id: s.stage.id, name: s.stage.name, label: getStageLabel(s.stage.name) },
      project: { id: s.project.id, code: s.project.code, clientName: s.project.clientName },
    }));
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

    // Si cambió el name, color o tipo, sincronizar el snapshot en installation_schedules
    const nameChanged = body.name !== undefined && body.name !== existing.name;
    const colorChanged = body.color !== undefined && body.color !== existing.color;
    const typeChanged = body.type !== undefined && body.type !== existing.type;
    if (nameChanged || colorChanged || typeChanged) {
      const snapshotData: Prisma.InstallationScheduleUpdateManyMutationInput = {};
      if (nameChanged) snapshotData.teamName = body.name!;
      if (colorChanged) snapshotData.teamColor = body.color!;
      if (typeChanged) snapshotData.teamType = body.type!;
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
    forceRecalculate: z.boolean().optional(),
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
    forceRecalculate: z.boolean().optional(),
  }).strict();

  // Helper de G.2: guarda contra recálculos no confirmados cuando hay overrides
  // manuales. Devuelve null si está OK proceder, o un objeto 409 para enviar.
  async function deadlineRecalcGuard(projectId: string, forceRecalculate: boolean) {
    if (forceRecalculate) return null;
    const overrideCount = await countProjectManualOverrides(projectId);
    if (overrideCount === 0) return null;
    return {
      error: true,
      code: "CONFIRM_RECALCULATE",
      overrideCount,
      message: `Hay ${overrideCount} deadline${overrideCount === 1 ? "" : "s"} editado${overrideCount === 1 ? "" : "s"} manualmente que será${overrideCount === 1 ? "" : "n"} recalculado${overrideCount === 1 ? "" : "s"}`,
    } as const;
  }

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

  // Regla 1: coherencia entre fechas de instalación y etapa OPERACIONES.
  // Sólo comparamos contra las fechas REALES (actualStartDate/actualEndDate).
  // Las fechas planificadas ya no se usan para esta validación — fueron
  // eliminadas de la UI y por tanto de la regla.
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
      },
    });

    if (!operations) return { ok: true, warning: null };

    // Caso A: Operaciones todavía no inició → permitir sin restricción.
    // Caso B: instalación empieza antes del inicio real de Operaciones
    if (operations.actualStartDate && plannedWorkStart.getTime() < operations.actualStartDate.getTime()) {
      return {
        ok: false,
        error: {
          code: "INSTALL_BEFORE_OPERATIONS",
          message: `La instalación no puede empezar antes del inicio real de Operaciones (${formatDateEs(operations.actualStartDate)}). Ajustá las fechas.`,
        },
      };
    }

    // Caso C: instalación termina después del fin real de Operaciones
    if (operations.actualEndDate && plannedWorkEnd.getTime() > operations.actualEndDate.getTime()) {
      return {
        ok: false,
        error: {
          code: "INSTALL_AFTER_OPERATIONS",
          message: `La instalación no puede terminar después del cierre real de Operaciones (${formatDateEs(operations.actualEndDate)}). Ajustá las fechas.`,
        },
      };
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
    teamType: TeamType;
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
      teamType: s.teamType,
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

    // G.2: guard de recálculo si hay overrides manuales sin confirmación
    const guard = await deadlineRecalcGuard(body.projectId, body.forceRecalculate ?? false);
    if (guard) return reply.code(409).send(guard);

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
      teamType: team.type,
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

    // G.2: recalcular deadlines del proyecto con la nueva fecha de instalación
    const deadlineRecalc = await recalculateProjectDeadlines(body.projectId, body.forceRecalculate ?? false);
    reply.header("X-Deadline-Recalc", JSON.stringify(deadlineRecalc));

    reply.code(201);
    return { data: serializeSchedule(created), warning: validation.warning };
  });

  app.patch("/calendar/:id", { preHandler: authorize(Module.OPERACIONES, Action.EDIT) }, async (request, reply) => {
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
      updateData.teamType = team.type;
    }

    // Si viene segments o plannedWorkStart/End, se reemplazan todos los tramos.
    const wantsSegmentReplace =
      body.segments !== undefined ||
      body.plannedWorkStart !== undefined ||
      body.plannedWorkEnd !== undefined;
    if (wantsSegmentReplace) {
      // G.2: si los segmentos cambian, validar overrides manuales antes de aplicar
      const guard = await deadlineRecalcGuard(existing.projectId, body.forceRecalculate ?? false);
      if (guard) return reply.code(409).send(guard);

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

    // G.2: recalcular si cambiaron los tramos
    if (wantsSegmentReplace) {
      const deadlineRecalc = await recalculateProjectDeadlines(existing.projectId, body.forceRecalculate ?? false);
      reply.header("X-Deadline-Recalc", JSON.stringify(deadlineRecalc));
    }

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
      // La validación contra rango planificado se eliminó: las fechas
      // planificadas ya no se muestran en la UI y no forman parte de las
      // reglas de coherencia.
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
  app.patch("/calendar/:id/reschedule", { preHandler: authorize(Module.OPERACIONES, Action.EDIT) }, async (request, reply) => {
    const user = ensureUser(request);
    const params = z.object({ id: z.string() }).parse(request.params);
    const body = z
      .object({
        plannedWorkStart: dateOnlySchema,
        plannedWorkEnd: dateOnlySchema,
        segmentId: z.string().optional(),
        forceRecalculate: z.boolean().optional(),
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

    // G.2: guard de overrides manuales
    const guard = await deadlineRecalcGuard(existing.projectId, body.forceRecalculate ?? false);
    if (guard) return reply.code(409).send(guard);

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

    const deadlineRecalc = await recalculateProjectDeadlines(existing.projectId, body.forceRecalculate ?? false);
    reply.header("X-Deadline-Recalc", JSON.stringify(deadlineRecalc));

    return { data: serializeSchedule(updated), warning: validation.warning };
  });

  // ── CRUD de segments ──────────────────────────────────────────────────────────

  app.post("/calendar/:id/segments", { preHandler: authorize(Module.OPERACIONES, Action.EDIT) }, async (request, reply) => {
    const user = ensureUser(request);
    const params = z.object({ id: z.string() }).parse(request.params);
    const segmentBodySchema = z.object({
      startDate: dateOnlySchema,
      endDate: dateOnlySchema,
      notes: z.string().trim().nullable().optional(),
      forceRecalculate: z.boolean().optional(),
    }).strict();
    const body = segmentBodySchema.parse(request.body);

    const existing = await prisma.installationSchedule.findFirst({
      where: { id: params.id, deletedAt: null },
      include: { segments: { orderBy: { startDate: "asc" } } },
    });
    if (!existing) {
      throw notFound("INSTALLATION_NOT_FOUND", "Instalación no encontrada");
    }

    // G.2: guard de overrides
    const guard = await deadlineRecalcGuard(existing.projectId, body.forceRecalculate ?? false);
    if (guard) return reply.code(409).send(guard);

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

    const deadlineRecalc = await recalculateProjectDeadlines(existing.projectId, body.forceRecalculate ?? false);
    reply.header("X-Deadline-Recalc", JSON.stringify(deadlineRecalc));

    reply.code(201);
    return serializeSchedule(updated);
  });

  app.patch("/calendar/:id/segments/:segmentId", { preHandler: authorize(Module.OPERACIONES, Action.EDIT) }, async (request, reply) => {
    const user = ensureUser(request);
    const params = z.object({ id: z.string(), segmentId: z.string() }).parse(request.params);
    const body = z.object({
      startDate: dateOnlySchema.optional(),
      endDate: dateOnlySchema.optional(),
      notes: z.string().trim().nullable().optional(),
      forceRecalculate: z.boolean().optional(),
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

    // G.2: si cambia la fecha del segmento → guard de overrides
    const datesChanging = body.startDate !== undefined || body.endDate !== undefined;
    if (datesChanging) {
      const guard = await deadlineRecalcGuard(existing.projectId, body.forceRecalculate ?? false);
      if (guard) return reply.code(409).send(guard);
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

    if (datesChanging) {
      const deadlineRecalc = await recalculateProjectDeadlines(existing.projectId, body.forceRecalculate ?? false);
      reply.header("X-Deadline-Recalc", JSON.stringify(deadlineRecalc));
    }

    return serializeSchedule(updated);
  });

  app.delete("/calendar/:id/segments/:segmentId", { preHandler: authorize(Module.OPERACIONES, Action.EDIT) }, async (request, reply) => {
    const user = ensureUser(request);
    const params = z.object({ id: z.string(), segmentId: z.string() }).parse(request.params);
    const query = z.object({ forceRecalculate: z.union([z.literal("true"), z.literal("false")]).optional() }).parse(request.query);
    const forceRecalculate = query.forceRecalculate === "true";

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

    // G.2: si el tramo eliminado es el más temprano, podría cambiar el earliest start
    const sortedByStart = [...existing.segments].sort((a, b) => a.startDate.getTime() - b.startDate.getTime());
    const isEarliest = sortedByStart[0].id === target.id;
    if (isEarliest) {
      const guard = await deadlineRecalcGuard(existing.projectId, forceRecalculate);
      if (guard) return reply.code(409).send(guard);
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

    if (isEarliest) {
      const deadlineRecalc = await recalculateProjectDeadlines(existing.projectId, forceRecalculate);
      reply.header("X-Deadline-Recalc", JSON.stringify(deadlineRecalc));
    }

    return serializeSchedule(updated);
  });

  app.delete("/calendar/:id", { preHandler: authorize(Module.OPERACIONES, Action.DELETE) }, async (request, reply) => {
    const user = ensureUser(request);
    const params = z.object({ id: z.string() }).parse(request.params);
    const query = z.object({ forceRecalculate: z.union([z.literal("true"), z.literal("false")]).optional() }).parse(request.query);
    const forceRecalculate = query.forceRecalculate === "true";

    const existing = await prisma.installationSchedule.findFirst({
      where: { id: params.id, deletedAt: null },
      include: { project: { select: { clientName: true } } },
    });
    if (!existing) {
      throw notFound("INSTALLATION_NOT_FOUND", "Instalación no encontrada");
    }

    // G.2: borrar el schedule deja DIAS_ANTES_INSTALACION sin fecha → guard
    const guard = await deadlineRecalcGuard(existing.projectId, forceRecalculate);
    if (guard) return reply.code(409).send(guard);

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

    const deadlineRecalc = await recalculateProjectDeadlines(existing.projectId, forceRecalculate);
    reply.header("X-Deadline-Recalc", JSON.stringify(deadlineRecalc));

    return { success: true };
  });

  // ─── Trámites UTE ────────────────────────────────────────────────────────────

  const uteDateSchema = z.union([
    z.string().datetime(),
    z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
    z.null(),
  ]);

  // caseNumber y notes son texto libre sin validación de formato. Trim para
  // evitar whitespace-only strings; null explícito limpia el campo.
  const uteCaseNumberSchema = z
    .string()
    .max(200)
    .transform((v) => v.trim())
    .nullable()
    .optional();
  const uteNotesSchema = z
    .string()
    .max(5000)
    .transform((v) => v.trim())
    .nullable()
    .optional();

  const uteProcessCreateSchema = z
    .object({
      projectId: z.string().min(1),
      caseNumber: uteCaseNumberSchema,
      notes: uteNotesSchema,
      consultaSentAt: uteDateSchema.optional(),
    })
    .strict();

  const uteProcessPatchSchema = z
    .object({
      caseNumber: uteCaseNumberSchema,
      notes: uteNotesSchema,
      currentStage: z.nativeEnum(UteStage).optional(),
      currentStatus: z.nativeEnum(UteStatus).optional(),
      stageManuallySet: z.boolean().optional(),
      dateColors: z.record(z.string()).nullable().optional(),
      consultaSentAt: uteDateSchema.optional(),
      caseOpenedAt: uteDateSchema.optional(),
      consultaApprovedAt: uteDateSchema.optional(),
      solicitudSentAt: uteDateSchema.optional(),
      proyectoApprovedAt: uteDateSchema.optional(),
      docs1SentAt: uteDateSchema.optional(),
      docs1ApprovedAt: uteDateSchema.optional(),
      ensayosSentAt: uteDateSchema.optional(),
      ensayosApprovedAt: uteDateSchema.optional(),
      docs2SentAt: uteDateSchema.optional(),
      finalizedAt: uteDateSchema.optional(),
    })
    .strict()
    .refine((v) => Object.keys(v).length > 0, { message: "Debés enviar al menos un campo" });

  function parseUteDate(value: string | null | undefined): Date | null | undefined {
    if (value === undefined) return undefined;
    if (value === null) return null;
    return /^\d{4}-\d{2}-\d{2}$/.test(value) ? parseDateOnly(value) : new Date(value);
  }

  app.get("/ute-processes", { preHandler: authorize(Module.TRAMITES_UTE, Action.VIEW) }, async (request) => {
    const query = z
      .object({
        stage: z.nativeEnum(UteStage).optional(),
        status: z.nativeEnum(UteStatus).optional(),
        search: z.string().trim().min(1).optional(),
        sortBy: z
          .enum(["client", "duration", "currentStage", "currentStatus", "createdAt", "updatedAt"])
          .optional(),
        sortOrder: z.enum(["asc", "desc"]).optional(),
      })
      .parse(request.query);

    const rows = await prisma.uteProcess.findMany({
      where: {
        deletedAt: null,
        project: { deletedAt: null },
        ...(query.stage ? { currentStage: query.stage } : {}),
        ...(query.status ? { currentStatus: query.status } : {}),
        ...(query.search
          ? { project: { deletedAt: null, clientName: { contains: query.search, mode: "insensitive" } } }
          : {}),
      },
      include: UTE_PROCESS_INCLUDE,
      orderBy: { updatedAt: "desc" },
    });

    const now = new Date();
    const serialized = rows.map((r) => serializeUteProcess(r, now));

    const sortBy = query.sortBy ?? "updatedAt";
    const order = query.sortOrder ?? "desc";
    const dir = order === "asc" ? 1 : -1;
    // Para ordenar por etapa y estado respetamos el orden del flow / severidad,
    // no el alfabético del enum (DOCS_2 no debería ir entre DOCS_1 y ENSAYOS
    // simplemente porque empieza igual).
    const STAGE_RANK: Record<UteStage, number> = {
      CONSULTA: 1,
      SOLICITUD: 2,
      DOCS_1: 3,
      ENSAYOS: 4,
      DOCS_2: 5,
      FINALIZADO: 6,
      RELEVAR: 99,
    };
    const STATUS_RANK: Record<UteStatus, number> = {
      PENDIENTE: 1,
      ESPERANDO: 2,
      EN_PROCESO: 3,
      CERRADO: 4,
    };

    serialized.sort((a, b) => {
      switch (sortBy) {
        case "client":
          return a.project.clientName.localeCompare(b.project.clientName, "es", { sensitivity: "base" }) * dir;
        case "duration":
          return (a.totalDays - b.totalDays) * dir;
        case "currentStage":
          return (STAGE_RANK[a.currentStage] - STAGE_RANK[b.currentStage]) * dir;
        case "currentStatus":
          return (STATUS_RANK[a.currentStatus] - STATUS_RANK[b.currentStatus]) * dir;
        case "createdAt":
          return (new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()) * dir;
        case "updatedAt":
        default:
          return (new Date(a.updatedAt).getTime() - new Date(b.updatedAt).getTime()) * dir;
      }
    });

    return serialized;
  });

  app.get("/ute-processes/:id", { preHandler: authorize(Module.TRAMITES_UTE, Action.VIEW) }, async (request) => {
    const { id } = z.object({ id: z.string() }).parse(request.params);
    const row = await prisma.uteProcess.findFirst({
      where: { id, deletedAt: null },
      include: UTE_PROCESS_INCLUDE,
    });
    if (!row) throw notFound("UTE_PROCESS_NOT_FOUND", "Trámite UTE no encontrado");
    return serializeUteProcess(row);
  });

  app.post("/ute-processes", { preHandler: authorize(Module.TRAMITES_UTE, Action.CREATE) }, async (request, reply) => {
    const user = ensureUser(request);
    const body = uteProcessCreateSchema.parse(request.body);

    const project = await prisma.project.findFirst({
      where: { id: body.projectId, deletedAt: null },
      select: { id: true, clientName: true },
    });
    if (!project) throw notFound("PROJECT_NOT_FOUND", "Proyecto no encontrado");

    const existing = await prisma.uteProcess.findFirst({
      where: { projectId: project.id, deletedAt: null },
      select: { id: true },
    });
    if (existing) {
      throw conflict("UTE_PROCESS_EXISTS", "El proyecto ya tiene un trámite UTE activo");
    }

    const consultaSent = parseUteDate(body.consultaSentAt) ?? null;

    const created = await prisma.uteProcess.create({
      data: {
        projectId: project.id,
        caseNumber: body.caseNumber ?? null,
        notes: body.notes ?? null,
        consultaSentAt: consultaSent,
        currentStage: consultaSent ? UteStage.CONSULTA : UteStage.CONSULTA,
        currentStatus: consultaSent ? UteStatus.ESPERANDO : UteStatus.PENDIENTE,
        createdById: user.id,
      },
      include: UTE_PROCESS_INCLUDE,
    });

    await regenerateUteSubstages(prisma, created);

    reply.code(201);
    return serializeUteProcess(created);
  });

  app.patch("/ute-processes/:id", { preHandler: authorize(Module.TRAMITES_UTE, Action.EDIT) }, async (request) => {
    const { id } = z.object({ id: z.string() }).parse(request.params);
    const body = uteProcessPatchSchema.parse(request.body);

    const existing = await prisma.uteProcess.findFirst({
      where: { id, deletedAt: null },
      include: UTE_PROCESS_INCLUDE,
    });
    if (!existing) throw notFound("UTE_PROCESS_NOT_FOUND", "Trámite UTE no encontrado");

    const dateUpdates: Partial<Record<UteActionKey, Date | null>> = {};
    for (const key of UTE_ACTION_KEYS) {
      if (key in body) {
        const parsed = parseUteDate(body[key] as string | null | undefined);
        if (parsed !== undefined) dateUpdates[key] = parsed;
      }
    }

    const mergedDates: Record<UteActionKey, Date | null> = {} as Record<UteActionKey, Date | null>;
    for (const key of UTE_ACTION_KEYS) {
      mergedDates[key] = key in dateUpdates ? dateUpdates[key] ?? null : (existing[key] as Date | null);
    }
    const coherence = validateCoherence(mergedDates);
    if (!coherence.ok) throw badRequest("UTE_DATES_INCOHERENT", coherence.message);

    const mergedRow = { ...existing, ...dateUpdates };
    const stageFromDates = deriveStage(mergedRow);

    // Un stage explícito lo marca como manual. Si ya estaba manual (flag),
    // no se re-deriva salvo que el caller mande stageManuallySet=false.
    let nextStageManuallySet = existing.stageManuallySet;
    let nextStage = existing.currentStage;
    if (body.currentStage !== undefined) {
      nextStage = body.currentStage;
      nextStageManuallySet = true;
    } else if (body.stageManuallySet === false) {
      nextStage = stageFromDates;
      nextStageManuallySet = false;
    } else if (!existing.stageManuallySet) {
      nextStage = stageFromDates;
    }
    if (body.stageManuallySet === true) nextStageManuallySet = true;

    // Si marca finalizedAt y no pasó status → pasa a CERRADO automático.
    const nextStatus =
      body.currentStatus !== undefined
        ? body.currentStatus
        : mergedRow.finalizedAt
          ? UteStatus.CERRADO
          : existing.currentStatus;

    // dateColors: merge del existente con el parche (null por clave limpia
    // esa celda; null entero resetea todo).
    let dateColorsData: Prisma.InputJsonValue | null | undefined = undefined;
    if (body.dateColors !== undefined) {
      if (body.dateColors === null) {
        dateColorsData = Prisma.JsonNull as unknown as null;
      } else {
        const existingColors = (existing.dateColors as DateColorsMap | null) ?? {};
        const merged: Record<string, string> = { ...existingColors };
        for (const [k, v] of Object.entries(body.dateColors)) {
          if (v === null || v === undefined) delete merged[k];
          else merged[k] = v;
        }
        const validation = validateDateColors(merged);
        if (!validation.ok) throw badRequest("UTE_COLOR_INVALID", validation.message);
        dateColorsData = validation.value as Prisma.InputJsonValue;
      }
    }

    const updated = await prisma.uteProcess.update({
      where: { id },
      data: {
        ...(body.caseNumber !== undefined ? { caseNumber: body.caseNumber || null } : {}),
        ...(body.notes !== undefined ? { notes: body.notes || null } : {}),
        ...dateUpdates,
        currentStage: nextStage,
        currentStatus: nextStatus,
        stageManuallySet: nextStageManuallySet,
        ...(dateColorsData !== undefined ? { dateColors: dateColorsData as Prisma.InputJsonValue } : {}),
      },
      include: UTE_PROCESS_INCLUDE,
    });

    // Re-syncea status/fechas de las 11 subetapas system. ensureUteSubstages
    // también corre por si una migración previa quedó incompleta.
    await regenerateUteSubstages(prisma, updated);

    return serializeUteProcess(updated);
  });

  // Cierre manual del trámite desde la etapa del proyecto: lo marca FINALIZADO
  // + CERRADO y completa la etapa HABILITACION_UTE, SIN cargar las fechas de
  // cada paso (esas alimentan los promedios de tiempo UTE). finalizedAt = fecha
  // real de fin de la etapa Operaciones (o hoy si todavía no terminó).
  app.post(
    "/projects/:projectId/ute/finalizar",
    { preHandler: authorize(Module.TRAMITES_UTE, Action.EDIT) },
    async (request) => {
      const user = ensureUser(request);
      const { projectId } = z.object({ projectId: z.string() }).parse(request.params);

      const ute = await prisma.uteProcess.findFirst({
        where: { projectId, deletedAt: null },
        select: { id: true },
      });
      if (!ute) {
        throw badRequest(
          "UTE_PROCESS_REQUIRED",
          "El proyecto no tiene un trámite UTE. Creá el trámite antes de finalizarlo.",
        );
      }

      const operaciones = await prisma.stage.findFirst({
        where: { projectId, name: StageType.OPERACIONES, deletedAt: null },
        select: { actualEndDate: true },
      });
      const finalizedAt = operaciones?.actualEndDate ?? todayUtc();

      const updated = await prisma.uteProcess.update({
        where: { id: ute.id },
        data: {
          currentStage: UteStage.FINALIZADO,
          currentStatus: UteStatus.CERRADO,
          stageManuallySet: true,
          finalizedAt,
        },
        include: UTE_PROCESS_INCLUDE,
      });

      // Trámite CERRADO ⟹ las 11 subetapas pasan a COMPLETED ⟹ la etapa
      // HABILITACION_UTE queda completada (sin tocar las fechas de cada paso).
      await regenerateUteSubstages(prisma, updated);

      await createAuditEntry({
        entityType: AuditEntityType.project,
        entityId: projectId,
        projectId,
        userId: user.id,
        action: AuditAction.updated,
        description: "Marcó el trámite UTE como finalizado (cierre manual desde la etapa)",
      });

      return serializeUteProcess(updated);
    },
  );

  app.delete("/ute-processes/:id", { preHandler: authorize(Module.TRAMITES_UTE, Action.DELETE) }, async (request) => {
    const { id } = z.object({ id: z.string() }).parse(request.params);
    const existing = await prisma.uteProcess.findFirst({ where: { id, deletedAt: null } });
    if (!existing) throw notFound("UTE_PROCESS_NOT_FOUND", "Trámite UTE no encontrado");
    await prisma.uteProcess.update({ where: { id }, data: { deletedAt: new Date() } });
    return { success: true };
  });

  // ─── Métricas UTE ───────────────────────────────────────────────────────────

  app.get("/metrics/ute", { preHandler: authorize(Module.TRAMITES_UTE, Action.VIEW) }, async () => {
    const now = new Date();
    const yearStart = new Date(now.getFullYear(), 0, 1);

    const processes = await prisma.uteProcess.findMany({
      where: { deletedAt: null, project: { deletedAt: null } },
      include: {
        project: {
          select: { id: true, code: true, clientName: true, createdAt: true },
        },
      },
    });

    const serialized = processes.map((p) => ({
      id: p.id,
      projectId: p.projectId,
      project: p.project,
      currentStage: p.currentStage,
      currentStatus: p.currentStatus,
      ...calculateTimes(p, now),
      finalizedAt: p.finalizedAt,
      consultaSentAt: p.consultaSentAt,
      // Timing por etapa (days between pairs, si ambas fechas existen)
      stagePairs: {
        consulta:
          p.consultaSentAt && p.consultaApprovedAt
            ? diffInDays(p.consultaSentAt, p.consultaApprovedAt)
            : null,
        solicitud:
          p.solicitudSentAt && p.proyectoApprovedAt
            ? diffInDays(p.solicitudSentAt, p.proyectoApprovedAt)
            : null,
        docs1:
          p.docs1SentAt && p.docs1ApprovedAt ? diffInDays(p.docs1SentAt, p.docs1ApprovedAt) : null,
        ensayos:
          p.ensayosSentAt && p.ensayosApprovedAt
            ? diffInDays(p.ensayosSentAt, p.ensayosApprovedAt)
            : null,
        finalizacion:
          p.docs2SentAt && p.finalizedAt ? diffInDays(p.docs2SentAt, p.finalizedAt) : null,
      },
      createdProjectToConsultaDays:
        p.consultaSentAt && p.project.createdAt
          ? diffInDays(p.project.createdAt, p.consultaSentAt)
          : null,
    }));

    const active = serialized.filter((p) => p.currentStatus !== UteStatus.CERRADO);
    const finalizedThisYear = serialized.filter(
      (p) => p.finalizedAt && p.finalizedAt >= yearStart,
    );

    function avg(nums: number[]): number | null {
      if (nums.length === 0) return null;
      return Math.round(nums.reduce((s, n) => s + n, 0) / nums.length);
    }

    const avgTotal = avg(finalizedThisYear.map((p) => p.totalDays));
    const avgOur = avg(finalizedThisYear.map((p) => p.ourTimeDays));
    const avgUte = avg(finalizedThisYear.map((p) => p.uteTimeDays));

    const stageLabels: Record<keyof typeof serialized[0]["stagePairs"], string> = {
      consulta: "Consulta (enviada → aprobada)",
      solicitud: "Solicitud (enviada → proyecto aprobado)",
      docs1: "Docs 1 (enviados → aprobados)",
      ensayos: "Ensayos (enviados → aprobados)",
      finalizacion: "Finalización (docs 2 → finalizado)",
    };

    const byStage = (Object.keys(stageLabels) as Array<keyof typeof stageLabels>).map((key) => {
      const values = serialized
        .map((p) => p.stagePairs[key])
        .filter((v): v is number => v !== null && v >= 0);
      return {
        key,
        label: stageLabels[key],
        avg: avg(values),
        min: values.length > 0 ? Math.min(...values) : null,
        max: values.length > 0 ? Math.max(...values) : null,
        count: values.length,
      };
    });

    const totalOurAccum = serialized.reduce((s, p) => s + p.ourTimeDays, 0);
    const totalUteAccum = serialized.reduce((s, p) => s + p.uteTimeDays, 0);
    const grand = totalOurAccum + totalUteAccum;

    const topOurDelay = [...active]
      .sort((a, b) => b.ourTimeDays - a.ourTimeDays)
      .slice(0, 5)
      .map((p) => ({
        id: p.id,
        projectCode: p.project.code,
        clientName: p.project.clientName,
        days: p.ourTimeDays,
        currentStage: p.currentStage,
      }));
    const topUteDelay = [...active]
      .sort((a, b) => b.uteTimeDays - a.uteTimeDays)
      .slice(0, 5)
      .map((p) => ({
        id: p.id,
        projectCode: p.project.code,
        clientName: p.project.clientName,
        days: p.uteTimeDays,
        currentStage: p.currentStage,
      }));

    const timeToStartValues = serialized
      .map((p) => p.createdProjectToConsultaDays)
      .filter((v): v is number => v !== null && v >= 0);
    const avgTimeToStart = avg(timeToStartValues);

    return {
      kpis: {
        activeCount: active.length,
        finalizedThisYearCount: finalizedThisYear.length,
        avgTotalDays: avgTotal,
        avgOurDays: avgOur,
        avgUteDays: avgUte,
        avgTimeToStartDays: avgTimeToStart,
      },
      byStage,
      distribution: {
        ourPercent: grand > 0 ? Math.round((totalOurAccum / grand) * 100) : 0,
        utePercent: grand > 0 ? Math.round((totalUteAccum / grand) * 100) : 0,
        ourDays: totalOurAccum,
        uteDays: totalUteAccum,
      },
      topOurDelay,
      topUteDelay,
    };
  });

  void SENT_APPROVED_PAIRS;

  // ─── UTE quarterly-evolution: evolución trimestral con tendencias ────────
  //
  // Dos modelos conviven en este endpoint:
  //
  // 1) Tarjetas grandes (Tiempo Total / Voltia / UTE): SOLO trámites
  //    finalizados. Por trámite se calcula:
  //      - tiempoTotal  = suma de todas sus etapas cerradas
  //      - tiempoVoltia = suma de sus etapas VOLTIA (envíos)
  //      - tiempoUte    = suma de sus etapas UTE (aprobaciones, caso, fin)
  //    Cada trámite se asigna al Q de su `finalizedAt` y aporta UN valor a
  //    cada estadística (promedio/mediana/min/max).
  //
  // 2) Mini cards "por etapa": cada etapa cerrada (intervalo entre dos
  //    acciones consecutivas) se asigna al Q de la acción de cierre. Una
  //    etapa contribuye independientemente del estado del trámite.
  //
  // Q se incluye si tiene datos en cualquiera de los dos modelos.
  //
  // Tendencias: último Q vs promedio últimos 4 Q (inclusive). Clasifica en
  // MEJORANDO (cambio < -5%) / EMPEORANDO (> 5%) / ESTABLE.
  app.get("/metrics/ute/quarterly-evolution", { preHandler: authorize(Module.TRAMITES_UTE, Action.VIEW) }, async () => {
    const COUNT = 8;
    const now = new Date();
    type Q = { key: string; label: string; year: number; quarter: number; start: Date; end: Date };

    const curQ = Math.floor(now.getUTCMonth() / 3) + 1;
    let y = now.getUTCFullYear();
    let q = curQ;
    const allQuarters: Q[] = [];
    for (let i = 0; i < COUNT; i++) {
      const start = new Date(Date.UTC(y, (q - 1) * 3, 1));
      const end = new Date(Date.UTC(y, q * 3, 1));
      allQuarters.push({ key: `${y}-Q${q}`, label: `Q${q} ${y}`, year: y, quarter: q, start, end });
      q -= 1;
      if (q < 1) { q = 4; y -= 1; }
    }
    allQuarters.reverse();

    const processes = await prisma.uteProcess.findMany({
      where: { deletedAt: null, project: { deletedAt: null } },
    });

    function median(nums: number[]): number | null {
      if (nums.length === 0) return null;
      const sorted = [...nums].sort((a, b) => a - b);
      const mid = Math.floor(sorted.length / 2);
      const v = sorted.length % 2 === 0 ? (sorted[mid - 1] + sorted[mid]) / 2 : sorted[mid];
      return Math.round(v * 10) / 10;
    }
    function avg(nums: number[]): number | null {
      if (nums.length === 0) return null;
      return Math.round((nums.reduce((s, n) => s + n, 0) / nums.length) * 10) / 10;
    }
    function stats(nums: number[]) {
      return {
        promedio: avg(nums),
        mediana: median(nums),
        min: nums.length > 0 ? Math.min(...nums) : null,
        max: nums.length > 0 ? Math.max(...nums) : null,
        cantidad: nums.length,
      };
    }

    type Responsible = "VOLTIA" | "UTE";

    // Cada acción que CIERRA una etapa, con su label y responsable.
    // `consultaSentAt` no figura: nunca cierra una etapa (es la primera
    // acción del trámite).
    const STAGE_META: Record<string, { label: string; responsible: Responsible }> = {
      caseOpenedAt:        { label: "Caso abierto",        responsible: "UTE" },
      consultaApprovedAt:  { label: "Consulta aprobada",   responsible: "UTE" },
      solicitudSentAt:     { label: "Solicitud enviada",   responsible: "VOLTIA" },
      proyectoApprovedAt:  { label: "Proyecto aprobado",   responsible: "UTE" },
      docs1SentAt:         { label: "Docs 1 enviados",     responsible: "VOLTIA" },
      docs1ApprovedAt:     { label: "Docs 1 aprobados",    responsible: "UTE" },
      ensayosSentAt:       { label: "Ensayos enviados",    responsible: "VOLTIA" },
      ensayosApprovedAt:   { label: "Ensayos aprobados",   responsible: "UTE" },
      docs2SentAt:         { label: "Docs 2 enviados",     responsible: "VOLTIA" },
      finalizedAt:         { label: "Finalizado",          responsible: "UTE" },
    };
    const STAGE_ORDER = Object.keys(STAGE_META);

    const ALL_ACTIONS: UteActionKey[] = [
      "consultaSentAt", "caseOpenedAt", "consultaApprovedAt",
      "solicitudSentAt", "proyectoApprovedAt",
      "docs1SentAt", "docs1ApprovedAt",
      "ensayosSentAt", "ensayosApprovedAt",
      "docs2SentAt", "finalizedAt",
    ];

    type ClosedStage = {
      stageKey: string;
      responsible: Responsible;
      duracion: number;
      fechaCierre: Date;
    };

    const allClosed: ClosedStage[] = [];
    for (const p of processes) {
      const actions = ALL_ACTIONS
        .map((k) => ({ key: k, date: p[k] as Date | null }))
        .filter((a): a is { key: UteActionKey; date: Date } => a.date != null)
        .sort((a, b) => a.date.getTime() - b.date.getTime());

      for (let i = 1; i < actions.length; i++) {
        const prev = actions[i - 1];
        const curr = actions[i];
        const meta = STAGE_META[curr.key];
        if (!meta) continue;
        const duracion = Math.max(
          0,
          Math.round((curr.date.getTime() - prev.date.getTime()) / 86_400_000),
        );
        allClosed.push({
          stageKey: curr.key,
          responsible: meta.responsible,
          duracion,
          fechaCierre: curr.date,
        });
      }
    }

    // Por cada trámite finalizado, sumar sus etapas Voltia/UTE/Total.
    type FinalizedTotals = {
      processId: string;
      finalizedAt: Date;
      tiempoVoltia: number;
      tiempoUte: number;
      tiempoTotal: number;
    };
    const finalizedTotals: FinalizedTotals[] = [];
    for (const p of processes) {
      if (!p.finalizedAt) continue;
      const acts = ALL_ACTIONS
        .map((k) => ({ key: k, date: p[k] as Date | null }))
        .filter((a): a is { key: UteActionKey; date: Date } => a.date != null)
        .sort((a, b) => a.date.getTime() - b.date.getTime());
      let voltia = 0;
      let ute = 0;
      for (let i = 1; i < acts.length; i++) {
        const meta = STAGE_META[acts[i].key];
        if (!meta) continue;
        const dur = Math.max(
          0,
          Math.round((acts[i].date.getTime() - acts[i - 1].date.getTime()) / 86_400_000),
        );
        if (meta.responsible === "VOLTIA") voltia += dur;
        else ute += dur;
      }
      finalizedTotals.push({
        processId: p.id,
        finalizedAt: p.finalizedAt,
        tiempoVoltia: voltia,
        tiempoUte: ute,
        tiempoTotal: voltia + ute,
      });
    }

    const builtQuarters = allQuarters.map((quarter) => {
      // Top cards: trámites finalizados en este Q, agregados por trámite.
      const finishedInQ = finalizedTotals.filter(
        (t) => t.finalizedAt >= quarter.start && t.finalizedAt < quarter.end,
      );
      const totalsTotal = finishedInQ.map((t) => t.tiempoTotal);
      const totalsVoltia = finishedInQ.map((t) => t.tiempoVoltia);
      const totalsUte = finishedInQ.map((t) => t.tiempoUte);

      // Mini cards: cada etapa cerrada en este Q.
      const stagesInQ = allClosed.filter(
        (s) => s.fechaCierre >= quarter.start && s.fechaCierre < quarter.end,
      );
      const porEtapa = STAGE_ORDER.map((key) => {
        const meta = STAGE_META[key];
        const durs = stagesInQ.filter((s) => s.stageKey === key).map((s) => s.duracion);
        return {
          stageName: key,
          stageLabel: meta.label,
          responsible: meta.responsible,
          promedio: avg(durs),
          mediana: median(durs),
          count: durs.length,
        };
      });

      return {
        quarter: quarter.key,
        label: quarter.label,
        cantidadTramitesFinalizados: finishedInQ.length,
        cantidadEtapasCerradas: stagesInQ.length,
        tiempoTotalDias: stats(totalsTotal),
        tiempoVoltiaDias: stats(totalsVoltia),
        tiempoUteDias: stats(totalsUte),
        porEtapa,
      };
    });

    const quarters = builtQuarters.filter(
      (qq) => qq.cantidadTramitesFinalizados > 0 || qq.cantidadEtapasCerradas > 0,
    );

    type Direccion = "MEJORANDO" | "EMPEORANDO" | "ESTABLE";
    function tendencia(values: (number | null)[]): {
      ultimoQ: number | null;
      promedioUltimos4Q: number | null;
      cambio: number | null;
      direccion: Direccion;
    } {
      const valid = values.filter((v): v is number => v != null);
      if (valid.length === 0) {
        return { ultimoQ: null, promedioUltimos4Q: null, cambio: null, direccion: "ESTABLE" };
      }
      const ultimoQ = valid[valid.length - 1];
      const last4 = valid.slice(-4);
      const promedioUltimos4Q = Math.round((last4.reduce((s, n) => s + n, 0) / last4.length) * 10) / 10;
      if (promedioUltimos4Q === 0) {
        return { ultimoQ, promedioUltimos4Q, cambio: 0, direccion: "ESTABLE" };
      }
      const cambioRaw = ((ultimoQ - promedioUltimos4Q) / promedioUltimos4Q) * 100;
      const cambio = Math.round(cambioRaw * 10) / 10;
      let direccion: Direccion = "ESTABLE";
      if (cambio < -5) direccion = "MEJORANDO";
      else if (cambio > 5) direccion = "EMPEORANDO";
      return { ultimoQ, promedioUltimos4Q, cambio, direccion };
    }

    const tendencias = {
      tiempoTotal: tendencia(quarters.map((qq) => qq.tiempoTotalDias.promedio)),
      tiempoVoltia: tendencia(quarters.map((qq) => qq.tiempoVoltiaDias.promedio)),
      tiempoUte: tendencia(quarters.map((qq) => qq.tiempoUteDias.promedio)),
    };

    return { quarters, tendencias };
  });

  // ─── Dev test endpoint + Finanzas + Stock ───────────────────────────────────
  // (Originalmente esto vivía dentro de un `if (NODE_ENV === "development")`
  // que rompía silenciosamente Finanzas y Stock en local y prod. El bloque se
  // sacó pero las 1000+ líneas internas mantienen su indent extra de 4
  // espacios — la limpieza visual queda como cleanup futuro.)

    // ─── Finance: Exchange Rate ───────────────────────────────────────────────

    app.get("/finance/exchange-rate", async () => {
      const rate = await prisma.exchangeRate.findFirst({ orderBy: { createdAt: "desc" } });
      if (!rate) throw notFound("EXCHANGE_RATE_NOT_FOUND", "No hay tipo de cambio registrado");
      return { usdToUyu: decimalToNumber(rate.usdToUyu), date: serializeDate(rate.date), source: rate.source };
    });

    app.post("/finance/exchange-rate", { preHandler: authorize(Module.FINANZAS, Action.CREATE) }, async (request) => {
      const user = ensureUser(request);
      const body = z
        .object({
          usdToUyu: z.coerce.number().positive(),
          // Fecha opcional ISO (YYYY-MM-DD o full ISO). Si no viene, usa now().
          date: z.string().optional(),
        })
        .strict()
        .parse(request.body);
      const rate = await prisma.exchangeRate.create({
        data: {
          usdToUyu: new Prisma.Decimal(body.usdToUyu),
          createdBy: user.id,
          ...(body.date ? { date: new Date(body.date) } : {}),
        },
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
      const rates = await prisma.exchangeRate.findMany({
        orderBy: [{ date: "desc" }, { createdAt: "desc" }],
        take: 30,
      });
      return rates.map((r) => ({ id: r.id, usdToUyu: decimalToNumber(r.usdToUyu), date: serializeDate(r.date), source: r.source }));
    });

    // Consulta SOLO al BCU (sin guardar). El cliente lo usa para sugerir un
    // valor en el modal de "actualizar TC". Si el usuario lo acepta, dispara
    // el POST normal — esto deja el rate en source="manual" porque fue una
    // decisión humana, distinto al cron diario que usa source="bcu".
    app.get("/finance/exchange-rate/bcu-preview", { preHandler: authorize(Module.FINANZAS, Action.VIEW) }, async () => {
      try {
        const rate = await fetchBcuRatePreview();
        if (!rate) {
          throw badRequest("BCU_NO_DATA", "BCU no devolvió cotizaciones recientes");
        }
        return rate;
      } catch (err) {
        if (err instanceof AppError) throw err;
        const msg = err instanceof Error ? err.message : String(err);
        throw badRequest("BCU_FETCH_ERROR", `No se pudo consultar BCU: ${msg}`);
      }
    });

    // ─── Finance: Accounts (cajas / cuentas bancarias) ────────────────────────
    //
    // Una Account representa una caja o banco de donde sale/entra dinero.
    // Movimientos PAGADOS/COBRADOS y Payments deben vincular una cuenta. El
    // saldo se calcula on-demand sumando saldoInicial + ingresos - gastos -
    // pagos vinculados.

    // fechaSaldoInicial no puede ser futura: el saldoInicial representa el saldo
    // de la cuenta a esa fecha. Si fuera futuro, los movimientos actuales no se
    // contarían y el saldo quedaría desconectado de la realidad.
    const fechaSaldoInicialSchema = z
      .string()
      .regex(/^\d{4}-\d{2}-\d{2}$/)
      .nullable()
      .optional()
      .refine(
        (val) => {
          if (!val) return true;
          // Comparamos como string YYYY-MM-DD para evitar problemas de TZ.
          const hoy = new Date().toISOString().slice(0, 10);
          return val <= hoy;
        },
        { message: "La fecha del saldo inicial no puede ser futura" },
      );

    const accountCreateSchema = z.object({
      nombre: z.string().min(1),
      tipo: z.nativeEnum(AccountType),
      moneda: z.nativeEnum(Moneda),
      saldoInicial: z.coerce.number().default(0),
      fechaSaldoInicial: fechaSaldoInicialSchema,
      notas: z.string().optional(),
    }).strict();

    const accountPatchSchema = z.object({
      nombre: z.string().min(1).optional(),
      tipo: z.nativeEnum(AccountType).optional(),
      moneda: z.nativeEnum(Moneda).optional(),
      saldoInicial: z.coerce.number().optional(),
      fechaSaldoInicial: fechaSaldoInicialSchema,
      notas: z.string().nullable().optional(),
      activa: z.boolean().optional(),
    }).strict();

    function serializeAccount(a: {
      id: string; nombre: string; tipo: AccountType; moneda: Moneda;
      saldoInicial: import("@prisma/client/runtime/library").Decimal;
      fechaSaldoInicial: Date | null; notas: string | null; activa: boolean;
      createdAt: Date; updatedAt: Date; deletedAt: Date | null;
      _count?: { movements: number; payments: number };
    }) {
      return {
        id: a.id,
        nombre: a.nombre,
        tipo: a.tipo,
        moneda: a.moneda,
        saldoInicial: Number(a.saldoInicial),
        fechaSaldoInicial: a.fechaSaldoInicial ? serializeDateOnly(a.fechaSaldoInicial) : null,
        notas: a.notas,
        activa: a.activa,
        createdAt: serializeDate(a.createdAt),
        updatedAt: serializeDate(a.updatedAt),
        deletedAt: a.deletedAt ? serializeDate(a.deletedAt) : null,
        ...(a._count ? { _count: a._count } : {}),
      };
    }

    /** Calcula el saldo actual de una cuenta sumando todos los movimientos
     *  PAGADOS/COBRADOS y los pagos asociados.
     *
     *  Semántica de `fechaSaldoInicial`: "saldo al CIERRE de ese día". Los
     *  movimientos con fecha == fechaSaldoInicial ya están absorbidos en
     *  `saldoInicial`, así que sólo cuentan los ESTRICTAMENTE posteriores
     *  (fecha > fechaSaldoInicial = día siguiente en adelante). Si el campo
     *  está en null, no hay corte (legacy: todos los movimientos cuentan). */
    async function computeAccountBalance(accountId: string): Promise<{
      saldoInicial: number; ingresos: number; gastos: number; pagos: number; saldoActual: number;
    }> {
      const account = await prisma.account.findUnique({ where: { id: accountId } });
      if (!account) throw notFound("ACCOUNT_NOT_FOUND", "Cuenta no encontrada");
      const saldoInicial = Number(account.saldoInicial);
      const fechaCorte = account.fechaSaldoInicial; // Date | null
      const fechaFilter = fechaCorte ? { fecha: { gt: fechaCorte } } : {};

      // Ingresos: movements INGRESO con cobrado=true
      const ingresoAgg = await prisma.financeMovement.aggregate({
        where: { accountId, deletedAt: null, tipoMovimiento: TipoMovimiento.INGRESO, cobrado: true, ...fechaFilter },
        _sum: { monto: true },
      });
      // Gastos: movements GASTO con pagado=true que NO tienen Payment asociado.
      // Si tienen Payment (via PaymentApplication), ese ya se cuenta abajo en pagosAgg
      // — sumar ambos generaría doble débito (G.8 Auto-Payment crea ambos para el
      // mismo evento lógico).
      const gastoAgg = await prisma.financeMovement.aggregate({
        where: {
          accountId,
          deletedAt: null,
          tipoMovimiento: TipoMovimiento.GASTO,
          pagado: true,
          paymentApplications: { none: { payment: { deletedAt: null } } },
          ...fechaFilter,
        },
        _sum: { monto: true },
      });
      // Pagos: payments con accountId
      const pagosAgg = await prisma.payment.aggregate({
        where: { accountId, deletedAt: null, ...fechaFilter },
        _sum: { monto: true },
      });

      const ingresos = Number(ingresoAgg._sum.monto ?? 0);
      const gastos = Number(gastoAgg._sum.monto ?? 0);
      const pagos = Number(pagosAgg._sum.monto ?? 0);
      const saldoActual = Math.round((saldoInicial + ingresos - gastos - pagos) * 100) / 100;
      return { saldoInicial, ingresos, gastos, pagos, saldoActual };
    }

    // ─── Invariante de coherencia financiera ────────────────────────────────
    //
    // REGLA DE ORO: el saldo total de cuentas activas (suma `computeAccountBalance`)
    // debe coincidir con el flujo de fondos unificado hasta HOY, considerando SOLO
    // movimientos PAGADOS/COBRADOS (plata real, no proyectada ni a pagar).
    //
    // Si los dos cálculos divergen (>$0.01 USD) hay un descalce que investigar:
    // típicamente bug en alguna de las lógicas, o movimiento PAGADO con fecha
    // futura, o data corrupta (Payment sin movement, etc.).
    type InvariantDetails = {
      saldoCuentasUSD: number;
      saldoFlujoUSD: number;
      diferencia: number;
      fecha: string;
      perAccount: Array<{
        nombre: string;
        moneda: Moneda;
        saldoActual: number;
        saldoActualUSD: number;
      }>;
      tipoCambioUsado: number;
    };

    async function validateFinanceInvariants(): Promise<{ ok: boolean; details: InvariantDetails }> {
      const accounts = await prisma.account.findMany({
        where: { activa: true, deletedAt: null },
      });
      const lastRate = await prisma.exchangeRate.findFirst({ orderBy: { createdAt: "desc" } });
      const parsedRate = lastRate ? decimalToNumber(lastRate.usdToUyu) : null;
      const fallbackUsdToUyu = parsedRate && parsedRate > 0 ? parsedRate : 1;
      const toUSD = (monto: number, moneda: Moneda, tipoCambioRow: number | null) => {
        if (moneda === Moneda.USD) return monto;
        const rate = tipoCambioRow && tipoCambioRow > 0 ? tipoCambioRow : fallbackUsdToUyu;
        return rate > 0 ? monto / rate : monto;
      };

      // 1) saldoCuentasUSD = Σ computeAccountBalance, convertido a USD.
      const perAccount: InvariantDetails["perAccount"] = [];
      let saldoCuentasUSD = 0;
      for (const account of accounts) {
        const balance = await computeAccountBalance(account.id);
        const saldoActual = balance.saldoActual;
        const saldoActualUSD = toUSD(saldoActual, account.moneda, null);
        saldoCuentasUSD += saldoActualUSD;
        perAccount.push({
          nombre: account.nombre,
          moneda: account.moneda,
          saldoActual: Math.round(saldoActual * 100) / 100,
          saldoActualUSD: Math.round(saldoActualUSD * 100) / 100,
        });
      }

      // 2) saldoFlujoUSD = Σ saldoInicial USD + walk cronológico de movimientos
      //    PAGADOS/COBRADOS y Payments con fecha <= hoy y >= fechaSaldoInicial.
      //    Walk iterativo (no aggregate) para que sea una segunda fuente de
      //    verdad y detecte bugs en el helper.
      const hoyIso = new Date().toISOString().slice(0, 10);
      const hoyDate = new Date(`${hoyIso}T23:59:59.999Z`);

      let saldoFlujoUSD = 0;
      const accountsById = new Map(accounts.map((a) => [a.id, a]));
      for (const a of accounts) {
        saldoFlujoUSD += toUSD(Number(a.saldoInicial), a.moneda, null);
      }

      // Movimientos PAGADOS/COBRADOS con accountId activo, fecha <= hoy y >= corte.
      const movsPagados = await prisma.financeMovement.findMany({
        where: {
          deletedAt: null,
          fecha: { lte: hoyDate },
          accountId: { in: accounts.map((a) => a.id) },
          OR: [
            { tipoMovimiento: TipoMovimiento.GASTO, status: FinanceMovementStatus.PAGADO },
            { tipoMovimiento: TipoMovimiento.INGRESO, cobrado: true },
          ],
        },
        select: {
          id: true, fecha: true, monto: true, moneda: true, tipoCambio: true,
          tipoMovimiento: true, accountId: true,
          paymentApplications: { include: { payment: { select: { deletedAt: true } } } },
        },
      });
      for (const m of movsPagados) {
        const a = m.accountId ? accountsById.get(m.accountId) : null;
        if (!a) continue;
        // Cierre del día: movimientos del propio día de fechaSaldoInicial ya
        // están absorbidos. Solo aplican estrictamente posteriores.
        if (a.fechaSaldoInicial && m.fecha <= a.fechaSaldoInicial) continue;
        // Si el GASTO tiene Payment activo asociado, ya se cuenta vía pagosWalk.
        const tieneAppActiva = m.tipoMovimiento === TipoMovimiento.GASTO
          && m.paymentApplications.some((pa) => !pa.payment.deletedAt);
        if (tieneAppActiva) continue;
        const monto = decimalToNumber(m.monto) ?? 0;
        const tcRow = m.tipoCambio ? decimalToNumber(m.tipoCambio) : null;
        const usd = toUSD(monto, m.moneda, tcRow);
        if (m.tipoMovimiento === TipoMovimiento.GASTO) saldoFlujoUSD -= usd;
        else if (m.tipoMovimiento === TipoMovimiento.INGRESO) saldoFlujoUSD += usd;
      }

      // Payments con fecha <= hoy.
      const pagos = await prisma.payment.findMany({
        where: {
          deletedAt: null,
          fecha: { lte: hoyDate },
          accountId: { in: accounts.map((a) => a.id) },
        },
        select: { fecha: true, monto: true, moneda: true, accountId: true },
      });
      for (const p of pagos) {
        const a = p.accountId ? accountsById.get(p.accountId) : null;
        if (!a) continue;
        if (a.fechaSaldoInicial && p.fecha <= a.fechaSaldoInicial) continue;
        const monto = decimalToNumber(p.monto) ?? 0;
        saldoFlujoUSD -= toUSD(monto, p.moneda, null);
      }

      saldoCuentasUSD = Math.round(saldoCuentasUSD * 100) / 100;
      saldoFlujoUSD = Math.round(saldoFlujoUSD * 100) / 100;
      const diferencia = Math.round((saldoCuentasUSD - saldoFlujoUSD) * 100) / 100;

      return {
        ok: Math.abs(diferencia) < 0.01,
        details: {
          saldoCuentasUSD,
          saldoFlujoUSD,
          diferencia,
          fecha: hoyIso,
          perAccount,
          tipoCambioUsado: fallbackUsdToUyu,
        },
      };
    }

    /** Wrap: corre el check y, si el invariante está roto, deja un warning en
     *  logs (no bloquea la operación). Útil para llamar después de operaciones
     *  críticas que tocan saldos. */
    async function checkInvariantOrWarn(operation: string, context?: Record<string, unknown>) {
      try {
        const result = await validateFinanceInvariants();
        if (!result.ok) {
          app.log.warn(
            { operation, ...context, ...result.details },
            `INVARIANTE FINANCIERO ROTO tras "${operation}": diferencia=${result.details.diferencia} USD`,
          );
        }
      } catch (err) {
        app.log.error({ operation, err }, "Falló el check de invariante financiero");
      }
    }

    app.get("/finance/invariant-check", { preHandler: authorize(Module.FINANZAS, Action.VIEW) }, async () => {
      return validateFinanceInvariants();
    });

    // ─── Cobros por proyecto ────────────────────────────────────────────────
    //
    // Espejo de Proveedores pero por proyecto (cliente). Compara budgetUsd con
    // la suma de INGRESOS cobrados con projectId asignado, agrupando por moneda
    // y normalizando a USD para los KPIs globales.

    type EstadoCobranza = "SIN_PRESUPUESTO" | "PENDIENTE" | "PARCIAL" | "COMPLETO" | "EXCEDIDO";

    function clasificarEstado(presupuestoUsd: number | null, cobradoUsd: number): EstadoCobranza {
      if (presupuestoUsd == null) return "SIN_PRESUPUESTO";
      if (cobradoUsd < 0.005) return "PENDIENTE";
      if (cobradoUsd > presupuestoUsd + 0.005) return "EXCEDIDO";
      if (cobradoUsd >= presupuestoUsd - 0.005) return "COMPLETO";
      return "PARCIAL";
    }

    app.get("/finance/cobros-by-project", { preHandler: authorize(Module.FINANZAS, Action.VIEW) }, async (request) => {
      const query = z.object({
        estado: z.enum(["PENDIENTE", "PARCIAL", "COMPLETO", "EXCEDIDO", "SIN_PRESUPUESTO"]).optional(),
        clientName: z.string().optional(),
        activos: z.enum(["true", "false"]).optional(),
      }).parse(request.query);

      const lastRate = await prisma.exchangeRate.findFirst({ orderBy: { createdAt: "desc" } });
      const fallbackUsdToUyu = lastRate ? (decimalToNumber(lastRate.usdToUyu) ?? 1) : 1;

      const where: Prisma.ProjectWhereInput = {};
      if (query.activos === "true") where.status = ProjectStatus.ACTIVE;
      if (query.clientName && query.clientName.trim().length > 0) {
        where.clientName = { contains: query.clientName.trim(), mode: "insensitive" };
      }

      const projects = await prisma.project.findMany({
        where,
        select: {
          id: true,
          code: true,
          clientName: true,
          capacityKwp: true,
          budgetUsd: true,
          status: true,
        },
        orderBy: [{ status: "asc" }, { clientName: "asc" }],
      });

      // Cobros agregados por proyecto en una sola query.
      const projectIds = projects.map((p) => p.id);
      const cobrosAgg = projectIds.length === 0 ? [] : await prisma.financeMovement.findMany({
        where: {
          deletedAt: null,
          tipoMovimiento: TipoMovimiento.INGRESO,
          cobrado: true,
          projectId: { in: projectIds },
        },
        select: {
          projectId: true,
          fecha: true,
          monto: true,
          moneda: true,
          tipoCambio: true,
        },
      });

      const cobrosByProject = new Map<string, typeof cobrosAgg>();
      for (const m of cobrosAgg) {
        if (!m.projectId) continue;
        const arr = cobrosByProject.get(m.projectId) ?? [];
        arr.push(m);
        cobrosByProject.set(m.projectId, arr);
      }

      const items = projects.map((p) => {
        const cobros = cobrosByProject.get(p.id) ?? [];
        let totalCobradoUSD = 0;
        let ultimoCobro: Date | null = null;
        for (const c of cobros) {
          totalCobradoUSD += convertMovementToUsd(c, fallbackUsdToUyu);
          if (!ultimoCobro || c.fecha > ultimoCobro) ultimoCobro = c.fecha;
        }
        totalCobradoUSD = roundMoney(totalCobradoUSD);
        const presupuestoUSD = p.budgetUsd != null ? Number(p.budgetUsd) : null;
        const saldoPendienteUSD = presupuestoUSD != null
          ? roundMoney(Math.max(0, presupuestoUSD - totalCobradoUSD))
          : 0;
        const saldoAFavorUSD = presupuestoUSD != null
          ? roundMoney(Math.max(0, totalCobradoUSD - presupuestoUSD))
          : 0;
        const estadoCobranza = clasificarEstado(presupuestoUSD, totalCobradoUSD);

        return {
          id: p.id,
          clientName: p.clientName,
          code: p.code,
          capacity: Number(p.capacityKwp),
          status: p.status,
          presupuestoUSD,
          totalCobradoUSD,
          saldoPendienteUSD,
          saldoAFavorUSD,
          estadoCobranza,
          ultimoCobro: ultimoCobro ? serializeDateOnly(ultimoCobro) : null,
          cantidadCobros: cobros.length,
        };
      });

      const filtered = query.estado ? items.filter((i) => i.estadoCobranza === query.estado) : items;

      const totales = filtered.reduce(
        (acc, p) => ({
          totalPresupuestadoUSD: acc.totalPresupuestadoUSD + (p.presupuestoUSD ?? 0),
          totalCobradoUSD: acc.totalCobradoUSD + p.totalCobradoUSD,
          totalPendienteUSD: acc.totalPendienteUSD + p.saldoPendienteUSD,
          totalSaldoAFavorUSD: acc.totalSaldoAFavorUSD + p.saldoAFavorUSD,
        }),
        { totalPresupuestadoUSD: 0, totalCobradoUSD: 0, totalPendienteUSD: 0, totalSaldoAFavorUSD: 0 },
      );

      return {
        projects: filtered,
        totales: {
          totalPresupuestadoUSD: roundMoney(totales.totalPresupuestadoUSD),
          totalCobradoUSD: roundMoney(totales.totalCobradoUSD),
          totalPendienteUSD: roundMoney(totales.totalPendienteUSD),
          totalSaldoAFavorUSD: roundMoney(totales.totalSaldoAFavorUSD),
        },
        tipoCambio: fallbackUsdToUyu,
      };
    });

    app.get("/finance/cobros-by-project/:projectId", { preHandler: authorize(Module.FINANZAS, Action.VIEW) }, async (request) => {
      const { projectId } = z.object({ projectId: z.string() }).parse(request.params);

      const project = await prisma.project.findFirst({
        where: { id: projectId },
        select: {
          id: true, code: true, clientName: true,
          capacityKwp: true, budgetUsd: true, status: true,
        },
      });
      if (!project) throw notFound("PROJECT_NOT_FOUND", "Proyecto no encontrado");

      const lastRate = await prisma.exchangeRate.findFirst({ orderBy: { createdAt: "desc" } });
      const fallbackUsdToUyu = lastRate ? (decimalToNumber(lastRate.usdToUyu) ?? 1) : 1;

      const cobros = await prisma.financeMovement.findMany({
        where: {
          deletedAt: null,
          tipoMovimiento: TipoMovimiento.INGRESO,
          cobrado: true,
          projectId,
        },
        include: {
          account: { select: { id: true, nombre: true, moneda: true } },
        },
        orderBy: { fecha: "asc" },
      });

      // Cobros previstos del plan (status=PREVISTO, no cobrados). Se devuelven
      // SOLO para la tabla (mezclados con los pagados). NO entran en KPIs /
      // totales / estado de cuenta — esos siguen calculándose sobre `cobros`.
      const previstos = await prisma.financeMovement.findMany({
        where: {
          deletedAt: null,
          tipoMovimiento: TipoMovimiento.INGRESO,
          status: FinanceMovementStatus.PREVISTO,
          projectId,
        },
        include: {
          account: { select: { id: true, nombre: true, moneda: true } },
        },
        orderBy: { fecha: "asc" },
      });

      // KPIs por moneda.
      const kpisPorMoneda: Record<Moneda, { presupuesto: number; cobrado: number; pendiente: number; saldoAFavor: number }> = {
        [Moneda.USD]: { presupuesto: 0, cobrado: 0, pendiente: 0, saldoAFavor: 0 },
        [Moneda.UYU]: { presupuesto: 0, cobrado: 0, pendiente: 0, saldoAFavor: 0 },
      };
      // El presupuesto del proyecto está en USD por convención (budgetUsd).
      if (project.budgetUsd != null) {
        kpisPorMoneda[Moneda.USD].presupuesto = Number(project.budgetUsd);
      }
      for (const c of cobros) {
        kpisPorMoneda[c.moneda].cobrado += Number(c.monto);
      }
      for (const m of [Moneda.USD, Moneda.UYU] as Moneda[]) {
        const k = kpisPorMoneda[m];
        k.cobrado = roundMoney(k.cobrado);
        const diff = k.presupuesto - k.cobrado;
        k.pendiente = roundMoney(Math.max(0, diff));
        k.saldoAFavor = roundMoney(Math.max(0, -diff));
      }

      // Totales unificados USD.
      const totalCobradoUSD = roundMoney(
        cobros.reduce((acc, c) => acc + convertMovementToUsd(c, fallbackUsdToUyu), 0),
      );
      const presupuestoUSD = project.budgetUsd != null ? Number(project.budgetUsd) : null;
      const saldoPendienteUSD = presupuestoUSD != null
        ? roundMoney(Math.max(0, presupuestoUSD - totalCobradoUSD))
        : 0;
      const saldoAFavorUSD = presupuestoUSD != null
        ? roundMoney(Math.max(0, totalCobradoUSD - presupuestoUSD))
        : 0;
      const estadoCobranza = clasificarEstado(presupuestoUSD, totalCobradoUSD);

      // Estado de cuenta cronológico: cada cobro suma al saldo del cliente
      // hacia el "completado". Lo dejamos como ledger simple (acumulado del
      // cobrado vs presupuesto).
      let acumulado = 0;
      const estadoCuenta = cobros.map((c) => {
        const usd = convertMovementToUsd(c, fallbackUsdToUyu);
        acumulado = roundMoney(acumulado + usd);
        return {
          fecha: serializeDateOnly(c.fecha),
          descripcion: c.descripcion,
          monto: Number(c.monto),
          moneda: c.moneda,
          montoUSD: roundMoney(usd),
          acumuladoCobradoUSD: acumulado,
          saldoRestanteUSD: presupuestoUSD != null
            ? roundMoney(presupuestoUSD - acumulado)
            : null,
        };
      });

      return {
        project: {
          id: project.id,
          code: project.code,
          clientName: project.clientName,
          capacity: Number(project.capacityKwp),
          status: project.status,
          presupuestoUSD,
        },
        kpis: kpisPorMoneda,
        totals: {
          totalCobradoUSD,
          saldoPendienteUSD,
          saldoAFavorUSD,
          estadoCobranza,
          cantidadCobros: cobros.length,
        },
        // Tabla: pagados + previstos mezclados, ordenados por fecha ascendente.
        // `status` distingue PAGADO vs PREVISTO; `dueDate` se incluye para que el
        // front elija qué fecha mostrar.
        cobros: [...cobros, ...previstos]
          .map((c) => ({
            id: c.id,
            fecha: serializeDateOnly(c.fecha),
            dueDate: serializeDateOnly(c.dueDate),
            descripcion: c.descripcion,
            monto: Number(c.monto),
            moneda: c.moneda,
            tipoCambio: c.tipoCambio ? Number(c.tipoCambio) : null,
            accountId: c.accountId,
            accountName: c.account?.nombre ?? null,
            accountMoneda: c.account?.moneda ?? null,
            observaciones: c.observaciones,
            status: c.status,
          }))
          .sort((a, b) => (a.fecha ?? "").localeCompare(b.fecha ?? "")),
        estadoCuenta,
        tipoCambio: fallbackUsdToUyu,
      };
    });

    // ─── Asistente Plan de Pagos Previstos ─────────────────────────────────
    // Crea cobros previstos estructurados (seña + cuotas) a partir del
    // presupuesto del proyecto en una sola transacción. Identificación del
    // plan: prefijo "[PLAN] " en descripcion. Solo lectura/escritura para
    // FINANZAS.{VIEW,EDIT}.

    app.get(
      "/finance/plan-pagos/:projectId",
      { preHandler: authorize(Module.FINANZAS, Action.VIEW) },
      async (request) => {
        const { projectId } = z.object({ projectId: z.string().min(1) }).parse(request.params);
        return getPlanPagos(projectId);
      },
    );

    const planPagosBodySchema = z
      .object({
        projectId: z.string().min(1),
        cuotas: z
          .array(
            z.object({
              descripcion: z.string().trim().min(1).max(120),
              monto: z.number().positive(),
              fechaPrevista: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
            }),
          )
          .min(1),
      })
      .strict();

    app.post(
      "/finance/plan-pagos",
      { preHandler: authorize(Module.FINANZAS, Action.EDIT) },
      async (request, reply) => {
        const user = ensureUser(request);
        const body = planPagosBodySchema.parse(request.body);

        const result = await createPlanPagos({
          projectId: body.projectId,
          cuotas: body.cuotas,
          userId: user.id,
        });

        await createAuditEntry({
          entityType: AuditEntityType.project,
          entityId: body.projectId,
          projectId: body.projectId,
          userId: user.id,
          action: AuditAction.created,
          description:
            result.replaced > 0
              ? `Reemplazó plan de pagos previstos (${result.replaced} previas → ${result.created} nuevas)`
              : `Creó plan de pagos previstos (${result.created} cuotas)`,
          metadata: { kind: "plan_pagos", created: result.created, replaced: result.replaced },
        });

        reply.code(201);
        return result;
      },
    );

    // ─── Generador de documentos UTE ────────────────────────────────────────
    // GET config: devuelve la config UTE actual del proyecto (la crea con
    // defaults si no existía).
    app.get(
      "/projects/:projectId/ute-docs/config",
      { preHandler: authorize(Module.INGENIERIA, Action.VIEW) },
      async (request) => {
        const { projectId } = z.object({ projectId: z.string().min(1) }).parse(request.params);
        return getOrCreateUteDocConfig(projectId);
      },
    );

    // PUT config: upsert con todos los campos editables.
    const uteDocConfigBodySchema = z
      .object({
        cuentaUte: z.string().optional(),
        casoUte: z.string().optional(),
        representa: z.string().optional(),
        ciRepre: z.string().optional(),
        calidadRepre: z.string().optional(),
        fi: z.string().optional(),
        rut: z.string().optional(),
        dirFi: z.string().optional(),
        ti: z.string().optional(),
        ciTi: z.string().optional(),
        oficina: z.string().optional(),
        repUte: z.string().optional(),
        calidadUte: z.string().optional(),
        asUte: z.string().optional(),
        ps: z.string().optional(),
        x: z.string().optional(),
        potenciaNomSolicitudImg: z.string().optional(),
        intensidadNomSolicitudImg: z.string().optional(),
        tension230: z.boolean().optional(),
        tension400: z.boolean().optional(),
        tensionNomInversor230: z.boolean().optional(),
        tensionNomInversor400: z.boolean().optional(),
        fasesMono: z.boolean().optional(),
        fasesTri: z.boolean().optional(),
        tipoGeneradorSincMono: z.boolean().optional(),
        tipoGeneradorSincTri: z.boolean().optional(),
        potImg: z.string().optional(),
        potImgLetras: z.string().optional(),
        potContratada: z.string().optional(),
        potContratadaLetras: z.string().optional(),
        potContratada1000: z.string().optional(),
        tarifa: z.string().optional(),
        fp: z.string().optional(),
        normas1: z.string().optional(),
        normas2: z.string().optional(),
        x1: z.string().optional(),
        x2: z.string().optional(),
        x3: z.string().optional(),
        x4: z.string().optional(),
        seriePanel: z.string().optional(),
        serieInversor: z.string().optional(),
        areaPaneles: z.string().optional(),
        fechaDoc: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable().optional(),
        fechaFin: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable().optional(),
      })
      .strict();

    app.put(
      "/projects/:projectId/ute-docs/config",
      { preHandler: authorize(Module.INGENIERIA, Action.EDIT) },
      async (request) => {
        const { projectId } = z.object({ projectId: z.string().min(1) }).parse(request.params);
        const raw = uteDocConfigBodySchema.parse(request.body);
        // Convertir fechas string → Date (null para clearear).
        const data: Record<string, unknown> = { ...raw };
        if (raw.fechaDoc === null) data.fechaDoc = null;
        else if (raw.fechaDoc) data.fechaDoc = parseDateOnly(raw.fechaDoc);
        if (raw.fechaFin === null) data.fechaFin = null;
        else if (raw.fechaFin) data.fechaFin = parseDateOnly(raw.fechaFin);
        return upsertUteDocConfig({ projectId, data });
      },
    );

    // DELETE config: borra la fila para que el próximo GET la recree con los
    // defaults del schema. Lo usa el botón "Resetear" del form.
    app.delete(
      "/projects/:projectId/ute-docs/config",
      { preHandler: authorize(Module.INGENIERIA, Action.EDIT) },
      async (request, reply) => {
        const { projectId } = z.object({ projectId: z.string().min(1) }).parse(request.params);
        await prisma.uteDocumentConfig.deleteMany({ where: { projectId } });
        reply.code(204);
      },
    );

    // POST generate: arma el ZIP de los docs pedidos y lo devuelve.
    app.post(
      "/projects/:projectId/ute-docs/generate",
      { preHandler: authorize(Module.INGENIERIA, Action.EDIT) },
      async (request, reply) => {
        const user = ensureUser(request);
        const { projectId } = z.object({ projectId: z.string().min(1) }).parse(request.params);
        const body = z
          .object({
            docs: z.array(z.enum(UTE_DOC_KEYS as [UteDocKey, ...UteDocKey[]])).min(1),
          })
          .strict()
          .parse(request.body);

        const { zipBuffer, zipFilename, docsGenerated, generationId, projectCode } =
          await generateUteDocs({
            projectId,
            userId: user.id,
            docs: body.docs,
          });

        // Persistir el ZIP como FileAttachment del proyecto (toolSource
        // "ute-docs"). Una sola versión vigente: al regenerar se soft-deletea
        // la anterior y se borra el archivo físico. Mismo patrón que unifilar.
        // Si la persistencia falla no se interrumpe la descarga.
        try {
          const previous = await prisma.fileAttachment.findMany({
            where: { projectId, toolSource: "ute-docs", deletedAt: null },
            select: { id: true, url: true },
          });

          const ymd = new Date().toISOString().slice(0, 10).replace(/-/g, "");
          const storedName = `voltia_ute_${projectCode}_${ymd}.zip`;
          const stored = await saveBufferAsAttachment(
            zipBuffer,
            storedName,
            "application/zip",
            projectId,
          );

          await prisma.fileAttachment.create({
            data: {
              projectId,
              filename: stored.filename,
              storedFilename: stored.storedFilename,
              mimeType: stored.mimeType,
              sizeBytes: stored.sizeBytes,
              url: stored.url,
              tipo: FileAttachmentTipo.OTRO,
              toolSource: "ute-docs",
              toolEntityId: generationId,
              uploadedById: user.id,
            },
          });

          if (previous.length > 0) {
            await prisma.fileAttachment.updateMany({
              where: { id: { in: previous.map((p) => p.id) } },
              data: { deletedAt: new Date() },
            });
            await Promise.all(
              previous.map((p) => deleteStoredFile(p.url).catch(() => undefined)),
            );
          }
        } catch (err) {
          request.log.warn({ err }, "No se pudo persistir el ZIP UTE generado");
        }

        await createAuditEntry({
          entityType: AuditEntityType.project,
          entityId: projectId,
          projectId,
          userId: user.id,
          action: AuditAction.created,
          description: `Generó ${docsGenerated.length} documento${docsGenerated.length === 1 ? "" : "s"} UTE`,
          metadata: { kind: "ute_docs", docs: docsGenerated },
        });

        reply
          .header("Content-Type", "application/zip")
          .header("Content-Disposition", `attachment; filename="${zipFilename}"`)
          .send(zipBuffer);
      },
    );

    // ZIP UTE generado vigente (uno solo). Lo consume el bloque "Documentos UTE
    // generados". Visible para cualquiera con acceso al proyecto (VIEW).
    app.get(
      "/projects/:projectId/ute-docs/generado",
      { preHandler: authorize(Module.OPERACIONES, Action.VIEW) },
      async (request) => {
        const { projectId } = z.object({ projectId: z.string().min(1) }).parse(request.params);
        await findProjectOrThrow(projectId);

        const file = await prisma.fileAttachment.findFirst({
          where: { projectId, toolSource: "ute-docs", deletedAt: null },
          orderBy: { createdAt: "desc" },
          include: { uploadedBy: { select: { id: true, name: true } } },
        });

        if (!file) return { generado: null };

        return {
          generado: {
            id: file.id,
            filename: file.filename,
            mimeType: file.mimeType,
            sizeBytes: file.sizeBytes,
            uploadedBy: file.uploadedBy
              ? { id: file.uploadedBy.id, name: file.uploadedBy.name }
              : null,
            createdAt: serializeDate(file.createdAt),
            downloadUrl: `/api/files/${file.id}/preview`,
          },
        };
      },
    );

    // ─── Documentos UTE firmados (subidos por Operaciones tras la obra) ─────
    // Acumulativo: cada subida es una entrada más (no reemplaza). Acepta PDF,
    // imágenes y ZIP. Multipart es files:1 → el cliente sube de a uno.
    const UTE_FIRMADOS_EXTS = new Set([".pdf", ".jpg", ".jpeg", ".png", ".zip"]);

    const mapFirmado = (file: {
      id: string;
      filename: string;
      mimeType: string;
      sizeBytes: number;
      createdAt: Date;
      uploadedBy: { id: string; name: string | null } | null;
    }) => ({
      id: file.id,
      filename: file.filename,
      mimeType: file.mimeType,
      sizeBytes: file.sizeBytes,
      uploadedBy: file.uploadedBy ? { id: file.uploadedBy.id, name: file.uploadedBy.name } : null,
      createdAt: serializeDate(file.createdAt),
      downloadUrl: `/api/files/${file.id}/preview`,
    });

    app.post(
      "/projects/:projectId/ute-docs/firmados",
      { preHandler: authorize(Module.OPERACIONES, Action.VIEW) },
      async (request, reply) => {
        const user = ensureUser(request);
        const { projectId } = z.object({ projectId: z.string().min(1) }).parse(request.params);
        await findProjectOrThrow(projectId);

        const created: ReturnType<typeof mapFirmado>[] = [];
        for await (const part of request.parts()) {
          if (part.type !== "file") continue;
          const ext = path.extname(part.filename).toLowerCase();
          if (!UTE_FIRMADOS_EXTS.has(ext)) {
            // Drenar el stream para no colgar la request multipart.
            await part.toBuffer().catch(() => undefined);
            throw badRequest(
              "INVALID_FILE_TYPE",
              "Solo se permiten archivos PDF, JPG, PNG o ZIP",
            );
          }
          const saved = await saveUploadedFile(part, projectId);
          const attachment = await prisma.fileAttachment.create({
            data: {
              projectId,
              filename: saved.filename,
              storedFilename: saved.storedFilename,
              mimeType: saved.mimeType,
              sizeBytes: saved.sizeBytes,
              url: saved.url,
              tipo: FileAttachmentTipo.UPLOAD_MANUAL,
              toolSource: "ute-docs-firmados",
              uploadedById: user.id,
            },
            include: { uploadedBy: { select: { id: true, name: true } } },
          });
          created.push(mapFirmado(attachment));

          await createAuditEntry({
            entityType: AuditEntityType.file,
            entityId: attachment.id,
            projectId,
            userId: user.id,
            action: AuditAction.file_uploaded,
            description: `Subió documento UTE firmado '${saved.filename}'`,
          });
        }

        if (created.length === 0) {
          throw badRequest("FILE_REQUIRED", "Debés adjuntar al menos un archivo");
        }

        reply.code(201);
        return { firmados: created };
      },
    );

    app.get(
      "/projects/:projectId/ute-docs/firmados",
      { preHandler: authorize(Module.OPERACIONES, Action.VIEW) },
      async (request) => {
        const { projectId } = z.object({ projectId: z.string().min(1) }).parse(request.params);
        await findProjectOrThrow(projectId);

        const files = await prisma.fileAttachment.findMany({
          where: { projectId, toolSource: "ute-docs-firmados", deletedAt: null },
          orderBy: { createdAt: "desc" },
          include: { uploadedBy: { select: { id: true, name: true } } },
        });

        return { firmados: files.map(mapFirmado) };
      },
    );

    app.delete(
      "/projects/:projectId/ute-docs/firmados/:fileId",
      { preHandler: authorize(Module.OPERACIONES, Action.VIEW) },
      async (request, reply) => {
        const user = ensureUser(request);
        const { projectId, fileId } = z
          .object({ projectId: z.string().min(1), fileId: z.string().min(1) })
          .parse(request.params);

        const file = await prisma.fileAttachment.findFirst({
          where: { id: fileId, projectId, toolSource: "ute-docs-firmados", deletedAt: null },
        });
        if (!file) throw notFound("FILE_NOT_FOUND", "Documento firmado no encontrado");

        if (file.uploadedById !== user.id && user.role !== "ADMIN") {
          throw new AppError(403, "FORBIDDEN", "Solo quien lo subió o un administrador puede eliminarlo");
        }

        await prisma.fileAttachment.update({
          where: { id: file.id },
          data: { deletedAt: new Date() },
        });
        await deleteStoredFile(file.url);

        await createAuditEntry({
          entityType: AuditEntityType.file,
          entityId: file.id,
          projectId,
          userId: user.id,
          action: AuditAction.deleted,
          description: `Eliminó documento UTE firmado '${file.filename}'`,
        });

        return reply.code(204).send();
      },
    );

    // ─── Extracción de datos del cliente con IA (cédula / factura UTE) ──────
    // El cliente sube un archivo (multipart). El server lo guarda en
    // storage/projects/{id}/ute-docs/, lo manda a Claude Haiku para extraer
    // los datos, y devuelve el JSON al cliente. El cliente valida los datos
    // en un modal y los persiste vía PATCH /projects/:id si confirma.
    const UTE_EXTRACT_ALLOWED_MIME = ["image/jpeg", "image/png", "application/pdf"] as const;
    const UTE_EXTRACT_MAX_SIZE = 10 * 1024 * 1024; // 10MB
    app.post(
      "/projects/:projectId/ute-extract",
      { preHandler: authorize(Module.OPERACIONES, Action.EDIT) },
      async (request, reply) => {
        const user = ensureUser(request);
        const { projectId } = z.object({ projectId: z.string().min(1) }).parse(request.params);
        const { tipo } = z
          .object({ tipo: z.enum(["cedula", "factura_ute"]) })
          .parse(request.query);

        const project = await prisma.project.findFirst({
          where: { id: projectId, deletedAt: null },
        });
        if (!project) throw notFound("PROJECT_NOT_FOUND", "Proyecto no encontrado");

        const filePart = await request.file();
        if (!filePart) {
          throw badRequest("NO_FILE", "No se recibió ningún archivo en el campo 'file'");
        }
        const mime = filePart.mimetype;
        if (!UTE_EXTRACT_ALLOWED_MIME.includes(mime as (typeof UTE_EXTRACT_ALLOWED_MIME)[number])) {
          throw badRequest(
            "FILE_TYPE_INVALID",
            `Formato no soportado (${mime}). Usá JPG, PNG o PDF.`,
          );
        }

        // Drenar el stream a Buffer con límite explícito (multipart está
        // configurado con 10MB global, pero hacemos guard aparte para mensaje claro).
        const chunks: Buffer[] = [];
        let total = 0;
        for await (const chunk of filePart.file) {
          total += chunk.length;
          if (total > UTE_EXTRACT_MAX_SIZE) {
            throw badRequest("FILE_TOO_LARGE", "El archivo supera los 10MB permitidos.");
          }
          chunks.push(Buffer.from(chunk));
        }
        const fileBuffer = Buffer.concat(chunks);

        // Guardar en storage/projects/{id}/ute-docs/{tipo}.{ext}. Sobrescribe
        // si ya existía. Mismo path resolution que file-storage.service.ts.
        const ext = mime === "application/pdf" ? "pdf" : mime === "image/png" ? "png" : "jpg";
        const fileName = `${tipo}.${ext}`;
        const relativePath = path.join("projects", projectId, "ute-docs", fileName);
        const absolutePath = path.resolve(process.cwd(), "..", env.storagePath, relativePath);
        await fsPromises.mkdir(path.dirname(absolutePath), { recursive: true });
        await fsPromises.writeFile(absolutePath, fileBuffer);

        // Persistir la ruta en Project.{cedulaPath|facturaUtePath}.
        const pathField = tipo === "cedula" ? "cedulaPath" : "facturaUtePath";
        await prisma.project.update({
          where: { id: projectId },
          data: { [pathField]: relativePath },
        });

        // Llamar a Claude para extraer.
        let extracted;
        try {
          extracted = await extractFromDocument({
            fileBuffer,
            mimeType: mime,
            tipo: tipo as "cedula" | "factura_ute",
          });
        } catch (err) {
          throw badRequest(
            "AI_EXTRACTION_FAILED",
            `No se pudieron extraer datos del documento: ${(err as Error).message}`,
          );
        }

        await createAuditEntry({
          entityType: AuditEntityType.project,
          entityId: projectId,
          projectId,
          userId: user.id,
          action: AuditAction.created,
          description: `Extrajo datos de ${tipo === "cedula" ? "cédula" : "factura UTE"} con IA`,
          metadata: {
            kind: "ute_extract",
            tipo,
            archivo: relativePath,
            tokensInput: extracted.tokensInput,
            tokensOutput: extracted.tokensOutput,
          },
        });

        return {
          extraido: extracted.data,
          archivo_guardado: relativePath,
          tipo,
        };
      },
    );

    // DELETE: borra el archivo guardado (cédula o factura UTE) del storage
    // y limpia la ruta en Project. NO toca los datos del cliente que el
    // usuario haya confirmado en el modal (ciCliente, calle, etc.) — esos
    // viven en el proyecto y se editan/borran desde el detalle si hace falta.
    app.delete(
      "/projects/:projectId/ute-extract",
      { preHandler: authorize(Module.OPERACIONES, Action.EDIT) },
      async (request, reply) => {
        const user = ensureUser(request);
        const { projectId } = z.object({ projectId: z.string().min(1) }).parse(request.params);
        const { tipo } = z
          .object({ tipo: z.enum(["cedula", "factura_ute"]) })
          .parse(request.query);
        const project = await prisma.project.findFirst({
          where: { id: projectId, deletedAt: null },
        });
        if (!project) throw notFound("PROJECT_NOT_FOUND", "Proyecto no encontrado");
        const pathField = tipo === "cedula" ? "cedulaPath" : "facturaUtePath";
        const currentPath = project[pathField];
        if (currentPath) {
          // Best-effort: si el unlink falla (archivo ya no existe en disco),
          // igual limpiamos la ruta en DB.
          try {
            const absolutePath = path.resolve(process.cwd(), "..", env.storagePath, currentPath);
            await fsPromises.unlink(absolutePath);
          } catch {
            // ignore
          }
        }
        await prisma.project.update({
          where: { id: projectId },
          data: { [pathField]: null },
        });
        await createAuditEntry({
          entityType: AuditEntityType.project,
          entityId: projectId,
          projectId,
          userId: user.id,
          action: AuditAction.deleted,
          description: `Eliminó archivo ${tipo === "cedula" ? "cédula" : "factura UTE"}`,
          metadata: { kind: "ute_extract_delete", tipo, archivo: currentPath },
        });
        reply.code(204);
      },
    );

    // ─── Estado de resultado mensual (P&L) ──────────────────────────────────
    //
    // Estructura contable simple basada en CAJA REAL del mes:
    //   INGRESOS BRUTOS   = INGRESOS cobrados (excl AJUSTE_CONCILIACION)
    //   COSTOS DIRECTOS   = GASTOS PAGADOS sin Payment app + Payments del mes
    //                       (categorías SALIDA_PROYECTO/PAGO_PROVEEDOR/COMPRA_STOCK
    //                        + Payments siempre como PAGO_PROVEEDOR)
    //   MARGEN BRUTO      = INGRESOS - COSTOS DIRECTOS
    //   GASTOS OPERATIVOS = GASTOS PAGADOS sin Payment app, categorías que NO
    //                       son directas ni AJUSTE_CONCILIACION
    //   RESULTADO NETO    = MARGEN BRUTO - GASTOS OPERATIVOS
    //
    // Las cifras se devuelven en USD usando el TC del movimiento o, en su
    // defecto, el último TC global.
    const CATEGORIAS_DIRECTAS_PNL: CategoriaPrincipal[] = [
      CategoriaPrincipal.PROYECTO_SALIDA,
      CategoriaPrincipal.PAGO_PROVEEDOR,
      CategoriaPrincipal.COMPRA_STOCK,
    ];

    type PnLMovement = {
      id: string;
      _type: "MOVEMENT" | "PAYMENT";
      fecha: string;
      descripcion: string;
      monto: number;
      moneda: Moneda;
      montoUSD: number;
      projectId: string | null;
      projectName: string | null;
      supplierId: string | null;
      supplierName: string | null;
      accountName: string | null;
    };
    type CategoriaSummary = {
      categoria: string;
      total: number;
      cantidadMovimientos: number;
      movimientos: PnLMovement[];
    };

    function groupByCategoria(rows: { categoriaPrincipal: CategoriaPrincipal; montoUsd: number; mov: PnLMovement }[]): CategoriaSummary[] {
      const map = new Map<string, { total: number; movs: PnLMovement[] }>();
      for (const r of rows) {
        const cur = map.get(r.categoriaPrincipal) ?? { total: 0, movs: [] };
        cur.total += r.montoUsd;
        cur.movs.push(r.mov);
        map.set(r.categoriaPrincipal, cur);
      }
      return Array.from(map.entries())
        .map(([categoria, { total, movs }]) => ({
          categoria,
          total: roundMoney(total),
          cantidadMovimientos: movs.length,
          movimientos: movs.sort((a, b) => (a.fecha < b.fecha ? -1 : a.fecha > b.fecha ? 1 : 0)),
        }))
        .sort((a, b) => b.total - a.total);
    }

    async function calculateIncomeStatement(mes: number, anio: number) {
      const fechaInicio = new Date(Date.UTC(anio, mes - 1, 1));
      const fechaFin = new Date(Date.UTC(anio, mes, 1));

      const lastRate = await prisma.exchangeRate.findFirst({ orderBy: { createdAt: "desc" } });
      const fallback = lastRate ? (decimalToNumber(lastRate.usdToUyu) ?? 1) : 1;

      // Inclusión de detalle (project/supplier/account) para que la respuesta
      // pueda mostrar la lista de movimientos al expandir cada categoría.
      const movInclude = {
        project: { select: { id: true, clientName: true, code: true } },
        supplier: { select: { id: true, nombre: true } },
        account: { select: { id: true, nombre: true } },
      } as const;

      function movToPnL(m: {
        id: string;
        fecha: Date;
        descripcion: string;
        monto: import("@prisma/client/runtime/library").Decimal;
        moneda: Moneda;
        tipoCambio: import("@prisma/client/runtime/library").Decimal | null;
        projectId: string | null;
        supplierId: string | null;
        accountId: string | null;
        project: { id: string; clientName: string; code: string } | null;
        supplier: { id: string; nombre: string } | null;
        account: { id: string; nombre: string } | null;
      }, montoUsd: number): PnLMovement {
        return {
          id: m.id,
          _type: "MOVEMENT",
          fecha: serializeDateOnly(m.fecha),
          descripcion: m.descripcion,
          monto: decimalToNumber(m.monto) ?? 0,
          moneda: m.moneda,
          montoUSD: roundMoney(montoUsd),
          projectId: m.projectId,
          projectName: m.project?.clientName ?? null,
          supplierId: m.supplierId,
          supplierName: m.supplier?.nombre ?? null,
          accountName: m.account?.nombre ?? null,
        };
      }

      // INGRESOS cobrados del mes (excluye AJUSTE_CONCILIACION).
      const ingresos = await prisma.financeMovement.findMany({
        where: {
          deletedAt: null,
          tipoMovimiento: TipoMovimiento.INGRESO,
          cobrado: true,
          fecha: { gte: fechaInicio, lt: fechaFin },
          categoriaPrincipal: { not: CategoriaPrincipal.AJUSTE_CONCILIACION },
        },
        include: movInclude,
      });
      const ingresosRows = ingresos.map((m) => {
        const usd = convertMovementToUsd(m, fallback);
        return { categoriaPrincipal: m.categoriaPrincipal, montoUsd: usd, mov: movToPnL(m, usd) };
      });
      const ingresosBrutos = roundMoney(ingresosRows.reduce((s, r) => s + r.montoUsd, 0));

      // GASTOS PAGADOS del mes sin Payment app (sin doble conteo) +
      // categorías directas.
      const gastosDirectos = await prisma.financeMovement.findMany({
        where: {
          deletedAt: null,
          tipoMovimiento: TipoMovimiento.GASTO,
          pagado: true,
          fecha: { gte: fechaInicio, lt: fechaFin },
          categoriaPrincipal: { in: CATEGORIAS_DIRECTAS_PNL },
          paymentApplications: { none: { payment: { deletedAt: null } } },
        },
        include: movInclude,
      });
      const gastosDirectosRows = gastosDirectos.map((m) => {
        const usd = convertMovementToUsd(m, fallback);
        return { categoriaPrincipal: m.categoriaPrincipal, montoUsd: usd, mov: movToPnL(m, usd) };
      });

      // Payments del mes (siempre cuentan como costo directo / PAGO_PROVEEDOR).
      const payments = await prisma.payment.findMany({
        where: { deletedAt: null, fecha: { gte: fechaInicio, lt: fechaFin } },
        include: {
          supplier: { select: { id: true, nombre: true } },
          account: { select: { id: true, nombre: true } },
        },
      });
      const paymentsRows = payments.map((p) => {
        const monto = decimalToNumber(p.monto) ?? 0;
        const usd = p.moneda === Moneda.USD ? monto : (fallback > 0 ? monto / fallback : monto);
        const mov: PnLMovement = {
          id: p.id,
          _type: "PAYMENT",
          fecha: serializeDateOnly(p.fecha),
          descripcion: `Pago a ${p.supplier?.nombre ?? "proveedor"}${p.referencia ? ` · ${p.referencia}` : ""}`,
          monto,
          moneda: p.moneda,
          montoUSD: roundMoney(usd),
          projectId: null,
          projectName: null,
          supplierId: p.supplierId,
          supplierName: p.supplier?.nombre ?? null,
          accountName: p.account?.nombre ?? null,
        };
        return { categoriaPrincipal: CategoriaPrincipal.PAGO_PROVEEDOR, montoUsd: usd, mov };
      });

      const directosTotal = roundMoney(
        gastosDirectosRows.reduce((s, r) => s + r.montoUsd, 0) +
          paymentsRows.reduce((s, r) => s + r.montoUsd, 0),
      );
      const directosCategorias = groupByCategoria([...gastosDirectosRows, ...paymentsRows]);

      // GASTOS PAGADOS del mes sin Payment app, categorías NO directas (operativos).
      const gastosOperativos = await prisma.financeMovement.findMany({
        where: {
          deletedAt: null,
          tipoMovimiento: TipoMovimiento.GASTO,
          pagado: true,
          fecha: { gte: fechaInicio, lt: fechaFin },
          categoriaPrincipal: {
            notIn: [...CATEGORIAS_DIRECTAS_PNL, CategoriaPrincipal.AJUSTE_CONCILIACION],
          },
          paymentApplications: { none: { payment: { deletedAt: null } } },
        },
        include: movInclude,
      });
      const operativosRows = gastosOperativos.map((m) => {
        const usd = convertMovementToUsd(m, fallback);
        return { categoriaPrincipal: m.categoriaPrincipal, montoUsd: usd, mov: movToPnL(m, usd) };
      });
      const operativosTotal = roundMoney(operativosRows.reduce((s, r) => s + r.montoUsd, 0));

      const margenBruto = roundMoney(ingresosBrutos - directosTotal);
      const resultadoNeto = roundMoney(margenBruto - operativosTotal);

      const totalPagosUsd = roundMoney(paymentsRows.reduce((s, r) => s + r.montoUsd, 0));

      return {
        periodo: {
          mes,
          anio,
          fechaInicio: serializeDateOnly(fechaInicio),
          fechaFin: serializeDateOnly(new Date(fechaFin.getTime() - 24 * 60 * 60 * 1000)),
        },
        ingresosBrutos: {
          total: ingresosBrutos,
          detalleCategorias: groupByCategoria(ingresosRows),
        },
        costosDirectos: {
          total: directosTotal,
          detalleCategorias: directosCategorias,
        },
        margenBruto: {
          valor: margenBruto,
          porcentaje: ingresosBrutos > 0 ? roundMoney((margenBruto / ingresosBrutos) * 100) : 0,
        },
        gastosOperativos: {
          total: operativosTotal,
          detalleCategorias: groupByCategoria(operativosRows),
        },
        resultadoNeto: {
          valor: resultadoNeto,
          porcentaje: ingresosBrutos > 0 ? roundMoney((resultadoNeto / ingresosBrutos) * 100) : 0,
        },
        pagosProveedor: {
          total: totalPagosUsd,
          cantidad: payments.length,
        },
        tipoCambio: fallback,
      };
    }

    app.get("/finance/income-statement", { preHandler: authorize(Module.FINANZAS, Action.VIEW) }, async (request) => {
      const query = z.object({
        mes: z.coerce.number().int().min(1).max(12),
        anio: z.coerce.number().int(),
      }).parse(request.query);
      return calculateIncomeStatement(query.mes, query.anio);
    });

    app.get("/finance/income-statement/yearly", { preHandler: authorize(Module.FINANZAS, Action.VIEW) }, async (request) => {
      const query = z.object({ anio: z.coerce.number().int() }).parse(request.query);
      const meses: Array<{ mes: number; ingresos: number; costosDirectos: number; margenBruto: number; gastosOperativos: number; resultadoNeto: number }> = [];
      let totalIngresos = 0;
      let totalDirectos = 0;
      let totalMargen = 0;
      let totalOperativos = 0;
      let totalResultado = 0;
      for (let m = 1; m <= 12; m++) {
        const r = await calculateIncomeStatement(m, query.anio);
        meses.push({
          mes: m,
          ingresos: r.ingresosBrutos.total,
          costosDirectos: r.costosDirectos.total,
          margenBruto: r.margenBruto.valor,
          gastosOperativos: r.gastosOperativos.total,
          resultadoNeto: r.resultadoNeto.valor,
        });
        totalIngresos += r.ingresosBrutos.total;
        totalDirectos += r.costosDirectos.total;
        totalMargen += r.margenBruto.valor;
        totalOperativos += r.gastosOperativos.total;
        totalResultado += r.resultadoNeto.valor;
      }
      return {
        anio: query.anio,
        meses,
        totales: {
          ingresos: roundMoney(totalIngresos),
          costosDirectos: roundMoney(totalDirectos),
          margenBruto: roundMoney(totalMargen),
          gastosOperativos: roundMoney(totalOperativos),
          resultadoNeto: roundMoney(totalResultado),
        },
      };
    });

    // Vista anual con desglose por categoría mes a mes (planilla P&L).
    // Una sola query por año, agrupación en memoria (más eficiente que llamar
    // 12 veces a calculateIncomeStatement).
    app.get("/finance/income-statement/yearly-breakdown", { preHandler: authorize(Module.FINANZAS, Action.VIEW) }, async (request) => {
      const query = z.object({ anio: z.coerce.number().int() }).parse(request.query);
      const anio = query.anio;
      const fechaInicio = new Date(Date.UTC(anio, 0, 1));
      const fechaFin = new Date(Date.UTC(anio + 1, 0, 1));

      const lastRate = await prisma.exchangeRate.findFirst({ orderBy: { createdAt: "desc" } });
      const fallback = lastRate ? (decimalToNumber(lastRate.usdToUyu) ?? 1) : 1;

      const [movements, payments] = await prisma.$transaction([
        prisma.financeMovement.findMany({
          where: {
            deletedAt: null,
            fecha: { gte: fechaInicio, lt: fechaFin },
            categoriaPrincipal: { not: CategoriaPrincipal.AJUSTE_CONCILIACION },
            OR: [
              { tipoMovimiento: TipoMovimiento.INGRESO, cobrado: true },
              { tipoMovimiento: TipoMovimiento.GASTO, pagado: true },
            ],
          },
          include: {
            paymentApplications: {
              select: { id: true, payment: { select: { deletedAt: true } } },
              where: { payment: { deletedAt: null } },
            },
          },
        }),
        prisma.payment.findMany({
          where: { deletedAt: null, fecha: { gte: fechaInicio, lt: fechaFin } },
        }),
      ]);

      // Buckets: porSeccion → porCategoria → meses[12].
      type Bucket = Map<string, number[]>;
      const ingresosBucket: Bucket = new Map();
      const directosBucket: Bucket = new Map();
      const operativosBucket: Bucket = new Map();

      function add(bucket: Bucket, categoria: string, mesIdx: number, montoUsd: number) {
        const arr = bucket.get(categoria) ?? new Array<number>(12).fill(0);
        arr[mesIdx] += montoUsd;
        bucket.set(categoria, arr);
      }

      for (const m of movements) {
        const mesIdx = m.fecha.getUTCMonth(); // 0-11
        const usd = convertMovementToUsd(m, fallback);

        if (m.tipoMovimiento === TipoMovimiento.INGRESO) {
          add(ingresosBucket, m.categoriaPrincipal, mesIdx, usd);
        } else if (m.tipoMovimiento === TipoMovimiento.GASTO) {
          // Anti-doble-conteo: si tiene Payment app activa, lo cuenta el Payment.
          const tieneApp = m.paymentApplications.length > 0;
          if (tieneApp) continue;
          if (CATEGORIAS_DIRECTAS_PNL.includes(m.categoriaPrincipal)) {
            add(directosBucket, m.categoriaPrincipal, mesIdx, usd);
          } else {
            add(operativosBucket, m.categoriaPrincipal, mesIdx, usd);
          }
        }
      }

      // Payments siempre como costo directo (PAGO_PROVEEDOR).
      for (const p of payments) {
        const mesIdx = p.fecha.getUTCMonth();
        const monto = decimalToNumber(p.monto) ?? 0;
        const usd = p.moneda === Moneda.USD ? monto : (fallback > 0 ? monto / fallback : monto);
        add(directosBucket, CategoriaPrincipal.PAGO_PROVEEDOR, mesIdx, usd);
      }

      function bucketToSection(bucket: Bucket) {
        const porCategoria = Array.from(bucket.entries())
          .map(([categoria, meses]) => {
            const mesesRound = meses.map((v) => roundMoney(v));
            const total = roundMoney(mesesRound.reduce((s, v) => s + v, 0));
            return { categoria, label: categoria, meses: mesesRound, total };
          })
          .filter((c) => c.total > 0.005)
          .sort((a, b) => b.total - a.total);
        const totalMensual = new Array<number>(12).fill(0);
        for (const c of porCategoria) {
          for (let i = 0; i < 12; i++) totalMensual[i] += c.meses[i];
        }
        const totalMensualRound = totalMensual.map((v) => roundMoney(v));
        const totalAnio = roundMoney(totalMensualRound.reduce((s, v) => s + v, 0));
        return { porCategoria, totalMensual: totalMensualRound, totalAnio };
      }

      const ingresos = bucketToSection(ingresosBucket);
      const costosDirectos = bucketToSection(directosBucket);
      const gastosOperativos = bucketToSection(operativosBucket);

      const margenMeses = ingresos.totalMensual.map((ing, i) =>
        roundMoney(ing - costosDirectos.totalMensual[i]),
      );
      const margenTotal = roundMoney(margenMeses.reduce((s, v) => s + v, 0));

      const resultadoMeses = margenMeses.map((mb, i) =>
        roundMoney(mb - gastosOperativos.totalMensual[i]),
      );
      const resultadoTotal = roundMoney(resultadoMeses.reduce((s, v) => s + v, 0));

      return {
        anio,
        ingresos,
        costosDirectos,
        margenBruto: { meses: margenMeses, totalAnio: margenTotal },
        gastosOperativos,
        resultadoNeto: { meses: resultadoMeses, totalAnio: resultadoTotal },
      };
    });

    app.get("/accounts", { preHandler: authorize(Module.FINANZAS, Action.VIEW) }, async (request) => {
      const query = z.object({
        activa: z.enum(["true", "false", "all"]).optional(),
        tipo: z.nativeEnum(AccountType).optional(),
        moneda: z.nativeEnum(Moneda).optional(),
      }).parse(request.query);

      const where: Prisma.AccountWhereInput = { deletedAt: null };
      if (query.activa !== "all") where.activa = query.activa === "false" ? false : true;
      if (query.tipo) where.tipo = query.tipo;
      if (query.moneda) where.moneda = query.moneda;

      const accounts = await prisma.account.findMany({
        where,
        include: { _count: { select: { movements: true, payments: true } } },
        orderBy: [{ activa: "desc" }, { nombre: "asc" }],
      });
      return accounts.map(serializeAccount);
    });

    app.get("/accounts/:id", { preHandler: authorize(Module.FINANZAS, Action.VIEW) }, async (request) => {
      const { id } = z.object({ id: z.string() }).parse(request.params);
      const account = await prisma.account.findFirst({
        where: { id, deletedAt: null },
        include: { _count: { select: { movements: true, payments: true } } },
      });
      if (!account) throw notFound("ACCOUNT_NOT_FOUND", "Cuenta no encontrada");
      const balance = await computeAccountBalance(id);
      return { ...serializeAccount(account), balance };
    });

    app.get("/accounts/:id/balance", { preHandler: authorize(Module.FINANZAS, Action.VIEW) }, async (request) => {
      const { id } = z.object({ id: z.string() }).parse(request.params);
      return computeAccountBalance(id);
    });

    app.get("/accounts/summary", { preHandler: authorize(Module.FINANZAS, Action.VIEW) }, async () => {
      const accounts = await prisma.account.findMany({
        where: { deletedAt: null, activa: true },
        orderBy: { nombre: "asc" },
      });

      const lastRate = await prisma.exchangeRate.findFirst({ orderBy: { createdAt: "desc" } });
      const fallbackRate = lastRate ? (decimalToNumber(lastRate.usdToUyu) ?? 1) : 1;

      const porCuenta = await Promise.all(
        accounts.map(async (a) => {
          const balance = await computeAccountBalance(a.id);
          return {
            id: a.id,
            nombre: a.nombre,
            tipo: a.tipo,
            moneda: a.moneda,
            saldoActual: balance.saldoActual,
          };
        }),
      );

      let totalUSD = 0;
      let totalUYU = 0;
      for (const p of porCuenta) {
        if (p.moneda === Moneda.USD) totalUSD += p.saldoActual;
        else totalUYU += p.saldoActual;
      }
      const totalUnificadoUSD = Math.round((totalUSD + (fallbackRate > 0 ? totalUYU / fallbackRate : 0)) * 100) / 100;

      return {
        porCuenta,
        totalesPorMoneda: { USD: Math.round(totalUSD * 100) / 100, UYU: Math.round(totalUYU * 100) / 100 },
        totalUnificadoUSD,
        exchangeRate: lastRate ? { usdToUyu: fallbackRate, date: serializeDate(lastRate.date) } : null,
      };
    });

    app.post("/accounts", { preHandler: authorize(Module.CONFIGURACION, Action.CREATE) }, async (request) => {
      const user = ensureUser(request);
      const body = accountCreateSchema.parse(request.body);
      const account = await prisma.account.create({
        data: {
          nombre: body.nombre,
          tipo: body.tipo,
          moneda: body.moneda,
          saldoInicial: new Prisma.Decimal(body.saldoInicial),
          fechaSaldoInicial: body.fechaSaldoInicial ? parseDateOnly(body.fechaSaldoInicial) : null,
          notas: body.notas,
        },
      });
      await createAuditEntry({
        entityType: AuditEntityType.account,
        entityId: account.id,
        userId: user.id,
        action: AuditAction.created,
        description: `Creó cuenta ${account.nombre} (${account.tipo} ${account.moneda})`,
      });
      return serializeAccount(account);
    });

    app.patch("/accounts/:id", { preHandler: authorize(Module.CONFIGURACION, Action.EDIT) }, async (request) => {
      const user = ensureUser(request);
      const { id } = z.object({ id: z.string() }).parse(request.params);
      const body = accountPatchSchema.parse(request.body);
      const existing = await prisma.account.findFirst({ where: { id, deletedAt: null } });
      if (!existing) throw notFound("ACCOUNT_NOT_FOUND", "Cuenta no encontrada");

      const data: Prisma.AccountUpdateInput = {};
      if (body.nombre != null) data.nombre = body.nombre;
      if (body.tipo) data.tipo = body.tipo;
      if (body.moneda) data.moneda = body.moneda;
      if (body.saldoInicial != null) data.saldoInicial = new Prisma.Decimal(body.saldoInicial);
      if (body.fechaSaldoInicial !== undefined) {
        data.fechaSaldoInicial = body.fechaSaldoInicial ? parseDateOnly(body.fechaSaldoInicial) : null;
      }
      if (body.notas !== undefined) data.notas = body.notas;
      if (body.activa != null) data.activa = body.activa;

      const updated = await prisma.account.update({ where: { id }, data });
      await createAuditEntry({
        entityType: AuditEntityType.account,
        entityId: id,
        userId: user.id,
        action: AuditAction.updated,
        description: `Actualizó cuenta ${existing.nombre}`,
      });
      // Si cambió saldoInicial o fechaSaldoInicial, el saldo de cuenta cambió:
      // verificar invariante.
      if (body.saldoInicial != null || body.fechaSaldoInicial !== undefined) {
        void checkInvariantOrWarn("patch account (saldo/fecha)", { accountId: id });
      }
      return serializeAccount(updated);
    });

    app.delete("/accounts/:id", { preHandler: authorize(Module.CONFIGURACION, Action.DELETE) }, async (request) => {
      const user = ensureUser(request);
      const { id } = z.object({ id: z.string() }).parse(request.params);
      const existing = await prisma.account.findFirst({
        where: { id, deletedAt: null },
        include: { _count: { select: { movements: true, payments: true } } },
      });
      if (!existing) throw notFound("ACCOUNT_NOT_FOUND", "Cuenta no encontrada");
      if (existing._count.movements > 0 || existing._count.payments > 0) {
        throw badRequest(
          "ACCOUNT_HAS_MOVEMENTS",
          `No se puede eliminar: la cuenta tiene ${existing._count.movements} movimiento(s) y ${existing._count.payments} pago(s) asociado(s). Desactivala en lugar de borrarla.`,
        );
      }
      await prisma.account.update({ where: { id }, data: { deletedAt: new Date(), activa: false } });
      await createAuditEntry({
        entityType: AuditEntityType.account,
        entityId: id,
        userId: user.id,
        action: AuditAction.deleted,
        description: `Eliminó cuenta ${existing.nombre}`,
      });
      return { success: true };
    });

    // ─── G.10: Conciliación bancaria ──────────────────────────────────────────

    // Importante: registrar la ruta estática ANTES que las parametrizadas, para
    // que Fastify no interprete "reconciliation-alerts" como un :id de cuenta.
    app.get("/accounts/reconciliation-alerts", { preHandler: authorize(Module.FINANZAS, Action.VIEW) }, async () => {
      const accounts = await prisma.account.findMany({
        where: { deletedAt: null, activa: true },
        select: {
          id: true,
          nombre: true,
          moneda: true,
          tipo: true,
          reconciliations: {
            orderBy: { fecha: "desc" },
            take: 1,
            select: { id: true, fecha: true },
          },
        },
        orderBy: { nombre: "asc" },
      });
      const todayMs = todayUtc().getTime();
      let totalAlertas = 0;
      const out = accounts.map((a) => {
        const last = a.reconciliations[0] ?? null;
        const dias = last ? Math.floor((todayMs - last.fecha.getTime()) / 86400000) : null;
        const necesita = dias === null || dias > 30;
        if (necesita) totalAlertas++;
        return {
          accountId: a.id,
          nombre: a.nombre,
          moneda: a.moneda,
          tipo: a.tipo,
          ultimaConciliacionId: last?.id ?? null,
          ultimaConciliacion: last ? serializeDateOnly(last.fecha) : null,
          diasDesdeUltimaConciliacion: dias,
          necesitaConciliacion: necesita,
        };
      });
      return { totalAlertas, accounts: out };
    });

    app.get("/accounts/:id/reconciliation-preview", { preHandler: authorize(Module.FINANZAS, Action.VIEW) }, async (request) => {
      const { id } = z.object({ id: z.string() }).parse(request.params);
      const { saldoReal: saldoRealStr } = z.object({ saldoReal: z.string() }).parse(request.query);
      const saldoReal = Number.parseFloat(saldoRealStr);
      if (!Number.isFinite(saldoReal)) throw badRequest("INVALID_SALDO", "saldoReal debe ser numérico");

      const account = await prisma.account.findFirst({
        where: { id, deletedAt: null },
        select: { id: true, nombre: true, moneda: true },
      });
      if (!account) throw notFound("ACCOUNT_NOT_FOUND", "Cuenta no encontrada");

      const balance = await computeAccountBalance(id);
      const saldoCalculado = balance.saldoActual;
      const diferencia = roundMoney(saldoReal - saldoCalculado);
      const requiereAjuste = Math.abs(diferencia) > 0.01;

      return {
        accountId: account.id,
        accountName: account.nombre,
        moneda: account.moneda,
        saldoCalculado,
        saldoReal: roundMoney(saldoReal),
        diferencia,
        requiereAjuste,
        ajusteSugerido: requiereAjuste
          ? {
              tipo: diferencia > 0 ? TipoMovimiento.INGRESO : TipoMovimiento.GASTO,
              monto: Math.abs(diferencia),
              descripcion: `Ajuste conciliación ${account.nombre}`,
            }
          : null,
      };
    });

    app.post("/accounts/:id/reconcile", { preHandler: authorize(Module.FINANZAS, Action.EDIT) }, async (request) => {
      const user = ensureUser(request);
      const { id } = z.object({ id: z.string() }).parse(request.params);
      // v4.4: lógica simplificada — el banco siempre dice la verdad. Si hay
      // diferencia, actualizamos saldoInicial=saldoReal y fechaSaldoInicial=fecha,
      // y NO creamos movimiento de ajuste (la AccountReconciliation queda como
      // único registro del evento). Movimientos previos quedan como histórico.
      const body = z.object({
        fecha: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
        saldoReal: z.coerce.number(),
        notas: z.string().nullable().optional(),
      }).strict().parse(request.body);

      const account = await prisma.account.findFirst({ where: { id, deletedAt: null } });
      if (!account) throw notFound("ACCOUNT_NOT_FOUND", "Cuenta no encontrada");

      const balance = await computeAccountBalance(id);
      const saldoCalculado = balance.saldoActual;
      const diferencia = roundMoney(body.saldoReal - saldoCalculado);
      const fecha = parseDateOnly(body.fecha);

      const reconciliation = await prisma.$transaction(async (tx) => {
        if (Math.abs(diferencia) > 0.01) {
          await tx.account.update({
            where: { id },
            data: {
              saldoInicial: new Prisma.Decimal(body.saldoReal),
              fechaSaldoInicial: fecha,
            },
          });
        }

        return tx.accountReconciliation.create({
          data: {
            accountId: id,
            fecha,
            saldoReal: new Prisma.Decimal(body.saldoReal),
            saldoCalculado: new Prisma.Decimal(saldoCalculado),
            diferencia: new Prisma.Decimal(diferencia),
            ajusteMovementId: null, // v4.4: nunca se crean ajuste-movimientos
            notas: body.notas ?? null,
            createdById: user.id,
          },
          include: {
            ajusteMovement: { select: { id: true, descripcion: true, monto: true, tipoMovimiento: true } },
          },
        });
      });

      await createAuditEntry({
        entityType: AuditEntityType.account,
        entityId: id,
        userId: user.id,
        action: AuditAction.created,
        description: Math.abs(diferencia) > 0.01
          ? `Conciliación ${account.nombre}: real=${body.saldoReal.toFixed(2)}, calculado=${saldoCalculado.toFixed(2)}, diferencia=${diferencia.toFixed(2)}. Saldo de cuenta actualizado.`
          : `Conciliación ${account.nombre} sin diferencia. Saldo confirmado: ${body.saldoReal.toFixed(2)}.`,
        metadata: { reconciliationId: reconciliation.id, saldoActualizado: Math.abs(diferencia) > 0.01 },
      });

      void checkInvariantOrWarn("reconcile account", { accountId: id, reconciliationId: reconciliation.id });
      return {
        id: reconciliation.id,
        accountId: reconciliation.accountId,
        fecha: serializeDateOnly(reconciliation.fecha),
        saldoReal: Number(reconciliation.saldoReal),
        saldoCalculado: Number(reconciliation.saldoCalculado),
        diferencia: Number(reconciliation.diferencia),
        ajusteMovementId: reconciliation.ajusteMovementId,
        ajusteMovement: reconciliation.ajusteMovement
          ? {
              id: reconciliation.ajusteMovement.id,
              descripcion: reconciliation.ajusteMovement.descripcion,
              monto: Number(reconciliation.ajusteMovement.monto),
              tipoMovimiento: reconciliation.ajusteMovement.tipoMovimiento,
            }
          : null,
        notas: reconciliation.notas,
        createdAt: serializeDate(reconciliation.createdAt),
      };
    });

    app.get("/accounts/:id/reconciliations", { preHandler: authorize(Module.FINANZAS, Action.VIEW) }, async (request) => {
      const { id } = z.object({ id: z.string() }).parse(request.params);
      const account = await prisma.account.findFirst({ where: { id, deletedAt: null }, select: { id: true } });
      if (!account) throw notFound("ACCOUNT_NOT_FOUND", "Cuenta no encontrada");

      const items = await prisma.accountReconciliation.findMany({
        where: { accountId: id },
        orderBy: { fecha: "desc" },
        include: {
          ajusteMovement: { select: { id: true, descripcion: true, monto: true, tipoMovimiento: true } },
          createdBy: { select: { id: true, name: true } },
        },
      });

      return items.map((r) => ({
        id: r.id,
        fecha: serializeDateOnly(r.fecha),
        saldoReal: Number(r.saldoReal),
        saldoCalculado: Number(r.saldoCalculado),
        diferencia: Number(r.diferencia),
        ajusteMovementId: r.ajusteMovementId,
        ajusteMovement: r.ajusteMovement
          ? {
              id: r.ajusteMovement.id,
              descripcion: r.ajusteMovement.descripcion,
              monto: Number(r.ajusteMovement.monto),
              tipoMovimiento: r.ajusteMovement.tipoMovimiento,
            }
          : null,
        notas: r.notas,
        createdBy: { id: r.createdBy.id, name: r.createdBy.name },
        createdAt: serializeDate(r.createdAt),
      }));
    });

    function isMovementConcreted(row: {
      tipoMovimiento: TipoMovimiento;
      status: FinanceMovementStatus;
      cobrado: boolean;
    }) {
      // Un movimiento se considera "concretado" (ya impactó el flujo de caja)
      // cuando:
      // - GASTO con status=PAGADO
      // - INGRESO con status=PAGADO O cobrado=true (datos legacy y formularios
      //   nuevos pueden setear uno u otro; ambos significan dinero ya recibido)
      // - AJUSTE (instantáneo)
      // PARCIALMENTE_PAGADO NO se considera concretado completo.
      if (row.tipoMovimiento === TipoMovimiento.AJUSTE) return true;
      if (row.tipoMovimiento === TipoMovimiento.GASTO) {
        return row.status === FinanceMovementStatus.PAGADO;
      }
      if (row.tipoMovimiento === TipoMovimiento.INGRESO) {
        return row.status === FinanceMovementStatus.PAGADO || row.cobrado;
      }
      return false;
    }

    /** Devuelve un warning si el movimiento es PROYECTADO/COMPROMETIDO/A_PAGAR/
     *  PARCIALMENTE_PAGADO con fecha efectiva pasada (ya pasó la fecha de pago
     *  esperada pero no se concretó). El front lo muestra como toast/alert pero
     *  no bloquea el guardado. */
    function detectPastDateNotPaidWarning(row: {
      fecha: Date; status: FinanceMovementStatus; cobrado: boolean;
      tipoMovimiento: TipoMovimiento;
      expectedDate: Date | null; dueDate: Date | null;
    }): { type: "PAST_DATE_NOT_PAID"; message: string } | null {
      if (isMovementConcreted(row)) return null;
      const pendientes: FinanceMovementStatus[] = [
        FinanceMovementStatus.PREVISTO,
        FinanceMovementStatus.COMPROMETIDO,
        FinanceMovementStatus.A_PAGAR,
        FinanceMovementStatus.PARCIALMENTE_PAGADO,
      ];
      if (!pendientes.includes(row.status)) return null;
      const fechaEf = getMovementEffectiveDate(row);
      const hoy = new Date();
      hoy.setUTCHours(23, 59, 59, 999);
      if (fechaEf >= hoy) return null;
      const fechaIso = fechaEf.toISOString().slice(0, 10);
      return {
        type: "PAST_DATE_NOT_PAID",
        message: `El movimiento tiene fecha pasada (${fechaIso}) pero su estado es ${row.status}. Verificá si debería estar pagado/cobrado.`,
      };
    }

    function getMovementEffectiveDate(row: {
      fecha: Date;
      status: FinanceMovementStatus;
      cobrado: boolean;
      expectedDate: Date | null;
      dueDate: Date | null;
      tipoMovimiento: TipoMovimiento;
    }) {
      if (isMovementConcreted(row)) return row.fecha;
      return row.expectedDate ?? row.dueDate ?? row.fecha;
    }

    function convertMovementToUsd(row: {
      monto: import("@prisma/client/runtime/library").Decimal;
      moneda: Moneda;
      tipoCambio: import("@prisma/client/runtime/library").Decimal | null;
    }, fallbackUsdToUyu: number) {
      const monto = decimalToNumber(row.monto) ?? 0;
      if (row.moneda === Moneda.USD) return monto;
      const rowRate = row.tipoCambio ? (decimalToNumber(row.tipoCambio) ?? fallbackUsdToUyu) : fallbackUsdToUyu;
      return rowRate > 0 ? monto / rowRate : monto;
    }

    // Como convertMovementToUsd pero aplica IVA al monto antes de convertir.
    // Para el cálculo de saldos: lo que sale/entra de la cuenta es monto * (1+iva/100).
    function convertMovementToUsdConIva(row: {
      monto: import("@prisma/client/runtime/library").Decimal;
      moneda: Moneda;
      tipoCambio: import("@prisma/client/runtime/library").Decimal | null;
      ivaTasa?: number | null;
    }, fallbackUsdToUyu: number) {
      const monto = decimalToNumber(row.monto) ?? 0;
      const tasa = row.ivaTasa ?? 22;
      const montoConIva = monto * (1 + tasa / 100);
      if (row.moneda === Moneda.USD) return montoConIva;
      const rowRate = row.tipoCambio ? (decimalToNumber(row.tipoCambio) ?? fallbackUsdToUyu) : fallbackUsdToUyu;
      return rowRate > 0 ? montoConIva / rowRate : montoConIva;
    }

    function roundMoney(value: number) {
      return Math.round(value * 100) / 100;
    }

    // ─── Finance: Suppliers ───────────────────────────────────────────────────

    const supplierCreateSchema = z.object({
      nombre: z.string().min(1),
      rut: z.string().optional(),
      contactoNombre: z.string().optional(),
      email: z.string().email().optional(),
      telefono: z.string().optional(),
      direccion: z.string().optional(),
      condicionPago: z.string().optional(),
      notas: z.string().optional(),
    }).strict();

    const supplierPatchSchema = z.object({
      nombre: z.string().min(1).optional(),
      rut: z.string().nullable().optional(),
      contactoNombre: z.string().nullable().optional(),
      email: z.string().email().nullable().optional(),
      telefono: z.string().nullable().optional(),
      direccion: z.string().nullable().optional(),
      condicionPago: z.string().nullable().optional(),
      notas: z.string().nullable().optional(),
      activo: z.boolean().optional(),
    }).strict();

    function serializeSupplier(s: {
      id: string; nombre: string; rut: string | null; contactoNombre: string | null;
      email: string | null; telefono: string | null; direccion: string | null;
      condicionPago: string | null; activo: boolean; notas: string | null;
      createdAt: Date; updatedAt: Date;
      _count?: { movimientos: number; comprobantes: number };
    }) {
      return {
        id: s.id, nombre: s.nombre, rut: s.rut, contactoNombre: s.contactoNombre,
        email: s.email, telefono: s.telefono, direccion: s.direccion,
        condicionPago: s.condicionPago, activo: s.activo, notas: s.notas,
        createdAt: serializeDate(s.createdAt), updatedAt: serializeDate(s.updatedAt),
        ...(s._count ? { _count: s._count } : {}),
      };
    }

    app.get("/finance/suppliers", { preHandler: authorize(Module.FINANZAS, Action.VIEW) }, async (request) => {
      const query = z.object({
        activo: z.enum(["true", "false", "all"]).optional(),
        withBalance: z.enum(["true", "false"]).optional(),
      }).parse(request.query);
      const where: { deletedAt: null; activo?: boolean } = { deletedAt: null };
      if (query.activo !== "all") where.activo = query.activo === "false" ? false : true;
      const suppliers = await prisma.supplier.findMany({
        where,
        include: { _count: { select: { movimientos: true, comprobantes: true } } },
        orderBy: { nombre: "asc" },
      });
      const base = suppliers.map(serializeSupplier);
      if (query.withBalance !== "true") return base;

      // Cargar agregados por proveedor (facturas y pagos) para calcular saldo
      const supplierIds = suppliers.map((s) => s.id);
      const [movements, payments] = await Promise.all([
        prisma.financeMovement.findMany({
          where: {
            deletedAt: null,
            supplierId: { in: supplierIds },
            tipoMovimiento: TipoMovimiento.GASTO,
            status: { in: [
              FinanceMovementStatus.COMPROMETIDO,
              FinanceMovementStatus.A_PAGAR,
              FinanceMovementStatus.PARCIALMENTE_PAGADO,
              FinanceMovementStatus.PAGADO,
            ] },
          },
          include: {
            paymentApplications: {
              where: { payment: { deletedAt: null } },
              select: { montoAplicado: true },
            },
          },
        }),
        prisma.payment.findMany({
          where: { deletedAt: null, supplierId: { in: supplierIds } },
          include: { applications: { select: { montoAplicado: true } } },
        }),
      ]);

      type Agg = {
        facturasPendientesUSD: number; facturasPendientesUYU: number;
        saldoAFavorUSD: number; saldoAFavorUYU: number;
        facturasPendientesCount: number;
        ultimaActividad: Date | null;
      };
      const aggBy = new Map<string, Agg>();
      function getAgg(id: string): Agg {
        let a = aggBy.get(id);
        if (!a) {
          a = { facturasPendientesUSD: 0, facturasPendientesUYU: 0, saldoAFavorUSD: 0, saldoAFavorUYU: 0, facturasPendientesCount: 0, ultimaActividad: null };
          aggBy.set(id, a);
        }
        return a;
      }
      function bumpFecha(a: Agg, d: Date) {
        if (!a.ultimaActividad || d > a.ultimaActividad) a.ultimaActividad = d;
      }

      for (const m of movements) {
        if (!m.supplierId) continue;
        const a = getAgg(m.supplierId);
        const monto = Number(m.monto);
        const pagado = m.paymentApplications.reduce((acc, ap) => acc + Number(ap.montoAplicado), 0);
        const saldo = Math.max(0, monto - pagado);
        if (saldo > 0.005) {
          if (m.moneda === Moneda.USD) a.facturasPendientesUSD += saldo;
          else a.facturasPendientesUYU += saldo;
          a.facturasPendientesCount += 1;
        }
        bumpFecha(a, m.fecha);
      }
      for (const p of payments) {
        const a = getAgg(p.supplierId);
        const monto = Number(p.monto);
        const aplicado = p.applications.reduce((acc, ap) => acc + Number(ap.montoAplicado), 0);
        const saldoAFavor = Math.max(0, monto - aplicado);
        if (saldoAFavor > 0.005) {
          if (p.moneda === Moneda.USD) a.saldoAFavorUSD += saldoAFavor;
          else a.saldoAFavorUYU += saldoAFavor;
        }
        bumpFecha(a, p.fecha);
      }

      return base.map((s) => {
        const a = aggBy.get(s.id);
        const facturasPendientesUSD = a ? Math.round(a.facturasPendientesUSD * 100) / 100 : 0;
        const facturasPendientesUYU = a ? Math.round(a.facturasPendientesUYU * 100) / 100 : 0;
        const saldoAFavorUSD = a ? Math.round(a.saldoAFavorUSD * 100) / 100 : 0;
        const saldoAFavorUYU = a ? Math.round(a.saldoAFavorUYU * 100) / 100 : 0;
        return {
          ...s,
          balance: {
            facturasPendientesUSD,
            facturasPendientesUYU,
            saldoAFavorUSD,
            saldoAFavorUYU,
            saldoNetoUSD: Math.round((facturasPendientesUSD - saldoAFavorUSD) * 100) / 100,
            saldoNetoUYU: Math.round((facturasPendientesUYU - saldoAFavorUYU) * 100) / 100,
            facturasPendientesCount: a?.facturasPendientesCount ?? 0,
            ultimaActividad: a?.ultimaActividad ? serializeDateOnly(a.ultimaActividad) : null,
          },
        };
      });
    });

    app.get("/finance/suppliers/:id", { preHandler: authorize(Module.FINANZAS, Action.VIEW) }, async (request) => {
      const { id } = z.object({ id: z.string() }).parse(request.params);
      const supplier = await prisma.supplier.findFirst({
        where: { id, deletedAt: null },
        include: { _count: { select: { movimientos: true, comprobantes: true } } },
      });
      if (!supplier) throw notFound("SUPPLIER_NOT_FOUND", "Proveedor no encontrado");
      return serializeSupplier(supplier);
    });

    app.post("/finance/suppliers", { preHandler: authorize(Module.FINANZAS, Action.CREATE) }, async (request) => {
      const user = ensureUser(request);
      const body = supplierCreateSchema.parse(request.body);
      const dup = await prisma.supplier.findFirst({ where: { nombre: body.nombre, activo: true, deletedAt: null } });
      if (dup) throw conflict("SUPPLIER_NAME_EXISTS", "Ya existe un proveedor activo con ese nombre");
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
      if (body.nombre && body.nombre !== existing.nombre) {
        const dup = await prisma.supplier.findFirst({ where: { nombre: body.nombre, activo: true, deletedAt: null, id: { not: id } } });
        if (dup) throw conflict("SUPPLIER_NAME_EXISTS", "Ya existe un proveedor activo con ese nombre");
      }
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

    // ─── Materiales: Catálogo (categorías + items) ────────────────────────────

    const categoryCreateSchema = z.object({
      nombre: z.string().min(1),
      descripcion: z.string().optional(),
      orden: z.number().int().optional(),
    }).strict();

    const categoryPatchSchema = z.object({
      nombre: z.string().min(1).optional(),
      descripcion: z.string().nullable().optional(),
      orden: z.number().int().optional(),
      activa: z.boolean().optional(),
    }).strict();

    app.get("/materials/categories", { preHandler: authorize(Module.INGENIERIA, Action.VIEW) }, async (request) => {
      const query = z.object({ activa: z.enum(["true", "false", "all"]).optional() }).parse(request.query);
      const where: { activa?: boolean } = {};
      if (query.activa !== "all") where.activa = query.activa === "false" ? false : true;
      const categories = await prisma.materialCategory.findMany({
        where,
        include: { _count: { select: { items: true } } },
        orderBy: [{ orden: "asc" }, { nombre: "asc" }],
      });
      return categories.map((c) => ({
        id: c.id, nombre: c.nombre, descripcion: c.descripcion, orden: c.orden, activa: c.activa,
        createdAt: serializeDate(c.createdAt), updatedAt: serializeDate(c.updatedAt),
        _count: c._count,
      }));
    });

    app.post("/materials/categories", { preHandler: authorize(Module.CONFIGURACION, Action.CREATE) }, async (request) => {
      const body = categoryCreateSchema.parse(request.body);
      const dup = await prisma.materialCategory.findUnique({ where: { nombre: body.nombre } });
      if (dup) throw conflict("CATEGORY_NAME_EXISTS", "Ya existe una categoría con ese nombre");
      const last = await prisma.materialCategory.findFirst({ orderBy: { orden: "desc" } });
      const orden = body.orden ?? ((last?.orden ?? 0) + 1);
      return prisma.materialCategory.create({ data: { ...body, orden } });
    });

    app.patch("/materials/categories/:id", { preHandler: authorize(Module.CONFIGURACION, Action.EDIT) }, async (request) => {
      const { id } = z.object({ id: z.string() }).parse(request.params);
      const body = categoryPatchSchema.parse(request.body);
      const existing = await prisma.materialCategory.findUnique({ where: { id } });
      if (!existing) throw notFound("CATEGORY_NOT_FOUND", "Categoría no encontrada");
      if (body.nombre && body.nombre !== existing.nombre) {
        const dup = await prisma.materialCategory.findUnique({ where: { nombre: body.nombre } });
        if (dup) throw conflict("CATEGORY_NAME_EXISTS", "Ya existe una categoría con ese nombre");
      }
      return prisma.materialCategory.update({ where: { id }, data: body });
    });

    app.delete("/materials/categories/:id", { preHandler: authorize(Module.CONFIGURACION, Action.DELETE) }, async (request) => {
      const { id } = z.object({ id: z.string() }).parse(request.params);
      const existing = await prisma.materialCategory.findUnique({
        where: { id },
        include: { _count: { select: { items: true } } },
      });
      if (!existing) throw notFound("CATEGORY_NOT_FOUND", "Categoría no encontrada");
      if (existing._count.items > 0) {
        // soft delete: desactivar
        await prisma.materialCategory.update({ where: { id }, data: { activa: false } });
        return { success: true, deactivated: true };
      }
      await prisma.materialCategory.delete({ where: { id } });
      return { success: true, deactivated: false };
    });

    app.post("/materials/categories/reorder", { preHandler: authorize(Module.CONFIGURACION, Action.EDIT) }, async (request) => {
      const body = z.object({ ids: z.array(z.string()).min(1) }).strict().parse(request.body);
      await prisma.$transaction(body.ids.map((id, idx) =>
        prisma.materialCategory.update({ where: { id }, data: { orden: idx } })
      ));
      return { success: true };
    });

    const itemCreateSchema = z.object({
      categoryId: z.string(),
      nombre: z.string().min(1),
      descripcion: z.string().optional(),
      unidad: z.string().min(1).default("un"),
      precioSugerido: z.coerce.number().nonnegative().optional(),
      moneda: z.nativeEnum(Moneda).default(Moneda.USD),
      ivaTasa: z.coerce.number().min(0).max(100).optional(),
      defaultSupplierId: z.string().optional(),
      gestionaStock: z.boolean().optional(),
      stockMinimo: z.coerce.number().int({ message: "Las cantidades deben ser enteras" }).nonnegative().optional(),
      ubicacionDeposito: z.string().optional(),
    }).strict();

    const itemPatchSchema = z.object({
      categoryId: z.string().optional(),
      nombre: z.string().min(1).optional(),
      descripcion: z.string().nullable().optional(),
      unidad: z.string().min(1).optional(),
      precioSugerido: z.coerce.number().nonnegative().nullable().optional(),
      moneda: z.nativeEnum(Moneda).optional(),
      ivaTasa: z.coerce.number().min(0).max(100).optional(),
      defaultSupplierId: z.string().nullable().optional(),
      activo: z.boolean().optional(),
      gestionaStock: z.boolean().optional(),
      stockMinimo: z.coerce.number().int({ message: "Las cantidades deben ser enteras" }).nonnegative().nullable().optional(),
      ubicacionDeposito: z.string().nullable().optional(),
    }).strict();

    function serializeMaterialItem(it: {
      id: string; categoryId: string; nombre: string; descripcion: string | null;
      unidad: string; precioSugerido: import("@prisma/client/runtime/library").Decimal | null;
      moneda: Moneda; ivaTasa: number; defaultSupplierId: string | null; activo: boolean;
      gestionaStock: boolean;
      stockActual: import("@prisma/client/runtime/library").Decimal;
      stockMinimo: import("@prisma/client/runtime/library").Decimal | null;
      ubicacionDeposito: string | null;
      createdAt: Date; updatedAt: Date;
      category?: { id: string; nombre: string; orden: number; activa: boolean } | null;
      defaultSupplier?: { id: string; nombre: string } | null;
      _count?: { projectMaterials: number };
    }) {
      const stockActualNum = Number(it.stockActual);
      const stockMinimoNum = it.stockMinimo === null ? null : Number(it.stockMinimo);
      const bajoMinimo = it.gestionaStock && stockMinimoNum !== null && stockActualNum < stockMinimoNum;
      return {
        id: it.id, categoryId: it.categoryId, nombre: it.nombre, descripcion: it.descripcion,
        unidad: it.unidad,
        precioSugerido: it.precioSugerido === null ? null : decimalToNumber(it.precioSugerido),
        moneda: it.moneda, ivaTasa: it.ivaTasa, defaultSupplierId: it.defaultSupplierId, activo: it.activo,
        gestionaStock: it.gestionaStock,
        stockActual: stockActualNum,
        stockMinimo: stockMinimoNum,
        ubicacionDeposito: it.ubicacionDeposito,
        bajoMinimo,
        createdAt: serializeDate(it.createdAt), updatedAt: serializeDate(it.updatedAt),
        ...(it.category ? { category: it.category } : {}),
        ...(it.defaultSupplier ? { defaultSupplier: it.defaultSupplier } : {}),
        ...(it._count ? { _count: it._count } : {}),
      };
    }

    app.get("/materials/items", { preHandler: authorize(Module.INGENIERIA, Action.VIEW) }, async (request) => {
      const query = z.object({
        categoryId: z.string().optional(),
        search: z.string().optional(),
        activo: z.enum(["true", "false", "all"]).optional(),
        gestionaStock: z.enum(["true", "false", "all"]).optional(),
      }).parse(request.query);
      const where: Prisma.MaterialItemWhereInput = {};
      if (query.categoryId) where.categoryId = query.categoryId;
      if (query.activo !== "all") where.activo = query.activo === "false" ? false : true;
      if (query.gestionaStock && query.gestionaStock !== "all") {
        where.gestionaStock = query.gestionaStock === "true";
      }
      if (query.search) {
        where.OR = [
          { nombre: { contains: query.search, mode: "insensitive" } },
          { descripcion: { contains: query.search, mode: "insensitive" } },
        ];
      }
      const items = await prisma.materialItem.findMany({
        where,
        include: {
          category: { select: { id: true, nombre: true, orden: true, activa: true } },
          defaultSupplier: { select: { id: true, nombre: true } },
          _count: { select: { projectMaterials: true } },
        },
        orderBy: [{ category: { orden: "asc" } }, { nombre: "asc" }],
      });
      return items.map(serializeMaterialItem);
    });

    app.get("/materials/items/:id", { preHandler: authorize(Module.INGENIERIA, Action.VIEW) }, async (request) => {
      const { id } = z.object({ id: z.string() }).parse(request.params);
      const item = await prisma.materialItem.findUnique({
        where: { id },
        include: {
          category: { select: { id: true, nombre: true, orden: true, activa: true } },
          defaultSupplier: { select: { id: true, nombre: true } },
          _count: { select: { projectMaterials: true } },
        },
      });
      if (!item) throw notFound("MATERIAL_ITEM_NOT_FOUND", "Ítem no encontrado");
      return serializeMaterialItem(item);
    });

    app.post("/materials/items", { preHandler: authorize(Module.CONFIGURACION, Action.CREATE) }, async (request) => {
      const body = itemCreateSchema.parse(request.body);
      const cat = await prisma.materialCategory.findUnique({ where: { id: body.categoryId } });
      if (!cat || !cat.activa) throw badRequest("CATEGORY_INVALID", "La categoría no existe o está inactiva");
      if (body.defaultSupplierId) {
        const sup = await prisma.supplier.findFirst({ where: { id: body.defaultSupplierId, deletedAt: null } });
        if (!sup) throw badRequest("SUPPLIER_INVALID", "El proveedor por defecto no existe");
      }
      const item = await prisma.materialItem.create({
        data: body,
        include: {
          category: { select: { id: true, nombre: true, orden: true, activa: true } },
          defaultSupplier: { select: { id: true, nombre: true } },
        },
      });
      return serializeMaterialItem(item);
    });

    app.patch("/materials/items/:id", { preHandler: authorize(Module.CONFIGURACION, Action.EDIT) }, async (request) => {
      const { id } = z.object({ id: z.string() }).parse(request.params);
      const body = itemPatchSchema.parse(request.body);
      const existing = await prisma.materialItem.findUnique({ where: { id } });
      if (!existing) throw notFound("MATERIAL_ITEM_NOT_FOUND", "Ítem no encontrado");
      if (body.categoryId) {
        const cat = await prisma.materialCategory.findUnique({ where: { id: body.categoryId } });
        if (!cat || !cat.activa) throw badRequest("CATEGORY_INVALID", "La categoría no existe o está inactiva");
      }
      if (body.defaultSupplierId) {
        const sup = await prisma.supplier.findFirst({ where: { id: body.defaultSupplierId, deletedAt: null } });
        if (!sup) throw badRequest("SUPPLIER_INVALID", "El proveedor por defecto no existe");
      }
      const updated = await prisma.materialItem.update({
        where: { id }, data: body,
        include: {
          category: { select: { id: true, nombre: true, orden: true, activa: true } },
          defaultSupplier: { select: { id: true, nombre: true } },
        },
      });
      return serializeMaterialItem(updated);
    });

    app.delete("/materials/items/:id", { preHandler: authorize(Module.CONFIGURACION, Action.DELETE) }, async (request) => {
      const { id } = z.object({ id: z.string() }).parse(request.params);
      const existing = await prisma.materialItem.findUnique({
        where: { id },
        include: { _count: { select: { projectMaterials: true } } },
      });
      if (!existing) throw notFound("MATERIAL_ITEM_NOT_FOUND", "Ítem no encontrado");
      if (existing._count.projectMaterials > 0) {
        await prisma.materialItem.update({ where: { id }, data: { activo: false } });
        return { success: true, deactivated: true };
      }
      await prisma.materialItem.delete({ where: { id } });
      return { success: true, deactivated: false };
    });

    // ─── Materiales: Lista por proyecto ───────────────────────────────────────

    function serializeProjectMaterial(pm: {
      id: string; projectId: string; materialItemId: string;
      quantity: import("@prisma/client/runtime/library").Decimal;
      unitPrice: import("@prisma/client/runtime/library").Decimal;
      moneda: Moneda; ivaTasa: number; supplierId: string | null; notes: string | null;
      movementId: string | null;
      status: MaterialStatus;
      crossed: boolean;
      rowColor: string | null;
      addedById: string | null;
      lastEditedAt: Date | null;
      lastEditedById: string | null;
      lastEditedRole: string | null;
      createdAt: Date; updatedAt: Date;
      materialItem?: {
        id: string; nombre: string; unidad: string; categoryId: string;
        category: { id: string; nombre: string; orden: number };
      } | null;
      supplier?: { id: string; nombre: string } | null;
      movement?: { id: string; status: FinanceMovementStatus; descripcion: string } | null;
      addedBy?: { id: string; name: string } | null;
      lastEditedBy?: { id: string; name: string } | null;
    }) {
      const qty = Number(pm.quantity);
      const price = Number(pm.unitPrice);
      return {
        id: pm.id, projectId: pm.projectId, materialItemId: pm.materialItemId,
        quantity: qty, unitPrice: price, subtotal: Math.round(qty * price * 100) / 100,
        moneda: pm.moneda, ivaTasa: pm.ivaTasa, supplierId: pm.supplierId, notes: pm.notes, movementId: pm.movementId,
        status: pm.status,
        crossed: pm.crossed,
        rowColor: pm.rowColor,
        addedBy: pm.addedBy ?? null,
        lastEditedAt: pm.lastEditedAt ? serializeDate(pm.lastEditedAt) : null,
        lastEditedBy: pm.lastEditedBy ?? null,
        lastEditedRole: pm.lastEditedRole,
        createdAt: serializeDate(pm.createdAt), updatedAt: serializeDate(pm.updatedAt),
        ...(pm.materialItem ? { materialItem: pm.materialItem } : {}),
        ...(pm.supplier ? { supplier: pm.supplier } : {}),
        ...(pm.movement ? { movement: pm.movement } : {}),
      };
    }

    // Include reusable: lo usan GET / POST / PATCH para mantener la respuesta
    // consistente y para que el serializer reciba siempre la misma forma.
    const projectMaterialInclude = {
      materialItem: {
        select: {
          id: true, nombre: true, unidad: true, categoryId: true,
          category: { select: { id: true, nombre: true, orden: true } },
        },
      },
      supplier: { select: { id: true, nombre: true } },
      movement: { select: { id: true, status: true, descripcion: true } },
      addedBy: { select: { id: true, name: true } },
      lastEditedBy: { select: { id: true, name: true } },
    } as const;

    // Permisos: la lista de materiales es colaborativa entre Ingeniería y
    // Operaciones — cualquiera de los dos puede ver/editar.
    const materialPermsView = [
      { module: Module.INGENIERIA, action: Action.VIEW },
      { module: Module.OPERACIONES, action: Action.VIEW },
    ];
    const materialPermsEdit = [
      { module: Module.INGENIERIA, action: Action.EDIT },
      { module: Module.OPERACIONES, action: Action.EDIT },
    ];

    const ROW_COLOR_VALUES = ["yellow", "green", "blue", "purple", "red", "gray"] as const;
    const rowColorSchema = z.enum(ROW_COLOR_VALUES).nullable();

    app.get("/projects/:id/materials", { preHandler: authorizeAny(materialPermsView) }, async (request) => {
      const { id } = z.object({ id: z.string() }).parse(request.params);
      const project = await prisma.project.findFirst({ where: { id, deletedAt: null } });
      if (!project) throw notFound("PROJECT_NOT_FOUND", "Proyecto no encontrado");
      const materials = await prisma.projectMaterial.findMany({
        where: { projectId: id },
        include: projectMaterialInclude,
        orderBy: [{ materialItem: { category: { orden: "asc" } } }, { materialItem: { nombre: "asc" } }],
      });
      return materials.map(serializeProjectMaterial);
    });

    const projectMaterialCreateSchema = z.object({
      materialItemId: z.string(),
      quantity: z.coerce.number().int({ message: "Las cantidades deben ser enteras" }).positive(),
      unitPrice: z.coerce.number().nonnegative().optional(),
      moneda: z.nativeEnum(Moneda).optional(),
      ivaTasa: z.coerce.number().min(0).max(100).optional(),
      supplierId: z.string().nullable().optional(),
      notes: z.string().nullable().optional(),
      status: z.nativeEnum(MaterialStatus).optional(),
      crossed: z.boolean().optional(),
      rowColor: rowColorSchema.optional(),
    }).strict();

    app.post("/projects/:id/materials", { preHandler: authorizeAny(materialPermsEdit) }, async (request) => {
      const user = ensureUser(request);
      const { id } = z.object({ id: z.string() }).parse(request.params);
      const body = projectMaterialCreateSchema.parse(request.body);
      const project = await prisma.project.findFirst({ where: { id, deletedAt: null } });
      if (!project) throw notFound("PROJECT_NOT_FOUND", "Proyecto no encontrado");
      const item = await prisma.materialItem.findUnique({ where: { id: body.materialItemId } });
      if (!item || !item.activo) throw badRequest("MATERIAL_ITEM_INVALID", "El ítem no existe o está inactivo");
      const unitPrice = body.unitPrice ?? (item.precioSugerido ? Number(item.precioSugerido) : 0);
      const moneda = body.moneda ?? item.moneda;
      const ivaTasa = body.ivaTasa ?? item.ivaTasa;
      const supplierId = body.supplierId ?? item.defaultSupplierId ?? null;
      const now = new Date();
      const created = await prisma.projectMaterial.create({
        data: {
          projectId: id,
          materialItemId: body.materialItemId,
          quantity: body.quantity,
          unitPrice,
          moneda,
          ivaTasa,
          supplierId,
          notes: body.notes,
          status: body.status ?? MaterialStatus.PENDIENTE,
          crossed: body.crossed ?? false,
          rowColor: body.rowColor ?? null,
          addedById: user.id,
          lastEditedAt: now,
          lastEditedById: user.id,
          lastEditedRole: user.role,
        },
        include: projectMaterialInclude,
      });
      return serializeProjectMaterial(created);
    });

    const projectMaterialPatchSchema = z.object({
      quantity: z.coerce.number().int({ message: "Las cantidades deben ser enteras" }).positive().optional(),
      unitPrice: z.coerce.number().nonnegative().optional(),
      moneda: z.nativeEnum(Moneda).optional(),
      ivaTasa: z.coerce.number().min(0).max(100).optional(),
      supplierId: z.string().nullable().optional(),
      notes: z.string().nullable().optional(),
      status: z.nativeEnum(MaterialStatus).optional(),
      crossed: z.boolean().optional(),
      rowColor: rowColorSchema.optional(),
    }).strict();

    app.patch("/projects/:id/materials/:materialId", { preHandler: authorizeAny(materialPermsEdit) }, async (request) => {
      const user = ensureUser(request);
      const { id, materialId } = z.object({ id: z.string(), materialId: z.string() }).parse(request.params);
      const body = projectMaterialPatchSchema.parse(request.body);
      const existing = await prisma.projectMaterial.findFirst({ where: { id: materialId, projectId: id } });
      if (!existing) throw notFound("PROJECT_MATERIAL_NOT_FOUND", "Material del proyecto no encontrado");
      const updated = await prisma.projectMaterial.update({
        where: { id: materialId },
        data: {
          ...body,
          lastEditedAt: new Date(),
          lastEditedById: user.id,
          lastEditedRole: user.role,
        },
        include: projectMaterialInclude,
      });
      return serializeProjectMaterial(updated);
    });

    app.delete("/projects/:id/materials/:materialId", { preHandler: authorizeAny(materialPermsEdit) }, async (request) => {
      const { id, materialId } = z.object({ id: z.string(), materialId: z.string() }).parse(request.params);
      const existing = await prisma.projectMaterial.findFirst({ where: { id: materialId, projectId: id } });
      if (!existing) throw notFound("PROJECT_MATERIAL_NOT_FOUND", "Material del proyecto no encontrado");
      await prisma.$transaction(async (tx) => {
        if (existing.movementId) {
          await tx.financeMovement.update({ where: { id: existing.movementId }, data: { deletedAt: new Date() } });
        }
        await tx.projectMaterial.delete({ where: { id: materialId } });
      });
      return { success: true, previstoEliminado: !!existing.movementId };
    });

    // ─── Materiales: Generación / regeneración de previstos ───────────────────

    async function generatePrevistosForProject(projectId: string, userId: string | undefined, expectedDate: Date) {
      // Bloque 3: ya NO creamos FinanceMovement PREVISTO. La fecha tentativa se
      // setea directamente sobre cada ProjectMaterial.expectedDate y los
      // proyectados se incluyen en el flujo de fondos vía /finance/cashflow.
      // Solo se actualiza la fecha de los materiales que aún no están ligados
      // a un movimiento avanzado (COMPROMETIDO+/A_PAGAR/PAGADO) — esos no se
      // tocan porque ya forman parte del flujo real.
      const fechaIso = new Date(Date.UTC(expectedDate.getUTCFullYear(), expectedDate.getUTCMonth(), expectedDate.getUTCDate()));

      const materials = await prisma.projectMaterial.findMany({
        where: { projectId, movementId: null },
        select: { id: true },
      });

      if (materials.length > 0) {
        await prisma.projectMaterial.updateMany({
          where: { id: { in: materials.map((m) => m.id) } },
          data: { expectedDate: fechaIso },
        });
      }

      if (userId) {
        await createAuditEntry({
          entityType: AuditEntityType.project,
          entityId: projectId,
          projectId,
          userId,
          action: AuditAction.updated,
          description: `Fecha prevista de materiales actualizada a ${fechaIso.toISOString().slice(0, 10)} (${materials.length} ítem${materials.length === 1 ? "" : "s"})`,
        });
      }

      const alreadyExisted = await prisma.projectMaterial.count({
        where: { projectId, NOT: { movementId: null } },
      });

      // El shape de la respuesta se preserva: el frontend espera "created" como
      // cantidad de ítems afectados; "alreadyExisted" como ítems ligados a
      // movements (que no se modificaron).
      return { created: materials.length, alreadyExisted };
    }

    app.post("/projects/:id/materials/generate-previsto", { preHandler: authorize(Module.INGENIERIA, Action.EDIT) }, async (request, reply) => {
      const { id } = z.object({ id: z.string() }).parse(request.params);
      const { expectedDate: expectedDateStr } = z.object({ expectedDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional() }).parse(request.body);
      if (!expectedDateStr) return reply.code(400).send({ error: "EXPECTED_DATE_REQUIRED", message: "La fecha esperada es obligatoria" });
      const user = ensureUser(request);
      const project = await prisma.project.findFirst({ where: { id, deletedAt: null } });
      if (!project) throw notFound("PROJECT_NOT_FOUND", "Proyecto no encontrado");
      const expectedDate = parseDateOnly(expectedDateStr);
      const result = await generatePrevistosForProject(id, user.id, expectedDate);
      return result;
    });

    // Preview: cuántos PREVISTO se borrarían y qué movimientos avanzados se preservarían
    app.get("/projects/:id/materials/regenerate-impact", { preHandler: authorize(Module.INGENIERIA, Action.VIEW) }, async (request) => {
      const { id } = z.object({ id: z.string() }).parse(request.params);
      const project = await prisma.project.findFirst({ where: { id, deletedAt: null } });
      if (!project) throw notFound("PROJECT_NOT_FOUND", "Proyecto no encontrado");

      const movements = await prisma.financeMovement.findMany({
        where: {
          projectId: id,
          sourceType: MovementSourceType.PROJECT_MATERIALS,
          deletedAt: null,
        },
        select: { id: true, descripcion: true, status: true, monto: true, moneda: true, fecha: true },
        orderBy: { fecha: "asc" },
      });

      const toDelete = movements.filter((m) => m.status === FinanceMovementStatus.PREVISTO);
      const toPreserve = movements.filter((m) => m.status !== FinanceMovementStatus.PREVISTO);

      return {
        toDelete: toDelete.length,
        toPreserve: toPreserve.length,
        preservedDetails: toPreserve.map((m) => ({
          id: m.id,
          descripcion: m.descripcion,
          status: m.status,
          monto: Number(m.monto),
          moneda: m.moneda,
          fecha: serializeDateOnly(m.fecha),
        })),
      };
    });

    app.post("/projects/:id/materials/regenerate-previsto", { preHandler: authorize(Module.INGENIERIA, Action.EDIT) }, async (request, reply) => {
      const { id } = z.object({ id: z.string() }).parse(request.params);
      const { expectedDate: expectedDateStr } = z.object({ expectedDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional() }).parse(request.body);
      if (!expectedDateStr) return reply.code(400).send({ error: "EXPECTED_DATE_REQUIRED", message: "La fecha esperada es obligatoria" });
      const user = ensureUser(request);
      if (user.role !== "ADMIN") throw forbidden("Solo un administrador puede regenerar previstos");
      const project = await prisma.project.findFirst({ where: { id, deletedAt: null } });
      if (!project) throw notFound("PROJECT_NOT_FOUND", "Proyecto no encontrado");
      const expectedDate = parseDateOnly(expectedDateStr);

      // Sólo los PREVISTO. Los avanzados (COMPROMETIDO, A_PAGAR, PARCIALMENTE_PAGADO, PAGADO)
      // se preservan: sus ProjectMaterials siguen referenciando esos movimientos y NO se
      // recalculan en la generación nueva.
      const movsToDelete = await prisma.financeMovement.findMany({
        where: {
          projectId: id,
          status: FinanceMovementStatus.PREVISTO,
          sourceType: MovementSourceType.PROJECT_MATERIALS,
          deletedAt: null,
        },
        select: { id: true, descripcion: true, monto: true, moneda: true },
      });
      const preservedMovs = await prisma.financeMovement.findMany({
        where: {
          projectId: id,
          status: { in: [
            FinanceMovementStatus.COMPROMETIDO,
            FinanceMovementStatus.A_PAGAR,
            FinanceMovementStatus.PARCIALMENTE_PAGADO,
            FinanceMovementStatus.PAGADO,
          ] },
          sourceType: MovementSourceType.PROJECT_MATERIALS,
          deletedAt: null,
        },
        select: { id: true, descripcion: true, status: true, monto: true, moneda: true },
      });

      const movIds = movsToDelete.map((m) => m.id);
      await prisma.$transaction([
        // Desvincular ProjectMaterials que apuntaban a los previstos a borrar
        prisma.projectMaterial.updateMany({ where: { projectId: id, movementId: { in: movIds } }, data: { movementId: null } }),
        // Soft-delete de los movimientos previstos. Los InvoiceItems quedan asociados
        // (cascada hard) — Prisma no los borra al hacer deletedAt: si querés podés agregar
        // un cleanup posterior, pero hoy el filtro por deletedAt: null los oculta.
        prisma.financeMovement.updateMany({ where: { id: { in: movIds } }, data: { deletedAt: new Date() } }),
      ]);
      const result = await generatePrevistosForProject(id, user.id, expectedDate);
      return {
        ...result,
        deletedCount: movIds.length,
        preservedCount: preservedMovs.length,
        preservedDetails: preservedMovs.map((m) => ({
          id: m.id,
          descripcion: m.descripcion,
          status: m.status,
          monto: Number(m.monto),
          moneda: m.moneda,
        })),
        regenerated: movIds.length,
      };
    });

    // ─── Export PDF de lista de materiales ───────────────────────────────────

    app.post("/projects/:id/materials/export-pdf", { preHandler: authorize(Module.INGENIERIA, Action.VIEW) }, async (request, reply) => {
      const user = ensureUser(request);
      const { id } = z.object({ id: z.string() }).parse(request.params);
      const { includePrecios } = z.object({ includePrecios: z.string().optional() }).parse(request.query);
      const withPrices = includePrecios === "true";

      const project = await prisma.project.findFirst({ where: { id, deletedAt: null }, select: { id: true, clientName: true, code: true } });
      if (!project) throw notFound("PROJECT_NOT_FOUND", "Proyecto no encontrado");

      const materials = await prisma.projectMaterial.findMany({
        where: { projectId: id },
        include: {
          materialItem: {
            select: { nombre: true, unidad: true, category: { select: { nombre: true, orden: true } } },
          },
        },
        orderBy: { createdAt: "asc" },
      });

      // Directorio de destino dentro del storage del proyecto
      const storageRoot = path.resolve(process.cwd(), "..", env.storagePath, id);
      await fsPromises.mkdir(storageRoot, { recursive: true });

      const timestamp = new Date().toISOString().slice(0, 10);
      const storedFilename = withPrices
        ? `lista-materiales-con-precios-${Date.now()}.pdf`
        : `lista-materiales-${Date.now()}.pdf`;
      const absolutePath = path.join(storageRoot, storedFilename);
      const displayName = withPrices
        ? `Lista de materiales (con precios) ${timestamp}`
        : `Lista de materiales (sin precios) ${timestamp}`;

      // Generar PDF con pdfkit.
      // Área útil A4: x=50..545 (495pt). Columnas diseñadas para caber exactas.
      // Todas las celdas usan lineBreak: false para evitar solapamiento.
      await new Promise<void>((resolve, reject) => {
        const doc = new PDFDocument({ margin: 50, size: "A4", autoFirstPage: true });
        const writeStream = fs.createWriteStream(absolutePath);
        doc.pipe(writeStream);
        writeStream.on("finish", resolve);
        writeStream.on("error", reject);
        doc.on("error", reject);

        // ── Encabezado ────────────────────────────────────────────────────────
        doc.font("Helvetica-Bold").fontSize(16).text("Lista de Materiales", 50, 50, { align: "center", width: 495 });
        doc.font("Helvetica-Bold").fontSize(11).text(project.clientName, 50, 72, { align: "center", width: 495 });
        doc.font("Helvetica").fontSize(9).fillColor("#666666")
           .text(`Generado el ${new Date().toLocaleDateString("es-UY", { day: "2-digit", month: "long", year: "numeric" })}`, 50, 88, { align: "center", width: 495 });
        doc.fillColor("#000000");

        if (materials.length === 0) {
          doc.fontSize(11).text("Sin materiales cargados.", 50, 120, { align: "center", width: 495 });
          doc.end();
          return;
        }

        // ── Definición de columnas según modo ────────────────────────────────
        // Sin precios: Ítem(300) · gap(5) · Cant(80) · gap(5) · Unidad(105) = 495
        // Con precios: Ítem(180) · gap(5) · Cant(40) · gap(5) · Unidad(55) · gap(5) · Precio(95) · gap(5) · Subtotal(105) = 495
        const C = withPrices
          ? {
              item:     { x: 50,  w: 180 },
              cant:     { x: 235, w: 40  },
              unidad:   { x: 280, w: 55  },
              precio:   { x: 340, w: 95  },
              subtotal: { x: 440, w: 105 },
            }
          : {
              item:     { x: 50,  w: 300 },
              cant:     { x: 355, w: 80  },
              unidad:   { x: 440, w: 105 },
            };
        const PAGE_BOTTOM = 790;
        const ROW_H = 16;
        const FONT_SIZE = 8.5;

        function fitText(text: string, maxW: number): string {
          if (doc.widthOfString(text) <= maxW) return text;
          let t = text;
          while (t.length > 1 && doc.widthOfString(t + "…") > maxW) t = t.slice(0, -1);
          return t + "…";
        }

        function drawDataRow(y: number, nombre: string, cant: string, unidad: string, precio?: string, subtotal?: string) {
          doc.font("Helvetica").fontSize(FONT_SIZE).fillColor("#000000");
          doc.text(fitText(nombre, C.item.w), C.item.x, y, { width: C.item.w, lineBreak: false });
          doc.text(cant, C.cant.x, y, { width: C.cant.w, lineBreak: false, align: "right" });
          doc.text(fitText(unidad, C.unidad.w), C.unidad.x, y, { width: C.unidad.w, lineBreak: false, align: "center" });
          if (withPrices && precio !== undefined && subtotal !== undefined) {
            const Cp = C as { item: { x: number; w: number }; cant: { x: number; w: number }; unidad: { x: number; w: number }; precio: { x: number; w: number }; subtotal: { x: number; w: number } };
            doc.text(precio,   Cp.precio.x,   y, { width: Cp.precio.w,   lineBreak: false, align: "right" });
            doc.text(subtotal, Cp.subtotal.x, y, { width: Cp.subtotal.w, lineBreak: false, align: "right" });
          }
        }

        // ── Cabecera de tabla ─────────────────────────────────────────────────
        let rowY = 110;
        doc.rect(50, rowY, 495, ROW_H).fill("#1e3a5f");
        doc.font("Helvetica-Bold").fontSize(FONT_SIZE).fillColor("#ffffff");
        doc.text("Ítem",   C.item.x, rowY + 3, { width: C.item.w, lineBreak: false });
        doc.text("Cant.",  C.cant.x, rowY + 3, { width: C.cant.w, lineBreak: false, align: "right" });
        doc.text("Unidad", C.unidad.x, rowY + 3, { width: C.unidad.w, lineBreak: false, align: "center" });
        if (withPrices) {
          const Cp = C as { item: { x: number; w: number }; cant: { x: number; w: number }; unidad: { x: number; w: number }; precio: { x: number; w: number }; subtotal: { x: number; w: number } };
          doc.text("Precio",   Cp.precio.x,   rowY + 3, { width: Cp.precio.w,   lineBreak: false, align: "right" });
          doc.text("Subtotal", Cp.subtotal.x, rowY + 3, { width: Cp.subtotal.w, lineBreak: false, align: "right" });
        }
        rowY += ROW_H + 1;

        // ── Filas de datos ────────────────────────────────────────────────────
        const groups = new Map<string, { orden: number; nombre: string; items: typeof materials }>();
        for (const pm of materials) {
          const catNombre = pm.materialItem.category?.nombre ?? "Sin categoría";
          const catOrden = pm.materialItem.category?.orden ?? 9999;
          if (!groups.has(catNombre)) groups.set(catNombre, { orden: catOrden, nombre: catNombre, items: [] });
          groups.get(catNombre)!.items.push(pm);
        }
        const sortedGroups = Array.from(groups.values()).sort((a, b) => a.orden - b.orden);

        const totalByMoneda: Record<string, number> = {};
        const totalByMonedaConIva: Record<string, number> = {};
        let rowAlt = false;

        for (const group of sortedGroups) {
          if (rowY + ROW_H * 2 > PAGE_BOTTOM) {
            doc.addPage();
            rowY = 50;
            rowAlt = false;
          }

          doc.rect(50, rowY, 495, ROW_H - 1).fill("#dbeafe");
          doc.font("Helvetica-Bold").fontSize(8).fillColor("#1e3a5f")
             .text(group.nombre, 54, rowY + 3, { width: 487, lineBreak: false });
          rowY += ROW_H;

          for (const pm of group.items) {
            if (rowY + ROW_H > PAGE_BOTTOM) {
              doc.addPage();
              rowY = 50;
              rowAlt = false;
            }

            const qty = Number(pm.quantity);
            const price = Number(pm.unitPrice);
            const subtotal = qty * price;
            if (withPrices) {
              totalByMoneda[pm.moneda] = (totalByMoneda[pm.moneda] ?? 0) + subtotal;
              const ivaFactor = 1 + (pm.ivaTasa ?? 22) / 100;
              totalByMonedaConIva[pm.moneda] = (totalByMonedaConIva[pm.moneda] ?? 0) + subtotal * ivaFactor;
            }

            if (rowAlt) doc.rect(50, rowY, 495, ROW_H - 1).fill("#f8fafc");
            drawDataRow(
              rowY + 3,
              pm.materialItem.nombre,
              qty.toString(),
              pm.materialItem.unidad,
              withPrices ? `${price.toFixed(2)} ${pm.moneda}` : undefined,
              withPrices ? `${subtotal.toFixed(2)} ${pm.moneda}` : undefined,
            );
            rowY += ROW_H;
            rowAlt = !rowAlt;
          }
          rowY += 3;
        }

        // ── Separador + total (solo con precios) ──────────────────────────────
        if (withPrices) {
          if (rowY + 24 > PAGE_BOTTOM) {
            doc.addPage();
            rowY = 50;
          }
          doc.moveTo(50, rowY).lineTo(545, rowY).strokeColor("#1e3a5f").lineWidth(0.8).stroke();
          rowY += 6;

          const Cp = C as { item: { x: number; w: number }; cant: { x: number; w: number }; unidad: { x: number; w: number }; precio: { x: number; w: number }; subtotal: { x: number; w: number } };
          const totStr = Object.entries(totalByMoneda)
            .map(([m, v]) => `${v.toLocaleString("es-UY", { minimumFractionDigits: 2 })} ${m}`)
            .join("   ·   ");
          doc.font("Helvetica-Bold").fontSize(10).fillColor("#1e3a5f");
          doc.text("Total sin IVA:", 50, rowY, { width: 340, lineBreak: false });
          doc.text(totStr, Cp.subtotal.x - 95, rowY, { width: Cp.subtotal.w + 95, lineBreak: false, align: "right" });

          // Total con IVA (G.6)
          rowY += 16;
          const totConIvaStr = Object.entries(totalByMonedaConIva)
            .map(([m, v]) => `${v.toLocaleString("es-UY", { minimumFractionDigits: 2 })} ${m}`)
            .join("   ·   ");
          doc.font("Helvetica-Bold").fontSize(10).fillColor("#1e3a5f");
          doc.text("Total con IVA:", 50, rowY, { width: 340, lineBreak: false });
          doc.text(totConIvaStr, Cp.subtotal.x - 95, rowY, { width: Cp.subtotal.w + 95, lineBreak: false, align: "right" });
        }

        doc.end();
      });

      const stats = await fsPromises.stat(absolutePath);

      // Versionado por stream (con/sin precios son streams independientes:
      // cada modo mantiene su propia secuencia y soft-delete sólo afecta a su
      // mismo stream — el PDF "con precios" no pisa al "sin precios").
      const toolSourceKey = withPrices ? "materiales-con-precios" : "materiales-sin-precios";
      const previousAttachments = await prisma.fileAttachment.findMany({
        where: { projectId: id, toolSource: toolSourceKey, deletedAt: null },
        select: { id: true, url: true, toolVersion: true },
      });
      const lastVersion = previousAttachments.reduce(
        (max, a) => Math.max(max, a.toolVersion ?? 0),
        0,
      );
      const nextVersion = lastVersion + 1;

      // Registrar en FileAttachment con tipo LISTA_MATERIALES + tool metadata
      // para que aparezca con badge "Ingeniería · Materiales vN" en Documentos.
      const attachment = await prisma.fileAttachment.create({
        data: {
          projectId: id,
          filename: displayName + ".pdf",
          storedFilename,
          mimeType: "application/pdf",
          sizeBytes: stats.size,
          url: `${id}/${storedFilename}`,
          tipo: FileAttachmentTipo.LISTA_MATERIALES,
          toolSource: toolSourceKey,
          toolVersion: nextVersion,
          uploadedById: user.id,
        },
      });

      // Soft-delete versiones previas del mismo stream (mismo toolSource).
      // Borra también el archivo físico best-effort para liberar storage.
      if (previousAttachments.length > 0) {
        await prisma.fileAttachment.updateMany({
          where: { id: { in: previousAttachments.map((a) => a.id) } },
          data: { deletedAt: new Date() },
        });
        await Promise.all(
          previousAttachments.map((a) => deleteStoredFile(a.url).catch(() => undefined)),
        );
      }

      await createAuditEntry({
        entityType: AuditEntityType.file,
        entityId: attachment.id,
        projectId: id,
        userId: user.id,
        action: AuditAction.file_uploaded,
        description: `Generó PDF "Lista de materiales${withPrices ? " (con precios)" : " (sin precios)"}" v${nextVersion} para ${project.clientName}`,
      });

      reply.header("Content-Type", "application/pdf");
      reply.header("Content-Disposition", `attachment; filename="${displayName}.pdf"`);
      reply.header("X-File-Id", attachment.id);
      return reply.send(fs.createReadStream(absolutePath));
    });

    // ─── Calculadora de triángulos: guardar JPG + PDF ─────────────────────────
    //
    // Recibe el SVG ya renderizado del frontend + el JPG ya convertido vía
    // canvas (base64). Genera un PDF con pdfkit incluyendo la imagen y la
    // tabla de medidas, guarda ambos archivos en el storage del proyecto y
    // crea dos registros FileAttachment tipo CALCULO_TRIANGULOS.

    app.post("/projects/:id/triangle-calculation/save", { preHandler: authorize(Module.INGENIERIA, Action.EDIT) }, async (request, reply) => {
      const user = ensureUser(request);
      const { id } = z.object({ id: z.string() }).parse(request.params);

      const triangleSchema = z.object({
        mode: z.enum(["L-angle", "L-height", "height-angle"]),
        unit: z.enum(["mm", "cm", "m"]),
        values: z.object({
          L: z.number().positive().optional(),
          height: z.number().positive().optional(),
          angle: z.number().positive().optional(),
        }),
        result: z.object({
          L: z.number().positive(),
          height: z.number().positive(),
          angle: z.number().positive(),
          backLeg: z.number().positive(),
          totalMaterial: z.number().positive(),
        }),
        svgString: z.string().min(1),
        jpgBase64: z.string().min(1),
      }).strict();
      const body = triangleSchema.parse(request.body);

      const project = await prisma.project.findFirst({
        where: { id, deletedAt: null },
        select: { id: true, clientName: true, code: true },
      });
      if (!project) throw notFound("PROJECT_NOT_FOUND", "Proyecto no encontrado");

      const storageRoot = path.resolve(process.cwd(), "..", env.storagePath, id);
      await fsPromises.mkdir(storageRoot, { recursive: true });

      const ts = Date.now();
      const dateLabel = new Date().toISOString().slice(0, 10);
      const jpgFilename = `triangulo-${ts}.jpg`;
      const pdfFilename = `triangulo-${ts}.pdf`;
      const jpgPath = path.join(storageRoot, jpgFilename);
      const pdfPath = path.join(storageRoot, pdfFilename);

      // Decodificar JPG base64 ("data:image/jpeg;base64,XXX" o "XXX")
      const jpgPayload = body.jpgBase64.startsWith("data:")
        ? body.jpgBase64.split(",")[1] ?? ""
        : body.jpgBase64;
      const jpgBuffer = Buffer.from(jpgPayload, "base64");
      if (jpgBuffer.length === 0) {
        throw badRequest("INVALID_JPG", "El JPG enviado está vacío");
      }
      await fsPromises.writeFile(jpgPath, jpgBuffer);

      // Generar PDF con pdfkit incluyendo la imagen y la tabla de medidas
      await new Promise<void>((resolve, reject) => {
        const doc = new PDFDocument({ margin: 50, size: "A4" });
        const ws = fs.createWriteStream(pdfPath);
        doc.pipe(ws);
        ws.on("finish", resolve);
        ws.on("error", reject);
        doc.on("error", reject);

        // Header
        doc.font("Helvetica-Bold").fontSize(16).text("Cálculo de triángulo de aluminio", 50, 50, { align: "center", width: 495 });
        doc.font("Helvetica-Bold").fontSize(11).text(project.clientName, 50, 72, { align: "center", width: 495 });
        doc.font("Helvetica").fontSize(9).fillColor("#666666")
          .text(`Generado el ${new Date().toLocaleDateString("es-UY", { day: "2-digit", month: "long", year: "numeric" })}`, 50, 88, { align: "center", width: 495 });
        doc.fillColor("#000000");

        // Imagen del triángulo (centrada)
        try {
          doc.image(jpgBuffer, 70, 115, { fit: [455, 290], align: "center" });
        } catch {
          doc.font("Helvetica").fontSize(10).fillColor("#dc2626")
            .text("(No se pudo embeber la imagen del triángulo)", 50, 200, { align: "center", width: 495 });
          doc.fillColor("#000000");
        }

        // Tabla de medidas
        const tableY = 430;
        const u = body.unit;
        const fmt = (n: number, dec: number = 2) =>
          n.toLocaleString("es-UY", { minimumFractionDigits: dec, maximumFractionDigits: dec });

        doc.font("Helvetica-Bold").fontSize(11).fillColor("#1e3a5f")
          .text("Medidas calculadas", 50, tableY, { width: 495 });
        doc.fillColor("#000000");

        const rows: Array<[string, string]> = [
          ["Lado L (base e inclinado)", `${fmt(body.result.L)} ${u}`],
          ["Altura vertical", `${fmt(body.result.height)} ${u}`],
          ["Lado posterior", `${fmt(body.result.backLeg)} ${u}`],
          ["Ángulo de inclinación", `${fmt(body.result.angle, 1)}°`],
          ["Material total de aluminio (L + L + posterior)", `${fmt(body.result.totalMaterial)} ${u}`],
        ];

        let y = tableY + 22;
        for (const [label, value] of rows) {
          doc.font("Helvetica").fontSize(10).fillColor("#000000")
            .text(label, 60, y, { width: 320, lineBreak: false });
          doc.font("Helvetica-Bold").fontSize(10)
            .text(value, 380, y, { width: 165, lineBreak: false, align: "right" });
          y += 20;
        }

        // Pie con info del cálculo
        doc.font("Helvetica").fontSize(8).fillColor("#888888")
          .text(`Modo de cálculo: ${body.mode} · Unidad: ${u}`, 50, 770, { width: 495, align: "center" });

        doc.end();
      });

      const jpgStats = await fsPromises.stat(jpgPath);
      const pdfStats = await fsPromises.stat(pdfPath);

      const displayBase = `Cálculo triángulo ${dateLabel}`;

      // Versionado del cálculo de triángulos. JPG y PDF comparten toolVersion
      // porque representan la misma "versión" del cálculo. Sólo queda la
      // última: las anteriores se soft-deletean y se borran físicamente.
      const previousTriangleAttachments = await prisma.fileAttachment.findMany({
        where: { projectId: id, toolSource: "triangulos", deletedAt: null },
        select: { id: true, url: true, toolVersion: true },
      });
      const nextTriangleVersion =
        previousTriangleAttachments.reduce((max, a) => Math.max(max, a.toolVersion ?? 0), 0) + 1;

      const [jpgAttachment, pdfAttachment] = await Promise.all([
        prisma.fileAttachment.create({
          data: {
            projectId: id,
            filename: `${displayBase}.jpg`,
            storedFilename: jpgFilename,
            mimeType: "image/jpeg",
            sizeBytes: jpgStats.size,
            url: `${id}/${jpgFilename}`,
            tipo: FileAttachmentTipo.CALCULO_TRIANGULOS,
            toolSource: "triangulos",
            toolVersion: nextTriangleVersion,
            uploadedById: user.id,
          },
        }),
        prisma.fileAttachment.create({
          data: {
            projectId: id,
            filename: `${displayBase}.pdf`,
            storedFilename: pdfFilename,
            mimeType: "application/pdf",
            sizeBytes: pdfStats.size,
            url: `${id}/${pdfFilename}`,
            tipo: FileAttachmentTipo.CALCULO_TRIANGULOS,
            toolSource: "triangulos",
            toolVersion: nextTriangleVersion,
            uploadedById: user.id,
          },
        }),
      ]);

      if (previousTriangleAttachments.length > 0) {
        await prisma.fileAttachment.updateMany({
          where: { id: { in: previousTriangleAttachments.map((a) => a.id) } },
          data: { deletedAt: new Date() },
        });
        await Promise.all(
          previousTriangleAttachments.map((a) => deleteStoredFile(a.url).catch(() => undefined)),
        );
      }

      await createAuditEntry({
        entityType: AuditEntityType.file,
        entityId: pdfAttachment.id,
        projectId: id,
        userId: user.id,
        action: AuditAction.file_uploaded,
        description: `Guardó cálculo de triángulo v${nextTriangleVersion} (L=${body.result.L.toFixed(2)} ${body.unit}, h=${body.result.height.toFixed(2)} ${body.unit}, θ=${body.result.angle.toFixed(1)}°)`,
      });

      reply.code(201);
      return { jpgFileId: jpgAttachment.id, pdfFileId: pdfAttachment.id };
    });

    // ─── Costos del proyecto (basado en consumos de stock) ────────────────────
    //
    // Calcula el costo real consumido por un proyecto a partir de los
    // StockMovements de tipo EGRESO vinculados (no reversed). Cada egreso se
    // valora con el costoUnitario que tenía el ítem al consumirse, o si no hay
    // costo grabado, con el precioSugerido actual del MaterialItem como
    // fallback.

    app.get("/projects/:id/cost-summary", { preHandler: authorize(Module.OPERACIONES, Action.VIEW) }, async (request) => {
      const { id } = z.object({ id: z.string() }).parse(request.params);
      const project = await prisma.project.findFirst({
        where: { id, deletedAt: null },
        select: { id: true, code: true, clientName: true, budgetUsd: true },
      });
      if (!project) throw notFound("PROJECT_NOT_FOUND", "Proyecto no encontrado");

      const lastRate = await prisma.exchangeRate.findFirst({ orderBy: { createdAt: "desc" } });
      const fallbackRate = lastRate ? (decimalToNumber(lastRate.usdToUyu) ?? 1) : 1;
      function toUsd(amount: number, moneda: Moneda): number {
        if (moneda === Moneda.USD) return amount;
        return fallbackRate > 0 ? amount / fallbackRate : amount;
      }
      const r2 = (n: number) => Math.round(n * 100) / 100;

      // ───── PREVISTO: ProjectMaterials del proyecto ──────────────────────────
      const projectMaterials = await prisma.projectMaterial.findMany({
        where: { projectId: id },
        include: {
          materialItem: {
            select: {
              id: true, nombre: true, unidad: true,
              category: { select: { id: true, nombre: true, orden: true } },
            },
          },
        },
        orderBy: { createdAt: "asc" },
      });

      let costoPrevistoUSD = 0;
      let costoPrevistoUYU = 0;
      let costoPrevistoConIvaUSD = 0;
      let costoPrevistoConIvaUYU = 0;
      const previstoByCat = new Map<string, { id: string; nombre: string; orden: number; totalUSD: number; totalConIvaUSD: number; itemCount: number }>();
      const previstoByItem = new Map<string, {
        materialItemId: string; nombre: string; unidad: string;
        categoryId: string | null; categoryName: string;
        quantity: number; unitPrice: number; moneda: Moneda;
        ivaTasa: number;
        subtotal: number; subtotalUSD: number; subtotalConIvaUSD: number;
      }>();
      for (const pm of projectMaterials) {
        const qty = Number(pm.quantity);
        const price = Number(pm.unitPrice);
        const subtotal = qty * price;
        const subtotalUSD = toUsd(subtotal, pm.moneda);
        const ivaFactor = 1 + (pm.ivaTasa ?? 22) / 100;
        const subtotalConIva = subtotal * ivaFactor;
        const subtotalConIvaUSD = subtotalUSD * ivaFactor;
        if (pm.moneda === Moneda.USD) { costoPrevistoUSD += subtotal; costoPrevistoConIvaUSD += subtotalConIva; }
        else { costoPrevistoUYU += subtotal; costoPrevistoConIvaUYU += subtotalConIva; }

        const cat = pm.materialItem.category;
        if (cat) {
          const c = previstoByCat.get(cat.id) ?? { id: cat.id, nombre: cat.nombre, orden: cat.orden, totalUSD: 0, totalConIvaUSD: 0, itemCount: 0 };
          c.totalUSD += subtotalUSD;
          c.totalConIvaUSD += subtotalConIvaUSD;
          c.itemCount += 1;
          previstoByCat.set(cat.id, c);
        }

        // Acumular por ítem (en caso de tener el mismo ítem en varias filas)
        const existing = previstoByItem.get(pm.materialItemId);
        if (existing) {
          existing.quantity += qty;
          existing.subtotal += subtotal;
          existing.subtotalUSD += subtotalUSD;
          existing.subtotalConIvaUSD += subtotalConIvaUSD;
        } else {
          previstoByItem.set(pm.materialItemId, {
            materialItemId: pm.materialItemId,
            nombre: pm.materialItem.nombre,
            unidad: pm.materialItem.unidad,
            categoryId: cat?.id ?? null,
            categoryName: cat?.nombre ?? "—",
            quantity: qty,
            unitPrice: price,
            moneda: pm.moneda,
            ivaTasa: pm.ivaTasa ?? 22,
            subtotal,
            subtotalUSD,
            subtotalConIvaUSD,
          });
        }
      }
      const costoPrevistoTotalUSD = costoPrevistoUSD + toUsd(costoPrevistoUYU, Moneda.UYU);
      const costoPrevistoTotalConIvaUSD = costoPrevistoConIvaUSD + toUsd(costoPrevistoConIvaUYU, Moneda.UYU);
      const budgetUsd = project.budgetUsd ? decimalToNumber(project.budgetUsd) : null;
      const margenPrevistoUSD = budgetUsd != null ? r2(budgetUsd - costoPrevistoTotalUSD) : null;
      const margenPrevistoPercent = budgetUsd != null && budgetUsd > 0 ? Math.round((margenPrevistoUSD! / budgetUsd) * 1000) / 10 : null;

      // ───── REAL: StockMovements EGRESO no reversed ──────────────────────────
      const movs = await prisma.stockMovement.findMany({
        where: { projectId: id, tipo: TipoMovimientoStock.EGRESO, reversed: false },
        include: {
          materialItem: {
            select: {
              id: true, nombre: true, unidad: true,
              precioSugerido: true, moneda: true, ivaTasa: true,
              category: { select: { id: true, nombre: true, orden: true } },
            },
          },
        },
        orderBy: { fecha: "desc" },
      });

      let costoRealUSD = 0;
      let costoRealUYU = 0;
      let costoRealConIvaUSD = 0;
      let costoRealConIvaUYU = 0;
      const realByCat = new Map<string, { id: string; nombre: string; orden: number; totalUSD: number; totalConIvaUSD: number; itemCount: number }>();
      const realByItem = new Map<string, {
        materialItemId: string; nombre: string; unidad: string;
        categoryId: string | null; categoryName: string;
        quantity: number; subtotalUSD: number; subtotalConIvaUSD: number;
        moneda: Moneda; subtotal: number; ivaTasa: number;
      }>();

      const movements = movs.map((m) => {
        const cantidad = Number(m.cantidad);
        const unitPrice = m.costoUnitario != null
          ? Number(m.costoUnitario)
          : (m.materialItem.precioSugerido != null ? Number(m.materialItem.precioSugerido) : 0);
        const subtotal = cantidad * unitPrice;
        const moneda = m.moneda;
        const subtotalUSD = toUsd(subtotal, moneda);
        const ivaTasa = m.materialItem.ivaTasa ?? 22;
        const ivaFactor = 1 + ivaTasa / 100;
        const subtotalConIva = subtotal * ivaFactor;
        const subtotalConIvaUSD = subtotalUSD * ivaFactor;

        if (moneda === Moneda.USD) { costoRealUSD += subtotal; costoRealConIvaUSD += subtotalConIva; }
        else { costoRealUYU += subtotal; costoRealConIvaUYU += subtotalConIva; }

        const cat = m.materialItem.category;
        if (cat) {
          const c = realByCat.get(cat.id) ?? { id: cat.id, nombre: cat.nombre, orden: cat.orden, totalUSD: 0, totalConIvaUSD: 0, itemCount: 0 };
          c.totalUSD += subtotalUSD;
          c.totalConIvaUSD += subtotalConIvaUSD;
          c.itemCount += 1;
          realByCat.set(cat.id, c);
        }

        const existing = realByItem.get(m.materialItemId);
        if (existing) {
          existing.quantity += cantidad;
          existing.subtotal += subtotal;
          existing.subtotalUSD += subtotalUSD;
          existing.subtotalConIvaUSD += subtotalConIvaUSD;
        } else {
          realByItem.set(m.materialItemId, {
            materialItemId: m.materialItemId,
            nombre: m.materialItem.nombre,
            unidad: m.materialItem.unidad,
            categoryId: cat?.id ?? null,
            categoryName: cat?.nombre ?? "—",
            quantity: cantidad,
            moneda,
            subtotal,
            subtotalUSD,
            subtotalConIvaUSD,
            ivaTasa,
          });
        }

        return {
          id: m.id,
          materialItemId: m.materialItemId,
          materialItemName: m.materialItem.nombre,
          unidad: m.materialItem.unidad,
          categoryName: m.materialItem.category?.nombre ?? "—",
          quantity: cantidad,
          unitPrice,
          moneda,
          ivaTasa,
          subtotal: r2(subtotal),
          subtotalUSD: r2(subtotalUSD),
          subtotalConIva: r2(subtotalConIva),
          subtotalConIvaUSD: r2(subtotalConIvaUSD),
          fecha: serializeDate(m.fecha),
          priceSource: m.costoUnitario != null ? "movement" : "catalog",
        };
      });

      const costoRealTotalUSD = costoRealUSD + toUsd(costoRealUYU, Moneda.UYU);
      const costoRealTotalConIvaUSD = costoRealConIvaUSD + toUsd(costoRealConIvaUYU, Moneda.UYU);
      const margenRealUSD = budgetUsd != null ? r2(budgetUsd - costoRealTotalUSD) : null;
      const margenRealPercent = budgetUsd != null && budgetUsd > 0 ? Math.round((margenRealUSD! / budgetUsd) * 1000) / 10 : null;

      // ───── Comparación por ítem (previsto vs real) ──────────────────────────
      const allItemIds = new Set<string>([...previstoByItem.keys(), ...realByItem.keys()]);
      const comparacionPorItem = Array.from(allItemIds).map((itemId) => {
        const prev = previstoByItem.get(itemId);
        const real = realByItem.get(itemId);
        const nombre = prev?.nombre ?? real?.nombre ?? "—";
        const unidad = prev?.unidad ?? real?.unidad ?? "";
        const categoryName = prev?.categoryName ?? real?.categoryName ?? "—";
        const qPrev = prev?.quantity ?? 0;
        const qReal = real?.quantity ?? 0;
        const usdPrev = prev?.subtotalUSD ?? 0;
        const usdReal = real?.subtotalUSD ?? 0;
        const usdPrevConIva = prev?.subtotalConIvaUSD ?? 0;
        const usdRealConIva = real?.subtotalConIvaUSD ?? 0;
        return {
          materialItemId: itemId,
          nombre,
          unidad,
          categoryName,
          quantityPrevista: qPrev,
          quantityReal: qReal,
          quantityDiff: qReal - qPrev,
          subtotalPrevistoUSD: r2(usdPrev),
          subtotalRealUSD: r2(usdReal),
          subtotalDiffUSD: r2(usdReal - usdPrev),
          subtotalPrevistoConIvaUSD: r2(usdPrevConIva),
          subtotalRealConIvaUSD: r2(usdRealConIva),
          subtotalDiffConIvaUSD: r2(usdRealConIva - usdPrevConIva),
        };
      }).sort((a, b) => a.nombre.localeCompare(b.nombre));

      return {
        project: { id: project.id, code: project.code, clientName: project.clientName },
        budgetUsd,
        // PREVISTO (lista de Ingeniería)
        costoPrevistoUSD: r2(costoPrevistoUSD),
        costoPrevistoUYU: r2(costoPrevistoUYU),
        costoPrevistoTotalUSD: r2(costoPrevistoTotalUSD),
        costoPrevistoConIvaUSD: r2(costoPrevistoConIvaUSD),
        costoPrevistoConIvaUYU: r2(costoPrevistoConIvaUYU),
        costoPrevistoTotalConIvaUSD: r2(costoPrevistoTotalConIvaUSD),
        margenPrevistoUSD,
        margenPrevistoPercent,
        // REAL (consumos de stock)
        costoRealUSD: r2(costoRealUSD),
        costoRealUYU: r2(costoRealUYU),
        costoRealTotalUSD: r2(costoRealTotalUSD),
        costoRealConIvaUSD: r2(costoRealConIvaUSD),
        costoRealConIvaUYU: r2(costoRealConIvaUYU),
        costoRealTotalConIvaUSD: r2(costoRealTotalConIvaUSD),
        margenRealUSD,
        margenRealPercent,
        // Compatibilidad: campos viejos que la UI antigua todavía consume
        totalUsedUSD: r2(costoRealUSD),
        totalUsedUYU: r2(costoRealUYU),
        totalUsedUsdAll: r2(costoRealTotalUSD),
        marginUSD: margenRealUSD,
        marginPercent: margenRealPercent,
        itemCount: movements.length,
        exchangeRate: lastRate ? { usdToUyu: fallbackRate, date: serializeDate(lastRate.date) } : null,
        // Desgloses
        desglose: {
          previstoPorCategoria: Array.from(previstoByCat.values()).sort((a, b) => a.orden - b.orden).map((c) => ({
            id: c.id, nombre: c.nombre, totalUSD: r2(c.totalUSD), totalConIvaUSD: r2(c.totalConIvaUSD), itemCount: c.itemCount,
          })),
          realPorCategoria: Array.from(realByCat.values()).sort((a, b) => a.orden - b.orden).map((c) => ({
            id: c.id, nombre: c.nombre, totalUSD: r2(c.totalUSD), totalConIvaUSD: r2(c.totalConIvaUSD), itemCount: c.itemCount,
          })),
          comparacionPorItem,
          consumosDeStock: movements,
        },
        // Compatibilidad con la UI vieja
        byCategoryUSD: Array.from(realByCat.values()).sort((a, b) => a.orden - b.orden).map((c) => ({
          id: c.id, nombre: c.nombre, totalUSD: r2(c.totalUSD), itemCount: c.itemCount,
        })),
        movements,
      };
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
      pagado: z.boolean().optional(),
      cobrado: z.boolean().default(false),
      impactaFlujo: z.boolean().default(true),
      status: z.nativeEnum(FinanceMovementStatus).optional(),
      expectedDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
      dueDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
      projectId: z.string().optional(),
      supplierId: z.string().optional(),
      accountId: z.string().optional(),
      observaciones: z.string().optional(),
      estadoAprobacion: z.nativeEnum(EstadoAprobacion).default(EstadoAprobacion.REGISTRADO),
      archivoAdjuntoUrl: z.string().optional(),
      fixedCostId: z.string().optional(),
      // Si viene seteado y el movimiento es GASTO + PAGADO con proveedor + cuenta,
      // el monto del form se trata como Payment total: se distribuye entre las
      // facturas pendientes indicadas y, si sobra, se crea el movimiento nuevo
      // con el restante. Si no sobra (todo se aplicó a pendientes), no se crea
      // el movimiento nuevo (el flujo equivale a "Registrar pago" desde Pagos).
      applyToPendingInvoices: z.array(z.object({
        movementId: z.string(),
        monto: z.coerce.number().positive(),
      })).optional(),
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
      status: z.nativeEnum(FinanceMovementStatus).optional(),
      expectedDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable().optional(),
      dueDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable().optional(),
      projectId: z.string().nullable().optional(),
      supplierId: z.string().nullable().optional(),
      accountId: z.string().nullable().optional(),
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
        status: z.nativeEnum(FinanceMovementStatus).optional(),
        projectId: z.string().optional(),
        supplierId: z.string().optional(),
        accountId: z.string().optional(),
        rowType: z.enum(["MOVEMENT", "PAYMENT", "ALL"]).optional(),
        page: z.coerce.number().int().positive().optional(),
        limit: z.coerce.number().int().positive().max(5000).optional(),
      }).parse(request.query);

      const take = query.limit ?? 20;

      // Filtros que aplican a MOVEMENT.
      const where: Prisma.FinanceMovementWhereInput = {
        deletedAt: null,
        ...(query.mes ? { mes: query.mes } : {}),
        ...(query.anio ? { anio: query.anio } : {}),
        ...(query.tipo ? { tipoMovimiento: query.tipo } : {}),
        ...(query.categoria ? { categoriaPrincipal: query.categoria } : {}),
        ...(query.status ? { status: query.status } : {}),
        ...(query.projectId ? { projectId: query.projectId } : {}),
        ...(query.supplierId ? { supplierId: query.supplierId } : {}),
        ...(query.accountId ? { accountId: query.accountId } : {}),
      };

      // Filtro base de la nueva vista de Movimientos: SOLO lo ejecutado
      // (PAGADO). Los compromisos pendientes (A_PAGAR, PREVISTO) se gestionan
      // desde la pestaña Pendientes. Aplica solo si el cliente no mandó status
      // explícito; mantiene compatibilidad con consumidores legacy.
      if (!query.status) {
        where.status = FinanceMovementStatus.PAGADO;
      }

      // Decidimos si incluir Payments en la respuesta. Excluimos cuando hay
      // filtros movement-only (categoria/status/projectId) o cuando se filtra
      // por un tipo que no es GASTO (Payments siempre representan egresos).
      const includePayments = query.rowType !== "MOVEMENT"
        && !query.categoria
        && !query.status
        && !query.projectId
        && (query.tipo === undefined || query.tipo === TipoMovimiento.GASTO);
      const onlyPayments = query.rowType === "PAYMENT";

      // Para Payments construimos un where equivalente.
      const paymentWhere: Prisma.PaymentWhereInput = {
        deletedAt: null,
        ...(query.supplierId ? { supplierId: query.supplierId } : {}),
        ...(query.accountId ? { accountId: query.accountId } : {}),
      };
      // mes/anio: convertimos a rango de fechas
      if (query.mes && query.anio) {
        const start = new Date(Date.UTC(query.anio, query.mes - 1, 1));
        const end = new Date(Date.UTC(query.anio, query.mes, 1));
        paymentWhere.fecha = { gte: start, lt: end };
      } else if (query.anio) {
        const start = new Date(Date.UTC(query.anio, 0, 1));
        const end = new Date(Date.UTC(query.anio + 1, 0, 1));
        paymentWhere.fecha = { gte: start, lt: end };
      }

      const [allMovements, balanceRows, allPayments, lastRate] = await prisma.$transaction([
        prisma.financeMovement.findMany({
          where: onlyPayments ? { id: "__never__" } : where,
          include: {
            project: { select: { id: true, clientName: true, code: true } },
            supplier: { select: { id: true, nombre: true } },
            subcategoria: { select: { id: true, nombre: true, categoria: true } },
            materialItem: { select: { id: true, nombre: true, unidad: true } },
            paymentApplications: {
              include: { payment: { select: { id: true, deletedAt: true } } },
              where: { payment: { deletedAt: null } },
            },
          },
          orderBy: [{ fecha: "desc" }, { createdAt: "desc" }],
        }),
        prisma.financeMovement.findMany({
          where: { deletedAt: null },
          select: {
            id: true,
            fecha: true,
            createdAt: true,
            tipoMovimiento: true,
            status: true,
            cobrado: true,
            expectedDate: true,
            dueDate: true,
            monto: true,
            moneda: true,
            ivaTasa: true,
            tipoCambio: true,
            paymentApplications: {
              select: {
                id: true,
                montoAplicado: true,
                payment: { select: { deletedAt: true } },
              },
              where: { payment: { deletedAt: null } },
            },
          },
        }),
        includePayments
          ? prisma.payment.findMany({
              where: paymentWhere,
              include: {
                supplier: { select: { id: true, nombre: true } },
                account: { select: { id: true, nombre: true, moneda: true } },
                applications: {
                  include: { movement: { select: { id: true, descripcion: true, monto: true, moneda: true } } },
                },
              },
              orderBy: [{ fecha: "desc" }, { createdAt: "desc" }],
            })
          : prisma.payment.findMany({ where: { id: "__never__" } }),
        prisma.exchangeRate.findFirst({ orderBy: { createdAt: "desc" } }),
      ]);

      // Lookup: id de movement → tiene PaymentApplication activa.
      // Se usa para:
      //   1. En el saldo walk: el GASTO con app NO mueve saldoTemp (lo hace el Payment).
      //   2. En el render: saldoPendiente del GASTO.
      const movHasActiveApp = new Map<string, boolean>();
      for (const row of balanceRows) {
        movHasActiveApp.set(row.id, row.paymentApplications.length > 0);
      }

      // saldoMap es por clave compuesta `${type}:${id}` para evitar colisiones
      // (movements y payments usan cuid, no deberían colisionar pero por las dudas).
      const saldoMap = new Map<string, number>();
      const fechaEfectivaMap = new Map<string, string>();
      for (const row of balanceRows) {
        fechaEfectivaMap.set(`MOVEMENT:${row.id}`, getMovementEffectiveDate(row).toISOString().slice(0, 10));
      }
      for (const p of allPayments) {
        fechaEfectivaMap.set(`PAYMENT:${p.id}`, p.fecha.toISOString().slice(0, 10));
      }

      const parsedRate = lastRate ? decimalToNumber(lastRate.usdToUyu) : null;
      const fallbackUsdToUyu = parsedRate && parsedRate > 0 ? parsedRate : 1;
      const activeAccounts = await prisma.account.findMany({
        where: { deletedAt: null, activa: true },
        select: { id: true, moneda: true },
      });
      const accountBalances = await Promise.all(
        activeAccounts.map(async (account) => ({
          moneda: account.moneda,
          saldoActual: (await computeAccountBalance(account.id)).saldoActual,
        })),
      );

      let saldoActualCuentas = 0;
      let saldoActualUSD = 0;
      let saldoActualUYU = 0;
      for (const account of accountBalances) {
        if (account.moneda === Moneda.USD) {
          saldoActualUSD += account.saldoActual;
          saldoActualCuentas += account.saldoActual;
        } else {
          saldoActualUYU += account.saldoActual;
          saldoActualCuentas += fallbackUsdToUyu > 0 ? account.saldoActual / fallbackUsdToUyu : account.saldoActual;
        }
      }
      saldoActualCuentas = roundMoney(saldoActualCuentas);
      saldoActualUSD = roundMoney(saldoActualUSD);
      saldoActualUYU = roundMoney(saldoActualUYU);

      const today = todayUtc();

      // Past set (afectó el flujo): MOVEMENT concretados (incl. los que tienen
      // Payment app — informativos, no mueven saldo) + ALL Payments.
      // Sort DESC por fechaEfectiva, createdAt.
      type PastItem = (
        | { kind: "MOVEMENT"; row: typeof balanceRows[number]; fechaEfectiva: Date }
        | { kind: "PAYMENT"; row: typeof allPayments[number]; fechaEfectiva: Date }
      );
      const pastItems: PastItem[] = [];
      for (const row of balanceRows) {
        if (isMovementConcreted(row)) {
          pastItems.push({ kind: "MOVEMENT", row, fechaEfectiva: getMovementEffectiveDate(row) });
        }
      }
      for (const p of allPayments) {
        pastItems.push({ kind: "PAYMENT", row: p, fechaEfectiva: p.fecha });
      }
      pastItems.sort((a, b) => {
        const dt = b.fechaEfectiva.getTime() - a.fechaEfectiva.getTime();
        if (dt !== 0) return dt;
        // Tie-breaker 1: createdAt DESC
        const aCreated = a.row.createdAt.getTime();
        const bCreated = b.row.createdAt.getTime();
        if (aCreated !== bCreated) return bCreated - aCreated;
        // Tie-breaker 2: MOVEMENT antes que PAYMENT (si createdAt empata) para
        // que en pares Auto-Payment ambos muestren el saldo "después del pago"
        // (el movement no mueve saldo, el payment sí, así que el movement
        // primero permite que ambos vean el mismo saldo).
        if (a.kind !== b.kind) return a.kind === "MOVEMENT" ? -1 : 1;
        return 0;
      });

      const noConcretadosAsc = balanceRows
        .filter((row) => !isMovementConcreted(row))
        .sort((a, b) => {
          const timeDiff = getMovementEffectiveDate(a).getTime() - getMovementEffectiveDate(b).getTime();
          if (timeDiff !== 0) return timeDiff;
          return a.createdAt.getTime() - b.createdAt.getTime();
        });

      // Past loop unificado: walk DESC, set saldoMap, reverse efecto sólo para
      // items que afectan saldo (MOVEMENT GASTO/INGRESO sin app + PAYMENTs).
      let saldoTemp = saldoActualCuentas;
      for (const item of pastItems) {
        if (item.kind === "MOVEMENT") {
          const row = item.row;
          saldoMap.set(`MOVEMENT:${row.id}`, roundMoney(saldoTemp));
          const tieneApp = movHasActiveApp.get(row.id) ?? false;
          // Si tiene Payment activo, el saldo lo mueve el Payment. El movement
          // queda informativo (mismo saldo que el siguiente Payment).
          if (tieneApp && row.tipoMovimiento === TipoMovimiento.GASTO) continue;
          const montoUsdSinIva = convertMovementToUsd(row, fallbackUsdToUyu);
          if (row.tipoMovimiento === TipoMovimiento.GASTO) saldoTemp += montoUsdSinIva;
          else if (row.tipoMovimiento === TipoMovimiento.INGRESO) saldoTemp -= montoUsdSinIva;
          // AJUSTE no mueve saldo (criterio de computeAccountBalance).
          saldoTemp = roundMoney(saldoTemp);
        } else {
          // PAYMENT
          const p = item.row;
          saldoMap.set(`PAYMENT:${p.id}`, roundMoney(saldoTemp));
          const monto = decimalToNumber(p.monto) ?? 0;
          const montoUsd = p.moneda === Moneda.USD
            ? monto
            : (fallbackUsdToUyu > 0 ? monto / fallbackUsdToUyu : monto);
          saldoTemp += montoUsd; // reverse: el Payment fue una salida
          saldoTemp = roundMoney(saldoTemp);
        }
      }

      // Future loop (no concretados, ASC): proyectamos hacia adelante desde
      // saldoActualCuentas. Tracking paralelo CON IVA para los KPIs (G.7).
      // Para movements parcialmente pagados (con PaymentApplication activa)
      // proyectamos sólo saldoPendiente = monto - sum(applications), porque
      // la parte ya pagada está reflejada en el saldoActualCuentas vía Payments.
      saldoTemp = saldoActualCuentas;
      let saldoTempConIva = saldoActualCuentas;
      let saldoMinimoFuturo = saldoActualCuentas;
      let saldoMinimoFuturoSinIva = saldoActualCuentas;
      let fechaSaldoMinimoFuturo = serializeDateOnly(today);
      for (const row of noConcretadosAsc) {
        const aplicado = row.paymentApplications.reduce((s, pa) => s + Number(pa.montoAplicado), 0);
        const montoOriginal = Number(row.monto) || 0;
        const saldoPendiente = montoOriginal - aplicado;
        if (saldoPendiente <= 0.005) {
          // Totalmente pagado: el Payment ya impactó el saldo, no proyectamos.
          saldoMap.set(`MOVEMENT:${row.id}`, saldoTemp);
          continue;
        }
        const ratio = montoOriginal > 0 ? saldoPendiente / montoOriginal : 0;
        const montoUsdSinIva = convertMovementToUsd(row, fallbackUsdToUyu) * ratio;
        const montoUsdConIva = convertMovementToUsdConIva(row, fallbackUsdToUyu) * ratio;
        if (row.tipoMovimiento === TipoMovimiento.GASTO) {
          saldoTemp -= montoUsdSinIva;
          saldoTempConIva -= montoUsdConIva;
        } else if (row.tipoMovimiento === TipoMovimiento.INGRESO) {
          saldoTemp += montoUsdSinIva;
          saldoTempConIva += montoUsdConIva;
        }
        saldoTemp = roundMoney(saldoTemp);
        saldoTempConIva = roundMoney(saldoTempConIva);
        saldoMap.set(`MOVEMENT:${row.id}`, saldoTemp);
        if (saldoTempConIva < saldoMinimoFuturo) {
          saldoMinimoFuturo = saldoTempConIva;
          saldoMinimoFuturoSinIva = saldoTemp;
          fechaSaldoMinimoFuturo = fechaEfectivaMap.get(`MOVEMENT:${row.id}`) ?? fechaSaldoMinimoFuturo;
        }
      }
      const saldoFinalProyectado = roundMoney(saldoTempConIva);
      const saldoFinalProyectadoSinIva = roundMoney(saldoTemp);

      // Coherencia: el primer item del past (más reciente) debe tener saldoUSD == saldoActualCuentas.
      if (pastItems.length > 0) {
        const first = pastItems[0];
        const key = first.kind === "MOVEMENT" ? `MOVEMENT:${first.row.id}` : `PAYMENT:${first.row.id}`;
        const ultimoSaldo = saldoMap.get(key);
        if (ultimoSaldo !== undefined && Math.abs(ultimoSaldo - saldoActualCuentas) > 0.01) {
          app.log.warn(
            { ultimoSaldo, saldoActualCuentas, key },
            "Incoherencia: saldo del último item past no coincide con saldoActualCuentas",
          );
        }
      }
      const sinCuentasActivas = activeAccounts.length === 0;
      const usaFallbackTipoCambio = (!parsedRate || parsedRate <= 0)
        && (activeAccounts.some((account) => account.moneda === Moneda.UYU)
          || balanceRows.some((row) => row.moneda === Moneda.UYU));

      // ─── Construcción de items unificados ───────────────────────────────────
      type UnifiedItem = { fechaEfectiva: Date; createdAt: Date; isMovement: boolean; data: Record<string, unknown> };
      const unifiedItems: UnifiedItem[] = [];

      // Movements
      for (const m of allMovements) {
        const monto = decimalToNumber(m.monto) ?? 0;
        const montoPagado = m.tipoMovimiento === TipoMovimiento.GASTO
          ? Math.round(m.paymentApplications.reduce((acc, a) => acc + Number(a.montoAplicado), 0) * 100) / 100
          : 0;
        const saldoPendiente = m.tipoMovimiento === TipoMovimiento.GASTO
          ? Math.round((monto - montoPagado) * 100) / 100
          : monto;
        const tieneApp = movHasActiveApp.get(m.id) ?? false;
        // Pagado vía Payment: tiene application activa Y la suma cubre el monto
        // total (saldoPendiente <= 0). El saldo no se descuenta vía esta fila —
        // ya lo hizo el Payment correspondiente.
        const pagadoViaPayment = tieneApp && saldoPendiente <= 0.005;
        const paymentIdsAsociados = m.paymentApplications
          .filter((pa) => !pa.payment.deletedAt)
          .map((pa) => pa.payment.id);
        const real = isMovementConcreted(m);
        const { paymentApplications: _pa, ...rest } = m;
        void _pa;
        unifiedItems.push({
          fechaEfectiva: getMovementEffectiveDate(m),
          createdAt: m.createdAt,
          isMovement: true,
          data: {
            _type: "MOVEMENT",
            ...rest,
            monto,
            montoPagado,
            saldoPendiente,
            tieneApp,
            pagadoViaPayment,
            paymentIdsAsociados,
            saldoAcumuladoUSD: saldoMap.get(`MOVEMENT:${m.id}`) ?? 0,
            saldoEsReal: real,
            fechaEfectiva: fechaEfectivaMap.get(`MOVEMENT:${m.id}`) ?? serializeDateOnly(m.fecha),
            tipoCambio: m.tipoCambio ? decimalToNumber(m.tipoCambio) : null,
            quantity: m.quantity ? decimalToNumber(m.quantity) : null,
            unitPrice: m.unitPrice ? decimalToNumber(m.unitPrice) : null,
            fecha: serializeDateOnly(m.fecha),
            expectedDate: m.expectedDate ? serializeDateOnly(m.expectedDate) : null,
            dueDate: m.dueDate ? serializeDateOnly(m.dueDate) : null,
            createdAt: serializeDate(m.createdAt),
            updatedAt: serializeDate(m.updatedAt),
          },
        });
      }

      // Payments
      for (const p of allPayments) {
        const monto = decimalToNumber(p.monto) ?? 0;
        unifiedItems.push({
          fechaEfectiva: p.fecha,
          createdAt: p.createdAt,
          isMovement: false,
          data: {
            _type: "PAYMENT",
            id: p.id,
            fecha: serializeDateOnly(p.fecha),
            fechaEfectiva: serializeDateOnly(p.fecha),
            descripcion: `Pago a ${p.supplier?.nombre ?? "proveedor"}${p.referencia ? ` · ${p.referencia}` : ""}`,
            monto,
            moneda: p.moneda,
            metodo: p.metodo,
            referencia: p.referencia,
            notas: p.notas,
            supplierId: p.supplierId,
            supplier: p.supplier,
            accountId: p.accountId,
            account: p.account,
            applications: p.applications.map((a) => ({
              id: a.id,
              movementId: a.movementId,
              montoAplicado: Number(a.montoAplicado),
              movement: a.movement
                ? {
                    id: a.movement.id,
                    descripcion: a.movement.descripcion,
                    monto: Number(a.movement.monto),
                    moneda: a.movement.moneda,
                  }
                : null,
            })),
            saldoAcumuladoUSD: saldoMap.get(`PAYMENT:${p.id}`) ?? 0,
            saldoEsReal: true,
            createdAt: serializeDate(p.createdAt),
            updatedAt: serializeDate(p.updatedAt),
          },
        });
      }

      // Sort DESC por fecha efectiva, createdAt; tie-breaker MOVEMENT primero
      // (ver comentario en pastItems sort).
      unifiedItems.sort((a, b) => {
        const dt = b.fechaEfectiva.getTime() - a.fechaEfectiva.getTime();
        if (dt !== 0) return dt;
        const dtc = b.createdAt.getTime() - a.createdAt.getTime();
        if (dtc !== 0) return dtc;
        if (a.isMovement !== b.isMovement) return a.isMovement ? -1 : 1;
        return 0;
      });

      const total = unifiedItems.length;
      const page = query.page ?? 1;
      const startIdx = (page - 1) * take;
      const pageData = unifiedItems.slice(startIdx, startIdx + take).map((it) => it.data);

      return {
        data: pageData,
        total,
        page,
        limit: take,
        totalPages: Math.ceil(total / take),
        saldoActualCuentas,
        saldoActualUSD,
        saldoActualUYU,
        saldoFinalProyectado,
        saldoFinalProyectadoSinIva,
        saldoFinalUSD: saldoFinalProyectado,
        saldoMinimoFuturo,
        saldoMinimoFuturoSinIva,
        fechaSaldoMinimoFuturo,
        sinCuentasActivas,
        usaFallbackTipoCambio,
      };
    });

    /** Valida que si el movimiento "concreta dinero" (gasto pagado o ingreso
     *  cobrado), tenga accountId con misma moneda. */
    async function validateAccountForMovement(args: {
      tipoMovimiento: TipoMovimiento;
      status?: FinanceMovementStatus;
      cobrado: boolean;
      moneda: Moneda;
      accountId: string | null | undefined;
    }) {
      const concretaDinero =
        (args.tipoMovimiento === TipoMovimiento.GASTO && args.status === FinanceMovementStatus.PAGADO) ||
        (args.tipoMovimiento === TipoMovimiento.INGRESO && args.cobrado);
      if (!concretaDinero) return;
      if (!args.accountId) {
        throw badRequest(
          "ACCOUNT_REQUIRED",
          args.tipoMovimiento === TipoMovimiento.INGRESO
            ? "Para registrar un ingreso cobrado tenés que indicar la cuenta donde entró el dinero."
            : "Para registrar un gasto pagado tenés que indicar la cuenta de donde salió el dinero.",
        );
      }
      const account = await prisma.account.findFirst({ where: { id: args.accountId, deletedAt: null } });
      if (!account) throw badRequest("ACCOUNT_INVALID", "La cuenta seleccionada no existe");
      if (!account.activa) throw badRequest("ACCOUNT_INACTIVE", "La cuenta está inactiva");
      if (account.moneda !== args.moneda) {
        throw badRequest(
          "ACCOUNT_CURRENCY_MISMATCH",
          `La moneda del movimiento (${args.moneda}) no coincide con la de la cuenta (${account.moneda}).`,
        );
      }
    }

    // G.8: helper que crea un Payment + PaymentApplication automáticos para un
    // movimiento GASTO PAGADO con proveedor + cuenta. Se invoca al crear el
    // movimiento o al hacerlo transicionar a PAGADO sin pasar por el flujo manual.
    // Idempotente: el caller verifica que no haya ya applications activas.
    async function createAutoPaymentForMovement(
      tx: Prisma.TransactionClient,
      movement: {
        id: string;
        fecha: Date;
        monto: import("@prisma/client/runtime/library").Decimal;
        moneda: Moneda;
        tipoCambio: import("@prisma/client/runtime/library").Decimal | null;
        descripcion: string;
        supplierId: string;
        accountId: string;
      },
      userId: string,
    ) {
      const payment = await tx.payment.create({
        data: {
          supplierId: movement.supplierId,
          accountId: movement.accountId,
          fecha: movement.fecha,
          monto: movement.monto,
          moneda: movement.moneda,
          metodo: MetodoPago.OTRO,
          referencia: `Auto-pago: ${movement.descripcion}`.slice(0, 200),
          notas: "Pago automático generado al crear movimiento PAGADO directamente",
          createdById: userId,
        },
      });
      await tx.paymentApplication.create({
        data: {
          paymentId: payment.id,
          movementId: movement.id,
          montoAplicado: movement.monto,
        },
      });
      return payment;
    }

    app.post("/finance/movements", { preHandler: authorize(Module.FINANZAS, Action.CREATE) }, async (request) => {
      const user = ensureUser(request);
      const body = movementCreateSchema.parse(request.body);
      const fecha = parseDateOnly(body.fecha);
      const mes = fecha.getUTCMonth() + 1;
      const anio = fecha.getUTCFullYear();

      let tipoCambio = body.tipoCambio ? new Prisma.Decimal(body.tipoCambio) : null;
      if (body.moneda === Moneda.UYU && !tipoCambio) {
        const lastRate = await prisma.exchangeRate.findFirst({ orderBy: { createdAt: "desc" } });
        if (lastRate) tipoCambio = lastRate.usdToUyu;
      }

      // Derivar status / pagado coherentemente.
      // - Si status viene explícito, manda status; pagado = (status === PAGADO).
      // - Si no viene status, mantenemos compat: status = PAGADO si pagado=true, sino PAGADO por default.
      const status = body.status ?? (body.pagado === false ? FinanceMovementStatus.COMPROMETIDO : FinanceMovementStatus.PAGADO);
      const pagado = status === FinanceMovementStatus.PAGADO;

      // Validar cuenta si aplica
      await validateAccountForMovement({
        tipoMovimiento: body.tipoMovimiento,
        status,
        cobrado: body.cobrado,
        moneda: body.moneda,
        accountId: body.accountId,
      });
      // Si el movimiento de gasto arranca en A_PAGAR/PAGADO, marcamos que
      // requiere desglose de factura (la UI muestra alerta hasta que el
      // usuario cargue ítems o lo marque como "sin materiales").
      // Sólo GASTOS con proveedor: ajustes / gastos varios sin proveedor no
      // necesitan desglose de stock.
      const requiresItemDetail = body.tipoMovimiento === TipoMovimiento.GASTO
        && !!body.supplierId
        && (status === FinanceMovementStatus.A_PAGAR || status === FinanceMovementStatus.PAGADO);

      // G.8: si el movimiento se crea directamente PAGADO con proveedor + cuenta,
      // generamos el Payment + PaymentApplication automáticamente para que el
      // saldo del proveedor quede consistente (factura pagada en su totalidad).
      // Si además vienen facturas pendientes a aplicar (applyToPendingInvoices),
      // se reparte el pago entre ellas y, si sobra, sólo el sobrante queda como
      // movimiento nuevo. Si no sobra, no se crea movimiento nuevo (el pago va
      // íntegro a las pendientes, equivalente a "Registrar pago" desde Pagos).
      const applyToPending = body.applyToPendingInvoices ?? [];
      const useApplyMode =
        applyToPending.length > 0 &&
        body.tipoMovimiento === TipoMovimiento.GASTO &&
        status === FinanceMovementStatus.PAGADO &&
        !!body.supplierId &&
        !!body.accountId;
      const shouldAutoPayment =
        !useApplyMode &&
        body.tipoMovimiento === TipoMovimiento.GASTO &&
        status === FinanceMovementStatus.PAGADO &&
        !!body.supplierId &&
        !!body.accountId;

      if (applyToPending.length > 0 && !useApplyMode) {
        throw badRequest(
          "APPLY_INVALID_CONTEXT",
          "Sólo se pueden aplicar facturas pendientes en un GASTO PAGADO con proveedor y cuenta.",
        );
      }

      type CreatedMovement = Awaited<ReturnType<typeof prisma.financeMovement.create>>;
      const { movement, autoPayment, appliedPayment, applyDetails } = await prisma.$transaction(async (tx) => {
        if (useApplyMode) {
          // Validar facturas pendientes: mismo proveedor, misma moneda, saldo
          // pendiente >= monto a aplicar.
          const invoiceIds = applyToPending.map((a) => a.movementId);
          const invoices = await tx.financeMovement.findMany({
            where: { id: { in: invoiceIds }, deletedAt: null },
            include: {
              paymentApplications: { include: { payment: { select: { deletedAt: true } } } },
            },
          });
          const invoiceMap = new Map(invoices.map((i) => [i.id, i]));

          for (const a of applyToPending) {
            const inv = invoiceMap.get(a.movementId);
            if (!inv) {
              throw badRequest("INVOICE_NOT_FOUND", `La factura ${a.movementId} no existe o fue eliminada.`);
            }
            if (inv.tipoMovimiento !== TipoMovimiento.GASTO) {
              throw badRequest("INVOICE_INVALID_TYPE", "Sólo se pueden aplicar pagos a facturas de gasto.");
            }
            if (inv.supplierId !== body.supplierId) {
              throw badRequest("SUPPLIER_MISMATCH", "Las facturas pendientes deben ser del mismo proveedor.");
            }
            if (inv.moneda !== body.moneda) {
              throw badRequest("CURRENCY_MISMATCH", "Las facturas pendientes deben tener la misma moneda.");
            }
            const invMonto = decimalToNumber(inv.monto) ?? 0;
            const invAplicado = sumApplications(inv.paymentApplications.filter((p) => !p.payment.deletedAt));
            const invSaldo = Math.round((invMonto - invAplicado) * 100) / 100;
            if (a.monto > invSaldo + 0.005) {
              throw badRequest(
                "OVER_APPLIED_INVOICE",
                `La aplicación a la factura "${inv.descripcion}" excede su saldo pendiente (${invSaldo}).`,
              );
            }
          }

          const totalPago = body.monto;
          const sumApplied = Math.round(applyToPending.reduce((acc, a) => acc + a.monto, 0) * 100) / 100;
          if (sumApplied > totalPago + 0.005) {
            throw badRequest(
              "OVER_APPLIED",
              "La suma de aplicaciones a facturas pendientes excede el monto del pago.",
            );
          }
          const remainder = Math.round((totalPago - sumApplied) * 100) / 100;

          // Crear el Payment con el monto total de la salida de caja.
          const payment = await tx.payment.create({
            data: {
              supplierId: body.supplierId!,
              accountId: body.accountId!,
              fecha,
              monto: new Prisma.Decimal(totalPago),
              moneda: body.moneda,
              metodo: MetodoPago.OTRO,
              referencia: `Pago: ${body.descripcion}`.slice(0, 200),
              notas: "Pago generado al crear movimiento PAGADO con aplicación a facturas pendientes",
              createdById: user.id,
            },
          });

          // Aplicar Payment a cada factura pendiente.
          for (const a of applyToPending) {
            await tx.paymentApplication.create({
              data: {
                paymentId: payment.id,
                movementId: a.movementId,
                montoAplicado: new Prisma.Decimal(a.monto),
              },
            });
          }

          // Si sobra, crear movimiento nuevo con monto = sobrante y aplicar el sobrante.
          // Si no sobra, no se crea movimiento.
          let createdMovement: CreatedMovement | null = null;
          if (remainder > 0.005) {
            createdMovement = await tx.financeMovement.create({
              data: {
                fecha,
                mes,
                anio,
                tipoMovimiento: body.tipoMovimiento,
                categoriaPrincipal: body.categoriaPrincipal,
                subcategoriaId: body.subcategoriaId,
                descripcion: body.descripcion,
                monto: new Prisma.Decimal(remainder),
                moneda: body.moneda,
                tipoCambio,
                pagado: true,
                cobrado: body.cobrado,
                impactaFlujo: body.impactaFlujo,
                status: FinanceMovementStatus.PAGADO,
                expectedDate: body.expectedDate ? parseDateOnly(body.expectedDate) : null,
                dueDate: body.dueDate ? parseDateOnly(body.dueDate) : null,
                requiresItemDetail,
                projectId: body.projectId,
                supplierId: body.supplierId,
                accountId: body.accountId,
                observaciones: body.observaciones,
                estadoAprobacion: body.estadoAprobacion,
                archivoAdjuntoUrl: body.archivoAdjuntoUrl,
                creadoPorId: user.id,
              },
            });
            await tx.paymentApplication.create({
              data: {
                paymentId: payment.id,
                movementId: createdMovement.id,
                montoAplicado: new Prisma.Decimal(remainder),
              },
            });
          }

          // Recalcular status de cada factura afectada.
          for (const a of applyToPending) {
            await recalcMovementStatus(tx, a.movementId);
          }

          return {
            movement: createdMovement,
            autoPayment: null as null,
            appliedPayment: payment,
            applyDetails: { totalPago, sumApplied, remainder, count: applyToPending.length },
          };
        }

        const created = await tx.financeMovement.create({
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
            pagado,
            cobrado: body.cobrado,
            impactaFlujo: body.impactaFlujo,
            status,
            expectedDate: body.expectedDate ? parseDateOnly(body.expectedDate) : null,
            dueDate: body.dueDate ? parseDateOnly(body.dueDate) : null,
            requiresItemDetail,
            projectId: body.projectId,
            supplierId: body.supplierId,
            accountId: body.accountId,
            fixedCostId: body.fixedCostId,
            observaciones: body.observaciones,
            estadoAprobacion: body.estadoAprobacion,
            archivoAdjuntoUrl: body.archivoAdjuntoUrl,
            creadoPorId: user.id,
          },
        });

        let payment = null as Awaited<ReturnType<typeof createAutoPaymentForMovement>> | null;
        if (shouldAutoPayment) {
          payment = await createAutoPaymentForMovement(
            tx,
            {
              id: created.id,
              fecha: created.fecha,
              monto: created.monto,
              moneda: created.moneda,
              tipoCambio: created.tipoCambio,
              descripcion: created.descripcion,
              supplierId: body.supplierId!,
              accountId: body.accountId!,
            },
            user.id,
          );
        }
        return {
          movement: created,
          autoPayment: payment,
          appliedPayment: null as null,
          applyDetails: null as null,
        };
      });

      if (movement) {
        await createAuditEntry({
          entityType: AuditEntityType.finance_movement,
          entityId: movement.id,
          projectId: body.projectId,
          userId: user.id,
          action: AuditAction.created,
          description: `Registró movimiento: ${body.descripcion} por ${decimalToNumber(movement.monto)} ${body.moneda}`,
        });
      }

      if (autoPayment) {
        await createAuditEntry({
          entityType: AuditEntityType.finance_movement,
          entityId: autoPayment.id,
          projectId: body.projectId,
          userId: user.id,
          action: AuditAction.created,
          description: `Auto-pago generado para movimiento PAGADO ${movement?.id ?? ""}`,
          metadata: { autoGenerated: true, sourceMovementId: movement?.id ?? null },
        });
      }

      if (appliedPayment) {
        await createAuditEntry({
          entityType: AuditEntityType.finance_movement,
          entityId: appliedPayment.id,
          projectId: body.projectId,
          userId: user.id,
          action: AuditAction.created,
          description: movement
            ? `Pago de ${applyDetails?.totalPago} ${body.moneda} a ${applyDetails?.count} factura(s) pendiente(s) y movimiento nuevo ${movement.id}`
            : `Pago de ${applyDetails?.totalPago} ${body.moneda} aplicado íntegramente a ${applyDetails?.count} factura(s) pendiente(s)`,
          metadata: {
            appliedToInvoices: applyToPending,
            remainderToNewMovement: applyDetails?.remainder ?? 0,
          },
        });
      }

      void checkInvariantOrWarn("create movement", { movementId: movement?.id, paymentId: appliedPayment?.id ?? autoPayment?.id });

      const warnings = movement
        ? [detectPastDateNotPaidWarning(movement)].filter((w): w is NonNullable<typeof w> => w !== null)
        : [];

      if (movement) {
        return {
          ...movement,
          monto: decimalToNumber(movement.monto),
          tipoCambio: movement.tipoCambio ? decimalToNumber(movement.tipoCambio) : null,
          appliedToInvoices: applyDetails ? { count: applyDetails.count, total: applyDetails.sumApplied, remainder: applyDetails.remainder } : null,
          warnings,
        };
      }
      // Caso "movimiento no creado": el pago se aplicó íntegramente a facturas
      // pendientes. Devolvemos un payload distinto para que el front pueda
      // distinguir y mostrar el toast adecuado.
      return {
        skipped: true,
        message: "Pago aplicado íntegramente a facturas pendientes",
        paymentId: appliedPayment?.id ?? null,
        appliedToInvoices: applyDetails ? { count: applyDetails.count, total: applyDetails.sumApplied, remainder: 0 } : null,
      };
    });

    app.get("/finance/movements/:id", { preHandler: authorize(Module.FINANZAS, Action.VIEW) }, async (request) => {
      const { id } = z.object({ id: z.string() }).parse(request.params);
      const movement = await prisma.financeMovement.findFirst({
        where: { id, deletedAt: null },
        include: {
          project: { select: { id: true, clientName: true, code: true } },
          supplier: { select: { id: true, nombre: true } },
          subcategoria: true,
          paymentApplications: {
            include: {
              payment: {
                select: {
                  id: true, fecha: true, monto: true, moneda: true, metodo: true,
                  referencia: true, deletedAt: true,
                },
              },
            },
            orderBy: { createdAt: "desc" },
          },
          historial: { include: { user: { select: { id: true, name: true } } }, orderBy: { createdAt: "desc" } },
          comprobantes: { select: { id: true, numero: true, tipo: true, monto: true, moneda: true, estado: true } },
        },
      });
      if (!movement) throw notFound("MOVEMENT_NOT_FOUND", "Movimiento no encontrado");
      const activeApps = movement.paymentApplications.filter((a) => !a.payment.deletedAt);
      const montoPagado = activeApps.reduce((acc, a) => acc + Number(a.montoAplicado), 0);
      const monto = Number(movement.monto);
      return {
        ...movement,
        monto,
        tipoCambio: movement.tipoCambio ? decimalToNumber(movement.tipoCambio) : null,
        montoPagado: Math.round(montoPagado * 100) / 100,
        saldoPendiente: Math.round((monto - montoPagado) * 100) / 100,
        paymentApplications: movement.paymentApplications.map((a) => ({
          id: a.id,
          paymentId: a.paymentId,
          montoAplicado: Number(a.montoAplicado),
          createdAt: serializeDate(a.createdAt),
          payment: {
            id: a.payment.id,
            fecha: serializeDateOnly(a.payment.fecha),
            monto: Number(a.payment.monto),
            moneda: a.payment.moneda,
            metodo: a.payment.metodo,
            referencia: a.payment.referencia,
            deletedAt: a.payment.deletedAt ? serializeDate(a.payment.deletedAt) : null,
          },
        })),
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
        const d = parseDateOnly(body.fecha);
        updateData.fecha = d;
        updateData.mes = d.getUTCMonth() + 1;
        updateData.anio = d.getUTCFullYear();
      }
      if (body.monto !== undefined) updateData.monto = new Prisma.Decimal(body.monto);
      if (body.tipoCambio !== undefined) updateData.tipoCambio = body.tipoCambio ? new Prisma.Decimal(body.tipoCambio) : null;
      if (body.expectedDate !== undefined) updateData.expectedDate = body.expectedDate ? parseDateOnly(body.expectedDate) : null;
      if (body.dueDate !== undefined) updateData.dueDate = body.dueDate ? parseDateOnly(body.dueDate) : null;
      // Mantener pagado coherente con status si viene status pero no pagado explícito.
      if (body.status !== undefined && body.pagado === undefined) {
        updateData.pagado = body.status === FinanceMovementStatus.PAGADO;
      }

      // Validar cuenta sólo si el cambio concreta dinero. Tomamos los valores
      // efectivos (lo que viene en el body sino lo de existing).
      const effectiveStatus = body.status ?? existing.status;
      const effectiveCobrado = body.cobrado ?? existing.cobrado;
      const effectiveMoneda = body.moneda ?? existing.moneda;
      const effectiveAccountId = body.accountId !== undefined ? body.accountId : existing.accountId;
      const wasConcreto =
        (existing.tipoMovimiento === TipoMovimiento.GASTO && existing.status === FinanceMovementStatus.PAGADO) ||
        (existing.tipoMovimiento === TipoMovimiento.INGRESO && existing.cobrado);
      const willBeConcreto =
        (existing.tipoMovimiento === TipoMovimiento.GASTO && effectiveStatus === FinanceMovementStatus.PAGADO) ||
        (existing.tipoMovimiento === TipoMovimiento.INGRESO && effectiveCobrado);
      // Validamos cuando pasa a concretarse, o cuando ya estaba concreto y se
      // tocó accountId/moneda.
      if (willBeConcreto && (!wasConcreto || body.accountId !== undefined || body.moneda !== undefined)) {
        await validateAccountForMovement({
          tipoMovimiento: existing.tipoMovimiento,
          status: effectiveStatus,
          cobrado: effectiveCobrado,
          moneda: effectiveMoneda,
          accountId: effectiveAccountId,
        });
      }

      const updated = await prisma.financeMovement.update({ where: { id }, data: updateData });

      // G.8: si el movimiento pasó a PAGADO en este patch (desde otro estado)
      // y tiene proveedor + cuenta y NO había applications activas, generamos
      // el auto-Payment para mantener coherencia del saldo del proveedor.
      const wasNotPagado = existing.status !== FinanceMovementStatus.PAGADO;
      const isNowPagado = effectiveStatus === FinanceMovementStatus.PAGADO;
      if (
        wasNotPagado && isNowPagado &&
        existing.tipoMovimiento === TipoMovimiento.GASTO &&
        updated.supplierId &&
        updated.accountId
      ) {
        const existingAppsCount = await prisma.paymentApplication.count({
          where: { movementId: id, payment: { deletedAt: null } },
        });
        if (existingAppsCount === 0) {
          const autoPayment = await prisma.$transaction(async (tx) => {
            return createAutoPaymentForMovement(
              tx,
              {
                id: updated.id,
                fecha: updated.fecha,
                monto: updated.monto,
                moneda: updated.moneda,
                tipoCambio: updated.tipoCambio,
                descripcion: updated.descripcion,
                supplierId: updated.supplierId!,
                accountId: updated.accountId!,
              },
              user.id,
            );
          });
          await createAuditEntry({
            entityType: AuditEntityType.finance_movement,
            entityId: autoPayment.id,
            projectId: updated.projectId,
            userId: user.id,
            action: AuditAction.created,
            description: `Auto-pago generado al transicionar movimiento ${id} a PAGADO`,
            metadata: { autoGenerated: true, sourceMovementId: id },
          });
        }
      }

      await createAuditEntry({
        entityType: AuditEntityType.finance_movement,
        entityId: id,
        projectId: existing.projectId,
        userId: user.id,
        action: AuditAction.updated,
        description: `Actualizó movimiento: ${existing.descripcion}`,
      });
      void checkInvariantOrWarn("patch movement", { movementId: id });
      const patchWarning = detectPastDateNotPaidWarning(updated);
      const patchWarnings = patchWarning ? [patchWarning] : [];
      return {
        ...updated,
        monto: decimalToNumber(updated.monto),
        tipoCambio: updated.tipoCambio ? decimalToNumber(updated.tipoCambio) : null,
        warnings: patchWarnings,
      };
    });

    app.delete("/finance/movements/:id", { preHandler: authorize(Module.FINANZAS, Action.DELETE) }, async (request) => {
      const user = ensureUser(request);
      const { id } = z.object({ id: z.string() }).parse(request.params);
      const existing = await prisma.financeMovement.findFirst({
        where: { id, deletedAt: null },
        include: {
          paymentApplications: {
            where: { payment: { deletedAt: null } },
            select: { id: true, montoAplicado: true, paymentId: true },
          },
        },
      });
      if (!existing) throw notFound("MOVEMENT_NOT_FOUND", "Movimiento no encontrado");

      const apps = existing.paymentApplications;
      const liberadoTotal = apps.reduce((acc, a) => acc + Number(a.montoAplicado), 0);

      await prisma.$transaction(async (tx) => {
        if (apps.length > 0) {
          // Borrar aplicaciones del movimiento — los Payments quedan vivos y
          // su saldo sin aplicar aumenta automáticamente (queda como saldo a
          // favor del proveedor, listo para reaplicar en otra factura).
          await tx.paymentApplication.deleteMany({ where: { movementId: id } });
        }
        await tx.financeMovement.update({ where: { id }, data: { deletedAt: new Date() } });
      });

      const liberadoStr = apps.length > 0
        ? ` · liberó ${apps.length} aplicación(es) por ${Math.round(liberadoTotal * 100) / 100} ${existing.moneda} (saldo a favor del proveedor)`
        : "";
      await createAuditEntry({
        entityType: AuditEntityType.finance_movement,
        entityId: id,
        projectId: existing.projectId,
        userId: user.id,
        action: AuditAction.deleted,
        description: `Eliminó movimiento: ${existing.descripcion}${liberadoStr}`,
      });
      void checkInvariantOrWarn("delete movement", { movementId: id });
      return {
        success: true,
        liberatedApplications: apps.length,
        liberatedAmount: Math.round(liberadoTotal * 100) / 100,
      };
    });

    // ─── Finance: Previstos pendientes + cleanup ──────────────────────────────

    app.get("/finance/movements/previstos-pendientes", { preHandler: authorize(Module.FINANZAS, Action.VIEW) }, async (request) => {
      const query = z.object({
        categoryId: z.string().optional(),
        supplierId: z.string().optional(),
        from: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
        to: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
      }).parse(request.query);
      const where: Prisma.FinanceMovementWhereInput = {
        status: FinanceMovementStatus.PREVISTO,
        sourceType: MovementSourceType.PROJECT_MATERIALS,
        deletedAt: null,
      };
      if (query.supplierId) where.supplierId = query.supplierId;
      if (query.categoryId) where.materialItem = { categoryId: query.categoryId };
      if (query.from || query.to) {
        where.fecha = {};
        if (query.from) where.fecha.gte = parseDateOnly(query.from);
        if (query.to) where.fecha.lte = parseDateOnly(query.to);
      }
      const movs = await prisma.financeMovement.findMany({
        where,
        include: {
          project: { select: { id: true, code: true, clientName: true } },
          supplier: { select: { id: true, nombre: true } },
          materialItem: {
            select: {
              id: true, nombre: true, unidad: true,
              category: { select: { id: true, nombre: true } },
            },
          },
        },
        orderBy: [{ projectId: "asc" }, { createdAt: "asc" }],
      });
      return movs.map((m) => ({
        id: m.id,
        descripcion: m.descripcion,
        monto: decimalToNumber(m.monto),
        moneda: m.moneda,
        quantity: m.quantity ? decimalToNumber(m.quantity) : null,
        unitPrice: m.unitPrice ? decimalToNumber(m.unitPrice) : null,
        fecha: serializeDateOnly(m.fecha),
        expectedDate: m.expectedDate ? serializeDateOnly(m.expectedDate) : null,
        project: m.project,
        supplier: m.supplier,
        materialItem: m.materialItem,
      }));
    });

    app.post("/finance/movements/cleanup-previstos", { preHandler: authorize(Module.FINANZAS, Action.EDIT) }, async (request) => {
      const user = ensureUser(request);
      const body = z.object({ movementIds: z.array(z.string()).min(1) }).strict().parse(request.body);
      const movs = await prisma.financeMovement.findMany({
        where: { id: { in: body.movementIds }, deletedAt: null },
        select: { id: true, status: true, projectId: true, descripcion: true },
      });
      const invalid = movs.filter((m) => m.status !== FinanceMovementStatus.PREVISTO);
      if (invalid.length > 0) {
        throw badRequest("INVALID_STATUS", `Solo se pueden eliminar movimientos PREVISTOS (${invalid.length} con otro estado)`);
      }
      const ids = movs.map((m) => m.id);
      await prisma.$transaction([
        prisma.projectMaterial.updateMany({ where: { movementId: { in: ids } }, data: { movementId: null } }),
        prisma.financeMovement.updateMany({ where: { id: { in: ids } }, data: { deletedAt: new Date() } }),
      ]);
      for (const m of movs) {
        await createAuditEntry({
          entityType: AuditEntityType.finance_movement,
          entityId: m.id,
          projectId: m.projectId,
          userId: user.id,
          action: AuditAction.deleted,
          description: `Limpió previsto: ${m.descripcion}`,
        });
      }
      return { deleted: ids.length };
    });

    // ─── Finance: Transición de estados de movimientos ────────────────────────

    const allowedTransitions: Record<FinanceMovementStatus, FinanceMovementStatus[]> = {
      // PREVISTO se puede confirmar como PAGADO (cobro real o gasto real entró).
      // Usado por los pendientes manuales y las cuotas del plan de pagos.
      [FinanceMovementStatus.PREVISTO]: [FinanceMovementStatus.PAGADO],
      [FinanceMovementStatus.COMPROMETIDO]: [FinanceMovementStatus.A_PAGAR, FinanceMovementStatus.PAGADO],
      [FinanceMovementStatus.A_PAGAR]: [FinanceMovementStatus.PAGADO],
      // PARCIALMENTE_PAGADO se setea automáticamente al aplicar pagos; no se
      // transiciona manualmente (saldo restante debe pagarse vía Payment).
      [FinanceMovementStatus.PARCIALMENTE_PAGADO]: [],
      [FinanceMovementStatus.PAGADO]: [],
    };

    app.post("/finance/movements/:id/transition", { preHandler: authorize(Module.FINANZAS, Action.EDIT) }, async (request) => {
      const { id } = z.object({ id: z.string() }).parse(request.params);
      const body = z.object({
        newStatus: z.nativeEnum(FinanceMovementStatus),
        paidDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
        dueDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
        accountId: z.string().optional(),
      }).strict().parse(request.body);
      const user = ensureUser(request);
      const existing = await prisma.financeMovement.findFirst({ where: { id, deletedAt: null } });
      if (!existing) throw notFound("MOVEMENT_NOT_FOUND", "Movimiento no encontrado");

      const allowed = allowedTransitions[existing.status] ?? [];
      if (!allowed.includes(body.newStatus)) {
        throw badRequest(
          "INVALID_TRANSITION",
          `No se puede pasar de ${existing.status} a ${body.newStatus}`,
        );
      }

      // Si el movimiento tiene supplierId y se quiere transicionar manualmente
      // a PAGADO, se rechaza: el camino correcto es registrar un Payment y
      // aplicarlo. Movimientos sin supplier (ajustes, gastos varios) sí pueden
      // transicionar manualmente.
      if (body.newStatus === FinanceMovementStatus.PAGADO && existing.supplierId) {
        throw badRequest(
          "USE_PAYMENT_FLOW",
          "Para movimientos con proveedor, registrá un pago desde Pagos en lugar de marcar manualmente como pagado.",
        );
      }

      const data: Prisma.FinanceMovementUpdateInput = { status: body.newStatus };
      if (body.newStatus === FinanceMovementStatus.A_PAGAR) {
        if (!body.dueDate) throw badRequest("MISSING_DUE_DATE", "Se requiere dueDate para pasar a A_PAGAR");
        data.dueDate = parseDateOnly(body.dueDate);
      }
      if (body.newStatus === FinanceMovementStatus.PAGADO) {
        if (!body.paidDate) throw badRequest("MISSING_PAID_DATE", "Se requiere paidDate para marcar como PAGADO");
        const paid = parseDateOnly(body.paidDate);
        data.fecha = paid;
        data.mes = paid.getUTCMonth() + 1;
        data.anio = paid.getUTCFullYear();
        data.pagado = true;
        // Para INGRESO PREVISTO → PAGADO, además seteamos cobrado=true: la
        // valid validateAccountForMovement usa este flag para exigir cuenta
        // (sin él, los ingresos pasarían sin pedir cuenta).
        const cobradoEffective =
          existing.tipoMovimiento === TipoMovimiento.INGRESO ? true : existing.cobrado;
        if (existing.tipoMovimiento === TipoMovimiento.INGRESO) {
          data.cobrado = true;
        }
        // Validar cuenta (sólo se llega acá si no tiene supplier; los con
        // supplier ya fueron bloqueados arriba).
        const accountId = body.accountId ?? existing.accountId;
        await validateAccountForMovement({
          tipoMovimiento: existing.tipoMovimiento,
          status: FinanceMovementStatus.PAGADO,
          cobrado: cobradoEffective,
          moneda: existing.moneda,
          accountId,
        });
        if (body.accountId !== undefined) {
          data.account = body.accountId ? { connect: { id: body.accountId } } : { disconnect: true };
        }
      }

      const updated = await prisma.financeMovement.update({ where: { id }, data });
      await createAuditEntry({
        entityType: AuditEntityType.finance_movement,
        entityId: id,
        projectId: existing.projectId,
        userId: user.id,
        action: AuditAction.status_changed,
        description: `Transición ${existing.status} → ${body.newStatus} en movimiento ${existing.descripcion}`,
      });
      // Auto-detección de desglose pendiente al pasar a A_PAGAR / PAGADO.
      // Sólo aplica a GASTO con proveedor — los movimientos sin proveedor
      // suelen ser ajustes contables sin lista de ítems. El usuario aún tiene
      // que confirmar el desglose o marcar "sin materiales" desde la UI.
      const requiresDesgloseNow =
        (body.newStatus === FinanceMovementStatus.A_PAGAR || body.newStatus === FinanceMovementStatus.PAGADO)
        && existing.tipoMovimiento === TipoMovimiento.GASTO
        && existing.supplierId != null
        && !existing.hasItemDetail
        && !existing.noTieneMateriales;
      if (requiresDesgloseNow) {
        await prisma.financeMovement.update({ where: { id }, data: { requiresItemDetail: true } });
      }

      void checkInvariantOrWarn("transition movement", { movementId: id, newStatus: body.newStatus });
      return {
        id: updated.id,
        status: updated.status,
        fecha: serializeDateOnly(updated.fecha),
        dueDate: updated.dueDate ? serializeDateOnly(updated.dueDate) : null,
        pagado: updated.pagado,
        requiresItemDetail: requiresDesgloseNow || updated.requiresItemDetail,
      };
    });

    // ─── Finance: Pendientes de desglose ─────────────────────────────────────

    // Devuelve facturas A_PAGAR / PARCIALMENTE_PAGADO de un proveedor en una
    // moneda dada, con saldo pendiente > 0. Lo usa el form de "Nuevo movimiento"
    // PAGADO con proveedor: si hay facturas pendientes, ofrece aplicar el pago
    // contra ellas en lugar de crear sólo un Payment auto al movimiento nuevo.
    app.get("/finance/movements/pending-by-supplier", { preHandler: authorize(Module.FINANZAS, Action.VIEW) }, async (request) => {
      const query = z.object({
        supplierId: z.string(),
        moneda: z.nativeEnum(Moneda),
      }).parse(request.query);

      const facturas = await prisma.financeMovement.findMany({
        where: {
          deletedAt: null,
          tipoMovimiento: TipoMovimiento.GASTO,
          supplierId: query.supplierId,
          moneda: query.moneda,
          status: { in: [FinanceMovementStatus.A_PAGAR, FinanceMovementStatus.PARCIALMENTE_PAGADO] },
        },
        include: {
          paymentApplications: {
            include: { payment: { select: { deletedAt: true } } },
          },
        },
        orderBy: [{ dueDate: "asc" }, { fecha: "asc" }],
      });

      const result = facturas
        .map((m) => {
          const monto = decimalToNumber(m.monto) ?? 0;
          const aplicado = sumApplications(m.paymentApplications.filter((a) => !a.payment.deletedAt));
          const saldoPendiente = Math.round((monto - aplicado) * 100) / 100;
          return {
            id: m.id,
            descripcion: m.descripcion,
            fecha: serializeDateOnly(m.fecha),
            monto,
            moneda: m.moneda,
            saldoPendiente,
            status: m.status,
            dueDate: m.dueDate ? serializeDateOnly(m.dueDate) : null,
          };
        })
        .filter((f) => f.saldoPendiente > 0.005);

      return { facturasPendientes: result };
    });

    app.get("/finance/movements/pending-detail", { preHandler: authorize(Module.FINANZAS, Action.VIEW) }, async () => {
      // Solo GASTOS con proveedor: el desglose de factura sirve para imputar
      // stock cuando el proveedor facturó materiales. No aplica a INGRESOS,
      // AJUSTES, ni gastos sin proveedor (ej. pago de servicios genéricos).
      const movs = await prisma.financeMovement.findMany({
        where: {
          deletedAt: null,
          tipoMovimiento: TipoMovimiento.GASTO,
          supplierId: { not: null },
          status: { in: [FinanceMovementStatus.A_PAGAR, FinanceMovementStatus.PAGADO] },
          hasItemDetail: false,
          noTieneMateriales: false,
        },
        include: {
          project: { select: { id: true, code: true, clientName: true } },
          supplier: { select: { id: true, nombre: true } },
        },
        orderBy: { fecha: "asc" },
      });
      return movs.map((m) => ({
        id: m.id,
        descripcion: m.descripcion,
        monto: decimalToNumber(m.monto),
        moneda: m.moneda,
        status: m.status,
        fecha: serializeDateOnly(m.fecha),
        dueDate: m.dueDate ? serializeDateOnly(m.dueDate) : null,
        project: m.project,
        supplier: m.supplier,
      }));
    });

    // ─── Finance: Desglose de factura (InvoiceItem) ──────────────────────────
    //
    // Permite cargar el detalle de los productos comprados en una factura
    // A_PAGAR/PAGADO. Al confirmar el desglose, se generan StockMovements de
    // ENTRADA y se actualiza MaterialItem.stockActual. Si el movimiento luego
    // se anula, se revierten todos los StockMovements vinculados.

    function serializeInvoiceItem(it: {
      id: string; movementId: string; materialItemId: string;
      quantity: import("@prisma/client/runtime/library").Decimal;
      unitPrice: import("@prisma/client/runtime/library").Decimal;
      moneda: Moneda; ivaTasa: number; notes: string | null;
      createdAt: Date; updatedAt: Date;
      materialItem?: {
        id: string; nombre: string; unidad: string; gestionaStock: boolean;
        category: { id: string; nombre: string };
      } | null;
      stockMovement?: { id: string; fecha: Date; reversed: boolean } | null;
    }) {
      const qty = Number(it.quantity);
      const price = Number(it.unitPrice);
      return {
        id: it.id,
        movementId: it.movementId,
        materialItemId: it.materialItemId,
        quantity: qty,
        unitPrice: price,
        subtotal: Math.round(qty * price * 100) / 100,
        moneda: it.moneda,
        ivaTasa: it.ivaTasa,
        notes: it.notes,
        materialItem: it.materialItem ?? null,
        stockMovement: it.stockMovement
          ? {
              id: it.stockMovement.id,
              fecha: serializeDate(it.stockMovement.fecha),
              reversed: it.stockMovement.reversed,
            }
          : null,
        createdAt: serializeDate(it.createdAt),
        updatedAt: serializeDate(it.updatedAt),
      };
    }

    function sumInvoiceItems(items: Array<{ quantity: import("@prisma/client/runtime/library").Decimal; unitPrice: import("@prisma/client/runtime/library").Decimal }>) {
      return items.reduce((acc, it) => acc + Number(it.quantity) * Number(it.unitPrice), 0);
    }

    app.get("/finance/movements/:id/invoice-items", { preHandler: authorize(Module.FINANZAS, Action.VIEW) }, async (request) => {
      const { id } = z.object({ id: z.string() }).parse(request.params);
      const movement = await prisma.financeMovement.findFirst({
        where: { id, deletedAt: null },
        select: { id: true, monto: true, moneda: true, status: true, hasItemDetail: true, noTieneMateriales: true, requiresItemDetail: true },
      });
      if (!movement) throw notFound("MOVEMENT_NOT_FOUND", "Movimiento no encontrado");
      const items = await prisma.invoiceItem.findMany({
        where: { movementId: id },
        include: {
          materialItem: {
            select: {
              id: true, nombre: true, unidad: true, gestionaStock: true,
              category: { select: { id: true, nombre: true } },
            },
          },
          stockMovement: { select: { id: true, fecha: true, reversed: true } },
        },
        orderBy: { createdAt: "asc" },
      });
      const totalItems = Math.round(sumInvoiceItems(items) * 100) / 100;
      const monto = Number(movement.monto);
      const diff = Math.round((monto - totalItems) * 100) / 100;
      return {
        movement: {
          id: movement.id,
          monto,
          moneda: movement.moneda,
          status: movement.status,
          hasItemDetail: movement.hasItemDetail,
          noTieneMateriales: movement.noTieneMateriales,
          requiresItemDetail: movement.requiresItemDetail,
        },
        items: items.map(serializeInvoiceItem),
        totalItems,
        diff,
        matches: Math.abs(diff) <= 1.0,
      };
    });

    function ensureCanEditInvoice(m: { status: FinanceMovementStatus; noTieneMateriales: boolean; deletedAt: Date | null }) {
      if (m.deletedAt) throw badRequest("MOVEMENT_DELETED", "El movimiento está anulado");
      if (m.noTieneMateriales) throw badRequest("NO_MATERIALES", "El movimiento está marcado como sin materiales");
      if (m.status !== FinanceMovementStatus.A_PAGAR && m.status !== FinanceMovementStatus.PAGADO) {
        throw badRequest("INVALID_STATUS", `Solo se puede cargar desglose en A_PAGAR o PAGADO (actual: ${m.status})`);
      }
    }

    const invoiceItemBaseSchema = {
      materialItemId: z.string(),
      quantity: z.coerce.number().int({ message: "Las cantidades deben ser enteras" }).positive(),
      unitPrice: z.coerce.number().nonnegative(),
      moneda: z.nativeEnum(Moneda).optional(),
      ivaTasa: z.coerce.number().min(0).max(100).optional(),
      notes: z.string().nullable().optional(),
    };

    app.post("/finance/movements/:id/invoice-items", { preHandler: authorize(Module.FINANZAS, Action.EDIT) }, async (request) => {
      const { id } = z.object({ id: z.string() }).parse(request.params);
      const body = z.object(invoiceItemBaseSchema).strict().parse(request.body);
      const movement = await prisma.financeMovement.findFirst({ where: { id } });
      if (!movement) throw notFound("MOVEMENT_NOT_FOUND", "Movimiento no encontrado");
      ensureCanEditInvoice(movement);
      if (movement.hasItemDetail) {
        throw badRequest("DETAIL_CONFIRMED", "Este movimiento ya tiene desglose confirmado. Anulalo o desconfírmalo antes de modificar.");
      }
      const item = await prisma.materialItem.findFirst({ where: { id: body.materialItemId, activo: true } });
      if (!item) throw badRequest("MATERIAL_ITEM_INVALID", "El ítem no existe o está inactivo");
      if (!item.gestionaStock) throw badRequest("ITEM_NO_STOCK", "El ítem no gestiona stock; no puede formar parte de un desglose de factura");
      const moneda = body.moneda ?? movement.moneda;
      if (moneda !== movement.moneda) throw badRequest("CURRENCY_MISMATCH", "La moneda de cada ítem debe coincidir con la del movimiento");
      const ivaTasa = body.ivaTasa ?? item.ivaTasa;
      const created = await prisma.invoiceItem.create({
        data: {
          movementId: id,
          materialItemId: body.materialItemId,
          quantity: new Prisma.Decimal(body.quantity),
          unitPrice: new Prisma.Decimal(body.unitPrice),
          moneda,
          ivaTasa,
          notes: body.notes ?? null,
        },
        include: {
          materialItem: {
            select: {
              id: true, nombre: true, unidad: true, gestionaStock: true,
              category: { select: { id: true, nombre: true } },
            },
          },
          stockMovement: { select: { id: true, fecha: true, reversed: true } },
        },
      });
      return serializeInvoiceItem(created);
    });

    app.patch("/finance/movements/:id/invoice-items/:itemId", { preHandler: authorize(Module.FINANZAS, Action.EDIT) }, async (request) => {
      const { id, itemId } = z.object({ id: z.string(), itemId: z.string() }).parse(request.params);
      const body = z.object({
        quantity: z.coerce.number().int({ message: "Las cantidades deben ser enteras" }).positive().optional(),
        unitPrice: z.coerce.number().nonnegative().optional(),
        ivaTasa: z.coerce.number().min(0).max(100).optional(),
        notes: z.string().nullable().optional(),
      }).strict().parse(request.body);
      const movement = await prisma.financeMovement.findFirst({ where: { id } });
      if (!movement) throw notFound("MOVEMENT_NOT_FOUND", "Movimiento no encontrado");
      ensureCanEditInvoice(movement);
      if (movement.hasItemDetail) {
        throw badRequest("DETAIL_CONFIRMED", "Desglose ya confirmado; no se puede editar");
      }
      const existing = await prisma.invoiceItem.findFirst({ where: { id: itemId, movementId: id } });
      if (!existing) throw notFound("INVOICE_ITEM_NOT_FOUND", "Ítem de factura no encontrado");
      const updated = await prisma.invoiceItem.update({
        where: { id: itemId },
        data: {
          ...(body.quantity != null ? { quantity: new Prisma.Decimal(body.quantity) } : {}),
          ...(body.unitPrice != null ? { unitPrice: new Prisma.Decimal(body.unitPrice) } : {}),
          ...(body.ivaTasa != null ? { ivaTasa: body.ivaTasa } : {}),
          ...(body.notes !== undefined ? { notes: body.notes } : {}),
        },
        include: {
          materialItem: {
            select: {
              id: true, nombre: true, unidad: true, gestionaStock: true,
              category: { select: { id: true, nombre: true } },
            },
          },
          stockMovement: { select: { id: true, fecha: true, reversed: true } },
        },
      });
      return serializeInvoiceItem(updated);
    });

    app.delete("/finance/movements/:id/invoice-items/:itemId", { preHandler: authorize(Module.FINANZAS, Action.EDIT) }, async (request) => {
      const { id, itemId } = z.object({ id: z.string(), itemId: z.string() }).parse(request.params);
      const movement = await prisma.financeMovement.findFirst({ where: { id } });
      if (!movement) throw notFound("MOVEMENT_NOT_FOUND", "Movimiento no encontrado");
      ensureCanEditInvoice(movement);
      if (movement.hasItemDetail) {
        throw badRequest("DETAIL_CONFIRMED", "Desglose ya confirmado; no se puede eliminar ítems");
      }
      const existing = await prisma.invoiceItem.findFirst({ where: { id: itemId, movementId: id } });
      if (!existing) throw notFound("INVOICE_ITEM_NOT_FOUND", "Ítem de factura no encontrado");
      await prisma.invoiceItem.delete({ where: { id: itemId } });
      return { success: true };
    });

    app.post("/finance/movements/:id/invoice-items/confirm", { preHandler: authorize(Module.FINANZAS, Action.EDIT) }, async (request) => {
      const { id } = z.object({ id: z.string() }).parse(request.params);
      const user = ensureUser(request);
      const movement = await prisma.financeMovement.findFirst({ where: { id } });
      if (!movement) throw notFound("MOVEMENT_NOT_FOUND", "Movimiento no encontrado");
      ensureCanEditInvoice(movement);
      if (movement.hasItemDetail) throw badRequest("ALREADY_CONFIRMED", "El desglose ya estaba confirmado");

      const items = await prisma.invoiceItem.findMany({
        where: { movementId: id },
        include: { materialItem: true },
      });
      if (items.length === 0) throw badRequest("NO_ITEMS", "Cargá al menos un ítem o marcá el movimiento como sin materiales");

      const total = Math.round(sumInvoiceItems(items) * 100) / 100;
      const monto = Number(movement.monto);
      const diff = Math.round((monto - total) * 100) / 100;
      // Tolerancia de $1 (en la moneda del movimiento) para absorber redondeos
      // de precios unitarios × cantidades.
      const TOLERANCIA = 1.0;
      if (Math.abs(diff) > TOLERANCIA) {
        throw badRequest(
          "TOTAL_MISMATCH",
          `El total de ítems (${total.toFixed(2)} ${movement.moneda}) difiere del monto del movimiento (${monto.toFixed(2)} ${movement.moneda}) en más de ${TOLERANCIA.toFixed(2)} ${movement.moneda}. Diferencia: ${diff.toFixed(2)}`,
        );
      }

      // Generar StockMovements de ENTRADA por cada InvoiceItem y actualizar
      // MaterialItem.stockActual. Todo en una transacción.
      const today = new Date();
      const fechaUtc = new Date(Date.UTC(today.getFullYear(), today.getMonth(), today.getDate()));

      await prisma.$transaction(async (tx) => {
        for (const it of items) {
          const stockActual = Number(it.materialItem.stockActual);
          const cantidad = Number(it.quantity);
          const nuevoStock = stockActual + cantidad;
          const stockMov = await tx.stockMovement.create({
            data: {
              fecha: fechaUtc,
              materialItemId: it.materialItemId,
              tipo: TipoMovimientoStock.INGRESO,
              cantidad: it.quantity,
              costoUnitario: it.unitPrice,
              costoTotal: new Prisma.Decimal(cantidad * Number(it.unitPrice)),
              moneda: it.moneda,
              stockResultante: new Prisma.Decimal(nuevoStock),
              supplierId: movement.supplierId,
              financeMovementId: movement.id,
              invoiceItemId: it.id,
              causaIngreso: ExpenseSourceType.FACTURA,
              referencia: `Factura ${movement.descripcion}`,
            },
          });
          await tx.materialItem.update({
            where: { id: it.materialItemId },
            data: { stockActual: new Prisma.Decimal(nuevoStock) },
          });
          // No hace falta volver a actualizar invoiceItem.stockMovementId: la
          // relación inversa se infiere de StockMovement.invoiceItemId (UNIQUE).
          void stockMov;
        }
        await tx.financeMovement.update({
          where: { id },
          data: { hasItemDetail: true, requiresItemDetail: true },
        });
      });

      await createAuditEntry({
        entityType: AuditEntityType.invoice_item,
        entityId: id,
        projectId: movement.projectId,
        userId: user.id,
        action: AuditAction.created,
        description: `Confirmó desglose de factura: ${items.length} ítem(s) ingresaron al stock`,
      });

      return { confirmed: true, itemsCount: items.length, total };
    });

    app.post("/finance/movements/:id/mark-no-materials", { preHandler: authorize(Module.FINANZAS, Action.EDIT) }, async (request) => {
      const { id } = z.object({ id: z.string() }).parse(request.params);
      const user = ensureUser(request);
      const movement = await prisma.financeMovement.findFirst({ where: { id, deletedAt: null } });
      if (!movement) throw notFound("MOVEMENT_NOT_FOUND", "Movimiento no encontrado");
      if (movement.hasItemDetail) throw badRequest("ALREADY_CONFIRMED", "El movimiento ya tiene desglose confirmado");
      const existingItems = await prisma.invoiceItem.count({ where: { movementId: id } });
      if (existingItems > 0) {
        throw badRequest("ITEMS_PRESENT", "Eliminá los ítems cargados antes de marcar como sin materiales");
      }
      const updated = await prisma.financeMovement.update({
        where: { id },
        data: { noTieneMateriales: true, hasItemDetail: true, requiresItemDetail: false },
      });
      await createAuditEntry({
        entityType: AuditEntityType.finance_movement,
        entityId: id,
        projectId: movement.projectId,
        userId: user.id,
        action: AuditAction.updated,
        description: `Marcó factura como sin materiales: ${movement.descripcion}`,
      });
      return { id: updated.id, noTieneMateriales: true, hasItemDetail: true };
    });

    // ─── Finance: Anulación con reversión de stock ───────────────────────────

    app.post("/finance/movements/:id/cancel", { preHandler: authorize(Module.FINANZAS, Action.DELETE) }, async (request) => {
      const { id } = z.object({ id: z.string() }).parse(request.params);
      const user = ensureUser(request);
      const movement = await prisma.financeMovement.findFirst({ where: { id, deletedAt: null } });
      if (!movement) throw notFound("MOVEMENT_NOT_FOUND", "Movimiento no encontrado");

      const stockMovs = movement.hasItemDetail
        ? await prisma.stockMovement.findMany({
            where: { financeMovementId: id, reversed: false, invoiceItemId: { not: null } },
            include: { materialItem: true },
          })
        : [];

      await prisma.$transaction(async (tx) => {
        // Revertir cada stock movement vinculado
        for (const sm of stockMovs) {
          const stockActual = Number(sm.materialItem.stockActual);
          const cantidad = Number(sm.cantidad);
          const reverso = sm.tipo === TipoMovimientoStock.INGRESO ? -cantidad : cantidad;
          const nuevoStock = stockActual + reverso;
          await tx.stockMovement.create({
            data: {
              fecha: new Date(),
              materialItemId: sm.materialItemId,
              tipo: sm.tipo === TipoMovimientoStock.INGRESO ? TipoMovimientoStock.EGRESO : TipoMovimientoStock.INGRESO,
              cantidad: sm.cantidad,
              costoUnitario: sm.costoUnitario,
              costoTotal: sm.costoTotal,
              moneda: sm.moneda,
              stockResultante: new Prisma.Decimal(nuevoStock),
              supplierId: sm.supplierId,
              financeMovementId: sm.financeMovementId,
              causaIngreso: sm.causaIngreso,
              reversed: true,
              referencia: `Reversión de ${sm.id}`,
              observaciones: `Anulación de movimiento ${movement.descripcion}`,
            },
          });
          await tx.stockMovement.update({ where: { id: sm.id }, data: { reversed: true } });
          await tx.materialItem.update({
            where: { id: sm.materialItemId },
            data: { stockActual: new Prisma.Decimal(nuevoStock) },
          });
        }
        await tx.financeMovement.update({
          where: { id },
          data: {
            deletedAt: new Date(),
            estadoAprobacion: EstadoAprobacion.ANULADO,
          },
        });
      });

      await createAuditEntry({
        entityType: AuditEntityType.finance_movement,
        entityId: id,
        projectId: movement.projectId,
        userId: user.id,
        action: AuditAction.deleted,
        description: stockMovs.length > 0
          ? `Anuló movimiento y revirtió ${stockMovs.length} ingreso(s) de stock: ${movement.descripcion}`
          : `Anuló movimiento: ${movement.descripcion}`,
      });

      void checkInvariantOrWarn("cancel movement", { movementId: id });
      return { success: true, reversedStockMovements: stockMovs.length };
    });

    // ─── Finance: Payments + PaymentApplications ─────────────────────────────
    //
    // Modelo: un Payment es un pago real hecho a un proveedor (transferencia,
    // cheque, efectivo). Una PaymentApplication aplica una porción del pago a
    // una factura específica (FinanceMovement). Un pago puede aplicarse a
    // varias facturas, y una factura puede recibir varios pagos parciales.
    // El status de la factura se recalcula al crear/borrar applications.

    type PaymentApplicationLite = { montoAplicado: import("@prisma/client/runtime/library").Decimal };

    /** Suma de aplicaciones (no descontando applications de pagos eliminados — el caller
     *  debe pasar sólo las activas). */
    function sumApplications(apps: PaymentApplicationLite[]): number {
      return apps.reduce((acc, a) => acc + Number(a.montoAplicado), 0);
    }

    /** Recalcula el status de un movement según sus applications activas y lo
     *  actualiza en DB. Retorna el balance final. Devuelve null si el movement
     *  no debería evaluarse (ej. INGRESO/AJUSTE). */
    async function recalcMovementStatus(
      tx: Prisma.TransactionClient,
      movementId: string,
    ): Promise<{ saldo: number; pagado: number; status: FinanceMovementStatus } | null> {
      const m = await tx.financeMovement.findFirst({
        where: { id: movementId, deletedAt: null },
        include: { paymentApplications: { include: { payment: { select: { deletedAt: true } } } } },
      });
      if (!m) return null;
      if (m.tipoMovimiento !== TipoMovimiento.GASTO) return null;
      const monto = Number(m.monto);
      const activeApps = m.paymentApplications.filter((a) => !a.payment.deletedAt);
      const pagado = sumApplications(activeApps);
      const saldo = Math.round((monto - pagado) * 100) / 100;

      // Reglas de transición automática:
      // - saldo === 0 → PAGADO
      // - 0 < pagado < monto → PARCIALMENTE_PAGADO
      // - pagado === 0 → mantener el status existente (A_PAGAR / COMPROMETIDO / etc.)
      let nextStatus = m.status;
      const data: Prisma.FinanceMovementUpdateInput = {};

      if (Math.abs(saldo) < 0.005) {
        // Pagado por completo
        nextStatus = FinanceMovementStatus.PAGADO;
        if (m.status !== FinanceMovementStatus.PAGADO) {
          // Tomar fecha del último Payment que aplica
          const ultimaApp = activeApps.length > 0
            ? await tx.paymentApplication.findFirst({
                where: { movementId, payment: { deletedAt: null } },
                orderBy: { payment: { fecha: "desc" } },
                include: { payment: true },
              })
            : null;
          if (ultimaApp) {
            const fechaPago = ultimaApp.payment.fecha;
            data.fecha = fechaPago;
            data.mes = fechaPago.getUTCMonth() + 1;
            data.anio = fechaPago.getUTCFullYear();
          }
          data.pagado = true;
        }
      } else if (pagado > 0 && saldo > 0) {
        nextStatus = FinanceMovementStatus.PARCIALMENTE_PAGADO;
      } else if (pagado === 0) {
        // Sin pagos activos: si estaba PAGADO o PARCIALMENTE_PAGADO por aplicaciones,
        // volver al estado A_PAGAR (si tiene dueDate) o COMPROMETIDO.
        if (m.status === FinanceMovementStatus.PAGADO || m.status === FinanceMovementStatus.PARCIALMENTE_PAGADO) {
          nextStatus = m.dueDate ? FinanceMovementStatus.A_PAGAR : FinanceMovementStatus.COMPROMETIDO;
          data.pagado = false;
        }
      }

      if (nextStatus !== m.status) {
        data.status = nextStatus;
      }
      if (Object.keys(data).length > 0) {
        await tx.financeMovement.update({ where: { id: movementId }, data });
      }
      return { saldo, pagado, status: nextStatus };
    }

    /** Devuelve el balance de un payment: monto, montoAplicado, saldoSinAplicar. */
    async function getPaymentBalance(paymentId: string) {
      const apps = await prisma.paymentApplication.findMany({ where: { paymentId } });
      const pago = await prisma.payment.findUnique({ where: { id: paymentId } });
      if (!pago) return null;
      const monto = Number(pago.monto);
      const aplicado = sumApplications(apps);
      return {
        monto,
        montoAplicado: Math.round(aplicado * 100) / 100,
        saldoSinAplicar: Math.round((monto - aplicado) * 100) / 100,
      };
    }

    function serializePayment(p: {
      id: string; supplierId: string;
      fecha: Date; monto: import("@prisma/client/runtime/library").Decimal;
      moneda: Moneda; metodo: MetodoPago;
      referencia: string | null; notas: string | null;
      accountId: string | null;
      createdById: string | null;
      createdAt: Date; updatedAt: Date; deletedAt: Date | null;
      supplier?: { id: string; nombre: string } | null;
      account?: { id: string; nombre: string; tipo: AccountType; moneda: Moneda } | null;
      applications?: Array<{
        id: string; movementId: string; montoAplicado: import("@prisma/client/runtime/library").Decimal; createdAt: Date;
        movement?: {
          id: string; descripcion: string; monto: import("@prisma/client/runtime/library").Decimal;
          moneda: Moneda; status: FinanceMovementStatus; fecha: Date; dueDate: Date | null;
        } | null;
      }>;
    }, balance?: { monto: number; montoAplicado: number; saldoSinAplicar: number }) {
      return {
        id: p.id,
        supplierId: p.supplierId,
        supplier: p.supplier ?? null,
        accountId: p.accountId,
        account: p.account ?? null,
        fecha: serializeDateOnly(p.fecha),
        monto: Number(p.monto),
        moneda: p.moneda,
        metodo: p.metodo,
        referencia: p.referencia,
        notas: p.notas,
        createdById: p.createdById,
        createdAt: serializeDate(p.createdAt),
        updatedAt: serializeDate(p.updatedAt),
        deletedAt: p.deletedAt ? serializeDate(p.deletedAt) : null,
        montoAplicado: balance?.montoAplicado ?? 0,
        saldoSinAplicar: balance?.saldoSinAplicar ?? Number(p.monto),
        ...(p.applications ? {
          applications: p.applications.map((a) => ({
            id: a.id,
            movementId: a.movementId,
            montoAplicado: Number(a.montoAplicado),
            createdAt: serializeDate(a.createdAt),
            movement: a.movement ? {
              id: a.movement.id,
              descripcion: a.movement.descripcion,
              monto: Number(a.movement.monto),
              moneda: a.movement.moneda,
              status: a.movement.status,
              fecha: serializeDateOnly(a.movement.fecha),
              dueDate: a.movement.dueDate ? serializeDateOnly(a.movement.dueDate) : null,
            } : null,
          })),
        } : {}),
      };
    }

    // ─── Payments: listado + detalle ─────────────────────────────────────────

    app.get("/finance/payments", { preHandler: authorize(Module.FINANZAS, Action.VIEW) }, async (request) => {
      const query = z.object({
        supplierId: z.string().optional(),
        fechaDesde: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
        fechaHasta: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
        conSaldoSinAplicar: z.enum(["true", "false"]).optional(),
        includeDeleted: z.enum(["true", "false"]).optional(),
      }).parse(request.query);

      const where: Prisma.PaymentWhereInput = {
        ...(query.includeDeleted === "true" ? {} : { deletedAt: null }),
        ...(query.supplierId ? { supplierId: query.supplierId } : {}),
      };
      if (query.fechaDesde || query.fechaHasta) {
        where.fecha = {};
        if (query.fechaDesde) where.fecha.gte = parseDateOnly(query.fechaDesde);
        if (query.fechaHasta) where.fecha.lte = parseDateOnly(query.fechaHasta);
      }
      const payments = await prisma.payment.findMany({
        where,
        include: {
          supplier: { select: { id: true, nombre: true } },
          account: { select: { id: true, nombre: true, tipo: true, moneda: true } },
          applications: { select: { montoAplicado: true } },
        },
        orderBy: { fecha: "desc" },
      });
      let result = payments.map((p) => {
        const monto = Number(p.monto);
        const aplicado = p.applications.reduce((acc, a) => acc + Number(a.montoAplicado), 0);
        const balance = {
          monto,
          montoAplicado: Math.round(aplicado * 100) / 100,
          saldoSinAplicar: Math.round((monto - aplicado) * 100) / 100,
        };
        return serializePayment({ ...p, applications: undefined }, balance);
      });
      if (query.conSaldoSinAplicar === "true") {
        result = result.filter((p) => p.saldoSinAplicar > 0);
      }
      return result;
    });

    app.get("/finance/payments/:id", { preHandler: authorize(Module.FINANZAS, Action.VIEW) }, async (request) => {
      const { id } = z.object({ id: z.string() }).parse(request.params);
      const payment = await prisma.payment.findFirst({
        where: { id },
        include: {
          supplier: { select: { id: true, nombre: true } },
          account: { select: { id: true, nombre: true, tipo: true, moneda: true } },
          applications: {
            include: {
              movement: {
                select: {
                  id: true, descripcion: true, monto: true, moneda: true, status: true,
                  fecha: true, dueDate: true,
                },
              },
            },
            orderBy: { createdAt: "asc" },
          },
        },
      });
      if (!payment) throw notFound("PAYMENT_NOT_FOUND", "Pago no encontrado");
      const balance = await getPaymentBalance(id);
      return serializePayment(payment, balance ?? undefined);
    });

    // ─── Payments: CRUD ──────────────────────────────────────────────────────

    const paymentCreateSchema = z.object({
      supplierId: z.string().min(1),
      accountId: z.string().min(1),
      fecha: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
      // Permitimos negativos (notas de crédito); el handler valida que sea != 0.
      monto: z.coerce.number(),
      moneda: z.nativeEnum(Moneda).default(Moneda.USD),
      metodo: z.nativeEnum(MetodoPago).default(MetodoPago.TRANSFERENCIA),
      referencia: z.string().optional(),
      notas: z.string().optional(),
    }).strict();

    const paymentPatchSchema = z.object({
      fecha: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
      monto: z.coerce.number().optional(),
      moneda: z.nativeEnum(Moneda).optional(),
      metodo: z.nativeEnum(MetodoPago).optional(),
      accountId: z.string().min(1).optional(),
      referencia: z.string().nullable().optional(),
      notas: z.string().nullable().optional(),
    }).strict();

    /** Valida la cuenta para un Payment: existe, está activa y misma moneda. */
    async function validateAccountForPayment(accountId: string, moneda: Moneda) {
      const account = await prisma.account.findFirst({ where: { id: accountId, deletedAt: null } });
      if (!account) throw badRequest("ACCOUNT_INVALID", "La cuenta seleccionada no existe");
      if (!account.activa) throw badRequest("ACCOUNT_INACTIVE", "La cuenta está inactiva");
      if (account.moneda !== moneda) {
        throw badRequest(
          "ACCOUNT_CURRENCY_MISMATCH",
          `La moneda del pago (${moneda}) no coincide con la de la cuenta (${account.moneda}).`,
        );
      }
    }

    app.post("/finance/payments", { preHandler: authorize(Module.FINANZAS, Action.CREATE) }, async (request) => {
      const user = ensureUser(request);
      const body = paymentCreateSchema.parse(request.body);
      if (Math.abs(body.monto) < 0.005) {
        throw badRequest("MONTO_ZERO", "El monto del pago no puede ser 0");
      }
      const supplier = await prisma.supplier.findFirst({ where: { id: body.supplierId, deletedAt: null } });
      if (!supplier) throw badRequest("SUPPLIER_INVALID", "Proveedor no existe o está eliminado");
      await validateAccountForPayment(body.accountId, body.moneda);

      const payment = await prisma.payment.create({
        data: {
          supplierId: body.supplierId,
          accountId: body.accountId,
          fecha: parseDateOnly(body.fecha),
          monto: new Prisma.Decimal(body.monto),
          moneda: body.moneda,
          metodo: body.metodo,
          referencia: body.referencia,
          notas: body.notas,
          createdById: user.id,
        },
        include: { supplier: { select: { id: true, nombre: true } }, applications: true },
      });
      const isNegative = body.monto < 0;
      await createAuditEntry({
        entityType: AuditEntityType.payment,
        entityId: payment.id,
        userId: user.id,
        action: AuditAction.created,
        description: isNegative
          ? `Pago negativo de ${body.monto.toFixed(2)} ${body.moneda} a ${supplier.nombre} (nota de crédito)`
          : `Registró pago de ${body.monto.toFixed(2)} ${body.moneda} a ${supplier.nombre}`,
      });
      void checkInvariantOrWarn("create payment", { paymentId: payment.id });
      return serializePayment(payment, { monto: Number(payment.monto), montoAplicado: 0, saldoSinAplicar: Number(payment.monto) });
    });

    app.patch("/finance/payments/:id", { preHandler: authorize(Module.FINANZAS, Action.EDIT) }, async (request) => {
      const user = ensureUser(request);
      const { id } = z.object({ id: z.string() }).parse(request.params);
      const body = paymentPatchSchema.parse(request.body);
      const existing = await prisma.payment.findFirst({
        where: { id, deletedAt: null },
        include: { applications: { select: { montoAplicado: true } } },
      });
      if (!existing) throw notFound("PAYMENT_NOT_FOUND", "Pago no encontrado");

      // Si se reduce monto, validar que no quede menos que lo aplicado
      if (body.monto != null) {
        const aplicado = existing.applications.reduce((acc, a) => acc + Number(a.montoAplicado), 0);
        if (body.monto < aplicado - 0.005) {
          throw badRequest(
            "MONTO_LT_APLICADO",
            `El nuevo monto (${body.monto.toFixed(2)}) es menor al ya aplicado (${aplicado.toFixed(2)}). Eliminá aplicaciones primero.`,
          );
        }
      }

      // Validar monto != 0 si lo están cambiando
      if (body.monto != null && Math.abs(body.monto) < 0.005) {
        throw badRequest("MONTO_ZERO", "El monto del pago no puede ser 0");
      }
      // Validar cuenta si cambia accountId o moneda
      const effectiveMoneda = body.moneda ?? existing.moneda;
      const effectiveAccountId = body.accountId ?? existing.accountId;
      if (body.accountId !== undefined || body.moneda !== undefined) {
        if (!effectiveAccountId) throw badRequest("ACCOUNT_REQUIRED", "Un pago requiere una cuenta");
        await validateAccountForPayment(effectiveAccountId, effectiveMoneda);
      }

      const data: Prisma.PaymentUpdateInput = {};
      if (body.fecha) data.fecha = parseDateOnly(body.fecha);
      if (body.monto != null) data.monto = new Prisma.Decimal(body.monto);
      if (body.moneda) data.moneda = body.moneda;
      if (body.metodo) data.metodo = body.metodo;
      if (body.accountId !== undefined) data.account = body.accountId ? { connect: { id: body.accountId } } : { disconnect: true };
      if (body.referencia !== undefined) data.referencia = body.referencia;
      if (body.notas !== undefined) data.notas = body.notas;

      const updated = await prisma.payment.update({ where: { id }, data, include: { supplier: { select: { id: true, nombre: true } } } });
      await createAuditEntry({
        entityType: AuditEntityType.payment,
        entityId: id,
        userId: user.id,
        action: AuditAction.updated,
        description: `Actualizó pago a ${updated.supplier.nombre}`,
      });
      const balance = await getPaymentBalance(id);
      return serializePayment(updated, balance ?? undefined);
    });

    app.delete("/finance/payments/:id", { preHandler: authorize(Module.FINANZAS, Action.DELETE) }, async (request) => {
      const user = ensureUser(request);
      const { id } = z.object({ id: z.string() }).parse(request.params);
      const existing = await prisma.payment.findFirst({
        where: { id, deletedAt: null },
        include: { applications: { select: { id: true, movementId: true } }, supplier: { select: { nombre: true } } },
      });
      if (!existing) throw notFound("PAYMENT_NOT_FOUND", "Pago no encontrado");

      const movementIds = existing.applications.map((a) => a.movementId);
      await prisma.$transaction(async (tx) => {
        // Borrar applications primero
        await tx.paymentApplication.deleteMany({ where: { paymentId: id } });
        // Soft-delete del payment
        await tx.payment.update({ where: { id }, data: { deletedAt: new Date() } });
        // Recalcular status de cada movement afectado
        for (const movId of movementIds) {
          await recalcMovementStatus(tx, movId);
        }
      });
      await createAuditEntry({
        entityType: AuditEntityType.payment,
        entityId: id,
        userId: user.id,
        action: AuditAction.deleted,
        description: `Anuló pago a ${existing.supplier.nombre} (${existing.applications.length} aplicación(es) revertidas)`,
      });
      void checkInvariantOrWarn("delete payment", { paymentId: id });
      return { success: true, revertedApplications: existing.applications.length };
    });

    // ─── Payment Applications: aplicar / editar / quitar ─────────────────────

    app.post("/finance/payments/:id/applications", { preHandler: authorize(Module.FINANZAS, Action.EDIT) }, async (request) => {
      const user = ensureUser(request);
      const { id } = z.object({ id: z.string() }).parse(request.params);
      const body = z.object({
        applications: z.array(z.object({
          movementId: z.string(),
          monto: z.coerce.number().positive(),
        })).min(1),
      }).strict().parse(request.body);

      const payment = await prisma.payment.findFirst({
        where: { id, deletedAt: null },
        include: { applications: { select: { montoAplicado: true } } },
      });
      if (!payment) throw notFound("PAYMENT_NOT_FOUND", "Pago no encontrado");

      const aplicadoActual = payment.applications.reduce((acc, a) => acc + Number(a.montoAplicado), 0);
      const totalNuevo = body.applications.reduce((acc, a) => acc + a.monto, 0);
      const monto = Number(payment.monto);
      if (aplicadoActual + totalNuevo > monto + 0.005) {
        throw badRequest(
          "EXCEEDS_PAYMENT",
          `La aplicación total (${(aplicadoActual + totalNuevo).toFixed(2)}) excede el monto del pago (${monto.toFixed(2)}). Saldo disponible: ${(monto - aplicadoActual).toFixed(2)}`,
        );
      }

      // Validar movements
      const movIds = body.applications.map((a) => a.movementId);
      const movements = await prisma.financeMovement.findMany({
        where: { id: { in: movIds }, deletedAt: null },
        include: { paymentApplications: { include: { payment: { select: { deletedAt: true } } } } },
      });
      if (movements.length !== movIds.length) throw badRequest("MOVEMENT_INVALID", "Alguno de los movimientos no existe");

      for (const m of movements) {
        if (m.tipoMovimiento !== TipoMovimiento.GASTO) {
          throw badRequest("NOT_A_EXPENSE", `El movimiento ${m.descripcion} no es un gasto, no se puede aplicar pago`);
        }
        if (m.supplierId !== payment.supplierId) {
          throw badRequest("SUPPLIER_MISMATCH", `El movimiento ${m.descripcion} pertenece a otro proveedor`);
        }
        if (m.moneda !== payment.moneda) {
          throw badRequest("CURRENCY_MISMATCH", `La moneda del movimiento (${m.moneda}) no coincide con la del pago (${payment.moneda})`);
        }
        // Saldo pendiente del movement
        const activeApps = m.paymentApplications.filter((a) => !a.payment.deletedAt);
        const pagado = activeApps.reduce((acc, a) => acc + Number(a.montoAplicado), 0);
        const saldoMovement = Number(m.monto) - pagado;
        const aplicacion = body.applications.find((a) => a.movementId === m.id)!;
        if (aplicacion.monto > saldoMovement + 0.005) {
          throw badRequest(
            "EXCEEDS_MOVEMENT",
            `${m.descripcion}: el monto a aplicar (${aplicacion.monto.toFixed(2)}) excede el saldo pendiente (${saldoMovement.toFixed(2)})`,
          );
        }
        // Si ya hay una application para este (paymentId, movementId), rechazar (uso PATCH para editar)
        const existingApp = m.paymentApplications.find((a) => a.paymentId === id);
        if (existingApp) {
          throw badRequest(
            "APPLICATION_EXISTS",
            `Ya hay una aplicación de este pago a ${m.descripcion}. Usá PATCH para editar el monto.`,
          );
        }
      }

      const result = await prisma.$transaction(async (tx) => {
        for (const a of body.applications) {
          await tx.paymentApplication.create({
            data: {
              paymentId: id,
              movementId: a.movementId,
              montoAplicado: new Prisma.Decimal(a.monto),
            },
          });
          await recalcMovementStatus(tx, a.movementId);
        }
        return tx.payment.findUnique({
          where: { id },
          include: {
            supplier: { select: { id: true, nombre: true } },
            applications: {
              include: {
                movement: { select: { id: true, descripcion: true, monto: true, moneda: true, status: true, fecha: true, dueDate: true } },
              },
              orderBy: { createdAt: "asc" },
            },
          },
        });
      });

      for (const a of body.applications) {
        await createAuditEntry({
          entityType: AuditEntityType.payment_application,
          entityId: a.movementId,
          userId: user.id,
          action: AuditAction.created,
          description: `Aplicó ${a.monto.toFixed(2)} ${payment.moneda} del pago al movimiento`,
        });
      }

      const balance = await getPaymentBalance(id);
      void checkInvariantOrWarn("apply payment", { paymentId: id });
      return serializePayment(result!, balance ?? undefined);
    });

    app.patch("/finance/payments/:id/applications/:applicationId", { preHandler: authorize(Module.FINANZAS, Action.EDIT) }, async (request) => {
      const user = ensureUser(request);
      const { id, applicationId } = z.object({ id: z.string(), applicationId: z.string() }).parse(request.params);
      const body = z.object({ monto: z.coerce.number().positive() }).strict().parse(request.body);

      const app = await prisma.paymentApplication.findFirst({
        where: { id: applicationId, paymentId: id },
        include: {
          payment: { include: { applications: { select: { id: true, montoAplicado: true } } } },
          movement: { include: { paymentApplications: { include: { payment: { select: { deletedAt: true } } } } } },
        },
      });
      if (!app) throw notFound("APPLICATION_NOT_FOUND", "Aplicación no encontrada");
      if (app.payment.deletedAt) throw badRequest("PAYMENT_DELETED", "El pago está anulado");

      // Validar saldo del payment (sumar todas menos esta)
      const otrasApps = app.payment.applications.filter((a) => a.id !== applicationId);
      const aplicadoSinEsta = otrasApps.reduce((acc, a) => acc + Number(a.montoAplicado), 0);
      const monto = Number(app.payment.monto);
      if (aplicadoSinEsta + body.monto > monto + 0.005) {
        throw badRequest(
          "EXCEEDS_PAYMENT",
          `El nuevo monto excede el saldo del pago. Saldo disponible: ${(monto - aplicadoSinEsta).toFixed(2)}`,
        );
      }

      // Validar saldo del movement (sumar todas menos esta)
      const movActiveApps = app.movement.paymentApplications.filter((a) => !a.payment.deletedAt && a.id !== applicationId);
      const pagadoSinEsta = movActiveApps.reduce((acc, a) => acc + Number(a.montoAplicado), 0);
      const saldoMovement = Number(app.movement.monto) - pagadoSinEsta;
      if (body.monto > saldoMovement + 0.005) {
        throw badRequest(
          "EXCEEDS_MOVEMENT",
          `El nuevo monto excede el saldo pendiente del movimiento (${saldoMovement.toFixed(2)})`,
        );
      }

      await prisma.$transaction(async (tx) => {
        await tx.paymentApplication.update({
          where: { id: applicationId },
          data: { montoAplicado: new Prisma.Decimal(body.monto) },
        });
        await recalcMovementStatus(tx, app.movementId);
      });

      await createAuditEntry({
        entityType: AuditEntityType.payment_application,
        entityId: app.movementId,
        userId: user.id,
        action: AuditAction.updated,
        description: `Modificó aplicación de pago a ${body.monto.toFixed(2)} ${app.payment.moneda}`,
      });

      const balance = await getPaymentBalance(id);
      const refreshed = await prisma.payment.findUnique({
        where: { id },
        include: {
          supplier: { select: { id: true, nombre: true } },
          applications: {
            include: { movement: { select: { id: true, descripcion: true, monto: true, moneda: true, status: true, fecha: true, dueDate: true } } },
            orderBy: { createdAt: "asc" },
          },
        },
      });
      void checkInvariantOrWarn("change payment application", { paymentId: id });
      return serializePayment(refreshed!, balance ?? undefined);
    });

    app.delete("/finance/payments/:id/applications/:applicationId", { preHandler: authorize(Module.FINANZAS, Action.EDIT) }, async (request) => {
      const user = ensureUser(request);
      const { id, applicationId } = z.object({ id: z.string(), applicationId: z.string() }).parse(request.params);
      const app = await prisma.paymentApplication.findFirst({
        where: { id: applicationId, paymentId: id },
        include: { payment: { select: { id: true, deletedAt: true, moneda: true } } },
      });
      if (!app) throw notFound("APPLICATION_NOT_FOUND", "Aplicación no encontrada");

      await prisma.$transaction(async (tx) => {
        await tx.paymentApplication.delete({ where: { id: applicationId } });
        await recalcMovementStatus(tx, app.movementId);
      });

      await createAuditEntry({
        entityType: AuditEntityType.payment_application,
        entityId: app.movementId,
        userId: user.id,
        action: AuditAction.deleted,
        description: `Quitó aplicación de pago (${Number(app.montoAplicado).toFixed(2)} ${app.payment.moneda})`,
      });

      const balance = await getPaymentBalance(id);
      const refreshed = await prisma.payment.findUnique({
        where: { id },
        include: {
          supplier: { select: { id: true, nombre: true } },
          applications: {
            include: { movement: { select: { id: true, descripcion: true, monto: true, moneda: true, status: true, fecha: true, dueDate: true } } },
            orderBy: { createdAt: "asc" },
          },
        },
      });
      void checkInvariantOrWarn("change payment application", { paymentId: id });
      return serializePayment(refreshed!, balance ?? undefined);
    });

    // ─── Saldo a favor del proveedor (Payments con saldo sin aplicar) ────────
    //
    // Cuando un Payment tiene monto > Σ applications activas, ese remanente es
    // saldo a favor del proveedor. Estos endpoints listan ese saldo y permiten
    // aplicarlo automáticamente (FIFO) a una factura nueva.

    app.get("/finance/suppliers/:supplierId/saldo-a-favor", { preHandler: authorize(Module.FINANZAS, Action.VIEW) }, async (request) => {
      const { supplierId } = z.object({ supplierId: z.string() }).parse(request.params);
      const query = z.object({
        moneda: z.nativeEnum(Moneda),
      }).parse(request.query);

      const supplier = await prisma.supplier.findFirst({ where: { id: supplierId, deletedAt: null } });
      if (!supplier) throw notFound("SUPPLIER_NOT_FOUND", "Proveedor no encontrado");

      const payments = await prisma.payment.findMany({
        where: { supplierId, moneda: query.moneda, deletedAt: null },
        include: {
          applications: {
            include: { movement: { select: { deletedAt: true } } },
          },
        },
        orderBy: { fecha: "asc" }, // FIFO
      });

      const result = payments
        .map((p) => {
          // Ignoramos applications a movements borrados.
          const aplicado = p.applications
            .filter((a) => !a.movement || a.movement.deletedAt === null)
            .reduce((s, a) => s + Number(a.montoAplicado), 0);
          const saldoSinAplicar = roundMoney(Number(p.monto) - aplicado);
          return {
            id: p.id,
            fecha: serializeDateOnly(p.fecha),
            monto: Number(p.monto),
            saldoSinAplicar,
            referencia: p.referencia,
            metodo: p.metodo,
          };
        })
        .filter((p) => p.saldoSinAplicar > 0.005);

      const total = roundMoney(result.reduce((s, p) => s + p.saldoSinAplicar, 0));

      return {
        total,
        moneda: query.moneda,
        payments: result,
      };
    });

    app.post("/finance/movements/:id/apply-saldo-a-favor", { preHandler: authorize(Module.FINANZAS, Action.EDIT) }, async (request) => {
      const user = ensureUser(request);
      const { id: movementId } = z.object({ id: z.string() }).parse(request.params);

      const result = await prisma.$transaction(async (tx) => {
        const movement = await tx.financeMovement.findFirst({
          where: { id: movementId, deletedAt: null },
          include: {
            paymentApplications: { include: { payment: { select: { deletedAt: true } } } },
          },
        });
        if (!movement) throw notFound("MOVEMENT_NOT_FOUND", "Movimiento no encontrado");
        if (movement.tipoMovimiento !== TipoMovimiento.GASTO) {
          throw badRequest("INVALID_MOVEMENT_TYPE", "Sólo se puede aplicar saldo a favor a GASTOS.");
        }
        if (!movement.supplierId) {
          throw badRequest("SUPPLIER_REQUIRED", "El movimiento debe tener un proveedor asignado.");
        }

        const aplicadoExistente = movement.paymentApplications
          .filter((pa) => !pa.payment.deletedAt)
          .reduce((s, pa) => s + Number(pa.montoAplicado), 0);
        let saldoPendiente = roundMoney(Number(movement.monto) - aplicadoExistente);
        if (saldoPendiente <= 0.005) {
          throw badRequest("FACTURA_YA_PAGADA", "La factura ya está totalmente pagada.");
        }

        // Movements ya aplicados desde estos Payments — para evitar conflicto
        // con la unique constraint (paymentId, movementId).
        const yaAplicadosDeesteMov = new Set(
          movement.paymentApplications.filter((pa) => !pa.payment.deletedAt).map((pa) => pa.paymentId),
        );

        // Buscar Payments del proveedor con saldo a favor, FIFO.
        const payments = await tx.payment.findMany({
          where: { supplierId: movement.supplierId, moneda: movement.moneda, deletedAt: null },
          include: {
            applications: { include: { movement: { select: { deletedAt: true } } } },
          },
          orderBy: { fecha: "asc" },
        });

        const paymentsConSaldo = payments
          .map((p) => {
            const aplicado = p.applications
              .filter((a) => !a.movement || a.movement.deletedAt === null)
              .reduce((s, a) => s + Number(a.montoAplicado), 0);
            return { payment: p, saldoSinAplicar: roundMoney(Number(p.monto) - aplicado) };
          })
          .filter(({ payment, saldoSinAplicar }) =>
            saldoSinAplicar > 0.005 && !yaAplicadosDeesteMov.has(payment.id),
          );

        if (paymentsConSaldo.length === 0) {
          throw badRequest("NO_HAY_SALDO_A_FAVOR", "El proveedor no tiene saldo a favor disponible para aplicar.");
        }

        // Aplicar FIFO.
        let totalAplicadoNuevo = 0;
        const applicationsCreadas: { paymentId: string; montoAplicado: number }[] = [];
        for (const { payment, saldoSinAplicar } of paymentsConSaldo) {
          if (saldoPendiente <= 0.005) break;
          const aplicar = roundMoney(Math.min(saldoSinAplicar, saldoPendiente));
          if (aplicar <= 0.005) continue;
          await tx.paymentApplication.create({
            data: {
              paymentId: payment.id,
              movementId,
              montoAplicado: new Prisma.Decimal(aplicar),
            },
          });
          applicationsCreadas.push({ paymentId: payment.id, montoAplicado: aplicar });
          saldoPendiente = roundMoney(saldoPendiente - aplicar);
          totalAplicadoNuevo += aplicar;
        }

        // Recalcular status del movement vía helper centralizado.
        const recalc = await recalcMovementStatus(tx, movementId);

        return {
          totalAplicado: roundMoney(totalAplicadoNuevo),
          applicationsCreadas,
          saldoPendiente,
          newStatus: recalc?.status ?? movement.status,
        };
      });

      await createAuditEntry({
        entityType: AuditEntityType.finance_movement,
        entityId: movementId,
        userId: user.id,
        action: AuditAction.updated,
        description: `Aplicó saldo a favor: ${result.totalAplicado} desde ${result.applicationsCreadas.length} pago(s)`,
        metadata: { applicationsCreadas: result.applicationsCreadas, newStatus: result.newStatus },
      });

      void checkInvariantOrWarn("apply saldo a favor", { movementId });
      return result;
    });

    // ─── Estado de cuenta del proveedor ──────────────────────────────────────

    app.get("/finance/suppliers/:id/account-summary", { preHandler: authorize(Module.FINANZAS, Action.VIEW) }, async (request) => {
      const { id } = z.object({ id: z.string() }).parse(request.params);
      const query = z.object({
        fechaDesde: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
        fechaHasta: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
        soloPendientes: z.enum(["true", "false"]).optional(),
      }).parse(request.query);

      const supplier = await prisma.supplier.findFirst({ where: { id, deletedAt: null } });
      if (!supplier) throw notFound("SUPPLIER_NOT_FOUND", "Proveedor no encontrado");

      const fechaWhere: { gte?: Date; lte?: Date } = {};
      if (query.fechaDesde) fechaWhere.gte = parseDateOnly(query.fechaDesde);
      if (query.fechaHasta) fechaWhere.lte = parseDateOnly(query.fechaHasta);

      // Movimientos GASTO del proveedor (facturas)
      const movements = await prisma.financeMovement.findMany({
        where: {
          deletedAt: null,
          supplierId: id,
          tipoMovimiento: TipoMovimiento.GASTO,
          status: { in: [
            FinanceMovementStatus.COMPROMETIDO,
            FinanceMovementStatus.A_PAGAR,
            FinanceMovementStatus.PARCIALMENTE_PAGADO,
            FinanceMovementStatus.PAGADO,
          ] },
          ...(Object.keys(fechaWhere).length ? { fecha: fechaWhere } : {}),
        },
        include: { paymentApplications: { include: { payment: { select: { id: true, fecha: true, deletedAt: true } } } } },
        orderBy: { fecha: "asc" },
      });

      // Pagos del proveedor
      const payments = await prisma.payment.findMany({
        where: {
          supplierId: id,
          deletedAt: null,
          ...(Object.keys(fechaWhere).length ? { fecha: fechaWhere } : {}),
        },
        include: { applications: { select: { montoAplicado: true } } },
        orderBy: { fecha: "asc" },
      });

      // Construir filas de facturas
      const facturas = movements.map((m) => {
        const monto = Number(m.monto);
        const activeApps = m.paymentApplications.filter((a) => !a.payment.deletedAt);
        const pagado = activeApps.reduce((acc, a) => acc + Number(a.montoAplicado), 0);
        const saldo = Math.round((monto - pagado) * 100) / 100;
        return {
          id: m.id,
          fecha: serializeDateOnly(m.fecha),
          descripcion: m.descripcion,
          monto,
          moneda: m.moneda,
          montoPagado: Math.round(pagado * 100) / 100,
          saldoPendiente: saldo,
          status: m.status,
          dueDate: m.dueDate ? serializeDateOnly(m.dueDate) : null,
        };
      });

      const facturasFiltradas = query.soloPendientes === "true"
        ? facturas.filter((f) => f.saldoPendiente > 0)
        : facturas;

      // Construir filas de pagos
      const pagos = payments.map((p) => {
        const monto = Number(p.monto);
        const aplicado = p.applications.reduce((acc, a) => acc + Number(a.montoAplicado), 0);
        const saldoSinAplicar = Math.round((monto - aplicado) * 100) / 100;
        return {
          id: p.id,
          fecha: serializeDateOnly(p.fecha),
          monto,
          moneda: p.moneda,
          metodo: p.metodo,
          referencia: p.referencia,
          montoAplicado: Math.round(aplicado * 100) / 100,
          saldoSinAplicar,
        };
      });

      // Totales por moneda
      let facturasPendientesUSD = 0, facturasPendientesUYU = 0;
      let saldoAFavorUSD = 0, saldoAFavorUYU = 0;
      for (const f of facturas) {
        if (f.saldoPendiente <= 0) continue;
        if (f.moneda === Moneda.USD) facturasPendientesUSD += f.saldoPendiente;
        else facturasPendientesUYU += f.saldoPendiente;
      }
      for (const p of pagos) {
        if (p.saldoSinAplicar <= 0) continue;
        if (p.moneda === Moneda.USD) saldoAFavorUSD += p.saldoSinAplicar;
        else saldoAFavorUYU += p.saldoSinAplicar;
      }

      // Línea de tiempo (usamos sólo el subset filtrado por fecha)
      type EdcRow = { tipo: "factura" | "pago"; fecha: string; monto: number; moneda: Moneda; descripcion: string; saldoAcumuladoUSD: number };
      const lastRate = await prisma.exchangeRate.findFirst({ orderBy: { createdAt: "desc" } });
      const fallbackRate = lastRate ? (decimalToNumber(lastRate.usdToUyu) ?? 1) : 1;
      function toUsd(amount: number, moneda: Moneda) {
        if (moneda === Moneda.USD) return amount;
        return fallbackRate > 0 ? amount / fallbackRate : amount;
      }

      const eventos: EdcRow[] = [];
      for (const f of facturasFiltradas) {
        if (!f.fecha) continue;
        eventos.push({
          tipo: "factura",
          fecha: f.fecha,
          monto: f.monto,
          moneda: f.moneda,
          descripcion: f.descripcion,
          saldoAcumuladoUSD: 0,
        });
      }
      for (const p of pagos) {
        if (!p.fecha) continue;
        eventos.push({
          tipo: "pago",
          fecha: p.fecha,
          monto: p.monto,
          moneda: p.moneda,
          descripcion: `Pago${p.referencia ? ` ref. ${p.referencia}` : ""} (${p.metodo})`,
          saldoAcumuladoUSD: 0,
        });
      }
      eventos.sort((a, b) => (a.fecha < b.fecha ? -1 : a.fecha > b.fecha ? 1 : 0));
      let acum = 0;
      const estadoDeCuenta = eventos.map((e) => {
        const usd = toUsd(e.monto, e.moneda);
        // Factura suma deuda (positivo = debemos), pago resta deuda
        acum += e.tipo === "factura" ? usd : -usd;
        return { ...e, saldoAcumuladoUSD: Math.round(acum * 100) / 100 };
      });

      return {
        supplier: {
          id: supplier.id,
          nombre: supplier.nombre,
          rut: supplier.rut,
          contactoNombre: supplier.contactoNombre,
          email: supplier.email,
          telefono: supplier.telefono,
          direccion: supplier.direccion,
          condicionPago: supplier.condicionPago,
        },
        totals: {
          facturasPendientesUSD: Math.round(facturasPendientesUSD * 100) / 100,
          facturasPendientesUYU: Math.round(facturasPendientesUYU * 100) / 100,
          saldoAFavorUSD: Math.round(saldoAFavorUSD * 100) / 100,
          saldoAFavorUYU: Math.round(saldoAFavorUYU * 100) / 100,
          saldoNetoUSD: Math.round((facturasPendientesUSD - saldoAFavorUSD) * 100) / 100,
          saldoNetoUYU: Math.round((facturasPendientesUYU - saldoAFavorUYU) * 100) / 100,
        },
        exchangeRate: lastRate ? { usdToUyu: fallbackRate, date: serializeDate(lastRate.date) } : null,
        facturas: facturasFiltradas,
        pagos,
        estadoDeCuenta,
      };
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

    // ─── Finance: Supplier Invoices (deudas pendientes) ──────────────────────
    // Crea una FACTURA A PAGAR como FinanceMovement con status A_PAGAR.
    // Esta es la fuente de verdad canónica para deuda a proveedor (reemplaza
    // el flujo legacy de FinanceComprobante).
    app.post("/finance/supplier-invoices", { preHandler: authorize(Module.FINANZAS, Action.EDIT) }, async (request) => {
      const user = ensureUser(request);
      const body = z.object({
        supplierId: z.string().min(1),
        descripcion: z.string().min(1),
        monto: z.coerce.number().positive(),
        moneda: z.nativeEnum(Moneda),
        fechaEmision: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
        fechaVencimiento: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
        invoiceNumber: z.string().optional(),
        projectId: z.string().optional(),
      }).strict().parse(request.body);

      const supplier = await prisma.supplier.findFirst({ where: { id: body.supplierId, deletedAt: null } });
      if (!supplier) throw notFound("SUPPLIER_NOT_FOUND", "Proveedor no encontrado");

      if (body.projectId) {
        const project = await prisma.project.findFirst({ where: { id: body.projectId, deletedAt: null } });
        if (!project) throw notFound("PROJECT_NOT_FOUND", "Proyecto no encontrado");
      }

      const fechaEmision = body.fechaEmision ? parseDateOnly(body.fechaEmision) : new Date();
      const fechaVencimiento = parseDateOnly(body.fechaVencimiento);

      const movement = await prisma.financeMovement.create({
        data: {
          tipoMovimiento: TipoMovimiento.GASTO,
          categoriaPrincipal: CategoriaPrincipal.PAGO_PROVEEDOR,
          status: FinanceMovementStatus.A_PAGAR,
          sourceType: MovementSourceType.MANUAL,
          estadoAprobacion: EstadoAprobacion.REGISTRADO,
          supplierId: body.supplierId,
          projectId: body.projectId ?? null,
          descripcion: body.descripcion,
          monto: new Prisma.Decimal(body.monto),
          moneda: body.moneda,
          fecha: fechaEmision,
          dueDate: fechaVencimiento,
          invoiceNumber: body.invoiceNumber ?? null,
          mes: fechaVencimiento.getUTCMonth() + 1,
          anio: fechaVencimiento.getUTCFullYear(),
          pagado: false,
          impactaFlujo: true,
          creadoPorId: user.id,
        },
      });

      await createAuditEntry({
        entityType: AuditEntityType.finance_movement,
        entityId: movement.id,
        userId: user.id,
        action: AuditAction.created,
        description: `Registró factura a pagar de ${supplier.nombre} por ${body.monto} ${body.moneda}${body.invoiceNumber ? ` (Nº ${body.invoiceNumber})` : ""}`,
      });

      return { ...movement, monto: decimalToNumber(movement.monto) };
    });

    // ─── Finance: Reports ─────────────────────────────────────────────────────

    app.get("/finance/reports/results", { preHandler: authorize(Module.FINANZAS, Action.VIEW) }, async (request) => {
      const { anio } = z.object({ anio: z.coerce.number().int().default(new Date().getUTCFullYear()) }).parse(request.query);

      const lastRate = await prisma.exchangeRate.findFirst({ orderBy: { createdAt: "desc" } });
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
        select: { tipoMovimiento: true, monto: true, moneda: true, ivaTasa: true, tipoCambio: true, cobrado: true, pagado: true, status: true },
      });

      const lastRate = await prisma.exchangeRate.findFirst({ orderBy: { createdAt: "desc" } });
      const fallbackRate = lastRate ? (decimalToNumber(lastRate.usdToUyu) ?? 1) : 1;

      function toUsd(m: (typeof movements)[number]): number {
        const amount = decimalToNumber(m.monto) ?? 0;
        if (m.moneda === Moneda.USD) return amount;
        const rate = m.tipoCambio ? (decimalToNumber(m.tipoCambio) ?? fallbackRate) : fallbackRate;
        return rate > 0 ? amount / rate : amount;
      }

      let saldoActual = 0, porCobrar = 0, porPagar = 0;
      let previstoTotal = 0, comprometidoTotal = 0, aPagarTotal = 0;
      let saldoActualConIva = 0, porCobrarConIva = 0, porPagarConIva = 0;
      let previstoTotalConIva = 0, comprometidoTotalConIva = 0, aPagarTotalConIva = 0;
      for (const m of movements) {
        const usd = toUsd(m);
        const ivaFactor = 1 + ((m.ivaTasa ?? 22) / 100);
        const usdConIva = usd * ivaFactor;
        if (m.tipoMovimiento === TipoMovimiento.INGRESO) {
          if (m.cobrado) { saldoActual += usd; saldoActualConIva += usdConIva; }
          else { porCobrar += usd; porCobrarConIva += usdConIva; }
        } else if (m.tipoMovimiento === TipoMovimiento.GASTO) {
          if (m.pagado) { saldoActual -= usd; saldoActualConIva -= usdConIva; }
          else { porPagar += usd; porPagarConIva += usdConIva; }
          if (m.status === FinanceMovementStatus.PREVISTO) { previstoTotal += usd; previstoTotalConIva += usdConIva; }
          else if (m.status === FinanceMovementStatus.COMPROMETIDO) { comprometidoTotal += usd; comprometidoTotalConIva += usdConIva; }
          else if (m.status === FinanceMovementStatus.A_PAGAR) { aPagarTotal += usd; aPagarTotalConIva += usdConIva; }
        }
      }

      return {
        saldoActual,
        porCobrar,
        porPagar,
        saldoProyectado: saldoActual + porCobrar - porPagar,
        previstoTotal,
        comprometidoTotal,
        aPagarTotal,
        saldoProyectadoSinPrevistos: saldoActual + porCobrar - (comprometidoTotal + aPagarTotal),
        // Versiones con IVA (G.7)
        porCobrarConIva,
        porPagarConIva,
        saldoProyectadoConIva: saldoActualConIva + porCobrarConIva - porPagarConIva,
        previstoTotalConIva,
        comprometidoTotalConIva,
        aPagarTotalConIva,
        saldoProyectadoSinPrevistosConIva: saldoActualConIva + porCobrarConIva - (comprometidoTotalConIva + aPagarTotalConIva),
      };
    });

    app.get("/finance/reports/dashboard", { preHandler: authorize(Module.FINANZAS, Action.VIEW) }, async () => {
      const now = new Date();
      const mes = now.getUTCMonth() + 1;
      const anio = now.getUTCFullYear();

      const lastRate = await prisma.exchangeRate.findFirst({ orderBy: { createdAt: "desc" } });
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
      let ingresosConIva = 0, gastosConIva = 0, pendienteCobroConIva = 0, pendientePagoConIva = 0;
      for (const m of movements) {
        const usd = toUsd(m.monto, m.moneda, m.tipoCambio);
        const ivaFactor = 1 + ((m.ivaTasa ?? 22) / 100);
        const usdConIva = usd * ivaFactor;
        if (m.tipoMovimiento === TipoMovimiento.INGRESO) {
          ingresos += usd; ingresosConIva += usdConIva;
          if (!m.cobrado) { pendienteCobro += usd; pendienteCobroConIva += usdConIva; }
        } else if (m.tipoMovimiento === TipoMovimiento.GASTO) {
          gastos += usd; gastosConIva += usdConIva;
          if (!m.pagado) { pendientePago += usd; pendientePagoConIva += usdConIva; }
        }
      }

      return {
        mes, anio,
        ingresos, gastos, resultado: ingresos - gastos,
        pendienteCobro, pendientePago,
        ingresosConIva, gastosConIva, resultadoConIva: ingresosConIva - gastosConIva,
        pendienteCobroConIva, pendientePagoConIva,
        ultimosMovimientos: movements.slice(0, 10).map((m) => ({
          id: m.id, fecha: serializeDate(m.fecha), descripcion: m.descripcion,
          tipoMovimiento: m.tipoMovimiento, monto: decimalToNumber(m.monto), moneda: m.moneda,
          ivaTasa: m.ivaTasa,
          project: m.project, supplier: m.supplier,
        })),
      };
    });

    app.get("/finance/reports/by-project/:projectId", { preHandler: authorize(Module.FINANZAS, Action.VIEW) }, async (request) => {
      const { projectId } = z.object({ projectId: z.string() }).parse(request.params);
      const project = await prisma.project.findFirst({ where: { id: projectId, deletedAt: null }, select: { id: true, clientName: true, code: true } });
      if (!project) throw notFound("PROJECT_NOT_FOUND", "Proyecto no encontrado");

      const lastRate = await prisma.exchangeRate.findFirst({ orderBy: { createdAt: "desc" } });
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

    // ─── Stock: Productos (sobre MaterialItem unificado) ─────────────────────
    //
    // Tras la unificación de Stock + Materiales (2026-04-26) los productos del
    // catálogo viven en MaterialItem. Estos endpoints siguen exponiendo la
    // ruta legacy /stock/products devolviendo MaterialItems con
    // gestionaStock=true. La creación/edición/eliminación del catálogo se
    // hace desde /api/materials/items (mismo modelo).

    app.get("/stock/products", { preHandler: authorize(Module.STOCK, Action.VIEW) }, async (request) => {
      const query = z.object({
        categoryId: z.string().optional(),
        categoria: z.string().optional(),
        activo: z.enum(["true", "false"]).optional(),
        gestionaStock: z.enum(["true", "false", "all"]).optional(),
      }).parse(request.query);
      const activo = query.activo === undefined ? true : query.activo === "true";

      const where: Prisma.MaterialItemWhereInput = { activo };
      if (query.categoryId) where.categoryId = query.categoryId;
      if (query.categoria) where.category = { nombre: query.categoria };
      if (query.gestionaStock !== "all") {
        where.gestionaStock = query.gestionaStock === undefined ? true : query.gestionaStock === "true";
      }

      const items = await prisma.materialItem.findMany({
        where,
        include: {
          category: { select: { id: true, nombre: true, orden: true } },
          defaultSupplier: { select: { id: true, nombre: true } },
        },
        orderBy: [{ category: { orden: "asc" } }, { nombre: "asc" }],
      });

      return items.map((it) => {
        const stockActual = Number(it.stockActual);
        const stockMinimo = it.stockMinimo === null ? null : Number(it.stockMinimo);
        return {
          id: it.id,
          nombre: it.nombre,
          descripcion: it.descripcion,
          categoria: it.category?.nombre ?? "—",
          categoryId: it.categoryId,
          unidad: it.unidad,
          moneda: it.moneda,
          activo: it.activo,
          gestionaStock: it.gestionaStock,
          ubicacionDeposito: it.ubicacionDeposito,
          stockActual,
          stockMinimo,
          precioSugerido: it.precioSugerido === null ? null : decimalToNumber(it.precioSugerido),
          defaultSupplier: it.defaultSupplier,
          bajominimo: it.gestionaStock && stockMinimo !== null && stockActual < stockMinimo,
          createdAt: serializeDate(it.createdAt),
          updatedAt: serializeDate(it.updatedAt),
        };
      });
    });

    // ─── Stock: Movements ─────────────────────────────────────────────────────

    app.get("/stock/movements", { preHandler: authorize(Module.STOCK, Action.VIEW) }, async (request) => {
      const query = z.object({
        materialItemId: z.string().optional(),
        // legacy: aceptamos productId y lo mapeamos
        productId: z.string().optional(),
        projectId: z.string().optional(),
        tipo: z.nativeEnum(TipoMovimientoStock).optional(),
        includeReversed: z.enum(["true", "false"]).optional(),
        page: z.coerce.number().int().positive().optional(),
        limit: z.coerce.number().int().positive().max(100).optional(),
      }).parse(request.query);

      const itemId = query.materialItemId ?? query.productId;
      const take = query.limit ?? 20;
      const skip = ((query.page ?? 1) - 1) * take;

      const where: Prisma.StockMovementWhereInput = {
        ...(itemId ? { materialItemId: itemId } : {}),
        ...(query.projectId ? { projectId: query.projectId } : {}),
        ...(query.tipo ? { tipo: query.tipo } : {}),
        ...(query.includeReversed === "true" ? {} : { reversed: false }),
      };

      const [movements, total] = await prisma.$transaction([
        prisma.stockMovement.findMany({
          where,
          include: {
            materialItem: {
              select: {
                id: true, nombre: true, unidad: true,
                category: { select: { id: true, nombre: true } },
              },
            },
            supplier: { select: { id: true, nombre: true } },
            project: { select: { id: true, clientName: true, code: true } },
          },
          orderBy: { fecha: "desc" },
          skip,
          take,
        }),
        prisma.stockMovement.count({ where }),
      ]);

      return {
        data: movements.map((m) => ({
          id: m.id,
          fecha: serializeDate(m.fecha),
          tipo: m.tipo,
          cantidad: Number(m.cantidad),
          costoUnitario: m.costoUnitario ? decimalToNumber(m.costoUnitario) : null,
          costoTotal: m.costoTotal ? decimalToNumber(m.costoTotal) : null,
          moneda: m.moneda,
          stockResultante: Number(m.stockResultante),
          materialItemId: m.materialItemId,
          // alias para retrocompat con la UI vieja:
          product: m.materialItem ? {
            id: m.materialItem.id,
            nombre: m.materialItem.nombre,
            unidad: m.materialItem.unidad,
            categoria: m.materialItem.category?.nombre ?? "—",
          } : null,
          materialItem: m.materialItem,
          supplier: m.supplier,
          project: m.project,
          financeMovementId: m.financeMovementId,
          invoiceItemId: m.invoiceItemId,
          causaIngreso: m.causaIngreso,
          reversed: m.reversed,
          referencia: m.referencia,
          observaciones: m.observaciones,
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
        // legacy: productId también se acepta
        materialItemId: z.string().min(1).optional(),
        productId: z.string().min(1).optional(),
        tipo: z.nativeEnum(TipoMovimientoStock),
        cantidad: z.coerce.number().int({ message: "Las cantidades deben ser enteras" }).positive(),
        costoUnitario: z.coerce.number().min(0).optional(),
        moneda: z.nativeEnum(Moneda).default(Moneda.USD),
        supplierId: z.string().optional(),
        projectId: z.string().optional(),
        financeMovementId: z.string().optional(),
        causaIngreso: z.nativeEnum(ExpenseSourceType).optional(),
        referencia: z.string().optional(),
        observaciones: z.string().optional(),
      }).strict()
        .refine((d) => Boolean(d.materialItemId ?? d.productId), { message: "materialItemId requerido" })
        .parse(request.body);

      const itemId = body.materialItemId ?? body.productId!;
      const item = await prisma.materialItem.findFirst({ where: { id: itemId, activo: true } });
      if (!item) throw notFound("MATERIAL_ITEM_NOT_FOUND", "Ítem no encontrado o inactivo");
      if (!item.gestionaStock) throw badRequest("ITEM_NO_STOCK", "Este ítem no gestiona stock (gestionaStock=false)");

      const stockActual = Number(item.stockActual);
      let nuevoStock: number;
      let descripcion: string;

      if (body.tipo === TipoMovimientoStock.INGRESO) {
        nuevoStock = stockActual + body.cantidad;
        descripcion = `Ingreso de ${body.cantidad} ${item.unidad} de ${item.nombre}`;
      } else if (body.tipo === TipoMovimientoStock.EGRESO) {
        if (stockActual < body.cantidad) {
          throw badRequest("INSUFFICIENT_STOCK", `Stock insuficiente. Disponible: ${stockActual} ${item.unidad}`);
        }
        nuevoStock = stockActual - body.cantidad;
        descripcion = `Egreso de ${body.cantidad} ${item.unidad} de ${item.nombre}`;
      } else {
        nuevoStock = body.cantidad;
        descripcion = `Ajuste de stock de ${item.nombre} a ${body.cantidad} ${item.unidad}`;
      }

      const costoTotal = body.costoUnitario ? body.cantidad * body.costoUnitario : null;

      const [stockMovement] = await prisma.$transaction([
        prisma.stockMovement.create({
          data: {
            fecha: parseDateOnly(body.fecha),
            materialItemId: itemId,
            tipo: body.tipo,
            cantidad: new Prisma.Decimal(body.cantidad),
            costoUnitario: body.costoUnitario ? new Prisma.Decimal(body.costoUnitario) : null,
            costoTotal: costoTotal ? new Prisma.Decimal(costoTotal) : null,
            moneda: body.moneda,
            stockResultante: new Prisma.Decimal(nuevoStock),
            supplierId: body.supplierId,
            projectId: body.projectId,
            financeMovementId: body.financeMovementId,
            causaIngreso: body.causaIngreso,
            referencia: body.referencia,
            observaciones: body.observaciones,
          },
        }),
        prisma.materialItem.update({
          where: { id: itemId },
          data: { stockActual: new Prisma.Decimal(nuevoStock) },
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
        id: stockMovement.id,
        fecha: serializeDate(stockMovement.fecha),
        tipo: stockMovement.tipo,
        cantidad: Number(stockMovement.cantidad),
        costoUnitario: stockMovement.costoUnitario ? decimalToNumber(stockMovement.costoUnitario) : null,
        costoTotal: stockMovement.costoTotal ? decimalToNumber(stockMovement.costoTotal) : null,
        stockResultante: Number(stockMovement.stockResultante),
        nuevoStockActual: nuevoStock,
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

      const item = await prisma.materialItem.findFirst({
        where: { id },
        include: { category: { select: { id: true, nombre: true } } },
      });
      if (!item) throw notFound("MATERIAL_ITEM_NOT_FOUND", "Ítem no encontrado");

      const [movements, total] = await prisma.$transaction([
        prisma.stockMovement.findMany({
          where: { materialItemId: id, reversed: false },
          include: {
            supplier: { select: { id: true, nombre: true } },
            project: { select: { id: true, clientName: true, code: true } },
          },
          orderBy: { fecha: "desc" },
          skip,
          take,
        }),
        prisma.stockMovement.count({ where: { materialItemId: id, reversed: false } }),
      ]);

      return {
        product: {
          id: item.id,
          nombre: item.nombre,
          categoria: item.category?.nombre ?? "—",
          unidad: item.unidad,
          stockActual: Number(item.stockActual),
        },
        data: movements.map((m) => ({
          id: m.id, fecha: serializeDate(m.fecha), tipo: m.tipo,
          cantidad: Number(m.cantidad),
          costoUnitario: m.costoUnitario ? decimalToNumber(m.costoUnitario) : null,
          costoTotal: m.costoTotal ? decimalToNumber(m.costoTotal) : null,
          stockResultante: Number(m.stockResultante),
          supplier: m.supplier, project: m.project,
          referencia: m.referencia, observaciones: m.observaciones,
          causaIngreso: m.causaIngreso,
          createdAt: serializeDate(m.createdAt),
        })),
        total, page: query.page ?? 1, limit: take, totalPages: Math.ceil(total / take),
      };
    });

    app.get("/stock/alerts", { preHandler: authorize(Module.STOCK, Action.VIEW) }, async () => {
      const items = await prisma.materialItem.findMany({
        where: { activo: true, gestionaStock: true, stockMinimo: { not: null } },
        include: { category: { select: { id: true, nombre: true } } },
        orderBy: { stockActual: "asc" },
      });

      return items
        .map((it) => {
          const actual = Number(it.stockActual);
          const minimo = it.stockMinimo === null ? 0 : Number(it.stockMinimo);
          return {
            id: it.id,
            nombre: it.nombre,
            categoria: it.category?.nombre ?? "—",
            unidad: it.unidad,
            stockActual: actual,
            stockMinimo: minimo,
            moneda: it.moneda,
            ratio: minimo > 0 ? actual / minimo : 0,
          };
        })
        .filter((a) => a.stockActual < a.stockMinimo)
        .sort((a, b) => a.ratio - b.ratio);
    });

    // ─── Asistente IA: text-to-SQL con guardrails ────────────────────────────
    //
    // Sólo accesible para roles con role.name = ADMIN. El service ejecuta SQL
    // generado por Claude vía un usuario PG read-only que NO tiene SELECT
    // sobre tablas sensibles (audit_logs, ai_queries, etc.). El validador
    // local también rechaza palabras prohibidas como segunda capa.

    async function requireAdminRole(request: import("fastify").FastifyRequest) {
      const user = request.user;
      if (!user) throw badRequest("AUTH_CONTEXT_MISSING", "No autenticado");
      if (user.role !== "ADMIN") {
        throw forbidden("Sólo usuarios ADMIN pueden usar el asistente IA");
      }
    }

    app.get("/ai/status", { preHandler: requireAdminRole }, async () => {
      const { isAIAssistantEnabled } = await import("../services/ai-assistant.service.js");
      const enabled = isAIAssistantEnabled();
      return {
        enabled,
        message: enabled
          ? "Asistente IA disponible."
          : "Falta configurar ANTHROPIC_API_KEY o DATABASE_URL_READONLY en el server.",
      };
    });

    app.post("/ai/ask", { preHandler: requireAdminRole }, async (request, reply) => {
      const user = ensureUser(request);
      const body = z.object({
        question: z.string().min(1).max(2000),
      }).strict().parse(request.body);

      const { processQuestion, isAIAssistantEnabled, AICannotGenerateError, AISQLInvalidError, AIExecutionError } =
        await import("../services/ai-assistant.service.js");
      const { checkRateLimit } = await import("../services/ai-rate-limit.service.js");

      if (!isAIAssistantEnabled()) {
        return reply.status(503).send({
          error: "El asistente IA no está configurado en este server (falta ANTHROPIC_API_KEY o DATABASE_URL_READONLY).",
        });
      }

      // Rate limit
      const rl = await checkRateLimit(user.id);
      if (!rl.allowed) {
        await prisma.aIQuery.create({
          data: {
            userId: user.id,
            question: body.question,
            status: "RATE_LIMIT_EXCEEDED",
            errorMessage: rl.message,
          },
        });
        return reply.status(429).send({ error: rl.message });
      }

      const startTime = Date.now();
      try {
        const result = await processQuestion(body.question);
        const durationMs = Date.now() - startTime;

        await prisma.aIQuery.create({
          data: {
            userId: user.id,
            question: body.question,
            generatedSQL: result.generatedSQL,
            result: result.result as Prisma.InputJsonValue,
            response: result.response,
            status: "SUCCESS",
            tokensInput: result.tokens.input,
            tokensOutput: result.tokens.output,
            costUSD: new Prisma.Decimal(result.costUSD.toFixed(6)),
            durationMs,
          },
        });

        return {
          response: result.response,
          sql: result.generatedSQL,
          rowCount: result.rowCount,
          costUSD: Number(result.costUSD.toFixed(6)),
          tokens: result.tokens,
          durationMs,
        };
      } catch (err) {
        const durationMs = Date.now() - startTime;
        let status: "SQL_INVALID" | "EXECUTION_ERROR" | "AI_ERROR" = "AI_ERROR";
        let generatedSQL: string | null = null;
        let errorMessage = err instanceof Error ? err.message : String(err);
        if (err instanceof AISQLInvalidError) {
          status = "SQL_INVALID";
          generatedSQL = err.generatedSQL;
        } else if (err instanceof AIExecutionError) {
          status = "EXECUTION_ERROR";
          generatedSQL = err.generatedSQL;
        } else if (err instanceof AICannotGenerateError) {
          // Lo dejamos como AI_ERROR para no inflar el enum.
          status = "AI_ERROR";
        }

        await prisma.aIQuery.create({
          data: {
            userId: user.id,
            question: body.question,
            generatedSQL: generatedSQL ?? undefined,
            status,
            errorMessage,
            durationMs,
          },
        });

        return reply.status(400).send({ error: errorMessage });
      }
    });

    app.get("/ai/history", { preHandler: requireAdminRole }, async (request) => {
      const user = ensureUser(request);
      const items = await prisma.aIQuery.findMany({
        where: { userId: user.id },
        orderBy: { createdAt: "desc" },
        take: 50,
        select: {
          id: true,
          question: true,
          response: true,
          generatedSQL: true,
          status: true,
          errorMessage: true,
          costUSD: true,
          durationMs: true,
          createdAt: true,
        },
      });
      return items.map((q) => ({
        ...q,
        costUSD: q.costUSD ? Number(q.costUSD) : 0,
        createdAt: serializeDate(q.createdAt),
      }));
    });

    // Logs globales (para una página /admin/ai-logs).
    app.get("/ai/logs", { preHandler: requireAdminRole }, async (request) => {
      const query = z.object({
        limit: z.coerce.number().int().min(1).max(200).optional().default(50),
      }).parse(request.query);
      const items = await prisma.aIQuery.findMany({
        orderBy: { createdAt: "desc" },
        take: query.limit,
        include: { user: { select: { id: true, name: true, email: true } } },
      });
      return items.map((q) => ({
        id: q.id,
        question: q.question,
        status: q.status,
        errorMessage: q.errorMessage,
        costUSD: q.costUSD ? Number(q.costUSD) : 0,
        durationMs: q.durationMs,
        tokensInput: q.tokensInput,
        tokensOutput: q.tokensOutput,
        createdAt: serializeDate(q.createdAt),
        user: q.user,
      }));
    });

  // ─── Costos fijos predefinidos ─────────────────────────────────────────────

  const fixedCostBodySchema = z.object({
    nombre: z.string().min(1).max(120),
    descripcion: z.string().max(500).nullable().optional(),
    periodicidad: z.nativeEnum(FixedCostPeriodicity),
    diaDelMes: z.number().int().min(1).max(31),
    mesesPares: z.boolean().nullable().optional(),
    mesAnual: z.number().int().min(1).max(12).nullable().optional(),
    montoReferencia: z.number().nonnegative(),
    moneda: z.nativeEnum(Moneda).optional(),
    activo: z.boolean().optional(),
  });

  function serializeFixedCost(fc: {
    id: string; nombre: string; descripcion: string | null;
    periodicidad: FixedCostPeriodicity; diaDelMes: number;
    mesesPares: boolean | null; mesAnual: number | null;
    montoReferencia: Prisma.Decimal; moneda: Moneda; activo: boolean;
    createdAt: Date; updatedAt: Date;
  }) {
    return {
      id: fc.id,
      nombre: fc.nombre,
      descripcion: fc.descripcion,
      periodicidad: fc.periodicidad,
      diaDelMes: fc.diaDelMes,
      mesesPares: fc.mesesPares,
      mesAnual: fc.mesAnual,
      montoReferencia: Number(fc.montoReferencia),
      moneda: fc.moneda,
      activo: fc.activo,
      createdAt: serializeDate(fc.createdAt),
      updatedAt: serializeDate(fc.updatedAt),
    };
  }

  function appliesThisMonth(
    fc: { periodicidad: FixedCostPeriodicity; mesesPares: boolean | null; mesAnual: number | null },
    mes: number,
  ): boolean {
    if (fc.periodicidad === FixedCostPeriodicity.MENSUAL) return true;
    if (fc.periodicidad === FixedCostPeriodicity.BIMENSUAL) {
      const esPar = mes % 2 === 0;
      return fc.mesesPares === esPar;
    }
    if (fc.periodicidad === FixedCostPeriodicity.ANUAL) return fc.mesAnual === mes;
    return false;
  }

  // CRUD admin: listar todos (incluye inactivos para gestión).
  app.get("/admin/fixed-costs", { preHandler: authorize(Module.FINANZAS, Action.VIEW) }, async () => {
    const items = await prisma.fixedCost.findMany({
      where: { deletedAt: null },
      orderBy: [{ activo: "desc" }, { nombre: "asc" }],
    });
    return items.map(serializeFixedCost);
  });

  app.post("/admin/fixed-costs", { preHandler: authorize(Module.FINANZAS, Action.CREATE) }, async (request, reply) => {
    const body = fixedCostBodySchema.parse(request.body);
    if (body.periodicidad === FixedCostPeriodicity.BIMENSUAL && body.mesesPares == null) {
      throw badRequest("BIMENSUAL_REQUIRES_PARES", "Para bimensual hay que indicar pares o impares");
    }
    if (body.periodicidad === FixedCostPeriodicity.ANUAL && body.mesAnual == null) {
      throw badRequest("ANUAL_REQUIRES_MES", "Para anual hay que indicar el mes del año");
    }
    const created = await prisma.fixedCost.create({
      data: {
        nombre: body.nombre,
        descripcion: body.descripcion ?? null,
        periodicidad: body.periodicidad,
        diaDelMes: body.diaDelMes,
        mesesPares: body.periodicidad === FixedCostPeriodicity.BIMENSUAL ? body.mesesPares ?? null : null,
        mesAnual: body.periodicidad === FixedCostPeriodicity.ANUAL ? body.mesAnual ?? null : null,
        montoReferencia: new Prisma.Decimal(body.montoReferencia),
        moneda: body.moneda ?? Moneda.UYU,
        activo: body.activo ?? true,
      },
    });
    reply.code(201);
    return serializeFixedCost(created);
  });

  app.patch("/admin/fixed-costs/:id", { preHandler: authorize(Module.FINANZAS, Action.EDIT) }, async (request) => {
    const { id } = z.object({ id: z.string().min(1) }).parse(request.params);
    const body = fixedCostBodySchema.partial().parse(request.body);
    const existing = await prisma.fixedCost.findFirst({ where: { id, deletedAt: null } });
    if (!existing) throw notFound("FIXED_COST_NOT_FOUND", "Costo fijo no encontrado");

    const data: Prisma.FixedCostUpdateInput = {};
    if (body.nombre !== undefined) data.nombre = body.nombre;
    if (body.descripcion !== undefined) data.descripcion = body.descripcion;
    if (body.periodicidad !== undefined) data.periodicidad = body.periodicidad;
    if (body.diaDelMes !== undefined) data.diaDelMes = body.diaDelMes;
    if (body.mesesPares !== undefined) data.mesesPares = body.mesesPares;
    if (body.mesAnual !== undefined) data.mesAnual = body.mesAnual;
    if (body.montoReferencia !== undefined) data.montoReferencia = new Prisma.Decimal(body.montoReferencia);
    if (body.moneda !== undefined) data.moneda = body.moneda;
    if (body.activo !== undefined) data.activo = body.activo;

    const updated = await prisma.fixedCost.update({ where: { id }, data });
    return serializeFixedCost(updated);
  });

  app.delete("/admin/fixed-costs/:id", { preHandler: authorize(Module.FINANZAS, Action.DELETE) }, async (request, reply) => {
    const { id } = z.object({ id: z.string().min(1) }).parse(request.params);
    const existing = await prisma.fixedCost.findFirst({ where: { id, deletedAt: null } });
    if (!existing) throw notFound("FIXED_COST_NOT_FOUND", "Costo fijo no encontrado");
    await prisma.fixedCost.update({ where: { id }, data: { deletedAt: new Date(), activo: false } });
    reply.code(204);
    return;
  });

  // Para el formulario de movimiento: costos fijos que aplican este mes
  // y todavía no se pagaron, con último monto pagado como referencia visual
  // (no autocompleta el monto, solo informa).
  app.get("/finance/fixed-costs/pending", { preHandler: authorize(Module.FINANZAS, Action.VIEW) }, async (request) => {
    const query = z.object({
      mes: z.coerce.number().int().min(1).max(12),
      anio: z.coerce.number().int(),
    }).parse(request.query);

    const allActive = await prisma.fixedCost.findMany({
      where: { activo: true, deletedAt: null },
      orderBy: { nombre: "asc" },
    });
    const matching = allActive.filter((fc) => appliesThisMonth(fc, query.mes));

    const result = await Promise.all(
      matching.map(async (fc) => {
        const alreadyPaid = await prisma.financeMovement.findFirst({
          where: {
            fixedCostId: fc.id,
            mes: query.mes,
            anio: query.anio,
            status: FinanceMovementStatus.PAGADO,
            deletedAt: null,
          },
          select: { id: true },
        });
        if (alreadyPaid) return null;

        const lastPayment = await prisma.financeMovement.findFirst({
          where: { fixedCostId: fc.id, status: FinanceMovementStatus.PAGADO, deletedAt: null },
          orderBy: { fecha: "desc" },
          select: { monto: true, fecha: true },
        });

        return {
          ...serializeFixedCost(fc),
          ultimoMontoPagado: lastPayment ? Number(lastPayment.monto) : Number(fc.montoReferencia),
          ultimoPagoFecha: lastPayment ? serializeDate(lastPayment.fecha) : null,
        };
      }),
    );

    return result.filter((r) => r !== null);
  });

  // ─── Transferencias entre cuentas ──────────────────────────────────────────

  // POST /api/finance/transfers — crea un par de movimientos PAGADO (GASTO
  // origen + INGRESO destino) ligados por transferGroupId. Neto sobre el
  // saldo total = 0, pero cada cuenta queda con su movimiento individual.
  app.post(
    "/finance/transfers",
    { preHandler: authorize(Module.FINANZAS, Action.CREATE) },
    async (request, reply) => {
      const body = z
        .object({
          fecha: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
          fromAccountId: z.string().min(1),
          toAccountId: z.string().min(1),
          monto: z.coerce.number().positive(),
          moneda: z.nativeEnum(Moneda),
          descripcion: z.string().max(200).optional(),
        })
        .parse(request.body);

      if (body.fromAccountId === body.toAccountId) {
        throw badRequest("SAME_ACCOUNT", "La cuenta origen y destino deben ser distintas");
      }

      const [from, to] = await Promise.all([
        prisma.account.findFirst({ where: { id: body.fromAccountId, deletedAt: null } }),
        prisma.account.findFirst({ where: { id: body.toAccountId, deletedAt: null } }),
      ]);
      if (!from) throw badRequest("FROM_INVALID", "Cuenta origen inválida");
      if (!to) throw badRequest("TO_INVALID", "Cuenta destino inválida");
      if (from.moneda !== body.moneda || to.moneda !== body.moneda) {
        throw badRequest(
          "MONEDA_MISMATCH",
          "Las dos cuentas deben tener la misma moneda que la transferencia. Para cambio de moneda, registrá dos movimientos manuales.",
        );
      }

      const user = ensureUser(request);
      const fechaIso = parseDateOnly(body.fecha);
      const mes = fechaIso.getUTCMonth() + 1;
      const anio = fechaIso.getUTCFullYear();
      const transferGroupId = randomUUID();
      const baseDescripcion = body.descripcion?.trim();

      const result = await prisma.$transaction(async (tx) => {
        const movGasto = await tx.financeMovement.create({
          data: {
            fecha: fechaIso,
            mes,
            anio,
            tipoMovimiento: TipoMovimiento.GASTO,
            categoriaPrincipal: CategoriaPrincipal.TRANSFERENCIA,
            descripcion: baseDescripcion
              ? `${baseDescripcion} (transferencia a ${to.nombre})`
              : `Transferencia a ${to.nombre}`,
            monto: new Prisma.Decimal(body.monto),
            moneda: body.moneda,
            pagado: true,
            cobrado: false,
            impactaFlujo: true,
            status: FinanceMovementStatus.PAGADO,
            sourceType: MovementSourceType.MANUAL,
            accountId: from.id,
            estadoAprobacion: EstadoAprobacion.APROBADO,
            transferGroupId,
            creadoPorId: user.id,
          },
        });
        const movIngreso = await tx.financeMovement.create({
          data: {
            fecha: fechaIso,
            mes,
            anio,
            tipoMovimiento: TipoMovimiento.INGRESO,
            categoriaPrincipal: CategoriaPrincipal.TRANSFERENCIA,
            descripcion: baseDescripcion
              ? `${baseDescripcion} (transferencia desde ${from.nombre})`
              : `Transferencia desde ${from.nombre}`,
            monto: new Prisma.Decimal(body.monto),
            moneda: body.moneda,
            pagado: false,
            cobrado: true,
            impactaFlujo: true,
            status: FinanceMovementStatus.PAGADO,
            sourceType: MovementSourceType.MANUAL,
            accountId: to.id,
            estadoAprobacion: EstadoAprobacion.APROBADO,
            transferGroupId,
            creadoPorId: user.id,
          },
        });
        return { movGasto, movIngreso };
      });

      await createAuditEntry({
        entityType: AuditEntityType.finance_movement,
        entityId: result.movGasto.id,
        userId: user.id,
        action: AuditAction.created,
        description: `Transferencia ${body.monto.toFixed(2)} ${body.moneda} de ${from.nombre} → ${to.nombre}`,
      });

      reply.code(201);
      return {
        transferGroupId,
        gastoId: result.movGasto.id,
        ingresoId: result.movIngreso.id,
      };
    },
  );

  // ─── Pendientes (fuente única de compromisos a pagar) ────────────────────

  type PendingItemSourceType =
    | "FIXED_COST"
    | "PROJECT_MATERIAL"
    | "SUPPLIER_DEBT"
    | "COMMITTED_EXPENSE"
    | "MANUAL_PENDING";
  type PendingItem = {
    id: string;
    sourceType: PendingItemSourceType;
    sourceId: string;
    fecha: string;
    descripcion: string;
    categoria: string;
    tipoMovimiento: "INGRESO" | "GASTO";
    monto: number;
    moneda: Moneda;
    project: { id: string; clientName: string; code: string } | null;
    supplier: { id: string; nombre: string } | null;
    fixedCost: { id: string; nombre: string; periodicidad: FixedCostPeriodicity } | null;
    isOverdue: boolean;
  };
  type ProjectMaterialItem = {
    id: string;
    sourceId: string;
    materialNombre: string;
    quantity: number;
    unitPrice: number;
    monto: number;
    moneda: Moneda;
    fecha: string;
    isOverdue: boolean;
  };
  type ProjectMaterialCategoria = {
    categoria: string;
    totalAmount: number;
    items: ProjectMaterialItem[];
  };
  type ProjectMaterialGroup = {
    projectId: string;
    clientName: string;
    projectCode: string;
    totalAmount: number;
    moneda: Moneda;
    earliestDate: string;
    overdueCount: number;
    categorias: ProjectMaterialCategoria[];
  };
  type PendingResponse = {
    items: PendingItem[];
    projectMaterialGroups: ProjectMaterialGroup[];
  };

  async function getPendingItemsCore(now: Date): Promise<PendingResponse> {
    const items: PendingItem[] = [];

    // 1) Costos fijos pendientes del mes en curso (mensual / bimensual / anual).
    const fixedCosts = await prisma.fixedCost.findMany({
      where: { activo: true, deletedAt: null },
    });
    const mes = now.getUTCMonth() + 1;
    const anio = now.getUTCFullYear();
    for (const fc of fixedCosts) {
      if (!appliesThisMonth(fc, mes)) continue;
      const alreadyPaid = await prisma.financeMovement.findFirst({
        where: {
          fixedCostId: fc.id,
          mes,
          anio,
          status: FinanceMovementStatus.PAGADO,
          deletedAt: null,
        },
        select: { id: true },
      });
      if (alreadyPaid) continue;
      const skipped = await prisma.fixedCostSkip.findUnique({
        where: { fixedCostId_mes_anio: { fixedCostId: fc.id, mes, anio } },
        select: { id: true },
      });
      if (skipped) continue;
      const lastPayment = await prisma.financeMovement.findFirst({
        where: { fixedCostId: fc.id, status: FinanceMovementStatus.PAGADO, deletedAt: null },
        orderBy: { fecha: "desc" },
        select: { monto: true },
      });
      const day = Math.min(fc.diaDelMes, 28);
      const fecha = new Date(Date.UTC(anio, mes - 1, day));
      items.push({
        id: `fixed-${fc.id}`,
        sourceType: "FIXED_COST",
        sourceId: fc.id,
        fecha: serializeDateNonNull(fecha),
        descripcion: fc.nombre,
        categoria: "FIJO",
        tipoMovimiento: "GASTO",
        monto: lastPayment ? Number(lastPayment.monto) : Number(fc.montoReferencia),
        moneda: fc.moneda,
        project: null,
        supplier: null,
        fixedCost: { id: fc.id, nombre: fc.nombre, periodicidad: fc.periodicidad },
        isOverdue: fecha < now,
      });
    }

    // 2) Materiales proyectados — agrupados por proyecto > categoría.
    const pms = await prisma.projectMaterial.findMany({
      where: {
        expectedDate: { not: null },
        movementId: null,
        project: { deletedAt: null },
      },
      include: {
        materialItem: {
          select: {
            nombre: true,
            category: { select: { nombre: true, orden: true } },
          },
        },
        project: { select: { id: true, code: true, clientName: true } },
      },
      orderBy: [{ expectedDate: "asc" }, { createdAt: "asc" }],
    });
    const groupsMap = new Map<string, ProjectMaterialGroup>();
    for (const pm of pms) {
      const fecha = pm.expectedDate as Date;
      const fechaIso = serializeDateNonNull(fecha);
      const monto = Number(pm.quantity) * Number(pm.unitPrice);
      const isOverdue = fecha < now;
      const catNombre = pm.materialItem.category?.nombre ?? "Otros";

      // Clave: projectId|moneda — proyectos con materiales en USD y UYU
      // simultáneamente quedan en dos grupos (raro pero correcto).
      const key = `${pm.project.id}|${pm.moneda}`;
      let g = groupsMap.get(key);
      if (!g) {
        g = {
          projectId: pm.project.id,
          clientName: pm.project.clientName,
          projectCode: pm.project.code,
          totalAmount: 0,
          moneda: pm.moneda,
          earliestDate: fechaIso,
          overdueCount: 0,
          categorias: [],
        };
        groupsMap.set(key, g);
      }
      let cat = g.categorias.find((c) => c.categoria === catNombre);
      if (!cat) {
        cat = { categoria: catNombre, totalAmount: 0, items: [] };
        g.categorias.push(cat);
      }
      cat.items.push({
        id: `material-${pm.id}`,
        sourceId: pm.id,
        materialNombre: pm.materialItem.nombre,
        quantity: Number(pm.quantity),
        unitPrice: Number(pm.unitPrice),
        monto,
        moneda: pm.moneda,
        fecha: fechaIso,
        isOverdue,
      });
      cat.totalAmount += monto;
      g.totalAmount += monto;
      if (isOverdue) g.overdueCount += 1;
      if (fechaIso < g.earliestDate) g.earliestDate = fechaIso;
    }
    const projectMaterialGroups = Array.from(groupsMap.values()).sort((a, b) =>
      a.earliestDate.localeCompare(b.earliestDate),
    );
    // Categorías dentro de cada grupo ordenadas por monto desc (más caro primero).
    for (const g of projectMaterialGroups) {
      g.categorias.sort((a, b) => b.totalAmount - a.totalAmount);
    }

    // 3) Deuda a proveedor — fuente canónica: FinanceMovement A_PAGAR /
    // PARCIALMENTE_PAGADO con supplierId y dueDate. Reemplaza a la lectura
    // directa de FinanceComprobante (que queda como fallback legacy).
    const deudasMovements = await prisma.financeMovement.findMany({
      where: {
        tipoMovimiento: TipoMovimiento.GASTO,
        categoriaPrincipal: CategoriaPrincipal.PAGO_PROVEEDOR,
        status: { in: [FinanceMovementStatus.A_PAGAR, FinanceMovementStatus.PARCIALMENTE_PAGADO] },
        supplierId: { not: null },
        dueDate: { not: null },
        deletedAt: null,
      },
      include: {
        supplier: { select: { id: true, nombre: true } },
        project: { select: { id: true, code: true, clientName: true } },
        paymentApplications: { include: { payment: { select: { deletedAt: true } } } },
        comprobantes: { select: { id: true } },
      },
    });
    const supplierDebtMovementIds = new Set<string>();
    const comprobantesYaConMovimiento = new Set<string>();
    for (const m of deudasMovements) {
      if (!m.supplier || !m.dueDate) continue;
      const pagado = m.paymentApplications
        .filter((a) => !a.payment.deletedAt)
        .reduce((s, a) => s + Number(a.montoAplicado), 0);
      const saldo = Number(m.monto) - pagado;
      if (saldo <= 0.005) continue;
      supplierDebtMovementIds.add(m.id);
      for (const c of m.comprobantes) comprobantesYaConMovimiento.add(c.id);
      const fechaIso = serializeDateNonNull(m.dueDate);
      const descripcion = m.invoiceNumber
        ? `Factura ${m.invoiceNumber} — ${m.supplier.nombre}`
        : `${m.descripcion} — ${m.supplier.nombre}`;
      items.push({
        id: `supplier-invoice-${m.id}`,
        sourceType: "SUPPLIER_DEBT",
        sourceId: m.id,
        fecha: fechaIso,
        descripcion,
        categoria: "PAGO_PROVEEDOR",
        tipoMovimiento: "GASTO",
        monto: saldo,
        moneda: m.moneda,
        project: m.project,
        supplier: m.supplier,
        fixedCost: null,
        isOverdue: m.dueDate < now,
      });
    }

    // 3b) Legacy: FinanceComprobante PENDIENTE/PARCIALMENTE_PAGADO sin movement
    // espejo. Sigue funcionando para datos viejos pero no se crean nuevos.
    const facturas = await prisma.financeComprobante.findMany({
      where: {
        tipo: TipoComprobante.FACTURA,
        estado: { in: [EstadoComprobante.PENDIENTE, EstadoComprobante.PARCIALMENTE_PAGADO] },
        deletedAt: null,
      },
      include: {
        supplier: { select: { id: true, nombre: true } },
        movimiento: { select: { project: { select: { id: true, code: true, clientName: true } } } },
        pagos: { select: { monto: true } },
      },
    });
    for (const f of facturas) {
      if (!f.supplier) continue;
      if (comprobantesYaConMovimiento.has(f.id)) continue;
      const pagado = f.pagos.reduce((s, p) => s + Number(p.monto), 0);
      const saldo = Number(f.monto) - pagado;
      if (saldo <= 0.005) continue;
      const fecha = f.fechaVencimiento ?? f.fechaEmision;
      const numero = f.numero ?? f.concepto;
      items.push({
        id: `comprobante-${f.id}`,
        sourceType: "SUPPLIER_DEBT",
        sourceId: f.id,
        fecha: serializeDateNonNull(fecha),
        descripcion: `Factura ${numero} — ${f.supplier.nombre}`,
        categoria: "PAGO_PROVEEDOR",
        tipoMovimiento: "GASTO",
        monto: saldo,
        moneda: f.moneda,
        project: f.movimiento?.project ?? null,
        supplier: f.supplier,
        fixedCost: null,
        isOverdue: fecha < now,
      });
    }

    // 4) A_PAGAR sin proveedor (sueldos, comisiones, compromisos manuales).
    const committed = await prisma.financeMovement.findMany({
      where: {
        status: FinanceMovementStatus.A_PAGAR,
        supplierId: null,
        deletedAt: null,
      },
      include: { project: { select: { id: true, code: true, clientName: true } } },
    });
    for (const c of committed) {
      const fecha = c.dueDate ?? c.expectedDate ?? c.fecha;
      items.push({
        id: `committed-${c.id}`,
        sourceType: "COMMITTED_EXPENSE",
        sourceId: c.id,
        fecha: serializeDateNonNull(fecha),
        descripcion: c.descripcion,
        categoria: c.categoriaPrincipal,
        tipoMovimiento: c.tipoMovimiento === "INGRESO" ? "INGRESO" : "GASTO",
        monto: Number(c.monto),
        moneda: c.moneda,
        project: c.project,
        supplier: null,
        fixedCost: null,
        isOverdue: fecha < now,
      });
    }

    // 5) MANUAL_PENDING — PREVISTOs creados manualmente desde Pendientes o desde
    // el modal de cobro del proyecto (status PREVISTO + sourceType MANUAL).
    // Cubre tanto gastos previstos (ingresos con sourceType MANUAL también).
    const manualPrevistos = await prisma.financeMovement.findMany({
      where: {
        status: FinanceMovementStatus.PREVISTO,
        sourceType: MovementSourceType.MANUAL,
        deletedAt: null,
      },
      include: { project: { select: { id: true, code: true, clientName: true } } },
    });
    for (const m of manualPrevistos) {
      const fecha = m.dueDate ?? m.expectedDate ?? m.fecha;
      items.push({
        id: `manual-${m.id}`,
        sourceType: "MANUAL_PENDING",
        sourceId: m.id,
        fecha: serializeDateNonNull(fecha),
        descripcion: m.descripcion,
        categoria: m.categoriaPrincipal,
        tipoMovimiento: m.tipoMovimiento === "INGRESO" ? "INGRESO" : "GASTO",
        monto: Number(m.monto),
        moneda: m.moneda,
        project: m.project,
        supplier: null,
        fixedCost: null,
        isOverdue: fecha < now,
      });
    }

    items.sort((a, b) => a.fecha.localeCompare(b.fecha));
    return { items, projectMaterialGroups };
  }

  app.get("/finance/pending", { preHandler: authorize(Module.FINANZAS, Action.VIEW) }, async () => {
    const now = todayUtc();
    const { items, projectMaterialGroups } = await getPendingItemsCore(now);
    return { items, projectMaterialGroups, generatedAt: serializeDateNonNull(now) };
  });

  // Crear un pendiente manual (PREVISTO + MANUAL). Soporta GASTO o INGRESO.
  app.post("/finance/pending", { preHandler: authorize(Module.FINANZAS, Action.CREATE) }, async (request, reply) => {
    const user = ensureUser(request);
    const body = z
      .object({
        tipoMovimiento: z.enum(["INGRESO", "GASTO"]),
        descripcion: z.string().min(1).max(200),
        monto: z.coerce.number().positive(),
        moneda: z.nativeEnum(Moneda),
        categoriaPrincipal: z.nativeEnum(CategoriaPrincipal),
        fechaEsperada: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
        projectId: z.string().nullable().optional(),
      })
      .parse(request.body);

    if (body.tipoMovimiento === "INGRESO" && !body.projectId) {
      throw badRequest(
        "PROJECT_REQUIRED",
        "Los cobros previstos (ingresos) deben asociarse a un proyecto.",
      );
    }

    const fecha = parseDateOnly(body.fechaEsperada);
    const created = await prisma.financeMovement.create({
      data: {
        tipoMovimiento: body.tipoMovimiento as TipoMovimiento,
        categoriaPrincipal: body.categoriaPrincipal,
        status: FinanceMovementStatus.PREVISTO,
        sourceType: MovementSourceType.MANUAL,
        descripcion: body.descripcion.trim(),
        monto: new Prisma.Decimal(body.monto),
        moneda: body.moneda,
        fecha,
        dueDate: fecha,
        expectedDate: fecha,
        mes: fecha.getUTCMonth() + 1,
        anio: fecha.getUTCFullYear(),
        impactaFlujo: true,
        estadoAprobacion: EstadoAprobacion.REGISTRADO,
        projectId: body.projectId ?? null,
        creadoPorId: user.id,
      },
    });

    await createAuditEntry({
      entityType: AuditEntityType.finance_movement,
      entityId: created.id,
      projectId: body.projectId ?? null,
      userId: user.id,
      action: AuditAction.created,
      description: `Creó pendiente manual ${body.tipoMovimiento} ${body.moneda} ${body.monto.toFixed(2)} — ${body.descripcion}`,
    });

    reply.code(201);
    return { id: created.id };
  });

  // Eliminar un pendiente. La semántica depende del tipo:
  //   - FIXED_COST: crea un FixedCostSkip para mes/anio actuales (el costo
  //     fijo sigue activo para próximos meses, pero este mes ya no aparece).
  //   - PROJECT_MATERIAL: pone expectedDate=null en el ProjectMaterial (queda
  //     en el proyecto pero deja de aparecer en Pendientes / Flujo).
  //   - SUPPLIER_DEBT: anula la factura (estado = ANULADO).
  //   - COMMITTED_EXPENSE: soft-delete del FinanceMovement A_PAGAR.
  // En NINGÚN caso se crea un movimiento PAGADO ni "pasa a Movimientos".
  app.delete(
    "/finance/pending/:sourceType/:sourceId",
    { preHandler: authorize(Module.FINANZAS, Action.DELETE) },
    async (request, reply) => {
      const params = z
        .object({
          sourceType: z.enum([
            "FIXED_COST",
            "PROJECT_MATERIAL",
            "SUPPLIER_DEBT",
            "COMMITTED_EXPENSE",
            "MANUAL_PENDING",
          ]),
          sourceId: z.string().min(1),
        })
        .parse(request.params);

      if (params.sourceType === "FIXED_COST") {
        const now = todayUtc();
        const mes = now.getUTCMonth() + 1;
        const anio = now.getUTCFullYear();
        await prisma.fixedCostSkip.upsert({
          where: { fixedCostId_mes_anio: { fixedCostId: params.sourceId, mes, anio } },
          create: { fixedCostId: params.sourceId, mes, anio },
          update: {},
        });
        reply.code(204);
        return;
      }

      if (params.sourceType === "PROJECT_MATERIAL") {
        await prisma.projectMaterial.update({
          where: { id: params.sourceId },
          data: { expectedDate: null },
        });
        reply.code(204);
        return;
      }

      if (params.sourceType === "SUPPLIER_DEBT") {
        await prisma.financeComprobante.update({
          where: { id: params.sourceId },
          data: { estado: EstadoComprobante.ANULADO },
        });
        reply.code(204);
        return;
      }

      if (params.sourceType === "COMMITTED_EXPENSE" || params.sourceType === "MANUAL_PENDING") {
        await prisma.financeMovement.update({
          where: { id: params.sourceId },
          data: { deletedAt: new Date() },
        });
        reply.code(204);
        return;
      }

      throw badRequest("UNSUPPORTED", "sourceType no soportado");
    },
  );

  // ─── Flujo de fondos (proyección 3 meses) ──────────────────────────────────

  type CashflowEvent = {
    id: string;
    fecha: string;
    descripcion: string;
    tipo: "FIXED_COST" | "PROJECT_MATERIAL" | "SUPPLIER_DEBT" | "CLIENT_COBRO";
    monto: number;
    moneda: Moneda;
    impacto: "POSITIVO" | "NEGATIVO";
    sourceType: "FIXED_COST" | "PROJECT_MATERIAL" | "SUPPLIER_DEBT" | "CLIENT_COBRO";
    sourceId: string;
    causeNegative?: boolean;
  };

  function addMonths(d: Date, n: number): Date {
    const r = new Date(d);
    r.setUTCMonth(r.getUTCMonth() + n);
    return r;
  }

  function serializeDateNonNull(d: Date): string {
    return d.toISOString();
  }

  function buildFixedCostEventsForRange(
    fixedCosts: { id: string; nombre: string; periodicidad: FixedCostPeriodicity; mesesPares: boolean | null; mesAnual: number | null; diaDelMes: number; montoReferencia: Prisma.Decimal; moneda: Moneda }[],
    paidThisMonth: Set<string>,
    monthsAhead: number,
    now: Date,
    lastPaidByFc: Map<string, number>,
  ): CashflowEvent[] {
    const events: CashflowEvent[] = [];
    for (let i = 0; i <= monthsAhead; i++) {
      // Avanzar mes a mes con aritmética de meses, NO con addMonths sobre la
      // fecha con día: si "now" cae un 31 y el mes siguiente no tiene 31,
      // setUTCMonth se desbordaba al mes subsiguiente y se salteaba un mes
      // (p.ej. el 31/may proyectaba jul pero no jun).
      const totalMonth = now.getUTCMonth() + i;
      const anio = now.getUTCFullYear() + Math.floor(totalMonth / 12);
      const mes = (totalMonth % 12) + 1;
      for (const fc of fixedCosts) {
        if (!appliesThisMonth(fc, mes)) continue;
        const key = `${fc.id}:${anio}-${mes}`;
        if (paidThisMonth.has(key)) continue;
        const day = Math.min(fc.diaDelMes, 28);
        const fecha = new Date(Date.UTC(anio, mes - 1, day));
        if (fecha < now) continue;
        const monto = lastPaidByFc.get(fc.id) ?? Number(fc.montoReferencia);
        events.push({
          id: `fc:${fc.id}:${anio}-${mes}`,
          fecha: serializeDateNonNull(fecha),
          descripcion: fc.nombre,
          tipo: "FIXED_COST",
          monto,
          moneda: fc.moneda,
          impacto: "NEGATIVO",
          sourceType: "FIXED_COST",
          sourceId: fc.id,
        });
      }
    }
    return events;
  }

  app.get("/finance/cashflow", { preHandler: authorize(Module.FINANZAS, Action.VIEW) }, async () => {
    const now = todayUtc();
    const horizon = addMonths(now, 3);

    // 1) Saldos actuales por moneda.
    const lastRate = await prisma.exchangeRate.findFirst({ orderBy: { createdAt: "desc" } });
    const fallbackUsdToUyu =
      lastRate && Number(lastRate.usdToUyu) > 0 ? Number(lastRate.usdToUyu) : 1;
    const accounts = await prisma.account.findMany({
      where: { deletedAt: null, activa: true },
      select: { id: true, moneda: true },
    });
    let saldoActualUYU = 0;
    let saldoActualUSD = 0;
    for (const a of accounts) {
      const bal = await computeAccountBalance(a.id);
      if (a.moneda === Moneda.USD) saldoActualUSD += bal.saldoActual;
      else saldoActualUYU += bal.saldoActual;
    }
    saldoActualUSD = roundMoney(saldoActualUSD);
    saldoActualUYU = roundMoney(saldoActualUYU);

    // 2) Costos fijos: cuáles aplican y cuáles ya se pagaron en cada mes.
    const fixedCosts = await prisma.fixedCost.findMany({
      where: { activo: true, deletedAt: null },
    });
    const paidFixedThisMonth = await prisma.financeMovement.findMany({
      where: {
        fixedCostId: { in: fixedCosts.map((f) => f.id) },
        status: FinanceMovementStatus.PAGADO,
        deletedAt: null,
      },
      select: { fixedCostId: true, mes: true, anio: true, monto: true, fecha: true },
      orderBy: { fecha: "desc" },
    });
    const paidThisMonthSet = new Set<string>();
    const lastPaidByFc = new Map<string, number>();
    for (const p of paidFixedThisMonth) {
      if (!p.fixedCostId) continue;
      paidThisMonthSet.add(`${p.fixedCostId}:${p.anio}-${p.mes}`);
      if (!lastPaidByFc.has(p.fixedCostId)) lastPaidByFc.set(p.fixedCostId, Number(p.monto));
    }

    const fixedCostEvents = buildFixedCostEventsForRange(fixedCosts, paidThisMonthSet, 3, now, lastPaidByFc);

    // 3) Materiales proyectados (ProjectMaterial.expectedDate dentro del horizonte).
    const pms = await prisma.projectMaterial.findMany({
      where: {
        expectedDate: { gte: now, lte: horizon },
        movementId: null,
        project: { deletedAt: null },
      },
      include: {
        materialItem: { select: { nombre: true, category: { select: { nombre: true } } } },
        project: { select: { id: true, code: true, clientName: true } },
      },
    });
    const materialEvents: CashflowEvent[] = pms.map((pm) => ({
      id: `pm:${pm.id}`,
      fecha: serializeDateNonNull(pm.expectedDate as Date),
      descripcion: `${pm.project.clientName} — ${pm.materialItem.nombre}`,
      tipo: "PROJECT_MATERIAL",
      monto: Number(pm.quantity) * Number(pm.unitPrice),
      moneda: pm.moneda,
      impacto: "NEGATIVO",
      sourceType: "PROJECT_MATERIAL",
      sourceId: pm.id,
    }));

    // 4) Deuda a proveedores: A_PAGAR/PARCIALMENTE_PAGADO con supplierId.
    const supplierDebts = await prisma.financeMovement.findMany({
      where: {
        deletedAt: null,
        supplierId: { not: null },
        status: { in: [FinanceMovementStatus.A_PAGAR, FinanceMovementStatus.PARCIALMENTE_PAGADO] },
      },
      include: {
        supplier: { select: { id: true, nombre: true } },
        paymentApplications: {
          where: { payment: { deletedAt: null } },
          select: { montoAplicado: true },
        },
      },
    });
    const supplierDebtEvents: CashflowEvent[] = [];
    for (const m of supplierDebts) {
      const applied = m.paymentApplications.reduce((s, a) => s + Number(a.montoAplicado), 0);
      const saldo = Number(m.monto) - applied;
      if (saldo <= 0.005) continue;
      const fechaRef = m.dueDate ?? m.expectedDate ?? m.fecha;
      if (fechaRef > horizon) continue;
      supplierDebtEvents.push({
        id: `sd:${m.id}`,
        fecha: serializeDateNonNull(fechaRef < now ? now : fechaRef),
        descripcion: `${m.supplier?.nombre ?? "Proveedor"} — ${m.descripcion}`,
        tipo: "SUPPLIER_DEBT",
        monto: saldo,
        moneda: m.moneda,
        impacto: "NEGATIVO",
        sourceType: "SUPPLIER_DEBT",
        sourceId: m.id,
      });
    }

    // 5) Cobros pendientes de clientes: INGRESO con cobrado=false en el horizonte.
    const cobrosPendientes = await prisma.financeMovement.findMany({
      where: {
        deletedAt: null,
        tipoMovimiento: TipoMovimiento.INGRESO,
        cobrado: false,
        OR: [
          { expectedDate: { gte: now, lte: horizon } },
          { dueDate: { gte: now, lte: horizon } },
          { fecha: { gte: now, lte: horizon } },
        ],
      },
      include: { project: { select: { clientName: true } } },
    });
    const cobroEvents: CashflowEvent[] = cobrosPendientes.map((m) => {
      const fechaRef = m.expectedDate ?? m.dueDate ?? m.fecha;
      return {
        id: `cc:${m.id}`,
        fecha: serializeDateNonNull(fechaRef),
        descripcion: m.project ? `${m.project.clientName} — ${m.descripcion}` : m.descripcion,
        tipo: "CLIENT_COBRO",
        monto: Number(m.monto),
        moneda: m.moneda,
        impacto: "POSITIVO",
        sourceType: "CLIENT_COBRO",
        sourceId: m.id,
      };
    });

    // 6) Combinar y ordenar por fecha.
    const allEvents = [...fixedCostEvents, ...materialEvents, ...supplierDebtEvents, ...cobroEvents].sort(
      (a, b) => a.fecha.localeCompare(b.fecha),
    );

    // 7) Construir timeline en USD. Convertimos UYU → USD con el tipo de cambio
    //    actual para que el gráfico tenga una sola línea consolidada.
    const toUsd = (amount: number, moneda: Moneda) =>
      moneda === Moneda.UYU
        ? fallbackUsdToUyu > 0
          ? amount / fallbackUsdToUyu
          : amount
        : amount;
    const saldoActualUsdConsolidado =
      saldoActualUSD + (fallbackUsdToUyu > 0 ? saldoActualUYU / fallbackUsdToUyu : 0);

    // 7a) Histórico: últimos 3 meses. Estrategia:
    //     saldoAt(now - 3mo) = saldoActual − Σ(deltas de movements/payments en [now-3mo, now])
    //     Después walkamos forward acumulando para construir la curva.
    const fromPast = addMonths(now, -3);
    const pastMovements = await prisma.financeMovement.findMany({
      where: {
        deletedAt: null,
        status: FinanceMovementStatus.PAGADO,
        fecha: { gte: fromPast, lte: now },
        // Excluir Movements que tienen PaymentApplication activa: el cash event
        // real es el Payment correspondiente, contarlos los dos sería doble.
        paymentApplications: { none: { payment: { deletedAt: null } } },
      },
      select: { fecha: true, tipoMovimiento: true, monto: true, moneda: true, descripcion: true },
    });
    const pastPayments = await prisma.payment.findMany({
      where: {
        deletedAt: null,
        fecha: { gte: fromPast, lte: now },
      },
      select: { fecha: true, monto: true, moneda: true, supplier: { select: { nombre: true } } },
    });

    type PastEvent = { fecha: Date; deltaUsd: number; descripcion: string };
    const pastEvents: PastEvent[] = [];
    for (const m of pastMovements) {
      const sign = m.tipoMovimiento === TipoMovimiento.INGRESO ? 1 : m.tipoMovimiento === TipoMovimiento.GASTO ? -1 : 0;
      pastEvents.push({
        fecha: m.fecha,
        deltaUsd: sign * toUsd(Number(m.monto), m.moneda),
        descripcion: m.descripcion,
      });
    }
    for (const p of pastPayments) {
      pastEvents.push({
        fecha: p.fecha,
        // Payment positivo → egreso (pago a proveedor). Negativo → nota de crédito (ingreso).
        deltaUsd: -toUsd(Number(p.monto), p.moneda),
        descripcion: `Pago ${p.supplier?.nombre ?? "proveedor"}`,
      });
    }
    pastEvents.sort((a, b) => a.fecha.getTime() - b.fecha.getTime());

    const totalDeltaPast = pastEvents.reduce((s, e) => s + e.deltaUsd, 0);
    let saldoAtStart = roundMoney(saldoActualUsdConsolidado - totalDeltaPast);

    const historicalTimeline: { fecha: string; saldo: number; descripcion: string }[] = [
      { fecha: serializeDateNonNull(fromPast), saldo: saldoAtStart, descripcion: "Saldo inicial (hace 3 meses)" },
    ];
    let saldoAcum = saldoAtStart;
    for (const ev of pastEvents) {
      saldoAcum = roundMoney(saldoAcum + ev.deltaUsd);
      historicalTimeline.push({
        fecha: serializeDateNonNull(ev.fecha),
        saldo: saldoAcum,
        descripcion: ev.descripcion,
      });
    }
    // Anclamos el último punto del histórico al saldo actual real (puede haber
    // diferencia mínima por redondeos / movements con PaymentApplication que
    // excluimos arriba). Esto garantiza la continuidad visual con la proyección.
    const saldoUsdNow = roundMoney(saldoActualUsdConsolidado);
    historicalTimeline.push({
      fecha: serializeDateNonNull(now),
      saldo: saldoUsdNow,
      descripcion: "Saldo actual",
    });

    // 7b) Proyección: igual que antes, arrancando en saldoUsdNow.
    let saldoUsdProj = saldoUsdNow;
    const projectionTimeline: { fecha: string; saldo: number; descripcion: string }[] = [
      { fecha: serializeDateNonNull(now), saldo: saldoUsdProj, descripcion: "Saldo actual" },
    ];
    for (const ev of allEvents) {
      const delta = toUsd(ev.monto, ev.moneda) * (ev.impacto === "POSITIVO" ? 1 : -1);
      saldoUsdProj = roundMoney(saldoUsdProj + delta);
      const causeNegative =
        saldoUsdProj < 0 && projectionTimeline[projectionTimeline.length - 1].saldo >= 0;
      if (causeNegative) ev.causeNegative = true;
      projectionTimeline.push({ fecha: ev.fecha, saldo: saldoUsdProj, descripcion: ev.descripcion });
    }

    const alertaNegativo = projectionTimeline.some((t) => t.saldo < 0);

    return {
      saldoActualUYU,
      saldoActualUSD,
      fallbackUsdToUyu,
      events: allEvents,
      historicalTimeline,
      projectionTimeline,
      // Compatibilidad temporal: mantener timelineUSD como alias de la proyección
      // hasta que el cliente nuevo esté deployado en todos lados.
      timelineUSD: projectionTimeline,
      alertaNegativo,
      horizonUntil: serializeDateNonNull(horizon),
      historyFrom: serializeDateNonNull(fromPast),
    };
  });

  // PATCH para mover la fecha tentativa de un evento del flujo.
  app.patch("/finance/cashflow/events/:sourceType/:sourceId/fecha", { preHandler: authorize(Module.FINANZAS, Action.EDIT) }, async (request) => {
    const params = z.object({
      sourceType: z.enum([
        "FIXED_COST",
        "PROJECT_MATERIAL",
        "SUPPLIER_DEBT",
        "CLIENT_COBRO",
        "MANUAL_PENDING",
        "COMMITTED_EXPENSE",
      ]),
      sourceId: z.string().min(1),
    }).parse(request.params);
    const { fecha } = z.object({ fecha: z.string().regex(/^\d{4}-\d{2}-\d{2}$/) }).parse(request.body);
    const newFecha = parseDateOnly(fecha);

    if (params.sourceType === "FIXED_COST") {
      throw badRequest(
        "FIXED_COST_DATE_IS_FIXED",
        "La fecha de costos fijos se configura desde Administración (día del mes).",
      );
    }
    if (params.sourceType === "PROJECT_MATERIAL") {
      const updated = await prisma.projectMaterial.update({
        where: { id: params.sourceId },
        data: { expectedDate: newFecha },
        select: { id: true, expectedDate: true },
      });
      return { id: updated.id, fecha: serializeDate(updated.expectedDate as Date) };
    }
    if (params.sourceType === "SUPPLIER_DEBT") {
      const updated = await prisma.financeMovement.update({
        where: { id: params.sourceId },
        data: { dueDate: newFecha },
        select: { id: true, dueDate: true },
      });
      return { id: updated.id, fecha: updated.dueDate ? serializeDate(updated.dueDate) : null };
    }
    if (params.sourceType === "CLIENT_COBRO") {
      const updated = await prisma.financeMovement.update({
        where: { id: params.sourceId },
        data: { expectedDate: newFecha },
        select: { id: true, expectedDate: true },
      });
      return { id: updated.id, fecha: updated.expectedDate ? serializeDate(updated.expectedDate) : null };
    }
    // MANUAL_PENDING y COMMITTED_EXPENSE: dueDate del FinanceMovement directamente.
    // Sirve tanto para cuotas del plan de pagos como para gastos previstos
    // manuales o compromisos (sueldos, comisiones).
    if (params.sourceType === "MANUAL_PENDING" || params.sourceType === "COMMITTED_EXPENSE") {
      const updated = await prisma.financeMovement.update({
        where: { id: params.sourceId },
        data: { dueDate: newFecha },
        select: { id: true, dueDate: true },
      });
      return { id: updated.id, fecha: updated.dueDate ? serializeDate(updated.dueDate) : null };
    }
    throw badRequest("UNSUPPORTED", "sourceType no soportado");
  });

  // ─── Estado de resultados (P&L) ────────────────────────────────────────────

  type ResultItem = {
    id: string;
    fecha: string;
    descripcion: string;
    monto: number;
    moneda: Moneda;
    projectClientName: string | null;
    projectCode: string | null;
    supplierName: string | null;
  };

  function rangeForPeriod(periodo: "MENSUAL" | "TRIMESTRAL" | "ANUAL", anio: number, mes?: number, trimestre?: number) {
    if (periodo === "MENSUAL") {
      const m = mes ?? 1;
      return {
        fechaInicio: new Date(Date.UTC(anio, m - 1, 1)),
        fechaFin: new Date(Date.UTC(anio, m, 1)),
      };
    }
    if (periodo === "TRIMESTRAL") {
      const t = Math.max(1, Math.min(4, trimestre ?? 1));
      const startMonth = (t - 1) * 3;
      return {
        fechaInicio: new Date(Date.UTC(anio, startMonth, 1)),
        fechaFin: new Date(Date.UTC(anio, startMonth + 3, 1)),
      };
    }
    return {
      fechaInicio: new Date(Date.UTC(anio, 0, 1)),
      fechaFin: new Date(Date.UTC(anio + 1, 0, 1)),
    };
  }

  app.get("/finance/results", { preHandler: authorize(Module.FINANZAS, Action.VIEW) }, async (request) => {
    const query = z
      .object({
        periodo: z.enum(["MENSUAL", "TRIMESTRAL", "ANUAL"]),
        anio: z.coerce.number().int(),
        mes: z.coerce.number().int().min(1).max(12).optional(),
        trimestre: z.coerce.number().int().min(1).max(4).optional(),
      })
      .parse(request.query);

    const { fechaInicio, fechaFin } = rangeForPeriod(query.periodo, query.anio, query.mes, query.trimestre);

    const lastRate = await prisma.exchangeRate.findFirst({ orderBy: { createdAt: "desc" } });
    const fallbackUsdToUyu =
      lastRate && Number(lastRate.usdToUyu) > 0 ? Number(lastRate.usdToUyu) : 1;
    const toUsd = (amount: number, moneda: Moneda) =>
      moneda === Moneda.UYU ? (fallbackUsdToUyu > 0 ? amount / fallbackUsdToUyu : amount) : amount;

    const movements = await prisma.financeMovement.findMany({
      where: {
        status: FinanceMovementStatus.PAGADO,
        deletedAt: null,
        fecha: { gte: fechaInicio, lt: fechaFin },
        // Excluir ajustes de conciliación: no son operación, son ruido contable.
        categoriaPrincipal: { not: CategoriaPrincipal.AJUSTE_CONCILIACION },
      },
      include: {
        project: { select: { id: true, code: true, clientName: true } },
        supplier: { select: { nombre: true } },
        fixedCost: { select: { nombre: true } },
      },
      orderBy: { fecha: "asc" },
    });

    function fmtItem(m: typeof movements[number]): ResultItem {
      return {
        id: m.id,
        fecha: serializeDateNonNull(m.fecha),
        descripcion: m.descripcion,
        monto: Number(m.monto),
        moneda: m.moneda,
        projectClientName: m.project?.clientName ?? null,
        projectCode: m.project?.code ?? null,
        supplierName: m.supplier?.nombre ?? null,
      };
    }

    const sumUsd = (rows: typeof movements) =>
      rows.reduce((s, m) => s + toUsd(Number(m.monto), m.moneda), 0);

    const ingresosRows = movements.filter((m) => m.tipoMovimiento === TipoMovimiento.INGRESO);
    const egresosRows = movements.filter((m) => m.tipoMovimiento === TipoMovimiento.GASTO);

    const fijos = egresosRows.filter((m) => m.categoriaPrincipal === CategoriaPrincipal.FIJO);
    const variables = egresosRows.filter((m) => m.categoriaPrincipal === CategoriaPrincipal.VARIABLE);
    const salidasProyecto = egresosRows.filter((m) => m.categoriaPrincipal === CategoriaPrincipal.PROYECTO_SALIDA);
    const pagoProveedores = egresosRows.filter((m) => m.categoriaPrincipal === CategoriaPrincipal.PAGO_PROVEEDOR);
    const comprasStock = egresosRows.filter((m) => m.categoriaPrincipal === CategoriaPrincipal.COMPRA_STOCK);
    const otrosCats = new Set<CategoriaPrincipal>([
      CategoriaPrincipal.FIJO,
      CategoriaPrincipal.VARIABLE,
      CategoriaPrincipal.PROYECTO_SALIDA,
      CategoriaPrincipal.PAGO_PROVEEDOR,
      CategoriaPrincipal.COMPRA_STOCK,
    ]);
    const otros = egresosRows.filter((m) => !otrosCats.has(m.categoriaPrincipal));

    type ProjectGroup = { projectId: string; clientName: string; code: string; total: number; items: ResultItem[] };
    const byProjectMap = new Map<string, ProjectGroup>();
    for (const m of salidasProyecto) {
      const key = m.projectId ?? "sin-proyecto";
      let g = byProjectMap.get(key);
      if (!g) {
        g = {
          projectId: m.projectId ?? "",
          clientName: m.project?.clientName ?? "Sin proyecto",
          code: m.project?.code ?? "",
          total: 0,
          items: [],
        };
        byProjectMap.set(key, g);
      }
      g.total += toUsd(Number(m.monto), m.moneda);
      g.items.push(fmtItem(m));
    }
    const byProject = Array.from(byProjectMap.values()).sort((a, b) => b.total - a.total);

    const totalIngresos = sumUsd(ingresosRows);
    const totalEgresos = sumUsd(egresosRows);
    const resultado = totalIngresos - totalEgresos;
    const rentabilidad = totalIngresos > 0 ? Math.round((resultado / totalIngresos) * 1000) / 10 : 0;

    return {
      periodo: query.periodo,
      anio: query.anio,
      mes: query.mes ?? null,
      trimestre: query.trimestre ?? null,
      fechaInicio: serializeDateNonNull(fechaInicio),
      fechaFin: serializeDateNonNull(fechaFin),
      fallbackUsdToUyu,
      ingresos: { total: totalIngresos, items: ingresosRows.map(fmtItem) },
      egresos: {
        total: totalEgresos,
        costosFijos: {
          total: sumUsd(fijos),
          items: fijos.map((m) => ({
            ...fmtItem(m),
            descripcion: m.fixedCost?.nombre ?? m.descripcion,
          })),
        },
        costosVariables: { total: sumUsd(variables), items: variables.map(fmtItem) },
        salidasProyecto: { total: sumUsd(salidasProyecto), byProject },
        pagoProveedores: { total: sumUsd(pagoProveedores), items: pagoProveedores.map(fmtItem) },
        comprasStock: { total: sumUsd(comprasStock), items: comprasStock.map(fmtItem) },
        otros: { total: sumUsd(otros), items: otros.map(fmtItem) },
      },
      resultado,
      rentabilidad,
    };
  });
}

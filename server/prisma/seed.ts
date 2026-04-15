import bcrypt from "bcryptjs";
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
  SettingKey,
  SettingLevel,
  StageStatus,
  StageType,
  SubstageStatus,
  TaskPriority,
  TaskStatus,
  TipoObra,
} from "@prisma/client";

import { prisma } from "../src/lib/prisma.js";
import {
  calculateProjectProgress,
  createInitialPipeline,
  syncStageProgress,
  syncSubstageProgress,
} from "../src/services/project.service.js";
import { diffInDays, parseDateOnly } from "../src/utils/dates.js";

type ProjectGraph = Prisma.ProjectGetPayload<{
  include: {
    stages: {
      include: {
        substages: {
          include: {
            checklistItems: true;
          };
        };
      };
    };
  };
}>;

function dateOnly(value: string) {
  return parseDateOnly(value);
}

function timestamp(value: string) {
  return new Date(value);
}

function decimal(value: number) {
  return new Prisma.Decimal(value);
}

async function resetDatabase() {
  await prisma.auditLog.deleteMany();
  await prisma.notification.deleteMany();
  await prisma.fileAttachment.deleteMany();
  await prisma.task.deleteMany();
  await prisma.comment.deleteMany();
  await prisma.checklistItem.deleteMany();
  await prisma.substage.deleteMany();
  await prisma.stage.deleteMany();
  await prisma.salesActivity.deleteMany();
  await prisma.salesLead.deleteMany();
  await prisma.proposalGeneration.deleteMany();
  await prisma.setting.deleteMany();
  await prisma.permission.deleteMany();
  await prisma.solarSystem.deleteMany();
  await prisma.project.deleteMany();
  await prisma.user.deleteMany();
}

async function createUsers() {
  const password = await bcrypt.hash("Admin1234", 10);

  const admin = await prisma.user.create({
    data: {
      email: "admin@voltiapm.com",
      password,
      name: "Administrador Voltia",
      role: Role.ADMIN,
      avatarUrl: null,
    },
  });

  const operations = await prisma.user.create({
    data: {
      email: "operaciones@voltiapm.com",
      password,
      name: "Gerencia Operaciones",
      role: Role.OPERACIONES,
      avatarUrl: null,
    },
  });

  const comercial = await prisma.user.create({
    data: {
      email: "comercial@voltiapm.com",
      password,
      name: "Asesor Comercial",
      role: Role.ASESOR_COMERCIAL,
      avatarUrl: null,
    },
  });

  const ingeniero = await prisma.user.create({
    data: {
      email: "ingeniero@voltiapm.com",
      password,
      name: "Ingeniero Proyectista",
      role: Role.INGENIERIA,
      avatarUrl: null,
    },
  });

  return { admin, operations, comercial, ingeniero };
}

async function seedPermissions() {
  const matrix: Array<{ role: Role; module: Module; actions: Action[] }> = [
    // ADMIN — acceso total
    { role: Role.ADMIN, module: Module.VENTAS,         actions: [Action.VIEW, Action.CREATE, Action.EDIT, Action.DELETE, Action.COMMENT] },
    { role: Role.ADMIN, module: Module.ONBOARDING,     actions: [Action.VIEW, Action.CREATE, Action.EDIT, Action.DELETE, Action.COMPLETE, Action.COMMENT] },
    { role: Role.ADMIN, module: Module.INGENIERIA,     actions: [Action.VIEW, Action.CREATE, Action.EDIT, Action.DELETE, Action.COMPLETE, Action.COMMENT] },
    { role: Role.ADMIN, module: Module.OPERACIONES,    actions: [Action.VIEW, Action.CREATE, Action.EDIT, Action.DELETE, Action.COMPLETE, Action.COMMENT] },
    { role: Role.ADMIN, module: Module.HABILITACION,   actions: [Action.VIEW, Action.CREATE, Action.EDIT, Action.DELETE, Action.COMPLETE, Action.COMMENT] },
    { role: Role.ADMIN, module: Module.POSTVENTA,      actions: [Action.VIEW, Action.CREATE, Action.EDIT, Action.DELETE, Action.COMPLETE, Action.COMMENT] },
    { role: Role.ADMIN, module: Module.METRICAS,       actions: [Action.VIEW] },
    { role: Role.ADMIN, module: Module.CONFIGURACION,  actions: [Action.VIEW, Action.EDIT] },
    { role: Role.ADMIN, module: Module.USUARIOS,       actions: [Action.VIEW, Action.CREATE, Action.EDIT, Action.DELETE] },

    // ASESOR_COMERCIAL — ventas y onboarding, sin acceso a métricas
    { role: Role.ASESOR_COMERCIAL, module: Module.VENTAS,        actions: [Action.VIEW, Action.CREATE, Action.EDIT, Action.COMMENT] },
    { role: Role.ASESOR_COMERCIAL, module: Module.ONBOARDING,    actions: [Action.VIEW, Action.COMMENT] },
    { role: Role.ASESOR_COMERCIAL, module: Module.INGENIERIA,    actions: [Action.VIEW] },
    { role: Role.ASESOR_COMERCIAL, module: Module.OPERACIONES,   actions: [Action.VIEW] },
    { role: Role.ASESOR_COMERCIAL, module: Module.HABILITACION,  actions: [Action.VIEW] },
    { role: Role.ASESOR_COMERCIAL, module: Module.POSTVENTA,     actions: [Action.VIEW] },

    // INGENIERIA — ingeniería completa, sin acceso al módulo de ventas
    { role: Role.INGENIERIA, module: Module.ONBOARDING,    actions: [Action.VIEW, Action.COMMENT] },
    { role: Role.INGENIERIA, module: Module.INGENIERIA,    actions: [Action.VIEW, Action.CREATE, Action.EDIT, Action.COMPLETE, Action.COMMENT] },
    { role: Role.INGENIERIA, module: Module.OPERACIONES,   actions: [Action.VIEW, Action.COMMENT] },
    { role: Role.INGENIERIA, module: Module.HABILITACION,  actions: [Action.VIEW, Action.COMMENT] },
    { role: Role.INGENIERIA, module: Module.POSTVENTA,     actions: [Action.VIEW] },
    { role: Role.INGENIERIA, module: Module.METRICAS,      actions: [Action.VIEW] },

    // OPERACIONES — operaciones y habilitación completas, resto lectura
    { role: Role.OPERACIONES, module: Module.VENTAS,        actions: [Action.VIEW] },
    { role: Role.OPERACIONES, module: Module.ONBOARDING,    actions: [Action.VIEW, Action.COMMENT] },
    { role: Role.OPERACIONES, module: Module.INGENIERIA,    actions: [Action.VIEW] },
    { role: Role.OPERACIONES, module: Module.OPERACIONES,   actions: [Action.VIEW, Action.CREATE, Action.EDIT, Action.COMPLETE, Action.COMMENT] },
    { role: Role.OPERACIONES, module: Module.HABILITACION,  actions: [Action.VIEW, Action.CREATE, Action.EDIT, Action.COMPLETE, Action.COMMENT] },
    { role: Role.OPERACIONES, module: Module.POSTVENTA,     actions: [Action.VIEW, Action.COMMENT] },
    { role: Role.OPERACIONES, module: Module.METRICAS,      actions: [Action.VIEW] },
  ];

  for (const entry of matrix) {
    for (const action of entry.actions) {
      await prisma.permission.create({
        data: { role: entry.role, module: entry.module, action },
      });
    }
  }
}

async function seedSettings(updatedById: string) {
  const systemSettings: Array<{ key: SettingKey; value: string }> = [
    { key: SettingKey.DEFAULT_CURRENCY,        value: "USD" },
    { key: SettingKey.DATE_FORMAT,             value: "DD/MM/YYYY" },
    { key: SettingKey.TIMEZONE,                value: "America/Argentina/Buenos_Aires" },
    { key: SettingKey.NOTIFICATIONS_EMAIL,     value: "true" },
    { key: SettingKey.NOTIFICATIONS_WHATSAPP,  value: "false" },
    { key: SettingKey.SHOW_BUDGET_IN_PIPELINE, value: "true" },
    { key: SettingKey.DEFAULT_LANGUAGE,        value: "es" },
    { key: SettingKey.CO2_FACTOR,              value: "0.5" },
    { key: SettingKey.PROPOSAL_SCRIPT_PATH,    value: "scripts/proposal_generator.py" },
  ];

  for (const s of systemSettings) {
    await prisma.setting.create({
      data: {
        level: SettingLevel.SYSTEM,
        key: s.key,
        value: s.value,
        updatedById,
      },
    });
  }
}

async function seedLeads(comercialId: string, adminId: string, projectId: string) {
  // Lead 1 — recién ingresado
  const lead1 = await prisma.salesLead.create({
    data: {
      code: "LEAD-2026-001",
      clientName: "Frigorífico del Sur S.A. — Marcelo Ríos",
      clientEmail: "mrios@frigsur.com.ar",
      clientPhone: "+54 9 11 5544-3322",
      address: "Cañuelas, Buenos Aires",
      estimatedKwp: new Prisma.Decimal(180),
      estimatedBudgetUsd: new Prisma.Decimal(95000),
      stage: SalesStage.NUEVO_LEAD,
      assignedToId: comercialId,
      createdById: adminId,
      notes: "Contacto vía LinkedIn. Techo industrial disponible ~1200 m². Interesado en financiamiento.",
    },
  });
  await prisma.salesActivity.create({
    data: {
      leadId: lead1.id,
      userId: comercialId,
      action: "LLAMADA",
      notes: "Primer contacto telefónico. Cliente interesado, solicitó más información.",
    },
  });

  // Lead 2 — cotizado
  const lead2 = await prisma.salesLead.create({
    data: {
      code: "LEAD-2026-002",
      clientName: "Bodegas Andinas S.R.L. — Valentina Pereyra",
      clientEmail: "vpereyra@bodegasandinas.com",
      clientPhone: "+54 9 261 4433-2211",
      address: "Maipú, Mendoza",
      estimatedKwp: new Prisma.Decimal(320),
      estimatedBudgetUsd: new Prisma.Decimal(170000),
      stage: SalesStage.COTIZADO,
      assignedToId: comercialId,
      createdById: adminId,
      proposalSentAt: new Date("2026-03-23T10:00:00Z"),
      notes: "Empresa mediana. Tarifa T3 BT. Cotización enviada el 05/04. Esperando respuesta del directorio.",
    },
  });
  await prisma.salesActivity.createMany({
    data: [
      {
        leadId: lead2.id,
        userId: comercialId,
        fromStage: SalesStage.NUEVO_LEAD,
        toStage: SalesStage.PENDIENTE_COTIZAR,
        action: "REUNION",
        notes: "Visita técnica a la bodega. Se tomaron medidas del techo y se relevó medidor.",
      },
      {
        leadId: lead2.id,
        userId: comercialId,
        fromStage: SalesStage.PENDIENTE_COTIZAR,
        toStage: SalesStage.COTIZADO,
        action: "EMAIL",
        notes: "Envío de cotización formal con 3 opciones de capacidad: 250, 320 y 400 kWp.",
      },
    ],
  });

  // Lead 3 — en negociación
  const lead3 = await prisma.salesLead.create({
    data: {
      code: "LEAD-2026-003",
      clientName: "Logística Patagónica S.A. — Roberto Álvarez",
      clientEmail: "ralvarez@logpata.com.ar",
      clientPhone: "+54 9 294 3322-1100",
      address: "Bariloche, Río Negro",
      estimatedKwp: new Prisma.Decimal(90),
      estimatedBudgetUsd: new Prisma.Decimal(48000),
      stage: SalesStage.NEGOCIACION,
      assignedToId: comercialId,
      createdById: adminId,
      proposalSentAt: new Date("2026-03-12T11:00:00Z"),
      visitScheduledAt: new Date("2026-03-17T09:00:00Z"),
      visitCompletedAt: new Date("2026-03-18T14:00:00Z"),
      notes: "Cliente muy interesado. Negocia precio por pago anticipado. Oferta revisada con 5% de descuento.",
    },
  });
  await prisma.salesActivity.createMany({
    data: [
      {
        leadId: lead3.id,
        userId: comercialId,
        fromStage: SalesStage.COTIZADO,
        toStage: SalesStage.NEGOCIACION,
        action: "REUNION",
        notes: "Segunda reunión presencial. El cliente quiere cerrar antes de fin de mes.",
      },
      {
        leadId: lead3.id,
        userId: comercialId,
        action: "LLAMADA",
        notes: "Revisión de condiciones contractuales. Acuerdo verbal sobre precio.",
      },
    ],
  });

  // Lead 4 — convertido al proyecto (vinculado al projectId dado)
  const lead4 = await prisma.salesLead.create({
    data: {
      code: "LEAD-2025-047",
      clientName: "Supermercados Frescos S.A. — Daniela Morán",
      clientEmail: "dmoran@frescos.com.ar",
      clientPhone: "+54 9 351 6677-8899",
      address: "Córdoba, Córdoba",
      estimatedKwp: new Prisma.Decimal(250),
      estimatedBudgetUsd: new Prisma.Decimal(135000),
      stage: SalesStage.CERRADO_GANADO,
      assignedToId: comercialId,
      createdById: adminId,
      convertedToProjectId: projectId,
      convertedAt: new Date("2025-11-10T09:00:00Z"),
      proposalSentAt: new Date("2025-10-18T10:00:00Z"),
      visitScheduledAt: new Date("2025-10-25T10:00:00Z"),
      visitCompletedAt: new Date("2025-10-26T15:00:00Z"),
      closedAt: new Date("2025-11-10T09:00:00Z"),
      notes: "Convertido a proyecto activo. Firma de contrato realizada el 2025-11-10.",
    },
  });
  await prisma.salesActivity.createMany({
    data: [
      {
        leadId: lead4.id,
        userId: comercialId,
        action: "REUNION",
        notes: "Presentación formal de propuesta ejecutiva.",
      },
      {
        leadId: lead4.id,
        userId: adminId,
        fromStage: SalesStage.NEGOCIACION,
        toStage: SalesStage.CERRADO_GANADO,
        action: "CONTRATO",
        notes: "Firma de contrato y pago de anticipo del 50%. Lead convertido a proyecto.",
      },
    ],
  });

  return { lead1, lead2, lead3, lead4 };
}

async function seedGoals(adminId: string) {
  const goals: Array<{
    area: GoalArea;
    metric: GoalMetric;
    period: GoalPeriod;
    year: number;
    quarter: number | null;
    targetValue: number;
  }> = [
    { area: GoalArea.VENTAS,       metric: GoalMetric.LEADS_CREATED,        period: GoalPeriod.ANNUAL,     year: 2025, quarter: null, targetValue: 50 },
    { area: GoalArea.VENTAS,       metric: GoalMetric.LEADS_CREATED,        period: GoalPeriod.QUARTERLY,  year: 2025, quarter: 2,   targetValue: 15 },
    { area: GoalArea.VENTAS,       metric: GoalMetric.PROPOSALS_SENT,       period: GoalPeriod.ANNUAL,     year: 2025, quarter: null, targetValue: 40 },
    { area: GoalArea.VENTAS,       metric: GoalMetric.PROPOSALS_SENT,       period: GoalPeriod.QUARTERLY,  year: 2025, quarter: 2,   targetValue: 12 },
    { area: GoalArea.VENTAS,       metric: GoalMetric.CLOSED_WON,           period: GoalPeriod.ANNUAL,     year: 2025, quarter: null, targetValue: 20 },
    { area: GoalArea.VENTAS,       metric: GoalMetric.CLOSED_WON,           period: GoalPeriod.QUARTERLY,  year: 2025, quarter: 2,   targetValue: 6  },
    { area: GoalArea.OPERACIONES,  metric: GoalMetric.INSTALLATIONS_COUNT,  period: GoalPeriod.ANNUAL,     year: 2025, quarter: null, targetValue: 20 },
    { area: GoalArea.OPERACIONES,  metric: GoalMetric.INSTALLATIONS_COUNT,  period: GoalPeriod.QUARTERLY,  year: 2025, quarter: 2,   targetValue: 6  },
    { area: GoalArea.OPERACIONES,  metric: GoalMetric.KWP_INSTALLED,        period: GoalPeriod.ANNUAL,     year: 2025, quarter: null, targetValue: 1500 },
    { area: GoalArea.OPERACIONES,  metric: GoalMetric.KWP_INSTALLED,        period: GoalPeriod.QUARTERLY,  year: 2025, quarter: 2,   targetValue: 400 },
  ];

  await prisma.goal.createMany({
    data: goals.map((g) => ({
      area: g.area,
      metric: g.metric,
      period: g.period,
      year: g.year,
      quarter: g.quarter,
      targetValue: new Prisma.Decimal(g.targetValue),
      createdById: adminId,
    })),
    skipDuplicates: true,
  });
}

async function seedComments(
  adminId: string,
  comercialId: string,
  ingenieroId: string,
  projectId: string,
  stageId: string,
  taskId: string,
) {
  // Comentario a nivel proyecto
  await prisma.comment.create({
    data: {
      projectId,
      authorId: comercialId,
      content: "El cliente confirmó que el transformador tiene capacidad suficiente para los 250 kWp. No se requiere ampliación.",
    },
  });

  // Comentario a nivel etapa
  await prisma.comment.create({
    data: {
      projectId,
      stageId,
      authorId: ingenieroId,
      content: "Planos aprobados por el departamento de ingeniería. Se adjuntó versión final en archivos del proyecto.",
    },
  });

  // Comentario a nivel tarea
  await prisma.comment.create({
    data: {
      projectId,
      taskId,
      authorId: adminId,
      content: "Verificar que el proveedor de estructuras confirme entrega antes del 20/04. El cronograma depende de esto.",
    },
  });
}

async function createProject(params: {
  code: string;
  clientName: string;
  capacityKwp: number;
  locationCity: string;
  locationProvince: string;
  status: ProjectStatus;
  startDate: string;
  plannedEndDate: string;
  actualEndDate?: string | null;
  budgetUsd: number;
  executedUsd: number;
  estimatedMwhYear: number;
  modalidadPago?: ModalidadPago | null;
  notificationEmail: string;
  notificationPhone: string;
  createdById: string;
}) {
  const project = await prisma.project.create({
    data: {
      code: params.code,
      clientName: params.clientName,
      capacityKwp: decimal(params.capacityKwp),
      locationCity: params.locationCity,
      locationProvince: params.locationProvince,
      status: params.status,
      startDate: dateOnly(params.startDate),
      plannedEndDate: dateOnly(params.plannedEndDate),
      actualEndDate: params.actualEndDate ? dateOnly(params.actualEndDate) : null,
      budgetUsd: decimal(params.budgetUsd),
      executedUsd: decimal(params.executedUsd),
      estimatedMwhYear: decimal(params.estimatedMwhYear),
      co2TonsAvoided: decimal(Number((params.estimatedMwhYear * 0.5).toFixed(2))),
      modalidadPago: params.modalidadPago ?? null,
      notificationEmail: params.notificationEmail,
      notificationPhone: params.notificationPhone,
      createdById: params.createdById,
    },
  });

  await createInitialPipeline(
    project.id,
    dateOnly(params.startDate),
    dateOnly(params.plannedEndDate),
    params.modalidadPago ?? null,
  );

  return project;
}

async function hydrateProject(projectId: string) {
  const project = await prisma.project.findUnique({
    where: { id: projectId },
    include: {
      stages: {
        orderBy: { order: "asc" },
        include: {
          substages: {
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

  if (!project) {
    throw new Error(`Proyecto ${projectId} no encontrado durante seed`);
  }

  return project;
}

async function createSolarSystem(params: {
  projectId: string;
  order?: number;
  description?: string | null;
  inverterBrand?: string | null;
  inverterPowerKw?: number | null;
  inverterQuantity?: number | null;
  inverterPhaseType?: PhaseType | null;
  inverterModel?: string | null;
  panelQuantity?: number | null;
  panelPowerW?: number | null;
  panelBrand?: string | null;
  panelModel?: string | null;
}) {
  await prisma.solarSystem.create({
    data: {
      projectId: params.projectId,
      order: params.order ?? 1,
      description: params.description ?? null,
      inverterBrand: params.inverterBrand ?? null,
      inverterPowerKw: params.inverterPowerKw != null ? decimal(params.inverterPowerKw) : null,
      inverterQuantity: params.inverterQuantity ?? 1,
      inverterPhaseType: params.inverterPhaseType ?? null,
      inverterModel: params.inverterModel ?? null,
      panelQuantity: params.panelQuantity ?? null,
      panelPowerW: params.panelPowerW ?? null,
      panelBrand: params.panelBrand ?? null,
      panelModel: params.panelModel ?? null,
    },
  });
}

function getStage(project: ProjectGraph, stageType: StageType) {
  const stage = project.stages.find((item) => item.name === stageType);
  if (!stage) {
    throw new Error(`Etapa ${stageType} no encontrada en ${project.code}`);
  }

  return stage;
}

function getSubstage(project: ProjectGraph, stageType: StageType, substageName: string) {
  const stage = getStage(project, stageType);
  const substage = stage.substages.find((item) => item.name === substageName);
  if (!substage) {
    throw new Error(`Subetapa '${substageName}' no encontrada en ${project.code}`);
  }

  return substage;
}

async function setOperationVisibility(stageId: string, tipoObra: TipoObra) {
  await prisma.substage.updateMany({
    where: {
      stageId,
      deletedAt: null,
    },
    data: {
      isActive: true,
    },
  });

  await prisma.substage.updateMany({
    where: {
      stageId,
      name: "Ejecución de Obra Propia",
    },
    data: {
      isActive: tipoObra === TipoObra.PROPIA,
    },
  });

  await prisma.substage.updateMany({
    where: {
      stageId,
      name: "Ejecución de Obra Tercerizada",
    },
    data: {
      isActive: tipoObra === TipoObra.TERCERIZADA,
    },
  });
}

async function completeChecklistItems(params: {
  project: ProjectGraph;
  stageType: StageType;
  substageName: string;
  labels?: string[];
  completedAt: string;
  userId: string;
}) {
  const substage = getSubstage(params.project, params.stageType, params.substageName);
  const targetItems =
    params.labels && params.labels.length > 0
      ? substage.checklistItems.filter((item) => params.labels?.includes(item.label))
      : substage.checklistItems;

  for (const item of targetItems) {
    await prisma.checklistItem.update({
      where: { id: item.id },
      data: {
        completed: true,
        completedAt: timestamp(params.completedAt),
        completedBy: params.userId,
      },
    });
  }

  await syncSubstageProgress(substage.id);
}

async function addFreeChecklistItems(params: {
  project: ProjectGraph;
  stageType: StageType;
  substageName: string;
  items: Array<{ label: string; completed?: boolean; completedAt?: string; userId?: string }>;
}) {
  const substage = getSubstage(params.project, params.stageType, params.substageName);
  const maxOrder = substage.checklistItems.reduce((max, item) => Math.max(max, item.order), 0);

  for (const [index, item] of params.items.entries()) {
    await prisma.checklistItem.create({
      data: {
        substageId: substage.id,
        projectId: params.project.id,
        order: maxOrder + index + 1,
        label: item.label,
        completed: item.completed ?? false,
        completedAt: item.completedAt ? timestamp(item.completedAt) : null,
        completedBy: item.completed && item.userId ? item.userId : null,
        isRequired: false,
        isBlocker: false,
      },
    });
  }

  await syncSubstageProgress(substage.id);
}

async function setSubstageState(params: {
  project: ProjectGraph;
  stageType: StageType;
  substageName: string;
  status: SubstageStatus;
  actualStartDate?: string | null;
  actualEndDate?: string | null;
  notes?: string | null;
}) {
  const substage = getSubstage(params.project, params.stageType, params.substageName);
  await prisma.substage.update({
    where: { id: substage.id },
    data: {
      status: params.status,
      actualStartDate: params.actualStartDate ? dateOnly(params.actualStartDate) : null,
      actualEndDate: params.actualEndDate ? dateOnly(params.actualEndDate) : null,
      notes: params.notes ?? null,
      progressPercent: params.status === SubstageStatus.COMPLETED ? 100 : undefined,
    },
  });

  await syncSubstageProgress(substage.id);
}

async function setStageState(params: {
  project: ProjectGraph;
  stageType: StageType;
  status: StageStatus;
  actualStartDate?: string | null;
  actualEndDate?: string | null;
  tipoObra?: TipoObra | null;
  notes?: string | null;
}) {
  const stage = getStage(params.project, params.stageType);
  const actualStartDate = params.actualStartDate ? dateOnly(params.actualStartDate) : null;
  const actualEndDate = params.actualEndDate ? dateOnly(params.actualEndDate) : null;
  const actualDurationDays =
    actualStartDate && actualEndDate ? Math.max(0, diffInDays(actualStartDate, actualEndDate)) : null;
  const delayDays =
    actualDurationDays !== null && stage.plannedDurationDays !== null
      ? actualDurationDays - (stage.plannedDurationDays ?? 0)
      : null;

  await prisma.stage.update({
    where: { id: stage.id },
    data: {
      status: params.status,
      tipoObra: params.tipoObra ?? null,
      actualStartDate,
      actualEndDate,
      actualDurationDays,
      delayDays,
      notes: params.notes ?? null,
      progressPercent: params.status === StageStatus.COMPLETED ? 100 : stage.progressPercent,
    },
  });

  if (params.tipoObra && params.stageType === StageType.OPERACIONES) {
    await setOperationVisibility(stage.id, params.tipoObra);
  }

  await syncStageProgress(stage.id);
}

async function refreshProjectSummary(projectId: string, status?: ProjectStatus, actualEndDate?: string | null) {
  const progressPercent = await calculateProjectProgress(projectId);
  await prisma.project.update({
    where: { id: projectId },
    data: {
      status,
      actualEndDate: actualEndDate ? dateOnly(actualEndDate) : undefined,
      executedUsd: undefined,
      updatedAt: new Date(),
    },
  });

  return progressPercent;
}

async function seedProject1(adminId: string, operationsId: string) {
  const project = await createProject({
    code: "PRY-2025-004",
    clientName: "Agroindustrial Sur S.A.",
    capacityKwp: 250,
    locationCity: "San Justo",
    locationProvince: "Córdoba",
    status: ProjectStatus.ACTIVE,
    startDate: "2025-01-10",
    plannedEndDate: "2025-06-20",
    budgetUsd: 228000,
    executedUsd: 156400,
    estimatedMwhYear: 398.6,
    modalidadPago: ModalidadPago.DIRECTO_50_50,
    notificationEmail: "proyectos@agroindustrialsur.com.ar",
    notificationPhone: "+5493584123456",
    createdById: adminId,
  });

  await createSolarSystem({
    projectId: project.id,
    inverterBrand: "Growatt",
    inverterPowerKw: 25,
    inverterQuantity: 1,
    inverterPhaseType: PhaseType.TRIFASICO_400,
    panelQuantity: 40,
    panelPowerW: 550,
  });

  let graph = await hydrateProject(project.id);

  for (const [substageName, completedAt] of [
    ["Confirmación formal por escrito", "2025-01-10T12:00:00.000Z"],
    ["Cobro de seña (USD 500)", "2025-01-11T12:00:00.000Z"],
    ["Contrato", "2025-01-12T12:00:00.000Z"],
    ["Recolección de datos administrativos", "2025-01-13T12:00:00.000Z"],
    ["Modalidad de pago definida", "2025-01-13T16:00:00.000Z"],
    ["Organización carpeta digital", "2025-01-14T12:00:00.000Z"],
    ["Registro en planilla de operaciones", "2025-01-15T12:00:00.000Z"],
    ["Consulta inicial UTE", "2025-01-16T12:00:00.000Z"],
    ["Comunicación al cliente", "2025-01-16T17:00:00.000Z"],
  ] as const) {
    await completeChecklistItems({
      project: graph,
      stageType: StageType.ONBOARDING,
      substageName,
      completedAt,
      userId: adminId,
    });
    await setSubstageState({
      project: graph,
      stageType: StageType.ONBOARDING,
      substageName,
      status: SubstageStatus.COMPLETED,
      actualStartDate: "2025-01-10",
      actualEndDate: "2025-01-16",
    });
  }

  await setStageState({
    project: graph,
    stageType: StageType.ONBOARDING,
    status: StageStatus.COMPLETED,
    actualStartDate: "2025-01-10",
    actualEndDate: "2025-01-16",
  });

  graph = await hydrateProject(project.id);

  for (const [substageName, completedAt] of [
    ["Relevamiento Técnico", "2025-01-25T16:00:00.000Z"],
    ["Proyecto Final de Ingeniería", "2025-02-06T18:00:00.000Z"],
  ] as const) {
    await completeChecklistItems({
      project: graph,
      stageType: StageType.INGENIERIA,
      substageName,
      completedAt,
      userId: operationsId,
    });
    await setSubstageState({
      project: graph,
      stageType: StageType.INGENIERIA,
      substageName,
      status: SubstageStatus.COMPLETED,
      actualStartDate: substageName === "Relevamiento Técnico" ? "2025-01-20" : "2025-01-27",
      actualEndDate: substageName === "Relevamiento Técnico" ? "2025-01-25" : "2025-02-06",
    });
  }

  await setStageState({
    project: graph,
    stageType: StageType.INGENIERIA,
    status: StageStatus.COMPLETED,
    actualStartDate: "2025-01-20",
    actualEndDate: "2025-02-06",
  });

  graph = await hydrateProject(project.id);

  await setStageState({
    project: graph,
    stageType: StageType.OPERACIONES,
    status: StageStatus.IN_PROGRESS,
    actualStartDate: "2025-02-14",
    tipoObra: TipoObra.PROPIA,
  });

  graph = await hydrateProject(project.id);

  await completeChecklistItems({
    project: graph,
    stageType: StageType.OPERACIONES,
    substageName: "Planificación y Logística",
    completedAt: "2025-02-20T18:00:00.000Z",
    userId: operationsId,
  });
  await setSubstageState({
    project: graph,
    stageType: StageType.OPERACIONES,
    substageName: "Planificación y Logística",
    status: SubstageStatus.COMPLETED,
    actualStartDate: "2025-02-14",
    actualEndDate: "2025-02-20",
  });

  await completeChecklistItems({
    project: graph,
    stageType: StageType.OPERACIONES,
    substageName: "Ejecución de Obra Propia",
    labels: [
      "Cliente o responsable presente confirmado",
      "Alcance repasado con cliente",
      "Cortes eléctricos explicados",
      "Ubicación final confirmada",
      "Seguridad verificada",
      "Estructura montada",
      "Paneles instalados",
      "Canalizaciones realizadas",
      "Cableado DC completo",
      "Tablero armado",
      "Protecciones AC/DC instaladas",
      "Puesta a tierra realizada",
      "Rotulado completo",
      "Gerente de Operaciones notificado",
      "Medición de strings realizada",
      "Verificación eléctrica y puesta a tierra realizada",
      "Conexión final AC realizada",
      "Sistema encendido",
      "Planta creada en servidor",
      "Parámetros configurados",
    ],
    completedAt: "2025-03-22T17:00:00.000Z",
    userId: operationsId,
  });
  await setSubstageState({
    project: graph,
    stageType: StageType.OPERACIONES,
    substageName: "Ejecución de Obra Propia",
    status: SubstageStatus.IN_PROGRESS,
    actualStartDate: "2025-03-10",
    notes: "Fase 1 completa y fase 2 de puesta en marcha en curso",
  });

  await prisma.project.update({
    where: { id: project.id },
    data: {
      executedUsd: decimal(171200),
    },
  });

  return project.id;
}

async function seedProject2(adminId: string, operationsId: string) {
  const project = await createProject({
    code: "PRY-2025-002",
    clientName: "Frigorífico Norte S.R.L.",
    capacityKwp: 180,
    locationCity: "Reconquista",
    locationProvince: "Santa Fe",
    status: ProjectStatus.ACTIVE,
    startDate: "2025-01-15",
    plannedEndDate: "2025-06-10",
    budgetUsd: 168000,
    executedUsd: 148500,
    estimatedMwhYear: 284.4,
    modalidadPago: ModalidadPago.DIRECTO_50_50,
    notificationEmail: "obras@frigorificonorte.com",
    notificationPhone: "+5493482554411",
    createdById: adminId,
  });

  await createSolarSystem({
    projectId: project.id,
    inverterBrand: "Huawei",
    inverterPowerKw: 20,
    inverterQuantity: 1,
    inverterPhaseType: PhaseType.TRIFASICO_400,
    panelQuantity: 32,
    panelPowerW: 550,
  });

  let graph = await hydrateProject(project.id);

  for (const stageType of [StageType.ONBOARDING, StageType.INGENIERIA] as const) {
    const stage = getStage(graph, stageType);
    for (const substage of stage.substages) {
      await completeChecklistItems({
        project: graph,
        stageType,
        substageName: substage.name,
        completedAt: "2025-02-05T18:00:00.000Z",
        userId: stageType === StageType.ONBOARDING ? adminId : operationsId,
      });
      await setSubstageState({
        project: graph,
        stageType,
        substageName: substage.name,
        status: SubstageStatus.COMPLETED,
        actualStartDate: stageType === StageType.ONBOARDING ? "2025-01-15" : "2025-02-01",
        actualEndDate: stageType === StageType.ONBOARDING ? "2025-01-24" : "2025-02-05",
      });
    }

    await setStageState({
      project: graph,
      stageType,
      status: StageStatus.COMPLETED,
      actualStartDate: stageType === StageType.ONBOARDING ? "2025-01-15" : "2025-02-01",
      actualEndDate: stageType === StageType.ONBOARDING ? "2025-01-24" : "2025-02-05",
    });
    graph = await hydrateProject(project.id);
  }

  await setStageState({
    project: graph,
    stageType: StageType.OPERACIONES,
    status: StageStatus.COMPLETED,
    actualStartDate: "2025-02-10",
    actualEndDate: "2025-04-18",
    tipoObra: TipoObra.TERCERIZADA,
  });

  graph = await hydrateProject(project.id);

  await completeChecklistItems({
    project: graph,
    stageType: StageType.OPERACIONES,
    substageName: "Planificación y Logística",
    completedAt: "2025-02-15T16:00:00.000Z",
    userId: operationsId,
  });
  await setSubstageState({
    project: graph,
    stageType: StageType.OPERACIONES,
    substageName: "Planificación y Logística",
    status: SubstageStatus.COMPLETED,
    actualStartDate: "2025-02-10",
    actualEndDate: "2025-02-15",
  });

  await completeChecklistItems({
    project: graph,
    stageType: StageType.OPERACIONES,
    substageName: "Ejecución de Obra Tercerizada",
    completedAt: "2025-04-05T16:00:00.000Z",
    userId: operationsId,
  });
  await setSubstageState({
    project: graph,
    stageType: StageType.OPERACIONES,
    substageName: "Ejecución de Obra Tercerizada",
    status: SubstageStatus.COMPLETED,
    actualStartDate: "2025-02-20",
    actualEndDate: "2025-04-05",
  });

  await completeChecklistItems({
    project: graph,
    stageType: StageType.OPERACIONES,
    substageName: "Control de Costos",
    completedAt: "2025-04-18T18:00:00.000Z",
    userId: operationsId,
  });
  await setSubstageState({
    project: graph,
    stageType: StageType.OPERACIONES,
    substageName: "Control de Costos",
    status: SubstageStatus.COMPLETED,
    actualStartDate: "2025-04-08",
    actualEndDate: "2025-04-18",
  });

  graph = await hydrateProject(project.id);
  await setStageState({
    project: graph,
    stageType: StageType.HABILITACION_UTE,
    status: StageStatus.IN_PROGRESS,
    actualStartDate: "2025-04-22",
  });

  graph = await hydrateProject(project.id);
  await addFreeChecklistItems({
    project: graph,
    stageType: StageType.HABILITACION_UTE,
    substageName: "Trámite de microgeneración UTE",
    items: [
      { label: "Documentación de microgeneración cargada", completed: true, completedAt: "2025-04-25T12:00:00.000Z", userId: operationsId },
      { label: "Formulario firmado por cliente recibido", completed: true, completedAt: "2025-04-25T14:00:00.000Z", userId: operationsId },
      { label: "Número de trámite UTE registrado" },
    ],
  });
  await setSubstageState({
    project: graph,
    stageType: StageType.HABILITACION_UTE,
    substageName: "Trámite de microgeneración UTE",
    status: SubstageStatus.IN_PROGRESS,
    actualStartDate: "2025-04-22",
  });

  await addFreeChecklistItems({
    project: graph,
    stageType: StageType.HABILITACION_UTE,
    substageName: "Inspección y aprobación UTE",
    items: [{ label: "Fecha tentativa de inspección coordinada", completed: true, completedAt: "2025-05-02T11:00:00.000Z", userId: operationsId }],
  });

  await prisma.project.update({
    where: { id: project.id },
    data: {
      executedUsd: decimal(159800),
    },
  });

  return project.id;
}

async function seedProject3(adminId: string, operationsId: string) {
  const project = await createProject({
    code: "PRY-2025-006",
    clientName: "Clínica del Valle",
    capacityKwp: 60,
    locationCity: "Mendoza Capital",
    locationProvince: "Mendoza",
    status: ProjectStatus.ACTIVE,
    startDate: "2025-03-05",
    plannedEndDate: "2025-07-20",
    budgetUsd: 59400,
    executedUsd: 11200,
    estimatedMwhYear: 94.8,
    modalidadPago: ModalidadPago.FINANCIACION_BANCARIA,
    notificationEmail: "direccion@clinicadelvalle.com",
    notificationPhone: "+5492615550144",
    createdById: adminId,
  });

  await createSolarSystem({
    projectId: project.id,
    inverterBrand: "Growatt",
    inverterPowerKw: 6,
    inverterQuantity: 1,
    inverterPhaseType: PhaseType.MONOFASICO,
    panelQuantity: 12,
    panelPowerW: 550,
  });

  let graph = await hydrateProject(project.id);

  for (const substage of getStage(graph, StageType.ONBOARDING).substages) {
    await completeChecklistItems({
      project: graph,
      stageType: StageType.ONBOARDING,
      substageName: substage.name,
      completedAt: "2025-03-18T17:00:00.000Z",
      userId: adminId,
    });
    await setSubstageState({
      project: graph,
      stageType: StageType.ONBOARDING,
      substageName: substage.name,
      status: SubstageStatus.COMPLETED,
      actualStartDate: "2025-03-05",
      actualEndDate: "2025-03-18",
    });
  }

  await setStageState({
    project: graph,
    stageType: StageType.ONBOARDING,
    status: StageStatus.COMPLETED,
    actualStartDate: "2025-03-05",
    actualEndDate: "2025-03-18",
  });

  graph = await hydrateProject(project.id);
  await setStageState({
    project: graph,
    stageType: StageType.INGENIERIA,
    status: StageStatus.IN_PROGRESS,
    actualStartDate: "2025-03-20",
  });

  graph = await hydrateProject(project.id);
  await completeChecklistItems({
    project: graph,
    stageType: StageType.INGENIERIA,
    substageName: "Relevamiento Técnico",
    labels: [
      "Visita coordinada con cliente",
      "Fecha registrada en CRM",
      "Visita confirmada el día anterior",
      "Tipo y estado del techo relevado",
      "Pendiente y orientación medidas",
      "Obstáculos identificados",
      "Sistema de fijación viable definido",
      "Tipo de suministro relevado",
      "Estado de tablero relevado",
      "Espacio para protecciones verificado",
      "Puesta a tierra relevada",
      "Ubicación del inversor definida",
      "Ubicación de tablero de protecciones definida",
      "Recorridos DC y AC medidos",
      "Fotos del techo cargadas",
      "Fotos de estructura cargadas",
    ],
    completedAt: "2025-03-28T16:00:00.000Z",
    userId: operationsId,
  });
  await setSubstageState({
    project: graph,
    stageType: StageType.INGENIERIA,
    substageName: "Relevamiento Técnico",
    status: SubstageStatus.IN_PROGRESS,
    actualStartDate: "2025-03-21",
    notes: "Faltan evidencias y cierre del informe técnico",
  });

  await prisma.project.update({
    where: { id: project.id },
    data: {
      executedUsd: decimal(12800),
    },
  });

  return project.id;
}

async function seedProject4(adminId: string, operationsId: string) {
  const project = await createProject({
    code: "PRY-2025-005",
    clientName: "Bodega La Cuesta",
    capacityKwp: 120,
    locationCity: "Luján de Cuyo",
    locationProvince: "Mendoza",
    status: ProjectStatus.COMPLETED,
    startDate: "2024-09-02",
    plannedEndDate: "2025-01-30",
    actualEndDate: "2025-02-08",
    budgetUsd: 118500,
    executedUsd: 121900,
    estimatedMwhYear: 189.2,
    modalidadPago: ModalidadPago.DIRECTO_50_50,
    notificationEmail: "mantenimiento@bodegalacuesta.com",
    notificationPhone: "+5492615550980",
    createdById: adminId,
  });

  await createSolarSystem({
    projectId: project.id,
    inverterBrand: "Growatt",
    inverterPowerKw: 12,
    inverterQuantity: 1,
    inverterPhaseType: PhaseType.TRIFASICO_230,
    panelQuantity: 20,
    panelPowerW: 580,
  });

  let graph = await hydrateProject(project.id);

  const fullCompletedStages: Array<{
    stageType: StageType;
    stageStart: string;
    stageEnd: string;
    tipoObra?: TipoObra;
    substageWindows: Array<{ name: string; start: string; end: string }>;
  }> = [
    {
      stageType: StageType.ONBOARDING,
      stageStart: "2024-09-02",
      stageEnd: "2024-09-12",
      substageWindows: getStage(graph, StageType.ONBOARDING).substages.map((substage) => ({
        name: substage.name,
        start: "2024-09-02",
        end: "2024-09-12",
      })),
    },
    {
      stageType: StageType.INGENIERIA,
      stageStart: "2024-09-15",
      stageEnd: "2024-10-05",
      substageWindows: [
        { name: "Relevamiento Técnico", start: "2024-09-15", end: "2024-09-20" },
        { name: "Proyecto Final de Ingeniería", start: "2024-09-21", end: "2024-10-05" },
      ],
    },
    {
      stageType: StageType.OPERACIONES,
      stageStart: "2024-10-12",
      stageEnd: "2024-12-05",
      tipoObra: TipoObra.PROPIA,
      substageWindows: [
        { name: "Planificación y Logística", start: "2024-10-12", end: "2024-10-18" },
        { name: "Ejecución de Obra Propia", start: "2024-10-21", end: "2024-11-25" },
        { name: "Control de Costos", start: "2024-11-26", end: "2024-12-05" },
      ],
    },
    {
      stageType: StageType.HABILITACION_UTE,
      stageStart: "2024-12-10",
      stageEnd: "2025-01-20",
      substageWindows: [
        { name: "Trámite de microgeneración UTE", start: "2024-12-10", end: "2024-12-22" },
        { name: "Inspección y aprobación UTE", start: "2024-12-23", end: "2025-01-10" },
        { name: "Medidor bidireccional", start: "2025-01-11", end: "2025-01-20" },
      ],
    },
    {
      stageType: StageType.POSTVENTA,
      stageStart: "2025-01-22",
      stageEnd: "2025-02-08",
      substageWindows: [
        { name: "Capacitación al cliente", start: "2025-01-22", end: "2025-01-24" },
        { name: "Alta en plataforma de monitoreo", start: "2025-01-25", end: "2025-01-28" },
        { name: "Garantías y documentación final", start: "2025-01-29", end: "2025-02-08" },
      ],
    },
  ];

  for (const stageConfig of fullCompletedStages) {
    if (stageConfig.stageType === StageType.HABILITACION_UTE) {
      await addFreeChecklistItems({
        project: graph,
        stageType: StageType.HABILITACION_UTE,
        substageName: "Trámite de microgeneración UTE",
        items: [
          { label: "Expediente completo presentado", completed: true, completedAt: "2024-12-22T15:00:00.000Z", userId: operationsId },
          { label: "Seguimiento en planilla UTE actualizado", completed: true, completedAt: "2024-12-22T16:00:00.000Z", userId: operationsId },
        ],
      });
      await addFreeChecklistItems({
        project: graph,
        stageType: StageType.HABILITACION_UTE,
        substageName: "Inspección y aprobación UTE",
        items: [
          { label: "Inspección aprobada sin observaciones", completed: true, completedAt: "2025-01-10T14:00:00.000Z", userId: operationsId },
        ],
      });
      await addFreeChecklistItems({
        project: graph,
        stageType: StageType.HABILITACION_UTE,
        substageName: "Medidor bidireccional",
        items: [
          { label: "Medidor bidireccional instalado", completed: true, completedAt: "2025-01-20T13:00:00.000Z", userId: operationsId },
        ],
      });
    }

    if (stageConfig.stageType === StageType.POSTVENTA) {
      await addFreeChecklistItems({
        project: graph,
        stageType: StageType.POSTVENTA,
        substageName: "Capacitación al cliente",
        items: [{ label: "Capacitación presencial realizada", completed: true, completedAt: "2025-01-24T11:00:00.000Z", userId: operationsId }],
      });
      await addFreeChecklistItems({
        project: graph,
        stageType: StageType.POSTVENTA,
        substageName: "Alta en plataforma de monitoreo",
        items: [{ label: "Usuario del cliente habilitado", completed: true, completedAt: "2025-01-28T11:00:00.000Z", userId: operationsId }],
      });
      await addFreeChecklistItems({
        project: graph,
        stageType: StageType.POSTVENTA,
        substageName: "Garantías y documentación final",
        items: [{ label: "Dossier final entregado", completed: true, completedAt: "2025-02-08T11:00:00.000Z", userId: operationsId }],
      });
    }

    graph = await hydrateProject(project.id);

    if (stageConfig.stageType === StageType.OPERACIONES && stageConfig.tipoObra) {
      await setStageState({
        project: graph,
        stageType: StageType.OPERACIONES,
        status: StageStatus.IN_PROGRESS,
        actualStartDate: stageConfig.stageStart,
        tipoObra: stageConfig.tipoObra,
      });
      graph = await hydrateProject(project.id);
    }

    for (const substageWindow of stageConfig.substageWindows) {
      await completeChecklistItems({
        project: graph,
        stageType: stageConfig.stageType,
        substageName: substageWindow.name,
        completedAt: `${substageWindow.end}T18:00:00.000Z`,
        userId: stageConfig.stageType === StageType.ONBOARDING ? adminId : operationsId,
      });
      await setSubstageState({
        project: graph,
        stageType: stageConfig.stageType,
        substageName: substageWindow.name,
        status: SubstageStatus.COMPLETED,
        actualStartDate: substageWindow.start,
        actualEndDate: substageWindow.end,
      });
    }

    graph = await hydrateProject(project.id);
    await setStageState({
      project: graph,
      stageType: stageConfig.stageType,
      status: StageStatus.COMPLETED,
      actualStartDate: stageConfig.stageStart,
      actualEndDate: stageConfig.stageEnd,
      tipoObra: stageConfig.tipoObra,
    });
    graph = await hydrateProject(project.id);
  }

  return project.id;
}

async function createTasksAndFiles(projectIds: string[], adminId: string, operationsId: string) {
  const [project1Id, project2Id, project3Id, project4Id] = projectIds;

  const project1 = await hydrateProject(project1Id);
  const project2 = await hydrateProject(project2Id);
  const project3 = await hydrateProject(project3Id);
  const project4 = await hydrateProject(project4Id);

  const p1OpsStage = getStage(project1, StageType.OPERACIONES);
  const p1Own = getSubstage(project1, StageType.OPERACIONES, "Ejecución de Obra Propia");
  const p2Ute = getStage(project2, StageType.HABILITACION_UTE);
  const p3Engineering = getStage(project3, StageType.INGENIERIA);
  const p3O0 = getSubstage(project3, StageType.INGENIERIA, "Relevamiento Técnico");
  const p4Postventa = getStage(project4, StageType.POSTVENTA);

  await prisma.task.createMany({
    data: [
      {
        projectId: project1Id,
        stageId: p1OpsStage.id,
        substageId: p1Own.id,
        title: "Coordinar técnico de puesta en marcha",
        description: "Agendar cierre de Fase 2 con ensayo anti-isla",
        status: TaskStatus.IN_PROGRESS,
        priority: TaskPriority.URGENT,
        responsible: "Gerencia Operaciones",
        userId: operationsId,
        dueDate: dateOnly("2025-03-24"),
      },
      {
        projectId: project1Id,
        stageId: p1OpsStage.id,
        substageId: p1Own.id,
        title: "Subir videos de ensayos pendientes",
        description: "Falta cargar evidencia final al expediente del proyecto",
        status: TaskStatus.PENDING,
        priority: TaskPriority.NORMAL,
        responsible: "Jefe de Obra",
        userId: operationsId,
        dueDate: dateOnly("2025-03-25"),
      },
      {
        projectId: project2Id,
        stageId: p2Ute.id,
        title: "Confirmar fecha de inspección UTE",
        description: "Hacer seguimiento con distribuidora y cliente",
        status: TaskStatus.IN_PROGRESS,
        priority: TaskPriority.URGENT,
        responsible: "Gerencia Operaciones",
        userId: operationsId,
        dueDate: dateOnly("2025-05-05"),
      },
      {
        projectId: project3Id,
        stageId: p3Engineering.id,
        substageId: p3O0.id,
        title: "Cerrar informe técnico de relevamiento",
        description: "Faltan fotos de tablero y recorrido AC",
        status: TaskStatus.IN_PROGRESS,
        priority: TaskPriority.URGENT,
        responsible: "Técnico de Relevamiento",
        userId: operationsId,
        dueDate: dateOnly("2025-03-30"),
      },
      {
        projectId: project4Id,
        stageId: p4Postventa.id,
        title: "Enviar reporte final de monitoreo",
        description: "Entregar primer reporte mensual al cliente",
        status: TaskStatus.COMPLETED,
        priority: TaskPriority.NORMAL,
        responsible: "Equipo Postventa",
        userId: adminId,
        dueDate: dateOnly("2025-02-10"),
        completedAt: timestamp("2025-02-10T16:00:00.000Z"),
      } as Prisma.TaskCreateManyInput,
    ],
  });

  await prisma.fileAttachment.createMany({
    data: [
      {
        projectId: project1Id,
        stageId: p1OpsStage.id,
        substageId: p1Own.id,
        filename: "acta-avance-obra-propia.pdf",
        storedFilename: "seed-p1-acta.pdf",
        mimeType: "application/pdf",
        sizeBytes: 242184,
        url: "seed/PRY-2025-004/acta-avance-obra-propia.pdf",
        uploadedById: operationsId,
      },
      {
        projectId: project2Id,
        stageId: p2Ute.id,
        filename: "expediente-ute-microgeneracion.pdf",
        storedFilename: "seed-p2-ute.pdf",
        mimeType: "application/pdf",
        sizeBytes: 190842,
        url: "seed/PRY-2025-002/expediente-ute.pdf",
        uploadedById: operationsId,
      },
      {
        projectId: project3Id,
        stageId: p3Engineering.id,
        substageId: p3O0.id,
        filename: "fotos-relevamiento-clinica.zip",
        storedFilename: "seed-p3-relevamiento.zip",
        mimeType: "application/zip",
        sizeBytes: 412932,
        url: "seed/PRY-2025-006/fotos-relevamiento.zip",
        uploadedById: operationsId,
      },
      {
        projectId: project4Id,
        stageId: p4Postventa.id,
        filename: "dossier-final-bodega.pdf",
        storedFilename: "seed-p4-dossier.pdf",
        mimeType: "application/pdf",
        sizeBytes: 284912,
        url: "seed/PRY-2025-005/dossier-final.pdf",
        uploadedById: adminId,
      },
    ],
  });

  await prisma.notification.createMany({
    data: [
      {
        userId: operationsId,
        projectId: project1Id,
        type: NotificationType.stage_overdue,
        title: "Operaciones con desvío parcial",
        message: "La puesta en marcha de Agroindustrial Sur sigue abierta y requiere seguimiento.",
      },
      {
        userId: operationsId,
        projectId: project2Id,
        type: NotificationType.progress_milestone,
        title: "Proyecto entrando en habilitación",
        message: "Frigorífico Norte completó Operaciones y avanzó a Habilitación UTE.",
      },
      {
        userId: operationsId,
        projectId: project3Id,
        type: NotificationType.task_due,
        title: "Relevamiento con vencimiento próximo",
        message: "La tarea de cierre de informe técnico vence mañana.",
      },
    ],
  });
}

async function createAuditTrail(projectId: string, userId: string, entries: Array<{
  entityType: AuditEntityType;
  entityId: string;
  action: AuditAction;
  description: string;
  fieldChanged?: string | null;
  oldValue?: string | null;
  newValue?: string | null;
  timestamp: string;
}>) {
  for (const entry of entries) {
    await prisma.auditLog.create({
      data: {
        entityType: entry.entityType,
        entityId: entry.entityId,
        projectId,
        userId,
        action: entry.action,
        fieldChanged: entry.fieldChanged ?? null,
        oldValue: entry.oldValue ?? null,
        newValue: entry.newValue ?? null,
        description: entry.description,
        timestamp: timestamp(entry.timestamp),
      },
    });
  }
}

async function createProjectAudits(projectId: string, userId: string) {
  const project = await hydrateProject(projectId);
  const onboarding = getStage(project, StageType.ONBOARDING);
  const engineering = getStage(project, StageType.INGENIERIA);
  const operations = getStage(project, StageType.OPERACIONES);
  const habilitacion = getStage(project, StageType.HABILITACION_UTE);

  await createAuditTrail(projectId, userId, [
    {
      entityType: AuditEntityType.project,
      entityId: project.id,
      action: AuditAction.created,
      description: `Creó proyecto '${project.clientName}' con código ${project.code}`,
      timestamp: "2025-01-10T09:00:00.000Z",
    },
    {
      entityType: AuditEntityType.stage,
      entityId: onboarding.id,
      action: AuditAction.stage_advanced,
      fieldChanged: "status",
      oldValue: "PENDING",
      newValue: "IN_PROGRESS",
      description: "Inició etapa Onboarding",
      timestamp: "2025-01-10T10:00:00.000Z",
    },
    {
      entityType: AuditEntityType.substage,
      entityId: getSubstage(project, StageType.ONBOARDING, "Cobro de seña (USD 500)").id,
      action: AuditAction.updated,
      fieldChanged: "completed",
      oldValue: "false",
      newValue: "true",
      description: "Marcó cobro de seña como completado",
      timestamp: "2025-01-11T16:00:00.000Z",
    },
    {
      entityType: AuditEntityType.stage,
      entityId: onboarding.id,
      action: AuditAction.stage_advanced,
      fieldChanged: "status",
      oldValue: "IN_PROGRESS",
      newValue: "COMPLETED",
      description: "Completó etapa Onboarding",
      timestamp: "2025-01-16T18:00:00.000Z",
    },
    {
      entityType: AuditEntityType.stage,
      entityId: engineering.id,
      action: AuditAction.stage_advanced,
      fieldChanged: "status",
      oldValue: "PENDING",
      newValue: "IN_PROGRESS",
      description: "Inició etapa Ingeniería",
      timestamp: "2025-01-20T09:00:00.000Z",
    },
    {
      entityType: AuditEntityType.substage,
      entityId: getSubstage(project, StageType.INGENIERIA, "Proyecto Final de Ingeniería").id,
      action: AuditAction.updated,
      fieldChanged: "completed",
      oldValue: "false",
      newValue: "true",
      description: "Cerró el proyecto final de ingeniería",
      timestamp: "2025-02-06T18:00:00.000Z",
    },
    {
      entityType: AuditEntityType.stage,
      entityId: engineering.id,
      action: AuditAction.stage_advanced,
      fieldChanged: "status",
      oldValue: "IN_PROGRESS",
      newValue: "COMPLETED",
      description: "Completó etapa Ingeniería",
      timestamp: "2025-02-06T18:15:00.000Z",
    },
    {
      entityType: AuditEntityType.stage,
      entityId: operations.id,
      action: AuditAction.updated,
      fieldChanged: "tipoObra",
      oldValue: null,
      newValue: "PROPIA",
      description: "Definió tipo de obra Propia para Operaciones",
      timestamp: "2025-02-14T09:00:00.000Z",
    },
    {
      entityType: AuditEntityType.stage,
      entityId: operations.id,
      action: AuditAction.stage_advanced,
      fieldChanged: "status",
      oldValue: "PENDING",
      newValue: "IN_PROGRESS",
      description: "Inició etapa Operaciones",
      timestamp: "2025-02-14T09:05:00.000Z",
    },
    {
      entityType: AuditEntityType.substage,
      entityId: getSubstage(project, StageType.OPERACIONES, "Planificación y Logística").id,
      action: AuditAction.updated,
      fieldChanged: "status",
      oldValue: "PENDING",
      newValue: "COMPLETED",
      description: "Completó planificación y logística",
      timestamp: "2025-02-20T18:00:00.000Z",
    },
    {
      entityType: AuditEntityType.substage,
      entityId: getSubstage(project, StageType.OPERACIONES, "Ejecución de Obra Propia").id,
      action: AuditAction.updated,
      fieldChanged: "status",
      oldValue: "PENDING",
      newValue: "IN_PROGRESS",
      description: "Inició ejecución de obra propia",
      timestamp: "2025-03-10T08:00:00.000Z",
    },
    {
      entityType: AuditEntityType.stage,
      entityId: habilitacion.id,
      action: AuditAction.created,
      description: "Etapa Habilitación UTE preparada para siguiente avance",
      timestamp: "2025-03-22T18:00:00.000Z",
    },
  ]);
}

async function run() {
  await resetDatabase();
  const { admin, operations, comercial, ingeniero } = await createUsers();

  const project1Id = await seedProject1(admin.id, operations.id);
  const project2Id = await seedProject2(admin.id, operations.id);
  const project3Id = await seedProject3(admin.id, operations.id);
  const project4Id = await seedProject4(admin.id, operations.id);

  await createTasksAndFiles([project1Id, project2Id, project3Id, project4Id], admin.id, operations.id);

  await createProjectAudits(project1Id, admin.id);
  await createProjectAudits(project2Id, admin.id);
  await createProjectAudits(project3Id, admin.id);
  await createProjectAudits(project4Id, admin.id);

  await seedPermissions();
  await seedSettings(admin.id);
  await seedLeads(comercial.id, admin.id, project1Id);
  await seedGoals(admin.id);

  // Para seedComments necesitamos IDs de una etapa y una tarea del project1
  const project1 = await prisma.project.findUnique({
    where: { id: project1Id },
    include: {
      stages: { orderBy: { order: "asc" }, take: 1 },
      tasks: { take: 1 },
    },
  });
  if (project1 && project1.stages.length > 0 && project1.tasks.length > 0) {
    await seedComments(
      admin.id,
      comercial.id,
      ingeniero.id,
      project1Id,
      project1.stages[0].id,
      project1.tasks[0].id,
    );
  }

  console.log("Seed completado con pipeline SOP real, permisos, settings, leads, objetivos y comentarios.");
}

run()
  .catch((error) => {
    console.error("Error ejecutando seed", error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

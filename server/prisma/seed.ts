import bcrypt from "bcryptjs";
import {
  Action,
  AuditAction,
  AuditEntityType,
  CategoriaPrincipal,
  EstadoAprobacion,
  GoalArea,
  GoalMetric,
  GoalPeriod,
  ModalidadPago,
  Module,
  Moneda,
  NotificationType,
  PhaseType,
  Prisma,
  ProjectStatus,
  SalesStage,
  SettingKey,
  SettingLevel,
  StageStatus,
  StageType,
  SubstageStatus,
  TaskPriority,
  TaskStatus,
  TipoMovimiento,
  TipoMovimientoStock,
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

if (process.env.NODE_ENV === 'production') {
  console.log('⛔ Seed bloqueado en producción.')
  console.log('Para correr manualmente usá:')
  console.log('FORCE_SEED=1 npm run db:seed')
  if (process.env.FORCE_SEED !== '1') {
    process.exit(0)
  }
}

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

function slug(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
}

// ─── Roles sistema ────────────────────────────────────────────────────────────

const SYSTEM_ROLES: Array<{ name: string; label: string }> = [
  { name: "ADMIN", label: "Administrador" },
  { name: "OPERACIONES", label: "Operaciones" },
  { name: "INGENIERIA", label: "Ingeniería" },
  { name: "ASESOR_COMERCIAL", label: "Asesor comercial" },
  { name: "FINANZAS", label: "Finanzas" },
];

async function seedSystemRoles(): Promise<Map<string, string>> {
  // Upsert por name (idempotente). Mantiene isSystem=true sin pisar labels si el admin renombró.
  const map = new Map<string, string>();
  for (const r of SYSTEM_ROLES) {
    const role = await prisma.role.upsert({
      where: { name: r.name },
      create: { name: r.name, label: r.label, isSystem: true },
      update: {
        // No sobreescribimos label/description en re-seed: respeta ediciones del admin.
        isSystem: true,
      },
    });
    map.set(r.name, role.id);
  }
  return map;
}

// ─── Usuarios ─────────────────────────────────────────────────────────────────

async function createUsers(roleIdByName: Map<string, string>) {
  const password = await bcrypt.hash("Y1025Voltia", 10);

  async function upsertUser(email: string, data: { name: string; roleName: string }) {
    const roleId = roleIdByName.get(data.roleName);
    if (!roleId) throw new Error(`Rol ${data.roleName} no encontrado en la tabla roles`);
    return prisma.user.upsert({
      where: { email },
      create: {
        email,
        password,
        name: data.name,
        roleId,
        avatarUrl: null,
      },
      update: {
        // No sobreescribir password ni role en re-seed: preservar cambios hechos desde la app.
        name: data.name,
      },
    });
  }

  const admin = await upsertUser("admin@voltiapm.com", { name: "Administrador Voltia", roleName: "ADMIN" });
  const operations = await upsertUser("operaciones@voltiapm.com", { name: "Gerencia Operaciones", roleName: "OPERACIONES" });
  const comercial = await upsertUser("comercial@voltiapm.com", { name: "Asesor Comercial", roleName: "ASESOR_COMERCIAL" });
  const ingeniero = await upsertUser("ingeniero@voltiapm.com", { name: "Ingeniero Proyectista", roleName: "INGENIERIA" });
  const finanzas = await upsertUser("finanzas@voltiapm.com", { name: "Responsable Finanzas", roleName: "FINANZAS" });

  return { admin, operations, comercial, ingeniero, finanzas };
}

// ─── Permisos ─────────────────────────────────────────────────────────────────

async function seedPermissions(roleIdByName: Map<string, string>) {
  const matrix: Array<{ roleName: string; module: Module; actions: Action[] }> = [
    { roleName: "ADMIN", module: Module.VENTAS,         actions: [Action.VIEW, Action.CREATE, Action.EDIT, Action.DELETE, Action.COMMENT] },
    { roleName: "ADMIN", module: Module.ONBOARDING,     actions: [Action.VIEW, Action.CREATE, Action.EDIT, Action.DELETE, Action.COMPLETE, Action.COMMENT] },
    { roleName: "ADMIN", module: Module.INGENIERIA,     actions: [Action.VIEW, Action.CREATE, Action.EDIT, Action.DELETE, Action.COMPLETE, Action.COMMENT] },
    { roleName: "ADMIN", module: Module.OPERACIONES,    actions: [Action.VIEW, Action.CREATE, Action.EDIT, Action.DELETE, Action.COMPLETE, Action.COMMENT] },
    { roleName: "ADMIN", module: Module.HABILITACION,   actions: [Action.VIEW, Action.CREATE, Action.EDIT, Action.DELETE, Action.COMPLETE, Action.COMMENT] },
    { roleName: "ADMIN", module: Module.POSTVENTA,      actions: [Action.VIEW, Action.CREATE, Action.EDIT, Action.DELETE, Action.COMPLETE, Action.COMMENT] },
    { roleName: "ADMIN", module: Module.METRICAS,       actions: [Action.VIEW] },
    { roleName: "ADMIN", module: Module.CONFIGURACION,  actions: [Action.VIEW, Action.CREATE, Action.EDIT, Action.DELETE] },
    { roleName: "ADMIN", module: Module.USUARIOS,       actions: [Action.VIEW, Action.CREATE, Action.EDIT, Action.DELETE] },
    { roleName: "ADMIN", module: Module.FINANZAS,       actions: [Action.VIEW, Action.CREATE, Action.EDIT, Action.DELETE] },
    { roleName: "ADMIN", module: Module.STOCK,          actions: [Action.VIEW, Action.CREATE, Action.EDIT, Action.DELETE] },
    { roleName: "ASESOR_COMERCIAL", module: Module.VENTAS,        actions: [Action.VIEW, Action.CREATE, Action.EDIT, Action.COMMENT] },
    { roleName: "ASESOR_COMERCIAL", module: Module.ONBOARDING,    actions: [Action.VIEW, Action.COMMENT] },
    { roleName: "ASESOR_COMERCIAL", module: Module.INGENIERIA,    actions: [Action.VIEW] },
    { roleName: "ASESOR_COMERCIAL", module: Module.OPERACIONES,   actions: [Action.VIEW] },
    { roleName: "ASESOR_COMERCIAL", module: Module.HABILITACION,  actions: [Action.VIEW] },
    { roleName: "ASESOR_COMERCIAL", module: Module.POSTVENTA,     actions: [Action.VIEW] },
    { roleName: "INGENIERIA", module: Module.ONBOARDING,    actions: [Action.VIEW, Action.COMMENT] },
    { roleName: "INGENIERIA", module: Module.INGENIERIA,    actions: [Action.VIEW, Action.CREATE, Action.EDIT, Action.COMPLETE, Action.COMMENT] },
    { roleName: "INGENIERIA", module: Module.OPERACIONES,   actions: [Action.VIEW, Action.COMMENT] },
    { roleName: "INGENIERIA", module: Module.HABILITACION,  actions: [Action.VIEW, Action.COMMENT] },
    { roleName: "INGENIERIA", module: Module.POSTVENTA,     actions: [Action.VIEW] },
    { roleName: "INGENIERIA", module: Module.METRICAS,      actions: [Action.VIEW] },
    { roleName: "OPERACIONES", module: Module.VENTAS,        actions: [Action.VIEW] },
    { roleName: "OPERACIONES", module: Module.ONBOARDING,    actions: [Action.VIEW, Action.COMMENT] },
    { roleName: "OPERACIONES", module: Module.INGENIERIA,    actions: [Action.VIEW] },
    { roleName: "OPERACIONES", module: Module.OPERACIONES,   actions: [Action.VIEW, Action.CREATE, Action.EDIT, Action.COMPLETE, Action.COMMENT] },
    { roleName: "OPERACIONES", module: Module.HABILITACION,  actions: [Action.VIEW, Action.CREATE, Action.EDIT, Action.COMPLETE, Action.COMMENT] },
    { roleName: "OPERACIONES", module: Module.POSTVENTA,     actions: [Action.VIEW, Action.COMMENT] },
    { roleName: "OPERACIONES", module: Module.METRICAS,      actions: [Action.VIEW] },
    { roleName: "OPERACIONES", module: Module.STOCK,         actions: [Action.VIEW] },
    { roleName: "FINANZAS", module: Module.FINANZAS, actions: [Action.VIEW, Action.CREATE, Action.EDIT, Action.DELETE] },
    { roleName: "FINANZAS", module: Module.STOCK,    actions: [Action.VIEW, Action.CREATE, Action.EDIT, Action.DELETE] },
  ];

  for (const entry of matrix) {
    const roleId = roleIdByName.get(entry.roleName);
    if (!roleId) throw new Error(`Rol ${entry.roleName} no encontrado`);
    for (const action of entry.actions) {
      await prisma.permission.upsert({
        where: {
          roleId_module_action: { roleId, module: entry.module, action },
        },
        create: { roleId, module: entry.module, action },
        update: {},
      });
    }
  }
}

// ─── Settings ─────────────────────────────────────────────────────────────────

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
    const id = `seed-setting-${s.key.toLowerCase()}`;
    await prisma.setting.upsert({
      where: { id },
      create: {
        id,
        level: SettingLevel.SYSTEM,
        key: s.key,
        value: s.value,
        updatedById,
      },
      update: {
        value: s.value,
        updatedById,
      },
    });
  }
}

// ─── Leads ────────────────────────────────────────────────────────────────────

async function seedLeads(comercialId: string, adminId: string, projectId: string) {
  async function upsertLead(code: string, data: Omit<Prisma.SalesLeadCreateInput, "code">) {
    return prisma.salesLead.upsert({
      where: { code },
      create: { code, ...data },
      update: data,
    });
  }

  async function upsertActivity(
    id: string,
    data: Omit<Prisma.SalesActivityCreateInput, "id">,
  ) {
    await prisma.salesActivity.upsert({
      where: { id },
      create: { id, ...data },
      update: data,
    });
  }

  const lead1 = await upsertLead("LEAD-2026-001", {
    clientName: "Frigorífico del Sur S.A. — Marcelo Ríos",
    clientEmail: "mrios@frigsur.com.ar",
    clientPhone: "+54 9 11 5544-3322",
    address: "Cañuelas, Buenos Aires",
    estimatedKwp: new Prisma.Decimal(180),
    estimatedBudgetUsd: new Prisma.Decimal(95000),
    stage: SalesStage.NUEVO_LEAD,
    assignedTo: { connect: { id: comercialId } },
    createdBy: { connect: { id: adminId } },
    notes: "Contacto vía LinkedIn. Techo industrial disponible ~1200 m². Interesado en financiamiento.",
  });
  await upsertActivity(`seed-sa-${lead1.code}-1`, {
    lead: { connect: { id: lead1.id } },
    user: { connect: { id: comercialId } },
    action: "LLAMADA",
    notes: "Primer contacto telefónico. Cliente interesado, solicitó más información.",
  });

  const lead2 = await upsertLead("LEAD-2026-002", {
    clientName: "Bodegas Andinas S.R.L. — Valentina Pereyra",
    clientEmail: "vpereyra@bodegasandinas.com",
    clientPhone: "+54 9 261 4433-2211",
    address: "Maipú, Mendoza",
    estimatedKwp: new Prisma.Decimal(320),
    estimatedBudgetUsd: new Prisma.Decimal(170000),
    stage: SalesStage.COTIZADO,
    assignedTo: { connect: { id: comercialId } },
    createdBy: { connect: { id: adminId } },
    proposalSentAt: new Date("2026-03-23T10:00:00Z"),
    notes: "Empresa mediana. Tarifa T3 BT. Cotización enviada el 05/04. Esperando respuesta del directorio.",
  });
  await upsertActivity(`seed-sa-${lead2.code}-1`, {
    lead: { connect: { id: lead2.id } },
    user: { connect: { id: comercialId } },
    fromStage: SalesStage.NUEVO_LEAD,
    toStage: SalesStage.PENDIENTE_COTIZAR,
    action: "REUNION",
    notes: "Visita técnica a la bodega. Se tomaron medidas del techo y se relevó medidor.",
  });
  await upsertActivity(`seed-sa-${lead2.code}-2`, {
    lead: { connect: { id: lead2.id } },
    user: { connect: { id: comercialId } },
    fromStage: SalesStage.PENDIENTE_COTIZAR,
    toStage: SalesStage.COTIZADO,
    action: "EMAIL",
    notes: "Envío de cotización formal con 3 opciones de capacidad: 250, 320 y 400 kWp.",
  });

  const lead3 = await upsertLead("LEAD-2026-003", {
    clientName: "Logística Patagónica S.A. — Roberto Álvarez",
    clientEmail: "ralvarez@logpata.com.ar",
    clientPhone: "+54 9 294 3322-1100",
    address: "Bariloche, Río Negro",
    estimatedKwp: new Prisma.Decimal(90),
    estimatedBudgetUsd: new Prisma.Decimal(48000),
    stage: SalesStage.NEGOCIACION,
    assignedTo: { connect: { id: comercialId } },
    createdBy: { connect: { id: adminId } },
    proposalSentAt: new Date("2026-03-12T11:00:00Z"),
    visitScheduledAt: new Date("2026-03-17T09:00:00Z"),
    visitCompletedAt: new Date("2026-03-18T14:00:00Z"),
    notes: "Cliente muy interesado. Negocia precio por pago anticipado. Oferta revisada con 5% de descuento.",
  });
  await upsertActivity(`seed-sa-${lead3.code}-1`, {
    lead: { connect: { id: lead3.id } },
    user: { connect: { id: comercialId } },
    fromStage: SalesStage.COTIZADO,
    toStage: SalesStage.NEGOCIACION,
    action: "REUNION",
    notes: "Segunda reunión presencial. El cliente quiere cerrar antes de fin de mes.",
  });
  await upsertActivity(`seed-sa-${lead3.code}-2`, {
    lead: { connect: { id: lead3.id } },
    user: { connect: { id: comercialId } },
    action: "LLAMADA",
    notes: "Revisión de condiciones contractuales. Acuerdo verbal sobre precio.",
  });

  const lead4 = await upsertLead("LEAD-2025-047", {
    clientName: "Supermercados Frescos S.A. — Daniela Morán",
    clientEmail: "dmoran@frescos.com.ar",
    clientPhone: "+54 9 351 6677-8899",
    address: "Córdoba, Córdoba",
    estimatedKwp: new Prisma.Decimal(250),
    estimatedBudgetUsd: new Prisma.Decimal(135000),
    stage: SalesStage.CERRADO_GANADO,
    assignedTo: { connect: { id: comercialId } },
    createdBy: { connect: { id: adminId } },
    convertedToProject: { connect: { id: projectId } },
    convertedAt: new Date("2025-11-10T09:00:00Z"),
    proposalSentAt: new Date("2025-10-18T10:00:00Z"),
    visitScheduledAt: new Date("2025-10-25T10:00:00Z"),
    visitCompletedAt: new Date("2025-10-26T15:00:00Z"),
    closedAt: new Date("2025-11-10T09:00:00Z"),
    notes: "Convertido a proyecto activo. Firma de contrato realizada el 2025-11-10.",
  });
  await upsertActivity(`seed-sa-${lead4.code}-1`, {
    lead: { connect: { id: lead4.id } },
    user: { connect: { id: comercialId } },
    action: "REUNION",
    notes: "Presentación formal de propuesta ejecutiva.",
  });
  await upsertActivity(`seed-sa-${lead4.code}-2`, {
    lead: { connect: { id: lead4.id } },
    user: { connect: { id: adminId } },
    fromStage: SalesStage.NEGOCIACION,
    toStage: SalesStage.CERRADO_GANADO,
    action: "CONTRATO",
    notes: "Firma de contrato y pago de anticipo del 50%. Lead convertido a proyecto.",
  });

  return { lead1, lead2, lead3, lead4 };
}

// ─── Goals ────────────────────────────────────────────────────────────────────

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

  for (const g of goals) {
    // Upsert manual: el composite unique incluye `quarter` nullable y Prisma no
    // acepta null en el tipo compuesto generado. Find-then-create/update
    // preserva la intención (no duplica, no borra).
    const existing = await prisma.goal.findFirst({
      where: {
        area: g.area,
        metric: g.metric,
        period: g.period,
        year: g.year,
        quarter: g.quarter,
      },
    });
    if (existing) {
      await prisma.goal.update({
        where: { id: existing.id },
        data: { targetValue: new Prisma.Decimal(g.targetValue) },
      });
    } else {
      await prisma.goal.create({
        data: {
          area: g.area,
          metric: g.metric,
          period: g.period,
          year: g.year,
          quarter: g.quarter,
          targetValue: new Prisma.Decimal(g.targetValue),
          createdById: adminId,
        },
      });
    }
  }
}

// ─── Comments ─────────────────────────────────────────────────────────────────

async function seedComments(
  adminId: string,
  comercialId: string,
  ingenieroId: string,
  projectId: string,
  stageId: string,
  taskId: string,
) {
  await prisma.comment.upsert({
    where: { id: "seed-comment-project-1" },
    create: {
      id: "seed-comment-project-1",
      projectId,
      authorId: comercialId,
      content: "El cliente confirmó que el transformador tiene capacidad suficiente para los 250 kWp. No se requiere ampliación.",
    },
    update: {},
  });

  await prisma.comment.upsert({
    where: { id: "seed-comment-stage-1" },
    create: {
      id: "seed-comment-stage-1",
      projectId,
      stageId,
      authorId: ingenieroId,
      content: "Planos aprobados por el departamento de ingeniería. Se adjuntó versión final en archivos del proyecto.",
    },
    update: {},
  });

  await prisma.comment.upsert({
    where: { id: "seed-comment-task-1" },
    create: {
      id: "seed-comment-task-1",
      projectId,
      taskId,
      authorId: adminId,
      content: "Verificar que el proveedor de estructuras confirme entrega antes del 20/04. El cronograma depende de esto.",
    },
    update: {},
  });
}

// ─── Projects ─────────────────────────────────────────────────────────────────

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
  // Chequear si el proyecto ya existe ANTES del upsert.
  // Solo si es nuevo invocamos createInitialPipeline() para evitar duplicar stages/substages.
  const existing = await prisma.project.findUnique({ where: { code: params.code } });

  const commonData = {
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
  };

  const project = await prisma.project.upsert({
    where: { code: params.code },
    create: {
      code: params.code,
      createdById: params.createdById,
      ...commonData,
    },
    update: commonData,
  });

  if (!existing) {
    await createInitialPipeline(
      project.id,
      dateOnly(params.startDate),
      dateOnly(params.plannedEndDate),
      params.modalidadPago ?? null,
    );
  }

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
  const order = params.order ?? 1;
  const data = {
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
  };
  await prisma.solarSystem.upsert({
    where: { projectId_order: { projectId: params.projectId, order } },
    create: {
      projectId: params.projectId,
      order,
      ...data,
    },
    update: data,
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
    where: { stageId, deletedAt: null },
    data: { isActive: true },
  });
  await prisma.substage.updateMany({
    where: { stageId, name: "Ejecución de Obra Propia" },
    data: { isActive: tipoObra === TipoObra.PROPIA },
  });
  await prisma.substage.updateMany({
    where: { stageId, name: "Ejecución de Obra Tercerizada" },
    data: { isActive: tipoObra === TipoObra.TERCERIZADA },
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

  for (const [index, item] of params.items.entries()) {
    const id = `seed-chkextra-${substage.id}-${slug(item.label)}-${index}`;
    const data = {
      substageId: substage.id,
      projectId: params.project.id,
      label: item.label,
      completed: item.completed ?? false,
      completedAt: item.completedAt ? timestamp(item.completedAt) : null,
      completedBy: item.completed && item.userId ? item.userId : null,
      isRequired: false,
      isBlocker: false,
    };
    await prisma.checklistItem.upsert({
      where: { id },
      create: {
        id,
        order: 1000 + index, // rango reservado para items extra del seed
        ...data,
      },
      update: {
        completed: data.completed,
        completedAt: data.completedAt,
        completedBy: data.completedBy,
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

// ─── Project definitions (sin cambios de lógica; delegan a createProject) ─────

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
    notificationEmail: "agroind@example.com",
    notificationPhone: "+54 9 351 5555-0001",
    createdById: adminId,
  });

  await createSolarSystem({
    projectId: project.id,
    order: 1,
    description: "Planta principal - 250 kWp",
    inverterBrand: "Growatt",
    inverterPowerKw: 50,
    inverterQuantity: 5,
    inverterPhaseType: PhaseType.TRIFASICO_400,
    inverterModel: "MAX 50KTL3-X",
    panelQuantity: 454,
    panelPowerW: 550,
    panelBrand: "JA Solar",
    panelModel: "JAM72S30-550/MR",
  });

  let graph = await hydrateProject(project.id);

  await setStageState({
    project: graph,
    stageType: StageType.ONBOARDING,
    status: StageStatus.COMPLETED,
    actualStartDate: "2025-01-10",
    actualEndDate: "2025-01-16",
  });
  graph = await hydrateProject(project.id);

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

  await setSubstageState({
    project: graph,
    stageType: StageType.OPERACIONES,
    substageName: "Planificación y Logística",
    status: SubstageStatus.COMPLETED,
    actualStartDate: "2025-02-14",
    actualEndDate: "2025-02-20",
  });
  graph = await hydrateProject(project.id);

  await completeChecklistItems({
    project: graph,
    stageType: StageType.OPERACIONES,
    substageName: "Planificación y Logística",
    completedAt: "2025-02-20T18:00:00.000Z",
    userId: operationsId,
  });
  graph = await hydrateProject(project.id);

  await setSubstageState({
    project: graph,
    stageType: StageType.OPERACIONES,
    substageName: "Ejecución de Obra Propia",
    status: SubstageStatus.IN_PROGRESS,
    actualStartDate: "2025-03-10",
  });

  await refreshProjectSummary(project.id, ProjectStatus.ACTIVE);

  return project.id;
}

async function seedProject2(adminId: string, operationsId: string) {
  const project = await createProject({
    code: "PRY-2025-002",
    clientName: "Frigorífico Norte S.R.L.",
    capacityKwp: 180,
    locationCity: "Resistencia",
    locationProvince: "Chaco",
    status: ProjectStatus.ACTIVE,
    startDate: "2024-11-15",
    plannedEndDate: "2025-05-30",
    budgetUsd: 165000,
    executedUsd: 142500,
    estimatedMwhYear: 287.0,
    modalidadPago: ModalidadPago.FINANCIACION_BANCARIA,
    notificationEmail: "frignorte@example.com",
    notificationPhone: "+54 9 362 5555-0002",
    createdById: adminId,
  });

  await createSolarSystem({
    projectId: project.id,
    order: 1,
    description: "Planta principal - 180 kWp",
    inverterBrand: "Huawei",
    inverterPowerKw: 60,
    inverterQuantity: 3,
    inverterPhaseType: PhaseType.TRIFASICO_400,
    inverterModel: "SUN2000-60KTL",
    panelQuantity: 330,
    panelPowerW: 545,
    panelBrand: "Trina Solar",
    panelModel: "TSM-DE19R",
  });

  let graph = await hydrateProject(project.id);

  for (const stageType of [StageType.ONBOARDING, StageType.INGENIERIA]) {
    await setStageState({
      project: graph,
      stageType,
      status: StageStatus.COMPLETED,
      actualStartDate: "2024-11-15",
      actualEndDate: "2024-12-15",
    });
    graph = await hydrateProject(project.id);
  }

  await setStageState({
    project: graph,
    stageType: StageType.OPERACIONES,
    status: StageStatus.COMPLETED,
    actualStartDate: "2024-12-20",
    actualEndDate: "2025-03-31",
    tipoObra: TipoObra.TERCERIZADA,
  });
  graph = await hydrateProject(project.id);

  await setStageState({
    project: graph,
    stageType: StageType.HABILITACION_UTE,
    status: StageStatus.IN_PROGRESS,
    actualStartDate: "2025-04-01",
  });

  await refreshProjectSummary(project.id, ProjectStatus.ACTIVE);

  return project.id;
}

async function seedProject3(adminId: string, operationsId: string) {
  const project = await createProject({
    code: "PRY-2025-006",
    clientName: "Clínica del Valle",
    capacityKwp: 65,
    locationCity: "Tafí Viejo",
    locationProvince: "Tucumán",
    status: ProjectStatus.ACTIVE,
    startDate: "2025-02-20",
    plannedEndDate: "2025-06-15",
    budgetUsd: 58000,
    executedUsd: 18000,
    estimatedMwhYear: 98.4,
    modalidadPago: ModalidadPago.DIRECTO_50_50,
    notificationEmail: "clinicavalle@example.com",
    notificationPhone: "+54 9 381 5555-0003",
    createdById: adminId,
  });

  await createSolarSystem({
    projectId: project.id,
    order: 1,
    description: "Planta única - 65 kWp",
    inverterBrand: "Growatt",
    inverterPowerKw: 25,
    inverterQuantity: 2,
    inverterPhaseType: PhaseType.TRIFASICO_230,
    inverterModel: "MAX 25KTL3-X",
    panelQuantity: 120,
    panelPowerW: 545,
    panelBrand: "Canadian Solar",
    panelModel: "CS6R-HKN",
  });

  let graph = await hydrateProject(project.id);

  await setStageState({
    project: graph,
    stageType: StageType.ONBOARDING,
    status: StageStatus.COMPLETED,
    actualStartDate: "2025-02-20",
    actualEndDate: "2025-02-26",
  });
  graph = await hydrateProject(project.id);

  await setStageState({
    project: graph,
    stageType: StageType.INGENIERIA,
    status: StageStatus.IN_PROGRESS,
    actualStartDate: "2025-03-01",
  });

  await refreshProjectSummary(project.id, ProjectStatus.ACTIVE);

  return project.id;
}

async function seedProject4(adminId: string, operationsId: string) {
  const project = await createProject({
    code: "PRY-2025-005",
    clientName: "Bodega La Cuesta",
    capacityKwp: 145,
    locationCity: "San Rafael",
    locationProvince: "Mendoza",
    status: ProjectStatus.COMPLETED,
    startDate: "2024-08-10",
    plannedEndDate: "2025-01-20",
    actualEndDate: "2025-01-18",
    budgetUsd: 132000,
    executedUsd: 132000,
    estimatedMwhYear: 230.0,
    modalidadPago: ModalidadPago.DIRECTO_50_50,
    notificationEmail: "bodegalacuesta@example.com",
    notificationPhone: "+54 9 260 5555-0004",
    createdById: adminId,
  });

  await createSolarSystem({
    projectId: project.id,
    order: 1,
    description: "Sistema completo - 145 kWp",
    inverterBrand: "Fronius",
    inverterPowerKw: 50,
    inverterQuantity: 3,
    inverterPhaseType: PhaseType.TRIFASICO_400,
    inverterModel: "Symo 50.0-3",
    panelQuantity: 264,
    panelPowerW: 550,
    panelBrand: "Longi",
    panelModel: "Hi-MO 6",
  });

  const stageConfigs: Array<{
    type: StageType;
    stageStart: string;
    stageEnd: string;
    tipoObra?: TipoObra;
  }> = [
    { type: StageType.ONBOARDING, stageStart: "2024-08-10", stageEnd: "2024-08-17" },
    { type: StageType.INGENIERIA, stageStart: "2024-08-20", stageEnd: "2024-09-10" },
    { type: StageType.OPERACIONES, stageStart: "2024-09-15", stageEnd: "2024-11-30", tipoObra: TipoObra.PROPIA },
    { type: StageType.HABILITACION_UTE, stageStart: "2024-12-01", stageEnd: "2024-12-20" },
    { type: StageType.POSTVENTA, stageStart: "2024-12-21", stageEnd: "2025-01-18" },
  ];

  let graph = await hydrateProject(project.id);
  for (const stageConfig of stageConfigs) {
    await setStageState({
      project: graph,
      stageType: stageConfig.type,
      status: StageStatus.COMPLETED,
      actualStartDate: stageConfig.stageStart,
      actualEndDate: stageConfig.stageEnd,
      tipoObra: stageConfig.tipoObra,
    });
    graph = await hydrateProject(project.id);
  }

  return project.id;
}

// ─── Tasks, Files, Notifications ──────────────────────────────────────────────

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

  const tasks: Array<{ id: string; data: Prisma.TaskUncheckedCreateInput }> = [
    {
      id: "seed-task-p1-1",
      data: {
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
    },
    {
      id: "seed-task-p1-2",
      data: {
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
    },
    {
      id: "seed-task-p2-1",
      data: {
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
    },
    {
      id: "seed-task-p3-1",
      data: {
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
    },
    {
      id: "seed-task-p4-1",
      data: {
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
      },
    },
  ];

  for (const t of tasks) {
    await prisma.task.upsert({
      where: { id: t.id },
      create: { id: t.id, ...t.data },
      update: t.data,
    });
  }

  const files: Array<{ id: string; data: Prisma.FileAttachmentUncheckedCreateInput }> = [
    {
      id: "seed-file-p1-1",
      data: {
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
    },
    {
      id: "seed-file-p2-1",
      data: {
        projectId: project2Id,
        stageId: p2Ute.id,
        filename: "expediente-ute-microgeneracion.pdf",
        storedFilename: "seed-p2-ute.pdf",
        mimeType: "application/pdf",
        sizeBytes: 190842,
        url: "seed/PRY-2025-002/expediente-ute.pdf",
        uploadedById: operationsId,
      },
    },
    {
      id: "seed-file-p3-1",
      data: {
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
    },
    {
      id: "seed-file-p4-1",
      data: {
        projectId: project4Id,
        stageId: p4Postventa.id,
        filename: "dossier-final-bodega.pdf",
        storedFilename: "seed-p4-dossier.pdf",
        mimeType: "application/pdf",
        sizeBytes: 284912,
        url: "seed/PRY-2025-005/dossier-final.pdf",
        uploadedById: adminId,
      },
    },
  ];

  for (const f of files) {
    await prisma.fileAttachment.upsert({
      where: { id: f.id },
      create: { id: f.id, ...f.data },
      update: f.data,
    });
  }

  const notifications: Array<{ id: string; data: Prisma.NotificationUncheckedCreateInput }> = [
    {
      id: "seed-notif-p1-overdue",
      data: {
        userId: operationsId,
        projectId: project1Id,
        type: NotificationType.stage_overdue,
        title: "Operaciones con desvío parcial",
        message: "La puesta en marcha de Agroindustrial Sur sigue abierta y requiere seguimiento.",
      },
    },
    {
      id: "seed-notif-p2-milestone",
      data: {
        userId: operationsId,
        projectId: project2Id,
        type: NotificationType.progress_milestone,
        title: "Proyecto entrando en habilitación",
        message: "Frigorífico Norte completó Operaciones y avanzó a Habilitación UTE.",
      },
    },
    {
      id: "seed-notif-p3-due",
      data: {
        userId: operationsId,
        projectId: project3Id,
        type: NotificationType.task_due,
        title: "Relevamiento con vencimiento próximo",
        message: "La tarea de cierre de informe técnico vence mañana.",
      },
    },
  ];

  for (const n of notifications) {
    await prisma.notification.upsert({
      where: { id: n.id },
      create: { id: n.id, ...n.data },
      update: n.data,
    });
  }
}

// ─── Audit trail ──────────────────────────────────────────────────────────────

async function createAuditTrail(
  projectCode: string,
  projectId: string,
  userId: string,
  entries: Array<{
    entityType: AuditEntityType;
    entityId: string;
    action: AuditAction;
    description: string;
    fieldChanged?: string | null;
    oldValue?: string | null;
    newValue?: string | null;
    timestamp: string;
  }>,
) {
  for (const [index, entry] of entries.entries()) {
    const id = `seed-audit-${projectCode}-${index + 1}`;
    const data = {
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
    };
    await prisma.auditLog.upsert({
      where: { id },
      create: { id, ...data },
      update: data,
    });
  }
}

async function createProjectAudits(projectId: string, userId: string) {
  const project = await hydrateProject(projectId);
  const onboarding = getStage(project, StageType.ONBOARDING);
  const engineering = getStage(project, StageType.INGENIERIA);
  const operations = getStage(project, StageType.OPERACIONES);
  const habilitacion = getStage(project, StageType.HABILITACION_UTE);

  await createAuditTrail(project.code, projectId, userId, [
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

// ─── Installation schedules ───────────────────────────────────────────────────

async function seedInstallationSchedules(params: {
  adminId: string;
  project1Id: string;
  project2Id: string;
  project4Id: string;
}) {
  const { adminId, project1Id, project2Id, project4Id } = params;

  type ScheduleSeed = {
    teamName: string;
    teamColor: string;
    confirmedAt?: Date;
    confirmedBy?: string;
    notes?: string;
    segments: Array<{ startDate: Date; endDate: Date; notes?: string }>;
  };

  async function upsertSchedule(projectId: string, data: ScheduleSeed) {
    // Borra cualquier instalación previa del proyecto (incluyendo segments por cascade).
    const existing = await prisma.installationSchedule.findUnique({ where: { projectId } });
    if (existing) {
      await prisma.installationSchedule.delete({ where: { id: existing.id } });
    }
    await prisma.installationSchedule.create({
      data: {
        projectId,
        teamName: data.teamName,
        teamColor: data.teamColor,
        confirmedAt: data.confirmedAt,
        confirmedBy: data.confirmedBy,
        notes: data.notes,
        createdBy: adminId,
        segments: {
          create: data.segments.map((s) => ({
            startDate: s.startDate,
            endDate: s.endDate,
            notes: s.notes ?? null,
          })),
        },
      },
    });
  }

  await upsertSchedule(project1Id, {
    teamName: "Equipo propio",
    teamColor: "#378ADD",
    confirmedAt: new Date("2026-04-20T12:00:00Z"),
    confirmedBy: adminId,
    notes: "Traslado de materiales confirmado con logística.",
    segments: [
      { startDate: parseDateOnly("2026-05-04"), endDate: parseDateOnly("2026-05-08") },
    ],
  });

  await upsertSchedule(project2Id, {
    teamName: "Instaladores Sur",
    teamColor: "#1D9E75",
    notes: "Coordinar ingreso con planta.",
    segments: [
      { startDate: parseDateOnly("2026-05-11"), endDate: parseDateOnly("2026-05-15") },
    ],
  });

  await upsertSchedule(project4Id, {
    teamName: "Equipo propio",
    teamColor: "#378ADD",
    confirmedAt: new Date("2026-04-22T15:00:00Z"),
    confirmedBy: adminId,
    segments: [
      { startDate: parseDateOnly("2026-05-25"), endDate: parseDateOnly("2026-05-29") },
    ],
  });
}

// ─── Finance & Stock ──────────────────────────────────────────────────────────

async function seedFinanceAndStock(
  adminId: string,
  project1Id: string,
  project2Id: string,
  project3Id: string,
) {
  // ExchangeRate
  await prisma.exchangeRate.upsert({
    where: { id: "seed-exch-initial" },
    create: {
      id: "seed-exch-initial",
      usdToUyu: new Prisma.Decimal("43.50"),
      source: "manual",
      createdBy: adminId,
    },
    update: {
      usdToUyu: new Prisma.Decimal("43.50"),
      source: "manual",
    },
  });

  // Suppliers
  async function upsertSupplier(
    id: string,
    data: Omit<Prisma.SupplierCreateInput, "id">,
  ) {
    return prisma.supplier.upsert({
      where: { id },
      create: { id, ...data },
      update: data,
    });
  }

  const growatt = await upsertSupplier("seed-supplier-growatt", {
    nombre: "Growatt Uruguay",
    email: "growatt@example.com",
    condicionPago: "30 días",
  });
  const estructuras = await upsertSupplier("seed-supplier-estructuras", {
    nombre: "Estructuras del Sur",
    email: "estructuras@example.com",
    condicionPago: "contado",
  });
  await upsertSupplier("seed-supplier-cables", {
    nombre: "Cables & Más",
    email: "cables@example.com",
    condicionPago: "15 días",
  });

  // FinanceSubcategories — tienen unique compuesto (nombre, categoria)
  async function upsertSubcat(nombre: string, categoria: CategoriaPrincipal) {
    return prisma.financeSubcategory.upsert({
      where: { nombre_categoria: { nombre, categoria } },
      create: { nombre, categoria },
      update: {},
    });
  }

  const subCobro = await upsertSubcat("Cobro cliente", CategoriaPrincipal.PROYECTO_ENTRADA);
  const subManoObra = await upsertSubcat("Mano de obra", CategoriaPrincipal.PROYECTO_SALIDA);
  const subAlquiler = await upsertSubcat("Alquiler", CategoriaPrincipal.FIJO);
  const subSueldos = await upsertSubcat("Sueldos", CategoriaPrincipal.FIJO);
  const subCombustible = await upsertSubcat("Combustible", CategoriaPrincipal.VARIABLE);
  const subCompra = await upsertSubcat("Compra paneles", CategoriaPrincipal.COMPRA_STOCK);
  await upsertSubcat("Materiales de obra", CategoriaPrincipal.PROYECTO_SALIDA);
  await upsertSubcat("Consumo en obra", CategoriaPrincipal.CONSUMO_STOCK);

  // StockProducts
  async function upsertProduct(
    id: string,
    data: Omit<Prisma.StockProductCreateInput, "id">,
  ) {
    return prisma.stockProduct.upsert({
      where: { id },
      create: { id, ...data },
      update: data,
    });
  }

  const paneles = await upsertProduct("seed-stock-paneles", {
    nombre: "Panel solar 550W",
    categoria: "Paneles",
    unidad: "unidad",
    stockActual: new Prisma.Decimal("45"),
    stockMinimo: new Prisma.Decimal("10"),
    costoPromedio: new Prisma.Decimal("185.00"),
    moneda: Moneda.USD,
  });
  await upsertProduct("seed-stock-inversores", {
    nombre: "Inversor Growatt 5kW",
    categoria: "Inversores",
    unidad: "unidad",
    stockActual: new Prisma.Decimal("8"),
    stockMinimo: new Prisma.Decimal("2"),
    costoPromedio: new Prisma.Decimal("950.00"),
    moneda: Moneda.USD,
  });
  await upsertProduct("seed-stock-cable", {
    nombre: "Cable DC 6mm",
    categoria: "Cables",
    unidad: "metro",
    stockActual: new Prisma.Decimal("500"),
    stockMinimo: new Prisma.Decimal("100"),
    costoPromedio: new Prisma.Decimal("2.50"),
    moneda: Moneda.USD,
  });
  const estructura = await upsertProduct("seed-stock-estructura", {
    nombre: "Estructura aluminio",
    categoria: "Estructuras",
    unidad: "kit",
    stockActual: new Prisma.Decimal("15"),
    stockMinimo: new Prisma.Decimal("5"),
    costoPromedio: new Prisma.Decimal("320.00"),
    moneda: Moneda.USD,
  });
  await upsertProduct("seed-stock-disyuntor", {
    nombre: "Disyuntor 32A",
    categoria: "Protecciones",
    unidad: "unidad",
    stockActual: new Prisma.Decimal("30"),
    stockMinimo: new Prisma.Decimal("10"),
    costoPromedio: new Prisma.Decimal("18.00"),
    moneda: Moneda.USD,
  });

  // FinanceMovements
  async function upsertMov(
    id: string,
    data: Omit<Prisma.FinanceMovementUncheckedCreateInput, "id">,
  ) {
    return prisma.financeMovement.upsert({
      where: { id },
      create: { id, ...data },
      update: data,
    });
  }

  const mov1 = await upsertMov("seed-movfin-1", {
    fecha: new Date("2026-02-10"),
    mes: 2, anio: 2026,
    tipoMovimiento: TipoMovimiento.INGRESO,
    categoriaPrincipal: CategoriaPrincipal.PROYECTO_ENTRADA,
    subcategoriaId: subCobro.id,
    descripcion: "Cobro anticipo proyecto P1",
    monto: new Prisma.Decimal("8500.00"),
    moneda: Moneda.USD,
    cobrado: true, impactaFlujo: true,
    projectId: project1Id,
    estadoAprobacion: EstadoAprobacion.APROBADO,
    creadoPorId: adminId,
  });
  void mov1;

  await upsertMov("seed-movfin-2", {
    fecha: new Date("2026-03-05"),
    mes: 3, anio: 2026,
    tipoMovimiento: TipoMovimiento.INGRESO,
    categoriaPrincipal: CategoriaPrincipal.PROYECTO_ENTRADA,
    subcategoriaId: subCobro.id,
    descripcion: "Cobro saldo proyecto P2",
    monto: new Prisma.Decimal("12000.00"),
    moneda: Moneda.USD,
    cobrado: true, impactaFlujo: true,
    projectId: project2Id,
    estadoAprobacion: EstadoAprobacion.APROBADO,
    creadoPorId: adminId,
  });

  await upsertMov("seed-movfin-3", {
    fecha: new Date("2026-03-20"),
    mes: 3, anio: 2026,
    tipoMovimiento: TipoMovimiento.INGRESO,
    categoriaPrincipal: CategoriaPrincipal.PROYECTO_ENTRADA,
    subcategoriaId: subCobro.id,
    descripcion: "Cobro anticipo proyecto P3",
    monto: new Prisma.Decimal("6200.00"),
    moneda: Moneda.USD,
    cobrado: false, impactaFlujo: true,
    projectId: project3Id,
    estadoAprobacion: EstadoAprobacion.REGISTRADO,
    creadoPorId: adminId,
  });

  await upsertMov("seed-movfin-4", {
    fecha: new Date("2026-02-01"),
    mes: 2, anio: 2026,
    tipoMovimiento: TipoMovimiento.GASTO,
    categoriaPrincipal: CategoriaPrincipal.FIJO,
    subcategoriaId: subAlquiler.id,
    descripcion: "Alquiler oficina febrero",
    monto: new Prisma.Decimal("1200.00"),
    moneda: Moneda.USD,
    pagado: true, impactaFlujo: true,
    estadoAprobacion: EstadoAprobacion.APROBADO,
    creadoPorId: adminId,
  });

  await upsertMov("seed-movfin-5", {
    fecha: new Date("2026-02-28"),
    mes: 2, anio: 2026,
    tipoMovimiento: TipoMovimiento.GASTO,
    categoriaPrincipal: CategoriaPrincipal.FIJO,
    subcategoriaId: subSueldos.id,
    descripcion: "Sueldos febrero",
    monto: new Prisma.Decimal("5800.00"),
    moneda: Moneda.USD,
    pagado: true, impactaFlujo: true,
    estadoAprobacion: EstadoAprobacion.APROBADO,
    creadoPorId: adminId,
  });

  await upsertMov("seed-movfin-6", {
    fecha: new Date("2026-03-31"),
    mes: 3, anio: 2026,
    tipoMovimiento: TipoMovimiento.GASTO,
    categoriaPrincipal: CategoriaPrincipal.FIJO,
    subcategoriaId: subSueldos.id,
    descripcion: "Sueldos marzo",
    monto: new Prisma.Decimal("5800.00"),
    moneda: Moneda.USD,
    pagado: false, impactaFlujo: true,
    estadoAprobacion: EstadoAprobacion.PENDIENTE_APROBACION,
    creadoPorId: adminId,
  });

  await upsertMov("seed-movfin-7", {
    fecha: new Date("2026-03-10"),
    mes: 3, anio: 2026,
    tipoMovimiento: TipoMovimiento.GASTO,
    categoriaPrincipal: CategoriaPrincipal.VARIABLE,
    subcategoriaId: subCombustible.id,
    descripcion: "Combustible camioneta marzo",
    monto: new Prisma.Decimal("340.00"),
    moneda: Moneda.USD,
    pagado: true, impactaFlujo: true,
    estadoAprobacion: EstadoAprobacion.REGISTRADO,
    creadoPorId: adminId,
  });

  await upsertMov("seed-movfin-8", {
    fecha: new Date("2026-03-15"),
    mes: 3, anio: 2026,
    tipoMovimiento: TipoMovimiento.GASTO,
    categoriaPrincipal: CategoriaPrincipal.PROYECTO_SALIDA,
    subcategoriaId: subManoObra.id,
    descripcion: "Subcontrato instalación eléctrica P1",
    monto: new Prisma.Decimal("1500.00"),
    moneda: Moneda.USD,
    pagado: false, impactaFlujo: true,
    projectId: project1Id,
    estadoAprobacion: EstadoAprobacion.REGISTRADO,
    creadoPorId: adminId,
  });

  const movStock1 = await upsertMov("seed-movfin-stock-1", {
    fecha: new Date("2026-02-15"),
    mes: 2, anio: 2026,
    tipoMovimiento: TipoMovimiento.GASTO,
    categoriaPrincipal: CategoriaPrincipal.COMPRA_STOCK,
    subcategoriaId: subCompra.id,
    descripcion: "Compra 20 paneles 550W - Growatt",
    monto: new Prisma.Decimal("3700.00"),
    moneda: Moneda.USD,
    pagado: true, impactaFlujo: true,
    supplierId: growatt.id,
    estadoAprobacion: EstadoAprobacion.APROBADO,
    creadoPorId: adminId,
  });

  const movStock2 = await upsertMov("seed-movfin-stock-2", {
    fecha: new Date("2026-03-01"),
    mes: 3, anio: 2026,
    tipoMovimiento: TipoMovimiento.GASTO,
    categoriaPrincipal: CategoriaPrincipal.COMPRA_STOCK,
    subcategoriaId: subCompra.id,
    descripcion: "Compra 5 kits estructura aluminio",
    monto: new Prisma.Decimal("1600.00"),
    moneda: Moneda.USD,
    pagado: true, impactaFlujo: true,
    supplierId: estructuras.id,
    estadoAprobacion: EstadoAprobacion.APROBADO,
    creadoPorId: adminId,
  });

  // StockMovements
  async function upsertStockMov(
    id: string,
    data: Omit<Prisma.StockMovementUncheckedCreateInput, "id">,
  ) {
    await prisma.stockMovement.upsert({
      where: { id },
      create: { id, ...data },
      update: data,
    });
  }

  await upsertStockMov("seed-movstock-1", {
    fecha: new Date("2026-02-15"),
    productId: paneles.id,
    tipo: TipoMovimientoStock.INGRESO,
    cantidad: new Prisma.Decimal("20"),
    costoUnitario: new Prisma.Decimal("185.00"),
    costoTotal: new Prisma.Decimal("3700.00"),
    moneda: Moneda.USD,
    stockResultante: new Prisma.Decimal("45"),
    supplierId: growatt.id,
    financeMovementId: movStock1.id,
    referencia: "OC-2026-001",
  });
  await upsertStockMov("seed-movstock-2", {
    fecha: new Date("2026-03-01"),
    productId: estructura.id,
    tipo: TipoMovimientoStock.INGRESO,
    cantidad: new Prisma.Decimal("5"),
    costoUnitario: new Prisma.Decimal("320.00"),
    costoTotal: new Prisma.Decimal("1600.00"),
    moneda: Moneda.USD,
    stockResultante: new Prisma.Decimal("15"),
    supplierId: estructuras.id,
    financeMovementId: movStock2.id,
    referencia: "OC-2026-002",
  });

  console.log("Finance & Stock seed completado.");
}

// ─── Entry point ──────────────────────────────────────────────────────────────

async function run() {
  const roleIdByName = await seedSystemRoles();
  const { admin, operations, comercial, ingeniero } = await createUsers(roleIdByName);

  const project1Id = await seedProject1(admin.id, operations.id);
  const project2Id = await seedProject2(admin.id, operations.id);
  const project3Id = await seedProject3(admin.id, operations.id);
  const project4Id = await seedProject4(admin.id, operations.id);

  await createTasksAndFiles([project1Id, project2Id, project3Id, project4Id], admin.id, operations.id);

  await createProjectAudits(project1Id, admin.id);
  await createProjectAudits(project2Id, admin.id);
  await createProjectAudits(project3Id, admin.id);
  await createProjectAudits(project4Id, admin.id);

  await seedPermissions(roleIdByName);
  await seedSettings(admin.id);
  await seedLeads(comercial.id, admin.id, project1Id);
  await seedGoals(admin.id);
  await seedFinanceAndStock(admin.id, project1Id, project2Id, project3Id);
  await seedInstallationSchedules({ adminId: admin.id, project1Id, project2Id, project4Id });

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

  console.log("Seed completado (idempotente: upsert por claves únicas, sin borrar datos existentes).");
}

run()
  .catch((error) => {
    console.error("Error ejecutando seed", error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

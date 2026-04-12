import "dotenv/config";

import bcrypt from "bcryptjs";
import {
  AuditAction,
  AuditEntityType,
  NotificationType,
  Prisma,
  PrismaClient,
  ProjectStatus,
  StageName,
  StageStatus,
  SubstageStatus,
  TaskPriority,
  TaskStatus,
} from "@prisma/client";

const prisma = new PrismaClient();

type SeedUser = {
  id: string;
  email: string;
  name: string;
};

type SubstageTemplate = {
  name: string;
  responsible: string;
};

type StageTemplate = {
  name: StageName;
  substages: SubstageTemplate[];
};

type ProjectSeedConfig = {
  code: string;
  clientName: string;
  capacityKwp: number;
  locationCity: string;
  locationProvince: string;
  status: ProjectStatus;
  startDate: string;
  plannedEndDate: string;
  actualEndDate?: string;
  budgetUsd: number;
  executedUsd: number;
  estimatedMwhYear: number;
  notificationEmail: string;
  notificationPhone: string;
  stagePlans: Array<{
    name: StageName;
    status: StageStatus;
    progressPercent: number;
    plannedStartDate: string;
    plannedEndDate: string;
    actualStartDate?: string;
    actualEndDate?: string;
    notes?: string;
    substages: Array<{
      name: string;
      responsible: string;
      userEmail?: string;
      status: SubstageStatus;
      dueDate?: string;
      plannedStartDate?: string;
      plannedEndDate?: string;
      actualStartDate?: string;
      actualEndDate?: string;
      notes?: string;
    }>;
  }>;
  tasks: Array<{
    title: string;
    description: string;
    status: TaskStatus;
    priority: TaskPriority;
    responsible: string;
    userEmail?: string;
    stageName?: StageName;
    substageName?: string;
    dueDate?: string;
    completedAt?: string;
  }>;
  files: Array<{
    filename: string;
    storedFilename: string;
    mimeType: string;
    sizeBytes: number;
    url: string;
    uploadedByEmail: string;
    stageName?: StageName;
    substageName?: string;
    createdAt: string;
  }>;
  notifications: Array<{
    type: NotificationType;
    title: string;
    message: string;
    userEmail?: string;
    read?: boolean;
    sentEmail?: boolean;
    sentWhatsapp?: boolean;
    createdAt: string;
  }>;
  auditTrail: Array<{
    entityType: AuditEntityType;
    action: AuditAction;
    entityRef: string;
    userEmail: string;
    description: string;
    timestamp: string;
    fieldChanged?: string;
    oldValue?: string;
    newValue?: string;
    metadata?: Prisma.JsonObject;
  }>;
};

const stageTemplates: StageTemplate[] = [
  {
    name: StageName.PREVENTA,
    substages: [
      { name: "Relevamiento inicial", responsible: "Comercial" },
      { name: "Propuesta técnico-económica", responsible: "Ingeniería Comercial" },
      { name: "Cierre contractual", responsible: "Dirección" },
    ],
  },
  {
    name: StageName.INGENIERIA,
    substages: [
      { name: "Ingeniería de detalle", responsible: "Ingeniería" },
      { name: "Planos y memorias", responsible: "Ingeniería" },
      { name: "Aprobación interna", responsible: "PM" },
    ],
  },
  {
    name: StageName.COMPRAS,
    substages: [
      { name: "Solicitud de cotizaciones", responsible: "Compras" },
      { name: "Ordenes de compra", responsible: "Compras" },
      { name: "Recepción de materiales", responsible: "Depósito" },
    ],
  },
  {
    name: StageName.INSTALACION,
    substages: [
      { name: "Montaje de estructuras", responsible: "Jefe de Obra" },
      { name: "Tendido eléctrico", responsible: "Equipo eléctrico" },
      { name: "Puesta en marcha interna", responsible: "Puesta en marcha" },
    ],
  },
  {
    name: StageName.HABILITACION,
    substages: [
      { name: "Documentación para distribuidora", responsible: "Regulatorio" },
      { name: "Inspección externa", responsible: "PM" },
      { name: "Energización comercial", responsible: "Operaciones" },
    ],
  },
  {
    name: StageName.POSTVENTA,
    substages: [
      { name: "Capacitación al cliente", responsible: "Postventa" },
      { name: "Entrega de dossier final", responsible: "PM" },
      { name: "Seguimiento 30 días", responsible: "Postventa" },
    ],
  },
];

function dateOnly(value: string | undefined) {
  return value ? new Date(`${value}T00:00:00.000Z`) : null;
}

function dateTime(value: string | undefined) {
  return value ? new Date(value) : null;
}

function daysBetween(start?: string, end?: string) {
  if (!start || !end) {
    return null;
  }

  const msPerDay = 1000 * 60 * 60 * 24;
  const difference = dateOnly(end)!.getTime() - dateOnly(start)!.getTime();
  return Math.round(difference / msPerDay);
}

function buildDefaultSubstages(name: StageName) {
  return stageTemplates.find((template) => template.name === name)?.substages ?? [];
}

const projects: ProjectSeedConfig[] = [
  {
    code: "PRY-2025-004",
    clientName: "Agroindustrial Sur S.A.",
    capacityKwp: 250,
    locationCity: "San Justo",
    locationProvince: "Córdoba",
    status: ProjectStatus.ACTIVE,
    startDate: "2025-01-13",
    plannedEndDate: "2025-05-30",
    budgetUsd: 214500,
    executedUsd: 161200,
    estimatedMwhYear: 412.5,
    notificationEmail: "energia@agroindustrialsur.com.ar",
    notificationPhone: "+5493515551104",
    stagePlans: [
      {
        name: StageName.PREVENTA,
        status: StageStatus.COMPLETED,
        progressPercent: 100,
        plannedStartDate: "2025-01-13",
        plannedEndDate: "2025-01-24",
        actualStartDate: "2025-01-13",
        actualEndDate: "2025-01-23",
        notes: "Contrato firmado con alcance EPC completo.",
        substages: buildDefaultSubstages(StageName.PREVENTA).map((substage, index) => ({
          ...substage,
          status: SubstageStatus.COMPLETED,
          userEmail: index === 2 ? "admin@solarispm.com" : "pm@solarispm.com",
          plannedStartDate: ["2025-01-13", "2025-01-16", "2025-01-20"][index],
          plannedEndDate: ["2025-01-15", "2025-01-19", "2025-01-24"][index],
          actualStartDate: ["2025-01-13", "2025-01-16", "2025-01-20"][index],
          actualEndDate: ["2025-01-15", "2025-01-19", "2025-01-23"][index],
          dueDate: ["2025-01-15", "2025-01-19", "2025-01-24"][index],
        })),
      },
      {
        name: StageName.INGENIERIA,
        status: StageStatus.COMPLETED,
        progressPercent: 100,
        plannedStartDate: "2025-01-27",
        plannedEndDate: "2025-02-14",
        actualStartDate: "2025-01-27",
        actualEndDate: "2025-02-15",
        notes: "Incluye planos estructurales y eléctricos IFC.",
        substages: buildDefaultSubstages(StageName.INGENIERIA).map((substage) => ({
          ...substage,
          status: SubstageStatus.COMPLETED,
          userEmail: "pm@solarispm.com",
          plannedStartDate: "2025-01-27",
          plannedEndDate: "2025-02-14",
          actualStartDate: "2025-01-27",
          actualEndDate: "2025-02-15",
          dueDate: "2025-02-14",
        })),
      },
      {
        name: StageName.COMPRAS,
        status: StageStatus.COMPLETED,
        progressPercent: 100,
        plannedStartDate: "2025-02-17",
        plannedEndDate: "2025-03-07",
        actualStartDate: "2025-02-17",
        actualEndDate: "2025-03-10",
        notes: "Hubo demora logística de 3 días en la llegada de inversores.",
        substages: [
          {
            name: "Solicitud de cotizaciones",
            responsible: "Compras",
            userEmail: "pm@solarispm.com",
            status: SubstageStatus.COMPLETED,
            dueDate: "2025-02-20",
            plannedStartDate: "2025-02-17",
            plannedEndDate: "2025-02-20",
            actualStartDate: "2025-02-17",
            actualEndDate: "2025-02-20",
          },
          {
            name: "Ordenes de compra",
            responsible: "Compras",
            userEmail: "admin@solarispm.com",
            status: SubstageStatus.COMPLETED,
            dueDate: "2025-02-26",
            plannedStartDate: "2025-02-21",
            plannedEndDate: "2025-02-26",
            actualStartDate: "2025-02-21",
            actualEndDate: "2025-02-27",
          },
          {
            name: "Recepción de materiales",
            responsible: "Depósito",
            status: SubstageStatus.COMPLETED,
            dueDate: "2025-03-07",
            plannedStartDate: "2025-02-27",
            plannedEndDate: "2025-03-07",
            actualStartDate: "2025-02-27",
            actualEndDate: "2025-03-10",
            notes: "Demora por transporte de módulos desde Rosario.",
          },
        ],
      },
      {
        name: StageName.INSTALACION,
        status: StageStatus.IN_PROGRESS,
        progressPercent: 72,
        plannedStartDate: "2025-03-11",
        plannedEndDate: "2025-04-18",
        actualStartDate: "2025-03-12",
        notes: "Frente civil liberado y tableros casi finalizados.",
        substages: [
          {
            name: "Montaje de estructuras",
            responsible: "Jefe de Obra",
            userEmail: "pm@solarispm.com",
            status: SubstageStatus.COMPLETED,
            dueDate: "2025-03-25",
            plannedStartDate: "2025-03-11",
            plannedEndDate: "2025-03-25",
            actualStartDate: "2025-03-12",
            actualEndDate: "2025-03-26",
          },
          {
            name: "Tendido eléctrico",
            responsible: "Equipo eléctrico",
            userEmail: "pm@solarispm.com",
            status: SubstageStatus.IN_PROGRESS,
            dueDate: "2025-04-12",
            plannedStartDate: "2025-03-26",
            plannedEndDate: "2025-04-12",
            actualStartDate: "2025-03-27",
            notes: "Restan conexiones de strings en nave 2.",
          },
          {
            name: "Puesta en marcha interna",
            responsible: "Puesta en marcha",
            status: SubstageStatus.PENDING,
            dueDate: "2025-04-18",
            plannedStartDate: "2025-04-13",
            plannedEndDate: "2025-04-18",
          },
        ],
      },
      {
        name: StageName.HABILITACION,
        status: StageStatus.PENDING,
        progressPercent: 0,
        plannedStartDate: "2025-04-21",
        plannedEndDate: "2025-05-09",
        substages: buildDefaultSubstages(StageName.HABILITACION).map((substage) => ({
          ...substage,
          status: SubstageStatus.PENDING,
          dueDate: "2025-05-09",
          plannedStartDate: "2025-04-21",
          plannedEndDate: "2025-05-09",
        })),
      },
      {
        name: StageName.POSTVENTA,
        status: StageStatus.PENDING,
        progressPercent: 0,
        plannedStartDate: "2025-05-12",
        plannedEndDate: "2025-05-30",
        substages: buildDefaultSubstages(StageName.POSTVENTA).map((substage) => ({
          ...substage,
          status: SubstageStatus.PENDING,
          dueDate: "2025-05-30",
          plannedStartDate: "2025-05-12",
          plannedEndDate: "2025-05-30",
        })),
      },
    ],
    tasks: [
      {
        title: "Validar stock final de bandejas portacables",
        description: "Confirmar stock disponible antes del cierre de tendido eléctrico.",
        status: TaskStatus.IN_PROGRESS,
        priority: TaskPriority.URGENT,
        responsible: "Lucía Mena",
        userEmail: "pm@solarispm.com",
        stageName: StageName.INSTALACION,
        substageName: "Tendido eléctrico",
        dueDate: "2025-04-09",
      },
      {
        title: "Coordinar ventana de corte con mantenimiento del cliente",
        description: "Necesario para pruebas de protecciones y arranque interno.",
        status: TaskStatus.PENDING,
        priority: TaskPriority.NORMAL,
        responsible: "Javier Ruiz",
        stageName: StageName.INSTALACION,
        substageName: "Puesta en marcha interna",
        dueDate: "2025-04-14",
      },
      {
        title: "Actualizar forecast de costo ejecutado",
        description: "Revisar impacto de demora en compras e instalación.",
        status: TaskStatus.COMPLETED,
        priority: TaskPriority.NORMAL,
        responsible: "Nicolás Varela",
        userEmail: "admin@solarispm.com",
        stageName: StageName.COMPRAS,
        dueDate: "2025-03-12",
        completedAt: "2025-03-11T17:45:00.000Z",
      },
    ],
    files: [
      {
        filename: "layout-cubierta-v3.pdf",
        storedFilename: "6ad3f9ac-4b0c-4d46-9887-layout-cubierta-v3.pdf",
        mimeType: "application/pdf",
        sizeBytes: 2841190,
        url: "/projects/PRY-2025-004/layout-cubierta-v3.pdf",
        uploadedByEmail: "pm@solarispm.com",
        stageName: StageName.INGENIERIA,
        createdAt: "2025-02-10T14:20:00.000Z",
      },
      {
        filename: "acta-recepcion-inversores.pdf",
        storedFilename: "bcb70525-b0ad-4fc3-a789-acta-recepcion-inversores.pdf",
        mimeType: "application/pdf",
        sizeBytes: 820144,
        url: "/projects/PRY-2025-004/acta-recepcion-inversores.pdf",
        uploadedByEmail: "admin@solarispm.com",
        stageName: StageName.COMPRAS,
        substageName: "Recepción de materiales",
        createdAt: "2025-03-10T10:05:00.000Z",
      },
    ],
    notifications: [
      {
        type: NotificationType.task_due,
        title: "Tarea vencida en Instalación",
        message: "La validación de stock de bandejas portacables venció y sigue en curso.",
        userEmail: "pm@solarispm.com",
        sentEmail: true,
        createdAt: "2025-04-10T08:00:00.000Z",
      },
      {
        type: NotificationType.stage_overdue,
        title: "Compras cerró con desvío",
        message: "La etapa Compras finalizó con 3 días de retraso respecto al plan.",
        userEmail: "admin@solarispm.com",
        read: true,
        sentEmail: true,
        sentWhatsapp: true,
        createdAt: "2025-03-10T18:30:00.000Z",
      },
    ],
    auditTrail: [
      {
        entityType: AuditEntityType.project,
        action: AuditAction.created,
        entityRef: "project",
        userEmail: "admin@solarispm.com",
        description: "Creó el proyecto Agroindustrial Sur S.A. con código PRY-2025-004",
        timestamp: "2025-01-13T09:15:00.000Z",
      },
      {
        entityType: AuditEntityType.stage,
        action: AuditAction.created,
        entityRef: "PREVENTA",
        userEmail: "admin@solarispm.com",
        description: "Se generaron automáticamente las 6 etapas base del proyecto",
        timestamp: "2025-01-13T09:16:00.000Z",
        metadata: { generatedStages: 6 },
      },
      {
        entityType: AuditEntityType.stage,
        action: AuditAction.status_changed,
        entityRef: "PREVENTA",
        userEmail: "pm@solarispm.com",
        description: "Cambió estado de Preventa de PENDING a IN_PROGRESS",
        timestamp: "2025-01-13T09:20:00.000Z",
        fieldChanged: "status",
        oldValue: "PENDING",
        newValue: "IN_PROGRESS",
      },
      {
        entityType: AuditEntityType.stage,
        action: AuditAction.stage_advanced,
        entityRef: "PREVENTA",
        userEmail: "pm@solarispm.com",
        description: "Completó la etapa Preventa y habilitó Ingeniería",
        timestamp: "2025-01-23T17:30:00.000Z",
      },
      {
        entityType: AuditEntityType.file,
        action: AuditAction.file_uploaded,
        entityRef: "layout-cubierta-v3.pdf",
        userEmail: "pm@solarispm.com",
        description: "Adjuntó layout-cubierta-v3.pdf a Ingeniería",
        timestamp: "2025-02-10T14:20:00.000Z",
      },
      {
        entityType: AuditEntityType.stage,
        action: AuditAction.status_changed,
        entityRef: "COMPRAS",
        userEmail: "admin@solarispm.com",
        description: "Cambió estado de Compras de IN_PROGRESS a COMPLETED",
        timestamp: "2025-03-10T18:10:00.000Z",
        fieldChanged: "status",
        oldValue: "IN_PROGRESS",
        newValue: "COMPLETED",
      },
      {
        entityType: AuditEntityType.stage,
        action: AuditAction.updated,
        entityRef: "COMPRAS",
        userEmail: "admin@solarispm.com",
        description: "Actualizó delayDays de Compras de 0 a 3",
        timestamp: "2025-03-10T18:12:00.000Z",
        fieldChanged: "delayDays",
        oldValue: "0",
        newValue: "3",
      },
      {
        entityType: AuditEntityType.project,
        action: AuditAction.updated,
        entityRef: "project",
        userEmail: "admin@solarispm.com",
        description: "Actualizó executedUsd del proyecto de 138500.00 a 161200.00",
        timestamp: "2025-03-11T17:45:00.000Z",
        fieldChanged: "executedUsd",
        oldValue: "138500.00",
        newValue: "161200.00",
      },
      {
        entityType: AuditEntityType.stage,
        action: AuditAction.status_changed,
        entityRef: "INSTALACION",
        userEmail: "pm@solarispm.com",
        description: "Cambió estado de Instalación de PENDING a IN_PROGRESS",
        timestamp: "2025-03-12T08:00:00.000Z",
        fieldChanged: "status",
        oldValue: "PENDING",
        newValue: "IN_PROGRESS",
      },
      {
        entityType: AuditEntityType.task,
        action: AuditAction.created,
        entityRef: "Validar stock final de bandejas portacables",
        userEmail: "pm@solarispm.com",
        description: "Creó tarea urgente para validar stock final de bandejas portacables",
        timestamp: "2025-04-07T11:10:00.000Z",
      },
      {
        entityType: AuditEntityType.project,
        action: AuditAction.alert_triggered,
        entityRef: "project",
        userEmail: "admin@solarispm.com",
        description: "Se disparó alerta por tarea vencida en la etapa Instalación",
        timestamp: "2025-04-10T08:00:00.000Z",
        metadata: { notificationType: "task_due" },
      },
    ],
  },
  {
    code: "PRY-2025-002",
    clientName: "Frigorífico Norte S.R.L.",
    capacityKwp: 180,
    locationCity: "Reconquista",
    locationProvince: "Santa Fe",
    status: ProjectStatus.ACTIVE,
    startDate: "2024-11-18",
    plannedEndDate: "2025-03-28",
    budgetUsd: 158000,
    executedUsd: 149300,
    estimatedMwhYear: 301.4,
    notificationEmail: "mantenimiento@frigorificonorte.com.ar",
    notificationPhone: "+5493482559012",
    stagePlans: [
      {
        name: StageName.PREVENTA,
        status: StageStatus.COMPLETED,
        progressPercent: 100,
        plannedStartDate: "2024-11-18",
        plannedEndDate: "2024-11-29",
        actualStartDate: "2024-11-18",
        actualEndDate: "2024-11-29",
        substages: buildDefaultSubstages(StageName.PREVENTA).map((substage) => ({
          ...substage,
          status: SubstageStatus.COMPLETED,
          userEmail: "admin@solarispm.com",
          dueDate: "2024-11-29",
          plannedStartDate: "2024-11-18",
          plannedEndDate: "2024-11-29",
          actualStartDate: "2024-11-18",
          actualEndDate: "2024-11-29",
        })),
      },
      {
        name: StageName.INGENIERIA,
        status: StageStatus.COMPLETED,
        progressPercent: 100,
        plannedStartDate: "2024-12-02",
        plannedEndDate: "2024-12-20",
        actualStartDate: "2024-12-02",
        actualEndDate: "2024-12-19",
        substages: buildDefaultSubstages(StageName.INGENIERIA).map((substage) => ({
          ...substage,
          status: SubstageStatus.COMPLETED,
          userEmail: "pm@solarispm.com",
          dueDate: "2024-12-20",
          plannedStartDate: "2024-12-02",
          plannedEndDate: "2024-12-20",
          actualStartDate: "2024-12-02",
          actualEndDate: "2024-12-19",
        })),
      },
      {
        name: StageName.COMPRAS,
        status: StageStatus.COMPLETED,
        progressPercent: 100,
        plannedStartDate: "2024-12-23",
        plannedEndDate: "2025-01-17",
        actualStartDate: "2024-12-23",
        actualEndDate: "2025-01-17",
        substages: buildDefaultSubstages(StageName.COMPRAS).map((substage) => ({
          ...substage,
          status: SubstageStatus.COMPLETED,
          userEmail: "admin@solarispm.com",
          dueDate: "2025-01-17",
          plannedStartDate: "2024-12-23",
          plannedEndDate: "2025-01-17",
          actualStartDate: "2024-12-23",
          actualEndDate: "2025-01-17",
        })),
      },
      {
        name: StageName.INSTALACION,
        status: StageStatus.COMPLETED,
        progressPercent: 100,
        plannedStartDate: "2025-01-20",
        plannedEndDate: "2025-02-28",
        actualStartDate: "2025-01-21",
        actualEndDate: "2025-02-26",
        notes: "Cierre de obra civil antes de lo previsto.",
        substages: buildDefaultSubstages(StageName.INSTALACION).map((substage, index) => ({
          ...substage,
          status: SubstageStatus.COMPLETED,
          userEmail: index === 0 ? "pm@solarispm.com" : undefined,
          dueDate: "2025-02-28",
          plannedStartDate: "2025-01-20",
          plannedEndDate: "2025-02-28",
          actualStartDate: "2025-01-21",
          actualEndDate: "2025-02-26",
        })),
      },
      {
        name: StageName.HABILITACION,
        status: StageStatus.IN_PROGRESS,
        progressPercent: 28,
        plannedStartDate: "2025-03-03",
        plannedEndDate: "2025-03-21",
        actualStartDate: "2025-03-03",
        notes: "Inspección técnica programada para la próxima semana.",
        substages: [
          {
            name: "Documentación para distribuidora",
            responsible: "Regulatorio",
            userEmail: "pm@solarispm.com",
            status: SubstageStatus.COMPLETED,
            dueDate: "2025-03-07",
            plannedStartDate: "2025-03-03",
            plannedEndDate: "2025-03-07",
            actualStartDate: "2025-03-03",
            actualEndDate: "2025-03-06",
          },
          {
            name: "Inspección externa",
            responsible: "PM",
            userEmail: "admin@solarispm.com",
            status: SubstageStatus.IN_PROGRESS,
            dueDate: "2025-03-14",
            plannedStartDate: "2025-03-10",
            plannedEndDate: "2025-03-14",
            actualStartDate: "2025-03-10",
          },
          {
            name: "Energización comercial",
            responsible: "Operaciones",
            status: SubstageStatus.PENDING,
            dueDate: "2025-03-21",
            plannedStartDate: "2025-03-17",
            plannedEndDate: "2025-03-21",
          },
        ],
      },
      {
        name: StageName.POSTVENTA,
        status: StageStatus.PENDING,
        progressPercent: 0,
        plannedStartDate: "2025-03-24",
        plannedEndDate: "2025-03-28",
        substages: buildDefaultSubstages(StageName.POSTVENTA).map((substage) => ({
          ...substage,
          status: SubstageStatus.PENDING,
          dueDate: "2025-03-28",
          plannedStartDate: "2025-03-24",
          plannedEndDate: "2025-03-28",
        })),
      },
    ],
    tasks: [
      {
        title: "Confirmar fecha de inspección con EPE",
        description: "Llamar al inspector asignado y cerrar franja horaria.",
        status: TaskStatus.IN_PROGRESS,
        priority: TaskPriority.URGENT,
        responsible: "Marina Páez",
        userEmail: "pm@solarispm.com",
        stageName: StageName.HABILITACION,
        substageName: "Inspección externa",
        dueDate: "2025-03-12",
      },
      {
        title: "Preparar carpeta de manuales para entrega",
        description: "Compilar manuales de inversores, planos as-built y garantías.",
        status: TaskStatus.PENDING,
        priority: TaskPriority.NORMAL,
        responsible: "Tomás Giraudo",
        stageName: StageName.POSTVENTA,
        dueDate: "2025-03-26",
      },
      {
        title: "Emitir acta interna de fin de instalación",
        description: "Documento interno requerido antes de pasar a habilitación.",
        status: TaskStatus.COMPLETED,
        priority: TaskPriority.NORMAL,
        responsible: "Nicolás Varela",
        userEmail: "admin@solarispm.com",
        stageName: StageName.INSTALACION,
        dueDate: "2025-02-27",
        completedAt: "2025-02-26T19:00:00.000Z",
      },
    ],
    files: [
      {
        filename: "protocolo-puesta-marcha.pdf",
        storedFilename: "bd2779df-7298-4e62-a00f-protocolo-puesta-marcha.pdf",
        mimeType: "application/pdf",
        sizeBytes: 1152033,
        url: "/projects/PRY-2025-002/protocolo-puesta-marcha.pdf",
        uploadedByEmail: "pm@solarispm.com",
        stageName: StageName.INSTALACION,
        createdAt: "2025-02-25T16:25:00.000Z",
      },
      {
        filename: "expediente-epe.zip",
        storedFilename: "8fcf0d41-dccd-45d7-bb4d-expediente-epe.zip",
        mimeType: "application/zip",
        sizeBytes: 5428930,
        url: "/projects/PRY-2025-002/expediente-epe.zip",
        uploadedByEmail: "admin@solarispm.com",
        stageName: StageName.HABILITACION,
        substageName: "Documentación para distribuidora",
        createdAt: "2025-03-06T13:40:00.000Z",
      },
    ],
    notifications: [
      {
        type: NotificationType.progress_milestone,
        title: "Proyecto por encima del 85%",
        message: "Frigorífico Norte S.R.L. superó el 85% de avance global.",
        userEmail: "admin@solarispm.com",
        read: true,
        sentEmail: true,
        createdAt: "2025-03-06T09:00:00.000Z",
      },
      {
        type: NotificationType.task_due,
        title: "Inspección externa próxima a vencer",
        message: "La coordinación de inspección con EPE vence hoy.",
        userEmail: "pm@solarispm.com",
        sentEmail: true,
        sentWhatsapp: true,
        createdAt: "2025-03-12T07:00:00.000Z",
      },
    ],
    auditTrail: [
      {
        entityType: AuditEntityType.project,
        action: AuditAction.created,
        entityRef: "project",
        userEmail: "admin@solarispm.com",
        description: "Creó el proyecto Frigorífico Norte S.R.L. con código PRY-2025-002",
        timestamp: "2024-11-18T10:00:00.000Z",
      },
      {
        entityType: AuditEntityType.stage,
        action: AuditAction.created,
        entityRef: "PREVENTA",
        userEmail: "admin@solarispm.com",
        description: "Se generaron automáticamente las etapas base del proyecto",
        timestamp: "2024-11-18T10:01:00.000Z",
      },
      {
        entityType: AuditEntityType.stage,
        action: AuditAction.stage_advanced,
        entityRef: "PREVENTA",
        userEmail: "pm@solarispm.com",
        description: "Completó la etapa Preventa y habilitó Ingeniería",
        timestamp: "2024-11-29T18:00:00.000Z",
      },
      {
        entityType: AuditEntityType.stage,
        action: AuditAction.stage_advanced,
        entityRef: "INGENIERIA",
        userEmail: "pm@solarispm.com",
        description: "Completó la etapa Ingeniería y habilitó Compras",
        timestamp: "2024-12-19T17:20:00.000Z",
      },
      {
        entityType: AuditEntityType.stage,
        action: AuditAction.stage_advanced,
        entityRef: "COMPRAS",
        userEmail: "admin@solarispm.com",
        description: "Completó la etapa Compras y habilitó Instalación",
        timestamp: "2025-01-17T18:15:00.000Z",
      },
      {
        entityType: AuditEntityType.file,
        action: AuditAction.file_uploaded,
        entityRef: "protocolo-puesta-marcha.pdf",
        userEmail: "pm@solarispm.com",
        description: "Adjuntó protocolo-puesta-marcha.pdf a Instalación",
        timestamp: "2025-02-25T16:25:00.000Z",
      },
      {
        entityType: AuditEntityType.stage,
        action: AuditAction.status_changed,
        entityRef: "HABILITACION",
        userEmail: "pm@solarispm.com",
        description: "Cambió estado de Habilitación de PENDING a IN_PROGRESS",
        timestamp: "2025-03-03T08:30:00.000Z",
        fieldChanged: "status",
        oldValue: "PENDING",
        newValue: "IN_PROGRESS",
      },
      {
        entityType: AuditEntityType.task,
        action: AuditAction.created,
        entityRef: "Confirmar fecha de inspección con EPE",
        userEmail: "pm@solarispm.com",
        description: "Creó tarea urgente para coordinar la inspección externa",
        timestamp: "2025-03-10T09:10:00.000Z",
      },
      {
        entityType: AuditEntityType.project,
        action: AuditAction.alert_triggered,
        entityRef: "project",
        userEmail: "admin@solarispm.com",
        description: "Se disparó alerta por milestone de avance global superior al 85%",
        timestamp: "2025-03-06T09:00:00.000Z",
        metadata: { notificationType: "progress_milestone" },
      },
      {
        entityType: AuditEntityType.file,
        action: AuditAction.file_uploaded,
        entityRef: "expediente-epe.zip",
        userEmail: "admin@solarispm.com",
        description: "Subió expediente-epe.zip para documentación ante distribuidora",
        timestamp: "2025-03-06T13:40:00.000Z",
      },
      {
        entityType: AuditEntityType.project,
        action: AuditAction.updated,
        entityRef: "project",
        userEmail: "admin@solarispm.com",
        description: "Actualizó executedUsd del proyecto de 141800.00 a 149300.00",
        timestamp: "2025-03-08T15:00:00.000Z",
        fieldChanged: "executedUsd",
        oldValue: "141800.00",
        newValue: "149300.00",
      },
    ],
  },
  {
    code: "PRY-2025-006",
    clientName: "Clínica del Valle",
    capacityKwp: 60,
    locationCity: "Mendoza Capital",
    locationProvince: "Mendoza",
    status: ProjectStatus.ACTIVE,
    startDate: "2025-04-01",
    plannedEndDate: "2025-07-18",
    budgetUsd: 61200,
    executedUsd: 4200,
    estimatedMwhYear: 96.5,
    notificationEmail: "infraestructura@clinicadelvalle.com",
    notificationPhone: "+5492615564033",
    stagePlans: [
      {
        name: StageName.PREVENTA,
        status: StageStatus.IN_PROGRESS,
        progressPercent: 15,
        plannedStartDate: "2025-04-01",
        plannedEndDate: "2025-04-18",
        actualStartDate: "2025-04-01",
        notes: "Cliente solicitó alternativa con respaldo parcial de cargas críticas.",
        substages: [
          {
            name: "Relevamiento inicial",
            responsible: "Comercial",
            userEmail: "pm@solarispm.com",
            status: SubstageStatus.COMPLETED,
            dueDate: "2025-04-04",
            plannedStartDate: "2025-04-01",
            plannedEndDate: "2025-04-04",
            actualStartDate: "2025-04-01",
            actualEndDate: "2025-04-03",
          },
          {
            name: "Propuesta técnico-económica",
            responsible: "Ingeniería Comercial",
            userEmail: "admin@solarispm.com",
            status: SubstageStatus.IN_PROGRESS,
            dueDate: "2025-04-11",
            plannedStartDate: "2025-04-05",
            plannedEndDate: "2025-04-11",
            actualStartDate: "2025-04-05",
            notes: "Se evalúa integración con grupo electrógeno existente.",
          },
          {
            name: "Cierre contractual",
            responsible: "Dirección",
            status: SubstageStatus.PENDING,
            dueDate: "2025-04-18",
            plannedStartDate: "2025-04-14",
            plannedEndDate: "2025-04-18",
          },
        ],
      },
      {
        name: StageName.INGENIERIA,
        status: StageStatus.PENDING,
        progressPercent: 0,
        plannedStartDate: "2025-04-21",
        plannedEndDate: "2025-05-09",
        substages: buildDefaultSubstages(StageName.INGENIERIA).map((substage) => ({
          ...substage,
          status: SubstageStatus.PENDING,
          dueDate: "2025-05-09",
          plannedStartDate: "2025-04-21",
          plannedEndDate: "2025-05-09",
        })),
      },
      {
        name: StageName.COMPRAS,
        status: StageStatus.PENDING,
        progressPercent: 0,
        plannedStartDate: "2025-05-12",
        plannedEndDate: "2025-05-30",
        substages: buildDefaultSubstages(StageName.COMPRAS).map((substage) => ({
          ...substage,
          status: SubstageStatus.PENDING,
          dueDate: "2025-05-30",
          plannedStartDate: "2025-05-12",
          plannedEndDate: "2025-05-30",
        })),
      },
      {
        name: StageName.INSTALACION,
        status: StageStatus.PENDING,
        progressPercent: 0,
        plannedStartDate: "2025-06-02",
        plannedEndDate: "2025-06-27",
        substages: buildDefaultSubstages(StageName.INSTALACION).map((substage) => ({
          ...substage,
          status: SubstageStatus.PENDING,
          dueDate: "2025-06-27",
          plannedStartDate: "2025-06-02",
          plannedEndDate: "2025-06-27",
        })),
      },
      {
        name: StageName.HABILITACION,
        status: StageStatus.PENDING,
        progressPercent: 0,
        plannedStartDate: "2025-06-30",
        plannedEndDate: "2025-07-11",
        substages: buildDefaultSubstages(StageName.HABILITACION).map((substage) => ({
          ...substage,
          status: SubstageStatus.PENDING,
          dueDate: "2025-07-11",
          plannedStartDate: "2025-06-30",
          plannedEndDate: "2025-07-11",
        })),
      },
      {
        name: StageName.POSTVENTA,
        status: StageStatus.PENDING,
        progressPercent: 0,
        plannedStartDate: "2025-07-14",
        plannedEndDate: "2025-07-18",
        substages: buildDefaultSubstages(StageName.POSTVENTA).map((substage) => ({
          ...substage,
          status: SubstageStatus.PENDING,
          dueDate: "2025-07-18",
          plannedStartDate: "2025-07-14",
          plannedEndDate: "2025-07-18",
        })),
      },
    ],
    tasks: [
      {
        title: "Cerrar medición de cargas críticas",
        description: "Completar cuadro de cargas para evaluar respaldo parcial de emergencia.",
        status: TaskStatus.IN_PROGRESS,
        priority: TaskPriority.URGENT,
        responsible: "Marina Páez",
        userEmail: "pm@solarispm.com",
        stageName: StageName.PREVENTA,
        substageName: "Propuesta técnico-económica",
        dueDate: "2025-04-10",
      },
      {
        title: "Enviar minuta comercial al directorio",
        description: "Resumen ejecutivo con TIR estimada y plazos preliminares.",
        status: TaskStatus.PENDING,
        priority: TaskPriority.NORMAL,
        responsible: "Nicolás Varela",
        userEmail: "admin@solarispm.com",
        stageName: StageName.PREVENTA,
        dueDate: "2025-04-15",
      },
    ],
    files: [
      {
        filename: "consumos-historicos-clinica.xlsx",
        storedFilename: "a79bcddb-9941-46ff-aac8-consumos-historicos-clinica.xlsx",
        mimeType: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        sizeBytes: 142202,
        url: "/projects/PRY-2025-006/consumos-historicos-clinica.xlsx",
        uploadedByEmail: "pm@solarispm.com",
        stageName: StageName.PREVENTA,
        substageName: "Relevamiento inicial",
        createdAt: "2025-04-03T12:12:00.000Z",
      },
    ],
    notifications: [
      {
        type: NotificationType.task_due,
        title: "Tarea vencida en Preventa",
        message: "La medición de cargas críticas está vencida y sigue en curso.",
        userEmail: "pm@solarispm.com",
        sentEmail: true,
        createdAt: "2025-04-11T07:30:00.000Z",
      },
      {
        type: NotificationType.stage_changed,
        title: "Preventa iniciada",
        message: "Clínica del Valle comenzó la etapa de Preventa.",
        userEmail: "admin@solarispm.com",
        read: true,
        createdAt: "2025-04-01T09:00:00.000Z",
      },
    ],
    auditTrail: [
      {
        entityType: AuditEntityType.project,
        action: AuditAction.created,
        entityRef: "project",
        userEmail: "admin@solarispm.com",
        description: "Creó el proyecto Clínica del Valle con código PRY-2025-006",
        timestamp: "2025-04-01T08:45:00.000Z",
      },
      {
        entityType: AuditEntityType.stage,
        action: AuditAction.created,
        entityRef: "PREVENTA",
        userEmail: "admin@solarispm.com",
        description: "Se generaron automáticamente las etapas base del proyecto",
        timestamp: "2025-04-01T08:46:00.000Z",
      },
      {
        entityType: AuditEntityType.stage,
        action: AuditAction.status_changed,
        entityRef: "PREVENTA",
        userEmail: "pm@solarispm.com",
        description: "Cambió estado de Preventa de PENDING a IN_PROGRESS",
        timestamp: "2025-04-01T09:00:00.000Z",
        fieldChanged: "status",
        oldValue: "PENDING",
        newValue: "IN_PROGRESS",
      },
      {
        entityType: AuditEntityType.substage,
        action: AuditAction.status_changed,
        entityRef: "Relevamiento inicial",
        userEmail: "pm@solarispm.com",
        description: "Completó la subetapa Relevamiento inicial",
        timestamp: "2025-04-03T17:10:00.000Z",
        fieldChanged: "status",
        oldValue: "IN_PROGRESS",
        newValue: "COMPLETED",
      },
      {
        entityType: AuditEntityType.file,
        action: AuditAction.file_uploaded,
        entityRef: "consumos-historicos-clinica.xlsx",
        userEmail: "pm@solarispm.com",
        description: "Adjuntó consumos-historicos-clinica.xlsx al relevamiento inicial",
        timestamp: "2025-04-03T12:12:00.000Z",
      },
      {
        entityType: AuditEntityType.task,
        action: AuditAction.created,
        entityRef: "Cerrar medición de cargas críticas",
        userEmail: "pm@solarispm.com",
        description: "Creó tarea urgente para cerrar medición de cargas críticas",
        timestamp: "2025-04-05T10:15:00.000Z",
      },
      {
        entityType: AuditEntityType.project,
        action: AuditAction.updated,
        entityRef: "project",
        userEmail: "admin@solarispm.com",
        description: "Actualizó executedUsd del proyecto de 0.00 a 4200.00",
        timestamp: "2025-04-05T18:20:00.000Z",
        fieldChanged: "executedUsd",
        oldValue: "0.00",
        newValue: "4200.00",
      },
      {
        entityType: AuditEntityType.project,
        action: AuditAction.updated,
        entityRef: "project",
        userEmail: "admin@solarispm.com",
        description: "Actualizó alcance comercial para considerar respaldo parcial de cargas críticas",
        timestamp: "2025-04-07T11:00:00.000Z",
        fieldChanged: "scope",
        oldValue: "Fotovoltaico on-grid",
        newValue: "Fotovoltaico on-grid + cargas críticas",
      },
      {
        entityType: AuditEntityType.project,
        action: AuditAction.alert_triggered,
        entityRef: "project",
        userEmail: "admin@solarispm.com",
        description: "Se disparó alerta por tarea vencida en Preventa",
        timestamp: "2025-04-11T07:30:00.000Z",
        metadata: { notificationType: "task_due" },
      },
      {
        entityType: AuditEntityType.substage,
        action: AuditAction.updated,
        entityRef: "Propuesta técnico-económica",
        userEmail: "admin@solarispm.com",
        description: "Actualizó notas de la subetapa Propuesta técnico-económica",
        timestamp: "2025-04-09T14:00:00.000Z",
        fieldChanged: "notes",
        oldValue: "Análisis preliminar",
        newValue: "Se evalúa integración con grupo electrógeno existente.",
      },
    ],
  },
  {
    code: "PRY-2025-005",
    clientName: "Bodega La Cuesta",
    capacityKwp: 120,
    locationCity: "Luján de Cuyo",
    locationProvince: "Mendoza",
    status: ProjectStatus.COMPLETED,
    startDate: "2024-07-08",
    plannedEndDate: "2024-11-15",
    actualEndDate: "2024-11-12",
    budgetUsd: 101500,
    executedUsd: 99850,
    estimatedMwhYear: 196.2,
    notificationEmail: "operaciones@bodegalacuesta.com",
    notificationPhone: "+5492615587721",
    stagePlans: [
      {
        name: StageName.PREVENTA,
        status: StageStatus.COMPLETED,
        progressPercent: 100,
        plannedStartDate: "2024-07-08",
        plannedEndDate: "2024-07-19",
        actualStartDate: "2024-07-08",
        actualEndDate: "2024-07-18",
        substages: buildDefaultSubstages(StageName.PREVENTA).map((substage, index) => ({
          ...substage,
          status: SubstageStatus.COMPLETED,
          userEmail: index === 0 ? "pm@solarispm.com" : "admin@solarispm.com",
          dueDate: "2024-07-19",
          plannedStartDate: "2024-07-08",
          plannedEndDate: "2024-07-19",
          actualStartDate: "2024-07-08",
          actualEndDate: "2024-07-18",
        })),
      },
      {
        name: StageName.INGENIERIA,
        status: StageStatus.COMPLETED,
        progressPercent: 100,
        plannedStartDate: "2024-07-22",
        plannedEndDate: "2024-08-09",
        actualStartDate: "2024-07-22",
        actualEndDate: "2024-08-08",
        substages: buildDefaultSubstages(StageName.INGENIERIA).map((substage) => ({
          ...substage,
          status: SubstageStatus.COMPLETED,
          userEmail: "pm@solarispm.com",
          dueDate: "2024-08-09",
          plannedStartDate: "2024-07-22",
          plannedEndDate: "2024-08-09",
          actualStartDate: "2024-07-22",
          actualEndDate: "2024-08-08",
        })),
      },
      {
        name: StageName.COMPRAS,
        status: StageStatus.COMPLETED,
        progressPercent: 100,
        plannedStartDate: "2024-08-12",
        plannedEndDate: "2024-08-30",
        actualStartDate: "2024-08-12",
        actualEndDate: "2024-08-29",
        substages: buildDefaultSubstages(StageName.COMPRAS).map((substage) => ({
          ...substage,
          status: SubstageStatus.COMPLETED,
          userEmail: "admin@solarispm.com",
          dueDate: "2024-08-30",
          plannedStartDate: "2024-08-12",
          plannedEndDate: "2024-08-30",
          actualStartDate: "2024-08-12",
          actualEndDate: "2024-08-29",
        })),
      },
      {
        name: StageName.INSTALACION,
        status: StageStatus.COMPLETED,
        progressPercent: 100,
        plannedStartDate: "2024-09-02",
        plannedEndDate: "2024-10-04",
        actualStartDate: "2024-09-02",
        actualEndDate: "2024-10-02",
        substages: buildDefaultSubstages(StageName.INSTALACION).map((substage) => ({
          ...substage,
          status: SubstageStatus.COMPLETED,
          userEmail: "pm@solarispm.com",
          dueDate: "2024-10-04",
          plannedStartDate: "2024-09-02",
          plannedEndDate: "2024-10-04",
          actualStartDate: "2024-09-02",
          actualEndDate: "2024-10-02",
        })),
      },
      {
        name: StageName.HABILITACION,
        status: StageStatus.COMPLETED,
        progressPercent: 100,
        plannedStartDate: "2024-10-07",
        plannedEndDate: "2024-10-31",
        actualStartDate: "2024-10-07",
        actualEndDate: "2024-10-29",
        substages: buildDefaultSubstages(StageName.HABILITACION).map((substage, index) => ({
          ...substage,
          status: SubstageStatus.COMPLETED,
          userEmail: index === 1 ? "admin@solarispm.com" : "pm@solarispm.com",
          dueDate: "2024-10-31",
          plannedStartDate: "2024-10-07",
          plannedEndDate: "2024-10-31",
          actualStartDate: "2024-10-07",
          actualEndDate: "2024-10-29",
        })),
      },
      {
        name: StageName.POSTVENTA,
        status: StageStatus.COMPLETED,
        progressPercent: 100,
        plannedStartDate: "2024-11-01",
        plannedEndDate: "2024-11-15",
        actualStartDate: "2024-11-01",
        actualEndDate: "2024-11-12",
        notes: "Entrega final y seguimiento inicial completados sin desvíos.",
        substages: buildDefaultSubstages(StageName.POSTVENTA).map((substage) => ({
          ...substage,
          status: SubstageStatus.COMPLETED,
          userEmail: "pm@solarispm.com",
          dueDate: "2024-11-15",
          plannedStartDate: "2024-11-01",
          plannedEndDate: "2024-11-15",
          actualStartDate: "2024-11-01",
          actualEndDate: "2024-11-12",
        })),
      },
    ],
    tasks: [
      {
        title: "Emitir acta de recepción definitiva",
        description: "Acta firmada por cliente y dirección de proyecto.",
        status: TaskStatus.COMPLETED,
        priority: TaskPriority.NORMAL,
        responsible: "Nicolás Varela",
        userEmail: "admin@solarispm.com",
        stageName: StageName.POSTVENTA,
        dueDate: "2024-11-12",
        completedAt: "2024-11-12T18:00:00.000Z",
      },
      {
        title: "Capacitación final al personal de mantenimiento",
        description: "Capacitación de operación básica y protocolo de alarmas.",
        status: TaskStatus.COMPLETED,
        priority: TaskPriority.NORMAL,
        responsible: "Marina Páez",
        userEmail: "pm@solarispm.com",
        stageName: StageName.POSTVENTA,
        substageName: "Capacitación al cliente",
        dueDate: "2024-11-05",
        completedAt: "2024-11-05T16:20:00.000Z",
      },
    ],
    files: [
      {
        filename: "as-built-final.pdf",
        storedFilename: "f1d94bc1-f7a2-4891-8f74-as-built-final.pdf",
        mimeType: "application/pdf",
        sizeBytes: 2241130,
        url: "/projects/PRY-2025-005/as-built-final.pdf",
        uploadedByEmail: "pm@solarispm.com",
        stageName: StageName.POSTVENTA,
        createdAt: "2024-11-04T15:10:00.000Z",
      },
      {
        filename: "acta-recepcion-definitiva.pdf",
        storedFilename: "cfb4ec32-baa1-4f97-8386-acta-recepcion-definitiva.pdf",
        mimeType: "application/pdf",
        sizeBytes: 404810,
        url: "/projects/PRY-2025-005/acta-recepcion-definitiva.pdf",
        uploadedByEmail: "admin@solarispm.com",
        stageName: StageName.POSTVENTA,
        createdAt: "2024-11-12T18:05:00.000Z",
      },
    ],
    notifications: [
      {
        type: NotificationType.stage_changed,
        title: "Proyecto finalizado",
        message: "Bodega La Cuesta completó todas sus etapas y cerró el proyecto.",
        userEmail: "admin@solarispm.com",
        read: true,
        sentEmail: true,
        sentWhatsapp: true,
        createdAt: "2024-11-12T18:15:00.000Z",
      },
    ],
    auditTrail: [
      {
        entityType: AuditEntityType.project,
        action: AuditAction.created,
        entityRef: "project",
        userEmail: "admin@solarispm.com",
        description: "Creó el proyecto Bodega La Cuesta con código PRY-2025-005",
        timestamp: "2024-07-08T09:30:00.000Z",
      },
      {
        entityType: AuditEntityType.stage,
        action: AuditAction.created,
        entityRef: "PREVENTA",
        userEmail: "admin@solarispm.com",
        description: "Se generaron automáticamente las etapas base del proyecto",
        timestamp: "2024-07-08T09:31:00.000Z",
      },
      {
        entityType: AuditEntityType.stage,
        action: AuditAction.stage_advanced,
        entityRef: "PREVENTA",
        userEmail: "pm@solarispm.com",
        description: "Completó la etapa Preventa y habilitó Ingeniería",
        timestamp: "2024-07-18T17:40:00.000Z",
      },
      {
        entityType: AuditEntityType.stage,
        action: AuditAction.stage_advanced,
        entityRef: "INGENIERIA",
        userEmail: "pm@solarispm.com",
        description: "Completó la etapa Ingeniería y habilitó Compras",
        timestamp: "2024-08-08T18:00:00.000Z",
      },
      {
        entityType: AuditEntityType.stage,
        action: AuditAction.stage_advanced,
        entityRef: "COMPRAS",
        userEmail: "admin@solarispm.com",
        description: "Completó la etapa Compras y habilitó Instalación",
        timestamp: "2024-08-29T18:05:00.000Z",
      },
      {
        entityType: AuditEntityType.stage,
        action: AuditAction.stage_advanced,
        entityRef: "INSTALACION",
        userEmail: "pm@solarispm.com",
        description: "Completó la etapa Instalación y habilitó Habilitación",
        timestamp: "2024-10-02T19:10:00.000Z",
      },
      {
        entityType: AuditEntityType.stage,
        action: AuditAction.stage_advanced,
        entityRef: "HABILITACION",
        userEmail: "admin@solarispm.com",
        description: "Completó la etapa Habilitación y habilitó Postventa",
        timestamp: "2024-10-29T17:55:00.000Z",
      },
      {
        entityType: AuditEntityType.file,
        action: AuditAction.file_uploaded,
        entityRef: "as-built-final.pdf",
        userEmail: "pm@solarispm.com",
        description: "Adjuntó as-built-final.pdf al cierre de Postventa",
        timestamp: "2024-11-04T15:10:00.000Z",
      },
      {
        entityType: AuditEntityType.task,
        action: AuditAction.status_changed,
        entityRef: "Capacitación final al personal de mantenimiento",
        userEmail: "pm@solarispm.com",
        description: "Marcó como completada la capacitación final al cliente",
        timestamp: "2024-11-05T16:20:00.000Z",
        fieldChanged: "status",
        oldValue: "IN_PROGRESS",
        newValue: "COMPLETED",
      },
      {
        entityType: AuditEntityType.project,
        action: AuditAction.status_changed,
        entityRef: "project",
        userEmail: "admin@solarispm.com",
        description: "Cambió estado del proyecto de ACTIVE a COMPLETED",
        timestamp: "2024-11-12T18:15:00.000Z",
        fieldChanged: "status",
        oldValue: "ACTIVE",
        newValue: "COMPLETED",
      },
      {
        entityType: AuditEntityType.file,
        action: AuditAction.file_uploaded,
        entityRef: "acta-recepcion-definitiva.pdf",
        userEmail: "admin@solarispm.com",
        description: "Adjuntó acta-recepcion-definitiva.pdf al cierre documental",
        timestamp: "2024-11-12T18:05:00.000Z",
      },
    ],
  },
];

async function main() {
  await prisma.auditLog.deleteMany();
  await prisma.notification.deleteMany();
  await prisma.fileAttachment.deleteMany();
  await prisma.task.deleteMany();
  await prisma.substage.deleteMany();
  await prisma.stage.deleteMany();
  await prisma.project.deleteMany();
  await prisma.user.deleteMany();

  const adminPassword = await bcrypt.hash("Admin1234", 10);

  const users = await Promise.all([
    prisma.user.create({
      data: {
        email: "admin@solarispm.com",
        password: adminPassword,
        name: "Administrador Solaris",
        avatarUrl: "https://api.dicebear.com/9.x/initials/svg?seed=Administrador%20Solaris",
      },
    }),
    prisma.user.create({
      data: {
        email: "pm@solarispm.com",
        password: adminPassword,
        name: "Marina Páez",
        avatarUrl: "https://api.dicebear.com/9.x/initials/svg?seed=Marina%20Paez",
      },
    }),
  ]);

  const userByEmail = new Map(users.map((user) => [user.email, user]));

  for (const projectConfig of projects) {
    const createdBy = userByEmail.get("admin@solarispm.com");
    if (!createdBy) {
      throw new Error("Seed users were not created correctly.");
    }

    const project = await prisma.project.create({
      data: {
        code: projectConfig.code,
        clientName: projectConfig.clientName,
        capacityKwp: new Prisma.Decimal(projectConfig.capacityKwp),
        locationCity: projectConfig.locationCity,
        locationProvince: projectConfig.locationProvince,
        status: projectConfig.status,
        startDate: dateOnly(projectConfig.startDate)!,
        plannedEndDate: dateOnly(projectConfig.plannedEndDate)!,
        actualEndDate: dateOnly(projectConfig.actualEndDate),
        budgetUsd: new Prisma.Decimal(projectConfig.budgetUsd),
        executedUsd: new Prisma.Decimal(projectConfig.executedUsd),
        estimatedMwhYear: new Prisma.Decimal(projectConfig.estimatedMwhYear),
        co2TonsAvoided: new Prisma.Decimal((projectConfig.estimatedMwhYear * 0.5).toFixed(2)),
        notificationEmail: projectConfig.notificationEmail,
        notificationPhone: projectConfig.notificationPhone,
        createdById: createdBy.id,
      },
    });

    const stageByName = new Map<StageName, { id: string }>();
    const substageByName = new Map<string, { id: string }>();
    const substageByLabel = new Map<string, { id: string }>();
    const taskByTitle = new Map<string, { id: string }>();
    const fileByName = new Map<string, { id: string }>();

    for (const [index, stageConfig] of projectConfig.stagePlans.entries()) {
      const plannedDurationDays = daysBetween(stageConfig.plannedStartDate, stageConfig.plannedEndDate);
      const actualDurationDays = daysBetween(stageConfig.actualStartDate, stageConfig.actualEndDate);
      const delayDays =
        plannedDurationDays !== null && actualDurationDays !== null
          ? actualDurationDays - plannedDurationDays
          : null;

      const stage = await prisma.stage.create({
        data: {
          projectId: project.id,
          order: index + 1,
          name: stageConfig.name,
          status: stageConfig.status,
          progressPercent: stageConfig.progressPercent,
          plannedStartDate: dateOnly(stageConfig.plannedStartDate),
          plannedEndDate: dateOnly(stageConfig.plannedEndDate),
          actualStartDate: dateOnly(stageConfig.actualStartDate),
          actualEndDate: dateOnly(stageConfig.actualEndDate),
          plannedDurationDays,
          actualDurationDays,
          delayDays,
          notes: stageConfig.notes,
        },
      });

      stageByName.set(stageConfig.name, { id: stage.id });

      for (const [subIndex, substageConfig] of stageConfig.substages.entries()) {
        const substage = await prisma.substage.create({
          data: {
            projectId: project.id,
            stageId: stage.id,
            order: subIndex + 1,
            name: substageConfig.name,
            status: substageConfig.status,
            responsible: substageConfig.responsible,
            userId: substageConfig.userEmail ? userByEmail.get(substageConfig.userEmail)?.id : undefined,
            dueDate: dateOnly(substageConfig.dueDate),
            plannedStartDate: dateOnly(substageConfig.plannedStartDate),
            plannedEndDate: dateOnly(substageConfig.plannedEndDate),
            actualStartDate: dateOnly(substageConfig.actualStartDate),
            actualEndDate: dateOnly(substageConfig.actualEndDate),
            notes: substageConfig.notes,
          },
        });

        substageByName.set(`${stageConfig.name}:${substageConfig.name}`, { id: substage.id });
        substageByLabel.set(substageConfig.name, { id: substage.id });
      }
    }

    for (const taskConfig of projectConfig.tasks) {
      const stageId = taskConfig.stageName ? stageByName.get(taskConfig.stageName)?.id : undefined;
      const substageId =
        taskConfig.stageName && taskConfig.substageName
          ? substageByName.get(`${taskConfig.stageName}:${taskConfig.substageName}`)?.id
          : undefined;

      const task = await prisma.task.create({
        data: {
          projectId: project.id,
          stageId,
          substageId,
          title: taskConfig.title,
          description: taskConfig.description,
          status: taskConfig.status,
          priority: taskConfig.priority,
          responsible: taskConfig.responsible,
          userId: taskConfig.userEmail ? userByEmail.get(taskConfig.userEmail)?.id : undefined,
          dueDate: dateOnly(taskConfig.dueDate),
          completedAt: dateTime(taskConfig.completedAt),
        },
      });

      taskByTitle.set(taskConfig.title, { id: task.id });
    }

    for (const fileConfig of projectConfig.files) {
      const stageId = fileConfig.stageName ? stageByName.get(fileConfig.stageName)?.id : undefined;
      const substageId =
        fileConfig.stageName && fileConfig.substageName
          ? substageByName.get(`${fileConfig.stageName}:${fileConfig.substageName}`)?.id
          : undefined;

      const uploadedBy = userByEmail.get(fileConfig.uploadedByEmail);
      if (!uploadedBy) {
        throw new Error(`Unknown uploader ${fileConfig.uploadedByEmail}`);
      }

      const file = await prisma.fileAttachment.create({
        data: {
          projectId: project.id,
          stageId,
          substageId,
          filename: fileConfig.filename,
          storedFilename: fileConfig.storedFilename,
          mimeType: fileConfig.mimeType,
          sizeBytes: fileConfig.sizeBytes,
          url: fileConfig.url,
          uploadedById: uploadedBy.id,
          createdAt: dateTime(fileConfig.createdAt)!,
        },
      });

      fileByName.set(fileConfig.filename, { id: file.id });
    }

    for (const notificationConfig of projectConfig.notifications) {
      await prisma.notification.create({
        data: {
          userId: notificationConfig.userEmail
            ? userByEmail.get(notificationConfig.userEmail)?.id
            : undefined,
          projectId: project.id,
          type: notificationConfig.type,
          title: notificationConfig.title,
          message: notificationConfig.message,
          read: notificationConfig.read ?? false,
          sentEmail: notificationConfig.sentEmail ?? false,
          sentWhatsapp: notificationConfig.sentWhatsapp ?? false,
          createdAt: dateTime(notificationConfig.createdAt)!,
        },
      });
    }

    for (const audit of projectConfig.auditTrail) {
      const user = userByEmail.get(audit.userEmail);
      if (!user) {
        throw new Error(`Unknown audit log user ${audit.userEmail}`);
      }

      const entityId =
        audit.entityRef === "project"
          ? project.id
          : stageByName.get(audit.entityRef as StageName)?.id ??
            substageByName.get(`${StageName.PREVENTA}:${audit.entityRef}`)?.id ??
            substageByLabel.get(audit.entityRef)?.id ??
            taskByTitle.get(audit.entityRef)?.id ??
            fileByName.get(audit.entityRef)?.id ??
            audit.entityRef;

      await prisma.auditLog.create({
        data: {
          entityType: audit.entityType,
          entityId,
          projectId: project.id,
          userId: user.id,
          action: audit.action,
          fieldChanged: audit.fieldChanged,
          oldValue: audit.oldValue,
          newValue: audit.newValue,
          description: audit.description,
          timestamp: dateTime(audit.timestamp)!,
          metadata: audit.metadata,
        },
      });
    }
  }

  console.log("Seed completed successfully with 4 projects and full relational data.");
}

main()
  .catch(async (error) => {
    console.error(error);
    await prisma.$disconnect();
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

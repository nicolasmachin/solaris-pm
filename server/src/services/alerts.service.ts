import { AuditAction, AuditEntityType, GoalPeriod, NotificationType, Role, StageStatus, SubstageStatus, TaskStatus } from "@prisma/client";
import cron from "node-cron";

import { prisma } from "../lib/prisma.js";
import { createAuditEntry } from "./audit.service.js";
import { createAndSendNotification } from "./notify.service.js";
import { diffInDays, todayUtc } from "../utils/dates.js";

async function getSystemUserId() {
  const user =
    (await prisma.user.findUnique({ where: { email: "admin@voltiapm.com" } })) ??
    (await prisma.user.findFirst({ orderBy: { createdAt: "asc" } }));

  return user?.id ?? null;
}

async function registerAlert(params: {
  projectId: string;
  userId?: string | null;
  type: NotificationType;
  title: string;
  message: string;
  context: Parameters<typeof createAndSendNotification>[0]["context"];
}) {
  await createAndSendNotification({
    projectId: params.projectId,
    userId: params.userId ?? null,
    type: params.type,
    title: params.title,
    message: params.message,
    context: params.context,
    deduplicate: true,
  });

  const systemUserId = await getSystemUserId();
  if (systemUserId) {
    await createAuditEntry({
      entityType: AuditEntityType.project,
      entityId: params.projectId,
      projectId: params.projectId,
      userId: systemUserId,
      action: AuditAction.alert_triggered,
      description: `Se disparó alerta '${params.title}' para el proyecto`,
      metadata: { type: params.type },
    });
  }
}

export async function runAlertsCheck() {
  const tomorrow = todayUtc();
  tomorrow.setUTCDate(tomorrow.getUTCDate() + 1);

  // ── Tasks ──────────────────────────────────────────────────────────────────

  const tasks = await prisma.task.findMany({
    where: {
      deletedAt: null,
      status: { not: TaskStatus.COMPLETED },
      dueDate: { not: null },
      project: { deletedAt: null },
    },
    include: { project: true, user: true },
  });

  for (const task of tasks) {
    if (!task.dueDate) continue;

    const dueDiff = diffInDays(todayUtc(), task.dueDate);
    if (dueDiff === 1) {
      await registerAlert({
        projectId: task.projectId,
        userId: task.userId,
        type: NotificationType.task_due,
        title: "Tarea próxima a vencer",
        message: `La tarea '${task.title}' vence mañana.`,
        context: {
          type: "task_due",
          projectName: task.project.clientName,
          taskTitle: task.title,
          dueDate: task.dueDate.toISOString().slice(0, 10),
        },
      });
    }

    if (dueDiff < 0 && dueDiff >= -1) {
      await registerAlert({
        projectId: task.projectId,
        userId: task.userId,
        type: NotificationType.task_due,
        title: "Tarea vencida",
        message: `La tarea '${task.title}' venció en las últimas 24 horas.`,
        context: {
          type: "task_due",
          projectName: task.project.clientName,
          taskTitle: task.title,
          dueDate: task.dueDate.toISOString().slice(0, 10),
        },
      });
    }
  }

  // ── Stages ──────────────────────────────────────────────────────────────────

  const stages = await prisma.stage.findMany({
    where: {
      status: { not: StageStatus.COMPLETED },
      project: { deletedAt: null },
    },
    include: { project: true },
  });

  for (const stage of stages) {
    const delayDays = stage.plannedEndDate
      ? Math.max(0, diffInDays(stage.plannedEndDate, todayUtc()))
      : 0;

    if (stage.plannedEndDate && stage.plannedEndDate < todayUtc()) {
      await registerAlert({
        projectId: stage.projectId,
        type: NotificationType.stage_overdue,
        title: "Etapa vencida",
        message: `La etapa ${stage.name} superó su fecha planificada y sigue abierta.`,
        context: {
          type: "stage_overdue",
          projectName: stage.project.clientName,
          stageName: stage.name,
          delayDays,
        },
      });
    }

    if (stage.plannedStartDate && stage.plannedEndDate) {
      const totalDays = Math.max(1, diffInDays(stage.plannedStartDate, stage.plannedEndDate));
      const elapsedDays = Math.max(0, diffInDays(stage.plannedStartDate, todayUtc()));
      if (elapsedDays / totalDays >= 0.8) {
        await registerAlert({
          projectId: stage.projectId,
          type: NotificationType.stage_overdue,
          title: "Etapa en riesgo por tiempo",
          message: `La etapa ${stage.name} consumió más del 80% del tiempo planificado sin completarse.`,
          context: {
            type: "stage_overdue",
            projectName: stage.project.clientName,
            stageName: stage.name,
            delayDays,
          },
        });
      }
    }
  }

  // ── Delayed projects ───────────────────────────────────────────────────────

  const delayedProjects = await prisma.project.findMany({
    where: { deletedAt: null },
    include: { stages: true },
  });

  for (const project of delayedProjects) {
    const delayDays = project.stages
      .filter((s) => s.status === StageStatus.COMPLETED)
      .reduce((sum, s) => sum + (s.delayDays ?? 0), 0);

    if (delayDays > 5) {
      await registerAlert({
        projectId: project.id,
        type: NotificationType.project_delayed,
        title: "Proyecto con retraso acumulado",
        message: `El proyecto ${project.code} acumula ${delayDays} días de desvío.`,
        context: {
          type: "project_delayed",
          projectName: project.clientName,
          delayDays,
        },
      });
    }
  }

  // ── Blocked substages ──────────────────────────────────────────────────────

  const blockedSubstages = await prisma.substage.findMany({
    where: {
      deletedAt: null,
      status: SubstageStatus.BLOCKED,
      updatedAt: { lte: new Date(Date.now() - 48 * 60 * 60 * 1000) },
      project: { deletedAt: null },
    },
    include: {
      project: true,
      stage: true,
    },
  });

  for (const substage of blockedSubstages) {
    await registerAlert({
      projectId: substage.projectId,
      userId: substage.userId,
      type: NotificationType.substage_blocked,
      title: "Subetapa bloqueada",
      message: `La subetapa '${substage.name}' lleva más de 48 horas bloqueada.`,
      context: {
        type: "substage_blocked",
        projectName: substage.project.clientName,
        stageName: substage.stage.name,
        substageName: substage.name,
        responsible: substage.responsible,
      },
    });
  }
}

export function startAlertsJob() {
  const task = cron.schedule("0 * * * *", async () => {
    try {
      await runAlertsCheck();
    } catch (error) {
      console.error("Error ejecutando job de alertas", error);
    }
  });

  return task;
}

// ─── Goals configured check ──────────────────────────────────────────────────

export async function checkGoalsConfigured(): Promise<void> {
  const now = new Date();
  const year = now.getFullYear();
  const quarter = Math.ceil((now.getMonth() + 1) / 3);
  const periodLabel = `Q${quarter} ${year}`;

  // Check if any goals exist for this quarter
  const goalsCount = await prisma.goal.count({
    where: { period: GoalPeriod.QUARTERLY, year, quarter },
  });

  if (goalsCount > 0) return;

  // Check if notification already exists to avoid duplicates
  const existing = await prisma.notification.findFirst({
    where: {
      type: NotificationType.goals_not_configured,
      title: "Objetivos no configurados",
      message: { contains: periodLabel },
    },
  });

  if (existing) return;

  // Notify all ADMIN users
  const admins = await prisma.user.findMany({
    where: { role: Role.ADMIN, deletedAt: null },
    select: { id: true },
  });

  for (const admin of admins) {
    await prisma.notification.create({
      data: {
        userId: admin.id,
        type: NotificationType.goals_not_configured,
        title: "Objetivos no configurados",
        message: `No hay objetivos definidos para ${periodLabel}. Configuralos en Administración.`,
        read: false,
      },
    });
  }

  console.log(`[goals-check] Notificación creada para ${admins.length} admin(s): sin objetivos en ${periodLabel}`);
}

export function startGoalsCheckJob() {
  // Run on the 1st of each quarter: Jan 1, Apr 1, Jul 1, Oct 1 at 08:00
  cron.schedule("0 8 1 1,4,7,10 *", async () => {
    try {
      await checkGoalsConfigured();
    } catch (error) {
      console.error("Error ejecutando check de objetivos", error);
    }
  });
}

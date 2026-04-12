import { AuditAction, AuditEntityType, NotificationType, StageStatus, SubstageStatus, TaskStatus } from "@prisma/client";
import cron from "node-cron";

import { prisma } from "../lib/prisma.js";
import { createAuditEntry } from "./audit.service.js";
import { createNotificationIfNotExists } from "./notification.service.js";
import { diffInDays, todayUtc } from "../utils/dates.js";

async function getSystemUserId() {
  const user =
    (await prisma.user.findUnique({ where: { email: "admin@solarispm.com" } })) ??
    (await prisma.user.findFirst({ orderBy: { createdAt: "asc" } }));

  return user?.id ?? null;
}

async function registerAlert(params: {
  projectId: string;
  userId?: string | null;
  type: NotificationType;
  title: string;
  message: string;
}) {
  const notification = await createNotificationIfNotExists({
    projectId: params.projectId,
    userId: params.userId ?? null,
    type: params.type,
    title: params.title,
    message: params.message,
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
      metadata: {
        notificationId: notification.id,
        type: params.type,
      },
    });
  }
}

export async function runAlertsCheck() {
  const tomorrow = todayUtc();
  tomorrow.setUTCDate(tomorrow.getUTCDate() + 1);

  const tasks = await prisma.task.findMany({
    where: {
      deletedAt: null,
      status: {
        not: TaskStatus.COMPLETED,
      },
      dueDate: {
        not: null,
      },
      project: {
        deletedAt: null,
      },
    },
    include: {
      project: true,
      user: true,
    },
  });

  for (const task of tasks) {
    if (!task.dueDate) {
      continue;
    }

    const dueDiff = diffInDays(todayUtc(), task.dueDate);
    if (dueDiff === 1) {
      await registerAlert({
        projectId: task.projectId,
        userId: task.userId,
        type: NotificationType.task_due,
        title: "Tarea próxima a vencer",
        message: `La tarea '${task.title}' vence mañana.`,
      });
    }

    if (dueDiff < 0 && dueDiff >= -1) {
      await registerAlert({
        projectId: task.projectId,
        userId: task.userId,
        type: NotificationType.task_due,
        title: "Tarea vencida",
        message: `La tarea '${task.title}' venció en las últimas 24 horas.`,
      });
    }
  }

  const stages = await prisma.stage.findMany({
    where: {
      status: {
        not: StageStatus.COMPLETED,
      },
      project: {
        deletedAt: null,
      },
    },
    include: {
      project: true,
    },
  });

  for (const stage of stages) {
    if (stage.plannedEndDate && stage.plannedEndDate < todayUtc()) {
      await registerAlert({
        projectId: stage.projectId,
        type: NotificationType.stage_overdue,
        title: "Etapa vencida",
        message: `La etapa ${stage.name} superó su fecha planificada y sigue abierta.`,
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
        });
      }
    }
  }

  const delayedProjects = await prisma.project.findMany({
    where: {
      deletedAt: null,
    },
    include: {
      stages: true,
    },
  });

  for (const project of delayedProjects) {
    const delayDays = project.stages
      .filter((stage) => stage.status === StageStatus.COMPLETED)
      .reduce((sum, stage) => sum + (stage.delayDays ?? 0), 0);

    if (delayDays > 5) {
      await registerAlert({
        projectId: project.id,
        type: NotificationType.project_delayed,
        title: "Proyecto con retraso acumulado",
        message: `El proyecto ${project.code} acumula ${delayDays} días de desvío.`,
      });
    }
  }

  const blockedSubstages = await prisma.substage.findMany({
    where: {
      deletedAt: null,
      status: SubstageStatus.BLOCKED,
      updatedAt: {
        lte: new Date(Date.now() - 48 * 60 * 60 * 1000),
      },
      project: {
        deletedAt: null,
      },
    },
  });

  for (const substage of blockedSubstages) {
    await registerAlert({
      projectId: substage.projectId,
      userId: substage.userId,
      type: NotificationType.substage_blocked,
      title: "Subetapa bloqueada",
      message: `La subetapa '${substage.name}' lleva más de 48 horas bloqueada.`,
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

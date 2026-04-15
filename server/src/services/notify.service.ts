import { NotificationType } from "@prisma/client";
import { prisma } from "../lib/prisma.js";
import { createNotification, createNotificationIfNotExists } from "./notification.service.js";
import { sendEmail } from "./email.service.js";
import { sendWhatsApp } from "./whatsapp.service.js";
import {
  emailTaskDue,
  emailStageOverdue,
  emailProgressMilestone,
  emailSubstageBlocked,
  emailProjectDelayed,
  emailStageChanged,
} from "./email.templates.js";
import {
  waTaskDue,
  waStageOverdue,
  waProgressMilestone,
  waSubstageBlocked,
  waProjectDelayed,
  waStageChanged,
} from "./whatsapp.templates.js";

// ─── Types ────────────────────────────────────────────────────────────────────

export type NotifyContext =
  | { type: "task_due"; projectName: string; taskTitle: string; dueDate: string }
  | { type: "stage_overdue"; projectName: string; stageName: string; delayDays: number }
  | { type: "progress_milestone"; projectName: string; percent: number; currentStage?: string }
  | { type: "substage_blocked"; projectName: string; stageName: string; substageName: string; responsible?: string | null }
  | { type: "project_delayed"; projectName: string; delayDays: number }
  | { type: "stage_changed"; projectName: string; stageName: string; oldStatus: string; newStatus: string; changedBy?: string }
  | { type: "goals_not_configured"; period: string };

// ─── Dispatch channels ────────────────────────────────────────────────────────

async function dispatchChannels(
  notificationId: string,
  projectId: string,
  context: NotifyContext,
): Promise<void> {
  const project = await prisma.project.findFirst({
    where: { id: projectId, deletedAt: null },
    select: { notificationEmail: true, notificationPhone: true },
  });

  if (!project) return;

  const { notificationEmail, notificationPhone } = project;
  let sentEmail = false;
  let sentWhatsapp = false;

  if (notificationEmail) {
    const template = buildEmailTemplate(context, projectId);
    if (template) {
      sentEmail = await sendEmail({ to: notificationEmail, ...template });
    }
  }

  if (notificationPhone) {
    const message = buildWhatsAppMessage(context, projectId);
    if (message) {
      sentWhatsapp = await sendWhatsApp({ to: notificationPhone, message });
    }
  }

  // Update flags even if send failed (to avoid infinite retry loop)
  if (notificationEmail || notificationPhone) {
    await prisma.notification.update({
      where: { id: notificationId },
      data: {
        ...(notificationEmail ? { sentEmail: sentEmail || true } : {}),
        ...(notificationPhone ? { sentWhatsapp: sentWhatsapp || true } : {}),
      },
    });
  }
}

function buildEmailTemplate(
  context: NotifyContext,
  projectId: string,
): { subject: string; html: string; text?: string } | null {
  switch (context.type) {
    case "task_due":
      return emailTaskDue({ projectName: context.projectName, projectId, taskTitle: context.taskTitle, dueDate: context.dueDate });
    case "stage_overdue":
      return emailStageOverdue({ projectName: context.projectName, projectId, stageName: context.stageName, delayDays: context.delayDays });
    case "progress_milestone":
      return emailProgressMilestone({ projectName: context.projectName, projectId, percent: context.percent, currentStage: context.currentStage });
    case "substage_blocked":
      return emailSubstageBlocked({ projectName: context.projectName, projectId, stageName: context.stageName, substageName: context.substageName, responsible: context.responsible });
    case "project_delayed":
      return emailProjectDelayed({ projectName: context.projectName, projectId, delayDays: context.delayDays });
    case "stage_changed":
      return emailStageChanged({ projectName: context.projectName, projectId, stageName: context.stageName, oldStatus: context.oldStatus, newStatus: context.newStatus, changedBy: context.changedBy });
    default:
      return null;
  }
}

function buildWhatsAppMessage(context: NotifyContext, projectId: string): string | null {
  switch (context.type) {
    case "task_due":
      return waTaskDue({ projectName: context.projectName, projectId, taskTitle: context.taskTitle, dueDate: context.dueDate });
    case "stage_overdue":
      return waStageOverdue({ projectName: context.projectName, projectId, stageName: context.stageName, delayDays: context.delayDays });
    case "progress_milestone":
      return waProgressMilestone({ projectName: context.projectName, projectId, percent: context.percent });
    case "substage_blocked":
      return waSubstageBlocked({ projectName: context.projectName, projectId, substageName: context.substageName, responsible: context.responsible });
    case "project_delayed":
      return waProjectDelayed({ projectName: context.projectName, projectId, delayDays: context.delayDays });
    case "stage_changed":
      return waStageChanged({ projectName: context.projectName, projectId, stageName: context.stageName, newStatus: context.newStatus });
    default:
      return null;
  }
}

// ─── Public API ───────────────────────────────────────────────────────────────

/** Create notification (deduplicating) and send via all configured channels */
export async function createAndSendNotification(params: {
  projectId: string;
  userId?: string | null;
  type: NotificationType;
  title: string;
  message: string;
  context: NotifyContext;
  deduplicate?: boolean;
}): Promise<void> {
  try {
    const notification = params.deduplicate !== false
      ? await createNotificationIfNotExists({
          projectId: params.projectId,
          userId: params.userId ?? null,
          type: params.type,
          title: params.title,
          message: params.message,
        })
      : await createNotification({
          projectId: params.projectId,
          userId: params.userId ?? null,
          type: params.type,
          title: params.title,
          message: params.message,
        });

    // Only send channels if this notification hasn't been sent yet
    if (!notification.sentEmail && !notification.sentWhatsapp) {
      await dispatchChannels(notification.id, params.projectId, params.context);
    }
  } catch (err) {
    console.error("[notify] Error creating/sending notification:", err);
  }
}

/** Check progress milestones and fire notification if a new one was crossed */
export async function checkProgressMilestone(
  projectId: string,
  newProgressPercent: number,
): Promise<void> {
  const milestones = [25, 50, 75, 100];

  for (const milestone of milestones) {
    if (newProgressPercent >= milestone) {
      const exists = await prisma.notification.findFirst({
        where: {
          projectId,
          type: NotificationType.progress_milestone,
          title: { contains: `${milestone}%` },
        },
      });

      if (!exists) {
        const project = await prisma.project.findFirst({
          where: { id: projectId, deletedAt: null },
          include: {
            stages: { orderBy: { order: "asc" } },
          },
        });

        if (!project) continue;

        const currentStage = project.stages.find(
          (s) => s.status === "IN_PROGRESS" || s.status === "PENDING",
        );

        await createAndSendNotification({
          projectId,
          type: NotificationType.progress_milestone,
          title: `Hito alcanzado: ${milestone}%`,
          message: `El proyecto ${project.clientName} alcanzó el ${milestone}% de avance.`,
          context: {
            type: "progress_milestone",
            projectName: project.clientName,
            percent: milestone,
            currentStage: currentStage?.name,
          },
          deduplicate: false,
        });
      }
    }
  }
}

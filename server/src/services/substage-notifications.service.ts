import { NotificationType } from "@prisma/client";
import { prisma } from "../lib/prisma.js";
import { createNotification } from "./notification.service.js";
import { sendEmail } from "./email.service.js";
import { sendWhatsApp } from "./whatsapp.service.js";

// Devuelve la siguiente subetapa lógica del proyecto:
//   1. Misma stage, siguiente order
//   2. Si era la última de la stage, primera subetapa de la siguiente stage
//   3. null si no hay siguiente
export async function findNextSubstage(substage: { id: string; stageId: string; order: number }) {
  const inSameStage = await prisma.substage.findFirst({
    where: {
      stageId: substage.stageId,
      order: { gt: substage.order },
      deletedAt: null,
      isActive: true,
    },
    orderBy: { order: "asc" },
  });
  if (inSameStage) return inSameStage;

  const currentStage = await prisma.stage.findUnique({
    where: { id: substage.stageId },
    select: { id: true, projectId: true, order: true },
  });
  if (!currentStage) return null;

  const nextStage = await prisma.stage.findFirst({
    where: {
      projectId: currentStage.projectId,
      order: { gt: currentStage.order },
      deletedAt: null,
    },
    orderBy: { order: "asc" },
    include: {
      substages: {
        where: { deletedAt: null, isActive: true },
        orderBy: { order: "asc" },
        take: 1,
      },
    },
  });
  return nextStage?.substages[0] ?? null;
}

// Notifica al responsable de la siguiente subetapa que ya puede avanzar.
// Best-effort: cualquier error se registra pero no se propaga.
export async function notifyNextSubstageOwner(completedSubstageId: string): Promise<void> {
  try {
    const completed = await prisma.substage.findUnique({
      where: { id: completedSubstageId },
      include: {
        project: { select: { id: true, clientName: true } },
      },
    });
    if (!completed) return;

    const next = await findNextSubstage(completed);
    if (!next || !next.userId) return;

    const target = await prisma.user.findUnique({
      where: { id: next.userId },
      select: { id: true, name: true, email: true, phone: true, deletedAt: true },
    });
    if (!target || target.deletedAt) return;

    const prefs = await prisma.userNotificationPreference.findUnique({
      where: { userId: target.id },
    });
    // Default opt-in si nunca configuró: respetar el default del schema (true)
    const wantsNotif = prefs?.prevSubstageCompleted ?? true;
    if (!wantsNotif) return;

    const inApp = prefs?.prevSubstageCompletedInApp ?? true;
    const wantEmail = prefs?.prevSubstageCompletedEmail ?? false;
    const wantWA = prefs?.prevSubstageCompletedWhatsapp ?? false;

    const projectName = completed.project.clientName;
    const title = "Tu próxima subetapa está habilitada";
    const message = `Se completó "${completed.name}" en el proyecto "${projectName}". Ya podés avanzar con: ${next.name}.`;

    if (inApp) {
      await createNotification({
        userId: target.id,
        projectId: completed.project.id,
        type: NotificationType.prev_substage_completed,
        title,
        message,
      });
    }
    if (wantEmail && target.email) {
      const html = `<p>${message}</p>`;
      await sendEmail({ to: target.email, subject: title, html, text: message });
    }
    if (wantWA && target.phone) {
      await sendWhatsApp({ to: target.phone, message: `${title}: ${message}` });
    }
  } catch (err) {
    console.error("[notifyNextSubstageOwner] failed:", err);
  }
}

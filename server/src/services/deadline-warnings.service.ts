import cron from "node-cron";
import { NotificationType } from "@prisma/client";
import { prisma } from "./../lib/prisma.js";
import { createNotification } from "./notification.service.js";
import { sendEmail } from "./email.service.js";
import { sendWhatsApp } from "./whatsapp.service.js";

// Devuelve la fecha "hoy" (UTC, sin hora) y "hoy + N días"
function getDateRange(daysAhead: number): { from: Date; to: Date } {
  const now = new Date();
  const from = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
  const to = new Date(from);
  to.setUTCDate(to.getUTCDate() + daysAhead);
  return { from, to };
}

function formatDateEs(date: Date): string {
  return date.toLocaleDateString("es-UY", { day: "2-digit", month: "long", year: "numeric" });
}

// Busca subetapas con deadline en próximos 3 días, no completadas, no notificadas
// todavía, y dispara notificaciones según las preferencias del responsable.
export async function sendDeadlineWarnings(): Promise<{ checked: number; sent: number }> {
  const { from, to } = getDateRange(3);

  const substages = await prisma.substage.findMany({
    where: {
      deadline: { gte: from, lte: to },
      actualEndDate: null,
      deadlineNotificationSent: false,
      deletedAt: null,
      isActive: true,
      userId: { not: null },
    },
    include: {
      user: { select: { id: true, name: true, email: true, phone: true, deletedAt: true } },
      stage: { select: { id: true, name: true } },
      project: { select: { id: true, clientName: true } },
    },
  });

  let sent = 0;
  for (const sub of substages) {
    if (!sub.user || sub.user.deletedAt || !sub.deadline) continue;

    const prefs = await prisma.userNotificationPreference.findUnique({ where: { userId: sub.user.id } });
    const wants = prefs?.deadlineWarning ?? true;
    if (!wants) {
      // Marcar como notificado igual para no estar consultando todos los días
      await prisma.substage.update({
        where: { id: sub.id },
        data: { deadlineNotificationSent: true, deadlineNotifiedAt: new Date() },
      });
      continue;
    }

    const inApp = prefs?.deadlineWarningInApp ?? true;
    const wantEmail = prefs?.deadlineWarningEmail ?? false;
    const wantWA = prefs?.deadlineWarningWhatsapp ?? false;

    const title = "Recordatorio de deadline próximo";
    const message = `La subetapa "${sub.name}" del proyecto "${sub.project.clientName}" vence el ${formatDateEs(sub.deadline)}.`;

    try {
      if (inApp) {
        await createNotification({
          userId: sub.user.id,
          projectId: sub.project.id,
          type: NotificationType.deadline_warning,
          title,
          message,
        });
      }
      if (wantEmail && sub.user.email) {
        await sendEmail({ to: sub.user.email, subject: title, html: `<p>${message}</p>`, text: message });
      }
      if (wantWA && sub.user.phone) {
        await sendWhatsApp({ to: sub.user.phone, message: `${title}: ${message}` });
      }
    } catch (err) {
      console.error(`[deadline-warnings] failed to notify substage ${sub.id}:`, err);
    }

    await prisma.substage.update({
      where: { id: sub.id },
      data: { deadlineNotificationSent: true, deadlineNotifiedAt: new Date() },
    });
    sent++;
  }

  return { checked: substages.length, sent };
}

// Cron diario a las 9 AM
export function startDeadlineWarningsJob() {
  return cron.schedule("0 9 * * *", async () => {
    try {
      const result = await sendDeadlineWarnings();
      if (result.sent > 0) {
        console.log(`[deadline-warnings] enviadas ${result.sent}/${result.checked} notificaciones`);
      }
    } catch (err) {
      console.error("[deadline-warnings] job error:", err);
    }
  });
}

import { GoalPeriod, NotificationType } from "@prisma/client";
import cron from "node-cron";

import { prisma } from "../lib/prisma.js";

// El cron horario de alertas (task_due / stage_overdue / project_delayed /
// substage_blocked) se eliminó en mayo 2026 junto con el dispatcher que
// usaba Project.notificationEmail para enviar a clientes. Solo sobrevive
// el chequeo trimestral de "objetivos no configurados", que es
// in-app puro y se entrega a usuarios ADMIN.

export async function checkGoalsConfigured(): Promise<void> {
  const now = new Date();
  const year = now.getFullYear();
  const quarter = Math.ceil((now.getMonth() + 1) / 3);
  const periodLabel = `Q${quarter} ${year}`;

  const goalsCount = await prisma.goal.count({
    where: { period: GoalPeriod.QUARTERLY, year, quarter },
  });

  if (goalsCount > 0) return;

  const existing = await prisma.notification.findFirst({
    where: {
      type: NotificationType.goals_not_configured,
      title: "Objetivos no configurados",
      message: { contains: periodLabel },
    },
  });

  if (existing) return;

  const admins = await prisma.user.findMany({
    where: { role: { name: "ADMIN" }, deletedAt: null },
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

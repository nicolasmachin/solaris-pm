import { NotificationType } from "@prisma/client";
import { prisma } from "../lib/prisma.js";
import { createNotificationByUniqueKey } from "./notification.service.js";
import { sendEmail } from "./email.service.js";
import { emailEngineeringCompleted } from "./email.templates.js";

// Ingeniería completada → avisar a Operaciones + Admin
//
// Esta función es lo único que queda en este servicio: en mayo 2026 se
// eliminaron las notificaciones automáticas multicanal (task_due,
// stage_overdue, progress_milestone, substage_blocked, project_delayed,
// stage_changed) porque el dispatcher usaba Project.notificationEmail —
// que en realidad era el email del cliente — como destinatario. Ver
// services/email.service.ts para el guardrail que previene un incidente
// equivalente a futuro.

const ENGINEERING_COMPLETED_ROLES = ["OPERACIONES", "ADMIN"];

export async function notifyEngineeringCompleted(params: {
  projectId: string;
  trigger: "stage_completed" | "efp_approved";
}): Promise<void> {
  try {
    const project = await prisma.project.findFirst({
      where: { id: params.projectId, deletedAt: null },
      select: { id: true, clientName: true, code: true },
    });
    if (!project) return;

    const recipients = await prisma.user.findMany({
      where: {
        deletedAt: null,
        role: { name: { in: ENGINEERING_COMPLETED_ROLES } },
      },
      select: { id: true, name: true, email: true },
    });
    if (recipients.length === 0) return;

    const title = `Proyecto ${project.clientName} listo para Operaciones`;
    const message = `${project.clientName}${project.code ? ` (${project.code})` : ""} completó Ingeniería y está listo para que Operaciones inicie la planificación de la instalación.`;

    for (const user of recipients) {
      const uniqueKey = `engineering_completed_${project.id}_${user.id}`;

      const { notification, created } = await createNotificationByUniqueKey({
        projectId: project.id,
        userId: user.id,
        type: NotificationType.engineering_completed,
        title,
        message,
        uniqueKey,
      });

      if (!created) continue;

      if (user.email) {
        const template = emailEngineeringCompleted({
          projectName: project.clientName,
          projectCode: project.code,
          projectId: project.id,
          trigger: params.trigger,
        });
        const ok = await sendEmail({ to: user.email, ...template });
        if (ok) {
          await prisma.notification.update({
            where: { id: notification.id },
            data: { sentEmail: true },
          });
        }
      }
    }
  } catch (err) {
    console.error("[notify] Error en notifyEngineeringCompleted:", err);
  }
}

import { NotificationType, TraspasoTipo } from "@prisma/client";

import { prisma } from "../../lib/prisma.js";
import { createNotification } from "../notification.service.js";
import { sendEmail } from "../email.service.js";
import { buildNotificacionMensaje } from "./catalogo.js";
import type { DestinatarioCalculado } from "./destinatarios.js";

type NotificarInput = {
  traspasoId: string;
  tipo: TraspasoTipo;
  projectId: string;
  projectName: string;
  nota?: string | null;
};

// Notifica a cada destinatario in-app + email interno. Best-effort: los errores
// por destinatario se loguean y no interrumpen al resto. Marca los flags
// notificadoInApp / notificadoEmail en cada TraspasoDestinatario ya persistido.
//
// Todos los destinatarios son usuarios internos (roles del sistema), así que el
// email va con type: 'internal' — el guardrail nunca deja que llegue a un cliente.
export async function notificarDestinatarios(
  input: NotificarInput,
  destinatarios: DestinatarioCalculado[],
): Promise<{ inApp: number; email: number }> {
  if (destinatarios.length === 0) return { inApp: 0, email: 0 };

  const { title, message } = buildNotificacionMensaje(input.tipo, input.projectName, input.nota);

  const users = await prisma.user.findMany({
    where: { id: { in: destinatarios.map((d) => d.usuarioId) } },
    select: { id: true, email: true },
  });
  const emailById = new Map(users.map((u) => [u.id, u.email]));

  let inAppCount = 0;
  let emailCount = 0;

  for (const dest of destinatarios) {
    let sentEmail = false;
    try {
      await createNotification({
        userId: dest.usuarioId,
        projectId: input.projectId,
        type: NotificationType.traspaso_asignado,
        title,
        message,
      });
      inAppCount++;

      const email = emailById.get(dest.usuarioId);
      if (email) {
        sentEmail = await sendEmail({
          to: email,
          subject: title,
          html: `<p>${message}</p><p>Entrá a Voltia PM para ver el detalle del traspaso.</p>`,
          text: message,
          type: "internal",
        });
        if (sentEmail) emailCount++;
      }
    } catch (err) {
      console.error(`[traspasos] fallo notificando a ${dest.usuarioId}:`, err);
    }

    try {
      await prisma.traspasoDestinatario.update({
        where: { traspasoId_usuarioId: { traspasoId: input.traspasoId, usuarioId: dest.usuarioId } },
        data: { notificadoInApp: true, notificadoEmail: sentEmail },
      });
    } catch (err) {
      console.error(`[traspasos] no se pudo marcar notificado ${dest.usuarioId}:`, err);
    }
  }

  return { inApp: inAppCount, email: emailCount };
}

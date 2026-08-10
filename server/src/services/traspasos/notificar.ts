import { NotificationType, TraspasoTipo } from "@prisma/client";

import { prisma } from "../../lib/prisma.js";
import { createNotification } from "../notification.service.js";
import { buildNotificacionMensaje } from "./catalogo.js";
import type { DestinatarioCalculado } from "./destinatarios.js";

type NotificarInput = {
  traspasoId: string;
  tipo: TraspasoTipo;
  projectId: string;
  projectName: string;
  nota?: string | null;
};

// Notifica a cada destinatario SOLO in-app. El mail por evento se eliminó para
// bajar el ruido: la novedad viaja al resumen diario (digest) que junta las
// notificaciones de las últimas 24h por persona. Best-effort: los errores por
// destinatario se loguean y no interrumpen al resto. Marca notificadoInApp en
// cada TraspasoDestinatario ya persistido (notificadoEmail queda false).
export async function notificarDestinatarios(
  input: NotificarInput,
  destinatarios: DestinatarioCalculado[],
): Promise<{ inApp: number; email: number }> {
  if (destinatarios.length === 0) return { inApp: 0, email: 0 };

  const { title, message } = buildNotificacionMensaje(input.tipo, input.projectName, input.nota);

  let inAppCount = 0;

  for (const dest of destinatarios) {
    try {
      await createNotification({
        userId: dest.usuarioId,
        projectId: input.projectId,
        type: NotificationType.traspaso_asignado,
        title,
        message,
      });
      inAppCount++;
    } catch (err) {
      console.error(`[traspasos] fallo notificando a ${dest.usuarioId}:`, err);
    }

    try {
      await prisma.traspasoDestinatario.update({
        where: { traspasoId_usuarioId: { traspasoId: input.traspasoId, usuarioId: dest.usuarioId } },
        data: { notificadoInApp: true, notificadoEmail: false },
      });
    } catch (err) {
      console.error(`[traspasos] no se pudo marcar notificado ${dest.usuarioId}:`, err);
    }
  }

  return { inApp: inAppCount, email: 0 };
}

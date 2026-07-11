import cron from "node-cron";
import { NotificationType } from "@prisma/client";

import { prisma } from "../../lib/prisma.js";
import { createNotificationByUniqueKey } from "../notification.service.js";
import { sendEmail } from "../email.service.js";

// Regla de Oro del aviso post-habilitación (§8.2 del protocolo).
// Cuando el trámite UTE finaliza (T8 setea Project.postHabilitacionInicioEn),
// Experiencia Solar debe avisar al Generador que ya puede encender en 24-48hs.
// Este job alerta INTERNAMENTE (no manda nada al cliente): a las 24hs recuerda
// al rol EXPERIENCIA_SOLAR; a las 48hs escala a ADMIN. Idempotente por
// uniqueKey. Deja de alertar cuando `avisoHabilitacionEn` queda seteado
// (lo hace CX al registrar la interacción de bitácora AVISO_HABILITACION).

const H24_MS = 24 * 60 * 60 * 1000;
const H48_MS = 48 * 60 * 60 * 1000;

async function usuariosPorRol(roleName: string): Promise<Array<{ id: string; email: string }>> {
  return prisma.user.findMany({
    where: { deletedAt: null, role: { name: roleName } },
    select: { id: true, email: true },
  });
}

async function alertar(
  destinatarios: Array<{ id: string; email: string }>,
  projectId: string,
  title: string,
  message: string,
  uniqueKey: string,
): Promise<boolean> {
  // Dedupe global por uniqueKey (una sola notificación de por vida por hito).
  // Como createNotificationByUniqueKey es por-fila, usamos una key por usuario.
  let created = false;
  for (const u of destinatarios) {
    const { created: c } = await createNotificationByUniqueKey({
      userId: u.id,
      projectId,
      type: NotificationType.aviso_habilitacion_pendiente,
      title,
      message,
      uniqueKey: `${uniqueKey}:${u.id}`,
    });
    if (c) {
      created = true;
      if (u.email) {
        await sendEmail({ to: u.email, subject: title, html: `<p>${message}</p>`, text: message, type: "internal" });
      }
    }
  }
  return created;
}

export async function chequearAvisosHabilitacion(
  now: Date = new Date(),
): Promise<{ checked: number; recordados: number; escalados: number }> {
  const pendientes = await prisma.project.findMany({
    where: { postHabilitacionInicioEn: { not: null }, avisoHabilitacionEn: null, deletedAt: null },
    select: { id: true, clientName: true, postHabilitacionInicioEn: true },
  });

  if (pendientes.length === 0) return { checked: 0, recordados: 0, escalados: 0 };

  const cx = await usuariosPorRol("EXPERIENCIA_SOLAR");
  const admins = await usuariosPorRol("ADMIN");

  let recordados = 0;
  let escalados = 0;

  for (const p of pendientes) {
    const elapsed = now.getTime() - p.postHabilitacionInicioEn!.getTime();
    try {
      if (elapsed >= H48_MS) {
        const title = `Aviso al Generador VENCIDO: ${p.clientName}`;
        const message =
          `El trámite UTE de "${p.clientName}" finalizó hace más de 48hs y todavía no se registró el aviso al Generador. ` +
          `Regla de Oro incumplida — Experiencia Solar debe contactar al Generador ya.`;
        if (await alertar(admins, p.id, title, message, `aviso-hab-48h:${p.id}`)) escalados++;
      } else if (elapsed >= H24_MS) {
        const title = `Avisá al Generador que puede encender: ${p.clientName}`;
        const message =
          `El trámite UTE de "${p.clientName}" finalizó hace más de 24hs. ` +
          `Contactá al Generador para avisarle que ya puede empezar a producir su energía y registralo en la bitácora.`;
        if (await alertar(cx, p.id, title, message, `aviso-hab-24h:${p.id}`)) recordados++;
      }
    } catch (err) {
      console.error(`[aviso-habilitacion] fallo en proyecto ${p.id}:`, err);
    }
  }

  return { checked: pendientes.length, recordados, escalados };
}

// Cron cada 3 horas (configurable). Precisión de horas para la ventana 24-48.
export function startAvisoHabilitacionJob() {
  const expr = process.env.CRON_AVISO_HABILITACION || "0 */3 * * *";
  return cron.schedule(expr, async () => {
    try {
      const r = await chequearAvisosHabilitacion();
      if (r.recordados > 0 || r.escalados > 0) {
        console.log(`[aviso-habilitacion] recordados ${r.recordados}, escalados ${r.escalados} de ${r.checked}`);
      }
    } catch (err) {
      console.error("[aviso-habilitacion] job error:", err);
    }
  });
}

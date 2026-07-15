import cron from "node-cron";
import { AuditAction, AuditEntityType, NotificationType, TraspasoEstado } from "@prisma/client";

import { prisma } from "../../lib/prisma.js";
import { createAuditEntry } from "../audit.service.js";
import { createNotification } from "../notification.service.js";
import { sendEmail } from "../email.service.js";
import { isOlderThanBusinessDays } from "../../utils/business-days.js";
import { TRASPASO_LABEL } from "./catalogo.js";

function getUmbralDiasHabiles(): number {
  const raw = Number(process.env.UMBRAL_ESCALACION_TRASPASO_DIAS_HABILES);
  return Number.isFinite(raw) && raw > 0 ? raw : 5;
}

// Busca traspasos PENDIENTE_CONFIRMACION detectados hace ≥ N días hábiles y sin
// confirmar, los pasa a ESCALADO y notifica a todos los ADMIN (in-app + email
// interno). Es la red de seguridad para que nada quede colgado sin acuse.
export async function escalarVencidos(): Promise<{ checked: number; escalated: number }> {
  const umbral = getUmbralDiasHabiles();
  const now = new Date();

  const pendientes = await prisma.traspaso.findMany({
    // Los pospuestos vigentes no escalan hasta que venza `pospuestoHasta`.
    where: {
      estado: TraspasoEstado.PENDIENTE_CONFIRMACION,
      OR: [{ pospuestoHasta: null }, { pospuestoHasta: { lte: now } }],
    },
    include: {
      project: { select: { id: true, clientName: true } },
      modalUsuario: { select: { name: true } },
    },
  });

  const vencidos = pendientes.filter((t) => isOlderThanBusinessDays(t.condicionDetectadaEn, umbral, now));
  if (vencidos.length === 0) return { checked: pendientes.length, escalated: 0 };

  const admins = await prisma.user.findMany({
    where: { deletedAt: null, role: { name: "ADMIN" } },
    select: { id: true, email: true },
  });

  for (const t of vencidos) {
    try {
      await prisma.traspaso.update({
        where: { id: t.id },
        data: { estado: TraspasoEstado.ESCALADO, escaladoEn: now },
      });

      const title = `Traspaso sin confirmar: ${TRASPASO_LABEL[t.tipo]}`;
      const message =
        `El traspaso "${TRASPASO_LABEL[t.tipo]}" del proyecto "${t.project.clientName}" ` +
        `lleva más de ${umbral} días hábiles sin confirmar (responsable: ${t.modalUsuario.name}).`;

      for (const admin of admins) {
        await createNotification({
          userId: admin.id,
          projectId: t.project.id,
          type: NotificationType.traspaso_escalado,
          title,
          message,
        });
        if (admin.email) {
          await sendEmail({ to: admin.email, subject: title, html: `<p>${message}</p>`, text: message, type: "internal" });
        }
      }

      await createAuditEntry({
        entityType: AuditEntityType.traspaso,
        entityId: t.id,
        projectId: t.project.id,
        userId: t.modalUsuarioId,
        action: AuditAction.traspaso_escalado,
        description: `Escalado a ADMIN por ${umbral} días hábiles sin confirmar.`,
      });
    } catch (err) {
      console.error(`[traspasos-escalacion] fallo escalando ${t.id}:`, err);
    }
  }

  return { checked: pendientes.length, escalated: vencidos.length };
}

// Cron: días hábiles a las 07:00 (configurable con CRON_ESCALACION).
export function startTraspasosEscalacionJob() {
  const expr = process.env.CRON_ESCALACION || "0 7 * * 1-5";
  return cron.schedule(expr, async () => {
    try {
      const result = await escalarVencidos();
      if (result.escalated > 0) {
        console.log(`[traspasos-escalacion] escalados ${result.escalated}/${result.checked}`);
      }
    } catch (err) {
      console.error("[traspasos-escalacion] job error:", err);
    }
  });
}

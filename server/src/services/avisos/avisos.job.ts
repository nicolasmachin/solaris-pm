/**
 * Jobs de los avisos automáticos:
 *  - cada 15 minutos, si hay plantillas en revisión, pregunta a Meta si ya las
 *    aprobó (también detecta si Meta pausó o rechazó una activa);
 *  - todas las mañanas, los avisos "faltan N días para la obra".
 * Kill switch: AVISOS_AUTOMATICOS=false.
 */

import cron from "node-cron";

import { prisma } from "../../lib/prisma.js";
import { refrescarPlantillas } from "./avisos.service.js";
import { avisosHabilitados, mandarAviso } from "./emitir.js";

const DIA_MS = 24 * 60 * 60 * 1000;

/** Hoy en Uruguay, como fecha UTC a la medianoche (igual que las @db.Date). */
function hoyUruguay(ahora = new Date()): Date {
  const local = new Date(ahora.getTime() - 3 * 60 * 60 * 1000);
  return new Date(Date.UTC(local.getUTCFullYear(), local.getUTCMonth(), local.getUTCDate()));
}

/** Manda los avisos de "faltan N días para la obra" de hoy. */
export async function avisosObraProxima(ahora = new Date()) {
  const avisos = await prisma.avisoAutomatico.findMany({
    where: { disparador: "obra.proxima", estado: "ACTIVO", deletedAt: null, dias: { not: null } },
  });
  let mandados = 0;
  for (const aviso of avisos) {
    const objetivo = new Date(hoyUruguay(ahora).getTime() + aviso.dias! * DIA_MS);
    // Obras confirmadas con algún tramo ese día; se queda con las que ARRANCAN ese día.
    const obras = await prisma.installationSchedule.findMany({
      where: {
        deletedAt: null,
        confirmedAt: { not: null },
        segments: { some: { startDate: objetivo } },
      },
      select: { projectId: true, segments: { select: { startDate: true } } },
    });
    for (const o of obras) {
      const primero = Math.min(...o.segments.map((s) => s.startDate.getTime()));
      if (primero !== objetivo.getTime()) continue;
      const r = await mandarAviso(aviso, {
        disparador: "obra.proxima",
        projectId: o.projectId,
        ref: objetivo.toISOString().slice(0, 10),
        ocurrioEn: ahora,
      }).catch((err) => console.error("[avisos] obra próxima:", err instanceof Error ? err.message : err));
      if (r?.estado === "ENVIADO") mandados++;
    }
  }
  return mandados;
}

export function startAvisosJobs() {
  const plantillas = cron.schedule(
    process.env.CRON_AVISOS_PLANTILLAS || "*/15 * * * *",
    async () => {
      try {
        const enRevision = await prisma.avisoAutomatico.count({
          where: { deletedAt: null, canal: "WHATSAPP", estado: { in: ["EN_REVISION", "ACTIVO", "LISTO"] } },
        });
        if (enRevision > 0) await refrescarPlantillas();
      } catch (err) {
        console.error("[avisos] estado de plantillas:", err instanceof Error ? err.message : err);
      }
    },
    { timezone: "America/Montevideo" },
  );
  const diario = cron.schedule(
    process.env.CRON_AVISOS_DIARIO || "0 9 * * *",
    async () => {
      if (!avisosHabilitados()) return;
      try {
        const n = await avisosObraProxima();
        if (n > 0) console.log(`[avisos] obra próxima: ${n} enviados`);
      } catch (err) {
        console.error("[avisos] obra próxima:", err instanceof Error ? err.message : err);
      }
    },
    { timezone: "America/Montevideo" },
  );
  return { plantillas, diario };
}

import cron from "node-cron";
import { TraspasoEstado } from "@prisma/client";

import { prisma } from "../../lib/prisma.js";
import { sendEmail } from "../email.service.js";
import { TRASPASO_LABEL } from "./catalogo.js";

async function getAdmins(): Promise<Array<{ email: string }>> {
  const admins = await prisma.user.findMany({
    where: { deletedAt: null, role: { name: "ADMIN" }, email: { not: "" } },
    select: { email: true },
  });
  return admins;
}

async function enviarAAdmins(subject: string, html: string, text: string): Promise<number> {
  const admins = await getAdmins();
  let sent = 0;
  for (const a of admins) {
    const ok = await sendEmail({ to: a.email, subject, html, text, type: "internal" });
    if (ok) sent++;
  }
  return sent;
}

function formatDateEs(date: Date): string {
  return date.toLocaleDateString("es-UY", { day: "2-digit", month: "long", year: "numeric" });
}

// Reporte DIARIO: solo se envía si hay traspasos que escalaron en las últimas
// 24 hs. Si no hay nada, no molesta a nadie.
export async function reporteDiarioAdmin(now: Date = new Date()): Promise<{ sent: number; count: number }> {
  const desde = new Date(now.getTime() - 24 * 60 * 60 * 1000);
  const escalados = await prisma.traspaso.findMany({
    where: { estado: TraspasoEstado.ESCALADO, escaladoEn: { gte: desde, lte: now } },
    include: {
      project: { select: { clientName: true } },
      modalUsuario: { select: { name: true } },
    },
    orderBy: { escaladoEn: "asc" },
  });

  if (escalados.length === 0) return { sent: 0, count: 0 };

  const filas = escalados
    .map(
      (t) =>
        `<li><b>${TRASPASO_LABEL[t.tipo]}</b> — ${t.project.clientName} — responsable: ${t.modalUsuario.name}</li>`,
    )
    .join("");
  const subject = `[Voltia PM] Traspasos escalados hoy (${escalados.length})`;
  const html = `<p>Traspasos que escalaron por falta de confirmación en las últimas 24 hs:</p><ul>${filas}</ul>`;
  const text = `${escalados.length} traspaso(s) escalados en las últimas 24 hs.`;

  const sent = await enviarAAdmins(subject, html, text);
  return { sent, count: escalados.length };
}

// Reporte SEMANAL: resumen completo de la semana (todos los estados) con métricas.
export async function reporteSemanalAdmin(now: Date = new Date()): Promise<{ sent: number; total: number }> {
  const desde = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
  const traspasos = await prisma.traspaso.findMany({
    where: { createdAt: { gte: desde, lte: now } },
    select: { estado: true, condicionDetectadaEn: true, confirmadoEn: true },
  });

  const total = traspasos.length;
  const confirmados = traspasos.filter((t) => t.confirmadoEn !== null);
  const escalados = traspasos.filter((t) => t.estado === TraspasoEstado.ESCALADO).length;
  const pendientes = traspasos.filter((t) => t.estado === TraspasoEstado.PENDIENTE_CONFIRMACION).length;

  let horasPromedio = 0;
  if (confirmados.length > 0) {
    const totalMs = confirmados.reduce(
      (acc, t) => acc + (t.confirmadoEn!.getTime() - t.condicionDetectadaEn.getTime()),
      0,
    );
    horasPromedio = totalMs / confirmados.length / (1000 * 60 * 60);
  }

  const subject = `[Voltia PM] Resumen semanal de traspasos`;
  const html =
    `<p>Semana del ${formatDateEs(desde)} al ${formatDateEs(now)}:</p>` +
    `<ul>` +
    `<li>Total disparados: <b>${total}</b></li>` +
    `<li>Confirmados: <b>${confirmados.length}</b></li>` +
    `<li>Tiempo promedio de confirmación: <b>${horasPromedio.toFixed(1)} h</b></li>` +
    `<li>Pendientes: <b>${pendientes}</b></li>` +
    `<li>Escalados: <b>${escalados}</b></li>` +
    `</ul>`;
  const text = `Semanal: ${total} total, ${confirmados.length} confirmados, ${escalados} escalados, ${pendientes} pendientes.`;

  const sent = await enviarAAdmins(subject, html, text);
  return { sent, total };
}

// Cron: solo el resumen SEMANAL lunes 08:00 (configurable). El reporte DIARIO de
// escalados se descontinuó: las escalaciones ya llegan a cada ADMIN como
// notificación in-app y viajan en su resumen diario (digest). El semanal se
// mantiene porque es analítico (métricas de la semana), no una repetición de
// eventos. `reporteDiarioAdmin` queda disponible por si se quiere invocar a mano.
export function startTraspasosReportesJobs() {
  const jobs: cron.ScheduledTask[] = [];
  jobs.push(
    cron.schedule(process.env.CRON_REPORTE_SEMANAL || "0 8 * * 1", async () => {
      try {
        const r = await reporteSemanalAdmin();
        console.log(`[traspasos-reporte-semanal] ${r.total} traspasos, enviado a ${r.sent} admins`);
      } catch (err) {
        console.error("[traspasos-reporte-semanal] job error:", err);
      }
    }),
  );
  return jobs;
}

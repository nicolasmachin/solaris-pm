// Crons mensuales del ciclo de reportes fotovoltaicos.
//
// Tres jobs escalonados a lo largo del mes, cada uno una función pura testeable
// (recibe `now`) + un wrapper `startX()` con la expresión cron por env:
//
//   Ingesta (días 2,4,6)  → trae los datos de Growatt del mes anterior. Los días
//                           4 y 6 sólo reintentan lo incompleto (skip inteligente).
//   Emisión (día 7)       → recalcula y genera los PDF de los que están completos;
//                           notifica al equipo el resumen del mes.
//   Envío   (día 9)       → DESACTIVADO por default. El envío arranca con
//                           aprobación humana (primer mail saliente del sistema,
//                           datos económicos con la marca). Se prende con
//                           REPORTES_FV_ENVIO_AUTO=true cuando el pipeline esté
//                           probado unos meses.

import cron from "node-cron";
import { ReporteFvIngestaModo } from "@prisma/client";

import { prisma } from "../../lib/prisma.js";
import { sendEmail } from "../email.service.js";
import { listarConfigsEfectivas } from "./config.service.js";
import { generarEmision } from "./emision.service.js";
import { enviarLote } from "./envio.service.js";
import { ingerirPeriodoSincrono } from "./growatt/ingesta.service.js";
import { mesEs } from "./format.js";
import { dateAPeriodo, type Periodo, periodoADate, periodoMesAnterior } from "./periodo.js";

/** Actor de los jobs: el primer ADMIN activo (no hay usuario de sistema). */
async function usuarioSistema(): Promise<string | null> {
  const admin = await prisma.user.findFirst({
    where: { deletedAt: null, role: { name: "ADMIN" } },
    orderBy: { createdAt: "asc" },
    select: { id: true },
  });
  return admin?.id ?? null;
}

// ─── Ingesta mensual ──────────────────────────────────────────────────────────

export async function ejecutarIngestaMensual(now: Date = new Date()): Promise<{ periodo: Periodo; ingestaId: string } | null> {
  const periodo = periodoMesAnterior(now);
  const userId = (await usuarioSistema()) ?? undefined;
  const ingestaId = await ingerirPeriodoSincrono({
    periodo,
    modo: ReporteFvIngestaModo.CRON,
    userId,
  });
  return { periodo, ingestaId };
}

export function startReportesFvIngestaJob() {
  const expr = process.env.CRON_REPORTES_FV_INGESTA || "0 6 2,4,6 * *";
  return cron.schedule(expr, async () => {
    try {
      const r = await ejecutarIngestaMensual();
      if (r) console.log(`[reportes-fv] ingesta mensual de ${r.periodo} completa (${r.ingestaId})`);
    } catch (err) {
      console.error("[reportes-fv] ingesta mensual error:", err);
    }
  });
}

// ─── Emisión mensual ──────────────────────────────────────────────────────────

export interface ResumenEmision {
  periodo: Periodo;
  generados: number;
  yaEmitidos: number;
  esperandoDatos: number;
  bloqueados: number;
  errores: number;
}

export async function ejecutarEmisionMensual(
  now: Date = new Date(),
  opts: { projectIds?: string[]; notificar?: boolean } = {},
): Promise<ResumenEmision> {
  const periodo = periodoMesAnterior(now);
  const userId = await usuarioSistema();
  const resumen: ResumenEmision = {
    periodo,
    generados: 0,
    yaEmitidos: 0,
    esperandoDatos: 0,
    bloqueados: 0,
    errores: 0,
  };
  if (!userId) return resumen;

  let configs = await listarConfigsEfectivas({ soloHabilitados: true });
  if (opts.projectIds) configs = configs.filter((c) => opts.projectIds!.includes(c.projectId));
  const fecha = periodoADate(periodo);

  for (const config of configs) {
    // Bloqueos de cálculo → no se puede emitir.
    if (config.bloqueosCalculo.length > 0) {
      resumen.bloqueados++;
      continue;
    }

    // ¿Tiene lectura completa del mes?
    const lectura = await prisma.reporteFvLectura.findUnique({
      where: { projectId_periodo: { projectId: config.projectId, periodo: fecha } },
      select: { generacionKwh: true, consumoKwh: true, exportacionKwh: true },
    });
    if (!lectura || lectura.generacionKwh == null || lectura.consumoKwh == null || lectura.exportacionKwh == null) {
      resumen.esperandoDatos++;
      continue;
    }

    // ¿Ya hay una emisión de este mes? (no regenerar cada corrida)
    const yaEmitida = await prisma.reporteFvEmision.findFirst({
      where: { projectId: config.projectId, periodo: fecha },
      select: { id: true },
    });
    if (yaEmitida) {
      resumen.yaEmitidos++;
      continue;
    }

    try {
      await generarEmision(config.projectId, periodo, userId);
      resumen.generados++;
    } catch {
      resumen.errores++;
    }
  }

  if (opts.notificar !== false) await notificarResumen(resumen);
  return resumen;
}

async function notificarResumen(r: ResumenEmision): Promise<void> {
  // Sólo se avisa si hubo algo que emitir o algo pendiente que revisar.
  if (r.generados === 0 && r.esperandoDatos === 0 && r.bloqueados === 0) return;

  const equipo = await prisma.user.findMany({
    where: { deletedAt: null, role: { name: { in: ["EXPERIENCIA_SOLAR", "ADMIN"] } } },
    select: { email: true },
  });
  const destinatarios = [...new Set(equipo.map((u) => u.email))];
  if (destinatarios.length === 0) return;

  const mes = mesEs(r.periodo);
  const html =
    `<p>Los reportes fotovoltaicos de <strong>${mes}</strong> están listos para revisar y enviar.</p>` +
    `<ul>` +
    `<li><strong>${r.generados}</strong> reportes generados${r.yaEmitidos ? ` (+${r.yaEmitidos} ya estaban)` : ""}</li>` +
    (r.esperandoDatos ? `<li><strong>${r.esperandoDatos}</strong> esperando carga de datos del mes</li>` : "") +
    (r.bloqueados ? `<li><strong>${r.bloqueados}</strong> con la configuración incompleta</li>` : "") +
    (r.errores ? `<li><strong>${r.errores}</strong> con error al generar</li>` : "") +
    `</ul>` +
    `<p>Entrá al panel de Reportes FV en Experiencia Solar para revisarlos y enviarlos.</p>`;

  // internal: el guardrail valida que todos sean usuarios de Voltia (lo son).
  await sendEmail({
    to: destinatarios,
    subject: `Reportes fotovoltaicos de ${mes} listos para enviar`,
    html,
    type: "internal",
  }).catch((err) => console.error("[reportes-fv] no se pudo notificar el resumen:", err));
}

export function startReportesFvEmisionJob() {
  const expr = process.env.CRON_REPORTES_FV_EMISION || "0 8 7 * *";
  return cron.schedule(expr, async () => {
    try {
      const r = await ejecutarEmisionMensual();
      if (r.generados > 0 || r.esperandoDatos > 0) {
        console.log(
          `[reportes-fv] emisión mensual de ${r.periodo}: ${r.generados} generados, ` +
            `${r.esperandoDatos} esperando datos, ${r.bloqueados} bloqueados, ${r.errores} errores`,
        );
      }
    } catch (err) {
      console.error("[reportes-fv] emisión mensual error:", err);
    }
  });
}

// ─── Envío mensual (desactivado por default) ──────────────────────────────────

export async function ejecutarEnvioMensual(now: Date = new Date()): Promise<{ periodo: Periodo; resumen: Record<string, number> } | null> {
  const userId = await usuarioSistema();
  if (!userId) return null;
  const periodo = periodoMesAnterior(now);
  const { resumen } = await enviarLote(periodo, { userId });
  return { periodo, resumen };
}

export function startReportesFvEnvioJob() {
  const expr = process.env.CRON_REPORTES_FV_ENVIO || "0 12 9 * *";
  return cron.schedule(expr, async () => {
    // El envío automático está apagado hasta que el pipeline lleve unos meses
    // estable. Mientras, el envío es manual desde el panel.
    if (process.env.REPORTES_FV_ENVIO_AUTO !== "true") return;
    try {
      const r = await ejecutarEnvioMensual();
      if (r) {
        console.log(`[reportes-fv] envío mensual de ${r.periodo}: ${JSON.stringify(r.resumen)}`);
      }
    } catch (err) {
      console.error("[reportes-fv] envío mensual error:", err);
    }
  });
}

/** Arranca los tres crons del módulo. Llamado desde index.ts. */
export function startReportesFvJobs() {
  startReportesFvIngestaJob();
  startReportesFvEmisionJob();
  startReportesFvEnvioJob();
}

// Helper de periodo para tests que quieran el mes anterior de una fecha.
export function periodoDeReporte(now: Date): Periodo {
  return dateAPeriodo(new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - 1, 1)));
}

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
import { enviarPendientes } from "./pendientes.service.js";
import { ingerirPeriodoSincrono } from "./growatt/ingesta.service.js";
import { ingerirPeriodoHuawei } from "./huawei/ingesta.service.js";
import { mesEs, periodoTextoCorto } from "./format.js";
import {
  dateAPeriodo,
  hoyUruguay,
  type Periodo,
  periodoADate,
  periodoCerrado,
  periodoMesAnterior,
  rangoDelPeriodo,
  sumarMeses,
} from "./periodo.js";

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

  // Las plantas Huawei corren después y por separado: son otra API, escriben en
  // las mismas lecturas y no comparten el registro de corrida (ReporteFvIngesta
  // cuenta plantas de Growatt). Que falle FusionSolar no puede tumbar la ingesta
  // de las ~150 plantas Growatt, que es el grueso.
  try {
    const h = await ingerirPeriodoHuawei(periodo);
    if (h.plantas) {
      console.log(
        `[reportes-fv] Huawei ${periodo}: ${h.guardadas} guardadas, ${h.omitidas} omitidas de ${h.plantas}`,
      );
    }
  } catch (err) {
    console.error("[reportes-fv] ingesta Huawei error:", err);
  }

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
  opts: {
    projectIds?: string[];
    notificar?: boolean;
    /** Período a emitir. Por defecto el mes anterior, que es lo que hace el cron. */
    periodo?: Periodo;
    /** Regenerar los que ya tienen PDF. El cron nunca lo hace; el panel sí. */
    forzar?: boolean;
    /** Quién dispara. Sin esto se usa el usuario de sistema (el cron). */
    userId?: string;
  } = {},
): Promise<ResumenEmision> {
  const periodo = opts.periodo ?? periodoMesAnterior(now);
  const userId = opts.userId ?? (await usuarioSistema());
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
    if (yaEmitida && !opts.forzar) {
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

  const destinatarios = await destinatariosEquipo();
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

/** Quiénes reciben los avisos internos del módulo. */
async function destinatariosEquipo(): Promise<string[]> {
  const equipo = await prisma.user.findMany({
    where: {
      deletedAt: null,
      role: { name: { in: ["EXPERIENCIA_SOLAR", "ADMIN"] } },
      email: { not: null },
    },
    select: { email: true },
  });
  return [...new Set(equipo.map((u) => u.email).filter((e): e is string => !!e))];
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

// ─── Ciclos del medidor (diario) ──────────────────────────────────────────────
//
// Los crons de arriba trabajan sobre el mes anterior, que es lo que cierra para
// los clientes sin día de corte. Un cliente con corte cierra su ciclo en otro
// momento del mes (corte 6 → el 6), y esperando al cron mensual su reporte se
// atrasaba casi un mes. Este job corre todos los días y, para cada cliente con
// corte, replica el mismo calendario contado desde el cierre de SU ciclo:
// trae datos entre los días 2 y 6 después del cierre (sólo lo incompleto) y
// genera el PDF desde el día 7. Nunca envía.

const INGESTA_DESDE = 2;
const INGESTA_HASTA = 6;
const EMISION_DESDE = 7;
// Pasado este margen el ciclo ya lo levanta el cron mensual (o el panel).
const EMISION_HASTA = 25;

export interface ResumenCiclos {
  ingeridos: number;
  emitidos: string[];
}

export async function ejecutarCiclosDelMedidor(now: Date = new Date()): Promise<ResumenCiclos> {
  const resumen: ResumenCiclos = { ingeridos: 0, emitidos: [] };
  const userId = await usuarioSistema();
  if (!userId) return resumen;

  const hoy = hoyUruguay(now);
  const mesHoy = dateAPeriodo(new Date(`${hoy}T00:00:00.000Z`));
  const configs = (await listarConfigsEfectivas({ soloHabilitados: true })).filter(
    (c) => c.diaCorteMedidor != null,
  );

  // Agrupados por período para lanzar una sola ingesta por período.
  const aIngerir = new Map<Periodo, string[]>();
  const aEmitir = new Map<Periodo, string[]>();
  for (const c of configs) {
    // El último ciclo cerrado: el del mes en curso si su corte ya pasó, si no
    // el del mes anterior.
    const periodo = periodoCerrado(mesHoy, c.diaCorteMedidor, now) ? mesHoy : sumarMeses(mesHoy, -1);
    const cierre = rangoDelPeriodo(periodo, c.diaCorteMedidor).hasta;
    const dias = Math.round(
      (new Date(`${hoy}T00:00:00.000Z`).getTime() - new Date(`${cierre}T00:00:00.000Z`).getTime()) / 86_400_000,
    );
    if (dias >= INGESTA_DESDE && dias <= INGESTA_HASTA) {
      aIngerir.set(periodo, [...(aIngerir.get(periodo) ?? []), c.projectId]);
    } else if (dias >= EMISION_DESDE && dias <= EMISION_HASTA) {
      aEmitir.set(periodo, [...(aEmitir.get(periodo) ?? []), c.projectId]);
    }
  }

  for (const [periodo, projectIds] of aIngerir) {
    // Saltea sola a los que ya tienen la lectura completa.
    await ingerirPeriodoSincrono({ periodo, modo: ReporteFvIngestaModo.CRON, projectIds, userId });
    resumen.ingeridos += projectIds.length;
  }

  const inicio = new Date();
  for (const [periodo, projectIds] of aEmitir) {
    // Sin forzar: sólo los que todavía no tienen PDF y ya tienen datos.
    await ejecutarEmisionMensual(now, { periodo, projectIds, notificar: false, userId });
  }
  if (aEmitir.size > 0) {
    const nuevas = await prisma.reporteFvEmision.findMany({
      where: { generadoEn: { gte: inicio }, projectId: { in: configs.map((c) => c.projectId) } },
      select: { projectId: true, periodo: true },
    });
    const corte = new Map(configs.map((c) => [c.projectId, c]));
    resumen.emitidos = nuevas.map((e) => {
      const c = corte.get(e.projectId)!;
      return `${c.clientName} (${periodoTextoCorto(dateAPeriodo(e.periodo), c.diaCorteMedidor)})`;
    });
  }

  if (resumen.emitidos.length > 0) {
    const destinatarios = await destinatariosEquipo();
    if (destinatarios.length > 0) {
      await sendEmail({
        to: destinatarios,
        subject: "Reportes fotovoltaicos nuevos listos para enviar",
        html:
          `<p>Se generaron reportes de clientes con día de corte del medidor que cerraron su ciclo:</p>` +
          `<ul>${resumen.emitidos.map((n) => `<li>${n}</li>`).join("")}</ul>` +
          `<p>Entrá a Reportes FV en Experiencia Solar para revisarlos y enviarlos.</p>`,
        type: "internal",
      }).catch((err) => console.error("[reportes-fv] no se pudo notificar los ciclos:", err));
    }
  }
  return resumen;
}

export function startReportesFvCiclosJob() {
  const expr = process.env.CRON_REPORTES_FV_CICLOS || "30 7 * * *";
  return cron.schedule(
    expr,
    async () => {
      try {
        const r = await ejecutarCiclosDelMedidor();
        if (r.ingeridos || r.emitidos.length) {
          console.log(`[reportes-fv] ciclos del medidor: ${r.ingeridos} ingeridos, emitidos: ${r.emitidos.join(", ")}`);
        }
      } catch (err) {
        console.error("[reportes-fv] ciclos del medidor error:", err);
      }
    },
    { timezone: "America/Montevideo" },
  );
}

// ─── Envío mensual (desactivado por default) ──────────────────────────────────

export async function ejecutarEnvioMensual(now: Date = new Date()): Promise<{ hasta: string; resumen: Record<string, number> } | null> {
  const userId = await usuarioSistema();
  if (!userId) return null;
  // Mismo criterio que el panel: todo lo pendiente cuyo período cerró antes de hoy.
  const hasta = hoyUruguay(now);
  const { resumen } = await enviarPendientes(hasta, { userId });
  return { hasta, resumen };
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
        console.log(`[reportes-fv] envío de pendientes al ${r.hasta}: ${JSON.stringify(r.resumen)}`);
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
  startReportesFvCiclosJob();
}

// Helper de periodo para tests que quieran el mes anterior de una fecha.
export function periodoDeReporte(now: Date): Periodo {
  return dateAPeriodo(new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - 1, 1)));
}

// Reportes pendientes de envío, por fecha de corte y no por mes.
//
// Con clientes que tienen día de corte, agrupar el envío por "mes" confundía:
// dentro de "agosto" había ciclos que arrancaban en julio, y el ciclo de un
// cliente con corte temprano quedaba colgado hasta el mes siguiente. El envío
// se piensa así: se elige una fecha de corte (hoy, por defecto) y se manda todo
// reporte generado cuyo período cerró antes de esa fecha y que el cliente
// todavía no recibió. Si un cliente tiene dos pendientes (un mes que quedó sin
// mandar + el actual), recibe los dos, cada uno en su mail.

import { ReporteFvEmisionEstado, ReporteFvFuente, ReporteFvIngestaModo } from "@prisma/client";

import { prisma } from "../../lib/prisma.js";
import { listarConfigsEfectivas } from "./config.service.js";
import { generarEmision } from "./emision.service.js";
import { enviarEmision, type ResultadoEnvio } from "./envio.service.js";
import { periodoTextoCorto } from "./format.js";
import { ingerirPeriodoSincrono } from "./growatt/ingesta.service.js";
import { dateAPeriodo, type Periodo, rangoDelPeriodo } from "./periodo.js";

export interface PendienteEnvio {
  emisionId: string;
  projectId: string;
  cliente: string;
  periodo: Periodo;
  /** "7 jul al 6 ago 2026" — lo que dice el PDF. */
  periodoTexto: string;
  /** Último día que cubre el reporte, YYYY-MM-DD. */
  cierre: string;
  version: number;
  generadoEn: string;
  diaCorteMedidor: number | null;
  destinatarios: string[];
  /** Motivos por los que el envío lo va a saltear (vacío = sale). */
  bloqueosEnvio: string[];
  /**
   * El PDF se generó antes de que el reporte mostrara el período en días.
   * Conviene regenerarlo antes de mandarlo.
   */
  formatoViejo: boolean;
}

/**
 * Todo lo generado y sin enviar cuyo período cerró antes de `hasta` (exclusive).
 * De cada generador y período se toma la última versión, y sólo si nunca se
 * mandó ninguna versión de ese período.
 */
export async function listarPendientes(hasta: string): Promise<PendienteEnvio[]> {
  const emisiones = await prisma.reporteFvEmision.findMany({
    where: {
      estado: { not: ReporteFvEmisionEstado.ANULADO },
      project: { deletedAt: null },
    },
    select: {
      id: true,
      projectId: true,
      periodo: true,
      version: true,
      estado: true,
      generadoEn: true,
      snapshotJson: true,
      project: { select: { clientName: true } },
    },
    orderBy: [{ projectId: "asc" }, { periodo: "asc" }, { version: "desc" }],
  });

  // Config efectiva (no la tabla cruda): los destinatarios caen al mail del
  // cliente del proyecto cuando no hay ninguno cargado, igual que al enviar.
  const configs = new Map(
    (await listarConfigsEfectivas({ soloHabilitados: true })).map((c) => [c.projectId, c]),
  );

  const clave = (e: { projectId: string; periodo: Date }) => `${e.projectId}|${dateAPeriodo(e.periodo)}`;
  const enviados = new Set(
    emisiones.filter((e) => e.estado === ReporteFvEmisionEstado.ENVIADO).map(clave),
  );

  const vistos = new Set<string>();
  const pendientes: PendienteEnvio[] = [];
  for (const e of emisiones) {
    const k = clave(e);
    if (vistos.has(k)) continue; // ya se tomó la última versión
    vistos.add(k);
    if (e.estado !== ReporteFvEmisionEstado.LISTO || enviados.has(k)) continue;

    const config = configs.get(e.projectId);
    if (!config) continue; // deshabilitado o sin config

    const periodo = dateAPeriodo(e.periodo);
    const rango = rangoDelPeriodo(periodo, config.diaCorteMedidor);
    if (rango.hasta >= hasta) continue; // todavía no cerró a la fecha de corte

    const snapshot = e.snapshotJson as { periodoCorto?: string } | null;
    pendientes.push({
      emisionId: e.id,
      projectId: e.projectId,
      cliente: e.project.clientName,
      periodo,
      periodoTexto: periodoTextoCorto(periodo, config.diaCorteMedidor),
      cierre: rango.hasta,
      version: e.version,
      generadoEn: e.generadoEn.toISOString(),
      diaCorteMedidor: config.diaCorteMedidor,
      destinatarios: config.destinatarios.map((d) => d.email),
      bloqueosEnvio: config.bloqueosEnvio,
      formatoViejo: !snapshot?.periodoCorto,
    });
  }

  return pendientes.sort(
    (a, b) => a.cliente.localeCompare(b.cliente, "es") || a.cierre.localeCompare(b.cierre),
  );
}

export interface ResultadoRegeneracion {
  regenerados: number;
  reingeridos: number;
  errores: Array<{ cliente: string; periodo: Periodo; motivo: string }>;
}

/**
 * Vuelve a generar el PDF de cada pendiente (crea una versión nueva; la anterior
 * queda guardada). No manda nada.
 *
 * Para los clientes con día de corte, antes vuelve a traer los datos del
 * período de Growatt: si la lectura se tomó cuando el cliente todavía no tenía
 * el corte cargado, cubre el mes calendario y no su ciclo (le pasó a Percovich
 * en julio de 2026). Las lecturas cargadas a mano no se pisan.
 */
export async function regenerarPendientes(hasta: string, userId: string): Promise<ResultadoRegeneracion> {
  const pendientes = await listarPendientes(hasta);
  const resultado: ResultadoRegeneracion = { regenerados: 0, reingeridos: 0, errores: [] };

  for (const p of pendientes) {
    try {
      if (p.diaCorteMedidor != null && (await lecturaEsDeGrowatt(p.projectId, p.periodo))) {
        await ingerirPeriodoSincrono({
          periodo: p.periodo,
          modo: ReporteFvIngestaModo.MANUAL,
          projectIds: [p.projectId],
          force: true,
          userId,
        });
        resultado.reingeridos++;
      }
      await generarEmision(p.projectId, p.periodo, userId);
      resultado.regenerados++;
    } catch (err) {
      resultado.errores.push({
        cliente: p.cliente,
        periodo: p.periodo,
        motivo: err instanceof Error ? err.message : String(err),
      });
    }
  }
  return resultado;
}

async function lecturaEsDeGrowatt(projectId: string, periodo: Periodo): Promise<boolean> {
  const lectura = await prisma.reporteFvLectura.findFirst({
    where: { projectId, periodo: new Date(`${periodo}-01T00:00:00.000Z`) },
    select: { generacionFuente: true, consumoFuente: true },
  });
  if (!lectura) return true;
  return lectura.generacionFuente !== ReporteFvFuente.MANUAL && lectura.consumoFuente !== ReporteFvFuente.MANUAL;
}

/**
 * Manda (o simula, con dryRun) todos los pendientes a la fecha de corte. Cada
 * reporte pasa por las guardas de `enviarEmision`: los que no las cumplen
 * quedan OMITIDO con el motivo, sin cortar el resto.
 */
export async function enviarPendientes(
  hasta: string,
  opts: { dryRun?: boolean; userId: string; emisionIds?: string[] },
): Promise<{ resultados: Array<ResultadoEnvio & { cliente: string; periodoTexto: string }>; resumen: Record<string, number> }> {
  let pendientes = await listarPendientes(hasta);
  if (opts.emisionIds) pendientes = pendientes.filter((p) => opts.emisionIds!.includes(p.emisionId));

  const resultados: Array<ResultadoEnvio & { cliente: string; periodoTexto: string }> = [];
  for (const p of pendientes) {
    const r = await enviarEmision(p.emisionId, { dryRun: opts.dryRun, userId: opts.userId });
    resultados.push({ ...r, cliente: p.cliente, periodoTexto: p.periodoTexto });
  }

  const resumen: Record<string, number> = {};
  for (const r of resultados) resumen[r.estado] = (resumen[r.estado] ?? 0) + 1;
  return { resultados, resumen };
}

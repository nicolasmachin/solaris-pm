// Envío del reporte al cliente por email, con el PDF adjunto.
//
// Es el PRIMER email saliente a clientes externos del sistema (encuestas,
// tickets y avisos son todos in-app), así que arranca con aprobación humana: lo
// dispara una persona desde el panel, no un cron.
//
// Idempotencia: un claim transaccional sobre `ReporteFvEmision.enviadoEn` impide
// que dos procesos concurrentes (o dos clicks) manden el mismo reporte dos
// veces. Cada intento —incluidos dry-run y omitidos— queda en `ReporteFvEnvio`.

import { EmailStatus, ReporteFvEmisionEstado, ReporteFvEnvioEstado } from "@prisma/client";

import { prisma } from "../../lib/prisma.js";
import { AuditAction, AuditEntityType } from "@prisma/client";
import { createAuditEntry } from "../audit.service.js";
import { badRequest, notFound } from "../../utils/errors.js";
import { getStoredFilePath } from "../file-storage.service.js";
import { sendEmail } from "../email.service.js";
import { getConfigEfectiva } from "./config.service.js";
import { regenerarPdfDesdeSnapshot } from "./emision.service.js";
import { asuntoReporteFv, cuerpoHtmlReporteFv, cuerpoTextoReporteFv } from "./emailBody.js";
import { dateAPeriodo, periodoADate } from "./periodo.js";
import { mesEs } from "./format.js";
import fs from "node:fs";

const BCC_INTERNO = process.env.REPORTES_FV_BCC || "";
const PDF_MIN_BYTES = 20 * 1024;

export interface ResultadoEnvio {
  emisionId: string;
  estado: ReporteFvEnvioEstado;
  destinatarios: string[];
  motivo?: string;
}

interface OpcionesEnvio {
  dryRun?: boolean;
  userId: string;
}

/**
 * Envía (o simula, si dryRun) el reporte de una emisión. Devuelve el resultado
 * sin tirar en los casos "esperables" (guardas no cumplidas): esos quedan como
 * OMITIDO para que un envío en lote no se corte por un generador incompleto.
 */
export async function enviarEmision(emisionId: string, opts: OpcionesEnvio): Promise<ResultadoEnvio> {
  const emision = await prisma.reporteFvEmision.findUnique({
    where: { id: emisionId },
    include: {
      calculo: { select: { ahorroTotal: true, ahorroPromedioHistorico: true, mesesConDatosUsd: true } },
      fileAttachment: { select: { url: true, sizeBytes: true } },
      project: { select: { id: true, clientName: true } },
    },
  });
  if (!emision) throw notFound("EMISION_NO_ENCONTRADA", "La emisión no existe");

  const periodo = dateAPeriodo(emision.periodo);
  const config = await getConfigEfectiva(emision.project.id);

  // ─── Guardas duras ───
  const guarda = validarGuardas(emision, config);
  if (guarda) {
    return registrarEnvio(emisionId, {
      estado: ReporteFvEnvioEstado.OMITIDO,
      destinatarios: config.destinatarios.map((d) => d.email),
      motivo: guarda,
      esDryRun: opts.dryRun ?? false,
      userId: opts.userId,
    });
  }

  const to = config.destinatarios.filter((d) => !d.esCopia).map((d) => d.email);
  const cc = config.destinatarios.filter((d) => d.esCopia).map((d) => d.email);
  const destinatarios = [...to, ...cc];

  // ─── Dry-run: no manda nada, sólo deja constancia ───
  if (opts.dryRun) {
    return registrarEnvio(emisionId, {
      estado: ReporteFvEnvioEstado.DRY_RUN,
      destinatarios,
      esDryRun: true,
      userId: opts.userId,
    });
  }

  // ─── Claim de idempotencia ───
  const claim = await prisma.reporteFvEmision.updateMany({
    where: { id: emisionId, enviadoEn: null, estado: ReporteFvEmisionEstado.LISTO },
    data: { enviadoEn: new Date(), estado: ReporteFvEmisionEstado.ENVIADO },
  });
  if (claim.count === 0) {
    return {
      emisionId,
      estado: ReporteFvEnvioEstado.OMITIDO,
      destinatarios,
      motivo: "Ya fue enviado (o no está en estado LISTO)",
    };
  }

  try {
    const pdf = await cargarPdf(emision);
    const mes = mesEs(periodo);

    const ok = await sendEmail({
      to,
      cc: cc.length > 0 ? cc : undefined,
      bcc: BCC_INTERNO || undefined,
      subject: asuntoReporteFv(mes),
      html: cuerpoHtmlReporteFv(emision.project.clientName, mes),
      text: cuerpoTextoReporteFv(emision.project.clientName, mes),
      type: "client_facing",
      attachments: [{ filename: `reporte-fotovoltaico-${periodo}.pdf`, content: pdf, contentType: "application/pdf" }],
    });

    if (!ok) throw new Error("El transporte SMTP rechazó el envío");

    // Log de email + publicar en el portal (mail y portal cuentan lo mismo).
    const emailLog = await prisma.emailLog.create({
      data: {
        templateKey: "reporte_fv_mensual",
        projectId: emision.project.id,
        sentById: opts.userId,
        toAddresses: to.join(", "),
        ccAddresses: cc.length > 0 ? cc.join(", ") : null,
        bccAddresses: BCC_INTERNO || null,
        subject: asuntoReporteFv(mes),
        status: EmailStatus.SENT,
      },
    });

    await prisma.reporteFvEmision.update({
      where: { id: emisionId },
      data: { publicadoEnPortal: true, publicadoEn: new Date() },
    });

    const resultado = await registrarEnvio(emisionId, {
      estado: ReporteFvEnvioEstado.ENVIADO,
      destinatarios,
      esDryRun: false,
      userId: opts.userId,
      emailLogId: emailLog.id,
    });

    await createAuditEntry({
      entityType: AuditEntityType.reporte_fv_emision,
      entityId: emisionId,
      projectId: emision.project.id,
      userId: opts.userId,
      action: AuditAction.email_sent,
      description: `Envió el reporte fotovoltaico de ${emision.project.clientName} — ${periodo} a ${destinatarios.join(", ")}`,
    });

    return resultado;
  } catch (err) {
    // El envío falló: se revierte el claim para poder reintentar.
    await prisma.reporteFvEmision.update({
      where: { id: emisionId },
      data: { enviadoEn: null, estado: ReporteFvEmisionEstado.LISTO },
    });
    return registrarEnvio(emisionId, {
      estado: ReporteFvEnvioEstado.FALLIDO,
      destinatarios,
      motivo: err instanceof Error ? err.message : String(err),
      esDryRun: false,
      userId: opts.userId,
    });
  }
}

/** Devuelve el motivo por el que NO se puede enviar, o null si está todo OK. */
function validarGuardas(
  emision: {
    estado: ReporteFvEmisionEstado;
    enviadoEn: Date | null;
    fileAttachment: { sizeBytes: number } | null;
    calculo: { ahorroTotal: unknown; ahorroPromedioHistorico: unknown; mesesConDatosUsd: number } | null;
  },
  config: Awaited<ReturnType<typeof getConfigEfectiva>>,
): string | null {
  if (!config.habilitado) return "El reporte está deshabilitado para este generador";
  if (config.bloqueosEnvio.length > 0) return config.bloqueosEnvio.join("; ");
  if (config.destinatarios.length === 0) return "No tiene destinatarios";
  if (emision.estado !== ReporteFvEmisionEstado.LISTO) {
    return `La emisión está en estado ${emision.estado}, no LISTO`;
  }
  if (emision.enviadoEn != null) return "Ya fue enviado";
  if ((emision.fileAttachment?.sizeBytes ?? 0) < PDF_MIN_BYTES) {
    return "El PDF no está o es demasiado chico";
  }

  // Sanity check del ahorro: fuera del rango [0.2×, 5×] del promedio histórico
  // (con al menos 3 meses), requiere revisión antes de mandarlo en lote.
  const calc = emision.calculo;
  if (calc && calc.mesesConDatosUsd >= 3) {
    const ahorro = Math.abs(Number(calc.ahorroTotal));
    const promedio = Math.abs(Number(calc.ahorroPromedioHistorico));
    if (promedio > 0 && (ahorro < promedio * 0.2 || ahorro > promedio * 5)) {
      return `El ahorro del mes ($${Math.round(ahorro)}) se aparta mucho del promedio ($${Math.round(promedio)}): revisar antes de enviar`;
    }
  }
  return null;
}

async function cargarPdf(emision: {
  id: string;
  fileAttachment: { url: string | null } | null;
}): Promise<Buffer> {
  const url = emision.fileAttachment?.url;
  if (url) {
    const path = getStoredFilePath(url);
    if (fs.existsSync(path)) return fs.readFileSync(path);
  }
  return regenerarPdfDesdeSnapshot(emision.id);
}

async function registrarEnvio(
  emisionId: string,
  data: {
    estado: ReporteFvEnvioEstado;
    destinatarios: string[];
    esDryRun: boolean;
    userId: string;
    motivo?: string;
    emailLogId?: string;
  },
): Promise<ResultadoEnvio> {
  await prisma.reporteFvEnvio.create({
    data: {
      emisionId,
      estado: data.estado,
      destinatarios: data.destinatarios.join(", "),
      errorMessage: data.motivo ?? null,
      esDryRun: data.esDryRun,
      enviadoPorId: data.userId,
      emailLogId: data.emailLogId ?? null,
    },
  });
  return { emisionId, estado: data.estado, destinatarios: data.destinatarios, motivo: data.motivo };
}

/**
 * Envía en lote todas las emisiones LISTO de un periodo (o un subconjunto).
 * Los que no pasan las guardas quedan OMITIDO sin cortar el resto.
 */
export async function enviarLote(
  periodo: string,
  opts: OpcionesEnvio & { projectIds?: string[] },
): Promise<{ resultados: ResultadoEnvio[]; resumen: Record<string, number> }> {
  const emisiones = await prisma.reporteFvEmision.findMany({
    where: {
      periodo: periodoADate(periodo),
      estado: ReporteFvEmisionEstado.LISTO,
      ...(opts.projectIds ? { projectId: { in: opts.projectIds } } : {}),
    },
    select: { id: true, projectId: true, version: true },
    orderBy: [{ projectId: "asc" }, { version: "desc" }],
  });

  // Sólo la última versión LISTO por proyecto.
  const vistos = new Set<string>();
  const objetivo = emisiones.filter((e) => (vistos.has(e.projectId) ? false : (vistos.add(e.projectId), true)));

  const resultados: ResultadoEnvio[] = [];
  for (const e of objetivo) {
    resultados.push(await enviarEmision(e.id, opts));
  }

  const resumen: Record<string, number> = {};
  for (const r of resultados) resumen[r.estado] = (resumen[r.estado] ?? 0) + 1;
  return { resultados, resumen };
}

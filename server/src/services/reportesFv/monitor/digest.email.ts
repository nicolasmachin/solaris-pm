// Digest diario del monitoreo.
//
// La regla que ordena todo: se avisa cuando algo EMPIEZA a estar mal, no todos
// los días que sigue mal. Si no hay nada nuevo, nada resuelto y nada roto del
// lado nuestro, no sale ningún mail. Un digest diario que casi siempre dice lo
// mismo deja de leerse en una semana, y entonces el sistema no sirve para nada.

import { FvIncidenciaEstado } from "@prisma/client";

import { prisma } from "../../../lib/prisma.js";
import { sendEmail } from "../../email.service.js";
import { destinatariosMonitor, diaResumenSemanal, emailHabilitado } from "./config.js";
import { diaCorto, diaTexto, type Dia } from "./dias.js";
import { DIAGNOSTICO_LABEL } from "./diagnostico.js";
import type { FilaResumen, ResumenMonitor } from "./monitor.service.js";

function escapar(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

function nombre(f: FilaResumen): string {
  return f.clientName || f.plantName;
}

export function asuntoDigest(r: ResumenMonitor): string {
  const fecha = diaCorto(r.fecha);
  if (r.corridaRota) return `Monitoreo FV · no se pudo consultar Growatt (${fecha})`;
  if (r.fallaMasiva) return `Monitoreo FV · caída general: ${r.plantasTotal} plantas revisadas (${fecha})`;

  const partes: string[] = [];
  if (r.incidenciasNuevas.length > 0) {
    partes.push(`${r.incidenciasNuevas.length} ${r.incidenciasNuevas.length === 1 ? "nueva" : "nuevas"}`);
  }
  if (r.incidenciasAbiertas.length > 0) partes.push(`${r.incidenciasAbiertas.length} abiertas`);
  if (partes.length === 0 && r.incidenciasResueltas.length > 0) {
    partes.push(`${r.incidenciasResueltas.length} resueltas`);
  }
  if (partes.length === 0) partes.push("todo en orden");
  return `Monitoreo FV · ${partes.join(", ")} (${fecha})`;
}

function filaHtml(f: FilaResumen, conDetalle: boolean): string {
  const desde = f.ultimaGeneracionEn
    ? `última generación: ${diaTexto(f.ultimaGeneracionEn)}`
    : "sin generación registrada";
  const dias = f.diasAfectados > 1 ? ` · hace ${f.diasAfectados} días` : "";
  return (
    `<tr><td style="padding:10px 0;border-bottom:1px solid #eceef0;">` +
    `<div style="font-size:14px;font-weight:600;color:#12151c;">${escapar(nombre(f))}` +
    `<span style="font-weight:400;color:#8a9099;"> — ${escapar(DIAGNOSTICO_LABEL[f.diagnostico])}${dias}</span></div>` +
    (conDetalle
      ? `<div style="font-size:13px;color:#4a5058;margin-top:3px;">${escapar(f.detalle)}</div>` +
        `<div style="font-size:12px;color:#8a9099;margin-top:2px;">${escapar(desde)}</div>`
      : "") +
    `</td></tr>`
  );
}

function seccion(titulo: string, filas: FilaResumen[], conDetalle: boolean): string {
  if (filas.length === 0) return "";
  return (
    `<h3 style="font-size:13px;text-transform:uppercase;letter-spacing:.04em;color:#8a9099;margin:24px 0 4px;">` +
    `${escapar(titulo)}</h3>` +
    `<table role="presentation" width="100%" cellpadding="0" cellspacing="0">` +
    filas.map((f) => filaHtml(f, conDetalle)).join("") +
    `</table>`
  );
}

export function renderDigestHtml(r: ResumenMonitor): string {
  if (r.corridaRota) {
    return (
      `<p>El monitoreo diario <strong>no pudo consultar Growatt</strong> para ${r.plantasError} de ` +
      `${r.plantasTotal} plantas el ${escapar(diaTexto(r.fecha))}.</p>` +
      `<p>No se abrió ni se cerró ninguna incidencia: con la API caída no se puede saber qué plantas ` +
      `están realmente bien. Lo más probable es que haya vencido el token de la API o que Growatt esté fuera de servicio.</p>` +
      (r.erroresConsulta.length > 0
        ? `<p style="font-size:12px;color:#8a9099;">Primer error: ${escapar(r.erroresConsulta[0].error)}</p>`
        : "")
    );
  }

  if (r.fallaMasiva) {
    return (
      `<p>El ${escapar(diaTexto(r.fecha))} <strong>${r.porDiagnostico.SIN_GENERACION ?? 0} de ${r.plantasTotal} plantas</strong> ` +
      `no generaron. Es demasiada gente a la vez como para que sean fallas individuales: casi seguro fue un temporal ` +
      `o un problema general de la red.</p>` +
      `<p>Por eso <strong>no se abrieron incidencias</strong>. Si mañana el número sigue igual de alto, ahí sí hay algo raro.</p>`
    );
  }

  const revisadas = r.plantasOk;
  const ok = r.porDiagnostico.OK ?? 0;
  const esperando = r.porDiagnostico.ESPERANDO_HABILITACION ?? 0;
  const conProblema =
    (r.porDiagnostico.SIN_GENERACION ?? 0) +
    (r.porDiagnostico.SIN_COMUNICACION ?? 0) +
    (r.porDiagnostico.ERROR_DISPOSITIVO ?? 0);

  const estado =
    `<p style="font-size:13px;color:#4a5058;">` +
    `<strong>${revisadas}</strong> plantas revisadas del ${escapar(diaTexto(r.fecha))} · ` +
    `<strong>${ok}</strong> funcionando · <strong>${conProblema}</strong> con problema` +
    (esperando > 0 ? ` · ${esperando} esperando habilitación` : "") +
    (r.plantasError > 0 ? ` · ${r.plantasError} no se pudieron consultar` : "") +
    `</p>`;

  const errores =
    r.erroresConsulta.length > 0
      ? `<h3 style="font-size:13px;text-transform:uppercase;letter-spacing:.04em;color:#8a9099;margin:24px 0 4px;">No se pudieron consultar</h3>` +
        `<ul style="font-size:13px;color:#4a5058;padding-left:18px;margin:4px 0;">` +
        r.erroresConsulta
          .slice(0, 10)
          .map((e) => `<li>${escapar(e.clientName || e.plantName)}: ${escapar(e.error)}</li>`)
          .join("") +
        `</ul>`
      : "";

  return (
    estado +
    seccion("Problemas nuevos", r.incidenciasNuevas, true) +
    seccion("Siguen sin resolverse", r.incidenciasAbiertas, false) +
    seccion("Volvieron a funcionar", r.incidenciasResueltas, false) +
    errores
  );
}

export function renderDigestTexto(r: ResumenMonitor): string {
  const lineas: string[] = [`Monitoreo FV — ${diaTexto(r.fecha)}`, ""];

  if (r.corridaRota) {
    lineas.push(
      `No se pudo consultar Growatt para ${r.plantasError} de ${r.plantasTotal} plantas.`,
      "No se abrió ni cerró ninguna incidencia.",
    );
    return lineas.join("\n");
  }
  if (r.fallaMasiva) {
    lineas.push(
      `${r.porDiagnostico.SIN_GENERACION ?? 0} de ${r.plantasTotal} plantas sin generar: se asumió un evento general.`,
      "No se abrieron incidencias.",
    );
    return lineas.join("\n");
  }

  lineas.push(
    `${r.plantasOk} plantas revisadas · ${r.porDiagnostico.OK ?? 0} funcionando`,
    "",
  );
  const bloque = (titulo: string, filas: FilaResumen[], detalle: boolean) => {
    if (filas.length === 0) return;
    lineas.push(`${titulo.toUpperCase()}:`);
    for (const f of filas) {
      lineas.push(`- ${nombre(f)} — ${DIAGNOSTICO_LABEL[f.diagnostico]}`);
      if (detalle) lineas.push(`  ${f.detalle}`);
    }
    lineas.push("");
  };
  bloque("Problemas nuevos", r.incidenciasNuevas, true);
  bloque("Siguen sin resolverse", r.incidenciasAbiertas, false);
  bloque("Volvieron a funcionar", r.incidenciasResueltas, false);
  return lineas.join("\n");
}

/** ¿Amerita mandar mail hoy? */
export function ameritaDigest(r: ResumenMonitor, ahora: Date = new Date()): boolean {
  if (r.corridaRota) return true;
  if (r.incidenciasNuevas.length > 0) return true;
  if (r.incidenciasResueltas.length > 0) return true;
  if (r.plantasError > 0) return true;
  if (r.fallaMasiva) return true;
  // Recordatorio semanal: que una incidencia no se pudra en silencio durante
  // semanas sólo porque ya dejó de ser noticia.
  const dowUruguay = new Date(ahora.getTime() - 3 * 3_600_000).getUTCDay();
  return dowUruguay === diaResumenSemanal() && r.incidenciasAbiertas.length > 0;
}

/**
 * Manda el digest. Dos candados de idempotencia:
 *   (a) claim transaccional sobre `emailEnviado` de la corrida — dos procesos
 *       (cron y botón manual) no pueden mandar el mismo mail;
 *   (b) `notificadaEn` por incidencia — una vez avisada no vuelve nunca a la
 *       sección "nuevas", corra el cron las veces que corra.
 *
 * Si el SMTP falla se revierte todo, para que el reintento de mañana incluya lo
 * de hoy en vez de perderlo.
 */
export async function enviarDigest(r: ResumenMonitor, ahora: Date = new Date()): Promise<boolean> {
  if (!emailHabilitado()) {
    console.log("[fv-monitor] digest deshabilitado por FV_MONITOR_EMAIL_ENABLED=false");
    return false;
  }
  if (!ameritaDigest(r, ahora)) return false;

  const claim = await prisma.fvMonitorCorrida.updateMany({
    where: { id: r.corridaId, emailEnviado: false },
    data: { emailEnviado: true },
  });
  if (claim.count === 0) return false; // ya lo mandó otro proceso

  const destinatarios = destinatariosMonitor();
  const ok = await sendEmail({
    to: destinatarios,
    // client_facing y no internal a propósito: es una casilla personal externa
    // y el guardrail de sendEmail bloquea (en silencio, devolviendo false) todo
    // destinatario que no sea un usuario interno vivo. Mismo caso que el
    // reporte semanal de indicadores. NO cambiar a "internal".
    type: "client_facing",
    subject: asuntoDigest(r),
    html: renderDigestHtml(r),
    text: renderDigestTexto(r),
  });

  if (!ok) {
    await prisma.fvMonitorCorrida
      .update({ where: { id: r.corridaId }, data: { emailEnviado: false } })
      .catch(() => undefined);
    console.warn("[fv-monitor] no se pudo enviar el digest (¿SMTP configurado?)");
    return false;
  }

  const avisadas = r.incidenciasNuevas.map((f) => f.incidenciaId);
  if (avisadas.length > 0) {
    await prisma.fvIncidencia.updateMany({
      where: { id: { in: avisadas }, estado: FvIncidenciaEstado.ABIERTA },
      data: { notificadaEn: new Date() },
    });
  }
  console.log(`[fv-monitor] digest enviado a ${destinatarios.join(", ")}`);
  return true;
}

export type { Dia };

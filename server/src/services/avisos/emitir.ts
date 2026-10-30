/**
 * Motor de los avisos automáticos al cliente.
 *
 * Los puntos del flujo llaman a `emitirHecho()` cuando pasa algo (se confirma la
 * fecha de obra, UTE habilita…). Acá se buscan los avisos ACTIVOS de ese
 * disparador y se le manda a cada uno su mensaje al cliente. Nunca tira error
 * hacia quien lo llamó: un aviso que falla no puede frenar la carga de una fecha.
 *
 * Reglas (ver docs/manual/20-avisos-automaticos.md):
 *  - Solo cuentan los hechos posteriores a la activación del aviso, y no más
 *    viejos que ANTIGUEDAD_MAX_DIAS (una fecha cargada tarde no avisa algo viejo).
 *  - Un hecho manda cada aviso una sola vez: la fila de `avisos_envios` con su
 *    clave se crea ANTES de mandar y es única. Si se reabre una etapa o se
 *    vuelve a cargar una fecha, no sale de nuevo.
 *  - Todo queda registrado: lo enviado, lo fallido y lo que no se mandó con el
 *    motivo; lo enviado además va a la bitácora del cliente y a la auditoría.
 *  - Fuera de producción no se le escribe a ningún cliente: va a
 *    AVISOS_DEV_TELEFONO / el redirect de mails de desarrollo, o no sale.
 */

import { AuditAction, AuditEntityType, InteractionChannel, InteractionDirection, InteractionReason, Prisma } from "@prisma/client";

import { env } from "../../config/env.js";
import { prisma } from "../../lib/prisma.js";
import { createAuditEntry } from "../audit.service.js";
import { DISPARADOR_POR_CLAVE } from "./disparadores.js";
import { fechaLarga, rellenar, variablesDelTexto } from "./plantilla.js";

export const ANTIGUEDAD_MAX_DIAS = 7;
const DIA_MS = 24 * 60 * 60 * 1000;

export type Hecho = {
  /** Clave del catálogo (disparadores.ts). */
  disparador: string;
  projectId: string;
  /** Lo que distingue a este hecho de otro igual del mismo proyecto (el suministro, la fecha nueva, el id del evento). */
  ref?: string;
  /** Cuándo pasó. Por defecto, ahora. */
  ocurrioEn?: Date;
  /** Fecha que se muestra como {{evento.fecha}}. */
  eventoFecha?: Date | null;
};

export function avisosHabilitados(): boolean {
  return process.env.AVISOS_AUTOMATICOS !== "false";
}

/** Para enganchar en el flujo: no espera ni tira error. */
export function emitirHecho(hecho: Hecho): void {
  if (!avisosHabilitados()) return;
  void procesarHecho(hecho).catch((err) =>
    console.error(`[avisos] ${hecho.disparador} ${hecho.projectId}:`, err instanceof Error ? err.message : err),
  );
}

let sistemaId: string | null | undefined;
async function usuarioSistema(): Promise<string | null> {
  if (sistemaId !== undefined) return sistemaId;
  const u = await prisma.user.findFirst({
    where: { deletedAt: null, role: { name: "ADMIN" } },
    orderBy: { createdAt: "asc" },
    select: { id: true },
  });
  sistemaId = u?.id ?? null;
  return sistemaId;
}

/** Los datos del cliente para rellenar el mensaje. Solo cosas que se le pueden decir al cliente. */
export async function datosDelCliente(projectId: string, eventoFecha?: Date | null) {
  const p = await prisma.project.findUnique({
    where: { id: projectId },
    select: {
      clientName: true,
      nombreCliente: true,
      clientPhone: true,
      clientEmail: true,
      deletedAt: true,
      importedFromCsv: true,
      installationSchedule: {
        select: { deletedAt: true, confirmedAt: true, segments: { select: { startDate: true, endDate: true } } },
      },
    },
  });
  if (!p) return null;
  const nombreCompleto = (p.nombreCliente || p.clientName).trim();
  const obra = p.installationSchedule && !p.installationSchedule.deletedAt ? p.installationSchedule : null;
  const inicios = (obra?.segments ?? []).map((s) => s.startDate.getTime());
  const fines = (obra?.segments ?? []).map((s) => s.endDate.getTime());
  const datos: Record<string, string | null> = {
    "cliente.nombre": nombreCompleto.split(/\s+/)[0] ?? "",
    "cliente.nombreCompleto": nombreCompleto,
    "obra.fecha": inicios.length ? fechaLarga(new Date(Math.min(...inicios))) : null,
    "obra.fechaFin": fines.length ? fechaLarga(new Date(Math.max(...fines))) : null,
    "evento.fecha": eventoFecha ? fechaLarga(eventoFecha) : null,
    "portal.link": `${process.env.PUBLIC_APP_URL || "https://app.voltia.com.uy"}/portal`,
  };
  return { proyecto: p, datos };
}

type Aviso = Prisma.AvisoAutomaticoGetPayload<object>;

export async function procesarHecho(hecho: Hecho): Promise<void> {
  const avisos = await prisma.avisoAutomatico.findMany({
    where: { disparador: hecho.disparador, estado: "ACTIVO", deletedAt: null },
  });
  for (const aviso of avisos) {
    try {
      await mandarAviso(aviso, hecho);
    } catch (err) {
      console.error(`[avisos] «${aviso.nombre}» ${hecho.projectId}:`, err instanceof Error ? err.message : err);
    }
  }
}

export function claveDelHecho(h: Hecho): string {
  return [h.disparador, h.projectId, h.ref ?? ""].join("|");
}

/** Manda un aviso por un hecho. Devuelve la fila del registro (o null si ya se había procesado). */
export async function mandarAviso(aviso: Aviso, hecho: Hecho) {
  const ocurrio = hecho.ocurrioEn ?? new Date();
  const claveHecho = claveDelHecho(hecho);

  // Se reserva el hecho antes de mandar: si ya existe, otro proceso lo mandó.
  const yaEsta = await prisma.avisoEnvio.findUnique({
    where: { avisoId_claveHecho: { avisoId: aviso.id, claveHecho } },
    select: { id: true },
  });
  if (yaEsta) return null;
  let envio;
  try {
    envio = await prisma.avisoEnvio.create({
      data: { avisoId: aviso.id, projectId: hecho.projectId, claveHecho, canal: aviso.canal, estado: "PROCESANDO" },
    });
  } catch (err) {
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002") return null;
    throw err;
  }
  const cerrar = (data: { estado: "ENVIADO" | "FALLIDO" | "OMITIDO"; detalle?: string; destino?: string | null; texto?: string; waMessageId?: string }) =>
    prisma.avisoEnvio.update({ where: { id: envio.id }, data });

  // Solo hechos posteriores a la activación. Se compara el día en Uruguay: una
  // fecha de UTE se carga sin hora, y la del mismo día de la activación cuenta.
  if (!aviso.activadoEn || diaUruguay(ocurrio) < diaUruguay(aviso.activadoEn)) {
    return cerrar({ estado: "OMITIDO", detalle: "El hecho es anterior a la activación del aviso." });
  }
  if (Date.now() - ocurrio.getTime() > ANTIGUEDAD_MAX_DIAS * DIA_MS) {
    return cerrar({ estado: "OMITIDO", detalle: `El hecho tiene más de ${ANTIGUEDAD_MAX_DIAS} días: se cargó tarde.` });
  }

  const cliente = await datosDelCliente(hecho.projectId, hecho.eventoFecha);
  if (!cliente || cliente.proyecto.deletedAt) return cerrar({ estado: "OMITIDO", detalle: "El proyecto no existe o está borrado." });
  if (cliente.proyecto.importedFromCsv) {
    return cerrar({ estado: "OMITIDO", detalle: "Es un generador cargado por planilla, no un proyecto de Voltia." });
  }

  const { texto, faltan } = rellenar(aviso.cuerpo, cliente.datos);
  if (faltan.length > 0) {
    return cerrar({ estado: "OMITIDO", texto, detalle: `Faltan datos para el mensaje: ${faltan.join(", ")}.` });
  }

  const sistema = await usuarioSistema();
  const esProd = env.nodeEnv === "production";
  try {
    if (aviso.canal === "WHATSAPP") {
      const { enviarPlantilla, normalizarTelefono } = await import("../whatsapp-cloud/api.service.js");
      const real = cliente.proyecto.clientPhone ? normalizarTelefono(cliente.proyecto.clientPhone) : "";
      if (real.length < 10) return cerrar({ estado: "OMITIDO", texto, detalle: "El proyecto no tiene un celular válido cargado." });
      const destino = esProd ? real : process.env.AVISOS_DEV_TELEFONO || "";
      if (!destino) return cerrar({ estado: "OMITIDO", texto, destino: real, detalle: "En desarrollo no se le escribe al cliente (falta AVISOS_DEV_TELEFONO)." });
      if (aviso.plantillaEstado !== "APPROVED" || !aviso.plantillaNombre) {
        return cerrar({ estado: "FALLIDO", texto, destino: real, detalle: "La plantilla no está aprobada por Meta." });
      }
      const orden = Array.isArray(aviso.plantillaVariables)
        ? (aviso.plantillaVariables as string[])
        : variablesDelTexto(aviso.cuerpo);
      const msg = await enviarPlantilla({
        telefono: destino,
        nombre: aviso.plantillaNombre,
        idioma: aviso.plantillaIdioma,
        variables: orden.map((v) => cliente.datos[v] ?? ""),
        userId: sistema,
        texto,
      });
      await cerrar({ estado: "ENVIADO", texto, destino: real, waMessageId: msg.waMessageId });
    } else {
      const { sendEmail } = await import("../email.service.js");
      const { renderEmailLayout } = await import("../email/layout.js");
      const destino = cliente.proyecto.clientEmail?.trim();
      if (!destino || !destino.includes("@")) return cerrar({ estado: "OMITIDO", texto, detalle: "El proyecto no tiene mail cargado." });
      const { texto: asunto } = rellenar(aviso.asunto || aviso.nombre, cliente.datos);
      const html = renderEmailLayout({
        title: asunto,
        kicker: "Voltia",
        contentHtml: escaparHtml(texto).replace(/\n/g, "<br>"),
        footerNote: "Mensaje automático de Voltia.",
      });
      const { devEmailBlocked } = await import("../email/dev-redirect.js");
      if (devEmailBlocked()) {
        return cerrar({ estado: "OMITIDO", texto, destino, detalle: "En desarrollo no se le escribe al cliente (falta DEV_EMAIL_REDIRECT_TO)." });
      }
      const ok = await sendEmail({ to: destino, subject: asunto, html, text: texto, type: "client_facing" });
      if (!ok) return cerrar({ estado: "FALLIDO", texto, destino, detalle: "El servidor de correo no lo mandó (ver logs)." });
      await cerrar({ estado: "ENVIADO", texto, destino });
    }
  } catch (err) {
    const detalle = err instanceof Error ? err.message : String(err);
    return cerrar({ estado: "FALLIDO", texto, detalle });
  }

  await registrarEnviado(aviso, hecho.projectId, texto);
  return prisma.avisoEnvio.findUnique({ where: { id: envio.id } });
}

/** Lo que salió queda en la bitácora del cliente (y cierra el paso del recorrido) y en la auditoría. */
export async function registrarEnviado(aviso: Aviso, projectId: string, texto: string) {
  const sistema = await usuarioSistema();
  if (sistema) {
    const { createInteraction } = await import("../clientes/index.js");
    await createInteraction(
      projectId,
      aviso.canal === "WHATSAPP" ? InteractionChannel.WHATSAPP : InteractionChannel.EMAIL,
      `Aviso automático «${aviso.nombre}»:\n${texto}`,
      sistema,
      {
        direction: InteractionDirection.SALIENTE,
        reason: InteractionReason.SEGUIMIENTO,
        checks: aviso.cierraCheck ? [aviso.cierraCheck] : [],
      },
    ).catch((err) => console.error("[avisos] bitácora:", err instanceof Error ? err.message : err));
    await createAuditEntry({
      entityType: AuditEntityType.project,
      entityId: projectId,
      projectId: projectId,
      userId: sistema,
      action: AuditAction.created,
      description: `Aviso automático «${aviso.nombre}» enviado al cliente por ${aviso.canal === "WHATSAPP" ? "WhatsApp" : "mail"} (${DISPARADOR_POR_CLAVE.get(aviso.disparador)?.etiqueta ?? aviso.disparador})`,
    });
  }
}

/** "2026-10-29": las fechas sin hora (medianoche UTC) tal cual; las demás, en hora de Uruguay. */
export function diaUruguay(d: Date): string {
  const soloFecha = d.getUTCHours() === 0 && d.getUTCMinutes() === 0 && d.getUTCSeconds() === 0;
  return new Date(soloFecha ? d.getTime() : d.getTime() - 3 * 60 * 60 * 1000).toISOString().slice(0, 10);
}

function escaparHtml(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

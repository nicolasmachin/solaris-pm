/**
 * Motor de los avisos automáticos al cliente.
 *
 * Los puntos del flujo llaman a `emitirHecho()` cuando pasa algo (se confirma la
 * fecha de obra, UTE habilita…). Acá se buscan los avisos ACTIVOS de ese
 * disparador y se le reserva a cada uno su envío. Nunca tira error hacia quien
 * lo llamó: un aviso que falla no puede frenar la carga de una fecha.
 *
 * Reglas (ver docs/manual/20-avisos-automaticos.md):
 *  - Solo cuentan los hechos posteriores a la activación del aviso, y no más
 *    viejos que ANTIGUEDAD_MAX_DIAS (una fecha cargada tarde no avisa algo viejo).
 *    Se mira al llegar el hecho: lo que después espera (la demora, la
 *    bienvenida) no lo vuelve viejo.
 *  - Un hecho manda cada aviso una sola vez: la fila de `avisos_envios` con su
 *    clave se crea ANTES de mandar y es única. Si se reabre una etapa o se
 *    vuelve a cargar una fecha, no sale de nuevo.
 *  - **Nada sale antes de la bienvenida** de Experiencia Solar (paso
 *    `e1_bienvenida`): lo que pasa antes queda PROGRAMADO y sale cuando se hace.
 *  - Con demora, el envío queda PROGRAMADO para el hecho + la demora; el job de
 *    `avisos.job.ts` lo manda a su hora (`enviarProgramados()`).
 *  - La condición (SIN_CONTACTO) se revisa al momento de salir.
 *  - Todo queda registrado: lo enviado, lo fallido y lo que no se mandó con el
 *    motivo; lo enviado además va a la bitácora del cliente y a la auditoría.
 *  - Fuera de producción no se le escribe a ningún cliente: va a
 *    AVISOS_DEV_TELEFONO / el redirect de mails de desarrollo, o no sale.
 */

import { AuditAction, AuditEntityType, InteractionChannel, InteractionDirection, InteractionReason, Prisma } from "@prisma/client";

import { env } from "../../config/env.js";
import { prisma } from "../../lib/prisma.js";
import { createAuditEntry } from "../audit.service.js";
import { DISPARADOR_BIENVENIDA, DISPARADOR_POR_CLAVE } from "./disparadores.js";
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
  /**
   * Para la condición SIN_CONTACTO: desde cuándo se mira si Experiencia Solar le
   * escribió. Por defecto, el hecho. El recordatorio de obra mira desde que se
   * confirmó la fecha.
   */
  contactoDesde?: Date | null;
  /** Datos del mensaje que se fijan ahora (ej. la fecha de obra que se suspendió). */
  datosFijos?: Record<string, string>;
};

/** Prefijo con que los avisos quedan en la bitácora: no cuentan como "Experiencia Solar le escribió". */
export const PREFIJO_BITACORA = "Aviso automático «";

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

/**
 * Reserva el envío de un aviso por un hecho y, si no tiene que esperar, lo manda.
 * Devuelve la fila del registro (o null si el hecho ya se había procesado).
 */
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
      data: {
        avisoId: aviso.id,
        projectId: hecho.projectId,
        claveHecho,
        canal: aviso.canal,
        estado: "PROCESANDO",
        ocurrioEn: ocurrio,
        contactoDesde: hecho.contactoDesde ?? ocurrio,
        eventoFecha: hecho.eventoFecha ?? null,
        datosFijos: hecho.datosFijos ?? Prisma.DbNull,
      },
    });
  } catch (err) {
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002") return null;
    throw err;
  }
  const cerrar = (data: Cierre) => prisma.avisoEnvio.update({ where: { id: envio.id }, data });

  // Solo hechos posteriores a la activación. Se compara el día en Uruguay: una
  // fecha de UTE se carga sin hora, y la del mismo día de la activación cuenta.
  if (!aviso.activadoEn || diaUruguay(ocurrio) < diaUruguay(aviso.activadoEn)) {
    return cerrar({ estado: "OMITIDO", detalle: "El hecho es anterior a la activación del aviso." });
  }
  if (Date.now() - ocurrio.getTime() > ANTIGUEDAD_MAX_DIAS * DIA_MS) {
    return cerrar({ estado: "OMITIDO", detalle: `El hecho tiene más de ${ANTIGUEDAD_MAX_DIAS} días: se cargó tarde.` });
  }

  const salirEn = new Date(ocurrio.getTime() + (aviso.demoraMinutos ?? 0) * 60_000);
  if (salirEn.getTime() > Date.now()) {
    return cerrar({ estado: "PROGRAMADO", salirEn, detalle: null });
  }
  if (!(await bienvenidaHecha(aviso, hecho.projectId))) {
    return cerrar({ estado: "PROGRAMADO", salirEn, detalle: ESPERA_BIENVENIDA });
  }
  return enviarEnvio(envio.id);
}

const ESPERA_BIENVENIDA = "Espera a que Experiencia Solar haga la bienvenida.";

type Cierre = {
  estado: "PROGRAMADO" | "ENVIADO" | "FALLIDO" | "OMITIDO";
  detalle?: string | null;
  destino?: string | null;
  texto?: string;
  waMessageId?: string;
  salirEn?: Date;
};

/**
 * La bienvenida (paso `e1_bienvenida`) está hecha. Un proyecto sin ese paso (los
 * de antes del recorrido) no espera: no habría cómo hacerla. El aviso de la
 * propia bienvenida no espera nada.
 */
export async function bienvenidaHecha(aviso: { disparador: string }, projectId: string): Promise<boolean> {
  if (aviso.disparador === DISPARADOR_BIENVENIDA) return true;
  const checks = await prisma.recorridoCheck.findMany({
    where: { projectId, codigo: "e1_bienvenida" },
    select: { completadoEn: true },
  });
  return checks.length === 0 || checks.some((c) => c.completadoEn);
}

/**
 * Si Experiencia Solar le escribió al cliente desde `desde`: un WhatsApp saliente
 * a alguno de sus teléfonos (desde Voltia PM o desde el celular) o un contacto
 * registrado en la bitácora. Los avisos automáticos no cuentan.
 */
export async function leEscribieronDesde(projectId: string, telefono: string | null, desde: Date): Promise<boolean> {
  const contacto = await prisma.clientInteraction.findFirst({
    where: {
      projectId,
      deletedAt: null,
      createdAt: { gt: desde },
      OR: [{ direction: InteractionDirection.SALIENTE }, { direction: null }],
      NOT: { content: { startsWith: PREFIJO_BITACORA } },
    },
    select: { id: true },
  });
  if (contacto) return true;
  const { telefonosDe } = await import("../whatsapp-cloud/bandejas.service.js");
  const telefonos = telefonosDe(telefono);
  if (telefonos.length === 0) return false;
  const deAvisos = await prisma.avisoEnvio.findMany({
    where: { projectId, waMessageId: { not: null } },
    select: { waMessageId: true },
  });
  const mensaje = await prisma.whatsAppMensaje.findFirst({
    where: {
      telefono: { in: telefonos },
      direccion: "SALIENTE",
      ocurridoEn: { gt: desde },
      waMessageId: { notIn: deAvisos.map((e) => e.waMessageId!) },
    },
    select: { id: true },
  });
  return !!mensaje;
}

/**
 * Manda un envío reservado. Lo usan el hecho que no espera y el job, para los
 * PROGRAMADOS que llegaron a su hora. Si todavía falta la bienvenida, lo deja
 * PROGRAMADO.
 */
export async function enviarEnvio(envioId: string) {
  // Se toma el envío: si otro proceso ya lo agarró, no se manda dos veces.
  const tomado = await prisma.avisoEnvio.updateMany({
    where: { id: envioId, estado: { in: ["PROCESANDO", "PROGRAMADO"] } },
    data: { estado: "ENVIANDO" },
  });
  if (tomado.count === 0) return null;
  const envio = await prisma.avisoEnvio.findUniqueOrThrow({ where: { id: envioId }, include: { aviso: true } });
  const aviso = envio.aviso;
  const cerrar = (data: Cierre) => prisma.avisoEnvio.update({ where: { id: envio.id }, data });
  const projectId = envio.projectId;
  if (!projectId) return cerrar({ estado: "OMITIDO", detalle: "El proyecto no existe o está borrado." });

  if (aviso.estado !== "ACTIVO" || aviso.deletedAt) {
    return cerrar({ estado: "OMITIDO", detalle: "El aviso se pausó o se borró antes de salir." });
  }
  if (!(await bienvenidaHecha(aviso, projectId))) {
    return cerrar({ estado: "PROGRAMADO", detalle: ESPERA_BIENVENIDA });
  }

  const cliente = await datosDelCliente(projectId, envio.eventoFecha);
  if (!cliente || cliente.proyecto.deletedAt) return cerrar({ estado: "OMITIDO", detalle: "El proyecto no existe o está borrado." });
  if (cliente.proyecto.importedFromCsv) {
    return cerrar({ estado: "OMITIDO", detalle: "Es un generador cargado por planilla, no un proyecto de Voltia." });
  }
  const datos = { ...cliente.datos, ...((envio.datosFijos as Record<string, string> | null) ?? {}) };

  if (aviso.condicion === "SIN_CONTACTO") {
    const desde = envio.contactoDesde ?? envio.ocurrioEn ?? envio.createdAt;
    if (await leEscribieronDesde(projectId, cliente.proyecto.clientPhone, desde)) {
      return cerrar({ estado: "OMITIDO", detalle: "Experiencia Solar ya le escribió al cliente desde el hecho." });
    }
  }

  const { texto, faltan } = rellenar(aviso.cuerpo, datos);
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
      const { bandejaExperienciaSolar } = await import("../whatsapp-cloud/bandejas.service.js");
      const { cuenta } = await bandejaExperienciaSolar();
      if (!cuenta) return cerrar({ estado: "FALLIDO", texto, destino: real, detalle: "No hay un número de WhatsApp para Experiencia Solar." });
      const msg = await enviarPlantilla({
        cuenta,
        telefono: destino,
        nombre: aviso.plantillaNombre,
        idioma: aviso.plantillaIdioma,
        variables: orden.map((v) => datos[v] ?? ""),
        userId: sistema,
        texto,
      });
      await cerrar({ estado: "ENVIADO", texto, destino: real, waMessageId: msg.waMessageId, detalle: null });
    } else {
      const { sendEmail } = await import("../email.service.js");
      const { renderEmailLayout } = await import("../email/layout.js");
      const destino = cliente.proyecto.clientEmail?.trim();
      if (!destino || !destino.includes("@")) return cerrar({ estado: "OMITIDO", texto, detalle: "El proyecto no tiene mail cargado." });
      const { texto: asunto } = rellenar(aviso.asunto || aviso.nombre, datos);
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
      await cerrar({ estado: "ENVIADO", texto, destino, detalle: null });
    }
  } catch (err) {
    const detalle = err instanceof Error ? err.message : String(err);
    return cerrar({ estado: "FALLIDO", texto, detalle });
  }

  await registrarEnviado(aviso, projectId, texto);
  return prisma.avisoEnvio.findUnique({ where: { id: envio.id } });
}

/**
 * Manda los PROGRAMADOS que llegaron a su hora (todos, o los de un proyecto: al
 * hacerse la bienvenida se liberan los suyos sin esperar al job).
 */
export async function enviarProgramados(params: { projectId?: string; ahora?: Date } = {}) {
  const pendientes = await prisma.avisoEnvio.findMany({
    where: { estado: "PROGRAMADO", salirEn: { lte: params.ahora ?? new Date() }, projectId: params.projectId },
    orderBy: { salirEn: "asc" },
    select: { id: true },
    take: 200,
  });
  let enviados = 0;
  for (const p of pendientes) {
    try {
      const r = await enviarEnvio(p.id);
      if (r?.estado === "ENVIADO") enviados++;
    } catch (err) {
      console.error(`[avisos] envío programado ${p.id}:`, err instanceof Error ? err.message : err);
    }
  }
  return enviados;
}

/** Lo que salió queda en la bitácora del cliente (y cierra el paso del recorrido) y en la auditoría. */
export async function registrarEnviado(aviso: Aviso, projectId: string, texto: string) {
  const sistema = await usuarioSistema();
  if (sistema) {
    const { createInteraction } = await import("../clientes/index.js");
    await createInteraction(
      projectId,
      aviso.canal === "WHATSAPP" ? InteractionChannel.WHATSAPP : InteractionChannel.EMAIL,
      `${PREFIJO_BITACORA}${aviso.nombre}»:\n${texto}`,
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

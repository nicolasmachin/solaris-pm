/**
 * Asistente del WhatsApp de Ventas: contesta el primer mensaje de un cliente
 * nuevo con el speech, en nombre del asesor, para no tardar horas en el primer
 * contacto. Pedido de Nicolás del 16-nov-2026; las reglas están en la
 * automatización "whatsapp" (Marketing → Automatizaciones, server/config/
 * instagram/whatsapp.md) y lo que puede decir de Voltia, en "_datos".
 *
 * Cómo anda:
 * 1. Entra el primer mensaje de un número sin conversación previa, ni lead, ni
 *    cliente, ni usuario del equipo, a un número de Ventas con el asistente
 *    prendido: se programa la respuesta para dentro de 2 a 5 minutos al azar
 *    (de noche, de 21 a 8, para las 8 y pico). Cada mensaje nuevo del cliente
 *    corre la espera.
 * 2. El job, al vencer: si el asesor ya contestó (desde Voltia PM o desde el
 *    celular), no hace nada. Si no, Claude arma el speech adaptado a lo que
 *    preguntó, o decide que no le toca (reclamo, factura, pregunta si es un
 *    bot…) y pasa el chat al asesor.
 * 3. Se manda de a un mensaje, con 20 a 40 segundos entre uno y otro. Si en el
 *    medio escribe el asesor o el cliente, se corta.
 * 4. Cuando el cliente contesta al speech, el chat pasa al asesor (punto rojo y
 *    notificación); si mandó un archivo, es la factura: se crea el lead.
 *
 * En PRUEBA hace todo menos mandar: lo que habría mandado queda en
 * `asistenteSombra` y se ve en el chat.
 */

import { AuditAction, AuditEntityType, NotificationType, OrigenLead, Prisma } from "@prisma/client";

import { prisma } from "../../lib/prisma.js";
import { createAuditEntry } from "../audit.service.js";
import { completar, deTipo, textoComun } from "../instagram-marketing/automatizaciones.js";
import { pedirJson } from "../instagram-marketing/claude.js";
import { createNotification } from "../notification.service.js";
import { crearLead } from "../sales/leads.service.js";
import { enviarTexto } from "./api.service.js";
import { bandejaVentas, clienteDe } from "./bandejas.service.js";

const PAUSA_ENTRE_MENSAJES_S: [number, number] = [20, 40];
const HORA_DESDE = 8;
const HORA_HASTA = 21;
const MAXIMO_MENSAJES = 6;

type Salida = { mensajes: string[]; derivar: boolean; motivo: string };
const ESQUEMA = {
  type: "object",
  properties: {
    mensajes: { type: "array", items: { type: "string" } },
    derivar: { type: "boolean" },
    motivo: { type: "string" },
  },
  required: ["mensajes", "derivar", "motivo"],
  additionalProperties: false,
};

const azar = (min: number, max: number) => min + Math.random() * (max - min);

/** Hora de Uruguay (UTC-3, sin horario de verano). */
function horaUruguay(d: Date): number {
  return (d.getUTCHours() + 21) % 24;
}

/**
 * Cuándo contestar: dentro de la espera, salvo de noche (21 a 8 en Uruguay),
 * que se corre a las 8 y unos minutos. Todos los días, también el fin de semana.
 */
export function cuandoContestar(ahora: Date, esperaSeg: [number, number]): Date {
  const en = new Date(ahora.getTime() + azar(esperaSeg[0], esperaSeg[1]) * 1000);
  const h = horaUruguay(en);
  if (h >= HORA_DESDE && h < HORA_HASTA) return en;
  // Las 8 de la mañana de Uruguay (11 UTC) del día que corresponde.
  const ocho = new Date(en);
  ocho.setUTCHours(HORA_DESDE + 3, 0, 0, 0);
  if (ocho.getTime() <= en.getTime()) ocho.setUTCDate(ocho.getUTCDate() + 1);
  return new Date(ocho.getTime() + azar(2, 12) * 60_000);
}

/** El número de Ventas con el asistente prendido (o en prueba), con su responsable. */
async function numeroConAsistente(phoneNumberId: string) {
  const n = await prisma.whatsAppNumero.findUnique({
    where: { phoneNumberId },
    select: { uso: true, estado: true, asistente: true, responsableId: true, responsable: { select: { name: true } } },
  });
  if (!n || n.uso !== "VENTAS" || n.estado !== "CONECTADO" || n.asistente === "APAGADO" || !n.responsableId) return null;
  return n;
}

const DONDE = (phoneNumberId: string, telefono: string) => ({ phoneNumberId_telefono: { phoneNumberId, telefono } });

/**
 * Lo llama el webhook al guardar un mensaje del cliente. Decide si programar el
 * speech, correr la espera o pasarle el chat al asesor.
 */
export async function alEntrarMensaje(phoneNumberId: string, telefono: string, tipo: string) {
  const numero = await numeroConAsistente(phoneNumberId);
  if (!numero) return;
  const auto = await deTipo("whatsapp");
  if (!auto?.activa) return;
  const conv = await prisma.whatsAppConversacion.findUnique({ where: DONDE(phoneNumberId, telefono) });
  const estado = conv?.asistenteEstado ?? null;

  if (estado === "PROGRAMADO") {
    // Escribe en tandas: cada mensaje corre la espera.
    await prisma.whatsAppConversacion.update({
      where: DONDE(phoneNumberId, telefono),
      data: { asistenteEn: cuandoContestar(new Date(), auto.espera) },
    });
    return;
  }
  if (estado === "SPEECH" || estado === "ENVIANDO") {
    // Contestó al speech: lo sigue el asesor.
    const archivo = ["image", "document"].includes(tipo);
    await pasarAlAsesor(phoneNumberId, telefono, archivo ? "Mandó la factura: para cotizar" : "Contestó al speech", numero.responsableId!, {
      crearLead: archivo,
    });
    return;
  }
  if (estado) return; // ASESOR, HUMANO o SOMBRA: el asistente ya no interviene.
  // Un mensaje que Meta no deja leer (131060) no se puede contestar: lo ve el asesor en el celular.
  if (tipo === "unsupported") return;

  // Solo chats nuevos: sin nada nuestro antes y sin lead, cliente ni usuario del equipo.
  const nuestro = await prisma.whatsAppMensaje.count({ where: { phoneNumberId, telefono, direccion: "SALIENTE" } });
  if (nuestro > 0) return;
  const anteriores = await prisma.whatsAppMensaje.count({
    where: { phoneNumberId, telefono, direccion: "ENTRANTE", ocurridoEn: { lt: new Date(Date.now() - 24 * 60 * 60 * 1000) } },
  });
  if (anteriores > 0) return;
  const cliente = await clienteDe(await bandejaVentas(numero.responsableId!), telefono);
  if (cliente?.leadId || cliente?.projectId || cliente?.usuarioId) return;

  await prisma.whatsAppConversacion.upsert({
    where: DONDE(phoneNumberId, telefono),
    create: { phoneNumberId, telefono, asistenteEstado: "PROGRAMADO", asistenteEn: cuandoContestar(new Date(), auto.espera) },
    update: { asistenteEstado: "PROGRAMADO", asistenteEn: cuandoContestar(new Date(), auto.espera) },
  });
}

/** ¿Escribió el asesor (Voltia PM o celular) después de este momento? */
async function contestoUnaPersona(phoneNumberId: string, telefono: string, desde: Date) {
  return (
    (await prisma.whatsAppMensaje.count({
      where: { phoneNumberId, telefono, direccion: "SALIENTE", origen: { not: "ASISTENTE" }, ocurridoEn: { gte: desde } },
    })) > 0
  );
}

/** El chat, como lo lee Claude: los mensajes del cliente (con la transcripción de los audios). */
async function conversacionParaClaude(phoneNumberId: string, telefono: string) {
  const ms = await prisma.whatsAppMensaje.findMany({
    where: { phoneNumberId, telefono },
    orderBy: { ocurridoEn: "asc" },
    take: 30,
    select: { direccion: true, tipo: true, texto: true, transcripcion: true },
  });
  return ms
    .map((m) => {
      const quien = m.direccion === "ENTRANTE" ? "Cliente" : "Voltia";
      if (m.tipo === "text") return `${quien}: ${m.texto ?? ""}`;
      if (m.tipo === "audio" || m.tipo === "voice") return `${quien}: [Mandó: audio]${m.transcripcion ? ` "${m.transcripcion}"` : ""}`;
      return `${quien}: [Mandó: ${m.tipo}]${m.texto ? ` ${m.texto}` : ""}`;
    })
    .join("\n");
}

/** Arma la respuesta con Claude. */
async function armarRespuesta(phoneNumberId: string, telefono: string, asesor: string): Promise<Salida | null> {
  const auto = await deTipo("whatsapp");
  if (!auto) return null;
  const conv = await prisma.whatsAppConversacion.findUnique({ where: DONDE(phoneNumberId, telefono), select: { id: true, nombrePerfil: true } });
  const instrucciones = completar(auto.flujo.replace("{DATOS}", completar(await textoComun("_datos")))).replaceAll("{ASESOR}", asesor);
  const ahora = new Date();
  const contexto = [
    `Hoy: ${ahora.toLocaleString("es-UY", { timeZone: "America/Montevideo", weekday: "long", hour: "2-digit", minute: "2-digit" })}.`,
    conv?.nombrePerfil ? `Nombre que tiene en WhatsApp: ${conv.nombrePerfil}.` : "No se sabe su nombre.",
  ].join("\n");
  const r = await pedirJson<Salida>({
    feature: "whatsapp_asistente",
    instrucciones,
    contexto,
    mensajes: [{ role: "user", content: `Esta conversación:\n${await conversacionParaClaude(phoneNumberId, telefono)}` }],
    esquema: ESQUEMA,
    maxTokens: 2000,
    entityId: conv?.id,
  });
  if (!r.resultado) {
    console.error("[whatsapp] el asistente no pudo armar la respuesta:", r.problema);
    return null;
  }
  return { ...r.resultado, mensajes: r.resultado.mensajes.map((m) => m.trim()).filter(Boolean).slice(0, MAXIMO_MENSAJES) };
}

/** El chat pasa al asesor: punto rojo, notificación y, si mandó la factura, el lead. */
export async function pasarAlAsesor(
  phoneNumberId: string,
  telefono: string,
  motivo: string,
  responsableId: string,
  opciones: { crearLead?: boolean } = {},
) {
  const conv = await prisma.whatsAppConversacion.update({
    where: DONDE(phoneNumberId, telefono),
    data: { asistenteEstado: "ASESOR", asistenteMotivo: motivo, asistenteEn: null, asistentePendientes: Prisma.DbNull },
  });
  let leadId = conv.leadId;
  if (opciones.crearLead && !leadId) {
    try {
      const actor = await prisma.user.findUniqueOrThrow({ where: { id: responsableId }, select: { id: true, name: true } });
      const lead = await crearLead({
        data: {
          clientName: conv.nombrePerfil ?? `WhatsApp +${telefono}`,
          clientPhone: telefono,
          assignedToId: responsableId,
          origen: OrigenLead.OTRO,
          origenDetalle: "WhatsApp (contestó el asistente de Ventas)",
        },
        actor,
      });
      leadId = lead.id;
      await prisma.whatsAppConversacion.update({ where: { id: conv.id }, data: { leadId } });
    } catch (err) {
      console.error("[whatsapp] el asistente no pudo crear el lead:", err instanceof Error ? err.message : err);
    }
  }
  await createNotification({
    userId: responsableId,
    type: NotificationType.whatsapp_requiere_asesor,
    title: `WhatsApp: ${conv.nombrePerfil ?? `+${telefono}`}`,
    message: motivo,
    link: `/ventas/whatsapp?tel=${telefono}`,
  }).catch((err) => console.error("[whatsapp] no se pudo avisar al asesor:", err));
}

/** El job: contestar lo que venció y mandar el mensaje siguiente de lo que se está mandando. */
export async function revisarAsistente(ahora = new Date()) {
  const vencidas = await prisma.whatsAppConversacion.findMany({
    where: { asistenteEstado: { in: ["PROGRAMADO", "ENVIANDO"] }, asistenteEn: { lte: ahora } },
    select: { id: true, phoneNumberId: true, telefono: true, asistenteEstado: true, asistenteEn: true, createdAt: true },
    take: 20,
  });
  for (const c of vencidas) {
    // La toma una sola vez (si llegó otro mensaje, la espera se corrió).
    const tomada = await prisma.whatsAppConversacion.updateMany({
      where: { id: c.id, asistenteEn: c.asistenteEn },
      data: { asistenteEn: null },
    });
    if (!tomada.count) continue;
    const accion = c.asistenteEstado === "PROGRAMADO" ? contestar(c.phoneNumberId, c.telefono) : mandarSiguiente(c.phoneNumberId, c.telefono);
    await accion.catch((err) => console.error("[whatsapp] falló el asistente:", err instanceof Error ? err.message : err));
  }
}

async function contestar(phoneNumberId: string, telefono: string) {
  const numero = await numeroConAsistente(phoneNumberId);
  if (!numero) {
    await prisma.whatsAppConversacion.update({ where: DONDE(phoneNumberId, telefono), data: { asistenteEstado: null } });
    return;
  }
  const primero = await prisma.whatsAppMensaje.findFirst({
    where: { phoneNumberId, telefono, direccion: "ENTRANTE" },
    orderBy: { ocurridoEn: "asc" },
    select: { ocurridoEn: true },
  });
  if (primero && (await contestoUnaPersona(phoneNumberId, telefono, primero.ocurridoEn))) {
    await prisma.whatsAppConversacion.update({ where: DONDE(phoneNumberId, telefono), data: { asistenteEstado: "HUMANO" } });
    return;
  }
  const asesor = (numero.responsable?.name ?? "").split(" ")[0] || "el asesor";
  const r = await armarRespuesta(phoneNumberId, telefono, asesor);
  if (!r) {
    await pasarAlAsesor(phoneNumberId, telefono, "El asistente no pudo contestar", numero.responsableId!);
    return;
  }
  if (r.derivar) {
    await pasarAlAsesor(phoneNumberId, telefono, r.motivo || "Necesita al asesor", numero.responsableId!);
    return;
  }
  if (r.mensajes.length === 0) {
    await prisma.whatsAppConversacion.update({ where: DONDE(phoneNumberId, telefono), data: { asistenteEstado: "HUMANO", asistenteMotivo: r.motivo } });
    return;
  }
  if (numero.asistente === "PRUEBA") {
    await prisma.whatsAppConversacion.update({
      where: DONDE(phoneNumberId, telefono),
      data: { asistenteEstado: "SOMBRA", asistenteMotivo: r.motivo, asistenteSombra: r.mensajes },
    });
    return;
  }
  await prisma.whatsAppConversacion.update({
    where: DONDE(phoneNumberId, telefono),
    // asistenteEn queda vacío mientras se manda el primero: así el job no lo toma dos veces.
    data: { asistenteEstado: "ENVIANDO", asistenteMotivo: r.motivo, asistentePendientes: r.mensajes, asistenteEn: null },
  });
  await mandarSiguiente(phoneNumberId, telefono);
}

async function mandarSiguiente(phoneNumberId: string, telefono: string) {
  const conv = await prisma.whatsAppConversacion.findUniqueOrThrow({ where: DONDE(phoneNumberId, telefono) });
  if (conv.asistenteEstado !== "ENVIANDO") return;
  const pendientes = (conv.asistentePendientes as string[] | null) ?? [];
  const numero = await numeroConAsistente(phoneNumberId);
  // Si escribió el asesor en el medio, se corta.
  const desde = new Date(Date.now() - 10 * 60_000);
  if (!numero || numero.asistente !== "ACTIVO" || (await contestoUnaPersona(phoneNumberId, telefono, desde))) {
    await prisma.whatsAppConversacion.update({
      where: { id: conv.id },
      data: { asistenteEstado: "HUMANO", asistentePendientes: Prisma.DbNull, asistenteEn: null },
    });
    return;
  }
  const [texto, ...resto] = pendientes;
  if (texto) {
    const cuenta = (await bandejaVentas(numero.responsableId!)).cuenta;
    if (!cuenta) return;
    await enviarTexto({ telefono, texto, userId: null, cuenta, origen: "ASISTENTE" });
  }
  await prisma.whatsAppConversacion.update({
    where: { id: conv.id },
    data:
      resto.length > 0
        ? { asistentePendientes: resto, asistenteEn: new Date(Date.now() + azar(...PAUSA_ENTRE_MENSAJES_S) * 1000) }
        : { asistenteEstado: "SPEECH", asistentePendientes: Prisma.DbNull, asistenteEn: null },
  });
  if (resto.length === 0) {
    await createAuditEntry({
      entityType: AuditEntityType.user,
      entityId: numero.responsableId!,
      userId: numero.responsableId!,
      action: AuditAction.created,
      description: `El asistente de WhatsApp le mandó el speech a +${telefono}`,
    });
  }
}

let iniciado = false;
export function startAsistenteWhatsApp() {
  if (iniciado) return;
  iniciado = true;
  setInterval(() => {
    revisarAsistente().catch((err) => console.error("[whatsapp] falló la revisión del asistente:", err));
  }, 10_000).unref();
}

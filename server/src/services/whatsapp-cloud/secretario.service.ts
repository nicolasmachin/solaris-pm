/**
 * El "secretario" de WhatsApp: lo que usa el chat de Claude (conector MCP,
 * herramientas whatsapp_*) para leer los números de una persona —sobre todo el
 * de trabajo de la Dirección (uso DIRECCION), que no tiene bandeja en Voltia
 * PM— y, cuando se lo pide, contestar desde ahí.
 *
 * Cada uno ve los números de los que es responsable; el admin, cualquiera.
 * Pedido de Nicolás del 17-nov-2026. Ver docs/manual/15-whatsapp.md.
 */

import { prisma } from "../../lib/prisma.js";
import { badRequest, notFound } from "../../utils/errors.js";
import { normalizarTelefono } from "./api.service.js";
import { bandejaDeNumero, clienteDe, estaSinContestar, mandar, reconocedor, type ClienteDeConversacion } from "./bandejas.service.js";

type Usuario = { id: string; role: string };

/** Los números que puede leer: los suyos; el admin, todos. */
export async function numerosDe(u: Usuario) {
  return prisma.whatsAppNumero.findMany({
    where: { estado: "CONECTADO", ...(u.role === "ADMIN" ? {} : { responsableId: u.id }) },
    select: { phoneNumberId: true, telefono: true, uso: true, responsableId: true, responsable: { select: { name: true } } },
    orderBy: { conectadoEn: "asc" },
  });
}

/**
 * El número a leer: el que pidió (por teléfono o "mío") o, si no dijo, el suyo
 * de Dirección y si no el primero suyo.
 */
export async function elegirNumero(u: Usuario, cual?: string | null) {
  const numeros = await numerosDe(u);
  if (numeros.length === 0) throw notFound("SIN_NUMERO", "No tenés ningún número de WhatsApp conectado a Voltia PM.");
  if (cual?.trim()) {
    const d = cual.replace(/\D/g, "");
    const n = numeros.find((x) => d.length >= 6 && x.telefono.replace(/\D/g, "").endsWith(d.slice(-8)));
    if (n) return n;
    const porNombre = numeros.find((x) => x.responsable?.name.toLowerCase().includes(cual.trim().toLowerCase()));
    if (porNombre) return porNombre;
    throw notFound("NUMERO_NO_ENCONTRADO", `No encontré el número "${cual}". Los tuyos: ${numeros.map((x) => x.telefono).join(", ")}.`);
  }
  return (
    numeros.find((x) => x.uso === "DIRECCION" && x.responsableId === u.id) ??
    numeros.find((x) => x.responsableId === u.id) ??
    numeros[0]
  );
}

const ETIQUETA: Record<string, string> = {
  image: "Foto",
  audio: "Audio",
  voice: "Audio",
  video: "Video",
  document: "Documento",
  sticker: "Sticker",
  location: "Ubicación",
  reaction: "Reacción",
  unsupported: "MENSAJE NO DISPONIBLE (verlo en el celular)",
};

/** Un mensaje en una línea de texto, con la transcripción si es audio. */
export function lineaDe(m: { tipo: string; texto: string | null; transcripcion?: string | null; archivoPath?: string | null }) {
  if (m.tipo === "text") return m.texto ?? "";
  const etiqueta = ETIQUETA[m.tipo] ?? m.tipo;
  if (m.transcripcion) return `[${etiqueta}] «${m.transcripcion}»`;
  return `[${etiqueta}]${m.texto ? ` ${m.texto}` : ""}`;
}

function quienEs(c: ClienteDeConversacion | null, nombrePerfil: string | null, telefono: string) {
  if (c?.interno) return `${c.nombre} (${c.codigo})`;
  if (c) return `${c.nombre} · ${c.codigo}${c.leadId ? " (lead)" : c.projectId ? " (cliente)" : ""}`;
  return nombrePerfil ? `~${nombrePerfil} (no está en Voltia PM)` : `+${telefono} (no está en Voltia PM)`;
}

const HORA = (d: Date) =>
  d.toLocaleString("es-UY", { timeZone: "America/Montevideo", weekday: "short", day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" });

/**
 * Los chats donde el último mensaje es del otro (nadie le contestó), del más
 * viejo al más nuevo, con lo que mandó desde la última respuesta nuestra.
 */
export async function pendientes(phoneNumberId: string, dias = 14) {
  const bandeja = await bandejaDeNumero(phoneNumberId);
  const quienDe = await reconocedor(bandeja);
  const desde = new Date(Date.now() - dias * 24 * 3600_000);
  const mensajes = await prisma.whatsAppMensaje.findMany({
    where: { phoneNumberId, ocurridoEn: { gte: desde }, tipo: { notIn: ["reaction", "edit"] } },
    orderBy: { ocurridoEn: "asc" },
    select: { telefono: true, direccion: true, tipo: true, texto: true, transcripcion: true, ocurridoEn: true },
  });
  const porTel = new Map<string, typeof mensajes>();
  for (const m of mensajes) porTel.set(m.telefono, [...(porTel.get(m.telefono) ?? []), m]);
  const estados = await prisma.whatsAppConversacion.findMany({
    where: { phoneNumberId, telefono: { in: [...porTel.keys()] } },
    select: { telefono: true, resueltoHasta: true, nombrePerfil: true },
  });
  const estadoDe = new Map(estados.map((e) => [e.telefono, e]));
  const salida = [];
  for (const [telefono, ms] of porTel) {
    const ultimo = ms[ms.length - 1];
    const ultimoEntrante = [...ms].reverse().find((m) => m.direccion === "ENTRANTE");
    const e = estadoDe.get(telefono);
    if (!estaSinContestar({ direccion: ultimo.direccion, ultimoEntranteEn: ultimoEntrante?.ocurridoEn ?? null }, e?.resueltoHasta)) continue;
    // Los del equipo también se listan (también esperan respuesta), marcados.
    const cliente = quienDe(telefono);
    const ultimaNuestra = [...ms].reverse().find((m) => m.direccion === "SALIENTE");
    const sinContestar = ms.filter((m) => m.direccion === "ENTRANTE" && (!ultimaNuestra || m.ocurridoEn > ultimaNuestra.ocurridoEn));
    salida.push({
      telefono,
      quien: quienEs(cliente, e?.nombrePerfil ?? null, telefono),
      interno: !!cliente?.interno,
      desde: sinContestar[0]?.ocurridoEn ?? ultimo.ocurridoEn,
      mensajes: sinContestar.slice(-8).map((m) => `${HORA(m.ocurridoEn)}: ${lineaDe(m)}`),
      cantidad: sinContestar.length,
      ultimaRespuestaNuestra: ultimaNuestra ? HORA(ultimaNuestra.ocurridoEn) : null,
    });
  }
  return salida.sort((a, b) => a.desde.getTime() - b.desde.getTime());
}

/** Encuentra el chat por teléfono o por nombre (contacto, lead, cliente, usuario o nombre de WhatsApp). */
export async function buscarChat(phoneNumberId: string, quien: string): Promise<string> {
  const d = quien.replace(/\D/g, "");
  if (d.length >= 8) {
    const tel = normalizarTelefono(quien);
    const hay = await prisma.whatsAppMensaje.findFirst({
      where: { phoneNumberId, telefono: { endsWith: tel.slice(-8) } },
      select: { telefono: true },
    });
    return hay?.telefono ?? tel;
  }
  const q = quien.trim();
  const telefonos = new Set<string>();
  const [contactos, leads, proyectos, usuarios, perfiles] = await Promise.all([
    prisma.contacto.findMany({ where: { deletedAt: null, nombre: { contains: q, mode: "insensitive" }, telefono: { not: null } }, select: { telefono: true } }),
    prisma.salesLead.findMany({ where: { deletedAt: null, clientName: { contains: q, mode: "insensitive" } }, select: { clientPhone: true } }),
    prisma.project.findMany({ where: { deletedAt: null, clientName: { contains: q, mode: "insensitive" } }, select: { clientPhone: true } }),
    prisma.user.findMany({ where: { deletedAt: null, name: { contains: q, mode: "insensitive" } }, select: { phone: true } }),
    prisma.whatsAppConversacion.findMany({ where: { phoneNumberId, nombrePerfil: { contains: q, mode: "insensitive" } }, select: { telefono: true } }),
  ]);
  for (const c of contactos) telefonos.add(c.telefono!);
  for (const p of perfiles) telefonos.add(p.telefono);
  for (const x of [...leads.map((l) => l.clientPhone), ...proyectos.map((p) => p.clientPhone), ...usuarios.map((u) => u.phone)]) {
    const t = x ? normalizarTelefono(x.split(/[\/,;]/)[0]) : "";
    if (t.length >= 10) telefonos.add(t);
  }
  if (telefonos.size === 0) throw notFound("CHAT_NO_ENCONTRADO", `No encontré a "${quien}" en Voltia PM.`);
  // De los candidatos, el que tiene conversación en este número, la más reciente.
  const conChat = await prisma.whatsAppMensaje.findFirst({
    where: { phoneNumberId, telefono: { in: [...telefonos] } },
    orderBy: { ocurridoEn: "desc" },
    select: { telefono: true },
  });
  if (!conChat) throw notFound("CHAT_NO_ENCONTRADO", `"${quien}" no tiene conversación en este número.`);
  return conChat.telefono;
}

/** Un chat entero (los últimos `cuantos` mensajes), en texto. */
export async function leerChat(phoneNumberId: string, telefono: string, cuantos = 80) {
  const bandeja = await bandejaDeNumero(phoneNumberId);
  const [ms, e, cliente] = await Promise.all([
    prisma.whatsAppMensaje.findMany({
      where: { phoneNumberId, telefono, tipo: { notIn: ["edit"] } },
      orderBy: { ocurridoEn: "desc" },
      take: cuantos,
      select: { direccion: true, tipo: true, texto: true, transcripcion: true, ocurridoEn: true, origen: true, enviadoPor: { select: { name: true } } },
    }),
    prisma.whatsAppConversacion.findUnique({
      where: { phoneNumberId_telefono: { phoneNumberId, telefono } },
      select: { nombrePerfil: true },
    }),
    clienteDe(bandeja, telefono),
  ]);
  const yo = bandeja.responsable?.nombre ?? "Voltia";
  return {
    quien: quienEs(cliente, e?.nombrePerfil ?? null, telefono),
    telefono,
    lineas: ms.reverse().map((m) => {
      const autor =
        m.direccion === "ENTRANTE"
          ? "Él/ella"
          : m.origen === "ASISTENTE"
            ? "Asistente"
            : m.enviadoPor?.name
              ? `${m.enviadoPor.name} (desde Voltia PM)`
              : yo;
      return `${HORA(m.ocurridoEn)} · ${autor}: ${lineaDe(m)}`;
    }),
  };
}

/** Busca un texto en los mensajes (y en lo que dicen los audios) de los números que puede leer. */
export async function buscarTexto(phoneNumberIds: string[], texto: string, dias = 90) {
  const q = texto.trim();
  if (q.length < 3) throw badRequest("BUSQUEDA_CORTA", "Escribí al menos 3 letras para buscar.");
  const ms = await prisma.whatsAppMensaje.findMany({
    where: {
      phoneNumberId: { in: phoneNumberIds },
      ocurridoEn: { gte: new Date(Date.now() - dias * 24 * 3600_000) },
      OR: [{ texto: { contains: q, mode: "insensitive" } }, { transcripcion: { contains: q, mode: "insensitive" } }],
    },
    orderBy: { ocurridoEn: "desc" },
    take: 40,
    select: { phoneNumberId: true, telefono: true, direccion: true, tipo: true, texto: true, transcripcion: true, ocurridoEn: true },
  });
  const reconocedores = new Map<string, (t: string) => ClienteDeConversacion | null>();
  const salida = [];
  for (const m of ms) {
    if (!reconocedores.has(m.phoneNumberId)) reconocedores.set(m.phoneNumberId, await reconocedor(await bandejaDeNumero(m.phoneNumberId)));
    const cliente = reconocedores.get(m.phoneNumberId)!(m.telefono);
    salida.push(`${HORA(m.ocurridoEn)} · ${quienEs(cliente, null, m.telefono)} · ${m.direccion === "ENTRANTE" ? "escribió" : "le escribimos"}: ${lineaDe(m)}`);
  }
  return salida;
}

/** Manda un texto desde un número (solo con la ventana de 24 h abierta). */
export async function enviar(phoneNumberId: string, telefono: string, texto: string, userId: string) {
  const bandeja = await bandejaDeNumero(phoneNumberId);
  return mandar(bandeja, { tipo: "texto", telefono, texto }, userId);
}

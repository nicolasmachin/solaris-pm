/**
 * Contestador de mensajes privados de Instagram de @voltia_uy, con Claude.
 *
 * Pedido de Nicolás del 25-oct-2026; contestó desde el servidor de indicadores
 * del 29-oct y pasa a Voltia PM con el encargo del 29-oct (Tabaré, con el aval
 * de Nicolás). Las reglas son de Nicolás y están en la automatización
 * "privados" (Marketing → Automatizaciones); lo que puede decir de Voltia, en
 * el texto "_datos".
 *
 * Cómo anda:
 * 1. Meta avisa cada mensaje por el webhook. Se guarda en la conversación de
 *    esa persona (`registrarMensaje`).
 * 2. Si lo escribió un cliente, se agenda la respuesta para dentro de un rato
 *    al azar (`responderDesde`; la gente escribe en tandas y no tiene que
 *    parecer automático). Cada mensaje nuevo corre la espera.
 * 3. El job levanta las que vencieron y `atender` decide (`porQueNo`): no se
 *    contesta si el asistente está apagado, fuera de la ventana de Meta, si
 *    ManyChat o una persona escribió hace poco, si se derivó, si alguien la
 *    tomó o si se llegó al tope de gasto.
 * 4. Claude devuelve los mensajes, si hay que derivar, si es un lead, si contó
 *    el speech y de qué se trató. Se mandan de a uno con "escribiendo…", se
 *    etiqueta el contacto y, si se derivó, le llega un mail a Martín.
 *
 * En modo sombra hace todo menos mandar (ni mensajes, ni etiquetas, ni mails):
 * lo que habría contestado queda en `instagram_eventos` con `sombra = true`.
 */

import type Anthropic from "@anthropic-ai/sdk";
import type { InstagramConversacion, InstagramMensaje, Prisma } from "@prisma/client";

import { prisma } from "../../lib/prisma.js";
import { type MensajeAviso, textoDe } from "./aviso.js";
import { type Automatizacion, completar, deTipo, normalizar, textoComun } from "./automatizaciones.js";
import { pedirJson } from "./claude.js";
import { IG, asistenteConfig, modoInstagram, type ModoInstagram } from "./config.js";
import { ETIQUETA, TEMAS, etiquetar } from "./contactos.js";
import { claveDe, PAUSA_DERIVADA_MS, VENTANA_ANUNCIO_MS, VENTANA_MS } from "./conversacion.js";
import * as meta from "./meta.js";
import { anotar, avisar, avisarGasto, superoElTope } from "./registro.js";

export const MAXIMO_CARACTERES = 1000; // el límite de Instagram por mensaje
export const MAXIMO_MENSAJES = 6;
const HISTORIA = 30; // mensajes que se le pasan a Claude
// Pausa entre mensajes, con "escribiendo…": como tipea una persona.
const CARACTERES_POR_SEGUNDO = 25;
const PAUSA_MINIMA_S = 2;
const PAUSA_MAXIMA_S = 9;
const DIAS = ["domingo", "lunes", "martes", "miércoles", "jueves", "viernes", "sábado"];

export const ESQUEMA = {
  type: "object",
  properties: {
    mensajes: { type: "array", items: { type: "string" } },
    derivar: { type: "boolean" },
    lead: { type: "boolean" },
    speech: { type: "boolean" },
    temas: { type: "array", items: { type: "string", enum: [...TEMAS] } },
    motivo: { type: "string" },
  },
  required: ["mensajes", "derivar", "lead", "speech", "temas", "motivo"],
  additionalProperties: false,
};

export type ResultadoPrivado = {
  mensajes?: string[];
  respuesta?: string;
  derivar?: boolean;
  lead?: boolean;
  speech?: boolean;
  temas?: string[];
  motivo?: string;
};

export type Conv = InstagramConversacion & { mensajes: InstagramMensaje[] };
type MensajeLite = Pick<InstagramMensaje, "autor" | "enviadoEn" | "texto">;

/** Lo que se reemplaza en las pruebas. */
export type Deps = {
  claude: (conv: Conv, aparte?: string) => Promise<{ resultado: ResultadoPrivado | null; problema: string | null; costoUsd: number }>;
  enviar: (persona: string, texto: string) => Promise<string>;
  escribiendo: (persona: string) => Promise<void>;
  dormir: (ms: number) => Promise<void>;
  perfil: (persona: string) => Promise<meta.Perfil>;
  avisar: (asunto: string, cuerpo: string, para?: string[]) => Promise<boolean>;
};

export const depsReales: Deps = {
  claude: (conv, aparte) => preguntarAClaude(conv, aparte),
  enviar: meta.enviarMensaje,
  escribiendo: meta.mostrarEscribiendo,
  dormir: (ms) => new Promise((r) => setTimeout(r, ms)),
  perfil: meta.perfil,
  avisar,
};

// ── Recibir ─────────────────────────────────────────────────────────────────

export function pidioMasInfo(texto: string): boolean {
  return ["quiero mas info", "quiero mas informacion", "me interesa mas info"].includes(
    normalizar(texto).replace(/^[\s!.]+|[\s!.]+$/g, ""),
  );
}

function alAzar([minimo, maximo]: [number, number]): number {
  return (minimo + Math.random() * (maximo - minimo)) * 1000;
}

/**
 * Guarda un mensaje del webhook. Los ecos son lo que mandó @voltia_uy: si es
 * una respuesta nuestra ya está guardada (mismo id); si no, la mandó ManyChat o
 * una persona desde el celular ("OTRO"). Devuelve el id de la conversación si
 * lo escribió un cliente.
 */
export async function registrarMensaje(m: MensajeAviso, ahora = new Date()): Promise<string | null> {
  const esEco = m.esEco || m.de === IG.cuenta;
  const persona = esEco ? m.para : m.de;
  if (!/^\d+$/.test(persona) || persona === IG.cuenta) return null;
  const autor = esEco ? "OTRO" : "CLIENTE";
  const enviadoEn = new Date(m.momentoMs || ahora.getTime());
  const texto = textoDe(m);
  const clave = claveDe({ mid: m.mid, momento: enviadoEn.getTime() / 1000, de: esEco ? "otro" : "cliente", texto });

  const conv = await prisma.instagramConversacion.upsert({
    where: { persona },
    create: { persona },
    update: {},
  });
  const nuevo = await prisma.instagramMensaje.createMany({
    data: [{ conversacionId: conv.id, clave, autor, texto, enviadoEn }],
    skipDuplicates: true,
  });
  if (nuevo.count === 0) return null; // Meta reintenta, o es el eco de algo nuestro

  const datos: Prisma.InstagramConversacionUpdateInput = {
    ultimoMensajeEn: !conv.ultimoMensajeEn || enviadoEn > conv.ultimoMensajeEn ? enviadoEn : undefined,
  };
  if (!esEco) {
    if (!conv.ultimoClienteEn || enviadoEn > conv.ultimoClienteEn) datos.ultimoClienteEn = enviadoEn;
    if (m.anuncio) datos.desdeAnuncio = true;
    const auto = modoInstagram() === "apagado" ? null : await deTipo("privado");
    if (auto?.activa) datos.responderDesde = new Date(ahora.getTime() + alAzar(auto.espera));
  }
  await prisma.instagramConversacion.update({ where: { id: conv.id }, data: datos });

  if (esEco) return null;
  if (modoInstagram() === "envio") {
    const etiquetas: string[] = [ETIQUETA.ESCRIBIO];
    if (m.anuncio) etiquetas.push(ETIQUETA.ANUNCIO);
    if (pidioMasInfo(m.texto)) etiquetas.push(ETIQUETA.MAS_INFO);
    await etiquetar({ persona, usuario: conv.usuario, momento: enviadoEn }, etiquetas);
  }
  return conv.id;
}

/**
 * Guarda en la conversación un mensaje que mandó otra automatización (el
 * privado de un lead magnet), con de dónde vino la persona.
 */
export async function anotarEnviado(args: { persona: string; mid: string; texto: string; usuario?: string; origen?: string }) {
  if (!/^\d+$/.test(args.persona)) return;
  const ahora = new Date();
  const conv = await prisma.instagramConversacion.upsert({
    where: { persona: args.persona },
    create: { persona: args.persona, usuario: args.usuario || null },
    update: {},
  });
  const clave = claveDe({ mid: args.mid, momento: ahora.getTime() / 1000, de: "asistente", texto: args.texto });
  await prisma.instagramMensaje.upsert({
    where: { conversacionId_clave: { conversacionId: conv.id, clave } },
    // El eco pudo llegar antes y quedar como "otro".
    create: { conversacionId: conv.id, clave, autor: "ASISTENTE", texto: args.texto, enviadoEn: ahora },
    update: { autor: "ASISTENTE" },
  });
  const origenes = Array.isArray(conv.origenes) ? (conv.origenes as Prisma.JsonArray) : [];
  await prisma.instagramConversacion.update({
    where: { id: conv.id },
    data: {
      usuario: conv.usuario || args.usuario || null,
      ultimoMensajeEn: ahora,
      ...(args.origen ? { origenes: [...origenes, { momento: Math.round(ahora.getTime() / 1000), texto: args.origen }] } : {}),
    },
  });
}

// ── Decidir ─────────────────────────────────────────────────────────────────

export type Razon =
  | "apagado"
  | "sin_mensajes"
  | "ya_contestado"
  | "fuera_de_ventana"
  | "tomada"
  | "contesto_otro"
  | "derivada"
  | "tope_de_gasto";

/**
 * La razón para NO contestar ahora, o null si se puede. Lógica pura.
 *
 * En modo sombra no se mira si escribió "otro": mientras convive con el
 * contestador de indicadores, sus respuestas llegan como ecos y el asistente
 * de Voltia PM se callaría siempre. Ahí se quiere ver qué habría contestado.
 */
export function porQueNo(
  conv: Pick<InstagramConversacion, "desdeAnuncio" | "derivadaEn" | "tomadaEn">,
  mensajes: Array<Pick<InstagramMensaje, "autor" | "enviadoEn">>,
  ahora: Date,
  ctx: { modo: ModoInstagram; activa: boolean; pausaOtroMs: number; topeSuperado: boolean },
): Razon | null {
  if (ctx.modo === "apagado" || !ctx.activa) return "apagado";
  const delCliente = mensajes.filter((m) => m.autor === "CLIENTE");
  if (delCliente.length === 0) return "sin_mensajes";
  if (mensajes[mensajes.length - 1].autor !== "CLIENTE") return "ya_contestado";
  const ventana = conv.desdeAnuncio ? VENTANA_ANUNCIO_MS : VENTANA_MS;
  if (ahora.getTime() - delCliente[delCliente.length - 1].enviadoEn.getTime() > ventana) return "fuera_de_ventana";
  if (conv.tomadaEn) return "tomada";
  if (
    ctx.modo === "envio" &&
    mensajes.some((m) => (m.autor === "OTRO" || m.autor === "PERSONA") && ahora.getTime() - m.enviadoEn.getTime() < ctx.pausaOtroMs)
  ) {
    return "contesto_otro";
  }
  if (conv.derivadaEn && ahora.getTime() - conv.derivadaEn.getTime() < PAUSA_DERIVADA_MS) return "derivada";
  if (ctx.topeSuperado) return "tope_de_gasto";
  return null;
}

export function escribioOtro(mensajes: Array<Pick<InstagramMensaje, "autor" | "enviadoEn">>, desde: Date): boolean {
  return mensajes.some((m) => (m.autor === "OTRO" || m.autor === "PERSONA") && m.enviadoEn >= desde);
}

/** Los mensajes a mandar, limpios. Acepta también la forma vieja ("respuesta"). */
export function mensajesDe(r: ResultadoPrivado): string[] {
  const crudos = r.mensajes ?? [r.respuesta ?? ""];
  return crudos
    .map((t) => String(t ?? "").trim().slice(0, MAXIMO_CARACTERES))
    .filter(Boolean)
    .slice(0, MAXIMO_MENSAJES);
}

const digitos = (t: string) => t.replace(/\D/g, "");

/** Si deriva y Claude no puso el WhatsApp, se agrega. */
export function conWhatsapp(textos: string[], derivar: boolean): string[] {
  const c = asistenteConfig();
  if (!derivar || !c.derivarWhatsapp || textos.some((t) => digitos(t).includes(digitos(c.derivarWhatsapp)))) return textos;
  return [...textos, `Te paso con ${c.derivarA} por WhatsApp al ${c.derivarWhatsapp}.`];
}

// ── Claude ──────────────────────────────────────────────────────────────────

export function mensajesParaClaude(mensajes: MensajeLite[]): Anthropic.MessageParam[] {
  const turnos: Array<{ role: "user" | "assistant"; content: string }> = [];
  for (const m of mensajes.slice(-HISTORIA)) {
    const rol = m.autor === "CLIENTE" ? "user" : "assistant";
    let texto = m.texto || "[mensaje sin texto]";
    if (m.autor === "OTRO" || m.autor === "PERSONA") texto = `[Escribió Voltia por otro lado] ${texto}`;
    const ultimo = turnos[turnos.length - 1];
    if (ultimo && ultimo.role === rol) ultimo.content += `\n${texto}`;
    else turnos.push({ role: rol, content: texto });
  }
  while (turnos.length && turnos[0].role !== "user") turnos.shift();
  return turnos;
}

function conAparte(turnos: Anthropic.MessageParam[], aparte: string): Anthropic.MessageParam[] {
  if (!aparte) return turnos;
  const ultimo = turnos[turnos.length - 1];
  if (ultimo?.role === "user") return [...turnos.slice(0, -1), { role: "user", content: `${ultimo.content}\n\n${aparte}` }];
  return [...turnos, { role: "user", content: aparte }];
}

function horaUruguay(ahora: Date) {
  const p = Object.fromEntries(
    new Intl.DateTimeFormat("en-GB", {
      timeZone: "America/Montevideo",
      weekday: "short",
      day: "2-digit",
      month: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      hourCycle: "h23",
    })
      .formatToParts(ahora)
      .map((x) => [x.type, x.value]),
  );
  const dia = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].indexOf(p.weekday);
  return { dia, hora: Number(p.hour), texto: `${DIAS[dia]} ${p.day}/${p.month} ${p.hour}:${p.minute}` };
}

/** Lo propio de esta conversación: va aparte de las instrucciones para no romper el caché. */
export function contexto(conv: InstagramConversacion, ahora = new Date()): string {
  const l = ["# Esta conversación", ""];
  if (conv.nombre) l.push(`- Nombre en Instagram: ${conv.nombre}`);
  if (conv.usuario) l.push(`- Usuario: @${conv.usuario}`);
  for (const o of (Array.isArray(conv.origenes) ? conv.origenes : []) as Array<{ texto?: string }>) {
    if (o?.texto) l.push(`- ${o.texto}`);
  }
  if (conv.desdeAnuncio) l.push("- Escribió desde un anuncio.");
  if (conv.sigue !== null) l.push(`- Sigue a @voltia_uy: ${conv.sigue ? "sí" : "no"}`);
  if (conv.speechEn) l.push("- Ya se le mandó el speech en esta conversación.");
  l.push(`- Ahora en Uruguay: ${horaUruguay(ahora).texto}`);
  return l.join("\n");
}

async function instrucciones(auto: Automatizacion): Promise<string> {
  return completar(auto.flujo.replace("{DATOS}", completar(await textoComun("_datos"))));
}

async function preguntarAClaude(conv: Conv, aparte = "") {
  const auto = await deTipo("privado");
  if (!auto) throw new Error("No está la automatización de privados.");
  return pedirJson<ResultadoPrivado>({
    feature: "instagram_privados",
    instrucciones: await instrucciones(auto),
    contexto: contexto(conv),
    mensajes: conAparte(mensajesParaClaude(conv.mensajes), aparte),
    esquema: ESQUEMA,
    maxTokens: 4000,
    entityId: conv.id,
  });
}

// ── Atender ─────────────────────────────────────────────────────────────────

const atendiendo = new Set<string>();

async function cargar(id: string): Promise<Conv | null> {
  return prisma.instagramConversacion.findUnique({
    where: { id },
    include: { mensajes: { orderBy: { enviadoEn: "asc" } } },
  });
}

/** Decide y, si corresponde, contesta. Devuelve la decisión. */
export async function atender(id: string, deps: Deps = depsReales, ahora = new Date()): Promise<string> {
  if (atendiendo.has(id)) return "en_curso";
  atendiendo.add(id);
  try {
    return await atenderSinCandado(id, deps, ahora);
  } finally {
    atendiendo.delete(id);
  }
}

async function atenderSinCandado(id: string, deps: Deps, ahora: Date): Promise<string> {
  let conv = await cargar(id);
  if (!conv) return "sin_conversacion";
  const modo = modoInstagram();
  const sombra = modo === "sombra";
  const auto = await deTipo("privado");
  const base = { tipo: "privado" as const, automatizacion: auto?.id ?? "privados", persona: conv.persona, sombra, desdeAnuncio: conv.desdeAnuncio };

  const topeSuperado = await superoElTope(ahora);
  const razon = porQueNo(conv, conv.mensajes, ahora, {
    modo,
    activa: Boolean(auto?.activa),
    pausaOtroMs: asistenteConfig().pausaOtroMin * 60_000,
    topeSuperado,
  });
  if (razon) {
    if (razon !== "ya_contestado" && razon !== "sin_mensajes" && razon !== "apagado") {
      await anotar({ ...base, usuario: conv.usuario, resultado: "no_contestado", razon });
    }
    if (razon === "tope_de_gasto") await avisarGasto(ahora);
    return razon;
  }
  const ultimo = conv.mensajes[conv.mensajes.length - 1].enviadoEn;

  const p = await deps.perfil(conv.persona);
  conv = {
    ...conv,
    ...(await prisma.instagramConversacion.update({
      where: { id },
      data: {
        usuario: conv.usuario || p.username || null,
        nombre: conv.nombre || p.name || null,
        sigue: p.is_user_follow_business ?? conv.sigue,
      },
    })),
  };

  const { resultado, problema, costoUsd } = await deps.claude(conv);
  await avisarGasto(ahora);
  const r: ResultadoPrivado = resultado ?? { mensajes: [], derivar: true, lead: false, motivo: problema ?? "sin respuesta" };
  const lead = Boolean(r.lead);
  const derivar = Boolean(r.derivar) || lead;
  const motivo = (r.motivo ?? "").trim();
  const temas = (r.temas ?? []).filter((t) => (TEMAS as readonly string[]).includes(t));
  const textos = conWhatsapp(mensajesDe(r), derivar);
  const evento = { ...base, usuario: conv.usuario, costoUsd, lead, derivado: derivar, datos: { motivo, temas, mensajes: textos } };

  if (sombra) {
    await anotar({ ...evento, resultado: textos.length ? (derivar ? "derivado" : "contestado") : "sin_respuesta", speech: Boolean(r.speech) });
    return "sombra";
  }

  // Mientras Claude pensaba, ¿escribió alguien de Voltia o ManyChat?
  const ahoraConv = await cargar(id);
  if (!ahoraConv || escribioOtro(ahoraConv.mensajes, ultimo)) {
    await anotar({ ...evento, resultado: "no_contestado", razon: "contesto_otro" });
    return "contesto_otro";
  }
  if (textos.length === 0) {
    await anotar({ ...evento, resultado: "sin_respuesta" });
    return "sin_respuesta";
  }

  const mandados = await mandar(ahoraConv, textos, ultimo, deps);
  const speech = Boolean(r.speech) && mandados > 0;
  const decision = derivar ? "derivado" : "contestado";
  const final = await prisma.instagramConversacion.update({
    where: { id },
    data: {
      ...(derivar ? { derivadaEn: ahora, derivadaMotivo: motivo || null, derivadaLead: lead } : {}),
      ...(speech ? { speechEn: ahora } : {}),
    },
    include: { mensajes: { orderBy: { enviadoEn: "asc" } } },
  });
  await anotar({ ...evento, resultado: decision, speech, datos: { ...evento.datos, mandados } });

  const etiquetas = temas.map((t) => `Tema: ${t}`);
  if (speech) etiquetas.push(ETIQUETA.SPEECH);
  if (lead) etiquetas.push(ETIQUETA.LEAD);
  if (derivar) etiquetas.push(ETIQUETA.DERIVADO);
  await etiquetar({ persona: final.persona, usuario: final.usuario, nombre: final.nombre, sigue: final.sigue, momento: ahora }, etiquetas);
  if (derivar) await avisarDerivacion(final, motivo, lead, deps);
  return decision;
}

/** Manda los mensajes de a uno, con pausas de "escribiendo…". Devuelve cuántos salieron. */
async function mandar(conv: Conv, textos: string[], ultimo: Date, deps: Deps): Promise<number> {
  let mandados = 0;
  for (const [i, texto] of textos.entries()) {
    if (i > 0) {
      await deps.escribiendo(conv.persona);
      const segundos = Math.min(PAUSA_MAXIMA_S, Math.max(PAUSA_MINIMA_S, texto.length / CARACTERES_POR_SEGUNDO));
      await deps.dormir(segundos * 1000);
      const ahora = await cargar(conv.id);
      if (!ahora || escribioOtro(ahora.mensajes, ultimo)) break; // ManyChat o una persona se metió
    }
    const mid = await deps.enviar(conv.persona, texto);
    mandados += 1;
    const enviadoEn = new Date();
    const clave = claveDe({ mid, momento: enviadoEn.getTime() / 1000, de: "asistente", texto });
    await prisma.instagramMensaje.upsert({
      where: { conversacionId_clave: { conversacionId: conv.id, clave } },
      // El eco de nuestra respuesta pudo llegar antes y quedar como "otro".
      create: { conversacionId: conv.id, clave, autor: "ASISTENTE", texto, enviadoEn },
      update: { autor: "ASISTENTE" },
    });
    await prisma.instagramConversacion.update({ where: { id: conv.id }, data: { ultimoMensajeEn: enviadoEn } });
  }
  return mandados;
}

function fechaCorta(d: Date): string {
  return d.toLocaleString("es-UY", { timeZone: "America/Montevideo", day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" });
}

async function avisarDerivacion(conv: Conv, motivo: string, lead: boolean, deps: Deps) {
  const c = asistenteConfig();
  let quien = conv.usuario ? `@${conv.usuario}` : `la persona ${conv.persona}`;
  if (conv.nombre) quien += ` (${conv.nombre})`;
  const nombres: Record<string, string> = { CLIENTE: quien, ASISTENTE: "Asistente", PERSONA: "Voltia PM", OTRO: "Voltia (ManyChat o celular)" };
  const lineas = [
    `${lead ? "LEAD: mandó la factura o los datos del techo. " : ""}El asistente de Instagram derivó a ${quien} con ${c.derivarA} (WhatsApp ${c.derivarWhatsapp}).`,
    `Motivo: ${motivo || "sin motivo"}.`,
    "",
    "La conversación:",
    ...conv.mensajes.slice(-HISTORIA).map((m) => `${fechaCorta(m.enviadoEn)} ${nombres[m.autor] ?? m.autor}: ${m.texto}`),
    "",
    "Para verla y contestarle: Voltia PM → Marketing → Instagram.",
  ];
  await deps.avisar(`Instagram: ${lead ? "LEAD" : "derivado"} ${quien} a ${c.derivarA}`, lineas.join("\n"), [c.derivarMail]);
}

// ── Seguimiento (el "reclamo" de ManyChat al día siguiente) ─────────────────

/**
 * ¿Corresponde el seguimiento ahora? Se le mandó el speech, no contestó nada
 * después, no se derivó, nadie la tomó, no escribió nadie más, no se le hizo ya
 * el seguimiento de ese speech, y pasaron entre `horas` (20 a 23,5: siempre
 * dentro de las 24 h de Meta) desde su último mensaje, en horario y día hábil
 * (`horario`, `dias` con 0 = lunes, hora de Uruguay). Lógica pura.
 */
export function tocaSeguimiento(
  conv: Pick<InstagramConversacion, "speechEn" | "seguimientoEn" | "derivadaEn" | "tomadaEn">,
  mensajes: Array<Pick<InstagramMensaje, "autor" | "enviadoEn">>,
  ahora: Date,
  extra: Record<string, unknown>,
): boolean {
  const speech = conv.speechEn;
  if (!speech || (conv.seguimientoEn && conv.seguimientoEn >= speech) || conv.derivadaEn || conv.tomadaEn) return false;
  if (!mensajes.length || mensajes[mensajes.length - 1].autor !== "ASISTENTE") return false;
  if (mensajes.some((m) => m.autor !== "ASISTENTE" && m.enviadoEn > speech)) return false;
  const delCliente = mensajes.filter((m) => m.autor === "CLIENTE");
  if (!delCliente.length) return false;
  const [desde, hasta] = (extra.horas as number[] | undefined) ?? [20, 23.5];
  const pasaron = (ahora.getTime() - delCliente[delCliente.length - 1].enviadoEn.getTime()) / 3_600_000;
  if (pasaron < desde || pasaron > Math.min(hasta, 23.75)) return false;
  const [abre, cierra] = (extra.horario as number[] | undefined) ?? [8, 21];
  const dias = (extra.dias as number[] | undefined) ?? [0, 1, 2, 3, 4, 5];
  const { dia, hora } = horaUruguay(ahora);
  const diaLunesCero = (dia + 6) % 7;
  return hora >= abre && hora < cierra && dias.includes(diaLunesCero);
}

export async function revisarSeguimientos(deps: Deps = depsReales, ahora = new Date()): Promise<string[]> {
  // En sombra no hay speech propio que seguir: no se evalúa.
  if (modoInstagram() !== "envio") return [];
  const [auto, privados] = await Promise.all([deTipo("seguimiento"), deTipo("privado")]);
  if (!auto?.activa || !privados?.activa) return [];
  const candidatas = await prisma.instagramConversacion.findMany({
    where: { speechEn: { not: null }, derivadaEn: null, tomadaEn: null, ultimoClienteEn: { gte: new Date(ahora.getTime() - 24 * 3600_000) } },
    include: { mensajes: { orderBy: { enviadoEn: "asc" } } },
  });
  const hechos: string[] = [];
  for (const conv of candidatas) {
    if (!tocaSeguimiento(conv, conv.mensajes, ahora, auto.extra)) continue;
    try {
      if ((await hacerSeguimiento(conv, auto, deps, ahora)) === "seguimiento") hechos.push(conv.persona);
    } catch (err) {
      console.error("[instagram] falló un seguimiento:", err instanceof Error ? err.message : err);
      await anotar({ tipo: "seguimiento", resultado: "error", persona: conv.persona, datos: { error: String(err).slice(0, 300) } });
    }
  }
  return hechos;
}

async function hacerSeguimiento(conv: Conv, auto: Automatizacion, deps: Deps, ahora: Date): Promise<string> {
  if (await superoElTope(ahora)) return "tope_de_gasto";
  // Se marca antes de mandar: nunca dos seguimientos del mismo speech.
  const marcada = await prisma.instagramConversacion.updateMany({
    where: { id: conv.id, OR: [{ seguimientoEn: null }, { seguimientoEn: { lt: conv.speechEn! } }] },
    data: { seguimientoEn: ahora },
  });
  if (marcada.count === 0) return "no_toca";
  const ultimo = conv.mensajes[conv.mensajes.length - 1].enviadoEn;
  const { resultado, costoUsd } = await deps.claude(conv, completar(auto.flujo));
  await avisarGasto(ahora);
  const textos = mensajesDe(resultado ?? {}).slice(0, 2);
  const mandados = textos.length ? await mandar(conv, textos, ultimo, deps) : 0;
  await anotar({
    tipo: "seguimiento",
    resultado: mandados ? "seguimiento" : "sin_respuesta",
    automatizacion: auto.id,
    persona: conv.persona,
    usuario: conv.usuario,
    costoUsd,
    datos: { mensajes: textos.slice(0, mandados), motivo: resultado?.motivo ?? "" },
  });
  if (mandados) await etiquetar({ persona: conv.persona, usuario: conv.usuario, momento: ahora }, [ETIQUETA.RECLAMADO]);
  return mandados ? "seguimiento" : "sin_respuesta";
}

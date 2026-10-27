// Historial del asistente: conversaciones por usuario y lo que el asistente
// aprende de cada persona.
//
// Las conversaciones se guardan para poder retomarlas; cada una la ve solo su
// dueño. El "aprendizaje" es un texto corto por persona (`AsistentePerfil`)
// que un modelo barato reescribe cada tanto a partir de las conversaciones, y
// que va al prompt de cada consulta de esa persona.

import Anthropic from "@anthropic-ai/sdk";

import { prisma } from "../../lib/prisma.js";
import { createMessage } from "../ai/usage.js";
import type { MensajeChat } from "./chat.service.js";

/** Mensajes previos que se mandan al modelo: lo viejo de una conversación larga no hace falta. */
const MAX_MENSAJES_PREVIOS = 30;
/** Cada cuántos mensajes de la persona se reescriben sus notas. */
const CADA_N_MENSAJES = 6;
const MODELO_PERFIL = "claude-haiku-5-5";

export async function listarConversaciones(userId: string) {
  const filas = await prisma.asistenteConversacion.findMany({
    where: { userId },
    orderBy: { updatedAt: "desc" },
    take: 50,
    select: { id: true, titulo: true, updatedAt: true },
  });
  return filas.map((c) => ({ id: c.id, titulo: c.titulo, actualizada: c.updatedAt.toISOString() }));
}

async function deUsuario(userId: string, id: string) {
  const c = await prisma.asistenteConversacion.findUnique({ where: { id }, select: { userId: true } });
  return !!c && c.userId === userId;
}

export async function leerConversacion(userId: string, id: string) {
  if (!(await deUsuario(userId, id))) return null;
  const mensajes = await prisma.asistenteMensaje.findMany({
    where: { conversacionId: id },
    orderBy: { createdAt: "asc" },
    select: { role: true, content: true, modelo: true, herramientas: true },
  });
  return mensajes;
}

export async function borrarConversacion(userId: string, id: string): Promise<boolean> {
  if (!(await deUsuario(userId, id))) return false;
  await prisma.asistenteConversacion.delete({ where: { id } });
  return true;
}

/**
 * La conversación hasta ahora, como la necesita el modelo. Crea la
 * conversación si no viene id (o si el id no es de este usuario).
 */
export async function prepararConversacion(userId: string, conversacionId: string | null | undefined, primerMensaje: string) {
  if (conversacionId && (await deUsuario(userId, conversacionId))) {
    const previos = await prisma.asistenteMensaje.findMany({
      where: { conversacionId },
      orderBy: { createdAt: "desc" },
      take: MAX_MENSAJES_PREVIOS,
      select: { role: true, content: true },
    });
    const ordenados = previos.reverse() as MensajeChat[];
    // Tiene que arrancar con un mensaje de la persona.
    while (ordenados.length && ordenados[0].role !== "user") ordenados.shift();
    return { conversacionId, previos: ordenados };
  }
  const titulo = primerMensaje.replace(/\s+/g, " ").trim().slice(0, 80);
  const nueva = await prisma.asistenteConversacion.create({ data: { userId, titulo }, select: { id: true } });
  return { conversacionId: nueva.id, previos: [] as MensajeChat[] };
}

/** Guarda la pregunta y la respuesta juntas: una pregunta sin respuesta no queda. */
export async function guardarIntercambio(args: {
  conversacionId: string;
  pregunta: string;
  respuesta: string;
  modelo: string;
  herramientas: string[];
}) {
  const ahora = Date.now();
  await prisma.$transaction([
    prisma.asistenteMensaje.create({
      data: { conversacionId: args.conversacionId, role: "user", content: args.pregunta, createdAt: new Date(ahora) },
    }),
    prisma.asistenteMensaje.create({
      data: {
        conversacionId: args.conversacionId,
        role: "assistant",
        content: args.respuesta,
        modelo: args.modelo,
        herramientas: args.herramientas,
        createdAt: new Date(ahora + 1),
      },
    }),
    prisma.asistenteConversacion.update({ where: { id: args.conversacionId }, data: { updatedAt: new Date() } }),
  ]);
}

export async function notasDe(userId: string): Promise<string | null> {
  const p = await prisma.asistentePerfil.findUnique({ where: { userId }, select: { notas: true } });
  return p?.notas.trim() || null;
}

/**
 * Suma un mensaje a la cuenta de la persona y, cada `CADA_N_MENSAJES`,
 * reescribe sus notas con la conversación actual. Se llama sin esperar: si
 * falla, la persona no se entera y se reintenta en el mensaje siguiente.
 */
export async function aprenderDeLaConversacion(user: { id: string; name: string }, conversacionId: string) {
  const perfil = await prisma.asistentePerfil.upsert({
    where: { userId: user.id },
    create: { userId: user.id, notas: "", mensajesDesdeActualizacion: 1 },
    update: { mensajesDesdeActualizacion: { increment: 1 } },
  });
  if (perfil.mensajesDesdeActualizacion < CADA_N_MENSAJES) return;

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) return;

  const mensajes = await prisma.asistenteMensaje.findMany({
    where: { conversacionId },
    orderBy: { createdAt: "desc" },
    take: 20,
    select: { role: true, content: true },
  });
  const transcripcion = mensajes
    .reverse()
    .map((m) => `${m.role === "user" ? user.name : "Asistente"}: ${m.content.slice(0, 3000)}`)
    .join("\n\n");

  const res = await createMessage(
    new Anthropic({ apiKey }),
    "asistente_perfil",
    {
      model: MODELO_PERFIL,
      max_tokens: 1500,
      messages: [
        {
          role: "user",
          content: `Sos el asistente interno de Voltia (energía solar, Uruguay). Llevás unas notas sobre ${user.name}, una persona del equipo, para atenderla mejor la próxima vez.

Notas actuales:
${perfil.notas || "(todavía no hay)"}

Última conversación:
${transcripcion}

Reescribí las notas incorporando lo nuevo que sirva para atenderla mejor: en qué trabaja, qué suele pedir, cómo le gusta que le respondan (largo, formato, tono), clientes o temas que sigue. Nada de datos personales sensibles ni copias de datos de clientes que ya están en Voltia PM. Máximo 150 palabras, en viñetas, en español. Devolvé solo las notas.`,
        },
      ],
    },
    { userId: user.id },
  );
  const notas = res.content
    .filter((b): b is Anthropic.TextBlock => b.type === "text")
    .map((b) => b.text)
    .join("\n")
    .trim();
  if (!notas) return;
  await prisma.asistentePerfil.update({
    where: { userId: user.id },
    data: { notas: notas.slice(0, 3000), mensajesDesdeActualizacion: 0 },
  });
}

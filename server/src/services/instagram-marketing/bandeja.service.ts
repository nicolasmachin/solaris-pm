/**
 * Marketing → Instagram: la copia de las conversaciones del contestador y lo que
 * se hace con ellas desde Voltia PM (contestar, tomar, crear el lead).
 */

import { AuditAction, AuditEntityType, OrigenLead, Prisma } from "@prisma/client";

import { prisma } from "../../lib/prisma.js";
import { badRequest, conflict, notFound } from "../../utils/errors.js";
import { createAuditEntry } from "../audit.service.js";
import { crearLead } from "../sales/leads.service.js";
import { enviarPorConector, tomarPorConector } from "./conector.js";
import {
  type ConversacionConector,
  estadoAsistente,
  normalizarMensajes,
  ventanaAbierta,
  ventanaHasta,
} from "./conversacion.js";

type Actor = { id: string; name: string };

// ── Lo que manda el conector ────────────────────────────────────────────────

/**
 * Guarda la conversación que mandó el conector. Idempotente: llega entera cada
 * vez que cambia, así que se agregan los mensajes nuevos y se corrige el autor
 * de los que cambiaron (un eco que primero se guardó como "otro" y después el
 * conector reconoció como suyo). Nunca borra.
 *
 * Tomar la conversación lo decide Voltia PM: lo que diga el conector de eso no
 * se mira.
 */
export async function guardarDesdeConector(conv: ConversacionConector, opciones: { historial?: boolean } = {}) {
  const mensajes = normalizarMensajes(conv);
  const usuarios = new Set(
    (
      await prisma.user.findMany({
        where: { id: { in: [...new Set(mensajes.map((m) => m.enviadoPorId).filter((x): x is string => !!x))] } },
        select: { id: true },
      })
    ).map((u) => u.id),
  );

  return prisma.$transaction(async (tx) => {
    const datos = {
      usuario: conv.usuario?.replace(/^@/, "") || undefined,
      nombre: conv.nombre || undefined,
      desdeAnuncio: conv.desde_anuncio ?? undefined,
      derivadaEn: conv.derivada ? new Date(conv.derivada.momento * 1000) : null,
      derivadaMotivo: conv.derivada?.motivo ?? null,
    };
    const existente = await tx.instagramConversacion.findUnique({ where: { persona: conv.persona } });
    const c =
      existente ??
      (await tx.instagramConversacion.create({
        data: {
          persona: conv.persona,
          ...datos,
          desdeAnuncio: datos.desdeAnuncio ?? false,
          // La carga del historial no llena la bandeja de "sin leer".
          vistaHasta: opciones.historial ? new Date() : null,
        },
      }));

    const previos = new Map(
      (await tx.instagramMensaje.findMany({ where: { conversacionId: c.id }, select: { clave: true, autor: true } })).map(
        (m) => [m.clave, m.autor],
      ),
    );
    const nuevos = mensajes.filter((m) => !previos.has(m.clave));
    if (nuevos.length > 0) {
      await tx.instagramMensaje.createMany({
        data: nuevos.map((m) => ({
          conversacionId: c.id,
          clave: m.clave,
          autor: m.autor,
          texto: m.texto,
          enviadoEn: m.enviadoEn,
          enviadoPorId: m.enviadoPorId && usuarios.has(m.enviadoPorId) ? m.enviadoPorId : null,
        })),
        skipDuplicates: true,
      });
    }
    for (const m of mensajes) {
      const autorPrevio = previos.get(m.clave);
      // Un mensaje de Voltia PM ya quedó con su autor al mandarlo: no se pisa.
      if (autorPrevio && autorPrevio !== m.autor && autorPrevio !== "PERSONA") {
        await tx.instagramMensaje.update({
          where: { conversacionId_clave: { conversacionId: c.id, clave: m.clave } },
          data: { autor: m.autor },
        });
      }
    }

    const [ultimo, ultimoCliente] = await Promise.all([
      tx.instagramMensaje.aggregate({ where: { conversacionId: c.id }, _max: { enviadoEn: true } }),
      tx.instagramMensaje.aggregate({ where: { conversacionId: c.id, autor: "CLIENTE" }, _max: { enviadoEn: true } }),
    ]);
    await tx.instagramConversacion.update({
      where: { id: c.id },
      data: {
        ...datos,
        ultimoMensajeEn: ultimo._max.enviadoEn,
        ultimoClienteEn: ultimoCliente._max.enviadoEn,
      },
    });
    return { id: c.id, nuevos: nuevos.length };
  });
}

// ── La bandeja ──────────────────────────────────────────────────────────────

type FilaConversacion = {
  id: string;
  persona: string;
  usuario: string | null;
  nombre: string | null;
  desdeAnuncio: boolean;
  derivadaEn: Date | null;
  derivadaMotivo: string | null;
  tomadaEn: Date | null;
  tomadaPor: string | null;
  ultimoMensajeEn: Date | null;
  ultimoClienteEn: Date | null;
  leadId: string | null;
  leadCode: string | null;
  leadNombre: string | null;
  ultimoTexto: string | null;
  ultimoAutor: string | null;
  noLeidos: number;
};

function presentar(f: FilaConversacion, ahora = new Date()) {
  return {
    id: f.id,
    persona: f.persona,
    usuario: f.usuario,
    nombre: f.nombre,
    desdeAnuncio: f.desdeAnuncio,
    estado: estadoAsistente(f, ahora),
    derivadaMotivo: f.derivadaMotivo,
    tomadaPor: f.tomadaPor,
    ultimoMensajeEn: f.ultimoMensajeEn,
    ultimoTexto: f.ultimoTexto,
    ultimoAutor: f.ultimoAutor,
    noLeidos: f.noLeidos,
    ventanaAbierta: ventanaAbierta(f, ahora),
    ventanaHasta: ventanaHasta(f),
    lead: f.leadId ? { id: f.leadId, code: f.leadCode, nombre: f.leadNombre } : null,
  };
}

async function filas(where: Prisma.Sql = Prisma.sql`TRUE`): Promise<FilaConversacion[]> {
  return prisma.$queryRaw<FilaConversacion[]>`
    SELECT c."id", c."persona", c."usuario", c."nombre", c."desdeAnuncio", c."derivadaEn", c."derivadaMotivo",
           c."tomadaEn", u."name" AS "tomadaPor", c."ultimoMensajeEn", c."ultimoClienteEn",
           c."leadId", l."code" AS "leadCode", l."clientName" AS "leadNombre",
           ult."texto" AS "ultimoTexto", ult."autor" AS "ultimoAutor",
           (SELECT COUNT(*)::int FROM "instagram_mensajes" m
             WHERE m."conversacionId" = c."id" AND m."autor" = 'CLIENTE'
               AND (c."vistaHasta" IS NULL OR m."enviadoEn" > c."vistaHasta")) AS "noLeidos"
    FROM "instagram_conversaciones" c
    LEFT JOIN "users" u ON u."id" = c."tomadaPorId"
    LEFT JOIN "sales_leads" l ON l."id" = c."leadId"
    LEFT JOIN LATERAL (
      SELECT m."texto", m."autor" FROM "instagram_mensajes" m
      WHERE m."conversacionId" = c."id" ORDER BY m."enviadoEn" DESC LIMIT 1
    ) ult ON TRUE
    WHERE ${where}
    ORDER BY c."ultimoMensajeEn" DESC NULLS LAST
    LIMIT 300
  `;
}

export async function listarConversaciones() {
  const ahora = new Date();
  return (await filas()).map((f) => presentar(f, ahora));
}

async function conversacionOFalla(id: string) {
  const c = await prisma.instagramConversacion.findUnique({ where: { id } });
  if (!c) throw notFound("CONVERSACION_NO_ENCONTRADA", "No existe esa conversación");
  return c;
}

/** La conversación con sus mensajes. Al abrirla se da por leída. */
export async function verConversacion(id: string) {
  const c = await conversacionOFalla(id);
  const mensajes = await prisma.instagramMensaje.findMany({
    where: { conversacionId: id },
    orderBy: { enviadoEn: "asc" },
    include: { enviadoPor: { select: { name: true } } },
  });
  const ultimo = mensajes.at(-1)?.enviadoEn ?? null;
  if (ultimo && (!c.vistaHasta || c.vistaHasta < ultimo)) {
    await prisma.instagramConversacion.update({ where: { id }, data: { vistaHasta: ultimo } });
  }
  const [fila] = await filas(Prisma.sql`c."id" = ${id}`);
  return {
    conversacion: presentar(fila),
    mensajes: mensajes.map((m) => ({
      id: m.id,
      autor: m.autor,
      texto: m.texto,
      enviadoEn: m.enviadoEn,
      enviadoPor: m.enviadoPor?.name ?? null,
    })),
  };
}

export async function enviarMensaje(id: string, texto: string, actor: Actor) {
  const c = await conversacionOFalla(id);
  if (!ventanaAbierta(c)) {
    throw conflict(
      "VENTANA_CERRADA",
      c.desdeAnuncio
        ? "Pasaron más de 7 días desde el último mensaje: Instagram no deja escribirle hasta que vuelva a escribir."
        : "Pasaron más de 24 horas desde el último mensaje: Instagram no deja escribirle hasta que vuelva a escribir.",
    );
  }
  const { mid } = await enviarPorConector(c.persona, texto, { id: actor.id, nombre: actor.name });
  const ahora = new Date();
  await prisma.$transaction([
    prisma.instagramMensaje.upsert({
      where: { conversacionId_clave: { conversacionId: id, clave: mid } },
      create: { conversacionId: id, clave: mid, autor: "PERSONA", texto, enviadoEn: ahora, enviadoPorId: actor.id },
      update: { autor: "PERSONA", enviadoPorId: actor.id },
    }),
    prisma.instagramConversacion.update({ where: { id }, data: { ultimoMensajeEn: ahora, vistaHasta: ahora } }),
  ]);
  await createAuditEntry({
    entityType: AuditEntityType.instagram_conversacion,
    entityId: id,
    userId: actor.id,
    action: AuditAction.created,
    description: `Contestó por Instagram a ${c.usuario ? `@${c.usuario}` : c.persona}`,
  });
  return { mid };
}

export async function tomarConversacion(id: string, tomada: boolean, actor: Actor) {
  const c = await conversacionOFalla(id);
  if (!!c.tomadaEn === tomada) return { ok: true };
  await tomarPorConector(c.persona, tomada, { id: actor.id, nombre: actor.name });
  await prisma.instagramConversacion.update({
    where: { id },
    data: tomada ? { tomadaEn: new Date(), tomadaPorId: actor.id } : { tomadaEn: null, tomadaPorId: null },
  });
  await createAuditEntry({
    entityType: AuditEntityType.instagram_conversacion,
    entityId: id,
    userId: actor.id,
    action: AuditAction.status_changed,
    description: tomada
      ? `Tomó la conversación de Instagram de ${c.usuario ? `@${c.usuario}` : c.persona} (el asistente deja de contestar)`
      : `Le devolvió al asistente la conversación de Instagram de ${c.usuario ? `@${c.usuario}` : c.persona}`,
  });
  return { ok: true };
}

/**
 * Crea el lead desde la conversación, con el origen ya puesto: anuncio si
 * escribió por un anuncio de mensajes, redes sin anuncio si no.
 */
export async function crearLeadDesdeConversacion(
  id: string,
  input: { clientName: string; clientPhone?: string | null; notes?: string | null },
  actor: Actor,
) {
  const c = await conversacionOFalla(id);
  if (c.leadId) throw conflict("YA_TIENE_LEAD", "Esta conversación ya tiene un lead");
  if (!input.clientName.trim()) throw badRequest("NOMBRE_REQUERIDO", "Falta el nombre del cliente");
  const lead = await crearLead({
    data: {
      clientName: input.clientName.trim(),
      clientPhone: input.clientPhone?.trim() || null,
      notes: input.notes?.trim() || null,
      origen: c.desdeAnuncio ? OrigenLead.ANUNCIO_META : OrigenLead.REDES_ORGANICO,
      origenDetalle: `Instagram${c.usuario ? ` @${c.usuario}` : ""}`,
    },
    actor,
    metadata: { instagramConversacionId: id },
  });
  await prisma.instagramConversacion.update({ where: { id }, data: { leadId: lead.id } });
  return { id: lead.id, code: lead.code };
}

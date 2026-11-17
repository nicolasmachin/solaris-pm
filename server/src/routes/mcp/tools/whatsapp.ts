// WhatsApp desde el chat: el "secretario" (pedido de Nicolás del 17-nov-2026).
// Lee los números de los que la persona es responsable —sobre todo el de trabajo
// de la Dirección, que no tiene bandeja en Voltia PM— y contesta cuando se lo
// pide. Cada uno ve los suyos; el admin, todos. Ver services/whatsapp-cloud/
// secretario.service.ts.

import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";

import {
  buscarChat,
  buscarTexto,
  elegirNumero,
  enviar,
  leerChat,
  numerosDe,
  pendientes,
} from "../../../services/whatsapp-cloud/secretario.service.js";
import type { McpUser } from "../context.js";
import { texto } from "../format.js";

const NUMERO = z
  .string()
  .trim()
  .max(40)
  .optional()
  .describe("Qué número leer (teléfono o nombre del responsable). Por defecto, el de Dirección de quien pregunta, o el suyo.");

const USO: Record<string, string> = { DIRECCION: "Dirección", VENTAS: "Ventas", EXPERIENCIA_SOLAR: "Experiencia Solar" };

export function registerWhatsAppTools(server: McpServer, user: McpUser) {
  const u = { id: user.id, role: user.role };

  server.registerTool(
    "whatsapp_pendientes",
    {
      title: "WhatsApp: a quién no le contesté",
      description:
        "Los chats de WhatsApp donde el último mensaje es del otro y nadie le contestó (desde el celular o desde " +
        "Voltia PM), del más viejo al más nuevo: quién es (cliente, lead, contacto, alguien del equipo o un " +
        "desconocido con su nombre de WhatsApp), desde cuándo espera y lo que mandó (los audios, transcriptos). " +
        "Sirve para el resumen del día y para decidir qué contestar, qué derivar a Ventas o a Experiencia Solar y " +
        "qué se puede dejar. 'MENSAJE NO DISPONIBLE' = Meta no pasó el contenido: hay que verlo en el celular. Solo " +
        "cuenta desde que el número se conectó a Voltia PM; los grupos no entran.",
      inputSchema: { numero: NUMERO, dias: z.number().int().min(1).max(90).optional().describe("Hasta cuántos días para atrás. Por defecto 14") },
      annotations: { readOnlyHint: true },
    },
    async ({ numero, dias }) => {
      const n = await elegirNumero(u, numero);
      const lista = await pendientes(n.phoneNumberId, dias ?? 14);
      if (!lista.length) return texto(`${n.telefono}: no hay chats esperando respuesta en los últimos ${dias ?? 14} días.`);
      return texto(
        `${n.telefono} (${USO[n.uso ?? ""] ?? "sin bandeja"}): ${lista.length} chats esperando respuesta, del más viejo al más nuevo.`,
        lista
          .map(
            (p) =>
              `• ${p.quien}${p.interno ? " [equipo]" : ""} · +${p.telefono} · ${p.cantidad} sin contestar` +
              `${p.ultimaRespuestaNuestra ? ` · última respuesta nuestra: ${p.ultimaRespuestaNuestra}` : " · nunca le contestamos"}\n` +
              p.mensajes.map((m) => `    ${m}`).join("\n"),
          )
          .join("\n"),
      );
    },
  );

  server.registerTool(
    "whatsapp_chat",
    {
      title: "WhatsApp: leer un chat",
      description:
        "El chat de WhatsApp con alguien, para saber qué pidió o en qué quedó. `quien` puede ser un teléfono o un " +
        "nombre (de contacto, lead, cliente, persona del equipo o el nombre que tiene en WhatsApp). Los audios vienen " +
        "transcriptos; las fotos y documentos, indicados. Solo desde que el número se conectó a Voltia PM.",
      inputSchema: {
        quien: z.string().trim().min(2).max(80),
        numero: NUMERO,
        cuantos: z.number().int().min(5).max(300).optional().describe("Últimos mensajes. Por defecto 80"),
      },
      annotations: { readOnlyHint: true },
    },
    async ({ quien, numero, cuantos }) => {
      const n = await elegirNumero(u, numero);
      const tel = await buscarChat(n.phoneNumberId, quien);
      const c = await leerChat(n.phoneNumberId, tel, cuantos ?? 80);
      if (!c.lineas.length) return texto(`No hay mensajes con ${c.quien} en ${n.telefono}.`);
      return texto(`Chat de ${n.telefono} con ${c.quien} · +${c.telefono}`, c.lineas.join("\n"));
    },
  );

  server.registerTool(
    "whatsapp_buscar",
    {
      title: "WhatsApp: buscar en las conversaciones",
      description:
        "Busca un texto en los mensajes de WhatsApp (y en lo que dicen los audios) de los números que la persona " +
        "puede leer: '¿quién me habló del inversor de Paysandú?', '¿quién me pidió la factura?'. Devuelve hasta 40 " +
        "mensajes, del más nuevo al más viejo, con quién es cada uno.",
      inputSchema: {
        texto: z.string().trim().min(3).max(100),
        numero: NUMERO.describe("Solo en este número. Por defecto, en todos los que puede leer"),
        dias: z.number().int().min(1).max(365).optional().describe("Por defecto 90"),
      },
      annotations: { readOnlyHint: true },
    },
    async ({ texto: q, numero, dias }) => {
      const ids = numero ? [(await elegirNumero(u, numero)).phoneNumberId] : (await numerosDe(u)).map((n) => n.phoneNumberId);
      const r = await buscarTexto(ids, q, dias ?? 90);
      return texto(r.length ? `${r.length} mensajes con "${q}":` : `Ningún mensaje con "${q}".`, r.join("\n"));
    },
  );

  server.registerTool(
    "whatsapp_enviar",
    {
      title: "WhatsApp: mandar un mensaje",
      description:
        "Manda un mensaje de texto desde un número de WhatsApp de Voltia (por defecto, el de quien pregunta). Le llega " +
        "a la persona como cualquier mensaje de ese número. Solo si la persona escribió en las últimas 24 horas " +
        "(regla de WhatsApp); si no, avisa. USARLA SOLO cuando el usuario lo pide explícitamente y con el texto que " +
        "aprobó: confirmá el texto y el destinatario antes de mandar.",
      inputSchema: {
        quien: z.string().trim().min(2).max(80).describe("Teléfono o nombre de a quién"),
        texto: z.string().trim().min(1).max(4096),
        numero: NUMERO,
      },
      annotations: { readOnlyHint: false, destructiveHint: false, openWorldHint: true },
    },
    async ({ quien, texto: t, numero }) => {
      const n = await elegirNumero(u, numero);
      const tel = await buscarChat(n.phoneNumberId, quien);
      const m = await enviar(n.phoneNumberId, tel, t, user.id);
      return texto(`Mandado desde ${n.telefono} a +${m.telefono} (estado: ${m.estado ?? "aceptado"}).`);
    },
  );
}

// Marketing → Instagram desde el chat, para los asesores (Tabaré revisa a
// diario qué contestó el asistente). Todo de solo lectura: contestar, tomar o
// tocar una automatización se hace en Voltia PM.

import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { Action, Module } from "@prisma/client";
import { z } from "zod";

import { prisma } from "../../../lib/prisma.js";
import { contactos, consultas, estado, listarAutomatizaciones } from "../../../services/instagram-marketing/panel.service.js";
import { requirePermission, type McpUser } from "../context.js";
import { texto } from "../format.js";

const AUTOR: Record<string, string> = { CLIENTE: "Cliente", ASISTENTE: "Asistente", PERSONA: "Voltia PM", OTRO: "Voltia (ManyChat/celular)" };

function hora(d: Date): string {
  return d.toLocaleString("es-UY", { timeZone: "America/Montevideo", day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" });
}

function modoLabel(m: string) {
  return m === "envio" ? "CONTESTANDO" : m === "sombra" ? "EN SOMBRA (arma las respuestas y no las manda)" : "APAGADO";
}

export function registerMarketingTools(server: McpServer, user: McpUser) {
  server.registerTool(
    "instagram_resumen",
    {
      title: "Instagram: consultas por día y estado del asistente",
      description:
        "Cómo viene Instagram de @voltia_uy: si el asistente está contestando, en sombra o apagado, " +
        "el gasto del mes, y por día las personas que escribieron por privado (nuevas, por anuncio u " +
        "orgánico), a cuántas se les contó el speech (la cifra IG de la planilla), derivaciones a " +
        "Martín, leads, privados de lead magnets y respuestas a comentarios. Las métricas cuentan " +
        "desde que Voltia PM atiende Instagram (30-oct-2026); el historial de ManyChat no entra.",
      inputSchema: { dias: z.number().int().min(1).max(90).optional().describe("Por defecto 14") },
      annotations: { readOnlyHint: true },
    },
    async ({ dias }) => {
      await requirePermission(user, Module.MARKETING, Action.VIEW);
      const [e, filas] = await Promise.all([estado(), consultas(dias ?? 14)]);
      const lineas = filas
        .filter((d) => d.personas || d.speech || d.leadMagnets || d.comentariosContestados)
        .map(
          (d) =>
            `- ${d.dia}: ${d.personas} escribieron (${d.nuevas} nuevas; ${d.anuncio} por anuncio, ${d.organico} orgánico) · ` +
            `speech ${d.speech} · derivadas ${d.derivadas} (leads ${d.leads}) · lead magnets ${d.leadMagnets} · ` +
            `comentarios contestados ${d.comentariosContestados}`,
        );
      return texto(
        `Asistente de Instagram: ${modoLabel(e.modo)}. Gasto del mes: US$ ${e.gasto.usd.toFixed(2)} de US$ ${e.gasto.topeUsd} ` +
          `(${e.gasto.llamadas} llamadas a Claude). Deriva a ${e.derivarA} (${e.derivarWhatsapp}).`,
        lineas.length ? lineas.join("\n") : "Sin movimiento en esos días.",
      );
    },
  );

  server.registerTool(
    "instagram_conversaciones",
    {
      title: "Instagram: conversaciones del asistente",
      description:
        "Las conversaciones de privados de @voltia_uy con lo que decidió el asistente en cada una: qué " +
        "contestó, por qué no contestó (fuera de ventana, tomada, escribió otro, tope de gasto) y, en " +
        "modo sombra, lo que HABRÍA contestado al lado de lo que contestó de verdad el contestador de " +
        "indicadores. Sin `usuario`, lista las de los últimos días; con `usuario` (o parte del nombre), " +
        "muestra esa conversación entera.",
      inputSchema: {
        usuario: z.string().trim().max(80).optional(),
        dias: z.number().int().min(1).max(30).optional().describe("Por defecto 2"),
      },
      annotations: { readOnlyHint: true },
    },
    async ({ usuario, dias }) => {
      await requirePermission(user, Module.MARKETING, Action.VIEW);
      if (usuario) {
        const q = usuario.replace(/^@/, "");
        const c = await prisma.instagramConversacion.findFirst({
          where: { OR: [{ usuario: { contains: q, mode: "insensitive" } }, { nombre: { contains: q, mode: "insensitive" } }, { persona: q }] },
          include: { mensajes: { orderBy: { enviadoEn: "asc" } }, lead: { select: { code: true } } },
          orderBy: { ultimoMensajeEn: "desc" },
        });
        if (!c) return texto(`No hay conversación de Instagram con "${usuario}".`);
        const eventos = await prisma.instagramEvento.findMany({ where: { persona: c.persona }, orderBy: { creadoEn: "asc" } });
        const linea = [
          ...c.mensajes.map((m) => ({ t: m.enviadoEn, s: `${hora(m.enviadoEn)} ${AUTOR[m.autor] ?? m.autor}: ${m.texto}` })),
          ...eventos.map((e) => {
            const d = e.datos as { mensajes?: string[]; motivo?: string; publica?: string; privado?: string };
            const que = e.razon ? `${e.resultado} (${e.razon})` : e.resultado;
            const dijo = d.mensajes?.length ? ` → ${d.mensajes.join(" / ")}` : "";
            return { t: e.creadoEn, s: `   [${e.sombra ? "SOMBRA " : ""}${e.tipo}: ${que}${d.motivo ? ` · ${d.motivo}` : ""}${dijo}]` };
          }),
        ].sort((a, b) => a.t.getTime() - b.t.getTime());
        return texto(
          `@${c.usuario ?? "?"} ${c.nombre ? `(${c.nombre})` : ""} · ${c.desdeAnuncio ? "vino de un anuncio" : "orgánico"}` +
            `${c.derivadaEn ? ` · derivada: ${c.derivadaMotivo ?? ""}` : ""}${c.tomadaEn ? " · tomada por una persona" : ""}` +
            `${c.lead ? ` · lead ${c.lead.code}` : ""}`,
          linea.map((x) => x.s).join("\n"),
        );
      }
      const desde = new Date(Date.now() - (dias ?? 2) * 24 * 3600_000);
      const convs = await prisma.instagramConversacion.findMany({
        where: { ultimoMensajeEn: { gte: desde } },
        orderBy: { ultimoMensajeEn: "desc" },
        take: 60,
      });
      const eventos = await prisma.instagramEvento.findMany({
        where: { tipo: { in: ["privado", "seguimiento"] }, creadoEn: { gte: desde } },
        orderBy: { creadoEn: "asc" },
      });
      if (!convs.length) return texto("No hubo conversaciones en esos días.");
      return texto(
        convs
          .map((c) => {
            const ev = eventos.filter((e) => e.persona === c.persona);
            const ult = ev[ev.length - 1];
            return (
              `- @${c.usuario ?? c.persona} ${c.nombre ? `(${c.nombre}) ` : ""}· último ${c.ultimoMensajeEn ? hora(c.ultimoMensajeEn) : "?"}` +
              `${c.desdeAnuncio ? " · anuncio" : ""}${c.derivadaEn ? " · derivada" : ""}${c.tomadaEn ? " · tomada" : ""}` +
              (ult ? ` · asistente: ${ult.sombra ? "SOMBRA " : ""}${ult.resultado}${ult.razon ? ` (${ult.razon})` : ""}` : "")
            );
          })
          .join("\n"),
      );
    },
  );

  server.registerTool(
    "instagram_automatizaciones",
    {
      title: "Instagram: automatizaciones",
      description:
        "Las automatizaciones de Instagram (el reemplazo de ManyChat): cuáles están PRENDIDAS, qué las " +
        "dispara (privado, comentario con palabra clave, seguimiento), el link que mandan y lo que " +
        "hicieron en la semana, con las últimas respuestas a comentarios. Con `ver_flujo` muestra el " +
        "flujo escrito de cada una.",
      inputSchema: { ver_flujo: z.boolean().optional() },
      annotations: { readOnlyHint: true },
    },
    async ({ ver_flujo }) => {
      await requirePermission(user, Module.MARKETING, Action.VIEW);
      const [e, autos] = await Promise.all([estado(), listarAutomatizaciones()]);
      const ultimos = await prisma.instagramComentario.findMany({
        where: { estado: "HECHO" },
        orderBy: { atendidoEn: "desc" },
        take: 15,
      });
      const bloques = autos
        .filter((a) => a.disparador !== "texto")
        .map((a) => {
          const cab =
            `${a.activa ? "PRENDIDA" : "apagada"} · ${a.nombre} (${a.id}) · ${a.disparador}` +
            `${a.palabras.length ? ` · palabras: ${a.palabras.join(", ")}` : ""}${a.link ? ` · link ${a.link}` : ""}` +
            ` · semana: ${a.actividad.semana} (${a.actividad.contestados} contestadas, ${a.actividad.sombra} en sombra), hoy ${a.actividad.hoy}`;
          return ver_flujo ? `${cab}\n${a.flujo}` : cab;
        });
      const coms = ultimos.map(
        (c) =>
          `- ${c.atendidoEn ? hora(c.atendidoEn) : ""} @${c.usuario ?? "?"} «${c.texto.slice(0, 80)}» → ${c.sombra ? "SOMBRA " : ""}${c.resultado}` +
          `${c.respuestaPublica ? ` · público: ${c.respuestaPublica}` : ""}${c.mensajePrivado ? ` · privado: ${c.mensajePrivado.split("\n")[0]}` : ""}`,
      );
      return texto(
        `Asistente: ${modoLabel(e.modo)}.`,
        bloques.join(ver_flujo ? "\n\n" : "\n"),
        coms.length ? `Últimos comentarios atendidos:\n${coms.join("\n")}` : "Todavía no atendió comentarios.",
      );
    },
  );

  server.registerTool(
    "instagram_contactos",
    {
      title: "Instagram: base de contactos",
      description:
        "La base de contactos de Instagram con etiquetas (quién escribió, comentó, recibió el speech o un " +
        "lead magnet, fue derivado, es lead). Devuelve cuántos hay por etiqueta y una lista. Filtros: " +
        "`etiqueta` (o parte), `buscar` (usuario o nombre). Los marcados 'historial' vienen de ManyChat " +
        "(antes del 30-oct-2026) y no cuentan para las métricas.",
      inputSchema: {
        etiqueta: z.string().trim().max(80).optional(),
        buscar: z.string().trim().max(80).optional(),
        cuantos: z.number().int().min(1).max(200).optional(),
      },
      annotations: { readOnlyHint: true },
    },
    async ({ etiqueta, buscar, cuantos }) => {
      await requirePermission(user, Module.MARKETING, Action.VIEW);
      const r = await contactos({ etiqueta, texto: buscar, cuantos: cuantos ?? 30 });
      return texto(
        `Contactos: ${r.total}. Por etiqueta: ${r.etiquetas.map((e) => `${e.etiqueta} ${e.contactos}`).join(" · ")}`,
        r.contactos
          .map(
            (c) =>
              `- @${c.usuario ?? c.persona ?? "?"}${c.nombre ? ` (${c.nombre})` : ""}${c.importado ? " · historial" : ""}` +
              ` · visto ${hora(c.ultimaVez)}${c.lead ? ` · lead ${c.lead.code}` : ""} · ${c.etiquetas.map((e) => e.nombre).join(", ")}`,
          )
          .join("\n") || "Ninguno con esos filtros.",
      );
    },
  );
}

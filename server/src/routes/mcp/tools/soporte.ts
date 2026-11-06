// Abrir un ticket de soporte desde el chat: lo que el 27-oct-2026 se hizo a mano
// para Gustavo Vallegra después de diagnosticar la planta (sin comunicación +
// strings mal conectados): ticket con texto para el cliente, nota interna con
// el diagnóstico técnico y derivación a Operaciones.
//
// OJO: el cliente ve en el portal el TÍTULO y la DESCRIPCIÓN de los tickets de
// su proyecto. Lo técnico va en la nota interna, que no ve.

import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { Action, Module, TicketPrioridad } from "@prisma/client";
import { z } from "zod";

import { prisma } from "../../../lib/prisma.js";
import { agregarComentario, crearTicket, derivarTicket } from "../../../services/tickets/tickets.service.js";
import { requireAnyPermission, requirePermission, type McpUser } from "../context.js";
import { campos, texto } from "../format.js";

export function registerSoporteTools(server: McpServer, user: McpUser) {
  server.registerTool(
    "crear_ticket_soporte",
    {
      title: "Abrir un ticket de soporte",
      description:
        "Abre un ticket de soporte en un proyecto. El TÍTULO y la DESCRIPCIÓN los ve el cliente en " +
        "el portal: escribirlos para él, sin tecnicismos ni diagnósticos internos. El diagnóstico " +
        "técnico (mediciones, qué revisar, cómo corregirlo) va en `nota_interna`, que solo ve el " +
        "equipo. Con `derivar_a` lo pasa a Operaciones o Ingeniería, que lo reciben en sus " +
        "pendientes. Sin `confirmar: true` solo muestra cómo quedaría. Antes de abrir, revisar con " +
        "tickets_y_mantenimientos que no haya uno abierto por lo mismo.",
      inputSchema: {
        project_id: z.string().min(1),
        titulo: z.string().trim().min(5).max(200).describe("Lo ve el cliente"),
        descripcion: z.string().trim().min(10).max(4000).describe("Lo ve el cliente"),
        nota_interna: z.string().trim().max(4000).optional().describe("Solo el equipo: diagnóstico técnico"),
        prioridad: z.enum(["BAJA", "MEDIA", "ALTA"]).optional(),
        derivar_a: z.enum(["OPERACIONES", "INGENIERIA"]).optional(),
        confirmar: z.boolean().optional(),
      },
    },
    async ({ project_id, titulo, descripcion, nota_interna, prioridad, derivar_a, confirmar }) => {
      await requirePermission(user, Module.TICKETS, Action.CREATE);
      if (derivar_a) await requirePermission(user, Module.TICKETS, Action.EDIT);
      if (nota_interna) {
        await requireAnyPermission(user, [
          { module: Module.TICKETS, action: Action.COMMENT },
          { module: Module.TICKETS, action: Action.EDIT },
        ]);
      }
      const p = await prisma.project.findFirst({ where: { id: project_id, deletedAt: null }, select: { code: true, clientName: true } });
      if (!p) return texto(`No encontré el proyecto ${project_id}.`);
      const abiertos = await prisma.ticket.findMany({
        where: { projectId: project_id, deletedAt: null, estado: { in: ["ABIERTO", "DERIVADO", "EN_PROGRESO"] } },
        select: { titulo: true, estado: true, createdAt: true },
      });

      const vista = campos([
        ["Proyecto", `${p.clientName} (${p.code})`],
        ["Título (lo ve el cliente)", titulo],
        ["Descripción (lo ve el cliente)", descripcion],
        ["Nota interna (solo el equipo)", nota_interna ?? "—"],
        ["Prioridad", prioridad ?? "MEDIA"],
        ["Derivado a", derivar_a ?? "nadie (queda en Experiencia Solar)"],
        [
          "Tickets ya abiertos en el proyecto",
          abiertos.length ? abiertos.map((t) => `"${t.titulo}" (${t.estado.toLowerCase()})`).join("; ") : "ninguno",
        ],
      ]);
      if (!confirmar) return texto(vista, "Vista previa: no se creó nada. Para abrirlo, volver a llamar con confirmar: true.");

      const t = await crearTicket({
        projectId: project_id,
        titulo,
        descripcion,
        prioridad: TicketPrioridad[prioridad ?? "MEDIA"],
        creadoPorId: user.id,
      });
      if (nota_interna) await agregarComentario({ ticketId: t.id, autorId: user.id, contenido: nota_interna, esInterno: true });
      if (derivar_a) await derivarTicket({ ticketId: t.id, areaDerivada: derivar_a, actorUserId: user.id });
      return texto(
        vista,
        `Listo: ticket abierto${derivar_a ? ` y derivado a ${derivar_a === "OPERACIONES" ? "Operaciones" : "Ingeniería"}` : ""}. ` +
          "La visita la coordina Experiencia Solar con el cliente.",
      );
    },
  );

  server.registerTool(
    "responder_ticket",
    {
      title: "Responder dentro de un ticket",
      description:
        "Agrega un comentario a un ticket ya abierto. Por defecto es interno: solo lo ve el equipo. " +
        "Con `para_el_cliente: true` lo ve el cliente en el portal y, si él abrió el reclamo, le llega " +
        "un aviso: escribirlo para él. Sin `confirmar: true` solo muestra cómo quedaría.",
      inputSchema: {
        ticket_id: z.string().min(1),
        comentario: z.string().trim().min(1).max(4000),
        para_el_cliente: z.boolean().optional().describe("Si lo ve el cliente. Por defecto, no."),
        confirmar: z.boolean().optional().describe("true para comentar de verdad."),
      },
    },
    async ({ ticket_id, comentario, para_el_cliente, confirmar }) => {
      await requireAnyPermission(user, [
        { module: Module.TICKETS, action: Action.COMMENT },
        { module: Module.TICKETS, action: Action.EDIT },
      ]);
      const t = await prisma.ticket.findFirst({
        where: { id: ticket_id, deletedAt: null },
        select: { titulo: true, estado: true, project: { select: { clientName: true } } },
      });
      if (!t) return texto(`No encontré ningún ticket con el id ${ticket_id}.`);

      const vista = campos([
        ["Cliente", t.project.clientName],
        ["Ticket", `"${t.titulo}" (${t.estado.toLowerCase()})`],
        ["Quién lo ve", para_el_cliente ? "EL CLIENTE, en el portal" : "Solo el equipo"],
        ["Comentario", comentario],
      ]);
      if (!confirmar) return texto(vista, "Vista previa: no se comentó nada. Para comentar, volver a llamar con confirmar: true.");

      await agregarComentario({ ticketId: ticket_id, autorId: user.id, contenido: comentario, esInterno: !para_el_cliente });
      return texto(vista, "Listo: comentario agregado.");
    },
  );
}

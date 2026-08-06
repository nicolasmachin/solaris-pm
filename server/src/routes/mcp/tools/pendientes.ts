// Herramientas de pendientes del conector.
//
// Trabajan sobre el mismo modelo `Task` que "Mis tareas": no hay una bandeja
// paralela. Lo que se dicta por el chat aparece en la app y viceversa.
//
// A diferencia de la app, acá TODO pendiente tiene que colgar de un cliente
// potencial o de un proyecto. Un pendiente dictado sin destino no aparece en la
// ficha de nadie y se pierde; si no se identifica, la herramienta pide
// precisión en vez de crearlo suelto.

import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { TaskOrigin, TaskStatus } from "@prisma/client";
import { z } from "zod";

import { prisma } from "../../../lib/prisma.js";
import { createAuditEntry } from "../../../services/audit.service.js";
import { AuditAction, AuditEntityType } from "@prisma/client";
import type { McpUser } from "../context.js";
import { campos, fechaCorta, texto } from "../format.js";

function auditMeta(tool: string) {
  return { source: "mcp", tool };
}

/** Los pendientes del usuario, con su contexto. */
const TASK_INCLUDE = {
  lead: { select: { id: true, code: true, clientName: true } },
  project: { select: { id: true, code: true, clientName: true } },
} as const;

/** ¿Esta tarea es del usuario? Mismo criterio que la app. */
async function puedeTocarla(taskId: string, user: McpUser) {
  const task = await prisma.task.findFirst({
    where: { id: taskId, deletedAt: null },
    include: { ...TASK_INCLUDE, assignees: { select: { userId: true } } },
  });
  if (!task) return { task: null, permitido: false };
  const permitido =
    user.role === "ADMIN" ||
    task.userId === user.id ||
    task.assignees.some((a) => a.userId === user.id);
  return { task, permitido };
}

function describirContexto(task: {
  lead: { code: string; clientName: string } | null;
  project: { code: string; clientName: string } | null;
}): string | null {
  if (task.lead) return `${task.lead.clientName} [${task.lead.code}]`;
  if (task.project) return `${task.project.clientName} [${task.project.code}]`;
  return null;
}

export function registerPendientesTools(server: McpServer, user: McpUser) {
  server.registerTool(
    "listar_pendientes",
    {
      title: "Listar pendientes",
      description:
        "Lista los pendientes del usuario. Por defecto los que hay que hacer; " +
        "también permite ver los que están en espera de un tercero o los ya " +
        "completados. Se puede filtrar por cliente potencial.",
      inputSchema: {
        estado: z
          .enum(["pendientes", "en_espera", "completados"])
          .optional()
          .describe("Cuáles listar. Por defecto, los pendientes."),
        lead_id: z.string().optional().describe("Solo los de este cliente potencial"),
      },
      annotations: { readOnlyHint: true },
    },
    async ({ estado, lead_id }) => {
      const scope = estado ?? "pendientes";
      const statusFilter =
        scope === "completados"
          ? TaskStatus.COMPLETED
          : scope === "en_espera"
            ? TaskStatus.WAITING
            : { notIn: [TaskStatus.COMPLETED, TaskStatus.WAITING] };

      const tasks = await prisma.task.findMany({
        where: {
          deletedAt: null,
          status: statusFilter,
          ...(lead_id ? { leadId: lead_id } : {}),
          OR: [{ assignees: { some: { userId: user.id } } }, { userId: user.id }],
        },
        include: TASK_INCLUDE,
        orderBy:
          scope === "en_espera"
            ? [{ followUpAt: "asc" }, { createdAt: "desc" }]
            : scope === "completados"
              ? [{ completedAt: "desc" }]
              : [{ dueDate: "asc" }, { createdAt: "desc" }],
        take: 40,
      });

      if (tasks.length === 0) {
        const vacio = {
          pendientes: "No tenés pendientes.",
          en_espera: "No tenés nada esperando a un tercero.",
          completados: "No hay pendientes completados.",
        };
        return texto(vacio[scope]);
      }

      const lineas = tasks.map((t) => {
        const contexto = describirContexto(t);
        const detalle =
          scope === "en_espera"
            ? [
                t.waitingReason ? `espera: ${t.waitingReason}` : null,
                t.followUpAt ? `reconsultar ${fechaCorta(t.followUpAt)}` : null,
              ]
            : scope === "completados"
              ? [t.completedAt ? `completada ${fechaCorta(t.completedAt)}` : null]
              : [t.dueDate ? `vence ${fechaCorta(t.dueDate)}` : "sin fecha"];

        const meta = [contexto, ...detalle].filter(Boolean).join(" · ");
        return `- ${t.title} (id: ${t.id})${meta ? `\n  ${meta}` : ""}`;
      });

      const titulo = {
        pendientes: `Tenés ${tasks.length} pendiente${tasks.length > 1 ? "s" : ""}:`,
        en_espera: `${tasks.length} esperando a un tercero:`,
        completados: `${tasks.length} completado${tasks.length > 1 ? "s" : ""}:`,
      };

      return texto(titulo[scope], lineas.join("\n"));
    },
  );

  server.registerTool(
    "crear_pendiente",
    {
      title: "Crear pendiente",
      description:
        "Crea un pendiente propio. TIENE que colgar de un cliente potencial o de un " +
        "proyecto: si no se sabe cuál, preguntar antes de crearlo, no inventarlo. " +
        "Aparece en 'Mis tareas' de la aplicación.",
      inputSchema: {
        titulo: z.string().min(1).max(200).describe("Qué hay que hacer, en una línea"),
        lead_id: z.string().optional().describe("Cliente potencial del que cuelga"),
        project_id: z.string().optional().describe("Proyecto del que cuelga"),
        detalle: z.string().max(2000).optional(),
        fecha: z
          .string()
          .regex(/^\d{4}-\d{2}-\d{2}$/)
          .optional()
          .describe("Para cuándo, en formato AAAA-MM-DD"),
      },
    },
    async ({ titulo, lead_id, project_id, detalle, fecha }) => {
      if (!lead_id && !project_id) {
        return texto(
          "Necesito saber de qué cliente o proyecto es este pendiente. " +
            "Buscá el cliente con buscar_lead y volvé a intentarlo.",
        );
      }

      if (lead_id) {
        const lead = await prisma.salesLead.findFirst({
          where: { id: lead_id, deletedAt: null },
          select: { id: true },
        });
        if (!lead) return texto(`No encontré ningún cliente potencial con el id ${lead_id}.`);
      }
      if (project_id) {
        const project = await prisma.project.findFirst({
          where: { id: project_id, deletedAt: null },
          select: { id: true },
        });
        if (!project) return texto(`No encontré ningún proyecto con el id ${project_id}.`);
      }

      const task = await prisma.task.create({
        data: {
          title: titulo,
          description: detalle ?? null,
          leadId: lead_id ?? null,
          projectId: project_id ?? null,
          status: TaskStatus.PENDING,
          priority: "NORMAL",
          origin: TaskOrigin.MCP,
          responsible: "",
          userId: user.id,
          dueDate: fecha ? new Date(`${fecha}T00:00:00.000Z`) : null,
        },
        include: TASK_INCLUDE,
      });
      await prisma.taskAssignee.create({ data: { taskId: task.id, userId: user.id } });

      await createAuditEntry({
        entityType: AuditEntityType.task,
        entityId: task.id,
        projectId: task.projectId,
        userId: user.id,
        action: AuditAction.created,
        description: `Creó el pendiente '${task.title}'`,
        metadata: auditMeta("crear_pendiente"),
      });

      return texto(
        `Anotado: "${task.title}".`,
        campos([
          ["id", task.id],
          ["Cliente", describirContexto(task)],
          ["Fecha", fechaCorta(task.dueDate)],
        ]),
      );
    },
  );

  server.registerTool(
    "completar_pendiente",
    {
      title: "Completar pendiente",
      description: "Marca un pendiente como hecho. Usar el id que devuelve listar_pendientes.",
      inputSchema: { task_id: z.string().min(1) },
    },
    async ({ task_id }) => {
      const { task, permitido } = await puedeTocarla(task_id, user);
      if (!task) return texto(`No encontré ese pendiente.`);
      if (!permitido) return texto("Ese pendiente no es tuyo, así que no lo puedo tocar.");
      if (task.status === TaskStatus.COMPLETED) {
        return texto(`"${task.title}" ya estaba completado.`);
      }

      const updated = await prisma.task.update({
        where: { id: task.id },
        data: {
          status: TaskStatus.COMPLETED,
          completedAt: new Date(),
          // Al completarlo deja de tener sentido lo que esperaba.
          waitingReason: null,
          followUpAt: null,
        },
      });

      await createAuditEntry({
        entityType: AuditEntityType.task,
        entityId: task.id,
        projectId: task.projectId,
        userId: user.id,
        action: AuditAction.status_changed,
        fieldChanged: "status",
        oldValue: task.status,
        newValue: updated.status,
        description: `Completó el pendiente '${task.title}'`,
        metadata: auditMeta("completar_pendiente"),
      });

      return texto(`Listo, "${task.title}" queda completado.`);
    },
  );

  server.registerTool(
    "poner_en_espera",
    {
      title: "Poner un pendiente en espera",
      description:
        "Marca un pendiente como que depende de un tercero: el cliente, un organismo, " +
        "un proveedor. Sale de la lista de pendientes y pasa a la de 'en espera'. Hay " +
        "que decir qué se está esperando.",
      inputSchema: {
        task_id: z.string().min(1),
        esperando: z
          .string()
          .min(1)
          .max(500)
          .describe("Qué se está esperando y de quién"),
        reconsultar_el: z
          .string()
          .regex(/^\d{4}-\d{2}-\d{2}$/)
          .optional()
          .describe("Cuándo volver a mirarlo, en formato AAAA-MM-DD"),
      },
    },
    async ({ task_id, esperando, reconsultar_el }) => {
      const { task, permitido } = await puedeTocarla(task_id, user);
      if (!task) return texto("No encontré ese pendiente.");
      if (!permitido) return texto("Ese pendiente no es tuyo, así que no lo puedo tocar.");

      const updated = await prisma.task.update({
        where: { id: task.id },
        data: {
          status: TaskStatus.WAITING,
          completedAt: null,
          waitingReason: esperando,
          followUpAt: reconsultar_el ? new Date(`${reconsultar_el}T00:00:00.000Z`) : null,
        },
      });

      await createAuditEntry({
        entityType: AuditEntityType.task,
        entityId: task.id,
        projectId: task.projectId,
        userId: user.id,
        action: AuditAction.status_changed,
        fieldChanged: "status",
        oldValue: task.status,
        newValue: updated.status,
        description: `Puso en espera el pendiente '${task.title}': ${esperando}`,
        metadata: auditMeta("poner_en_espera"),
      });

      const cuando = updated.followUpAt
        ? ` Lo volvemos a mirar el ${fechaCorta(updated.followUpAt)}.`
        : " No le puse fecha de recontacto.";

      return texto(`"${task.title}" queda en espera: ${esperando}.${cuando}`);
    },
  );
}

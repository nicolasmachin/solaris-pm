// Consulta de proyectos: obra, etapas, trámite UTE, materiales, documentos e
// historial. Todo lectura, salvo comentar.
//
// Se lee de los modelos con los mismos servicios que usa la aplicación
// (getCurrentStage, countdownForStage, serializeUteProcess…) y no de las rutas
// HTTP: dos de ellas piden OPERACIONES:EDIT para leer, y una consulta no
// debería exigir permiso de escritura.

import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import {
  Action,
  AuditAction,
  AuditEntityType,
  Module,
  ProjectStatus,
  StageStatus,
  TaskStatus,
} from "@prisma/client";
import { z } from "zod";

import { prisma } from "../../../lib/prisma.js";
import { createAuditEntry } from "../../../services/audit.service.js";
import { getClienteTimeline } from "../../../services/clientes/index.js";
import { getCurrentStage, getDisplayStage } from "../../../services/project.service.js";
import { getSlaMap, countdownForStage } from "../../../services/stage-sla.service.js";
import { getStageLabel } from "../../../services/pipeline-definitions.js";
import { serializeUteProcess, UTE_PROCESS_INCLUDE } from "../../../services/uteProcess.service.js";
import { requirePermission, type McpUser } from "../context.js";
import { buildDownloadUrl } from "../descargas.routes.js";
import { campos, fechaCorta, fechaLarga, texto, usd } from "../format.js";

function auditMeta(tool: string) {
  return { source: "mcp", tool };
}

const TOPE_BUSQUEDA = 15;

const ESTADO_LABEL: Record<ProjectStatus, string> = {
  PROSPECT: "Prospecto",
  ACTIVE: "Activo",
  COMPLETED: "Terminado",
  PAUSED: "Pausado",
  ARCHIVED: "Archivado",
};

/** El semáforo de plazo de la etapa, en palabras. */
function semaforo(c: { status: string; remainingBusinessDays: number } | null): string | null {
  if (!c) return null;
  if (c.status === "overdue") {
    return `atrasada ${Math.abs(c.remainingBusinessDays)} días hábiles`;
  }
  const quedan = `quedan ${c.remainingBusinessDays} días hábiles`;
  return c.status === "warning" ? `${quedan} (al límite)` : quedan;
}

export function registerProyectosTools(server: McpServer, user: McpUser) {
  // ── Búsqueda y ficha ─────────────────────────────────────────────────────

  server.registerTool(
    "buscar_proyecto",
    {
      title: "Buscar proyecto",
      description:
        "Busca obras por nombre del cliente o por código de proyecto. Devuelve estado, " +
        "etapa actual y avance. Para clientes ya entregados que se cargaron por planilla " +
        "y no tienen obra, usar buscar_generador.",
      inputSchema: {
        busqueda: z.string().min(2).describe("Nombre del cliente o código del proyecto"),
        incluir_terminados: z
          .boolean()
          .optional()
          .describe("Incluir terminados y archivados. Por defecto no."),
      },
      annotations: { readOnlyHint: true },
    },
    async ({ busqueda, incluir_terminados }) => {
      await requirePermission(user, Module.OPERACIONES, Action.VIEW);

      const proyectos = await prisma.project.findMany({
        where: {
          deletedAt: null,
          // Los importados por planilla no tienen obra: viven en Experiencia
          // Solar y se buscan con buscar_generador.
          importedFromCsv: false,
          ...(incluir_terminados
            ? {}
            : { status: { notIn: [ProjectStatus.ARCHIVED, ProjectStatus.COMPLETED] } }),
          OR: [
            { clientName: { contains: busqueda, mode: "insensitive" } },
            { code: { contains: busqueda, mode: "insensitive" } },
          ],
        },
        orderBy: { createdAt: "desc" },
        take: TOPE_BUSQUEDA,
        select: {
          id: true,
          code: true,
          clientName: true,
          status: true,
          locationCity: true,
          capacityKwp: true,
          stageOverride: true,
          stages: {
            where: { deletedAt: null },
            select: { name: true, status: true, order: true },
          },
        },
      });

      if (proyectos.length === 0) {
        return texto(
          `No encontré proyectos que coincidan con "${busqueda}"` +
            (incluir_terminados ? "." : ", entre los que están en curso. Probá incluyendo los terminados."),
        );
      }

      const lista = proyectos.map((p) => {
        const etapa = getDisplayStage(p.stages, p.stageOverride);
        const detalle = [
          ESTADO_LABEL[p.status],
          etapa ? getStageLabel(etapa.name) : null,
          p.capacityKwp ? `${Number(p.capacityKwp)} kWp` : null,
          p.locationCity,
        ]
          .filter(Boolean)
          .join(" · ");
        return `- ${p.clientName} [${p.code}] (id: ${p.id})\n  ${detalle}`;
      });

      return texto(
        `${proyectos.length} resultado${proyectos.length > 1 ? "s" : ""} para "${busqueda}":`,
        lista.join("\n"),
      );
    },
  );

  server.registerTool(
    "ficha_proyecto",
    {
      title: "Ficha del proyecto",
      description:
        "Estado general de una obra: en qué etapa está y si va en plazo, avance, " +
        "potencia, fechas, cuándo se instala y con qué cuadrilla, y cómo viene el " +
        "trámite de UTE. Es la herramienta para saber 'cómo viene' un proyecto. " +
        "Para el detalle de subetapas usar detalle_etapas.",
      inputSchema: { project_id: z.string().min(1) },
      annotations: { readOnlyHint: true },
    },
    async ({ project_id }) => {
      await requirePermission(user, Module.OPERACIONES, Action.VIEW);

      const p = await prisma.project.findFirst({
        where: { id: project_id, deletedAt: null },
        include: {
          salesperson: { select: { name: true } },
          installationSchedule: { include: { segments: { orderBy: { startDate: "asc" } } } },
          stages: {
            where: { deletedAt: null },
            orderBy: { order: "asc" },
            select: {
              name: true,
              status: true,
              order: true,
              progressPercent: true,
              actualStartDate: true,
              actualEndDate: true,
              delayDays: true,
              responsibleUser: { select: { name: true } },
            },
          },
          uteProcesses: {
            where: { deletedAt: null },
            orderBy: { createdAt: "desc" },
            take: 1,
            include: UTE_PROCESS_INCLUDE,
          },
        },
      });

      if (!p) return texto(`No encontré ningún proyecto con el id ${project_id}.`);

      const actual = getDisplayStage(p.stages, p.stageOverride);
      const slaMap = await getSlaMap();
      const countdown = actual
        ? countdownForStage(
            {
              name: actual.name,
              status: actual.status,
              actualStartDate: actual.actualStartDate,
              actualEndDate: actual.actualEndDate,
            },
            slaMap,
            p.startDate,
          )
        : null;

      const completadas = p.stages.filter((s) => s.status === StageStatus.COMPLETED).length;
      const atraso = p.stages.reduce((acc, s) => acc + (s.delayDays ?? 0), 0);

      const general = campos([
        ["Código", p.code],
        ["Estado", ESTADO_LABEL[p.status]],
        [
          "Etapa actual",
          actual
            ? `${getStageLabel(actual.name)}${semaforo(countdown) ? ` — ${semaforo(countdown)}` : ""}`
            : null,
        ],
        ["Responsable de la etapa", actual ? (actual as { responsibleUser?: { name: string } | null }).responsibleUser?.name : null],
        ["Avance", `${completadas} de ${p.stages.length} etapas terminadas`],
        ["Atraso acumulado", atraso > 0 ? `${atraso} días` : null],
        ["Potencia", p.capacityKwp ? `${Number(p.capacityKwp)} kWp` : null],
        ["Ubicación", [p.locationCity, p.locationProvince].filter(Boolean).join(", ")],
        ["Vendedor", p.salesperson?.name],
        ["Presupuesto", p.budgetUsd ? usd(Number(p.budgetUsd)) : null],
      ]);

      const fechas = campos([
        ["Venta", fechaLarga(p.saleDate)],
        ["Inicio", fechaLarga(p.startDate)],
        ["Entrega prevista", fechaLarga(p.plannedEndDate)],
        ["Entrega real", fechaLarga(p.actualEndDate)],
        ["Habilitación UTE", fechaLarga(p.actualUteEnd)],
      ]);

      const sched = p.installationSchedule;
      const obra = sched
        ? campos([
            ["Cuadrilla", `${sched.teamName ?? "sin asignar"}${sched.teamType ? ` (${sched.teamType.toLowerCase()})` : ""}`],
            [
              "Fechas de obra",
              sched.segments.length > 0
                ? sched.segments
                    .map((s) => `${fechaCorta(s.startDate)} a ${fechaCorta(s.endDate)}`)
                    .join(", ")
                : null,
            ],
            ["Confirmada", sched.confirmedAt ? fechaCorta(sched.confirmedAt) : "sin confirmar"],
          ])
        : null;

      const ute = p.uteProcesses[0] ? serializeUteProcess(p.uteProcesses[0]) : null;
      const bloqueUte = ute
        ? campos([
            ["Etapa", ute.currentStage],
            ["Estado", ute.currentStatus],
            ["Expediente", ute.caseNumber],
            ["Días totales", ute.totalDays],
            ["De los cuales nuestros", ute.ourTimeDays],
            ["Esperando a UTE", ute.uteTimeDays],
          ])
        : null;

      return texto(
        `${p.clientName}`,
        general,
        fechas ? `FECHAS\n${fechas}` : null,
        obra ? `INSTALACIÓN\n${obra}` : null,
        bloqueUte ? `TRÁMITE UTE\n${bloqueUte}` : null,
      );
    },
  );

  server.registerTool(
    "detalle_etapas",
    {
      title: "Etapas y subetapas del proyecto",
      description:
        "El desglose completo del pipeline de una obra: cada etapa con sus subetapas, " +
        "quién es responsable, qué está hecho y qué falta. Usar cuando se pregunta qué " +
        "falta para avanzar o quién tiene una tarea trabada.",
      inputSchema: {
        project_id: z.string().min(1),
        solo_pendientes: z
          .boolean()
          .optional()
          .describe("Mostrar solo lo que falta. Por defecto muestra todo."),
      },
      annotations: { readOnlyHint: true },
    },
    async ({ project_id, solo_pendientes }) => {
      await requirePermission(user, Module.OPERACIONES, Action.VIEW);

      const p = await prisma.project.findFirst({
        where: { id: project_id, deletedAt: null },
        select: {
          clientName: true,
          code: true,
          stages: {
            where: { deletedAt: null },
            orderBy: { order: "asc" },
            select: {
              name: true,
              status: true,
              progressPercent: true,
              responsibleUser: { select: { name: true } },
              substages: {
                where: { deletedAt: null, isActive: true },
                orderBy: { order: "asc" },
                select: {
                  name: true,
                  status: true,
                  user: { select: { name: true } },
                  deadline: true,
                },
              },
            },
          },
        },
      });

      if (!p) return texto(`No encontré ningún proyecto con el id ${project_id}.`);

      const bloques = p.stages
        .filter((s) => !solo_pendientes || s.status !== StageStatus.COMPLETED)
        .map((s) => {
          const subs = s.substages
            .filter((x) => !solo_pendientes || x.status !== "COMPLETED")
            .map((x) => {
              const marca =
                x.status === "COMPLETED" ? "✓" : x.status === "BLOCKED" ? "⨯" : x.status === "NO_APLICA" ? "–" : "·";
              const extra = [
                x.user?.name,
                x.deadline ? `vence ${fechaCorta(x.deadline)}` : null,
              ]
                .filter(Boolean)
                .join(", ");
              return `  ${marca} ${x.name}${extra ? ` (${extra})` : ""}`;
            });
          const cabecera =
            `${getStageLabel(s.name)} — ${s.progressPercent}%` +
            (s.responsibleUser?.name ? ` · ${s.responsibleUser.name}` : "");
          return subs.length > 0 ? `${cabecera}\n${subs.join("\n")}` : cabecera;
        });

      if (bloques.length === 0) {
        return texto(`${p.clientName} [${p.code}]: no queda nada pendiente.`);
      }

      return texto(
        `${p.clientName} [${p.code}]${solo_pendientes ? " — lo que falta" : ""}:`,
        bloques.join("\n\n"),
        "(✓ hecho · · pendiente · ⨯ bloqueado · – no aplica)",
      );
    },
  );

  // ── Trámite UTE ──────────────────────────────────────────────────────────

  server.registerTool(
    "tramite_ute",
    {
      title: "Trámite de habilitación UTE",
      description:
        "Estado del trámite ante UTE de un proyecto: en qué etapa está, los hitos con " +
        "sus fechas, y cuántos días son responsabilidad nuestra y cuántos estamos " +
        "esperando a UTE.",
      inputSchema: { project_id: z.string().min(1) },
      annotations: { readOnlyHint: true },
    },
    async ({ project_id }) => {
      await requirePermission(user, Module.TRAMITES_UTE, Action.VIEW);

      const row = await prisma.uteProcess.findFirst({
        where: { projectId: project_id, deletedAt: null },
        orderBy: { createdAt: "desc" },
        include: UTE_PROCESS_INCLUDE,
      });
      if (!row) return texto("Ese proyecto no tiene trámite de UTE iniciado.");

      const u = serializeUteProcess(row);

      const estado = campos([
        ["Etapa", u.currentStage],
        ["Estado", u.currentStatus],
        ["Expediente", u.caseNumber],
        ["Código PS", u.project.uteCodigoPS],
        ["Código AS", u.project.uteCodigoAS],
        ["Última acción", u.lastActionAt],
      ]);

      const hitos = campos([
        ["Consulta enviada", u.consultaSentAt],
        ["Expediente abierto", u.caseOpenedAt],
        ["Consulta aprobada", u.consultaApprovedAt],
        ["Solicitud enviada", u.solicitudSentAt],
        ["Proyecto aprobado", u.proyectoApprovedAt],
        ["Documentación 1 enviada", u.docs1SentAt],
        ["Documentación 1 aprobada", u.docs1ApprovedAt],
        ["Ensayos enviados", u.ensayosSentAt],
        ["Ensayos aprobados", u.ensayosApprovedAt],
        ["Documentación 2 enviada", u.docs2SentAt],
        ["Finalizado", u.finalizedAt],
      ]);

      const tiempos = campos([
        ["Días totales", u.totalDays],
        ["Nuestros", u.ourTimeDays],
        ["Esperando a UTE", u.uteTimeDays],
      ]);

      return texto(
        `Trámite UTE de ${u.project.clientName} [${u.project.code}]`,
        estado,
        `HITOS\n${hitos}`,
        `TIEMPOS\n${tiempos}`,
      );
    },
  );

  // ── Obra y materiales ────────────────────────────────────────────────────

  server.registerTool(
    "obra_y_materiales",
    {
      title: "Obra y materiales del proyecto",
      description:
        "Los materiales de una obra con su estado de compra, el costo previsto, y las " +
        "fotos y videos con enlace para verlos. Usar para saber si llegó el material o " +
        "qué se registró de la obra.",
      inputSchema: { project_id: z.string().min(1) },
      annotations: { readOnlyHint: true },
    },
    async ({ project_id }) => {
      await requirePermission(user, Module.OPERACIONES, Action.VIEW);

      const p = await prisma.project.findFirst({
        where: { id: project_id, deletedAt: null },
        select: { id: true, clientName: true, code: true },
      });
      if (!p) return texto(`No encontré ningún proyecto con el id ${project_id}.`);

      const materiales = await prisma.projectMaterial.findMany({
        where: { projectId: p.id },
        select: {
          quantity: true,
          unitPrice: true,
          moneda: true,
          status: true,
          expectedDate: true,
          materialItem: { select: { nombre: true, unidad: true } },
          supplier: { select: { nombre: true } },
        },
        orderBy: { createdAt: "asc" },
        take: 60,
      });

      const porEstado = new Map<string, number>();
      for (const m of materiales) porEstado.set(m.status, (porEstado.get(m.status) ?? 0) + 1);

      const listaMateriales =
        materiales.length > 0
          ? materiales
              .map((m) => {
                const precio = m.unitPrice ? ` · ${Number(m.unitPrice)} ${m.moneda ?? ""}`.trim() : "";
                const fecha = m.expectedDate ? ` · llega ${fechaCorta(m.expectedDate)}` : "";
                return `- ${m.materialItem?.nombre ?? "?"} × ${Number(m.quantity)} — ${m.status}${precio}${fecha}`;
              })
              .join("\n")
          : null;

      const fotos = await prisma.fileAttachment.count({
        where: { projectId: p.id, deletedAt: null, toolSource: "obra-fotos" },
      });

      const videos = await prisma.projectVideo.findMany({
        where: { projectId: p.id, deletedAt: null },
        select: { id: true, tipoVideo: true, descripcion: true, processingStatus: true },
        take: 10,
      });

      return texto(
        `Obra de ${p.clientName} [${p.code}]`,
        materiales.length > 0
          ? `MATERIALES (${materiales.length}) — ${[...porEstado].map(([k, v]) => `${k}: ${v}`).join(" · ")}\n${listaMateriales}`
          : "Todavía no se cargaron materiales.",
        fotos > 0 ? `FOTOS DE OBRA\n${fotos} foto${fotos === 1 ? "" : "s"} cargadas.` : null,
        videos.length > 0
          ? `VIDEOS\n${videos.map((v) => `- ${v.tipoVideo}${v.descripcion ? `: ${v.descripcion}` : ""} (${v.processingStatus})`).join("\n")}`
          : null,
      );
    },
  );

  server.registerTool(
    "documentos_proyecto",
    {
      title: "Documentos del proyecto",
      description:
        "Lista los documentos generados de un proyecto —unifilar, pre-ingeniería, " +
        "proyecto final, presupuestos— con un enlace para abrirlos. Los enlaces duran " +
        "15 minutos.",
      inputSchema: { project_id: z.string().min(1) },
      annotations: { readOnlyHint: true },
    },
    async ({ project_id }) => {
      await requirePermission(user, Module.OPERACIONES, Action.VIEW);

      const p = await prisma.project.findFirst({
        where: { id: project_id, deletedAt: null },
        select: { id: true, clientName: true, code: true },
      });
      if (!p) return texto(`No encontré ningún proyecto con el id ${project_id}.`);

      const archivos = await prisma.fileAttachment.findMany({
        where: {
          projectId: p.id,
          deletedAt: null,
          // Las fotos de obra se cuentan aparte en obra_y_materiales: son
          // cientos y ahogarían la lista.
          NOT: { toolSource: "obra-fotos" },
        },
        select: {
          id: true,
          filename: true,
          tipo: true,
          toolSource: true,
          toolVersion: true,
          createdAt: true,
        },
        orderBy: { createdAt: "desc" },
        take: 25,
      });

      if (archivos.length === 0) {
        return texto(`${p.clientName} [${p.code}] no tiene documentos generados todavía.`);
      }

      const lista = archivos.map((a) => {
        const origen = a.toolSource
          ? ` · ${a.toolSource}${a.toolVersion ? ` v${a.toolVersion}` : ""}`
          : "";
        return (
          `- ${a.filename} (${fechaCorta(a.createdAt)})${origen}\n` +
          `  ${buildDownloadUrl(user.id, "project-file", a.id)}`
        );
      });

      return texto(
        `Documentos de ${p.clientName} [${p.code}] — los enlaces vencen en 15 minutos:`,
        lista.join("\n"),
      );
    },
  );

  // ── Historial ────────────────────────────────────────────────────────────

  server.registerTool(
    "historial_proyecto",
    {
      title: "Historial del proyecto",
      description:
        "La historia completa del cliente en orden: avances de etapa, comentarios, " +
        "llamadas y mensajes registrados, traspasos entre áreas, tickets y encuestas. " +
        "Usar para ponerse al día con un cliente antes de llamarlo.",
      inputSchema: {
        project_id: z.string().min(1),
        limite: z.number().int().min(1).max(50).optional().describe("Cuántos eventos. Por defecto 20."),
      },
      annotations: { readOnlyHint: true },
    },
    async ({ project_id, limite }) => {
      await requirePermission(user, Module.OPERACIONES, Action.VIEW);

      const p = await prisma.project.findFirst({
        where: { id: project_id, deletedAt: null },
        select: { clientName: true, code: true },
      });
      if (!p) return texto(`No encontré ningún proyecto con el id ${project_id}.`);

      const items = await getClienteTimeline(project_id);
      if (items.length === 0) return texto(`${p.clientName} no tiene historial registrado.`);

      const lineas = items
        .slice(0, limite ?? 20)
        .map((i) => `- ${fechaCorta(i.createdAt)}${i.autor ? ` · ${i.autor.nombre}` : ""}: ${i.text}`);

      return texto(
        `Historial de ${p.clientName} [${p.code}] (${items.length} eventos, se muestran ${lineas.length}):`,
        lineas.join("\n"),
      );
    },
  );

  // ── Escritura ────────────────────────────────────────────────────────────

  server.registerTool(
    "comentar_proyecto",
    {
      title: "Comentar en un proyecto",
      description:
        "Deja un comentario en el historial de una obra. Es la forma de registrar algo " +
        "desde la obra misma sin abrir la aplicación.",
      inputSchema: {
        project_id: z.string().min(1),
        comentario: z.string().min(1),
      },
    },
    async ({ project_id, comentario }) => {
      await requirePermission(user, Module.OPERACIONES, Action.COMMENT);

      const p = await prisma.project.findFirst({
        where: { id: project_id, deletedAt: null },
        select: { id: true, clientName: true },
      });
      if (!p) return texto(`No encontré ningún proyecto con el id ${project_id}.`);

      const comment = await prisma.comment.create({
        data: { content: comentario, authorId: user.id, projectId: p.id },
      });

      await createAuditEntry({
        entityType: AuditEntityType.comment,
        entityId: comment.id,
        projectId: p.id,
        userId: user.id,
        action: AuditAction.comment_added,
        description: `Comentó en el proyecto '${p.clientName}'`,
        metadata: auditMeta("comentar_proyecto"),
      });

      return texto(`Comentario guardado en ${p.clientName}:`, comentario);
    },
  );

  // Las tareas del proyecto se listan acá y no en listar_pendientes porque esa
  // solo trae las propias: en una obra importa lo que quedó pendiente sea de
  // quien sea.
  server.registerTool(
    "pendientes_proyecto",
    {
      title: "Pendientes del proyecto",
      description:
        "Los pendientes abiertos de una obra, de todo el equipo (no solo los propios). " +
        "Para crear uno nuevo usar crear_pendiente con el project_id.",
      inputSchema: { project_id: z.string().min(1) },
      annotations: { readOnlyHint: true },
    },
    async ({ project_id }) => {
      await requirePermission(user, Module.OPERACIONES, Action.VIEW);

      const tasks = await prisma.task.findMany({
        where: {
          projectId: project_id,
          deletedAt: null,
          status: { not: TaskStatus.COMPLETED },
        },
        select: {
          title: true,
          status: true,
          dueDate: true,
          waitingReason: true,
          followUpAt: true,
          assignees: { select: { user: { select: { name: true } } } },
        },
        orderBy: [{ dueDate: "asc" }, { createdAt: "desc" }],
        take: 30,
      });

      if (tasks.length === 0) return texto("Ese proyecto no tiene pendientes abiertos.");

      const lineas = tasks.map((t) => {
        const quien = t.assignees.map((a) => a.user.name).join(", ");
        const estado =
          t.status === TaskStatus.WAITING
            ? `en espera${t.waitingReason ? `: ${t.waitingReason}` : ""}${t.followUpAt ? ` (reconsultar ${fechaCorta(t.followUpAt)})` : ""}`
            : t.dueDate
              ? `vence ${fechaCorta(t.dueDate)}`
              : "sin fecha";
        return `- ${t.title} — ${estado}${quien ? ` · ${quien}` : ""}`;
      });

      return texto(`${tasks.length} pendiente${tasks.length > 1 ? "s" : ""} en la obra:`, lineas.join("\n"));
    },
  );
}

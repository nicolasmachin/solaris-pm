// "¿Qué tengo hoy?" — la pregunta de la mañana.
//
// El resto del conector responde sobre un cliente que ya se nombró. Esta es la
// única que responde sin que haya que saber por dónde empezar, que es
// justamente lo que uno no sabe cuando arranca el día.

import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { Action, Module, SalesStage, TaskStatus } from "@prisma/client";
import { z } from "zod";

import { prisma } from "../../../lib/prisma.js";
import { requirePermission, type McpUser } from "../context.js";
import { ETAPA_LABEL, fechaCorta, texto } from "../format.js";

/** Sin novedades hace más de esto, un lead está trabado. */
const DIAS_TRABADO = 14;

/** Tope de leads que se listan por bloque. Más que esto no se lee en un chat. */
const TOPE_POR_BLOQUE = 8;

const ETAPAS_ABIERTAS: SalesStage[] = [
  SalesStage.NUEVO_LEAD,
  SalesStage.COTIZADO,
  SalesStage.RECLAMADO,
  SalesStage.AGENDAR_VISITA,
  SalesStage.VISITADO,
];

/** Medianoche de hoy, en hora de Uruguay, como instante UTC. */
function inicioDeHoy(): Date {
  const hoy = new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Montevideo",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
  return new Date(`${hoy}T00:00:00.000Z`);
}

function diasDesde(fecha: Date): number {
  return Math.floor((Date.now() - fecha.getTime()) / 86_400_000);
}

export function registerMiDiaTools(server: McpServer, user: McpUser) {
  server.registerTool(
    "mi_dia",
    {
      title: "Qué tengo hoy",
      description:
        "Resumen del día del asesor: cómo está su embudo, qué clientes potenciales " +
        "piden acción hoy (reclamos, visitas agendadas, cotizaciones sin respuesta), " +
        "cuáles están trabados hace tiempo y qué pendientes vencen. Usar cuando se " +
        "pregunta 'qué tengo hoy', 'por dónde arranco' o 'cómo viene el mes', sin " +
        "nombrar un cliente en particular.",
      inputSchema: {
        de_todo_el_equipo: z
          .boolean()
          .optional()
          .describe("Ver los de todos, no solo los propios. Por defecto, solo los propios."),
      },
      annotations: { readOnlyHint: true },
    },
    async ({ de_todo_el_equipo }) => {
      await requirePermission(user, Module.VENTAS, Action.VIEW);

      const soloMios = !de_todo_el_equipo;
      const scope = soloMios ? { assignedToId: user.id } : {};

      const leads = await prisma.salesLead.findMany({
        where: { deletedAt: null, stage: { in: ETAPAS_ABIERTAS }, ...scope },
        select: {
          id: true,
          code: true,
          clientName: true,
          stage: true,
          reclamosCount: true,
          lastReclamoAt: true,
          visitScheduledAt: true,
          proposalSentAt: true,
          leadCreatedAt: true,
          createdAt: true,
          assignedTo: { select: { name: true } },
          activities: { select: { createdAt: true }, orderBy: { createdAt: "desc" }, take: 1 },
        },
      });

      if (leads.length === 0) {
        return texto(
          soloMios
            ? "No tenés clientes potenciales abiertos."
            : "No hay clientes potenciales abiertos.",
        );
      }

      // ── Embudo ──
      const porEtapa = new Map<SalesStage, number>();
      for (const l of leads) porEtapa.set(l.stage, (porEtapa.get(l.stage) ?? 0) + 1);
      const embudo = ETAPAS_ABIERTAS.filter((e) => porEtapa.has(e))
        .map((e) => `${ETAPA_LABEL[e] ?? e}: ${porEtapa.get(e)}`)
        .join(" · ");

      const hoy = inicioDeHoy();
      const pasadoManana = new Date(hoy.getTime() + 2 * 86_400_000);

      const etiqueta = (l: (typeof leads)[number]) =>
        `${l.clientName} [${l.code}]` + (soloMios ? "" : ` · ${l.assignedTo?.name ?? "sin asesor"}`);

      // ── Piden acción hoy ──
      // El rango va acotado por los dos lados: sin el piso, "visitas de hoy y
      // mañana" listaba todas las agendadas del pasado.
      const visitasProximas = leads
        .filter(
          (l) =>
            l.visitScheduledAt && l.visitScheduledAt >= hoy && l.visitScheduledAt < pasadoManana,
        )
        .sort((a, b) => a.visitScheduledAt!.getTime() - b.visitScheduledAt!.getTime())
        .map((l) => `- ${etiqueta(l)} — visita el ${fechaCorta(l.visitScheduledAt)}`);

      // Agendada hace rato y el lead sigue esperando la visita: o se hizo y no
      // se registró, o se cayó. En los dos casos hay algo que hacer.
      const visitasVencidas = leads
        .filter(
          (l) =>
            l.stage === SalesStage.AGENDAR_VISITA &&
            l.visitScheduledAt &&
            l.visitScheduledAt < hoy,
        )
        .sort((a, b) => a.visitScheduledAt!.getTime() - b.visitScheduledAt!.getTime())
        .slice(0, TOPE_POR_BLOQUE)
        .map((l) => `- ${etiqueta(l)} — estaba agendada para el ${fechaCorta(l.visitScheduledAt)}`);

      const reclamados = leads
        .filter((l) => l.stage === SalesStage.RECLAMADO || l.reclamosCount > 0)
        .sort((a, b) => b.reclamosCount - a.reclamosCount)
        .slice(0, TOPE_POR_BLOQUE)
        .map(
          (l) =>
            `- ${etiqueta(l)} — ${l.reclamosCount} reclamo${l.reclamosCount === 1 ? "" : "s"}` +
            (l.lastReclamoAt ? `, el último el ${fechaCorta(l.lastReclamoAt)}` : ""),
        );

      // ── Trabados ──
      const conAntiguedad = leads.map((l) => {
        const ultima = l.activities[0]?.createdAt ?? l.leadCreatedAt ?? l.createdAt;
        return { lead: l, dias: diasDesde(ultima) };
      });
      const trabados = conAntiguedad
        .filter((x) => x.dias >= DIAS_TRABADO)
        .sort((a, b) => b.dias - a.dias)
        .slice(0, TOPE_POR_BLOQUE)
        .map((x) => `- ${etiqueta(x.lead)} — sin novedades hace ${x.dias} días`);

      // ── Pendientes ──
      const pendientes = await prisma.task.findMany({
        where: {
          deletedAt: null,
          status: { notIn: [TaskStatus.COMPLETED, TaskStatus.WAITING] },
          OR: [{ assignees: { some: { userId: user.id } } }, { userId: user.id }],
          dueDate: { lte: new Date(hoy.getTime() + 86_400_000) },
        },
        select: { title: true, dueDate: true },
        orderBy: { dueDate: "asc" },
        take: TOPE_POR_BLOQUE,
      });
      const lineasPendientes = pendientes.map((t) => {
        const vencido = t.dueDate && t.dueDate < hoy;
        return `- ${t.title}${vencido ? ` — VENCIDO el ${fechaCorta(t.dueDate)}` : " — vence hoy"}`;
      });

      // Lo que se espera de un tercero se cuenta pero no se lista: no es acción
      // de hoy, y mezclarlo tapa lo que sí lo es.
      const enEspera = await prisma.task.count({
        where: {
          deletedAt: null,
          status: TaskStatus.WAITING,
          OR: [{ assignees: { some: { userId: user.id } } }, { userId: user.id }],
        },
      });

      const titulo = soloMios
        ? `Tenés ${leads.length} clientes potenciales abiertos.`
        : `Hay ${leads.length} clientes potenciales abiertos en todo el equipo.`;

      return texto(
        titulo,
        `EMBUDO\n${embudo}`,
        visitasProximas.length > 0 ? `VISITAS DE HOY Y MAÑANA\n${visitasProximas.join("\n")}` : null,
        visitasVencidas.length > 0
          ? `VISITAS QUE YA PASARON Y SIGUEN SIN REGISTRAR\n${visitasVencidas.join("\n")}`
          : null,
        reclamados.length > 0 ? `RECLAMARON\n${reclamados.join("\n")}` : null,
        trabados.length > 0
          ? `TRABADOS (sin novedades hace ${DIAS_TRABADO} días o más)\n${trabados.join("\n")}`
          : null,
        lineasPendientes.length > 0
          ? `PENDIENTES DE HOY\n${lineasPendientes.join("\n")}`
          : "No tenés pendientes venciendo hoy.",
        enEspera > 0 ? `(${enEspera} pendiente${enEspera === 1 ? "" : "s"} esperando a un tercero.)` : null,
      );
    },
  );
}

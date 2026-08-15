// Herramientas de ventas del conector.
//
// Toda escritura pasa por los servicios compartidos con la API HTTP, así que
// las reglas de negocio son las mismas se entre por el chat o por la pantalla.
// Cada una audita con `source: "mcp"` para poder medir qué se hace por acá.

import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { Action, Module, SalesStage, TaskStatus } from "@prisma/client";
import { z } from "zod";

import { prisma } from "../../../lib/prisma.js";
import {
  buildLeadSearchFilter,
  comentarLead,
  crearLead,
  editarLead,
  moverEtapaLead,
} from "../../../services/sales/leads.service.js";
import { interpretarMarkup } from "../../../services/proposal/calculator.js";
import { hasPermission } from "../../../middleware/authorize.middleware.js";
import { listLeadProposals } from "../../../services/proposal/lead-proposals.service.js";
import { getVersionById } from "../../../services/proposal/version.service.js";
import { requirePermission, type McpUser } from "../context.js";
import { campos, ETAPA_LABEL, fechaCorta, fechaLarga, pesos, porcentaje, texto, usd } from "../format.js";
import { buildDownloadUrl } from "../descargas.routes.js";

/** Marca de origen para la auditoría. */
function auditMeta(tool: string) {
  return { source: "mcp", tool };
}

/** Cuántos resultados devuelve una búsqueda. Más que esto no se lee en un chat. */
const LIMITE_BUSQUEDA = 15;

export function registerVentasTools(server: McpServer, user: McpUser) {
  // ── Lectura ──────────────────────────────────────────────────────────────

  server.registerTool(
    "buscar_lead",
    {
      title: "Buscar cliente potencial",
      description:
        "Busca clientes potenciales (leads) por nombre, teléfono, email, dirección o " +
        "código. El teléfono se puede pasar con o sin espacios y guiones. Devuelve una " +
        "lista corta con la etapa y los datos de contacto. Usar antes de cualquier " +
        "acción sobre un cliente, para obtener su identificador.",
      inputSchema: {
        busqueda: z.string().min(2).describe("Nombre, teléfono, email, dirección o código"),
        incluir_cerrados: z
          .boolean()
          .optional()
          .describe("Incluir los ya ganados o perdidos. Por defecto no."),
      },
      annotations: { readOnlyHint: true },
    },
    async ({ busqueda, incluir_cerrados }) => {
      await requirePermission(user, Module.VENTAS, Action.VIEW);

      const filtro = await buildLeadSearchFilter(busqueda);
      const leads = await prisma.salesLead.findMany({
        where: {
          deletedAt: null,
          ...(filtro ?? {}),
          ...(incluir_cerrados
            ? {}
            : { stage: { notIn: [SalesStage.CERRADO_GANADO, SalesStage.CERRADO_PERDIDO] } }),
        },
        orderBy: { leadCreatedAt: "desc" },
        take: LIMITE_BUSQUEDA,
        select: {
          id: true,
          code: true,
          clientName: true,
          clientPhone: true,
          clientEmail: true,
          address: true,
          stage: true,
          assignedTo: { select: { name: true } },
        },
      });

      if (leads.length === 0) {
        return texto(
          `No hay clientes potenciales que coincidan con "${busqueda}"` +
            (incluir_cerrados ? "." : ", entre los que están abiertos. Probá incluyendo los cerrados."),
        );
      }

      const lista = leads
        .map((l) => {
          const datos = [
            ETAPA_LABEL[l.stage] ?? l.stage,
            l.clientPhone,
            l.address,
            l.assignedTo ? `asesor: ${l.assignedTo.name}` : null,
          ]
            .filter(Boolean)
            .join(" · ");
          return `- ${l.clientName} [${l.code}] (id: ${l.id})\n  ${datos}`;
        })
        .join("\n");

      const encabezado =
        leads.length === LIMITE_BUSQUEDA
          ? `Primeros ${LIMITE_BUSQUEDA} resultados para "${busqueda}" (puede haber más):`
          : `${leads.length} resultado${leads.length > 1 ? "s" : ""} para "${busqueda}":`;

      return texto(encabezado, lista);
    },
  );

  server.registerTool(
    "ficha_lead",
    {
      title: "Ficha del cliente potencial",
      description:
        "Devuelve todo lo que hay sobre un cliente potencial: contacto, dirección, " +
        "etapa, fechas del proceso, últimos comentarios, propuestas y pendientes " +
        "abiertos. Es la herramienta para preparar una visita.",
      inputSchema: {
        lead_id: z.string().min(1).describe("Identificador del cliente potencial"),
      },
      annotations: { readOnlyHint: true },
    },
    async ({ lead_id }) => {
      await requirePermission(user, Module.VENTAS, Action.VIEW);

      const lead = await prisma.salesLead.findFirst({
        where: { id: lead_id, deletedAt: null },
        include: {
          assignedTo: { select: { name: true } },
          convertedToProject: { select: { code: true } },
          comments: {
            where: { deletedAt: null },
            orderBy: { createdAt: "desc" },
            take: 8,
            include: { author: { select: { name: true } } },
          },
          tasks: {
            where: { deletedAt: null, status: { not: TaskStatus.COMPLETED } },
            orderBy: { dueDate: "asc" },
          },
        },
      });

      if (!lead) return texto(`No encontré ningún cliente potencial con el id ${lead_id}.`);

      const datos = campos([
        ["Código", lead.code],
        ["Etapa", ETAPA_LABEL[lead.stage] ?? lead.stage],
        ["Teléfono", lead.clientPhone],
        ["Email", lead.clientEmail],
        ["Dirección", lead.address],
        ["Asesor", lead.assignedTo?.name],
        ["Reclamos", lead.reclamosCount > 0 ? `${lead.reclamosCount} (último: ${fechaCorta(lead.lastReclamoAt)})` : null],
        ["Potencia estimada", lead.estimatedKwp ? `${lead.estimatedKwp} kWp` : null],
        ["Presupuesto estimado", lead.estimatedBudgetUsd ? usd(Number(lead.estimatedBudgetUsd)) : null],
        ["Factura UTE mensual", lead.uteBillMonthlyUsd ? usd(Number(lead.uteBillMonthlyUsd)) : null],
        ["Tipo de techo", lead.roofType],
        ["Motivo de pérdida", lead.lostReason],
        ["Convertido en proyecto", lead.convertedToProject?.code],
      ]);

      const fechas = campos([
        ["Alta", fechaLarga(lead.leadCreatedAt)],
        ["Propuesta enviada", fechaLarga(lead.proposalSentAt)],
        ["Visita agendada", fechaLarga(lead.visitScheduledAt)],
        ["Visita realizada", fechaLarga(lead.visitCompletedAt)],
        ["Cierre", fechaLarga(lead.closedAt)],
      ]);

      const propuestas = await listLeadProposals(lead.id, false, lead.clientName);
      const bloquePropuestas =
        propuestas.length > 0
          ? "PROPUESTAS\n" +
            propuestas
              .slice(0, 5)
              .map((p) => {
                const monto = p.totalConIva ? ` · ${usd(p.totalConIva)}` : "";
                return `- v${p.versionNumber ?? "?"} del ${fechaCorta(p.createdAt)}${monto} (id: ${p.id})`;
              })
              .join("\n")
          : "PROPUESTAS\nTodavía no tiene ninguna.";

      const bloquePendientes =
        lead.tasks.length > 0
          ? "PENDIENTES ABIERTOS\n" +
            lead.tasks
              .map((t) => {
                const estado =
                  t.status === TaskStatus.WAITING
                    ? `en espera${t.waitingReason ? `: ${t.waitingReason}` : ""}${
                        t.followUpAt ? ` (reconsultar ${fechaCorta(t.followUpAt)})` : ""
                      }`
                    : t.dueDate
                      ? `vence ${fechaCorta(t.dueDate)}`
                      : "sin fecha";
                return `- ${t.title} — ${estado}`;
              })
              .join("\n")
          : null;

      const bloqueComentarios =
        lead.comments.length > 0
          ? "ÚLTIMOS COMENTARIOS\n" +
            lead.comments
              .map((c) => `- ${fechaCorta(c.createdAt)} · ${c.author.name}: ${c.content}`)
              .join("\n")
          : null;

      const bloqueNotas = lead.notes ? `NOTAS\n${lead.notes}` : null;

      return texto(
        `${lead.clientName}`,
        datos,
        fechas ? `FECHAS\n${fechas}` : null,
        bloqueNotas,
        bloquePropuestas,
        bloquePendientes,
        bloqueComentarios,
      );
    },
  );

  server.registerTool(
    "ver_propuesta",
    {
      title: "Ver propuesta comercial",
      description:
        "Devuelve los números de una propuesta publicada —precio final, potencia, " +
        "paneles, ahorro, retorno y cuotas de financiación— y un enlace para " +
        "descargar el PDF, válido por 15 minutos. Si no se indica cuál, devuelve la " +
        "última del cliente.",
      inputSchema: {
        lead_id: z.string().min(1).describe("Identificador del cliente potencial"),
        version_id: z
          .string()
          .optional()
          .describe("Identificador de una versión concreta. Por defecto, la última."),
      },
      annotations: { readOnlyHint: true },
    },
    async ({ lead_id, version_id }) => {
      await requirePermission(user, Module.VENTAS, Action.VIEW);

      const lead = await prisma.salesLead.findFirst({
        where: { id: lead_id, deletedAt: null },
        select: { id: true, clientName: true },
      });
      if (!lead) return texto(`No encontré ningún cliente potencial con el id ${lead_id}.`);

      let versionId = version_id;
      if (!versionId) {
        const ultima = await prisma.proposalV2Version.findFirst({
          where: { leadId: lead.id, status: "PUBLISHED" },
          orderBy: { versionNumber: "desc" },
          select: { id: true },
        });

        if (!ultima) {
          // La mayoría de los clientes históricos tienen sus propuestas en el
          // generador anterior, que no guarda los números desglosados: de esas
          // solo se puede ofrecer el PDF.
          const vieja = await prisma.proposalGeneration.findFirst({
            where: { leadId: lead.id, discardedAt: null, status: "COMPLETED" },
            orderBy: { version: "desc" },
            select: { id: true, version: true, createdAt: true },
          });

          if (vieja) {
            return texto(
              `${lead.clientName} tiene una propuesta del generador anterior ` +
                `(v${vieja.version}, del ${fechaCorta(vieja.createdAt)}). De esas no ` +
                `guardamos los números desglosados, así que solo puedo darte el PDF.`,
              `PDF (el enlace vence en 15 minutos):\n${buildDownloadUrl(user.id, "proposal-generation", vieja.id)}`,
            );
          }

          return texto(
            `${lead.clientName} todavía no tiene ninguna propuesta publicada. ` +
              `Se arman desde Voltia PM, en el panel del cliente.`,
          );
        }
        versionId = ultima.id;
      }

      const version = await getVersionById(versionId);
      if (!version || version.leadId !== lead.id) {
        return texto("No encontré esa propuesta para este cliente.");
      }

      // Del snapshot se toman SOLO los campos comerciales. El resto incluye
      // costos, comisiones y margen, que no tienen por qué salir de la app.
      const snap = version.snapshot as {
        data?: {
          sistema?: { cantidadPaneles?: number; potenciaPanelW?: number; marcaPaneles?: string; marcaInversor?: string };
          cotizacion?: { plazoEntrega?: string; markupPorcentaje?: number };
        };
        calc?: Record<string, number>;
      };
      const calc = snap.calc ?? {};
      const sistema = snap.data?.sistema ?? {};

      const numeros = campos([
        ["Precio final (IVA incluido)", usd(calc.totalFinalConIva ?? calc.totalConIva)],
        ["Potencia", calc.potenciaTotalKwp ? `${calc.potenciaTotalKwp.toFixed(2)} kWp` : null],
        [
          "Paneles",
          sistema.cantidadPaneles
            ? `${sistema.cantidadPaneles} × ${sistema.potenciaPanelW ?? "?"} W` +
              (sistema.marcaPaneles ? ` ${sistema.marcaPaneles}` : "")
            : null,
        ],
        ["Inversor", sistema.marcaInversor],
        ["Precio por watt", calc.usdPorWatt ? `USD ${calc.usdPorWatt.toFixed(2)}` : null],
        [
          "Markup aplicado",
          snap.data?.cotizacion?.markupPorcentaje !== undefined
            ? `${(interpretarMarkup(snap.data.cotizacion.markupPorcentaje) * 100).toFixed(1)}%`
            : null,
        ],
        ["Plazo de entrega", snap.data?.cotizacion?.plazoEntrega],
      ]);

      // La ganancia solo para quien ya ve el cálculo interno en la aplicación.
      const verInterno = await hasPermission(user.role, Module.VENTAS, Action.DEBUG_CALCULADORA);
      const interno =
        verInterno && calc.markupUsdSinIva !== undefined
          ? campos([
              ["Ganancia de la empresa", usd(calc.markupUsdSinIva)],
              ["Margen sobre la venta", porcentaje(calc.margen, 1)],
            ])
          : null;

      const retorno = campos([
        ["Ahorro mensual", pesos(calc.ahorroMensualPesos)],
        ["Ahorro anual", usd(calc.ahorroAnualUsd)],
        ["Porcentaje de ahorro", porcentaje(calc.porcentajeAhorro)],
        ["Nueva factura UTE", pesos(calc.pagaNuevoUtePesos)],
        ["Retorno de la inversión", calc.priAnios ? `${calc.priAnios.toFixed(1)} años` : null],
      ]);

      const financiacion = campos([
        ["24 cuotas", pesos(calc.cuota24m)],
        ["36 cuotas", pesos(calc.cuota36m)],
        ["60 cuotas", pesos(calc.cuota60m)],
      ]);

      const enlace = buildDownloadUrl(user.id, "proposal-version", version.id);

      return texto(
        `Propuesta v${version.versionNumber} de ${lead.clientName} — publicada el ${fechaLarga(version.publishedAt)}`,
        numeros,
        interno ? `INTERNO — no mostrar al cliente\n${interno}` : null,
        retorno ? `AHORRO Y RETORNO\n${retorno}` : null,
        financiacion ? `FINANCIACIÓN BBVA\n${financiacion}` : null,
        `PDF (el enlace vence en 15 minutos):\n${enlace}`,
      );
    },
  );

  // ── Escritura ────────────────────────────────────────────────────────────

  server.registerTool(
    "crear_lead",
    {
      title: "Crear cliente potencial",
      description:
        "Da de alta un cliente potencial nuevo. Solo el nombre es obligatorio. " +
        "Antes de crear uno, buscá por nombre o teléfono para no duplicar.",
      inputSchema: {
        nombre: z.string().min(1).describe("Nombre del cliente o de la empresa"),
        telefono: z.string().optional(),
        email: z.string().optional(),
        direccion: z.string().optional(),
        factura_ute_mensual_usd: z
          .number()
          .positive()
          .optional()
          .describe("Cuánto paga de UTE por mes, en dólares"),
        potencia_estimada_kwp: z.number().positive().optional(),
        tipo_techo: z.string().optional(),
        notas: z.string().optional(),
      },
    },
    async (args) => {
      await requirePermission(user, Module.VENTAS, Action.CREATE);

      const lead = await crearLead({
        data: {
          clientName: args.nombre,
          clientPhone: args.telefono ?? null,
          clientEmail: args.email ?? null,
          address: args.direccion ?? null,
          uteBillMonthlyUsd: args.factura_ute_mensual_usd ?? null,
          estimatedKwp: args.potencia_estimada_kwp ?? null,
          roofType: args.tipo_techo ?? null,
          notes: args.notas ?? null,
          // El asesor es quien lo carga, salvo que después se reasigne desde
          // la app.
          assignedToId: user.id,
        },
        actor: user,
        metadata: auditMeta("crear_lead"),
      });

      return texto(
        `Listo. Creé el cliente potencial ${lead.clientName} con el código ${lead.code}.`,
        campos([
          ["id", lead.id],
          ["Etapa", ETAPA_LABEL[lead.stage] ?? lead.stage],
          ["Teléfono", lead.clientPhone],
          ["Email", lead.clientEmail],
          ["Dirección", lead.address],
          ["Asesor", user.name],
        ]),
      );
    },
  );

  server.registerTool(
    "editar_lead",
    {
      title: "Editar cliente potencial",
      description:
        "Corrige los datos de contacto o de relevamiento de un cliente potencial. " +
        "Solo cambia lo que se manda. No sirve para cambiar la etapa (usar " +
        "mover_etapa) ni para reasignar el asesor, que se hace desde la app.",
      inputSchema: {
        lead_id: z.string().min(1),
        telefono: z.string().optional(),
        email: z.string().optional(),
        direccion: z.string().optional(),
        factura_ute_mensual_usd: z.number().positive().optional(),
        potencia_estimada_kwp: z.number().positive().optional(),
        presupuesto_estimado_usd: z.number().positive().optional(),
        tipo_techo: z.string().optional(),
        notas: z.string().optional(),
      },
    },
    async (args) => {
      await requirePermission(user, Module.VENTAS, Action.EDIT);

      // Lista blanca: el nombre y el asesor quedan afuera a propósito.
      // Renombrar por dictado es como se terminan duplicando clientes, y
      // reasignar dueño es una decisión que merece la pantalla.
      const data = {
        ...(args.telefono !== undefined && { clientPhone: args.telefono }),
        ...(args.email !== undefined && { clientEmail: args.email }),
        ...(args.direccion !== undefined && { address: args.direccion }),
        ...(args.factura_ute_mensual_usd !== undefined && {
          uteBillMonthlyUsd: args.factura_ute_mensual_usd,
        }),
        ...(args.potencia_estimada_kwp !== undefined && { estimatedKwp: args.potencia_estimada_kwp }),
        ...(args.presupuesto_estimado_usd !== undefined && {
          estimatedBudgetUsd: args.presupuesto_estimado_usd,
        }),
        ...(args.tipo_techo !== undefined && { roofType: args.tipo_techo }),
        ...(args.notas !== undefined && { notes: args.notas }),
      };

      if (Object.keys(data).length === 0) {
        return texto("No me pasaste ningún dato para cambiar.");
      }

      const lead = await editarLead({
        leadId: args.lead_id,
        data,
        actor: user,
        metadata: auditMeta("editar_lead"),
      });

      return texto(
        `Guardado. Así quedó ${lead.clientName}:`,
        campos([
          ["Teléfono", lead.clientPhone],
          ["Email", lead.clientEmail],
          ["Dirección", lead.address],
          ["Factura UTE mensual", lead.uteBillMonthlyUsd ? usd(Number(lead.uteBillMonthlyUsd)) : null],
          ["Potencia estimada", lead.estimatedKwp ? `${lead.estimatedKwp} kWp` : null],
          ["Presupuesto estimado", lead.estimatedBudgetUsd ? usd(Number(lead.estimatedBudgetUsd)) : null],
          ["Tipo de techo", lead.roofType],
          ["Notas", lead.notes],
        ]),
      );
    },
  );

  server.registerTool(
    "mover_etapa",
    {
      title: "Mover de etapa",
      description:
        "Cambia la etapa de un cliente potencial en el pipeline comercial. Al pasar " +
        "a 'agendar visita' se completa sola la fecha de visita si estaba vacía, y al " +
        "cerrar se registra la fecha de cierre. Para cerrar como perdido hay que " +
        "indicar el motivo.",
      inputSchema: {
        lead_id: z.string().min(1),
        etapa: z
          .enum([
            "NUEVO_LEAD",
            "COTIZADO",
            "RECLAMADO",
            "AGENDAR_VISITA",
            "VISITADO",
            "CERRADO_GANADO",
            "CERRADO_PERDIDO",
          ])
          .describe("Etapa destino"),
        motivo_perdida: z
          .string()
          .optional()
          .describe("Obligatorio si la etapa es CERRADO_PERDIDO"),
        nota: z.string().optional().describe("Comentario que queda en el historial"),
      },
    },
    async ({ lead_id, etapa, motivo_perdida, nota }) => {
      await requirePermission(user, Module.VENTAS, Action.EDIT);

      const { lead, previousStage } = await moverEtapaLead({
        leadId: lead_id,
        stage: etapa as SalesStage,
        notes: nota,
        lostReason: motivo_perdida,
        actor: user,
        metadata: auditMeta("mover_etapa"),
      });

      const aviso =
        etapa === "CERRADO_GANADO"
          ? "\n\nOjo: el proyecto NO se crea solo. Para convertirlo hay que entrar a " +
            "Voltia PM y completar ciudad, departamento y potencia."
          : "";

      return texto(
        `${lead.clientName} pasó de "${ETAPA_LABEL[previousStage] ?? previousStage}" a ` +
          `"${ETAPA_LABEL[lead.stage] ?? lead.stage}".${aviso}`,
      );
    },
  );

  server.registerTool(
    "comentar_lead",
    {
      title: "Comentar en un cliente potencial",
      description:
        "Deja un comentario en el historial del cliente potencial. Es la herramienta " +
        "para registrar lo que pasó en una visita o una llamada. Si el cliente ya se " +
        "convirtió en proyecto, el comentario se ve también desde ahí.",
      inputSchema: {
        lead_id: z.string().min(1),
        comentario: z.string().min(1).describe("El texto tal como lo quiere dejar el usuario"),
      },
    },
    async ({ lead_id, comentario }) => {
      await requirePermission(user, Module.VENTAS, Action.COMMENT);

      const comment = await comentarLead({
        leadId: lead_id,
        content: comentario,
        actor: user,
        metadata: auditMeta("comentar_lead"),
      });

      return texto(`Comentario guardado el ${fechaCorta(comment.createdAt)} a nombre de ${user.name}:`, comentario);
    },
  );
}

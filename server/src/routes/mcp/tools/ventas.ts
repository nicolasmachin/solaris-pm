// Herramientas de ventas del conector.
//
// Toda escritura pasa por los servicios compartidos con la API HTTP, así que
// las reglas de negocio son las mismas se entre por el chat o por la pantalla.
// Cada una audita con `source: "mcp"` para poder medir qué se hace por acá.

import { guardarUbicacionLead, parsearCoordenadas } from "../../../services/ubicacion.service.js";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { Action, Module, OrigenLead, ProposalVariante, SalesStage, TaskStatus } from "@prisma/client";
import { z } from "zod";

import { prisma } from "../../../lib/prisma.js";
import {
  buildLeadSearchFilter,
  comentarLead,
  crearLead,
  editarLead,
  moverEtapaLead,
} from "../../../services/sales/leads.service.js";
import { describirOrigen, ORIGEN_LEAD_LABEL } from "../../../services/sales/origen-lead.js";
import { interpretarMarkup } from "../../../services/proposal/calculator.js";
import { describirInversores, listaInversoresDistintos } from "../../../services/proposal/inversores.js";
import { hasPermission } from "../../../middleware/authorize.middleware.js";
import { listLeadProposals } from "../../../services/proposal/lead-proposals.service.js";
import { getDraft } from "../../../services/proposal/draft.service.js";
import { getVersionById } from "../../../services/proposal/version.service.js";
import { requirePermission, type McpUser } from "../context.js";
import { campos, ETAPA_LABEL, gps, fechaCorta, fechaLarga, fechaLargaUruguay, pesos, porcentaje, texto, usd } from "../format.js";
import { diaManualUruguay } from "../../../utils/uruguay.js";
import { buildDownloadUrl, nombrePdfPropuesta, nombrePdfPropuestaVieja } from "../descargas.routes.js";
import { convertirLeadAProyecto, datosConversion, type Fuente } from "../../../services/proyecto-alta.service.js";
import { describirFacturacion, FACTURACION_INPUT, FECHA, facturacionDesdeMcp } from "./alta-proyecto.logic.js";

/** Marca de origen para la auditoría. */
function auditMeta(tool: string) {
  return { source: "mcp", tool };
}

/** Cuántos resultados devuelve una búsqueda. Más que esto no se lee en un chat. */
const LIMITE_BUSQUEDA = 15;

/** Valores aceptados para el origen, con su significado, para la descripción. */
const ORIGEN_DESCRIPCION =
  "Cómo nos conoció. Valores: " +
  Object.entries(ORIGEN_LEAD_LABEL)
    .map(([k, v]) => `${k} = ${v}`)
    .join("; ") +
  ". Preguntarlo si no se sabe; no adivinarlo.";


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
          origen: true,
          origenDetalle: true,
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
            `origen: ${describirOrigen(l.origen, l.origenDetalle)}`,
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
        ["Asesor", lead.assignedTo?.name],
        ["Cómo nos conoció", describirOrigen(lead.origen, lead.origenDetalle)],
        ["Reclamos", lead.reclamosCount > 0 ? `${lead.reclamosCount} (último: ${fechaCorta(lead.lastReclamoAt)})` : null],
        ["Motivo de pérdida", lead.lostReason],
        ["Convertido en proyecto", lead.convertedToProject?.code],
      ]);

      // Los campos vacíos se muestran con una raya en vez de omitirse: sin eso
      // no hay forma de distinguir "el dato no está cargado" de "el conector no
      // lo expone", y esa duda obliga a abrir la aplicación igual.
      const contacto = campos([
        ["Teléfono", lead.clientPhone ?? "—"],
        ["Email", lead.clientEmail ?? "—"],
        ["Dirección", lead.address ?? "—"],
        ["Ubicación GPS", gps(lead) ?? "—"],
      ]);

      // El relevamiento vive repartido: el tipo de techo en el lead, y el resto
      // en el borrador de la propuesta, que es donde lo carga quien cotiza.
      const draft = await getDraft(lead.id, ProposalVariante.RESIDENCIAL);
      const d = (draft?.data ?? {}) as {
        techo?: { descripcion?: string; tamanoM2?: number };
        factura?: {
          suministro?: string;
          potenciaContratadaKw?: number;
          tarifa?: string;
          pagaMensualPesos?: number;
        };
        sistema?: { tipoMontaje?: string; cantidadPaneles?: number; potenciaPanelW?: number };
      };

      const m2 = d.techo?.tamanoM2;
      const relevamiento = campos([
        ["Tipo de techo", lead.roofType ?? d.techo?.descripcion ?? "—"],
        ["Superficie disponible", m2 && m2 > 0 ? `${m2} m²` : "— (sin cargar)"],
        ["Tipo de montaje", d.sistema?.tipoMontaje ?? "—"],
        ["Tipo de suministro", d.factura?.suministro ?? "—"],
        [
          "Potencia contratada",
          d.factura?.potenciaContratadaKw ? `${d.factura.potenciaContratadaKw} kW` : "—",
        ],
        ["Tarifa UTE", d.factura?.tarifa ?? "—"],
        [
          "Factura mensual",
          d.factura?.pagaMensualPesos ? pesos(d.factura.pagaMensualPesos) : "—",
        ],
        ["Potencia estimada", lead.estimatedKwp ? `${lead.estimatedKwp} kWp` : "—"],
        [
          "Presupuesto estimado",
          lead.estimatedBudgetUsd ? usd(Number(lead.estimatedBudgetUsd)) : "—",
        ],
      ]);

      const fechas = campos([
        ["Alta", fechaLargaUruguay(lead.leadCreatedAt)],
        ["Propuesta enviada", fechaLargaUruguay(lead.proposalSentAt)],
        ["Visita agendada", fechaLargaUruguay(lead.visitScheduledAt)],
        ["Visita realizada", fechaLargaUruguay(lead.visitCompletedAt)],
        ["Cierre", fechaLargaUruguay(lead.closedAt)],
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

      // Si hay minuta cargada se avisa: es el dato más rico de la visita y
      // conviene que quien pregunta sepa que puede pedirla entera.
      const tieneMinuta = await prisma.fileAttachment.count({
        where: {
          leadId: lead.id,
          deletedAt: null,
          mimeType: "application/pdf",
          OR: [
            { tipo: "MINUTA_RELEVAMIENTO" },
            { filename: { contains: "minuta", mode: "insensitive" } },
            { filename: { contains: "Resumen de Visita", mode: "insensitive" } },
          ],
        },
      });

      return texto(
        `${lead.clientName}`,
        datos,
        `CONTACTO\n${contacto}`,
        `RELEVAMIENTO\n${relevamiento}`,
        fechas ? `FECHAS\n${fechas}` : null,
        bloqueNotas,
        bloquePropuestas,
        bloquePendientes,
        bloqueComentarios,
        tieneMinuta > 0
          ? `Hay ${tieneMinuta} minuta${tieneMinuta > 1 ? "s" : ""} de visita cargada${tieneMinuta > 1 ? "s" : ""}. ` +
            `Pedí "minuta_lead" para leerla completa: trae medidas del techo, ` +
            `instalación eléctrica y observaciones que no están en esta ficha.`
          : null,
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
              `PDF (el enlace vence en 15 minutos):\n${buildDownloadUrl(user.id, "proposal-generation", vieja.id, nombrePdfPropuestaVieja(lead.clientName, vieja.version))}`,
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
          variante?: string;
          empresa?: { razonSocial?: string; rut?: string; contactoNombre?: string };
          sistema?: {
            cantidadPaneles?: number;
            potenciaPanelW?: number;
            marcaPaneles?: string;
            marcaInversor?: string;
            potenciaInversorKw?: number;
            inversores?: { marca: string; potenciaKw: number; paneles?: number }[];
            tipoMontaje?: string;
          };
          techo?: { descripcion?: string; tamanoM2?: number };
          factura?: {
            suministro?: string;
            potenciaContratadaKw?: number;
            tarifa?: string;
            pagaMensualPesos?: number;
          };
          cotizacion?: { plazoEntrega?: string; markupPorcentaje?: number };
        };
        calc?: Record<string, number>;
      };
      const calc = snap.calc ?? {};
      const sistema = snap.data?.sistema ?? {};
      // Inversores distintos: "1 Growatt de 8 kW + 1 Huawei de 6 kW".
      const listaInv = listaInversoresDistintos(sistema);
      const inversoresTexto = listaInv ? describirInversores(listaInv) : null;

      const esEmpresa = snap.data?.variante === "EMPRESA";
      const numeros = campos([
        ["Tipo", esEmpresa ? "Empresa (B2B)" : "Residencial"],
        ...(esEmpresa
          ? ([
              ["Razón social", snap.data?.empresa?.razonSocial || "—"],
              ["RUT", snap.data?.empresa?.rut || "—"],
              ["Contacto", snap.data?.empresa?.contactoNombre || "—"],
            ] as [string, string][])
          : []),
        ["Precio final (IVA incluido)", usd(calc.totalFinalConIva ?? calc.totalConIva)],
        ["Potencia", calc.potenciaTotalKwp ? `${calc.potenciaTotalKwp.toFixed(2)} kWp` : null],
        [
          "Paneles",
          sistema.cantidadPaneles
            ? `${sistema.cantidadPaneles} × ${sistema.potenciaPanelW ?? "?"} W` +
              (sistema.marcaPaneles ? ` ${sistema.marcaPaneles}` : "")
            : null,
        ],
        ["Inversor", inversoresTexto ?? sistema.marcaInversor],
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

      // La configuración física del sistema: lo que se conversa en la visita.
      const configuracion = campos([
        ["Tipo de techo", snap.data?.techo?.descripcion ?? "—"],
        [
          "Superficie de techo",
          snap.data?.techo?.tamanoM2 ? `${snap.data.techo.tamanoM2} m²` : "—",
        ],
        ["Tipo de montaje", snap.data?.sistema?.tipoMontaje ?? "—"],
        [
          "Potencia del inversor",
          inversoresTexto
            ? inversoresTexto
            : snap.data?.sistema?.potenciaInversorKw
            ? `${snap.data.sistema.potenciaInversorKw} kW`
            : "—",
        ],
        ["Tipo de suministro", snap.data?.factura?.suministro ?? "—"],
        [
          "Potencia contratada",
          snap.data?.factura?.potenciaContratadaKw
            ? `${snap.data.factura.potenciaContratadaKw} kW`
            : "—",
        ],
        ["Tarifa UTE", snap.data?.factura?.tarifa ?? "—"],
        [
          "Factura mensual actual",
          snap.data?.factura?.pagaMensualPesos ? pesos(snap.data.factura.pagaMensualPesos) : "—",
        ],
      ]);

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

      const enlace = buildDownloadUrl(user.id, "proposal-version", version.id, nombrePdfPropuesta(version, lead.clientName));

      return texto(
        `Propuesta v${version.versionNumber} de ${lead.clientName} — publicada el ${fechaLarga(version.publishedAt)}`,
        numeros,
        configuracion ? `CONFIGURACIÓN\n${configuracion}` : null,
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
        "Antes de crear uno, buscá por nombre o teléfono para no duplicar. Conviene " +
        "cargar `origen` (cómo nos conoció): es lo que permite medir qué canal trae ventas.",
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
        origen: z.nativeEnum(OrigenLead).optional().describe(ORIGEN_DESCRIPCION),
        origen_detalle: z
          .string()
          .optional()
          .describe("Aclaración del origen: quién lo recomendó, qué marca, qué anuncio. Obligatorio si origen es OTRO."),
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
          origen: args.origen ?? null,
          origenDetalle: args.origen_detalle ?? null,
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
          ["Cómo nos conoció", lead.origen ? describirOrigen(lead.origen, lead.origenDetalle) : null],
        ]),
        lead.origen ? null : "No quedó cargado cómo nos conoció: si lo sabés, pasalo con editar_lead.",
      );
    },
  );

  server.registerTool(
    "editar_lead",
    {
      title: "Editar cliente potencial",
      description:
        "Corrige los datos de contacto o de relevamiento de un cliente potencial, y " +
        "cómo nos conoció (origen), la ubicación GPS del domicilio, y las fechas del proceso (alta, propuesta enviada, visita agendada, visita " +
        "realizada, cierre). Las fechas se completan solas al avanzar el lead: " +
        "cambiarlas acá es para corregirlas o cargar una que faltó, y solo si la " +
        "persona lo pide. Solo cambia lo que se manda. No sirve para cambiar la etapa " +
        "(usar mover_etapa) ni para reasignar el asesor, que se hace desde la app.",
      inputSchema: {
        lead_id: z.string().min(1),
        telefono: z.string().optional(),
        email: z.string().optional(),
        direccion: z.string().optional(),
        ubicacion: z
          .string()
          .optional()
          .describe("Ubicación GPS del domicilio: coordenadas (\"-34.9, -56.1\") o link largo de Google Maps, o \"borrar\". Si el lead ya es proyecto, se copia."),
        factura_ute_mensual_usd: z.number().positive().optional(),
        potencia_estimada_kwp: z.number().positive().optional(),
        presupuesto_estimado_usd: z.number().positive().optional(),
        tipo_techo: z.string().optional(),
        notas: z.string().optional(),
        origen: z.nativeEnum(OrigenLead).optional().describe(ORIGEN_DESCRIPCION),
        origen_detalle: z.string().optional().describe("Aclaración del origen. Obligatoria si origen es OTRO."),
        fecha_alta: z.union([z.string().regex(/^\d{4}-\d{2}-\d{2}$/), z.literal("borrar")]).optional().describe("AAAA-MM-DD, o \"borrar\" para dejarla vacía."),
        fecha_propuesta_enviada: z.union([z.string().regex(/^\d{4}-\d{2}-\d{2}$/), z.literal("borrar")]).optional().describe("AAAA-MM-DD, o \"borrar\"."),
        fecha_visita_agendada: z.union([z.string().regex(/^\d{4}-\d{2}-\d{2}$/), z.literal("borrar")]).optional().describe("Día en que se ACORDÓ la visita con el cliente (no el día de la visita). AAAA-MM-DD, o \"borrar\"."),
        fecha_visita_realizada: z.union([z.string().regex(/^\d{4}-\d{2}-\d{2}$/), z.literal("borrar")]).optional().describe("Día en que se hizo la visita. AAAA-MM-DD, o \"borrar\"."),
        fecha_cierre: z.union([z.string().regex(/^\d{4}-\d{2}-\d{2}$/), z.literal("borrar")]).optional().describe("AAAA-MM-DD, o \"borrar\"."),
      },
    },
    async (args) => {
      await requirePermission(user, Module.VENTAS, Action.EDIT);

      // Un día cargado a mano se guarda como las 00:00 de ese día en Uruguay:
      // es como lo guarda la app, y así cuenta en ese día en las métricas.
      const fecha = (v: string | undefined) =>
        v === undefined ? undefined : v === "borrar" ? null : diaManualUruguay(v).toISOString();
      const fechas = {
        leadCreatedAt: fecha(args.fecha_alta),
        proposalSentAt: fecha(args.fecha_propuesta_enviada),
        visitScheduledAt: fecha(args.fecha_visita_agendada),
        visitCompletedAt: fecha(args.fecha_visita_realizada),
        closedAt: fecha(args.fecha_cierre),
      };
      const fechasPedidas = Object.fromEntries(Object.entries(fechas).filter(([, v]) => v !== undefined));

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
        ...(args.origen !== undefined && { origen: args.origen }),
        ...(args.origen_detalle !== undefined && { origenDetalle: args.origen_detalle }),
        ...fechasPedidas,
      };

      let coords: ReturnType<typeof parsearCoordenadas> = null;
      if (args.ubicacion !== undefined && args.ubicacion !== "borrar") {
        coords = parsearCoordenadas(args.ubicacion);
        if (!coords) {
          return texto(
            "No encontré coordenadas en la ubicación. Pasame las coordenadas (-34.9, -56.1) o el link largo de Google Maps: los links cortos (maps.app.goo.gl) no las traen.",
          );
        }
      }

      if (Object.keys(data).length === 0 && args.ubicacion === undefined) {
        return texto("No me pasaste ningún dato para cambiar.");
      }

      if (args.ubicacion !== undefined) {
        const r = await guardarUbicacionLead(args.lead_id, { coords, origen: "MANUAL", userId: user.id });
        if (!r) return texto(`No encontré ningún cliente potencial con el id ${args.lead_id}.`);
      }
      if (Object.keys(data).length === 0) {
        const l = await prisma.salesLead.findUnique({ where: { id: args.lead_id }, select: { clientName: true, ubicacionLat: true, ubicacionLng: true, convertedToProjectId: true } });
        return texto(
          coords ? `Guardé la ubicación GPS de ${l?.clientName}.` : `Borré la ubicación GPS de ${l?.clientName}.`,
          campos([["Ubicación GPS", l ? gps(l) : null], ["También en el proyecto", l?.convertedToProjectId ? "sí" : null]]),
        );
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
          ["Ubicación GPS", args.ubicacion !== undefined ? (coords ? `${coords.lat}, ${coords.lng}` : "borrada") : null],
          ["Factura UTE mensual", lead.uteBillMonthlyUsd ? usd(Number(lead.uteBillMonthlyUsd)) : null],
          ["Potencia estimada", lead.estimatedKwp ? `${lead.estimatedKwp} kWp` : null],
          ["Presupuesto estimado", lead.estimatedBudgetUsd ? usd(Number(lead.estimatedBudgetUsd)) : null],
          ["Tipo de techo", lead.roofType],
          ["Notas", lead.notes],
          ["Cómo nos conoció", lead.origen ? describirOrigen(lead.origen, lead.origenDetalle) : null],
          ["Alta", fechaLargaUruguay(lead.leadCreatedAt)],
          ["Propuesta enviada", fechaLargaUruguay(lead.proposalSentAt)],
          ["Visita agendada", fechaLargaUruguay(lead.visitScheduledAt)],
          ["Visita realizada", fechaLargaUruguay(lead.visitCompletedAt)],
          ["Cierre", fechaLargaUruguay(lead.closedAt)],
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
          ? "\n\nOjo: el proyecto NO se crea solo. Para convertirlo, usá " +
            "convertir_lead_en_proyecto con la ciudad, el departamento y qué se le " +
            "factura (confirmalo antes con el usuario)."
          : "";

      return texto(
        `${lead.clientName} pasó de "${ETAPA_LABEL[previousStage] ?? previousStage}" a ` +
          `"${ETAPA_LABEL[lead.stage] ?? lead.stage}".${aviso}`,
      );
    },
  );

  server.registerTool(
    "convertir_lead_en_proyecto",
    {
      title: "Convertir un lead ganado en proyecto",
      description:
        "Crea el proyecto de un cliente potencial que ya está en CERRADO_GANADO, igual que el " +
        "botón \"Convertir en proyecto\" de Voltia PM: arma las etapas de obra, el trámite UTE, " +
        "un suministro por inversor si la propuesta tiene varios, y pasa al proyecto los adjuntos, " +
        "fotos, videos, comentarios y la última propuesta publicada. No se puede deshacer desde el " +
        "chat: sin `confirmar` solo devuelve la vista previa; pasá `confirmar: true` recién " +
        "después de que el usuario la vio y dijo que sí. " +
        "Potencia y monto salen de la última propuesta publicada si no se pasan; nombre, " +
        "teléfono, email y dirección, del lead.",
      inputSchema: {
        lead_id: z.string().describe("id del lead (de buscar_lead o ficha_lead)"),
        ciudad: z.string().min(1).describe("Ciudad o localidad de la obra"),
        departamento: z.string().min(1).describe("Departamento de la obra (Montevideo, Canelones…)"),
        facturacion: FACTURACION_INPUT,
        potencia_kwp: z
          .number()
          .positive()
          .optional()
          .describe("Potencia del sistema. Si no se pasa, la de la última propuesta publicada."),
        monto_usd: z
          .number()
          .nonnegative()
          .optional()
          .describe("Precio de venta con IVA. Si no se pasa, el de la última propuesta publicada."),
        modalidad_pago: z
          .enum(["DIRECTO_50_50", "FINANCIACION_BANCARIA"])
          .optional()
          .describe("Cómo paga. Con FINANCIACION_BANCARIA queda prevista la cuota única del banco."),
        nombre: z.string().optional().describe("Solo si el proyecto tiene que ir a otro nombre que el lead"),
        direccion: z.string().optional(),
        email: z.string().email().optional(),
        telefono: z.string().optional(),
        fecha_inicio: FECHA.optional().describe("YYYY-MM-DD. Por defecto, hoy."),
        fecha_fin_prevista: FECHA.optional().describe("YYYY-MM-DD. Por defecto, 90 días después del inicio."),
        confirmar: z
          .literal(true)
          .optional()
          .describe("Solo después de que el usuario vio la vista previa y aprobó. Sin esto no se crea nada."),
      },
    },
    async (args) => {
      await requirePermission(user, Module.VENTAS, Action.CREATE);

      const facturacion = facturacionDesdeMcp(args.facturacion);
      const body = {
        clientName: args.nombre,
        clientAddress: args.direccion,
        clientEmail: args.email,
        clientPhone: args.telefono,
        capacityKwp: args.potencia_kwp,
        budgetUsd: args.monto_usd,
        locationCity: args.ciudad,
        locationProvince: args.departamento,
        startDate: args.fecha_inicio,
        plannedEndDate: args.fecha_fin_prevista,
        modalidadPago: args.modalidad_pago,
        facturacion,
      };
      const usdTexto = (n: number) => usd(n) ?? "—";

      if (!args.confirmar) {
        const d = await datosConversion(args.lead_id, body);
        const DE: Record<Fuente, string> = {
          pedido: "",
          propuesta: " (de la última propuesta publicada)",
          estimado: " (estimado del lead: no hay propuesta publicada)",
        };
        return texto(
          `Vista previa — todavía NO se creó nada. Así quedaría el proyecto de ${d.clientName}:`,
          campos([
            ["Potencia", d.capacityKwp > 0 ? `${d.capacityKwp} kWp${DE[d.fuenteKwp]}` : null],
            [
              "Monto con IVA",
              d.budgetUsd > 0
                ? `${usdTexto(d.budgetUsd)}${DE[d.fuenteMonto]}`
                : "SIN MONTO: no hay propuesta publicada ni estimado; pasá monto_usd o queda en 0",
            ],
            ["Ubicación", `${d.locationCity}, ${d.locationProvince}`],
            ["Dirección", d.clientAddress],
            ["Teléfono", d.clientPhone],
            ["Email", d.clientEmail],
            ["Facturación", describirFacturacion(facturacion, usdTexto)],
            ["Modalidad de pago", args.modalidad_pago ?? null],
            ["Fecha de venta", d.lead.closedAt ? fechaCorta(d.lead.closedAt) : null],
          ]),
          d.missing.length > 0
            ? `Falta: ${d.missing.join(", ")}. Así no se puede crear.`
            : "Si el usuario está de acuerdo, volvé a llamar con los mismos datos y confirmar: true.",
        );
      }

      const project = await convertirLeadAProyecto({
        leadId: args.lead_id,
        body,
        userId: user.id,
        auditMetadata: auditMeta("convertir_lead_en_proyecto"),
      });

      const sistemas = await prisma.solarSystem.count({ where: { projectId: project.id, deletedAt: null } });

      return texto(
        `Listo. ${project.clientName} ya es el proyecto ${project.code}.`,
        campos([
          ["id del proyecto", project.id],
          ["Potencia", `${Number(project.capacityKwp)} kWp`],
          ["Monto", project.budgetUsd != null ? usd(Number(project.budgetUsd)) : null],
          ["Ubicación", `${project.locationCity}, ${project.locationProvince}`],
          ["Facturación", describirFacturacion(facturacion, usdTexto)],
          ["Modalidad de pago", project.modalidadPago],
          ["Fecha de venta", project.saleDate ? fechaCorta(project.saleDate) : null],
          ["Suministros", sistemas > 1 ? `${sistemas} (uno por inversor, cada uno con su trámite UTE)` : null],
        ]),
        "Se armaron las etapas de obra y el trámite UTE, y pasaron al proyecto los adjuntos, " +
          "fotos, videos, comentarios y la propuesta del lead.",
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

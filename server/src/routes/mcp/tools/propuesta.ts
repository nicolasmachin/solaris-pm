// Armado y publicación de propuestas comerciales residenciales desde el chat.
//
// Solo RESIDENCIAL: el cotizador B2B se estrenó hace días y conviene que tenga
// rodaje antes de exponerlo por acá. Un borrador B2B armado desde el chat
// además necesitaría razón social y RUT, que no son datos que uno dicte de
// memoria caminando.
//
// La cotización del dólar NO se expone: es el único parámetro que mueve el
// precio y que el asesor no debería tocar. El markup sí, que es su holgura.

import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { Action, Module, ProposalVariante } from "@prisma/client";
import { z } from "zod";

import { prisma } from "../../../lib/prisma.js";
import {
  computeDraftResumenComercial,
  draftMissingFields,
  draftQualityIssues,
  ensureDraft,
  upsertDraft,
} from "../../../services/proposal/draft.service.js";
import type { DraftDataPublish } from "../../../services/proposal/schemas/draft.schema.js";
import { publishVersion } from "../../../services/proposal/version.service.js";
import { requirePermission, type McpUser } from "../context.js";
import { buildDownloadUrl } from "../descargas.routes.js";
import { hasPermission } from "../../../middleware/authorize.middleware.js";
import { campos, pesos, porcentaje, texto, usd } from "../format.js";

const VARIANTE = ProposalVariante.RESIDENCIAL;

/**
 * Cómo se llama cada campo en una conversación. Traduce los paths que devuelven
 * `draftMissingFields` y `draftQualityIssues`, que son útiles para un formulario
 * pero ilegibles en un chat.
 */
const NOMBRE_CAMPO: Record<string, string> = {
  "cliente.nombre": "el nombre del cliente",
  "cliente.ciudad": "la ciudad",
  "factura.pagaMensualPesos": "cuánto paga de UTE por mes (en pesos)",
  "factura.tarifa": "la tarifa (Simple, Doble o Triple)",
  "factura.suministro": "el suministro (monofásico o trifásico)",
  "factura.potenciaContratadaKw": "la potencia contratada en kW",
  "techo.descripcion": "de qué es el techo",
  "techo.tamanoM2": "los metros cuadrados de techo disponibles",
  "cotizacion.distanciaInstalacionKm": "la distancia hasta la obra en km",
  "cotizacion.cotizacionDolar": "la cotización del dólar",
  "cotizacion.markupPorcentaje": "el markup",
  "cotizacion.plazoEntrega": "el plazo de entrega",
  "sistema.cantidadPaneles": "cuántos paneles lleva",
  "sistema.potenciaPanelW": "la potencia de cada panel en W",
  "sistema.marcaPaneles": "la marca de los paneles",
  "sistema.potenciaInversorKw": "la potencia del inversor en kW",
  "sistema.marcaInversor": "la marca del inversor",
  "sistema.tipoMontaje": "el tipo de montaje",
  fecha: "la fecha de la propuesta",
};

function nombrarCampos(paths: string[]): string {
  return paths.map((p) => NOMBRE_CAMPO[p] ?? p).join("\n- ");
}

/**
 * El resumen que se lee antes de confirmar.
 *
 * `verInterno` lo decide quien llama según el permiso: con él se agrega lo que
 * gana la empresa, que no se le muestra al cliente. El markup en porcentaje va
 * siempre — lo elige el propio asesor, y poder escribirlo sin poder leerlo era
 * una asimetría que obligaba a abrir la aplicación para saber con qué quedó.
 */
function bloqueResumen(
  r: NonNullable<Awaited<ReturnType<typeof computeDraftResumenComercial>>>,
  verInterno: boolean,
) {
  const sistema = campos([
    ["Precio final (IVA incluido)", usd(r.precioFinalConIva)],
    ["Potencia", `${r.potenciaKwp.toFixed(2)} kWp`],
    ["Paneles", `${r.cantidadPaneles} × ${r.potenciaPanelW} W ${r.marcaPaneles}`.trim()],
    ["Inversor", r.marcaInversor],
    ["Precio por watt", `USD ${r.usdPorWatt.toFixed(2)}`],
    ["Markup aplicado", `${r.markupPorcentaje.toFixed(1)}%`],
    ["Plazo de entrega", r.plazoEntrega],
  ]);

  const ahorro = campos([
    ["Ahorro mensual", pesos(r.ahorroMensualPesos)],
    ["Ahorro anual", usd(r.ahorroAnualUsd)],
    ["Porcentaje de ahorro", porcentaje(r.porcentajeAhorro)],
    ["Nueva factura UTE", pesos(r.pagaNuevoUtePesos)],
    ["Retorno de la inversión", `${r.priAnios.toFixed(1)} años`],
  ]);

  const cuotas = campos([
    ["24 cuotas", pesos(r.cuota24m)],
    ["36 cuotas", pesos(r.cuota36m)],
    ["60 cuotas", pesos(r.cuota60m)],
  ]);

  const interno = verInterno
    ? "\n\nINTERNO — no mostrar al cliente\n" +
      campos([
        ["Ganancia de la empresa", usd(r.interno.gananciaUsd)],
        ["Margen sobre la venta", porcentaje(r.interno.margenSobreVenta, 1)],
      ])
    : "";

  return (
    [sistema, `AHORRO Y RETORNO\n${ahorro}`, `FINANCIACIÓN BBVA\n${cuotas}`].join("\n\n") + interno
  );
}

export function registerPropuestaTools(server: McpServer, user: McpUser) {
  server.registerTool(
    "preparar_propuesta",
    {
      title: "Preparar propuesta residencial",
      description:
        "Arma o corrige el borrador de la propuesta residencial de un cliente potencial. " +
        "Se le pasan solo los datos que se conocen; el resto lo completa con los valores " +
        "por defecto del cotizador y lo que ya sabe del cliente. Devuelve qué falta para " +
        "poder emitirla o, si ya está completa, el precio final, el ahorro y las cuotas. " +
        "No emite nada: para eso está publicar_propuesta. " +
        "No sirve para propuestas de empresa, que se arman desde la aplicación.",
      inputSchema: {
        lead_id: z.string().min(1).describe("Identificador del cliente potencial"),
        ciudad: z.string().optional().describe("Ciudad donde se instala"),
        paga_ute_mensual_pesos: z
          .number()
          .positive()
          .optional()
          .describe("Cuánto paga de UTE por mes, EN PESOS"),
        cantidad_paneles: z.number().int().positive().optional(),
        potencia_panel_w: z.number().min(100).optional(),
        marca_paneles: z.string().optional(),
        potencia_inversor_kw: z.number().positive().optional(),
        marca_inversor: z.string().optional(),
        techo_m2: z.number().positive().optional().describe("Metros cuadrados disponibles"),
        techo_descripcion: z.string().optional().describe("De qué es el techo: chapa, losa…"),
        tipo_montaje: z.string().optional(),
        tarifa: z.enum(["Simple", "Doble", "Triple"]).optional(),
        suministro: z.enum(["monofásico", "trifásico"]).optional(),
        potencia_contratada_kw: z.number().min(0).optional(),
        distancia_km: z.number().min(0).optional(),
        plazo_entrega: z.string().optional(),
        markup_porcentaje: z
          .number()
          .min(0)
          .max(100)
          .optional()
          .describe("Margen del asesor. Solo si lo pide explícitamente."),
        notas: z.string().optional(),
      },
    },
    async (args) => {
      await requirePermission(user, Module.VENTAS, Action.EDIT);

      const lead = await prisma.salesLead.findFirst({
        where: { id: args.lead_id, deletedAt: null },
        select: { id: true, clientName: true },
      });
      if (!lead) return texto(`No encontré ningún cliente potencial con el id ${args.lead_id}.`);

      // Trae el borrador completo (lo crea con la precarga si no existía).
      const draft = await ensureDraft(lead.id, user.id, VARIANTE);
      const actual = draft.data as DraftDataPublish;

      // Se arma el objeto entero y no un parche: el esquema del borrador es
      // estricto y un PUT parcial pisaría el resto.
      const data = {
        ...actual,
        cliente: {
          ...actual.cliente,
          ...(args.ciudad !== undefined && { ciudad: args.ciudad }),
        },
        factura: {
          ...actual.factura,
          ...(args.paga_ute_mensual_pesos !== undefined && {
            pagaMensualPesos: args.paga_ute_mensual_pesos,
          }),
          ...(args.tarifa !== undefined && { tarifa: args.tarifa }),
          ...(args.suministro !== undefined && { suministro: args.suministro }),
          ...(args.potencia_contratada_kw !== undefined && {
            potenciaContratadaKw: args.potencia_contratada_kw,
          }),
        },
        techo: {
          ...actual.techo,
          ...(args.techo_descripcion !== undefined && { descripcion: args.techo_descripcion }),
          ...(args.techo_m2 !== undefined && { tamanoM2: args.techo_m2 }),
        },
        cotizacion: {
          ...actual.cotizacion,
          ...(args.distancia_km !== undefined && { distanciaInstalacionKm: args.distancia_km }),
          ...(args.markup_porcentaje !== undefined && {
            markupPorcentaje: args.markup_porcentaje,
          }),
          ...(args.plazo_entrega !== undefined && { plazoEntrega: args.plazo_entrega }),
        },
        sistema: {
          ...actual.sistema,
          ...(args.cantidad_paneles !== undefined && { cantidadPaneles: args.cantidad_paneles }),
          ...(args.potencia_panel_w !== undefined && { potenciaPanelW: args.potencia_panel_w }),
          ...(args.marca_paneles !== undefined && { marcaPaneles: args.marca_paneles }),
          ...(args.potencia_inversor_kw !== undefined && {
            potenciaInversorKw: args.potencia_inversor_kw,
          }),
          ...(args.marca_inversor !== undefined && { marcaInversor: args.marca_inversor }),
          ...(args.tipo_montaje !== undefined && { tipoMontaje: args.tipo_montaje }),
        },
        ...(args.notas !== undefined && { notas: args.notas }),
      };

      await upsertDraft(lead.id, data, user.id, VARIANTE);

      // Falta de campos (schema) + valores que el schema tolera pero producen
      // una propuesta sin sentido.
      const faltantes = draftMissingFields(data) ?? [];
      const flojos = draftQualityIssues(data);
      const pendientes = [...new Set([...faltantes, ...flojos])];

      if (pendientes.length > 0) {
        return texto(
          `Guardé lo que me pasaste para ${lead.clientName}. Para poder emitir la propuesta ` +
            `todavía falta:`,
          `- ${nombrarCampos(pendientes)}`,
          "Pasame esos datos y la dejo lista.",
        );
      }

      const resumen = await computeDraftResumenComercial(lead.id, VARIANTE);
      if (!resumen) {
        return texto(
          "El borrador quedó guardado pero no pude calcular los números. " +
            "Revisalo desde la aplicación.",
        );
      }

      // La ganancia solo la ve quien ya tiene acceso al cálculo interno en la
      // aplicación. El markup en porcentaje se muestra siempre.
      const verInterno = await hasPermission(user.role, Module.VENTAS, Action.DEBUG_CALCULADORA);

      return texto(
        `Propuesta lista para ${lead.clientName}:`,
        bloqueResumen(resumen, verInterno),
        "Si está bien, decime que la emita y genero el PDF.",
      );
    },
  );

  server.registerTool(
    "publicar_propuesta",
    {
      title: "Emitir la propuesta",
      description:
        "Emite la propuesta residencial: genera el PDF definitivo y la registra como una " +
        "versión nueva. USAR SOLO después de que la persona haya visto los números que " +
        "devolvió preparar_propuesta y haya dicho explícitamente que los emita. " +
        "Nunca llamarla por iniciativa propia ni para 'ver cómo queda'.",
      inputSchema: {
        lead_id: z.string().min(1),
        confirmar: z
          .literal(true)
          .describe("Solo true, y solo si la persona confirmó los números que ya vio."),
      },
    },
    async ({ lead_id }) => {
      await requirePermission(user, Module.VENTAS, Action.CREATE);

      const lead = await prisma.salesLead.findFirst({
        where: { id: lead_id, deletedAt: null },
        select: { id: true, clientName: true, stage: true },
      });
      if (!lead) return texto(`No encontré ningún cliente potencial con el id ${lead_id}.`);

      // Se revalida la calidad acá también: entre preparar y publicar puede
      // haber pasado cualquier cosa, incluida una edición desde la aplicación.
      const draft = await ensureDraft(lead.id, user.id, VARIANTE);
      const pendientes = [
        ...new Set([...(draftMissingFields(draft.data) ?? []), ...draftQualityIssues(draft.data)]),
      ];
      if (pendientes.length > 0) {
        return texto(
          `Todavía no puedo emitir la propuesta de ${lead.clientName}. Falta:`,
          `- ${nombrarCampos(pendientes)}`,
        );
      }

      const version = await publishVersion(lead.id, user.id, VARIANTE);
      const enlace = buildDownloadUrl(user.id, "proposal-version", version.id);

      const movio =
        lead.stage === "NUEVO_LEAD"
          ? "\n\nAl emitirla, el cliente pasó solo a la etapa Cotizado y quedó registrada la fecha de envío."
          : "";

      return texto(
        `Emitida la propuesta v${version.versionNumber} de ${lead.clientName}.${movio}`,
        `PDF (el enlace vence en 15 minutos):\n${enlace}`,
      );
    },
  );
}

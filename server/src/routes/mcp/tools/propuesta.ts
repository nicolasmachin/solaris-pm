// Armado y publicación de propuestas comerciales desde el chat, con los dos
// cotizadores: residencial y empresa (B2B). Si no se dice cuál, se usa el del
// tipo de cliente del lead. El B2B pide además razón social y RUT para emitir,
// y suma el desglose de la comisión del asesor, como el panel del cotizador.
//
// La cotización del dólar NO se expone: es el único parámetro que mueve el
// precio y que el asesor no debería tocar. El markup sí, que es su holgura.

import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { Action, Module, ProposalVariante } from "@prisma/client";
import { z } from "zod";

import { prisma } from "../../../lib/prisma.js";
import {
  computeDraftComision,
  computeDraftResumenComercial,
  draftMissingFields,
  draftQualityIssues,
  ensureDraft,
  upsertDraft,
} from "../../../services/proposal/draft.service.js";
import type { DraftDataPublish } from "../../../services/proposal/schemas/draft.schema.js";
import { interpretarMarkup } from "../../../services/proposal/calculator.js";
import {
  describirInversores,
  listaInversoresDistintos,
  sincronizarSistemaInversores,
} from "../../../services/proposal/inversores.js";
import { publishVersion } from "../../../services/proposal/version.service.js";
import { requirePermission, type McpUser } from "../context.js";
import { buildDownloadUrl, nombrePdfPropuesta } from "../descargas.routes.js";
import { hasPermission } from "../../../middleware/authorize.middleware.js";
import { campos, pesos, porcentaje, texto, usd } from "../format.js";
import { aplicarEmpresa, elegirVariante, vinoAlgoDeEmpresa } from "./propuesta.logic.js";

const tipoSchema = z
  .enum(["residencial", "empresa"])
  .optional()
  .describe(
    "Qué cotizador: residencial o empresa (B2B). Si no se pasa, el del tipo de cliente del lead. " +
      "Cada uno tiene su propio borrador.",
  );

const nombreCotizador = (v: ProposalVariante) => (v === ProposalVariante.EMPRESA ? "empresa (B2B)" : "residencial");

/**
 * Cómo se llama cada campo en una conversación. Traduce los paths que devuelven
 * `draftMissingFields` y `draftQualityIssues`, que son útiles para un formulario
 * pero ilegibles en un chat.
 */
const NOMBRE_CAMPO: Record<string, string> = {
  "cliente.nombre": "el nombre del cliente",
  "cliente.ciudad": "la ciudad",
  "empresa.razonSocial": "la razón social de la empresa",
  "empresa.rut": "el RUT de la empresa",
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
  "sistema.inversores":
    "los inversores: marca y potencia de cada uno, y que los paneles asignados sumen los del sistema",
  "sistema.tipoMontaje": "el tipo de montaje",
  fecha: "la fecha de la propuesta",
};

function nombrarCampos(paths: string[]): string {
  // Los errores de un inversor puntual llegan como "sistema.inversores.1.marca":
  // en el chat alcanza con decir que hay que revisar los inversores.
  const normalizados = paths.map((p) => (p.startsWith("sistema.inversores") ? "sistema.inversores" : p));
  return [...new Set(normalizados)].map((p) => NOMBRE_CAMPO[p] ?? p).join("\n- ");
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

/**
 * La comisión del asesor en el B2B, igual que el panel del cotizador: base sobre
 * la venta más un excedente si el markup supera el de referencia. La ve el
 * propio asesor (mismo permiso que el panel), no va al cliente.
 */
// Los porcentajes de comisión del B2B vienen como fracción (0.04 = 4%); el
// markup de referencia, en cambio, ya viene en porcentaje. Igual que el panel.
const pctFraccion = (f: number) => `${(f * 100).toLocaleString("es-UY", { maximumFractionDigits: 2 })}%`;

function bloqueComisionB2B(c: NonNullable<Awaited<ReturnType<typeof computeDraftComision>>>): string {
  if (c.comisionFijadaAMano) {
    return "COMISIÓN DEL ASESOR — no mostrar al cliente\n" + campos([["Comisión (fijada a mano)", usd(c.comisionTotalUsd)]]);
  }
  return (
    "COMISIÓN DEL ASESOR — no mostrar al cliente\n" +
    campos([
      ["Base", `${usd(c.comisionBaseUsd)} (${pctFraccion(c.comisionBasePorcentaje)} de la venta sin IVA)`],
      [
        "Excedente",
        `${usd(c.comisionExcedenteUsd)} (${pctFraccion(c.comisionExcedentePorcentaje)} de lo que el markup pasa del ${c.markupReferenciaPorcentaje}% de referencia)`,
      ],
      ["Total", `${usd(c.comisionTotalUsd)} (${pctFraccion(c.comisionPctEfectivo)} efectivo)`],
      ["Con el markup de referencia sería", usd(c.comisionEnReferenciaUsd)],
    ])
  );
}

/**
 * Lo que ya está cargado en el borrador.
 *
 * Se muestra siempre, incluso cuando falta algo: hasta acá la herramienta solo
 * decía qué faltaba, así que no había forma de auditar lo cargado sin abrir la
 * aplicación — que es justo lo que el conector viene a evitar.
 */
function bloqueCargado(d: DraftDataPublish): string {
  const m2 = d.techo?.tamanoM2;
  return (
    "CARGADO EN EL BORRADOR\n" +
    campos([
      ["Cliente", d.cliente?.nombre],
      ["Ciudad", d.cliente?.ciudad || "—"],
      ...(d.variante === "EMPRESA"
        ? ([
            ["Razón social", d.empresa?.razonSocial || "—"],
            ["RUT", d.empresa?.rut || "—"],
            ["Contacto", [d.empresa?.contactoNombre, d.empresa?.contactoCargo].filter(Boolean).join(", ") || "—"],
            ["Saludo de la carta", d.cliente?.dirigidoA || "—"],
          ] as [string, string][])
        : []),
      ["Tipo de techo", d.techo?.descripcion || "—"],
      ["Superficie de techo", m2 && m2 > 0 ? `${m2} m²` : "—"],
      ["Tipo de montaje", d.sistema?.tipoMontaje || "—"],
      [
        "Paneles",
        d.sistema?.cantidadPaneles
          ? `${d.sistema.cantidadPaneles} × ${d.sistema.potenciaPanelW ?? "?"} W ${d.sistema.marcaPaneles ?? ""}`.trim()
          : "—",
      ],
      [
        "Inversor",
        listaInversoresDistintos(d.sistema)
          ? describirInversores(listaInversoresDistintos(d.sistema)!)
          : d.sistema?.potenciaInversorKw
          ? `${(d.sistema.cantidadInversores ?? 1) > 1 ? `${d.sistema.cantidadInversores} × ` : ""}${d.sistema.potenciaInversorKw} kW ${d.sistema.marcaInversor ?? ""}`.trim()
          : (d.sistema?.marcaInversor ?? "—"),
      ],
      ["Suministro", d.factura?.suministro || "—"],
      [
        "Potencia contratada",
        d.factura?.potenciaContratadaKw ? `${d.factura.potenciaContratadaKw} kW` : "—",
      ],
      ["Tarifa", d.factura?.tarifa || "—"],
      ["Factura mensual", d.factura?.pagaMensualPesos ? pesos(d.factura.pagaMensualPesos) : "—"],
      ["Markup", `${(interpretarMarkup(d.cotizacion?.markupPorcentaje ?? 0) * 100).toFixed(1)}%`],
      ["Plazo de entrega", d.cotizacion?.plazoEntrega || "—"],
      [
        "Ítems adicionales",
        d.itemsAdicionales?.length
          ? d.itemsAdicionales.map((i) => `${i.nombre} (${usd(i.precioSinIvaUsd)})`).join(", ")
          : "—",
      ],
      ["Notas", d.notas || "—"],
      ...(d.costos?.comisionVentas !== undefined
        ? [["Comisión del asesor (fijada a mano)", usd(d.costos.comisionVentas)] as [string, string]]
        : []),
      ...(d.costos?.comisionBbva !== undefined
        ? [["Comisión BBVA (fijada a mano)", usd(d.costos.comisionBbva)] as [string, string]]
        : []),
    ])
  );
}

export function registerPropuestaTools(server: McpServer, user: McpUser) {
  server.registerTool(
    "preparar_propuesta",
    {
      title: "Preparar propuesta (residencial o empresa)",
      description:
        "Consulta o corrige el borrador de la propuesta de un cliente potencial, con el " +
        "cotizador residencial o el de empresa (B2B). Llamada solo con el lead_id NO escribe " +
        "nada: devuelve el estado del borrador, qué hay cargado y qué falta. Con datos, los " +
        "guarda. El resto lo completa con los valores por defecto del cotizador y lo que ya " +
        "sabe del cliente. En empresa, para emitir hacen falta la razón social y el RUT; el " +
        "contacto es opcional pero arma el saludo de la carta. No emite nada: para eso está " +
        "publicar_propuesta.",
      inputSchema: {
        lead_id: z.string().min(1).describe("Identificador del cliente potencial"),
        tipo: tipoSchema,
        razon_social: z.string().optional().describe("Solo empresa: razón social a la que va la propuesta"),
        rut: z.string().optional().describe("Solo empresa: RUT de la empresa"),
        contacto_nombre: z
          .string()
          .optional()
          .describe("Solo empresa: quién recibe la propuesta. La carta lo saluda a él/ella."),
        contacto_cargo: z.string().optional().describe("Solo empresa: cargo del contacto"),
        ciudad: z.string().optional().describe("Ciudad donde se instala"),
        paga_ute_mensual_pesos: z
          .number()
          .positive()
          .optional()
          .describe("Cuánto paga de UTE por mes, EN PESOS"),
        cantidad_paneles: z.number().int().positive().optional(),
        potencia_panel_w: z.number().min(100).optional(),
        marca_paneles: z.string().optional(),
        potencia_inversor_kw: z
          .number()
          .positive()
          .optional()
          .describe("Potencia de UN inversor en kW, no la suma de todos"),
        cantidad_inversores: z
          .number()
          .int()
          .positive()
          .optional()
          .describe(
            "Cuántos inversores iguales lleva. Más de uno sirve para cotizar varias " +
              "instalaciones juntas: multiplica el costo del inversor y el de la " +
              "instalación eléctrica. Los paneles se cargan sumados en cantidad_paneles.",
          ),
        marca_inversor: z.string().optional(),
        inversores: z
          .array(
            z.object({
              marca: z.string().min(1),
              potencia_kw: z.number().positive(),
              paneles: z
                .number()
                .int()
                .min(0)
                .optional()
                .describe("Paneles de este inversor. Si no se pasa, se reparten solos por potencia."),
            }),
          )
          .optional()
          .describe(
            "Inversores DISTINTOS (marca y potencia propias), por ejemplo un Growatt de 8 kW y " +
              "un Huawei de 6 kW. Con dos o más reemplaza a potencia_inversor_kw, " +
              "cantidad_inversores y marca_inversor, y cada inversor se cotiza por separado. " +
              "Una lista vacía vuelve a inversores iguales.",
          ),
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
        comision_vendedor_usd: z
          .number()
          .min(0)
          .nullable()
          .optional()
          .describe(
            "Comisión del asesor en USD sin IVA, solo para esta cotización. 0 = la venta no " +
              "lleva comisión. null = volver al cálculo normal. Solo si lo pide explícitamente.",
          ),
        comision_bbva_usd: z
          .number()
          .min(0)
          .nullable()
          .optional()
          .describe(
            "Comisión del BBVA en USD sin IVA, solo para esta cotización. 0 = no la lleva " +
              "(por ejemplo, el cliente no paga con el BBVA). null = volver al cálculo normal. " +
              "Solo si lo pide explícitamente.",
          ),
      },
    },
    async (args) => {
      await requirePermission(user, Module.VENTAS, Action.EDIT);

      const lead = await prisma.salesLead.findFirst({
        where: { id: args.lead_id, deletedAt: null },
        select: { id: true, clientName: true, tipoCliente: true },
      });
      if (!lead) return texto(`No encontré ningún cliente potencial con el id ${args.lead_id}.`);
      const VARIANTE = elegirVariante(args.tipo, lead.tipoCliente);
      const esEmpresa = VARIANTE === ProposalVariante.EMPRESA;
      const avisoEmpresa =
        !esEmpresa && vinoAlgoDeEmpresa(args)
          ? "Ojo: los datos de empresa (razón social, RUT, contacto) solo se usan en el cotizador de empresa; en esta propuesta residencial los ignoré."
          : null;

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
          ...(args.cantidad_inversores !== undefined && {
            cantidadInversores: args.cantidad_inversores,
          }),
          ...(args.marca_inversor !== undefined && { marcaInversor: args.marca_inversor }),
          ...(args.tipo_montaje !== undefined && { tipoMontaje: args.tipo_montaje }),
        },
        ...(args.notas !== undefined && { notas: args.notas }),
      };
      // Comisiones fijadas a mano: viven en los ajustes del costeo, igual que
      // cuando se pisan en la aplicación. null borra el ajuste (vuelve al
      // cálculo normal) y, si no queda ningún ajuste, se saca el objeto entero.
      if (args.comision_vendedor_usd !== undefined || args.comision_bbva_usd !== undefined) {
        const costos: NonNullable<DraftDataPublish["costos"]> = { ...(actual.costos ?? {}) };
        for (const [clave, valor] of [
          ["comisionVentas", args.comision_vendedor_usd],
          ["comisionBbva", args.comision_bbva_usd],
        ] as const) {
          if (valor === undefined) continue;
          if (valor === null) delete costos[clave];
          else costos[clave] = valor;
        }
        if (Object.keys(costos).length > 0) data.costos = costos;
        else delete data.costos;
      }
      // Inversores. Una lista de 2+ pasa a inversores distintos; una lista vacía
      // o de uno vuelve a inversores iguales (con los datos del primero, si
      // vino). Si no vino la lista pero sí algún dato de los inversores
      // iguales, se sale del modo distintos: esos datos describen inversores
      // todos iguales y mezclarlos con una lista daría una propuesta ambigua.
      if (args.inversores !== undefined) {
        const lista = args.inversores.map((i) => ({
          marca: i.marca,
          potenciaKw: i.potencia_kw,
          ...(i.paneles !== undefined && { paneles: i.paneles }),
        }));
        if (lista.length >= 2) {
          data.sistema = { ...data.sistema, inversores: lista };
        } else {
          const { inversores: _fuera, ...resto } = data.sistema as typeof data.sistema & {
            inversores?: unknown;
          };
          data.sistema = {
            ...resto,
            cantidadInversores: 1,
            ...(lista[0] && { marcaInversor: lista[0].marca, potenciaInversorKw: lista[0].potenciaKw }),
          };
        }
      } else if (
        listaInversoresDistintos(data.sistema) &&
        (args.potencia_inversor_kw !== undefined ||
          args.cantidad_inversores !== undefined ||
          args.marca_inversor !== undefined)
      ) {
        const { inversores: _fuera, ...resto } = data.sistema as typeof data.sistema & {
          inversores?: unknown;
        };
        data.sistema = resto;
      }
      // Lo mismo que hace upsertDraft al guardar: con la lista, cantidad /
      // potencia / marca clásicas se derivan de ella. Se aplica también acá para
      // que el "cargado" y los faltantes que se devuelven sean los guardados.
      data.sistema = sincronizarSistemaInversores(data.sistema);
      // Datos de la empresa (solo B2B) y saludo de la carta.
      Object.assign(data, aplicarEmpresa(data as DraftDataPublish, args));

      // Solo se escribe si algo cambió de verdad. Antes se guardaba siempre y
      // la respuesta decía "guardé lo que me pasaste" aunque no hubiera venido
      // ningún dato: sugería una escritura que no había ocurrido.
      const huboCambios = JSON.stringify(data) !== JSON.stringify(actual);
      if (huboCambios) await upsertDraft(lead.id, data, user.id, VARIANTE);

      // Falta de campos (schema) + valores que el schema tolera pero producen
      // una propuesta sin sentido.
      const faltantes = draftMissingFields(data) ?? [];
      const flojos = draftQualityIssues(data);
      const pendientes = [...new Set([...faltantes, ...flojos])];

      const cotizador = `Cotizador ${nombreCotizador(VARIANTE)}.`;
      if (pendientes.length > 0) {
        return texto(
          huboCambios
            ? `Guardé lo que me pasaste para ${lead.clientName}. ${cotizador}`
            : `Borrador de ${lead.clientName} (no cambié nada). ${cotizador}`,
          ...(avisoEmpresa ? [avisoEmpresa] : []),
          bloqueCargado(data as DraftDataPublish),
          "FALTA PARA EMITIR\n- " + nombrarCampos(pendientes),
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
      const comision = esEmpresa ? await computeDraftComision(lead.id, VARIANTE) : null;

      return texto(
        huboCambios
          ? `Propuesta lista para ${lead.clientName}. ${cotizador}`
          : `Borrador de ${lead.clientName} (no cambié nada), listo para emitir. ${cotizador}`,
        ...(avisoEmpresa ? [avisoEmpresa] : []),
        bloqueCargado(data as DraftDataPublish),
        bloqueResumen(resumen, verInterno),
        ...(comision ? [bloqueComisionB2B(comision)] : []),
        "Si está bien, decime que la emita y genero el PDF.",
      );
    },
  );

  server.registerTool(
    "publicar_propuesta",
    {
      title: "Emitir la propuesta",
      description:
        "Emite la propuesta (residencial o empresa, la misma que se preparó): genera el PDF definitivo y la registra como una " +
        "versión nueva. USAR SOLO después de que la persona haya visto los números que " +
        "devolvió preparar_propuesta y haya dicho explícitamente que los emita. " +
        "Nunca llamarla por iniciativa propia ni para 'ver cómo queda'.",
      inputSchema: {
        lead_id: z.string().min(1),
        tipo: tipoSchema,
        confirmar: z
          .literal(true)
          .describe("Solo true, y solo si la persona confirmó los números que ya vio."),
      },
    },
    async ({ lead_id, tipo }) => {
      await requirePermission(user, Module.VENTAS, Action.CREATE);

      const lead = await prisma.salesLead.findFirst({
        where: { id: lead_id, deletedAt: null },
        select: { id: true, clientName: true, stage: true, tipoCliente: true },
      });
      if (!lead) return texto(`No encontré ningún cliente potencial con el id ${lead_id}.`);
      const VARIANTE = elegirVariante(tipo, lead.tipoCliente);

      // Se revalida la calidad acá también: entre preparar y publicar puede
      // haber pasado cualquier cosa, incluida una edición desde la aplicación.
      const draft = await ensureDraft(lead.id, user.id, VARIANTE);
      const pendientes = [
        ...new Set([...(draftMissingFields(draft.data) ?? []), ...draftQualityIssues(draft.data)]),
      ];
      if (pendientes.length > 0) {
        return texto(
          `Todavía no puedo emitir la propuesta ${nombreCotizador(VARIANTE)} de ${lead.clientName}. Falta:`,
          `- ${nombrarCampos(pendientes)}`,
        );
      }

      const version = await publishVersion(lead.id, user.id, VARIANTE);
      const enlace = buildDownloadUrl(user.id, "proposal-version", version.id, nombrePdfPropuesta(version, lead.clientName));

      const movio =
        lead.stage === "NUEVO_LEAD"
          ? "\n\nAl emitirla, el cliente pasó solo a la etapa Cotizado y quedó registrada la fecha de envío."
          : "";

      return texto(
        `Emitida la propuesta ${nombreCotizador(VARIANTE)} v${version.versionNumber} de ${lead.clientName}.${movio}`,
        `PDF (el enlace vence en 15 minutos):\n${enlace}`,
      );
    },
  );
}

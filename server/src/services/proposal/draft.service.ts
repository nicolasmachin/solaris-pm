// Service del borrador de propuesta v2. Hay UNO POR LEAD Y VARIANTE: el
// cotizador residencial y el B2B son dos botones distintos con dos borradores
// distintos, así que todas las búsquedas van por el par (leadId, variante).
// Ver FASE_E_SPEC.md.

import { Prisma, ProposalVariante } from "@prisma/client";

import { prisma } from "../../lib/prisma.js";
import { AppError, badRequest, notFound } from "../../utils/errors.js";
import { buildCalcDebugRows, type CalcDebugRow } from "./calculator-labels.js";
import { calculate } from "./calculator.js";
import { buildInitialDraftData, mergeDraftData } from "./initial-draft.js";
import { resolveDefaults } from "./resolveDefaults.js";
import { draftDataPublishSchema, draftDataStorageSchema } from "./schemas/draft.schema.js";

export function getDraft(leadId: string, variante: ProposalVariante = ProposalVariante.RESIDENCIAL) {
  return prisma.proposalV2Draft.findUnique({ where: { leadId_variante: { leadId, variante } } });
}

/**
 * Devuelve el borrador del lead para esa variante, creándolo con la precarga si
 * todavía no existe. Idempotente: llamarlo dos veces no pisa lo cargado.
 *
 * Existe porque hasta acá la precarga vivía en el frontend y el borrador se
 * creaba de rebote con el primer autosave. Eso dejaba afuera a cualquier otro
 * consumidor —el conector MCP, entre otros— y obligaba a duplicar la lógica de
 * qué valor trae cada campo.
 */
export async function ensureDraft(
  leadId: string,
  userId: string,
  variante: ProposalVariante = ProposalVariante.RESIDENCIAL,
) {
  const lead = await prisma.salesLead.findFirst({
    where: { id: leadId, deletedAt: null },
    select: { clientName: true, roofType: true, notes: true },
  });
  if (!lead) throw notFound("LEAD_NOT_FOUND", "El lead no existe.");

  const defaultsRow = await prisma.proposalDefaults.findUnique({ where: { id: "singleton" } });
  if (!defaultsRow) {
    throw badRequest("PROPOSAL_DEFAULTS_NOT_SEEDED", "Los defaults de propuestas no están cargados.");
  }

  const base = buildInitialDraftData(defaultsRow.data, lead, variante);
  const existing = await getDraft(leadId, variante);

  if (existing) {
    // Se devuelve completo, no crudo: lo guardado puede ser parcial (el
    // autosave usa el schema lenient) y quien lo lee necesita el objeto entero.
    // La fila no se toca.
    return { ...existing, data: mergeDraftData(base, existing.data) };
  }

  // upsert y no create: entre el findUnique de arriba y este insert puede haber
  // entrado otro (dos pestañas, o el autosave del constructor). El unique
  // compuesto lo resolvería con un error; así gana el que llegó primero y el
  // segundo se lo encuentra hecho.
  const created = await prisma.proposalV2Draft.upsert({
    where: { leadId_variante: { leadId, variante } },
    create: {
      leadId,
      variante,
      data: base as unknown as Prisma.InputJsonValue,
      createdById: userId,
      updatedById: userId,
    },
    update: {},
  });

  return { ...created, data: mergeDraftData(base, created.data) };
}

// Lista de campos que faltan para que el draft valide en modo publicación
// (strict). Devuelve null si valida. Los paths se serializan tipo "cliente.ciudad".
export function draftMissingFields(rawData: unknown): string[] | null {
  const parsed = draftDataPublishSchema.safeParse(rawData);
  if (parsed.success) return null;
  const seen = new Set<string>();
  for (const issue of parsed.error.issues) {
    seen.add(issue.path.join(".") || "(raíz)");
  }
  return [...seen];
}

// Corre la calculadora contra el borrador y devuelve las filas ya armadas para
// el drawer de debug (label + descripción + unidad + valor + orden). Valida el
// draft con el schema de publicación (strict); si falta algo, 400 con `missing`.
export async function computeDraftCalcRows(
  leadId: string,
  variante: ProposalVariante = ProposalVariante.RESIDENCIAL,
): Promise<CalcDebugRow[]> {
  const draft = await getDraft(leadId, variante);
  if (!draft) throw notFound("DRAFT_NOT_FOUND", "El lead no tiene borrador.");

  const parsed = draftDataPublishSchema.safeParse(draft.data);
  if (!parsed.success) {
    throw new AppError(400, "PROPOSAL_DRAFT_INVALID", "Faltan campos obligatorios", {
      missing: draftMissingFields(draft.data),
    });
  }

  const defaultsRow = await prisma.proposalDefaults.findUnique({ where: { id: "singleton" } });
  if (!defaultsRow) {
    throw badRequest("PROPOSAL_DEFAULTS_NOT_SEEDED", "Los defaults de propuestas no están cargados.");
  }
  const defaults = resolveDefaults(defaultsRow.data);
  const calc = calculate(parsed.data, defaults);
  return buildCalcDebugRows(calc);
}

/**
 * Crea el borrador si no existe, lo actualiza si existe (uno por lead). Valida
 * `data` contra draftDataStorageSchema (lenient) antes de escribir — permite
 * borradores a medio llenar (autosave); tira ZodError solo si el tipo no valida
 * (el route lo mapea a 400). `createdById` se fija en la creación y no se pisa
 * en updates; `updatedById` refleja siempre el último editor.
 */
export async function upsertDraft(
  leadId: string,
  data: unknown,
  userId: string,
  variante: ProposalVariante = ProposalVariante.RESIDENCIAL,
) {
  const parsed = draftDataStorageSchema.parse(data);
  // La variante de la fila manda sobre la que venga en el body: el borrador es
  // del cotizador desde el que se está escribiendo, y así un body sin variante
  // (o con la otra) no puede reetiquetar el borrador equivocado.
  const dataJson = { ...parsed, variante } as unknown as Prisma.InputJsonValue;

  return prisma.proposalV2Draft.upsert({
    where: { leadId_variante: { leadId, variante } },
    create: { leadId, variante, data: dataJson, createdById: userId, updatedById: userId },
    update: { data: dataJson, updatedById: userId },
  });
}

/**
 * Problemas de calidad que el schema no atrapa.
 *
 * `draftDataPublishSchema` acepta `0` en la factura, en los m² de techo y en la
 * potencia del inversor, porque hay borradores legítimos a medio llenar. Pero
 * publicar con esos ceros produce una propuesta sin sentido: con
 * `pagaMensualPesos = 0` el ahorro da infinito.
 *
 * Quien arma la propuesta mirando el formulario ve el disparate; quien la dicta
 * por chat, no. Por eso este chequeo extra, que devuelve los campos en el mismo
 * formato de paths que `draftMissingFields`.
 */
export function draftQualityIssues(rawData: unknown): string[] {
  // Se lee el objeto crudo en vez de exigir que el schema valide primero: si
  // dependiera del parse, quien completa el borrador se enteraría de estos tres
  // campos recién en una segunda vuelta, después de resolver los obligatorios.
  // Preguntar todo junto es la diferencia entre una conversación y un
  // interrogatorio.
  if (typeof rawData !== "object" || rawData === null) return [];
  const d = rawData as Record<string, Record<string, unknown> | undefined>;

  const positivo = (grupo: string, campo: string): boolean => {
    const v = d[grupo]?.[campo];
    return typeof v === "number" && v > 0;
  };

  const issues: string[] = [];
  if (!positivo("factura", "pagaMensualPesos")) issues.push("factura.pagaMensualPesos");
  if (!positivo("techo", "tamanoM2")) issues.push("techo.tamanoM2");
  if (!positivo("sistema", "potenciaInversorKw")) issues.push("sistema.potenciaInversorKw");

  return issues;
}

/** Los números comerciales del borrador: lo que se le puede mostrar al cliente. */
export interface ResumenComercial {
  precioFinalConIva: number;
  potenciaKwp: number;
  cantidadPaneles: number;
  potenciaPanelW: number;
  marcaPaneles: string;
  marcaInversor: string;
  usdPorWatt: number;
  plazoEntrega: string;
  ahorroMensualPesos: number;
  ahorroAnualUsd: number;
  porcentajeAhorro: number;
  pagaNuevoUtePesos: number;
  priAnios: number;
  cuota24m: number;
  cuota36m: number;
  cuota60m: number;
}

/**
 * Corre la calculadora sobre el borrador y devuelve SOLO los campos
 * comerciales. Deliberadamente deja afuera costos, markup, comisiones y margen:
 * es el subconjunto que se puede leer en voz alta frente a un cliente.
 *
 * Devuelve null si el borrador todavía no valida — quien llama ya sabe qué
 * falta por `draftMissingFields`.
 */
export async function computeDraftResumenComercial(
  leadId: string,
  variante: ProposalVariante = ProposalVariante.RESIDENCIAL,
): Promise<ResumenComercial | null> {
  const draft = await getDraft(leadId, variante);
  if (!draft) return null;

  const parsed = draftDataPublishSchema.safeParse(draft.data);
  if (!parsed.success) return null;

  const defaultsRow = await prisma.proposalDefaults.findUnique({ where: { id: "singleton" } });
  if (!defaultsRow) return null;

  const calc = calculate(parsed.data, resolveDefaults(defaultsRow.data));

  return {
    precioFinalConIva: calc.totalFinalConIva,
    potenciaKwp: calc.potenciaTotalKwp,
    cantidadPaneles: parsed.data.sistema.cantidadPaneles,
    potenciaPanelW: parsed.data.sistema.potenciaPanelW,
    marcaPaneles: parsed.data.sistema.marcaPaneles,
    marcaInversor: parsed.data.sistema.marcaInversor,
    usdPorWatt: calc.usdPorWatt,
    plazoEntrega: parsed.data.cotizacion.plazoEntrega,
    ahorroMensualPesos: calc.ahorroMensualPesos,
    ahorroAnualUsd: calc.ahorroAnualUsd,
    porcentajeAhorro: calc.porcentajeAhorro,
    pagaNuevoUtePesos: calc.pagaNuevoUtePesos,
    priAnios: calc.priAnios,
    cuota24m: calc.cuota24m,
    cuota36m: calc.cuota36m,
    cuota60m: calc.cuota60m,
  };
}

/**
 * Desglose de la comisión del asesor para el borrador, tal como lo muestra el
 * explicativo del cotizador B2B. Es un subconjunto deliberado del cálculo: los
 * parámetros vigentes y las cuatro cifras de la comisión, más cuánto cobraría
 * la misma propuesta cotizada al markup de referencia (que es la comparación
 * que hace entendible el esquema).
 *
 * Va aparte de computeDraftCalcRows porque ese endpoint es admin-only: el
 * asesor tiene que poder ver su propia comisión sin acceso al desglose de
 * costos de la empresa.
 *
 * Devuelve null si el borrador todavía no valida (falta cargar datos): el panel
 * simplemente no se muestra, sin error.
 */
export async function computeDraftComision(
  leadId: string,
  variante: ProposalVariante = ProposalVariante.RESIDENCIAL,
): Promise<{
  variante: ProposalVariante;
  markupPorcentaje: number;
  markupReferenciaPorcentaje: number;
  comisionBasePorcentaje: number;
  comisionExcedentePorcentaje: number;
  markupExcedenteUsd: number;
  comisionBaseUsd: number;
  comisionExcedenteUsd: number;
  comisionTotalUsd: number;
  comisionPctEfectivo: number;
  comisionEnReferenciaUsd: number;
} | null> {
  const draft = await getDraft(leadId, variante);
  if (!draft) return null;

  const parsed = draftDataPublishSchema.safeParse(draft.data);
  if (!parsed.success) return null;

  const defaultsRow = await prisma.proposalDefaults.findUnique({ where: { id: "singleton" } });
  if (!defaultsRow) return null;
  const defaults = resolveDefaults(defaultsRow.data);

  const calc = calculate(parsed.data, defaults);
  // La misma propuesta cotizada al markup de referencia: es el "contra qué"
  // del incentivo, y se calcula con el mismo motor para que no se despegue.
  const enReferencia = calculate(
    {
      ...parsed.data,
      cotizacion: {
        ...parsed.data.cotizacion,
        markupPorcentaje: defaults.b2bMarkupReferenciaPorcentaje,
      },
    },
    defaults,
  );

  return {
    variante,
    markupPorcentaje: parsed.data.cotizacion.markupPorcentaje,
    markupReferenciaPorcentaje: defaults.b2bMarkupReferenciaPorcentaje,
    comisionBasePorcentaje: defaults.b2bComisionBasePorcentaje,
    comisionExcedentePorcentaje: defaults.b2bComisionExcedentePorcentaje,
    markupExcedenteUsd: calc.markupExcedenteUsdSinIva,
    comisionBaseUsd: calc.comisionVentasBaseUsdSinIva,
    comisionExcedenteUsd: calc.comisionVentasExcedenteUsdSinIva,
    comisionTotalUsd: calc.comisionVentasUsdSinIva,
    comisionPctEfectivo: calc.comisionVentasPctEfectivo,
    comisionEnReferenciaUsd: enReferencia.comisionVentasUsdSinIva,
  };
}

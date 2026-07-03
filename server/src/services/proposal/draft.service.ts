// Service del borrador de propuesta v2 (uno por lead). Ver FASE_E_SPEC.md.

import { Prisma } from "@prisma/client";

import { prisma } from "../../lib/prisma.js";
import { AppError, badRequest, notFound } from "../../utils/errors.js";
import { buildCalcDebugRows, type CalcDebugRow } from "./calculator-labels.js";
import { calculate } from "./calculator.js";
import { resolveDefaults } from "./resolveDefaults.js";
import { draftDataPublishSchema, draftDataStorageSchema } from "./schemas/draft.schema.js";

export function getDraft(leadId: string) {
  return prisma.proposalV2Draft.findUnique({ where: { leadId } });
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
export async function computeDraftCalcRows(leadId: string): Promise<CalcDebugRow[]> {
  const draft = await prisma.proposalV2Draft.findUnique({ where: { leadId } });
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
export async function upsertDraft(leadId: string, data: unknown, userId: string) {
  const parsed = draftDataStorageSchema.parse(data);
  const dataJson = parsed as unknown as Prisma.InputJsonValue;

  return prisma.proposalV2Draft.upsert({
    where: { leadId },
    create: { leadId, data: dataJson, createdById: userId, updatedById: userId },
    update: { data: dataJson, updatedById: userId },
  });
}

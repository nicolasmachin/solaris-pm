// Service del borrador de propuesta v2 (uno por lead). Ver FASE_E_SPEC.md.

import { Prisma } from "@prisma/client";

import { prisma } from "../../lib/prisma.js";
import { draftDataSchema } from "./schemas/draft.schema.js";

export function getDraft(leadId: string) {
  return prisma.proposalV2Draft.findUnique({ where: { leadId } });
}

/**
 * Crea el borrador si no existe, lo actualiza si existe (uno por lead). Valida
 * `data` contra draftDataSchema antes de escribir — tira ZodError si no valida
 * (el route lo mapea a 400). `createdById` se fija en la creación y no se pisa
 * en updates; `updatedById` refleja siempre el último editor.
 */
export async function upsertDraft(leadId: string, data: unknown, userId: string) {
  const parsed = draftDataSchema.parse(data);
  const dataJson = parsed as unknown as Prisma.InputJsonValue;

  return prisma.proposalV2Draft.upsert({
    where: { leadId },
    create: { leadId, data: dataJson, createdById: userId, updatedById: userId },
    update: { data: dataJson, updatedById: userId },
  });
}

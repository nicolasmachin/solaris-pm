// Service del borrador de proforma (uno por proyecto). Mismo patrón que el draft
// de contrato.

import { Prisma } from "@prisma/client";

import { prisma } from "../../lib/prisma.js";
import { proformaDataPublishSchema, proformaDataStorageSchema } from "./schemas/proforma.schema.js";

export function getDraft(projectId: string) {
  return prisma.proformaDraft.findUnique({ where: { projectId } });
}

// Campos que faltan para publicar (strict). null si valida.
export function proformaMissingFields(rawData: unknown): string[] | null {
  const parsed = proformaDataPublishSchema.safeParse(rawData);
  if (parsed.success) return null;
  const seen = new Set<string>();
  for (const issue of parsed.error.issues) {
    seen.add(issue.path.join(".") || "(raíz)");
  }
  return [...seen];
}

export async function upsertDraft(projectId: string, data: unknown, userId: string) {
  const parsed = proformaDataStorageSchema.parse(data);
  const dataJson = parsed as unknown as Prisma.InputJsonValue;

  return prisma.proformaDraft.upsert({
    where: { projectId },
    create: { projectId, data: dataJson, createdById: userId, updatedById: userId },
    update: { data: dataJson, updatedById: userId },
  });
}

// Service del borrador de contrato (uno por proyecto). Mismo patrón que el draft
// de propuestas v2.

import { Prisma } from "@prisma/client";

import { prisma } from "../../lib/prisma.js";
import { contractDataPublishSchema, contractDataStorageSchema } from "./schemas/contract.schema.js";

export function getDraft(projectId: string) {
  return prisma.contractDraft.findUnique({ where: { projectId } });
}

// Campos que faltan para que el borrador valide en modo publicación (strict).
// Devuelve null si valida. Paths serializados tipo "cliente.documento".
export function contractMissingFields(rawData: unknown): string[] | null {
  const parsed = contractDataPublishSchema.safeParse(rawData);
  if (parsed.success) return null;
  const seen = new Set<string>();
  for (const issue of parsed.error.issues) {
    seen.add(issue.path.join(".") || "(raíz)");
  }
  return [...seen];
}

// Crea o actualiza el borrador (uno por proyecto). Valida `data` contra el schema
// lenient (permite parciales para el autosave). `createdById` sólo en create.
export async function upsertDraft(projectId: string, data: unknown, userId: string) {
  const parsed = contractDataStorageSchema.parse(data);
  const dataJson = parsed as unknown as Prisma.InputJsonValue;

  return prisma.contractDraft.upsert({
    where: { projectId },
    create: { projectId, data: dataJson, createdById: userId, updatedById: userId },
    update: { data: dataJson, updatedById: userId },
  });
}

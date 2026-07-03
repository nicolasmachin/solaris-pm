/**
 * Grant idempotente: migra `markupPorcentajeDefault` del singleton de decimal
 * (0.2) a porcentaje (20). Ver FASE_G_SPEC.md §4.1.4.
 *
 * Correr (local / prod):
 *   docker compose exec server npx tsx prisma/scripts/grant-markup-porcentaje.ts
 *
 * Detección: si el valor actual es ≤ 1 se asume decimal y se multiplica por 100.
 * Si es > 1 se asume ya migrado y NO se toca. No toca snapshots publicados
 * (inmutables): la calculadora los interpreta por magnitud.
 */

import { PrismaClient, Prisma } from "@prisma/client";

const prisma = new PrismaClient();

const KEY = "markupPorcentajeDefault";

async function main() {
  const existing = await prisma.proposalDefaults.findUnique({ where: { id: "singleton" } });
  if (!existing) {
    throw new Error("No existe el singleton ProposalDefaults. Corré seed-proposal-defaults primero.");
  }

  const data = (typeof existing.data === "object" && existing.data !== null
    ? { ...(existing.data as Record<string, unknown>) }
    : {}) as Record<string, unknown>;

  const entry = data[KEY];
  if (typeof entry !== "object" || entry === null || !("value" in entry)) {
    console.log(`ℹ️  No existe la clave "${KEY}" en el singleton. Nada que migrar.`);
    return;
  }
  const value = (entry as { value: unknown }).value;
  if (typeof value !== "number") {
    console.log(`ℹ️  "${KEY}" no es numérico (${String(value)}). Nada que migrar.`);
    return;
  }

  if (value > 1) {
    console.log(`= ${KEY}: ${value} (ya en porcentaje, sin cambios).`);
    return;
  }

  const nuevo = value * 100;
  data[KEY] = { ...(entry as object), value: nuevo };
  await prisma.proposalDefaults.update({
    where: { id: "singleton" },
    data: { data: data as unknown as Prisma.InputJsonValue },
  });
  console.log(`~ ${KEY}: ${value} (decimal) → ${nuevo} (porcentaje). ✅ Migrado.`);
}

main()
  .catch((err) => {
    console.error("❌ Error en grant-markup-porcentaje:", err);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());

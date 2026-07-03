/**
 * Grant idempotente: setea los factores de ahorro por tarifa en el singleton
 * ProposalDefaults, para que la calculadora discrimine Simple/Doble/Triple.
 *
 * Correr (local):
 *   docker compose exec server npx tsx prisma/scripts/grant-fix-factores-tarifa.ts
 *
 * Simple = 1.05 y Doble = 0.88 salen del Excel (IF(C6="Simple",…1.05,…0.88)).
 * Triple = 0.88 es PLACEHOLDER (el Excel no lo distingue de Doble): el valor real
 * lo define Nicolás y se cambia desde Admin sin tocar código.
 *
 * Idempotente: sólo toca las claves declaradas (value + asesorCanOverride).
 * No borra ni modifica ninguna otra variable del singleton.
 */

import { PrismaClient, Prisma } from "@prisma/client";

const prisma = new PrismaClient();

const TARGET: Record<string, number> = {
  factorAhorroSimple: 1.05,
  factorAhorroDoble: 0.88,
  factorAhorroTriple: 0.88, // placeholder (= Doble hasta definir el real)
};

function currentValue(entry: unknown): number | undefined {
  if (typeof entry === "object" && entry !== null && "value" in entry) {
    const v = (entry as { value: unknown }).value;
    if (typeof v === "number") return v;
  }
  return undefined;
}

async function main() {
  const existing = await prisma.proposalDefaults.findUnique({ where: { id: "singleton" } });
  if (!existing) {
    throw new Error("No existe el singleton ProposalDefaults. Corré seed-proposal-defaults primero.");
  }

  const data = (typeof existing.data === "object" && existing.data !== null
    ? { ...(existing.data as Record<string, unknown>) }
    : {}) as Record<string, unknown>;

  let added = 0;
  let changed = 0;
  let unchanged = 0;

  for (const [key, value] of Object.entries(TARGET)) {
    const prev = currentValue(data[key]);
    if (prev === undefined) {
      console.log(`  + ${key}: (nueva) → ${value}`);
      added += 1;
    } else if (prev !== value) {
      console.log(`  ~ ${key}: ${prev} → ${value}`);
      changed += 1;
    } else {
      console.log(`  = ${key}: ${value} (sin cambios)`);
      unchanged += 1;
      continue;
    }
    data[key] = { value, asesorCanOverride: false };
  }

  if (added === 0 && changed === 0) {
    console.log(`\n✅ Nada que hacer: las ${unchanged} claves ya estaban en su valor objetivo.`);
    return;
  }

  await prisma.proposalDefaults.update({
    where: { id: "singleton" },
    data: { data: data as unknown as Prisma.InputJsonValue },
  });
  console.log(`\n✅ Singleton actualizado: ${added} agregada(s), ${changed} cambiada(s), ${unchanged} sin cambios.`);
}

main()
  .catch((err) => {
    console.error("❌ Error en grant-fix-factores-tarifa:", err);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());

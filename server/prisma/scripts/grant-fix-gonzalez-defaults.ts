/**
 * Grant idempotente: fixea los defaults del generador de propuestas v2 para que
 * la calculadora reproduzca el Excel del caso Jose Gonzalez.
 *
 * Correr (local):
 *   docker compose exec server npx tsx prisma/scripts/grant-fix-gonzalez-defaults.ts
 *
 * Idempotente: sólo toca las claves declaradas abajo (setea value +
 * asesorCanOverride). No borra ni modifica ninguna otra variable del singleton.
 * Loguea, por clave, si la agregó, la cambió (viejo → nuevo) o la dejó igual.
 *
 * Origen de los valores: hoja "Financiacion BBVA" y CALCULADORA/Costos del Excel
 * "Negocio Paneles v8" (ver docs/features/proposals-v2/casos_referencia/).
 */

import { PrismaClient, Prisma } from "@prisma/client";

const prisma = new PrismaClient();

// value = número a setear; todas son constantes internas (asesorCanOverride:false).
const TARGET: Record<string, number> = {
  // Equipamiento trifásico mal cargado (tenía el valor monofásico).
  precioElectricaTriUsdSinIva: 750,
  precioMeterTriUsd: 220,
  // Panel: 100 para reproducir el Excel (pendiente: Nicolás decide 100 vs 105).
  precioPanelUsdSinIva: 100,
  // Mano de obra — tarifas horarias por rol ($/h) + horas fijas.
  tarifaCatAPorHora: 814, // Electricista
  tarifaCatCPorHora: 947, // Capataz
  tarifaCatDPorHora: 543, // CAT D
  horasManoDeObraPorInstalacion: 10,
  // Financiación BBVA (modelo UI + PMT).
  cotizacionUI: 6.33,
  bbva24mGastosAdminCapital: 0.025,
  bbva36mGastosAdminCapital: 0.045,
  bbva60mGastosAdminCapital: 0.015,
  bbva24mFactorCuota: 1.023,
  bbva36mFactorCuota: 1.036,
  bbva60mFactorCuota: 1.071,
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
      continue; // ya está en el valor y flag correctos: no reescribir.
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
    console.error("❌ Error en grant-fix-gonzalez-defaults:", err);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());

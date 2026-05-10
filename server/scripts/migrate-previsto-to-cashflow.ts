// Script de migración: Bloque 3 — desconectar ingeniería de finanzas.
//
// Toma todos los FinanceMovement con sourceType=PROJECT_MATERIALS y
// status=PREVISTO (no soft-deleted) y para cada uno:
//   1. Copia movement.expectedDate → projectMaterial.expectedDate de cada
//      ProjectMaterial linkeado (si la columna está vacía).
//   2. Setea projectMaterial.movementId = null (los desliga).
//   3. Soft-deletea el FinanceMovement (deletedAt = now).
//
// Idempotente: correr de nuevo no hace nada (no quedan PREVISTO sin deletedAt).
//
// Uso:
//   npx tsx scripts/migrate-previsto-to-cashflow.ts --dry-run    (default)
//   npx tsx scripts/migrate-previsto-to-cashflow.ts --apply
//
// Importante: hacer backup ANTES de correr con --apply.

import { FinanceMovementStatus, MovementSourceType } from "@prisma/client";

import { prisma } from "../src/lib/prisma.js";

const APPLY = process.argv.includes("--apply");

async function main() {
  const mode = APPLY ? "APPLY" : "DRY-RUN";
  console.log(`[migrate-previsto-to-cashflow] modo=${mode}`);

  const previstos = await prisma.financeMovement.findMany({
    where: {
      sourceType: MovementSourceType.PROJECT_MATERIALS,
      status: FinanceMovementStatus.PREVISTO,
      deletedAt: null,
    },
    select: {
      id: true,
      descripcion: true,
      monto: true,
      moneda: true,
      expectedDate: true,
      projectId: true,
      projectMaterials: {
        select: { id: true, expectedDate: true },
      },
    },
    orderBy: { fecha: "asc" },
  });

  console.log(`Movimientos PREVISTO encontrados: ${previstos.length}`);

  if (previstos.length === 0) {
    console.log("Nada para migrar. Bye.");
    process.exit(0);
  }

  let materialsToTouch = 0;
  let materialsAlreadySet = 0;
  let materialsMissingExpectedDate = 0;

  for (const p of previstos) {
    const totalMaterials = p.projectMaterials.length;
    materialsToTouch += totalMaterials;
    materialsAlreadySet += p.projectMaterials.filter((pm) => pm.expectedDate !== null).length;
    if (!p.expectedDate) materialsMissingExpectedDate += totalMaterials;
  }

  console.log("");
  console.log("Resumen del cambio que se va a aplicar:");
  console.log(`  - movements a soft-delete: ${previstos.length}`);
  console.log(`  - projectMaterials a desligar (movementId → null): ${materialsToTouch}`);
  console.log(`  - projectMaterials que reciben expectedDate (estaban null): ${materialsToTouch - materialsAlreadySet}`);
  console.log(`  - projectMaterials que ya tenían expectedDate seteado (no se pisa): ${materialsAlreadySet}`);
  if (materialsMissingExpectedDate > 0) {
    console.warn(
      `  ⚠ ${materialsMissingExpectedDate} ProjectMaterial pertenecen a movimientos PREVISTO sin expectedDate; los dejamos con expectedDate=null.`,
    );
  }
  console.log("");

  // Detalle por movement (resumen).
  for (const p of previstos.slice(0, 25)) {
    const fecha = p.expectedDate ? new Date(p.expectedDate).toISOString().slice(0, 10) : "—";
    console.log(
      `  • ${p.id}  ${p.descripcion.padEnd(46)}  ${p.moneda} ${Number(p.monto).toFixed(2).padStart(12)}  exp=${fecha}  mat=${p.projectMaterials.length}`,
    );
  }
  if (previstos.length > 25) console.log(`  … (+${previstos.length - 25} más)`);
  console.log("");

  if (!APPLY) {
    console.log("Dry-run completado. Para aplicar de verdad, correr con --apply.");
    process.exit(0);
  }

  console.log("Aplicando cambios en una sola transacción…");
  let updatedMaterials = 0;
  let updatedMovements = 0;

  await prisma.$transaction(async (tx) => {
    for (const p of previstos) {
      // 1. Por cada material linkeado: si no tiene expectedDate, copiamos la del movimiento.
      for (const pm of p.projectMaterials) {
        if (pm.expectedDate === null && p.expectedDate !== null) {
          await tx.projectMaterial.update({
            where: { id: pm.id },
            data: { expectedDate: p.expectedDate, movementId: null },
          });
        } else {
          await tx.projectMaterial.update({
            where: { id: pm.id },
            data: { movementId: null },
          });
        }
        updatedMaterials++;
      }

      // 2. Soft-delete del movimiento.
      await tx.financeMovement.update({
        where: { id: p.id },
        data: { deletedAt: new Date() },
      });
      updatedMovements++;
    }
  });

  console.log(`✓ Migración completada.`);
  console.log(`  - movements soft-deleted: ${updatedMovements}`);
  console.log(`  - projectMaterials actualizados: ${updatedMaterials}`);
  process.exit(0);
}

main().catch((err) => {
  console.error("ERROR fatal:", err);
  process.exit(1);
});

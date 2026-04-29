/**
 * G.9 — Limpieza de movimientos legacy con `requiresItemDetail=true` por error.
 *
 * Casos cubiertos:
 *   1. INGRESOS con `requiresItemDetail=true` (nunca debieron tenerlo).
 *   2. GASTOS sin `supplierId` con `requiresItemDetail=true` (no aplican
 *      al desglose porque no tienen proveedor que facture stock).
 *
 * Idempotente: correr varias veces es seguro.
 *
 * Uso:
 *   docker compose exec server npx tsx scripts/cleanup-ingreso-requires-detail.ts
 */

import { PrismaClient, TipoMovimiento } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  console.log("🔍 Buscando INGRESOS con requiresItemDetail=true...");
  const ingresoCount = await prisma.financeMovement.count({
    where: { tipoMovimiento: TipoMovimiento.INGRESO, requiresItemDetail: true, deletedAt: null },
  });
  console.log(`   Encontrados: ${ingresoCount}`);

  console.log("🔍 Buscando GASTOS sin proveedor con requiresItemDetail=true...");
  const gastoCount = await prisma.financeMovement.count({
    where: {
      tipoMovimiento: TipoMovimiento.GASTO,
      supplierId: null,
      requiresItemDetail: true,
      deletedAt: null,
    },
  });
  console.log(`   Encontrados: ${gastoCount}`);

  if (ingresoCount === 0 && gastoCount === 0) {
    console.log("✅ Nada que limpiar");
    await prisma.$disconnect();
    return;
  }

  const r1 = await prisma.financeMovement.updateMany({
    where: { tipoMovimiento: TipoMovimiento.INGRESO, requiresItemDetail: true, deletedAt: null },
    data: { requiresItemDetail: false },
  });
  console.log(`✅ ${r1.count} INGRESOS limpiados`);

  const r2 = await prisma.financeMovement.updateMany({
    where: {
      tipoMovimiento: TipoMovimiento.GASTO,
      supplierId: null,
      requiresItemDetail: true,
      deletedAt: null,
    },
    data: { requiresItemDetail: false },
  });
  console.log(`✅ ${r2.count} GASTOS sin proveedor limpiados`);
}

main()
  .catch((e) => {
    console.error("❌ Cleanup failed:", e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());

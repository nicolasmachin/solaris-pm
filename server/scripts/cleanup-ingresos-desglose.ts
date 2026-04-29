/**
 * Limpia INGRESOS con `requiresItemDetail=true` (bug de versiones anteriores que
 * marcaba todos los movimientos creados en A_PAGAR/PAGADO como pendientes de
 * desglose, sin filtrar por tipoMovimiento). El desglose de factura solo aplica
 * a GASTOS con proveedor.
 *
 * Idempotente: si no hay INGRESOS con la marca, no hace nada.
 *
 * Uso:
 *   docker compose exec server npx tsx scripts/cleanup-ingresos-desglose.ts
 */

import { PrismaClient, TipoMovimiento } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  console.log("🔍 Buscando INGRESOS con requiresItemDetail=true...");

  const orphans = await prisma.financeMovement.findMany({
    where: {
      tipoMovimiento: TipoMovimiento.INGRESO,
      requiresItemDetail: true,
      deletedAt: null,
    },
    select: {
      id: true,
      descripcion: true,
      monto: true,
      moneda: true,
      fecha: true,
    },
    orderBy: { fecha: "asc" },
  });

  console.log(`📊 Encontrados ${orphans.length} INGRESOS con desglose pendiente erróneo`);

  if (orphans.length === 0) {
    console.log("✅ Nada que limpiar");
    await prisma.$disconnect();
    return;
  }

  console.log("\nLista de INGRESOS a limpiar:");
  for (const m of orphans) {
    const fechaStr = m.fecha.toISOString().split("T")[0];
    console.log(`  - ${fechaStr} | ${m.descripcion} | ${m.moneda} ${m.monto}`);
  }

  console.log("\n⚙️  Aplicando limpieza...");
  const result = await prisma.financeMovement.updateMany({
    where: {
      tipoMovimiento: TipoMovimiento.INGRESO,
      requiresItemDetail: true,
      deletedAt: null,
    },
    data: { requiresItemDetail: false },
  });

  console.log(`✅ ${result.count} INGRESOS limpiados (requiresItemDetail=false)`);
}

main()
  .catch((e) => {
    console.error("❌ Cleanup failed:", e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());

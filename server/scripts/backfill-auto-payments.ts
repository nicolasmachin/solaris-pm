/**
 * G.8 — Backfill de auto-Payments para movimientos PAGADOS legacy.
 *
 * Recorre todos los FinanceMovement GASTO en estado PAGADO con supplierId
 * que NO tengan PaymentApplications activas (huérfanos del flujo automático
 * introducido en G.8) y les genera un Payment + PaymentApplication retroactivo
 * para que el saldo del proveedor cuadre.
 *
 * Idempotente: correr varias veces no duplica.
 *
 * Uso:
 *   docker compose exec server npx tsx scripts/backfill-auto-payments.ts
 */

import { PrismaClient, MetodoPago, TipoMovimiento, FinanceMovementStatus } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  console.log("🔍 Buscando movimientos PAGADOS sin Payment asociado...");

  const movements = await prisma.financeMovement.findMany({
    where: {
      tipoMovimiento: TipoMovimiento.GASTO,
      status: FinanceMovementStatus.PAGADO,
      supplierId: { not: null },
      deletedAt: null,
    },
    include: {
      paymentApplications: {
        where: { payment: { deletedAt: null } },
        select: { id: true },
      },
    },
  });

  const orphans = movements.filter((m) => m.paymentApplications.length === 0);
  console.log(`📊 Encontrados ${orphans.length} movimientos sin Payment (de ${movements.length} totales en PAGADO con proveedor)`);

  if (orphans.length === 0) {
    console.log("✅ Nada que reparar");
    await prisma.$disconnect();
    return;
  }

  // Buscar usuario admin para crear los Payments en su nombre
  const adminRole = await prisma.role.findFirst({ where: { name: "ADMIN" } });
  if (!adminRole) {
    console.error("❌ No se encontró el rol ADMIN");
    process.exit(1);
  }
  const admin = await prisma.user.findFirst({ where: { roleId: adminRole.id, deletedAt: null } });
  if (!admin) {
    console.error("❌ No se encontró usuario con rol ADMIN");
    process.exit(1);
  }
  console.log(`👤 Usando admin '${admin.name}' (${admin.email}) como creador de los Payments`);

  let created = 0;
  let skipped = 0;
  const errors: Array<{ movementId: string; reason: string }> = [];

  for (const mov of orphans) {
    try {
      let accountId = mov.accountId;

      // Si no tiene accountId, buscar primera cuenta activa con la misma moneda
      if (!accountId) {
        const account = await prisma.account.findFirst({
          where: { moneda: mov.moneda, activa: true, deletedAt: null },
          orderBy: { createdAt: "asc" },
        });
        if (!account) {
          console.warn(`⚠️ Movimiento ${mov.id} (${mov.descripcion}) sin accountId y sin cuenta default en ${mov.moneda}. Saltado.`);
          skipped++;
          errors.push({ movementId: mov.id, reason: `Sin cuenta default en ${mov.moneda}` });
          continue;
        }
        accountId = account.id;
        await prisma.financeMovement.update({
          where: { id: mov.id },
          data: { accountId },
        });
        console.log(`   ↳ Movimiento ${mov.id} sin accountId, asignada cuenta ${account.nombre}`);
      }

      await prisma.$transaction(async (tx) => {
        const payment = await tx.payment.create({
          data: {
            supplierId: mov.supplierId!,
            accountId,
            fecha: mov.fecha,
            monto: mov.monto,
            moneda: mov.moneda,
            metodo: MetodoPago.OTRO,
            referencia: `[BACKFILL] ${mov.descripcion}`.slice(0, 200),
            notas: "Pago retroactivo creado por backfill (G.8)",
            createdById: admin.id,
          },
        });
        await tx.paymentApplication.create({
          data: {
            paymentId: payment.id,
            movementId: mov.id,
            montoAplicado: mov.monto,
          },
        });
      });

      created++;
      console.log(`✅ ${created}/${orphans.length}: Movimiento ${mov.id} reparado (${mov.descripcion})`);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      console.error(`❌ Error en movimiento ${mov.id}:`, msg);
      errors.push({ movementId: mov.id, reason: msg });
    }
  }

  console.log("");
  console.log("═══════════════════════════════════");
  console.log(`✅ Pagos creados: ${created}`);
  console.log(`⚠️ Saltados: ${skipped}`);
  console.log(`❌ Errores: ${errors.length - skipped > 0 ? errors.length - skipped : 0}`);
  console.log("═══════════════════════════════════");

  if (errors.length > 0) {
    console.log("\nDetalle:");
    for (const e of errors) console.log(`  - ${e.movementId}: ${e.reason}`);
  }
}

main()
  .catch((e) => {
    console.error("❌ Backfill failed:", e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());

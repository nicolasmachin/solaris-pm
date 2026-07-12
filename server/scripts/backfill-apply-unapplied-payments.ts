/**
 * Backfill — aplica FIFO los Payments que quedaron "sin aplicar".
 *
 * Contexto: hasta el cambio del pago-a-proveedor con auto-aplicación FIFO, un
 * pago registrado desde la vista de proveedor podía quedar con saldo sin aplicar
 * ("a favor del proveedor") si no se aplicaba a mano. Ese dinero no descontaba
 * deuda ni figuraba en el Estado de resultados.
 *
 * Este script recorre todos los Payment (no anulados, monto > 0) con saldo sin
 * aplicar y los aplica automáticamente FIFO a las facturas adeudadas más viejas
 * del mismo proveedor (misma lógica que el endpoint POST /finance/payments).
 * El sobrante queda como saldo a favor.
 *
 * Idempotente: correr varias veces no duplica (sólo aplica lo que aún queda sin
 * aplicar). Procesa los pagos de más viejo a más nuevo.
 *
 * Uso:
 *   # Simulación (NO escribe nada, sólo muestra qué haría):
 *   docker compose exec server npx tsx scripts/backfill-apply-unapplied-payments.ts
 *
 *   # Aplicar de verdad:
 *   docker compose exec server npx tsx scripts/backfill-apply-unapplied-payments.ts --apply
 */

import { PrismaClient, Prisma, TipoMovimiento, FinanceMovementStatus } from "@prisma/client";

const prisma = new PrismaClient();

const APPLY = process.argv.includes("--apply");

function roundMoney(v: number) {
  return Math.round(v * 100) / 100;
}

/**
 * Replica recalcMovementStatus del endpoint: recalcula el status del movimiento
 * según sus aplicaciones activas y, al quedar PAGADO, mueve su fecha a la del
 * último pago (criterio caja).
 */
async function recalcMovementStatus(tx: Prisma.TransactionClient, movementId: string) {
  const m = await tx.financeMovement.findFirst({
    where: { id: movementId, deletedAt: null },
    include: { paymentApplications: { include: { payment: { select: { deletedAt: true } } } } },
  });
  if (!m || m.tipoMovimiento !== TipoMovimiento.GASTO) return;

  const monto = Number(m.monto);
  const activeApps = m.paymentApplications.filter((a) => !a.payment.deletedAt);
  const pagado = activeApps.reduce((s, a) => s + Number(a.montoAplicado), 0);
  const saldo = roundMoney(monto - pagado);

  let nextStatus = m.status;
  const data: Prisma.FinanceMovementUpdateInput = {};

  if (Math.abs(saldo) < 0.005) {
    nextStatus = FinanceMovementStatus.PAGADO;
    if (m.status !== FinanceMovementStatus.PAGADO) {
      const ultimaApp = activeApps.length > 0
        ? await tx.paymentApplication.findFirst({
            where: { movementId, payment: { deletedAt: null } },
            orderBy: { payment: { fecha: "desc" } },
            include: { payment: true },
          })
        : null;
      if (ultimaApp) {
        const fechaPago = ultimaApp.payment.fecha;
        data.fecha = fechaPago;
        data.mes = fechaPago.getUTCMonth() + 1;
        data.anio = fechaPago.getUTCFullYear();
      }
      data.pagado = true;
    }
  } else if (pagado > 0 && saldo > 0) {
    nextStatus = FinanceMovementStatus.PARCIALMENTE_PAGADO;
  } else if (pagado === 0) {
    if (m.status === FinanceMovementStatus.PAGADO || m.status === FinanceMovementStatus.PARCIALMENTE_PAGADO) {
      nextStatus = m.dueDate ? FinanceMovementStatus.A_PAGAR : FinanceMovementStatus.COMPROMETIDO;
      data.pagado = false;
    }
  }

  if (nextStatus !== m.status) data.status = nextStatus;
  if (Object.keys(data).length > 0) {
    await tx.financeMovement.update({ where: { id: movementId }, data });
  }
}

async function main() {
  console.log(APPLY
    ? "⚙️  MODO APPLY — se van a aplicar los pagos sin aplicar."
    : "🔎 MODO SIMULACIÓN (dry-run) — no se escribe nada. Usá --apply para ejecutar.");
  console.log("");

  // Todos los pagos vivos, más viejos primero (para consumir facturas en orden).
  const payments = await prisma.payment.findMany({
    where: { deletedAt: null },
    include: {
      applications: { include: { movement: { select: { deletedAt: true } } } },
      supplier: { select: { nombre: true } },
    },
    orderBy: { fecha: "asc" },
  });

  // Pre-filtrar los que tienen saldo sin aplicar y monto positivo.
  const candidatos = payments.filter((p) => {
    const monto = Number(p.monto);
    if (monto <= 0) return false; // notas de crédito: no cancelan facturas
    const aplicado = p.applications
      .filter((a) => !a.movement || a.movement.deletedAt === null)
      .reduce((s, a) => s + Number(a.montoAplicado), 0);
    return roundMoney(monto - aplicado) > 0.005;
  });

  console.log(`📊 ${candidatos.length} pago(s) con saldo sin aplicar (de ${payments.length} totales).`);
  if (candidatos.length === 0) {
    console.log("✅ Nada que aplicar.");
    return;
  }

  let totalPagosTocados = 0;
  let totalAplicadoGlobal = 0;
  let totalAplicacionesCreadas = 0;

  const ROLLBACK = new Error("__DRY_RUN_ROLLBACK__");

  try {
    await prisma.$transaction(async (tx) => {
      for (const p of candidatos) {
        const monto = Number(p.monto);
        const aplicadoPrevio = p.applications
          .filter((a) => !a.movement || a.movement.deletedAt === null)
          .reduce((s, a) => s + Number(a.montoAplicado), 0);
        let saldoSinAplicar = roundMoney(monto - aplicadoPrevio);
        const yaAplicadosDeEstePago = new Set(
          p.applications
            .filter((a) => !a.movement || a.movement.deletedAt === null)
            .map((a) => a.movementId),
        );

        // Facturas adeudadas del proveedor (misma moneda), más viejas primero.
        const facturas = await tx.financeMovement.findMany({
          where: {
            deletedAt: null,
            supplierId: p.supplierId,
            moneda: p.moneda,
            tipoMovimiento: TipoMovimiento.GASTO,
            status: { in: [
              FinanceMovementStatus.COMPROMETIDO,
              FinanceMovementStatus.A_PAGAR,
              FinanceMovementStatus.PARCIALMENTE_PAGADO,
            ] },
          },
          include: { paymentApplications: { include: { payment: { select: { deletedAt: true } } } } },
          orderBy: [{ fecha: "asc" }, { createdAt: "asc" }],
        });

        const aplicadasEstePago: string[] = [];
        let aplicadoEnEstePago = 0;
        for (const f of facturas) {
          if (saldoSinAplicar <= 0.005) break;
          if (yaAplicadosDeEstePago.has(f.id)) continue;
          const activeApps = f.paymentApplications.filter((a) => !a.payment.deletedAt);
          const pagado = activeApps.reduce((s, a) => s + Number(a.montoAplicado), 0);
          const saldoPendiente = roundMoney(Number(f.monto) - pagado);
          if (saldoPendiente <= 0.005) continue;
          const aplicar = roundMoney(Math.min(saldoSinAplicar, saldoPendiente));
          if (aplicar <= 0.005) continue;
          await tx.paymentApplication.create({
            data: {
              paymentId: p.id,
              movementId: f.id,
              montoAplicado: new Prisma.Decimal(aplicar),
            },
          });
          await recalcMovementStatus(tx, f.id);
          saldoSinAplicar = roundMoney(saldoSinAplicar - aplicar);
          aplicadoEnEstePago = roundMoney(aplicadoEnEstePago + aplicar);
          aplicadasEstePago.push(`${f.descripcion} (${aplicar} ${p.moneda})`);
        }

        if (aplicadasEstePago.length > 0) {
          totalPagosTocados++;
          totalAplicadoGlobal = roundMoney(totalAplicadoGlobal + aplicadoEnEstePago);
          totalAplicacionesCreadas += aplicadasEstePago.length;
          const fechaStr = p.fecha.toISOString().slice(0, 10);
          console.log(`• Pago ${fechaStr} ${monto} ${p.moneda} a ${p.supplier?.nombre ?? "?"}: aplicado ${aplicadoEnEstePago} a ${aplicadasEstePago.length} factura(s), queda ${saldoSinAplicar} a favor`);
          for (const a of aplicadasEstePago) console.log(`    ↳ ${a}`);
        }
      }

      if (!APPLY) throw ROLLBACK;
    }, { timeout: 120_000, maxWait: 20_000 });
  } catch (err) {
    if (err !== ROLLBACK) throw err;
  }

  console.log("");
  console.log("═══════════════════════════════════");
  console.log(`Pagos con alguna aplicación: ${totalPagosTocados}`);
  console.log(`Aplicaciones creadas:        ${totalAplicacionesCreadas}`);
  console.log(`Total aplicado:              ${totalAplicadoGlobal}`);
  console.log(APPLY ? "✅ Cambios COMMITEADOS." : "🔎 Simulación: no se escribió nada (usá --apply).");
  console.log("═══════════════════════════════════");
}

main()
  .catch((e) => {
    console.error("❌ Backfill failed:", e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());

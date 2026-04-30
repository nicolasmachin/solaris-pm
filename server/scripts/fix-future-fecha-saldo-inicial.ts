/**
 * v4.3 — Setear fechaSaldoInicial a HOY cuando esté en el futuro.
 *
 * Tras hacer fechaSaldoInicial funcional (filtro `fecha >= fechaCorte`), las
 * cuentas con `fechaSaldoInicial` futura producirían saldo == saldoInicial
 * (porque ningún movimiento tendría fecha >= fechaCorte). Las llevamos a hoy
 * para que la cuenta empiece a acumular movimientos de hoy en adelante.
 *
 * Si tras correr esto el saldo no coincide con la realidad, conciliá la cuenta
 * desde /finanzas/cuentas para crear el ajuste correspondiente.
 *
 * Idempotente: correr varias veces es seguro.
 *
 * Uso:
 *   docker compose exec server npx tsx scripts/fix-future-fecha-saldo-inicial.ts
 */

import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  const hoyIso = new Date().toISOString().slice(0, 10);
  const hoy = new Date(`${hoyIso}T00:00:00.000Z`);

  console.log(`🔍 Buscando cuentas con fechaSaldoInicial > ${hoyIso}...`);
  const cuentasMalas = await prisma.account.findMany({
    where: { fechaSaldoInicial: { gt: hoy }, deletedAt: null },
    select: { id: true, nombre: true, fechaSaldoInicial: true, saldoInicial: true, moneda: true },
  });

  if (cuentasMalas.length === 0) {
    console.log("✅ Nada que corregir.");
    return;
  }

  console.log(`   Encontradas ${cuentasMalas.length}:`);
  for (const c of cuentasMalas) {
    console.log(
      `   - ${c.nombre} (${c.moneda}): fechaSaldoInicial=${c.fechaSaldoInicial?.toISOString().slice(0, 10)}, saldoInicial=${c.saldoInicial}`,
    );
  }

  const result = await prisma.account.updateMany({
    where: { id: { in: cuentasMalas.map((c) => c.id) } },
    data: { fechaSaldoInicial: hoy },
  });

  console.log(`✅ ${result.count} cuenta(s) actualizada(s): fechaSaldoInicial → ${hoyIso}.`);
  console.log(
    "   Movimientos posteriores a hoy afectan el saldo. Si el saldo no matchea la realidad, conciliá la cuenta desde /finanzas/cuentas.",
  );
}

main()
  .catch((e) => {
    console.error("❌ Fix failed:", e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());

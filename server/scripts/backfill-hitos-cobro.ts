/**
 * Backfill — ata las cuotas pendientes de los planes de pago existentes a su
 * momento de la obra (`hitoCobro`) y les saca la fecha.
 *
 * Contexto: desde el 22-oct-2026 las cuotas del plan por defecto no tienen
 * fecha: quedan listas para cobrar cuando llega su momento (previo a la obra,
 * obra finalizada, habilitación finalizada). Los planes armados antes tenían
 * fechas inventadas (+30/+60/+90 días) con los nombres viejos del plan.
 *
 * Solo toca cuotas PREVISTAS (sin cobrar), de proyecto, cargadas a mano y sin
 * hito, cuyo nombre es uno de los del plan por defecto (o una variante clara).
 * Las de otros nombres ("Cuota 2", "Saldo", acuerdos especiales) quedan con su
 * fecha: se listan al final para revisarlas a mano.
 *
 * Idempotente (salta las que ya tienen hito).
 *
 * Uso:
 *   # Simulación (no escribe nada):
 *   docker compose exec server npx tsx scripts/backfill-hitos-cobro.ts
 *   # Aplicar:
 *   docker compose exec server npx tsx scripts/backfill-hitos-cobro.ts --apply
 */

import { CategoriaPrincipal, FinanceMovementStatus, HitoCobro, MovementSourceType, PrismaClient, TipoMovimiento } from "@prisma/client";

const prisma = new PrismaClient();
const APPLY = process.argv.includes("--apply");

const NUEVO_NOMBRE: Record<HitoCobro, string> = {
  SENIA: "Seña",
  PREVIO_OBRA: "Cuota 1 · previo a la obra",
  OBRA_FINALIZADA: "Cuota 2 · obra finalizada",
  HABILITACION: "Cuota 3 · habilitación finalizada",
};

function hitoDe(nombre: string): HitoCobro | null {
  const n = nombre.replace(/^\[PLAN\]\s*/, "").trim().toLowerCase();
  if (n === "seña" || n === "sena") return HitoCobro.SENIA;
  if (/^pago previo\b/.test(n)) return HitoCobro.PREVIO_OBRA;
  if (/^pago obra (terminada|finalizada)\b/.test(n)) return HitoCobro.OBRA_FINALIZADA;
  if (/^pago obra habilitada\b/.test(n)) return HitoCobro.HABILITACION;
  return null;
}

async function main() {
  const cuotas = await prisma.financeMovement.findMany({
    where: {
      deletedAt: null, hitoCobro: null,
      tipoMovimiento: TipoMovimiento.INGRESO, categoriaPrincipal: CategoriaPrincipal.PROYECTO_ENTRADA,
      status: FinanceMovementStatus.PREVISTO, sourceType: MovementSourceType.MANUAL, cobrado: false,
      projectId: { not: null },
    },
    select: { id: true, descripcion: true, monto: true, dueDate: true, project: { select: { code: true, clientName: true } } },
    orderBy: { createdAt: "asc" },
  });

  const sinTocar: string[] = [];
  let atadas = 0;
  for (const c of cuotas) {
    const hito = hitoDe(c.descripcion);
    const quien = `${c.project?.code} ${c.project?.clientName}`;
    if (!hito) {
      sinTocar.push(`  ${quien} · ${c.descripcion} · USD ${Number(c.monto)} · vence ${c.dueDate?.toISOString().slice(0, 10) ?? "sin fecha"}`);
      continue;
    }
    console.log(`${APPLY ? "ATA" : "ataría"}: ${quien} · "${c.descripcion}" → "${NUEVO_NOMBRE[hito]}" (${hito}), sin fecha`);
    if (APPLY) {
      await prisma.financeMovement.update({
        where: { id: c.id },
        data: { hitoCobro: hito, descripcion: NUEVO_NOMBRE[hito], dueDate: null },
      });
    }
    atadas++;
  }

  console.log(`\n${atadas} cuota(s) ${APPLY ? "atadas" : "a atar"} a su momento de la obra.`);
  if (sinTocar.length) {
    console.log(`${sinTocar.length} cuota(s) con otro nombre quedan con su fecha (revisar a mano):`);
    console.log(sinTocar.join("\n"));
  }
  if (!APPLY) console.log("\nSimulación: no se escribió nada. Correr con --apply para aplicar.");
}

main().finally(() => prisma.$disconnect());

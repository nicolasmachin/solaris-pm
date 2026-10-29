/**
 * Backfill — deja la cuota única "Financiación bancaria" en los proyectos que
 * ya tenían esa modalidad antes de que se creara sola (29-oct-2026).
 *
 * Contexto: con financiación bancaria el banco paga todo junto, pero esos
 * proyectos quedaban sin cobro previsto o con el plan de cuotas del pago
 * directo. Desde el 29-oct, elegir la modalidad reemplaza lo previsto por una
 * sola cuota del banco por lo que falta cobrar (respeta una seña prevista).
 *
 * Usa la misma función que la pantalla (`planFinanciacionBancaria`), así que
 * salta los que ya tienen la cuota del banco y los que no tienen nada que
 * cobrar. Idempotente.
 *
 * Uso:
 *   # Simulación (no escribe nada):
 *   docker compose exec server npx tsx scripts/backfill-plan-financiacion.ts
 *   # Aplicar (las acciones quedan a nombre del usuario dado):
 *   docker compose exec server npx tsx scripts/backfill-plan-financiacion.ts --apply --usuario=<email>
 */

import { CategoriaPrincipal, FinanceMovementStatus, ModalidadPago, TipoMovimiento } from "@prisma/client";

import { prisma } from "../src/lib/prisma.js";
import { planFinanciacionBancaria } from "../src/services/planPagos.service.js";

const APPLY = process.argv.includes("--apply");
const email = process.argv.find((a) => a.startsWith("--usuario="))?.slice("--usuario=".length);

const proyectos = await prisma.project.findMany({
  where: { deletedAt: null, modalidadPago: ModalidadPago.FINANCIACION_BANCARIA },
  select: {
    id: true, code: true, clientName: true, budgetUsd: true,
    financeMovements: {
      where: { deletedAt: null, tipoMovimiento: TipoMovimiento.INGRESO, categoriaPrincipal: CategoriaPrincipal.PROYECTO_ENTRADA },
      select: { descripcion: true, monto: true, status: true },
    },
  },
  orderBy: { code: "asc" },
});

let userId = "";
if (APPLY) {
  if (!email) throw new Error("Con --apply hay que pasar --usuario=<email>");
  userId = (await prisma.user.findFirstOrThrow({ where: { email } })).id;
}

for (const p of proyectos) {
  const previstos = p.financeMovements.filter((m) => m.status === FinanceMovementStatus.PREVISTO);
  const antes = previstos.map((m) => `${m.descripcion} ${Number(m.monto)}`).join(" / ") || "sin cobros previstos";
  console.log(`${p.code} ${p.clientName} (presupuesto ${Number(p.budgetUsd ?? 0)}) — antes: ${antes}`);
  if (!APPLY) continue;
  const r = await planFinanciacionBancaria(p.id, userId);
  console.log(r ? `   → ${r.cuotas.map((c) => `${c.descripcion} ${c.monto}`).join(" / ")}` : "   → sin cambios");
}
if (!APPLY) console.log("\nSimulación. Para aplicar: --apply --usuario=<email>");
await prisma.$disconnect();

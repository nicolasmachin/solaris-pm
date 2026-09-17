// Backfill: congela la comisión de las ventas ya cerradas (CERRADO_GANADO) que
// quedaron sin comisión, que es lo que dejaba a esas ventas sin monto en los
// informes.
//
// Desde v10.7 la comisión se congela sola al ganar (`congelarComisionAlGanar`),
// así que esto es solo para las ventas cerradas ANTES de ese cambio.
//
// Dos modos:
//
//   1. Barrido (sin --lead): recorre los ganados sin comisión y congela los que
//      tengan propuesta publicada. Los que no tengan ninguna se listan al final
//      para cargarlos a mano (modo 2): sin propuesta no hay monto que leer.
//
//   2. Carga manual (--lead <id> --precio-sin-iva <USD> [--precio-con-iva <USD>]):
//      para una venta cerrada sin propuesta en el sistema. Calcula la comisión
//      como el % del singleton de propuestas sobre el precio SIN IVA, y guarda
//      el precio CON IVA como presupuesto del lead, que es de donde los informes
//      sacan el monto de la venta cuando no hay propuesta.
//
// Idempotente: nunca toca un lead que ya tiene comisión.
//
// Correr con:
//   docker compose exec server node --import tsx scripts/backfill-comisiones-ganados.ts            → DRY-RUN
//   docker compose exec server node --import tsx scripts/backfill-comisiones-ganados.ts --execute  → aplica

import { PrismaClient, Prisma, SalesStage } from "@prisma/client";

import { confirmCommission } from "../src/services/commission/commission.service.js";

const prisma = new PrismaClient();
const EXECUTE = process.argv.includes("--execute");

function argValue(name: string): string | undefined {
  const i = process.argv.indexOf(name);
  return i >= 0 ? process.argv[i + 1] : undefined;
}

const COMISION_PCT_DEFAULT = 0.04;

/** % de comisión del singleton de propuestas (fracción: 0.04 = 4%). */
async function comisionPct(): Promise<number> {
  const defaults = await prisma.proposalDefaults.findUnique({ where: { id: "singleton" } });
  const raw = (defaults?.data as { comisionVendedorPorcentaje?: { value?: unknown } } | null)
    ?.comisionVendedorPorcentaje?.value;
  const n = typeof raw === "number" ? raw : raw != null ? Number(raw) : NaN;
  return Number.isFinite(n) && n > 0 ? n : COMISION_PCT_DEFAULT;
}

/** Usuario al que se le atribuye la carga (createdBy). Primer ADMIN activo. */
async function actorId(): Promise<string> {
  const email = argValue("--as");
  const user = email
    ? await prisma.user.findFirst({ where: { email } })
    : await prisma.user.findFirst({ where: { role: { name: "ADMIN" } }, orderBy: { createdAt: "asc" } });
  if (!user) throw new Error("No se encontró el usuario que carga la comisión (probá con --as <email>).");
  return user.id;
}

async function cargaManual(leadId: string) {
  const precioSinIva = Number(argValue("--precio-sin-iva"));
  const precioConIva = Number(argValue("--precio-con-iva"));
  if (!(precioSinIva > 0)) throw new Error("Falta --precio-sin-iva <USD> (el precio de la propuesta).");

  const lead = await prisma.salesLead.findUnique({
    where: { id: leadId },
    select: { id: true, clientName: true, stage: true, closedAt: true, assignedToId: true, estimatedBudgetUsd: true },
  });
  if (!lead) throw new Error(`El lead ${leadId} no existe.`);
  if (lead.stage !== SalesStage.CERRADO_GANADO) throw new Error(`${lead.clientName} no está en CERRADO_GANADO.`);
  if (!lead.closedAt) throw new Error(`${lead.clientName} no tiene fecha de cierre.`);
  if (!lead.assignedToId) throw new Error(`${lead.clientName} no tiene asesor asignado.`);

  const existing = await prisma.commission.findUnique({ where: { leadId } });
  if (existing) {
    console.log(`· ${lead.clientName}: ya tiene comisión (USD ${Number(existing.montoUsd).toFixed(2)}). No se toca.`);
    return;
  }

  const pct = await comisionPct();
  const montoComision = Math.round(precioSinIva * pct * 100) / 100;
  const presupuesto = precioConIva > 0 ? precioConIva : null;

  console.log(
    `· ${lead.clientName}: comisión USD ${montoComision.toFixed(2)} (${(pct * 100).toFixed(1)}% de ${precioSinIva})` +
      (presupuesto ? ` · precio de venta USD ${presupuesto}` : ""),
  );
  if (!EXECUTE) return;

  const userId = await actorId();
  // Mismo camino que el modal cuando no hay propuesta nueva: deja la comisión
  // atada al lead y crea el pendiente en Finanzas.
  await confirmCommission({ leadId, userId, userRole: "ADMIN", montoManualUsd: montoComision });

  if (presupuesto && lead.estimatedBudgetUsd == null) {
    await prisma.salesLead.update({
      where: { id: leadId },
      data: { estimatedBudgetUsd: new Prisma.Decimal(presupuesto) },
    });
  }
  console.log("  ✓ cargada");
}

async function barrido() {
  const leads = await prisma.salesLead.findMany({
    where: { deletedAt: null, stage: SalesStage.CERRADO_GANADO, commission: null },
    select: {
      id: true,
      clientName: true,
      closedAt: true,
      assignedToId: true,
      proposalV2Versions: {
        where: { status: "PUBLISHED", discardedAt: null },
        orderBy: { versionNumber: "desc" },
        take: 1,
        select: { id: true, versionNumber: true },
      },
    },
    orderBy: { closedAt: "asc" },
  });

  console.log(`Ventas ganadas sin comisión: ${leads.length}${EXECUTE ? "" : "  (DRY-RUN)"}\n`);

  const sinPropuesta: string[] = [];
  let congeladas = 0;

  for (const lead of leads) {
    const version = lead.proposalV2Versions[0];
    if (!version) {
      sinPropuesta.push(`${lead.clientName} (${lead.id})`);
      continue;
    }
    console.log(`· ${lead.clientName}: congelar con la versión ${version.versionNumber}`);
    if (!EXECUTE) continue;
    if (!lead.assignedToId || !lead.closedAt) {
      console.log("  ✗ sin asesor o sin fecha de cierre: se saltea");
      continue;
    }
    const userId = await actorId();
    try {
      await confirmCommission({ leadId: lead.id, userId, userRole: "ADMIN", proposalVersionId: version.id });
      congeladas += 1;
      console.log("  ✓ congelada");
    } catch (err) {
      console.log(`  ✗ ${(err as Error).message}`);
    }
  }

  if (sinPropuesta.length) {
    console.log(`\nSin propuesta publicada (cargar a mano con --lead <id> --precio-sin-iva <USD>):`);
    for (const l of sinPropuesta) console.log(`  · ${l}`);
  }
  if (EXECUTE) console.log(`\nCongeladas: ${congeladas}`);
}

async function main() {
  const leadId = argValue("--lead");
  if (leadId) await cargaManual(leadId);
  else await barrido();
}

main()
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());

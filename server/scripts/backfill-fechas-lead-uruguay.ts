// Backfill: pasa las fechas del proceso de un lead cargadas a mano de las
// 00:00 UTC a las 00:00 de Uruguay (03:00 UTC).
//
// Hasta v10.9 la app guardaba un día editado a mano ("15/06") como las 00:00
// UTC, que en Uruguay son las 21:00 del día anterior. El panel del lead lo
// mostraba bien (recortaba la fecha UTC), pero el listado de leads lo mostraba
// un día antes y, desde que las métricas cortan a medianoche de Uruguay, habría
// contado en el día anterior. Ahora la app y el chat guardan las 00:00 de
// Uruguay; este script alinea lo que ya estaba cargado.
//
// Qué toca: solo valores EXACTAMENTE a las 00:00:00.000 UTC en leadCreatedAt,
// proposalSentAt, visitScheduledAt, visitCompletedAt y closedAt. Las fechas que
// se completan solas llevan la hora real (con milisegundos) y no coinciden.
// Idempotente: después de correrlo esos valores quedan a las 03:00 UTC.
//
// Correr con:
//   docker compose exec server node --import tsx scripts/backfill-fechas-lead-uruguay.ts            → DRY-RUN
//   docker compose exec server node --import tsx scripts/backfill-fechas-lead-uruguay.ts --execute  → aplica

import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();
const EXECUTE = process.argv.includes("--execute");
const TRES_HORAS = 3 * 3_600_000;

const CAMPOS = ["leadCreatedAt", "proposalSentAt", "visitScheduledAt", "visitCompletedAt", "closedAt"] as const;
type Campo = (typeof CAMPOS)[number];

function aMedianocheUtc(d: Date | null): boolean {
  return d != null && d.getTime() % 86_400_000 === 0;
}

async function main() {
  console.log(`=== Backfill fechas de lead a hora de Uruguay (${EXECUTE ? "EXECUTE" : "DRY-RUN"}) ===\n`);

  const leads = await prisma.salesLead.findMany({
    select: {
      id: true, code: true, clientName: true,
      leadCreatedAt: true, proposalSentAt: true, visitScheduledAt: true, visitCompletedAt: true, closedAt: true,
    },
  });

  const porCampo = Object.fromEntries(CAMPOS.map((c) => [c, 0])) as Record<Campo, number>;
  let leadsTocados = 0;

  for (const lead of leads) {
    const data: Partial<Record<Campo, Date>> = {};
    for (const c of CAMPOS) {
      if (aMedianocheUtc(lead[c])) {
        data[c] = new Date(lead[c]!.getTime() + TRES_HORAS);
        porCampo[c]++;
      }
    }
    if (Object.keys(data).length === 0) continue;
    leadsTocados++;
    if (leadsTocados <= 10) {
      console.log(
        `  ${lead.code} ${lead.clientName}: ` +
          Object.entries(data)
            .map(([c, d]) => `${c} ${lead[c as Campo]!.toISOString()} → ${d!.toISOString()}`)
            .join(", "),
      );
    }
    if (EXECUTE) await prisma.salesLead.update({ where: { id: lead.id }, data });
  }

  console.log(`\nLeads revisados: ${leads.length}`);
  console.log(`Leads con fechas a corregir: ${leadsTocados}`);
  for (const c of CAMPOS) console.log(`  ${c}: ${porCampo[c]}`);
  console.log(EXECUTE ? "\nAplicado." : "\nDRY-RUN: no se modificó nada. Correr con --execute para aplicar.");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());

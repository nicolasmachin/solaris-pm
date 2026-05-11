// Pre-migración: reporta cómo se va a parsear `potenciaPaneles` cuando se
// haga el ALTER COLUMN TYPE INTEGER. NO modifica la DB.
//
// Uso:
//   docker compose exec server sh -c "cd /app && node --import tsx scripts/migrate-potencia-paneles.ts"

import { prisma } from "../src/lib/prisma.js";
import { parsePotenciaPanelesW } from "../src/services/efp.snapshots.types.js";

async function main() {
  console.log("Preview de parseo de potenciaPaneles para migración String → Int");
  console.log("");

  const all = await prisma.preIngenieriaVersion.findMany({
    where: { potenciaPaneles: { not: null } },
    select: { id: true, projectId: true, potenciaPaneles: true },
    orderBy: { createdAt: "asc" },
  });

  const total = all.length;
  let parseable = 0;
  const unparseable: Array<{ id: string; raw: string | null }> = [];
  const suspicious: Array<{ id: string; raw: string | null; parsed: number }> = [];

  console.log(`Total registros con potenciaPaneles no-NULL: ${total}\n`);
  console.log("ID                          | RAW          | PARSED");
  console.log("----------------------------+--------------+-------");

  for (const r of all) {
    const parsed = parsePotenciaPanelesW(r.potenciaPaneles);
    const rawCol = (r.potenciaPaneles ?? "").padEnd(12).slice(0, 12);
    const parsedCol = parsed === null ? "NULL" : String(parsed);
    console.log(`${r.id} | ${rawCol} | ${parsedCol}`);
    if (parsed === null) {
      unparseable.push({ id: r.id, raw: r.potenciaPaneles });
    } else {
      parseable++;
      // Sospechoso: valor muy chico sin unidad — un panel real entrega 200-700W.
      if (parsed < 50) suspicious.push({ id: r.id, raw: r.potenciaPaneles, parsed });
    }
  }

  console.log("");
  console.log(`Resultado: ${parseable} parseables · ${unparseable.length} no parseables`);

  if (unparseable.length > 0) {
    console.log("\nNo parseables (quedarían NULL):");
    for (const u of unparseable) console.log(`  - ${u.id}: raw="${u.raw}"`);
  }
  if (suspicious.length > 0) {
    console.log("\nSospechosos (parseados como < 50W, probable error de carga):");
    for (const s of suspicious) console.log(`  - ${s.id}: raw="${s.raw}" → ${s.parsed}`);
  }
}

main()
  .catch((err) => {
    console.error("EXCEPCIÓN:", err);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

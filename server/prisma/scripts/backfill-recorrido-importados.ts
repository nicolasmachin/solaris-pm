/**
 * Pone en E3 (post-habilitación) a los Generadores importados por planilla.
 *
 * Por qué hace falta: la etapa del recorrido **se deriva del pipeline del
 * proyecto**, y los importados por CSV nunca tuvieron pipeline. Se quedaban sin
 * etapa, o sea fuera del Recorrido, del agrupado del listado y de la cadencia de
 * contacto — que es exactamente la cartera que Experiencia Solar tiene que
 * acompañar. En desarrollo eran 41 de 93.
 *
 * La planilla es de clientes **ya instalados y funcionando**, así que todos son
 * E3. Se escribe el override manual (`recorridoManual`), que es el mecanismo
 * previsto justamente para los que no tienen pipeline del que derivarla.
 *
 * Idempotente y conservador: **solo toca los que no tienen etapa manual puesta**,
 * así que nunca pisa una corrección hecha a mano desde la ficha.
 *
 *   docker compose exec server npx tsx prisma/scripts/backfill-recorrido-importados.ts --dry
 *   docker compose exec server npx tsx prisma/scripts/backfill-recorrido-importados.ts
 */

import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();
const DRY = process.argv.includes("--dry");

async function main(): Promise<void> {
  const candidatos = await prisma.project.findMany({
    where: { deletedAt: null, importedFromCsv: true, recorridoManual: null },
    select: { id: true, clientName: true, plannedEndDate: true },
    orderBy: { clientName: "asc" },
  });

  console.log(`[backfill] importados sin etapa: ${candidatos.length}`);
  for (const p of candidatos.slice(0, 10)) {
    const entrega = p.plannedEndDate?.toISOString().slice(0, 10) ?? "sin fecha";
    console.log(`  ${p.clientName} (entrega ${entrega})`);
  }
  if (candidatos.length > 10) console.log(`  … y ${candidatos.length - 10} más`);

  if (DRY) {
    console.log("\n[backfill] --dry: no se escribió nada.");
    return;
  }
  if (candidatos.length === 0) return;

  const r = await prisma.project.updateMany({
    where: { id: { in: candidatos.map((c) => c.id) } },
    data: { recorridoManual: "E3" },
  });
  console.log(`\n[backfill] ${r.count} Generadores pasados a E3.`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());

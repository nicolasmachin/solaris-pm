// Backfill one-off: copiar `deadline` a `dueDate` en todas las subetapas donde
// `deadline IS NOT NULL` y `dueDate` difiere (null o distinto). Resuelve el bug
// histórico donde el cálculo automático de DeadlineRule solo escribía en
// `deadline` y `dueDate` quedaba vacío → Mis Tareas (que lee `dueDate`) mostraba
// "Sin fecha". De acá en adelante ambos campos se mantienen sincronizados.
//
// Idempotente: re-correrlo no hace nada si ya están sincronizados.
//
// Correr con:
//   docker compose exec server node --import tsx scripts/backfill-substage-duedate.ts

import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  console.log("=== Backfill de Substage.dueDate desde Substage.deadline ===\n");

  const totalConDeadline = await prisma.substage.count({
    where: { deadline: { not: null } },
  });
  const totalSinDueDate = await prisma.substage.count({
    where: { deadline: { not: null }, dueDate: null },
  });

  console.log("Conteo previo:");
  console.log(`  - Subetapas con deadline:                 ${totalConDeadline}`);
  console.log(`  - Subetapas con deadline pero sin dueDate: ${totalSinDueDate}\n`);

  // Todas las que tienen deadline; sobrescribimos dueDate sólo si difiere.
  const substages = await prisma.substage.findMany({
    where: { deadline: { not: null } },
    select: { id: true, deadline: true, dueDate: true },
  });

  console.log(`Procesando ${substages.length} subetapas con deadline...`);

  let updated = 0;
  for (const sub of substages) {
    if (sub.dueDate?.getTime() !== sub.deadline?.getTime()) {
      await prisma.substage.update({
        where: { id: sub.id },
        data: { dueDate: sub.deadline },
      });
      updated++;
    }
  }

  console.log(`\nListo. ${updated} subetapas actualizadas.`);

  const stillMissing = await prisma.substage.count({
    where: { deadline: { not: null }, dueDate: null },
  });
  console.log(`Subetapas que todavía tienen deadline pero NO dueDate: ${stillMissing}`);
  if (stillMissing > 0) {
    console.warn("⚠ Hay subetapas sin sincronizar — revisar.");
  }
}

main()
  .catch((err) => {
    console.error("\n✗ Error en backfill:", err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());

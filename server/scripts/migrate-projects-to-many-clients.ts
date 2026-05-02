// Migración idempotente: copia las relaciones legacy `Project.clientUserId`
// (1-a-1) a la nueva tabla pivote `ProjectClient` (m2m). El campo legacy
// `clientUserId` se conserva por seguridad — se puede borrar en una migración
// posterior una vez que se valide que todo el código nuevo usa la m2m.
//
// Correr con: docker compose exec server node --import tsx scripts/migrate-projects-to-many-clients.ts

import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  console.log("=== Migración legacy clientUserId → ProjectClient ===\n");

  const projects = await prisma.project.findMany({
    where: { clientUserId: { not: null }, deletedAt: null },
    select: { id: true, code: true, clientUserId: true, clientName: true },
    orderBy: { code: "asc" },
  });

  console.log(`Encontrados ${projects.length} proyectos con clientUserId legacy.\n`);

  let migrated = 0;
  let skipped = 0;

  for (const p of projects) {
    if (!p.clientUserId) continue;
    const existing = await prisma.projectClient.findUnique({
      where: { projectId_userId: { projectId: p.id, userId: p.clientUserId } },
      select: { id: true },
    });
    if (existing) {
      console.log(`  - ${p.code}: ya existe en ProjectClient — saltando`);
      skipped++;
      continue;
    }
    await prisma.projectClient.create({
      data: {
        projectId: p.id,
        userId: p.clientUserId,
      },
    });
    console.log(`  ✓ ${p.code} (${p.clientName}): legacy → ProjectClient`);
    migrated++;
  }

  console.log("\n=== Migración completada ===");
  console.log(`  Migrados:   ${migrated}`);
  console.log(`  Ya existían: ${skipped}`);
  console.log(`\nNota: Project.clientUserId se conserva como campo legacy por seguridad.`);
}

main()
  .catch((err) => {
    console.error("\n✗ Error en migración:", err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());

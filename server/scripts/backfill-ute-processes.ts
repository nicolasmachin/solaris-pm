/**
 * One-shot: crea un UteProcess para cada proyecto activo que aún no tenga uno.
 *
 * Idempotente: sólo crea si no existe un UteProcess activo (deletedAt=null)
 * para ese projectId. Re-correrlo no duplica nada.
 *
 * Sirve para poblar el módulo "Trámites UTE" sobre proyectos pre-existentes
 * al lanzamiento del módulo. Los proyectos nuevos ya reciben su UteProcess
 * automáticamente al crearse (ver POST /api/projects y /api/leads/:id/convert).
 *
 * Uso en producción:
 *   docker compose -f docker-compose.prod.yml exec server \
 *     npx tsx scripts/backfill-ute-processes.ts
 *
 * Uso en local:
 *   docker compose exec server npx tsx scripts/backfill-ute-processes.ts
 */

import { UteStage, UteStatus } from "@prisma/client";
import { prisma } from "../src/lib/prisma.js";

async function main() {
  console.log("=== Backfill UteProcess ===\n");

  const projects = await prisma.project.findMany({
    where: { deletedAt: null },
    select: { id: true, clientName: true, code: true },
    orderBy: { createdAt: "asc" },
  });

  console.log(`Proyectos activos encontrados: ${projects.length}\n`);

  let created = 0;
  let skipped = 0;
  let errors = 0;

  for (const project of projects) {
    const tag = `[${project.code}] ${project.clientName}`;
    try {
      const existing = await prisma.uteProcess.findFirst({
        where: { projectId: project.id, deletedAt: null },
        select: { id: true },
      });

      if (existing) {
        console.log(`  ⏭  ${tag} (ya tiene trámite)`);
        skipped++;
        continue;
      }

      await prisma.uteProcess.create({
        data: {
          projectId: project.id,
          currentStage: UteStage.CONSULTA,
          currentStatus: UteStatus.PENDIENTE,
          stageManuallySet: false,
          caseNumber: null,
          notes: null,
          dateColors: undefined,
          createdById: null,
        },
      });

      console.log(`  ✓ ${tag}`);
      created++;
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      console.error(`  ✗ ${tag}: ${msg}`);
      errors++;
    }
  }

  console.log("\n=== Resumen ===");
  console.log(`Total proyectos: ${projects.length}`);
  console.log(`Creados:         ${created}`);
  console.log(`Saltados:        ${skipped}`);
  console.log(`Errores:         ${errors}`);

  if (errors > 0) process.exitCode = 1;
}

main()
  .catch((e) => {
    console.error("Error fatal:", e);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

// Backfill idempotente: para cada FileAttachment con tipo=UNIFILAR (creado
// antes de que existieran los campos tool*), popular toolSource/toolVersion/
// toolEntityId. Matching por projectId + versionNumber extraído del filename
// (formato `unifilar_<cliente>_v<N>.pdf`). Si no hay match, el FileAttachment
// queda sin metadata fina (todavía aparece en Documentos vía `tipo=UNIFILAR`).
//
// Correr con: docker compose exec server node --import tsx scripts/backfill-unifilar-tool-metadata.ts

import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  console.log("=== Backfill tool metadata en FileAttachment UNIFILAR ===\n");

  const attachments = await prisma.fileAttachment.findMany({
    where: {
      tipo: "UNIFILAR",
      toolSource: null,
    },
    select: { id: true, projectId: true, filename: true, deletedAt: true },
  });

  console.log(`Encontrados ${attachments.length} FileAttachment UNIFILAR sin tool metadata.\n`);

  let migrated = 0;
  let skipped = 0;
  let unmatched = 0;

  for (const a of attachments) {
    // Parsear versionNumber del filename (ej: "unifilar_Foo_Bar_v3.pdf" → 3).
    const m = a.filename.match(/_v(\d+)\.\w+$/);
    if (!m) {
      console.log(`  ⚠  ${a.filename}: no pude parsear versionNumber — saltando`);
      skipped++;
      continue;
    }
    const versionNumber = parseInt(m[1], 10);

    const version = await prisma.unifilarVersion.findUnique({
      where: { projectId_versionNumber: { projectId: a.projectId, versionNumber } },
      select: { id: true },
    });

    if (!version) {
      console.log(`  ⚠  ${a.filename} (v${versionNumber}): no encontró UnifilarVersion`);
      unmatched++;
      continue;
    }

    await prisma.fileAttachment.update({
      where: { id: a.id },
      data: {
        toolSource: "unifilar",
        toolVersion: versionNumber,
        toolEntityId: version.id,
      },
    });

    const status = a.deletedAt ? "(soft-deleted)" : "";
    console.log(`  ✓ ${a.filename} → toolSource=unifilar, toolVersion=${versionNumber} ${status}`);
    migrated++;
  }

  console.log("\n=== Backfill completado ===");
  console.log(`  Migrados:                    ${migrated}`);
  console.log(`  Sin parsear (filename raro): ${skipped}`);
  console.log(`  Sin match en UnifilarVersion: ${unmatched}`);
}

main()
  .catch((err) => {
    console.error("\n✗ Error en backfill:", err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());

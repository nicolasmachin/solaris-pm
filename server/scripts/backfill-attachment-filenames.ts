// Backfill: renombra `FileAttachment.filename` cuando coincide con el patrón
// de un UUID literal (`<uuid>.<ext>`) y el registro fue creado por una
// herramienta interna (`toolSource IS NOT NULL`).
//
// Uso:
//   docker compose exec server sh -c "cd /app && node --import tsx scripts/backfill-attachment-filenames.ts --dry-run"
//   docker compose exec server sh -c "cd /app && node --import tsx scripts/backfill-attachment-filenames.ts"
//
// Idempotente: si el filename ya es legible, lo salta. NO toca `storedFilename`
// (eso es el nombre físico en disco). El archivo NO se mueve ni se copia.
// Solo se cambia el campo en DB.
//
// Regla de oro: si NO se puede construir un filename legible (falta clientName
// o version), se loguea y se salta. NO se hace algo a medias.

import { prisma } from "../src/lib/prisma.js";
import { buildToolGeneratedFilename } from "../src/services/file-storage.service.js";

const DRY_RUN = process.argv.includes("--dry-run");

const UUID_FILENAME_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\.(pdf|xlsx|jpg|jpeg|png)$/i;

// Whitelist explícita: SOLO renombramos attachments cuyo toolSource sea de
// un generador automático conocido. Cualquier otro toolSource (incluyendo
// "efp-attach" que es un upload manual con clasificación, o nuevos toolSources
// desconocidos) NO se toca — por la regla "uploads manuales preservan el
// nombre del usuario".
const AUTO_GENERATED_TOOL_SOURCES = new Set([
  "unifilar",
  "preing",
  "preingenieria",
  "materiales",
  "materiales-sin-precios",
  "materiales-con-precios",
  "triangulos",
  "ProposalGenerator",
  "efp",
]);

async function main() {
  console.log(`${DRY_RUN ? "[DRY-RUN] " : ""}Backfill de filenames de FileAttachment`);

  // Buscar attachments con toolSource (auto-generados) cuyo filename matchea
  // el patrón de UUID literal. NO tocamos uploads manuales (toolSource null).
  const candidates = await prisma.fileAttachment.findMany({
    where: {
      toolSource: { not: null },
      deletedAt: null,
    },
    select: {
      id: true,
      filename: true,
      toolSource: true,
      toolVersion: true,
      toolEntityId: true,
      projectId: true,
      leadId: true,
      createdAt: true,
    },
    orderBy: { createdAt: "asc" },
  });

  // Filtramos por whitelist de toolSources auto-generados + filename UUID.
  const uuidMatches = candidates.filter(
    (c) =>
      c.toolSource != null &&
      AUTO_GENERATED_TOOL_SOURCES.has(c.toolSource) &&
      UUID_FILENAME_RE.test(c.filename),
  );

  // Reportar también los que fueron descartados por whitelist (para visibilidad).
  const excludedByWhitelist = candidates.filter(
    (c) =>
      c.toolSource != null &&
      !AUTO_GENERATED_TOOL_SOURCES.has(c.toolSource) &&
      UUID_FILENAME_RE.test(c.filename),
  );

  console.log(
    `Revisados ${candidates.length} attachments con toolSource. ${uuidMatches.length} renombrables · ${excludedByWhitelist.length} excluidos por whitelist.\n`,
  );

  if (excludedByWhitelist.length > 0) {
    console.log("Excluidos (toolSource fuera de whitelist — probablemente uploads manuales):");
    for (const e of excludedByWhitelist) {
      console.log(`  - ${e.id.slice(0, 12)}… · toolSource=${e.toolSource} · ${e.filename}`);
    }
    console.log("");
  }

  if (uuidMatches.length === 0) {
    console.log("Nada que renombrar.");
    return;
  }

  let renamed = 0;
  const skipped: Array<{ id: string; reason: string }> = [];

  for (const a of uuidMatches) {
    // Para construir un filename legible necesitamos el clientName del project
    // (o lead). Si no tenemos contexto, skip.
    let clientName: string | null = null;
    if (a.projectId) {
      const p = await prisma.project.findUnique({
        where: { id: a.projectId },
        select: { clientName: true },
      });
      clientName = p?.clientName ?? null;
    } else if (a.leadId) {
      const l = await prisma.salesLead.findUnique({
        where: { id: a.leadId },
        select: { clientName: true },
      });
      clientName = l?.clientName ?? null;
    }

    if (!clientName) {
      skipped.push({ id: a.id, reason: "sin project ni lead asociado" });
      continue;
    }

    const ext = a.filename.split(".").pop() ?? "pdf";
    const newFilename = buildToolGeneratedFilename({
      toolSource: a.toolSource ?? "tool",
      projectClientName: clientName,
      version: a.toolVersion,
      extension: ext,
    });

    console.log(`  ${a.id.slice(0, 12)}… · ${a.toolSource} · ${a.filename} → ${newFilename}`);

    if (!DRY_RUN) {
      await prisma.fileAttachment.update({
        where: { id: a.id },
        data: { filename: newFilename },
      });
    }
    renamed++;
  }

  console.log("");
  console.log(`${DRY_RUN ? "[DRY-RUN] " : ""}Resultado: ${renamed} renombrados · ${skipped.length} skipped`);
  if (skipped.length > 0) {
    console.log("Skipped (motivo):");
    for (const s of skipped) console.log(`  - ${s.id}: ${s.reason}`);
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

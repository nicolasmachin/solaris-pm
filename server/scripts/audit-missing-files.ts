// Auditoría READ-ONLY de integridad: detecta FileAttachments en DB cuyo
// archivo físico no existe en STORAGE_PATH.
//
// Uso:
//   docker compose exec server sh -c "cd /app && node --import tsx scripts/audit-missing-files.ts"
//
// Output:
//   - Total de FileAttachments en DB (no eliminados)
//   - Cuántos tienen archivo físico OK
//   - Cuántos tienen archivo físico FALTANTE
//   - Lista de faltantes con: id · filename · projectId · createdAt · toolSource · url
//
// NO modifica nada. Se queda en disco para auditorías periódicas de integridad.

import { existsSync } from "node:fs";

import { prisma } from "../src/lib/prisma.js";
import { getStoredFilePath } from "../src/services/file-storage.service.js";

const c = {
  ok: "\x1b[32m✓\x1b[0m",
  miss: "\x1b[31m✗\x1b[0m",
  warn: "\x1b[33m!\x1b[0m",
};

async function main() {
  console.log("Auditoría de integridad: FileAttachment vs archivo físico");
  console.log("");

  const all = await prisma.fileAttachment.findMany({
    where: { deletedAt: null },
    select: {
      id: true,
      filename: true,
      url: true,
      projectId: true,
      leadId: true,
      mimeType: true,
      sizeBytes: true,
      toolSource: true,
      toolEntityId: true,
      createdAt: true,
    },
    orderBy: { createdAt: "asc" },
  });

  let okCount = 0;
  const missing: typeof all = [];

  for (const fa of all) {
    const path = getStoredFilePath(fa.url);
    if (existsSync(path)) {
      okCount++;
    } else {
      missing.push(fa);
    }
  }

  // Agrupar faltantes por toolSource para reporte ordenado.
  const byTool = new Map<string, typeof all>();
  for (const m of missing) {
    const key = m.toolSource ?? "(manual upload)";
    if (!byTool.has(key)) byTool.set(key, []);
    byTool.get(key)!.push(m);
  }

  // ─── Reporte ────────────────────────────────────────────────────────────
  console.log(`Total FileAttachments (deletedAt=null): ${all.length}`);
  console.log(`  ${c.ok} con archivo físico:       ${okCount}`);
  console.log(`  ${c.miss} con archivo FALTANTE:    ${missing.length}`);
  console.log("");

  if (missing.length === 0) {
    console.log(`${c.ok} Integridad perfecta. Nada para investigar.`);
    return;
  }

  console.log("Faltantes agrupados por toolSource:");
  for (const [tool, items] of byTool.entries()) {
    console.log(`\n  [${tool}] · ${items.length} archivo${items.length === 1 ? "" : "s"} faltante${items.length === 1 ? "" : "s"}`);
    for (const m of items) {
      const owner = m.projectId
        ? `project=${m.projectId.slice(0, 12)}`
        : m.leadId
          ? `lead=${m.leadId.slice(0, 12)}`
          : "huérfano";
      const created = m.createdAt.toISOString().slice(0, 10);
      console.log(
        `    - ${m.id.slice(0, 12)}… · ${m.filename} · ${owner} · ${created} · ${m.mimeType} · ${m.sizeBytes ?? "?"}b`,
      );
      console.log(`      url: ${m.url}`);
    }
  }

  console.log("");
  console.log(`${c.warn} Recomendación: revisar manualmente. Posibles causas:`);
  console.log("    1. Pérdida del volumen storage (ej: docker compose down -v).");
  console.log("    2. Borrado manual del archivo en disk.");
  console.log("    3. Migración entre entornos sin copiar el volumen.");
  console.log("    Acciones posibles: soft-delete los FA huérfanos, o re-subir los originales.");
}

main()
  .catch((err) => {
    console.error("EXCEPCIÓN:", err);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

// Backfill de snapshots para EFPVersion existentes.
// Para cada versión que tenga snapshotProject IS NULL, construye los 4 snapshots
// con los datos actuales (mejor aproximación al estado del momento — el dato
// histórico no se preservó).
//
// Uso:
//   docker compose exec server sh -c "cd /app && node --import tsx scripts/backfill-efp-snapshots.ts --dry-run"
//   docker compose exec server sh -c "cd /app && node --import tsx scripts/backfill-efp-snapshots.ts"
//
// Idempotente: si la versión ya tiene snapshotProject, se saltea.

import { Prisma } from "@prisma/client";

import { prisma } from "../src/lib/prisma.js";
import {
  parseCantidadPaneles,
  parsePotenciaPanelesW,
  type SnapshotMaterials,
  type SnapshotPreIng,
  type SnapshotProject,
  type SnapshotUte,
} from "../src/services/efp.snapshots.types.js";

const DRY_RUN = process.argv.includes("--dry-run");

async function main() {
  console.log(`${DRY_RUN ? "[DRY-RUN] " : ""}Backfill de snapshots EFPVersion`);

  // Prisma quirk: para campos Json? el NULL SQL se filtra con Prisma.DbNull,
  // no con `null` literal ni `{ equals: null }` (que no matchean nada).
  const versions = await prisma.eFPVersion.findMany({
    where: { snapshotProject: { equals: Prisma.DbNull } },
    select: {
      id: true,
      version: true,
      createdAt: true,
      efp: { select: { projectId: true } },
    },
    orderBy: { createdAt: "asc" },
  });

  console.log(`Encontradas ${versions.length} versión(es) sin snapshot.`);
  if (versions.length === 0) {
    console.log("Nada que hacer.");
    return;
  }

  let ok = 0;
  let failed = 0;
  const failures: Array<{ id: string; reason: string }> = [];

  for (const v of versions) {
    const capturedAt = v.createdAt.toISOString();

    const project = await prisma.project.findFirst({
      where: { id: v.efp.projectId, deletedAt: null },
      select: {
        id: true,
        code: true,
        clientName: true,
        clientAddress: true,
        locationCity: true,
        locationProvince: true,
        capacityKwp: true,
        notificationEmail: true,
      },
    });
    if (!project) {
      failures.push({ id: v.id, reason: `Project ${v.efp.projectId} no encontrado o borrado` });
      failed++;
      continue;
    }

    const snapshotProject: SnapshotProject = {
      id: project.id,
      code: project.code ?? null,
      clientName: project.clientName,
      clientAddress: project.clientAddress,
      locationCity: project.locationCity,
      locationProvince: project.locationProvince,
      capacityKwp: project.capacityKwp ? Number(project.capacityKwp) : null,
      notificationEmail: project.notificationEmail,
      capturedAt,
    };

    const preIng = await prisma.preIngenieriaVersion.findFirst({
      where: { projectId: project.id, createdAt: { lte: v.createdAt } },
      orderBy: { versionNumber: "desc" },
      select: {
        id: true,
        versionNumber: true,
        cantidadPaneles: true,
        potenciaPaneles: true,
        inversor: true,
      },
    });

    const snapshotPreIng: SnapshotPreIng = preIng
      ? {
          versionId: preIng.id,
          version: preIng.versionNumber,
          cantidadPaneles: parseCantidadPaneles(preIng.cantidadPaneles),
          potenciaPanelesW: parsePotenciaPanelesW(preIng.potenciaPaneles),
          inversor: preIng.inversor,
          capturedAt,
        }
      : {
          versionId: null,
          version: null,
          cantidadPaneles: null,
          potenciaPanelesW: null,
          inversor: null,
          capturedAt,
        };

    const ute = await prisma.uteProcess.findFirst({
      where: { projectId: project.id, deletedAt: null },
      orderBy: { createdAt: "asc" },
      select: { caseNumber: true, currentStage: true, currentStatus: true },
    });
    const snapshotUte: SnapshotUte = {
      caseNumber: ute?.caseNumber ?? null,
      currentStage: ute?.currentStage ?? null,
      currentStatus: ute?.currentStatus ?? null,
      capturedAt,
    };

    const materials = await prisma.projectMaterial.findMany({
      where: { projectId: project.id },
      include: {
        materialItem: { select: { id: true, nombre: true, unidad: true } },
      },
    });
    const snapshotMaterials: SnapshotMaterials = {
      items: materials.map((m) => ({
        materialItemId: m.materialItem?.id ?? m.materialItemId,
        description: m.materialItem?.nombre ?? "(sin nombre)",
        quantity: Number(m.quantity),
        unit: m.materialItem?.unidad ?? null,
      })),
      capturedAt,
    };

    console.log(
      `  v${v.version} (${v.id.slice(0, 8)}…) — project ${project.clientName} — preIng: ${
        preIng ? `v${preIng.versionNumber} cant=${snapshotPreIng.cantidadPaneles} pot=${snapshotPreIng.potenciaPanelesW}W` : "ninguna"
      } — ute: ${ute ? `${ute.currentStage}/${ute.currentStatus}` : "ninguna"} — materiales: ${snapshotMaterials.items.length}`,
    );

    if (!DRY_RUN) {
      await prisma.eFPVersion.update({
        where: { id: v.id },
        data: {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          snapshotProject: snapshotProject as any,
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          snapshotPreIng: snapshotPreIng as any,
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          snapshotUte: snapshotUte as any,
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          snapshotMaterials: snapshotMaterials as any,
        },
      });
    }
    ok++;
  }

  console.log("");
  console.log(`${DRY_RUN ? "[DRY-RUN] " : ""}Resultado: ${ok} ok · ${failed} fallidas`);
  if (failures.length > 0) {
    console.log("Fallas:");
    for (const f of failures) console.log(`  - ${f.id}: ${f.reason}`);
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

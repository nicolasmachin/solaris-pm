/**
 * One-shot: propaga el responsable de cada Stage a sus Substages sin asignar.
 *
 * Idempotente: sólo afecta substages con userId=null. Re-correrlo no cambia nada.
 * Sin transacción global: cada stage se procesa independiente; si una falla, las otras siguen.
 *
 * Uso:
 *   docker compose exec server npx tsx scripts/propagate-stage-responsibles.ts
 *   docker compose exec server npx tsx scripts/propagate-stage-responsibles.ts --dry-run
 */

import readline from "node:readline/promises";
import { stdin as input, stdout as output } from "node:process";
import { prisma } from "../src/lib/prisma.js";

interface StageAnalysis {
  stageId: string;
  projectId: string;
  stageName: string;
  responsibleUserId: string;
  unassignedCount: number;
}

async function analyze(): Promise<StageAnalysis[]> {
  const stages = await prisma.stage.findMany({
    where: {
      responsibleUserId: { not: null },
      deletedAt: null,
    },
    select: {
      id: true,
      projectId: true,
      name: true,
      responsibleUserId: true,
    },
  });

  const results: StageAnalysis[] = [];
  for (const stage of stages) {
    const unassignedCount = await prisma.substage.count({
      where: {
        stageId: stage.id,
        userId: null,
        deletedAt: null,
        isActive: true,
      },
    });
    results.push({
      stageId: stage.id,
      projectId: stage.projectId,
      stageName: String(stage.name),
      responsibleUserId: stage.responsibleUserId!,
      unassignedCount,
    });
  }
  return results;
}

async function confirm(question: string): Promise<boolean> {
  const rl = readline.createInterface({ input, output });
  try {
    const answer = await rl.question(question);
    return answer.trim() === "yes";
  } finally {
    rl.close();
  }
}

async function main() {
  const isDryRun = process.argv.includes("--dry-run");
  const start = Date.now();

  console.log("═══════════════════════════════════════════════════════════");
  console.log("  Propagación de responsables de Stage → Substages");
  console.log("═══════════════════════════════════════════════════════════");
  console.log(isDryRun ? "MODO: --dry-run (sin escritura)\n" : "MODO: ejecución real (requiere confirmación)\n");

  console.log("Analizando stages con responsable asignado...");
  const analysis = await analyze();
  const totalStages = analysis.length;
  const stagesWithWork = analysis.filter((s) => s.unassignedCount > 0);
  const totalSubstages = stagesWithWork.reduce((acc, s) => acc + s.unassignedCount, 0);

  console.log(`\nResumen del análisis:`);
  console.log(`  • Stages con responsable asignado: ${totalStages}`);
  console.log(`  • Stages con subetapas sin asignar: ${stagesWithWork.length}`);
  console.log(`  • Subetapas a actualizar: ${totalSubstages}\n`);

  if (stagesWithWork.length === 0) {
    console.log("Nada por hacer. Estado ya consistente.");
    console.log(`\nTiempo total: ${((Date.now() - start) / 1000).toFixed(2)}s`);
    return;
  }

  console.log("Detalle (stageId · proyecto · etapa · responsable · substages a actualizar):");
  for (const s of stagesWithWork) {
    console.log(`  ${s.stageId}  proj=${s.projectId}  ${s.stageName}  user=${s.responsibleUserId}  n=${s.unassignedCount}`);
  }
  console.log("");

  if (isDryRun) {
    console.log("[--dry-run] Sin ejecución. La DB no fue modificada.");
    console.log(`\nTiempo total: ${((Date.now() - start) / 1000).toFixed(2)}s`);
    return;
  }

  const ok = await confirm(`Se actualizarán ${totalSubstages} subetapas en ${stagesWithWork.length} etapas. Continuar? (yes/no) `);
  if (!ok) {
    console.log("Cancelado por el usuario. La DB no fue modificada.");
    return;
  }

  console.log("\nEjecutando updates (una etapa por vez, sin transacción global)...\n");

  let stagesTouched = 0;
  let substagesUpdated = 0;
  let stageErrors = 0;

  for (const s of stagesWithWork) {
    try {
      const result = await prisma.substage.updateMany({
        where: {
          stageId: s.stageId,
          userId: null,
          deletedAt: null,
          isActive: true,
        },
        data: { userId: s.responsibleUserId },
      });
      if (result.count > 0) {
        stagesTouched += 1;
        substagesUpdated += result.count;
        console.log(`  ✓ ${s.stageId} (${s.stageName})  actualizadas: ${result.count}`);
      } else {
        console.log(`  · ${s.stageId} (${s.stageName})  sin cambios (posible race o ya propagado)`);
      }
    } catch (err) {
      stageErrors += 1;
      const msg = err instanceof Error ? err.message : String(err);
      console.error(`  ✗ ${s.stageId} (${s.stageName})  ERROR: ${msg}`);
    }
  }

  const elapsed = ((Date.now() - start) / 1000).toFixed(2);
  console.log("\n═══════════════════════════════════════════════════════════");
  console.log("  Resumen final");
  console.log("═══════════════════════════════════════════════════════════");
  console.log(`  • Etapas analizadas (con responsable): ${totalStages}`);
  console.log(`  • Etapas con al menos 1 subetapa actualizada: ${stagesTouched}`);
  console.log(`  • Subetapas actualizadas en total: ${substagesUpdated}`);
  if (stageErrors > 0) console.log(`  • Etapas con error: ${stageErrors}`);
  console.log(`  • Tiempo total: ${elapsed}s`);
}

main()
  .catch((err) => {
    console.error("\nError catastrófico:", err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

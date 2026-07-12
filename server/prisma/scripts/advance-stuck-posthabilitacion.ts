// Avance de Post-Habilitación atascado.
//
// Contexto: hasta el fix de ute-sync (matcheo de nombres nuevos/viejos de etapa),
// los proyectos con trámite UTE finalizado NO avanzaban automáticamente su etapa
// Post-Habilitación ni se marcaban COMPLETED (el servicio buscaba la etapa por el
// nombre viejo `HABILITACION_UTE`, que tras v8.0 pasó a `TRAMITACION_UTE`).
//
// Este script reprocesa esos proyectos ya finalizados que quedaron atascados,
// usando la MISMA lógica idempotente y guardada del servicio
// (`advancePostventaOnUteFinalizado`): completa Post-Habilitación con la fecha
// del trámite (finalizedAt), NUNCA la de hoy, y cierra el proyecto si corresponde.
//
// Uso:  tsx advance-stuck-posthabilitacion.ts            → DRY-RUN (no toca nada)
//       tsx advance-stuck-posthabilitacion.ts --execute  → aplica

import { prisma } from "../../src/lib/prisma.js";
import {
  advancePostventaOnUteFinalizado,
  planPostventaAdvance,
} from "../../src/services/ute-sync.service.js";

const EXECUTE = process.argv.includes("--execute");

async function main() {
  // Proyectos vivos con trámite UTE finalizado.
  const utes = await prisma.uteProcess.findMany({
    where: {
      deletedAt: null,
      project: { deletedAt: null },
      OR: [{ currentStage: "FINALIZADO" }, { finalizedAt: { not: null } }],
    },
  });

  console.log(`Trámites UTE finalizados (vivos): ${utes.length}`);
  console.log(`Modo: ${EXECUTE ? "EJECUCIÓN" : "DRY-RUN (no toca nada)"}\n`);

  let avanzados = 0;
  const saltados: Record<string, number> = {};

  for (const ute of utes) {
    const stages = await prisma.stage.findMany({
      where: { projectId: ute.projectId, deletedAt: null },
      select: { id: true, name: true, status: true, actualStartDate: true, actualEndDate: true },
    });
    const plan = planPostventaAdvance(ute, stages);
    if (plan.action === "skip") {
      saltados[plan.reason] = (saltados[plan.reason] ?? 0) + 1;
      continue;
    }

    const project = await prisma.project.findUnique({
      where: { id: ute.projectId },
      select: { code: true, clientName: true },
    });
    console.log(
      `• ${project?.code} — ${project?.clientName}: Post-Habilitación → COMPLETED @ ${plan.completedAt.toISOString().slice(0, 10)} (+ cierre de proyecto si todo listo)`,
    );

    if (EXECUTE) await advancePostventaOnUteFinalizado(ute);
    avanzados++;
  }

  console.log(`\n${EXECUTE ? "Avanzados" : "Se avanzarían"}: ${avanzados}`);
  const skipEntries = Object.entries(saltados);
  if (skipEntries.length) {
    console.log("Saltados (esperado):");
    for (const [reason, n] of skipEntries) console.log(`  ${reason}: ${n}`);
  }
  process.exit(0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});

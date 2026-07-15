// Backfill: elimina las subetapas legacy duplicadas de la etapa de UTE.
//
// Contexto: a lo largo del tiempo, distintos templates del pipeline sembraron
// subetapas en la etapa TRAMITACION_UTE / HABILITACION_UTE. Hoy esa etapa la
// puebla ÍNTEGRAMENTE el módulo de Trámites UTE con 11 subetapas system
// (uteAction != null, sincronizadas desde el UteProcess). Todo lo demás son
// restos de templates viejos que DUPLICAN esos pasos:
//   - Set A (isSystem, sin uteAction): "Trámite de microgeneración UTE",
//     "Inspección y aprobación UTE", "Medidor bidireccional".
//   - Set B (isSystem, sin uteAction): "Consulta incial aprobada",
//     "Solicitud IMG enviada", "Solicitud IMG aprobada".
//   - Set C (no-system, sin uteAction): "Docs 1 enviados/aprobados",
//     "Docs 2 enviados/aprobados", "Ensayos enviados/aprobados",
//     "Habilitacion termianada".
//
// IMPORTANTE: algunos nombres legacy coinciden con canónicos ("Ensayos enviados",
// "Ensayos aprobados"), así que el match SIEMPRE filtra por `uteAction: null`
// (las canónicas tienen uteAction != null) para no borrarlas.
//
// El script, por cada etapa UTE: (1) soft-deletea las subetapas legacy (uteAction
// null, moviéndolas a `order` negativo para liberar el unique [stageId, order]);
// (2) corre regenerateUteSubstages (o ensureUteSubstages si no hay UteProcess)
// para garantizar las 11 canónicas y su status desde las fechas del UteProcess.
// NO toca las 11 canónicas ni subetapas custom del usuario (ej. "prueba").
// Soft-delete: reversible, no se pierde nada.
//
// Idempotente. Correr con:
//   docker compose exec server node --import tsx scripts/cleanup-ute-substage-duplicates.ts

import { PrismaClient } from "@prisma/client";

import { ensureUteSubstages, regenerateUteSubstages } from "../src/services/ute-sync.service.js";

const prisma = new PrismaClient();

const UTE_STAGE_NAMES = ["TRAMITACION_UTE", "HABILITACION_UTE"];

// Nombres exactos de subetapas de templates viejos que duplican los 11 pasos
// canónicos. Solo se soft-deletean las que tengan uteAction = null.
const LEGACY_NAMES = [
  // Set A
  "Trámite de microgeneración UTE",
  "Inspección y aprobación UTE",
  "Medidor bidireccional",
  // Set B
  "Consulta incial aprobada",
  "Solicitud IMG enviada",
  "Solicitud IMG aprobada",
  // Set C
  "Docs 1 enviados",
  "Docs 1 aprobados",
  "Docs 2 enviados",
  "Docs 2 aprobados",
  "Ensayos enviados",
  "Ensayos aprobados",
  "Habilitacion termianada",
];

async function main() {
  console.log("=== Limpieza de subetapas UTE duplicadas ===\n");

  const stages = await prisma.stage.findMany({
    where: { name: { in: UTE_STAGE_NAMES }, deletedAt: null, project: { deletedAt: null } },
    select: { id: true, project: { select: { id: true, code: true } } },
    orderBy: { project: { code: "asc" } },
  });

  // Paso 1: soft-delete de las legacy por nombre (solo uteAction null), en cada etapa UTE.
  let legacyEliminadas = 0;
  const stagesConDup = new Set<string>();

  for (const stage of stages) {
    const legacy = await prisma.substage.findMany({
      where: { stageId: stage.id, name: { in: LEGACY_NAMES }, uteAction: null, deletedAt: null },
      select: { id: true },
    });
    if (legacy.length === 0) continue;

    // Órdenes negativos por debajo del mínimo actual de la etapa (incluye
    // soft-deleted de corridas previas) para liberar el slot del unique sin chocar.
    const minAgg = await prisma.substage.aggregate({
      where: { stageId: stage.id },
      _min: { order: true },
    });
    let nextOrder = Math.min(minAgg._min.order ?? 0, 0) - 1;
    for (const s of legacy) {
      await prisma.substage.update({
        where: { id: s.id },
        data: { deletedAt: new Date(), order: nextOrder },
      });
      nextOrder--;
    }
    legacyEliminadas += legacy.length;
    stagesConDup.add(stage.project.code);
    console.log(`  ✓ ${stage.project.code}: ${legacy.length} subetapa(s) legacy eliminada(s)`);
  }

  // Paso 2: sanar las canónicas (recrea las que falten + status desde el UteProcess).
  const projectIds = [...new Set(stages.map((s) => s.project.id))];
  let sanados = 0;
  for (const projectId of projectIds) {
    const uteProcess = await prisma.uteProcess.findFirst({
      where: { projectId, deletedAt: null },
      orderBy: { createdAt: "desc" },
    });
    if (uteProcess) {
      await regenerateUteSubstages(prisma, uteProcess);
    } else {
      await ensureUteSubstages(prisma, projectId);
    }
    sanados++;
  }

  console.log("\n=== Completado ===");
  console.log(`  Etapas UTE revisadas:         ${stages.length}`);
  console.log(`  Etapas con duplicados:        ${stagesConDup.size}`);
  console.log(`  Subetapas legacy eliminadas:  ${legacyEliminadas}`);
  console.log(`  Proyectos re-sincronizados:   ${sanados}`);
}

main()
  .catch((err) => {
    console.error("\n✗ Error en la limpieza:", err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());

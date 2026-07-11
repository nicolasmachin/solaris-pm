// Migración de datos: pipeline viejo de 5 etapas → 8 etapas + 2 paralelas de
// Experiencia Solar. Estrategia "por fase" (validada con el usuario):
//   - ONBOARDING: se preserva tal cual.
//   - INGENIERIA → PRE_INGENIERIA + VALIDACION_OPERACIONES + INGENIERIA_FINAL
//   - OPERACIONES → COMPRAS + EJECUCION_OBRA
//   - HABILITACION_UTE → TRAMITACION_UTE (rename in-place, conserva sub-etapas/estado UTE)
//   - POSTVENTA → POST_HABILITACION (rename in-place)
//   - + SEGUIMIENTO_PREOBRA, SEGUIMIENTO_HABILITACION (nuevas, PENDING)
// El estado de las etapas divididas se propaga por fase. UTE, herramientas
// (contrato/proforma/consulta) y datos del proyecto se preservan.
//
// Uso:  tsx migrate-pipeline-8-stages.ts            → DRY-RUN (reporta, no toca nada)
//       tsx migrate-pipeline-8-stages.ts --execute  → aplica

import { StageStatus, StageType, SubstageStatus } from "@prisma/client";

import { prisma } from "../../src/lib/prisma.js";
import { PIPELINE_DEFINITIONS } from "../../src/services/pipeline-definitions.js";

const EXECUTE = process.argv.includes("--execute");

const OLD_STAGES = [
  StageType.ONBOARDING,
  StageType.INGENIERIA,
  StageType.OPERACIONES,
  StageType.HABILITACION_UTE,
  StageType.POSTVENTA,
];

const NEW_ORDER: Record<string, number> = {
  ONBOARDING: 1,
  PRE_INGENIERIA: 2,
  VALIDACION_OPERACIONES: 3,
  INGENIERIA_FINAL: 4,
  COMPRAS: 5,
  EJECUCION_OBRA: 6,
  TRAMITACION_UTE: 7,
  POST_HABILITACION: 8,
  SEGUIMIENTO_PREOBRA: 9,
  SEGUIMIENTO_HABILITACION: 10,
};

// Propaga el estado de una etapa vieja a N etapas nuevas.
function splitStatuses(old: StageStatus, count: number): StageStatus[] {
  if (old === StageStatus.COMPLETED) return Array(count).fill(StageStatus.COMPLETED);
  if (old === StageStatus.IN_PROGRESS)
    return [StageStatus.IN_PROGRESS, ...Array(count - 1).fill(StageStatus.PENDING)];
  return Array(count).fill(StageStatus.PENDING);
}

type StageRow = { id: string; name: StageType; status: StageStatus; order: number; plannedStartDate: Date | null; plannedEndDate: Date | null; actualStartDate: Date | null; actualEndDate: Date | null };

async function main() {
  const projects = await prisma.project.findMany({
    where: { deletedAt: null },
    select: { id: true, code: true, clientName: true, stages: { select: { id: true, name: true, status: true, order: true, plannedStartDate: true, plannedEndDate: true, actualStartDate: true, actualEndDate: true } } },
  });

  const target = projects.filter((p) => {
    const names = new Set(p.stages.map((s) => s.name));
    // Migrar solo los que tienen la estructura vieja (al menos INGENIERIA y OPERACIONES).
    return names.has(StageType.INGENIERIA) && names.has(StageType.OPERACIONES);
  });

  console.log(`Proyectos totales: ${projects.length} · a migrar (estructura vieja): ${target.length}\n`);
  console.log(`Modo: ${EXECUTE ? "EJECUCIÓN" : "DRY-RUN (no toca nada)"}\n`);

  let migrados = 0;
  const problemas: string[] = [];

  for (const p of target) {
    const byName = new Map(p.stages.map((s) => [s.name, s as StageRow]));
    const ing = byName.get(StageType.INGENIERIA);
    const op = byName.get(StageType.OPERACIONES);
    const ute = byName.get(StageType.HABILITACION_UTE);
    const post = byName.get(StageType.POSTVENTA);
    if (!ing || !op) {
      problemas.push(`${p.code}: falta INGENIERIA u OPERACIONES`);
      continue;
    }

    const ingS = splitStatuses(ing.status, 3); // PRE_INGENIERIA, VALIDACION_OPERACIONES, INGENIERIA_FINAL
    const opS = splitStatuses(op.status, 2); // COMPRAS, EJECUCION_OBRA

    console.log(
      `• ${p.code} — ${p.clientName}\n` +
        `    INGENIERIA(${ing.status}) → PRE_INGENIERIA(${ingS[0]}), VALIDACION_OPERACIONES(${ingS[1]}), INGENIERIA_FINAL(${ingS[2]})\n` +
        `    OPERACIONES(${op.status}) → COMPRAS(${opS[0]}), EJECUCION_OBRA(${opS[1]})\n` +
        `    HABILITACION_UTE${ute ? `(${ute.status})` : "(falta)"} → TRAMITACION_UTE  ·  POSTVENTA${post ? `(${post.status})` : "(falta)"} → POST_HABILITACION\n` +
        `    + SEGUIMIENTO_PREOBRA, SEGUIMIENTO_HABILITACION (nuevas)`,
    );

    if (!EXECUTE) {
      migrados++;
      continue;
    }

    await prisma.$transaction(async (tx) => {
      // 1) Borrar las etapas que se dividen (cascade borra sus sub-etapas/checklist).
      await tx.stage.delete({ where: { id: ing.id } });
      await tx.stage.delete({ where: { id: op.id } });
      // 2) Renombrar UTE y Postventa in-place (preservan sub-etapas + estado).
      if (ute) await tx.stage.update({ where: { id: ute.id }, data: { name: StageType.TRAMITACION_UTE, order: NEW_ORDER.TRAMITACION_UTE } });
      if (post) await tx.stage.update({ where: { id: post.id }, data: { name: StageType.POST_HABILITACION, order: NEW_ORDER.POST_HABILITACION } });
      // 3) Crear las etapas nuevas (divisiones + carriles CX).
      await createStage(tx, p.id, StageType.PRE_INGENIERIA, ingS[0], ing);
      await createStage(tx, p.id, StageType.VALIDACION_OPERACIONES, ingS[1], ing);
      await createStage(tx, p.id, StageType.INGENIERIA_FINAL, ingS[2], ing);
      await createStage(tx, p.id, StageType.COMPRAS, opS[0], op);
      await createStage(tx, p.id, StageType.EJECUCION_OBRA, opS[1], op);
      await createStage(tx, p.id, StageType.SEGUIMIENTO_PREOBRA, StageStatus.PENDING, null);
      await createStage(tx, p.id, StageType.SEGUIMIENTO_HABILITACION, StageStatus.PENDING, null);
    });
    migrados++;
  }

  console.log(`\n${EXECUTE ? "Migrados" : "Se migrarían"}: ${migrados} proyectos.`);
  if (problemas.length) console.log(`Problemas (${problemas.length}):\n  ${problemas.join("\n  ")}`);
  process.exit(0);
}

async function createStage(
  tx: Parameters<Parameters<typeof prisma.$transaction>[0]>[0],
  projectId: string,
  name: StageType,
  status: StageStatus,
  refOldStage: StageRow | null,
) {
  const def = PIPELINE_DEFINITIONS.find((d) => d.name === name);
  const isDone = status === StageStatus.COMPLETED;
  const stage = await tx.stage.create({
    data: {
      projectId,
      order: NEW_ORDER[name],
      name,
      status,
      progressPercent: isDone ? 100 : 0,
      tipoObra: null,
      plannedStartDate: refOldStage?.plannedStartDate ?? null,
      plannedEndDate: refOldStage?.plannedEndDate ?? null,
      actualStartDate: isDone ? refOldStage?.actualStartDate ?? refOldStage?.actualEndDate ?? null : null,
      actualEndDate: isDone ? refOldStage?.actualEndDate ?? null : null,
    },
  });

  const subs = def?.substages ?? [];
  for (let i = 0; i < subs.length; i++) {
    const sub = subs[i];
    // Etapa completa → todas las sub completas. En curso → la primera completa
    // (para que la etapa se muestre "en curso" con progreso > 0). Pendiente → todas pendientes.
    const subStatus: SubstageStatus =
      isDone || (status === StageStatus.IN_PROGRESS && i === 0)
        ? SubstageStatus.COMPLETED
        : SubstageStatus.PENDING;
    const created = await tx.substage.create({
      data: {
        projectId,
        stageId: stage.id,
        order: sub.order,
        name: sub.name,
        sopCode: sub.sopCode ?? null,
        responsableRol: sub.responsableRol ?? null,
        responsible: sub.responsible,
        status: subStatus,
        progressPercent: subStatus === SubstageStatus.COMPLETED ? 100 : 0,
        isSystem: sub.isSystem ?? true,
        isActive: sub.isActive ?? true,
      },
    });
    if (sub.checklist?.length) {
      await tx.checklistItem.createMany({
        data: sub.checklist.map((it, idx) => ({
          substageId: created.id,
          projectId,
          order: idx + 1,
          label: it.label,
          isRequired: it.isRequired ?? false,
          isBlocker: it.isBlocker ?? false,
          completed: subStatus === SubstageStatus.COMPLETED,
          appliesWhenModalidadPago: it.appliesWhenModalidadPago ?? null,
        })),
      });
    }
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});

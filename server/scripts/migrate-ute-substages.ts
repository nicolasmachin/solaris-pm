// Migración: regenera las subetapas de la etapa HABILITACION_UTE de cada
// proyecto a partir del UteProcess. Backupea las substages actuales (incluso
// las custom isSystem=false) en audit_logs y las hard-deletea (cascade
// borra ChecklistItems). Después corre regenerateUteSubstages para crear las
// 11 system y setear su status según las fechas del UteProcess.
//
// Idempotente: correrlo dos veces no rompe nada porque el segundo backup
// vendría con array vacío (no hay substages custom restantes) y la regeneración
// detecta las 11 system existentes y sólo las re-syncea.
//
// Correr con: docker compose exec server node --import tsx scripts/migrate-ute-substages.ts

import { PrismaClient } from "@prisma/client";

import {
  regenerateUteSubstages,
  UTE_SUBSTAGE_SPECS,
} from "../src/services/ute-sync.service.js";

const prisma = new PrismaClient();

async function main() {
  console.log("=== Migración UteProcess ↔ subetapas ===\n");

  // Necesitamos un user ADMIN para los AuditLog y para createdById de UteProcess
  // creados durante la migración. AuditLog.userId es NOT NULL.
  const adminUser = await prisma.user.findFirst({
    where: { role: { name: "ADMIN" }, deletedAt: null },
    orderBy: { createdAt: "asc" },
  });
  if (!adminUser) {
    throw new Error("No se encontró un user ADMIN para registrar la migración");
  }
  console.log(`Audit user: ${adminUser.email} (${adminUser.id})\n`);

  const projects = await prisma.project.findMany({
    where: { deletedAt: null },
    include: {
      uteProcesses: {
        where: { deletedAt: null },
        orderBy: { createdAt: "desc" },
        take: 1,
      },
      stages: {
        where: { name: "HABILITACION_UTE", deletedAt: null },
        include: {
          substages: {
            where: { deletedAt: null },
            include: { checklistItems: true },
          },
        },
      },
    },
    orderBy: { code: "asc" },
  });

  console.log(`Encontrados ${projects.length} proyectos activos.\n`);

  let created = 0;
  let migrated = 0;
  let skipped = 0;
  let totalBackedUp = 0;

  for (const project of projects) {
    const stage = project.stages[0];
    if (!stage) {
      console.log(`  ⚠  ${project.code}: sin etapa HABILITACION_UTE — saltando`);
      skipped++;
      continue;
    }

    let uteProcess = project.uteProcesses[0];
    if (!uteProcess) {
      uteProcess = await prisma.uteProcess.create({
        data: {
          projectId: project.id,
          currentStage: "CONSULTA",
          currentStatus: "PENDIENTE",
          createdById: adminUser.id,
        },
      });
      created++;
      console.log(`  + ${project.code}: UteProcess creado`);
    }

    // Sólo "legacy/custom" — sin uteAction. Las que ya tienen uteAction (de
    // runs anteriores de esta migración) se quedan y re-syncean.
    const subsToBackup = stage.substages.filter((s) => s.uteAction == null);

    // Para evitar conflicto con el unique (stageId, order) hard-deleteamos
    // TODAS las substages legacy del stage (alive + soft-deleted) que NO
    // tengan uteAction. Las soft-deleted no van al backup (ya estaban
    // descartadas antes).
    const allOldNonUte = await prisma.substage.findMany({
      where: { stageId: stage.id, uteAction: null },
      select: { id: true },
    });

    if (subsToBackup.length > 0) {
      await prisma.auditLog.create({
        data: {
          entityType: "substage",
          entityId: stage.id,
          projectId: project.id,
          userId: adminUser.id,
          action: "updated",
          fieldChanged: "BACKUP_BEFORE_UTE_SYNC",
          description: `Backup de ${subsToBackup.length} subetapas de HABILITACION_UTE antes de regenerar desde UteProcess`,
          metadata: {
            stageId: stage.id,
            projectCode: project.code,
            count: subsToBackup.length,
            substages: subsToBackup.map((s) => ({
              id: s.id,
              order: s.order,
              name: s.name,
              status: s.status,
              isSystem: s.isSystem,
              uteAction: s.uteAction ?? null,
              userId: s.userId,
              dueDate: s.dueDate?.toISOString() ?? null,
              plannedStartDate: s.plannedStartDate?.toISOString() ?? null,
              plannedEndDate: s.plannedEndDate?.toISOString() ?? null,
              actualStartDate: s.actualStartDate?.toISOString() ?? null,
              actualEndDate: s.actualEndDate?.toISOString() ?? null,
              notes: s.notes,
              deadline: s.deadline?.toISOString() ?? null,
              checklistItems: s.checklistItems.map((ci) => ({
                id: ci.id,
                order: ci.order,
                label: ci.label,
                completed: ci.completed,
                isRequired: ci.isRequired,
              })),
            })),
          },
        },
      });
      totalBackedUp += subsToBackup.length;
    }

    if (allOldNonUte.length > 0) {
      await prisma.substage.deleteMany({
        where: { id: { in: allOldNonUte.map((s) => s.id) } },
      });
    }

    await regenerateUteSubstages(prisma, uteProcess);
    migrated++;
    console.log(`  ✓ ${project.code}: ${subsToBackup.length} subs viejas → backup + ${UTE_SUBSTAGE_SPECS.length} subs system`);
  }

  console.log("\n=== Migración completada ===");
  console.log(`  UteProcess creados:    ${created}`);
  console.log(`  Proyectos migrados:    ${migrated}`);
  console.log(`  Saltados (sin stage):  ${skipped}`);
  console.log(`  Substages backupeadas: ${totalBackedUp}`);
}

main()
  .catch((err) => {
    console.error("\n✗ Error en migración:", err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());

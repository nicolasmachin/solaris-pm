// Backfill: las subetapas de Validación de Operaciones y de Ejecución de Obra
// que le faltan a un proyecto, según la definición vigente del pipeline.
//
// Por qué: el 10-oct-2026 se rediseñaron esas etapas (Presupuesto al
// instalador tercerizado; Realización de la obra, Retiro de sobrantes y
// Control de obra) y se decidió aplicarlas solo a los proyectos nuevos. El
// 11-oct-2026 Nicolás pidió que todos los proyectos las tengan: el manual de
// Operaciones las explica y los proyectos viejos mostraban otras.
//
// Qué hace, por etapa:
//   - Crea cada subetapa de la definición que el proyecto no tiene (se compara
//     el nombre sin mayúsculas: "Planificación y Logística" = "Planificación y
//     logística"), con su checklist.
//       · Si la etapa ya está COMPLETED, la subetapa entra COMPLETED y su
//         checklist tildado: no se reabre una obra cerrada ni se disparan
//         plazos o avisos.
//       · Si no, entra PENDING.
//   - En una Ejecución de Obra que no está terminada, da de baja (deletedAt)
//     las subetapas viejas que ya no están en la definición y que nadie
//     empezó (PENDING y sin ningún ítem del checklist tildado). Las que tienen
//     trabajo hecho se dejan.
//
// Idempotente: volver a correrlo no crea nada nuevo.
//
// Correr (primero sin --aplicar, que solo cuenta):
//   docker compose exec server node --import tsx scripts/backfill-subetapas-operaciones.ts
//   docker compose exec server node --import tsx scripts/backfill-subetapas-operaciones.ts --aplicar

import { PrismaClient, StageStatus, StageType, SubstageStatus } from "@prisma/client";
import { getActivePipelineTemplate } from "../src/services/pipeline-definitions.js";

const prisma = new PrismaClient();
const APLICAR = process.argv.includes("--aplicar");
const ETAPAS: StageType[] = [StageType.VALIDACION_OPERACIONES, StageType.EJECUCION_OBRA];
const clave = (s: string) => s.trim().toLocaleLowerCase("es");

async function main() {
  console.log(`=== Subetapas de Operaciones ${APLICAR ? "(APLICANDO)" : "(prueba: no escribe nada)"} ===\n`);
  const template = await getActivePipelineTemplate();
  const ahora = new Date();
  let creadas = 0;
  let bajas = 0;
  const proyectos = new Set<string>();

  for (const tipo of ETAPAS) {
    const def = template.find((s) => s.name === tipo);
    if (!def) {
      console.log(`  · ${tipo}: no está en la definición, se saltea`);
      continue;
    }
    const nombres = new Set(def.substages.map((s) => clave(s.name)));
    const etapas = await prisma.stage.findMany({
      where: { name: tipo, project: { deletedAt: null } },
      include: {
        substages: { where: { deletedAt: null }, include: { checklistItems: true } },
        project: { select: { code: true } },
      },
    });

    for (const etapa of etapas) {
      const cerrada = etapa.status === StageStatus.COMPLETED;
      // El orden es único por etapa, contando también las dadas de baja: las
      // nuevas van después de la última.
      const max = await prisma.substage.aggregate({ where: { stageId: etapa.id }, _max: { order: true } });
      let siguiente = (max._max.order ?? 0) + 1;
      const tiene = new Set(etapa.substages.map((s) => clave(s.name)));

      for (const sub of def.substages) {
        if (tiene.has(clave(sub.name))) continue;
        creadas++;
        proyectos.add(etapa.project.code);
        console.log(`  + ${etapa.project.code} · ${tipo} · ${sub.name} (${cerrada ? "completada" : "pendiente"})`);
        if (!APLICAR) continue;
        const nueva = await prisma.substage.create({
          data: {
            projectId: etapa.projectId,
            stageId: etapa.id,
            order: siguiente++,
            name: sub.name,
            sopCode: sub.sopCode,
            responsableRol: sub.responsableRol,
            status: cerrada ? SubstageStatus.COMPLETED : SubstageStatus.PENDING,
            progressPercent: cerrada ? 100 : 0,
            responsible: sub.responsible,
            isSystem: sub.isSystem ?? true,
            isActive: sub.isActive ?? true,
            actualEndDate: cerrada ? (etapa.actualEndDate ?? null) : null,
          },
        });
        const items = sub.checklist ?? [];
        if (items.length > 0) {
          await prisma.checklistItem.createMany({
            data: items.map((it, i) => ({
              substageId: nueva.id,
              projectId: etapa.projectId,
              order: i + 1,
              label: it.label,
              isRequired: it.isRequired ?? false,
              isBlocker: it.isBlocker ?? false,
              evidenceKind: it.evidenceKind ?? null,
              appliesWhenModalidadPago: it.appliesWhenModalidadPago ?? null,
              completed: cerrada,
              completedAt: cerrada ? ahora : null,
            })),
          });
        }
      }

      // Las viejas de una Ejecución en curso que nadie empezó.
      if (tipo === StageType.EJECUCION_OBRA && !cerrada) {
        for (const vieja of etapa.substages) {
          if (nombres.has(clave(vieja.name))) continue;
          const empezada =
            vieja.status !== SubstageStatus.PENDING || vieja.checklistItems.some((it) => it.completed);
          if (empezada) continue;
          bajas++;
          proyectos.add(etapa.project.code);
          console.log(`  - ${etapa.project.code} · ${tipo} · ${vieja.name} (vieja, sin empezar: se da de baja)`);
          if (APLICAR) {
            await prisma.substage.update({ where: { id: vieja.id }, data: { deletedAt: ahora } });
          }
        }
      }
    }
  }

  console.log(`\nProyectos tocados: ${proyectos.size}`);
  console.log(`Subetapas ${APLICAR ? "creadas" : "a crear"}: ${creadas}`);
  console.log(`Subetapas viejas ${APLICAR ? "dadas de baja" : "a dar de baja"}: ${bajas}`);
  if (!APLICAR) console.log("\nNo se escribió nada. Para aplicar: --aplicar");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());

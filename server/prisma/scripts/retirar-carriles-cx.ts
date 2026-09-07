/**
 * Retira de los proyectos los carriles viejos de Experiencia Solar.
 *
 * Contexto: `SEGUIMIENTO_PREOBRA` y `SEGUIMIENTO_HABILITACION` vivían dentro del
 * pipeline del proyecto. Se movieron al módulo de Experiencia Solar (modelo
 * `RecorridoCheck`), donde pueden tener plazo y vencer sin frenar la obra.
 *
 * Medido en producción antes de correrlo: **71 proyectos los tenían y solo 1
 * estaba completado**. En la práctica no se usaban — eran casillas que se tildan
 * una vez y quedan tildadas para siempre, que es justamente lo que se corrigió.
 *
 * Es un **soft-delete**: se marca `deletedAt`, no se borra nada. Si hubiera que
 * volver atrás, se limpia ese campo. Las subetapas y sus checklist quedan como
 * están, colgando de un stage borrado.
 *
 *   # ver qué haría, sin tocar nada:
 *   docker compose exec server npx tsx prisma/scripts/retirar-carriles-cx.ts
 *   # aplicar:
 *   docker compose exec server npx tsx prisma/scripts/retirar-carriles-cx.ts --apply
 */

import { PrismaClient, StageType } from "@prisma/client";

const prisma = new PrismaClient();
const APPLY = process.argv.includes("--apply");

const CARRILES = [StageType.SEGUIMIENTO_PREOBRA, StageType.SEGUIMIENTO_HABILITACION];

async function main(): Promise<void> {
  const stages = await prisma.stage.findMany({
    where: { name: { in: CARRILES }, deletedAt: null },
    select: {
      id: true,
      name: true,
      status: true,
      project: { select: { clientName: true } },
      substages: { where: { deletedAt: null }, select: { status: true } },
    },
  });

  if (stages.length === 0) {
    console.log("No hay carriles de Experiencia Solar en el pipeline. Nada que hacer.");
    return;
  }

  // Los que tienen algo tildado se listan aparte: no se pierde el dato (es
  // soft-delete), pero conviene saber cuáles eran.
  const conAvance = stages.filter(
    (s) => s.status === "COMPLETED" || s.substages.some((ss) => ss.status === "COMPLETED"),
  );

  console.log(`Carriles a retirar: ${stages.length} (en ${new Set(stages.map((s) => s.project.clientName)).size} proyectos)`);
  console.log(`  Con algún avance tildado: ${conAvance.length}`);
  for (const s of conAvance) {
    console.log(`    · ${s.project.clientName} — ${s.name}`);
  }

  if (!APPLY) {
    console.log("\nSimulación. Correr con --apply para aplicar (soft-delete, reversible).");
    return;
  }

  const res = await prisma.stage.updateMany({
    where: { name: { in: CARRILES }, deletedAt: null },
    data: { deletedAt: new Date() },
  });
  console.log(`\nRetirados: ${res.count}. Es soft-delete: se revierte limpiando deletedAt.`);
  console.log("El acompañamiento ahora vive en la pestaña Pasos de la ficha del cliente.");
}

main()
  .then(() => prisma.$disconnect())
  .catch(async (err) => {
    console.error("[retirar-carriles] error:", err);
    await prisma.$disconnect();
    process.exitCode = 1;
  });

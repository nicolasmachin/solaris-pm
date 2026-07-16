// Backfill: setea Project.actualUteEnd desde la fecha de fin de la etapa de UTE
// (TRAMITACION_UTE / HABILITACION_UTE .actualEndDate) para proyectos que
// finalizaron el trámite antes de que existiera el sync automático (hoy en
// api.routes.ts: `projectSync.actualUteEnd = stageAfter.actualEndDate`).
//
// Esa fecha es el ancla de "puesta en marcha": habilita la columna
// "Próx. mantenimiento" en Experiencia Solar y el cron de encuestas de
// aniversario para esos proyectos.
//
// Idempotente: solo toca proyectos con actualUteEnd null. No pisa nada existente.
//
// Correr con: docker compose exec server node --import tsx scripts/backfill-project-ute-end.ts

import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  console.log("=== Backfill: Project.actualUteEnd desde la etapa de UTE ===\n");

  const stages = await prisma.stage.findMany({
    where: {
      name: { in: ["TRAMITACION_UTE", "HABILITACION_UTE"] },
      deletedAt: null,
      actualEndDate: { not: null },
      project: { deletedAt: null, actualUteEnd: null },
    },
    select: { projectId: true, actualEndDate: true, project: { select: { code: true } } },
    orderBy: { actualEndDate: "desc" },
  });

  // Un proyecto podría tener las dos etapas (viejo+nuevo); nos quedamos con la
  // fecha más reciente (el orderBy desc + first-wins del Map lo garantiza).
  const byProject = new Map<string, { fecha: Date; code: string }>();
  for (const s of stages) {
    if (!s.actualEndDate) continue;
    if (!byProject.has(s.projectId)) {
      byProject.set(s.projectId, { fecha: s.actualEndDate, code: s.project.code });
    }
  }

  let seteados = 0;
  for (const [projectId, { fecha, code }] of byProject) {
    await prisma.project.update({ where: { id: projectId }, data: { actualUteEnd: fecha } });
    seteados++;
    console.log(`  ✓ ${code}: actualUteEnd = ${fecha.toISOString().slice(0, 10)}`);
  }

  console.log("\n=== Completado ===");
  console.log(`  Proyectos con fecha de fin de UTE seteada: ${seteados}`);
}

main()
  .catch((err) => {
    console.error("\n✗ Error en el backfill:", err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());

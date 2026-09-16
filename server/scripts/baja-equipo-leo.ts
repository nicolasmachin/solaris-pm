/**
 * One-shot: da de baja el equipo "Leo" CONSERVANDO el histórico.
 *
 * Decisión de negocio (16/9/2026): las obras que hizo Leo siguen mostrando su
 * nombre. Quien mire para atrás tiene que poder ver quién las hizo; dejarlas
 * "sin equipo" perdería ese dato para siempre.
 *
 * Por eso el script NO toca las obras: solo marca el equipo como borrado
 * (`deletedAt`), que es lo que lo saca del selector y de los filtros. El nombre
 * y el color siguen guardados en cada `InstallationSchedule` (`teamName`,
 * `teamColor`), que están desnormalizados justamente para esto, así que el
 * bloque se sigue pintando igual que siempre.
 *
 * Idempotente.
 *
 *   docker compose exec server npx tsx scripts/baja-equipo-leo.ts
 */

import { prisma } from "../src/lib/prisma.js";

const NOMBRE_EQUIPO = "Leo";

async function main() {
  const equipo = await prisma.team.findFirst({
    where: { name: NOMBRE_EQUIPO },
    select: { id: true, name: true, deletedAt: true },
  });

  if (!equipo) {
    console.log(`El equipo "${NOMBRE_EQUIPO}" no existe. Nada que hacer.`);
    return;
  }

  const obras = await prisma.installationSchedule.findMany({
    where: { OR: [{ teamId: equipo.id }, { teamName: NOMBRE_EQUIPO }], deletedAt: null },
    select: { id: true, project: { select: { code: true, clientName: true } } },
  });

  console.log(`Equipo "${equipo.name}" — ${obras.length} obra(s) en el histórico:`);
  for (const o of obras) {
    console.log(`  · ${o.project?.code ?? "?"} — ${o.project?.clientName ?? "?"}`);
  }
  console.log("\nEsas obras NO se tocan: siguen mostrando a Leo como responsable.");

  if (equipo.deletedAt) {
    console.log(`\nEl equipo ya estaba dado de baja. Nada que hacer.`);
    return;
  }

  await prisma.team.update({ where: { id: equipo.id }, data: { deletedAt: new Date() } });
  console.log(`\nEquipo "${equipo.name}" dado de baja: ya no se puede asignar a nada nuevo.`);
}

main()
  .catch((error) => {
    console.error("Falló:", error);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());

/**
 * Retira de los proyectos el paso "Repaso de garantías" del recorrido de
 * Experiencia Solar (`e3_garantias`).
 *
 * Contexto: el paso no se hacía. La garantía ya está en el contrato firmado y el
 * paso no producía ningún documento nuevo — era un recordatorio que sumaba un
 * renglón a la lista de E3 sin sumar trabajo real. Se saca del catálogo
 * (`services/clientes/recorrido-checks.ts`) y de las plantillas de mensajes.
 *
 * Medido en producción antes de correrlo: 72 filas, 28 tildadas, y las 28 se
 * marcaron el mismo día y dentro del mismo minuto que otros checks de E3 del
 * mismo proyecto. Es una limpieza en masa, no 28 repasos de garantías: por eso se
 * borra sin perder nada que interese.
 *
 * Es un **borrado duro**: `RecorridoCheck` no tiene `deletedAt`. Lo que se pierde
 * es "quién tildó este paso y cuándo", que en este caso es el rastro de esa
 * limpieza. Si hiciera falta volver atrás, el paso se recrea solo al listar los
 * checks de un proyecto (`ensureChecks`) con solo devolver la definición al
 * catálogo; lo que no vuelve es el tildado.
 *
 * Además baja de 5 a 4 el orden del paso del portal, que era el que venía después.
 *
 *   # ver qué haría, sin tocar nada:
 *   docker compose exec server npx tsx prisma/scripts/retirar-check-garantias.ts
 *   # aplicar:
 *   docker compose exec server npx tsx prisma/scripts/retirar-check-garantias.ts --apply
 */

import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();
const APPLY = process.argv.includes("--apply");

const CODIGO = "e3_garantias";

async function main(): Promise<void> {
  const filas = await prisma.recorridoCheck.findMany({
    where: { codigo: CODIGO },
    select: {
      completadoEn: true,
      venceEn: true,
      nota: true,
      project: { select: { clientName: true } },
    },
  });

  const completadas = filas.filter((f) => f.completadoEn !== null).length;
  const conNota = filas.filter((f) => f.nota !== null);

  console.log(`Paso "${CODIGO}" en la base:`);
  console.log(`  filas          ${filas.length}`);
  console.log(`  tildadas       ${completadas}`);
  console.log(`  con plazo      ${filas.filter((f) => f.venceEn !== null).length}`);
  console.log(`  con nota       ${conNota.length}`);

  // Una nota es texto que alguien escribió a mano: si aparece, hay que mirarla
  // antes de borrar. En producción no había ninguna.
  for (const f of conNota) {
    console.log(`    ⚠ ${f.project.clientName}: ${f.nota}`);
  }

  const desordenados = await prisma.recorridoCheck.count({
    where: { codigo: "e3_portal_recorrido", orden: { not: 4 } },
  });
  console.log(`Paso del portal con el orden viejo: ${desordenados}`);

  if (filas.length === 0 && desordenados === 0) {
    console.log("\nNada que hacer.");
    return;
  }

  if (!APPLY) {
    console.log("\n(simulación — nada se tocó; agregá --apply para aplicarlo)");
    return;
  }

  const borradas = await prisma.recorridoCheck.deleteMany({ where: { codigo: CODIGO } });
  const reordenados = await prisma.recorridoCheck.updateMany({
    where: { codigo: "e3_portal_recorrido" },
    data: { orden: 4 },
  });
  console.log(`\nBorradas ${borradas.count} filas. Reordenados ${reordenados.count} pasos del portal.`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());

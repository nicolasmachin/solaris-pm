/**
 * Deshace las habilitaciones que nunca ocurrieron.
 *
 * Un trámite marcado "Finalizado" desde el selector de etapa, sin fecha de
 * habilitación, disparaba igual el aviso de "ya podés encender" y los pasos de
 * E3. Le pasó a un cliente que ni siquiera hizo la obra. El código ya no lo
 * permite (ver `marcarHabilitacionEnProyecto` y la validación de hitos en el
 * PATCH de trámites); esto limpia lo que quedó mal de antes.
 *
 * Toca SOLO proyectos cuyo trámite esté en FINALIZADO **sin `finalizedAt`**:
 * sin esa fecha no hubo habilitación. Los que la tienen no se tocan, aunque les
 * falten hitos intermedios: esos son habilitaciones reales cargadas a medias.
 *
 * Qué revierte: `postHabilitacionInicioEn`, `postHabilitacionSubFase` y el
 * vencimiento de los checks de E2/E3 que se activaron por ese falso disparo.
 * No toca checks ya completados: si alguien de verdad hizo esa tarea, queda.
 *
 *   docker compose -f docker-compose.prod.yml exec server \
 *     npx tsx scripts/fix-habilitacion-sin-fecha.ts          # simula
 *     npx tsx scripts/fix-habilitacion-sin-fecha.ts --aplicar # escribe
 */

import { prisma } from "../src/lib/prisma.js";

const APLICAR = process.argv.includes("--aplicar");
const CHECKS_DEL_DISPARO = [
  "e2_habilitacion",
  "e3_capacitacion",
  "e3_acceso_inversor",
  "e3_alta_reportes",
  "e3_portal_recorrido",
];

async function main() {
  const tramites = await prisma.uteProcess.findMany({
    where: { deletedAt: null, currentStage: "FINALIZADO", finalizedAt: null },
    select: { projectId: true, project: { select: { clientName: true, postHabilitacionInicioEn: true } } },
  });

  if (tramites.length === 0) {
    console.log("No hay trámites finalizados sin fecha de habilitación.");
    return;
  }

  console.log(`${tramites.length} trámite(s) finalizados sin fecha de habilitación:\n`);
  let tocados = 0;

  for (const t of tramites) {
    const checks = await prisma.recorridoCheck.findMany({
      where: {
        projectId: t.projectId,
        codigo: { in: CHECKS_DEL_DISPARO },
        venceEn: { not: null },
        completadoEn: null,
      },
      select: { id: true, codigo: true },
    });

    const limpiaProyecto = t.project.postHabilitacionInicioEn != null;
    if (!limpiaProyecto && checks.length === 0) {
      console.log(`  ${t.project.clientName}: ya estaba limpio`);
      continue;
    }
    tocados++;
    console.log(
      `  ${t.project.clientName}: ` +
        [
          limpiaProyecto ? "borra la fecha de habilitación falsa" : null,
          checks.length > 0 ? `desactiva ${checks.length} paso(s): ${checks.map((c) => c.codigo).join(", ")}` : null,
        ]
          .filter(Boolean)
          .join(" · "),
    );

    if (!APLICAR) continue;

    if (limpiaProyecto) {
      await prisma.project.update({
        where: { id: t.projectId },
        data: { postHabilitacionInicioEn: null, postHabilitacionSubFase: null },
      });
    }
    if (checks.length > 0) {
      await prisma.recorridoCheck.updateMany({
        where: { id: { in: checks.map((c) => c.id) } },
        data: { venceEn: null },
      });
    }
  }

  console.log(
    `\n${tocados} proyecto(s) ${APLICAR ? "corregidos" : "a corregir (simulación: corré con --aplicar)"}.`,
  );
}

main()
  .then(() => prisma.$disconnect())
  .catch(async (e) => {
    console.error(e);
    await prisma.$disconnect();
    process.exit(1);
  });

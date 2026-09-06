/**
 * Backfill de la fecha de habilitación de proyectos ya habilitados.
 *
 * Contexto: hasta ahora `Project.postHabilitacionInicioEn` se escribía en UN SOLO
 * lugar — al confirmar manualmente el traspaso T8 en Pendientes. Si nadie lo
 * confirmaba, el campo quedaba null y con él NO arrancaba la Regla de Oro (el
 * aviso de "ya podés encender"), no había ancla para aniversarios, mantenimientos
 * ni encuestas, y el proyecto no pasaba a E3. En producción eso dejó ~20 clientes
 * habilitados fuera de todo radar.
 *
 * El origen ya está corregido (`ute-sync.service.ts` la escribe cuando Tramitación
 * marca el trámite terminado). Este script arregla los que quedaron atrás.
 *
 * Fecha que usa, en orden: finalizedAt del trámite → fin de la etapa de
 * habilitación → fin de la etapa de obra. Si no hay ninguna, NO inventa una fecha:
 * lo reporta para revisar a mano.
 *
 *   # ver qué haría, sin tocar nada:
 *   docker compose exec server npx tsx prisma/scripts/backfill-fecha-habilitacion.ts
 *   # aplicar:
 *   docker compose exec server npx tsx prisma/scripts/backfill-fecha-habilitacion.ts --apply
 */

import { PostHabilitacionSubFase, PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();
const APPLY = process.argv.includes("--apply");

const ETAPAS_HABILITACION = ["TRAMITACION_UTE", "HABILITACION_UTE"];
const ETAPAS_OBRA = ["EJECUCION_OBRA", "OPERACIONES"];

async function main(): Promise<void> {
  // Habilitados = el trámite está finalizado, por fecha o por etapa.
  const candidatos = await prisma.project.findMany({
    where: {
      deletedAt: null,
      postHabilitacionInicioEn: null,
      uteProcesses: {
        some: {
          deletedAt: null,
          OR: [{ finalizedAt: { not: null } }, { currentStage: "FINALIZADO" }],
        },
      },
    },
    select: {
      id: true,
      clientName: true,
      uteProcesses: {
        where: { deletedAt: null },
        select: { finalizedAt: true },
        orderBy: { createdAt: "desc" },
        take: 1,
      },
      stages: {
        where: { deletedAt: null },
        select: { name: true, actualEndDate: true },
      },
    },
  });

  console.log(`Proyectos habilitados sin fecha: ${candidatos.length}\n`);
  if (candidatos.length === 0) return;

  let aplicados = 0;
  const sinFecha: string[] = [];

  for (const p of candidatos) {
    const fin = p.uteProcesses[0]?.finalizedAt ?? null;
    const hab = p.stages.find((s) => ETAPAS_HABILITACION.includes(s.name))?.actualEndDate ?? null;
    const obra = p.stages.find((s) => ETAPAS_OBRA.includes(s.name))?.actualEndDate ?? null;
    const fecha = fin ?? hab ?? obra;
    const origen = fin ? "trámite" : hab ? "etapa habilitación" : obra ? "etapa obra" : null;

    if (!fecha) {
      sinFecha.push(p.clientName);
      console.log(`  ✗ ${p.clientName.padEnd(32)} SIN FECHA — revisar a mano`);
      continue;
    }

    console.log(`  ${APPLY ? "✓" : "·"} ${p.clientName.padEnd(32)} ${fecha.toISOString().slice(0, 10)}  (${origen})`);
    if (APPLY) {
      await prisma.project.update({
        where: { id: p.id },
        data: {
          postHabilitacionInicioEn: fecha,
          postHabilitacionSubFase: PostHabilitacionSubFase.E3_A_COMPROMISO_COMERCIAL,
        },
      });
      aplicados++;
    }
  }

  console.log("");
  if (APPLY) {
    console.log(`Aplicados: ${aplicados}. Sin fecha (no tocados): ${sinFecha.length}.`);
    console.log(
      "\nOJO: estos proyectos van a aparecer como 'aviso de habilitación pendiente'.\n" +
        "Es lo correcto — hay que verificar cliente por cliente si se avisó o no, y\n" +
        "registrar la interacción con motivo AVISO_HABILITACION para apagar la alarma.",
    );
  } else {
    console.log(`Simulación. Se escribirían ${candidatos.length - sinFecha.length} fechas.`);
    console.log("Correr con --apply para aplicar.");
  }
}

main()
  .then(() => prisma.$disconnect())
  .catch(async (err) => {
    console.error("[backfill] error:", err);
    await prisma.$disconnect();
    process.exitCode = 1;
  });

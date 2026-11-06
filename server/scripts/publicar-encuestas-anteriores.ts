/**
 * Publica las encuestas que ya existen en los clientes anteriores a su disparo,
 * sin avisarles ni abrir el plazo del paso "aviso de la encuesta": se enteran por
 * el mensaje de Dirección con el video del portal.
 *
 * - Obras con habilitación, sin ninguna encuesta (terminaron antes del 15-jul-2026):
 *   la de habilitación.
 * - Importadas de planilla, sin fecha de habilitación: la de aniversario, contando
 *   desde la entrega. La tarea diaria crea todas las ediciones cumplidas y avisa al
 *   crearlas, así que esto hay que correrlo ANTES de las 6:00 siguientes al deploy
 *   de `getAnclaAniversario`. Con dos años, la primera edición queda borrada: existe
 *   para que la tarea no la cree, y al cliente no le aparecen dos iguales.
 *
 *   docker compose -f docker-compose.prod.yml exec server \
 *     npx tsx scripts/publicar-encuestas-anteriores.ts            # simula
 *     npx tsx scripts/publicar-encuestas-anteriores.ts --aplicar --actor=mail@voltia.com.uy
 */

import { Prisma, SurveyTipo } from "@prisma/client";

import { prisma } from "../src/lib/prisma.js";
import { aniversariosCumplidos } from "../src/utils/aniversario.js";

const APLICAR = process.argv.includes("--aplicar");
const actorMail = process.argv.find((a) => a.startsWith("--actor="))?.slice(8);

async function main() {
  const now = new Date();
  const actor = actorMail
    ? await prisma.user.findFirst({ where: { email: actorMail, deletedAt: null }, select: { id: true } })
    : null;
  if (APLICAR && !actor) throw new Error("Para aplicar hace falta --actor=<mail de un usuario existente>");

  const proyectos = await prisma.project.findMany({
    where: { deletedAt: null, status: "COMPLETED", excludedFromMetrics: false, surveys: { none: { deletedAt: null } } },
    select: { id: true, importedFromCsv: true, plannedEndDate: true, postHabilitacionInicioEn: true, actualUteEnd: true },
  });

  const filas: Prisma.SatisfactionSurveyCreateManyInput[] = [];
  const cuenta = { habilitacion: 0, aniversario: 0, menosDeUnAnio: 0, otros: 0 };
  for (const p of proyectos) {
    const conFecha = p.postHabilitacionInicioEn ?? p.actualUteEnd;
    if (!p.importedFromCsv && conFecha) {
      filas.push({ projectId: p.id, tipo: SurveyTipo.HABILITACION, edicion: 0, createdById: actor?.id });
      cuenta.habilitacion++;
    } else if (p.importedFromCsv && !conFecha && p.plannedEndDate) {
      const anios = Math.min(aniversariosCumplidos(p.plannedEndDate, now), 2);
      if (anios < 1) {
        cuenta.menosDeUnAnio++;
        continue;
      }
      if (anios === 2) {
        filas.push({ projectId: p.id, tipo: SurveyTipo.ANIVERSARIO, edicion: 1, createdById: actor?.id, deletedAt: now });
      }
      filas.push({ projectId: p.id, tipo: SurveyTipo.ANIVERSARIO, edicion: anios, createdById: actor?.id });
      cuenta.aniversario++;
    } else {
      cuenta.otros++;
    }
  }

  console.log(`${APLICAR ? "Aplicando" : "Simulación"}: ${JSON.stringify(cuenta)}`);
  if (APLICAR) {
    const r = await prisma.satisfactionSurvey.createMany({ data: filas, skipDuplicates: true });
    console.log(`Filas creadas: ${r.count}`);
  }
}

main()
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());

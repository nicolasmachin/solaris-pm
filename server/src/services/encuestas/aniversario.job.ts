import cron from "node-cron";
import { SurveyTipo } from "@prisma/client";

import { prisma } from "../../lib/prisma.js";
import { aniversariosCumplidos } from "../../utils/aniversario.js";
import { crearEncuestaSiNoExiste } from "./encuestas.service.js";

// Genera la encuesta de aniversario (E3) en cada aniversario de la puesta en
// marcha del sistema. Ancla: Project.postHabilitacionInicioEn (año 0); fallback
// actualUteEnd para proyectos sin la fecha de post-habilitación seteada.
// Idempotente: crearEncuestaSiNoExiste dedup por (proyecto, ANIVERSARIO, edición=año).
//
// Cap configurable (default 2 años, alineado con el compromiso comercial E3-A de
// mantenimiento anual sin cargo los primeros 2 años). Subir con la env var cuando
// se quiera encuestar más allá.

function anioAniversarioMax(): number {
  const raw = parseInt(process.env.ENCUESTAS_ANIVERSARIO_MAX_ANIOS || "2", 10);
  return Number.isFinite(raw) && raw > 0 ? raw : 2;
}

export async function chequearAniversarios(
  now: Date = new Date(),
): Promise<{ checked: number; generadas: number }> {
  const proyectos = await prisma.project.findMany({
    where: {
      deletedAt: null,
      OR: [{ postHabilitacionInicioEn: { not: null } }, { actualUteEnd: { not: null } }],
    },
    select: { id: true, postHabilitacionInicioEn: true, actualUteEnd: true },
  });

  const tope = anioAniversarioMax();
  let generadas = 0;

  for (const p of proyectos) {
    const ancla = p.postHabilitacionInicioEn ?? p.actualUteEnd;
    if (!ancla) continue;
    const cumplidos = Math.min(aniversariosCumplidos(ancla, now), tope);
    for (let anio = 1; anio <= cumplidos; anio++) {
      try {
        // Solo cuenta como "generada" la que no existía todavía.
        const yaExiste = await prisma.satisfactionSurvey.findUnique({
          where: { projectId_tipo_edicion: { projectId: p.id, tipo: SurveyTipo.ANIVERSARIO, edicion: anio } },
          select: { id: true },
        });
        const survey = await crearEncuestaSiNoExiste({
          projectId: p.id,
          tipo: SurveyTipo.ANIVERSARIO,
          edicion: anio,
        });
        if (survey && !yaExiste) generadas++;
      } catch (err) {
        console.error(`[encuestas-aniversario] fallo en proyecto ${p.id} año ${anio}:`, err);
      }
    }
  }

  return { checked: proyectos.length, generadas };
}

// Cron diario a las 06:00 (configurable). El aniversario es una fecha de día, no
// necesita precisión horaria.
export function startEncuestasAniversarioJob() {
  const expr = process.env.CRON_ENCUESTAS_ANIVERSARIO || "0 6 * * *";
  return cron.schedule(expr, async () => {
    try {
      const r = await chequearAniversarios();
      if (r.generadas > 0) {
        console.log(`[encuestas-aniversario] generadas ${r.generadas} encuesta(s) de aniversario de ${r.checked} proyecto(s)`);
      }
    } catch (err) {
      console.error("[encuestas-aniversario] job error:", err);
    }
  });
}

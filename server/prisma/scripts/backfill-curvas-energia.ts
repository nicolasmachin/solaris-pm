// Rellena hacia atrás la curva por día (vista de energía) y, con ella, el
// consumo y la importación diaria de las plantas Growatt.
//
//   docker compose exec server npx tsx prisma/scripts/backfill-curvas-energia.ts --desde 2026-09-01 --hasta 2026-10-12
//   docker compose exec server npx tsx prisma/scripts/backfill-curvas-energia.ts --desde 2026-10-01 --proyecto <projectId>
//
// Sin --hasta llega hasta ayer. Va planta por planta y día por día con pausa
// (3 a 5 consultas por planta y día): 20 plantas × 30 días son ~2.000
// consultas, más de una hora. Los días ya guardados como completos se saltean,
// así que se puede cortar y volver a correr.

import { prisma } from "../../src/lib/prisma.js";
import { guardarCurvasDelDia, hoyUy, obtenerCurvaDia } from "../../src/services/reportesFv/energia/curva.service.js";
import { growattDormir, growattPausaCurvaMs } from "../../src/services/reportesFv/growatt/client.js";
import { rangoDias, sumarDias } from "../../src/services/reportesFv/monitor/dias.js";

function arg(n: string) {
  const i = process.argv.indexOf(n);
  return i >= 0 ? process.argv[i + 1] : undefined;
}

async function main() {
  const desde = arg("--desde");
  if (!desde) throw new Error("Falta --desde AAAA-MM-DD");
  const hasta = arg("--hasta") ?? sumarDias(hoyUy(), -1);
  const proyecto = arg("--proyecto");
  const dias = rangoDias(desde, hasta);
  console.log(`Días: ${desde} → ${hasta} (${dias.length})${proyecto ? ` · proyecto ${proyecto}` : " · todas las plantas Growatt"}`);

  for (const dia of dias) {
    if (proyecto) {
      try {
        const c = await obtenerCurvaDia(proyecto, dia);
        console.log(`  ${dia}: ${c.puntos.length} puntos · gen ${c.resumen.generacionKwh} · consumo ${c.resumen.consumoKwh}`);
      } catch (err) {
        console.log(`  ${dia}: error ${err instanceof Error ? err.message : err}`);
      }
      await growattDormir(growattPausaCurvaMs);
    } else {
      const r = await guardarCurvasDelDia(dia);
      console.log(`  ${dia}: ${r.guardadas} plantas, ${r.fallidas} con error`);
    }
  }
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());

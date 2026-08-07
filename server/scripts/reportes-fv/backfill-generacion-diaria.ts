/**
 * Rellena la serie diaria de generación desde Growatt.
 *
 *   docker compose exec server npx tsx scripts/reportes-fv/backfill-generacion-diaria.ts \
 *     --desde 2026-07-01 [--hasta 2026-08-07] [--plant 1419543]
 *
 * El monitoreo diario sólo guarda los últimos 7 días, así que sin esto el
 * gráfico del portal arranca vacío. Costo: ceil(dias/7) requests por planta.
 *
 * OJO con el rate limit: Growatt devuelve error_code 10012 mucho antes de lo
 * que sugiere su documentación. Va de a una planta por vez, a propósito.
 */

import { prisma } from "../../src/lib/prisma.js";
import { generacionDiaria, growattDormir, growattPausaMs } from "../../src/services/reportesFv/growatt/client.js";
import { esDiaValido } from "../../src/services/reportesFv/monitor/dias.js";
import { guardarGeneracionDiaria } from "../../src/services/reportesFv/monitor/generacion-diaria.service.js";

function arg(nombre: string): string | undefined {
  const i = process.argv.indexOf(`--${nombre}`);
  return i >= 0 ? process.argv[i + 1] : undefined;
}

async function main() {
  const desde = arg("desde");
  const hasta = arg("hasta") ?? new Date().toISOString().slice(0, 10);
  if (!desde || !esDiaValido(desde) || !esDiaValido(hasta)) {
    console.error("Uso: --desde YYYY-MM-DD [--hasta YYYY-MM-DD] [--plant <plantId>]");
    process.exit(1);
  }

  const plantArg = arg("plant");
  const plantas = await prisma.growattPlant.findMany({
    where: {
      ignorada: false,
      projectId: { not: null },
      ...(plantArg ? { plantId: BigInt(plantArg) } : {}),
    },
    select: { plantId: true, name: true, projectId: true },
    orderBy: { name: "asc" },
  });

  console.log(`Backfill ${desde} → ${hasta} · ${plantas.length} plantas\n`);

  let requests = 0;
  let filas = 0;
  let fallidas = 0;
  const t0 = Date.now();

  for (const [i, p] of plantas.entries()) {
    const etiqueta = `[${i + 1}/${plantas.length}] ${p.name}`;
    try {
      const serie = await generacionDiaria(p.plantId.toString(), desde, hasta, () => requests++);
      const escritos = await guardarGeneracionDiaria(p.projectId!, p.plantId, serie);
      filas += escritos;
      console.log(`${etiqueta}: ${serie.size} días, ${escritos} guardados`);
    } catch (err) {
      fallidas++;
      console.error(`${etiqueta}: ERROR ${err instanceof Error ? err.message : String(err)}`);
    }
    await growattDormir(growattPausaMs);
  }

  console.log(
    `\nListo: ${filas} filas · ${requests} requests · ${fallidas} plantas con error · ` +
      `${Math.round((Date.now() - t0) / 1000)} s`,
  );
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());

/**
 * Rellena la noche de días pasados (lo que el medidor contó con el inversor
 * apagado). Lo de todos los días lo hace el monitoreo de las 8; esto es para
 * atrás. No correrlo mientras corre el monitoreo: comparten el límite de Growatt.
 *
 *   npx tsx scripts/reportes-fv/backfill-noches.ts --proyecto PRY-2026-109 --desde 2026-10-20
 *   npx tsx scripts/reportes-fv/backfill-noches.ts --todos --desde 2026-10-01
 */
import { prisma } from "../../src/lib/prisma.js";
import { hoyUy, obtenerCurvaDia } from "../../src/services/reportesFv/energia/curva.service.js";
import { reconstruirNochesDePlanta } from "../../src/services/reportesFv/energia/noche.service.js";
import { rangoDias, sumarDias } from "../../src/services/reportesFv/monitor/dias.js";

const arg = (n: string) => {
  const i = process.argv.indexOf(`--${n}`);
  return i >= 0 ? process.argv[i + 1] : undefined;
};

async function main() {
  const desde = arg("desde");
  const codigo = arg("proyecto");
  if (!desde || (!codigo && !process.argv.includes("--todos"))) throw new Error("Falta --desde y --proyecto o --todos");
  const plantas = await prisma.growattPlant.findMany({
    where: { projectId: { not: null }, ignorada: false, ...(codigo ? { project: { code: codigo } } : {}) },
    select: { projectId: true, plantId: true, project: { select: { clientName: true } } },
  });
  const hoy = hoyUy();
  const dias = rangoDias(desde, hoy);
  for (const p of plantas) {
    // Primero las curvas: los totales del día salen de la curva guardada.
    for (const d of rangoDias(desde, sumarDias(hoy, -1))) await obtenerCurvaDia(p.projectId!, d).catch(() => undefined);
    const n = await reconstruirNochesDePlanta(p.projectId!, p.plantId, dias);
    console.log(`${p.project?.clientName}: ${n} noches de ${dias.length}`);
  }
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());

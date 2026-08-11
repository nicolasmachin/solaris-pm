/**
 * Vuelve a traer de Growatt un período para uno o varios generadores.
 *
 * Para qué existe: el día de corte del medidor se aplica en el momento de la
 * INGESTA (define el rango de días que se le piden a Growatt), no en el cálculo.
 * Así que cuando se carga o se cambia el día de corte de un cliente, los meses
 * ya guardados siguen teniendo el mes calendario hasta que se reingieran. Esto
 * es lo que los pone al día sin correr la flota entera.
 *
 *   docker compose exec server npx tsx scripts/reportes-fv/reingerir.ts \
 *     2026-08 PRY-2026-007 [--force]
 *
 * `--force` pisa además los valores cargados a mano. Sin él, lo que escribió una
 * persona se respeta.
 *
 * Acepta varios códigos de proyecto separados por espacio. Sin códigos aborta:
 * para la flota completa está el botón del panel.
 */

import { ReporteFvIngestaModo } from "@prisma/client";

import { prisma } from "../../src/lib/prisma.js";
import { ingerirPeriodoSincrono } from "../../src/services/reportesFv/growatt/ingesta.service.js";
import { rangoDelPeriodo } from "../../src/services/reportesFv/periodo.js";
import type { Periodo } from "../../src/services/reportesFv/periodo.js";

async function main() {
  const args = process.argv.slice(2);
  const force = args.includes("--force");
  const [periodo, ...codigos] = args.filter((a) => a !== "--force");

  if (!periodo || !/^\d{4}-\d{2}$/.test(periodo) || codigos.length === 0) {
    console.error("Uso: reingerir.ts <YYYY-MM> <CODIGO...> [--force]");
    process.exit(1);
  }

  const proyectos = await prisma.project.findMany({
    where: { code: { in: codigos } },
    select: { id: true, code: true, clientName: true, reporteFvConfig: { select: { diaCorteMedidor: true } } },
  });

  const noEncontrados = codigos.filter((c) => !proyectos.some((p) => p.code === c));
  if (noEncontrados.length) console.log(`⚠️  Sin proyecto: ${noEncontrados.join(", ")}`);
  if (!proyectos.length) process.exit(1);

  for (const p of proyectos) {
    const corte = p.reporteFvConfig?.diaCorteMedidor ?? null;
    const r = rangoDelPeriodo(periodo as Periodo, corte);
    console.log(
      `${p.clientName} (${p.code}) — ${periodo}: ${r.desde} → ${r.hasta} (${r.dias} días, ` +
        `${corte ? `corte día ${corte}` : "mes calendario"})`,
    );
  }

  console.log(`\nTrayendo de Growatt${force ? " (force: pisa lo cargado a mano)" : ""}…`);
  const ingestaId = await ingerirPeriodoSincrono({
    periodo: periodo as Periodo,
    modo: ReporteFvIngestaModo.MANUAL,
    projectIds: proyectos.map((p) => p.id),
    force,
  });
  console.log(`corrida ${ingestaId}\n`);

  const lecturas = await prisma.reporteFvLectura.findMany({
    where: {
      projectId: { in: proyectos.map((p) => p.id) },
      periodo: new Date(`${periodo}-01T00:00:00.000Z`),
    },
    include: { project: { select: { clientName: true } } },
  });

  for (const l of lecturas) {
    console.log(
      `${l.project.clientName}: generación ${l.generacionKwh ?? "—"} · consumo ${l.consumoKwh ?? "—"} · ` +
        `exportación ${l.exportacionKwh ?? "—"} · importación ${l.importacionMedidaKwh ?? "—"} ` +
        `(${l.diasConDatos ?? "?"}/${l.diasEsperados ?? "?"} días)` +
        (l.motivoFaltante ? `\n  ⚠️  ${l.motivoFaltante}` : ""),
    );
  }
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());

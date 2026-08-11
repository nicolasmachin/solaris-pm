/**
 * Completa los días que el smart meter no midió, proyectando el promedio de los
 * días que sí midió, y recalcula la serie.
 *
 * Para qué: cuando el medidor de un cliente pierde días, el total del mes queda
 * corto y el reporte sale con un consumo que no es el real. Esto lo estima en
 * vez de dejarlo incompleto — a costa de que el número deja de ser una medición
 * y pasa a ser una proyección, así que queda marcado como tal en la lectura y en
 * la nota que sale impresa.
 *
 * La GENERACIÓN no se toca nunca: viene del inversor, que no pierde días.
 *
 *   docker compose exec server npx tsx scripts/reportes-fv/completar-lectura-estimada.ts \
 *     PRY-2026-007 2026-08 [--solo-importacion] [--dry-run]
 *
 * `--solo-importacion` deja la exportación como se midió. Útil cuando la
 * exportación medida ya coincide con la factura y proyectarla la empeoraría
 * (pasa en invierno: los días perdidos casi no exportaron).
 */

import { Prisma, ReporteFvFuente } from "@prisma/client";

import { prisma } from "../../src/lib/prisma.js";
import { recalcularSerie } from "../../src/services/reportesFv/calculo.service.js";

function n(v: Prisma.Decimal | null): number | null {
  return v == null ? null : Number(v);
}

async function main() {
  const args = process.argv.slice(2);
  const soloImportacion = args.includes("--solo-importacion");
  const dryRun = args.includes("--dry-run");
  const [codigo, periodo] = args.filter((a) => !a.startsWith("--"));

  if (!codigo || !periodo) {
    console.error("Uso: completar-lectura-estimada.ts <CODIGO> <YYYY-MM> [--solo-importacion] [--dry-run]");
    process.exit(1);
  }

  const proyecto = await prisma.project.findFirst({
    where: { code: codigo },
    select: { id: true, clientName: true },
  });
  if (!proyecto) {
    console.error(`No existe el proyecto ${codigo}`);
    process.exit(1);
  }

  const fecha = new Date(`${periodo}-01T00:00:00.000Z`);
  const lectura = await prisma.reporteFvLectura.findUnique({
    where: { projectId_periodo: { projectId: proyecto.id, periodo: fecha } },
  });
  if (!lectura) {
    console.error(`No hay lectura de ${periodo} para ${proyecto.clientName}`);
    process.exit(1);
  }

  const conDatos = lectura.diasConDatos;
  const esperados = lectura.diasEsperados;
  if (!conDatos || !esperados || conDatos >= esperados) {
    console.log("La lectura no tiene días faltantes: no hay nada que completar.");
    process.exit(0);
  }

  const factor = esperados / conDatos;
  const gen = n(lectura.generacionKwh);
  const impMedida = n(lectura.importacionMedidaKwh);
  const expMedida = n(lectura.exportacionKwh);

  if (impMedida == null) {
    console.error("La lectura no tiene importación medida: no se puede proyectar.");
    process.exit(1);
  }

  const r2 = (x: number) => Math.round(x * 100) / 100;
  const impNueva = r2(impMedida * factor);
  const expNueva = soloImportacion || expMedida == null ? expMedida : r2(expMedida * factor);
  // Identidad del modelo: consumo = generación − exportación + importación.
  const consNuevo = gen == null ? null : r2(gen - (expNueva ?? 0) + impNueva);

  console.log(`${proyecto.clientName} — ${periodo}`);
  console.log(`  medido: ${conDatos} de ${esperados} días (factor ${factor.toFixed(4)})`);
  console.log(`  generación      ${gen} (del inversor, sin tocar)`);
  console.log(`  importación     ${impMedida} → ${impNueva}`);
  console.log(`  exportación     ${expMedida} → ${expNueva}${soloImportacion ? " (sin proyectar)" : ""}`);
  console.log(`  consumo total   ${n(lectura.consumoKwh)} → ${consNuevo}`);

  if (dryRun) {
    console.log("\n(dry run: no se guardó nada)");
    process.exit(0);
  }

  const nota =
    `Estimado: el medidor reportó ${conDatos} de ${esperados} días. Los ${esperados - conDatos} días ` +
    `faltantes se completaron con el promedio diario de los días medidos.`;

  await prisma.reporteFvLectura.update({
    where: { id: lectura.id },
    data: {
      importacionMedidaKwh: new Prisma.Decimal(impNueva.toFixed(2)),
      exportacionKwh: expNueva == null ? null : new Prisma.Decimal(expNueva.toFixed(2)),
      consumoKwh: consNuevo == null ? null : new Prisma.Decimal(consNuevo.toFixed(2)),
      // MANUAL y no GROWATT: el número ya no es una medición. Además así la
      // próxima ingesta no lo pisa (la regla protege lo cargado por una persona).
      consumoFuente: ReporteFvFuente.MANUAL,
      exportacionFuente: expNueva == null ? lectura.exportacionFuente : ReporteFvFuente.MANUAL,
      nota,
      // diasConDatos NO se toca: sigue siendo verdad que se midieron 25 de 31, y
      // es lo que hace que el PDF mantenga su advertencia de datos parciales.
    },
  });

  console.log("\nRecalculando la serie…");
  await recalcularSerie(proyecto.id);

  const calculo = await prisma.reporteFvCalculo.findUnique({
    where: { projectId_periodo: { projectId: proyecto.id, periodo: fecha } },
  });
  if (calculo) {
    console.log("\nResultado del reporte:");
    console.log(`  ahorro del mes        $ ${n(calculo.ahorroTotal)}`);
    console.log(`  ahorro acumulado USD  ${n(calculo.ahorroAcumuladoUsd)}`);
    console.log(`  retorno inversión     ${n(calculo.retornoInversionPct)}%`);
  }
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());

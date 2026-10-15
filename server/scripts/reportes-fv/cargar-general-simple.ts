/**
 * Carga la tarifa General Simple en el cuadro de UTE 2026.
 *
 *   docker compose exec server npx tsx scripts/reportes-fv/cargar-general-simple.ts [--aplicar]
 *
 * Los cuadros publicados no se editan desde la pantalla, y la General Simple
 * entró al sistema en oct-2026, con el cuadro 2026 ya publicado. Los precios
 * salen de la factura de UTE de Estilo SAS (B 9430783, ciclo 16-ago a
 * 16-sep-2026): cargo fijo $272,80, potencia $70 por kW, 1.000 kWh a $5,64 y
 * el resto a $6,473 (sin IVA). Sólo agrega: no toca las otras tarifas.
 * Idempotente. Sin --aplicar muestra lo que haría.
 */

import { TarifaUte } from "@prisma/client";

import { prisma } from "../../src/lib/prisma.js";

const CARGOS = { cargoFijo: 272.8, cargoPotenciaKw: 70 };
const TRAMOS = [
  { orden: 0, desdeKwh: 1, hastaKwh: 1000, precioKwh: 5.64 },
  { orden: 1, desdeKwh: 1001, hastaKwh: 9999999, precioKwh: 6.473 },
];

async function main() {
  const aplicar = process.argv.includes("--aplicar");
  const version = await prisma.tarifaUteVersion.findUnique({
    where: { vigenteDesde: new Date("2026-01-01") },
    include: { cargos: true, tramos: true },
  });
  if (!version) throw new Error("No existe el cuadro con vigencia 2026-01-01");

  const yaCargos = version.cargos.find((c) => c.tarifa === TarifaUte.GENERAL_SIMPLE);
  const yaTramos = version.tramos.filter((t) => t.tarifa === TarifaUte.GENERAL_SIMPLE);
  console.log(`Cuadro ${version.nombre} (${version.id})`);
  console.log(`  cargos General Simple hoy: ${yaCargos ? `${yaCargos.cargoFijo} / ${yaCargos.cargoPotenciaKw}` : "—"}`);
  console.log(`  tramos General Simple hoy: ${yaTramos.length}`);
  console.log(`  a cargar: cargo fijo ${CARGOS.cargoFijo}, potencia ${CARGOS.cargoPotenciaKw}/kW, ${TRAMOS.length} tramos`);

  if (!aplicar) {
    console.log("\nSimulación. Correr con --aplicar para guardar.");
    return;
  }

  await prisma.$transaction(async (tx) => {
    await tx.tarifaUteCargo.upsert({
      where: { versionId_tarifa: { versionId: version.id, tarifa: TarifaUte.GENERAL_SIMPLE } },
      create: { versionId: version.id, tarifa: TarifaUte.GENERAL_SIMPLE, ...CARGOS },
      update: CARGOS,
    });
    await tx.tarifaUteTramo.deleteMany({ where: { versionId: version.id, tarifa: TarifaUte.GENERAL_SIMPLE } });
    await tx.tarifaUteTramo.createMany({
      data: TRAMOS.map((t) => ({ ...t, versionId: version.id, tarifa: TarifaUte.GENERAL_SIMPLE })),
    });
  });
  console.log("\nListo. El servidor toma el cambio al vencer su caché de cuadros (o al reiniciarlo).");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());

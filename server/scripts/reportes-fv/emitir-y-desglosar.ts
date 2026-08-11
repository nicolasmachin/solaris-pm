/**
 * Genera el PDF de un período y muestra el desglose de la factura estimada,
 * para poder contrastarlo línea por línea con la factura real de UTE.
 *
 * El desglose no queda en `ReporteFvCalculo` (que sólo guarda los ahorros), así
 * que sin esto la única forma de verlo es abrir el PDF.
 *
 *   docker compose exec server npx tsx scripts/reportes-fv/emitir-y-desglosar.ts \
 *     PRY-2026-007 2026-08 [--sin-emitir]
 */

import { prisma } from "../../src/lib/prisma.js";
import { computarSerieDeProyecto } from "../../src/services/reportesFv/calculo.service.js";
import { exigirConfigCompleta, getConfigEfectiva } from "../../src/services/reportesFv/config.service.js";
import { generarEmision } from "../../src/services/reportesFv/emision.service.js";
import type { Periodo } from "../../src/services/reportesFv/periodo.js";

const money = (x: number) => `$ ${x.toLocaleString("es-UY", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

async function main() {
  const args = process.argv.slice(2);
  const sinEmitir = args.includes("--sin-emitir");
  const [codigo, periodo] = args.filter((a) => !a.startsWith("--"));
  if (!codigo || !periodo) {
    console.error("Uso: emitir-y-desglosar.ts <CODIGO> <YYYY-MM> [--sin-emitir]");
    process.exit(1);
  }

  const proyecto = await prisma.project.findFirst({
    where: { code: codigo },
    select: { id: true, clientName: true },
  });
  if (!proyecto) {
    console.error(`No existe ${codigo}`);
    process.exit(1);
  }

  const config = exigirConfigCompleta(await getConfigEfectiva(proyecto.id));
  const { serie } = await computarSerieDeProyecto(config);
  const r = serie.find((x) => x.periodo === periodo);
  if (!r) {
    console.error(`Sin datos para ${periodo}`);
    process.exit(1);
  }

  console.log(`${proyecto.clientName} — ${periodo}`);
  console.log(`Tarifa principal: ${r.tarifaPrincipal.toUpperCase()}\n`);

  const t = r.tarifas[r.tarifaPrincipal];
  const sin = t.facturaSin;
  const con = t.facturaConAjustada;

  console.log("                          SIN paneles      CON paneles");
  const fila = (label: string, a: number, b: number) =>
    console.log(`  ${label.padEnd(22)} ${money(a).padStart(14)}  ${money(b).padStart(14)}`);
  fila("cargo fijo", sin.cargoFijo, con.cargoFijo);
  fila("cargo potencia", sin.cargoPotencia, con.cargoPotencia);
  fila("energía", sin.cargoEnergia, con.cargoEnergia);
  fila("IVA", sin.iva, con.iva);
  if ("creditoExportacion" in con) fila("crédito exportación", 0, (con as any).creditoExportacion ?? 0);
  fila("TOTAL", sin.totalNeto, con.totalNeto);

  console.log(`\n  Ahorro del mes: ${money(r.ahorroTotal)}`);
  console.log(`  (autoconsumo ${money(r.ahorroAutoconsumo)} + venta ${money(r.ahorroVenta)})`);
  console.log(`\n  Energía tomada de la red: ${r.importacionRedKwh} kWh`);
  console.log(`  Autoconsumo: ${r.autoconsumoKwh} kWh`);

  console.log("\nOtras tarifas, para comparar:");
  for (const key of r.tarifasMostradas) {
    if (key === r.tarifaPrincipal) continue;
    console.log(`  ${key.padEnd(8)} ahorro ${money(r.tarifas[key].desglose.ahorroTotal)}`);
  }

  if (!sinEmitir) {
    const admin = await prisma.user.findFirst({
      where: { role: { name: "ADMIN" }, deletedAt: null },
      orderBy: { createdAt: "asc" },
      select: { id: true },
    });
    if (admin) {
      const e = await generarEmision(proyecto.id, periodo as Periodo, admin.id);
      console.log(`\nPDF generado: v${e.version} (${(e.bytes / 1024).toFixed(0)} KB)`);
    }
  }
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());

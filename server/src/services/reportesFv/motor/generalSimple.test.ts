// Tarifa General Simple contra una factura real de UTE.
//
// Estilo SAS, cuenta 0451476057, ciclo 16-ago a 16-sep-2026 (factura
// B 9430783): General Simple, 35 kW contratados, 1.812 kWh comprados, total
// $16.615,00. Los precios son los de esa factura. Lo que la valida es que, con
// la importación de la factura, el motor da el mismo total — incluido el IVA
// sobre el cargo fijo, que en las residenciales no se cobra.
//
// Correr: npm run test:reportes-fv-general

import assert from "node:assert/strict";
import { test } from "node:test";

import { calcularSerie } from "./serie.js";
import type { TarifaSnapshot } from "./types.js";

const cero = { cargoFijo: 0, cargoPotenciaKw: 0 };

const TARIFA: TarifaSnapshot = {
  cargos: {
    simple: cero,
    doble: cero,
    triple: cero,
    zafral: cero,
    general_simple: { cargoFijo: 272.8, cargoPotenciaKw: 70 },
  },
  tramosSimple: [{ desdeKwh: 1, hastaKwh: 9999999, precioKwh: 10 }],
  tramosGeneralSimple: [
    { desdeKwh: 1, hastaKwh: 1000, precioKwh: 5.64 },
    { desdeKwh: 1001, hastaKwh: 9999999, precioKwh: 6.473 },
  ],
  franjasDoble: { punta: 0, fuera_punta: 0 },
  franjasTriple: { punta: 0, llano: 0, valle: 0 },
  franjasZafral: { punta: 0, llano: 0, valle: 0 },
  ivaPct: 0.22,
  irpfPct: 0.12,
};

const config = {
  potenciaContratadaKw: 35, pctPunta: 0.1, pctLlano: 0.85, pctValle: 0.05,
  inversionUsd: 20000, potenciaInstaladaKwp: 18.6, mesInicio: "2026-07" as const,
  tipoCliente: "empresa" as const, tarifaContratada: "general_simple" as const,
};

test("la General Simple reproduce la factura de Estilo", () => {
  // consumo − generación + exportación = importación: 3.002 − 1.662 + 472 = 1.812.
  const [r] = calcularSerie({
    config,
    lecturas: [{ periodo: "2026-09", generacionKwh: 1662, consumoKwh: 3002, exportacionKwh: 472 }],
    tarifaPorPeriodo: () => TARIFA,
    tipoCambioPorPeriodo: () => 40,
  });

  assert.equal(r.omitido, null);
  assert.equal(r.tarifaPrincipal, "general_simple");
  assert.deepEqual(r.tarifasMostradas, ["general_simple"]);
  assert.equal(r.importacionRedKwh, 1812);

  const t = r.tarifas.general_simple;
  // Energía: 1.000 × 5,64 + 812 × 6,473 = 10.896,08 (la factura dice 5.640 + 5.256,08).
  assert.equal(t.facturaConAjustada.cargoEnergia, 10896.08);
  // Gravado = 272,80 + 2.450 + 10.896,08 = 13.618,88; IVA 2.996,15; total 16.615,03
  // (la factura redondea a 16.615,00).
  assert.equal(t.facturaConAjustada.iva, 2996.15);
  assert.ok(Math.abs(t.facturaConAjustada.totalNeto - 16615) < 0.05, `con: ${t.facturaConAjustada.totalNeto}`);

  // Sin paneles se habrían comprado los 3.002 kWh.
  assert.ok(Math.abs(t.facturaSin.totalNeto - 26012.54) < 0.05, `sin: ${t.facturaSin.totalNeto}`);
});

test("sin la General Simple en el cuadro, el mes no se emite", () => {
  const [r] = calcularSerie({
    config,
    lecturas: [{ periodo: "2026-09", generacionKwh: 1662, consumoKwh: 3002, exportacionKwh: 472 }],
    tarifaPorPeriodo: () => ({ ...TARIFA, tramosGeneralSimple: [] }),
    tipoCambioPorPeriodo: () => 40,
  });
  assert.match(r.omitido ?? "", /General Simple/);
});

// Tests de la reasignación de la hora punta por días hábiles.
//
// UTE cobra la punta al precio caro sólo de lunes a viernes. El golden test lo
// ejercita a través de BARENOF (tarifa zafral), pero la tarifa doble no tiene
// ningún cliente en el fixture, así que acá se cubre la fórmula en sí y su
// efecto sobre doble y triple de forma explícita.
//
// Correr: npm run test:reportes-fv-habiles

import assert from "node:assert/strict";
import { test } from "node:test";

import { fraccionDiasHabiles } from "../periodo.js";
import { calcularSerie } from "./serie.js";
import type { TarifaSnapshot } from "./types.js";

test("fraccionDiasHabiles cuenta lunes a viernes del mes", () => {
  // Enero 2026: 31 días, 22 hábiles (9 de fin de semana).
  assert.equal(Math.round(fraccionDiasHabiles("2026-01") * 1e6) / 1e6, 0.709677);
  // Febrero 2026: 28 días, 20 hábiles.
  assert.equal(Math.round(fraccionDiasHabiles("2026-02") * 1e6) / 1e6, 0.714286);
  // La fracción siempre está entre 0 y 1.
  for (const p of ["2024-12", "2025-06", "2026-03"]) {
    const f = fraccionDiasHabiles(p);
    assert.ok(f > 0 && f < 1, `${p}: ${f}`);
  }
});

// Cuadro tarifario mínimo para el test (precios redondos, fáciles de seguir).
const TARIFA: TarifaSnapshot = {
  cargos: {
    simple: { cargoFijo: 0, cargoPotenciaKw: 0 },
    doble: { cargoFijo: 0, cargoPotenciaKw: 0 },
    triple: { cargoFijo: 0, cargoPotenciaKw: 0 },
    zafral: { cargoFijo: 0, cargoPotenciaKw: 0 },
  },
  tramosSimple: [{ desdeKwh: 0, hastaKwh: 9999999, precioKwh: 10 }],
  franjasDoble: { punta: 100, fuera_punta: 10 },
  franjasTriple: { punta: 100, llano: 10, valle: 1 },
  franjasZafral: { punta: 100, llano: 10, valle: 1 },
  ivaPct: 0,
  irpfPct: 0,
};

test("la punta de fin de semana se factura a fuera de punta / llano", () => {
  // Un cliente empresa con 100% del consumo en punta (caso extremo para que la
  // reasignación sea fácil de ver). Sin generación ni exportación: la factura
  // "con paneles" iguala el consumo, y el cargo de energía es puro precio × kWh.
  const base = {
    lecturas: [{ periodo: "2026-01", generacionKwh: 0, consumoKwh: 1000, exportacionKwh: 0 }],
    tarifaPorPeriodo: () => TARIFA,
    tipoCambioPorPeriodo: () => 40,
  };
  const frac = fraccionDiasHabiles("2026-01"); // 22/31

  // DOBLE: pctPunta efectivo = 1 * frac; el resto (1 - frac) va a fuera de punta.
  const doble = calcularSerie({
    config: {
      potenciaContratadaKw: 5, pctPunta: 1, pctLlano: 0, pctValle: 0,
      inversionUsd: 1000, potenciaInstaladaKwp: 5, mesInicio: "2026-01",
      tipoCliente: "empresa", tarifaContratada: "doble",
    },
    ...base,
  })[0];
  const esperadoDoble = 1000 * frac * 100 + 1000 * (1 - frac) * 10;
  assert.ok(
    Math.abs(doble.tarifas.doble.facturaSin.cargoEnergia - Math.round(esperadoDoble * 100) / 100) < 0.02,
    `doble: ${doble.tarifas.doble.facturaSin.cargoEnergia} vs ${esperadoDoble}`,
  );

  // TRIPLE: el excedente de punta se mueve a LLANO (no a valle).
  const triple = calcularSerie({
    config: {
      potenciaContratadaKw: 5, pctPunta: 1, pctLlano: 0, pctValle: 0,
      inversionUsd: 1000, potenciaInstaladaKwp: 5, mesInicio: "2026-01",
      tipoCliente: "empresa", tarifaContratada: "triple",
    },
    ...base,
  })[0];
  const esperadoTriple = 1000 * frac * 100 + 1000 * (1 - frac) * 10 + 0 * 1;
  assert.ok(
    Math.abs(triple.tarifas.triple.facturaSin.cargoEnergia - Math.round(esperadoTriple * 100) / 100) < 0.02,
    `triple: ${triple.tarifas.triple.facturaSin.cargoEnergia} vs ${esperadoTriple}`,
  );
});

test("la tarifa simple no cambia por días hábiles", () => {
  // La simple va por tramos de consumo, no por franjas: la fracción no la toca.
  const [r] = calcularSerie({
    config: {
      potenciaContratadaKw: 5, pctPunta: 0.2, pctLlano: 0.5, pctValle: 0.3,
      inversionUsd: 1000, potenciaInstaladaKwp: 5, mesInicio: "2026-01",
      tipoCliente: "residencial", tarifaContratada: null,
    },
    lecturas: [{ periodo: "2026-01", generacionKwh: 0, consumoKwh: 500, exportacionKwh: 0 }],
    tarifaPorPeriodo: () => TARIFA,
    tipoCambioPorPeriodo: () => 40,
  });
  assert.equal(r.tarifas.simple.facturaSin.cargoEnergia, 5000); // 500 × 10, sin franjas
});

// Tests del builder de valores del singleton para la memoria de cálculo.
//   npm run test:proposal-memoria

import { strict as assert } from "node:assert";
import { test } from "node:test";

import { buildMemoriaSingletonValues, singletonLabels } from "./calculator-memoria.js";

const sampleData = {
  markupPorcentajeDefault: { value: 20, asesorCanOverride: false },
  factorAhorroSimple: { value: 1.05, asesorCanOverride: false },
  precioPanelUsdSinIva: { value: 100, asesorCanOverride: false },
  // negociosPromedioMes ausente a propósito (drift)
  costoOtrosPesos: { value: "no-numérico", asesorCanOverride: false },
};

test("extrae value + label + unidad de una variable existente", () => {
  const out = buildMemoriaSingletonValues(sampleData);
  assert.equal(out.markupPorcentajeDefault.value, 20);
  assert.equal(out.markupPorcentajeDefault.unidad, "%");
  assert.equal(out.markupPorcentajeDefault.label, "Markup por defecto");
  assert.equal(out.precioPanelUsdSinIva.value, 100);
  assert.equal(out.precioPanelUsdSinIva.unidad, "USD");
});

test("variable ausente → value null (drift), con label/unidad igual", () => {
  const out = buildMemoriaSingletonValues(sampleData);
  assert.equal(out.negociosPromedioMes.value, null);
  assert.equal(out.negociosPromedioMes.label, "Negocios promedio por mes");
});

test("variable no numérica → value null", () => {
  const out = buildMemoriaSingletonValues(sampleData);
  assert.equal(out.costoOtrosPesos.value, null);
});

test("cubre todas las claves declaradas en singletonLabels", () => {
  const out = buildMemoriaSingletonValues(sampleData);
  assert.equal(Object.keys(out).length, Object.keys(singletonLabels).length);
});

test("data vacía/ inválida no rompe", () => {
  assert.doesNotThrow(() => buildMemoriaSingletonValues(null));
  assert.equal(buildMemoriaSingletonValues(null).markupPorcentajeDefault.value, null);
});

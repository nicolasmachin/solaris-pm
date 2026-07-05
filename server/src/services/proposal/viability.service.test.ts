// Tests de los indicadores de viabilidad (función pura).
//   npm run test:viability

import { strict as assert } from "node:assert";
import { test } from "node:test";

import { computeViability } from "./viability.service.js";

// 11 paneles → espacioOcupado = 33 m².
const base = { cantidadPaneles: 11, tamanoM2: 40, pagaMensualPesos: 6000, ahorroMensualPesos: 6814.5 };

test("ahorro: paga 0 → null", () =>
  assert.equal(computeViability({ ...base, pagaMensualPesos: 0 }).ahorroPorcentaje, null));
test("ahorro: paga faltante (null) → null", () =>
  assert.equal(computeViability({ ...base, pagaMensualPesos: null }).ahorroPorcentaje, null));
test("ahorro: NaN → null", () =>
  assert.equal(computeViability({ ...base, ahorroMensualPesos: NaN }).ahorroPorcentaje, null));
test("ahorro: redondeado", () =>
  assert.equal(computeViability(base).ahorroPorcentaje, Math.round((6814.5 / 6000) * 100))); // 114

test("espacio 33/33 → warning (disponible = ocupado)", () =>
  assert.equal(computeViability({ ...base, tamanoM2: 33 }).estado, "warning"));
test("espacio 33/36 → warning (< ocupado×1.10)", () =>
  assert.equal(computeViability({ ...base, tamanoM2: 36 }).estado, "warning"));
test("espacio 33/40 → ok (≥ ocupado×1.10)", () =>
  assert.equal(computeViability({ ...base, tamanoM2: 40 }).estado, "ok"));
test("espacio 33/30 → error (disponible < ocupado)", () =>
  assert.equal(computeViability({ ...base, tamanoM2: 30 }).estado, "error"));
test("espacio tamanoM2 0 → unknown", () => {
  const r = computeViability({ ...base, tamanoM2: 0 });
  assert.equal(r.estado, "unknown");
  assert.equal(r.espacioDisponible, null);
});
test("espacio sin paneles (null) → unknown", () =>
  assert.equal(computeViability({ ...base, cantidadPaneles: null }).estado, "unknown"));

test("campos ocupado/disponible correctos", () => {
  const r = computeViability(base);
  assert.equal(r.espacioOcupado, 33);
  assert.equal(r.espacioDisponible, 40);
});

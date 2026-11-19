// Tests de la lógica pura del alta de proyectos desde el conector:
//   node --import tsx --test src/routes/mcp/tools/alta-proyecto.logic.test.ts

import { strict as assert } from "node:assert";
import { test } from "node:test";

import { describirFacturacion, facturacionDesdeMcp, mismoCliente } from "./alta-proyecto.logic.js";

const usd = (n: number) => `US$ ${n}`;

test("facturación normal: no pide monto ni motivo", () => {
  assert.deepEqual(facturacionDesdeMcp({ normal: true }), { normal: true, sinIvaUsd: null, motivo: null });
});

test("facturación normal conserva la nota (a nombre de quién)", () => {
  assert.equal(facturacionDesdeMcp({ normal: true, motivo: " a nombre de la SA " }).motivo, "a nombre de la SA");
});

test("otro monto sin monto ni motivo: error que dice qué falta", () => {
  assert.throws(() => facturacionDesdeMcp({ normal: false }), /monto sin IVA.*motivo/);
});

test("otro monto con motivo corto: error", () => {
  assert.throws(() => facturacionDesdeMcp({ normal: false, monto_sin_iva_usd: 100, motivo: "x" }), /motivo/);
});

test("sin factura = monto 0 con motivo", () => {
  const f = facturacionDesdeMcp({ normal: false, monto_sin_iva_usd: 0, motivo: "paga el banco" });
  assert.deepEqual(f, { normal: false, sinIvaUsd: 0, motivo: "paga el banco" });
  assert.equal(describirFacturacion(f, usd), "Sin factura — paga el banco");
});

test("otro monto se describe con el monto", () => {
  const f = facturacionDesdeMcp({ normal: false, monto_sin_iva_usd: 5000, motivo: "descuento" });
  assert.equal(describirFacturacion(f, usd), "Otro monto: US$ 5000 sin IVA — descuento");
});

test("mismo cliente: palabras en otro orden y con tildes", () => {
  assert.ok(mismoCliente("Juan Pérez", "perez juan carlos"));
  assert.ok(!mismoCliente("Juan Pérez", "Juan Rodríguez"));
  assert.ok(!mismoCliente("de la", "de la Fuente"));
});

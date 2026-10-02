// Tests de las fechas del reporte mensual. Runner builtin node:test:
//   node --import tsx --test src/services/reporteSemanal/reporte-mensual.test.ts

import { strict as assert } from "node:assert";
import { test } from "node:test";

import { calcularMesCerrado, mesAnterior } from "./reporte-mensual.job.js";

test("corriendo el 1 de octubre a las 00:01 (Uruguay) devuelve septiembre entero", () => {
  const m = calcularMesCerrado(new Date("2026-10-01T03:01:00Z"));
  assert.equal(m.etiqueta, "septiembre de 2026");
  assert.equal(m.inicio.toISOString(), "2026-09-01T03:00:00.000Z");
  assert.equal(m.fin.toISOString(), "2026-10-01T03:00:00.000Z");
});

test("el 30 de septiembre a las 23:30 (Uruguay) todavía es septiembre: el cerrado es agosto", () => {
  // 23:30 en Montevideo = 02:30 UTC del 1 de octubre.
  const m = calcularMesCerrado(new Date("2026-10-01T02:30:00Z"));
  assert.equal(m.etiqueta, "agosto de 2026");
});

test("en enero el mes cerrado es diciembre del año anterior", () => {
  const m = calcularMesCerrado(new Date("2027-01-01T03:01:00Z"));
  assert.equal(m.etiqueta, "diciembre de 2026");
  assert.equal(m.fin.toISOString(), "2027-01-01T03:00:00.000Z");
});

test("el anterior de enero es diciembre", () => {
  const ene = calcularMesCerrado(new Date("2027-02-01T03:01:00Z"));
  assert.equal(ene.etiqueta, "enero de 2027");
  assert.equal(mesAnterior(ene).etiqueta, "diciembre de 2026");
});

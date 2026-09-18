import { test } from "node:test";
import assert from "node:assert/strict";

import { periodoTextoCorto, periodoTextoLargo } from "./format.js";
import { hoyUruguay, periodoCerrado } from "./periodo.js";

test("texto del período: mes calendario", () => {
  assert.equal(periodoTextoLargo("2026-08", null), "1 al 31 de agosto de 2026");
  assert.equal(periodoTextoCorto("2026-08", null), "1 al 31 ago 2026");
  assert.equal(periodoTextoLargo("2026-02", undefined), "1 al 28 de febrero de 2026");
});

test("texto del período: ciclo del medidor", () => {
  assert.equal(periodoTextoLargo("2026-08", 6), "7 de julio al 6 de agosto de 2026");
  assert.equal(periodoTextoCorto("2026-08", 6), "7 jul al 6 ago 2026");
  // Cruza de año: el año va en los dos extremos.
  assert.equal(periodoTextoLargo("2026-01", 10), "11 de diciembre de 2025 al 10 de enero de 2026");
  assert.equal(periodoTextoCorto("2026-01", 10), "11 dic 2025 al 10 ene 2026");
});

test("hoy en Uruguay: las 01:00 UTC todavía son el día anterior", () => {
  assert.equal(hoyUruguay(new Date("2026-09-07T01:00:00Z")), "2026-09-06");
  assert.equal(hoyUruguay(new Date("2026-09-07T03:00:00Z")), "2026-09-07");
});

test("período cerrado", () => {
  const el18deSetiembre = new Date("2026-09-18T15:00:00Z");
  // Mes en curso sin corte: abierto.
  assert.equal(periodoCerrado("2026-09", null, el18deSetiembre), false);
  // Mes anterior: cerrado.
  assert.equal(periodoCerrado("2026-08", null, el18deSetiembre), true);
  // Corte 6: el ciclo 7 ago → 6 sep ya cerró; corte 25: todavía no.
  assert.equal(periodoCerrado("2026-09", 6, el18deSetiembre), true);
  assert.equal(periodoCerrado("2026-09", 25, el18deSetiembre), false);
  // El mismo día del corte todavía no cerró (falta medir ese día).
  assert.equal(periodoCerrado("2026-09", 18, el18deSetiembre), false);
  assert.equal(periodoCerrado("2026-09", 17, el18deSetiembre), true);
});

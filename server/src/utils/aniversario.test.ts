import assert from "node:assert/strict";
import { test } from "node:test";

import { getAnclaAniversario } from "./aniversario.js";

const entrega = new Date("2025-07-16");
const habilitacion = new Date("2026-03-01");
const base = { postHabilitacionInicioEn: null, actualUteEnd: null, plannedEndDate: entrega, importedFromCsv: true };

test("la fecha de habilitación manda sobre la de entrega", () => {
  assert.equal(getAnclaAniversario({ ...base, actualUteEnd: habilitacion }), habilitacion);
});

test("un importado sin habilitación usa la fecha de entrega", () => {
  assert.equal(getAnclaAniversario(base), entrega);
});

test("un proyecto normal sin habilitar no tiene ancla, aunque tenga fecha prevista", () => {
  assert.equal(getAnclaAniversario({ ...base, importedFromCsv: false }), null);
});

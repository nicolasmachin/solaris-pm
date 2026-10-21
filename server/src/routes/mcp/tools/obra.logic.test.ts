// Tests de la lógica pura de las herramientas de obra del conector:
//   node --import tsx --test src/routes/mcp/tools/obra.logic.test.ts

import { strict as assert } from "node:assert";
import { test } from "node:test";

import { buscarSubetapa, diaCorto, huecosLibres, ocuparTramo } from "./obra.logic.js";

// Semana del lunes 2 al domingo 8 de noviembre de 2026 (sin feriados).
test("sin nada agendado, un solo hueco con los días hábiles", () => {
  assert.deepEqual(huecosLibres("2026-11-02", "2026-11-08", new Set()), [
    { desde: "2026-11-02", hasta: "2026-11-06", diasHabiles: 5 },
  ]);
});

test("una obra de martes a miércoles parte la semana en dos huecos", () => {
  const ocupados = new Set<string>();
  ocuparTramo(ocupados, "2026-11-03", "2026-11-04", "2026-11-02", "2026-11-08");
  assert.deepEqual(huecosLibres("2026-11-02", "2026-11-08", ocupados), [
    { desde: "2026-11-02", hasta: "2026-11-02", diasHabiles: 1 },
    { desde: "2026-11-05", hasta: "2026-11-06", diasHabiles: 2 },
  ]);
});

test("el fin de semana no corta un hueco de viernes a lunes", () => {
  const ocupados = new Set(["2026-11-02", "2026-11-03", "2026-11-04", "2026-11-05", "2026-11-10"]);
  assert.deepEqual(huecosLibres("2026-11-02", "2026-11-10", ocupados), [
    { desde: "2026-11-06", hasta: "2026-11-09", diasHabiles: 2 },
  ]);
});

test("un tramo que empieza antes del rango se recorta al rango", () => {
  const ocupados = new Set<string>();
  ocuparTramo(ocupados, "2026-10-28", "2026-11-03", "2026-11-02", "2026-11-06");
  assert.deepEqual([...ocupados].sort(), ["2026-11-02", "2026-11-03"]);
});

test("los feriados no cuentan como días libres (25 de agosto)", () => {
  const huecos = huecosLibres("2026-08-24", "2026-08-28", new Set());
  assert.equal(huecos.reduce((s, h) => s + h.diasHabiles, 0), 4);
});

test("diaCorto", () => {
  assert.equal(diaCorto("2026-11-02"), "lun 2/11");
});

const subs = [
  { id: "a1", name: "Retiro de sobrantes" },
  { id: "b2", name: "Control de obra" },
  { id: "c3", name: "Realización de la obra" },
  { id: "d4", name: "Informe del capataz" },
];

test("buscarSubetapa por id", () => {
  assert.deepEqual(buscarSubetapa(subs, "b2").map((s) => s.id), ["b2"]);
});

test("buscarSubetapa por nombre sin tildes ni mayúsculas", () => {
  assert.deepEqual(buscarSubetapa(subs, "realizacion de la OBRA").map((s) => s.id), ["c3"]);
});

test("buscarSubetapa: el nombre exacto le gana al que lo contiene", () => {
  assert.deepEqual(buscarSubetapa(subs, "control de obra").map((s) => s.id), ["b2"]);
});

test("buscarSubetapa: una parte del nombre que coincide con varias devuelve todas", () => {
  // "sobrantes" también contiene "obra": la búsqueda parcial es literal.
  assert.deepEqual(buscarSubetapa(subs, "obra").map((s) => s.id), ["a1", "b2", "c3"]);
});

test("buscarSubetapa: sin coincidencias", () => {
  assert.deepEqual(buscarSubetapa(subs, "gabinete"), []);
});

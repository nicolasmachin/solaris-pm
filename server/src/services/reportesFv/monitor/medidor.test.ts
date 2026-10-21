// Tests de la detección de "medidor invertido".
// Correr: npm run test:fv-medidor

import assert from "node:assert/strict";
import { test } from "node:test";

import { evaluarMedidor, exportaMasDeLoQueGenera, type DiaMedidor } from "./medidor.js";
import { rangoDias, sumarDias } from "./dias.js";

const DIA = "2026-10-20";

function serie(dias: Array<[number | null, number | null] | null>): Map<string, DiaMedidor> {
  const fechas = rangoDias(sumarDias(DIA, -(dias.length - 1)), DIA);
  const m = new Map<string, DiaMedidor>();
  fechas.forEach((f, i) => {
    const d = dias[i];
    if (d) m.set(f, { generacionKwh: d[0], exportacionKwh: d[1] });
  });
  return m;
}

test("caso Rodolfo Sosa: exporta más de lo que genera varios días → alerta", () => {
  // 18: 53/87, 19: 75/72, 20: 64/88
  const r = evaluarMedidor({ dia: DIA, historial: serie([[53, 87], [75, 72], [64, 88]]) });
  assert.equal(r.alerta, true);
  assert.equal(r.diasConExceso, 2);
  assert.match(r.detalle!, /al revés/);
});

test("planta normal (exporta una parte de lo que genera) → sin alerta", () => {
  const r = evaluarMedidor({ dia: DIA, historial: serie([[63, 18], [80, 40], [70, 30]]) });
  assert.equal(r.alerta, false);
});

test("un solo día con exceso no alcanza", () => {
  const r = evaluarMedidor({ dia: DIA, historial: serie([[60, 20], [60, 25], [40, 55]]) });
  assert.equal(r.alerta, false);
});

test("si el día evaluado ya mide bien, no alerta (se corrigió)", () => {
  const r = evaluarMedidor({ dia: DIA, historial: serie([[53, 87], [64, 88], [70, 20]]) });
  assert.equal(r.alerta, false);
});

test("los días sin dato del medidor se saltean, no cortan", () => {
  const r = evaluarMedidor({ dia: DIA, historial: serie([[53, 87], [60, null], null, [64, 88]]) });
  assert.equal(r.alerta, true);
});

test("exceso chico (desfase de horario) no cuenta", () => {
  assert.equal(exportaMasDeLoQueGenera({ generacionKwh: 50, exportacionKwh: 51 }), false);
  assert.equal(exportaMasDeLoQueGenera({ generacionKwh: 50, exportacionKwh: 54 }), false); // < 10 %
  assert.equal(exportaMasDeLoQueGenera({ generacionKwh: 50, exportacionKwh: 56 }), true);
  // Día nublado de noche larga: genera poco y "exporta" lo que se compró.
  assert.equal(exportaMasDeLoQueGenera({ generacionKwh: 1, exportacionKwh: 29 }), true);
});

// Tests de las funciones puras del reporte semanal (sin DB).
//   npm run test:reporte-semanal

import { strict as assert } from "node:assert";
import { test } from "node:test";

import { calcularSemana, montoDeVenta, numeroSemanaIso } from "./reporte-semanal.job.js";

const snapshotCon = (calc: Record<string, number>) => ({ calc });

test("montoDeVenta: usa la propuesta congelada en la comisión", () => {
  const monto = montoDeVenta({
    estimatedBudgetUsd: 9999,
    commission: { proposalVersion: { snapshot: snapshotCon({ totalConIva: 12000 }) } },
    proposalV2Versions: [{ snapshot: snapshotCon({ totalConIva: 15000 }) }],
  });
  assert.equal(monto, 12000);
});

test("montoDeVenta: sin comisión, cae a la última propuesta publicada", () => {
  const monto = montoDeVenta({
    estimatedBudgetUsd: 9999,
    commission: null,
    proposalV2Versions: [{ snapshot: snapshotCon({ totalConIva: 15496 }) }],
  });
  assert.equal(monto, 15496);
});

test("montoDeVenta: prefiere totalFinalConIva cuando el snapshot lo trae", () => {
  const monto = montoDeVenta({
    estimatedBudgetUsd: null,
    commission: null,
    proposalV2Versions: [{ snapshot: snapshotCon({ totalConIva: 10000, totalFinalConIva: 10800 }) }],
  });
  assert.equal(monto, 10800);
});

test("montoDeVenta: sin propuestas, cae al presupuesto estimado del lead", () => {
  const monto = montoDeVenta({ estimatedBudgetUsd: 15496, commission: null, proposalV2Versions: [] });
  assert.equal(monto, 15496);
});

test("montoDeVenta: sin nada devuelve null (se muestra 's/dato')", () => {
  const monto = montoDeVenta({ estimatedBudgetUsd: null, commission: null, proposalV2Versions: [] });
  assert.equal(monto, null);
});

test("calcularSemana: corriendo el lunes 00:01 devuelve la semana anterior cerrada", () => {
  // Lunes 14/09/2026 00:01 hora Uruguay = 03:01 UTC.
  const semana = calcularSemana(new Date("2026-09-14T03:01:00Z"));
  assert.equal(semana.etiqueta, "lunes 07/09 – domingo 13/09/2026");
  assert.equal(semana.semanaIso, 37);
});

test("numeroSemanaIso: el jueves define el año ISO", () => {
  assert.deepEqual(numeroSemanaIso(new Date("2026-01-01T00:00:00Z")), { semana: 1, anio: 2026 });
});

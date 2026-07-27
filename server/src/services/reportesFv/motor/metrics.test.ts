// Unit tests de las funciones puras del motor.
//
// El golden test cubre la equivalencia global; esto cubre los casos borde que
// el histórico no ejercita y las dos trampas del port (redondeo bancario y la
// semántica de min/max con NaN).
//
// Correr: npm run test:reportes-fv

import assert from "node:assert/strict";
import { test } from "node:test";

import {
  aplicarSaldoCuentaCorriente,
  calcularAutoconsumo,
  calcularCostoEnergiaSimple,
  calcularDesgloseBeneficio,
  calcularFactura,
  calcularImportacionRed,
  pyMax,
  pyMin,
  round2,
} from "./metrics.js";
import type { TramoEscalonado } from "./types.js";

// Los tramos reales de la tarifa simple.
const TRAMOS: TramoEscalonado[] = [
  { desdeKwh: 0, hastaKwh: 100, precioKwh: 5 },
  { desdeKwh: 101, hastaKwh: 600, precioKwh: 8 },
  { desdeKwh: 601, hastaKwh: 9999999, precioKwh: 11 },
];

test("round2 replica el redondeo bancario de Python", () => {
  // El caso clásico: 2.675 en binario es 2.674999…, Python da 2.67.
  // Math.round(2.675 * 100) / 100 daría 2.68.
  assert.equal(round2(2.675), 2.67);
  assert.equal(round2(1.005), 1.0); // 1.00499… en binario
  assert.equal(round2(0.125), 0.12); // empate exacto → al par
  assert.equal(round2(0.135), 0.14); // 0.13500000000000001 → sube
  assert.equal(round2(2.5), 2.5);
  assert.equal(round2(-2.675), -2.67);
  assert.equal(round2(1234.5678), 1234.57);
  assert.equal(round2(0), 0);
  assert.ok(Number.isNaN(round2(Number.NaN)));
});

test("pyMin/pyMax no propagan NaN como Math.min/Math.max", () => {
  // De esta asimetría depende que el saldo de cuenta corriente arranque en 0 en
  // los meses previos a la instalación, en vez de quedar NaN para siempre.
  assert.ok(Number.isNaN(pyMax(Number.NaN, 0)));
  assert.equal(pyMax(0, Number.NaN), 0);
  assert.equal(pyMin(0, Number.NaN), 0);
  assert.ok(Number.isNaN(pyMin(Number.NaN, 0)));
  // Comportamiento normal sin NaN
  assert.equal(pyMax(3, 7), 7);
  assert.equal(pyMin(3, 7), 3);
});

test("el primer tramo escalonado cubre 101 kWh, no 100 (quirk del original)", () => {
  // capacidad = hasta - desde + 1 = 100 - 0 + 1 = 101
  assert.equal(calcularCostoEnergiaSimple(100, TRAMOS), 500); // 100 × 5
  assert.equal(calcularCostoEnergiaSimple(101, TRAMOS), 505); // 101 × 5, todavía en el primer tramo
  assert.equal(calcularCostoEnergiaSimple(102, TRAMOS), 513); // 101×5 + 1×8
  assert.equal(calcularCostoEnergiaSimple(0, TRAMOS), 0);
});

test("el costo escalonado suma los tramos sucesivos", () => {
  // 101×5 + 500×8 = 505 + 4000 = 4505; el resto a 11
  assert.equal(calcularCostoEnergiaSimple(601, TRAMOS), 4505);
  assert.equal(calcularCostoEnergiaSimple(701, TRAMOS), 4505 + 100 * 11);
});

test("autoconsumo e importación nunca son negativos", () => {
  assert.equal(calcularAutoconsumo(500, 200), 300);
  assert.equal(calcularAutoconsumo(200, 500), 0); // exportó más de lo que generó
  assert.equal(calcularImportacionRed(1000, 500, 200), 700);
  assert.equal(calcularImportacionRed(100, 500, 0), 0); // generó de más
});

test("la factura convierte el neto negativo en saldo a favor", () => {
  const f = calcularFactura({
    cargoFijo: 200,
    cargoPotencia: 400,
    cargoEnergia: 100,
    creditoExportacion: 5000,
  });
  assert.equal(f.totalNeto, 0);
  assert.ok(f.saldoAFavor > 0);
  // Sólo potencia + energía gravan IVA; el cargo fijo no.
  assert.equal(f.iva, round2((400 + 100) * 0.22));
  assert.equal(f.irpf, round2(5000 * 0.12));
});

test("la factura sin exportación no genera saldo", () => {
  const f = calcularFactura({ cargoFijo: 200, cargoPotencia: 400, cargoEnergia: 1000 });
  assert.equal(f.saldoAFavor, 0);
  assert.ok(f.totalNeto > 0);
  assert.equal(f.irpf, 0);
});

test("la cuenta corriente aplica sólo hasta cubrir la deuda", () => {
  const factura = calcularFactura({ cargoFijo: 200, cargoPotencia: 100, cargoEnergia: 100 });
  const deuda = factura.totalNeto;

  // Saldo mayor que la deuda: se aplica sólo lo necesario y sobra.
  const conSobrante = aplicarSaldoCuentaCorriente(factura, deuda + 1000);
  assert.equal(conSobrante.saldoAplicado, deuda);
  assert.equal(conSobrante.totalNeto, 0);
  assert.equal(conSobrante.saldoFinal, 1000);

  // Saldo menor: se aplica todo y queda deuda.
  const conFaltante = aplicarSaldoCuentaCorriente(factura, 50);
  assert.equal(conFaltante.saldoAplicado, 50);
  assert.equal(conFaltante.totalNeto, round2(deuda - 50));
  assert.equal(conFaltante.saldoFinal, 0);
});

test("un mes sin datos vacía el saldo en vez de dejarlo en NaN", () => {
  // Es lo que pasa con los meses previos a la instalación: el consumo viene
  // vacío, la factura da NaN, pero el saldo tiene que seguir siendo un número.
  const facturaNaN = calcularFactura({
    cargoFijo: 200,
    cargoPotencia: 100,
    cargoEnergia: Number.NaN,
  });
  assert.equal(facturaNaN.saldoAFavor, 0, "NaN < 0 es false, no genera saldo");

  const ajustada = aplicarSaldoCuentaCorriente(facturaNaN, 1500);
  assert.equal(ajustada.saldoAplicado, 1500);
  assert.equal(ajustada.saldoFinal, 0);
});

test("el desglose no divide por cero cuando no hubo ahorro", () => {
  const f = calcularFactura({ cargoFijo: 200, cargoPotencia: 100, cargoEnergia: 100 });
  const d = calcularDesgloseBeneficio(f, f);
  assert.equal(d.pctAutoconsumo, 0);
  assert.equal(d.pctVenta, 0);
  assert.ok(Number.isFinite(d.ahorroTotal));
});

test("el desglose reparte el ahorro entre autoconsumo y venta", () => {
  const sin = calcularFactura({ cargoFijo: 200, cargoPotencia: 400, cargoEnergia: 3000 });
  const con = calcularFactura({
    cargoFijo: 200,
    cargoPotencia: 400,
    cargoEnergia: 500,
    creditoExportacion: 800,
  });
  const d = calcularDesgloseBeneficio(sin, con);

  assert.equal(d.ahorroAutoconsumo, round2(sin.totalNeto - con.totalBruto));
  assert.equal(d.ahorroVenta, round2(800 - con.irpf));
  assert.equal(d.ahorroTotal, round2(d.ahorroAutoconsumo + d.ahorroVenta));
  assert.ok(Math.abs(d.pctAutoconsumo + d.pctVenta - 100) < 0.2);
});

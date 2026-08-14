// Tests de las funciones puras del servicio de comisiones (sin DB).
//   npm run test:commission

import { strict as assert } from "node:assert";
import { test } from "node:test";

import { firstDayOfNextMonth, readComisionFromSnapshot } from "./commission.service.js";

test("firstDayOfNextMonth: día normal → día 1 del mes siguiente", () => {
  const r = firstDayOfNextMonth(new Date("2026-03-10T12:00:00Z"));
  assert.equal(r.toISOString(), "2026-04-01T00:00:00.000Z");
});

test("firstDayOfNextMonth: día 31 no saltea meses", () => {
  const r = firstDayOfNextMonth(new Date("2026-01-31T23:59:00Z"));
  assert.equal(r.toISOString(), "2026-02-01T00:00:00.000Z");
});

test("firstDayOfNextMonth: diciembre → enero del año siguiente", () => {
  const r = firstDayOfNextMonth(new Date("2026-12-15T00:00:00Z"));
  assert.equal(r.toISOString(), "2027-01-01T00:00:00.000Z");
});

test("readComisionFromSnapshot: lee monto y % del snapshot", () => {
  const snap = {
    calc: { comisionVentasUsdSinIva: 400, totalConIva: 10800 },
    defaults: { comisionVendedorPorcentaje: 0.04 },
  } as unknown as import("@prisma/client").Prisma.JsonValue;
  const { montoUsd, porcentaje } = readComisionFromSnapshot(snap);
  assert.equal(montoUsd, 400);
  assert.equal(porcentaje, 0.04);
});

test("readComisionFromSnapshot: % como string se coacciona a número", () => {
  const snap = {
    calc: { comisionVentasUsdSinIva: 123.45 },
    defaults: { comisionVendedorPorcentaje: "0.04" },
  } as unknown as import("@prisma/client").Prisma.JsonValue;
  const { montoUsd, porcentaje } = readComisionFromSnapshot(snap);
  assert.equal(montoUsd, 123.45);
  assert.equal(porcentaje, 0.04);
});

test("readComisionFromSnapshot: sin comisión → null (dispara carga manual)", () => {
  const snap = { calc: {}, defaults: {} } as unknown as import("@prisma/client").Prisma.JsonValue;
  const { montoUsd, porcentaje } = readComisionFromSnapshot(snap);
  assert.equal(montoUsd, null);
  assert.equal(porcentaje, null);
});

// ─── % efectivo: el snapshot manda sobre el default global ──────────────────
//
// Con el cotizador B2B la comisión dejó de ser un % fijo: crece con el markup
// negociado. El porcentaje que se congela tiene que ser el que efectivamente se
// aplicó, no el del singleton.

test("snapshot nuevo: usa el % efectivo del cálculo, no el default", () => {
  const r = readComisionFromSnapshot({
    calc: { comisionVentasUsdSinIva: 1481.14, comisionVentasPctEfectivo: 0.0631 },
    defaults: { comisionVendedorPorcentaje: 0.04 },
  } as never);
  assert.equal(r.montoUsd, 1481.14);
  assert.equal(r.porcentaje, 0.0631);
});

test("snapshot viejo sin % efectivo: cae al default del singleton", () => {
  const r = readComisionFromSnapshot({
    calc: { comisionVentasUsdSinIva: 389.99 },
    defaults: { comisionVendedorPorcentaje: 0.04 },
  } as never);
  assert.equal(r.montoUsd, 389.99);
  assert.equal(r.porcentaje, 0.04);
});

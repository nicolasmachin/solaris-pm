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

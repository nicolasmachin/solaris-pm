// Tests de las dos funciones puras de pagos a instaladores: cuánto se congela de
// la propuesta y cómo se deriva el saldo/estado de los pagos entregados.
//   npm run test:installer-payment

import { strict as assert } from "node:assert";
import { test } from "node:test";

import { Prisma } from "@prisma/client";

import { calcularSaldo, readManoDeObraFromSnapshot } from "./installer-payment.service.js";

// ─── Monto congelado de la propuesta ─────────────────────────────────────────

function snapshotCon(manoDeObraUsdSinIva: unknown) {
  return { calc: { manoDeObraUsdSinIva } } as unknown as Prisma.JsonValue;
}

test("congela la mano de obra con IVA", () => {
  // 1000 sin IVA → 1220 con IVA (22%).
  assert.equal(readManoDeObraFromSnapshot(snapshotCon(1000)), 1220);
  // Redondeo a centavos: 1152 × 1,22 = 1405,44.
  assert.equal(readManoDeObraFromSnapshot(snapshotCon(1152)), 1405.44);
});

test("redondea a dos decimales, sin arrastrar coma flotante", () => {
  const r = readManoDeObraFromSnapshot(snapshotCon(333.33));
  assert.equal(r, 406.66);
  assert.equal(Number.isInteger(r! * 100), true, "el resultado tiene que ser centavos exactos");
});

test("devuelve null cuando el snapshot no sirve", () => {
  assert.equal(readManoDeObraFromSnapshot(snapshotCon(undefined)), null);
  assert.equal(readManoDeObraFromSnapshot(snapshotCon(0)), null, "0 no es un monto a pagar");
  assert.equal(readManoDeObraFromSnapshot(snapshotCon(-5)), null, "negativo es dato corrupto");
  assert.equal(readManoDeObraFromSnapshot(snapshotCon("1000")), null, "string no se coerciona");
  assert.equal(readManoDeObraFromSnapshot(snapshotCon(Number.NaN)), null);
  assert.equal(readManoDeObraFromSnapshot({} as Prisma.JsonValue), null, "snapshot sin calc");
  assert.equal(readManoDeObraFromSnapshot(null), null, "snapshot vacío");
});

// ─── Saldo y estado ──────────────────────────────────────────────────────────

const mov = (monto: number) => ({ monto: new Prisma.Decimal(monto) });

test("sin pagos queda PENDIENTE y el saldo es el total", () => {
  const r = calcularSaldo(1000, []);
  assert.equal(r.status, "PENDIENTE");
  assert.equal(r.pagadoUsd, 0);
  assert.equal(r.saldoUsd, 1000);
});

test("un pago que no cubre todo deja PARCIAL", () => {
  const r = calcularSaldo(1000, [mov(400)]);
  assert.equal(r.status, "PARCIAL");
  assert.equal(r.pagadoUsd, 400);
  assert.equal(r.saldoUsd, 600);
});

test("varios pagos que suman el total dejan PAGADO", () => {
  const r = calcularSaldo(1000, [mov(400), mov(350), mov(250)]);
  assert.equal(r.status, "PAGADO");
  assert.equal(r.pagadoUsd, 1000);
  assert.equal(r.saldoUsd, 0);
});

test("el saldo no queda en PARCIAL por un error de coma flotante", () => {
  // 0.1 + 0.2 !== 0.3 en punto flotante: sin tolerancia esto daría PARCIAL con
  // un saldo de -0.0000000000000004.
  const r = calcularSaldo(0.3, [mov(0.1), mov(0.2)]);
  assert.equal(r.status, "PAGADO");
  assert.equal(r.saldoUsd, 0);
});

test("un centavo pendiente sigue siendo PARCIAL", () => {
  const r = calcularSaldo(1000, [mov(999.99)]);
  assert.equal(r.status, "PARCIAL");
  assert.equal(r.saldoUsd, 0.01);
});

test("si se pagó de más el saldo queda negativo pero el estado es PAGADO", () => {
  // No debería pasar (la ruta rechaza pagos que superen el saldo), pero si un
  // admin baja el monto desde Finanzas después de haber pagado, el estado tiene
  // que reflejar que ya está saldado en vez de romperse.
  const r = calcularSaldo(500, [mov(600)]);
  assert.equal(r.status, "PAGADO");
  assert.equal(r.saldoUsd, -100);
});

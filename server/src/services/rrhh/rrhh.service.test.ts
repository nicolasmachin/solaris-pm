import assert from "node:assert/strict";
import { test } from "node:test";

import { diasHasta, estadoVencimiento } from "./rrhh.service.js";

const d = (iso: string) => new Date(`${iso}T00:00:00.000Z`);

test("días hasta el vencimiento, en días de Uruguay", () => {
  assert.equal(diasHasta(d("2026-11-10"), "2026-10-26"), 15);
  assert.equal(diasHasta(d("2026-10-26"), "2026-10-26"), 0);
  assert.equal(diasHasta(d("2026-10-25"), "2026-10-26"), -1);
});

test("estado del vencimiento", () => {
  assert.equal(estadoVencimiento(null, "2026-10-26"), null);
  assert.equal(estadoVencimiento(d("2026-10-26"), "2026-10-26"), "POR_VENCER"); // vence hoy: todavía vale
  assert.equal(estadoVencimiento(d("2026-10-25"), "2026-10-26"), "VENCIDO");
  assert.equal(estadoVencimiento(d("2026-11-25"), "2026-10-26"), "POR_VENCER"); // 30 días justos
  assert.equal(estadoVencimiento(d("2026-11-26"), "2026-10-26"), "VIGENTE");
});

// Tests de la tabla de precios de IA. Runner builtin node:test:
//   node --import tsx --test src/services/ai/pricing.test.ts

import { strict as assert } from "node:assert";
import { test } from "node:test";

import { costoAnthropic, costoWhisper } from "./pricing.js";

const cerca = (a: number | null, b: number) => {
  assert.ok(a !== null, "esperaba un costo, vino null");
  assert.ok(Math.abs(a - b) < 1e-9, `${a} ≠ ${b}`);
};

test("Sonnet 4.5: 3 USD el millón de entrada, 15 el de salida", () => {
  cerca(costoAnthropic("claude-sonnet-4-5", { input: 1_000_000, output: 1_000_000 }), 18);
});

test("el ID con fecha cobra igual que el alias", () => {
  cerca(
    costoAnthropic("claude-sonnet-4-5-20250929", { input: 2000, output: 500 }),
    2000 * 3e-6 + 500 * 15e-6,
  );
});

test("Haiku 4.5: 1 y 5 USD el millón", () => {
  cerca(costoAnthropic("claude-haiku-4-5-20251001", { input: 1_000_000, output: 200_000 }), 1 + 1);
});

test("Opus 5.5 no cae en el precio de Opus 5", () => {
  cerca(costoAnthropic("claude-opus-5-5", { input: 1_000_000, output: 0 }), 4);
  cerca(costoAnthropic("claude-opus-5", { input: 1_000_000, output: 0 }), 5);
});

test("caché: leer a 0,1× y escribir a 1,25× el precio de entrada", () => {
  cerca(
    costoAnthropic("claude-sonnet-4-5", {
      input: 0,
      output: 0,
      cacheRead: 1_000_000,
      cacheWrite: 1_000_000,
    }),
    0.3 + 3.75,
  );
});

test("modelo desconocido: costo null, no un precio inventado", () => {
  assert.equal(costoAnthropic("gpt-4o", { input: 1000, output: 1000 }), null);
});

test("Whisper: 0,006 USD por minuto", () => {
  cerca(costoWhisper("whisper-1", 90), 0.009);
  assert.equal(costoWhisper("whisper-9", 60), null);
});

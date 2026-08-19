// Tests de la fecha del documento. Runner builtin node:test:
//   npm run test:initial-draft
//
// El caso que motivó esto: el borrador es uno por lead y sobrevive entre
// versiones, así que su `fecha` quedaba clavada en la de la V1 y una V2
// emitida días después salía con la fecha vieja impresa en la portada.

import { strict as assert } from "node:assert";
import { test } from "node:test";

import { fechaVigente, todayIso } from "./initial-draft.js";

function sumarDias(iso: string, dias: number): string {
  const d = new Date(`${iso}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + dias);
  return d.toISOString().slice(0, 10);
}

test("una fecha vencida se corrige al día de emisión", () => {
  assert.equal(fechaVigente("2026-08-12"), todayIso());
  assert.equal(fechaVigente(sumarDias(todayIso(), -1)), todayIso());
});

test("la fecha de hoy se respeta tal cual", () => {
  const hoy = todayIso();
  assert.equal(fechaVigente(hoy), hoy);
});

test("una fecha futura se respeta: fechar hacia adelante es intencional", () => {
  const manana = sumarDias(todayIso(), 1);
  assert.equal(fechaVigente(manana), manana);
  const enUnMes = sumarDias(todayIso(), 30);
  assert.equal(fechaVigente(enUnMes), enUnMes);
});

test("sin fecha o con basura, cae al día de emisión", () => {
  for (const v of [undefined, null, "", "ayer", "12/08/2026", "2026-8-1"]) {
    assert.equal(fechaVigente(v as string | undefined), todayIso(), `entrada: ${String(v)}`);
  }
});

test("todayIso da la fecha de Uruguay, no la UTC", () => {
  // El servidor corre en UTC: desde las 21:00 local, un toISOString() pelado
  // adelanta el documento un día.
  const esperado = new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Montevideo",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
  assert.equal(todayIso(), esperado);
  assert.match(todayIso(), /^\d{4}-\d{2}-\d{2}$/);
});

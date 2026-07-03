// Tests de los helpers Handlebars de la propuesta v2. Runner builtin node:test:
//   npm run test:proposal-template

import { strict as assert } from "node:assert";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import { fileURLToPath } from "node:url";

import Handlebars from "handlebars";

import "./template.js"; // side-effect: registra los helpers (tarifaLabel, etc.)

const tarifaLabel = (t: string) => Handlebars.compile("{{tarifaLabel t}}")({ t });

test("tarifaLabel: Simple → Simple", () => assert.equal(tarifaLabel("Simple"), "Simple"));
test("tarifaLabel: Doble → Doble Horario", () => assert.equal(tarifaLabel("Doble"), "Doble Horario"));
test("tarifaLabel: Triple → Triple Horario", () => assert.equal(tarifaLabel("Triple"), "Triple Horario"));
test("tarifaLabel: fallback devuelve el valor tal cual", () => assert.equal(tarifaLabel("Otra"), "Otra"));

// ─── Cuotas BBVA: se muestran en pesos SIN multiplicar por el dólar ─────────
// (calculate() ya las devuelve en pesos; el bug 40x era un `mult ...dólar` extra.)
test("cuota BBVA en pesos = valor de calculate() sin ×dólar", () => {
  const out = Handlebars.compile("{{pesos calculated.cuota24m}}")({ calculated: { cuota24m: 22450.24 } });
  assert.equal(out, "$ 22.450");
});

test("los partials NO reintroducen la multiplicación por cotizacionDolar en las cuotas", () => {
  const partials = ["financiacion.hbs", "resumen.hbs"];
  for (const p of partials) {
    const html = readFileSync(
      fileURLToPath(new URL(`../../templates/proposal-v2/partials/${p}`, import.meta.url)),
      "utf8",
    );
    assert.ok(
      !/mult\s+calculated\.cuota/.test(html),
      `${p} volvió a multiplicar la cuota por el dólar (mult calculated.cuota…)`,
    );
    for (const n of ["24", "36", "60"]) {
      assert.ok(
        html.includes(`{{pesos calculated.cuota${n}m}}`),
        `${p} debe renderizar {{pesos calculated.cuota${n}m}}`,
      );
    }
  }
});

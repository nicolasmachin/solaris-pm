// Tests de los helpers Handlebars de la propuesta v2. Runner builtin node:test:
//   npm run test:proposal-template

import { strict as assert } from "node:assert";
import { test } from "node:test";

import Handlebars from "handlebars";

import "./template.js"; // side-effect: registra los helpers (tarifaLabel, etc.)

const tarifaLabel = (t: string) => Handlebars.compile("{{tarifaLabel t}}")({ t });

test("tarifaLabel: Simple → Simple", () => assert.equal(tarifaLabel("Simple"), "Simple"));
test("tarifaLabel: Doble → Doble Horario", () => assert.equal(tarifaLabel("Doble"), "Doble Horario"));
test("tarifaLabel: Triple → Triple Horario", () => assert.equal(tarifaLabel("Triple"), "Triple Horario"));
test("tarifaLabel: fallback devuelve el valor tal cual", () => assert.equal(tarifaLabel("Otra"), "Otra"));

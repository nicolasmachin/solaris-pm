// Tests del fallback del asesor (buildAdvisor). Runner node:test:
//   node --import tsx --test src/services/proposal/advisor.test.ts

import { strict as assert } from "node:assert";
import { test } from "node:test";

import { buildAdvisor } from "./advisor.js";

test("buildAdvisor: valores completos pasan tal cual", () => {
  assert.deepEqual(
    buildAdvisor({ name: "Ana Pérez", jobTitle: "Asesora Senior", email: "ana@voltia.com.uy" }),
    { name: "Ana Pérez", jobTitle: "Asesora Senior", email: "ana@voltia.com.uy" },
  );
});

test("buildAdvisor: jobTitle null → 'Asesor Comercial'", () => {
  const a = buildAdvisor({ name: "Ana Pérez", jobTitle: null, email: "ana@voltia.com.uy" });
  assert.equal(a.jobTitle, "Asesor Comercial");
  assert.equal(a.name, "Ana Pérez");
});

test("buildAdvisor: jobTitle vacío/whitespace → 'Asesor Comercial'", () => {
  assert.equal(buildAdvisor({ name: "Ana", jobTitle: "   ", email: "a@b.c" }).jobTitle, "Asesor Comercial");
});

test("buildAdvisor: name vacío/null → 'Voltia'", () => {
  assert.equal(buildAdvisor({ name: null, jobTitle: null, email: null }).name, "Voltia");
  assert.equal(buildAdvisor({}).name, "Voltia");
});

test("buildAdvisor: email vacío queda como string vacío", () => {
  assert.equal(buildAdvisor({ name: "Ana", jobTitle: "X", email: null }).email, "");
});

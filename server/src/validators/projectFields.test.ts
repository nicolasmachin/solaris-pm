// Tests de los validadores compartidos de campos de Project (usados por el
// módulo Proyectos y por el PATCH del CRM). Runner builtin node:test:
//   npm run test:project-fields
//   node --import tsx --test src/validators/projectFields.test.ts

import { strict as assert } from "node:assert";
import { test } from "node:test";

import { z } from "zod";

import { clientEmailValue, clientPhoneValue, dateOnlyValue } from "./projectFields.js";

// Schema estricto equivalente al del endpoint PATCH /api/clientes/:projectId.
const patchBodySchema = z
  .object({
    mail: clientEmailValue.nullable().optional(),
    telefono: clientPhoneValue.nullable().optional(),
    fechaEntrega: dateOnlyValue.nullable().optional(),
  })
  .strict();

test("teléfono: acepta 09 + 7 dígitos", () => {
  assert.equal(clientPhoneValue.safeParse("099123456").success, true);
  assert.equal(clientPhoneValue.safeParse("091000006").success, true);
});

test("teléfono: rechaza +598, espacios, corto y largo", () => {
  for (const bad of ["+59899123456", "099 123 456", "0991234", "0991234567", "12345678"]) {
    assert.equal(clientPhoneValue.safeParse(bad).success, false, `debería rechazar ${bad}`);
  }
});

test('teléfono: acepta "" (para borrar)', () => {
  assert.equal(clientPhoneValue.safeParse("").success, true);
});

test("email: acepta válido y \"\", rechaza inválido", () => {
  assert.equal(clientEmailValue.safeParse("a@b.com").success, true);
  assert.equal(clientEmailValue.safeParse("").success, true);
  assert.equal(clientEmailValue.safeParse("no-es-email").success, false);
});

test("fecha: acepta YYYY-MM-DD, rechaza otros formatos", () => {
  assert.equal(dateOnlyValue.safeParse("2026-07-15").success, true);
  assert.equal(dateOnlyValue.safeParse("15/07/2026").success, false);
});

test("body PATCH: acepta campos válidos (incluye null y vacío)", () => {
  assert.equal(patchBodySchema.safeParse({ mail: "nuevo@mail.com" }).success, true);
  assert.equal(patchBodySchema.safeParse({ telefono: "099123456" }).success, true);
  assert.equal(patchBodySchema.safeParse({ fechaEntrega: "2026-07-15" }).success, true);
  assert.equal(patchBodySchema.safeParse({ mail: null, telefono: "" }).success, true);
  assert.equal(patchBodySchema.safeParse({}).success, true);
});

test("body PATCH: rechaza campo desconocido (.strict)", () => {
  assert.equal(patchBodySchema.safeParse({ clientName: "Hacker" }).success, false);
  assert.equal(patchBodySchema.safeParse({ mail: "a@b.com", foo: 1 }).success, false);
});

test("body PATCH: rechaza valores inválidos", () => {
  assert.equal(patchBodySchema.safeParse({ telefono: "+59899123456" }).success, false);
  assert.equal(patchBodySchema.safeParse({ mail: "x" }).success, false);
  assert.equal(patchBodySchema.safeParse({ fechaEntrega: "ayer" }).success, false);
});

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

test("teléfono: acepta celular uruguayo, fijo, +598, Argentina y con separadores", () => {
  for (const ok of [
    "099123456",
    "091000006",
    "099 123 456",
    "+59899123456",
    "+598 99 123 456",
    "24001234",
    "+54 9 11 1234-5678",
    "(011) 4321-5678",
    "0054 9 341 555.1234",
  ]) {
    assert.equal(clientPhoneValue.safeParse(ok).success, true, `debería aceptar ${ok}`);
  }
});

test("teléfono: rechaza letras, muy corto y muy largo", () => {
  for (const bad of ["099abc456", "12345", "+1234567890123456", "099123456 int 2", "++59899123456"]) {
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
  assert.equal(patchBodySchema.safeParse({ telefono: "099abc456" }).success, false);
  assert.equal(patchBodySchema.safeParse({ mail: "x" }).success, false);
  assert.equal(patchBodySchema.safeParse({ fechaEntrega: "ayer" }).success, false);
});

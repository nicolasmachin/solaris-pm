// Tests de la whitelist de adjuntos de lead (Tanda 1).
//   npm run test:lead-attachments

import { strict as assert } from "node:assert";
import { test } from "node:test";

import { assertAllowedLeadFile } from "./sales.service.js";

test("acepta PDF / JPG / PNG con mime correcto", () => {
  assert.doesNotThrow(() => assertAllowedLeadFile("doc.pdf", "application/pdf"));
  assert.doesNotThrow(() => assertAllowedLeadFile("foto.jpg", "image/jpeg"));
  assert.doesNotThrow(() => assertAllowedLeadFile("foto.PNG", "image/png"));
});

test("acepta HEIC del iPhone, con y sin mimetype reconocido", () => {
  assert.doesNotThrow(() => assertAllowedLeadFile("IMG_1234.HEIC", "image/heic"));
  assert.doesNotThrow(() => assertAllowedLeadFile("IMG_1234.heic", "image/heif"));
  // Varios navegadores de escritorio no reconocen el formato y no mandan mime.
  assert.doesNotThrow(() => assertAllowedLeadFile("IMG_1234.heic", "application/octet-stream"));
  assert.doesNotThrow(() => assertAllowedLeadFile("IMG_1234.heif", ""));
});

test("acepta Word / Excel (mime correcto)", () => {
  assert.doesNotThrow(() =>
    assertAllowedLeadFile("a.docx", "application/vnd.openxmlformats-officedocument.wordprocessingml.document"));
  assert.doesNotThrow(() =>
    assertAllowedLeadFile("a.xlsx", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"));
});

test("acepta docx/xlsx con octet-stream (navegadores)", () => {
  assert.doesNotThrow(() => assertAllowedLeadFile("a.docx", "application/octet-stream"));
});

test("rechaza ZIP", () => {
  assert.throws(() => assertAllowedLeadFile("x.zip", "application/zip"), /no soportado/);
});

test("rechaza extensión no listada (exe, txt, csv, ppt)", () => {
  for (const f of ["m.exe", "n.txt", "o.csv", "p.pptx"]) {
    assert.throws(() => assertAllowedLeadFile(f, "application/octet-stream"), /no soportado/);
  }
});

test("rechaza mime que no coincide con la extensión (renombre)", () => {
  assert.throws(() => assertAllowedLeadFile("malo.pdf", "image/jpeg"), /no soportado/);
});

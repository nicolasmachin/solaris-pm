import assert from "node:assert/strict";
import { test } from "node:test";

import { leerPortada } from "./sincronizar-manuales.js";

test("lee versión y fecha de la portada", () => {
  assert.deepEqual(leerPortada("Manual de Ventas Versión 1.4 · del 22/10/26 · documento interno"), {
    version: "1.4",
    vigenteDesde: "2026-10-22",
  });
});

test("versión de dos cifras y fecha sin día", () => {
  assert.deepEqual(leerPortada("Versión 0.20 · octubre de 2026"), { version: "0.20", vigenteDesde: null });
  assert.deepEqual(leerPortada("Version 3.0 — 11 de octubre de 2026"), { version: "3.0", vigenteDesde: null });
});

test("sin versión en la portada", () => {
  assert.deepEqual(leerPortada("Una portada escaneada"), { version: null, vigenteDesde: null });
});

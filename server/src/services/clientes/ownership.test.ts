// Tests del ownership de interacciones (autor o ADMIN). Runner builtin node:test:
//   npm run test:interaction-ownership
//   node --import tsx --test src/services/clientes/ownership.test.ts

import { strict as assert } from "node:assert";
import { test } from "node:test";

import { canModifyInteraction } from "./index.js";

test("ownership: el autor puede modificar su interacción", () => {
  assert.equal(canModifyInteraction({ id: "u1", role: "POSTVENTA" }, "u1"), true);
  assert.equal(canModifyInteraction({ id: "u1", role: "ASESOR_COMERCIAL" }, "u1"), true);
});

test("ownership: otro usuario (no autor, no admin) NO puede", () => {
  assert.equal(canModifyInteraction({ id: "u2", role: "POSTVENTA" }, "u1"), false);
  assert.equal(canModifyInteraction({ id: "u2", role: "ASESOR_COMERCIAL" }, "u1"), false);
});

test("ownership: ADMIN puede modificar cualquiera", () => {
  assert.equal(canModifyInteraction({ id: "admin", role: "ADMIN" }, "u1"), true);
  assert.equal(canModifyInteraction({ id: "admin", role: "ADMIN" }, "otro-autor"), true);
});

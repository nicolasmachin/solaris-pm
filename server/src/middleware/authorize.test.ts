// Tests del núcleo de `authorizeAny`. Se ejecutan con el runner builtin
// `node:test` (sin frameworks externos): `npm run test:auth` o
// `node --import tsx --test src/middleware/authorize.test.ts`.

import { strict as assert } from "node:assert";
import { test } from "node:test";

import { Action, Module } from "@prisma/client";

import { anyPermissionAllowed } from "./authorize.middleware.js";

function makeChecker(allowed: Set<string>) {
  return async (role: string, module: Module, action: Action) =>
    allowed.has(`${role}:${module}:${action}`);
}

test("anyPermissionAllowed: pasa si tiene el primero", async () => {
  const check = makeChecker(new Set(["ING:INGENIERIA:EDIT"]));
  const ok = await anyPermissionAllowed(
    "ING",
    [
      { module: Module.INGENIERIA, action: Action.EDIT },
      { module: Module.OPERACIONES, action: Action.EDIT },
    ],
    check,
  );
  assert.equal(ok, true);
});

test("anyPermissionAllowed: pasa si tiene el segundo (no el primero)", async () => {
  const check = makeChecker(new Set(["OPS:OPERACIONES:EDIT"]));
  const ok = await anyPermissionAllowed(
    "OPS",
    [
      { module: Module.INGENIERIA, action: Action.EDIT },
      { module: Module.OPERACIONES, action: Action.EDIT },
    ],
    check,
  );
  assert.equal(ok, true);
});

test("anyPermissionAllowed: rechaza si no tiene ninguno", async () => {
  const check = makeChecker(new Set(["VTAS:VENTAS:VIEW"]));
  const ok = await anyPermissionAllowed(
    "VTAS",
    [
      { module: Module.INGENIERIA, action: Action.EDIT },
      { module: Module.OPERACIONES, action: Action.EDIT },
    ],
    check,
  );
  assert.equal(ok, false);
});

test("anyPermissionAllowed: ADMIN con todos los permisos pasa", async () => {
  // Simula el caso real: ADMIN tiene una entry por cada combinación módulo/acción.
  const check = makeChecker(
    new Set([
      "ADMIN:INGENIERIA:EDIT",
      "ADMIN:OPERACIONES:EDIT",
      "ADMIN:VENTAS:EDIT",
    ]),
  );
  const ok = await anyPermissionAllowed(
    "ADMIN",
    [
      { module: Module.INGENIERIA, action: Action.EDIT },
      { module: Module.OPERACIONES, action: Action.EDIT },
    ],
    check,
  );
  assert.equal(ok, true);
});

test("anyPermissionAllowed: corta al primer permiso match (no llama al resto)", async () => {
  let calls = 0;
  const check = async (_role: string, module: Module, _action: Action) => {
    calls += 1;
    return module === Module.INGENIERIA;
  };
  await anyPermissionAllowed(
    "ING",
    [
      { module: Module.INGENIERIA, action: Action.EDIT },
      { module: Module.OPERACIONES, action: Action.EDIT },
      { module: Module.VENTAS, action: Action.EDIT },
    ],
    check,
  );
  assert.equal(calls, 1);
});

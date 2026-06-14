// Tests del middleware de autorización por etapa. Runner builtin node:test:
//   node --import tsx --test src/middleware/__tests__/authorize-by-stage.middleware.test.ts
//
// COBERTURA: se testea la parte PURA (mapping StageType→Module y PIPELINE_MODULES),
// que es donde más probable está un bug (olvidar un StageType nuevo, mapear mal
// HABILITACION_UTE, etc.).
//
// PENDIENTE (no cubierto acá): getModuleByStageId/BySubstageId/ByTaskId, el
// comportamiento de cache y clearStageModuleCache. Esas funciones pegan a la DB
// vía los delegates del cliente Prisma v6, que NO son mockeables con
// `node:test` mock.method (los métodos del delegate son getters dinámicos →
// "methodName must be a method. Received undefined"). Quedan cubiertas por la
// validación manual por rol (PASO 8 de la spec). Si en el futuro se agrega un
// runner con mock de módulos (vitest), se completan.

import { strict as assert } from "node:assert";
import { test } from "node:test";

import { Module, StageType } from "@prisma/client";

import { STAGE_TYPE_TO_MODULE, PIPELINE_MODULES } from "../authorize-by-stage.middleware.js";

test("STAGE_TYPE_TO_MODULE cubre todos los StageType (sin faltantes)", () => {
  for (const st of Object.values(StageType)) {
    assert.ok(STAGE_TYPE_TO_MODULE[st] !== undefined, `falta mapping para ${st}`);
  }
  assert.equal(Object.keys(STAGE_TYPE_TO_MODULE).length, Object.values(StageType).length);
});

test("STAGE_TYPE_TO_MODULE: cada etapa mapea al módulo esperado", () => {
  assert.equal(STAGE_TYPE_TO_MODULE[StageType.ONBOARDING], Module.ONBOARDING);
  assert.equal(STAGE_TYPE_TO_MODULE[StageType.INGENIERIA], Module.INGENIERIA);
  assert.equal(STAGE_TYPE_TO_MODULE[StageType.OPERACIONES], Module.OPERACIONES);
  // El enum de etapas usa HABILITACION_UTE; el de módulos, HABILITACION.
  assert.equal(STAGE_TYPE_TO_MODULE[StageType.HABILITACION_UTE], Module.HABILITACION);
  assert.equal(STAGE_TYPE_TO_MODULE[StageType.POSTVENTA], Module.POSTVENTA);
});

test("PIPELINE_MODULES tiene los 6 módulos del pipeline en orden", () => {
  assert.deepEqual(PIPELINE_MODULES, [
    Module.VENTAS,
    Module.ONBOARDING,
    Module.INGENIERIA,
    Module.OPERACIONES,
    Module.HABILITACION,
    Module.POSTVENTA,
  ]);
});

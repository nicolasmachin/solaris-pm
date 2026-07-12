// Tests de calculateStageProgress: una sub-tarea cuenta como "resuelta" si está
// COMPLETED o NO_APLICA. Runner builtin node:test:
//   node --import tsx --test src/services/stage-progress.test.ts

import { strict as assert } from "node:assert";
import { test } from "node:test";

import { SubstageStatus } from "@prisma/client";

import { calculateStageProgress } from "./project.service.js";

const sub = (status: SubstageStatus) => ({ status });

test("todas COMPLETED → 100%", () => {
  assert.equal(
    calculateStageProgress([sub(SubstageStatus.COMPLETED), sub(SubstageStatus.COMPLETED)]),
    100,
  );
});

test("COMPLETED + NO_APLICA cuentan como resueltas → 100%", () => {
  assert.equal(
    calculateStageProgress([sub(SubstageStatus.COMPLETED), sub(SubstageStatus.NO_APLICA)]),
    100,
  );
});

test("todas NO_APLICA → 100% (nada aplica, etapa resuelta)", () => {
  assert.equal(
    calculateStageProgress([sub(SubstageStatus.NO_APLICA), sub(SubstageStatus.NO_APLICA)]),
    100,
  );
});

test("una PENDING entre resueltas → parcial (no 100)", () => {
  assert.equal(
    calculateStageProgress([
      sub(SubstageStatus.COMPLETED),
      sub(SubstageStatus.NO_APLICA),
      sub(SubstageStatus.PENDING),
      sub(SubstageStatus.IN_PROGRESS),
    ]),
    50,
  );
});

test("subetapas inactivas / borradas no cuentan", () => {
  assert.equal(
    calculateStageProgress([
      { status: SubstageStatus.COMPLETED },
      { status: SubstageStatus.PENDING, isActive: false },
      { status: SubstageStatus.PENDING, deletedAt: new Date() },
    ]),
    100,
  );
});

test("sin subetapas → 0%", () => {
  assert.equal(calculateStageProgress([]), 0);
});

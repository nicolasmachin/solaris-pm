// Tests de la decisión de auto-avance de POSTVENTA al finalizar el trámite UTE.
// Cubren el flujo feliz, la cascada de fechas, idempotencia y no-regresión.
// Lógica pura (sin DB): testea planPostventaAdvance, el núcleo de
// advancePostventaOnUteFinalizado. Runner builtin node:test:
//   node --import tsx --test src/services/ute-sync.advance.test.ts

import { strict as assert } from "node:assert";
import { test } from "node:test";

import { planPostventaAdvance, type StageForAdvance } from "./ute-sync.service.js";

// Fechas de referencia (orden cronológico para distinguir la cascada).
const OPERACIONES_END = new Date("2026-04-01");
const HABILITACION_END = new Date("2026-05-10");
const FINALIZED_AT = new Date("2026-06-11");

// Pipeline típico de un proyecto con la obra y la habilitación ya cerradas y
// POSTVENTA todavía sin arrancar.
function stagesListas(overrides: Partial<Record<string, Partial<StageForAdvance>>> = {}): StageForAdvance[] {
  const base: Record<string, StageForAdvance> = {
    ONBOARDING: { id: "s1", name: "ONBOARDING", status: "COMPLETED", actualStartDate: null, actualEndDate: null },
    INGENIERIA: { id: "s2", name: "INGENIERIA", status: "COMPLETED", actualStartDate: null, actualEndDate: null },
    OPERACIONES: { id: "s3", name: "OPERACIONES", status: "COMPLETED", actualStartDate: null, actualEndDate: OPERACIONES_END },
    HABILITACION_UTE: { id: "s4", name: "HABILITACION_UTE", status: "COMPLETED", actualStartDate: null, actualEndDate: HABILITACION_END },
    POSTVENTA: { id: "s5", name: "POSTVENTA", status: "PENDING", actualStartDate: null, actualEndDate: null },
  };
  for (const [name, patch] of Object.entries(overrides)) {
    base[name] = { ...base[name], ...patch };
  }
  return Object.values(base);
}

test("avanza: trámite finalizado por finalizedAt → POSTVENTA con fecha = finalizedAt", () => {
  const plan = planPostventaAdvance(
    { currentStage: "FINALIZADO", finalizedAt: FINALIZED_AT },
    stagesListas(),
  );
  assert.equal(plan.action, "advance");
  if (plan.action !== "advance") return;
  assert.equal(plan.postventaId, "s5");
  assert.equal(plan.completedAt.getTime(), FINALIZED_AT.getTime());
});

test("avanza: finalizado por currentStage (finalizedAt null) → cascada a HABILITACION_UTE.actualEndDate", () => {
  const plan = planPostventaAdvance(
    { currentStage: "FINALIZADO", finalizedAt: null },
    stagesListas(),
  );
  assert.equal(plan.action, "advance");
  if (plan.action !== "advance") return;
  assert.equal(plan.completedAt.getTime(), HABILITACION_END.getTime());
});

test("avanza: cascada hasta OPERACIONES cuando finalizedAt y HABILITACION_UTE.actualEndDate son null", () => {
  const plan = planPostventaAdvance(
    { currentStage: "FINALIZADO", finalizedAt: null },
    stagesListas({ HABILITACION_UTE: { actualEndDate: null } }),
  );
  assert.equal(plan.action, "advance");
  if (plan.action !== "advance") return;
  assert.equal(plan.completedAt.getTime(), OPERACIONES_END.getTime());
});

test("skip 'sin-fecha': finalizado pero sin ninguna fecha en la cascada (NO usa fecha de hoy)", () => {
  const plan = planPostventaAdvance(
    { currentStage: "FINALIZADO", finalizedAt: null },
    stagesListas({ HABILITACION_UTE: { actualEndDate: null }, OPERACIONES: { actualEndDate: null } }),
  );
  assert.deepEqual(plan, { action: "skip", reason: "sin-fecha" });
});

test("idempotencia: POSTVENTA ya COMPLETED → skip", () => {
  const plan = planPostventaAdvance(
    { currentStage: "FINALIZADO", finalizedAt: FINALIZED_AT },
    stagesListas({ POSTVENTA: { status: "COMPLETED", actualEndDate: FINALIZED_AT } }),
  );
  assert.deepEqual(plan, { action: "skip", reason: "postventa-ya-completada" });
});

test("no-regresión: trámite NO finalizado → no toca nada", () => {
  const plan = planPostventaAdvance(
    { currentStage: "DOCS_1", finalizedAt: null },
    stagesListas(),
  );
  assert.deepEqual(plan, { action: "skip", reason: "tramite-no-finalizado" });
});

test("guarda: HABILITACION_UTE aún no COMPLETED → no avanza POSTVENTA", () => {
  const plan = planPostventaAdvance(
    { currentStage: "FINALIZADO", finalizedAt: FINALIZED_AT },
    stagesListas({ HABILITACION_UTE: { status: "IN_PROGRESS" } }),
  );
  assert.deepEqual(plan, { action: "skip", reason: "habilitacion-no-completada" });
});

test("borde: proyecto sin etapa POSTVENTA → skip", () => {
  const sinPostventa = stagesListas().filter((s) => s.name !== "POSTVENTA");
  const plan = planPostventaAdvance(
    { currentStage: "FINALIZADO", finalizedAt: FINALIZED_AT },
    sinPostventa,
  );
  assert.deepEqual(plan, { action: "skip", reason: "sin-etapa-postventa" });
});

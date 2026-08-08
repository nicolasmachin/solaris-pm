// Tests del matcher de la migración legacy.
// Correr: npm run test:fv-matching

import assert from "node:assert/strict";
import { test } from "node:test";

import { resolverAmpliaciones, type ProyectoCandidato } from "./matching.js";

function proyecto(over: Partial<ProyectoCandidato> & { id: string }): ProyectoCandidato {
  return {
    code: `PRY-${over.id}`,
    clientName: "Cliente",
    clientEmail: null,
    importedFromCsv: false,
    capacityKwp: 4,
    parentProjectId: null,
    ...over,
  };
}

test("dos proyectos del mismo cliente donde uno es ampliación → gana el original", () => {
  const original = proyecto({ id: "1", code: "PRY-2026-059" });
  const ampliacion = proyecto({ id: "2", code: "PRY-2026-059-A1", parentProjectId: "1" });

  assert.equal(resolverAmpliaciones([original, ampliacion])?.id, "1");
  // El orden no importa.
  assert.equal(resolverAmpliaciones([ampliacion, original])?.id, "1");
});

test("varias ampliaciones del mismo original también se resuelven", () => {
  const original = proyecto({ id: "1" });
  const a1 = proyecto({ id: "2", parentProjectId: "1" });
  // El árbol es plano: una ampliación de una ampliación cuelga de la misma raíz.
  const a2 = proyecto({ id: "3", parentProjectId: "1" });
  assert.equal(resolverAmpliaciones([original, a1, a2])?.id, "1");
});

test("dos clientes distintos con el mismo nombre siguen siendo ambiguos", () => {
  const a = proyecto({ id: "1" });
  const b = proyecto({ id: "2" });
  assert.equal(resolverAmpliaciones([a, b]), null);
});

test("ampliaciones de raíces distintas no se resuelven solas", () => {
  const raizA = proyecto({ id: "1" });
  const ampliacionDeOtro = proyecto({ id: "2", parentProjectId: "99" });
  assert.equal(resolverAmpliaciones([raizA, ampliacionDeOtro]), null);
});

test("sin raíz clara (todas son ampliaciones) no se resuelve", () => {
  const a = proyecto({ id: "1", parentProjectId: "99" });
  const b = proyecto({ id: "2", parentProjectId: "99" });
  assert.equal(resolverAmpliaciones([a, b]), null);
});

test("un solo candidato no es un caso de ampliación", () => {
  assert.equal(resolverAmpliaciones([proyecto({ id: "1" })]), null);
  assert.equal(resolverAmpliaciones([]), null);
});

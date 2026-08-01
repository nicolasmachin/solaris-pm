// Tests del motor de ruteo de traspasos: calcularDestinatarios (roles primarios,
// expansión por área incluyendo gerencias, roles en copia, ADMIN siempre en
// copia, dedupe, exclusión del actor, área derivada de T9) + invariantes del
// catálogo.
//
// El ruteo es 100% por ROL real (se eliminó el mecanismo viejo de sub-roles de
// Operaciones). El fetcher de usuarios se inyecta (DestinatarioDeps) desde un
// directorio falso, así el test es unitario sin tocar la DB. Runner builtin:
//   node --import tsx --test src/services/traspasos/destinatarios.test.ts

import { strict as assert } from "node:assert";
import { test } from "node:test";

import { TraspasoTipo } from "@prisma/client";

import {
  calcularDestinatarios,
  previewDestinatarios,
  type DestinatarioDeps,
} from "./destinatarios.js";
import {
  STAGE_TO_TRASPASO,
  STAGE_TO_TRASPASO_EXTRA,
  TRASPASO_CATALOGO,
  TRASPASO_LABEL,
} from "./catalogo.js";

type FakeUser = { id: string; roleName: string };

// Arma unos DestinatarioDeps que resuelven contra un directorio de usuarios
// falso, replicando el filtrado por rol que hace la versión Prisma.
function depsFrom(users: FakeUser[]): DestinatarioDeps {
  return {
    usuariosPorRoles: async (roles) =>
      users
        .filter((u) => roles.includes(u.roleName))
        .map((u) => ({ id: u.id, roleName: u.roleName })),
  };
}

const primarios = (r: Array<{ usuarioId: string; esCopia: boolean }>) =>
  r.filter((d) => !d.esCopia).map((d) => d.usuarioId).sort();
const copias = (r: Array<{ usuarioId: string; esCopia: boolean }>) =>
  r.filter((d) => d.esCopia).map((d) => d.usuarioId).sort();

// Usuarios base reutilizables (cada uno con UN solo rol real).
const ADMIN: FakeUser = { id: "admin1", roleName: "ADMIN" };
const ING1: FakeUser = { id: "ing1", roleName: "INGENIERIA" };
const ING2: FakeUser = { id: "ing2", roleName: "INGENIERIA" };
const GERING: FakeUser = { id: "gering1", roleName: "GERENTE_INGENIERIA" };
const EXP1: FakeUser = { id: "exp1", roleName: "EXPERIENCIA_SOLAR" };
const UTE1: FakeUser = { id: "ute1", roleName: "TRAMITACION_UTE" };
const GEROPS: FakeUser = { id: "gerops1", roleName: "GERENTE_OPERACIONES" };
const LOGIS: FakeUser = { id: "logis1", roleName: "LOGISTICA" };
const CAPA: FakeUser = { id: "capa1", roleName: "CAPATAZ" };
const OPS1: FakeUser = { id: "ops1", roleName: "OPERACIONES" };

test("T1: primarios área Ingeniería (incluye su gerente) + Experiencia Solar, ADMIN copia", async () => {
  const r = await calcularDestinatarios(
    TraspasoTipo.T1_ONBOARDING_COMPLETADO,
    {},
    depsFrom([ADMIN, ING1, GERING, EXP1, CAPA]),
  );
  // El área Ingeniería incluye al Gerente de Ingeniería.
  assert.deepEqual(primarios(r), ["exp1", "gering1", "ing1"]);
  assert.deepEqual(copias(r), ["admin1"]);
  // Un rol de Operaciones (Capataz) no entra en un traspaso a Ingeniería/ExpSolar.
  assert.ok(!r.some((d) => d.usuarioId === "capa1"));
});

test("T2: primario sólo Gerente de Operaciones (rol puntual); ADMIN copia", async () => {
  const r = await calcularDestinatarios(
    TraspasoTipo.T2_PREINGENIERIA_PRONTA,
    {},
    depsFrom([ADMIN, GEROPS, LOGIS, OPS1]),
  );
  assert.deepEqual(primarios(r), ["gerops1"]);
  assert.deepEqual(copias(r), ["admin1"]);
  // No es toda el área: Logística y Operaciones base no reciben.
  assert.ok(!r.some((d) => d.usuarioId === "logis1"));
  assert.ok(!r.some((d) => d.usuarioId === "ops1"));
});

test("T3: primario área Ingeniería, Gerente de Operaciones y ADMIN en copia", async () => {
  const r = await calcularDestinatarios(
    TraspasoTipo.T3_VALIDACION_OPERACIONES_A_INGENIERIA,
    {},
    depsFrom([ADMIN, ING1, GERING, GEROPS]),
  );
  assert.deepEqual(primarios(r), ["gering1", "ing1"]);
  assert.deepEqual(copias(r), ["admin1", "gerops1"]);
});

test("T5: primario Logística, Gerente de Operaciones + ADMIN en copia", async () => {
  const r = await calcularDestinatarios(
    TraspasoTipo.T5_INGENIERIA_FINAL_COMPLETADA,
    {},
    depsFrom([ADMIN, LOGIS, GEROPS]),
  );
  assert.deepEqual(primarios(r), ["logis1"]);
  assert.deepEqual(copias(r), ["admin1", "gerops1"]);
});

test("T6: primario sólo Gerente de Operaciones; ADMIN copia", async () => {
  const r = await calcularDestinatarios(
    TraspasoTipo.T6_MATERIALES_RECIBIDOS_EN_DEPOSITO,
    {},
    depsFrom([ADMIN, GEROPS, OPS1, LOGIS]),
  );
  assert.deepEqual(primarios(r), ["gerops1"]);
  assert.deepEqual(copias(r), ["admin1"]);
  assert.ok(!r.some((d) => d.usuarioId === "ops1"));
});

test("T7: primarios Experiencia Solar + Tramitación UTE, Gerente de Operaciones + ADMIN copia", async () => {
  const r = await calcularDestinatarios(
    TraspasoTipo.T7_OBRA_TERMINADA,
    {},
    depsFrom([ADMIN, EXP1, UTE1, GEROPS]),
  );
  assert.deepEqual(primarios(r), ["exp1", "ute1"]);
  assert.deepEqual(copias(r), ["admin1", "gerops1"]);
});

test("dedupe: un usuario que cae en primario y en copia aparece una vez como primario", async () => {
  // deps que devuelve el mismo usuario tanto para el rol primario como para ADMIN,
  // forzando el solapamiento primario/copia.
  const dup: FakeUser = { id: "dup1", roleName: "GERENTE_OPERACIONES" };
  const deps: DestinatarioDeps = {
    usuariosPorRoles: async (roles) => {
      const out: Array<{ id: string; roleName: string }> = [];
      if (roles.includes("GERENTE_OPERACIONES")) out.push(dup);
      if (roles.includes("ADMIN")) out.push(dup);
      return out;
    },
  };
  const r = await calcularDestinatarios(TraspasoTipo.T2_PREINGENIERIA_PRONTA, {}, deps);
  const apariciones = r.filter((d) => d.usuarioId === "dup1");
  assert.equal(apariciones.length, 1, "debe aparecer exactamente una vez");
  assert.equal(apariciones[0].esCopia, false, "primario gana sobre copia");
});

test("exclude actor: el usuario que confirma no se auto-notifica (primario)", async () => {
  const r = await calcularDestinatarios(
    TraspasoTipo.T1_ONBOARDING_COMPLETADO,
    { excludeUserId: "ing1" },
    depsFrom([ADMIN, ING1, EXP1]),
  );
  assert.deepEqual(primarios(r), ["exp1"]);
  assert.deepEqual(copias(r), ["admin1"]);
});

test("exclude actor: si el actor es ADMIN, no queda en copia", async () => {
  const r = await calcularDestinatarios(
    TraspasoTipo.T1_ONBOARDING_COMPLETADO,
    { excludeUserId: "admin1" },
    depsFrom([ADMIN, ING1, EXP1]),
  );
  assert.deepEqual(primarios(r), ["exp1", "ing1"]);
  assert.deepEqual(copias(r), []);
});

test("T9 con área derivada INGENIERIA: primario área Ingeniería (con su gerente), ADMIN copia", async () => {
  const r = await calcularDestinatarios(
    TraspasoTipo.T9_TICKET_DERIVADO,
    { payload: { areaDerivada: "INGENIERIA" } },
    depsFrom([ADMIN, ING1, GERING, GEROPS]),
  );
  assert.deepEqual(primarios(r), ["gering1", "ing1"]);
  // El gerente de Operaciones no pertenece al área Ingeniería.
  assert.deepEqual(copias(r), ["admin1"]);
});

test("T9 con área derivada OPERACIONES: primario todo el área (incluye Gerente/Capataz/Logística)", async () => {
  const r = await calcularDestinatarios(
    TraspasoTipo.T9_TICKET_DERIVADO,
    { payload: { areaDerivada: "OPERACIONES" } },
    depsFrom([ADMIN, OPS1, GEROPS, CAPA, LOGIS]),
  );
  assert.deepEqual(primarios(r), ["capa1", "gerops1", "logis1", "ops1"]);
  assert.deepEqual(copias(r), ["admin1"]);
});

test("previewDestinatarios agrupa por rol con conteo y marca la copia", async () => {
  const preview = await previewDestinatarios(
    TraspasoTipo.T1_ONBOARDING_COMPLETADO,
    {},
    depsFrom([ADMIN, ING1, ING2, EXP1]),
  );
  const set = new Set(preview);
  assert.ok(set.has("INGENIERIA (2)"), `esperaba INGENIERIA (2), got ${JSON.stringify(preview)}`);
  assert.ok(set.has("EXPERIENCIA_SOLAR (1)"));
  assert.ok(set.has("ADMIN (copia) (1)"));
});

// ─── Invariantes del catálogo (puras, sin mock) ─────────────────────────────

test("todo TraspasoTipo tiene entrada en el catálogo y una etiqueta", () => {
  for (const tipo of Object.values(TraspasoTipo)) {
    assert.ok(TRASPASO_CATALOGO[tipo], `falta CATALOGO[${tipo}]`);
    assert.ok(TRASPASO_LABEL[tipo], `falta LABEL[${tipo}]`);
  }
});

test("los mapeos etapa→traspaso apuntan a tipos válidos con entrada de catálogo", () => {
  const tiposValidos = new Set<string>(Object.values(TraspasoTipo));
  for (const t of Object.values(STAGE_TO_TRASPASO)) {
    assert.ok(tiposValidos.has(t), `STAGE_TO_TRASPASO tipo inválido: ${t}`);
    assert.ok(TRASPASO_CATALOGO[t], `sin catálogo: ${t}`);
  }
  for (const t of Object.values(STAGE_TO_TRASPASO_EXTRA)) {
    assert.ok(tiposValidos.has(t), `STAGE_TO_TRASPASO_EXTRA tipo inválido: ${t}`);
  }
});

test("VALIDACION_OPERACIONES dispara T3 (cierre) y T4 (extra) — dual C12", () => {
  assert.equal(
    STAGE_TO_TRASPASO.VALIDACION_OPERACIONES,
    TraspasoTipo.T3_VALIDACION_OPERACIONES_A_INGENIERIA,
  );
  assert.equal(
    STAGE_TO_TRASPASO_EXTRA.VALIDACION_OPERACIONES,
    TraspasoTipo.T4_VALIDACION_OPERACIONES_A_ATENCION_CLIENTE,
  );
});

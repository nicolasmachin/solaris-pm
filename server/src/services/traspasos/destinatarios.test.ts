// Tests del motor de ruteo de traspasos: calcularDestinatarios (roles primarios,
// sub-roles de Operaciones, copia del Gerente, ADMIN siempre en copia, dedupe,
// exclusión del actor, área derivada de T9) + invariantes del catálogo.
//
// Los fetchers de usuarios se inyectan (DestinatarioDeps) desde un directorio
// falso, así el test es unitario sin tocar la DB. Runner builtin (node:test):
//   node --import tsx --test src/services/traspasos/destinatarios.test.ts

import { strict as assert } from "node:assert";
import { test } from "node:test";

import { SubRolOperaciones, TraspasoTipo } from "@prisma/client";

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

type FakeUser = { id: string; roleName: string; subRoles?: SubRolOperaciones[] };

// Arma unos DestinatarioDeps que resuelven contra un directorio de usuarios
// falso, replicando el filtrado que hace la versión Prisma (por rol o sub-rol).
function depsFrom(users: FakeUser[]): DestinatarioDeps {
  return {
    usuariosPorRoles: async (roles) =>
      users
        .filter((u) => roles.includes(u.roleName))
        .map((u) => ({ id: u.id, roleName: u.roleName })),
    usuariosOperacionesConSubRol: async (subRol) =>
      users
        .filter((u) => u.roleName === "OPERACIONES" && (u.subRoles ?? []).includes(subRol))
        .map((u) => ({ id: u.id, roleName: u.roleName })),
  };
}

const primarios = (r: Array<{ usuarioId: string; esCopia: boolean }>) =>
  r.filter((d) => !d.esCopia).map((d) => d.usuarioId).sort();
const copias = (r: Array<{ usuarioId: string; esCopia: boolean }>) =>
  r.filter((d) => d.esCopia).map((d) => d.usuarioId).sort();

// Usuarios base reutilizables
const ADMIN: FakeUser = { id: "admin1", roleName: "ADMIN" };
const ING1: FakeUser = { id: "ing1", roleName: "INGENIERIA" };
const ING2: FakeUser = { id: "ing2", roleName: "INGENIERIA" };
const EXP1: FakeUser = { id: "exp1", roleName: "EXPERIENCIA_SOLAR" };
const UTE1: FakeUser = { id: "ute1", roleName: "TRAMITACION_UTE" };
const GERENTE: FakeUser = { id: "gerente1", roleName: "OPERACIONES", subRoles: [SubRolOperaciones.GERENTE] };
const COMPRAS: FakeUser = { id: "compras1", roleName: "OPERACIONES", subRoles: [SubRolOperaciones.COMPRAS] };
const CAPATAZ: FakeUser = { id: "capataz1", roleName: "OPERACIONES", subRoles: [SubRolOperaciones.CAPATACIA] };

test("T1: primarios Ingeniería + Experiencia Solar, ADMIN en copia", async () => {
  const r = await calcularDestinatarios(
    TraspasoTipo.T1_ONBOARDING_COMPLETADO,
    {},
    depsFrom([ADMIN, ING1, EXP1, CAPATAZ]),
  );
  assert.deepEqual(primarios(r), ["exp1", "ing1"]);
  assert.deepEqual(copias(r), ["admin1"]);
  // Un usuario de Operaciones sin rol destinatario no entra.
  assert.ok(!r.some((d) => d.usuarioId === "capataz1"));
});

test("T2: primario Gerente (sub-rol), no incluye Compras; ADMIN copia", async () => {
  const r = await calcularDestinatarios(
    TraspasoTipo.T2_PREINGENIERIA_PRONTA,
    {},
    depsFrom([ADMIN, GERENTE, COMPRAS]),
  );
  assert.deepEqual(primarios(r), ["gerente1"]);
  assert.deepEqual(copias(r), ["admin1"]);
  assert.ok(!r.some((d) => d.usuarioId === "compras1"));
});

test("T3: primario Ingeniería, Gerente y ADMIN en copia", async () => {
  const r = await calcularDestinatarios(
    TraspasoTipo.T3_VALIDACION_OPERACIONES_A_INGENIERIA,
    {},
    depsFrom([ADMIN, ING1, GERENTE]),
  );
  assert.deepEqual(primarios(r), ["ing1"]);
  assert.deepEqual(copias(r), ["admin1", "gerente1"]);
});

test("T5: primario Compras (sub-rol), Gerente + ADMIN en copia", async () => {
  const r = await calcularDestinatarios(
    TraspasoTipo.T5_INGENIERIA_FINAL_COMPLETADA,
    {},
    depsFrom([ADMIN, COMPRAS, GERENTE]),
  );
  assert.deepEqual(primarios(r), ["compras1"]);
  assert.deepEqual(copias(r), ["admin1", "gerente1"]);
});

test("T7: primarios Experiencia Solar + Tramitación UTE, Gerente + ADMIN copia", async () => {
  const r = await calcularDestinatarios(
    TraspasoTipo.T7_OBRA_TERMINADA,
    {},
    depsFrom([ADMIN, EXP1, UTE1, GERENTE]),
  );
  assert.deepEqual(primarios(r), ["exp1", "ute1"]);
  assert.deepEqual(copias(r), ["admin1", "gerente1"]);
});

test("dedupe: un Operaciones con sub-roles COMPRAS y GERENTE entra una sola vez como primario en T5", async () => {
  const opsGC: FakeUser = {
    id: "opsGC",
    roleName: "OPERACIONES",
    subRoles: [SubRolOperaciones.COMPRAS, SubRolOperaciones.GERENTE],
  };
  const r = await calcularDestinatarios(
    TraspasoTipo.T5_INGENIERIA_FINAL_COMPLETADA,
    {},
    depsFrom([ADMIN, opsGC]),
  );
  const apariciones = r.filter((d) => d.usuarioId === "opsGC");
  assert.equal(apariciones.length, 1, "debe aparecer exactamente una vez");
  assert.equal(apariciones[0].esCopia, false, "primario gana sobre copia");
  assert.deepEqual(copias(r), ["admin1"]);
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

test("T9 con área derivada INGENIERIA: primario Ingeniería, sin copia de Gerente", async () => {
  const r = await calcularDestinatarios(
    TraspasoTipo.T9_TICKET_DERIVADO,
    { payload: { areaDerivada: "INGENIERIA" } },
    depsFrom([ADMIN, ING1, GERENTE]),
  );
  assert.deepEqual(primarios(r), ["ing1"]);
  assert.deepEqual(copias(r), ["admin1"]);
});

test("T9 con área derivada OPERACIONES: primario Operaciones + copia de Gerente", async () => {
  const ops1: FakeUser = { id: "ops1", roleName: "OPERACIONES" };
  const r = await calcularDestinatarios(
    TraspasoTipo.T9_TICKET_DERIVADO,
    { payload: { areaDerivada: "OPERACIONES" } },
    depsFrom([ADMIN, ops1]),
  );
  assert.deepEqual(primarios(r), ["ops1"]);
  // gerenteCopia se activa por la derivación a Operaciones (aunque acá no haya gerente cargado)
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

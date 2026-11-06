import assert from "node:assert/strict";
import { test } from "node:test";

import { coincideNombre, sugerirMails, taparMail } from "./sugerir-mail.js";

test("tapa el mail dejando el comienzo y el dominio", () => {
  assert.equal(taparMail("nicolas@voltia.com.uy"), "ni•••••@voltia.com.uy");
  assert.equal(taparMail("a@b.uy"), "a•@b.uy");
});

test("el nombre coincide sin tildes ni mayúsculas, en cualquier orden", () => {
  assert.ok(coincideNombre("Nicolás Machín", "machin nicolas"));
  assert.ok(!coincideNombre("Nicolás Machín", "nicolas perez"));
});

test("una sola palabra solo sirve si es el nombre completo", () => {
  assert.ok(!coincideNombre("Martín González", "gonzalez"));
  assert.ok(coincideNombre("Busquets", "busquets"));
});

test("sin duplicados, sin usuarios sin mail y con tope de tres", () => {
  const u = (email: string | null) => ({ name: "Ana Pérez", email });
  assert.deepEqual(sugerirMails([u("ana@x.uy"), u("ana@x.uy"), u(null)], "ana perez"), ["an•@x.uy"]);
  const varios = ["aa1@x.uy", "bb2@x.uy", "cc3@x.uy", "dd4@x.uy"].map(u);
  assert.equal(sugerirMails(varios, "ana perez").length, 3);
});

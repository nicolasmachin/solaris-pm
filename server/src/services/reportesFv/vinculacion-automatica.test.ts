import { test } from "node:test";
import assert from "node:assert/strict";

import { emparejarPlantas, type ProyectoCandidato } from "./vinculacion-automatica.js";

const proy = (id: string, clientName: string, tieneGrowatt = false, tieneHuawei = false): ProyectoCandidato => ({
  id,
  clientName,
  tieneGrowatt,
  tieneHuawei,
});

test("vincula cuando el nombre coincide sin importar tildes, mayúsculas ni espacios", () => {
  const r = emparejarPlantas([{ marca: "GROWATT", id: "1", nombre: "Néstor  Rojas " }], [proy("p1", "Nestor Rojas")]);
  assert.equal(r.vincular.length, 1);
  assert.equal(r.vincular[0].proyecto.id, "p1");
});

test("no vincula por parecido: el nombre tiene que ser igual", () => {
  const r = emparejarPlantas([{ marca: "GROWATT", id: "1", nombre: "Coviteja 1 (mono)" }], [proy("p1", "COVITEJA Mono")]);
  assert.equal(r.vincular.length, 0);
  assert.equal(r.sinVincular[0].motivo, "SIN_PROYECTO");
});

test("con dos proyectos del mismo nombre no adivina", () => {
  const r = emparejarPlantas([{ marca: "GROWATT", id: "1", nombre: "Juan Pérez" }], [proy("p1", "Juan Perez"), proy("p2", "Juan Pérez")]);
  assert.equal(r.sinVincular[0].motivo, "VARIOS_PROYECTOS");
});

test("si el proyecto ya tiene planta, de cualquier marca, va al mail (caso Álvaro García)", () => {
  const proyectos = [proy("p1", "Alvaro Garcia", false, true)];
  const growatt = emparejarPlantas([{ marca: "GROWATT", id: "g", nombre: "Álvaro García" }], proyectos);
  assert.equal(growatt.vincular.length, 0);
  assert.equal(growatt.sinVincular[0].motivo, "PROYECTO_CON_PLANTA");
});

test("dos plantas iguales en la misma corrida: la segunda no pisa a la primera", () => {
  const r = emparejarPlantas(
    [
      { marca: "GROWATT", id: "1", nombre: "Ana Sosa" },
      { marca: "GROWATT", id: "2", nombre: "Ana Sosa" },
    ],
    [proy("p1", "Ana Sosa")],
  );
  assert.equal(r.vincular.length, 1);
  assert.equal(r.sinVincular[0].motivo, "PROYECTO_CON_PLANTA");
});

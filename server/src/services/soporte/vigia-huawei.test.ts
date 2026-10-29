import assert from "node:assert/strict";
import { test } from "node:test";

import { evaluarHuawei, type PrevioHuawei } from "./vigia-huawei.js";

const hoy = "2026-10-29";
const t0 = new Date("2026-10-29T14:00:00Z");
const t1 = new Date("2026-10-29T14:30:00Z");
const previo: PrevioHuawei = { diaKwh: 10, dia: hoy, leidoEn: t0, sinComunicacionConSol: 0, conFallaConSol: 0, sinSumarConSol: 0 };

test("sumó energía → genera, con la potencia media", () => {
  const r = evaluarHuawei(previo, { salud: 3, diaKwh: 11.5 }, hoy, t1, true);
  assert.equal(r.genera, true);
  assert.equal(Math.round(r.potenciaW!), 3000);
  assert.equal(r.alerta, null);
});

test("sana pero no suma, dos lecturas con sol → no genera", () => {
  const r = evaluarHuawei({ ...previo, sinSumarConSol: 1 }, { salud: 3, diaKwh: 10 }, hoy, t1, true);
  assert.equal(r.alerta, "SIN_GENERACION");
});

test("Cidel: sin comunicación una hora con sol", () => {
  const r = evaluarHuawei({ ...previo, sinComunicacionConSol: 1 }, { salud: 1, diaKwh: 0 }, hoy, t1, true);
  assert.equal(r.alerta, "SIN_COMUNICACION");
});

test("primera lectura del día: no hay con qué comparar, no alerta", () => {
  const r = evaluarHuawei({ ...previo, dia: "2026-10-28" }, { salud: 3, diaKwh: 0 }, hoy, t1, true);
  assert.equal(r.sinSumarConSol, 0);
  assert.equal(r.alerta, null);
});

test("sin sol no alerta aunque el contador esté alto", () => {
  const r = evaluarHuawei({ ...previo, sinSumarConSol: 5 }, { salud: 3, diaKwh: 10 }, hoy, t1, false);
  assert.equal(r.alerta, null);
});

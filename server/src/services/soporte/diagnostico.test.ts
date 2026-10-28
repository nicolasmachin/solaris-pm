import assert from "node:assert/strict";
import { test } from "node:test";

import { diagnosticarInversor } from "./diagnostico.js";

const ahora = new Date("2026-10-28T20:25:00Z"); // 17:25 en Uruguay
const base = {
  status: 1,
  statusText: "Normal",
  faultCode: null,
  faultTexto: null,
  pacW: 0,
  vacMax: 230,
  vpvMax: 400,
  ultimoDatoEn: new Date("2026-10-28T20:20:00Z"),
};

test("Irigaray: último dato de hace una hora, generando → no comunica", () => {
  const d = diagnosticarInversor({ ...base, pacW: 3525, ultimoDatoEn: new Date("2026-10-28T19:23:41Z") }, ahora);
  assert.equal(d.tipo, "SIN_COMUNICACION");
  assert.match((d as { detalle: string }).detalle, /16:23/);
});

test("Norman: código 302 → falla, y es la llave", () => {
  const d = diagnosticarInversor({ ...base, faultCode: 302, vacMax: 0 }, ahora);
  assert.equal(d.tipo, "FALLA_INVERSOR");
  assert.equal((d as { llaveDelCliente: boolean }).llaveDelCliente, true);
});

test("sin código pero sin red y con paneles → la llave", () => {
  const d = diagnosticarInversor({ ...base, vacMax: 0, vpvMax: 500 }, ahora);
  assert.equal(d.tipo, "SIN_GENERACION");
  assert.equal((d as { llaveDelCliente: boolean }).llaveDelCliente, true);
});

test("paneles sin tensión → lado de continua", () => {
  const d = diagnosticarInversor({ ...base, vpvMax: 3 }, ahora);
  assert.match((d as { titulo: string }).titulo, /paneles/);
});

test("el inversor sí genera → falsa alarma de la lista", () => {
  assert.equal(diagnosticarInversor({ ...base, pacW: 1500 }, ahora).tipo, "GENERA");
});

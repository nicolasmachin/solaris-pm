import assert from "node:assert/strict";
import { test } from "node:test";

import { evaluarLectura, medianaCartera, SONDEOS_PARA_ALERTA, type EstadoPrevio } from "./vigia.js";

const limpio: EstadoPrevio = { factorNormal: 1, ceroConSol: 0, desconectadaConSol: 0 };
const cartera = (w: number) => Array.from({ length: 10 }, () => ({ status: 1, potenciaW: w, kwp: 5 }));

test("mediana: con menos de 5 plantas en línea no hay referencia", () => {
  assert.equal(medianaCartera(cartera(1000).slice(0, 4)), null);
  assert.equal(medianaCartera(cartera(1000)), 0.2);
});

test("caso Norman: comunica, no genera, la cartera sí → alerta a la hora", () => {
  let e = limpio;
  let ultima;
  for (let i = 0; i < SONDEOS_PARA_ALERTA; i++) {
    ultima = evaluarLectura(e, { status: 1, potenciaW: 0, kwp: 6.6 }, 0.3);
    e = ultima;
  }
  assert.equal(ultima!.alerta, "SIN_GENERACION");
});

test("de noche (sin sol en la cartera) no cuenta ni alerta", () => {
  const r = evaluarLectura({ ...limpio, ceroConSol: 2 }, { status: 1, potenciaW: 0, kwp: 6 }, 0.01);
  assert.equal(r.ceroConSol, 2);
  assert.equal(r.alerta, null);
});

test("desconectada con sol una hora → sin comunicación", () => {
  const r = evaluarLectura({ ...limpio, desconectadaConSol: 3 }, { status: 4, potenciaW: -1, kwp: 6 }, 0.3);
  assert.equal(r.alerta, "SIN_COMUNICACION");
});

test("vuelve a generar → se limpian los contadores", () => {
  const r = evaluarLectura({ ...limpio, ceroConSol: 9 }, { status: 1, potenciaW: 800, kwp: 4 }, 0.2);
  assert.equal(r.ceroConSol, 0);
  assert.equal(r.alerta, null);
  assert.ok(r.vsNormal! > 0.9 && r.vsNormal! < 1.1);
});

test("una planta que siempre rinde la mitad no es anomalía: el factor la absorbe", () => {
  let e: EstadoPrevio = { factorNormal: null, ceroConSol: 0, desconectadaConSol: 0 };
  for (let i = 0; i < 200; i++) e = evaluarLectura(e, { status: 1, potenciaW: 500, kwp: 5 }, 0.2);
  const r = evaluarLectura(e, { status: 1, potenciaW: 500, kwp: 5 }, 0.2);
  assert.ok(Math.abs(r.vsNormal! - 1) < 0.01);
});

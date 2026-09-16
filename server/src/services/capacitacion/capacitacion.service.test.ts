import assert from "node:assert/strict";
import { test } from "node:test";

import { calcularTokenEmbed } from "../bunny-stream.service.js";
import { alcanzaUmbral, limpiarTituloBunny, resolverProgreso, validarOrden } from "./capacitacion.service.js";

test("umbral de completado al 90%", () => {
  assert.equal(alcanzaUmbral(89, 100), false);
  assert.equal(alcanzaUmbral(90, 100), true);
  assert.equal(alcanzaUmbral(500, null), false);
});

test("progreso guarda el máximo y se completa solo al pasar el umbral", () => {
  const now = new Date("2026-09-15T12:00:00Z");
  const a = resolverProgreso({ previoSegundos: 50, previoCompletadoAt: null, segundos: 20, duracionSeg: 100, now });
  assert.deepEqual(a, { segundosVistos: 50, completadoAt: null });
  const b = resolverProgreso({ previoSegundos: 50, previoCompletadoAt: null, segundos: 95, duracionSeg: 100, now });
  assert.deepEqual(b, { segundosVistos: 95, completadoAt: now });
});

test("el botón manual manda y el automático no descompleta", () => {
  const antes = new Date("2026-09-01T00:00:00Z");
  const now = new Date("2026-09-15T12:00:00Z");
  assert.equal(
    resolverProgreso({ previoSegundos: 99, previoCompletadoAt: antes, segundos: 0, duracionSeg: 100, now }).completadoAt,
    antes,
  );
  assert.equal(
    resolverProgreso({ previoSegundos: 99, previoCompletadoAt: antes, segundos: 0, duracionSeg: 100, completado: false, now })
      .completadoAt,
    null,
  );
  assert.equal(
    resolverProgreso({ previoSegundos: 0, previoCompletadoAt: null, segundos: 0, duracionSeg: 100, completado: true, now })
      .completadoAt,
    now,
  );
});

test("validarOrden exige exactamente el mismo conjunto", () => {
  assert.equal(validarOrden(["b", "a"], ["a", "b"]), true);
  assert.equal(validarOrden(["a"], ["a", "b"]), false);
  assert.equal(validarOrden(["a", "a"], ["a", "b"]), false);
  assert.equal(validarOrden(["a", "c"], ["a", "b"]), false);
});

test("token del embed = sha256 hex de tokenKey + videoId + expires", () => {
  // Vector calculado aparte: printf '%s' 'clavevideo-11700000000' | shasum -a 256
  assert.equal(
    calcularTokenEmbed("clave", "video-1", 1700000000),
    "2585324f3de2d67931cc97e9c0a18f4fb5f726058f6586ef77f428a8c3513e98",
  );
});

test("limpia la extensión del título de Bunny", () => {
  assert.equal(limpiarTituloBunny("Embudo de ventas App Voltia PM.mov"), "Embudo de ventas App Voltia PM");
  assert.equal(limpiarTituloBunny("Sin extensión"), "Sin extensión");
});

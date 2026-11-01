import assert from "node:assert/strict";
import { test } from "node:test";

import { estaNoLeida, estaSinContestar, telefonosDe } from "./bandejas.service.js";

test("telefonosDe: un campo con varios teléfonos, en formatos distintos", () => {
  assert.deepEqual(telefonosDe("099 123 456 / 98765432"), ["59899123456", "59898765432"]);
  assert.deepEqual(telefonosDe("+598 91 111 222 y 2600 1234"), ["59891111222"]);
  assert.deepEqual(telefonosDe(null), []);
});

test("sin contestar: el último es del cliente y nadie lo dio por resuelto", () => {
  const t = new Date("2026-11-01T12:00:00Z");
  assert.equal(estaSinContestar({ direccion: "ENTRANTE", ultimoEntranteEn: t }, null), true);
  assert.equal(estaSinContestar({ direccion: "SALIENTE", ultimoEntranteEn: t }, null), false);
  // "No hace falta contestar" apaga la alerta hasta el próximo mensaje del cliente.
  assert.equal(estaSinContestar({ direccion: "ENTRANTE", ultimoEntranteEn: t }, t), false);
  assert.equal(estaSinContestar({ direccion: "ENTRANTE", ultimoEntranteEn: new Date("2026-11-01T13:00:00Z") }, t), true);
});

test("no leída: hay un mensaje del cliente posterior a lo leído", () => {
  const t = new Date("2026-11-01T12:00:00Z");
  assert.equal(estaNoLeida(t, null), true);
  assert.equal(estaNoLeida(t, t), false);
  assert.equal(estaNoLeida(null, null), false);
});

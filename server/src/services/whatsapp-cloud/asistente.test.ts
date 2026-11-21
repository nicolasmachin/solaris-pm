import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";

import { datosParaWhatsApp, problemaDelSpeech } from "./asistente.service.js";

const OTRO = ["Martín García", "092 365 636"];

test("datos para WhatsApp: sin la línea que manda a hablar con otro asesor", () => {
  const datos = readFileSync(new URL("../../../config/instagram/_datos.md", import.meta.url), "utf8");
  const limpio = datosParaWhatsApp(datos);
  assert.ok(datos.includes("{DERIVAR_A}"));
  assert.ok(!limpio.includes("{DERIVAR_A}"));
  assert.ok(!limpio.includes("dejar el celular"));
  assert.ok(limpio.includes("BBVA"));
  assert.ok(limpio.includes("currículum"));
});

test("speech: sin precio no sale (el caso del 21-nov)", () => {
  const malo = [
    "Buenas tardes Andy, qué tal?",
    "Por acá te habla July, asesora comercial de Voltia.",
    "Para cotizar te pido una foto de la factura de UTE (o el consumo de los últimos meses) y la zona donde está la casa.",
    "Si preferís hablar con una persona, también podés escribirle a Martín García al 092 365 636.",
  ];
  assert.match(problemaDelSpeech(malo, OTRO)!, /precio/);
  const sinPrecioMalo = [...malo, "Para una casa normal arranca en 8.500 dólares."];
  assert.match(problemaDelSpeech(sinPrecioMalo, OTRO)!, /Martín García/);
});

test("speech completo pasa; un teléfono suelto no", () => {
  const bueno = [
    "Buenas tardes, qué tal?",
    "Por acá te habla July, asesora comercial de Voltia.",
    "Instalamos paneles conectados con UTE, sirve si gastás de $5.000 para arriba.",
    "Para una casa normal arranca en USD 8500, se recupera en unos 6 años.",
    "Si querés avanzar, pasame una factura de UTE. Quedo atenta.",
  ];
  assert.equal(problemaDelSpeech(bueno, OTRO), null);
  assert.match(problemaDelSpeech([...bueno, "O llamame al 099 123 456"], OTRO)!, /teléfono/);
  assert.match(problemaDelSpeech(bueno.slice(0, 4), OTRO)!, /factura/);
});

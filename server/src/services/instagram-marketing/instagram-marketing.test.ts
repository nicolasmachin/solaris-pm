import assert from "node:assert/strict";
import { createHmac } from "node:crypto";
import { test } from "node:test";

import { firmaValida } from "../whatsapp-cloud/firma.js";
import {
  claveDe,
  envioConectorSchema,
  estadoAsistente,
  normalizarMensajes,
  ventanaAbierta,
  ventanaHasta,
} from "./conversacion.js";

const HORA = 3600 * 1000;

test("la conversación del conector se lee tal como la guarda", () => {
  const envio = envioConectorSchema.parse({
    conversacion: {
      persona: "17841400000000001",
      usuario: "juan.perez",
      nombre: "Juan",
      desde_anuncio: true,
      derivada: { momento: 1761700000, motivo: "pidió presupuesto" },
      decisiones: [{ momento: 1, decision: "contestado" }],
      mensajes: [
        { mid: "m2", momento: 1761700100, de: "asistente", texto: "¡Hola Juan!" },
        { mid: "m1", momento: 1761700000, de: "cliente", texto: "Hola, ¿precio?" },
        { mid: "", momento: 1761700200, de: "otro", texto: "Te escribe ManyChat" },
        { mid: "m3", momento: 1761700300, de: "persona", texto: "Soy Martín", por: "user_1" },
      ],
    },
  });
  const m = normalizarMensajes(envio.conversacion!);
  assert.deepEqual(m.map((x) => x.autor), ["CLIENTE", "ASISTENTE", "OTRO", "PERSONA"]);
  assert.equal(m[0].enviadoEn.toISOString(), new Date(1761700000 * 1000).toISOString());
  assert.equal(m[2].clave.startsWith("t1761700200-otro-"), true);
  assert.equal(m[3].enviadoPorId, "user_1");
  assert.equal(m[1].enviadoPorId, null);
});

test("un id de persona que no es número se rechaza (es el nombre del archivo en el conector)", () => {
  assert.equal(envioConectorSchema.safeParse({ conversacion: { persona: "../x", mensajes: [] } }).success, false);
});

test("la llave sin id de Meta es estable y no duplica", () => {
  const a = claveDe({ momento: 10, de: "otro", texto: "hola" });
  assert.equal(a, claveDe({ momento: 10, de: "otro", texto: "hola" }));
  assert.notEqual(a, claveDe({ momento: 10, de: "otro", texto: "chau" }));
  const m = normalizarMensajes({
    persona: "1",
    mensajes: [
      { mid: "x", momento: 1, de: "cliente", texto: "a" },
      { mid: "x", momento: 1, de: "cliente", texto: "a" },
    ],
  });
  assert.equal(m.length, 1);
});

test("un autor desconocido cuenta como OTRO", () => {
  const [m] = normalizarMensajes({ persona: "1", mensajes: [{ mid: "a", momento: 1, de: "manychat", texto: "x" }] });
  assert.equal(m.autor, "OTRO");
});

test("ventana de Meta: 24 h, o 7 días si vino de un anuncio", () => {
  const ahora = new Date("2026-10-30T12:00:00Z");
  const hace30h = new Date(ahora.getTime() - 30 * HORA);
  assert.equal(ventanaAbierta({ ultimoClienteEn: hace30h, desdeAnuncio: false }, ahora), false);
  assert.equal(ventanaAbierta({ ultimoClienteEn: hace30h, desdeAnuncio: true }, ahora), true);
  assert.equal(ventanaAbierta({ ultimoClienteEn: null, desdeAnuncio: true }, ahora), false);
  assert.equal(ventanaHasta({ ultimoClienteEn: hace30h, desdeAnuncio: false })!.getTime(), hace30h.getTime() + 24 * HORA);
});

test("estado: tomada gana; derivada dura 7 días; si no, atiende el asistente", () => {
  const ahora = new Date("2026-10-30T12:00:00Z");
  assert.equal(estadoAsistente({ tomadaEn: ahora, derivadaEn: ahora }, ahora), "TOMADA");
  assert.equal(estadoAsistente({ tomadaEn: null, derivadaEn: new Date(ahora.getTime() - 2 * 24 * HORA) }, ahora), "DERIVADA");
  assert.equal(estadoAsistente({ tomadaEn: null, derivadaEn: new Date(ahora.getTime() - 8 * 24 * HORA) }, ahora), "ASISTENTE");
  assert.equal(estadoAsistente({ tomadaEn: null, derivadaEn: null }, ahora), "ASISTENTE");
});

test("la firma del conector es la misma que usa Meta (sha256=HMAC del cuerpo)", () => {
  const cuerpo = Buffer.from('{"conversacion":{"persona":"1","mensajes":[]}}');
  const firma = "sha256=" + createHmac("sha256", "secreto").update(cuerpo).digest("hex");
  assert.equal(firmaValida(cuerpo, firma, "secreto"), true);
  assert.equal(firmaValida(cuerpo, firma, "otro"), false);
  assert.equal(firmaValida(cuerpo, firma, ""), false);
});

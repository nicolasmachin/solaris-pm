import { createHmac } from "node:crypto";
import { after, describe, test } from "node:test";
import assert from "node:assert/strict";

import { prisma } from "../../lib/prisma.js";
import { desafioSuscripcion, firmaValida } from "./firma.js";
import { normalizarTelefono } from "./api.service.js";
import { procesarWebhook } from "./webhook.service.js";

const SECRETO = "secreto-de-prueba";
const firmar = (cuerpo: Buffer, secreto = SECRETO) =>
  `sha256=${createHmac("sha256", secreto).update(cuerpo).digest("hex")}`;

describe("verificación del webhook (GET)", () => {
  test("devuelve el desafío con el token correcto", () => {
    const q = { "hub.mode": "subscribe", "hub.verify_token": "tok", "hub.challenge": "123" };
    assert.equal(desafioSuscripcion(q, "tok"), "123");
  });
  test("rechaza un token incorrecto, otro modo o sin token configurado", () => {
    assert.equal(desafioSuscripcion({ "hub.mode": "subscribe", "hub.verify_token": "x", "hub.challenge": "1" }, "tok"), null);
    assert.equal(desafioSuscripcion({ "hub.mode": "unsubscribe", "hub.verify_token": "tok", "hub.challenge": "1" }, "tok"), null);
    assert.equal(desafioSuscripcion({ "hub.mode": "subscribe", "hub.verify_token": "", "hub.challenge": "1" }, ""), null);
  });
});

describe("firma del POST", () => {
  const cuerpo = Buffer.from('{"object":"whatsapp_business_account","entry":[]}');
  test("acepta la firma correcta", () => {
    assert.equal(firmaValida(cuerpo, firmar(cuerpo), SECRETO), true);
  });
  test("rechaza firma de otro secreto, cuerpo alterado, sin cabecera o sin secreto", () => {
    assert.equal(firmaValida(cuerpo, firmar(cuerpo, "otro"), SECRETO), false);
    assert.equal(firmaValida(Buffer.from(cuerpo.toString() + " "), firmar(cuerpo), SECRETO), false);
    assert.equal(firmaValida(cuerpo, undefined, SECRETO), false);
    assert.equal(firmaValida(cuerpo, "sha256=abc", SECRETO), false);
    assert.equal(firmaValida(cuerpo, firmar(cuerpo, ""), ""), false);
  });
});

describe("teléfonos", () => {
  test("normaliza celulares uruguayos al formato de WhatsApp", () => {
    assert.equal(normalizarTelefono("098 640 651"), "59898640651");
    assert.equal(normalizarTelefono("98640651"), "59898640651");
    assert.equal(normalizarTelefono("+598 98 640 651"), "59898640651");
  });
});

describe("idempotencia del webhook", () => {
  const id = `wamid.TEST_${Date.now()}`;
  const payload = {
    object: "whatsapp_business_account",
    entry: [
      {
        changes: [
          {
            field: "messages",
            value: {
              metadata: { phone_number_id: "PRUEBA" },
              messages: [{ from: "59800000000", id, timestamp: "1760000000", type: "text", text: { body: "hola" } }],
              statuses: [{ id, status: "delivered", timestamp: "1760000001" }],
            },
          },
        ],
      },
    ],
  };

  after(async () => {
    await prisma.whatsAppEstado.deleteMany({ where: { waMessageId: id } });
    await prisma.whatsAppMensaje.deleteMany({ where: { waMessageId: id } });
    await prisma.$disconnect();
  });

  test("el mismo webhook dos veces no duplica mensajes ni estados", async () => {
    const r1 = await procesarWebhook(payload);
    const r2 = await procesarWebhook(payload);
    assert.deepEqual(r1, { mensajes: 1, estados: 1 });
    assert.deepEqual(r2, { mensajes: 0, estados: 0 });
    assert.equal(await prisma.whatsAppMensaje.count({ where: { waMessageId: id } }), 1);
    assert.equal(await prisma.whatsAppEstado.count({ where: { waMessageId: id } }), 1);
  });
});

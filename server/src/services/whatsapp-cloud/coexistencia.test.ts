import { after, describe, test } from "node:test";
import assert from "node:assert/strict";

import { prisma } from "../../lib/prisma.js";
import { direccionDe, procesarWebhook } from "./webhook.service.js";

const PHONE_ID = `PRUEBA_COEX_${Date.now()}`;
const sufijo = Date.now();

const envolver = (field: string, value: Record<string, unknown>) => ({
  object: "whatsapp_business_account",
  entry: [{ changes: [{ field, value: { metadata: { phone_number_id: PHONE_ID }, ...value } }] }],
});

after(async () => {
  await prisma.whatsAppMensaje.deleteMany({ where: { phoneNumberId: PHONE_ID } });
  await prisma.whatsAppNumero.deleteMany({ where: { phoneNumberId: PHONE_ID } });
  await prisma.$disconnect();
});

describe("coexistencia: mensajes del celular e historial", () => {
  test("lo que manda el negocio lleva `to`; lo del cliente, no", () => {
    assert.equal(direccionDe({ from: "598", to: "599", id: "x", timestamp: "1", type: "text" }), "SALIENTE");
    assert.equal(direccionDe({ from: "599", id: "x", timestamp: "1", type: "text" }), "ENTRANTE");
  });

  test("un eco del celular se guarda como saliente, con el teléfono del cliente", async () => {
    const id = `wamid.ECO_${sufijo}`;
    const r = await procesarWebhook(
      envolver("smb_message_echoes", {
        message_echoes: [{ from: "59899000000", to: "59898111222", id, timestamp: "1760000000", type: "text", text: { body: "te paso el presupuesto" } }],
      }),
    );
    assert.equal(r.mensajes, 1);
    const m = await prisma.whatsAppMensaje.findUniqueOrThrow({ where: { waMessageId: id } });
    assert.equal(m.direccion, "SALIENTE");
    assert.equal(m.telefono, "59898111222");
    assert.equal(m.origen, "CELULAR");
  });

  test("el historial guarda los dos lados del hilo y el avance solo sube", async () => {
    await prisma.whatsAppNumero.create({
      data: { phoneNumberId: PHONE_ID, wabaId: "1", telefono: "+598 99 000 000", tokenCifrado: "x", coexistencia: true },
    });
    const hilo = (progreso: number, ids: string[]) =>
      envolver("history", {
        history: [
          {
            metadata: { phase: 0, chunk_order: progreso, progress: progreso },
            threads: [
              {
                id: "59898333444",
                messages: [
                  { from: "59898333444", id: ids[0], timestamp: "1750000000", type: "text", text: { body: "hola" } },
                  { from: "59899000000", to: "59898333444", id: ids[1], timestamp: "1750000100", type: "text", text: { body: "buenas" } },
                ],
              },
            ],
          },
        ],
      });
    const r = await procesarWebhook(hilo(60, [`wamid.H1_${sufijo}`, `wamid.H2_${sufijo}`]));
    assert.equal(r.mensajes, 2);
    // Una tanda vieja que llega tarde no hace bajar el avance.
    await procesarWebhook(hilo(30, [`wamid.H3_${sufijo}`, `wamid.H4_${sufijo}`]));
    const n = await prisma.whatsAppNumero.findUniqueOrThrow({ where: { phoneNumberId: PHONE_ID } });
    assert.equal(n.historialProgreso, 60);
    const h2 = await prisma.whatsAppMensaje.findUniqueOrThrow({ where: { waMessageId: `wamid.H2_${sufijo}` } });
    assert.equal(h2.direccion, "SALIENTE");
    assert.equal(h2.telefono, "59898333444");
    assert.equal(h2.origen, "HISTORIAL");
  });

  test("si el dueño no compartió el historial, queda el motivo", async () => {
    await procesarWebhook(
      envolver("history", {
        history: [{ errors: [{ code: 2593109, message: "History sync is turned off", error_data: { details: "History sharing is turned off by the business" } }] }],
      }),
    );
    const n = await prisma.whatsAppNumero.findUniqueOrThrow({ where: { phoneNumberId: PHONE_ID } });
    assert.equal(n.historialError, "History sharing is turned off by the business");
  });
});

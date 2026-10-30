/**
 * Entrada del contestador de Instagram: `/webhooks/instagram-conector`, sin
 * prefijo /api y sin login. El conector de indicadores manda acá la conversación
 * entera cada vez que cambia, firmada con el secreto compartido
 * (`X-Voltia-Firma: sha256=<HMAC del cuerpo>`, el mismo formato que usa Meta).
 *
 * Igual que el webhook de WhatsApp, guarda el cuerpo crudo para validar la firma;
 * el parser vive solo dentro de este plugin.
 */

import type { FastifyInstance } from "fastify";

import { instagramConectorConfig } from "../services/instagram-marketing/config.js";
import { guardarDesdeConector } from "../services/instagram-marketing/bandeja.service.js";
import { envioConectorSchema } from "../services/instagram-marketing/conversacion.js";
import { firmaValida } from "../services/whatsapp-cloud/firma.js";

export async function registerInstagramConectorWebhookRoutes(app: FastifyInstance) {
  app.addContentTypeParser("application/json", { parseAs: "buffer" }, (request, body, done) => {
    const buffer = body as Buffer;
    request.cuerpoCrudo = buffer;
    try {
      done(null, buffer.length > 0 ? JSON.parse(buffer.toString("utf8")) : {});
    } catch (error) {
      done(error as Error, undefined);
    }
  });

  app.post("/webhooks/instagram-conector", { bodyLimit: 20 * 1024 * 1024 }, async (request, reply) => {
    const firma = request.headers["x-voltia-firma"];
    if (!firmaValida(request.cuerpoCrudo ?? Buffer.alloc(0), typeof firma === "string" ? firma : undefined, instagramConectorConfig().secreto)) {
      console.warn("[instagram] envío del conector con firma inválida, rechazado");
      return reply.code(401).send({ error: "firma_invalida" });
    }
    const envio = envioConectorSchema.safeParse(request.body);
    if (!envio.success) {
      return reply.code(400).send({ error: "formato_invalido", detalle: envio.error.issues.slice(0, 5) });
    }
    const lista = [...(envio.data.conversacion ? [envio.data.conversacion] : []), ...(envio.data.conversaciones ?? [])];
    let nuevos = 0;
    for (const conv of lista) {
      nuevos += (await guardarDesdeConector(conv, { historial: envio.data.historial })).nuevos;
    }
    return { ok: true, conversaciones: lista.length, mensajesNuevos: nuevos };
  });
}

/**
 * Webhook de la Cloud API de WhatsApp: `/webhooks/whatsapp`, sin prefijo /api.
 *
 * Es público (Meta no se loguea), y por eso cada POST se valida con la firma
 * `X-Hub-Signature-256`. La firma se calcula sobre el cuerpo tal cual llega, así
 * que este plugin guarda el cuerpo crudo antes de parsearlo; el parser vive solo
 * dentro de este plugin y no afecta al resto de las rutas.
 *
 * En producción, Caddy tiene que mandar `/webhooks/*` al backend (DEPLOY.md §2).
 */

import type { FastifyInstance } from "fastify";

import { desafioSuscripcion, firmaValida } from "../services/whatsapp-cloud/firma.js";
import { whatsappConfig } from "../services/whatsapp-cloud/config.js";
import { procesarWebhook } from "../services/whatsapp-cloud/webhook.service.js";

declare module "fastify" {
  interface FastifyRequest {
    cuerpoCrudo?: Buffer;
  }
}

export async function registerWhatsAppWebhookRoutes(app: FastifyInstance) {
  app.addContentTypeParser("application/json", { parseAs: "buffer" }, (request, body, done) => {
    const buffer = body as Buffer;
    request.cuerpoCrudo = buffer;
    try {
      done(null, buffer.length > 0 ? JSON.parse(buffer.toString("utf8")) : {});
    } catch (error) {
      done(error as Error, undefined);
    }
  });

  // Verificación: Meta la hace una vez, al guardar la URL del webhook.
  app.get("/webhooks/whatsapp", async (request, reply) => {
    const desafio = desafioSuscripcion(request.query as Record<string, unknown>, whatsappConfig().verifyToken);
    if (desafio === null) return reply.code(403).send("Forbidden");
    return reply.code(200).type("text/plain").send(desafio);
  });

  app.post("/webhooks/whatsapp", async (request, reply) => {
    const cuerpo = request.cuerpoCrudo ?? Buffer.alloc(0);
    const firma = request.headers["x-hub-signature-256"];
    if (!firmaValida(cuerpo, typeof firma === "string" ? firma : undefined, whatsappConfig().appSecret)) {
      console.warn("[whatsapp] webhook con firma inválida, rechazado");
      return reply.code(401).send("Invalid signature");
    }

    // Se contesta enseguida: si Meta no recibe el 200 rápido, reintenta. El
    // procesamiento es idempotente, así que un reintento no duplica nada.
    reply.code(200).send("OK");
    // Solo un resumen: el historial de un número trae conversaciones enteras y
    // no tienen por qué quedar en los logs.
    const campos = ((request.body as { entry?: Array<{ changes?: Array<{ field?: string }> }> }).entry ?? [])
      .flatMap((e) => e.changes ?? [])
      .map((c) => c.field)
      .join(",");
    console.log(`[whatsapp] webhook: ${campos || "sin cambios"} (${cuerpo.length} bytes)`);
    setImmediate(() => {
      procesarWebhook(request.body as Parameters<typeof procesarWebhook>[0]).catch((err) =>
        console.error("[whatsapp] error procesando webhook:", err),
      );
    });
    return reply;
  });
}

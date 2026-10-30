/**
 * Webhook de Instagram de @voltia_uy: `/webhooks/instagram`, sin prefijo /api y
 * sin login (Caddy ya manda `/webhooks/*` al backend).
 *
 * - GET: la verificación de Meta al guardar el webhook (`INSTAGRAM_VERIFY_TOKEN`).
 * - POST: cada aviso, firmado por Meta con la clave de la app "Voltia
 *   Indicadores" (`INSTAGRAM_APP_SECRET`). En modo sombra los reenvía el
 *   servidor de indicadores con el cuerpo crudo y la misma firma, así que la
 *   validación es la misma.
 *
 * Se contesta 200 enseguida y se procesa después: Meta desactiva el webhook si
 * tarda o falla seguido.
 */

import type { FastifyInstance } from "fastify";

import { comentariosDelAviso, mensajesDelAviso } from "../services/instagram-marketing/aviso.js";
import * as comentarios from "../services/instagram-marketing/comentarios.js";
import { modoInstagram, webhookInstagramConfig } from "../services/instagram-marketing/config.js";
import * as privados from "../services/instagram-marketing/privados.js";
import { desafioSuscripcion, firmaValida } from "../services/whatsapp-cloud/firma.js";

export async function registerInstagramWebhookRoutes(app: FastifyInstance) {
  app.addContentTypeParser("application/json", { parseAs: "buffer" }, (request, body, done) => {
    const buffer = body as Buffer;
    request.cuerpoCrudo = buffer;
    try {
      done(null, buffer.length > 0 ? JSON.parse(buffer.toString("utf8")) : {});
    } catch (error) {
      done(error as Error, undefined);
    }
  });

  app.get("/webhooks/instagram", async (request, reply) => {
    const desafio = desafioSuscripcion(request.query as Record<string, unknown>, webhookInstagramConfig().verifyToken);
    if (desafio === null) return reply.code(403).send("forbidden");
    return reply.type("text/plain").send(desafio);
  });

  app.post("/webhooks/instagram", { bodyLimit: 5 * 1024 * 1024 }, async (request, reply) => {
    const firma = request.headers["x-hub-signature-256"];
    if (!firmaValida(request.cuerpoCrudo ?? Buffer.alloc(0), typeof firma === "string" ? firma : undefined, webhookInstagramConfig().appSecret)) {
      console.warn("[instagram] aviso con firma inválida, rechazado");
      return reply.code(401).send({ error: "firma_invalida" });
    }
    const datos = (request.body ?? {}) as Parameters<typeof mensajesDelAviso>[0] & { object?: string };
    void procesar(datos).catch((err) => console.error("[instagram] no se pudo procesar el aviso:", err instanceof Error ? err.message : err));
    return { ok: true };
  });
}

async function procesar(datos: Parameters<typeof mensajesDelAviso>[0] & { object?: string }) {
  if (datos.object && datos.object !== "instagram") return;
  // Los mensajes se guardan siempre (la bandeja los muestra aunque el asistente esté apagado).
  for (const m of mensajesDelAviso(datos)) await privados.registrarMensaje(m);
  if (modoInstagram() === "apagado") return;
  for (const c of comentariosDelAviso(datos)) await comentarios.recibir(c);
}

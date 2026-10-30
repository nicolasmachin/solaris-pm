/**
 * Lo que lee el servidor de indicadores de Voltia PM, sin login de usuario,
 * protegido con el secreto compartido (`Authorization: Bearer …`, ver
 * services/instagram-marketing/conector.ts). Solo lectura.
 *
 * - `GET /webhooks/instagram-conector/consultas?desde=AAAA-MM-DD&hasta=AAAA-MM-DD`:
 *   las consultas de Instagram por día, de donde sale la fuente "IG" de la
 *   planilla de indicadores (ver metricas.ts).
 *
 * Va bajo /webhooks/ porque Caddy ya manda esa ruta al backend.
 */

import type { FastifyInstance } from "fastify";
import { z } from "zod";

import { secretoValido } from "../services/instagram-marketing/conector.js";
import { consultasPorDia } from "../services/instagram-marketing/metricas.js";

const dia = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);

export async function registerInstagramConectorWebhookRoutes(app: FastifyInstance) {
  app.get("/webhooks/instagram-conector/consultas", async (request, reply) => {
    if (!secretoValido(request.headers.authorization)) return reply.code(401).send({ error: "no_autorizado" });
    const q = z.object({ desde: dia, hasta: dia }).safeParse(request.query);
    if (!q.success || q.data.desde > q.data.hasta) return reply.code(400).send({ error: "fechas_invalidas" });
    if ((Date.parse(q.data.hasta) - Date.parse(q.data.desde)) / 86_400_000 > 400) {
      return reply.code(400).send({ error: "rango_demasiado_largo" });
    }
    return { dias: await consultasPorDia(q.data.desde, q.data.hasta) };
  });
}

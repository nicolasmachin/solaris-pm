// Avisos push: activar y desactivar en este dispositivo. Ver services/push.
//
//     GET    /api/push/estado          { habilitado, clavePublica }
//     POST   /api/push/suscripciones   { endpoint, keys: { p256dh, auth } }
//     DELETE /api/push/suscripciones   { endpoint }
//     POST   /api/push/prueba          manda un aviso de prueba a mis dispositivos
//
// Cualquier usuario con sesión, incluido el cliente: cada uno maneja solo los
// avisos de sus propios dispositivos, así que no hay permiso de la matriz.

import type { FastifyInstance, FastifyRequest } from "fastify";
import { z } from "zod";

import { authenticate } from "../middleware/auth.middleware.js";
import {
  borrarSuscripcion,
  clavePublica,
  enviarPush,
  guardarSuscripcion,
  pushHabilitado,
} from "../services/push/push.service.js";
import { badRequest, forbidden } from "../utils/errors.js";

const suscripcionBody = z.object({
  endpoint: z.string().url().max(2000),
  keys: z.object({ p256dh: z.string().min(1).max(500), auth: z.string().min(1).max(500) }),
});

function usuario(request: FastifyRequest) {
  const user = request.user;
  if (!user) throw badRequest("AUTH_CONTEXT_MISSING", "No se pudo resolver el usuario autenticado");
  // Mirando el portal como un cliente, activar avisos suscribiría al interno
  // con la pantalla del cliente: no se hace.
  if (request.headers["x-portal-preview"]) throw forbidden("En la vista del cliente no se activan avisos");
  return user;
}

export async function registerPushRoutes(app: FastifyInstance) {
  await app.register(async (app) => {
    app.addHook("preHandler", authenticate);

    app.get("/push/estado", async () => ({ habilitado: pushHabilitado(), clavePublica: clavePublica() }));

    app.post("/push/suscripciones", async (request) => {
      const user = usuario(request);
      if (!pushHabilitado()) throw badRequest("PUSH_DESHABILITADO", "Los avisos no están configurados");
      const body = suscripcionBody.parse(request.body);
      const ua = request.headers["user-agent"];
      await guardarSuscripcion(user.id, body, typeof ua === "string" ? ua.slice(0, 300) : null);
      return { ok: true };
    });

    app.delete("/push/suscripciones", async (request) => {
      const user = usuario(request);
      const { endpoint } = z.object({ endpoint: z.string().min(1) }).parse(request.body);
      await borrarSuscripcion(user.id, endpoint);
      return { ok: true };
    });

    app.post("/push/prueba", async (request) => {
      const user = usuario(request);
      const enviados = await enviarPush(user.id, {
        titulo: "Voltia",
        cuerpo: "Listo: los avisos te van a llegar a este dispositivo.",
        url: user.role === "CLIENT" ? "/portal" : "/dashboard",
        etiqueta: "prueba",
      });
      return { enviados };
    });
  });
}

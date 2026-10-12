// Videos para clientes en el portal (`/portal/videos`). Se registra DENTRO de
// `registerPortalRoutes`, así hereda `authenticate` y el modo "ver el portal
// como el cliente" (`portalPreviewHook`).
//
// No es un módulo aparte: es Capacitación. El contenido se gestiona desde
// Capacitación → Gestionar, en un área con el rol CLIENT tildado; acá solo se
// lee. Quien pida estos endpoints ve siempre lo que ve un cliente (el rol se
// fuerza a CLIENT): un interno con PORTAL_CLIENTE:VIEW no termina viendo las
// áreas internas desde el portal. El progreso sí queda a nombre del usuario real.

import { Action, Module } from "@prisma/client";
import type { FastifyInstance, FastifyRequest } from "fastify";
import { z } from "zod";

import { authorize } from "../middleware/authorize.middleware.js";
import * as cap from "../services/capacitacion/capacitacion.service.js";
import { firmarTokenMedia } from "../services/capacitacion/miniaturas.service.js";
import { badRequest } from "../utils/errors.js";

const idParam = z.object({ id: z.string().min(1) });
const ver = { preHandler: authorize(Module.PORTAL_CLIENTE, Action.VIEW) };

function usuarioCliente(request: FastifyRequest): cap.CapUser {
  if (!request.user) throw badRequest("AUTH_CONTEXT_MISSING", "No se pudo resolver el usuario autenticado");
  return { id: request.user.id, role: cap.ROL_CLIENTE };
}

export async function registerPortalVideosRoutes(app: FastifyInstance) {
  // Todo de una: son pocos videos y la pantalla los muestra juntos.
  app.get("/client/videos", ver, async (request) => {
    const user = usuarioCliente(request);
    return { secciones: await cap.contenidoPortal(user), mediaToken: firmarTokenMedia(user) };
  });

  // GET y no POST (como en Capacitación): el modo "ver como el cliente" solo
  // deja pasar GET, y quien mira tiene que poder reproducir el video.
  app.get("/client/videos/:id/embed", ver, async (request) => {
    const user = usuarioCliente(request);
    const { id } = idParam.parse(request.params);
    return cap.embedVideo(id, user);
  });

  // En modo vista previa no llega acá: el hook rechaza todo lo que no sea GET,
  // así que quien mira no le deja progreso al cliente.
  app.put("/client/videos/:id/progreso", ver, async (request) => {
    const user = usuarioCliente(request);
    const { id } = idParam.parse(request.params);
    const body = z
      .object({ segundos: z.number().min(0).max(24 * 3600), completado: z.boolean().optional() })
      .parse(request.body);
    return cap.guardarProgreso(id, user, body);
  });
}

// Alta del cliente en la aplicación del inversor (ver services/growatt-alta).
//
//   Público (sin login, lo abre el cliente con el link):
//     GET  /api/publico/alta-app/:token
//     POST /api/publico/alta-app/:token/disponible   { usuario }
//     POST /api/publico/alta-app/:token              { usuario, password, email }
//   Equipo (EXPERIENCIA_CLIENTES):
//     GET  /api/projects/:projectId/alta-app          VIEW
//     POST /api/projects/:projectId/alta-app/link     EDIT
//   Portal (PORTAL_CLIENTE):
//     GET  /api/client/alta-app
//     POST /api/client/alta-app/disponible            { projectId, usuario }
//     POST /api/client/alta-app/:projectId            { usuario, password, email }
//
// Lo público va en un plugin aparte, sin el hook de autenticación. Tiene un
// freno por IP: el link es secreto, pero la ruta está en internet.

import { Action, Module } from "@prisma/client";
import type { FastifyInstance, FastifyRequest } from "fastify";
import { z } from "zod";

import { authenticate } from "../middleware/auth.middleware.js";
import { authorize } from "../middleware/authorize.middleware.js";
import {
  completarConLink,
  completarDesdePortal,
  estadoAltaProyecto,
  estadoPortal,
  generarLinkAlta,
  infoLink,
  usuarioDisponible,
} from "../services/growatt-alta/growatt-alta.service.js";
import { AppError, unauthorized } from "../utils/errors.js";

const datosSchema = z.object({
  usuario: z.string().trim().min(1).max(40),
  password: z.string().min(1).max(64),
  email: z.string().trim().min(3).max(120),
});

// 30 pedidos por IP cada 10 minutos alcanza de sobra para una persona que
// prueba usuarios; frena a alguien que adivina tokens o usuarios.
const ventana = new Map<string, { desde: number; n: number }>();
function frenarPorIp(request: FastifyRequest) {
  const ip = request.ip ?? "?";
  const ahora = Date.now();
  const v = ventana.get(ip);
  if (!v || ahora - v.desde > 10 * 60_000) {
    ventana.set(ip, { desde: ahora, n: 1 });
    return;
  }
  v.n++;
  if (v.n > 30) throw new AppError(429, "DEMASIADOS_PEDIDOS", "Demasiados intentos. Probá de nuevo en unos minutos.");
}

function ensureUser(request: FastifyRequest) {
  if (!request.user) throw unauthorized("No autenticado");
  return request.user;
}

export async function registerGrowattAltaPublicRoutes(app: FastifyInstance) {
  const tokenParams = z.object({ token: z.string().min(1).max(100) });

  app.get("/publico/alta-app/:token", async (request) => {
    frenarPorIp(request);
    const { token } = tokenParams.parse(request.params);
    return infoLink(token);
  });

  app.post("/publico/alta-app/:token/disponible", async (request) => {
    frenarPorIp(request);
    const { token } = tokenParams.parse(request.params);
    const { usuario } = z.object({ usuario: z.string().max(40) }).parse(request.body);
    return usuarioDisponible(token, null, usuario);
  });

  app.post("/publico/alta-app/:token", async (request) => {
    frenarPorIp(request);
    const { token } = tokenParams.parse(request.params);
    return completarConLink(token, datosSchema.parse(request.body));
  });
}

export async function registerGrowattAltaRoutes(app: FastifyInstance) {
  app.addHook("preHandler", authenticate);
  const projectParams = z.object({ projectId: z.string().min(1) });

  app.get(
    "/projects/:projectId/alta-app",
    { preHandler: authorize(Module.EXPERIENCIA_CLIENTES, Action.VIEW) },
    async (request) => estadoAltaProyecto(projectParams.parse(request.params).projectId),
  );

  app.post(
    "/projects/:projectId/alta-app/link",
    { preHandler: authorize(Module.EXPERIENCIA_CLIENTES, Action.EDIT) },
    async (request) => {
      const user = ensureUser(request);
      return generarLinkAlta(projectParams.parse(request.params).projectId, user.id);
    },
  );

  app.get(
    "/client/alta-app",
    { preHandler: authorize(Module.PORTAL_CLIENTE, Action.VIEW) },
    async (request) => estadoPortal(ensureUser(request).id),
  );

  app.post(
    "/client/alta-app/disponible",
    { preHandler: authorize(Module.PORTAL_CLIENTE, Action.VIEW) },
    async (request) => {
      ensureUser(request);
      const { projectId, usuario } = z.object({ projectId: z.string().min(1), usuario: z.string().max(40) }).parse(request.body);
      return usuarioDisponible(null, projectId, usuario);
    },
  );

  app.post(
    "/client/alta-app/:projectId",
    { preHandler: authorize(Module.PORTAL_CLIENTE, Action.VIEW) },
    async (request) => {
      const user = ensureUser(request);
      frenarPorIp(request);
      return completarDesdePortal(user.id, projectParams.parse(request.params).projectId, datosSchema.parse(request.body));
    },
  );
}

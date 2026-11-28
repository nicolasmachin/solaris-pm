// Agenda de instalación de cargadores de autos eléctricos. Prefijo /api.
//
// Dos caras:
//   - /publico/cargadores/*: la página /agendar-cargador, sin login. Solo lee
//     días libres y crea reservas; nunca devuelve datos de otras reservas.
//   - /cargadores/*: la gestión interna (configuración y lista de reservas),
//     con los permisos del calendario (OPERACIONES), que es donde caen.

import { Action, Module } from "@prisma/client";
import type { FastifyInstance, FastifyRequest } from "fastify";
import { z } from "zod";

import { authenticate } from "../middleware/auth.middleware.js";
import { authorize } from "../middleware/authorize.middleware.js";
import {
  calcularDisponibilidad,
  cancelarReserva,
  configPublica,
  configSchema,
  crearReserva,
  guardarConfig,
  leerConfig,
  listarReservas,
  reservaInputSchema,
} from "../services/cargadores/agenda-cargadores.service.js";
import { AppError, unauthorized } from "../utils/errors.js";

function ensureUser(request: FastifyRequest) {
  if (!request.user) throw unauthorized("No autenticado");
  return request.user;
}

/**
 * IP del cliente. En prod el server está detrás de Caddy, que pone la IP real
 * en X-Forwarded-For (y reemplaza la que mande el cliente); sin esto todas las
 * reservas compartirían la IP del proxy y el límite frenaría a todo el mundo.
 */
function ipCliente(request: FastifyRequest): string {
  const xff = request.headers["x-forwarded-for"];
  const primera = (Array.isArray(xff) ? xff[0] : xff)?.split(",")[0]?.trim();
  return primera || request.ip;
}

export async function registerCargadoresPublicoRoutes(app: FastifyInstance) {
  app.get("/publico/cargadores/config", async () => {
    return { config: configPublica(await leerConfig()) };
  });

  app.get("/publico/cargadores/disponibilidad", async () => {
    return { dias: await calcularDisponibilidad(await leerConfig()) };
  });

  app.post("/publico/cargadores/reservas", async (request) => {
    const ip = ipCliente(request);
    const { tooManyAttempts } = await import("./mcp/rate-limit.js");
    if (tooManyAttempts(`cargadores:${ip}`)) {
      throw new AppError(429, "DEMASIADOS_PEDIDOS", "Ya recibimos tus pedidos. Te vamos a escribir.");
    }
    const raw = (request.body ?? {}) as Record<string, unknown>;
    // Trampa para bots: un campo oculto que una persona nunca completa. Se
    // contesta como si hubiera salido bien para no darles pistas.
    if (typeof raw.web === "string" && raw.web.trim() !== "") {
      return { ok: true, estado: "A_CONFIRMAR", fecha: null, franja: null };
    }
    const input = reservaInputSchema.parse(raw);
    const r = await crearReserva(input, ip);
    return { ok: true, estado: r.estado, fecha: r.fecha?.toISOString().slice(0, 10) ?? null, franja: r.franja };
  });
}

export async function registerCargadoresRoutes(app: FastifyInstance) {
  const guardVer = [authenticate, authorize(Module.OPERACIONES, Action.VIEW)];
  const guardEditar = [authenticate, authorize(Module.OPERACIONES, Action.EDIT)];

  app.get("/cargadores/config", { preHandler: guardVer }, async () => {
    const [config, dias] = await Promise.all([leerConfig(), leerConfig().then(calcularDisponibilidad)]);
    return { config, diasLibres: dias.length };
  });

  app.put("/cargadores/config", { preHandler: guardEditar }, async (request) => {
    const user = ensureUser(request);
    const body = configSchema.parse(request.body);
    return { config: await guardarConfig(body, user.id) };
  });

  app.get("/cargadores/reservas", { preHandler: guardVer }, async (request) => {
    const q = z.object({ canceladas: z.enum(["0", "1"]).optional() }).parse(request.query);
    return { reservas: await listarReservas({ incluirCanceladas: q.canceladas === "1" }) };
  });

  app.post("/cargadores/reservas/:id/cancelar", { preHandler: guardEditar }, async (request) => {
    const user = ensureUser(request);
    const { id } = z.object({ id: z.string().min(1) }).parse(request.params);
    const r = await cancelarReserva(id, user);
    return { ok: true, estado: r.estado };
  });
}

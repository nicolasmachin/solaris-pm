// Vales de obra: salida de materiales del local a una obra y devolución de
// sobrantes, y el consumo resultante por material. Ver `vales-obra.service.ts`.
// Opcional: ninguna etapa los exige todavía.

import { Action, Module } from "@prisma/client";
import type { FastifyInstance, FastifyRequest } from "fastify";
import { z } from "zod";

import { authenticate } from "../middleware/auth.middleware.js";
import { authorize } from "../middleware/authorize.middleware.js";
import { consumoDeObra, registrarValeObra } from "../services/stock/vales-obra.service.js";
import { parseDateOnly } from "../utils/dates.js";
import { unauthorized } from "../utils/errors.js";

function ensureUser(request: FastifyRequest) {
  if (!request.user) throw unauthorized("No autenticado");
  return request.user;
}

const params = z.object({ projectId: z.string().min(1) }).strict();

const valeBody = z
  .object({
    tipo: z.enum(["SALIDA", "DEVOLUCION"]),
    fecha: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
    renglones: z
      .array(z.object({ materialItemId: z.string().min(1), cantidad: z.coerce.number().positive() }).strict())
      .min(1)
      .max(500),
    observaciones: z.string().max(2000).optional(),
  })
  .strict();

export async function registerValesObraRoutes(app: FastifyInstance) {
  app.get(
    "/projects/:projectId/consumo-obra",
    { preHandler: [authenticate, authorize(Module.STOCK, Action.VIEW)] },
    async (request) => {
      const { projectId } = params.parse(request.params);
      return { filas: await consumoDeObra(projectId) };
    },
  );

  app.post(
    "/projects/:projectId/vales-obra",
    { preHandler: [authenticate, authorize(Module.STOCK, Action.CREATE)] },
    async (request) => {
      const user = ensureUser(request);
      const { projectId } = params.parse(request.params);
      const body = valeBody.parse(request.body);
      return registrarValeObra({
        projectId,
        tipo: body.tipo,
        fecha: parseDateOnly(body.fecha),
        renglones: body.renglones,
        observaciones: body.observaciones,
        userId: user.id,
      });
    },
  );
}

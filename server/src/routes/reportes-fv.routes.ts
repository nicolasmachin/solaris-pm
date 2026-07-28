// Endpoints del módulo Reportes fotovoltaicos. Prefijo /api.
//
// Tarifas UTE → authorize(CONFIGURACION, *): son parámetros del sistema, no
// datos de un cliente. El resto del módulo usa EXPERIENCIA_CLIENTES.

import { Action, FranjaHoraria, Module, TarifaUte } from "@prisma/client";
import type { FastifyInstance } from "fastify";
import { z } from "zod";

import { authenticate } from "../middleware/auth.middleware.js";
import { authorize } from "../middleware/authorize.middleware.js";
import { badRequest } from "../utils/errors.js";
import {
  actualizarVersion,
  crearVersion,
  getVersion,
  listarVersiones,
  publicarVersion,
} from "../services/reportesFv/tarifas/tarifas.service.js";

const fechaISO = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, "La fecha debe tener formato YYYY-MM-DD")
  .transform((s) => new Date(`${s}T00:00:00.000Z`));

const cargoSchema = z.object({
  tarifa: z.nativeEnum(TarifaUte),
  cargoFijo: z.number().min(0),
  cargoPotenciaKw: z.number().min(0),
});

const tramoSchema = z.object({
  tarifa: z.nativeEnum(TarifaUte),
  orden: z.number().int().min(0),
  desdeKwh: z.number().int().min(0),
  hastaKwh: z.number().int().min(0),
  precioKwh: z.number().min(0),
});

const franjaSchema = z.object({
  tarifa: z.nativeEnum(TarifaUte),
  franja: z.nativeEnum(FranjaHoraria),
  precioKwh: z.number().min(0),
});

const cuadroSchema = {
  cargos: z.array(cargoSchema).optional(),
  tramos: z.array(tramoSchema).optional(),
  franjas: z.array(franjaSchema).optional(),
};

export async function registerReportesFvRoutes(app: FastifyInstance) {
  app.addHook("preHandler", authenticate);

  // ─── Tarifas UTE ───────────────────────────────────────────────────────────

  app.get(
    "/reportes-fv/tarifas",
    { preHandler: authorize(Module.CONFIGURACION, Action.VIEW) },
    async () => ({ versiones: await listarVersiones() }),
  );

  app.get(
    "/reportes-fv/tarifas/:id",
    { preHandler: authorize(Module.CONFIGURACION, Action.VIEW) },
    async (request) => {
      const { id } = z.object({ id: z.string() }).parse(request.params);
      return getVersion(id);
    },
  );

  app.post(
    "/reportes-fv/tarifas",
    { preHandler: authorize(Module.CONFIGURACION, Action.CREATE) },
    async (request, reply) => {
      const body = z
        .object({
          nombre: z.string().min(1, "El cuadro necesita un nombre"),
          vigenteDesde: fechaISO,
          ivaPct: z.number().min(0).max(1).optional(),
          irpfPct: z.number().min(0).max(1).optional(),
          notas: z.string().nullable().optional(),
          clonarDeId: z.string().optional(),
          publicada: z.boolean().optional(),
          ...cuadroSchema,
        })
        .parse(request.body);

      const id = await crearVersion(body, request.user!.id);
      return reply.code(201).send({ id });
    },
  );

  app.put(
    "/reportes-fv/tarifas/:id",
    { preHandler: authorize(Module.CONFIGURACION, Action.EDIT) },
    async (request) => {
      const { id } = z.object({ id: z.string() }).parse(request.params);
      const body = z
        .object({
          nombre: z.string().min(1).optional(),
          vigenteDesde: fechaISO.optional(),
          ivaPct: z.number().min(0).max(1).optional(),
          irpfPct: z.number().min(0).max(1).optional(),
          notas: z.string().nullable().optional(),
          ...cuadroSchema,
        })
        .parse(request.body);

      await actualizarVersion(id, body, request.user!.id);
      return { ok: true };
    },
  );

  app.post(
    "/reportes-fv/tarifas/:id/publicar",
    { preHandler: authorize(Module.CONFIGURACION, Action.EDIT) },
    async (request) => {
      const { id } = z.object({ id: z.string() }).parse(request.params);
      const { confirmar } = z.object({ confirmar: z.boolean().optional() }).parse(request.body ?? {});

      // Publicar es irreversible: la versión queda inmutable y cambia qué tarifa
      // rige de ahí en adelante. Se pide confirmación explícita del cliente.
      if (!confirmar) {
        throw badRequest(
          "CONFIRMACION_REQUERIDA",
          "Publicar un cuadro tarifario es irreversible. Confirmá la acción para continuar.",
        );
      }

      await publicarVersion(id, request.user!.id);
      return { ok: true };
    },
  );
}

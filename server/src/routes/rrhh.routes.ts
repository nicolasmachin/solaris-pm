// Endpoints del módulo Recursos Humanos. Prefijo /api.
//   /mi-legajo/*  → RRHH:VIEW, siempre sobre el legajo propio.
//   /rrhh/*       → RRHH:EDIT, legajos de todos (sueldos, contratos, salud).
// Ver services/rrhh/rrhh.service.ts.

import fs from "node:fs";

import { Action, LegajoDocumentoTipo, Module, VinculoLaboral } from "@prisma/client";
import type { FastifyInstance, FastifyRequest } from "fastify";
import { z } from "zod";

import { authenticate } from "../middleware/auth.middleware.js";
import { authorize } from "../middleware/authorize.middleware.js";
import * as rrhh from "../services/rrhh/rrhh.service.js";
import { contentDisposition } from "../utils/content-disposition.js";
import { badRequest } from "../utils/errors.js";
import { verificarTokenDescarga } from "../utils/token-descarga.js";

function ensureUser(request: FastifyRequest) {
  if (!request.user) throw badRequest("AUTH_CONTEXT_MISSING", "No se pudo resolver el usuario autenticado");
  return request.user;
}

const idParam = z.object({ id: z.string().min(1) });
const userIdParam = z.object({ userId: z.string().min(1) });
const fecha = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Fecha inválida (AAAA-MM-DD)");
const texto = z.string().trim().max(500).nullish();

const datosPersonales = z
  .object({
    cedula: z.string().trim().max(20).nullish(),
    fechaNacimiento: fecha.or(z.literal("")).nullish(),
    direccion: texto,
    telefonoPersonal: z.string().trim().max(40).nullish(),
    emailPersonal: z.string().trim().max(200).nullish(),
    emergenciaNombre: texto,
    emergenciaTelefono: z.string().trim().max(40).nullish(),
    emergenciaVinculo: texto,
    mutualista: texto,
    emergenciaMovil: texto,
    grupoSanguineo: z.string().trim().max(10).nullish(),
    alergias: texto,
    banco: texto,
    cuentaBancaria: z.string().trim().max(60).nullish(),
    talleRopa: z.string().trim().max(20).nullish(),
    talleCalzado: z.string().trim().max(20).nullish(),
    licenciaConducirCategoria: z.string().trim().max(20).nullish(),
  })
  .strict();

const datosEmpresa = z.object({
  vinculo: z.nativeEnum(VinculoLaboral).optional(),
  fechaIngreso: fecha.or(z.literal("")).nullish(),
  fechaEgreso: fecha.or(z.literal("")).nullish(),
  cargo: texto,
  tipoContrato: texto,
  categoria: texto,
  sueldoNominal: z.number().nonnegative().nullish(),
  sueldoMoneda: z.enum(["UYU", "USD"]).optional(),
  notasInternas: z.string().trim().max(4000).nullish(),
});

// Metadatos de una subida: por querystring (el archivo es la única parte multipart).
const datosSubida = z.object({
  tipo: z.nativeEnum(LegajoDocumentoTipo),
  titulo: z.string().trim().max(200).optional(),
  periodo: z.string().regex(/^\d{4}-\d{2}$/, "El período va como AAAA-MM").optional(),
  vencimiento: fecha.optional(),
  soloInterno: z.preprocess((v) => v === true || v === "true" || v === "1", z.boolean()).optional(),
});

const ver = { preHandler: authorize(Module.RRHH, Action.VIEW) };
const gestionar = { preHandler: authorize(Module.RRHH, Action.EDIT) };

export async function registerRrhhRoutes(app: FastifyInstance) {
  // Descarga y vista previa: sin `authenticate` (un enlace o un iframe no mandan
  // el header Authorization). El token viaja en `?t=`, atado al documento, y el
  // service vuelve a chequear que sea de la persona o de un gestor.
  const tokenQuery = z.object({ t: z.string().min(1) });
  for (const [sufijo, disposition] of [["download", "attachment"], ["preview", "inline"]] as const) {
    app.get(`/rrhh/documentos/:id/${sufijo}`, async (request, reply) => {
      const { id } = idParam.parse(request.params);
      const { t } = tokenQuery.parse(request.query);
      const user = verificarTokenDescarga(t, rrhh.TOKEN_DESCARGA, id);
      const file = await rrhh.documentoParaDescarga(id, user);
      reply.header("Content-Type", file.mimeType);
      reply.header("Content-Disposition", contentDisposition(disposition, file.filename));
      reply.header("Cache-Control", "private, no-store");
      return reply.send(fs.createReadStream(file.absolutePath));
    });
  }

  await app.register(async (app) => {
    app.addHook("preHandler", authenticate);

    // ─── Mi legajo ──────────────────────────────────────────────────────────

    app.get("/mi-legajo", ver, async (request) => rrhh.miLegajo(ensureUser(request)));

    app.patch("/mi-legajo", ver, async (request) => {
      const datos = datosPersonales.parse(request.body);
      return rrhh.actualizarMisDatos(ensureUser(request), datos);
    });

    app.post("/mi-legajo/documentos", ver, async (request, reply) => {
      const q = datosSubida.omit({ soloInterno: true }).parse(request.query);
      const part = await request.file();
      if (!part) throw badRequest("FILE_REQUIRED", "Debés adjuntar un archivo");
      const doc = await rrhh.subirMiDocumento(ensureUser(request), part, q);
      reply.code(201);
      return doc;
    });

    app.delete("/mi-legajo/documentos/:id", ver, async (request, reply) => {
      const { id } = idParam.parse(request.params);
      await rrhh.borrarMiDocumento(ensureUser(request), id);
      return reply.code(204).send();
    });

    // ─── Gestión ────────────────────────────────────────────────────────────

    app.get("/rrhh/legajos", gestionar, async () => rrhh.listarLegajos());

    app.get("/rrhh/vencimientos", gestionar, async () => rrhh.tableroVencimientos());

    app.get("/rrhh/tipos", gestionar, async () => rrhh.TIPOS);

    app.get("/rrhh/legajos/:userId", gestionar, async (request) => {
      const { userId } = userIdParam.parse(request.params);
      return rrhh.legajoDe(userId, ensureUser(request));
    });

    app.patch("/rrhh/legajos/:userId", gestionar, async (request) => {
      const { userId } = userIdParam.parse(request.params);
      const datos = datosPersonales.merge(datosEmpresa).parse(request.body);
      return rrhh.actualizarLegajo(userId, datos, ensureUser(request));
    });

    app.post("/rrhh/legajos/:userId/documentos", gestionar, async (request, reply) => {
      const { userId } = userIdParam.parse(request.params);
      const q = datosSubida.parse(request.query);
      const part = await request.file();
      if (!part) throw badRequest("FILE_REQUIRED", "Debés adjuntar un archivo");
      const doc = await rrhh.subirDocumento(userId, part, q, ensureUser(request));
      reply.code(201);
      return doc;
    });

    app.patch("/rrhh/documentos/:id", gestionar, async (request) => {
      const { id } = idParam.parse(request.params);
      const body = z
        .object({
          titulo: z.string().trim().min(1).max(200).optional(),
          vencimiento: fecha.nullish(),
          periodo: z.string().regex(/^\d{4}-\d{2}$/).nullish(),
          soloInterno: z.boolean().optional(),
        })
        .parse(request.body);
      return rrhh.actualizarDocumento(id, body, ensureUser(request));
    });

    app.post("/rrhh/documentos/:id/revision", gestionar, async (request) => {
      const { id } = idParam.parse(request.params);
      const body = z
        .object({
          aprobar: z.boolean(),
          motivo: z.string().trim().max(500).nullish(),
          vencimiento: fecha.nullish(),
        })
        .parse(request.body);
      return rrhh.revisarDocumento(id, body, ensureUser(request));
    });

    app.delete("/rrhh/documentos/:id", gestionar, async (request, reply) => {
      const { id } = idParam.parse(request.params);
      await rrhh.borrarDocumento(id, ensureUser(request));
      return reply.code(204).send();
    });
  });
}

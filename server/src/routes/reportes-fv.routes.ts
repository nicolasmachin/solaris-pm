// Endpoints del módulo Reportes fotovoltaicos. Prefijo /api.
//
// Tarifas UTE → authorize(CONFIGURACION, *): son parámetros del sistema, no
// datos de un cliente. El resto del módulo usa EXPERIENCIA_CLIENTES.

import { Action, FranjaHoraria, Module, TarifaUte } from "@prisma/client";
import type { FastifyInstance } from "fastify";
import { z } from "zod";

import { authenticate } from "../middleware/auth.middleware.js";
import { authorize } from "../middleware/authorize.middleware.js";
import { badRequest, notFound } from "../utils/errors.js";
import { contentDisposition } from "../utils/content-disposition.js";
import { prisma } from "../lib/prisma.js";
import { getStoredFilePath } from "../services/file-storage.service.js";
import fs from "node:fs";
import {
  actualizarVersion,
  crearVersion,
  getVersion,
  listarVersiones,
  publicarVersion,
} from "../services/reportesFv/tarifas/tarifas.service.js";
import { getDetalleGenerador, getPanel, periodosConDatos } from "../services/reportesFv/panel.service.js";
import { upsertConfig } from "../services/reportesFv/config.service.js";
import { upsertLecturaManual } from "../services/reportesFv/lecturas.service.js";
import { recalcularSerie } from "../services/reportesFv/calculo.service.js";
import { generarEmision, regenerarPdfDesdeSnapshot } from "../services/reportesFv/emision.service.js";
import { enviarEmision, enviarLote } from "../services/reportesFv/envio.service.js";

const periodoSchema = z
  .string()
  .regex(/^\d{4}-(0[1-9]|1[0-2])$/, "El periodo debe tener formato YYYY-MM");

const tarifaKeySchema = z.enum(["simple", "doble", "triple", "zafral"]);

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

  // ─── Panel de gestión (Experiencia Solar) ───────────────────────────────────

  const EXP = Module.EXPERIENCIA_CLIENTES;

  // Listado de generadores (dados de alta y no) con estado del periodo + KPIs.
  app.get(
    "/reportes-fv/panel",
    { preHandler: authorize(EXP, Action.VIEW) },
    async (request) => {
      const { periodo } = z.object({ periodo: periodoSchema }).parse(request.query);
      return getPanel(periodo);
    },
  );

  // Periodos disponibles para el selector.
  app.get(
    "/reportes-fv/periodos",
    { preHandler: authorize(EXP, Action.VIEW) },
    async () => ({ periodos: await periodosConDatos() }),
  );

  // Detalle de un generador (config + lecturas + emisiones).
  app.get(
    "/reportes-fv/generadores/:projectId",
    { preHandler: authorize(EXP, Action.VIEW) },
    async (request) => {
      const { projectId } = z.object({ projectId: z.string() }).parse(request.params);
      const detalle = await getDetalleGenerador(projectId);
      if (!detalle) throw notFound("GENERADOR_NO_ENCONTRADO", "El generador no existe");
      return detalle;
    },
  );

  // Dar de alta o editar la config. Recalcula la serie después.
  app.put(
    "/reportes-fv/generadores/:projectId/config",
    { preHandler: authorize(EXP, Action.EDIT) },
    async (request) => {
      const { projectId } = z.object({ projectId: z.string() }).parse(request.params);
      const body = z
        .object({
          habilitado: z.boolean().optional(),
          tipoCliente: z.enum(["residencial", "empresa"]).optional(),
          tarifaContratada: tarifaKeySchema.nullable().optional(),
          potenciaContratadaKw: z.number().min(0).nullable().optional(),
          pctPunta: z.number().min(0).nullable().optional(),
          pctLlano: z.number().min(0).nullable().optional(),
          pctValle: z.number().min(0).nullable().optional(),
          inversionUsd: z.number().min(0).nullable().optional(),
          potenciaInstaladaKwp: z.number().min(0).nullable().optional(),
          mesInicio: periodoSchema.nullable().optional(),
          origenDatos: z.enum(["GROWATT", "MANUAL"]).optional(),
          growattPlantId: z.string().regex(/^\d+$/).nullable().optional(),
          notasFijas: z.string().nullable().optional(),
          destinatarios: z
            .array(
              z.object({
                email: z.string().email(),
                nombre: z.string().nullable().optional(),
                esCopia: z.boolean().optional(),
              }),
            )
            .optional(),
        })
        .parse(request.body);

      await upsertConfig(projectId, body, request.user!.id);
      // Recalcular no debe hacer fallar el guardado (la config puede quedar
      // incompleta a propósito mientras se cargan datos).
      await recalcularSerie(projectId).catch(() => undefined);
      return { ok: true };
    },
  );

  // Cargar/corregir una lectura a mano. Recalcula la serie después.
  app.put(
    "/reportes-fv/generadores/:projectId/lecturas/:periodo",
    { preHandler: authorize(EXP, Action.EDIT) },
    async (request) => {
      const { projectId, periodo } = z
        .object({ projectId: z.string(), periodo: periodoSchema })
        .parse(request.params);
      const body = z
        .object({
          generacionKwh: z.number().min(0).nullable().optional(),
          consumoKwh: z.number().min(0).nullable().optional(),
          exportacionKwh: z.number().min(0).nullable().optional(),
          nota: z.string().nullable().optional(),
        })
        .parse(request.body);

      await upsertLecturaManual(projectId, periodo, body, request.user!.id);
      await recalcularSerie(projectId).catch(() => undefined);
      return { ok: true };
    },
  );

  // Recalcular la serie de un generador (idempotente).
  app.post(
    "/reportes-fv/generadores/:projectId/recalcular",
    { preHandler: authorize(EXP, Action.EDIT) },
    async (request) => {
      const { projectId } = z.object({ projectId: z.string() }).parse(request.params);
      return recalcularSerie(projectId);
    },
  );

  // Generar (o regenerar) el PDF de un periodo. Crea una emisión versionada.
  app.post(
    "/reportes-fv/generadores/:projectId/emitir",
    { preHandler: authorize(EXP, Action.CREATE) },
    async (request, reply) => {
      const { projectId } = z.object({ projectId: z.string() }).parse(request.params);
      const { periodo } = z.object({ periodo: periodoSchema }).parse(request.body);
      const resultado = await generarEmision(projectId, periodo, request.user!.id);
      return reply.code(201).send(resultado);
    },
  );

  // Servir el PDF de una emisión (preview inline o descarga).
  app.get(
    "/reportes-fv/emisiones/:emisionId/pdf",
    { preHandler: authorize(EXP, Action.VIEW) },
    async (request, reply) => {
      const { emisionId } = z.object({ emisionId: z.string() }).parse(request.params);
      const { download } = z.object({ download: z.coerce.boolean().optional() }).parse(request.query);

      const emision = await prisma.reporteFvEmision.findUnique({
        where: { id: emisionId },
        select: {
          fileAttachment: { select: { url: true, filename: true } },
          project: { select: { clientName: true } },
          periodo: true,
        },
      });
      if (!emision) throw notFound("EMISION_NO_ENCONTRADA", "La emisión no existe");

      const nombre = `reporte-${emision.project.clientName}-${emision.periodo.toISOString().slice(0, 7)}.pdf`;
      reply.header("Content-Type", "application/pdf");
      reply.header("Content-Disposition", contentDisposition(download ? "attachment" : "inline", nombre));

      // Si el archivo está en storage, se sirve por stream; si no, se regenera
      // desde el snapshot congelado (resiliencia).
      const url = emision.fileAttachment?.url;
      if (url) {
        const absolutePath = getStoredFilePath(url);
        if (fs.existsSync(absolutePath)) return reply.send(fs.createReadStream(absolutePath));
      }
      return reply.send(await regenerarPdfDesdeSnapshot(emisionId));
    },
  );

  // ─── Envío al cliente ────────────────────────────────────────────────────────
  // COMPLETE = aprobar y enviar: la acción irreversible del módulo.

  // Enviar una emisión (o dry-run: simula sin mandar).
  app.post(
    "/reportes-fv/emisiones/:emisionId/enviar",
    { preHandler: authorize(EXP, Action.COMPLETE) },
    async (request) => {
      const { emisionId } = z.object({ emisionId: z.string() }).parse(request.params);
      const { dryRun } = z.object({ dryRun: z.boolean().optional() }).parse(request.body ?? {});
      return enviarEmision(emisionId, { dryRun, userId: request.user!.id });
    },
  );

  // Enviar en lote las emisiones LISTO de un periodo (o un subconjunto).
  app.post(
    "/reportes-fv/envios/lote",
    { preHandler: authorize(EXP, Action.COMPLETE) },
    async (request) => {
      const { periodo, projectIds, dryRun } = z
        .object({
          periodo: periodoSchema,
          projectIds: z.array(z.string()).optional(),
          dryRun: z.boolean().optional(),
        })
        .parse(request.body);
      return enviarLote(periodo, { projectIds, dryRun, userId: request.user!.id });
    },
  );
}

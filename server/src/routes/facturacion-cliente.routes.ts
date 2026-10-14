// Emisión de facturas y notas de crédito a clientes por Biller. Prefijo /api.
//
// Todo bajo FINANZAS: ver con VIEW, emitir con EDIT. Emitir exige
// `confirmado: true` con el borrador exacto que se vio en pantalla: nada llega a
// DGI sin que una persona lo confirme (regla del 30-sep-2026).

import { Action, Module } from "@prisma/client";
import fs from "node:fs";
import type { FastifyInstance, FastifyRequest } from "fastify";
import { z } from "zod";

import { authenticate } from "../middleware/auth.middleware.js";
import { authorize } from "../middleware/authorize.middleware.js";
import {
  actualizarEstadoDgi,
  armarBorradorFactura,
  armarBorradorNotaCredito,
  borradorSchema,
  cfesDelProyecto,
  cuerpoBiller,
  datosRutDgi,
  emitirCfe,
  estadoEmision,
  guardarPdf,
  totalesBorrador,
  validarBorrador,
} from "../services/biller/cfe-emitidos.service.js";
import { getStoredFilePath } from "../services/file-storage.service.js";
import { prisma } from "../lib/prisma.js";
import { contentDisposition } from "../utils/content-disposition.js";
import { badRequest, notFound, unauthorized } from "../utils/errors.js";

function ensureUser(request: FastifyRequest) {
  if (!request.user) throw unauthorized("No autenticado");
  return request.user;
}

const ver = { preHandler: [authenticate, authorize(Module.FINANZAS, Action.VIEW)] };
const editar = { preHandler: [authenticate, authorize(Module.FINANZAS, Action.EDIT)] };

const emitirBody = z.object({
  borrador: borradorSchema,
  // Sin esto no se emite: la pantalla lo manda solo desde el paso "Revisar".
  confirmado: z.literal(true),
});

export async function registerFacturacionClienteRoutes(app: FastifyInstance) {
  app.get("/finance/facturacion/:projectId/cfes", ver, async (request) => {
    const { projectId } = z.object({ projectId: z.string() }).parse(request.params);
    return { cfes: await cfesDelProyecto(projectId), emision: estadoEmision() };
  });

  app.get("/finance/facturacion/:projectId/borrador", editar, async (request) => {
    const { projectId } = z.object({ projectId: z.string() }).parse(request.params);
    return armarBorradorFactura(projectId);
  });

  // Revisión previa: valida y devuelve lo que se mandaría a Biller, sin mandarlo.
  app.post("/finance/facturacion/revisar", editar, async (request) => {
    const { borrador } = z.object({ borrador: borradorSchema }).parse(request.body);
    return {
      problemas: validarBorrador(borrador),
      ...totalesBorrador(borrador),
      cuerpo: cuerpoBiller(borrador, "(se asigna al emitir)", null),
    };
  });

  // Razón social y domicilio fiscal de un RUT, para facturar a otra empresa.
  app.get("/finance/facturacion/dgi-rut", editar, async (request) => {
    const { rut } = z.object({ rut: z.string().regex(/^\d{12}$/, "El RUT tiene 12 dígitos") }).parse(request.query);
    const datos = await datosRutDgi(rut);
    if (!datos) throw notFound("RUT_NO_ENCONTRADO", "DGI no tiene datos para ese RUT");
    return datos;
  });

  app.post("/finance/facturacion/:projectId/emitir", editar, async (request, reply) => {
    const user = ensureUser(request);
    const { projectId } = z.object({ projectId: z.string() }).parse(request.params);
    const body = emitirBody.parse(request.body);
    if (body.borrador.tipoCfe !== 101 && body.borrador.tipoCfe !== 111) {
      throw badRequest("TIPO_INVALIDO", "Acá se emiten facturas; la nota de crédito va desde la factura");
    }
    const cfe = await emitirCfe({ projectId, borrador: body.borrador, userId: user.id });
    reply.code(201);
    return { cfe };
  });

  app.get("/finance/cfe/:id/borrador-nota-credito", editar, async (request) => {
    const { id } = z.object({ id: z.string() }).parse(request.params);
    const { monto } = z.object({ monto: z.coerce.number().positive().optional() }).parse(request.query);
    return armarBorradorNotaCredito(id, { monto: monto ?? null });
  });

  app.post("/finance/cfe/:id/nota-credito", editar, async (request, reply) => {
    const user = ensureUser(request);
    const { id } = z.object({ id: z.string() }).parse(request.params);
    const body = emitirBody.parse(request.body);
    const factura = await prisma.cfeEmitido.findUnique({ where: { id } });
    if (!factura) throw notFound("CFE_NOT_FOUND", "Factura no encontrada");
    const cfe = await emitirCfe({
      projectId: factura.projectId,
      borrador: body.borrador,
      referenciaId: factura.id,
      userId: user.id,
    });
    reply.code(201);
    return { cfe };
  });

  // Consultar el estado ante DGI ahora, sin esperar al job.
  app.post("/finance/cfe/:id/actualizar", ver, async (request) => {
    const { id } = z.object({ id: z.string() }).parse(request.params);
    return { cfe: await actualizarEstadoDgi(id) };
  });

  app.get("/finance/cfe/:id/pdf", ver, async (request, reply) => {
    const { id } = z.object({ id: z.string() }).parse(request.params);
    const { descargar } = z.object({ descargar: z.coerce.boolean().optional() }).parse(request.query);
    const archivo = await guardarPdf(id);
    if (!archivo) throw notFound("PDF_NO_DISPONIBLE", "Biller todavía no tiene el PDF de este comprobante");
    const ruta = getStoredFilePath(archivo.url);
    if (!fs.existsSync(ruta)) throw notFound("FILE_NOT_FOUND", "El PDF no está en el storage");
    reply.header("Content-Type", "application/pdf");
    reply.header("Content-Disposition", contentDisposition(descargar ? "attachment" : "inline", archivo.filename));
    return reply.send(fs.createReadStream(ruta));
  });
}

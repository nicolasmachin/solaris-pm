/**
 * Cotizaciones a medida y artículos de venta (services/cotizaciones/).
 * Permisos del módulo VENTAS: VIEW para ver y bajar el PDF, CREATE para crear y
 * duplicar, EDIT para editar, cambiar el estado y gestionar los artículos de
 * venta, DELETE para borrar.
 */

import { Action, CotizacionEstado, Module } from "@prisma/client";
import type { FastifyInstance, FastifyRequest } from "fastify";
import { z } from "zod";

import { authenticate } from "../middleware/auth.middleware.js";
import { authorize } from "../middleware/authorize.middleware.js";
import { prisma } from "../lib/prisma.js";
import { articuloBody, contenidoSchema, cotizacionBody, estadoBody } from "../services/cotizaciones/cotizaciones.schema.js";
import {
  borrarCotizacion,
  buscarDestinatarios,
  cambiarEstado,
  contenidoDe,
  crearCotizacion,
  datosPdf,
  duplicarCotizacion,
  editarCotizacion,
  fichaCotizacion,
  listarArticulos,
  listarCotizaciones,
} from "../services/cotizaciones/cotizaciones.service.js";
import { generarCotizacionPdf, nombreArchivo } from "../services/cotizaciones/pdf.js";
import { contentDisposition } from "../utils/content-disposition.js";
import { notFound, unauthorized } from "../utils/errors.js";

function ensureUser(request: FastifyRequest) {
  if (!request.user) throw unauthorized("No autenticado");
  return request.user;
}

const idParam = z.object({ id: z.string().min(1) });

export async function registerCotizacionesRoutes(app: FastifyInstance) {
  app.addHook("preHandler", authenticate);
  const ver = { preHandler: authorize(Module.VENTAS, Action.VIEW) };
  const crear = { preHandler: authorize(Module.VENTAS, Action.CREATE) };
  const editar = { preHandler: authorize(Module.VENTAS, Action.EDIT) };
  const borrar = { preHandler: authorize(Module.VENTAS, Action.DELETE) };

  app.get("/cotizaciones", ver, async (request) => {
    const f = z.object({ q: z.string().max(100).optional(), estado: z.nativeEnum(CotizacionEstado).optional() }).parse(request.query);
    return listarCotizaciones(f);
  });
  app.get("/cotizaciones/destinatarios", ver, async (request) => {
    const { q } = z.object({ q: z.string().max(100).default("") }).parse(request.query);
    return buscarDestinatarios(q);
  });
  app.get("/cotizaciones/:id", ver, async (request) => {
    const c = await fichaCotizacion(idParam.parse(request.params).id);
    return { ...c, contenido: contenidoDe(c) };
  });
  app.post("/cotizaciones", crear, async (request, reply) => {
    const c = await crearCotizacion(cotizacionBody.parse(request.body), ensureUser(request).id);
    reply.code(201);
    return c;
  });
  app.put("/cotizaciones/:id", editar, async (request) =>
    editarCotizacion(idParam.parse(request.params).id, cotizacionBody.parse(request.body), ensureUser(request).id),
  );
  app.patch("/cotizaciones/:id/estado", editar, async (request) =>
    cambiarEstado(idParam.parse(request.params).id, estadoBody.parse(request.body).estado, ensureUser(request).id),
  );
  app.post("/cotizaciones/:id/duplicar", crear, async (request, reply) => {
    const c = await duplicarCotizacion(idParam.parse(request.params).id, ensureUser(request).id);
    reply.code(201);
    return c;
  });
  app.delete("/cotizaciones/:id", borrar, async (request, reply) => {
    await borrarCotizacion(idParam.parse(request.params).id, ensureUser(request).id);
    reply.code(204);
  });

  // PDF de una cotización guardada.
  app.get("/cotizaciones/:id/pdf", ver, async (request, reply) => {
    const { download } = z.object({ download: z.string().optional() }).parse(request.query);
    const c = await fichaCotizacion(idParam.parse(request.params).id);
    const pdf = await generarCotizacionPdf(await datosPdf(contenidoDe(c), c.numero));
    reply
      .header("Content-Type", "application/pdf")
      .header("Content-Disposition", contentDisposition(download ? "attachment" : "inline", nombreArchivo(c.numero, c.clienteNombre)));
    return reply.send(pdf);
  });

  // Vista previa de lo que está en pantalla, sin guardar.
  app.post("/cotizaciones/vista-previa", ver, async (request, reply) => {
    const body = contenidoSchema.extend({ numero: z.string().nullable().optional() }).parse(request.body);
    const pdf = await generarCotizacionPdf(await datosPdf(body, body.numero ?? null));
    reply.header("Content-Type", "application/pdf");
    return reply.send(pdf);
  });

  // ─── Artículos de venta ───
  app.get("/articulos-venta", ver, async (request) => {
    const { todos } = z.object({ todos: z.string().optional() }).parse(request.query);
    return listarArticulos(todos === "true");
  });
  app.post("/articulos-venta", editar, async (request, reply) => {
    const a = await prisma.articuloVenta.create({ data: articuloBody.parse(request.body) });
    reply.code(201);
    return a;
  });
  app.put("/articulos-venta/:id", editar, async (request) => {
    const { id } = idParam.parse(request.params);
    const existe = await prisma.articuloVenta.findUnique({ where: { id }, select: { id: true } });
    if (!existe) throw notFound("ARTICULO_NO_ENCONTRADO", "El artículo no existe.");
    return prisma.articuloVenta.update({ where: { id }, data: articuloBody.parse(request.body) });
  });
}

/**
 * CRM de Ventas: Contactos y Empresas (services/crm/contactos.service.ts).
 * Permisos del módulo VENTAS: VIEW para ver, CREATE para dar de alta, EDIT para
 * editar y vincular, DELETE para borrar. Cambiar el contacto de un proyecto pide
 * EDIT en alguno de los módulos del pipeline del proyecto.
 */

import { Action, Module } from "@prisma/client";
import type { FastifyInstance, FastifyRequest } from "fastify";
import { z } from "zod";

import { authenticate } from "../middleware/auth.middleware.js";
import { authorize, authorizeAny } from "../middleware/authorize.middleware.js";
import { prisma } from "../lib/prisma.js";
import { authorizeProjectEditAnyPipeline } from "../middleware/authorize-by-stage.middleware.js";
import {
  borrarContacto,
  cambiarVinculo,
  borrarEmpresa,
  crearContacto,
  crearEmpresa,
  desvincular,
  editarContacto,
  editarEmpresa,
  fichaContacto,
  fichaEmpresa,
  listarContactos,
  listarEmpresas,
  vincular,
} from "../services/crm/contactos.service.js";
import { unauthorized } from "../utils/errors.js";

function ensureUser(request: FastifyRequest) {
  if (!request.user) throw unauthorized("No autenticado");
  return request.user;
}

const texto = (max: number) => z.string().max(max).nullable().optional();
const contactoBody = z.object({
  nombre: z.string().min(1).max(120),
  telefono: texto(40),
  email: texto(160),
  documento: texto(30),
  notas: texto(2000),
});
const empresaBody = z.object({
  razonSocial: z.string().min(1).max(160),
  nombreFantasia: texto(160),
  rut: texto(20),
  telefono: texto(40),
  email: texto(160),
  direccion: texto(240),
  notas: texto(2000),
});
const idParam = z.object({ id: z.string().min(1) });

export async function registerCrmRoutes(app: FastifyInstance) {
  app.addHook("preHandler", authenticate);
  const ver = { preHandler: authorize(Module.VENTAS, Action.VIEW) };
  const crear = { preHandler: authorize(Module.VENTAS, Action.CREATE) };
  const editar = { preHandler: authorize(Module.VENTAS, Action.EDIT) };
  const borrar = { preHandler: authorize(Module.VENTAS, Action.DELETE) };

  // Buscar y crear contactos también se usa desde la bandeja de WhatsApp de
  // Experiencia Solar (asociar un chat, crear el contacto desde el chat).
  const verDesdeChat = { preHandler: authorizeAny([{ module: Module.VENTAS, action: Action.VIEW }, { module: Module.EXPERIENCIA_CLIENTES, action: Action.VIEW }]) };
  const crearDesdeChat = { preHandler: authorizeAny([{ module: Module.VENTAS, action: Action.CREATE }, { module: Module.EXPERIENCIA_CLIENTES, action: Action.CREATE }]) };

  // ─── Usuarios de Voltia (para asociar un chat interno) ───
  app.get("/crm/usuarios", verDesdeChat, async (request) => {
    const { q } = z.object({ q: z.string().max(100).optional() }).parse(request.query);
    const texto = q?.trim();
    const usuarios = await prisma.user.findMany({
      where: { deletedAt: null, ...(texto ? { name: { contains: texto, mode: "insensitive" as const } } : {}) },
      select: { id: true, name: true, phone: true, role: { select: { label: true, name: true } } },
      orderBy: { name: "asc" },
      take: 20,
    });
    return usuarios.filter((u) => u.role.name !== "CLIENT").map((u) => ({ id: u.id, nombre: u.name, telefono: u.phone, rol: u.role.label }));
  });

  // ─── Contactos ───
  app.get("/crm/contactos", verDesdeChat, async (request) => {
    const { q } = z.object({ q: z.string().max(100).optional() }).parse(request.query);
    return listarContactos(q);
  });
  app.get("/crm/contactos/:id", ver, async (request) => fichaContacto(idParam.parse(request.params).id));
  app.post("/crm/contactos", crearDesdeChat, async (request, reply) => {
    const c = await crearContacto(contactoBody.parse(request.body), ensureUser(request).id);
    reply.code(201);
    return c;
  });
  app.patch("/crm/contactos/:id", editar, async (request) =>
    editarContacto(idParam.parse(request.params).id, contactoBody.partial().parse(request.body), ensureUser(request).id),
  );
  app.delete("/crm/contactos/:id", borrar, async (request, reply) => {
    await borrarContacto(idParam.parse(request.params).id, ensureUser(request).id);
    reply.code(204);
  });

  // ─── Empresas ───
  app.get("/crm/empresas", ver, async (request) => {
    const { q } = z.object({ q: z.string().max(100).optional() }).parse(request.query);
    return listarEmpresas(q);
  });
  app.get("/crm/empresas/:id", ver, async (request) => fichaEmpresa(idParam.parse(request.params).id));
  app.post("/crm/empresas", crear, async (request, reply) => {
    const e = await crearEmpresa(empresaBody.parse(request.body), ensureUser(request).id);
    reply.code(201);
    return e;
  });
  app.patch("/crm/empresas/:id", editar, async (request) =>
    editarEmpresa(idParam.parse(request.params).id, empresaBody.partial().parse(request.body), ensureUser(request).id),
  );
  app.delete("/crm/empresas/:id", borrar, async (request, reply) => {
    await borrarEmpresa(idParam.parse(request.params).id, ensureUser(request).id);
    reply.code(204);
  });

  // ─── Vínculo ───
  app.put("/crm/empresas/:id/contactos/:contactoId", editar, async (request, reply) => {
    const { id, contactoId } = z.object({ id: z.string().min(1), contactoId: z.string().min(1) }).parse(request.params);
    const body = z.object({ cargo: texto(80), principal: z.boolean().optional() }).parse(request.body ?? {});
    await vincular(id, contactoId, body, ensureUser(request).id);
    reply.code(204);
  });
  app.delete("/crm/empresas/:id/contactos/:contactoId", editar, async (request, reply) => {
    const { id, contactoId } = z.object({ id: z.string().min(1), contactoId: z.string().min(1) }).parse(request.params);
    await desvincular(id, contactoId, ensureUser(request).id);
    reply.code(204);
  });

  // ─── Contacto y empresa de un lead o un proyecto ───
  const vinculoBody = z.object({ contactoId: z.string().min(1).nullable().optional(), empresaId: z.string().min(1).nullable().optional() });
  app.put("/crm/leads/:id/vinculo", editar, async (request, reply) => {
    await cambiarVinculo({ leadId: idParam.parse(request.params).id }, vinculoBody.parse(request.body), ensureUser(request).id);
    reply.code(204);
  });
  app.put("/crm/proyectos/:id/vinculo", { preHandler: authorizeProjectEditAnyPipeline(Action.EDIT) }, async (request, reply) => {
    await cambiarVinculo({ projectId: idParam.parse(request.params).id }, vinculoBody.parse(request.body), ensureUser(request).id);
    reply.code(204);
  });
}

// Endpoints del módulo Experiencia de Clientes (Ola 1 / MVP).
//   - VIEW   (POSTVENTA, ADMIN, ASESOR_COMERCIAL): listado, ficha, export, bitácora
//   - CREATE (POSTVENTA, ADMIN, ASESOR_COMERCIAL): registrar interacción
//
// El "cliente" es una proyección sobre `Project` (relación 1:1). Toda la lógica
// vive en services/clientes/. Ver EXPERIENCIA_CLIENTES_SPEC.md.

import { Action, AuditAction, AuditEntityType, InteractionChannel, Module } from "@prisma/client";
import type { FastifyInstance, FastifyRequest } from "fastify";
import { z } from "zod";

import { authenticate } from "../middleware/auth.middleware.js";
import { authorize } from "../middleware/authorize.middleware.js";
import { createAuditEntry } from "../services/audit.service.js";
import {
  buildClientesCsv,
  canModifyInteraction,
  createInteraction,
  getActiveInteraction,
  getClienteFicha,
  getClienteTimeline,
  getClienteListItem,
  listClientes,
  listClientesForExport,
  listInteractions,
  projectExists,
  softDeleteInteraction,
  updateInteraction,
  type ClienteFiltros,
} from "../services/clientes/index.js";
import { updateProjectClientFields } from "../services/project-fields.service.js";
import { forbidden, notFound, unauthorized } from "../utils/errors.js";
import { clientEmailValue, clientPhoneValue, dateOnlyValue } from "../validators/projectFields.js";

function ensureUser(request: FastifyRequest) {
  if (!request.user) throw unauthorized("No autenticado");
  return request.user;
}

// Ownership compartido por PATCH y DELETE de interacciones: el autor puede tocar
// la suya; ADMIN puede tocar cualquiera. Caso contrario, 403.
function ensureCanModifyInteraction(user: { id: string; role: string }, authorId: string) {
  if (!canModifyInteraction(user, authorId)) {
    throw forbidden("No podés modificar una interacción de otro usuario");
  }
}

// Filtros compartidos por listado y export. `etapa` = recorrido del cliente
// (E1/E2/E3); `estado` cubre los 4 estados derivados de ProjectStatus.
const filtersSchema = z.object({
  search: z.string().trim().min(1).optional(),
  estado: z.enum(["ACTIVO", "FINALIZADO", "ARCHIVADO", "PROSPECTO"]).optional(),
  asesorId: z.string().min(1).optional(),
  departamento: z.string().min(1).optional(),
  etapa: z.enum(["E1", "E2", "E3"]).optional(),
  sortBy: z.enum(["nombre", "fechaEntrega", "potenciaKwp", "etapa"]).optional(),
  sortDir: z.enum(["asc", "desc"]).optional(),
});

const listQuerySchema = filtersSchema.extend({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(200).default(50),
});

function toFiltros(q: z.infer<typeof filtersSchema>): ClienteFiltros {
  return {
    search: q.search,
    estado: q.estado,
    asesorId: q.asesorId,
    departamento: q.departamento,
    etapa: q.etapa,
    sortBy: q.sortBy,
    sortDir: q.sortDir,
  };
}

// Edición inline desde el listado: SOLO mail / teléfono / fecha de entrega.
// .strict() → cualquier otro campo en el body es un error de validación. Los
// valores reusan los validadores compartidos con el módulo Proyectos.
const patchClienteBodySchema = z
  .object({
    mail: clientEmailValue.nullable().optional(),
    telefono: clientPhoneValue.nullable().optional(),
    fechaEntrega: dateOnlyValue.nullable().optional(),
  })
  .strict();

export async function registerClientesRoutes(app: FastifyInstance) {
  app.addHook("preHandler", authenticate);

  // ─── Listado filtrable + paginado ────────────────────────────────────────
  app.get(
    "/clientes",
    { preHandler: authorize(Module.EXPERIENCIA_CLIENTES, Action.VIEW) },
    async (request) => {
      const q = listQuerySchema.parse(request.query);
      return listClientes(toFiltros(q), q.page, q.pageSize);
    },
  );

  // ─── Export CSV (respeta filtros, sin paginación) ────────────────────────
  // Registrada antes de /clientes/:projectId — Fastify igual prioriza la ruta
  // estática, pero lo dejamos explícito.
  app.get(
    "/clientes/export",
    { preHandler: authorize(Module.EXPERIENCIA_CLIENTES, Action.VIEW) },
    async (request, reply) => {
      const q = filtersSchema.parse(request.query);
      const items = await listClientesForExport(toFiltros(q));
      const csv = buildClientesCsv(items);
      const fecha = new Date().toISOString().slice(0, 10);
      reply
        .header("Content-Type", "text/csv; charset=utf-8")
        .header("Content-Disposition", `attachment; filename="clientes_voltia_${fecha}.csv"`);
      return reply.send(csv);
    },
  );

  // ─── Ficha 360 ───────────────────────────────────────────────────────────
  app.get(
    "/clientes/:projectId",
    { preHandler: authorize(Module.EXPERIENCIA_CLIENTES, Action.VIEW) },
    async (request) => {
      const { projectId } = z.object({ projectId: z.string().min(1) }).parse(request.params);
      const ficha = await getClienteFicha(projectId);
      if (!ficha) throw notFound("CLIENTE_NOT_FOUND", "Cliente no encontrado");
      return ficha;
    },
  );

  // ─── Timeline unificado (Ventas + Proyecto + Cliente), solo lectura ───────
  app.get(
    "/clientes/:projectId/timeline",
    { preHandler: authorize(Module.EXPERIENCIA_CLIENTES, Action.VIEW) },
    async (request) => {
      const { projectId } = z.object({ projectId: z.string().min(1) }).parse(request.params);
      return getClienteTimeline(projectId);
    },
  );

  // ─── Edición inline de mail / teléfono / fecha de entrega ─────────────────
  // Escribe el dato canónico en Project (clientEmail / clientPhone /
  // plannedEndDate) reusando validadores y auditoría del módulo Proyectos.
  app.patch(
    "/clientes/:projectId",
    { preHandler: authorize(Module.EXPERIENCIA_CLIENTES, Action.EDIT) },
    async (request) => {
      const user = ensureUser(request);
      const { projectId } = z.object({ projectId: z.string().min(1) }).parse(request.params);
      const body = patchClienteBodySchema.parse(request.body);

      const updated = await updateProjectClientFields(
        projectId,
        { clientEmail: body.mail, clientPhone: body.telefono, plannedEndDate: body.fechaEntrega },
        user.id,
        "experiencia_clientes",
      );
      if (!updated) throw notFound("CLIENTE_NOT_FOUND", "Cliente no encontrado");

      return getClienteListItem(projectId);
    },
  );

  // ─── Bitácora: listar ────────────────────────────────────────────────────
  app.get(
    "/clientes/:projectId/interacciones",
    { preHandler: authorize(Module.EXPERIENCIA_CLIENTES, Action.VIEW) },
    async (request) => {
      const { projectId } = z.object({ projectId: z.string().min(1) }).parse(request.params);
      if (!(await projectExists(projectId))) throw notFound("CLIENTE_NOT_FOUND", "Cliente no encontrado");
      return listInteractions(projectId);
    },
  );

  // ─── Bitácora: registrar interacción ─────────────────────────────────────
  app.post(
    "/clientes/:projectId/interacciones",
    { preHandler: authorize(Module.EXPERIENCIA_CLIENTES, Action.CREATE) },
    async (request, reply) => {
      const user = ensureUser(request);
      const { projectId } = z.object({ projectId: z.string().min(1) }).parse(request.params);
      const body = z
        .object({
          channel: z.nativeEnum(InteractionChannel),
          content: z.string().trim().min(1).max(2000),
        })
        .parse(request.body);

      if (!(await projectExists(projectId))) throw notFound("CLIENTE_NOT_FOUND", "Cliente no encontrado");

      const interaction = await createInteraction(projectId, body.channel, body.content, user.id);

      await createAuditEntry({
        entityType: AuditEntityType.client_interaction,
        entityId: interaction.id,
        projectId,
        userId: user.id,
        action: AuditAction.created,
        description: `Registró una interacción (${body.channel}) en Experiencia de Clientes`,
      });

      reply.code(201);
      return interaction;
    },
  );

  // ─── Bitácora: editar interacción ─────────────────────────────────────────
  app.patch(
    "/clientes/interacciones/:id",
    { preHandler: authorize(Module.EXPERIENCIA_CLIENTES, Action.EDIT) },
    async (request) => {
      const user = ensureUser(request);
      const { id } = z.object({ id: z.string().min(1) }).parse(request.params);
      const body = z
        .object({
          content: z.string().trim().min(1).max(2000),
          channel: z.nativeEnum(InteractionChannel).optional(),
        })
        .parse(request.body);

      const existing = await getActiveInteraction(id);
      if (!existing) throw notFound("INTERACTION_NOT_FOUND", "Interacción no encontrada");
      ensureCanModifyInteraction(user, existing.authorId);

      const updated = await updateInteraction(id, body.content, body.channel);

      await createAuditEntry({
        entityType: AuditEntityType.client_interaction,
        entityId: id,
        projectId: existing.projectId,
        userId: user.id,
        action: AuditAction.updated,
        fieldChanged: "content",
        oldValue: existing.content,
        newValue: body.content,
        description: `Editó una interacción en Experiencia de Clientes`,
      });

      return updated;
    },
  );

  // ─── Bitácora: borrar interacción (soft delete) ───────────────────────────
  app.delete(
    "/clientes/interacciones/:id",
    { preHandler: authorize(Module.EXPERIENCIA_CLIENTES, Action.DELETE) },
    async (request, reply) => {
      const user = ensureUser(request);
      const { id } = z.object({ id: z.string().min(1) }).parse(request.params);

      // Idempotente: si no existe o ya estaba borrada → 404.
      const existing = await getActiveInteraction(id);
      if (!existing) throw notFound("INTERACTION_NOT_FOUND", "Interacción no encontrada");
      ensureCanModifyInteraction(user, existing.authorId);

      await softDeleteInteraction(id, user.id);

      await createAuditEntry({
        entityType: AuditEntityType.client_interaction,
        entityId: id,
        projectId: existing.projectId,
        userId: user.id,
        action: AuditAction.deleted,
        description: `Borró una interacción en Experiencia de Clientes`,
      });

      reply.code(204);
      return null;
    },
  );
}

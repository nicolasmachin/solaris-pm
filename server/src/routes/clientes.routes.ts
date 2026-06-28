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
  createInteraction,
  getClienteFicha,
  listClientes,
  listClientesForExport,
  listInteractions,
  projectExists,
  type ClienteFiltros,
} from "../services/clientes/index.js";
import { notFound, unauthorized } from "../utils/errors.js";

function ensureUser(request: FastifyRequest) {
  if (!request.user) throw unauthorized("No autenticado");
  return request.user;
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
}

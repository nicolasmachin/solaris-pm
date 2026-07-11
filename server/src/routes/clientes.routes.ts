// Endpoints del módulo Experiencia de Clientes (Ola 1 / MVP).
//   - VIEW   (POSTVENTA, ADMIN, ASESOR_COMERCIAL): listado, ficha, export, bitácora
//   - CREATE (POSTVENTA, ADMIN, ASESOR_COMERCIAL): registrar interacción
//
// El "cliente" es una proyección sobre `Project` (relación 1:1). Toda la lógica
// vive en services/clientes/. Ver EXPERIENCIA_CLIENTES_SPEC.md.

import { Action, AuditAction, AuditEntityType, InteractionChannel, InteractionDirection, InteractionReason, Module, ProjectStatus } from "@prisma/client";
import type { FastifyInstance, FastifyRequest } from "fastify";
import { z } from "zod";

import { prisma } from "../lib/prisma.js";
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
import { confirmImport, previewImport } from "../services/clientes/import.service.js";
import { badRequest, forbidden, notFound, unauthorized } from "../utils/errors.js";
import {
  addressValue,
  capacityValue,
  clienteEstadoValue,
  clientEmailValue,
  clientNameValue,
  clientPhoneValue,
  dateOnlyValue,
  provinceValue,
} from "../validators/projectFields.js";

// El "estado" del CRM mapea a ProjectStatus (ACTIVO cubre ACTIVE/PAUSED: al
// setearlo se escribe ACTIVE).
const ESTADO_TO_STATUS: Record<"ACTIVO" | "FINALIZADO" | "ARCHIVADO" | "PROSPECTO", ProjectStatus> = {
  ACTIVO: ProjectStatus.ACTIVE,
  FINALIZADO: ProjectStatus.COMPLETED,
  ARCHIVADO: ProjectStatus.ARCHIVED,
  PROSPECTO: ProjectStatus.PROSPECT,
};

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
    nombre: clientNameValue.optional(),
    departamento: provinceValue.optional(),
    potencia: capacityValue.optional(),
    asesor: z.string().min(1).nullable().optional(),
    estado: clienteEstadoValue.optional(),
    direccion: addressValue.nullable().optional(),
    fechaVenta: dateOnlyValue.nullable().optional(),
    etapa: z.enum(["E1", "E2", "E3"]).nullable().optional(),
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

  // ─── Importación desde CSV (registros livianos, sin pipeline) ────────────
  app.post(
    "/clientes/import/preview",
    { preHandler: authorize(Module.EXPERIENCIA_CLIENTES, Action.CREATE) },
    async (request) => {
      const parts = request.parts();
      let text: string | null = null;
      for await (const part of parts) {
        if (part.type === "file") {
          const buf = await part.toBuffer();
          text = buf.toString("utf-8");
          break;
        }
      }
      if (text === null) throw badRequest("NO_FILE", "Subí un archivo CSV");
      const result = await previewImport(text);
      if ("error" in result) throw badRequest("CSV_PARSE_ERROR", result.error ?? "CSV inválido");
      return result;
    },
  );

  const importConfirmSchema = z.object({
    rows: z
      .array(
        z.object({
          nombre: z.string().min(1),
          mail: z.string().nullable().optional(),
          telefono: z.string().nullable().optional(),
          departamento: z.string().nullable().optional(),
          potenciaKwp: z.number().nullable().optional(),
          status: z.nativeEnum(ProjectStatus).optional(),
          fechaEntrega: z.string().nullable().optional(),
          asesorId: z.string().nullable().optional(),
        }),
      )
      .min(1)
      .max(2000),
  });

  app.post(
    "/clientes/import/confirm",
    { preHandler: authorize(Module.EXPERIENCIA_CLIENTES, Action.CREATE) },
    async (request) => {
      const user = ensureUser(request);
      const body = importConfirmSchema.parse(request.body);
      return confirmImport(body.rows, user.id);
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

      // Validar que el asesor exista (si se está asignando uno).
      if (body.asesor) {
        const asesor = await prisma.user.findFirst({
          where: { id: body.asesor, deletedAt: null },
          select: { id: true },
        });
        if (!asesor) throw badRequest("ASESOR_NOT_FOUND", "El asesor seleccionado no existe");
      }

      const updated = await updateProjectClientFields(
        projectId,
        {
          clientEmail: body.mail,
          clientPhone: body.telefono,
          plannedEndDate: body.fechaEntrega,
          clientName: body.nombre,
          locationProvince: body.departamento,
          capacityKwp: body.potencia,
          salespersonId: body.asesor,
          status: body.estado ? ESTADO_TO_STATUS[body.estado] : undefined,
          clientAddress: body.direccion,
          saleDate: body.fechaVenta,
          recorridoManual: body.etapa,
        },
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
          direction: z.nativeEnum(InteractionDirection).optional(),
          reason: z.nativeEnum(InteractionReason).optional(),
        })
        .parse(request.body);

      if (!(await projectExists(projectId))) throw notFound("CLIENTE_NOT_FOUND", "Cliente no encontrado");

      const interaction = await createInteraction(projectId, body.channel, body.content, user.id, {
        direction: body.direction,
        reason: body.reason,
      });

      await createAuditEntry({
        entityType: AuditEntityType.client_interaction,
        entityId: interaction.id,
        projectId,
        userId: user.id,
        action: AuditAction.created,
        description: `Registró una interacción (${body.channel}) en Experiencia Solar`,
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
        description: `Editó una interacción en Experiencia Solar`,
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
        description: `Borró una interacción en Experiencia Solar`,
      });

      reply.code(204);
      return null;
    },
  );
}

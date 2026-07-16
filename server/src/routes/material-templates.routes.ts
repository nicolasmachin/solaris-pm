// Plantillas de lista de materiales: ABM del catálogo maestro de plantillas
// (set reutilizable de ítems por tipo de instalación). La aplicación de una
// plantilla sobre la lista de un proyecto vive en api.routes.ts
// (POST /projects/:id/materials/apply-template), porque reutiliza los helpers
// de la lista por proyecto.
//
// Autorización: ver = INGENIERIA.VIEW (lo consume la herramienta al aplicar);
// administrar = CONFIGURACION (mismo criterio que las categorías de material).

import { Action, Module, PhaseType, Prisma } from "@prisma/client";
import type { FastifyInstance } from "fastify";
import { z } from "zod";

import { prisma } from "../lib/prisma.js";
import { authenticate } from "../middleware/auth.middleware.js";
import { authorize, authorizeAny } from "../middleware/authorize.middleware.js";
import { badRequest, conflict, notFound } from "../utils/errors.js";
import { serializeDate } from "../utils/serialization.js";

interface TemplateItemRow {
  id: string;
  materialItemId: string;
  quantity: import("@prisma/client/runtime/library").Decimal;
  orden: number;
  materialItem?: {
    id: string;
    nombre: string;
    unidad: string;
    activo: boolean;
    category: { id: string; nombre: string; orden: number };
  } | null;
}

interface TemplateRow {
  id: string;
  nombre: string;
  descripcion: string | null;
  phaseType: PhaseType | null;
  orden: number;
  activa: boolean;
  createdAt: Date;
  updatedAt: Date;
  items?: TemplateItemRow[];
}

function serializeTemplate(t: TemplateRow) {
  return {
    id: t.id,
    nombre: t.nombre,
    descripcion: t.descripcion,
    phaseType: t.phaseType,
    orden: t.orden,
    activa: t.activa,
    itemCount: t.items?.length ?? 0,
    items: (t.items ?? []).map((it) => ({
      id: it.id,
      materialItemId: it.materialItemId,
      quantity: Number(it.quantity),
      orden: it.orden,
      ...(it.materialItem
        ? {
            materialItem: {
              id: it.materialItem.id,
              nombre: it.materialItem.nombre,
              unidad: it.materialItem.unidad,
              activo: it.materialItem.activo,
              category: it.materialItem.category,
            },
          }
        : {}),
    })),
    createdAt: serializeDate(t.createdAt),
    updatedAt: serializeDate(t.updatedAt),
  };
}

const templateInclude = {
  items: {
    orderBy: { orden: "asc" },
    include: {
      materialItem: {
        select: {
          id: true,
          nombre: true,
          unidad: true,
          activo: true,
          category: { select: { id: true, nombre: true, orden: true } },
        },
      },
    },
  },
} satisfies Prisma.MaterialTemplateInclude;

const templateCreateSchema = z
  .object({
    nombre: z.string().min(1),
    descripcion: z.string().nullable().optional(),
    phaseType: z.nativeEnum(PhaseType).nullable().optional(),
    orden: z.coerce.number().int().optional(),
    activa: z.boolean().optional(),
  })
  .strict();

const templatePatchSchema = z
  .object({
    nombre: z.string().min(1).optional(),
    descripcion: z.string().nullable().optional(),
    phaseType: z.nativeEnum(PhaseType).nullable().optional(),
    orden: z.coerce.number().int().optional(),
    activa: z.boolean().optional(),
  })
  .strict();

const templateItemsSchema = z
  .object({
    items: z
      .array(
        z
          .object({
            materialItemId: z.string(),
            quantity: z.coerce.number().positive().optional(),
            orden: z.coerce.number().int().optional(),
          })
          .strict(),
      )
      .max(500),
  })
  .strict();

export async function registerMaterialTemplatesRoutes(app: FastifyInstance) {
  app.addHook("preHandler", authenticate);

  // Listado (con ítems) — lo usa tanto el modal de "Usar plantilla" como el admin.
  // Colaborativo Ingeniería + Operaciones, igual que la lista de materiales.
  app.get(
    "/material-templates",
    {
      preHandler: authorizeAny([
        { module: Module.INGENIERIA, action: Action.VIEW },
        { module: Module.OPERACIONES, action: Action.VIEW },
      ]),
    },
    async (request) => {
      const query = z
        .object({ activa: z.enum(["true", "false", "all"]).optional() })
        .parse(request.query);
      const where: { activa?: boolean } = {};
      if (query.activa !== "all") where.activa = query.activa === "false" ? false : true;
      const templates = await prisma.materialTemplate.findMany({
        where,
        include: templateInclude,
        orderBy: [{ orden: "asc" }, { nombre: "asc" }],
      });
      return templates.map(serializeTemplate);
    },
  );

  app.post(
    "/material-templates",
    { preHandler: authorize(Module.CONFIGURACION, Action.CREATE) },
    async (request) => {
      const body = templateCreateSchema.parse(request.body);
      const dup = await prisma.materialTemplate.findUnique({ where: { nombre: body.nombre } });
      if (dup) throw conflict("TEMPLATE_NAME_EXISTS", "Ya existe una plantilla con ese nombre");
      const last = await prisma.materialTemplate.findFirst({ orderBy: { orden: "desc" } });
      const orden = body.orden ?? (last?.orden ?? 0) + 1;
      const created = await prisma.materialTemplate.create({
        data: {
          nombre: body.nombre,
          descripcion: body.descripcion ?? null,
          phaseType: body.phaseType ?? null,
          orden,
          activa: body.activa ?? true,
        },
        include: templateInclude,
      });
      return serializeTemplate(created);
    },
  );

  app.patch(
    "/material-templates/:id",
    { preHandler: authorize(Module.CONFIGURACION, Action.EDIT) },
    async (request) => {
      const { id } = z.object({ id: z.string() }).parse(request.params);
      const body = templatePatchSchema.parse(request.body);
      const existing = await prisma.materialTemplate.findUnique({ where: { id } });
      if (!existing) throw notFound("TEMPLATE_NOT_FOUND", "Plantilla no encontrada");
      if (body.nombre && body.nombre !== existing.nombre) {
        const dup = await prisma.materialTemplate.findUnique({ where: { nombre: body.nombre } });
        if (dup) throw conflict("TEMPLATE_NAME_EXISTS", "Ya existe una plantilla con ese nombre");
      }
      const updated = await prisma.materialTemplate.update({
        where: { id },
        data: body,
        include: templateInclude,
      });
      return serializeTemplate(updated);
    },
  );

  app.delete(
    "/material-templates/:id",
    { preHandler: authorize(Module.CONFIGURACION, Action.DELETE) },
    async (request) => {
      const { id } = z.object({ id: z.string() }).parse(request.params);
      const existing = await prisma.materialTemplate.findUnique({
        where: { id },
        include: { _count: { select: { items: true } } },
      });
      if (!existing) throw notFound("TEMPLATE_NOT_FOUND", "Plantilla no encontrada");
      if (existing._count.items > 0) {
        await prisma.materialTemplate.update({ where: { id }, data: { activa: false } });
        return { success: true, deactivated: true };
      }
      await prisma.materialTemplate.delete({ where: { id } });
      return { success: true, deactivated: false };
    },
  );

  // Reemplaza el set completo de líneas de una plantilla.
  app.put(
    "/material-templates/:id/items",
    { preHandler: authorize(Module.CONFIGURACION, Action.EDIT) },
    async (request) => {
      const { id } = z.object({ id: z.string() }).parse(request.params);
      const body = templateItemsSchema.parse(request.body);
      const template = await prisma.materialTemplate.findUnique({ where: { id } });
      if (!template) throw notFound("TEMPLATE_NOT_FOUND", "Plantilla no encontrada");

      // Dedup por materialItemId (respeta el primero que aparece).
      const seen = new Set<string>();
      const deduped = body.items.filter((it) => {
        if (seen.has(it.materialItemId)) return false;
        seen.add(it.materialItemId);
        return true;
      });

      // Validar que todos los ítems existan y estén activos.
      if (deduped.length > 0) {
        const found = await prisma.materialItem.findMany({
          where: { id: { in: deduped.map((i) => i.materialItemId) }, activo: true },
          select: { id: true },
        });
        const foundIds = new Set(found.map((f) => f.id));
        const invalid = deduped.filter((i) => !foundIds.has(i.materialItemId));
        if (invalid.length > 0) {
          throw badRequest(
            "MATERIAL_ITEM_INVALID",
            `Hay ${invalid.length} ítem(s) inexistente(s) o inactivo(s) en la plantilla`,
          );
        }
      }

      await prisma.$transaction(async (tx) => {
        await tx.materialTemplateItem.deleteMany({ where: { templateId: id } });
        if (deduped.length > 0) {
          await tx.materialTemplateItem.createMany({
            data: deduped.map((it, idx) => ({
              templateId: id,
              materialItemId: it.materialItemId,
              quantity: it.quantity ?? 1,
              orden: it.orden ?? idx,
            })),
          });
        }
      });

      const updated = await prisma.materialTemplate.findUnique({
        where: { id },
        include: templateInclude,
      });
      return serializeTemplate(updated as TemplateRow);
    },
  );
}

// Sección "Comercial" de Trámites UTE: lo que se le pide a UTE Comercial y no
// es la habilitación (aumentos, suministros nuevos, provisorios…). Los que se
// mandan con el formulario desde Voltia PM se crean solos al enviar
// (`ute-suministro.routes.ts`); acá se cargan a mano los que se pidieron por
// otro lado y se les sigue el estado.

import {
  Action,
  AuditAction,
  AuditEntityType,
  Module,
  Prisma,
  UteTramiteComercialEstado,
  UteTramiteComercialTipo,
} from "@prisma/client";
import type { FastifyInstance, FastifyRequest } from "fastify";
import { z } from "zod";

import { prisma } from "../lib/prisma.js";
import { authenticate } from "../middleware/auth.middleware.js";
import { authorize } from "../middleware/authorize.middleware.js";
import { createAuditEntriesForChanges, createAuditEntry } from "../services/audit.service.js";
import { ESTADO_LABEL, TIPO_LABEL, hoyComoDia } from "../services/ute-comercial.service.js";
import { badRequest, notFound, unauthorized } from "../utils/errors.js";

function ensureUser(request: FastifyRequest) {
  if (!request.user) throw unauthorized("No autenticado");
  return request.user;
}

const dia = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/)
  .transform((v) => new Date(`${v}T00:00:00.000Z`));
const textoOpcional = z
  .string()
  .trim()
  .max(5000)
  .nullable()
  .optional()
  .transform((v) => (v === undefined ? undefined : v || null));

const createSchema = z
  .object({
    projectId: z.string().min(1),
    suministro: z.number().int().min(1).max(20).optional(),
    tipo: z.nativeEnum(UteTramiteComercialTipo),
    detalle: textoOpcional,
    estado: z.nativeEnum(UteTramiteComercialEstado).optional(),
    caseNumber: textoOpcional,
    notes: textoOpcional,
    solicitadoEl: dia.nullable().optional(),
  })
  .strict();

const patchSchema = z
  .object({
    suministro: z.number().int().min(1).max(20).optional(),
    tipo: z.nativeEnum(UteTramiteComercialTipo).optional(),
    detalle: textoOpcional,
    estado: z.nativeEnum(UteTramiteComercialEstado).optional(),
    caseNumber: textoOpcional,
    notes: textoOpcional,
    solicitadoEl: dia.nullable().optional(),
    resueltoEl: dia.nullable().optional(),
  })
  .strict();

const include = {
  project: { select: { id: true, code: true, clientName: true, locationCity: true } },
} satisfies Prisma.UteTramiteComercialInclude;

type Fila = Prisma.UteTramiteComercialGetPayload<{ include: typeof include }>;

// Días que lleva (o llevó) con UTE: desde el pedido hasta hoy, o hasta que se
// resolvió. Sin fecha de pedido no hay cuenta.
function serializar(t: Fila) {
  const hasta = t.resueltoEl ?? hoyComoDia();
  const dias = t.solicitadoEl
    ? Math.max(0, Math.round((hasta.getTime() - t.solicitadoEl.getTime()) / 86_400_000))
    : null;
  return { ...t, dias };
}

const LABELS: Record<string, string> = {
  suministro: "suministro",
  tipo: "tipo de trámite",
  detalle: "detalle",
  estado: "estado",
  caseNumber: "número de caso",
  notes: "notas",
  solicitadoEl: "fecha de pedido",
  resueltoEl: "fecha de resolución",
};

export async function registerUteComercialRoutes(app: FastifyInstance) {
  app.addHook("preHandler", authenticate);

  app.get(
    "/ute-tramites-comerciales",
    { preHandler: authorize(Module.TRAMITES_UTE, Action.VIEW) },
    async (request) => {
      const query = z.object({ projectId: z.string().min(1).optional() }).parse(request.query);
      const rows = await prisma.uteTramiteComercial.findMany({
        where: {
          deletedAt: null,
          project: { deletedAt: null },
          ...(query.projectId ? { projectId: query.projectId } : {}),
        },
        include,
        orderBy: [{ solicitadoEl: { sort: "desc", nulls: "first" } }, { createdAt: "desc" }],
      });
      return rows.map(serializar);
    },
  );

  app.post(
    "/ute-tramites-comerciales",
    { preHandler: authorize(Module.TRAMITES_UTE, Action.CREATE) },
    async (request, reply) => {
      const user = ensureUser(request);
      const body = createSchema.parse(request.body);
      const project = await prisma.project.findFirst({
        where: { id: body.projectId, deletedAt: null },
        select: { id: true },
      });
      if (!project) throw notFound("PROJECT_NOT_FOUND", "Proyecto no encontrado");
      if (body.tipo === UteTramiteComercialTipo.OTRO && !body.detalle) {
        throw badRequest("DETALLE_REQUERIDO", "Para un trámite de tipo «Otro» hay que decir qué es");
      }

      const estado = body.estado ?? UteTramiteComercialEstado.PEDIDO;
      // Si se carga como ya pedido y no se dice cuándo, se toma hoy: sin
      // fecha de pedido la sección no puede decir cuánto lleva.
      const solicitadoEl =
        body.solicitadoEl ?? (estado === UteTramiteComercialEstado.A_PEDIR ? null : hoyComoDia());

      const creado = await prisma.uteTramiteComercial.create({
        data: {
          projectId: body.projectId,
          suministro: body.suministro ?? 1,
          tipo: body.tipo,
          detalle: body.detalle ?? null,
          estado,
          caseNumber: body.caseNumber ?? null,
          notes: body.notes ?? null,
          solicitadoEl,
          resueltoEl: estado === UteTramiteComercialEstado.RESUELTO ? hoyComoDia() : null,
          createdById: user.id,
        },
        include,
      });

      await createAuditEntry({
        entityType: AuditEntityType.ute_tramite_comercial,
        entityId: creado.id,
        projectId: creado.projectId,
        userId: user.id,
        action: AuditAction.created,
        description: `Cargó un trámite con UTE Comercial: ${TIPO_LABEL[creado.tipo]}${
          creado.detalle ? ` (${creado.detalle})` : ""
        }`,
      });

      reply.code(201);
      return serializar(creado);
    },
  );

  app.patch(
    "/ute-tramites-comerciales/:id",
    { preHandler: authorize(Module.TRAMITES_UTE, Action.EDIT) },
    async (request) => {
      const user = ensureUser(request);
      const { id } = z.object({ id: z.string().min(1) }).parse(request.params);
      const body = patchSchema.parse(request.body);
      const actual = await prisma.uteTramiteComercial.findFirst({ where: { id, deletedAt: null } });
      if (!actual) throw notFound("TRAMITE_NOT_FOUND", "Trámite no encontrado");

      const data: Prisma.UteTramiteComercialUncheckedUpdateInput = {};
      for (const k of Object.keys(body) as (keyof typeof body)[]) {
        if (body[k] !== undefined) (data as Record<string, unknown>)[k] = body[k];
      }
      const tipoFinal = body.tipo ?? actual.tipo;
      const detalleFinal = body.detalle !== undefined ? body.detalle : actual.detalle;
      if (tipoFinal === UteTramiteComercialTipo.OTRO && !detalleFinal) {
        throw badRequest("DETALLE_REQUERIDO", "Para un trámite de tipo «Otro» hay que decir qué es");
      }

      // Las fechas acompañan al estado si no se cargaron a mano: marcarlo
      // pedido fecha el pedido hoy; marcarlo resuelto fecha la resolución.
      if (body.estado && body.estado !== actual.estado) {
        if (body.estado !== UteTramiteComercialEstado.A_PEDIR && !actual.solicitadoEl && body.solicitadoEl === undefined) {
          data.solicitadoEl = hoyComoDia();
        }
        if (body.estado === UteTramiteComercialEstado.RESUELTO && !actual.resueltoEl && body.resueltoEl === undefined) {
          data.resueltoEl = hoyComoDia();
        }
        // Reabrir un resuelto le saca la fecha de resolución.
        if (
          actual.estado === UteTramiteComercialEstado.RESUELTO &&
          body.estado !== UteTramiteComercialEstado.RESUELTO &&
          body.resueltoEl === undefined
        ) {
          data.resueltoEl = null;
        }
      }

      const actualizado = await prisma.uteTramiteComercial.update({ where: { id }, data, include });

      const viejo = actual as unknown as Record<string, unknown>;
      const nuevo = actualizado as unknown as Record<string, unknown>;
      const campos = Object.keys(data);
      await createAuditEntriesForChanges({
        entityType: AuditEntityType.ute_tramite_comercial,
        entityId: id,
        projectId: actual.projectId,
        userId: user.id,
        oldData: Object.fromEntries(campos.map((k) => [k, viejo[k]])),
        newData: Object.fromEntries(campos.map((k) => [k, nuevo[k]])),
        labels: LABELS,
        formatter: ({ field, label, oldValue, newValue }) => {
          if (field === "estado") {
            const de = ESTADO_LABEL[oldValue as UteTramiteComercialEstado] ?? oldValue;
            const a = ESTADO_LABEL[newValue as UteTramiteComercialEstado] ?? newValue;
            return `Trámite comercial (${TIPO_LABEL[actualizado.tipo]}): estado de ${de} a ${a}`;
          }
          // Las fechas llegan como ISO: se muestran dd/mm/aaaa.
          const fmt = (v: string | null) =>
            !v ? "vacío" : /^\d{4}-\d{2}-\d{2}T/.test(v) ? v.slice(0, 10).split("-").reverse().join("/") : v;
          return `Trámite comercial (${TIPO_LABEL[actualizado.tipo]}): ${label} de ${fmt(oldValue)} a ${fmt(newValue)}`;
        },
      });

      return serializar(actualizado);
    },
  );

  app.delete(
    "/ute-tramites-comerciales/:id",
    { preHandler: authorize(Module.TRAMITES_UTE, Action.DELETE) },
    async (request) => {
      const user = ensureUser(request);
      const { id } = z.object({ id: z.string().min(1) }).parse(request.params);
      const actual = await prisma.uteTramiteComercial.findFirst({ where: { id, deletedAt: null } });
      if (!actual) throw notFound("TRAMITE_NOT_FOUND", "Trámite no encontrado");
      await prisma.uteTramiteComercial.update({ where: { id }, data: { deletedAt: new Date() } });
      await createAuditEntry({
        entityType: AuditEntityType.ute_tramite_comercial,
        entityId: id,
        projectId: actual.projectId,
        userId: user.id,
        action: AuditAction.deleted,
        description: `Borró un trámite con UTE Comercial: ${TIPO_LABEL[actual.tipo]}`,
      });
      return { ok: true };
    },
  );
}

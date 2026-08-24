// Endpoints de pagos a instaladores tercerizados. Prefijo /api.
//
// Dos audiencias con permisos distintos:
//
//  - El INSTALADOR (rol INSTALADOR_TERCERIZADO) mira lo suyo con
//    `PAGOS_INSTALADOR:VIEW`. Nunca puede asignar, cobrar ni corregir montos.
//  - QUIEN GESTIONA (admin / finanzas) usa los permisos de FINANZAS, igual que
//    las comisiones: el que maneja la plata es el mismo, no hace falta una
//    segunda llave para lo mismo.
//
// El scoping "los míos vs todos" es idéntico al de comisiones: `/mine` siempre va
// al usuario logueado, y el listado general degrada a los propios si el rol no
// puede ver todo. Así un tercerizado que pega en `/installer-payments` no ve nada
// ajeno aunque adivine el endpoint.

import { Action, InstallerPaymentStatus, Module } from "@prisma/client";
import type { FastifyInstance, FastifyRequest } from "fastify";
import { z } from "zod";

import { authenticate } from "../middleware/auth.middleware.js";
import { authorize, hasPermission } from "../middleware/authorize.middleware.js";
import {
  borrarEntrega,
  createManualInstallerPayment,
  deleteInstallerPayment,
  editarEntrega,
  installerPaymentMetrics,
  listInstallerPayments,
  registrarPago,
  updateInstallerPayment,
} from "../services/installer-payment/installer-payment.service.js";
import { parseDateOnly } from "../utils/dates.js";
import { unauthorized } from "../utils/errors.js";

function ensureUser(request: FastifyRequest) {
  if (!request.user) throw unauthorized("No autenticado");
  return request.user;
}

/**
 * "Ver los pagos de todos los instaladores", no solo los propios. Dos señales,
 * ambas gobernadas por la matriz y sin roles hardcodeados — mismo criterio que
 * `canSeeAll` en `commission.routes.ts`.
 */
async function canSeeAll(role: string) {
  const [finanzas, gestion] = await Promise.all([
    hasPermission(role, Module.FINANZAS, Action.VIEW),
    hasPermission(role, Module.PAGOS_INSTALADOR, Action.EDIT),
  ]);
  return finanzas || gestion;
}

const listQuery = z
  .object({
    installerId: z.string().min(1).optional(),
    status: z.nativeEnum(InstallerPaymentStatus).optional(),
    year: z.coerce.number().int().min(2000).max(2100).optional(),
    sinAsignar: z.coerce.boolean().optional(),
  })
  .strict();

const idParams = z.object({ id: z.string().min(1) }).strict();

const CURRENT_YEAR_DEFAULT = () => new Date().getUTCFullYear();

export async function registerInstallerPaymentRoutes(app: FastifyInstance) {
  // ── Lectura ────────────────────────────────────────────────────────────────

  // Los pagos del instalador logueado. Siempre scopeado: no acepta installerId.
  app.get(
    "/installer-payments/mine",
    { preHandler: [authenticate, authorize(Module.PAGOS_INSTALADOR, Action.VIEW)] },
    async (request) => {
      const user = ensureUser(request);
      const q = listQuery.parse(request.query);
      const payments = await listInstallerPayments({
        installerId: user.id,
        status: q.status,
        year: q.year,
      });
      const metrics = await installerPaymentMetrics({
        installerId: user.id,
        year: q.year ?? CURRENT_YEAR_DEFAULT(),
      });
      return { payments, metrics };
    },
  );

  // Listado general. Sin permiso para ver todo, degrada a los propios.
  app.get(
    "/installer-payments",
    { preHandler: [authenticate, authorize(Module.PAGOS_INSTALADOR, Action.VIEW)] },
    async (request) => {
      const user = ensureUser(request);
      const q = listQuery.parse(request.query);
      const seeAll = await canSeeAll(user.role);

      const installerId = seeAll ? q.installerId : user.id;
      const payments = await listInstallerPayments({
        installerId,
        // "Sin asignar" solo tiene sentido para quien gestiona: al instalador le
        // mostraría trabajos que no son suyos.
        sinAsignar: seeAll ? q.sinAsignar : undefined,
        status: q.status,
        year: q.year,
      });
      const metrics = await installerPaymentMetrics({
        installerId,
        year: q.year ?? CURRENT_YEAR_DEFAULT(),
      });
      return { payments, metrics, seeAll };
    },
  );

  // ── Gestión (admin / finanzas) ─────────────────────────────────────────────

  const manualBody = z
    .object({
      installerId: z.string().min(1).nullable().optional(),
      projectId: z.string().min(1).nullable().optional(),
      concepto: z.string().trim().max(200).optional(),
      montoUsd: z.number().positive(),
      fechaTrabajo: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
    })
    .strict();

  app.post(
    "/installer-payments",
    { preHandler: [authenticate, authorize(Module.FINANZAS, Action.CREATE)] },
    async (request, reply) => {
      const user = ensureUser(request);
      const body = manualBody.parse(request.body);
      const payment = await createManualInstallerPayment({
        installerId: body.installerId ?? null,
        projectId: body.projectId ?? null,
        concepto: body.concepto,
        montoUsd: body.montoUsd,
        fechaTrabajo: parseDateOnly(body.fechaTrabajo),
        userId: user.id,
      });
      reply.code(201);
      return { payment };
    },
  );

  // Asignar el instalador y/o corregir monto, fechas y notas.
  const updateBody = z
    .object({
      installerId: z.string().min(1).nullable().optional(),
      montoUsd: z.number().positive().optional(),
      fechaTrabajo: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
      dueDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
      notas: z.string().max(1000).optional(),
    })
    .strict()
    .refine(
      (b) =>
        b.installerId !== undefined ||
        b.montoUsd != null ||
        b.fechaTrabajo != null ||
        b.dueDate != null ||
        b.notas !== undefined,
      { message: "Nada para actualizar." },
    );

  app.patch(
    "/installer-payments/:id",
    { preHandler: [authenticate, authorize(Module.FINANZAS, Action.EDIT)] },
    async (request) => {
      const user = ensureUser(request);
      const { id } = idParams.parse(request.params);
      const body = updateBody.parse(request.body);
      const payment = await updateInstallerPayment({
        paymentId: id,
        userId: user.id,
        installerId: body.installerId,
        montoUsd: body.montoUsd,
        fechaTrabajo: body.fechaTrabajo ? parseDateOnly(body.fechaTrabajo) : undefined,
        dueDate: body.dueDate ? parseDateOnly(body.dueDate) : undefined,
        notas: body.notas,
      });
      return { payment };
    },
  );

  // Registrar una entrega de plata (total o parcial).
  const pagoBody = z
    .object({
      montoUsd: z.number().positive(),
      fecha: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
      accountId: z.string().min(1).nullable().optional(),
      notas: z.string().max(1000).nullable().optional(),
    })
    .strict();

  app.post(
    "/installer-payments/:id/pagos",
    { preHandler: [authenticate, authorize(Module.FINANZAS, Action.CREATE)] },
    async (request, reply) => {
      const user = ensureUser(request);
      const { id } = idParams.parse(request.params);
      const body = pagoBody.parse(request.body);
      const payment = await registrarPago({
        paymentId: id,
        montoUsd: body.montoUsd,
        fecha: parseDateOnly(body.fecha),
        accountId: body.accountId ?? null,
        notas: body.notas ?? null,
        userId: user.id,
      });
      reply.code(201);
      return { payment };
    },
  );

  app.delete(
    "/installer-payments/:id",
    { preHandler: [authenticate, authorize(Module.FINANZAS, Action.DELETE)] },
    async (request, reply) => {
      const user = ensureUser(request);
      const { id } = idParams.parse(request.params);
      await deleteInstallerPayment({ paymentId: id, userId: user.id });
      reply.code(204);
      return null;
    },
  );

  // ── Editar / borrar una entrega ya registrada (opera sobre su movimiento de
  //    Finanzas, así el cambio se refleja en Movimientos / flujo / resultados) ──
  const entregaParams = z.object({ id: z.string().min(1), movementId: z.string().min(1) }).strict();
  const entregaUpdateBody = z
    .object({
      montoUsd: z.number().positive().optional(),
      fecha: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
      notas: z.string().max(1000).optional(),
    })
    .strict()
    .refine((b) => b.montoUsd != null || b.fecha != null || b.notas !== undefined, {
      message: "Nada para actualizar.",
    });

  app.patch(
    "/installer-payments/:id/pagos/:movementId",
    { preHandler: [authenticate, authorize(Module.FINANZAS, Action.EDIT)] },
    async (request) => {
      const user = ensureUser(request);
      const { id, movementId } = entregaParams.parse(request.params);
      const body = entregaUpdateBody.parse(request.body);
      const payment = await editarEntrega({
        paymentId: id,
        movementId,
        userId: user.id,
        montoUsd: body.montoUsd,
        fecha: body.fecha ? parseDateOnly(body.fecha) : undefined,
        notas: body.notas,
      });
      return { payment };
    },
  );

  app.delete(
    "/installer-payments/:id/pagos/:movementId",
    { preHandler: [authenticate, authorize(Module.FINANZAS, Action.DELETE)] },
    async (request) => {
      const user = ensureUser(request);
      const { id, movementId } = entregaParams.parse(request.params);
      const payment = await borrarEntrega({ paymentId: id, movementId, userId: user.id });
      return { payment };
    },
  );
}

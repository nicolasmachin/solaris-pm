// Endpoints de comisiones del asesor (Tanda 2). Prefijo /api.
//   Congelamiento (ventas):
//     GET  /leads/:leadId/commission/eligible-proposals   (VENTAS:VIEW)
//     POST /leads/:leadId/commission                       (VENTAS:EDIT)
//   Listados / métricas del dashboard: ver Commit 5 (COMISIONES:VIEW).

import { Action, CommissionStatus, Module } from "@prisma/client";
import type { FastifyInstance, FastifyRequest } from "fastify";
import { z } from "zod";

import { prisma } from "../lib/prisma.js";
import { authenticate } from "../middleware/auth.middleware.js";
import { authorize, hasPermission } from "../middleware/authorize.middleware.js";
import {
  commissionMetrics,
  confirmCommission,
  createManualCommission,
  getLeadCommission,
  listCommissions,
  listEligibleProposals,
} from "../services/commission/commission.service.js";
import { parseDateOnly } from "../utils/dates.js";
import { notFound, unauthorized } from "../utils/errors.js";

// ¿El usuario puede ver comisiones de todos los asesores? (ADMIN/FINANZAS).
// Los que no, solo ven las propias. Se apoya en FINANZAS:VIEW (ADMIN lo tiene).
function canSeeAll(role: string) {
  return hasPermission(role, Module.FINANZAS, Action.VIEW);
}

const listQuery = z
  .object({
    asesorId: z.string().min(1).optional(),
    status: z.nativeEnum(CommissionStatus).optional(),
    sort: z.enum(["fecha", "monto"]).optional(),
    year: z.coerce.number().int().optional(),
  })
  .strict();

const metricsQuery = z
  .object({
    asesorId: z.string().min(1).optional(),
    year: z.coerce.number().int().optional(),
  })
  .strict();

function ensureUser(request: FastifyRequest) {
  if (!request.user) throw unauthorized("No autenticado");
  return request.user;
}

const leadParams = z.object({ leadId: z.string().min(1) }).strict();
const manualBody = z
  .object({
    asesorId: z.string().min(1),
    montoUsd: z.number().positive(),
    fecha: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
    concepto: z.string().max(200).optional(),
  })
  .strict();
const confirmBody = z
  .object({
    proposalVersionId: z.string().min(1).optional(),
    montoManualUsd: z.number().positive().optional(),
    proposalGenerationId: z.string().min(1).optional(),
  })
  .strict();

export async function registerCommissionRoutes(app: FastifyInstance) {
  app.addHook("preHandler", authenticate);

  // Propuestas elegibles del lead para congelar la comisión (modal Etapa 2).
  app.get(
    "/leads/:leadId/commission/eligible-proposals",
    { preHandler: authorize(Module.VENTAS, Action.VIEW) },
    async (request) => {
      const { leadId } = leadParams.parse(request.params);
      const lead = await prisma.salesLead.findUnique({ where: { id: leadId }, select: { id: true } });
      if (!lead) throw notFound("LEAD_NOT_FOUND", "El lead no existe.");
      return listEligibleProposals(leadId);
    },
  );

  // Comisión del lead (o null). Para el panel del lead y el aviso al reabrir.
  app.get(
    "/leads/:leadId/commission",
    { preHandler: authorize(Module.VENTAS, Action.VIEW) },
    async (request) => {
      const { leadId } = leadParams.parse(request.params);
      return { commission: await getLeadCommission(leadId) };
    },
  );

  // Congela la comisión de la propuesta ganadora + genera el pendiente en Finanzas.
  app.post(
    "/leads/:leadId/commission",
    { preHandler: authorize(Module.VENTAS, Action.EDIT) },
    async (request) => {
      const user = ensureUser(request);
      const { leadId } = leadParams.parse(request.params);
      const body = confirmBody.parse(request.body);
      return confirmCommission({
        leadId,
        userId: user.id,
        userRole: user.role,
        proposalVersionId: body.proposalVersionId,
        montoManualUsd: body.montoManualUsd,
        proposalGenerationId: body.proposalGenerationId,
      });
    },
  );

  // Comisión manual cargada por un admin (sin lead). ADMIN/FINANZAS.
  app.post(
    "/commissions",
    { preHandler: authorize(Module.FINANZAS, Action.CREATE) },
    async (request) => {
      const user = ensureUser(request);
      const body = manualBody.parse(request.body);
      return createManualCommission({
        asesorId: body.asesorId,
        montoUsd: body.montoUsd,
        fecha: parseDateOnly(body.fecha),
        concepto: body.concepto,
        userId: user.id,
      });
    },
  );

  // Comisiones propias del asesor logueado.
  app.get(
    "/commissions/mine",
    { preHandler: authorize(Module.COMISIONES, Action.VIEW) },
    async (request) => {
      const user = ensureUser(request);
      const q = listQuery.parse(request.query);
      return listCommissions({ asesorId: user.id, status: q.status, sort: q.sort, year: q.year });
    },
  );

  // Todas las comisiones (ADMIN/FINANZAS). Sin ese permiso, degrada a las propias.
  app.get(
    "/commissions",
    { preHandler: authorize(Module.COMISIONES, Action.VIEW) },
    async (request) => {
      const user = ensureUser(request);
      const q = listQuery.parse(request.query);
      const seeAll = await canSeeAll(user.role);
      const asesorId = seeAll ? q.asesorId : user.id;
      return listCommissions({ asesorId, status: q.status, sort: q.sort, year: q.year });
    },
  );

  // Métricas agregadas para el dashboard.
  app.get(
    "/commissions/metrics",
    { preHandler: authorize(Module.COMISIONES, Action.VIEW) },
    async (request) => {
      const user = ensureUser(request);
      const q = metricsQuery.parse(request.query);
      const seeAll = await canSeeAll(user.role);
      const asesorId = seeAll ? q.asesorId : user.id;
      const year = q.year ?? new Date().getUTCFullYear();
      return commissionMetrics({ asesorId, year });
    },
  );
}

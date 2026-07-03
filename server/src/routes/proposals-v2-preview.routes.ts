// Endpoints del generador de propuestas v2.
//   POST /api/proposals-v2/preview       → VENTAS:VIEW  → { calculated, html }
//   POST /api/proposals-v2/generate-pdf  → VENTAS:VIEW  → PDF binario
// Read-only: lee el singleton ProposalDefaults y calcula. El flujo de caja del
// negocio se incluye en el `calculated` devuelto solo si el usuario es ADMIN
// (gating acá, no en el calculator). El HTML/PDF nunca contiene el flujo de caja,
// así que renderizar con el calculated completo no filtra datos sensibles.

import { Action, Module } from "@prisma/client";
import type { FastifyReply, FastifyRequest } from "fastify";
import type { FastifyInstance } from "fastify";
import { z } from "zod";

import { prisma } from "../lib/prisma.js";
import { authenticate } from "../middleware/auth.middleware.js";
import { authorize } from "../middleware/authorize.middleware.js";
import {
  calculate,
  generateFullPdfWithCover,
  generateProposalSummaryPdf,
  renderProposalFull,
  renderProposalSummary,
  resolveAdvisorForUser,
  resolveDefaults,
  type ProposalCalculated,
  type ProposalData,
} from "../services/proposal/index.js";
import { badRequest, unauthorized } from "../utils/errors.js";

function ensureUser(request: FastifyRequest) {
  if (!request.user) throw unauthorized("No autenticado");
  return request.user;
}

const dataSchema = z
  .object({
    cliente: z
      .object({
        nombre: z.string().min(1, "Falta el nombre del cliente"),
        dirigidoA: z.string(),
        ciudad: z.string(),
      })
      .strict(),
    factura: z
      .object({
        pagaMensualPesos: z.number().min(0),
        tarifa: z.enum(["Simple", "Doble", "Triple"]),
        suministro: z.enum(["monofásico", "trifásico"]),
        potenciaContratadaKw: z.number().min(0),
      })
      .strict(),
    techo: z
      .object({
        descripcion: z.string(),
        tamanoM2: z.number().min(0),
      })
      .strict(),
    cotizacion: z
      .object({
        distanciaInstalacionKm: z.number().min(0),
        cotizacionDolar: z.number().gt(0),
        // Acepta decimal (0.2) o porcentaje (20); la calc lo interpreta por magnitud.
        markupPorcentaje: z.number().min(0).max(100),
      })
      .strict(),
    sistema: z
      .object({
        cantidadPaneles: z.number().int().min(1),
        potenciaPanelW: z.number().min(100),
        marcaPaneles: z.string(),
        potenciaInversorKw: z.number().min(0),
        marcaInversor: z.string(),
      })
      .strict(),
    fecha: z.string().min(1),
    itemsAdicionales: z.array(
      z
        .object({
          id: z.string(),
          nombre: z.string(),
          descripcion: z.string(),
          precioSinIvaUsd: z.number().min(0),
          potenciaW: z.number().min(0).optional(),
        })
        .strict(),
    ),
  })
  .strict();

const bodySchema = z
  .object({
    data: dataSchema,
    mode: z.enum(["full", "summary"]).default("full"),
  })
  .strict();

// Claves del flujo de caja del negocio (solo ADMIN).
const FLUJO_KEYS = [
  "cobroAdelantoCliente",
  "pagoAlProveedor",
  "cobroSaldoCliente",
  "pagoManoDeObra",
  "pagoIva",
  "devolucionIva",
  "pagoVendedor",
  "pagoBbva",
  "gananciaFinal",
] as const;

function stripBusinessFlow(calc: ProposalCalculated): Partial<ProposalCalculated> {
  const copy = { ...calc } as Record<string, unknown>;
  for (const k of FLUJO_KEYS) delete copy[k];
  return copy as Partial<ProposalCalculated>;
}

async function resolveData(data: ProposalData) {
  const defaultsRow = await prisma.proposalDefaults.findUnique({ where: { id: "singleton" } });
  if (!defaultsRow) {
    throw badRequest(
      "PROPOSAL_DEFAULTS_NOT_SEEDED",
      "Los defaults de propuestas no están cargados — corré el seed",
    );
  }
  const defaults = resolveDefaults(defaultsRow.data);
  return calculate(data, defaults);
}

export async function registerProposalsV2PreviewRoutes(app: FastifyInstance) {
  app.addHook("preHandler", authenticate);

  // Preview: calcula y devuelve el HTML renderizado (para previsualizar en el front).
  app.post(
    "/proposals-v2/preview",
    { preHandler: authorize(Module.VENTAS, Action.VIEW) },
    async (request) => {
      const user = ensureUser(request);
      const { data, mode } = bodySchema.parse(request.body);
      const calculated = await resolveData(data as ProposalData);
      const advisor = await resolveAdvisorForUser(user.id);
      const ctx = { data: data as ProposalData, calculated, advisor };
      const html = mode === "summary" ? renderProposalSummary(ctx) : renderProposalFull(ctx);
      const isAdmin = user.role === "ADMIN";
      return {
        calculated: isAdmin ? calculated : stripBusinessFlow(calculated),
        html,
      };
    },
  );

  // Generación del PDF (binario).
  app.post(
    "/proposals-v2/generate-pdf",
    { preHandler: authorize(Module.VENTAS, Action.VIEW) },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const user = ensureUser(request);
      const { data, mode } = bodySchema.parse(request.body);
      const calculated = await resolveData(data as ProposalData);
      const advisor = await resolveAdvisorForUser(user.id);
      const ctx = { data: data as ProposalData, calculated, advisor };
      // El resumen NO lleva tapa (es solo el cuerpo de 1-2 páginas). La completa
      // arranca con la tapa (con overlay) si hay una configurada.
      const pdf =
        mode === "summary"
          ? await generateProposalSummaryPdf(ctx)
          : await generateFullPdfWithCover(ctx);
      const filename = mode === "summary" ? "propuesta-resumen.pdf" : "propuesta-completa.pdf";
      return reply
        .header("Content-Type", "application/pdf")
        .header("Content-Disposition", `inline; filename="${filename}"`)
        .send(pdf);
    },
  );
}

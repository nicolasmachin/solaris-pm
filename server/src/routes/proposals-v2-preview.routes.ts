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
import { draftDataPublishSchema } from "../services/proposal/schemas/draft.schema.js";
import { badRequest, unauthorized } from "../utils/errors.js";

function ensureUser(request: FastifyRequest) {
  if (!request.user) throw unauthorized("No autenticado");
  return request.user;
}

// El `data` de estos endpoints es el MISMO del borrador: se importa el schema
// canónico en vez de repetirlo. La copia inline que vivía acá se había quedado
// atrás (le faltaban plazoEntrega, tipoMontaje y notas), y con la variante B2B
// habría que mantener una cuarta divergencia más.
const dataSchema = draftDataPublishSchema;

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

// Endpoint de preview del generador de propuestas v2 (Fase B).
//   POST /api/proposals-v2/preview  → VENTAS:VIEW
// Read-only: lee el singleton ProposalDefaults, calcula y devuelve
// { calculated, debugHtml }. El flujo de caja del negocio se incluye en
// `calculated` solo si el usuario es ADMIN (gating acá, no en el calculator).

import { Action, Module } from "@prisma/client";
import type { FastifyRequest } from "fastify";
import type { FastifyInstance } from "fastify";
import { z } from "zod";

import { prisma } from "../lib/prisma.js";
import { authenticate } from "../middleware/auth.middleware.js";
import { authorize } from "../middleware/authorize.middleware.js";
import {
  calculate,
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
        markupPorcentaje: z.number().min(0).max(1),
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

const bodySchema = z.object({ data: dataSchema }).strict();

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

const fmtUsd = (n: number) => `USD ${n.toLocaleString("es-UY", { maximumFractionDigits: 2 })}`;
const fmtNum = (n: number) => n.toLocaleString("es-UY", { maximumFractionDigits: 2 });

function buildDebugHtml(c: ProposalCalculated, isAdmin: boolean): string {
  const rows: [string, string][] = [
    ["Potencia total", `${fmtNum(c.potenciaTotalKwp)} kWp`],
    ["Energía mensual", `${fmtNum(c.energiaMensualKwh)} kWh`],
    ["Energía anual", `${fmtNum(c.energiaAnualKwh)} kWh`],
    ["Costo equipamiento (sin IVA)", fmtUsd(c.costoEquipamientoSinIva)],
    ["Costo total (sin IVA)", fmtUsd(c.costoTotalSinIva)],
    ["Mano de obra (sin IVA)", fmtUsd(c.manoDeObraUsdSinIva)],
    ["Subtotal (sin IVA)", fmtUsd(c.subtotalSinIva)],
    ["Total con IVA", fmtUsd(c.totalConIva)],
    ["Total final con IVA (con ítems)", fmtUsd(c.totalFinalConIva)],
    ["USD/W", fmtNum(c.usdPorWatt)],
    ["Ahorro mensual", `$ ${fmtNum(c.ahorroMensualPesos)} (${fmtUsd(c.ahorroMensualUsd)})`],
    ["Ahorro anual", fmtUsd(c.ahorroAnualUsd)],
    ["Paga nuevo UTE", `$ ${fmtNum(c.pagaNuevoUtePesos)}`],
    ["TIR", `${fmtNum(c.tir * 100)} %`],
    ["PRI", `${fmtNum(c.priAnios)} años`],
    ["Cuota 24m", fmtUsd(c.cuota24m)],
    ["Cuota 36m", fmtUsd(c.cuota36m)],
    ["Cuota 60m", fmtUsd(c.cuota60m)],
  ];
  if (isAdmin) {
    rows.push(
      ["— Flujo de caja —", ""],
      ["Margen", `${fmtNum(c.margen * 100)} %`],
      ["Ganancia final", fmtUsd(c.gananciaFinal)],
    );
  }
  const trs = rows
    .map(([k, v]) => `<tr><td style="padding:4px 8px">${k}</td><td style="padding:4px 8px;text-align:right">${v}</td></tr>`)
    .join("");
  return `<div style="font-family:monospace;padding:20px"><h2>Debug — cálculos de la propuesta</h2><table border="1" style="border-collapse:collapse">${trs}</table></div>`;
}

export async function registerProposalsV2PreviewRoutes(app: FastifyInstance) {
  app.addHook("preHandler", authenticate);

  app.post(
    "/proposals-v2/preview",
    { preHandler: authorize(Module.VENTAS, Action.VIEW) },
    async (request) => {
      const user = ensureUser(request);
      const { data } = bodySchema.parse(request.body);

      const defaultsRow = await prisma.proposalDefaults.findUnique({ where: { id: "singleton" } });
      if (!defaultsRow) {
        throw badRequest(
          "PROPOSAL_DEFAULTS_NOT_SEEDED",
          "Los defaults de propuestas no están cargados — corré el seed",
        );
      }

      const defaults = resolveDefaults(defaultsRow.data);
      const calculated = calculate(data as ProposalData, defaults);

      const isAdmin = user.role === "ADMIN";
      return {
        calculated: isAdmin ? calculated : stripBusinessFlow(calculated),
        debugHtml: buildDebugHtml(calculated, isAdmin),
      };
    },
  );
}

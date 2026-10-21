// Conciliación diaria contra el banco. Prefijo /api.
//
// - POST /banco/lectura: la llama el lector del banco (robot externo), sin
//   usuario. Se autentica con BANCO_LECTOR_TOKEN en el header Authorization;
//   sin esa variable la ruta responde 404, como si no existiera.
// - El resto es para la pantalla de Movimientos: ver con FINANZAS:VIEW, marcar
//   "No va" con FINANZAS:EDIT.

import { timingSafeEqual } from "node:crypto";

import { Action, AuditAction, AuditEntityType, Module } from "@prisma/client";
import type { FastifyInstance, FastifyRequest } from "fastify";
import { z } from "zod";

import { prisma } from "../lib/prisma.js";
import { authenticate } from "../middleware/auth.middleware.js";
import { authorize } from "../middleware/authorize.middleware.js";
import { createAuditEntry } from "../services/audit.service.js";
import { desvincularBanco, pendientesPorCuenta, registrarLectura, registroBanco, vincularBanco } from "../services/finance/bank-reconciliation.service.js";
import { porConciliar } from "../services/finance/por-conciliar.service.js";
import { toDateOnlyString, todayUtc } from "../utils/dates.js";
import { badRequest, notFound, unauthorized } from "../utils/errors.js";

function ensureUser(request: FastifyRequest) {
  if (!request.user) throw unauthorized("No autenticado");
  return request.user;
}

function tokenValido(request: FastifyRequest) {
  const esperado = process.env.BANCO_LECTOR_TOKEN;
  if (!esperado) throw notFound("NOT_FOUND", "No encontrado");
  const recibido = (request.headers.authorization ?? "").replace(/^Bearer\s+/i, "");
  const a = Buffer.from(recibido);
  const b = Buffer.from(esperado);
  if (a.length !== b.length || !timingSafeEqual(a, b)) throw unauthorized("Token inválido");
}

const ver = { preHandler: [authenticate, authorize(Module.FINANZAS, Action.VIEW)] };
const editar = { preHandler: [authenticate, authorize(Module.FINANZAS, Action.EDIT)] };

const fechaSchema = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);
const lecturaSchema = z.object({
  leidoEn: z.string().datetime().optional(),
  cuentas: z.array(
    z.object({
      numeroCuenta: z.string().min(1),
      saldo: z.number().nullable().optional(),
      movimientos: z.array(
        z.object({
          fecha: fechaSchema,
          descripcion: z.string(),
          documento: z.string().nullable().optional(),
          dependencia: z.string().nullable().optional(),
          debito: z.number().nonnegative().nullable().optional(),
          credito: z.number().nonnegative().nullable().optional(),
        }),
      ).max(2000),
    }),
  ).min(1).max(20),
});

export async function registerConciliacionBancoRoutes(app: FastifyInstance) {
  app.post("/banco/lectura", async (request) => {
    tokenValido(request);
    const body = lecturaSchema.parse(request.body);
    const resultado = await registrarLectura(body.cuentas, body.leidoEn ? new Date(body.leidoEn) : new Date());
    request.log.info({ resultado }, "[banco] lectura registrada");
    return { ok: true, resultado };
  });

  app.get("/finance/banco/pendientes", ver, async () => ({ cuentas: await pendientesPorCuenta() }));

  // Lista única "Por conciliar" del Inicio de Finanzas.
  app.get("/finance/por-conciliar", ver, async () => porConciliar());

  // Registro de todo lo leído del banco, con su estado y la pareja en Voltia PM.
  // Por defecto, el mes en curso.
  app.get("/finance/banco/movimientos", ver, async (request) => {
    const hoy = toDateOnlyString(todayUtc())!;
    const q = z
      .object({
        accountId: z.string().optional(),
        desde: fechaSchema.default(`${hoy.slice(0, 8)}01`),
        hasta: fechaSchema.default(hoy),
      })
      .parse(request.query);
    return { movimientos: await registroBanco(q) };
  });

  app.post("/finance/banco/movimientos/:id/no-va", editar, async (request) => {
    const user = ensureUser(request);
    const { id } = z.object({ id: z.string() }).parse(request.params);
    const { motivo } = z.object({ motivo: z.string().trim().min(3) }).parse(request.body);
    const mov = await prisma.bankMovement.findUnique({ where: { id }, include: { account: { select: { nombre: true } } } });
    if (!mov) throw notFound("BANK_MOVEMENT_NOT_FOUND", "Movimiento del banco no encontrado");
    await prisma.bankMovement.update({
      where: { id },
      data: { ignoradoAt: new Date(), ignoradoMotivo: motivo, ignoradoPorId: user.id },
    });
    await createAuditEntry({
      entityType: AuditEntityType.bank_movement,
      entityId: id,
      userId: user.id,
      action: AuditAction.updated,
      fieldChanged: "ignoradoAt",
      newValue: motivo,
      description: `Marcó "No va" el movimiento del banco ${mov.descripcion} (${mov.account.nombre}): ${motivo}`,
    });
    return { ok: true };
  });

  app.post("/finance/banco/movimientos/:id/deshacer-no-va", editar, async (request) => {
    const user = ensureUser(request);
    const { id } = z.object({ id: z.string() }).parse(request.params);
    const mov = await prisma.bankMovement.findUnique({ where: { id }, include: { account: { select: { nombre: true } } } });
    if (!mov) throw notFound("BANK_MOVEMENT_NOT_FOUND", "Movimiento del banco no encontrado");
    await prisma.bankMovement.update({
      where: { id },
      data: { ignoradoAt: null, ignoradoMotivo: null, ignoradoPorId: null },
    });
    await createAuditEntry({
      entityType: AuditEntityType.bank_movement,
      entityId: id,
      userId: user.id,
      action: AuditAction.updated,
      fieldChanged: "ignoradoAt",
      oldValue: mov.ignoradoMotivo,
      description: `Volvió a comparar el movimiento del banco ${mov.descripcion} (${mov.account.nombre})`,
    });
    return { ok: true };
  });

  // Fijar la pareja (la propuesta, o una elegida a mano) y soltarla.
  app.post("/finance/banco/movimientos/:id/vincular", editar, async (request) => {
    const user = ensureUser(request);
    const { id } = z.object({ id: z.string() }).parse(request.params);
    const body = z.object({ movementId: z.string().optional(), paymentId: z.string().optional() }).strict()
      .refine((b) => !!b.movementId !== !!b.paymentId, "Indicá un movimiento o un pago").parse(request.body);
    const mov = await prisma.bankMovement.findUnique({ where: { id }, include: { account: { select: { nombre: true } } } });
    if (!mov) throw notFound("BANK_MOVEMENT_NOT_FOUND", "Movimiento del banco no encontrado");
    try {
      await vincularBanco(id, body, user.id);
    } catch (e) {
      const code = (e as Error).message;
      const msg: Record<string, string> = {
        MOVEMENT_NOT_FOUND: "Movimiento no encontrado",
        PAYMENT_NOT_FOUND: "Pago no encontrado",
        CUENTA_DISTINTA: "Es de otra cuenta",
        SENTIDO_DISTINTO: "Uno entra y el otro sale",
      };
      throw badRequest(code, msg[code] ?? "No se pudo vincular");
    }
    await createAuditEntry({
      entityType: AuditEntityType.bank_movement,
      entityId: id,
      userId: user.id,
      action: AuditAction.updated,
      description: `Confirmó la pareja del movimiento del banco ${mov.descripcion} (${mov.account.nombre})`,
    });
    return { ok: true };
  });

  app.post("/finance/banco/movimientos/:id/desvincular", editar, async (request) => {
    const user = ensureUser(request);
    const { id } = z.object({ id: z.string() }).parse(request.params);
    const mov = await prisma.bankMovement.findUnique({ where: { id }, include: { account: { select: { nombre: true } } } });
    if (!mov) throw notFound("BANK_MOVEMENT_NOT_FOUND", "Movimiento del banco no encontrado");
    await desvincularBanco(id);
    await createAuditEntry({
      entityType: AuditEntityType.bank_movement,
      entityId: id,
      userId: user.id,
      action: AuditAction.updated,
      description: `Soltó la pareja del movimiento del banco ${mov.descripcion} (${mov.account.nombre})`,
    });
    return { ok: true };
  });
}

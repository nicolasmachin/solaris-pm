// Tarjetas de crédito, cuenta del socio y adelantos a empleados. Prefijo /api.
//
// Una tarjeta es una cuenta (Account tipo TARJETA). Cada gasto es un movimiento
// de esa cuenta; el pago es una transferencia desde el banco (Movimientos →
// Transferencia). Lo que se debe de la tarjeta es su saldo: si después del pago
// queda en cero, "cierra".
//
// Cada gasto se marca de Voltia o personal. Lo personal no es gasto de la
// empresa: va a CUENTA_SOCIO (lo que el socio le debe a Voltia) o a
// ADELANTO_PERSONAL (se le descuenta del sueldo al empleado), según quién usó
// la tarjeta. Ninguna de las dos entra al resultado.
//
// Permisos: ver con FINANZAS:VIEW; clasificar, configurar titulares y marcar
// descontado con FINANZAS:EDIT.

import {
  AccountType,
  Action,
  AuditAction,
  AuditEntityType,
  CategoriaPrincipal,
  FinanceMovementStatus,
  Module,
  ReglaTarjeta,
  TipoMovimiento,
} from "@prisma/client";
import type { FastifyInstance, FastifyRequest } from "fastify";
import { z } from "zod";

import { prisma } from "../lib/prisma.js";
import { authenticate } from "../middleware/auth.middleware.js";
import { authorize } from "../middleware/authorize.middleware.js";
import { createAuditEntry } from "../services/audit.service.js";
import { assertFechaAbierta, rangoMes } from "../services/finance/cierre-mes.service.js";
import { toDateOnlyString } from "../utils/dates.js";
import { badRequest, notFound, unauthorized } from "../utils/errors.js";

function ensureUser(request: FastifyRequest) {
  if (!request.user) throw unauthorized("No autenticado");
  return request.user;
}

const ver = { preHandler: [authenticate, authorize(Module.FINANZAS, Action.VIEW)] };
const editar = { preHandler: [authenticate, authorize(Module.FINANZAS, Action.EDIT)] };

const PERSONALES: CategoriaPrincipal[] = [CategoriaPrincipal.CUENTA_SOCIO, CategoriaPrincipal.ADELANTO_PERSONAL];
const r2 = (n: number) => Math.round(n * 100) / 100;

/** Saldo de la tarjeta: lo que se debe (negativo = se debe). */
async function saldoTarjeta(accountId: string) {
  const a = await prisma.account.findUniqueOrThrow({ where: { id: accountId } });
  const fechaFilter = a.fechaSaldoInicial ? { fecha: { gt: a.fechaSaldoInicial } } : {};
  const [ing, gas] = await Promise.all([
    prisma.financeMovement.aggregate({ where: { accountId, deletedAt: null, tipoMovimiento: TipoMovimiento.INGRESO, cobrado: true, ...fechaFilter }, _sum: { monto: true } }),
    prisma.financeMovement.aggregate({ where: { accountId, deletedAt: null, tipoMovimiento: TipoMovimiento.GASTO, pagado: true, ...fechaFilter }, _sum: { monto: true } }),
  ]);
  return r2(Number(a.saldoInicial) + Number(ing._sum.monto ?? 0) - Number(gas._sum.monto ?? 0));
}

export async function registerTarjetasRoutes(app: FastifyInstance) {
  app.get("/finance/tarjetas", ver, async () => {
    const cuentas = await prisma.account.findMany({
      where: { deletedAt: null, tipo: AccountType.TARJETA },
      include: { tarjetaTitulares: { where: { activo: true }, orderBy: { createdAt: "asc" } } },
      orderBy: { nombre: "asc" },
    });
    const out = [];
    for (const c of cuentas) {
      out.push({
        id: c.id, nombre: c.nombre, moneda: c.moneda, activa: c.activa,
        saldo: await saldoTarjeta(c.id),
        titulares: c.tarjetaTitulares.map((t) => ({ id: t.id, nombre: t.nombre, regla: t.regla, personalComo: t.personalComo })),
      });
    }
    return { tarjetas: out };
  });

  const titularBody = z.object({
    nombre: z.string().trim().min(2).max(80),
    regla: z.nativeEnum(ReglaTarjeta),
    personalComo: z.enum([CategoriaPrincipal.CUENTA_SOCIO, CategoriaPrincipal.ADELANTO_PERSONAL]),
  });

  app.post("/finance/tarjetas/:accountId/titulares", editar, async (request) => {
    const user = ensureUser(request);
    const { accountId } = z.object({ accountId: z.string() }).parse(request.params);
    const body = titularBody.strict().parse(request.body);
    const a = await prisma.account.findFirst({ where: { id: accountId, deletedAt: null, tipo: AccountType.TARJETA } });
    if (!a) throw notFound("TARJETA_NOT_FOUND", "Tarjeta no encontrada");
    const t = await prisma.tarjetaTitular.create({ data: { accountId, ...body } });
    await createAuditEntry({
      entityType: AuditEntityType.account, entityId: accountId, userId: user.id, action: AuditAction.updated,
      description: `Agregó a ${body.nombre} a la tarjeta ${a.nombre} (${body.regla})`,
    });
    return t;
  });

  app.patch("/finance/tarjetas/titulares/:id", editar, async (request) => {
    const user = ensureUser(request);
    const { id } = z.object({ id: z.string() }).parse(request.params);
    const body = titularBody.partial().extend({ activo: z.boolean().optional() }).strict().parse(request.body);
    const t = await prisma.tarjetaTitular.findUnique({ where: { id } });
    if (!t) throw notFound("TITULAR_NOT_FOUND", "Titular no encontrado");
    const upd = await prisma.tarjetaTitular.update({ where: { id }, data: body });
    await createAuditEntry({
      entityType: AuditEntityType.account, entityId: t.accountId, userId: user.id, action: AuditAction.updated,
      description: `Cambió a ${t.nombre} en la tarjeta (${JSON.stringify(body)})`,
    });
    return upd;
  });

  // Resumen de una tarjeta en un mes: sus gastos con quién los hizo y si son de
  // Voltia o personales, los pagos que recibió, y si el saldo cierra.
  app.get("/finance/tarjetas/:accountId/resumen", ver, async (request) => {
    const { accountId } = z.object({ accountId: z.string() }).parse(request.params);
    const q = z.object({ anio: z.coerce.number().int(), mes: z.coerce.number().int().min(1).max(12) }).parse(request.query);
    const a = await prisma.account.findFirst({ where: { id: accountId, deletedAt: null, tipo: AccountType.TARJETA } });
    if (!a) throw notFound("TARJETA_NOT_FOUND", "Tarjeta no encontrada");
    const { inicio, fin } = rangoMes(q.anio, q.mes);
    const movs = await prisma.financeMovement.findMany({
      where: { accountId, deletedAt: null, fecha: { gte: inicio, lt: fin }, status: { not: FinanceMovementStatus.PREVISTO } },
      include: { tarjetaTitular: true, supplier: { select: { nombre: true } } },
      orderBy: { fecha: "asc" },
    });
    const gastos = movs.filter((m) => m.tipoMovimiento === TipoMovimiento.GASTO);
    const pagos = movs.filter((m) => m.tipoMovimiento === TipoMovimiento.INGRESO);
    const clasif = (m: (typeof gastos)[number]) =>
      m.categoriaPrincipal === CategoriaPrincipal.CUENTA_SOCIO ? "SOCIO"
        : m.categoriaPrincipal === CategoriaPrincipal.ADELANTO_PERSONAL ? "ADELANTO"
          : !m.tarjetaTitularId ? "SIN_TITULAR"
            : m.tarjetaTitular?.regla === ReglaTarjeta.MIXTA && !m.tarjetaDecididoAt ? "SIN_DECIDIR" : "VOLTIA";
    const suma = (xs: typeof gastos) => r2(xs.reduce((acc, m) => acc + Number(m.monto), 0));
    return {
      tarjeta: { id: a.id, nombre: a.nombre, moneda: a.moneda },
      saldo: await saldoTarjeta(accountId),
      totales: {
        voltia: suma(gastos.filter((m) => clasif(m) === "VOLTIA")),
        socio: suma(gastos.filter((m) => clasif(m) === "SOCIO")),
        adelantos: suma(gastos.filter((m) => clasif(m) === "ADELANTO")),
        sinTitular: suma(gastos.filter((m) => clasif(m) === "SIN_TITULAR")),
        sinDecidir: suma(gastos.filter((m) => clasif(m) === "SIN_DECIDIR")),
        pagos: suma(pagos),
      },
      gastos: gastos.map((m) => ({
        id: m.id, fecha: toDateOnlyString(m.fecha), descripcion: m.descripcion, monto: Number(m.monto), moneda: m.moneda,
        proveedor: m.supplier?.nombre ?? null, categoria: m.categoriaPrincipal, clasificacion: clasif(m),
        titular: m.tarjetaTitular ? { id: m.tarjetaTitular.id, nombre: m.tarjetaTitular.nombre, regla: m.tarjetaTitular.regla } : null,
        descontadoAt: m.descontadoAt?.toISOString() ?? null,
      })),
      pagos: pagos.map((m) => ({ id: m.id, fecha: toDateOnlyString(m.fecha), descripcion: m.descripcion, monto: Number(m.monto) })),
    };
  });

  // Quién hizo el gasto y si es de Voltia o personal. Al elegir el titular se
  // aplica su regla (siempre personal / siempre Voltia); "clasificacion"
  // decide los de una tarjeta mixta o hace una excepción (con quién autorizó).
  app.patch("/finance/tarjetas/movimientos/:id", editar, async (request) => {
    const user = ensureUser(request);
    const { id } = z.object({ id: z.string() }).parse(request.params);
    const body = z.object({
      titularId: z.string().nullable().optional(),
      clasificacion: z.enum(["VOLTIA", "PERSONAL"]).optional(),
      // Categoría de Voltia cuando se pasa de personal a Voltia.
      categoriaVoltia: z.nativeEnum(CategoriaPrincipal).optional(),
      autorizadoPor: z.string().trim().max(80).optional(),
    }).strict().parse(request.body);
    const m = await prisma.financeMovement.findFirst({ where: { id, deletedAt: null }, include: { account: true } });
    if (!m || m.account?.tipo !== AccountType.TARJETA) throw notFound("MOVEMENT_NOT_FOUND", "Gasto de tarjeta no encontrado");
    await assertFechaAbierta(m.fecha);

    let titular = m.tarjetaTitularId ? await prisma.tarjetaTitular.findUnique({ where: { id: m.tarjetaTitularId } }) : null;
    if (body.titularId !== undefined) {
      titular = body.titularId ? await prisma.tarjetaTitular.findFirst({ where: { id: body.titularId, accountId: m.accountId! } }) : null;
      if (body.titularId && !titular) throw badRequest("TITULAR_INVALIDO", "Ese titular no es de esta tarjeta");
    }
    // Clasificación: la pedida, o la que manda la regla del titular.
    let clasificacion = body.clasificacion;
    if (!clasificacion && body.titularId !== undefined && titular) {
      if (titular.regla === ReglaTarjeta.PERSONAL) clasificacion = "PERSONAL";
      if (titular.regla === ReglaTarjeta.VOLTIA) clasificacion = "VOLTIA";
    }
    if (clasificacion === "PERSONAL" && !titular) throw badRequest("TITULAR_REQUERIDO", "Para marcarlo personal, decí quién lo hizo");
    if (clasificacion === "PERSONAL" && titular?.regla === ReglaTarjeta.VOLTIA && !body.autorizadoPor) {
      throw badRequest("AUTORIZACION_REQUERIDA", "Es una tarjeta de la empresa: anotá quién autorizó el gasto personal");
    }

    // Decidido: si se eligió explícitamente, o si la regla del titular decide sola.
    const data: Record<string, unknown> = {
      tarjetaTitularId: titular?.id ?? null,
      tarjetaDecididoAt: clasificacion ? new Date() : null,
    };
    if (clasificacion === "PERSONAL") {
      data.categoriaPrincipal = titular!.personalComo;
      if (body.autorizadoPor) data.personalAutorizadoPor = body.autorizadoPor;
    } else if (clasificacion === "VOLTIA" && PERSONALES.includes(m.categoriaPrincipal)) {
      data.categoriaPrincipal = body.categoriaVoltia && !PERSONALES.includes(body.categoriaVoltia) ? body.categoriaVoltia : CategoriaPrincipal.VARIABLE;
      data.descontadoAt = null;
      data.descontadoPorId = null;
      data.personalAutorizadoPor = null;
    }
    await prisma.financeMovement.update({ where: { id }, data });
    await createAuditEntry({
      entityType: AuditEntityType.finance_movement, entityId: id, userId: user.id, action: AuditAction.updated,
      description: `Tarjeta ${m.account!.nombre}: «${m.descripcion}» ${titular ? `de ${titular.nombre}` : "sin titular"}${clasificacion ? ` → ${clasificacion === "PERSONAL" ? "personal" : "de Voltia"}` : ""}${body.autorizadoPor ? ` (autorizó ${body.autorizadoPor})` : ""}`,
    });
    return { ok: true };
  });

  // Adelantos a descontar del sueldo y saldo de la cuenta del socio.
  app.get("/finance/personales", ver, async () => {
    const [adelantos, socio] = await Promise.all([
      prisma.financeMovement.findMany({
        where: { deletedAt: null, categoriaPrincipal: CategoriaPrincipal.ADELANTO_PERSONAL, tipoMovimiento: TipoMovimiento.GASTO },
        include: { tarjetaTitular: { select: { nombre: true } }, account: { select: { nombre: true } } },
        orderBy: { fecha: "desc" },
        take: 300,
      }),
      prisma.financeMovement.groupBy({
        by: ["tipoMovimiento", "moneda"],
        where: { deletedAt: null, categoriaPrincipal: CategoriaPrincipal.CUENTA_SOCIO },
        _sum: { monto: true },
      }),
    ]);
    const saldoSocio: Record<string, number> = {};
    for (const g of socio) {
      const signo = g.tipoMovimiento === TipoMovimiento.GASTO ? 1 : -1;
      saldoSocio[g.moneda] = r2((saldoSocio[g.moneda] ?? 0) + signo * Number(g._sum.monto ?? 0));
    }
    return {
      // Lo que el socio le debe a Voltia (gastos personales pagados por Voltia − lo que devolvió o se le canceló).
      saldoSocio,
      adelantos: adelantos.map((m) => ({
        id: m.id, fecha: toDateOnlyString(m.fecha), descripcion: m.descripcion, monto: Number(m.monto), moneda: m.moneda,
        persona: m.tarjetaTitular?.nombre ?? null, tarjeta: m.account?.nombre ?? null, autorizadoPor: m.personalAutorizadoPor,
        descontadoAt: m.descontadoAt?.toISOString() ?? null,
      })),
    };
  });

  app.post("/finance/personales/:id/descontado", editar, async (request) => {
    const user = ensureUser(request);
    const { id } = z.object({ id: z.string() }).parse(request.params);
    const { descontado } = z.object({ descontado: z.boolean() }).strict().parse(request.body);
    const m = await prisma.financeMovement.findFirst({ where: { id, deletedAt: null, categoriaPrincipal: CategoriaPrincipal.ADELANTO_PERSONAL } });
    if (!m) throw notFound("ADELANTO_NOT_FOUND", "Adelanto no encontrado");
    await prisma.financeMovement.update({
      where: { id },
      data: descontado ? { descontadoAt: new Date(), descontadoPorId: user.id } : { descontadoAt: null, descontadoPorId: null },
    });
    await createAuditEntry({
      entityType: AuditEntityType.finance_movement, entityId: id, userId: user.id, action: AuditAction.updated,
      description: descontado ? `Marcó descontado del sueldo el adelanto «${m.descripcion}»` : `Volvió a pendiente de descontar el adelanto «${m.descripcion}»`,
    });
    return { ok: true };
  });
}

// "Es este": resuelve un movimiento del banco con lo que se eligió de sus
// sugerencias (sugerir-banco.service.ts), registrando en Voltia PM lo que falta
// y dejándolo emparejado con el banco:
//   MOVIMIENTO       se le pone la cuenta (si no tenía)
//   DEUDA            pago desde la cuenta a esa factura (lo que sobre, FIFO)
//   DEUDA_PROVEEDOR  pago desde la cuenta, FIFO a sus facturas más viejas
//   COSTO_FIJO       gasto pagado del costo fijo para ese mes
//   COBRO            el cobro previsto pasa a cobrado (si entró menos, queda el resto previsto)
//   FACTURA          gasto pagado con la factura recibida vinculada
// Más: cargar de una vez los cargos del banco (comisiones, IVA) como gastos.

import {
  AuditAction,
  AuditEntityType,
  CategoriaPrincipal,
  EstadoAprobacion,
  FinanceMovementStatus,
  MetodoPago,
  MovementSourceType,
  Prisma,
  TipoMovimiento,
} from "@prisma/client";

import { prisma } from "../../lib/prisma.js";
import { badRequest, notFound } from "../../utils/errors.js";
import { toDateOnlyString } from "../../utils/dates.js";
import { createAuditEntry } from "../audit.service.js";
import { vincularBanco } from "./bank-reconciliation.service.js";
import { assertFechaAbierta } from "./cierre-mes.service.js";
import { deudasAbiertasProveedor, recalcMovementStatus, repartirFifo } from "./deuda-proveedor.service.js";
import { etiquetaCfe, resolverProveedor, tomarPendiente } from "./facturas-recibidas.service.js";
import { esCargoBancario } from "./sugerir-banco.service.js";

const MESES = ["enero", "febrero", "marzo", "abril", "mayo", "junio", "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre"];
const r2 = (n: number) => Math.round(n * 100) / 100;

async function cargarBanco(bankId: string) {
  const b = await prisma.bankMovement.findUnique({ where: { id: bankId }, include: { account: true } });
  if (!b) throw notFound("BANK_MOVEMENT_NOT_FOUND", "Movimiento del banco no encontrado");
  if (b.movementId || b.paymentId) throw badRequest("YA_EMPAREJADO", "Este movimiento del banco ya está emparejado.");
  await assertFechaAbierta(b.fecha);
  return b;
}

const ref = (b: { asunto: string | null; descripcion: string; documento: string | null }) =>
  (b.asunto || `${b.descripcion}${b.documento ? ` ${b.documento}` : ""}`).slice(0, 190);

/** Pago a un proveedor desde la cuenta del banco: primero a `primeraId`, el resto FIFO. */
async function pagarProveedor(b: Awaited<ReturnType<typeof cargarBanco>>, supplierId: string, primeraId: string | null, userId: string) {
  return prisma.$transaction(async (tx) => {
    const deudas = await deudasAbiertasProveedor(tx, supplierId, b.account.moneda);
    const p = await tx.payment.create({
      data: {
        supplierId, accountId: b.accountId, fecha: b.fecha, monto: b.monto, moneda: b.account.moneda,
        metodo: MetodoPago.TRANSFERENCIA, referencia: ref(b), notas: "Registrado desde el movimiento del banco", createdById: userId,
      },
    });
    let resto = Number(b.monto);
    const orden = primeraId ? [...deudas.filter((d) => d.id === primeraId), ...deudas.filter((d) => d.id !== primeraId)] : deudas;
    for (const a of repartirFifo(orden, resto)) {
      await tx.paymentApplication.create({ data: { paymentId: p.id, movementId: a.movementId, montoAplicado: new Prisma.Decimal(r2(a.monto)) } });
      await recalcMovementStatus(tx, a.movementId);
      resto -= a.monto;
    }
    return { paymentId: p.id, sobra: r2(resto) };
  });
}

export async function resolverBanco(bankId: string, clave: string, userId: string): Promise<string> {
  const b = await cargarBanco(bankId);
  const [tipo, refId, periodo] = clave.split(":");
  const monto = Number(b.monto);
  const fechaTxt = toDateOnlyString(b.fecha);
  let texto: string;

  if (tipo === "MOVIMIENTO") {
    const m = await prisma.financeMovement.findFirst({ where: { id: refId, deletedAt: null }, include: { account: true, bankMovement: true } });
    if (!m) throw notFound("MOVEMENT_NOT_FOUND", "Movimiento no encontrado");
    // Se puede pasar de cuenta solo si la otra no tiene lector del banco y no está emparejado allá.
    if (m.accountId && m.accountId !== b.accountId && (m.account?.numeroCuentaBanco || m.bankMovement)) {
      throw badRequest("CUENTA_DISTINTA", "Ese movimiento está en otra cuenta que ya se controla con su banco.");
    }
    if (m.moneda !== b.account.moneda) throw badRequest("MONEDA_DISTINTA", "Ese movimiento está en otra moneda.");
    const antes = m.account?.nombre ?? null;
    if (m.accountId !== b.accountId) await prisma.financeMovement.update({ where: { id: m.id }, data: { accountId: b.accountId } });
    await vincularBanco(b.id, { movementId: m.id }, userId);
    texto = antes && antes !== b.account.nombre
      ? `pasó "${m.descripcion}" de ${antes} a ${b.account.nombre} y lo emparejó con el banco`
      : `le puso la cuenta ${b.account.nombre} a "${m.descripcion}" y lo emparejó con el banco`;
  } else if (tipo === "DEUDA" || tipo === "DEUDA_PROVEEDOR") {
    let supplierId = refId;
    let primera: string | null = null;
    if (tipo === "DEUDA") {
      const d = await prisma.financeMovement.findFirst({ where: { id: refId, deletedAt: null }, select: { supplierId: true, id: true } });
      if (!d?.supplierId) throw notFound("DEUDA_NOT_FOUND", "Factura no encontrada");
      supplierId = d.supplierId;
      primera = d.id;
    }
    const s = await prisma.supplier.findFirst({ where: { id: supplierId }, select: { nombre: true } });
    const r = await pagarProveedor(b, supplierId, primera, userId);
    await vincularBanco(b.id, { paymentId: r.paymentId }, userId);
    texto = `registró el pago a ${s?.nombre} desde ${b.account.nombre}${r.sobra > 0.005 ? ` (quedan ${r.sobra} a favor)` : ""}`;
  } else if (tipo === "COSTO_FIJO") {
    const fc = await prisma.fixedCost.findFirst({ where: { id: refId, deletedAt: null } });
    if (!fc) throw notFound("FIXED_COST_NOT_FOUND", "Costo fijo no encontrado");
    const [anio, mes] = (periodo ?? "").split("-").map(Number);
    if (!anio || !mes) throw badRequest("PERIODO_INVALIDO", "Falta el mes del costo fijo.");
    const m = await prisma.financeMovement.create({
      data: {
        tipoMovimiento: TipoMovimiento.GASTO, categoriaPrincipal: CategoriaPrincipal.FIJO, status: FinanceMovementStatus.PAGADO,
        sourceType: MovementSourceType.MANUAL, estadoAprobacion: EstadoAprobacion.APROBADO,
        descripcion: `${fc.nombre} — ${MESES[mes - 1]} ${anio}`, monto: b.monto, moneda: b.account.moneda,
        fecha: b.fecha, mes, anio, accountId: b.accountId, fixedCostId: fc.id, pagado: true, impactaFlujo: true, creadoPorId: userId,
      },
    });
    await vincularBanco(b.id, { movementId: m.id }, userId);
    texto = `registró pagado ${fc.nombre} de ${MESES[mes - 1]} desde ${b.account.nombre}`;
  } else if (tipo === "COBRO") {
    const c = await prisma.financeMovement.findFirst({ where: { id: refId, deletedAt: null, status: FinanceMovementStatus.PREVISTO } });
    if (!c) throw notFound("COBRO_NOT_FOUND", "Cobro previsto no encontrado");
    const previsto = Number(c.monto);
    await prisma.$transaction(async (tx) => {
      await tx.financeMovement.update({
        where: { id: c.id },
        data: {
          status: FinanceMovementStatus.PAGADO, cobrado: true, monto: b.monto, accountId: b.accountId, fecha: b.fecha,
          mes: b.fecha.getUTCMonth() + 1, anio: b.fecha.getUTCFullYear(),
        },
      });
      // Si entró menos que lo previsto, lo que falta queda previsto con el mismo momento de la obra.
      if (previsto - monto > 0.5) {
        await tx.financeMovement.create({
          data: {
            tipoMovimiento: TipoMovimiento.INGRESO, categoriaPrincipal: c.categoriaPrincipal, status: FinanceMovementStatus.PREVISTO,
            sourceType: c.sourceType, estadoAprobacion: c.estadoAprobacion, descripcion: `${c.descripcion} (resto)`,
            monto: new Prisma.Decimal(r2(previsto - monto)), moneda: c.moneda, fecha: c.fecha, mes: c.mes, anio: c.anio,
            dueDate: c.dueDate, hitoCobro: c.hitoCobro, projectId: c.projectId, cobrado: false, pagado: false, impactaFlujo: true, creadoPorId: userId,
          },
        });
      }
    });
    await vincularBanco(b.id, { movementId: c.id }, userId);
    texto = `marcó cobrado "${c.descripcion}" en ${b.account.nombre}${previsto - monto > 0.5 ? " (el resto queda previsto)" : ""}`;
  } else if (tipo === "FACTURA") {
    const f = await prisma.facturaRecibida.findUnique({ where: { id: refId } });
    if (!f) throw notFound("FACTURA_RECIBIDA_NOT_FOUND", "Factura no encontrada");
    if (!f.supplierId) throw badRequest("SUPPLIER_REQUIRED", "Elegí primero de qué proveedor es la factura (en Facturas).");
    const movementId = await prisma.$transaction(async (tx) => {
      await tomarPendiente(tx, f.id);
      const s = await resolverProveedor(f.rutEmisor, f.supplierId!, tx);
      const m = await tx.financeMovement.create({
        data: {
          tipoMovimiento: TipoMovimiento.GASTO, categoriaPrincipal: CategoriaPrincipal.VARIABLE, status: FinanceMovementStatus.PAGADO,
          sourceType: MovementSourceType.MANUAL, estadoAprobacion: EstadoAprobacion.REGISTRADO, supplierId: s.id,
          accountId: b.accountId, descripcion: etiquetaCfe(f.tipoCfe, f.serie, f.numero), monto: b.monto, moneda: b.account.moneda,
          fecha: b.fecha, mes: b.fecha.getUTCMonth() + 1, anio: b.fecha.getUTCFullYear(), invoiceNumber: `${f.serie}-${f.numero}`,
          ...(f.moneda === b.account.moneda ? { montoNeto: f.totalNeto, montoIva: f.totalIva } : {}),
          pagado: true, impactaFlujo: true, creadoPorId: userId,
        },
      });
      await tx.facturaRecibida.update({ where: { id: f.id }, data: { supplierId: s.id, movementId: m.id, resueltaPorId: userId, resueltaAt: new Date() } });
      return m.id;
    });
    await vincularBanco(b.id, { movementId }, userId);
    texto = `creó el gasto pagado de la factura ${etiquetaCfe(f.tipoCfe, f.serie, f.numero)} desde ${b.account.nombre}`;
  } else {
    throw badRequest("SUGERENCIA_INVALIDA", "No sé qué hacer con esa sugerencia.");
  }

  await createAuditEntry({
    entityType: AuditEntityType.bank_movement,
    entityId: b.id,
    userId,
    action: AuditAction.updated,
    description: `Desde el movimiento del banco del ${fechaTxt} (${b.descripcion}${b.asunto ? ` · ${b.asunto}` : ""}): ${texto}`,
  });
  return texto;
}

/** Carga como gasto cada cargo del banco (comisiones, IVA…) que falta, emparejado. */
export async function cargarCargosBancarios(ids: string[], userId: string): Promise<number> {
  const filas = await prisma.bankMovement.findMany({
    where: { id: { in: ids }, movementId: null, paymentId: null, ignoradoAt: null, tipo: TipoMovimiento.GASTO },
    include: { account: true },
  });
  let n = 0;
  for (const b of filas) {
    if (!esCargoBancario(b)) continue;
    await assertFechaAbierta(b.fecha);
    const m = await prisma.financeMovement.create({
      data: {
        tipoMovimiento: TipoMovimiento.GASTO, categoriaPrincipal: CategoriaPrincipal.VARIABLE, status: FinanceMovementStatus.PAGADO,
        sourceType: MovementSourceType.MANUAL, estadoAprobacion: EstadoAprobacion.APROBADO,
        descripcion: `Cargo bancario: ${b.descripcion}`, monto: b.monto, moneda: b.account.moneda, fecha: b.fecha,
        mes: b.fecha.getUTCMonth() + 1, anio: b.fecha.getUTCFullYear(), accountId: b.accountId, pagado: true, impactaFlujo: true, creadoPorId: userId,
      },
    });
    await vincularBanco(b.id, { movementId: m.id }, userId);
    n++;
  }
  if (n) {
    await createAuditEntry({
      entityType: AuditEntityType.bank_movement, entityId: filas[0].id, userId, action: AuditAction.created,
      description: `Cargó ${n} cargos del banco (comisiones, IVA) como gastos, emparejados con el banco`,
    });
  }
  return n;
}

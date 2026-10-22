// Deuda con proveedores: estado de cada factura según lo que se le aplicó, y
// ajustes (pagos con metodo AJUSTE, sin cuenta: bajan la deuda sin ser plata).
//
// Lo usan los pagos y ajustes (api.routes.ts) y las notas de crédito recibidas
// (cuentas-por-pagar.routes.ts), por eso vive acá. También el cierre del saldo
// a favor viejo al arrancar la cuenta con un proveedor.

import { CategoriaPrincipal, EstadoAprobacion, FinanceMovementStatus, MetodoPago, Moneda, MovementSourceType, Prisma, TipoMovimiento } from "@prisma/client";

import { prisma } from "../../lib/prisma.js";
import { badRequest } from "../../utils/errors.js";
import { toDateOnlyString } from "../../utils/dates.js";

type PaymentApplicationLite = { montoAplicado: Prisma.Decimal };

/** Suma de aplicaciones (el caller pasa sólo las activas). */
export function sumApplications(apps: PaymentApplicationLite[]): number {
  return apps.reduce((acc, a) => acc + Number(a.montoAplicado), 0);
}

const serializeDateOnly = (d: Date) => toDateOnlyString(d);

/** Recalcula el status de un movement según sus applications activas y lo
 *  actualiza en DB. Retorna el balance final. Devuelve null si el movement
 *  no debería evaluarse (ej. INGRESO/AJUSTE). */
export async function recalcMovementStatus(
  tx: Prisma.TransactionClient,
  movementId: string,
): Promise<{ saldo: number; pagado: number; status: FinanceMovementStatus } | null> {
  const m = await tx.financeMovement.findFirst({
    where: { id: movementId, deletedAt: null },
    include: { paymentApplications: { include: { payment: { select: { deletedAt: true } } } } },
  });
  if (!m) return null;
  if (m.tipoMovimiento !== TipoMovimiento.GASTO) return null;
  const monto = Number(m.monto);
  const activeApps = m.paymentApplications.filter((a) => !a.payment.deletedAt);
  const pagado = sumApplications(activeApps);
  const saldo = Math.round((monto - pagado) * 100) / 100;

  // Reglas de transición automática:
  // - saldo === 0 → PAGADO
  // - 0 < pagado < monto → PARCIALMENTE_PAGADO
  // - pagado === 0 → mantener el status existente (A_PAGAR / COMPROMETIDO / etc.)
  let nextStatus = m.status;
  const data: Prisma.FinanceMovementUpdateInput = {};

  if (Math.abs(saldo) < 0.005) {
    // Pagado por completo
    nextStatus = FinanceMovementStatus.PAGADO;
    if (m.status !== FinanceMovementStatus.PAGADO) {
      // Tomar fecha del último Payment que aplica
      const ultimaApp = activeApps.length > 0
        ? await tx.paymentApplication.findFirst({
            // Un ajuste no es un pago: si la saldó un ajuste, la deuda conserva su fecha.
            where: { movementId, payment: { deletedAt: null, metodo: { not: MetodoPago.AJUSTE } } },
            orderBy: { payment: { fecha: "desc" } },
            include: { payment: true },
          })
        : null;
      if (ultimaApp) {
        const fechaPago = ultimaApp.payment.fecha;
        data.fecha = fechaPago;
        data.mes = fechaPago.getUTCMonth() + 1;
        data.anio = fechaPago.getUTCFullYear();
      }
      data.pagado = true;
    }
  } else if (pagado > 0 && saldo > 0) {
    nextStatus = FinanceMovementStatus.PARCIALMENTE_PAGADO;
  } else if (pagado === 0) {
    // Sin pagos activos: si estaba PAGADO o PARCIALMENTE_PAGADO por aplicaciones,
    // volver al estado A_PAGAR (si tiene dueDate) o COMPROMETIDO.
    if (m.status === FinanceMovementStatus.PAGADO || m.status === FinanceMovementStatus.PARCIALMENTE_PAGADO) {
      nextStatus = m.dueDate ? FinanceMovementStatus.A_PAGAR : FinanceMovementStatus.COMPROMETIDO;
      data.pagado = false;
    }
  }

  if (nextStatus !== m.status) {
    data.status = nextStatus;
  }
  if (Object.keys(data).length > 0) {
    await tx.financeMovement.update({ where: { id: movementId }, data });
  }
  return { saldo, pagado, status: nextStatus };
}


export const ESTADOS_DEUDA_ABIERTA = [
  FinanceMovementStatus.COMPROMETIDO,
  FinanceMovementStatus.A_PAGAR,
  FinanceMovementStatus.PARCIALMENTE_PAGADO,
];

/** Deudas abiertas de un proveedor en una moneda, con lo que queda por pagar de cada una. */
export async function deudasAbiertasProveedor(db: Prisma.TransactionClient | typeof prisma, supplierId: string, moneda: Moneda) {
  const rows = await db.financeMovement.findMany({
    where: {
      supplierId, moneda, deletedAt: null,
      tipoMovimiento: TipoMovimiento.GASTO,
      status: { in: ESTADOS_DEUDA_ABIERTA },
    },
    include: {
      paymentApplications: { include: { payment: { select: { deletedAt: true } } } },
      facturaRecibida: { select: { id: true } },
    },
    orderBy: [{ fecha: "asc" }, { createdAt: "asc" }],
  });
  return rows
    .map((m) => {
      const saldo = Math.round((Number(m.monto) - sumApplications(m.paymentApplications.filter((a) => !a.payment.deletedAt))) * 100) / 100;
      return {
        id: m.id,
        fecha: serializeDateOnly(m.fecha),
        vencimiento: m.dueDate ? serializeDateOnly(m.dueDate) : null,
        descripcion: m.descripcion,
        invoiceNumber: m.invoiceNumber,
        monto: Number(m.monto),
        saldo,
        deFacturaRecibida: m.facturaRecibida != null,
      };
    })
    .filter((d) => d.saldo > 0.005);
}

/** Crea un ajuste aplicado a deudas puntuales, dentro de una transacción. */
export async function crearAjusteEnTx(
  tx: Prisma.TransactionClient,
  input: { supplierId: string; moneda: Moneda; fecha: Date; motivo: string; userId: string; aplicaciones: Array<{ movementId: string; monto: number }> },
) {
  const total = Math.round(input.aplicaciones.reduce((a, x) => a + x.monto, 0) * 100) / 100;
  if (total <= 0) throw badRequest("AJUSTE_VACIO", "El ajuste no tiene monto.");
  const abiertas = new Map((await deudasAbiertasProveedor(tx, input.supplierId, input.moneda)).map((d) => [d.id, d]));
  for (const a of input.aplicaciones) {
    const d = abiertas.get(a.movementId);
    if (!d) throw badRequest("DEUDA_NO_ABIERTA", "Una de las deudas ya no está abierta.");
    if (a.monto > d.saldo + 0.005) throw badRequest("AJUSTE_SUPERA", `El ajuste supera lo que queda de "${d.descripcion}" (${d.saldo.toFixed(2)}).`);
  }
  const p = await tx.payment.create({
    data: {
      supplierId: input.supplierId,
      accountId: null,
      fecha: input.fecha,
      monto: new Prisma.Decimal(total),
      moneda: input.moneda,
      metodo: MetodoPago.AJUSTE,
      referencia: `Ajuste: ${input.motivo}`.slice(0, 190),
      notas: input.motivo,
      createdById: input.userId,
    },
  });
  for (const a of input.aplicaciones) {
    await tx.paymentApplication.create({
      data: { paymentId: p.id, movementId: a.movementId, montoAplicado: new Prisma.Decimal(Math.round(a.monto * 100) / 100) },
    });
    await recalcMovementStatus(tx, a.movementId);
  }
  return { id: p.id, total };
}

/**
 * Lo que sobra de pagos viejos al proveedor (saldo a favor) hasta `fecha`, en
 * una moneda: al arrancar la cuenta con su estado de cuenta, eso ya está
 * contemplado por el proveedor y no puede quedar para comerse la próxima
 * factura. Se cierra con un movimiento "Saldo a favor anterior" cancelado por
 * esos mismos pagos: no es plata nueva (el movimiento queda pagado por pagos ya
 * contados en caja y resultados, y por eso no cuenta de nuevo en ningún lado).
 */
export async function cerrarSaldoAFavorEnTx(
  tx: Prisma.TransactionClient,
  input: { supplierId: string; moneda: Moneda; fecha: Date; descripcion: string; userId: string },
): Promise<{ id: string; total: number } | null> {
  const pagos = await tx.payment.findMany({
    where: {
      supplierId: input.supplierId, moneda: input.moneda, deletedAt: null,
      metodo: { not: MetodoPago.AJUSTE }, fecha: { lte: input.fecha }, monto: { gt: 0 },
    },
    include: { applications: { include: { movement: { select: { deletedAt: true } } } } },
    orderBy: { fecha: "asc" },
  });
  const sobrantes = pagos
    .map((p) => ({
      id: p.id,
      resto: Math.round((Number(p.monto) - p.applications
        .filter((a) => !a.movement.deletedAt)
        .reduce((a, x) => a + Number(x.montoAplicado), 0)) * 100) / 100,
    }))
    .filter((p) => p.resto > 0.005);
  const total = Math.round(sobrantes.reduce((a, p) => a + p.resto, 0) * 100) / 100;
  if (total <= 0.005) return null;
  const m = await tx.financeMovement.create({
    data: {
      tipoMovimiento: TipoMovimiento.GASTO,
      categoriaPrincipal: CategoriaPrincipal.PAGO_PROVEEDOR,
      status: FinanceMovementStatus.A_PAGAR,
      sourceType: MovementSourceType.MANUAL,
      estadoAprobacion: EstadoAprobacion.REGISTRADO,
      supplierId: input.supplierId,
      descripcion: input.descripcion,
      monto: new Prisma.Decimal(total),
      moneda: input.moneda,
      fecha: input.fecha,
      dueDate: input.fecha,
      mes: input.fecha.getUTCMonth() + 1,
      anio: input.fecha.getUTCFullYear(),
      pagado: false,
      impactaFlujo: false,
      creadoPorId: input.userId,
    },
  });
  for (const p of sobrantes) {
    await tx.paymentApplication.create({
      data: { paymentId: p.id, movementId: m.id, montoAplicado: new Prisma.Decimal(p.resto) },
    });
  }
  await recalcMovementStatus(tx, m.id);
  return { id: m.id, total };
}

/** Reparte un monto FIFO sobre las deudas abiertas (para bajar una diferencia). */
export function repartirFifo(deudas: Array<{ id: string; saldo: number }>, monto: number) {
  const out: Array<{ movementId: string; monto: number }> = [];
  let resto = Math.round(monto * 100) / 100;
  for (const d of deudas) {
    if (resto <= 0.005) break;
    const m = Math.min(d.saldo, resto);
    out.push({ movementId: d.id, monto: Math.round(m * 100) / 100 });
    resto = Math.round((resto - m) * 100) / 100;
  }
  if (resto > 0.005) throw badRequest("AJUSTE_SUPERA_DEUDA", "El ajuste es mayor que todo lo que se le debe al proveedor en esa moneda.");
  return out;
}


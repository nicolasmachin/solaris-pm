// Cuentas por pagar: cuánto se le debe a cada proveedor, para cuándo, y cuánto
// del límite de crédito está usado.
//
// La deuda es la misma que ya usan la ficha del proveedor y el flujo de fondos:
// facturas GASTO con proveedor en COMPROMETIDO / A_PAGAR / PARCIALMENTE_PAGADO,
// por su saldo (monto menos lo aplicado de pagos vigentes). El saldo a favor
// (pagos sin imputar) se muestra aparte y se resta para el neto, igual que en la
// ficha: no se reparte entre facturas.

import { FinanceMovementStatus, Moneda, TipoMovimiento } from "@prisma/client";

import { prisma } from "../../lib/prisma.js";
import { addDays, diffInDays, toDateOnlyString, todayUtc } from "../../utils/dates.js";
import { accumulateSupplierSaldoAFavor } from "../supplier-balance.service.js";

/** Vencimiento de una factura: la fecha de emisión más el plazo del proveedor. */
export function calcularVencimiento(fechaEmision: Date, plazoCreditoDias: number): Date {
  return addDays(fechaEmision, plazoCreditoDias);
}

const ESTADOS_DEUDA = [
  FinanceMovementStatus.COMPROMETIDO,
  FinanceMovementStatus.A_PAGAR,
  FinanceMovementStatus.PARCIALMENTE_PAGADO,
];

export type Tramo = "VENCIDO" | "HASTA_7" | "HASTA_30" | "MAS_30";

/** En qué tramo cae una factura según los días que le faltan para vencer. */
export function tramoDe(diasParaVencer: number): Tramo {
  if (diasParaVencer < 0) return "VENCIDO";
  if (diasParaVencer <= 7) return "HASTA_7";
  if (diasParaVencer <= 30) return "HASTA_30";
  return "MAS_30";
}

type Totales = Record<Tramo, number> & { total: number };

function totalesVacios(): Totales {
  return { total: 0, VENCIDO: 0, HASTA_7: 0, HASTA_30: 0, MAS_30: 0 };
}

const r2 = (n: number) => Math.round(n * 100) / 100;

function redondear(t: Totales): Totales {
  return {
    total: r2(t.total), VENCIDO: r2(t.VENCIDO), HASTA_7: r2(t.HASTA_7),
    HASTA_30: r2(t.HASTA_30), MAS_30: r2(t.MAS_30),
  };
}

export async function getCuentasPorPagar(hoy: Date = todayUtc()) {
  const [proveedores, facturas, pagos] = await Promise.all([
    prisma.supplier.findMany({
      where: { deletedAt: null },
      select: {
        id: true, nombre: true, rut: true, activo: true,
        plazoCreditoDias: true, limiteCredito: true, limiteCreditoMoneda: true,
      },
    }),
    prisma.financeMovement.findMany({
      where: {
        deletedAt: null,
        supplierId: { not: null },
        tipoMovimiento: TipoMovimiento.GASTO,
        status: { in: ESTADOS_DEUDA },
      },
      select: {
        id: true, supplierId: true, descripcion: true, invoiceNumber: true,
        monto: true, moneda: true, fecha: true, dueDate: true, expectedDate: true, status: true,
        project: { select: { id: true, code: true, clientName: true } },
        paymentApplications: {
          where: { payment: { deletedAt: null } },
          select: { montoAplicado: true },
        },
      },
    }),
    prisma.payment.findMany({
      where: { deletedAt: null },
      select: {
        supplierId: true, monto: true, moneda: true,
        applications: { select: { montoAplicado: true } },
      },
    }),
  ]);

  const saldoAFavor = accumulateSupplierSaldoAFavor(pagos);

  type FacturaDto = {
    id: string; descripcion: string; invoiceNumber: string | null;
    monto: number; saldo: number; moneda: Moneda;
    fechaEmision: string; vencimiento: string; diasParaVencer: number; tramo: Tramo;
    status: FinanceMovementStatus;
    project: { id: string; code: string; clientName: string } | null;
  };
  const porProveedor = new Map<string, { USD: Totales; UYU: Totales; facturas: FacturaDto[] }>();
  const general = { USD: totalesVacios(), UYU: totalesVacios() };

  for (const f of facturas) {
    if (!f.supplierId) continue;
    const aplicado = f.paymentApplications.reduce((a, p) => a + Number(p.montoAplicado), 0);
    const saldo = Number(f.monto) - aplicado;
    if (saldo <= 0.005) continue;
    // Las facturas cargadas antes de exigir vencimiento caen a la fecha esperada
    // o a la de emisión: mismo criterio que el flujo de fondos.
    const venc = f.dueDate ?? f.expectedDate ?? f.fecha;
    const dias = diffInDays(hoy, venc);
    const tramo = tramoDe(dias);

    let p = porProveedor.get(f.supplierId);
    if (!p) {
      p = { USD: totalesVacios(), UYU: totalesVacios(), facturas: [] };
      porProveedor.set(f.supplierId, p);
    }
    for (const t of [p[f.moneda], general[f.moneda]]) {
      t.total += saldo;
      t[tramo] += saldo;
    }
    p.facturas.push({
      id: f.id, descripcion: f.descripcion, invoiceNumber: f.invoiceNumber,
      monto: r2(Number(f.monto)), saldo: r2(saldo), moneda: f.moneda,
      fechaEmision: toDateOnlyString(f.fecha)!, vencimiento: toDateOnlyString(venc)!,
      diasParaVencer: dias, tramo, status: f.status, project: f.project,
    });
  }

  const filas = proveedores
    .map((s) => {
      const p = porProveedor.get(s.id);
      const favor = saldoAFavor.get(s.id) ?? { USD: 0, UYU: 0 };
      if (!p && favor.USD <= 0.005 && favor.UYU <= 0.005) return null;
      const deuda = p ?? { USD: totalesVacios(), UYU: totalesVacios(), facturas: [] };
      const limite = s.limiteCredito != null ? Number(s.limiteCredito) : null;
      // El límite se mide contra la deuda neta en su propia moneda: no se
      // convierte, igual que el resto del saldo de proveedores.
      const usado = r2(Math.max(0, deuda[s.limiteCreditoMoneda].total - favor[s.limiteCreditoMoneda]));
      deuda.facturas.sort((a, b) => a.vencimiento.localeCompare(b.vencimiento));
      return {
        supplier: {
          id: s.id, nombre: s.nombre, rut: s.rut, activo: s.activo,
          plazoCreditoDias: s.plazoCreditoDias,
          limiteCredito: limite, limiteCreditoMoneda: s.limiteCreditoMoneda,
        },
        USD: redondear(deuda.USD),
        UYU: redondear(deuda.UYU),
        saldoAFavor: { USD: r2(favor.USD), UYU: r2(favor.UYU) },
        neto: { USD: r2(deuda.USD.total - favor.USD), UYU: r2(deuda.UYU.total - favor.UYU) },
        limite: limite != null
          ? { monto: limite, moneda: s.limiteCreditoMoneda, usado, disponible: r2(limite - usado), excedido: usado > limite + 0.005 }
          : null,
        proximoVencimiento: deuda.facturas[0]?.vencimiento ?? null,
        facturas: deuda.facturas,
      };
    })
    .filter((x): x is NonNullable<typeof x> => x !== null)
    .sort((a, b) => (b.USD.VENCIDO + b.UYU.VENCIDO) - (a.USD.VENCIDO + a.UYU.VENCIDO)
      || (a.proximoVencimiento ?? "9999").localeCompare(b.proximoVencimiento ?? "9999"));

  return {
    hoy: toDateOnlyString(hoy),
    totales: { USD: redondear(general.USD), UYU: redondear(general.UYU) },
    proveedores: filas,
  };
}

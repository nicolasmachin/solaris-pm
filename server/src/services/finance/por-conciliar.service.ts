// "Por conciliar": todo lo que falta que se encuentre, en una sola lista para el
// Inicio de Finanzas. Se calcula al mirar (lo que se carga o confirma se
// refleja enseguida). Junta las tres puntas:
//  - banco → Voltia PM: lo que leyó el banco y no está cargado;
//  - Voltia PM → banco: lo pagado/cobrado desde una cuenta del banco que el banco no muestra;
//  - facturas recibidas → Voltia PM: las que están por revisar;
//  - posibles duplicados: dos gastos del mismo proveedor, mismo monto, a ±7 días.

import { EstadoFacturaRecibida, FinanceMovementStatus, TipoMovimiento } from "@prisma/client";

import { prisma } from "../../lib/prisma.js";
import { diffInDays, toDateOnlyString } from "../../utils/dates.js";
import { pendientesPorCuenta, sinBancoPorCuenta } from "./bank-reconciliation.service.js";

const DIAS_DUPLICADO = 7;

export async function porConciliar() {
  const [cuentas, sinBanco, porRevisar, duplicados] = await Promise.all([
    pendientesPorCuenta(),
    sinBancoPorCuenta(),
    facturasPorRevisar(),
    posiblesDuplicados(),
  ]);
  return {
    banco: cuentas.map((c) => ({ accountId: c.accountId, nombre: c.nombre, moneda: c.moneda, faltaCargar: c.pendientes.length, bancoLeidoEn: c.bancoLeidoEn })),
    sinBanco,
    facturas: porRevisar,
    duplicados,
  };
}

async function facturasPorRevisar() {
  const filas = await prisma.facturaRecibida.findMany({
    where: { estado: EstadoFacturaRecibida.PENDIENTE },
    select: { id: true, supplierId: true, fechaEmision: true },
  });
  const hoy = new Date();
  return {
    total: filas.length,
    sinProveedor: filas.filter((f) => !f.supplierId).length,
    // Más de una semana sin revisar: alguien se olvidó.
    atrasadas: filas.filter((f) => diffInDays(f.fechaEmision, hoy) > 7).length,
  };
}

/** Pares de gastos del mismo proveedor, misma moneda y mismo monto, a ±7 días. */
async function posiblesDuplicados() {
  const desde = new Date(Date.now() - 120 * 86_400_000);
  const movs = await prisma.financeMovement.findMany({
    where: {
      deletedAt: null,
      tipoMovimiento: TipoMovimiento.GASTO,
      supplierId: { not: null },
      fecha: { gte: desde },
      // Un previsto todavía no es un gasto.
      status: { not: FinanceMovementStatus.PREVISTO },
    },
    select: {
      id: true, supplierId: true, moneda: true, monto: true, fecha: true, descripcion: true, invoiceNumber: true,
      supplier: { select: { nombre: true } },
    },
    orderBy: { fecha: "asc" },
  });
  const grupos = new Map<string, typeof movs>();
  for (const m of movs) {
    const k = `${m.supplierId}|${m.moneda}|${Number(m.monto).toFixed(2)}`;
    grupos.set(k, [...(grupos.get(k) ?? []), m]);
  }
  const out: Array<{ proveedor: string; moneda: string; monto: number; a: Dup; b: Dup }> = [];
  for (const g of grupos.values()) {
    for (let i = 0; i < g.length; i++) {
      for (let j = i + 1; j < g.length; j++) {
        const a = g[i];
        const b = g[j];
        if (Math.abs(diffInDays(a.fecha, b.fecha)) > DIAS_DUPLICADO) continue;
        // Dos facturas con número distinto no son el mismo gasto.
        if (a.invoiceNumber && b.invoiceNumber && a.invoiceNumber !== b.invoiceNumber) continue;
        out.push({ proveedor: a.supplier!.nombre, moneda: a.moneda, monto: Number(a.monto), a: dup(a), b: dup(b) });
      }
    }
  }
  return out;
}

type Dup = { id: string; fecha: string | null; descripcion: string; invoiceNumber: string | null };
function dup(m: { id: string; fecha: Date; descripcion: string; invoiceNumber: string | null }): Dup {
  return { id: m.id, fecha: toDateOnlyString(m.fecha), descripcion: m.descripcion, invoiceNumber: m.invoiceNumber };
}

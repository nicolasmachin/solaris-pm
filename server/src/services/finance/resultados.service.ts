// Estado de resultados (criterio caja).
//
// Es la lógica de la pestaña Finanzas → Estado de resultados, extraída del
// handler de `GET /finance/results` para que la usen la pantalla y el conector
// MCP sin dos copias que se puedan despegar. El cálculo es el mismo, línea por
// línea; lo único nuevo es que recibe el rango ya resuelto, así que acepta
// cualquier período y no solo mes, trimestre o año.
//
// Criterio de caja:
//  - movimientos con status PAGADO cuya `fecha` cae en [fechaInicio, fechaFin);
//  - sin ajustes de conciliación;
//  - los gastos pagados vía Payment (facturas de proveedor) NO se cuentan por
//    el movimiento sino por el pago real del período, para reflejar pagos
//    parciales en el mes en que salió la plata.
//
// ⚠️ Los pesos se pasan a dólares con la ÚLTIMA cotización cargada, no con la
// del movimiento ni la del mes. Consecuencia: el resultado de un mes pasado
// cambia (un poco) cada vez que se carga una cotización nueva. Es el
// comportamiento de la pantalla y se conserva para que el chat dé el mismo
// número; está anotado como decisión a revisar en el manual.

import {
  CategoriaPrincipal,
  FinanceMovementStatus,
  Moneda,
  TipoMovimiento,
} from "@prisma/client";

import { prisma } from "../../lib/prisma.js";
import { conversorUsd, ultimoUsdToUyu } from "./tipo-cambio.js";

export type PeriodoResultados = "MENSUAL" | "TRIMESTRAL" | "ANUAL";

export type ResultItem = {
  id: string;
  fecha: string;
  descripcion: string;
  monto: number;
  moneda: Moneda;
  projectClientName: string | null;
  projectCode: string | null;
  supplierName: string | null;
};

/** Rango [inicio, fin) en UTC de un mes, trimestre o año. */
export function rangeForPeriod(
  periodo: PeriodoResultados,
  anio: number,
  mes?: number,
  trimestre?: number,
) {
  if (periodo === "MENSUAL") {
    const m = mes ?? 1;
    return {
      fechaInicio: new Date(Date.UTC(anio, m - 1, 1)),
      fechaFin: new Date(Date.UTC(anio, m, 1)),
    };
  }
  if (periodo === "TRIMESTRAL") {
    const t = Math.max(1, Math.min(4, trimestre ?? 1));
    const startMonth = (t - 1) * 3;
    return {
      fechaInicio: new Date(Date.UTC(anio, startMonth, 1)),
      fechaFin: new Date(Date.UTC(anio, startMonth + 3, 1)),
    };
  }
  return {
    fechaInicio: new Date(Date.UTC(anio, 0, 1)),
    fechaFin: new Date(Date.UTC(anio + 1, 0, 1)),
  };
}

export async function calcularEstadoResultados(fechaInicio: Date, fechaFin: Date) {
  const fallbackUsdToUyu = await ultimoUsdToUyu();
  const toUsd = conversorUsd(fallbackUsdToUyu);

  const movements = await prisma.financeMovement.findMany({
    where: {
      status: FinanceMovementStatus.PAGADO,
      deletedAt: null,
      fecha: { gte: fechaInicio, lt: fechaFin },
      // Excluir ajustes de conciliación: no son operación, son ruido contable.
      categoriaPrincipal: { not: CategoriaPrincipal.AJUSTE_CONCILIACION },
      // Los gastos pagados vía Payment se cuentan por el pago real del mes
      // (query `payments` más abajo), no por el movimiento. Se excluyen acá
      // para no duplicar.
      paymentApplications: { none: { payment: { deletedAt: null } } },
    },
    include: {
      project: { select: { id: true, code: true, clientName: true } },
      supplier: { select: { nombre: true } },
      fixedCost: { select: { nombre: true } },
    },
    orderBy: { fecha: "asc" },
  });

  // Pagos reales del período (criterio caja): cada Payment cuenta como salida a
  // proveedor en el mes de su fecha, por su monto completo.
  const payments = await prisma.payment.findMany({
    where: { deletedAt: null, fecha: { gte: fechaInicio, lt: fechaFin } },
    include: { supplier: { select: { nombre: true } } },
    orderBy: { fecha: "asc" },
  });
  const paymentItems: ResultItem[] = payments.map((p) => ({
    id: p.id,
    fecha: p.fecha.toISOString(),
    descripcion: `Pago a ${p.supplier?.nombre ?? "proveedor"}${p.referencia ? ` · ${p.referencia}` : ""}`,
    monto: Number(p.monto),
    moneda: p.moneda,
    projectClientName: null,
    projectCode: null,
    supplierName: p.supplier?.nombre ?? null,
  }));
  const paymentsTotalUsd = payments.reduce((s, p) => s + toUsd(Number(p.monto), p.moneda), 0);

  function fmtItem(m: (typeof movements)[number]): ResultItem {
    return {
      id: m.id,
      fecha: m.fecha.toISOString(),
      descripcion: m.descripcion,
      monto: Number(m.monto),
      moneda: m.moneda,
      projectClientName: m.project?.clientName ?? null,
      projectCode: m.project?.code ?? null,
      supplierName: m.supplier?.nombre ?? null,
    };
  }

  const sumUsd = (rows: typeof movements) =>
    rows.reduce((s, m) => s + toUsd(Number(m.monto), m.moneda), 0);

  const ingresosRows = movements.filter((m) => m.tipoMovimiento === TipoMovimiento.INGRESO);
  const egresosRows = movements.filter((m) => m.tipoMovimiento === TipoMovimiento.GASTO);

  const fijos = egresosRows.filter((m) => m.categoriaPrincipal === CategoriaPrincipal.FIJO);
  const variables = egresosRows.filter((m) => m.categoriaPrincipal === CategoriaPrincipal.VARIABLE);
  const salidasProyecto = egresosRows.filter(
    (m) => m.categoriaPrincipal === CategoriaPrincipal.PROYECTO_SALIDA,
  );
  const pagoProveedores = egresosRows.filter(
    (m) => m.categoriaPrincipal === CategoriaPrincipal.PAGO_PROVEEDOR,
  );
  const comprasStock = egresosRows.filter(
    (m) => m.categoriaPrincipal === CategoriaPrincipal.COMPRA_STOCK,
  );
  const otrosCats = new Set<CategoriaPrincipal>([
    CategoriaPrincipal.FIJO,
    CategoriaPrincipal.VARIABLE,
    CategoriaPrincipal.PROYECTO_SALIDA,
    CategoriaPrincipal.PAGO_PROVEEDOR,
    CategoriaPrincipal.COMPRA_STOCK,
  ]);
  const otros = egresosRows.filter((m) => !otrosCats.has(m.categoriaPrincipal));

  type ProjectGroup = {
    projectId: string;
    clientName: string;
    code: string;
    total: number;
    items: ResultItem[];
  };
  const byProjectMap = new Map<string, ProjectGroup>();
  for (const m of salidasProyecto) {
    const key = m.projectId ?? "sin-proyecto";
    let g = byProjectMap.get(key);
    if (!g) {
      g = {
        projectId: m.projectId ?? "",
        clientName: m.project?.clientName ?? "Sin proyecto",
        code: m.project?.code ?? "",
        total: 0,
        items: [],
      };
      byProjectMap.set(key, g);
    }
    g.total += toUsd(Number(m.monto), m.moneda);
    g.items.push(fmtItem(m));
  }
  const byProject = Array.from(byProjectMap.values()).sort((a, b) => b.total - a.total);

  // Pago a proveedores = movimientos PAGO_PROVEEDOR residuales (pagados sin
  // Payment asociado, caso raro) + los pagos reales del período.
  const pagoProveedoresItems = [...pagoProveedores.map(fmtItem), ...paymentItems];
  const pagoProveedoresTotal = sumUsd(pagoProveedores) + paymentsTotalUsd;

  const totalIngresos = sumUsd(ingresosRows);
  // egresosRows ya excluye lo pagado vía Payment; se suman los pagos reales aparte.
  const totalEgresos = sumUsd(egresosRows) + paymentsTotalUsd;
  const resultado = totalIngresos - totalEgresos;
  const rentabilidad =
    totalIngresos > 0 ? Math.round((resultado / totalIngresos) * 1000) / 10 : 0;

  return {
    fechaInicio: fechaInicio.toISOString(),
    fechaFin: fechaFin.toISOString(),
    fallbackUsdToUyu,
    ingresos: { total: totalIngresos, items: ingresosRows.map(fmtItem) },
    egresos: {
      total: totalEgresos,
      costosFijos: {
        total: sumUsd(fijos),
        items: fijos.map((m) => ({ ...fmtItem(m), descripcion: m.fixedCost?.nombre ?? m.descripcion })),
      },
      costosVariables: { total: sumUsd(variables), items: variables.map(fmtItem) },
      salidasProyecto: { total: sumUsd(salidasProyecto), byProject },
      pagoProveedores: { total: pagoProveedoresTotal, items: pagoProveedoresItems },
      comprasStock: { total: sumUsd(comprasStock), items: comprasStock.map(fmtItem) },
      otros: { total: sumUsd(otros), items: otros.map(fmtItem) },
    },
    resultado,
    rentabilidad,
  };
}

export type EstadoResultados = Awaited<ReturnType<typeof calcularEstadoResultados>>;

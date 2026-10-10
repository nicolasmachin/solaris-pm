// Posición financiera: lo que nos deben y lo que debemos, por vencimiento.
//
// Es el complemento de la caja (saldo de cuentas, que calcula el flujo de
// fondos): sumado a ella da cuánto tendría Voltia si hoy cobrara y pagara todo.
// Todo se lleva a USD con la cotización vigente, para poder sumar; cada parte
// conserva además su desglose.
//
// Nos deben = saldo pendiente de cada obra vendida (presupuesto − cobrado, mismo
// criterio que la pantalla Cobros). Lo que tiene fecha sale de los cobros
// previstos (el plan de pagos); el resto queda "sin fecha".
//
// Debemos = facturas de proveedores (Cuentas por pagar) + otros compromisos a
// pagar sin proveedor + comisiones de asesores pendientes + pagos a instaladores
// pendientes. Los costos fijos no entran: no son deuda hasta que se devengan.

import {
  CategoriaPrincipal,
  CommissionStatus,
  FinanceMovementStatus,
  InstallerPaymentStatus,
  Moneda,
  ProjectStatus,
  TipoMovimiento,
} from "@prisma/client";

import { prisma } from "../../lib/prisma.js";
import { diffInDays, todayUtc } from "../../utils/dates.js";
import { listarCobrosPorProyecto, movimientoEnUsd } from "./cobros.service.js";
import { getCuentasPorPagar, tramoDe, type Tramo } from "./cuentas-por-pagar.service.js";
import { ultimoUsdToUyu } from "./tipo-cambio.js";

type Tramos = Record<Tramo, number> & { SIN_FECHA: number; total: number };

const vacio = (): Tramos => ({ VENCIDO: 0, HASTA_7: 0, HASTA_30: 0, MAS_30: 0, SIN_FECHA: 0, total: 0 });
const r2 = (n: number) => Math.round(n * 100) / 100;
function redondear(t: Tramos): Tramos {
  return Object.fromEntries(Object.entries(t).map(([k, v]) => [k, r2(v)])) as Tramos;
}
function sumar(t: Tramos, monto: number, fecha: Date | null, hoy: Date) {
  t.total += monto;
  if (!fecha) t.SIN_FECHA += monto;
  else t[tramoDe(diffInDays(hoy, fecha))] += monto;
}

export async function getPosicionFinanciera(hoy: Date = todayUtc()) {
  const usdToUyu = await ultimoUsdToUyu();
  const aUsd = (monto: number, moneda: Moneda) => (moneda === Moneda.USD ? monto : usdToUyu > 0 ? monto / usdToUyu : 0);

  // ── Nos deben ──────────────────────────────────────────────────────────────
  const cobros = await listarCobrosPorProyecto({});
  const pendientePorProyecto = new Map(cobros.projects.map((p) => [p.id, p.saldoPendienteUSD]));

  const previstos = await prisma.financeMovement.findMany({
    where: {
      deletedAt: null,
      tipoMovimiento: TipoMovimiento.INGRESO,
      status: FinanceMovementStatus.PREVISTO,
      cobrado: false,
      categoriaPrincipal: { not: CategoriaPrincipal.SEGURO_GRANIZO },
      projectId: { not: null },
      project: { deletedAt: null, status: { notIn: [ProjectStatus.ARCHIVED, ProjectStatus.PROSPECT] } },
    },
    select: { projectId: true, monto: true, moneda: true, tipoCambio: true, fecha: true, dueDate: true, expectedDate: true },
    orderBy: [{ dueDate: "asc" }, { fecha: "asc" }],
  });

  const nosDeben = vacio();
  const previstoPorProyecto = new Map<string, number>();
  for (const m of previstos) {
    const pid = m.projectId!;
    // Un previsto nunca suma más que lo que la obra todavía debe: si el plan
    // quedó desfasado con el presupuesto, manda el saldo de la obra.
    const tope = (pendientePorProyecto.get(pid) ?? 0) - (previstoPorProyecto.get(pid) ?? 0);
    const usd = Math.min(movimientoEnUsd(m, usdToUyu), Math.max(0, tope));
    if (usd <= 0.005) continue;
    previstoPorProyecto.set(pid, (previstoPorProyecto.get(pid) ?? 0) + usd);
    sumar(nosDeben, usd, m.dueDate ?? m.expectedDate ?? m.fecha, hoy);
  }
  // Lo que las obras deben y no tiene una cuota prevista: sin fecha.
  let obrasSinPlanCompleto = 0;
  for (const p of cobros.projects) {
    const resto = p.saldoPendienteUSD - (previstoPorProyecto.get(p.id) ?? 0);
    if (resto > 0.5) {
      obrasSinPlanCompleto++;
      sumar(nosDeben, resto, null, hoy);
    }
  }

  // ── Debemos ────────────────────────────────────────────────────────────────
  const cxp = await getCuentasPorPagar(hoy);
  const proveedores = vacio();
  for (const p of cxp.proveedores) {
    for (const f of p.facturas) {
      sumar(proveedores, aUsd(f.saldo, f.moneda), new Date(`${f.vencimiento}T00:00:00.000Z`), hoy);
    }
  }
  const saldoAFavorProveedoresUsd = r2(cxp.proveedores.reduce(
    (a, p) => a + p.saldoAFavor.USD + aUsd(p.saldoAFavor.UYU, Moneda.UYU), 0));

  const compromisos = await prisma.financeMovement.findMany({
    where: {
      deletedAt: null,
      tipoMovimiento: TipoMovimiento.GASTO,
      supplierId: null,
      status: { in: [FinanceMovementStatus.COMPROMETIDO, FinanceMovementStatus.A_PAGAR] },
    },
    select: { monto: true, moneda: true, tipoCambio: true, fecha: true, dueDate: true, expectedDate: true },
  });
  const otros = vacio();
  for (const m of compromisos) sumar(otros, movimientoEnUsd(m, usdToUyu), m.dueDate ?? m.expectedDate ?? m.fecha, hoy);

  const comisionesPend = await prisma.commission.findMany({
    where: { status: CommissionStatus.PENDIENTE },
    select: { montoUsd: true, dueDate: true },
  });
  const comisiones = vacio();
  for (const c of comisionesPend) sumar(comisiones, Number(c.montoUsd), c.dueDate, hoy);

  const instaladoresPend = await prisma.installerPayment.findMany({
    where: { deletedAt: null, status: { in: [InstallerPaymentStatus.PENDIENTE, InstallerPaymentStatus.PARCIAL] } },
    select: {
      montoUsd: true, dueDate: true,
      movimientos: {
        where: { deletedAt: null, status: FinanceMovementStatus.PAGADO },
        select: { monto: true, moneda: true, tipoCambio: true },
      },
    },
  });
  const instaladores = vacio();
  for (const ip of instaladoresPend) {
    const pagado = ip.movimientos.reduce((a, m) => a + movimientoEnUsd(m, usdToUyu), 0);
    const saldo = Number(ip.montoUsd) - pagado;
    if (saldo > 0.005) sumar(instaladores, saldo, ip.dueDate, hoy);
  }

  const debemos = vacio();
  for (const t of [proveedores, otros, comisiones, instaladores]) {
    for (const k of Object.keys(debemos) as Array<keyof Tramos>) debemos[k] += t[k];
  }

  return {
    hoy: hoy.toISOString().slice(0, 10),
    usdToUyu,
    nosDeben: { ...redondear(nosDeben), obrasSinPlanCompleto },
    debemos: {
      ...redondear(debemos),
      desglose: {
        proveedores: redondear(proveedores),
        otrosCompromisos: redondear(otros),
        comisiones: redondear(comisiones),
        instaladores: redondear(instaladores),
      },
      saldoAFavorProveedores: saldoAFavorProveedoresUsd,
    },
    // Lo que nos deben menos lo que debemos (sin la caja: la suma el que llama).
    neto: r2(nosDeben.total - debemos.total + saldoAFavorProveedoresUsd),
  };
}

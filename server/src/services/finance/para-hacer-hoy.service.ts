// "Para hacer hoy" de Finanzas: todo lo pendiente de todas las pantallas del
// módulo en una sola lista, con cuántos hay y a dónde se va a resolverlo. Se
// calcula al pedirla: cuando algo se resuelve, desaparece solo (no hay que
// tildar nada). La usan el Inicio de Finanzas, el número del menú y el mail
// diario de quien trabaja en Finanzas.
//
// `gravedad`: VENCIDO (ya se pasó un plazo: también le llega a Gerencia),
// HOY (hay que hacerlo) o AVISO (mirar cuando se pueda).

import {
  AccountType,
  CategoriaPrincipal,
  CommissionStatus,
  EstadoCfeEmitido,
  EstadoFacturaRecibida,
  FinanceMovementStatus,
  InstallerPaymentStatus,
  ReglaTarjeta,
  TipoMovimiento,
} from "@prisma/client";

import { prisma } from "../../lib/prisma.js";
import { todayUtc } from "../../utils/dates.js";
import { hoyUruguay } from "../../utils/uruguay.js";
import { getCuentasPorPagar } from "./cuentas-por-pagar.service.js";
import { pendientesPorCuenta } from "./bank-reconciliation.service.js";
import { porConciliar } from "./por-conciliar.service.js";

export type Gravedad = "VENCIDO" | "HOY" | "AVISO";
export type ItemHoy = { clave: string; grupo: string; texto: string; cantidad: number; link: string; gravedad: Gravedad };

const HORAS_SIN_LECTURA = 30;
const DIAS_SIN_CONCILIAR = 30;
// Día del mes desde el que el cierre del mes anterior se considera atrasado
// (aproxima el día 7 hábil).
const DIA_CIERRE = 10;

export async function paraHacerHoy(): Promise<ItemHoy[]> {
  const hoy = todayUtc();
  const ahora = new Date();
  const items: ItemHoy[] = [];
  const add = (i: ItemHoy) => { if (i.cantidad > 0) items.push(i); };

  const [conciliar, cxp, cuentasBanco] = await Promise.all([porConciliar(), getCuentasPorPagar(hoy), pendientesPorCuenta()]);

  // ── Compras ────────────────────────────────────────────────────────────────
  add({ clave: "facturas", grupo: "Compras", texto: "facturas de proveedores por revisar", cantidad: conciliar.facturas.total, link: "/finanzas/facturas-proveedores", gravedad: conciliar.facturas.atrasadas > 0 ? "VENCIDO" : "HOY" });
  const solas = await prisma.facturaRecibida.count({
    where: { cargadaSola: true, resueltaAt: { gte: new Date(ahora.getTime() - 7 * 86_400_000) } },
  });
  add({ clave: "solas", grupo: "Compras", texto: "facturas de cuenta corriente que entraron solas esta semana (revisarlas)", cantidad: solas, link: "/finanzas/facturas-proveedores", gravedad: "AVISO" });
  const vencidas = cxp.proveedores.filter((p) => p.USD.VENCIDO > 0.005 || p.UYU.VENCIDO > 0.005).length;
  add({ clave: "deuda_vencida", grupo: "Compras", texto: "proveedores con deuda vencida", cantidad: vencidas, link: "/finanzas/proveedores", gravedad: "VENCIDO" });
  const vencen = cxp.proveedores.filter((p) => p.USD.HASTA_7 > 0.005 || p.UYU.HASTA_7 > 0.005).length;
  add({ clave: "deuda_7", grupo: "Compras", texto: "proveedores a los que se les vence algo en 7 días", cantidad: vencen, link: "/finanzas/proveedores", gravedad: "HOY" });
  add({ clave: "limite", grupo: "Compras", texto: "proveedores pasados del límite de crédito", cantidad: cxp.proveedores.filter((p) => p.limite?.excedido).length, link: "/finanzas/proveedores", gravedad: "AVISO" });
  const fijos = await prisma.financeMovement.count({
    where: { deletedAt: null, fixedCostId: { not: null }, tipoMovimiento: TipoMovimiento.GASTO, pagado: false, fecha: { lte: hoy }, status: { not: FinanceMovementStatus.PREVISTO } },
  });
  add({ clave: "fijos", grupo: "Compras", texto: "costos fijos vencidos sin pagar", cantidad: fijos, link: "/finanzas/costos-fijos", gravedad: "VENCIDO" });
  const instaladores = await prisma.installerPayment.count({ where: { deletedAt: null, status: { in: [InstallerPaymentStatus.PENDIENTE, InstallerPaymentStatus.PARCIAL] } } });
  add({ clave: "instaladores", grupo: "Compras", texto: "pagos a instaladores pendientes", cantidad: instaladores, link: "/finanzas/instaladores", gravedad: "AVISO" });
  const comisiones = await prisma.commission.count({ where: { status: CommissionStatus.PENDIENTE } });
  add({ clave: "comisiones", grupo: "Compras", texto: "comisiones de asesores sin pagar", cantidad: comisiones, link: "/finanzas/comisiones", gravedad: "AVISO" });

  // Proveedores de cuenta corriente sin comparar con su estado de cuenta hace más de 30 días.
  const cc = await prisma.supplier.findMany({
    where: { deletedAt: null, cuentaCorriente: true },
    select: { id: true, conciliaciones: { orderBy: { createdAt: "desc" }, take: 1, select: { createdAt: true } } },
  });
  const sinConciliar = cc.filter((s) => !s.conciliaciones[0] || s.conciliaciones[0].createdAt.getTime() < ahora.getTime() - DIAS_SIN_CONCILIAR * 86_400_000).length;
  add({ clave: "conciliar_prov", grupo: "Compras", texto: `proveedores de cuenta corriente sin comparar con su estado de cuenta hace más de ${DIAS_SIN_CONCILIAR} días`, cantidad: sinConciliar, link: "/finanzas/proveedores", gravedad: "AVISO" });

  // ── Bancos ─────────────────────────────────────────────────────────────────
  const faltaCargar = cuentasBanco.reduce((n, c) => n + c.pendientes.length, 0);
  add({ clave: "banco", grupo: "Bancos", texto: "movimientos del banco sin cargar en Voltia PM", cantidad: faltaCargar, link: "/finanzas/banco", gravedad: "HOY" });
  add({ clave: "sin_banco", grupo: "Bancos", texto: "movimientos cargados que el banco no muestra", cantidad: conciliar.sinBanco.length, link: "/finanzas/inicio#por-conciliar", gravedad: "HOY" });
  const sinLeer = cuentasBanco.filter((c) => !c.bancoLeidoEn || ahora.getTime() - new Date(c.bancoLeidoEn).getTime() > HORAS_SIN_LECTURA * 3_600_000).length;
  add({ clave: "lector", grupo: "Bancos", texto: "cuentas que el lector del banco no leyó en el último día", cantidad: sinLeer, link: "/finanzas/banco", gravedad: "AVISO" });
  add({ clave: "duplicados", grupo: "Bancos", texto: "posibles gastos cargados dos veces", cantidad: conciliar.duplicados.length, link: "/finanzas/inicio#por-conciliar", gravedad: "HOY" });
  const tarjetaSinDecidir = await prisma.financeMovement.count({
    where: {
      deletedAt: null, tipoMovimiento: TipoMovimiento.GASTO, account: { tipo: AccountType.TARJETA },
      categoriaPrincipal: { notIn: [CategoriaPrincipal.CUENTA_SOCIO, CategoriaPrincipal.ADELANTO_PERSONAL] },
      OR: [{ tarjetaTitularId: null }, { tarjetaTitular: { regla: ReglaTarjeta.MIXTA }, tarjetaDecididoAt: null }],
    },
  });
  add({ clave: "tarjetas", grupo: "Bancos", texto: "gastos de tarjeta sin decidir quién los hizo o si son de Voltia", cantidad: tarjetaSinDecidir, link: "/finanzas/tarjetas", gravedad: "HOY" });
  const adelantos = await prisma.financeMovement.count({ where: { deletedAt: null, categoriaPrincipal: CategoriaPrincipal.ADELANTO_PERSONAL, descontadoAt: null } });
  add({ clave: "adelantos", grupo: "Bancos", texto: "adelantos a empleados por descontar del sueldo", cantidad: adelantos, link: "/finanzas/tarjetas", gravedad: "AVISO" });

  // ── Ventas ─────────────────────────────────────────────────────────────────
  const cobrosVencidos = await prisma.financeMovement.count({
    where: {
      deletedAt: null, tipoMovimiento: TipoMovimiento.INGRESO, cobrado: false, fecha: { lt: hoy },
      categoriaPrincipal: { in: [CategoriaPrincipal.PROYECTO_ENTRADA, CategoriaPrincipal.COBRO_CLIENTE] },
    },
  });
  add({ clave: "cobros", grupo: "Ventas", texto: "cobros a clientes vencidos sin cobrar", cantidad: cobrosVencidos, link: "/finanzas/cobros", gravedad: "VENCIDO" });
  const sinFacturar = await prisma.project.count({
    where: {
      deletedAt: null, llevaFactura: true, facturaEmitida: false,
      financeMovements: { some: { deletedAt: null, tipoMovimiento: TipoMovimiento.INGRESO, cobrado: true } },
    },
  });
  add({ clave: "sin_facturar", grupo: "Ventas", texto: "obras que llevan factura, ya cobraron algo y no se facturaron", cantidad: sinFacturar, link: "/finanzas/facturacion", gravedad: "HOY" });
  const trabadas = await prisma.cfeEmitido.count({
    where: { estado: { in: [EstadoCfeEmitido.RECHAZADO, EstadoCfeEmitido.DUDOSO] }, createdAt: { gte: new Date(ahora.getTime() - 30 * 86_400_000) } },
  });
  add({ clave: "cfe", grupo: "Ventas", texto: "facturas a clientes rechazadas por DGI o sin confirmar", cantidad: trabadas, link: "/finanzas/facturacion", gravedad: "VENCIDO" });

  // ── Cierre ─────────────────────────────────────────────────────────────────
  const u = hoyUruguay(ahora);
  if (u.dia >= DIA_CIERRE) {
    const anterior = u.mes === 1 ? { anio: u.anio - 1, mes: 12 } : { anio: u.anio, mes: u.mes - 1 };
    const cerrado = await prisma.cierreMes.count({ where: { ...anterior, reabiertoAt: null } });
    add({ clave: "cierre", grupo: "Informes", texto: "el mes anterior todavía no se cerró", cantidad: cerrado ? 0 : 1, link: "/finanzas/cierre", gravedad: "VENCIDO" });
  }

  // Lo vencido primero.
  const orden: Record<Gravedad, number> = { VENCIDO: 0, HOY: 1, AVISO: 2 };
  return items.sort((a, b) => orden[a.gravedad] - orden[b.gravedad]);
}

// Exportado para quien necesite solo el total (el número del menú).
export async function totalParaHacerHoy() {
  const items = await paraHacerHoy();
  return { total: items.filter((i) => i.gravedad !== "AVISO").length, vencidos: items.filter((i) => i.gravedad === "VENCIDO").length };
}

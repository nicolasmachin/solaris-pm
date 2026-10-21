// Facturas recibidas de proveedores: pasar una factura de la bandeja a deuda.
//
// Lo usan la pantalla (cuentas-por-pagar.routes.ts) y la sincronización con
// Biller (las facturas que entran solas). Por eso vive acá y no en la ruta.
//
// Contra la doble deuda: la sincronización y una persona pueden confirmar la
// misma factura a la vez. Dentro de la transacción, la factura se "toma" con un
// updateMany condicionado a PENDIENTE; si otro ya la tomó, devuelve 0 filas y no
// se crea un segundo movimiento.

import {
  AuditAction,
  AuditEntityType,
  CategoriaPrincipal,
  EstadoAprobacion,
  EstadoFacturaRecibida,
  FinanceMovementStatus,
  MovementSourceType,
  Prisma,
  TipoMovimiento,
} from "@prisma/client";

import { prisma } from "../../lib/prisma.js";
import { badRequest, conflict, notFound } from "../../utils/errors.js";
import { parseDateOnly } from "../../utils/dates.js";
import { createAuditEntry } from "../audit.service.js";
import { esNotaCredito, normalizarRut, TIPO_CFE_LABEL } from "../biller/recibidos.service.js";
import { calcularVencimiento } from "./cuentas-por-pagar.service.js";
import { crearAjusteEnTx, deudasAbiertasProveedor, repartirFifo } from "./deuda-proveedor.service.js";

export const etiquetaCfe = (tipo: number, serie: string, numero: number) =>
  `${TIPO_CFE_LABEL[tipo] ?? `CFE ${tipo}`} ${serie}-${numero}`;

export async function cargarPendiente(id: string) {
  const f = await prisma.facturaRecibida.findUnique({ where: { id } });
  if (!f) throw notFound("FACTURA_RECIBIDA_NOT_FOUND", "Factura recibida no encontrada");
  if (f.estado !== EstadoFacturaRecibida.PENDIENTE) {
    throw badRequest("FACTURA_RECIBIDA_RESUELTA", "Esta factura ya fue confirmada o descartada.");
  }
  return f;
}

/**
 * Toma la factura para resolverla dentro de la transacción. Si ya no estaba
 * pendiente (otra persona o la sincronización la resolvió recién), corta.
 */
export async function tomarPendiente(tx: Prisma.TransactionClient, id: string) {
  const r = await tx.facturaRecibida.updateMany({
    where: { id, estado: EstadoFacturaRecibida.PENDIENTE },
    data: { estado: EstadoFacturaRecibida.CONFIRMADA },
  });
  if (r.count === 0) {
    throw conflict("FACTURA_RECIBIDA_RESUELTA", "Esta factura ya fue confirmada o descartada.");
  }
}

/**
 * El proveedor de la factura. Si se elige uno sin RUT, se le guarda el del
 * comprobante (así la próxima factura se reconoce sola). Si tiene otro RUT,
 * no es ese proveedor.
 */
export async function resolverProveedor(rutEmisor: string, supplierId: string, tx: Prisma.TransactionClient) {
  const s = await tx.supplier.findFirst({ where: { id: supplierId, deletedAt: null } });
  if (!s) throw notFound("SUPPLIER_NOT_FOUND", "Proveedor no encontrado");
  const rut = normalizarRut(s.rut);
  if (rut && rut !== rutEmisor) {
    throw badRequest("RUT_NO_COINCIDE", `${s.nombre} tiene el RUT ${s.rut}, y la factura es del RUT ${rutEmisor}.`);
  }
  if (!rut) await tx.supplier.update({ where: { id: s.id }, data: { rut: rutEmisor } });
  return s;
}

export type DatosConfirmar = { supplierId?: string; descripcion?: string; projectId?: string | null; fechaVencimiento?: string };

type FacturaPendiente = Awaited<ReturnType<typeof cargarPendiente>>;

/** Crea la deuda (FinanceMovement A_PAGAR) de una factura recibida pendiente. */
export async function confirmarFactura(
  f: FacturaPendiente,
  body: DatosConfirmar,
  userId: string,
  opciones: { automatica?: boolean } = {},
): Promise<string> {
  const supplierId = body.supplierId ?? f.supplierId;
  if (!supplierId) throw badRequest("SUPPLIER_REQUIRED", "Elegí a qué proveedor corresponde la factura.");
  if (esNotaCredito(f.tipoCfe)) return confirmarNotaCredito(f, supplierId, userId);

  const movement = await prisma.$transaction(async (tx) => {
    await tomarPendiente(tx, f.id);
    const s = await resolverProveedor(f.rutEmisor, supplierId, tx);
    // Vence según el plazo negociado con el proveedor, salvo que se indique otra fecha.
    const venc = body.fechaVencimiento
      ? parseDateOnly(body.fechaVencimiento)
      : calcularVencimiento(f.fechaEmision, s.plazoCreditoDias);
    const m = await tx.financeMovement.create({
      data: {
        tipoMovimiento: TipoMovimiento.GASTO,
        categoriaPrincipal: CategoriaPrincipal.PAGO_PROVEEDOR,
        status: FinanceMovementStatus.A_PAGAR,
        sourceType: MovementSourceType.MANUAL,
        estadoAprobacion: EstadoAprobacion.REGISTRADO,
        supplierId: s.id,
        projectId: body.projectId ?? null,
        descripcion: body.descripcion ?? etiquetaCfe(f.tipoCfe, f.serie, f.numero),
        monto: f.total,
        moneda: f.moneda,
        fecha: f.fechaEmision,
        dueDate: venc,
        invoiceNumber: `${f.serie}-${f.numero}`,
        // Desglose para el crédito fiscal y el libro de compras.
        montoNeto: f.totalNeto,
        montoIva: f.totalIva,
        mes: venc.getUTCMonth() + 1,
        anio: venc.getUTCFullYear(),
        pagado: false,
        impactaFlujo: true,
        creadoPorId: userId,
      },
    });
    await tx.facturaRecibida.update({
      where: { id: f.id },
      data: {
        supplierId: s.id, movementId: m.id,
        resueltaPorId: userId, resueltaAt: new Date(),
        cargadaSola: opciones.automatica ?? false,
      },
    });
    return { ...m, supplierNombre: s.nombre };
  });

  await createAuditEntry({
    entityType: AuditEntityType.factura_recibida,
    entityId: f.id,
    userId,
    action: AuditAction.created,
    description: opciones.automatica
      ? `Cargó sola como deuda la factura recibida ${etiquetaCfe(f.tipoCfe, f.serie, f.numero)} de ${movement.supplierNombre} por ${Number(f.total)} ${f.moneda} (proveedor de cuenta corriente, factura a crédito)`
      : `Confirmó la factura recibida ${etiquetaCfe(f.tipoCfe, f.serie, f.numero)} de ${movement.supplierNombre} por ${Number(f.total)} ${f.moneda}`,
  });
  return movement.id;
}

/**
 * Nota de crédito de un proveedor: baja lo que se le debe sin mover plata, así
 * que se registra como un ajuste (pago sin cuenta) repartido de la deuda más
 * vieja a la más nueva, en la moneda de la nota. Devuelve el id del ajuste.
 */
async function confirmarNotaCredito(f: FacturaPendiente, supplierId: string, userId: string): Promise<string> {
  const etiqueta = etiquetaCfe(f.tipoCfe, f.serie, f.numero);
  const r = await prisma.$transaction(async (tx) => {
    await tomarPendiente(tx, f.id);
    const s = await resolverProveedor(f.rutEmisor, supplierId, tx);
    const deudas = await deudasAbiertasProveedor(tx, s.id, f.moneda);
    const total = Number(f.total);
    const abierto = deudas.reduce((a, d) => a + d.saldo, 0);
    if (total > abierto + 0.005) {
      throw badRequest(
        "NC_SUPERA_DEUDA",
        `La nota de crédito (${total.toFixed(2)} ${f.moneda}) es mayor que lo que se le debe a ${s.nombre} (${abierto.toFixed(2)}). Cargá primero la factura que descuenta, o descartala indicando cómo se registró.`,
      );
    }
    const ajuste = await crearAjusteEnTx(tx, {
      supplierId: s.id, moneda: f.moneda, fecha: f.fechaEmision, userId,
      motivo: `Nota de crédito ${f.serie}-${f.numero} del proveedor`,
      aplicaciones: repartirFifo(deudas, total),
    });
    await tx.facturaRecibida.update({
      where: { id: f.id },
      data: { supplierId: s.id, ajusteId: ajuste.id, resueltaPorId: userId, resueltaAt: new Date() },
    });
    return { ajuste, supplierNombre: s.nombre };
  });
  await createAuditEntry({
    entityType: AuditEntityType.factura_recibida,
    entityId: f.id,
    userId,
    action: AuditAction.created,
    description: `Descontó la ${etiqueta} de ${r.supplierNombre} por ${Number(f.total)} ${f.moneda} de lo que se le debe (ajuste, no es plata)`,
  });
  return r.ajuste.id;
}

// ─── Facturas que pasan solas a deuda ───────────────────────────────────────

const DIAS_GASTO_IGUAL = 7;

/** Actor de los procesos automáticos: el primer ADMIN (no hay usuario de sistema). */
async function usuarioSistema(): Promise<string | null> {
  const admin = await prisma.user.findFirst({
    where: { deletedAt: null, role: { name: "ADMIN" } },
    orderBy: { createdAt: "asc" },
    select: { id: true },
  });
  return admin?.id ?? null;
}

/**
 * Pasa a deuda las facturas por revisar de proveedores de cuenta corriente.
 * Condiciones (si alguna no se cumple, queda por revisar para una persona):
 *  - el proveedor tiene tildado "Cuenta corriente";
 *  - es una factura (las notas de crédito las revisa una persona);
 *  - no hay un gasto del mismo proveedor, moneda y monto a ±7 días, o con el
 *    mismo número de factura, que todavía no tenga factura vinculada (sería la
 *    misma compra cargada a mano: se vincula, no se duplica).
 * Quedan marcadas "cargada sola" para la revisión semanal.
 */
export async function cargarSolasCuentaCorriente(): Promise<{ cargadas: number; aRevisar: number }> {
  const pendientes = await prisma.facturaRecibida.findMany({
    where: { estado: EstadoFacturaRecibida.PENDIENTE, supplier: { cuentaCorriente: true, deletedAt: null } },
    orderBy: { fechaEmision: "asc" },
  });
  if (!pendientes.length) return { cargadas: 0, aRevisar: 0 };
  const userId = await usuarioSistema();
  if (!userId) return { cargadas: 0, aRevisar: pendientes.length };

  let cargadas = 0;
  let aRevisar = 0;
  for (const f of pendientes) {
    if (esNotaCredito(f.tipoCfe) || Number(f.total) <= 0) { aRevisar++; continue; }
    const desde = new Date(f.fechaEmision.getTime() - DIAS_GASTO_IGUAL * 86_400_000);
    const hasta = new Date(f.fechaEmision.getTime() + DIAS_GASTO_IGUAL * 86_400_000);
    const parecidos = await prisma.financeMovement.findMany({
      where: {
        deletedAt: null, supplierId: f.supplierId!, moneda: f.moneda, tipoMovimiento: TipoMovimiento.GASTO,
        facturaRecibida: null,
        OR: [
          { invoiceNumber: { endsWith: String(f.numero) } },
          { monto: f.total, fecha: { gte: desde, lte: hasta } },
        ],
      },
      select: { id: true },
      take: 1,
    });
    if (parecidos.length) { aRevisar++; continue; }
    try {
      await confirmarFactura(f, {}, userId, { automatica: true });
      cargadas++;
    } catch (e) {
      // Otra persona la resolvió en el medio, o algo no cierra: queda para revisar.
      aRevisar++;
      console.error(`[facturas-cuenta-corriente] ${f.id}:`, (e as Error).message);
    }
  }
  return { cargadas, aRevisar };
}

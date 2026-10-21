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
  if (esNotaCredito(f.tipoCfe)) {
    throw badRequest(
      "NOTA_CREDITO_A_MANO",
      "Las notas de crédito todavía se registran a mano. Descartala indicando cómo se registró.",
    );
  }
  const supplierId = body.supplierId ?? f.supplierId;
  if (!supplierId) throw badRequest("SUPPLIER_REQUIRED", "Elegí a qué proveedor corresponde la factura.");

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

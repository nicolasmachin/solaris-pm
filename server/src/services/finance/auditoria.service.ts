// Auditoría de Finanzas: qué se cambió, de qué valor a qué valor, quién y cuándo.
//
// Antes, editar un movimiento o un pago dejaba solo "Actualizó movimiento: X",
// sin decir qué. Ahora cada campo que cambia deja su propia fila en audit_logs
// (fieldChanged / oldValue / newValue), con los valores en palabras: fechas
// aaaa-mm-dd, montos como número y cuentas, proveedores y proyectos por su
// nombre, no por su id. Así la pantalla Historial de Finanzas se lee sola.

import { AuditAction, AuditEntityType, Prisma } from "@prisma/client";

import { prisma } from "../../lib/prisma.js";
import { createAuditEntry } from "../audit.service.js";

const ETIQUETAS: Record<string, string> = {
  descripcion: "descripción",
  monto: "monto",
  moneda: "moneda",
  fecha: "fecha",
  categoriaPrincipal: "categoría",
  status: "estado",
  cobrado: "cobrado",
  pagado: "pagado",
  accountId: "cuenta",
  supplierId: "proveedor",
  projectId: "proyecto",
  dueDate: "vencimiento",
  expectedDate: "fecha esperada",
  invoiceNumber: "número de factura",
  tipoCambio: "tipo de cambio",
  metodo: "método",
  referencia: "referencia",
  notas: "notas",
  observaciones: "observaciones",
};

export const CAMPOS_MOVIMIENTO = [
  "descripcion", "monto", "moneda", "fecha", "categoriaPrincipal", "status", "cobrado",
  "accountId", "supplierId", "projectId", "dueDate", "expectedDate", "invoiceNumber", "tipoCambio", "observaciones",
] as const;

export const CAMPOS_PAGO = ["fecha", "monto", "moneda", "metodo", "accountId", "referencia", "notas"] as const;

function normalizar(campo: string, v: unknown): string | null {
  if (v === null || v === undefined || v === "") return null;
  if (v instanceof Date) {
    return campo === "fecha" || campo === "dueDate" || campo === "expectedDate"
      ? v.toISOString().slice(0, 10)
      : v.toISOString();
  }
  if (v instanceof Prisma.Decimal) return String(Number(v));
  if (typeof v === "boolean") return v ? "sí" : "no";
  return String(v);
}

async function nombreDe(campo: string, id: string | null): Promise<string | null> {
  if (!id) return null;
  if (campo === "accountId") return (await prisma.account.findUnique({ where: { id }, select: { nombre: true } }))?.nombre ?? id;
  if (campo === "supplierId") return (await prisma.supplier.findUnique({ where: { id }, select: { nombre: true } }))?.nombre ?? id;
  if (campo === "projectId") {
    const p = await prisma.project.findUnique({ where: { id }, select: { code: true, clientName: true } });
    return p ? `${p.code} · ${p.clientName}` : id;
  }
  return id;
}

/**
 * Deja una fila de auditoría por cada campo que cambió entre `antes` y
 * `despues`. Devuelve cuántos campos cambiaron (0 = no se registró nada).
 */
export async function registrarCambios(args: {
  entityType: AuditEntityType;
  entityId: string;
  projectId?: string | null;
  userId: string;
  nombre: string;
  campos: readonly string[];
  antes: Record<string, unknown>;
  despues: Record<string, unknown>;
}): Promise<number> {
  let n = 0;
  for (const campo of args.campos) {
    let viejo = normalizar(campo, args.antes[campo]);
    let nuevo = normalizar(campo, args.despues[campo]);
    if (viejo === nuevo) continue;
    if (campo.endsWith("Id")) {
      viejo = await nombreDe(campo, viejo);
      nuevo = await nombreDe(campo, nuevo);
    }
    const etiqueta = ETIQUETAS[campo] ?? campo;
    await createAuditEntry({
      entityType: args.entityType,
      entityId: args.entityId,
      projectId: args.projectId ?? undefined,
      userId: args.userId,
      action: AuditAction.updated,
      fieldChanged: campo,
      oldValue: viejo,
      newValue: nuevo,
      description: `Cambió ${etiqueta} de "${viejo ?? "vacío"}" a "${nuevo ?? "vacío"}" en ${args.nombre}`,
    });
    n++;
  }
  return n;
}

/** Los tipos de entidad que se muestran en el Historial de Finanzas. */
export const ENTIDADES_FINANZAS: AuditEntityType[] = [
  AuditEntityType.finance_movement,
  AuditEntityType.payment,
  AuditEntityType.payment_application,
  AuditEntityType.supplier,
  AuditEntityType.account,
  AuditEntityType.commission,
  AuditEntityType.installer_payment,
  AuditEntityType.factura_recibida,
  AuditEntityType.conciliacion_proveedor,
];

// Lógica pura de la facturación desde el chat (sin base ni Biller), para testear.

import { createHash } from "node:crypto";

import type { BorradorCfe } from "../../../services/biller/cfe-emitidos.service.js";

export type CambiosFactura = {
  documento?: string;
  nombre?: string;
  direccion?: string;
  ciudad?: string;
  departamento?: string;
  monto_sin_iva_usd?: number;
  concepto?: string;
  fecha_emision?: string;
  fecha_vencimiento?: string;
  email?: string;
  sin_mail?: true;
  tercero?: boolean;
};

const soloDigitos = (s: string) => s.replace(/\D/g, "");
const recortar = (s: string, n: number) => (s.length > n ? s.slice(0, n).trim() : s);

/**
 * Aplica al borrador que arma Voltia PM lo que se corrigió en el chat. Un
 * documento de 12 dígitos es RUT → e-Factura; si no, cédula → e-Ticket. Con
 * fecha de vencimiento, la factura pasa a crédito.
 */
export function aplicarCambios(base: BorradorCfe, c: CambiosFactura): BorradorCfe {
  const b: BorradorCfe = structuredClone(base);
  if (c.documento != null) {
    const doc = soloDigitos(c.documento);
    const esRut = doc.length === 12;
    b.cliente.documento = doc;
    b.cliente.tipoDocumento = esRut ? 2 : 3;
    b.tipoCfe = esRut ? 111 : 101;
  }
  if (c.nombre != null) b.cliente.nombre = c.nombre.trim();
  if (c.direccion != null) b.cliente.direccion = recortar(c.direccion.trim(), 70);
  if (c.ciudad != null) b.cliente.ciudad = recortar(c.ciudad.trim(), 30);
  if (c.departamento != null) b.cliente.departamento = recortar(c.departamento.trim(), 30);
  if (c.monto_sin_iva_usd != null) {
    b.items = [{ ...b.items[0], cantidad: 1, precio: Math.round(c.monto_sin_iva_usd * 100) / 100 }];
  }
  if (c.concepto != null) b.items = b.items.map((i, n) => (n === 0 ? { ...i, concepto: recortar(c.concepto!.trim(), 80) } : i));
  if (c.fecha_emision != null) b.fechaEmision = c.fecha_emision;
  if (c.fecha_vencimiento != null) {
    b.formaPago = 2;
    b.fechaVencimiento = c.fecha_vencimiento;
  }
  if (c.email != null) b.emailCliente = c.email.trim().toLowerCase();
  if (c.sin_mail) b.emailCliente = null;
  if (c.tercero != null) b.receptor = c.tercero ? "TERCERO" : "CLIENTE";
  return b;
}

/**
 * Huella del borrador exacto que se mostró. Se pide de vuelta al confirmar:
 * si entre la vista previa y la confirmación cambió algo (alguien tocó la
 * ficha, otro cobro, la fecha), no se emite y se muestra el borrador nuevo.
 */
export function huellaBorrador(b: BorradorCfe): string {
  return createHash("sha256").update(JSON.stringify(b)).digest("hex").slice(0, 8);
}

/** Primer teléfono de un campo que puede traer varios ("099 123 456 / 098…"). */
export function primerTelefono(campo: string | null | undefined): string | null {
  const t = (campo ?? "").split(/\s*(?:\/|,|;|\by\b|\bo\b)\s*/i).map((x) => x.trim()).find((x) => soloDigitos(x).length >= 8);
  return t ?? null;
}

import assert from "node:assert/strict";
import { test } from "node:test";

import type { BorradorCfe } from "../../../services/biller/cfe-emitidos.service.js";
import { aplicarCambios, huellaBorrador, primerTelefono } from "./facturacion.logic.js";

const base: BorradorCfe = {
  tipoCfe: 101,
  formaPago: 1,
  fechaEmision: "2026-11-19",
  fechaVencimiento: null,
  moneda: "USD" as BorradorCfe["moneda"],
  cliente: { tipoDocumento: 3, documento: "12345672", nombre: "Ana Pérez", direccion: "Rivera 123", ciudad: "Pando", departamento: "Canelones" },
  items: [{ concepto: "Suministro e instalación", descripcion: null, cantidad: 1, precio: 5000, indicadorFacturacion: 3 }],
  receptor: "CLIENTE",
  baseSinIva: 5000,
  porcentaje: 100,
  adenda: "Proyecto PRY-1",
  emailCliente: "ana@x.com",
  motivo: null,
};

test("sin cambios queda igual y no muta el original", () => {
  const b = aplicarCambios(base, {});
  assert.deepEqual(b, base);
  b.cliente.nombre = "X";
  assert.equal(base.cliente.nombre, "Ana Pérez");
});

test("un RUT de 12 dígitos pasa a e-Factura", () => {
  const b = aplicarCambios(base, { documento: "21.234.567-0012" });
  assert.equal(b.tipoCfe, 111);
  assert.equal(b.cliente.tipoDocumento, 2);
  assert.equal(b.cliente.documento, "212345670012");
});

test("vencimiento → crédito; monto y sin mail", () => {
  const b = aplicarCambios(base, { fecha_vencimiento: "2026-12-19", monto_sin_iva_usd: 2500.456, sin_mail: true });
  assert.equal(b.formaPago, 2);
  assert.equal(b.items[0].precio, 2500.46);
  assert.equal(b.emailCliente, null);
});

test("la huella cambia si cambia cualquier dato", () => {
  assert.equal(huellaBorrador(base), huellaBorrador(structuredClone(base)));
  assert.notEqual(huellaBorrador(base), huellaBorrador(aplicarCambios(base, { monto_sin_iva_usd: 4999 })));
  assert.equal(huellaBorrador(base).length, 8);
});

test("primer teléfono de un campo con varios", () => {
  assert.equal(primerTelefono("099 123 456 / 098 765 432"), "099 123 456");
  assert.equal(primerTelefono("sin dato"), null);
  assert.equal(primerTelefono(null), null);
});

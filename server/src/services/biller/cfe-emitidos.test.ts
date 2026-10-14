import assert from "node:assert/strict";
import { test } from "node:test";

import { cuerpoBiller, totalBorrador, validarBorrador, type BorradorCfe } from "./cfe-emitidos.service.js";

const base: BorradorCfe = {
  tipoCfe: 101,
  formaPago: 1,
  fechaEmision: "2026-10-14",
  fechaVencimiento: null,
  moneda: "USD",
  cliente: {
    tipoDocumento: 3,
    documento: "1.234.567-2",
    nombre: "Una Persona Con Un Nombre Bastante Largo De Verdad",
    direccion: "Av. Italia 1234",
    ciudad: "Montevideo",
    departamento: "Montevideo",
  },
  items: [{ concepto: "Instalación", descripcion: null, cantidad: 1, precio: 5000, indicadorFacturacion: 3 }],
  receptor: "CLIENTE",
  baseSinIva: 10000,
  porcentaje: 50,
  adenda: "Proyecto PRY-1",
  emailCliente: "cliente@ejemplo.com",
  motivo: null,
};

test("un borrador correcto no tiene problemas", () => {
  assert.deepEqual(validarBorrador(base), []);
  // Precios sin IVA: 5000 + 22 % = 6100.
  assert.equal(totalBorrador(base), 6100);
});

test("cédula con dígito verificador mal", () => {
  const b = { ...base, cliente: { ...base.cliente, documento: "12345678" } };
  assert.match(validarBorrador(b).join(), /cédula no es válida/);
});

test("e-Factura exige RUT de 12 dígitos", () => {
  const b: BorradorCfe = { ...base, tipoCfe: 111, cliente: { ...base.cliente, tipoDocumento: 2, documento: "2110" } };
  assert.match(validarBorrador(b).join(), /12 dígitos/);
  const cruzado: BorradorCfe = { ...base, tipoCfe: 111 };
  assert.match(validarBorrador(cruzado).join(), /e-Factura va a un RUT/);
});

test("crédito sin vencimiento", () => {
  assert.match(validarBorrador({ ...base, formaPago: 2 }).join(), /vencimiento/);
});

test("cuerpo para Biller: montos brutos, fechas dd/mm/aaaa, nombre de CI cortado a 30", () => {
  process.env.BILLER_SUCURSAL = "889";
  const c = cuerpoBiller({ ...base, formaPago: 2, fechaVencimiento: "2026-11-13" }, "PRY-1-abc", null) as Record<string, any>;
  assert.equal(c.montos_brutos, 0);
  assert.equal(c.items[0].precio, 5000);
  assert.equal(c.fecha_emision, "14/10/2026");
  assert.equal(c.fecha_vencimiento, "13/11/2026");
  assert.equal(c.sucursal, 889);
  assert.equal(c.cliente.documento, "12345672");
  assert.equal(c.cliente.nombre_fantasia.length, 30);
  assert.equal(c.cliente.razon_social, undefined);
  // En test (BILLER_URL sin definir = test.biller.uy) nunca se manda mail.
  assert.equal(c.emails_notificacion, undefined);
  assert.equal(c.referencias, undefined);
});

test("nota de crédito referencia la factura por id de Biller", () => {
  const c = cuerpoBiller({ ...base, tipoCfe: 102, motivo: "x" }, "PRY-1-nc", "421264") as Record<string, any>;
  assert.deepEqual(c.referencias, [421264]);
});

// Tests de los ajustes de costo por cotización ("costeo a medida").
//   npm run test:costeo
//
// Lo que se protege acá es, sobre todo, que NO cambie nada cuando no hay
// ajustes: el costeo a medida se agregó sobre un motor que ya estaba validado
// contra el Excel, y el día que empiece a mover números sin que nadie lo pida,
// se rompen todas las propuestas.

import { strict as assert } from "node:assert";
import { test } from "node:test";

import { calculate } from "./calculator.js";
import { defaultsFixture } from "./test-fixtures.js";
import type { ProposalData } from "./types.js";

const base: ProposalData = {
  cliente: { nombre: "Caso Costeo", dirigidoA: "Estimado,", ciudad: "Montevideo" },
  factura: {
    pagaMensualPesos: 6000,
    tarifa: "Simple",
    suministro: "trifásico",
    potenciaContratadaKw: 10,
  },
  techo: { descripcion: "Chapa", tamanoM2: 100 },
  cotizacion: {
    distanciaInstalacionKm: 35,
    cotizacionDolar: 40,
    markupPorcentaje: 20,
    plazoEntrega: "3 a 4 semanas",
  },
  sistema: {
    cantidadPaneles: 11,
    potenciaPanelW: 590,
    marcaPaneles: "Resun",
    potenciaInversorKw: 6,
    marcaInversor: "Growatt",
    tipoMontaje: "Chapa",
  },
  fecha: "2026-09-15",
  itemsAdicionales: [],
};

test("sin ajustes el resultado es idéntico a no tener la clave", () => {
  const sinClave = calculate(base, defaultsFixture);
  const conObjetoVacio = calculate({ ...base, costos: {} }, defaultsFixture);
  assert.deepEqual(conObjetoVacio, sinClave);
});

test("el precio unitario del panel pisa al default", () => {
  const normal = calculate(base, defaultsFixture);
  const ajustado = calculate({ ...base, costos: { panelPrecioUnitario: 150 } }, defaultsFixture);
  const esperado =
    normal.costoEquipamientoSinIva + (150 - defaultsFixture.precioPanelUsdSinIva) * 11;
  assert.equal(Math.round(ajustado.costoEquipamientoSinIva), Math.round(esperado));
  assert.equal(ajustado.panelPrecioUnitario, 150);
});

test("la cantidad sigue al sistema salvo que se la pise", () => {
  const normal = calculate(base, defaultsFixture);
  assert.equal(normal.panelCantidad, 11);
  assert.equal(normal.estructuraCantidad, 11);

  const ajustado = calculate({ ...base, costos: { panelCantidad: 9 } }, defaultsFixture);
  assert.equal(ajustado.panelCantidad, 9);
  // Las estructuras NO se arrastran: son una línea aparte del costeo.
  assert.equal(ajustado.estructuraCantidad, 11);
});

test("un costo en 0 es un valor válido, no una ausencia", () => {
  const ajustado = calculate({ ...base, costos: { meterPrecioUnitario: 0 } }, defaultsFixture);
  assert.equal(ajustado.meterPrecioUnitario, 0);
  const normal = calculate(base, defaultsFixture);
  assert.ok(ajustado.costoEquipamientoSinIva < normal.costoEquipamientoSinIva);
});

test("costo fijo, variable y mano de obra se pisan directo en USD", () => {
  const ajustado = calculate(
    { ...base, costos: { costoFijoAsignado: 1000, costoVariable: 500, manoDeObra: 2000 } },
    defaultsFixture,
  );
  assert.equal(ajustado.costoFijoAsignadoUsdSinIva, 1000);
  assert.equal(ajustado.costoVariableUsdSinIva, 500);
  assert.equal(ajustado.manoDeObraUsdSinIva, 2000);
  assert.equal(
    Math.round(ajustado.costoTotalSinIva),
    Math.round(ajustado.costoEquipamientoSinIva + 1000 + 500),
  );
});

test("subir un costo sube el precio final y NO la ganancia", () => {
  const normal = calculate(base, defaultsFixture);
  const caro = calculate({ ...base, costos: { panelPrecioUnitario: 300 } }, defaultsFixture);
  assert.ok(caro.totalConIva > normal.totalConIva, "el precio al cliente tiene que subir");
  // El markup es un % sobre costo+mano de obra, así que la ganancia sube con el
  // costo. Lo que se protege es el invariante del motor: ganancia ≡ markup.
  assert.equal(Math.round(caro.gananciaFinal), Math.round(caro.markupUsdSinIva));
  assert.equal(Math.round(normal.gananciaFinal), Math.round(normal.markupUsdSinIva));
});

// ─── Varias instalaciones en una misma propuesta ────────────────────────────
// El inversor y la eléctrica van uno por instalación; todo lo demás no se
// multiplica. Lo delicado es que el escalón de la eléctrica y el precio del
// inversor escalan con la cantidad de paneles: si se usara el total en vez de
// los paneles de cada instalación, se contaría dos veces el tamaño.

const dosInstalaciones = (n: number, paneles: number): ProposalData => ({
  ...base,
  sistema: { ...base.sistema, cantidadPaneles: paneles, cantidadInversores: n },
});

test("sin cantidadInversores se comporta como una sola instalación", () => {
  const sinCampo = calculate(base, defaultsFixture);
  const conUno = calculate(
    { ...base, sistema: { ...base.sistema, cantidadInversores: 1 } },
    defaultsFixture,
  );
  assert.deepEqual(conUno, sinCampo);
});

test("dos inversores multiplican inversor y eléctrica, y nada más", () => {
  const uno = calculate(dosInstalaciones(1, 12), defaultsFixture);
  const dos = calculate(dosInstalaciones(2, 24), defaultsFixture);

  // Uno por instalación
  assert.equal(dos.inversorCantidad, 2);
  assert.equal(dos.electricaCantidad, 2);
  // El resto sigue el total de paneles, sin multiplicarse por instalación
  assert.equal(dos.panelCantidad, 24);
  assert.equal(dos.estructuraCantidad, 24);
  assert.equal(dos.meterCantidad, 1);
  // Y los bloques que no dependen del tamaño quedan igual
  assert.equal(dos.costoFijoAsignadoUsdSinIva, uno.costoFijoAsignadoUsdSinIva);
  assert.equal(dos.costoVariableUsdSinIva, uno.costoVariableUsdSinIva);
});

test("el escalón de la eléctrica se calcula por instalación, no sobre el total", () => {
  // 24 paneles en 2 instalaciones = 12 cada una → escalón de 12 (≤20 ⇒ ×2),
  // no el de 24 (≤30 ⇒ ×3). Si se usara el total, cada eléctrica saldría un
  // 50% más cara.
  const dos = calculate(dosInstalaciones(2, 24), defaultsFixture);
  const unaDe12 = calculate(dosInstalaciones(1, 12), defaultsFixture);
  assert.equal(dos.electricaPrecioUnitario, unaDe12.electricaPrecioUnitario);

  // Y dos instalaciones cuestan exactamente el doble que una sola igual.
  assert.equal(
    Math.round(dos.electricaPrecioUnitario * dos.electricaCantidad),
    Math.round(unaDe12.electricaPrecioUnitario * 2),
  );
});

test("el precio del inversor usa los paneles de cada instalación", () => {
  // El caso especial trifásico (Tri12) aplica a sistemas de menos de 13 paneles
  // que pasan los 11 kW. Dos instalaciones de 12 paneles tienen que seguir
  // cayendo ahí, aunque sumadas den 24.
  const entrada: ProposalData = {
    ...base,
    factura: { ...base.factura, suministro: "trifásico" },
    sistema: {
      ...base.sistema,
      cantidadPaneles: 24,
      cantidadInversores: 2,
      potenciaInversorKw: 12,
    },
  };
  const r = calculate(entrada, defaultsFixture);
  assert.equal(r.inversorPrecioUnitario, defaultsFixture.precioInversorTri12Usd);

  // Con una sola instalación de 24 paneles ya no aplica: es un inversor mayor.
  const unaSola = calculate(
    { ...entrada, sistema: { ...entrada.sistema, cantidadInversores: 1 } },
    defaultsFixture,
  );
  assert.equal(unaSola.inversorPrecioUnitario, defaultsFixture.precioInversorTri21Usd);
});

test("los paneles por instalación se redondean para arriba", () => {
  // 25 paneles en 2 instalaciones: una lleva 13 y otra 12. Se cotiza sobre 13,
  // que es la más grande.
  const r = calculate(dosInstalaciones(2, 25), defaultsFixture);
  const trece = calculate(dosInstalaciones(1, 13), defaultsFixture);
  assert.equal(r.electricaPrecioUnitario, trece.electricaPrecioUnitario);
});

test("un ajuste manual del costeo gana sobre la cantidad del sistema", () => {
  const r = calculate(
    { ...dosInstalaciones(2, 24), costos: { inversorCantidad: 3, electricaCantidad: 1 } },
    defaultsFixture,
  );
  assert.equal(r.inversorCantidad, 3);
  assert.equal(r.electricaCantidad, 1);
});

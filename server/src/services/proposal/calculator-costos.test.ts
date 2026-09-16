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

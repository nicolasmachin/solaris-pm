import { test } from "node:test";
import assert from "node:assert/strict";

import { datosSuministro, resumirSistemasVarios, suministrosDePropuesta } from "./suministros.service.js";

const proyecto = {
  clientName: "Casa Pérez",
  nombreCliente: "JUAN PÉREZ",
  ciCliente: "1.234.567-8",
  empresa: false,
  calle: "RONDEAU",
  numCalle: "2110",
  locationCity: "Montevideo",
  locationProvince: "Montevideo",
  facturaUtePath: "projects/p/ute-docs/factura_ute.pdf",
  cedulaPath: null,
};

const sinDatos = {
  titularNombre: null,
  titularCi: null,
  titularEmpresa: null,
  calle: null,
  numCalle: null,
  localidad: null,
  departamento: null,
  facturaUtePath: null,
  cedulaPath: null,
};

test("un solo inversor: no hay suministros extra (el caso de siempre no se toca)", () => {
  assert.equal(suministrosDePropuesta({ cantidadPaneles: 12, potenciaInversorKw: 8, marcaInversor: "Growatt" }), null);
  assert.equal(
    suministrosDePropuesta({ cantidadPaneles: 12, cantidadInversores: 1, inversores: [{ marca: "Growatt", potenciaKw: 8 }] }),
    null,
  );
  assert.equal(suministrosDePropuesta(null), null);
});

test("inversores distintos: uno por inversor, con los paneles repartidos como en la propuesta", () => {
  const r = suministrosDePropuesta({
    cantidadPaneles: 24,
    inversores: [
      { marca: "Growatt", potenciaKw: 8 },
      { marca: "Huawei", potenciaKw: 6 },
    ],
  });
  assert.deepEqual(r, [
    { marca: "Growatt", potenciaKw: 8, paneles: 14 },
    { marca: "Huawei", potenciaKw: 6, paneles: 10 },
  ]);
});

test("inversores distintos con paneles cargados a mano: se respetan", () => {
  const r = suministrosDePropuesta({
    cantidadPaneles: 20,
    inversores: [
      { marca: "Growatt", potenciaKw: 8, paneles: 5 },
      { marca: "Huawei", potenciaKw: 6 },
    ],
  });
  assert.deepEqual(r?.map((i) => i.paneles), [5, 15]);
});

test("varios inversores iguales (forma clásica): también uno por inversor", () => {
  const r = suministrosDePropuesta({
    cantidadPaneles: 25,
    potenciaInversorKw: 6,
    cantidadInversores: 2,
    marcaInversor: "Growatt",
  });
  assert.deepEqual(r, [
    { marca: "Growatt", potenciaKw: 6, paneles: 13 },
    { marca: "Growatt", potenciaKw: 6, paneles: 12 },
  ]);
});

test("suministro principal: siempre los datos del proyecto, aunque su config tenga otros", () => {
  const d = datosSuministro(proyecto, { ...sinDatos, titularNombre: "OTRO", calle: "OTRA" }, 1);
  assert.equal(d.titularNombre, "JUAN PÉREZ");
  assert.equal(d.calle, "RONDEAU");
  assert.equal(d.titularPropio, false);
  assert.equal(d.facturaUtePath, proyecto.facturaUtePath);
});

test("otro suministro sin datos propios: titular y dirección del proyecto, pero NO su factura", () => {
  const d = datosSuministro(proyecto, sinDatos, 2);
  assert.equal(d.titularNombre, "JUAN PÉREZ");
  assert.equal(d.titularCi, "1.234.567-8");
  assert.equal(d.localidad, "Montevideo");
  assert.equal(d.titularPropio, false);
  assert.equal(d.facturaUtePath, null);
});

test("otro suministro con titular propio: manda el suyo; lo vacío cae al proyecto", () => {
  const d = datosSuministro(
    proyecto,
    { ...sinDatos, titularNombre: "ANA PÉREZ", titularCi: "4.444.444-4", titularEmpresa: false, calle: "  " },
    2,
  );
  assert.equal(d.titularNombre, "ANA PÉREZ");
  assert.equal(d.titularCi, "4.444.444-4");
  assert.equal(d.titularPropio, true);
  assert.equal(d.calle, "RONDEAU");
});

test("sin nombre de cédula, el titular es el nombre del proyecto", () => {
  const d = datosSuministro({ ...proyecto, nombreCliente: "" }, null, 1);
  assert.equal(d.titularNombre, "Casa Pérez");
});

test("contrato/proforma con un solo sistema: no se resume (cada documento lo lee como siempre)", () => {
  assert.equal(
    resumirSistemasVarios([{ inverterBrand: "Growatt", inverterPowerKw: 8, inverterQuantity: 2, panelQuantity: 20, panelPowerW: 585 }]),
    null,
  );
});

test("contrato/proforma con varios suministros: todos los inversores, paneles sumados, potencia total", () => {
  const r = resumirSistemasVarios([
    { inverterBrand: "Growatt", inverterPowerKw: 8, inverterQuantity: 1, panelQuantity: 14, panelPowerW: 585 },
    { inverterBrand: "Huawei", inverterPowerKw: 6, inverterQuantity: 1, panelQuantity: 10, panelPowerW: 585 },
  ]);
  assert.equal(r?.descripcion, "1 Growatt de 8 kW + 1 Huawei de 6 kW");
  assert.equal(r?.paneles, 24);
  assert.equal(r?.potenciaTotalKw, 14);
  assert.equal(r?.inversores.length, 2);
});

test("si a un suministro le faltan los paneles, el total no se inventa", () => {
  const r = resumirSistemasVarios([
    { inverterBrand: "Growatt", inverterPowerKw: 8, inverterQuantity: 1, panelQuantity: 14, panelPowerW: 585 },
    { inverterBrand: "Huawei", inverterPowerKw: 6, inverterQuantity: null, panelQuantity: null, panelPowerW: null },
  ]);
  assert.equal(r?.paneles, null);
  assert.equal(r?.descripcion, "1 Growatt de 8 kW + 1 Huawei de 6 kW");
});

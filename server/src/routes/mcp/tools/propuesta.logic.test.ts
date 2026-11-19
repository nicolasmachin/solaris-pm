import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  ajustesComoCampos,
  aplicarAjustesCosteo,
  aplicarEmpresa,
  elegirVariante,
  lineasCosteo,
  vinoAlgoDeCosteo,
  vinoAlgoDeEmpresa,
} from "./propuesta.logic.js";

const base = {
  variante: "EMPRESA",
  cliente: { nombre: "Estación Axion Ruta 11.", dirigidoA: "", ciudad: "Canelones" },
  empresa: { razonSocial: "", rut: "", contactoNombre: "", contactoCargo: "" },
} as any;

describe("elegirVariante", () => {
  it("respeta el tipo pedido", () => {
    assert.equal(elegirVariante("empresa", "RESIDENCIAL"), "EMPRESA");
    assert.equal(elegirVariante("residencial", "EMPRESA"), "RESIDENCIAL");
  });
  it("sin tipo, usa el del lead", () => {
    assert.equal(elegirVariante(undefined, "EMPRESA"), "EMPRESA");
    assert.equal(elegirVariante(undefined, "RESIDENCIAL"), "RESIDENCIAL");
    assert.equal(elegirVariante(undefined, null), "RESIDENCIAL");
  });
});

describe("aplicarEmpresa", () => {
  it("carga los datos y saluda al contacto", () => {
    const r = aplicarEmpresa(base, { razon_social: " IWILL S.A. ", rut: "214876200016", contacto_nombre: "Rossina Zaffaroni" });
    assert.equal(r.empresa!.razonSocial, "IWILL S.A.");
    assert.equal(r.empresa!.rut, "214876200016");
    assert.equal(r.cliente.dirigidoA, "Estimada Rossina,");
  });
  it("sin contacto, saluda a la empresa", () => {
    assert.equal(aplicarEmpresa(base, {}).cliente.dirigidoA, "Estimados,");
  });
  it("en residencial no toca la empresa", () => {
    const res = { ...base, variante: "RESIDENCIAL", cliente: { ...base.cliente, nombre: "Ana Pérez" } };
    const r = aplicarEmpresa(res, { razon_social: "X" });
    assert.equal(r.empresa!.razonSocial, "");
    assert.equal(r.cliente.dirigidoA, "Estimada Ana,");
  });
  it("detecta si vino algún dato de empresa", () => {
    assert.equal(vinoAlgoDeEmpresa({}), false);
    assert.equal(vinoAlgoDeEmpresa({ rut: "1" }), true);
  });
});

describe("aplicarAjustesCosteo", () => {
  it("pisa costos y mantiene los que ya estaban", () => {
    const r = aplicarAjustesCosteo(
      { comisionBbva: 0 },
      { estructura_costo_unitario_usd: 45, mano_de_obra_usd: 900, paneles_cantidad: 12 },
    );
    assert.deepEqual(r, { comisionBbva: 0, estructuraPrecioUnitario: 45, manoDeObra: 900, panelCantidad: 12 });
  });
  it("null vuelve al valor de fábrica y sin ajustes no queda objeto", () => {
    assert.deepEqual(aplicarAjustesCosteo({ manoDeObra: 900, inversorPrecioUnitario: 1200 }, { mano_de_obra_usd: null }), {
      inversorPrecioUnitario: 1200,
    });
    assert.equal(aplicarAjustesCosteo({ manoDeObra: 900 }, { mano_de_obra_usd: null }), undefined);
  });
  it("0 es un valor válido, no un borrado", () => {
    assert.deepEqual(aplicarAjustesCosteo(undefined, { comision_vendedor_usd: 0 }), { comisionVentas: 0 });
  });
  it("restablecer borra todo antes de aplicar lo nuevo", () => {
    assert.equal(aplicarAjustesCosteo({ manoDeObra: 900, comisionBbva: 0 }, {}, true), undefined);
    assert.deepEqual(aplicarAjustesCosteo({ manoDeObra: 900 }, { costos_fijos_usd: 300 }, true), {
      costoFijoAsignado: 300,
    });
  });
  it("detecta si vino algo del costeo", () => {
    assert.equal(vinoAlgoDeCosteo({ comision_bbva_usd: undefined }), false);
    assert.equal(vinoAlgoDeCosteo({ meter_cantidad: null }), true);
    assert.equal(vinoAlgoDeCosteo({}, true), true);
  });
});

describe("costeo en texto", () => {
  const u = (n: number) => `USD ${n}`;
  it("lista los ajustes con cantidades sin USD", () => {
    assert.deepEqual(ajustesComoCampos({ panelCantidad: 12, manoDeObra: 900 }, u), [
      ["Paneles, cantidad (fijado a mano)", "12"],
      ["Mano de obra (fijado a mano)", "USD 900"],
    ]);
  });
  it("marca las líneas pisadas con el valor de fábrica", () => {
    const base = {
      panelPrecioUnitario: 100, panelCantidad: 10,
      estructuraPrecioUnitario: 40, estructuraCantidad: 10,
      electricaPrecioUnitario: 300, electricaCantidad: 1,
      inversorPrecioUnitario: 1000, inversorCantidad: 1,
      meterPrecioUnitario: 150, meterCantidad: 1,
      costoEquipamientoSinIva: 2850, costoFijoAsignadoUsdSinIva: 200, costoVariableUsdSinIva: 100,
      manoDeObraUsdSinIva: 800, comisionVentasUsdSinIva: 150, comisionBbvaUsdSinIva: 50,
    };
    const calc = { ...base, estructuraPrecioUnitario: 45, costoEquipamientoSinIva: 2900, manoDeObraUsdSinIva: 900 };
    const filas = Object.fromEntries(
      lineasCosteo(calc, base, { estructuraPrecioUnitario: 45, manoDeObra: 900 }, u),
    );
    assert.equal(filas["Estructuras"], "10 × USD 45 = USD 450 — fijado a mano, de fábrica 10 × USD 40");
    assert.equal(filas["Paneles"], "10 × USD 100 = USD 1000");
    assert.equal(filas["Mano de obra"], "USD 900 — fijado a mano, de fábrica USD 800");
    assert.equal(filas["Equipamiento"], "USD 2900");
  });
});

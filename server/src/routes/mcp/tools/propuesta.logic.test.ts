import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { aplicarEmpresa, elegirVariante, vinoAlgoDeEmpresa } from "./propuesta.logic.js";

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

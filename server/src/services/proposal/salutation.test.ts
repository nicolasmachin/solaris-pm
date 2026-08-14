// Tests de `saludoPara`. Cubren los casos que importan en la carta de la
// propuesta y, sobre todo, sirven de red para la copia espejo del cliente
// (`client/src/lib/salutation.ts`): si alguien toca una lista de un lado y no
// del otro, acá se nota.

import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { saludoPara } from "./salutation.js";

describe("saludoPara", () => {
  it("infiere masculino por lista y por terminación", () => {
    assert.equal(saludoPara("Miguel Yenssen"), "Estimado Miguel,");
    assert.equal(saludoPara("Pablo Fernández"), "Estimado Pablo,");
    // Termina en -a pero está en la lista de masculinos.
    assert.equal(saludoPara("Luca Rossi"), "Estimado Luca,");
  });

  it("infiere femenino por lista y por terminación", () => {
    assert.equal(saludoPara("Ana Pérez"), "Estimada Ana,");
    // Termina en consonante; sale de la lista.
    assert.equal(saludoPara("Nair Rodríguez"), "Estimada Nair,");
    assert.equal(saludoPara("Beatriz Silva"), "Estimada Beatriz,");
  });

  it("cae a la forma neutra cuando no hay señal confiable", () => {
    // Ambiguos, deliberadamente fuera de las dos listas.
    assert.equal(saludoPara("Ariel Lo"), "Estimado/a Ariel,");
    assert.equal(saludoPara("Noel Prieto"), "Estimado/a Noel,");
  });

  it("trata a las empresas en plural", () => {
    assert.equal(saludoPara("Solar SRL"), "Estimados,");
    assert.equal(saludoPara("Supermercados Frescos S.A."), "Estimados,");
    assert.equal(saludoPara("Cooperativa La Uruguaya"), "Estimados,");
    assert.equal(saludoPara("Fundación Pérez"), "Estimados,");
  });

  it("resuelve el vacío sin romper la carta", () => {
    assert.equal(saludoPara(""), "Estimado/a cliente,");
    assert.equal(saludoPara("   "), "Estimado/a cliente,");
    assert.equal(saludoPara(undefined as unknown as string), "Estimado/a cliente,");
  });

  it("normaliza mayúsculas uniformes y respeta las mezcladas", () => {
    assert.equal(saludoPara("MIGUEL YENSSEN"), "Estimado Miguel,");
    assert.equal(saludoPara("miguel yenssen"), "Estimado Miguel,");
    // Ya viene con formato propio: no se toca.
    assert.equal(saludoPara("McCarthy Jones"), "Estimado/a McCarthy,");
  });

  it("ignora tildes al comparar contra las listas", () => {
    assert.equal(saludoPara("Martín Suárez"), "Estimado Martín,");
    assert.equal(saludoPara("Inés Correa"), "Estimada Inés,");
  });

  it("colapsa espacios de más", () => {
    assert.equal(saludoPara("  Ana   Pérez  "), "Estimada Ana,");
  });
});

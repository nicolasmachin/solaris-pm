// Tests de los helpers Handlebars de la propuesta v2. Runner builtin node:test:
//   npm run test:proposal-template

import { strict as assert } from "node:assert";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import { fileURLToPath } from "node:url";

import Handlebars from "handlebars";

import "./template.js"; // side-effect: registra los helpers (tarifaLabel, etc.)
import { renderProposalFull } from "./template.js";
import { calculate } from "./calculator.js";
import { defaultsFixture as defaultsParaRender } from "./test-fixtures.js";

const tarifaLabel = (t: string) => Handlebars.compile("{{tarifaLabel t}}")({ t });

test("tarifaLabel: Simple → Simple", () => assert.equal(tarifaLabel("Simple"), "Simple"));
test("tarifaLabel: Doble → Doble Horario", () => assert.equal(tarifaLabel("Doble"), "Doble Horario"));
test("tarifaLabel: Triple → Triple Horario", () => assert.equal(tarifaLabel("Triple"), "Triple Horario"));
test("tarifaLabel: fallback devuelve el valor tal cual", () => assert.equal(tarifaLabel("Otra"), "Otra"));

// ─── Cuotas BBVA: se muestran en pesos SIN multiplicar por el dólar ─────────
// (calculate() ya las devuelve en pesos; el bug 40x era un `mult ...dólar` extra.)
test("cuota BBVA en pesos = valor de calculate() sin ×dólar", () => {
  const out = Handlebars.compile("{{pesos calculated.cuota24m}}")({ calculated: { cuota24m: 22450.24 } });
  assert.equal(out, "$ 22.450");
});

test("los partials NO reintroducen la multiplicación por cotizacionDolar en las cuotas", () => {
  const partials = ["financiacion.hbs", "resumen.hbs"];
  for (const p of partials) {
    const html = readFileSync(
      fileURLToPath(new URL(`../../templates/proposal-v2/partials/${p}`, import.meta.url)),
      "utf8",
    );
    assert.ok(
      !/mult\s+calculated\.cuota/.test(html),
      `${p} volvió a multiplicar la cuota por el dólar (mult calculated.cuota…)`,
    );
    for (const n of ["24", "36", "60"]) {
      assert.ok(
        html.includes(`{{pesos calculated.cuota${n}m}}`),
        `${p} debe renderizar {{pesos calculated.cuota${n}m}}`,
      );
    }
  }
});

// ─── Variante EMPRESA: el documento B2B no puede tutear ni hablar de IRPF ────
//
// El 12% de IRPF es un impuesto de persona física: en una propuesta a una
// empresa es directamente incorrecto, no un matiz de redacción. Y el tuteo
// ("tu hogar", "necesitás") delata que el documento se escribió para otro
// destinatario. Estos tests renderizan el documento completo de las dos
// variantes y verifican la separación.

const RESIDENCIAL_ONLY = [
  "tu hogar",
  "tu casa",
  "IRPF",
  "necesitás",
  "consumís",
  "recuperás",
  "encontrás",
  "acompañarte",
  "presentarte",
];

function textoDe(variante: "RESIDENCIAL" | "EMPRESA" | undefined): string {
  const data = {
    ...(variante ? { variante } : {}),
    cliente: { nombre: "Solar Industrial SRL", ciudad: "Montevideo", dirigidoA: "Estimados," },
    empresa: { razonSocial: "Solar Industrial SRL", rut: "210012345678" },
    factura: { pagaMensualPesos: 60000, tarifa: "Simple", suministro: "trifásico", potenciaContratadaKw: 20 },
    techo: { descripcion: "chapa", tamanoM2: 300 },
    cotizacion: { distanciaInstalacionKm: 35, cotizacionDolar: 40, markupPorcentaje: 30, plazoEntrega: "6 a 8 semanas" },
    sistema: { cantidadPaneles: 40, potenciaPanelW: 590, marcaPaneles: "Resun", potenciaInversorKw: 20, marcaInversor: "Growatt", tipoMontaje: "Techo chapa" },
    fecha: "2026-08-12",
    notas: "",
    itemsAdicionales: [],
  } as unknown as Parameters<typeof renderProposalFull>[0]["data"];

  const calculated = calculate(
    data as never,
    { ...defaultsParaRender } as never,
  );
  const html = renderProposalFull({
    data,
    calculated,
    advisor: { name: "Asesor", jobTitle: "Asesor Comercial", email: "a@voltia.com.uy" },
  });
  return html.replace(/<[^>]+>/g, " ");
}

test("documento EMPRESA: sin tuteo ni IRPF", () => {
  const texto = textoDe("EMPRESA");
  for (const frase of RESIDENCIAL_ONLY) {
    assert.ok(!texto.includes(frase), `el documento a empresas no debería decir "${frase}"`);
  }
});

test("documento EMPRESA: incluye los datos fiscales", () => {
  const texto = textoDe("EMPRESA");
  assert.ok(texto.includes("Razón social"), "falta el bloque de razón social");
  assert.ok(texto.includes("210012345678"), "falta el RUT");
});

test("documento RESIDENCIAL: conserva su copy original", () => {
  const texto = textoDe("RESIDENCIAL");
  assert.ok(texto.includes("tu hogar"), "el residencial perdió su redacción");
  assert.ok(texto.includes("IRPF"), "el residencial perdió la mención al IRPF");
  assert.ok(!texto.includes("Razón social"), "el residencial no debe mostrar datos fiscales");
});

test("sin variante (versiones publicadas antes de B2B) renderiza el residencial", () => {
  const texto = textoDe(undefined);
  assert.ok(texto.includes("tu hogar"), "un snapshot sin variante debe renderizar como residencial");
});

// Tests del calculator con el caso real Jose Gonzalez (V9 / Excel "Negocio
// Paneles v8"). Runner builtin node:test:
//   npm run test:proposal
//   node --import tsx --test src/services/proposal/calculator.test.ts
//
// Los valores esperados salen de la hoja CALCULADORA del Excel para el caso
// Gonzalez (11 paneles, trifásico, dólar 40). Ver
// docs/features/proposals-v2/casos_referencia/Negocio_Paneles_v8.xlsx.

import { strict as assert } from "node:assert";
import { test } from "node:test";

import {
  calculate,
  getCuadrillaEscalon,
  getMultiplicadorElectrica,
  interpretarMarkup,
  pmt,
} from "./calculator.js";
import { defaultsFixture } from "./test-fixtures.js";
import type { ProposalData } from "./types.js";

const input: ProposalData = {
  cliente: {
    nombre: "Jose Gonzalez",
    dirigidoA: "Estimado Jose Gonzalez,",
    ciudad: "El Pinar, Canelones",
  },
  factura: {
    pagaMensualPesos: 6000,
    tarifa: "Simple",
    suministro: "trifásico",
    potenciaContratadaKw: 7,
  },
  techo: { descripcion: "de hormigon de 8 x 4 mts.", tamanoM2: 32 },
  cotizacion: { distanciaInstalacionKm: 35, cotizacionDolar: 40, markupPorcentaje: 0.2, plazoEntrega: "6 a 8 semanas" },
  sistema: {
    cantidadPaneles: 11,
    potenciaPanelW: 590,
    marcaPaneles: "Resun",
    potenciaInversorKw: 6,
    marcaInversor: "Growatt",
    tipoMontaje: "Techo de hormigón",
  },
  fecha: "2026-07-03",
  itemsAdicionales: [],
};

// Defaults corregidos (espejan el singleton tras grant-fix-gonzalez-defaults).
const defaults = defaultsFixture;


const r = calculate(input, defaults);

function approx(actual: number, expected: number, tolAbs: number, msg: string) {
  assert.ok(
    Math.abs(actual - expected) <= tolAbs,
    `${msg}: esperado ~${expected} (±${tolAbs}), obtenido ${actual}`,
  );
}

// ─── Escalón de cuadrilla (Excel U3 / IFS) ──────────────────────────────────
test("getCuadrillaEscalon: bordes de cada escalón", () => {
  const cases: [number, number][] = [
    [1, 2], [11, 2], [12, 2], [13, 3], [18, 3], [19, 4], [30, 4], [31, 5],
    [50, 5], [51, 6], [75, 6], [76, 7], [100, 7], [101, 8], [200, 8],
  ];
  for (const [paneles, esperado] of cases) {
    assert.equal(getCuadrillaEscalon(paneles), esperado, `${paneles} paneles → cuadrilla ${esperado}`);
  }
});

// ─── Multiplicador eléctrico por tramo de paneles (editable en Admin) ───────
test("getMultiplicadorElectrica: bordes de cada tramo (el redondo cierra, <=)", () => {
  const tabla = [1, 2, 3, 4, 5, 8, 10];
  const cases: [number, number][] = [
    [1, 1], [10, 1], [11, 2], [20, 2], [21, 3], [30, 3], [31, 4], [40, 4],
    [41, 5], [50, 5], [51, 8], [100, 8], [101, 10], [500, 10],
  ];
  for (const [paneles, esperado] of cases) {
    assert.equal(
      getMultiplicadorElectrica(paneles, tabla),
      esperado,
      `${paneles} paneles → multiplicador ${esperado}`,
    );
  }
});

test("multiplicador eléctrico ×2 (11 paneles) sube el equipamiento exactamente +750", () => {
  const conEscalon = { ...defaults, multiplicadorElectricaEscalones: [1, 2, 3, 4, 5, 8, 10] };
  const rEscalon = calculate(input, conEscalon); // 11 paneles trifásico → tramo ≤20 → ×2
  // Base tri 750 → ×2 = 1500; delta sobre el caso neutro (×1) = +750.
  approx(rEscalon.costoEquipamientoSinIva, r.costoEquipamientoSinIva + 750, 1e-9, "delta eléctrica ×2");
});

// ─── PMT (cuota francesa) ───────────────────────────────────────────────────
test("pmt: tasa 0 = capital / cuotas", () => approx(pmt(1000, 0, 10), 100, 1e-9, "pmt tasa 0"));
test("pmt: caso conocido 100k @ 1% x 12", () => approx(pmt(100000, 0.01, 12), 8884.88, 0.01, "pmt 1%"));

// ─── Cuotas BBVA: valores del Excel "Financiacion BBVA" (Gonzalez) ──────────
test("cuota BBVA 24 meses", () => approx(r.cuota24m, 22450, 5, "cuota24m"));
test("cuota BBVA 36 meses", () => approx(r.cuota36m, 15453, 5, "cuota36m"));
test("cuota BBVA 60 meses", () => approx(r.cuota60m, 10543, 5, "cuota60m"));

// ─── Caso Gonzalez: valores exactos del Excel ───────────────────────────────
test("potencia total kWp", () => approx(r.potenciaTotalKwp, 6.49, 0.001, "potenciaTotalKwp"));
test("costo equipamiento sin IVA", () => approx(r.costoEquipamientoSinIva, 4810, 0.5, "costoEquipamientoSinIva"));
test("costo fijo asignado sin IVA", () => approx(r.costoFijoAsignadoUsdSinIva, 1880.21, 0.5, "costoFijoAsignadoUsdSinIva"));
test("costo variable sin IVA", () => approx(r.costoVariableUsdSinIva, 282.5, 0.5, "costoVariableUsdSinIva"));
test("costo total sin IVA", () => approx(r.costoTotalSinIva, 6972.71, 0.5, "costoTotalSinIva"));
test("mano de obra USD sin IVA = 1152 exacto (cuadrilla 2)", () =>
  approx(r.manoDeObraUsdSinIva, 1152, 1e-9, "manoDeObraUsdSinIva"));
test("markup USD sin IVA", () => approx(r.markupUsdSinIva, 1624.94, 0.5, "markupUsdSinIva"));
test("comisión ventas sin IVA", () => approx(r.comisionVentasUsdSinIva, 389.99, 0.5, "comisionVentasUsdSinIva"));
test("subtotal sin IVA", () => approx(r.subtotalSinIva, 10529.62, 0.5, "subtotalSinIva"));
test("total con IVA", () => approx(r.totalConIva, 12846.14, 0.5, "totalConIva"));

// ─── Relaciones internas (siempre verdaderas) ───────────────────────────────
test("equipamiento con IVA = sin IVA * 1.22", () =>
  approx(r.costoEquipamientoConIva, r.costoEquipamientoSinIva * 1.22, 0.01, "equipConIva"));
test("IVA = subtotal * 0.22", () => approx(r.iva, r.subtotalSinIva * 0.22, 0.01, "iva"));
test("total con IVA = subtotal * 1.22", () =>
  approx(r.totalConIva, r.subtotalSinIva * 1.22, 0.01, "totalConIva-rel"));
test("total final = total + ítems con IVA", () =>
  approx(r.totalFinalConIva, r.totalConIva + r.itemsAdicionalesTotalConIva, 0.01, "totalFinal"));
test("TIR = ahorro anual / total con IVA", () =>
  approx(r.tir, r.ahorroAnualUsd / r.totalConIva, 1e-9, "tir-rel"));
test("PRI años = PRI meses / 12", () => approx(r.priAnios, r.priMeses / 12, 1e-9, "priAnios-rel"));
test("generación mensual: 12 valores que suman ≈ anual", () => {
  assert.equal(r.generacionMensualKwh.length, 12);
  const suma = r.generacionMensualKwh.reduce((a, b) => a + b, 0);
  approx(suma, r.energiaAnualKwh, 5, "suma generación mensual");
});
test("fechas formateadas", () => {
  assert.equal(r.fechaTextoLargo, "3 de julio de 2026");
  assert.equal(r.mesYAnio, "Julio 2026");
});

// ─── interpretarMarkup: acepta decimal y porcentaje ─────────────────────────
test("interpretarMarkup: decimal (≤1) se usa tal cual", () => {
  approx(interpretarMarkup(0.2), 0.2, 1e-9, "0.2");
  approx(interpretarMarkup(0.5), 0.5, 1e-9, "0.5");
});
test("interpretarMarkup: porcentaje (>1) se divide por 100", () => {
  approx(interpretarMarkup(20), 0.2, 1e-9, "20");
  approx(interpretarMarkup(50), 0.5, 1e-9, "50");
});
test("markup 20 (porcentaje) da el mismo markup que 0.2 (decimal)", () => {
  const con = (m: number) =>
    calculate({ ...input, cotizacion: { ...input.cotizacion, markupPorcentaje: m } }, defaults).markupUsdSinIva;
  approx(con(20), con(0.2), 1e-9, "markup 20 == 0.2");
});

// ─── Factor de ahorro por tarifa (Excel J16) ────────────────────────────────
// potenciaTotalW = 11 × 590 = 6490; ahorroMensualPesos = potenciaTotalW × factor.
const conTarifa = (tarifa: "Simple" | "Doble" | "Triple", defs = defaults) =>
  calculate({ ...input, factura: { ...input.factura, tarifa } }, defs);

test("tarifa Simple → factor 1.05 (matchea Excel: 6490 × 1.05)", () =>
  approx(conTarifa("Simple").ahorroMensualPesos, 6490 * 1.05, 0.01, "ahorro Simple"));
test("tarifa Doble → factor 0.88 (matchea Excel: 6490 × 0.88)", () =>
  approx(conTarifa("Doble").ahorroMensualPesos, 6490 * 0.88, 0.01, "ahorro Doble"));
test("tarifa Triple → factor 0.88 placeholder (6490 × 0.88)", () =>
  approx(conTarifa("Triple").ahorroMensualPesos, 6490 * 0.88, 0.01, "ahorro Triple"));

test("Doble y Triple hoy dan lo mismo (placeholder), pero por variables distintas", () =>
  approx(conTarifa("Doble").ahorroMensualPesos, conTarifa("Triple").ahorroMensualPesos, 1e-9, "Doble=Triple placeholder"));

test("estructural: editar factorAhorroTriple lo usa la calculadora (no hardcode)", () => {
  const defsTriple90 = { ...defaults, factorAhorroTriple: 0.9 };
  approx(conTarifa("Triple", defsTriple90).ahorroMensualPesos, 6490 * 0.9, 0.01, "ahorro Triple 0.90");
  // y no afecta a Doble
  approx(conTarifa("Doble", defsTriple90).ahorroMensualPesos, 6490 * 0.88, 0.01, "Doble intacto");
});

// ─── Comisión variable en propuestas a empresas (B2B) ───────────────────────
//
// Fórmula: comisión = base% × (costo + MO + markup) + tajada% × markup excedente,
// donde el excedente es lo que supera el markup de referencia. Con los defaults
// de arriba: referencia 20%, base 4%, tajada 30%.
//
// Base del caso Gonzalez: costoTotalSinIva 6972.71 + manoDeObra 1152 = 8124.71.
const BASE_COSTO_MO = 8124.71;

const conVariante = (variante: "RESIDENCIAL" | "EMPRESA", markupPorcentaje: number) =>
  calculate(
    { ...input, variante, cotizacion: { ...input.cotizacion, markupPorcentaje } },
    defaults,
  );

test("B2B en el markup de referencia: comisión idéntica a la residencial", () => {
  const empresa = conVariante("EMPRESA", 20);
  const residencial = conVariante("RESIDENCIAL", 20);
  approx(empresa.markupExcedenteUsdSinIva, 0, 1e-9, "excedente en la referencia");
  approx(empresa.comisionVentasUsdSinIva, residencial.comisionVentasUsdSinIva, 1e-9, "comisión igual");
  approx(empresa.comisionVentasUsdSinIva, 389.99, 0.5, "comisión B2B @20%");
  approx(empresa.comisionVentasPctEfectivo, 0.04, 1e-9, "pct efectivo = base");
});

test("B2B con markup 30%: la comisión suma la tajada del excedente", () => {
  const r30 = conVariante("EMPRESA", 30);
  // excedente = (30% − 20%) × 8124.71 = 812.47
  approx(r30.markupExcedenteUsdSinIva, 812.47, 0.5, "markupExcedente");
  // base = 4% × (8124.71 + 2437.41) = 422.48 ; extra = 30% × 812.47 = 243.74
  approx(r30.comisionVentasBaseUsdSinIva, 422.48, 0.5, "comisión base");
  approx(r30.comisionVentasExcedenteUsdSinIva, 243.74, 0.5, "comisión excedente");
  approx(r30.comisionVentasUsdSinIva, 666.22, 0.5, "comisión total");
  approx(r30.comisionVentasPctEfectivo, 0.0631, 0.0005, "pct efectivo");
  // La misma propuesta como residencial cobra solo la parte porcentual.
  approx(conVariante("RESIDENCIAL", 30).comisionVentasUsdSinIva, 422.48, 0.5, "residencial @30%");
});

test("B2B por debajo de la referencia: sin excedente ni comisión negativa", () => {
  const r10 = conVariante("EMPRESA", 10);
  approx(r10.markupExcedenteUsdSinIva, 0, 1e-9, "excedente clampeado a 0");
  approx(r10.comisionVentasExcedenteUsdSinIva, 0, 1e-9, "sin tajada");
  approx(r10.comisionVentasUsdSinIva, r10.comisionVentasBaseUsdSinIva, 1e-9, "solo la base");
});

test("la variante no contamina: residencial con markup alto sigue en el % plano", () => {
  const r40 = conVariante("RESIDENCIAL", 40);
  approx(r40.markupExcedenteUsdSinIva, 0, 1e-9, "sin excedente en residencial");
  approx(
    r40.comisionVentasUsdSinIva,
    (BASE_COSTO_MO + r40.markupUsdSinIva) * defaults.comisionVendedorPorcentaje,
    0.01,
    "comisión = 4% plano",
  );
});

test("sin variante (snapshots viejos) se comporta como residencial", () => {
  const sinVariante = calculate({ ...input, cotizacion: { ...input.cotizacion, markupPorcentaje: 30 } }, defaults);
  approx(sinVariante.comisionVentasUsdSinIva, conVariante("RESIDENCIAL", 30).comisionVentasUsdSinIva, 1e-9, "= residencial");
});

test("el desglose de comisión suma el total, y el % efectivo lo reconstruye", () => {
  for (const [variante, markup] of [["EMPRESA", 26], ["EMPRESA", 20], ["RESIDENCIAL", 26]] as const) {
    const c = conVariante(variante, markup);
    approx(
      c.comisionVentasBaseUsdSinIva + c.comisionVentasExcedenteUsdSinIva,
      c.comisionVentasUsdSinIva,
      1e-9,
      `desglose ${variante} @${markup}%`,
    );
    const baseComision = c.costoTotalSinIva + c.manoDeObraUsdSinIva + c.markupUsdSinIva;
    approx(c.comisionVentasPctEfectivo * baseComision, c.comisionVentasUsdSinIva, 1e-6, `pct efectivo ${variante} @${markup}%`);
  }
});

test("invariante: la ganancia de la empresa sigue siendo el markup, sin importar la comisión", () => {
  for (const [variante, markup] of [["EMPRESA", 35], ["EMPRESA", 20], ["RESIDENCIAL", 35], ["RESIDENCIAL", 15]] as const) {
    const c = conVariante(variante, markup);
    approx(c.gananciaFinal, c.markupUsdSinIva, 0.01, `gananciaFinal ≡ markup (${variante} @${markup}%)`);
  }
});

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

import { calculate, getCuadrillaEscalon } from "./calculator.js";
import type { ProposalData, ProposalDefaultsResolved } from "./types.js";

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
const defaults: ProposalDefaultsResolved = {
  precioPanelUsdSinIva: 100,
  precioEstructuraUsdSinIva: 90,
  precioElectricaMonoUsdSinIva: 492,
  precioElectricaTriUsdSinIva: 750,
  precioInversorMonoSub7Usd: 1000,
  precioInversorMonoSup7Usd: 1300,
  precioInversorTriSub11Usd: 1750,
  precioInversorTri12Usd: 2000,
  precioInversorTri21Usd: 2200,
  precioInversorTri31Usd: 2800,
  precioInversorTri51Usd: 5000,
  precioInversorTriMas: 8000,
  precioMeterMonoUsd: 110,
  precioMeterTriUsd: 220,
  costoFijoTotalPesosMes: 300833.68,
  negociosPromedioMes: 4,
  costoFletePorKm: 60,
  costoNaftaTotalPesos: 700,
  costoAlojamientoPesos: 3500,
  costoViaticosPesos: 3000,
  costoOtrosPesos: 2000,
  tarifaCatAPorHora: 814,
  tarifaCatCPorHora: 947,
  tarifaCatDPorHora: 543,
  horasManoDeObraPorInstalacion: 10,
  comisionVendedorPorcentaje: 0.04,
  comisionBbvaPorcentaje: 0.04,
  bbva24mInteresUI: 0,
  bbva36mInteresUI: 0,
  bbva60mInteresUI: 0.05,
  cotizacionUI: 6.33,
  bbva24mGastosAdminCapital: 0.025,
  bbva36mGastosAdminCapital: 0.045,
  bbva60mGastosAdminCapital: 0.015,
  bbva24mFactorCuota: 1.023,
  bbva36mFactorCuota: 1.036,
  bbva60mFactorCuota: 1.071,
};

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

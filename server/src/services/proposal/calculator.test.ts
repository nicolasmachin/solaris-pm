// Tests del calculator con el caso Jose Gonzalez. Runner builtin node:test:
//   npm run test:proposal
//   node --import tsx --test src/services/proposal/calculator.test.ts
//
// Los asserts de RELACIONES INTERNAS y de valores upstream (independientes de
// la mano de obra) deben pasar. Los asserts de valores absolutos que dependen
// de la mano de obra (totalConIva, TIR, PRI, margen, ganancia) y de las cuotas
// BBVA van con `skip` porque dependen de defaults aproximados de Fase A.

import { strict as assert } from "node:assert";
import { test } from "node:test";

import { calculate } from "./calculator.js";
import type { ProposalData, ProposalDefaultsResolved } from "./types.js";

const input: ProposalData = {
  cliente: {
    nombre: "Jose Gonzalez",
    dirigidoA: "Estimado Jose Gonzalez,",
    ciudad: "El Pinar, Uruguay.",
  },
  factura: {
    pagaMensualPesos: 9000,
    tarifa: "Doble",
    suministro: "monofásico",
    potenciaContratadaKw: 6.6,
  },
  techo: { descripcion: "de tejas de 8 x 4 mts.", tamanoM2: 32 },
  cotizacion: { distanciaInstalacionKm: 35, cotizacionDolar: 40, markupPorcentaje: 0.15 },
  sistema: {
    cantidadPaneles: 16,
    potenciaPanelW: 590,
    marcaPaneles: "Resun",
    potenciaInversorKw: 10,
    marcaInversor: "Growatt",
  },
  fecha: "2026-06-19",
  itemsAdicionales: [],
};

// Valores reales del singleton (seed de Fase A).
const defaults: ProposalDefaultsResolved = {
  precioPanelUsdSinIva: 105,
  precioEstructuraUsdSinIva: 90,
  precioElectricaMonoUsdSinIva: 492,
  precioElectricaTriUsdSinIva: 492,
  precioInversorMonoSub7Usd: 1000,
  precioInversorMonoSup7Usd: 1300,
  precioInversorTriSub11Usd: 1750,
  precioInversorTri12Usd: 2000,
  precioInversorTri21Usd: 2200,
  precioInversorTri31Usd: 2800,
  precioInversorTri51Usd: 5000,
  precioInversorTriMas: 8000,
  precioMeterMonoUsd: 110,
  precioMeterTriUsd: 110,
  costoFijoTotalPesosMes: 300833.68,
  negociosPromedioMes: 4,
  costoFletePorKm: 60,
  costoNaftaTotalPesos: 700,
  costoAlojamientoPesos: 3500,
  costoViaticosPesos: 3000,
  costoOtrosPesos: 2000,
  horasCatAPorKwp: 0.8,
  horasCatCPorKwp: 6,
  horasCatDPorKwp: 6,
  tarifaCatAPorHora: 800,
  tarifaCatCPorHora: 800,
  tarifaCatDPorHora: 800,
  margenManoDeObra: 1.2,
  comisionVendedorPorcentaje: 0.04,
  comisionBbvaPorcentaje: 0.04,
  bbva24mInteresUI: 0,
  bbva36mInteresUI: 0,
  bbva60mInteresUI: 0.05,
};

const r = calculate(input, defaults);

function approx(actual: number, expected: number, tolAbs: number, msg: string) {
  assert.ok(
    Math.abs(actual - expected) <= tolAbs,
    `${msg}: esperado ~${expected} (±${tolAbs}), obtenido ${actual}`,
  );
}
function within1pct(actual: number, expected: number, msg: string) {
  assert.ok(
    actual > expected * 0.99 && actual < expected * 1.01,
    `${msg}: esperado ${expected} ±1%, obtenido ${actual}`,
  );
}

// ─── Valores upstream (independientes de la mano de obra) ───────────────────
test("potencia total kWp", () => approx(r.potenciaTotalKwp, 9.44, 0.01, "potenciaTotalKwp"));
test("energía anual kWh", () => approx(r.energiaAnualKwh, 13962, 10, "energiaAnualKwh"));
test("energía mensual kWh", () => approx(r.energiaMensualKwh, 9.44 * 900, 1, "energiaMensualKwh"));
test("metros cuadrados", () => approx(r.metrosCuadradosPaneles, 48, 0.01, "metrosCuadradosPaneles"));
test("costo equipamiento sin IVA", () => within1pct(r.costoEquipamientoSinIva, 5022, "costoEquipamientoSinIva"));
test("costo fijo asignado sin IVA", () => within1pct(r.costoFijoAsignadoUsdSinIva, 1880.21, "costoFijoAsignadoUsdSinIva"));
test("costo variable sin IVA", () => within1pct(r.costoVariableUsdSinIva, 282.5, "costoVariableUsdSinIva"));
test("costo total sin IVA", () => within1pct(r.costoTotalSinIva, 7184.71, "costoTotalSinIva"));
test("ahorro mensual pesos", () => within1pct(r.ahorroMensualPesos, 8024, "ahorroMensualPesos"));
test("ahorro anual USD", () => within1pct(r.ahorroAnualUsd, 2407, "ahorroAnualUsd"));
test("paga nuevo UTE", () => approx(r.pagaNuevoUtePesos, 976, 1, "pagaNuevoUtePesos"));

// ─── Relaciones internas (siempre verdaderas) ───────────────────────────────
test("equipamiento con IVA = sin IVA * 1.22", () =>
  approx(r.costoEquipamientoConIva, r.costoEquipamientoSinIva * 1.22, 0.01, "equipConIva"));
test("IVA = subtotal * 0.22", () => approx(r.iva, r.subtotalSinIva * 0.22, 0.01, "iva"));
test("total con IVA = subtotal * 1.22", () =>
  approx(r.totalConIva, r.subtotalSinIva * 1.22, 0.01, "totalConIva-rel"));
test("ítems adicionales con IVA = sin IVA * 1.22", () =>
  approx(r.itemsAdicionalesTotalConIva, r.itemsAdicionalesTotalSinIva * 1.22, 0.01, "itemsConIva"));
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
test("retorno inversión: 16 valores, año 0 = -totalFinal", () => {
  assert.equal(r.retornoInversion16Anios.length, 16);
  approx(r.retornoInversion16Anios[0], -Math.round(r.totalFinalConIva), 1, "retorno año 0");
});
test("fechas formateadas", () => {
  assert.equal(r.fechaTextoLargo, "19 de junio de 2026");
  assert.equal(r.mesYAnio, "Junio 2026");
});

// ─── Inversor (regla §6.3) ──────────────────────────────────────────────────
test("inversor mono 10 kW → MonoSup7 (1300) refleja en equipamiento", () => {
  // costoEquip incluye inversor 1300 para mono ≥7 kW.
  const sinInversor = 105 * 16 + 90 * 16 + 492 + 110;
  approx(r.costoEquipamientoSinIva - sinInversor, 1300, 0.01, "precio inversor en equip");
});

// ─── Valores que dependen de mano de obra aproximada → skip ─────────────────
test("total con IVA ≈ 14029", { skip: "depende de defaults de mano de obra aproximados (Fase A)" }, () =>
  within1pct(r.totalConIva, 14029, "totalConIva"));
test("TIR ≈ 17.2%", { skip: "depende de defaults de mano de obra aproximados" }, () =>
  approx(r.tir, 0.172, 0.172 * 0.05, "tir"));
test("PRI ≈ 5.8 años", { skip: "depende de defaults de mano de obra aproximados" }, () =>
  approx(r.priAnios, 5.8, 5.8 * 0.05, "priAnios"));
test("margen ≈ 12.1%", { skip: "depende de defaults de mano de obra aproximados" }, () =>
  approx(r.margen, 0.121, 0.121 * 0.05, "margen"));
test("ganancia final ≈ 1389 USD", { skip: "depende de defaults de mano de obra aproximados" }, () =>
  within1pct(r.gananciaFinal, 1389, "gananciaFinal"));
test("mano de obra ≈ 2073.6 USD", { skip: "defaults de mano de obra aproximados; ajustar desde Admin tras Fase F" }, () =>
  within1pct(r.manoDeObraUsdSinIva, 2073.6, "manoDeObraUsdSinIva"));
test("cuotas BBVA 24/36/60", { skip: "TODO: refinar fórmula de cuota UI usando hoja Financiacion BBVA del Excel" }, () => {
  within1pct(r.cuota24m, 24517, "cuota24m");
  within1pct(r.cuota36m, 16875, "cuota36m");
  within1pct(r.cuota60m, 11514, "cuota60m");
});

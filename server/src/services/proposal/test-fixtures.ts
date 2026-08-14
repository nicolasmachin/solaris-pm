// Defaults resueltos del caso de referencia Jose Gonzalez (espejan el singleton
// tras grant-fix-gonzalez-defaults). Viven acá y no dentro de un .test.ts para
// que los usen varias suites sin importarse tests entre sí (lo que los correría
// dos veces).

import type { ProposalDefaultsResolved } from "./types.js";

export const defaultsFixture: ProposalDefaultsResolved = {
  precioPanelUsdSinIva: 100,
  precioEstructuraUsdSinIva: 90,
  precioElectricaMonoUsdSinIva: 492,
  precioElectricaTriUsdSinIva: 750,
  // Neutro (×1 en todos los tramos): mantiene el espejo exacto del Excel Gonzalez.
  // El escalonado real [1,2,3,4,5,8,10] se testea aparte más abajo.
  multiplicadorElectricaEscalones: [1, 1, 1, 1, 1, 1, 1],
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
  rendimientoAnualKwhPorKwp: 1479,
  metrosCuadradosPorPanel: 3,
  factoresGeneracionMensual: [0.105, 0.095, 0.092, 0.08, 0.07, 0.062, 0.066, 0.074, 0.082, 0.09, 0.092, 0.092],
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
  factorAhorroSimple: 1.05,
  factorAhorroDoble: 0.88,
  factorAhorroTriple: 0.88,
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
  b2bMarkupReferenciaPorcentaje: 20,
  b2bComisionBasePorcentaje: 0.04,
  b2bComisionExcedentePorcentaje: 0.3,
};

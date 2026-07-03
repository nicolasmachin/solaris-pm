import type { ProposalDefaultsResolved } from "./types.js";

// Extrae el `value` numérico de cada variable {value, asesorCanOverride} del
// JSON `data` del singleton ProposalDefaults, devolviendo la estructura plana
// que consume el calculator. Si falta una clave o no es numérica, tira error
// claro indicando cuál. (marcas y plazos no van: el calculator no los usa.)
export function resolveDefaults(rawDefaults: unknown): ProposalDefaultsResolved {
  if (typeof rawDefaults !== "object" || rawDefaults === null) {
    throw new Error("ProposalDefaults.data inválido (no es un objeto)");
  }
  const raw = rawDefaults as Record<string, unknown>;

  function num(key: string): number {
    const entry = raw[key];
    if (typeof entry !== "object" || entry === null || !("value" in entry)) {
      throw new Error(`Falta la variable de defaults "${key}" — corré el seed de propuestas`);
    }
    const value = (entry as { value: unknown }).value;
    if (typeof value !== "number" || Number.isNaN(value)) {
      throw new Error(`La variable de defaults "${key}" no es un número válido`);
    }
    return value;
  }

  return {
    precioPanelUsdSinIva: num("precioPanelUsdSinIva"),
    precioEstructuraUsdSinIva: num("precioEstructuraUsdSinIva"),
    precioElectricaMonoUsdSinIva: num("precioElectricaMonoUsdSinIva"),
    precioElectricaTriUsdSinIva: num("precioElectricaTriUsdSinIva"),
    precioInversorMonoSub7Usd: num("precioInversorMonoSub7Usd"),
    precioInversorMonoSup7Usd: num("precioInversorMonoSup7Usd"),
    precioInversorTriSub11Usd: num("precioInversorTriSub11Usd"),
    precioInversorTri12Usd: num("precioInversorTri12Usd"),
    precioInversorTri21Usd: num("precioInversorTri21Usd"),
    precioInversorTri31Usd: num("precioInversorTri31Usd"),
    precioInversorTri51Usd: num("precioInversorTri51Usd"),
    precioInversorTriMas: num("precioInversorTriMas"),
    precioMeterMonoUsd: num("precioMeterMonoUsd"),
    precioMeterTriUsd: num("precioMeterTriUsd"),

    costoFijoTotalPesosMes: num("costoFijoTotalPesosMes"),
    negociosPromedioMes: num("negociosPromedioMes"),

    costoFletePorKm: num("costoFletePorKm"),
    costoNaftaTotalPesos: num("costoNaftaTotalPesos"),
    costoAlojamientoPesos: num("costoAlojamientoPesos"),
    costoViaticosPesos: num("costoViaticosPesos"),
    costoOtrosPesos: num("costoOtrosPesos"),

    tarifaCatAPorHora: num("tarifaCatAPorHora"),
    tarifaCatCPorHora: num("tarifaCatCPorHora"),
    tarifaCatDPorHora: num("tarifaCatDPorHora"),
    horasManoDeObraPorInstalacion: num("horasManoDeObraPorInstalacion"),

    comisionVendedorPorcentaje: num("comisionVendedorPorcentaje"),
    comisionBbvaPorcentaje: num("comisionBbvaPorcentaje"),

    factorAhorroSimple: num("factorAhorroSimple"),
    factorAhorroDoble: num("factorAhorroDoble"),
    factorAhorroTriple: num("factorAhorroTriple"),

    bbva24mInteresUI: num("bbva24mInteresUI"),
    bbva36mInteresUI: num("bbva36mInteresUI"),
    bbva60mInteresUI: num("bbva60mInteresUI"),
    cotizacionUI: num("cotizacionUI"),
    bbva24mGastosAdminCapital: num("bbva24mGastosAdminCapital"),
    bbva36mGastosAdminCapital: num("bbva36mGastosAdminCapital"),
    bbva60mGastosAdminCapital: num("bbva60mGastosAdminCapital"),
    bbva24mFactorCuota: num("bbva24mFactorCuota"),
    bbva36mFactorCuota: num("bbva36mFactorCuota"),
    bbva60mFactorCuota: num("bbva60mFactorCuota"),
  };
}

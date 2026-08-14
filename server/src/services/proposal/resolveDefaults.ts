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

  function numArray(key: string, length: number): number[] {
    const entry = raw[key];
    if (typeof entry !== "object" || entry === null || !("value" in entry)) {
      throw new Error(`Falta la variable de defaults "${key}" — corré el seed de propuestas`);
    }
    const value = (entry as { value: unknown }).value;
    if (
      !Array.isArray(value) ||
      value.length !== length ||
      value.some((v) => typeof v !== "number" || Number.isNaN(v))
    ) {
      throw new Error(`La variable de defaults "${key}" debe ser un array de ${length} números`);
    }
    return value as number[];
  }

  return {
    precioPanelUsdSinIva: num("precioPanelUsdSinIva"),
    precioEstructuraUsdSinIva: num("precioEstructuraUsdSinIva"),
    precioElectricaMonoUsdSinIva: num("precioElectricaMonoUsdSinIva"),
    precioElectricaTriUsdSinIva: num("precioElectricaTriUsdSinIva"),
    multiplicadorElectricaEscalones: numArray("multiplicadorElectricaEscalones", 7),
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

    rendimientoAnualKwhPorKwp: num("rendimientoAnualKwhPorKwp"),
    metrosCuadradosPorPanel: num("metrosCuadradosPorPanel"),
    factoresGeneracionMensual: numArray("factoresGeneracionMensual", 12),

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

    // Comisión variable de las propuestas a empresas. La salida va PLANA a
    // propósito: `snapshot.defaults` está tipado como record de
    // number|string|number[], así que un objeto anidado acá rompería la
    // publicación de todas las propuestas, no solo las B2B.
    b2bMarkupReferenciaPorcentaje: numIn("b2b", "markupReferenciaPorcentaje", 20),
    b2bComisionBasePorcentaje: numIn("b2b", "comisionBasePorcentaje", 0.04),
    b2bComisionExcedentePorcentaje: numIn("b2b", "comisionExcedentePorcentaje", 0.3),
  };

  // Variable dentro de un subobjeto del singleton (como `plazos` o `b2b`).
  //
  // A diferencia de `num`, degrada al valor semilla en vez de tirar: si el seed
  // todavía no corrió en un ambiente, un error acá tumbaría también las
  // propuestas residenciales, que son las que sostienen la operación. Las
  // claves planas preexistentes mantienen el comportamiento estricto.
  function numIn(group: string, key: string, fallback: number): number {
    const node = raw[group];
    if (typeof node !== "object" || node === null) return fallback;
    const entry = (node as Record<string, unknown>)[key];
    if (typeof entry !== "object" || entry === null || !("value" in entry)) return fallback;
    const value = (entry as { value: unknown }).value;
    return typeof value === "number" && Number.isFinite(value) ? value : fallback;
  }
}

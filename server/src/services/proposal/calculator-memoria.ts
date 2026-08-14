// Metadata + builder de los VALORES DEL SINGLETON para la memoria de cálculo
// (Fase G). Complementa a calculator-labels.ts (que describe los INTERMEDIOS):
// acá describimos las VARIABLES editables del singleton que la memoria interpola
// vía placeholders {{singleton:nombreVariable}}.

import type { CalcUnidad } from "./calculator-labels.js";

export interface MemoriaVarMeta {
  label: string;
  unidad: CalcUnidad;
}

// Label humano + unidad por variable del singleton usada en la memoria.
export const singletonLabels = {
  // Equipamiento (USD sin IVA)
  precioPanelUsdSinIva: { label: "Panel", unidad: "USD" },
  precioEstructuraUsdSinIva: { label: "Estructura", unidad: "USD" },
  precioElectricaMonoUsdSinIva: { label: "Eléctrica monofásica", unidad: "USD" },
  precioElectricaTriUsdSinIva: { label: "Eléctrica trifásica", unidad: "USD" },
  precioMeterMonoUsd: { label: "Meter monofásico", unidad: "USD" },
  precioMeterTriUsd: { label: "Meter trifásico", unidad: "USD" },
  precioInversorMonoSub7Usd: { label: "Inversor mono <7 kW", unidad: "USD" },
  precioInversorMonoSup7Usd: { label: "Inversor mono ≥7 kW", unidad: "USD" },
  precioInversorTriSub11Usd: { label: "Inversor tri <11 kW", unidad: "USD" },
  precioInversorTri12Usd: { label: "Inversor tri (paneles <13)", unidad: "USD" },
  precioInversorTri21Usd: { label: "Inversor tri <21 kW", unidad: "USD" },
  precioInversorTri31Usd: { label: "Inversor tri <31 kW", unidad: "USD" },
  precioInversorTri51Usd: { label: "Inversor tri <51 kW", unidad: "USD" },
  precioInversorTriMas: { label: "Inversor tri ≥51 kW", unidad: "USD" },
  // Costos del negocio (pesos)
  costoFijoTotalPesosMes: { label: "Costo fijo total mensual", unidad: "pesos" },
  negociosPromedioMes: { label: "Negocios promedio por mes", unidad: "" },
  costoFletePorKm: { label: "Flete por km", unidad: "pesos" },
  costoNaftaTotalPesos: { label: "Nafta", unidad: "pesos" },
  costoAlojamientoPesos: { label: "Alojamiento", unidad: "pesos" },
  costoViaticosPesos: { label: "Viáticos", unidad: "pesos" },
  costoOtrosPesos: { label: "Otros costos variables", unidad: "pesos" },
  // Mano de obra
  tarifaCatAPorHora: { label: "Tarifa Electricista", unidad: "pesos" },
  tarifaCatCPorHora: { label: "Tarifa Capataz", unidad: "pesos" },
  tarifaCatDPorHora: { label: "Tarifa CAT D", unidad: "pesos" },
  horasManoDeObraPorInstalacion: { label: "Horas por instalación", unidad: "" },
  // Pricing
  markupPorcentajeDefault: { label: "Markup por defecto", unidad: "%" },
  comisionVendedorPorcentaje: { label: "Comisión vendedor (fracción)", unidad: "" },

  // Comisión variable de las propuestas a empresas. Van con notación de punto
  // porque viven en el subobjeto `b2b` del singleton, y porque
  // `markupPorcentajeDefault` también existe suelto (el del residencial).
  "b2b.markupReferenciaPorcentaje": { label: "B2B · Markup de referencia", unidad: "%" },
  "b2b.comisionBasePorcentaje": { label: "B2B · Comisión base (fracción)", unidad: "" },
  "b2b.comisionExcedentePorcentaje": { label: "B2B · Tajada del excedente (fracción)", unidad: "" },
  comisionBbvaPorcentaje: { label: "Comisión BBVA (fracción)", unidad: "" },
  // Ahorro por tarifa (multiplicadores)
  factorAhorroSimple: { label: "Factor ahorro Simple", unidad: "" },
  factorAhorroDoble: { label: "Factor ahorro Doble", unidad: "" },
  factorAhorroTriple: { label: "Factor ahorro Triple (placeholder)", unidad: "" },
  // Financiación BBVA
  cotizacionUI: { label: "Cotización UI", unidad: "" },
  bbva24mInteresUI: { label: "BBVA 24 — tasa anual", unidad: "" },
  bbva36mInteresUI: { label: "BBVA 36 — tasa anual", unidad: "" },
  bbva60mInteresUI: { label: "BBVA 60 — tasa anual", unidad: "" },
  bbva24mGastosAdminCapital: { label: "BBVA 24 — gastos admin", unidad: "" },
  bbva36mGastosAdminCapital: { label: "BBVA 36 — gastos admin", unidad: "" },
  bbva60mGastosAdminCapital: { label: "BBVA 60 — gastos admin", unidad: "" },
  bbva24mFactorCuota: { label: "BBVA 24 — factor cuota", unidad: "" },
  bbva36mFactorCuota: { label: "BBVA 36 — factor cuota", unidad: "" },
  bbva60mFactorCuota: { label: "BBVA 60 — factor cuota", unidad: "" },
} as const satisfies Record<string, MemoriaVarMeta>;

export interface MemoriaSingletonValue {
  value: number | null; // null si la variable no existe en el singleton (drift)
  label: string;
  unidad: CalcUnidad;
}

// Extrae, para cada variable declarada en singletonLabels, su valor actual del
// JSON `data` del singleton. Si falta o no es numérica, value = null (el cliente
// lo muestra como drift).
export function buildMemoriaSingletonValues(
  rawData: unknown,
): Record<string, MemoriaSingletonValue> {
  const data = (typeof rawData === "object" && rawData !== null ? rawData : {}) as Record<string, unknown>;
  const out: Record<string, MemoriaSingletonValue> = {};
  for (const [key, meta] of Object.entries(singletonLabels)) {
    // "grupo.clave" busca dentro del subobjeto correspondiente.
    const entry = key.includes(".")
      ? (() => {
          const [group, child] = key.split(".");
          const node = data[group];
          return typeof node === "object" && node !== null
            ? (node as Record<string, unknown>)[child]
            : undefined;
        })()
      : data[key];
    const rawValue =
      typeof entry === "object" && entry !== null && "value" in entry
        ? (entry as { value: unknown }).value
        : undefined;
    out[key] = {
      value: typeof rawValue === "number" ? rawValue : null,
      label: meta.label,
      unidad: meta.unidad,
    };
  }
  return out;
}

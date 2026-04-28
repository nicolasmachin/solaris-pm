// Tasa de IVA por defecto (Uruguay)
export const DEFAULT_IVA_TASA = 22.0;

// precio sin IVA → precio con IVA
export function calculateConIva(precioSinIva: number, ivaTasa: number = DEFAULT_IVA_TASA): number {
  return precioSinIva * (1 + ivaTasa / 100);
}

// monto IVA solo (sin el precio base)
export function calculateIvaAmount(precioSinIva: number, ivaTasa: number = DEFAULT_IVA_TASA): number {
  return precioSinIva * (ivaTasa / 100);
}

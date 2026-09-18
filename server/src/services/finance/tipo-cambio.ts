// Cotización vigente del dólar para convertir montos en pesos.
//
// El patrón "último ExchangeRate por createdAt, o 1 si no hay" está copiado en
// muchos handlers de api.routes.ts. Este helper lo concentra para los
// servicios de finanzas nuevos; los handlers viejos siguen con su copia hasta
// que se los toque.

import { Moneda } from "@prisma/client";

import { prisma } from "../../lib/prisma.js";

/** Pesos por dólar según la última cotización cargada. 1 si no hay ninguna. */
export async function ultimoUsdToUyu(): Promise<number> {
  const last = await prisma.exchangeRate.findFirst({ orderBy: { createdAt: "desc" } });
  return last && Number(last.usdToUyu) > 0 ? Number(last.usdToUyu) : 1;
}

/** Conversor a dólares con una cotización fija. */
export function conversorUsd(usdToUyu: number) {
  return (monto: number, moneda: Moneda) =>
    moneda === Moneda.UYU ? (usdToUyu > 0 ? monto / usdToUyu : monto) : monto;
}

import type { ProposalDefaultsResolved } from "./types.js";

// Precio del inversor (USD sin IVA) según red, potencia y cantidad de paneles.
// Regla confirmada (SPEC §6.3): monofásico se parte en <7 / ≥7 kW; trifásico
// tiene el caso especial `Tri12` para sistemas chicos (paneles<13) que superan
// los 11 kW pero no ameritan un inversor de 21 kW.
export function obtenerPrecioInversor(
  suministro: "monofásico" | "trifásico",
  potenciaKw: number,
  cantPaneles: number,
  defaults: ProposalDefaultsResolved,
): number {
  if (suministro === "monofásico") {
    return potenciaKw < 7 ? defaults.precioInversorMonoSub7Usd : defaults.precioInversorMonoSup7Usd;
  }
  // Trifásico
  if (potenciaKw < 11) return defaults.precioInversorTriSub11Usd;
  if (cantPaneles < 13) return defaults.precioInversorTri12Usd;
  if (potenciaKw < 21) return defaults.precioInversorTri21Usd;
  if (potenciaKw < 31) return defaults.precioInversorTri31Usd;
  if (potenciaKw < 51) return defaults.precioInversorTri51Usd;
  return defaults.precioInversorTriMas;
}

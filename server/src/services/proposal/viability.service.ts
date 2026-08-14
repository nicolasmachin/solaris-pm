// Indicadores de viabilidad del borrador (ahorro % + espacio) para el sub-header
// del constructor. Cálculo en el server (VENTAS:VIEW), a diferencia del drawer de
// debug que es admin-only. Ver docs/features/proposals-v2/TANDA_1_SPEC.md §3/§7.

import { ProposalVariante } from "@prisma/client";

import { prisma } from "../../lib/prisma.js";
import { calculate } from "./calculator.js";
import { resolveDefaults } from "./resolveDefaults.js";
import { draftDataPublishSchema } from "./schemas/draft.schema.js";

export interface ViabilityResult {
  ahorroPorcentaje: number | null;
  espacioOcupado: number | null;
  espacioDisponible: number | null;
  // Potencia pico del sistema (kWp) = cantidadPaneles × potenciaPanelW / 1000.
  potenciaPicoKwp: number | null;
  // Tiempo de retorno (PRI) en años y precio por kW con IVA — info del sub-header.
  priAnios: number | null;
  precioPorKwConIva: number | null;
  // Precio final de la propuesta con IVA (incluye ítems adicionales).
  precioFinalConIva: number | null;
  estado: "ok" | "warning" | "error" | "unknown";
}

// Función pura (testeable). `espacioOcupado = cantidadPaneles × 3`,
// `espacioDisponible = tamanoM2`. `ahorroPorcentaje = round(ahorroMensual/paga×100)`.
export function computeViability(input: {
  cantidadPaneles: number | null;
  tamanoM2: number | null;
  pagaMensualPesos: number | null;
  ahorroMensualPesos: number | null;
  potenciaPanelW?: number | null;
  priAnios?: number | null;
  precioPorKwConIva?: number | null;
  precioFinalConIva?: number | null;
}): ViabilityResult {
  const espacioOcupado =
    typeof input.cantidadPaneles === "number" && Number.isFinite(input.cantidadPaneles)
      ? input.cantidadPaneles * 3
      : null;
  const espacioDisponible =
    typeof input.tamanoM2 === "number" && Number.isFinite(input.tamanoM2) && input.tamanoM2 > 0
      ? input.tamanoM2
      : null;

  let estado: ViabilityResult["estado"];
  if (espacioDisponible === null || espacioOcupado === null) {
    estado = "unknown";
  } else if (espacioDisponible < espacioOcupado) {
    estado = "error";
  } else if (espacioDisponible < espacioOcupado * 1.1) {
    estado = "warning";
  } else {
    estado = "ok";
  }

  let ahorroPorcentaje: number | null = null;
  const paga = input.pagaMensualPesos;
  const ahorro = input.ahorroMensualPesos;
  if (typeof paga === "number" && paga > 0 && typeof ahorro === "number" && Number.isFinite(ahorro)) {
    ahorroPorcentaje = Math.round((ahorro / paga) * 100);
  }

  const potenciaPicoKwp =
    typeof input.cantidadPaneles === "number" && Number.isFinite(input.cantidadPaneles) &&
    typeof input.potenciaPanelW === "number" && Number.isFinite(input.potenciaPanelW)
      ? Math.round((input.cantidadPaneles * input.potenciaPanelW) / 10) / 100 // kWp con 2 decimales
      : null;

  return {
    ahorroPorcentaje,
    espacioOcupado,
    espacioDisponible,
    potenciaPicoKwp,
    priAnios: input.priAnios ?? null,
    precioPorKwConIva: input.precioPorKwConIva ?? null,
    precioFinalConIva: input.precioFinalConIva ?? null,
    estado,
  };
}

// Carga el borrador del lead y devuelve los indicadores. El espacio se saca de
// los campos crudos (funciona con borrador parcial); el ahorro requiere que el
// borrador valide strict para correr la calculadora (si no, queda en null).
export async function computeDraftViability(
  leadId: string,
  variante: ProposalVariante = ProposalVariante.RESIDENCIAL,
): Promise<ViabilityResult> {
  const draft = await prisma.proposalV2Draft.findUnique({
    where: { leadId_variante: { leadId, variante } },
  });
  const raw = (draft?.data ?? {}) as {
    sistema?: { cantidadPaneles?: unknown; potenciaPanelW?: unknown };
    techo?: { tamanoM2?: unknown };
    factura?: { pagaMensualPesos?: unknown };
  };
  const numOrNull = (v: unknown): number | null => (typeof v === "number" && Number.isFinite(v) ? v : null);

  let ahorroMensualPesos: number | null = null;
  let priAnios: number | null = null;
  let precioPorKwConIva: number | null = null;
  let precioFinalConIva: number | null = null;
  const parsed = draft ? draftDataPublishSchema.safeParse(draft.data) : null;
  if (parsed?.success) {
    const defaultsRow = await prisma.proposalDefaults.findUnique({ where: { id: "singleton" } });
    if (defaultsRow) {
      const calc = calculate(parsed.data, resolveDefaults(defaultsRow.data));
      ahorroMensualPesos = calc.ahorroMensualPesos;
      priAnios = Number.isFinite(calc.priAnios) ? calc.priAnios : null;
      // Precio por kW con IVA = USD por Watt (totalConIva / potencia W) × 1000.
      precioPorKwConIva = Number.isFinite(calc.usdPorWatt) ? Math.round(calc.usdPorWatt * 1000) : null;
      // Precio final con IVA (incluye ítems adicionales).
      precioFinalConIva = Number.isFinite(calc.totalFinalConIva) ? Math.round(calc.totalFinalConIva) : null;
    }
  }

  return computeViability({
    cantidadPaneles: numOrNull(raw?.sistema?.cantidadPaneles),
    tamanoM2: numOrNull(raw?.techo?.tamanoM2),
    pagaMensualPesos: numOrNull(raw?.factura?.pagaMensualPesos),
    ahorroMensualPesos,
    potenciaPanelW: numOrNull(raw?.sistema?.potenciaPanelW),
    priAnios,
    precioPorKwConIva,
    precioFinalConIva,
  });
}

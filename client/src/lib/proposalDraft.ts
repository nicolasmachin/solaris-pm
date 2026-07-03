// Helpers puros del constructor de propuestas v2: armar el draft inicial desde
// los defaults del singleton + el lead, y mergear el draft guardado (parcial)
// sobre esa base.

import type { LeadDetail } from "../types/leads.types";
import {
  isFlaggedValue,
  type NestedFlagged,
  type ProposalDefaultsData,
  type ProposalDraftData,
} from "../types/proposals-v2";

function numDefault(data: ProposalDefaultsData, key: string, fallback: number): number {
  const v = data[key];
  if (v && isFlaggedValue(v) && typeof v.value === "number") return v.value;
  return fallback;
}

function strDefault(data: ProposalDefaultsData, key: string, fallback: string): string {
  const v = data[key];
  if (v && isFlaggedValue(v) && typeof v.value === "string") return v.value;
  return fallback;
}

// Plazo de entrega por defecto, derivado de los días del singleton (coordinación
// + instalación). Es sólo la precarga; el asesor lo edita.
function plazoDefault(data: ProposalDefaultsData): string {
  const plazos = data.plazos && !isFlaggedValue(data.plazos) ? (data.plazos as NestedFlagged) : {};
  const dias = (k: string) => {
    const v = plazos[k]?.value;
    return typeof v === "number" ? v : 0;
  };
  const semanas = Math.max(1, Math.round((dias("diasCoordinacion") + dias("diasInstalacion")) / 7));
  return `${semanas} a ${semanas + 1} semanas`;
}

function todayIso(): string {
  return new Date().toISOString().slice(0, 10);
}

export function buildInitialDraftData(
  defaults: ProposalDefaultsData,
  lead: Pick<LeadDetail, "clientName" | "roofType" | "notes">,
): ProposalDraftData {
  return {
    cliente: { nombre: lead.clientName, dirigidoA: "", ciudad: "" },
    factura: { pagaMensualPesos: 0, tarifa: "Simple", suministro: "monofásico", potenciaContratadaKw: 0 },
    techo: { descripcion: lead.roofType ?? "", tamanoM2: 0 },
    cotizacion: {
      distanciaInstalacionKm: numDefault(defaults, "distanciaInstalacionKmDefault", 0),
      cotizacionDolar: numDefault(defaults, "cotizacionDolarDefault", 40),
      markupPorcentaje: numDefault(defaults, "markupPorcentajeDefault", 0.15),
      plazoEntrega: plazoDefault(defaults),
    },
    sistema: {
      cantidadPaneles: 0,
      potenciaPanelW: 0,
      marcaPaneles: strDefault(defaults, "marcaPanelesDefault", ""),
      potenciaInversorKw: 0,
      marcaInversor: strDefault(defaults, "marcaInversorDefault", ""),
      tipoMontaje: lead.roofType ?? "",
    },
    fecha: todayIso(),
    notas: lead.notes ?? "",
    itemsAdicionales: [],
  };
}

// Mergea el draft guardado (parcial, lenient) sobre la base inicial.
export function mergeDraft(
  base: ProposalDraftData,
  stored: Partial<ProposalDraftData> | undefined | null,
): ProposalDraftData {
  if (!stored) return base;
  return {
    cliente: { ...base.cliente, ...stored.cliente },
    factura: { ...base.factura, ...stored.factura },
    techo: { ...base.techo, ...stored.techo },
    cotizacion: { ...base.cotizacion, ...stored.cotizacion },
    sistema: { ...base.sistema, ...stored.sistema },
    fecha: stored.fecha ?? base.fecha,
    notas: stored.notas ?? base.notas,
    itemsAdicionales: stored.itemsAdicionales ?? base.itemsAdicionales,
  };
}

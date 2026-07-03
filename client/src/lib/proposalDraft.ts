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
      markupPorcentaje: numDefault(defaults, "markupPorcentajeDefault", 15),
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

// Validación de obligatorios (espeja draftDataPublishSchema del backend — no hay
// zod en el cliente). El backend re-valida en el POST (doble red). Sólo lista lo
// que efectivamente rompe el schema strict (0 es válido donde el schema usa
// min(0); cantidadPaneles<1, potenciaPanelW<100 y dólar<=0 sí rompen).
export interface MissingField {
  path: string;
  section: string;
  sectionLabel: string;
  label: string;
}

const REQUIRED: (MissingField & { ok: (d: ProposalDraftData) => boolean })[] = [
  { path: "cliente.nombre", section: "cliente", sectionLabel: "Cliente", label: "Nombre", ok: (d) => d.cliente.nombre.trim().length > 0 },
  { path: "cliente.ciudad", section: "cliente", sectionLabel: "Cliente", label: "Ciudad", ok: (d) => d.cliente.ciudad.trim().length > 0 },
  { path: "fecha", section: "cliente", sectionLabel: "Cliente", label: "Fecha de la propuesta", ok: (d) => d.fecha.trim().length > 0 },
  { path: "sistema.cantidadPaneles", section: "tecnicos", sectionLabel: "Datos técnicos", label: "Cantidad de paneles", ok: (d) => d.sistema.cantidadPaneles >= 1 },
  { path: "sistema.potenciaPanelW", section: "tecnicos", sectionLabel: "Datos técnicos", label: "Potencia por panel (W)", ok: (d) => d.sistema.potenciaPanelW >= 100 },
  { path: "sistema.marcaPaneles", section: "tecnicos", sectionLabel: "Datos técnicos", label: "Marca de paneles", ok: (d) => d.sistema.marcaPaneles.trim().length > 0 },
  { path: "sistema.marcaInversor", section: "tecnicos", sectionLabel: "Datos técnicos", label: "Marca de inversor", ok: (d) => d.sistema.marcaInversor.trim().length > 0 },
  { path: "sistema.tipoMontaje", section: "tecnicos", sectionLabel: "Datos técnicos", label: "Tipo de montaje", ok: (d) => d.sistema.tipoMontaje.trim().length > 0 },
  { path: "techo.descripcion", section: "tecnicos", sectionLabel: "Datos técnicos", label: "Descripción del techo", ok: (d) => d.techo.descripcion.trim().length > 0 },
  { path: "cotizacion.cotizacionDolar", section: "cotizacion", sectionLabel: "Cotización", label: "Cotización dólar", ok: (d) => d.cotizacion.cotizacionDolar > 0 },
  { path: "cotizacion.plazoEntrega", section: "cotizacion", sectionLabel: "Cotización", label: "Plazo de entrega", ok: (d) => d.cotizacion.plazoEntrega.trim().length > 0 },
];

export function validateDraft(d: ProposalDraftData): { ok: boolean; missing: MissingField[] } {
  const missing = REQUIRED.filter((r) => !r.ok(d)).map(({ ok: _ok, ...rest }) => rest);
  return { ok: missing.length === 0, missing };
}

// Igualdad estable (independiente del orden de las keys) para la detección de
// "sin cambios" del draft vs el snapshot de la última versión publicada.
export function draftEquals(a: ProposalDraftData, b: ProposalDraftData): boolean {
  const stable = (v: unknown): string =>
    JSON.stringify(v, (_k, val) =>
      val && typeof val === "object" && !Array.isArray(val)
        ? Object.keys(val as Record<string, unknown>)
            .sort()
            .reduce((o: Record<string, unknown>, k) => {
              o[k] = (val as Record<string, unknown>)[k];
              return o;
            }, {})
        : val,
    );
  return stable(a) === stable(b);
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

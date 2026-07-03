// Tipos del generador de propuestas v2 (mirror del backend).
// Ver docs/features/proposals-v2/SPEC.md.

/** Cada variable de defaults: valor + si el asesor puede sobrescribirlo. */
export interface FlaggedValue {
  value: number | string;
  asesorCanOverride: boolean;
}

/** Subobjeto de variables flagged (ej. `plazos`). */
export type NestedFlagged = Record<string, FlaggedValue>;

/** Estructura del JSON `data` de ProposalDefaults: cada clave es una variable
 *  flagged o un subobjeto de flagged. */
export type ProposalDefaultsData = Record<string, FlaggedValue | NestedFlagged>;

// ─── Constructor (Fase F) ────────────────────────────────────────────────────

export interface ProposalItemAdicional {
  id: string;
  nombre: string;
  descripcion: string;
  precioSinIvaUsd: number;
  potenciaW?: number;
}

/** Estado del form del constructor — mirror de draftDataPublishSchema. Todos los
 *  campos presentes (el form los mantiene poblados); el autosave manda esto y el
 *  backend lo valida lenient. */
export interface ProposalDraftData {
  cliente: { nombre: string; dirigidoA: string; ciudad: string };
  factura: {
    pagaMensualPesos: number;
    tarifa: "Simple" | "Doble" | "Triple";
    suministro: "monofásico" | "trifásico";
    potenciaContratadaKw: number;
  };
  techo: { descripcion: string; tamanoM2: number };
  cotizacion: {
    distanciaInstalacionKm: number;
    cotizacionDolar: number;
    markupPorcentaje: number;
    plazoEntrega: string;
  };
  sistema: {
    cantidadPaneles: number;
    potenciaPanelW: number;
    marcaPaneles: string;
    potenciaInversorKw: number;
    marcaInversor: string;
    tipoMontaje: string;
  };
  fecha: string;
  notas: string;
  itemsAdicionales: ProposalItemAdicional[];
}

export interface ProposalDraftResponse {
  id: string;
  leadId: string;
  data: Partial<ProposalDraftData>;
  createdAt: string;
  updatedAt: string;
}

export type ProposalVersionStatus = "PUBLISHED" | "DISCARDED";

/** Metadatos livianos del listado de versiones (sin snapshot completo). */
export interface ProposalVersionListItem {
  id: string;
  leadId: string;
  versionNumber: number;
  status: ProposalVersionStatus;
  publishedAt: string;
  publishedById: string;
  clientName: string | null;
  totalConIva: number | null;
}

/** Versión completa (incluye snapshot.data para el deep-equal de "sin cambios"). */
export interface ProposalVersionDetail {
  id: string;
  leadId: string;
  versionNumber: number;
  status: ProposalVersionStatus;
  snapshot: { data: ProposalDraftData; [k: string]: unknown };
  publishedAt: string;
}

/** Texto variable sobre la tapa (coordenadas + estilo). */
export interface CoverOverlayText {
  x: number;
  y: number;
  fontSize: number;
  color: string;
  fontWeight: "regular" | "bold";
}

export interface CoverOverlay {
  clientName: CoverOverlayText;
  city: CoverOverlayText;
  date: CoverOverlayText;
}

/** Respuesta de GET /proposals-v2/defaults. `seeded:false` = falta correr el seed. */
export interface ProposalDefaultsResponse {
  seeded: boolean;
  data: ProposalDefaultsData;
  coverOverlay: CoverOverlay | null;
  coverPdfAttachmentId: string | null;
  updatedAt: string | null;
}

/** Body de PUT /proposals-v2/defaults. Parcial: cada sección se guarda por
 *  separado (variables vs overlay). El backend exige al menos una. */
export interface ProposalDefaultsUpdateInput {
  data?: ProposalDefaultsData;
  coverOverlay?: CoverOverlay;
}

/** Type guard: distingue una variable flagged de un subobjeto. */
export function isFlaggedValue(v: FlaggedValue | NestedFlagged): v is FlaggedValue {
  return typeof v === "object" && v !== null && "value" in v && "asesorCanOverride" in v;
}

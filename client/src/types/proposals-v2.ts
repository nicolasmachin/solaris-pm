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

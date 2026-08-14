// Tipos del generador de propuestas v2 (mirror del backend).
// Ver docs/features/proposals-v2/SPEC.md.

/** Cada variable de defaults: valor + si el asesor puede sobrescribirlo. */
export interface FlaggedValue {
  value: number | string | number[];
  asesorCanOverride: boolean;
}

/** Subobjeto de variables flagged (ej. `plazos`). */
export type NestedFlagged = Record<string, FlaggedValue>;

/** Unidad de un intermedio de la calculadora (mirror de CalcUnidad del server). */
export type CalcUnidad = "USD" | "pesos" | "UI" | "%" | "kWh" | "unidades" | "";

/** Valor de una variable del singleton para la memoria de cálculo. */
export interface MemoriaSingletonValue {
  value: number | null; // null si la variable no existe en el singleton (drift)
  label: string;
  unidad: CalcUnidad;
}

/** Indicadores de viabilidad del borrador (mirror del backend). */
export interface ViabilityResult {
  ahorroPorcentaje: number | null;
  espacioOcupado: number | null;
  espacioDisponible: number | null;
  potenciaPicoKwp: number | null;
  priAnios: number | null;
  precioPorKwConIva: number | null;
  precioFinalConIva: number | null;
  estado: "ok" | "warning" | "error" | "unknown";
}

/** Fila del drawer de debug: metadata (del server) + valor calculado. */
export interface CalcDebugRow {
  key: string;
  label: string;
  descripcion: string;
  unidad: CalcUnidad;
  orden: number;
  valor: number | number[];
}

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
/** Cuál de los dos cotizadores. */
export type ProposalVariante = "RESIDENCIAL" | "EMPRESA";

export interface ProposalDraftData {
  variante: ProposalVariante;
  cliente: { nombre: string; dirigidoA: string; ciudad: string };
  /** Datos fiscales; solo se completan (y se exigen) en el cotizador B2B. */
  empresa: {
    razonSocial: string;
    rut: string;
    contactoNombre: string;
    contactoCargo: string;
  };
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

/** Desglose de la comisión del asesor (explicativo del cotizador B2B). */
export interface ComisionDesglose {
  variante: ProposalVariante;
  markupPorcentaje: number;
  markupReferenciaPorcentaje: number;
  /** Fracciones (0.04 = 4%). */
  comisionBasePorcentaje: number;
  comisionExcedentePorcentaje: number;
  markupExcedenteUsd: number;
  comisionBaseUsd: number;
  comisionExcedenteUsd: number;
  comisionTotalUsd: number;
  comisionPctEfectivo: number;
  /** Lo que cobraría la misma propuesta cotizada al markup de referencia. */
  comisionEnReferenciaUsd: number;
}

export interface ProposalDraftResponse {
  id: string;
  leadId: string;
  variante: ProposalVariante;
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
  /** Tapa propia del cotizador B2B. Null = usa la residencial. */
  coverEmpresaOverlay: CoverOverlay | null;
  coverEmpresaPdfAttachmentId: string | null;
  updatedAt: string | null;
}

/** Body de PUT /proposals-v2/defaults. Parcial: cada sección se guarda por
 *  separado (variables vs overlay). El backend exige al menos una. */
export interface ProposalDefaultsUpdateInput {
  data?: ProposalDefaultsData;
  coverOverlay?: CoverOverlay;
  /** null limpia el overlay propio: la tapa B2B vuelve a las coordenadas de la residencial. */
  coverEmpresaOverlay?: CoverOverlay | null;
}

/** Type guard: distingue una variable flagged de un subobjeto. */
export function isFlaggedValue(v: FlaggedValue | NestedFlagged): v is FlaggedValue {
  return typeof v === "object" && v !== null && "value" in v && "asesorCanOverride" in v;
}

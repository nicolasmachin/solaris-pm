// Metadatos centralizados de las etapas del pipeline. Cubre las 5 etapas viejas
// (proyectos existentes) y las 8 nuevas (proyectos con el pipeline expandido),
// que conviven hasta la migración de datos.

export type PipelineArea = "VENTAS" | "INGENIERIA" | "OPERACIONES" | "UTE" | "CX";

export const AREA_COLOR: Record<PipelineArea, string> = {
  VENTAS: "#2f80ed",
  INGENIERIA: "#9b51e0",
  OPERACIONES: "#f2994a",
  UTE: "#27ae60",
  CX: "#eb5f8a",
};

export const AREA_LABEL: Record<PipelineArea, string> = {
  VENTAS: "Ventas",
  INGENIERIA: "Ingeniería",
  OPERACIONES: "Operaciones",
  UTE: "Tramitación UTE",
  CX: "Experiencia Solar",
};

export const STAGE_AREA: Record<string, PipelineArea> = {
  ONBOARDING: "VENTAS",
  // viejas
  INGENIERIA: "INGENIERIA",
  OPERACIONES: "OPERACIONES",
  HABILITACION_UTE: "UTE",
  POSTVENTA: "CX",
  // nuevas (8 etapas)
  PRE_INGENIERIA: "INGENIERIA",
  VALIDACION_OPERACIONES: "OPERACIONES",
  INGENIERIA_FINAL: "INGENIERIA",
  COMPRAS: "OPERACIONES",
  EJECUCION_OBRA: "OPERACIONES",
  TRAMITACION_UTE: "UTE",
  POST_HABILITACION: "CX",
  // Paralelas de Experiencia Solar
  SEGUIMIENTO_PREOBRA: "CX",
  SEGUIMIENTO_HABILITACION: "CX",
};

// Etapas paralelas de Experiencia Solar (carriles) y las columnas del pipeline
// lineal que abarca cada una (para posicionarlas en el visual).
export const PARALLEL_STAGE_NAMES = new Set(["SEGUIMIENTO_PREOBRA", "SEGUIMIENTO_HABILITACION"]);
export const PARALLEL_SPAN: Record<string, { from: string; to: string }> = {
  SEGUIMIENTO_PREOBRA: { from: "PRE_INGENIERIA", to: "EJECUCION_OBRA" },
  SEGUIMIENTO_HABILITACION: { from: "TRAMITACION_UTE", to: "TRAMITACION_UTE" },
};
export function isParallelStage(name: string): boolean {
  return PARALLEL_STAGE_NAMES.has(name);
}

export const STAGE_LABEL: Record<string, string> = {
  ONBOARDING: "Onboarding",
  INGENIERIA: "Ingeniería",
  OPERACIONES: "Operaciones",
  HABILITACION_UTE: "Habilitación UTE",
  POSTVENTA: "Post-Habilitación",
  PRE_INGENIERIA: "Pre-Ingeniería",
  VALIDACION_OPERACIONES: "Validación de Operaciones",
  INGENIERIA_FINAL: "Ingeniería Final",
  COMPRAS: "Compras",
  EJECUCION_OBRA: "Ejecución de Obra",
  TRAMITACION_UTE: "Tramitación UTE",
  POST_HABILITACION: "Post-Habilitación",
  SEGUIMIENTO_PREOBRA: "Experiencia Solar · Preobra",
  SEGUIMIENTO_HABILITACION: "Experiencia Solar · Habilitación",
};

// Recorrido del Generador (carril de Experiencia Solar): E1 Preobra, E2
// Habilitación, E3 Post-Habilitación. Espeja RECORRIDO_BY_STAGE del backend.
export type CxRecorrido = "E1" | "E2" | "E3";
export const STAGE_RECORRIDO: Record<string, CxRecorrido> = {
  ONBOARDING: "E1",
  INGENIERIA: "E1",
  OPERACIONES: "E1",
  PRE_INGENIERIA: "E1",
  VALIDACION_OPERACIONES: "E1",
  INGENIERIA_FINAL: "E1",
  COMPRAS: "E1",
  EJECUCION_OBRA: "E1",
  HABILITACION_UTE: "E2",
  TRAMITACION_UTE: "E2",
  POSTVENTA: "E3",
  POST_HABILITACION: "E3",
};

// Traspaso de cierre por etapa (solo pipeline nuevo). Se muestra como chip.
export const STAGE_TRASPASO: Record<string, string> = {
  ONBOARDING: "T1",
  PRE_INGENIERIA: "T2",
  VALIDACION_OPERACIONES: "T3 · T4",
  INGENIERIA_FINAL: "T5",
  COMPRAS: "T6",
  EJECUCION_OBRA: "T7",
  TRAMITACION_UTE: "T8",
};

export function stageLabel(name: string): string {
  return STAGE_LABEL[name] ?? name;
}

export function stageArea(name: string): PipelineArea {
  return STAGE_AREA[name] ?? "VENTAS";
}

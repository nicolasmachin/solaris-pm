// Espejo client-side de las reglas eléctricas del server
// (server/src/services/unifilarSvg/rules.ts) para poder MOSTRAR en el form el
// calibre que el sistema calcularía automáticamente. No se usa para generar el
// plano (eso lo hace el server, fuente de verdad): es sólo la sugerencia que
// ve el proyectista al lado de cada campo de override. Mantener en sincronía
// con rules.ts si cambian las tablas.

import type { TipoRed } from "../../../api/unifilar.api";

export function prefijoCable(t: TipoRed): "2x" | "3x" | "4x" {
  return ({ MONO_230: "2x", TRI_230_SN: "3x", TRI_400_CN: "4x" } as const)[t];
}

export function seccionDcSugerida(esLargo: boolean): "4" | "6" {
  return esLargo ? "6" : "4";
}

export function seccionAcSugerida(potenciaKw: number, tipo: TipoRed): "4" | "6" | "10" | "16" {
  if (tipo === "MONO_230") {
    if (potenciaKw <= 6) return "6";
    if (potenciaKw <= 10) return "10";
    return "16";
  }
  if (potenciaKw <= 10) return "4";
  if (potenciaKw <= 15) return "6";
  if (potenciaKw <= 25) return "10";
  return "16";
}

export function seccionPeSugerida(potenciaKw: number, tipo: TipoRed): number {
  const secAc = parseInt(seccionAcSugerida(potenciaKw, tipo), 10);
  return Math.max(secAc, 6);
}

/** Texto "Automático (sugerido: …)" para el emptyOptionLabel del CalibreInput. */
export function autoLabel(sugerido: string): string {
  return `Automático (sugerido: ${sugerido})`;
}

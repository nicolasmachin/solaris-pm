// Reglas eléctricas del generador de unifilares (sección 4 de la spec).
// Las tablas 4.4 y 4.5 son orientativas — pendientes de validación con
// norma UTE oficial (ver SPEC § 11). TODO: confirmar valores con Voltia.

import type { TipoRed } from "@prisma/client";

export function polaridad(t: TipoRed): "2P" | "3P" | "4P" {
  return ({ MONO_230: "2P", TRI_230_SN: "3P", TRI_400_CN: "4P" } as const)[t];
}

export function prefijoCable(t: TipoRed): "2x" | "3x" | "4x" {
  return ({ MONO_230: "2x", TRI_230_SN: "3x", TRI_400_CN: "4x" } as const)[t];
}

export function esTrifasico(t: TipoRed): boolean {
  return t === "TRI_230_SN" || t === "TRI_400_CN";
}

export function seccionDc(esLargo: boolean): "4" | "6" {
  return esLargo ? "6" : "4";
}

/** Sección AC en mm² según potencia y tipo de red (tabla 4.4 spec). */
export function seccionAc(potenciaKw: number, tipo: TipoRed): "4" | "6" | "10" | "16" {
  if (tipo === "MONO_230") {
    if (potenciaKw <= 6) return "6";
    if (potenciaKw <= 10) return "10";
    return "16";
  }
  // Trifásico (con o sin neutro). Tabla actual no diferencia — pendiente UTE.
  if (potenciaKw <= 10) return "4";
  if (potenciaKw <= 15) return "6";
  if (potenciaKw <= 25) return "10";
  return "16";
}

/** Térmica AC del ICP IMG (tabla 4.5 spec). */
export function termicaCalibre(potenciaKw: number): string {
  if (potenciaKw <= 6) return "32A";
  if (potenciaKw <= 8) return "40A";
  if (potenciaKw <= 12) return "50A";
  if (potenciaKw <= 20) return "63A";
  return "80A";
}

/** Diferencial AC (300mA fija; tabla 4.5 spec). */
export function diferencialCalibre(potenciaKw: number): string {
  if (potenciaKw <= 6) return "40A 300mA";
  if (potenciaKw <= 12) return "63A 300mA";
  return "80A 300mA";
}

/** Sección PE conductor a la jabalina común (regla 4.6 spec). */
export function seccionPeJabalina(potenciaKw: number, tipoRed: TipoRed): number {
  const secAc = parseInt(seccionAc(potenciaKw, tipoRed), 10);
  return Math.max(secAc, 6);
}

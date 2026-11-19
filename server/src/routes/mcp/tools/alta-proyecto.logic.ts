// Lógica pura del alta de proyectos desde el conector: traducir la facturación
// del chat al formato de la app y avisar de posibles duplicados.

import { z } from "zod";

import type { Facturacion } from "../../../services/finance/a-facturar.service.js";

/** Fecha sin hora, como la piden las pantallas. */
export const FECHA = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Formato YYYY-MM-DD");

/** Parámetro de facturación, común a convertir un lead y crear un proyecto. */
export const FACTURACION_INPUT = z
  .object({
    normal: z
      .boolean()
      .describe("true = se le factura el total del presupuesto. false = otro monto (o sin factura)."),
    monto_sin_iva_usd: z
      .number()
      .nonnegative()
      .optional()
      .describe("Solo si normal es false: cuánto se factura SIN IVA. 0 = no lleva factura."),
    motivo: z
      .string()
      .optional()
      .describe(
        "Si normal es false, obligatorio: por qué (descuento, parte por banco…). " +
          "Si es normal, opcional: a nombre de quién, RUT…",
      ),
  })
  .strict()
  .describe("Qué se le factura al cliente. Preguntarlo siempre: no tiene valor por defecto.");

/** Cómo llega la facturación desde el chat. */
export interface FacturacionMcp {
  normal: boolean;
  monto_sin_iva_usd?: number;
  motivo?: string;
}

/**
 * Pasa la facturación del chat al formato de la app, con las mismas reglas que
 * el modal: si no es normal hacen falta el monto sin IVA (0 = sin factura) y el
 * motivo. Si falta algo, tira un error que el chat puede leer.
 */
export function facturacionDesdeMcp(f: FacturacionMcp): Facturacion {
  const motivo = f.motivo?.trim() || null;
  if (f.normal) return { normal: true, sinIvaUsd: null, motivo };
  const faltan: string[] = [];
  if (f.monto_sin_iva_usd == null) faltan.push("el monto sin IVA a facturar (0 si no lleva factura)");
  if (!motivo || motivo.length < 3) faltan.push("el motivo de la facturación distinta");
  if (faltan.length > 0) {
    throw new Error(`La facturación no es la normal: falta ${faltan.join(" y ")}.`);
  }
  return { normal: false, sinIvaUsd: f.monto_sin_iva_usd ?? 0, motivo };
}

/** Descripción corta de la facturación, para la respuesta. */
export function describirFacturacion(f: Facturacion, usd: (n: number) => string): string {
  if (f.normal) return "Normal (se factura el total)";
  if (!f.sinIvaUsd) return `Sin factura — ${f.motivo}`;
  return `Otro monto: ${usd(f.sinIvaUsd)} sin IVA — ${f.motivo}`;
}

/** Normaliza un nombre para comparar: minúsculas, sin tildes ni signos. */
export function normalizarNombre(s: string): string {
  return s
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9 ]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * ¿Parece el mismo cliente? Coincide si todas las palabras del nombre más corto
 * (de 3 letras o más) aparecen en el otro. "Juan Pérez" ≈ "Pérez Juan Carlos".
 */
export function mismoCliente(a: string, b: string): boolean {
  const pa = normalizarNombre(a).split(" ").filter((w) => w.length >= 3);
  const pb = normalizarNombre(b).split(" ").filter((w) => w.length >= 3);
  if (pa.length === 0 || pb.length === 0) return false;
  const [corto, largo] = pa.length <= pb.length ? [pa, new Set(pb)] : [pb, new Set(pa)];
  return corto.every((w) => largo.has(w));
}

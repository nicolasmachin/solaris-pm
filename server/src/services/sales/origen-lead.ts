// Origen del lead: "¿Cómo nos conoció?".
//
// Vive aparte para que la pantalla (vía API), el conector MCP y —cuando haya
// número real de WhatsApp— la vinculación de conversaciones usen las mismas
// etiquetas y la misma regla. Es lógica pura, sin base, para poder probarla.
//
// Parte 2 (WhatsApp, pendiente): cuando un mensaje entrante trae `referral`
// (anuncio "click to WhatsApp"), al vincular la conversación con un lead se
// llama a `origenDesdeAnuncio()` y se aplica con `completarOrigenSiFalta()`.
// Solo completa si el lead no tiene origen: lo que respondió el cliente a
// "¿cómo nos conoció?" vale más que la inferencia.

import { OrigenLead } from "@prisma/client";

import { badRequest } from "../../utils/errors.js";

export const ORIGEN_LEAD_LABEL: Record<OrigenLead, string> = {
  [OrigenLead.ANUNCIO_META]: "Anuncio en Instagram o Facebook",
  [OrigenLead.REDES_ORGANICO]: "Redes sociales (sin anuncio)",
  [OrigenLead.RECOMENDACION]: "Recomendación",
  [OrigenLead.GOOGLE_WEB]: "Google o la web",
  [OrigenLead.LINKEDIN]: "LinkedIn",
  [OrigenLead.INTELIGENCIA_ARTIFICIAL]: "Inteligencia artificial",
  [OrigenLead.CLIENTE_EXISTENTE]: "Ya es cliente",
  [OrigenLead.MARCA_ALIADA]: "Marca aliada",
  [OrigenLead.OTRO]: "Otro",
};

/** Texto para mostrar: "Recomendación (Juan Pérez)", o "Sin dato" si es null. */
export function describirOrigen(origen: OrigenLead | null, detalle: string | null): string {
  if (!origen) return "Sin dato";
  const d = detalle?.trim();
  return d ? `${ORIGEN_LEAD_LABEL[origen]} (${d})` : ORIGEN_LEAD_LABEL[origen];
}

/**
 * Normaliza origen + detalle tal como llegan de un alta o una edición.
 *
 * - `undefined` en ambos: no se toca nada (edición parcial).
 * - El detalle se recorta; vacío pasa a null.
 * - OTRO sin detalle es un error: "otro" a secas no dice nada al medir.
 * - Al borrar el origen (null) se borra también el detalle.
 *
 * `actual` es lo que ya tiene el lead, para validar una edición que cambia
 * solo uno de los dos campos.
 */
export function normalizarOrigen(
  input: { origen?: OrigenLead | null; origenDetalle?: string | null },
  actual: { origen: OrigenLead | null; origenDetalle: string | null } = { origen: null, origenDetalle: null },
): { origen?: OrigenLead | null; origenDetalle?: string | null } {
  if (input.origen === undefined && input.origenDetalle === undefined) return {};

  const origen = input.origen !== undefined ? input.origen : actual.origen;
  const detalleCrudo = input.origenDetalle !== undefined ? input.origenDetalle : actual.origenDetalle;
  const origenDetalle = origen === null ? null : detalleCrudo?.trim() || null;

  if (origen === OrigenLead.OTRO && !origenDetalle) {
    throw badRequest("ORIGEN_DETALLE_REQUIRED", "Si el origen es \"Otro\", contá cómo nos conoció");
  }

  return { origen, origenDetalle };
}

// ── Parte 2: anuncios de WhatsApp ──────────────────────────────────────────

/** Lo que trae el bloque `referral` de un mensaje que vino de un anuncio. */
export interface ReferralAnuncio {
  source_id?: string;
  source_type?: string;
  headline?: string;
  source_url?: string;
  ctwa_clid?: string;
}

/** Origen inferido de un anuncio "click to WhatsApp". */
export function origenDesdeAnuncio(referral: ReferralAnuncio): { origen: OrigenLead; origenDetalle: string | null } {
  const partes = [referral.headline?.trim(), referral.source_id ? `anuncio ${referral.source_id}` : null].filter(Boolean);
  return { origen: OrigenLead.ANUNCIO_META, origenDetalle: partes.length ? partes.join(" · ") : null };
}

/** Lo que hay que escribir en el lead, o null si ya tiene origen y no se toca. */
export function completarOrigenSiFalta(
  actual: { origen: OrigenLead | null },
  inferido: { origen: OrigenLead; origenDetalle: string | null },
): { origen: OrigenLead; origenDetalle: string | null } | null {
  return actual.origen ? null : inferido;
}

// ── Reporte por origen ─────────────────────────────────────────────────────

export interface FilaOrigen {
  /** null = leads sin el dato (los anteriores al campo, o cargados sin él). */
  origen: OrigenLead | null;
  leads: number;
  propuestas: number;
  ventas: number;
  montoUsd: number;
  /** Ventas cuyo monto no se pudo determinar (no suman al monto). */
  ventasSinMonto: number;
}

/**
 * Agrupa los hechos del período por origen. Cada hecho es independiente: un
 * lead que entró en el período y una venta cerrada en el período no tienen por
 * qué ser el mismo lead (son las definiciones de `indicadores`).
 *
 * Orden: los orígenes con más ventas primero, después por leads; "sin dato"
 * siempre al final.
 */
export function resumirPorOrigen(hechos: {
  leads: Array<{ origen: OrigenLead | null }>;
  propuestas: Array<{ origen: OrigenLead | null }>;
  ventas: Array<{ origen: OrigenLead | null; montoUsd: number | null }>;
}): FilaOrigen[] {
  const filas = new Map<OrigenLead | null, FilaOrigen>();
  const fila = (origen: OrigenLead | null) => {
    let f = filas.get(origen);
    if (!f) {
      f = { origen, leads: 0, propuestas: 0, ventas: 0, montoUsd: 0, ventasSinMonto: 0 };
      filas.set(origen, f);
    }
    return f;
  };

  for (const l of hechos.leads) fila(l.origen).leads++;
  for (const p of hechos.propuestas) fila(p.origen).propuestas++;
  for (const v of hechos.ventas) {
    const f = fila(v.origen);
    f.ventas++;
    if (v.montoUsd != null) f.montoUsd += v.montoUsd;
    else f.ventasSinMonto++;
  }

  return [...filas.values()].sort((a, b) => {
    if (a.origen === null) return 1;
    if (b.origen === null) return -1;
    return b.ventas - a.ventas || b.leads - a.leads || b.montoUsd - a.montoUsd;
  });
}

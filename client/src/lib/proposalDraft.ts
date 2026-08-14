// Helpers del constructor de propuestas v2 que viven en el cliente: la
// validación de obligatorios (para pintar los campos en rojo mientras se
// escribe) y la comparación de borradores.
//
// La PRECARGA y el MERGE ya no están acá: viven en el servidor
// (`server/src/services/proposal/initial-draft.ts`) y llegan resueltos por
// `POST /draft/init`. Se movieron para que el conector MCP pudiera cotizar sin
// duplicar la lógica de qué valor trae cada campo.

import type { ProposalDraftData } from "../types/proposals-v2";
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
  // Solo en el cotizador B2B (espeja el superRefine de draftDataPublishSchema).
  { path: "empresa.razonSocial", section: "empresa", sectionLabel: "Datos de la empresa", label: "Razón social", ok: (d) => d.variante !== "EMPRESA" || d.empresa.razonSocial.trim().length > 0 },
  { path: "empresa.rut", section: "empresa", sectionLabel: "Datos de la empresa", label: "RUT", ok: (d) => d.variante !== "EMPRESA" || d.empresa.rut.trim().length > 0 },
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

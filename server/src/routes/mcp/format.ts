// Formato de los resultados que devuelven las herramientas.
//
// Todo sale como texto legible en vez de JSON: es lo que el modelo lee mejor
// para responderle a una persona, y ocupa bastante menos que el equivalente
// estructurado (el resultado de una herramienta se corta cerca de los 150.000
// caracteres).

const MESES = [
  "enero", "febrero", "marzo", "abril", "mayo", "junio",
  "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre",
];

/** Fecha en formato "12 de marzo de 2026". Null si no hay. */
export function fechaLarga(value: Date | string | null | undefined): string | null {
  if (!value) return null;
  const d = typeof value === "string" ? new Date(value) : value;
  if (Number.isNaN(d.getTime())) return null;
  return `${d.getUTCDate()} de ${MESES[d.getUTCMonth()]} de ${d.getUTCFullYear()}`;
}

/** Fecha corta "12/03/2026". */
export function fechaCorta(value: Date | string | null | undefined): string | null {
  if (!value) return null;
  const d = typeof value === "string" ? new Date(value) : value;
  if (Number.isNaN(d.getTime())) return null;
  const dd = String(d.getUTCDate()).padStart(2, "0");
  const mm = String(d.getUTCMonth() + 1).padStart(2, "0");
  return `${dd}/${mm}/${d.getUTCFullYear()}`;
}

export function usd(value: number | null | undefined): string | null {
  if (value === null || value === undefined || !Number.isFinite(value)) return null;
  return `USD ${Math.round(value).toLocaleString("es-UY")}`;
}

export function pesos(value: number | null | undefined): string | null {
  if (value === null || value === undefined || !Number.isFinite(value)) return null;
  return `$ ${Math.round(value).toLocaleString("es-UY")}`;
}

export function porcentaje(value: number | null | undefined, decimales = 0): string | null {
  if (value === null || value === undefined || !Number.isFinite(value)) return null;
  return `${(value * 100).toFixed(decimales)}%`;
}

/** Nombre legible de una etapa del pipeline comercial. */
export const ETAPA_LABEL: Record<string, string> = {
  NUEVO_LEAD: "Nuevo",
  COTIZADO: "Cotizado",
  RECLAMADO: "Reclamado",
  AGENDAR_VISITA: "Agendar visita",
  VISITADO: "Visitado",
  CERRADO_GANADO: "Cerrado ganado",
  CERRADO_PERDIDO: "Cerrado perdido",
};

/** Arma un bloque "clave: valor" salteando lo que esté vacío. */
export function campos(pares: Array<[string, string | number | null | undefined]>): string {
  return pares
    .filter(([, v]) => v !== null && v !== undefined && v !== "")
    .map(([k, v]) => `${k}: ${v}`)
    .join("\n");
}

/** Resultado de texto con la forma que espera el protocolo. */
export function texto(...bloques: Array<string | null | undefined>) {
  const cuerpo = bloques.filter(Boolean).join("\n\n");
  return { content: [{ type: "text" as const, text: cuerpo }] };
}

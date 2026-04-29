// G.11 — Helpers para fechas SIN HORA (deadlines, fechas de movimiento,
// fechaSaldoInicial, etc). Evitan el bug clásico:
//
//   new Date("2026-04-29")
//     -> 2026-04-29T00:00:00 UTC
//     -> .toLocaleDateString('es-UY')  (zona UTC-3)
//     -> "28/04/2026"  ❌ día anterior
//
// La regla: las fechas date-only deben tratarse como strings "YYYY-MM-DD"
// y NUNCA pasarlas por `new Date()` para mostrarlas.

/**
 * Convierte una string ISO o un Date a "YYYY-MM-DD" preservando el día tal
 * como vino del backend (sin shift de zona).
 * - Si recibe "YYYY-MM-DD" → lo devuelve tal cual.
 * - Si recibe "YYYY-MM-DDTHH:MM:SS..." → corta la parte de fecha (UTC components).
 * - Si recibe Date → toma componentes UTC (consistente con cómo el backend
 *   guarda las fechas date-only: medianoche UTC).
 */
export function toDateOnlyISO(date: string | Date | null | undefined): string | null {
  if (date === null || date === undefined) return null;
  if (typeof date === "string") {
    if (/^\d{4}-\d{2}-\d{2}$/.test(date)) return date;
    if (date.includes("T")) return date.split("T")[0];
    return null;
  }
  if (date instanceof Date) {
    if (Number.isNaN(date.getTime())) return null;
    const y = date.getUTCFullYear();
    const m = String(date.getUTCMonth() + 1).padStart(2, "0");
    const d = String(date.getUTCDate()).padStart(2, "0");
    return `${y}-${m}-${d}`;
  }
  return null;
}

/**
 * Parsea "YYYY-MM-DD" a Date a medianoche LOCAL.
 * Útil cuando se necesita un Date para comparaciones (today, etc) sin shifts.
 */
export function parseDateOnly(dateString: string | null | undefined): Date | null {
  if (!dateString) return null;
  const iso = toDateOnlyISO(dateString);
  if (!iso) return null;
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(y, m - 1, d);
}

/**
 * Formatea fecha sin hora para mostrar al usuario en formato dd/MM/yyyy.
 * Trabaja sobre la string "YYYY-MM-DD" directamente, sin convertir a Date,
 * para evitar shifts de zona.
 */
export function formatDate(date: string | Date | null | undefined): string {
  const iso = toDateOnlyISO(date);
  if (!iso) return "—";
  const [y, m, d] = iso.split("-");
  return `${d}/${m}/${y}`;
}

/**
 * Devuelve el formato "YYYY-MM-DD" listo para `<input type="date">`.
 */
export function toInputDate(date: string | Date | null | undefined): string {
  return toDateOnlyISO(date) ?? "";
}

/**
 * Hoy en formato "YYYY-MM-DD" (zona local).
 */
export function todayLocalISO(): string {
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, "0");
  const d = String(now.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

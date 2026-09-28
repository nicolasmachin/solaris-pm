// Aritmética de fechas del seguro de granizo. Todo en días UTC (@db.Date).

import { addDays, diffInDays, startOfUtcDay } from "../../utils/dates.js";

export { addDays, diffInDays, startOfUtcDay };

// Mismo día y mes del año siguiente. El 29/2 cae en el 28/2 del año siguiente
// (JS lo pasaría al 1/3 y correría todas las renovaciones un día).
export function sumarUnAnio(desde: Date): Date {
  const y = desde.getUTCFullYear() + 1;
  const m = desde.getUTCMonth();
  const d = desde.getUTCDate();
  const candidato = new Date(Date.UTC(y, m, d));
  if (candidato.getUTCMonth() !== m) return new Date(Date.UTC(y, m + 1, 0));
  return candidato;
}

export function fmtFecha(d: Date): string {
  const dd = String(d.getUTCDate()).padStart(2, "0");
  const mm = String(d.getUTCMonth() + 1).padStart(2, "0");
  return `${dd}/${mm}/${String(d.getUTCFullYear()).slice(2)}`;
}

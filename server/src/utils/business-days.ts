// Cálculo de días hábiles (Uruguay).
//
// No son hábiles los sábados, los domingos y los días que Voltia no trabaja:
//  - los feriados no laborables de Uruguay, de fecha fija: 1 de enero, 1 de
//    mayo, 18 de julio, 25 de agosto y 25 de diciembre;
//  - Carnaval (lunes y martes) y la Semana de Turismo (lunes a viernes), que no
//    son feriados no laborables pero Voltia no trabaja (decidido el 17-oct-2026).
//    Se mueven con la Pascua, así que se calculan cada año.
// Cualquier otro día (un puente) se agrega con la variable FERIADOS_EXTRA, fechas
// AAAA-MM-DD separadas por coma.

const FERIADOS_FIJOS = new Set(["01-01", "05-01", "07-18", "08-25", "12-25"]);
const FERIADOS_EXTRA = new Set(
  (process.env.FERIADOS_EXTRA ?? "")
    .split(",")
    .map((f) => f.trim())
    .filter((f) => /^\d{4}-\d{2}-\d{2}$/.test(f)),
);

/** Domingo de Pascua (calendario gregoriano, algoritmo de Meeus/Jones/Butcher), en UTC. */
export function domingoDePascua(anio: number): Date {
  const a = anio % 19;
  const b = Math.floor(anio / 100);
  const c = anio % 100;
  const d = Math.floor(b / 4);
  const e = b % 4;
  const f = Math.floor((b + 8) / 25);
  const g = Math.floor((b - f + 1) / 3);
  const h = (19 * a + b - d - g + 15) % 30;
  const i = Math.floor(c / 4);
  const k = c % 4;
  const l = (32 + 2 * e + 2 * i - h - k) % 7;
  const m = Math.floor((a + 11 * h + 22 * l) / 451);
  const mes = Math.floor((h + l - 7 * m + 114) / 31);
  const dia = ((h + l - 7 * m + 114) % 31) + 1;
  return new Date(Date.UTC(anio, mes - 1, dia));
}

const movilesPorAnio = new Map<number, Set<string>>();

/** Carnaval y Semana de Turismo de un año, como fechas AAAA-MM-DD. */
function feriadosMoviles(anio: number): Set<string> {
  let set = movilesPorAnio.get(anio);
  if (set) return set;
  const pascua = domingoDePascua(anio);
  const dia = (offset: number) =>
    new Date(pascua.getTime() + offset * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
  set = new Set([
    dia(-48), // lunes de Carnaval
    dia(-47), // martes de Carnaval
    dia(-6), dia(-5), dia(-4), dia(-3), dia(-2), // Semana de Turismo, lunes a viernes
  ]);
  movilesPorAnio.set(anio, set);
  return set;
}

export function esFeriado(d: Date): boolean {
  const iso = d.toISOString().slice(0, 10);
  return (
    FERIADOS_FIJOS.has(iso.slice(5)) ||
    FERIADOS_EXTRA.has(iso) ||
    feriadosMoviles(d.getUTCFullYear()).has(iso)
  );
}

function isWeekend(d: Date): boolean {
  const day = d.getUTCDay();
  // domingo=0, sábado=6. Los feriados cuentan igual que un fin de semana.
  return day === 0 || day === 6 || esFeriado(d);
}

// Suma (o resta si `n` es negativo) `n` días hábiles a `start`.
export function addBusinessDays(start: Date, n: number): Date {
  const result = new Date(start);
  const step = n >= 0 ? 1 : -1;
  let remaining = Math.abs(n);
  while (remaining > 0) {
    result.setUTCDate(result.getUTCDate() + step);
    if (!isWeekend(result)) remaining--;
  }
  return result;
}

// Cuenta días hábiles estrictamente entre `from` (exclusivo) y `to` (inclusivo).
// Si `to <= from`, devuelve 0.
export function businessDaysBetween(from: Date, to: Date): number {
  if (to <= from) return 0;
  let count = 0;
  const cursor = new Date(from);
  while (cursor < to) {
    cursor.setUTCDate(cursor.getUTCDate() + 1);
    if (!isWeekend(cursor)) count++;
  }
  return count;
}

// ¿`date` ocurrió hace `businessDays` días hábiles o más respecto de `now`?
// Usado por la escalación: un traspaso detectado hace ≥ N días hábiles y sin
// confirmar está vencido.
export function isOlderThanBusinessDays(date: Date, businessDays: number, now: Date = new Date()): boolean {
  return businessDaysBetween(date, now) >= businessDays;
}

// Diferencia de días hábiles con signo entre `from` y `to`.
// Positivo si `to` está en el futuro respecto de `from` (faltan días hábiles),
// negativo si está en el pasado (vencido). 0 si caen el mismo día.
// Se usa para la cuenta regresiva de plazo por etapa: remaining = diff(hoy, deadline).
export function signedBusinessDaysBetween(from: Date, to: Date): number {
  if (to.getTime() === from.getTime()) return 0;
  return to > from ? businessDaysBetween(from, to) : -businessDaysBetween(to, from);
}

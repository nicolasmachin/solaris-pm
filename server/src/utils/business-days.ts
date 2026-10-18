// Cálculo de días hábiles (Uruguay).
//
// No son hábiles los sábados, los domingos y los feriados no laborables de
// Uruguay, que tienen fecha fija: 1 de enero, 1 de mayo, 18 de julio, 25 de
// agosto y 25 de diciembre. Los días que Voltia no trabaja sin ser feriado no
// laborable (Carnaval, Semana de Turismo, un puente) se agregan con la variable
// FERIADOS_EXTRA, fechas AAAA-MM-DD separadas por coma.
// TODO: pasar FERIADOS_EXTRA a una pantalla de Admin.

const FERIADOS_FIJOS = new Set(["01-01", "05-01", "07-18", "08-25", "12-25"]);
const FERIADOS_EXTRA = new Set(
  (process.env.FERIADOS_EXTRA ?? "")
    .split(",")
    .map((f) => f.trim())
    .filter((f) => /^\d{4}-\d{2}-\d{2}$/.test(f)),
);

export function esFeriado(d: Date): boolean {
  const iso = d.toISOString().slice(0, 10);
  return FERIADOS_FIJOS.has(iso.slice(5)) || FERIADOS_EXTRA.has(iso);
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

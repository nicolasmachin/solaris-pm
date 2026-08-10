// Cálculo de días hábiles (Uruguay).
//
// MVP: excluye solo sábados y domingos. Los feriados nacionales NO se
// contemplan todavía — cuando exista una tabla `Feriado` se engancha acá.
// TODO(traspasos): sumar feriados nacionales al cálculo (ver plan Traspasos §10.2).

function isWeekend(d: Date): boolean {
  const day = d.getUTCDay();
  return day === 0 || day === 6; // domingo=0, sábado=6
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

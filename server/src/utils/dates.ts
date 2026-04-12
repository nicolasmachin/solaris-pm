const DAY_IN_MS = 1000 * 60 * 60 * 24;

export function startOfUtcDay(date: Date) {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
}

export function parseDateOnly(value: string) {
  return new Date(`${value}T00:00:00.000Z`);
}

export function toDateOnlyString(date: Date | null | undefined) {
  if (!date) {
    return null;
  }

  return date.toISOString().slice(0, 10);
}

export function diffInDays(from: Date, to: Date) {
  const fromUtc = startOfUtcDay(from).getTime();
  const toUtc = startOfUtcDay(to).getTime();
  return Math.round((toUtc - fromUtc) / DAY_IN_MS);
}

export function addDays(date: Date, days: number) {
  const next = new Date(date);
  next.setUTCDate(next.getUTCDate() + days);
  return next;
}

export function todayUtc() {
  return startOfUtcDay(new Date());
}

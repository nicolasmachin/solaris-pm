// ─── Finance shared utilities ─────────────────────────────────────────────────

export function fmtCurrency(amount: number, moneda: 'USD' | 'UYU' = 'USD'): string {
  const n = amount.toLocaleString('es-UY', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  return `${moneda} ${n}`;
}

export function fmtDate(iso: string | null | undefined): string {
  if (!iso) return '-';
  const d = new Date(iso);
  return d.toLocaleDateString('es-UY', { day: '2-digit', month: '2-digit', year: 'numeric' });
}

export function currentMonthYear() {
  const now = new Date();
  return { mes: now.getMonth() + 1, anio: now.getFullYear() };
}

export const MONTH_NAMES = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'];

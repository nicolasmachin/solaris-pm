// ─── Finance shared utilities ─────────────────────────────────────────────────

import { formatDate } from '../utils/date';

export function fmtCurrency(amount: number, moneda: 'USD' | 'UYU' = 'USD'): string {
  const n = amount.toLocaleString('es-UY', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  return `${moneda} ${n}`;
}

// Delegamos en `formatDate` (utils/date) que parsea "YYYY-MM-DD" sin pasar por
// `new Date()` para evitar shifts de zona horaria (Uruguay UTC-3 mostraba el
// día anterior). Aceptamos también ISO completos extrayendo la parte de fecha.
export function fmtDate(iso: string | null | undefined): string {
  return formatDate(iso);
}

export function currentMonthYear() {
  const now = new Date();
  return { mes: now.getMonth() + 1, anio: now.getFullYear() };
}

export const MONTH_NAMES = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'];

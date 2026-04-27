import type { Moneda } from './finance.types';

export type AccountType = 'BANCO' | 'EFECTIVO' | 'TARJETA' | 'OTRO';

export const ACCOUNT_TYPE_LABEL: Record<AccountType, string> = {
  BANCO: 'Banco',
  EFECTIVO: 'Efectivo',
  TARJETA: 'Tarjeta',
  OTRO: 'Otro',
};

export interface Account {
  id: string;
  nombre: string;
  tipo: AccountType;
  moneda: Moneda;
  saldoInicial: number;
  fechaSaldoInicial: string | null;
  notas: string | null;
  activa: boolean;
  createdAt: string;
  updatedAt: string;
  deletedAt: string | null;
  _count?: { movements: number; payments: number };
  balance?: AccountBalance;
}

export interface AccountBalance {
  saldoInicial: number;
  ingresos: number;
  gastos: number;
  pagos: number;
  saldoActual: number;
}

export interface AccountsSummary {
  porCuenta: { id: string; nombre: string; tipo: AccountType; moneda: Moneda; saldoActual: number }[];
  totalesPorMoneda: { USD: number; UYU: number };
  totalUnificadoUSD: number;
  exchangeRate: { usdToUyu: number; date: string } | null;
}

import { apiClient } from './axios';
import type { Account, AccountBalance, AccountType, AccountsSummary } from '../types/accounts.types';
import type { Moneda } from '../types/finance.types';

export const getAccounts = (params?: {
  activa?: 'true' | 'false' | 'all';
  tipo?: AccountType;
  moneda?: Moneda;
}) => apiClient.get<Account[]>('/api/accounts', { params }).then(r => r.data);

export const getAccount = (id: string) =>
  apiClient.get<Account>(`/api/accounts/${id}`).then(r => r.data);

export const getAccountBalance = (id: string) =>
  apiClient.get<AccountBalance>(`/api/accounts/${id}/balance`).then(r => r.data);

export const getAccountsSummary = () =>
  apiClient.get<AccountsSummary>('/api/accounts/summary').then(r => r.data);

export const createAccount = (body: {
  nombre: string;
  tipo: AccountType;
  moneda: Moneda;
  saldoInicial?: number;
  fechaSaldoInicial?: string | null;
  notas?: string;
}) => apiClient.post<Account>('/api/accounts', body).then(r => r.data);

export const patchAccount = (id: string, body: Partial<{
  nombre: string;
  tipo: AccountType;
  moneda: Moneda;
  saldoInicial: number;
  fechaSaldoInicial: string | null;
  notas: string | null;
  activa: boolean;
}>) => apiClient.patch<Account>(`/api/accounts/${id}`, body).then(r => r.data);

export const deleteAccount = (id: string) =>
  apiClient.delete<{ success: true }>(`/api/accounts/${id}`).then(r => r.data);

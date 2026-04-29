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

// ─── G.10: Conciliación bancaria ──────────────────────────────────────────

export interface ReconciliationPreview {
  accountId: string;
  accountName: string;
  moneda: Moneda;
  saldoCalculado: number;
  saldoReal: number;
  diferencia: number;
  requiereAjuste: boolean;
  ajusteSugerido: { tipo: 'INGRESO' | 'GASTO'; monto: number; descripcion: string } | null;
}

export interface AccountReconciliation {
  id: string;
  accountId?: string;
  fecha: string;
  saldoReal: number;
  saldoCalculado: number;
  diferencia: number;
  ajusteMovementId: string | null;
  ajusteMovement: { id: string; descripcion: string; monto: number; tipoMovimiento: 'INGRESO' | 'GASTO' } | null;
  notas: string | null;
  createdBy?: { id: string; name: string };
  createdAt: string;
}

export interface ReconciliationAlert {
  accountId: string;
  nombre: string;
  moneda: Moneda;
  tipo: AccountType;
  ultimaConciliacionId: string | null;
  ultimaConciliacion: string | null;
  diasDesdeUltimaConciliacion: number | null;
  necesitaConciliacion: boolean;
}

export interface ReconciliationAlertsResponse {
  totalAlertas: number;
  accounts: ReconciliationAlert[];
}

export const getReconciliationPreview = (accountId: string, saldoReal: number) =>
  apiClient
    .get<ReconciliationPreview>(`/api/accounts/${accountId}/reconciliation-preview`, { params: { saldoReal: String(saldoReal) } })
    .then(r => r.data);

export const reconcileAccount = (accountId: string, body: { fecha: string; saldoReal: number; notas?: string | null; aplicarAjuste?: boolean }) =>
  apiClient.post<AccountReconciliation>(`/api/accounts/${accountId}/reconcile`, body).then(r => r.data);

export const getAccountReconciliations = (accountId: string) =>
  apiClient.get<AccountReconciliation[]>(`/api/accounts/${accountId}/reconciliations`).then(r => r.data);

export const getReconciliationAlerts = () =>
  apiClient.get<ReconciliationAlertsResponse>('/api/accounts/reconciliation-alerts').then(r => r.data);

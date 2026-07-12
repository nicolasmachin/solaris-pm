import { apiClient } from './axios';
import type { MetodoPago, Moneda } from '../types/finance.types';
import type { AccountSummary, Payment } from '../types/payments.types';

// ─── Payments ────────────────────────────────────────────────────────────────

export const getPayments = (params?: {
  supplierId?: string;
  fechaDesde?: string;
  fechaHasta?: string;
  conSaldoSinAplicar?: 'true' | 'false';
  includeDeleted?: 'true' | 'false';
}) => apiClient.get<Payment[]>('/api/finance/payments', { params }).then(r => r.data);

export const getPayment = (id: string) =>
  apiClient.get<Payment>(`/api/finance/payments/${id}`).then(r => r.data);

/** Resumen de la auto-aplicación FIFO que devuelve el backend al crear un pago. */
export interface PaymentApplyResult {
  totalAplicado: number;
  facturasAfectadas: number;
  saldoAFavor: number;
}

export type CreatePaymentResult = Payment & { aplicacion: PaymentApplyResult };

export const createPayment = (body: {
  supplierId: string;
  accountId: string;
  fecha: string;
  monto: number;
  moneda?: Moneda;
  metodo?: MetodoPago;
  referencia?: string;
  notas?: string;
  /** Default true en backend: aplica FIFO a las facturas adeudadas más viejas. */
  autoAplicar?: boolean;
}) => apiClient.post<CreatePaymentResult>('/api/finance/payments', body).then(r => r.data);

export const patchPayment = (id: string, body: Partial<{
  fecha: string;
  monto: number;
  moneda: Moneda;
  metodo: MetodoPago;
  accountId: string;
  referencia: string | null;
  notas: string | null;
}>) => apiClient.patch<Payment>(`/api/finance/payments/${id}`, body).then(r => r.data);

export const deletePayment = (id: string) =>
  apiClient.delete<{ success: true; revertedApplications: number }>(`/api/finance/payments/${id}`).then(r => r.data);

// ─── Payment applications ────────────────────────────────────────────────────

export const applyPayment = (paymentId: string, applications: { movementId: string; monto: number }[]) =>
  apiClient.post<Payment>(`/api/finance/payments/${paymentId}/applications`, { applications }).then(r => r.data);

export const patchApplication = (paymentId: string, applicationId: string, body: { monto: number }) =>
  apiClient.patch<Payment>(`/api/finance/payments/${paymentId}/applications/${applicationId}`, body).then(r => r.data);

export const deleteApplication = (paymentId: string, applicationId: string) =>
  apiClient.delete<Payment>(`/api/finance/payments/${paymentId}/applications/${applicationId}`).then(r => r.data);

// ─── Account summary ─────────────────────────────────────────────────────────

export const getSupplierAccountSummary = (supplierId: string, params?: {
  fechaDesde?: string;
  fechaHasta?: string;
  soloPendientes?: 'true' | 'false';
}) => apiClient.get<AccountSummary>(`/api/finance/suppliers/${supplierId}/account-summary`, { params }).then(r => r.data);

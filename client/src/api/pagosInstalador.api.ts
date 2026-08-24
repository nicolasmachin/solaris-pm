import { apiClient as api } from "./axios";

export type InstallerPaymentStatus = "PENDIENTE" | "PARCIAL" | "PAGADO";

export interface InstallerPaymentPago {
  id: string;
  fecha: string;
  montoUsd: number;
  descripcion: string;
}

export interface InstallerPayment {
  id: string;
  projectId: string | null;
  projectCode: string | null;
  /** Nombre del cliente; para los manuales sin proyecto, el concepto. */
  clientName: string;
  concepto: string | null;
  installerId: string | null;
  installerName: string | null;
  montoUsd: number;
  pagadoUsd: number;
  saldoUsd: number;
  /** true = no salió de una propuesta, hay que cargarle el monto. */
  origenManual: boolean;
  montoEditado: boolean;
  fechaTrabajo: string;
  dueDate: string;
  status: InstallerPaymentStatus;
  paidAt: string | null;
  notas: string | null;
  pagos: InstallerPaymentPago[];
  createdAt: string;
}

export interface InstallerPaymentMetrics {
  totalUsd: number;
  pagadoUsd: number;
  saldoUsd: number;
  trabajos: number;
  sinAsignar: number;
}

export interface InstallerPaymentListResult {
  payments: InstallerPayment[];
  metrics: InstallerPaymentMetrics;
  /** Solo viene en el listado general: true si el usuario ve los de todos. */
  seeAll?: boolean;
}

export interface ListParams {
  status?: InstallerPaymentStatus;
  year?: number;
  installerId?: string;
  sinAsignar?: boolean;
  /** "mine" fuerza el endpoint scopeado; "all" deja que el backend decida. */
  scope?: "mine" | "all";
}

export const STATUS_LABEL: Record<InstallerPaymentStatus, string> = {
  PENDIENTE: "Pendiente",
  PARCIAL: "Parcial",
  PAGADO: "Pagado",
};

export async function getInstallerPayments(params: ListParams = {}): Promise<InstallerPaymentListResult> {
  const { scope, ...query } = params;
  const url = scope === "mine" ? "/api/installer-payments/mine" : "/api/installer-payments";
  const { data } = await api.get<InstallerPaymentListResult>(url, { params: query });
  return data;
}

export async function createInstallerPayment(body: {
  installerId?: string | null;
  projectId?: string | null;
  concepto?: string;
  montoUsd: number;
  fechaTrabajo: string;
}): Promise<InstallerPayment> {
  const { data } = await api.post<{ payment: InstallerPayment }>("/api/installer-payments", body);
  return data.payment;
}

/** Asignar el instalador y/o corregir monto, fechas y notas. */
export async function updateInstallerPayment(
  id: string,
  body: {
    installerId?: string | null;
    montoUsd?: number;
    fechaTrabajo?: string;
    dueDate?: string;
    notas?: string;
  },
): Promise<InstallerPayment> {
  const { data } = await api.patch<{ payment: InstallerPayment }>(`/api/installer-payments/${id}`, body);
  return data.payment;
}

/** Registrar una entrega de plata (total o parcial). */
export async function registrarPagoInstalador(
  id: string,
  body: { montoUsd: number; fecha: string; accountId?: string | null; notas?: string | null },
): Promise<InstallerPayment> {
  const { data } = await api.post<{ payment: InstallerPayment }>(
    `/api/installer-payments/${id}/pagos`,
    body,
  );
  return data.payment;
}

export async function deleteInstallerPayment(id: string): Promise<void> {
  await api.delete(`/api/installer-payments/${id}`);
}

/** Corregir una entrega ya registrada (monto, fecha o notas). Refleja en Finanzas. */
export async function editarEntregaInstalador(
  paymentId: string,
  movementId: string,
  body: { montoUsd?: number; fecha?: string; notas?: string },
): Promise<InstallerPayment> {
  const { data } = await api.patch<{ payment: InstallerPayment }>(
    `/api/installer-payments/${paymentId}/pagos/${movementId}`,
    body,
  );
  return data.payment;
}

/** Anular una entrega ya registrada. Soft-borra su movimiento en Finanzas. */
export async function borrarEntregaInstalador(
  paymentId: string,
  movementId: string,
): Promise<InstallerPayment> {
  const { data } = await api.delete<{ payment: InstallerPayment }>(
    `/api/installer-payments/${paymentId}/pagos/${movementId}`,
  );
  return data.payment;
}

import { apiClient as api } from "./axios";

export type CommissionStatus = "PENDIENTE" | "PAGADA";

export interface SerializedCommission {
  id: string;
  asesorId: string;
  leadId: string | null;
  concepto: string | null;
  proposalVersionId: string | null;
  proposalGenerationId: string | null;
  montoUsd: number;
  porcentaje: number | null;
  origenManual: boolean;
  fechaVenta: string;
  dueDate: string;
  status: CommissionStatus;
  paidAt: string | null;
  financeMovementId: string | null;
  editadoAt: string | null;
  notaEdicion: string | null;
  dueDateManual: boolean;
  createdAt: string;
}

export interface CommissionListItem extends SerializedCommission {
  leadClientName: string;
  asesorName: string;
}

export interface CommissionMetrics {
  saldoAcobrarUsd: number;
  cobradoEnAnioUsd: number;
  ventasCerradas: number;
  evolucion: Array<{ mes: number; cobradas: number; generadas: number }>;
}

export interface EligibleProposal {
  id: string;
  versionNumber: number;
  publishedAt: string;
  clientName: string | null;
  totalConIva: number | null;
  comisionVentasUsdSinIva: number | null;
  isDefault: boolean;
}

export interface EligibleProposalsResult {
  proposals: EligibleProposal[];
  onlyOld: boolean;
}

export interface CommissionListParams {
  status?: CommissionStatus;
  sort?: "fecha" | "monto" | "cliente";
  year?: number;
  asesorId?: string;
  // "mine" (propias) o "all" (todas, para ADMIN/FINANZAS).
  scope?: "mine" | "all";
}

export async function getCommissions(params: CommissionListParams = {}): Promise<CommissionListItem[]> {
  const { scope = "mine", ...q } = params;
  const path = scope === "all" ? "/api/commissions" : "/api/commissions/mine";
  const { data } = await api.get<CommissionListItem[]>(path, { params: q });
  return data;
}

export async function getCommissionMetrics(
  params: { year?: number; asesorId?: string } = {},
): Promise<CommissionMetrics> {
  const { data } = await api.get<CommissionMetrics>("/api/commissions/metrics", { params });
  return data;
}

export async function getEligibleProposals(leadId: string): Promise<EligibleProposalsResult> {
  const { data } = await api.get<EligibleProposalsResult>(
    `/api/leads/${leadId}/commission/eligible-proposals`,
  );
  return data;
}

export async function getLeadCommission(leadId: string): Promise<SerializedCommission | null> {
  const { data } = await api.get<{ commission: SerializedCommission | null }>(
    `/api/leads/${leadId}/commission`,
  );
  return data.commission;
}

export async function confirmCommission(
  leadId: string,
  body: { proposalVersionId?: string; montoManualUsd?: number; proposalGenerationId?: string },
): Promise<{ commission: SerializedCommission; created: boolean }> {
  const { data } = await api.post(`/api/leads/${leadId}/commission`, body);
  return data;
}

// Comisión manual cargada por un admin (sin lead).
export async function createManualCommission(body: {
  asesorId: string;
  montoUsd: number;
  fecha: string; // YYYY-MM-DD
  concepto?: string;
}): Promise<SerializedCommission> {
  const { data } = await api.post<SerializedCommission>("/api/commissions", body);
  return data;
}

// Editar una comisión ya congelada (solo ADMIN). Fechas en YYYY-MM-DD.
export async function updateCommission(
  id: string,
  body: { montoUsd?: number; fechaVenta?: string; dueDate?: string; motivo?: string },
): Promise<SerializedCommission> {
  const { data } = await api.patch<SerializedCommission>(`/api/commissions/${id}`, body);
  return data;
}

// Borrar una comisión y su movimiento en Finanzas (solo ADMIN).
export interface ProjectCommissionPreview {
  clientName: string;
  budgetUsd: number | null;
  porcentajeSugerido: number;
  montoSugeridoUsd: number | null;
  asesorId: string | null;
  asesorName: string | null;
  fechaVenta: string | null;
  yaExisteComision: boolean;
}

// Preview admin-only para precargar la comisión desde la vista de proyecto.
export async function getProjectCommissionPreview(projectId: string): Promise<ProjectCommissionPreview> {
  const { data } = await api.get<ProjectCommissionPreview>(`/api/projects/${projectId}/commission-preview`);
  return data;
}

export async function deleteCommission(id: string): Promise<{ liberatedApplications: number }> {
  const { data } = await api.delete<{ liberatedApplications: number }>(`/api/commissions/${id}`);
  return data;
}

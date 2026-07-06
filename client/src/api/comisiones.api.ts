import { apiClient as api } from "./axios";

export type CommissionStatus = "PENDIENTE" | "PAGADA";

export interface SerializedCommission {
  id: string;
  asesorId: string;
  leadId: string;
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
  evolucion: Array<{ mes: number; cobradas: number; proyectadas: number }>;
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
  sort?: "fecha" | "monto";
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

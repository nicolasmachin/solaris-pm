import type { Comment, ProjectListItem } from "./api.types";

export type SalesStage =
  | "NUEVO_LEAD"
  | "COTIZADO"
  | "RECLAMADO"
  | "AGENDAR_VISITA"
  | "VISITADO"
  | "CERRADO_GANADO"
  | "CERRADO_PERDIDO";

export const STAGE_LABELS: Record<SalesStage, string> = {
  NUEVO_LEAD: "Nuevo lead",
  COTIZADO: "Cotizado",
  RECLAMADO: "Reclamado",
  AGENDAR_VISITA: "Agendar visita",
  VISITADO: "Visitado",
  CERRADO_GANADO: "Ganado",
  CERRADO_PERDIDO: "Perdido",
};

// Colores por stage compartidos entre Kanban y vista de lista.
export const STAGE_COLORS: Record<SalesStage, { border: string; dot: string }> = {
  NUEVO_LEAD: { border: "#334155", dot: "#94a3b8" },
  COTIZADO: { border: "#2563eb", dot: "#60a5fa" },
  RECLAMADO: { border: "#ea580c", dot: "#fb923c" },
  AGENDAR_VISITA: { border: "#0f766e", dot: "#2dd4bf" },
  VISITADO: { border: "#4d7c0f", dot: "#a3e635" },
  CERRADO_GANADO: { border: "#166534", dot: "#4ade80" },
  CERRADO_PERDIDO: { border: "#991b1b", dot: "#f87171" },
};

export const KANBAN_COLUMNS: SalesStage[] = [
  "NUEVO_LEAD",
  "COTIZADO",
  "RECLAMADO",
  "AGENDAR_VISITA",
  "VISITADO",
];

export interface LeadListItem {
  id: string;
  code: string;
  clientName: string;
  stage: SalesStage;
  estimatedKwp: number | null;
  estimatedBudgetUsd: number | null;
  assignedTo: { id: string; name: string } | null;
  daysInStage: number;
  reclamosCount: number;
  lastReclamoAt: string | null;
}

export interface LeadStageGroup {
  stage: SalesStage;
  count: number;
  leads: LeadListItem[];
}

export interface LeadActivity {
  id: string;
  action: string;
  notes: string | null;
  fromStage: SalesStage | null;
  toStage: SalesStage | null;
  user: { id: string; name: string };
  createdAt: string;
}

export interface LeadProposal {
  id: string;
  version: number;
  status: "PENDING" | "PROCESSING" | "COMPLETED" | "FAILED";
  inputFilePath?: string | null;
  outputFilePath?: string | null;
  errorMessage?: string | null;
  attachmentId?: string | null;
  completedAt?: string | null;
  createdAt: string;
  updatedAt: string;
  downloadUrl?: string | null;
}

// Lista unificada de propuestas del lead (viejas + nuevas). Mirror del backend
// (lead-proposals.service.ts).
export interface ProposalActions {
  canDownloadFull: boolean;
  canDownloadSummary: boolean;
  canDownloadExcel: boolean;
  canPreview: boolean;
  canDiscard: boolean;
  canRestore: boolean;
}

export interface ProposalListItem {
  id: string;
  tipo: "vieja" | "nueva";
  createdAt: string;
  versionNumber?: number;
  clientName: string;
  status: "activa" | "descartada" | null;
  totalConIva?: number;
  actions: ProposalActions;
}

export interface LeadDetail {
  id: string;
  code: string;
  clientName: string;
  clientEmail: string | null;
  clientPhone: string | null;
  address: string | null;
  stage: SalesStage;
  estimatedKwp: number | null;
  estimatedBudgetUsd: number | null;
  uteBillMonthlyUsd: number | null;
  roofType: string | null;
  notes: string | null;
  lostReason: string | null;
  leadCreatedAt: string | null;
  proposalSentAt: string | null;
  visitScheduledAt: string | null;
  visitCompletedAt: string | null;
  closedAt: string | null;
  reclamosCount: number;
  lastReclamoAt: string | null;
  assignedTo: { id: string; name: string } | null;
  convertedToProject: Pick<ProjectListItem, "id" | "code" | "clientName"> | null;
  convertedAt: string | null;
  comments: Comment[];
  activities: LeadActivity[];
  proposals: LeadProposal[];
  createdAt: string;
  updatedAt: string;
}

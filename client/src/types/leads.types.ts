import type { Comment, ProjectListItem } from "./api.types";

export type SalesStage =
  | "NUEVO_LEAD"
  | "PENDIENTE_COTIZAR"
  | "COTIZADO"
  | "RECLAMADO"
  | "VOLVER_CONTACTAR"
  | "NEGOCIACION"
  | "AGENDAR_VISITA"
  | "VISITADO"
  | "ONBOARDING"
  | "CERRADO_GANADO"
  | "CERRADO_PERDIDO"
  | "MAS_ADELANTE";

export const STAGE_LABELS: Record<SalesStage, string> = {
  NUEVO_LEAD: "Nuevo lead",
  PENDIENTE_COTIZAR: "Pendiente cotizar",
  COTIZADO: "Cotizado",
  RECLAMADO: "Reclamado",
  VOLVER_CONTACTAR: "Volver a contactar",
  NEGOCIACION: "Negociación",
  AGENDAR_VISITA: "Agendar visita",
  VISITADO: "Visitado",
  ONBOARDING: "Onboarding",
  CERRADO_GANADO: "Ganado",
  CERRADO_PERDIDO: "Perdido",
  MAS_ADELANTE: "Más adelante",
};

// Colores por stage compartidos entre Kanban y vista de lista.
export const STAGE_COLORS: Record<SalesStage, { border: string; dot: string }> = {
  NUEVO_LEAD: { border: "#334155", dot: "#94a3b8" },
  PENDIENTE_COTIZAR: { border: "#b45309", dot: "#f59e0b" },
  COTIZADO: { border: "#2563eb", dot: "#60a5fa" },
  RECLAMADO: { border: "#ea580c", dot: "#fb923c" },
  VOLVER_CONTACTAR: { border: "#6b7280", dot: "#cbd5e1" },
  NEGOCIACION: { border: "#7c3aed", dot: "#c084fc" },
  AGENDAR_VISITA: { border: "#0f766e", dot: "#2dd4bf" },
  VISITADO: { border: "#4d7c0f", dot: "#a3e635" },
  ONBOARDING: { border: "#4d7c0f", dot: "#a3e635" },
  CERRADO_GANADO: { border: "#166534", dot: "#4ade80" },
  CERRADO_PERDIDO: { border: "#991b1b", dot: "#f87171" },
  MAS_ADELANTE: { border: "#64748b", dot: "#94a3b8" },
};

export const KANBAN_COLUMNS: SalesStage[] = [
  "NUEVO_LEAD",
  "PENDIENTE_COTIZAR",
  "COTIZADO",
  "RECLAMADO",
  "VOLVER_CONTACTAR",
  "NEGOCIACION",
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
  assignedTo: { id: string; name: string } | null;
  convertedToProject: Pick<ProjectListItem, "id" | "code" | "clientName"> | null;
  convertedAt: string | null;
  comments: Comment[];
  activities: LeadActivity[];
  proposals: LeadProposal[];
  createdAt: string;
  updatedAt: string;
}

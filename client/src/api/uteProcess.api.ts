import { apiClient } from "./axios";

export type UteStage =
  | "CONSULTA"
  | "SOLICITUD"
  | "DOCS_1"
  | "DOCS_2"
  | "RELEVAR"
  | "ENSAYOS"
  | "FINALIZADO";

export type UteStatus = "CERRADO" | "EN_PROCESO" | "ESPERANDO" | "PENDIENTE";

export type UteActionKey =
  | "consultaSentAt"
  | "caseOpenedAt"
  | "consultaApprovedAt"
  | "solicitudSentAt"
  | "proyectoApprovedAt"
  | "docs1SentAt"
  | "docs1ApprovedAt"
  | "ensayosSentAt"
  | "ensayosApprovedAt"
  | "docs2SentAt"
  | "finalizedAt";

export type UteDateColors = Partial<Record<UteActionKey, string>>;

export type UteProcess = {
  id: string;
  projectId: string;
  project: {
    id: string;
    code: string;
    clientName: string;
    locationCity: string;
    notificationPhone: string | null;
    notificationEmail: string | null;
  };
  currentStage: UteStage;
  currentStatus: UteStatus;
  stageManuallySet: boolean;
  caseNumber: string | null;
  notes: string | null;
  dateColors: UteDateColors;
  consultaSentAt: string | null;
  caseOpenedAt: string | null;
  consultaApprovedAt: string | null;
  solicitudSentAt: string | null;
  proyectoApprovedAt: string | null;
  docs1SentAt: string | null;
  docs1ApprovedAt: string | null;
  ensayosSentAt: string | null;
  ensayosApprovedAt: string | null;
  docs2SentAt: string | null;
  finalizedAt: string | null;
  lastActionAt: string | null;
  totalDays: number;
  ourTimeDays: number;
  uteTimeDays: number;
  createdAt: string;
  updatedAt: string;
  createdById: string | null;
};

export type UteSortBy =
  | "client"
  | "duration"
  | "currentStage"
  | "currentStatus"
  | "createdAt"
  | "updatedAt";

export type UteListParams = {
  stage?: UteStage | null;
  status?: UteStatus | null;
  search?: string | null;
  sortBy?: UteSortBy;
  sortOrder?: "asc" | "desc";
};

export async function getUteProcesses(params: UteListParams = {}): Promise<UteProcess[]> {
  const clean: Record<string, string> = {};
  if (params.stage) clean.stage = params.stage;
  if (params.status) clean.status = params.status;
  if (params.search) clean.search = params.search;
  if (params.sortBy) clean.sortBy = params.sortBy;
  if (params.sortOrder) clean.sortOrder = params.sortOrder;
  const { data } = await apiClient.get<UteProcess[]>("/api/ute-processes", { params: clean });
  return data;
}

export async function getUteProcess(id: string): Promise<UteProcess> {
  const { data } = await apiClient.get<UteProcess>(`/api/ute-processes/${id}`);
  return data;
}

export type UteCreateInput = {
  projectId: string;
  caseNumber?: string | null;
  notes?: string | null;
  consultaSentAt?: string | null;
};

export async function createUteProcess(body: UteCreateInput): Promise<UteProcess> {
  const { data } = await apiClient.post<UteProcess>("/api/ute-processes", body);
  return data;
}

export type UtePatchInput = Partial<
  Record<UteActionKey, string | null>
> & {
  caseNumber?: string | null;
  notes?: string | null;
  currentStage?: UteStage;
  currentStatus?: UteStatus;
  stageManuallySet?: boolean;
  dateColors?: UteDateColors | null;
};

export async function patchUteProcess(id: string, body: UtePatchInput): Promise<UteProcess> {
  const { data } = await apiClient.patch<UteProcess>(`/api/ute-processes/${id}`, body);
  return data;
}

export async function deleteUteProcess(id: string): Promise<void> {
  await apiClient.delete(`/api/ute-processes/${id}`);
}

// ─── Constantes de presentación ─────────────────────────────────────────────

export const UTE_STAGE_ORDER: UteStage[] = [
  "CONSULTA",
  "SOLICITUD",
  "DOCS_1",
  "DOCS_2",
  "RELEVAR",
  "ENSAYOS",
  "FINALIZADO",
];

export const UTE_STAGE_LABEL: Record<UteStage, string> = {
  CONSULTA: "1. Consulta",
  SOLICITUD: "2. Solicitud",
  DOCS_1: "3. Docs 1",
  DOCS_2: "4. Docs 2",
  RELEVAR: "5. Relevar",
  ENSAYOS: "6. Ensayos",
  FINALIZADO: "7. Finalizado",
};

export const UTE_STATUS_LABEL: Record<UteStatus, string> = {
  CERRADO: "Cerrado",
  EN_PROCESO: "En proceso",
  ESPERANDO: "Esperando",
  PENDIENTE: "Pendiente",
};

export const UTE_ACTIONS_ORDERED: Array<{
  key: UteActionKey;
  label: string;
  side: "ours" | "ute";
}> = [
  { key: "consultaSentAt",     label: "Consulta enviada",     side: "ours" },
  { key: "caseOpenedAt",       label: "Caso abierto",         side: "ute" },
  { key: "consultaApprovedAt", label: "Consulta aprobada",    side: "ute" },
  { key: "solicitudSentAt",    label: "Solicitud enviada",    side: "ours" },
  { key: "proyectoApprovedAt", label: "Proyecto aprobado",    side: "ute" },
  { key: "docs1SentAt",        label: "Docs 1 enviados",      side: "ours" },
  { key: "docs1ApprovedAt",    label: "Docs 1 aprobados",     side: "ute" },
  { key: "ensayosSentAt",      label: "Ensayos enviados",     side: "ours" },
  { key: "ensayosApprovedAt",  label: "Ensayos aprobados",    side: "ute" },
  { key: "docs2SentAt",        label: "Docs 2 enviados",      side: "ours" },
  { key: "finalizedAt",        label: "Finalizado",           side: "ute" },
];

// ─── Paleta global de colores para celdas de fecha ──────────────────────────

export const UTE_COLOR_PALETTE = [
  "#5DCAA5",
  "#EAB308",
  "#EF5B5B",
  "#378ADD",
  "#6B7790",
  "#A78BFA",
] as const;

export type UteColorHex = (typeof UTE_COLOR_PALETTE)[number];

export const UTE_DEFAULT_COLOR: UteColorHex = "#5DCAA5";

// Flow order (distinto del display 1-7): el flujo real es
// CONSULTA → SOLICITUD → DOCS_1 → ENSAYOS → DOCS_2 → FINALIZADO.
// RELEVAR es lateral/manual y no participa del orden.
export const UTE_FLOW_ORDER: Record<UteStage, number> = {
  CONSULTA: 1,
  SOLICITUD: 2,
  DOCS_1: 3,
  ENSAYOS: 4,
  DOCS_2: 5,
  FINALIZADO: 6,
  RELEVAR: 99,
};

// ─── Endpoint de métricas UTE ───────────────────────────────────────────────

export type UteMetrics = {
  kpis: {
    activeCount: number;
    finalizedThisYearCount: number;
    avgTotalDays: number | null;
    avgOurDays: number | null;
    avgUteDays: number | null;
    avgTimeToStartDays: number | null;
  };
  byStage: Array<{
    key: "consulta" | "solicitud" | "docs1" | "ensayos" | "finalizacion";
    label: string;
    avg: number | null;
    min: number | null;
    max: number | null;
    count: number;
  }>;
  distribution: {
    ourPercent: number;
    utePercent: number;
    ourDays: number;
    uteDays: number;
  };
  topOurDelay: Array<{
    id: string;
    projectCode: string;
    clientName: string;
    days: number;
    currentStage: UteStage;
  }>;
  topUteDelay: Array<{
    id: string;
    projectCode: string;
    clientName: string;
    days: number;
    currentStage: UteStage;
  }>;
};

export async function getUteMetrics(): Promise<UteMetrics> {
  const { data } = await apiClient.get<UteMetrics>("/api/metrics/ute");
  return data;
}

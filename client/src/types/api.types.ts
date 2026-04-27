// ─── Enums ───────────────────────────────────────────────────────────────────

export type ProjectStatus =
  | "PROSPECT"
  | "ACTIVE"
  | "PAUSED"
  | "PLANNING"
  | "IN_PROGRESS"
  | "ON_HOLD"
  | "COMPLETED"
  | "CANCELLED"
  | "ARCHIVED";

export type StageStatus = "PENDING" | "IN_PROGRESS" | "COMPLETED" | "BLOCKED";
export type SubstageStatus =
  | "PENDING"
  | "IN_PROGRESS"
  | "COMPLETED"
  | "BLOCKED";
export type TaskStatus = "PENDING" | "IN_PROGRESS" | "COMPLETED" | "CANCELLED";
export type TaskPriority = "LOW" | "NORMAL" | "MEDIUM" | "HIGH" | "URGENT";
export type NotificationType =
  | "STAGE_COMPLETED"
  | "TASK_OVERDUE"
  | "PROJECT_DELAYED"
  | "SUBSTAGE_BLOCKED"
  | "BUDGET_ALERT"
  | "TASK_ASSIGNED"
  | "stage_overdue"
  | "substage_blocked"
  | "task_due"
  | "stage_changed"
  | "progress_milestone"
  | "project_delayed"
  | "goals_not_configured";
export type PhaseType = "MONOFASICO" | "TRIFASICO_230" | "TRIFASICO_400";

// ─── Auth ────────────────────────────────────────────────────────────────────

export type UserRole = "ADMIN" | "ASESOR_COMERCIAL" | "INGENIERIA" | "OPERACIONES";

export interface User {
  id: string;
  email: string;
  name: string;
  role: UserRole;
  createdAt?: string;
  updatedAt?: string;
}

export interface AuthResponse {
  token: string;
  user: User;
}

// ─── Projects list ───────────────────────────────────────────────────────────

export interface ProjectCurrentStage {
  id: string;
  name: string;
  label?: string;
  status: StageStatus;
  progressPercent: number;
  responsibleUserId?: string | null;
}

export interface ProjectListItem {
  id: string;
  code: string;
  clientName: string;
  locationCity: string;
  locationProvince: string;
  status: ProjectStatus;
  capacityKwp: number;
  progressPercent: number;
  /** Porcentaje de etapas completadas excluyendo POSTVENTA (0–100). */
  completionPercent: number;
  /** Nombres (StageType) de las etapas actualmente IN_PROGRESS. */
  currentStages: string[];
  /** Fecha de inicio de instalación (primer segment del schedule) si existe. */
  plannedWorkStart: string | null;
  startDate: string | null;
  plannedEndDate: string | null;
  actualEndDate?: string | null;
  createdAt: string;
  solarSystems: SolarSystem[];
  currentStage: ProjectCurrentStage | null;
  updatedAt: string;
}

export interface SolarSystem {
  id: string;
  projectId: string;
  order: number;
  description: string | null;
  inverterBrand: string | null;
  inverterPowerKw: number | null;
  inverterQuantity: number | null;
  inverterPhaseType: PhaseType | null;
  inverterModel: string | null;
  panelQuantity: number | null;
  panelPowerW: number | null;
  panelBrand: string | null;
  panelModel: string | null;
  deletedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

// ─── Project detail ──────────────────────────────────────────────────────────

export interface ProjectMetrics {
  progressPercent: number;
  daysElapsed: number;
  budgetUsedPercent: number | null;
}

export interface ChecklistItem {
  id: string;
  substageId: string;
  projectId: string;
  order: number;
  label: string;
  completed: boolean;
  completedAt: string | null;
  completedBy: string | null;
  notes: string | null;
  isRequired: boolean;
  isBlocker: boolean;
  isCustom: boolean;
  appliesWhenModalidadPago: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface Comment {
  id: string;
  content: string;
  projectId: string | null;
  leadId: string | null;
  stageId: string | null;
  substageId: string | null;
  checklistItemId: string | null;
  taskId: string | null;
  isEdited: boolean;
  editedAt: string | null;
  createdAt: string;
  updatedAt: string;
  author: {
    id: string;
    name: string;
  };
}

export interface AssignedUserRef {
  id: string;
  name: string;
  role: string | null;
}

export interface Substage {
  id: string;
  stageId: string;
  projectId: string;
  order: number;
  name: string;
  status: SubstageStatus;
  /** @deprecated texto legacy; usar userId + user */
  responsible: string | null;
  userId: string | null;
  user: AssignedUserRef | null;
  dueDate: string | null;
  plannedStartDate: string | null;
  plannedEndDate: string | null;
  actualStartDate: string | null;
  actualEndDate: string | null;
  actualDurationDays?: number | null;
  delayDays?: number | null;
  notes: string | null;
  deletedAt: string | null;
  createdAt: string;
  updatedAt: string;
  checklistItems: ChecklistItem[];
}

export interface Stage {
  id: string;
  projectId: string;
  order: number;
  name: string;
  label?: string;
  status: StageStatus;
  progressPercent: number;
  plannedStartDate: string | null;
  plannedEndDate: string | null;
  actualStartDate: string | null;
  actualEndDate: string | null;
  plannedDurationDays: number | null;
  actualDurationDays: number | null;
  delayDays: number | null;
  actualDatesManuallyEdited?: boolean;
  /** @deprecated texto legacy; usar responsibleUserId + responsibleUser */
  responsibleName?: string | null;
  responsibleUserId?: string | null;
  responsibleUser?: AssignedUserRef | null;
  notes: string | null;
  createdAt: string;
  updatedAt: string;
  substages: Substage[];
}

export interface Task {
  id: string;
  projectId: string;
  stageId: string | null;
  substageId: string | null;
  title: string;
  description: string | null;
  status: TaskStatus;
  priority: TaskPriority;
  /** @deprecated texto legacy; usar userId + user */
  responsible: string | null;
  userId: string | null;
  user: AssignedUserRef | null;
  dueDate: string | null;
  completedAt: string | null;
  deletedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface FileAttachment {
  id: string;
  projectId: string;
  stageId: string | null;
  substageId: string | null;
  filename: string;
  storedFilename: string;
  mimeType: string;
  sizeBytes: number;
  url: string;
  uploadedById: string | null;
  deletedAt: string | null;
  createdAt: string;
}

export interface Project {
  id: string;
  code: string;
  clientName: string;
  capacityKwp: number;
  locationCity: string;
  locationProvince: string;
  status: ProjectStatus;
  startDate: string | null;
  plannedEndDate: string | null;
  actualEndDate: string | null;
  budgetUsd: number | null;
  executedUsd: number;
  estimatedMwhYear: number | null;
  co2TonsAvoided: number | null;
  notificationEmail: string | null;
  notificationPhone: string | null;
  clientAddress: string | null;
  firstDateScheduledAt: string | null;
  createdById: string;
  salespersonId: string | null;
  salesperson: { id: string; name: string } | null;
  deletedAt: string | null;
  createdAt: string;
  updatedAt: string;
  solarSystems: SolarSystem[];
  stages: Stage[];
  tasks: Task[];
  files: FileAttachment[];
  metrics: ProjectMetrics;
  currentStage: Stage | null;
  recentTasks: Task[];
  recentFiles: FileAttachment[];
  installationSchedule?: {
    id: string;
    teamName: string;
    teamColor: string;
    // Envelope (min/max de segments). Puede ser null si por alguna razón no hay
    // segments, pero en la práctica siempre viene.
    plannedWorkStart: string | null;
    plannedWorkEnd: string | null;
    confirmedAt: string | null;
    confirmedByUser: { id: string; name: string } | null;
    notes: string | null;
    segments: Array<{
      id: string;
      startDate: string;
      endDate: string;
      notes: string | null;
    }>;
  } | null;
  /** Trámite UTE asociado al proyecto (activo, no eliminado). */
  uteProcess?: import("../api/uteProcess.api").UteProcess | null;
}

// ─── Substage patch response ──────────────────────────────────────────────────

export interface SubstagePatchResponse extends Substage {
  stageProgressPercent: number | null;
}

// ─── Audit ───────────────────────────────────────────────────────────────────

export interface AuditLog {
  id: string;
  entityType: string;
  entityId: string;
  projectId: string;
  userId: string | null;
  action: string;
  fieldChanged: string | null;
  oldValue: string | null;
  newValue: string | null;
  description: string;
  timestamp: string;
  metadata: Record<string, unknown> | null;
  user: {
    id: string;
    name: string;
    email: string;
  } | null;
}

// ─── Notifications ───────────────────────────────────────────────────────────

export interface Notification {
  id: string;
  projectId: string | null;
  type: NotificationType;
  title: string;
  message: string;
  read: boolean;
  createdAt: string;
  project?: Pick<ProjectListItem, "id" | "clientName">;
}

// ─── Pagination ──────────────────────────────────────────────────────────────

export interface PaginatedResponse<T> {
  data: T[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

// ─── Errors ──────────────────────────────────────────────────────────────────

export interface ApiError {
  error: boolean;
  code: string;
  message: string;
}

export interface MetricsOverview {
  filterYear: number;
  filterQuarter: number | null;
  totalProjects: number;
  activeProjects: number;
  completedProjects: number;
  installationsThisYear: number;
  installationsThisQuarter: number;
  kwpInstalledThisYear: number;
  kwpInstalledThisQuarter: number;
  avgDaysToScheduleFirstDate: number | null;
  totalKwp: number;
  totalMwhYear: number;
  totalCo2Tons: number;
  totalBudgetUsd: number;
  totalExecutedUsd: number;
  avgProgressPercent: number;
  avgSaleToDeliveryDays: number | null;
  goals: GoalProgress[];
}

export type GoalMetric = "INSTALLATIONS_COUNT" | "KWP_INSTALLED" | "LEADS_CREATED" | "PROPOSALS_SENT" | "CLOSED_WON";
export type GoalArea = "VENTAS" | "OPERACIONES";
export type GoalPeriod = "ANNUAL" | "QUARTERLY";

export interface GoalData {
  id: string;
  area: GoalArea;
  metric: GoalMetric;
  period: GoalPeriod;
  year: number;
  quarter: number | null;
  targetValue: number;
  createdBy?: { id: string; name: string };
  createdAt?: string;
}

export interface GoalProgress {
  id: string;
  metric: GoalMetric;
  period: GoalPeriod;
  quarter: number | null;
  targetValue: number;
  actualValue: number;
  percentAchieved: number | null;
  onTrack: boolean;
}

export interface MetricsSales {
  filterYear: number;
  filterQuarter: number | null;
  leadsCreatedThisYear: number;
  leadsCreatedThisQuarter: number | null;
  leadsCreatedThisWeek: number;
  proposalsSentThisYear: number;
  proposalsSentThisQuarter: number | null;
  proposalsSentThisWeek: number;
  closedWonThisYear: number;
  closedWonThisQuarter: number | null;
  closedWonThisWeek: number;
  closedLostThisYear: number;
  closedLostThisQuarter: number | null;
  conversionRate: number | null;
  avgLeadToProposal: number | null;
  avgProposalToVisit: number | null;
  avgVisitToClose: number | null;
  avgProposalToClose: number | null;
  goals: GoalProgress[];
}

export interface MetricsStageRow {
  stageName: string;
  stageLabel: string;
  avgActualDays: number;
  minActualDays: number;
  maxActualDays: number;
  completedCount: number;
}

export interface MetricsProjectRow {
  id: string;
  code: string;
  clientName: string;
  capacityKwp: number;
  status: ProjectStatus;
  progressPercent: number;
  daysElapsed: number;
  budgetUsd: number | null;
  executedUsd: number;
}

export interface ProjectGanttStage {
  id: string;
  name: string;
  label: string;
  plannedStart: string | null;
  plannedEnd: string | null;
  actualStart: string | null;
  actualEnd: string | null;
  status: StageStatus;
  progressPercent: number;
  delayDays: number | null;
}

export interface ProjectGanttResponse {
  projectId: string;
  projectCode: string;
  projectName: string;
  stages: ProjectGanttStage[];
}

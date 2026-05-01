import { apiClient } from "./axios";
import type {
  GoalArea,
  GoalData,
  MetricsOverview,
  MetricsProjectRow,
  MetricsSales,
  MetricsStageRow,
  ProjectGanttResponse,
} from "../types/api.types";

interface PeriodParams {
  year?: number;
  quarter?: number;
}

function periodQuery(params?: PeriodParams): Record<string, string> {
  const q: Record<string, string> = {};
  if (params?.year) q.year = String(params.year);
  if (params?.quarter) q.quarter = String(params.quarter);
  return q;
}

export async function getMetricsOverview(params?: PeriodParams): Promise<MetricsOverview> {
  const { data } = await apiClient.get<MetricsOverview>("/api/metrics/overview", { params: periodQuery(params) });
  return data;
}

export async function getMetricsStages(params?: PeriodParams): Promise<MetricsStageRow[]> {
  const { data } = await apiClient.get<MetricsStageRow[]>("/api/metrics/stages", { params: periodQuery(params) });
  return data;
}

export async function getMetricsProjects(): Promise<MetricsProjectRow[]> {
  const { data } = await apiClient.get<MetricsProjectRow[]>("/api/metrics/projects");
  return data;
}

export async function getMetricsSales(params?: PeriodParams): Promise<MetricsSales> {
  const { data } = await apiClient.get<MetricsSales>("/api/metrics/sales", { params: periodQuery(params) });
  return data;
}

export async function getProjectGantt(projectId: string): Promise<ProjectGanttResponse> {
  const { data } = await apiClient.get<ProjectGanttResponse>(`/api/metrics/projects/${projectId}/gantt`);
  return data;
}

// ─── Goals ───────────────────────────────────────────────────────────────────

export async function getGoals(params?: { area?: GoalArea; year?: number }): Promise<Record<string, GoalData[]>> {
  const q: Record<string, string> = {};
  if (params?.area) q.area = params.area;
  if (params?.year) q.year = String(params.year);
  const { data } = await apiClient.get<Record<string, GoalData[]>>("/api/goals", { params: q });
  return data;
}

export async function upsertGoal(body: {
  area: GoalArea;
  metric: string;
  period: string;
  year: number;
  quarter?: number | null;
  targetValue: number;
}): Promise<GoalData> {
  const { data } = await apiClient.post<GoalData>("/api/goals", body);
  return data;
}

export async function deleteGoal(id: string): Promise<void> {
  await apiClient.delete(`/api/goals/${id}`);
}

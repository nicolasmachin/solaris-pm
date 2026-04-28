import { apiClient } from './axios';
import type { DeadlineRule, CreateDeadlineRulePayload, UpdateDeadlineRulePayload, StageType } from '../types/deadline.types';

export const getDeadlineRules = (params?: { stageType?: StageType; activa?: boolean }) =>
  apiClient
    .get<DeadlineRule[]>('/api/admin/deadline-rules', {
      params: {
        ...(params?.stageType ? { stageType: params.stageType } : {}),
        ...(params?.activa !== undefined ? { activa: params.activa ? 'true' : 'false' } : {}),
      },
    })
    .then(r => r.data);

export const getDeadlineRule = (id: string) =>
  apiClient.get<DeadlineRule>(`/api/admin/deadline-rules/${id}`).then(r => r.data);

export const createDeadlineRule = (data: CreateDeadlineRulePayload) =>
  apiClient.post<DeadlineRule>('/api/admin/deadline-rules', data).then(r => r.data);

export const updateDeadlineRule = (id: string, data: UpdateDeadlineRulePayload) =>
  apiClient.patch<DeadlineRule>(`/api/admin/deadline-rules/${id}`, data).then(r => r.data);

export const deleteDeadlineRule = (id: string) =>
  apiClient.delete<{ success: true }>(`/api/admin/deadline-rules/${id}`).then(r => r.data);

// ─── Substage deadlines (manual edit + reset) ──────────────────────────────

export interface SubstageDeadlineResponse {
  id: string;
  deadline: string | null;
  deadlineManuallySet: boolean;
}

export const setSubstageDeadlineManual = (substageId: string, deadline: string | null) =>
  apiClient.patch<SubstageDeadlineResponse>(`/api/substages/${substageId}/deadline`, { deadline }).then(r => r.data);

export const resetSubstageDeadlineOverride = (substageId: string) =>
  apiClient.delete<SubstageDeadlineResponse>(`/api/substages/${substageId}/deadline-override`).then(r => r.data);

// ─── Recálculo a nivel proyecto ────────────────────────────────────────────

export interface RecalculateDeadlinesResult {
  total: number;
  updated: number;
  preserved: number;
  cleared: number;
}

export interface RecalculateConfirmRequired {
  error: true;
  code: 'CONFIRM_RECALCULATE';
  overrideCount: number;
  message: string;
}

export const recalculateProjectDeadlines = (projectId: string, forceOverrides: boolean = false) =>
  apiClient
    .post<RecalculateDeadlinesResult>(`/api/projects/${projectId}/recalculate-deadlines`, { forceOverrides })
    .then(r => r.data);


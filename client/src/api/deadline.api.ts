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

import { apiClient } from './axios';

export type AIQueryStatus =
  | 'SUCCESS'
  | 'SQL_INVALID'
  | 'EXECUTION_ERROR'
  | 'RATE_LIMIT_EXCEEDED'
  | 'PERMISSION_DENIED'
  | 'AI_ERROR';

export interface AIAskResponse {
  response: string;
  sql: string;
  rowCount: number;
  costUSD: number;
  tokens: { input: number; output: number };
  durationMs: number;
}

export const askAI = (question: string) =>
  apiClient.post<AIAskResponse>('/api/ai/ask', { question }).then(r => r.data);

export interface AIStatusResponse {
  enabled: boolean;
  message: string;
}

export const getAIStatus = () =>
  apiClient.get<AIStatusResponse>('/api/ai/status').then(r => r.data);

export interface AIHistoryItem {
  id: string;
  question: string;
  response: string | null;
  generatedSQL: string | null;
  status: AIQueryStatus;
  errorMessage: string | null;
  costUSD: number;
  durationMs: number | null;
  createdAt: string;
}

export const getAIHistory = () =>
  apiClient.get<AIHistoryItem[]>('/api/ai/history').then(r => r.data);

export interface AILogItem extends AIHistoryItem {
  tokensInput: number | null;
  tokensOutput: number | null;
  user: { id: string; name: string; email: string };
}

export const getAILogs = (limit = 50) =>
  apiClient.get<AILogItem[]>('/api/ai/logs', { params: { limit } }).then(r => r.data);

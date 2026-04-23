import { apiClient } from "./axios";
import type { StageStatus, SubstageStatus } from "../types/api.types";

export type StageType =
  | "ONBOARDING"
  | "INGENIERIA"
  | "OPERACIONES"
  | "HABILITACION_UTE"
  | "POSTVENTA";

export interface MyTaskSubstage {
  id: string;
  name: string;
  status: SubstageStatus;
  dueDate: string | null;
  checklistDoneCount: number;
  checklistTotalCount: number;
  assignedUser: {
    id: string | null;
    name: string;
    initials: string;
    isCurrentUser: boolean;
  } | null;
  urgencyRank: number;
}

export interface MyTaskBlock {
  projectId: string;
  projectCode: string;
  projectName: string;
  stageId: string;
  stageName: StageType;
  stageLabel: string;
  stageDueDate: string | null;
  pendingSubstagesCount: number;
  myPendingSubstagesCount: number;
  blockRank: number;
  substages: MyTaskSubstage[];
  // Nota: el backend no expone este campo; se calcula en el front si hace falta
  stageStatus?: StageStatus;
}

export async function getMyTasks(params?: { userId?: string | null }): Promise<MyTaskBlock[]> {
  const query: Record<string, string> = {};
  if (params?.userId) query.userId = params.userId;
  const { data } = await apiClient.get<MyTaskBlock[]>("/api/my-tasks", { params: query });
  return data;
}

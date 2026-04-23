import { apiClient } from "./axios";
import type { Stage, Substage, SubstagePatchResponse } from "../types/api.types";

export async function patchStage(
  projectId: string,
  stageId: string,
  body: {
    status?: Stage["status"];
    notes?: string | null;
    /** @deprecated usar responsibleUserId */
    responsibleName?: string | null;
    responsibleUserId?: string | null;
    plannedStartDate?: string | null;
    plannedEndDate?: string | null;
    actualStartDate?: string | null;
    actualEndDate?: string | null;
  }
): Promise<Stage> {
  const { data } = await apiClient.patch<Stage>(
    `/api/projects/${projectId}/stages/${stageId}`,
    body
  );
  return data;
}

export async function createSubstage(
  projectId: string,
  stageId: string,
  body: {
    name: string;
    /** @deprecated usar userId */
    responsible?: string;
    userId?: string | null;
    dueDate?: string | null;
    plannedStartDate?: string | null;
    plannedEndDate?: string | null;
    notes?: string | null;
  }
): Promise<Substage> {
  const { data } = await apiClient.post<Substage>(
    `/api/projects/${projectId}/stages/${stageId}/substages`,
    body
  );
  return data;
}

export async function patchSubstage(
  projectId: string,
  stageId: string,
  substageId: string,
  body: {
    name?: string;
    status?: Substage["status"];
    notes?: string | null;
    /** @deprecated usar userId */
    responsible?: string;
    userId?: string | null;
    dueDate?: string | null;
    plannedStartDate?: string | null;
    plannedEndDate?: string | null;
  }
): Promise<SubstagePatchResponse> {
  const { data } = await apiClient.patch<SubstagePatchResponse>(
    `/api/projects/${projectId}/stages/${stageId}/substages/${substageId}`,
    body
  );
  return data;
}

export async function deleteSubstage(
  projectId: string,
  stageId: string,
  substageId: string
): Promise<void> {
  await apiClient.delete(
    `/api/projects/${projectId}/stages/${stageId}/substages/${substageId}`
  );
}

export async function completeSubstage(projectId: string, stageId: string, substageId: string): Promise<SubstagePatchResponse> {
  const { data } = await apiClient.patch<SubstagePatchResponse>(
    `/api/projects/${projectId}/stages/${stageId}/substages/${substageId}`,
    { status: "COMPLETED" }
  );
  return data;
}

export async function completeAllSubstages(projectId: string, stageId: string): Promise<void> {
  await apiClient.patch(
    `/api/projects/${projectId}/stages/${stageId}/complete-all`,
    {}
  );
}

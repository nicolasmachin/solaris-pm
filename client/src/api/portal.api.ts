import { apiClient } from "./axios";

export interface PortalProjectListItem {
  id: string;
  code: string;
  clientName: string;
  capacityKwp: number;
  location: string;
  uteCaseNumber: string | null;
  uteCurrentStage: string | null;
  uteFinalized: boolean;
}

export type PortalTimelineStatus = "completed" | "current" | "pending";
export type PortalResponsible = "VOLTIA" | "UTE";

export interface PortalTimelineItem {
  key: string;
  label: string;
  description: string;
  responsible: PortalResponsible;
  status: PortalTimelineStatus;
  completedAt: string | null;
  daysInStage: number | null;
  explanation: string | null;
}

export interface PortalProjectUte {
  projectId: string;
  projectCode: string;
  clientName: string;
  capacityKwp: number;
  location: string;
  ute: {
    id: string;
    caseNumber: string | null;
    currentStage: string;
    currentStatus: string;
    finalizedAt: string | null;
    totalDays: number;
    ourTimeDays: number;
    uteTimeDays: number;
  } | null;
  timeline: PortalTimelineItem[];
}

export async function getPortalProjects(): Promise<PortalProjectListItem[]> {
  const { data } = await apiClient.get<PortalProjectListItem[]>("/api/client/projects");
  return data;
}

export async function getPortalProjectUte(projectId: string): Promise<PortalProjectUte> {
  const { data } = await apiClient.get<PortalProjectUte>(
    `/api/client/projects/${projectId}/ute`,
  );
  return data;
}

import { apiClient } from "./axios";

export type TipoObraLabel = "PROPIA" | "TERCERIZADA" | null;

export interface InstallationScheduleProjectRef {
  id: string;
  clientName: string;
  code: string;
  capacityKwp: number;
  locationCity: string;
  workType: TipoObraLabel;
}

export interface InstallationSchedule {
  id: string;
  projectId: string;
  teamId: string | null;
  team: { id: string; name: string; color: string } | null;
  teamName: string; // snapshot del nombre al momento de agendar
  teamColor: string; // snapshot del color
  plannedWorkStart: string; // YYYY-MM-DD
  plannedWorkEnd: string;   // YYYY-MM-DD
  actualWorkEnd: string | null;
  confirmedAt: string | null;
  confirmedBy: string | null;
  confirmedByUser: { id: string; name: string } | null;
  notes: string | null;
  operationsCompleted: boolean;
  createdAt: string;
  updatedAt: string;
  project: InstallationScheduleProjectRef | null;
}

export interface CalendarResponse {
  schedules: InstallationSchedule[];
  range: { start: string; end: string };
}

export interface CalendarTeam {
  id: string;
  teamName: string;
  teamColor: string;
}

export interface CalendarWarning {
  code: string;
  message: string;
}

export interface ScheduleWithWarning {
  data: InstallationSchedule;
  warning: CalendarWarning | null;
}

export interface InstallationCheckResponse {
  hasInstallation: boolean;
  plannedWorkStart: string | null;
  plannedWorkEnd: string | null;
  actualWorkEnd: string | null;
  operationsStatus: string | null;
  operationsActualStart: string | null;
  operationsActualEnd: string | null;
  issues: Array<{
    severity: "error" | "warning";
    code: string;
    message: string;
  }>;
}

export async function getCalendarMonth(year: number, month: number): Promise<CalendarResponse> {
  const { data } = await apiClient.get<CalendarResponse>("/api/calendar", {
    params: { year, month },
  });
  return data;
}

export async function getCalendarYear(year: number): Promise<CalendarResponse> {
  const { data } = await apiClient.get<CalendarResponse>("/api/calendar", {
    params: { year },
  });
  return data;
}

export async function getCalendarTeams(): Promise<CalendarTeam[]> {
  const { data } = await apiClient.get<CalendarTeam[]>("/api/calendar/teams");
  return data;
}

export async function createSchedule(body: {
  projectId: string;
  teamId: string;
  plannedWorkStart: string;
  plannedWorkEnd: string;
  notes?: string | null;
}): Promise<ScheduleWithWarning> {
  const { data } = await apiClient.post<ScheduleWithWarning>("/api/calendar", body);
  return data;
}

export async function patchSchedule(
  id: string,
  body: {
    teamId?: string;
    plannedWorkStart?: string;
    plannedWorkEnd?: string;
    notes?: string | null;
  },
): Promise<InstallationSchedule> {
  const { data } = await apiClient.patch<InstallationSchedule>(`/api/calendar/${id}`, body);
  return data;
}

export async function rescheduleSchedule(
  id: string,
  body: { plannedWorkStart: string; plannedWorkEnd: string },
): Promise<ScheduleWithWarning> {
  const { data } = await apiClient.patch<ScheduleWithWarning>(
    `/api/calendar/${id}/reschedule`,
    body,
  );
  return data;
}

export async function confirmSchedule(id: string): Promise<InstallationSchedule> {
  const { data } = await apiClient.patch<InstallationSchedule>(`/api/calendar/${id}/confirm`, {});
  return data;
}

export async function deleteSchedule(id: string): Promise<void> {
  await apiClient.delete(`/api/calendar/${id}`);
}

export async function installationCheck(projectId: string): Promise<InstallationCheckResponse> {
  const { data } = await apiClient.get<InstallationCheckResponse>(
    `/api/projects/${projectId}/installation-check`,
  );
  return data;
}

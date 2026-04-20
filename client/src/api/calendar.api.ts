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
  teamName: string;
  teamColor: string;
  weekStart: string; // YYYY-MM-DD (lunes)
  weekEnd: string;   // YYYY-MM-DD (viernes)
  confirmedAt: string | null;
  confirmedBy: string | null;
  confirmedByUser: { id: string; name: string } | null;
  notes: string | null;
  createdAt: string;
  updatedAt: string;
  project: InstallationScheduleProjectRef | null;
}

export interface CalendarResponse {
  schedules: InstallationSchedule[];
  freeWeeks: string[];
  range: { firstMonday: string; lastMonday: string };
}

export interface CalendarTeam {
  teamName: string;
  teamColor: string;
}

export async function getCalendar(year: number, month: number): Promise<CalendarResponse> {
  const { data } = await apiClient.get<CalendarResponse>("/api/calendar", {
    params: { year, month },
  });
  return data;
}

export async function getCalendarTeams(): Promise<CalendarTeam[]> {
  const { data } = await apiClient.get<CalendarTeam[]>("/api/calendar/teams");
  return data;
}

export async function createSchedule(body: {
  projectId: string;
  teamName: string;
  teamColor?: string;
  weekStart: string;
  notes?: string | null;
}): Promise<InstallationSchedule> {
  const { data } = await apiClient.post<InstallationSchedule>("/api/calendar", body);
  return data;
}

export async function patchSchedule(
  id: string,
  body: {
    teamName?: string;
    teamColor?: string;
    weekStart?: string;
    notes?: string | null;
  },
): Promise<InstallationSchedule> {
  const { data } = await apiClient.patch<InstallationSchedule>(`/api/calendar/${id}`, body);
  return data;
}

export async function confirmSchedule(id: string): Promise<InstallationSchedule> {
  const { data } = await apiClient.patch<InstallationSchedule>(`/api/calendar/${id}/confirm`, {});
  return data;
}

export async function deleteSchedule(id: string): Promise<void> {
  await apiClient.delete(`/api/calendar/${id}`);
}

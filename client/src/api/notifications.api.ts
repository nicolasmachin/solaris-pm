import { apiClient } from "./axios";
import type { Notification } from "../types/api.types";

export async function getNotifications(params?: { unread?: boolean }): Promise<Notification[]> {
  const query: Record<string, string> = {};
  if (params?.unread) query.unread = "true";
  const { data } = await apiClient.get<Notification[]>("/api/notifications", { params: query });
  return data;
}

export async function markNotificationRead(id: string): Promise<void> {
  await apiClient.patch(`/api/notifications/${id}/read`);
}

export async function markAllNotificationsRead(): Promise<void> {
  await apiClient.patch("/api/notifications/read-all");
}

import { apiClient } from "./axios";
import type { AuditLog } from "../types/api.types";

export async function getAuditLog(projectId: string, limit = 20): Promise<AuditLog[]> {
  const { data } = await apiClient.get<AuditLog[]>(
    `/api/projects/${projectId}/audit`,
    { params: { limit } }
  );
  return data;
}

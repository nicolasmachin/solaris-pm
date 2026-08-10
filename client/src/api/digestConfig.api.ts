import { apiClient } from "./axios";

// Config del resumen diario (digest): hora de envío + matriz Rol × Tipo.

export interface DigestTypeMeta {
  type: string;
  label: string;
  description: string;
}

export interface DigestConfig {
  sendHour: number;
  types: DigestTypeMeta[];
  enabled: Array<{ roleName: string; notificationType: string }>;
}

export function getDigestConfig(): Promise<DigestConfig> {
  return apiClient.get<DigestConfig>("/api/admin/digest-config").then((r) => r.data);
}

export function putDigestHour(hour: number): Promise<unknown> {
  return apiClient.put("/api/admin/digest-config/hour", { hour }).then((r) => r.data);
}

export function putDigestToggle(body: {
  roleName: string;
  notificationType: string;
  enabled: boolean;
}): Promise<unknown> {
  return apiClient.put("/api/admin/digest-config/toggle", body).then((r) => r.data);
}

import { apiClient } from "./axios";

// Plazos por etapa (SLA en días hábiles). Config de administración.

export interface StageSlaRow {
  stageType: string;
  /** Plazo en días hábiles. null si nunca se configuró. */
  diasHabiles: number | null;
  activo: boolean;
  /** true si ya existe una fila persistida para este tipo de etapa. */
  configured: boolean;
}

export function getStageSlas(): Promise<StageSlaRow[]> {
  return apiClient.get<StageSlaRow[]>("/api/admin/stage-slas").then((r) => r.data);
}

export function putStageSla(
  stageType: string,
  body: { diasHabiles: number; activo?: boolean },
): Promise<unknown> {
  return apiClient.put(`/api/admin/stage-slas/${stageType}`, body).then((r) => r.data);
}

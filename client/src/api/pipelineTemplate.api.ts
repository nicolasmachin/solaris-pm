import { apiClient } from "./axios";

export type PipelineModalidadPago = "CONTADO" | "FINANCIADO" | "DIRECTO_50_50";
export type PipelineTipoObra = "PROPIA" | "TERCERIZADA";
export type PipelineStageName =
  | "ONBOARDING"
  | "INGENIERIA"
  | "OPERACIONES"
  | "HABILITACION_UTE"
  | "POSTVENTA";

export interface PipelineChecklistItem {
  label: string;
  isRequired?: boolean;
  isBlocker?: boolean;
  appliesWhenModalidadPago?: PipelineModalidadPago | null;
}

export interface PipelineSubstage {
  order: number;
  name: string;
  sopCode?: string | null;
  responsableRol?: string | null;
  responsible: string;
  isSystem?: boolean;
  isActive?: boolean;
  operationVariant?: PipelineTipoObra | null;
  checklist?: PipelineChecklistItem[];
}

export interface PipelineStage {
  order: number;
  name: PipelineStageName;
  label?: string | null;
  weight: number;
  substages: PipelineSubstage[];
}

export interface PipelineTemplateResponse {
  stages: PipelineStage[];
  isCustom: boolean;
  updatedAt: string | null;
}

export async function getPipelineTemplate(): Promise<PipelineTemplateResponse> {
  const { data } = await apiClient.get<PipelineTemplateResponse>("/api/pipeline-template");
  return data;
}

export async function putPipelineTemplate(
  stages: PipelineStage[],
): Promise<PipelineTemplateResponse> {
  const { data } = await apiClient.put<PipelineTemplateResponse>("/api/pipeline-template", {
    stages,
  });
  return data;
}

export async function resetPipelineTemplate(): Promise<void> {
  await apiClient.delete("/api/pipeline-template");
}

import { apiClient } from "./axios";
import type { StageType } from "../types/deadline.types";

export type PipelineModalidadPago = "CONTADO" | "FINANCIADO" | "DIRECTO_50_50";
export type PipelineTipoObra = "PROPIA" | "TERCERIZADA";
// Cualquier StageType del pipeline actual (8 etapas + bloques CX). El backend
// valida que el set coincida con el pipeline por defecto; el editor no está
// atado a un número fijo de etapas.
export type PipelineStageName = StageType;

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

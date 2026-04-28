import { apiClient } from './axios';

export interface TriangleSavePayload {
  mode: 'L-angle' | 'L-height' | 'height-angle';
  unit: 'mm' | 'cm' | 'm';
  values: { L?: number; height?: number; angle?: number };
  result: {
    L: number;
    height: number;
    angle: number;
    backLeg: number;
    totalMaterial: number;
  };
  svgString: string;
  jpgBase64: string;
}

export interface TriangleSaveResponse {
  jpgFileId: string;
  pdfFileId: string;
}

export const saveTriangleCalculation = (projectId: string, payload: TriangleSavePayload) =>
  apiClient
    .post<TriangleSaveResponse>(`/api/projects/${projectId}/triangle-calculation/save`, payload)
    .then(r => r.data);
